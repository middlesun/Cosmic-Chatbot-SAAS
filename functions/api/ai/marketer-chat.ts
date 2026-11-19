import { callUserGeminiRestCf, corsHeaders } from '../../lib/workspace-auth';
import { extractUrlsFromText, fetchWebsiteCopy, isPublicHttpUrl, ScannedPageContext } from '../../lib/url-analyzer';

type CanonicalAssetModule =
  | 'email'
  | 'comment'
  | 'contact'
  | 'dm'
  | 'article'
  | 'social_post'
  | 'support_faq'
  | 'support_macro'
  | 'directory_tagline'
  | 'directory_pitch'
  | 'directory_summary'
  | 'directory_description'
  | 'vault';

function parseAssistantStructuredJson(rawContent: string): { reply: string; assets: any[] } {
  const raw = String(rawContent || '').trim();
  if (!raw) return { reply: '', assets: [] };

  const tryParse = (candidate: string) => {
    try {
      const obj = JSON.parse(candidate);
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        const reply = typeof obj.reply === 'string' ? obj.reply.trim() : '';
        const rawAssets = Array.isArray(obj.assets)
          ? obj.assets
          : (Array.isArray(obj.deliverables) ? obj.deliverables : []);
        if (reply || rawAssets.length > 0) {
          return { reply: reply || 'Here are the generated variations:', assets: rawAssets };
        }
      }
    } catch {
      return null;
    }
    return null;
  };

  const fenceStripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  const direct = tryParse(fenceStripped);
  if (direct) return direct;

  const firstBrace = fenceStripped.indexOf('{');
  const lastBrace = fenceStripped.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const sliced = tryParse(fenceStripped.slice(firstBrace, lastBrace + 1));
    if (sliced) return sliced;
  }

  return { reply: raw, assets: [] };
}

function normalizeMarketerAssets(rawList: any[]): any[] {
  const validModules = new Set<CanonicalAssetModule>([
    'email',
    'comment',
    'contact',
    'dm',
    'article',
    'social_post',
    'support_faq',
    'support_macro',
    'directory_tagline',
    'directory_pitch',
    'directory_summary',
    'directory_description',
    'vault',
  ]);

  return (Array.isArray(rawList) ? rawList : [])
    .map((item, idx) => {
      if (!item || typeof item !== 'object') return null;
      const body = String(item.body || item.content || item.text || item.answer || '').trim();
      if (!body) return null;

      let modRaw = String(item.suggestedModule || item.module || 'comment').toLowerCase().trim();
      const targetFieldRaw = String(item.targetField || '').trim().toLowerCase();

      if (modRaw === 'contact_form' || modRaw === 'contact-form' || modRaw === 'outreach') {
        modRaw = 'contact';
      } else if (modRaw === 'comments') {
        modRaw = 'comment';
      } else if (modRaw === 'emails') {
        modRaw = 'email';
      } else if (modRaw === 'dms') {
        modRaw = 'dm';
      } else if (modRaw === 'articles' || modRaw === 'blog' || modRaw === 'blogs') {
        modRaw = 'article';
      } else if (modRaw === 'social' || modRaw === 'social-post' || modRaw === 'social_posts' || modRaw === 'socialposts') {
        modRaw = 'social_post';
      } else if (modRaw === 'faq' || modRaw === 'faqs' || modRaw === 'support-faq') {
        modRaw = 'support_faq';
      } else if (modRaw === 'support' || modRaw === 'macro' || modRaw === 'macros' || modRaw === 'support-macro') {
        modRaw = 'support_macro';
      } else if (modRaw === 'content_vault' || modRaw === 'content-vault' || modRaw === 'idea') {
        modRaw = 'vault';
      } else if (modRaw === 'directory' || modRaw === 'directories') {
        if (targetFieldRaw === 'tagline') modRaw = 'directory_tagline';
        else if (targetFieldRaw === 'pitch' || targetFieldRaw === 'elevatorpitch') modRaw = 'directory_pitch';
        else if (targetFieldRaw === 'shortsummary' || targetFieldRaw === 'summary' || targetFieldRaw === 'mediumsummary') modRaw = 'directory_summary';
        else if (targetFieldRaw === 'fulldescription' || targetFieldRaw === 'description' || targetFieldRaw === 'longdescription') modRaw = 'directory_description';
        else if (body.length <= 60) modRaw = 'directory_tagline';
        else if (body.length <= 140) modRaw = 'directory_pitch';
        else if (body.length <= 250) modRaw = 'directory_summary';
        else modRaw = 'directory_description';
      }

      const suggestedModule: CanonicalAssetModule = validModules.has(modRaw as CanonicalAssetModule)
        ? (modRaw as CanonicalAssetModule)
        : 'comment';

      const targetField = suggestedModule === 'directory_tagline'
        ? 'tagline'
        : suggestedModule === 'directory_pitch'
          ? 'pitch'
          : suggestedModule === 'directory_summary'
            ? 'shortSummary'
            : suggestedModule === 'directory_description'
              ? 'fullDescription'
              : undefined;

      return {
        id: String(item.id || `asset-${Date.now()}-${idx + 1}`),
        suggestedModule,
        label: String(item.label || `Option ${idx + 1}`).slice(0, 90),
        platform: item.platform ? String(item.platform).trim().slice(0, 40) : undefined,
        format: item.format ? String(item.format).trim().slice(0, 30) : undefined,
        hook: item.hook ? String(item.hook).trim().slice(0, 180) : undefined,
        subject: item.subject ? String(item.subject).trim().slice(0, 180) : undefined,
        title: (item.title || item.question) ? String(item.title || item.question).trim().slice(0, 180) : undefined,
        category: item.category ? String(item.category).trim().slice(0, 60) : undefined,
        targetField,
        body,
        content: body,
      };
    })
    .filter(Boolean);
}

export async function onRequestOptions() {
  return new Response(null, { status: 200, headers: corsHeaders });
}

export async function onRequestPost(context: { request: Request; env: any }) {
  try {
    const body: any = await context.request.json().catch(() => ({}));
    const {
      messages = [],
      brandContext = null,
      brand = {},
      scannedSites = [],
      scannedContexts = [],
      activeTabContext = null,
      autoScanUrls = true,
      openRouterKey = '',
      geminiApiKey = '',
      aiModel = '',
      postingRulesSummary = '',
      mode = 'chat',
      refineType = '',
      missingAssetsAudit = null,
    } = body || {};

    const effectiveOrKey = String(openRouterKey || '').trim();
    const userGeminiKey = String(geminiApiKey || '').trim();

    if (!effectiveOrKey && !userGeminiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          needsApiKey: true,
          error: 'OpenRouter or Google Gemini API key required. Please configure your own AI API key in Settings.',
        }),
        { status: 401, headers: corsHeaders }
      );
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'At least one chat message is required.' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const sanitizedMessages = messages
      .filter((m: any) => {
        if (!m || (m.role !== 'user' && m.role !== 'assistant')) return false;
        const hasText = typeof m.content === 'string' && m.content.trim().length > 0;
        const hasImgs = Array.isArray(m.images) && m.images.length > 0;
        return hasText || hasImgs;
      })
      .slice(-16)
      .map((m: any) => {
        const imgs = (Array.isArray(m.images) ? m.images : [])
          .slice(0, 4)
          .map((img: any) => {
            if (!img) return null;
            const rawUrl = String(typeof img === 'string' ? img : (img.dataUrl || img.url || '')).trim();
            if (!rawUrl) return null;
            if (!rawUrl.startsWith('data:image/') && !/^https?:\/\//i.test(rawUrl)) return null;
            return {
              url: rawUrl,
              mimeType: typeof img === 'object' && img.mimeType ? String(img.mimeType) : '',
              name: typeof img === 'object' && img.name ? String(img.name).slice(0, 80) : '',
            };
          })
          .filter(Boolean) as Array<{ url: string; mimeType: string; name: string }>;
        return {
          role: m.role as 'user' | 'assistant',
          content: String(m.content || '').trim().slice(0, 12000),
          images: imgs,
        };
      });

    if (sanitizedMessages.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Message content cannot be empty.' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const mergedContexts: ScannedPageContext[] = [];
    const seenContextDomains = new Set<string>();
    const addContext = (ctx: any) => {
      if (!ctx || typeof ctx !== 'object') return;
      const urlStr = String(ctx.url || '').trim();
      const domainStr = String(ctx.domain || '').trim() || (urlStr ? urlStr.replace(/^https?:\/\/(www\.)?/i, '').split('/')[0] : '');
      const descStr = String(ctx.metaDescription || ctx.description || '').slice(0, 500);
      const bodyStr = String(ctx.bodyCopy || ctx.copy || '').slice(0, 3500);
      const key = `${domainStr.toLowerCase()}|${urlStr.toLowerCase()}`;
      if (!domainStr && !bodyStr && !ctx.title) return;
      if (seenContextDomains.has(key)) return;
      seenContextDomains.add(key);
      mergedContexts.push({
        sourceType: ctx.sourceType === 'tab' ? 'tab' : (ctx.sourceType === 'brand' ? 'brand' : 'url'),
        url: urlStr,
        domain: domainStr,
        title: String(ctx.title || '').slice(0, 240),
        metaDescription: descStr,
        description: descStr,
        headings: Array.isArray(ctx.headings) ? ctx.headings.slice(0, 12).map((h: any) => String(h).slice(0, 180)) : [],
        ctaTexts: Array.isArray(ctx.ctaTexts) ? ctx.ctaTexts.slice(0, 8).map((c: any) => String(c).slice(0, 80)) : [],
        bodyCopy: bodyStr,
        copy: bodyStr,
        platform: ctx.platform ? String(ctx.platform) : undefined,
        scannedAt: ctx.scannedAt ? String(ctx.scannedAt) : undefined,
      });
    };

    if (activeTabContext) addContext({ ...activeTabContext, sourceType: 'tab' });
    if (Array.isArray(scannedSites)) scannedSites.forEach(addContext);
    if (Array.isArray(scannedContexts)) scannedContexts.forEach(addContext);

    const activeBrand = (brandContext && typeof brandContext === 'object' && Object.keys(brandContext).length > 0)
      ? brandContext
      : (brand && typeof brand === 'object' ? brand : {});

    const brandName = String(activeBrand?.name || activeBrand?.brandName || '').trim();
    const brandUrl = String(activeBrand?.url || activeBrand?.website || activeBrand?.websiteUrl || '').trim();
    const brandTagline = String(activeBrand?.tagline || '').trim();
    const brandDesc = String(activeBrand?.description || activeBrand?.longPitch || activeBrand?.brandAssets?.longPitch || activeBrand?.pitch || '').trim();
    const brandCategory = String(activeBrand?.category || '').trim();
    const brandPricing = String(activeBrand?.pricingSummary || activeBrand?.brandAssets?.pricingSummary || activeBrand?.pricing || activeBrand?.pricingModel || '').trim();
    const brandPersona = String(activeBrand?.senderName || activeBrand?.persona || activeBrand?.authorName || '').trim();

    const newlyScannedSources: ScannedPageContext[] = [];
    if (autoScanUrls !== false) {
      const lastUserMsg = [...sanitizedMessages].reverse().find((m) => m.role === 'user');
      if (lastUserMsg) {
        const candidateUrls = extractUrlsFromText(lastUserMsg.content);
        for (const candidate of candidateUrls) {
          const parsed = isPublicHttpUrl(candidate);
          if (!parsed) continue;
          const domainKey = parsed.hostname.replace(/^www\./, '').toLowerCase();
          const alreadyScanned = mergedContexts.some((c) => c.domain.toLowerCase() === domainKey || c.url.toLowerCase() === parsed.href.toLowerCase());
          if (!alreadyScanned) {
            const scanRes = await fetchWebsiteCopy(parsed.href);
            if (scanRes.success) {
              addContext(scanRes.context);
              newlyScannedSources.push(scanRes.context);
            }
          }
        }
      }
      if (brandUrl) {
        const parsedBrandUrl = isPublicHttpUrl(brandUrl);
        if (parsedBrandUrl) {
          const bDomain = parsedBrandUrl.hostname.replace(/^www\./, '').toLowerCase();
          const hasBrandSiteCtx = mergedContexts.some((c) => c.domain.toLowerCase() === bDomain || c.url.toLowerCase() === parsedBrandUrl.href.toLowerCase());
          const hasRichBrandCopy = Boolean(brandDesc.length > 140 || (Array.isArray(activeBrand?.comments) && activeBrand.comments.length > 0) || (Array.isArray(activeBrand?.emails) && activeBrand.emails.length > 0));
          if (!hasBrandSiteCtx && !hasRichBrandCopy) {
            const brandScan = await fetchWebsiteCopy(parsedBrandUrl.href).catch(() => null);
            if (brandScan && brandScan.success && brandScan.context) {
              addContext({ ...brandScan.context, sourceType: 'brand' });
              newlyScannedSources.push({ ...brandScan.context, sourceType: 'brand' });
            }
          }
        }
      }
    }

    const ba = activeBrand?.brandAssets && typeof activeBrand.brandAssets === 'object' ? activeBrand.brandAssets : {};
    const extraBaLines: string[] = [];
    if (Array.isArray(ba.shortPitches) && ba.shortPitches.length) {
      const spList = ba.shortPitches.map((s: any) => String(typeof s === 'string' ? s : s?.text || '').trim()).filter(Boolean);
      if (spList.length) extraBaLines.push(`- Short Pitch Variations: ${spList.slice(0, 12).join(' || ')}`);
    } else if (ba.shortPitch) {
      extraBaLines.push(`- Short Pitch: ${String(ba.shortPitch)}`);
    }
    if (ba.targetAudience) extraBaLines.push(`- Target Audience: ${String(ba.targetAudience).slice(0, 700)}`);
    if (ba.founderStory) extraBaLines.push(`- Founder Story: ${String(ba.founderStory).slice(0, 900)}`);
    if (Array.isArray(ba.features) && ba.features.length) {
      extraBaLines.push(`- Key Features: ${ba.features.slice(0, 16).map((f: any) => typeof f === 'string' ? f : [f?.title, f?.detail].filter(Boolean).join(': ')).filter(Boolean).join(' | ').slice(0, 1200)}`);
    }
    if (Array.isArray(ba.benefits) && ba.benefits.length) {
      extraBaLines.push(`- Core Benefits: ${ba.benefits.slice(0, 16).map((f: any) => typeof f === 'string' ? f : [f?.title, f?.detail].filter(Boolean).join(': ')).filter(Boolean).join(' | ').slice(0, 1000)}`);
    }
    if (Array.isArray(ba.competitors) && ba.competitors.length) {
      extraBaLines.push(`- Competitor Positioning: ${ba.competitors.slice(0, 12).map((c: any) => `${c?.name || ''}: ${c?.advantage || ''}`).filter(Boolean).join(' || ').slice(0, 900)}`);
    }
    if (Array.isArray(ba.proof?.testimonials) && ba.proof.testimonials.length) {
      extraBaLines.push(`- Testimonials: ${ba.proof.testimonials.filter((t: any) => t?.quote).slice(0, 8).map((t: any) => `"${String(t.quote).slice(0, 180)}"`).join(' | ')}`);
    }
    if (ba.tone?.forbiddenWords) extraBaLines.push(`- Forbidden Words / Claims (NEVER USE): ${String(ba.tone.forbiddenWords).slice(0, 300)}`);
    if (Array.isArray(ba.customSections) && ba.customSections.length) {
      extraBaLines.push(`- Custom Brand Sections: ${ba.customSections.filter((s: any) => s?.title && s?.content).slice(0, 10).map((s: any) => `${String(s.title).trim()}: ${String(s.content).trim().slice(0, 300)}`).join(' || ')}`);
    }
    if (activeBrand?.directory && typeof activeBrand.directory === 'object') {
      const dirTags = (activeBrand.directory.taglines || []).slice(0, 12).map((x: any) => String(x?.text || x || '').trim()).filter(Boolean);
      const dirPitches = (activeBrand.directory.pitches || []).slice(0, 12).map((x: any) => String(x?.text || x || '').trim()).filter(Boolean);
      const dirDescs = (activeBrand.directory.descriptions || []).slice(0, 6).map((x: any) => String(x?.text || x || '').trim().slice(0, 400)).filter(Boolean);
      if (dirTags.length) extraBaLines.push(`- Directory Taglines: ${dirTags.join(' || ')}`);
      if (dirPitches.length) extraBaLines.push(`- Directory Pitches: ${dirPitches.join(' || ')}`);
      if (dirDescs.length) extraBaLines.push(`- Directory Descriptions: ${dirDescs.join(' || ')}`);
    }
    if (Array.isArray(activeBrand?.comments) && activeBrand.comments.length) {
      extraBaLines.push(`- Saved Comment Templates (${activeBrand.comments.length}): ${activeBrand.comments.slice(0, 25).map((c: any) => String(typeof c === 'string' ? c : c?.text || '').trim().slice(0, 260)).filter(Boolean).join(' || ')}`);
    }
    if (activeBrand?.contact?.messages?.length || activeBrand?.contact?.message) {
      const cMsgs = (Array.isArray(activeBrand.contact?.messages) ? activeBrand.contact.messages : [activeBrand.contact?.message]).slice(0, 15).map((m: any) => String(m?.text || m || '').trim().slice(0, 300)).filter(Boolean);
      if (cMsgs.length) extraBaLines.push(`- Contact Form Messages (${cMsgs.length}): ${cMsgs.join(' || ')}`);
    }
    if (Array.isArray(activeBrand?.emails) && activeBrand.emails.length) {
      extraBaLines.push(`- Cold Email Templates (${activeBrand.emails.length}): ${activeBrand.emails.slice(0, 15).map((e: any) => `Subject: ${String(e?.subject || '').trim()} | ${String(e?.body || '').trim().slice(0, 350)}`).join(' || ')}`);
    }
    if (Array.isArray(activeBrand?.dms) && activeBrand.dms.length) {
      extraBaLines.push(`- DM Templates (${activeBrand.dms.length}): ${activeBrand.dms.slice(0, 15).map((d: any) => `[${d?.platform || 'DM'}] ${String(d?.message || d?.body || '').trim().slice(0, 240)}`).join(' || ')}`);
    }
    if (Array.isArray(activeBrand?.socialPosts) && activeBrand.socialPosts.length) {
      extraBaLines.push(`- Social Post Samples (${activeBrand.socialPosts.length}): ${activeBrand.socialPosts.slice(0, 15).map((p: any) => `[${p?.platform || 'Social'}] ${String(p?.hook || '')} ${String(p?.body || '').trim().slice(0, 260)}`).join(' || ')}`);
    }
    if (Array.isArray(activeBrand?.articles) && activeBrand.articles.length) {
      extraBaLines.push(`- Articles & Blogs (${activeBrand.articles.length}): ${activeBrand.articles.slice(0, 10).map((a: any) => `${String(a?.title || '').trim()}: ${String(a?.body || '').trim().slice(0, 380)}`).join(' || ')}`);
    }
    if (Array.isArray(activeBrand?.support?.faqs) && activeBrand.support.faqs.length) {
      extraBaLines.push(`- Support FAQs (${activeBrand.support.faqs.length}): ${activeBrand.support.faqs.slice(0, 15).map((f: any) => `${f?.question || ''}: ${String(f?.answer || '').slice(0, 220)}`).join(' | ')}`);
    }
    if (Array.isArray(activeBrand?.support?.macros) && activeBrand.support.macros.length) {
      extraBaLines.push(`- Support Macros (${activeBrand.support.macros.length}): ${activeBrand.support.macros.slice(0, 15).map((m: any) => `${m?.title || ''}: ${String(m?.body || '').slice(0, 220)}`).join(' | ')}`);
    }
    if (Array.isArray(activeBrand?.contentVault) && activeBrand.contentVault.length) {
      extraBaLines.push(`- Content Vault Ideas & Drafts (${activeBrand.contentVault.length}): ${activeBrand.contentVault.slice(0, 20).map((v: any) => `${v?.title ? `[${v.title}] ` : ''}${String(v?.body || '').slice(0, 240)}`).join(' || ')}`);
    }

    const brandContextBlock = brandName || brandUrl || extraBaLines.length > 0
      ? `ACTIVE WORKSPACE PRODUCT / BRAND (always ground content in all saved Brand Assets, modules, and Vault items below unless the user explicitly points you at another product/URL):
- Brand Name: ${brandName || 'N/A'}
- Website: ${brandUrl || 'N/A'}
- Tagline: ${brandTagline || 'N/A'}
- Description / Pitch: ${brandDesc || 'N/A'}
- Category: ${brandCategory || 'N/A'}
- Pricing: ${brandPricing || 'N/A'}
- Sender / Persona: ${brandPersona || 'Co-Founder & Growth Marketer'}${extraBaLines.length ? '\n' + extraBaLines.join('\n') : ''}`.slice(0, 18000)
      : 'No active workspace brand profile selected yet.';

    const scannedBlock = mergedContexts.length > 0
      ? `SCANNED WEBSITE / ACTIVE TAB / THREAD CONTEXTS:\n${mergedContexts.map((c, i) => [
          `[Source ${i + 1} — ${c.sourceType === 'tab' ? 'ACTIVE BROWSER TAB' : (c.sourceType === 'brand' ? 'BRAND WEBSITE' : 'SCANNED URL')}: ${c.domain || c.url}]`,
          c.url ? `URL: ${c.url}` : '',
          c.title ? `Title: ${c.title}` : '',
          c.metaDescription ? `Meta Description: ${c.metaDescription}` : '',
          c.headings.length ? `Key Headings: ${c.headings.join(' | ')}` : '',
          c.ctaTexts.length ? `Primary CTAs: ${c.ctaTexts.join(' | ')}` : '',
          c.bodyCopy ? `Extracted Copy Excerpt: ${c.bodyCopy}` : '',
        ].filter(Boolean).join('\n')).join('\n\n')}`
      : 'No external websites or browser tabs scanned yet in this conversation.';

    const extraPostingRules = String(postingRulesSummary || '').trim()
      ? `\nAdditional Campaign/Posting Rules:\n${String(postingRulesSummary).trim().slice(0, 1200)}`
      : '';

    const modeHintBlock = mode === 'complete_missing_assets'
      ? `\nTASK MODE — COMPLETE MISSING ASSETS AUDIT:\nMissing / under-populated Product slots to fill:\n${JSON.stringify(missingAssetsAudit || {}).slice(0, 2500)}\nGenerate ready-to-save structured deliverables in "assets" targeting each missing slot cleanly.`
      : (mode === 'refine' && refineType
        ? `\nTASK MODE — ONE-CLICK REFINEMENT ("${String(refineType).slice(0, 40)}"):\nApply the requested transformation cleanly while respecting the Product's voice, forbidden words, and platform rules.`
        : '');

    const systemPrompt = `You are a Master Growth Marketer, Copywriter, and Strategic Co-Founder inside Smart Poster. You help founders brainstorm positioning, dissect competitor pages/screenshots, plan GTM campaigns, engage organically in communities, and write persuasive copy across EVERY selling intensity—from 100% non-salesy organic insight to soft-promotional peer recommendations to direct hardcore sales copy—matched precisely to the user's request.

MANDATORY 3-TIER TONE & LANGUAGE ADAPTATION CASCADE:
1. TIER 1 (Brand Assets & Saved Content): First study the voice, tone, vocabulary, formality, emojis, sentence rhythm, and written language inside the Brand Assets, saved Comments, Emails, DMs, Social Posts, Articles, Support FAQs, and Content Vault below. Always write in that exact voice and language.
2. TIER 2 (Website Copy Fallback): If Brand Assets and existing module items are sparse or empty, infer the tone, voice, and language directly from the Product's website copy provided in context.
3. TIER 3 (Niche Fallback): If neither is available, adapt naturally to the conventions of the inferred Product category/niche.

CORE MARKETING & WRITING PRINCIPLES:
1. CO-FOUNDER THINKING + EXECUTION: When the user is brainstorming, planning, or analyzing a screenshot/competitor page, give sharp strategic insights ("assets": [] when no final copy was asked for). When asked to write copy, put each variation/deliverable cleanly inside "assets".
2. FULL SALES SPECTRUM CONTROL: Adapt selling intensity cleanly to the channel & prompt:
   - Community/Reddit/HN/Quora comments & organic engagement: Helpful, grounded, zero fluff, zero fake hype unless user explicitly asks for a launch pitch.
   - Direct outreach/landing copy/hardcore sales offers: Strong hooks, clear proof, concrete urgency/CTA without robotic AI clichés.
3. ANTI-SLOP & FORBIDDEN WORDS: Never use hollow AI filler ("As an AI...", "In today's fast-paced digital landscape...", "delve", "testament to", "game-changer", "unlock your potential", "revolutionize"). Strictly avoid any term listed under "Forbidden Words / Claims (NEVER USE)".
4. LONG-FORM DEPTH WHEN ASKED: For educational breakdowns, comparisons, or articles (600–1,500+ words), deliver substantive, structured value—not padded filler.
5. MULTIMODAL & SCREENSHOT ANALYSIS: When images/screenshots are attached, inspect visual hierarchy, messaging gaps, objections, and copy angles specifically before drafting.
6. SEPARATE DELIVERABLES: Put each variation, email, social post, FAQ, or directory field length as its own object inside "assets".

PLATFORM & POSTING RULES (POSTING_RULES.md):
- Twitter / X: NEVER include "https://" or "http://"—use clean domains like "domain.com" so links post cleanly without truncation glitches.
- Formatting: Preserve clean line breaks and strip leading/trailing whitespace.
- Spintax: When asked for spintax, use clean single-level {option1|option2} compatible with Smart Poster's Randomness Engine (never spin URLs or brand names).
- Directory Submission Field Limits (STRICT):
  - "directory_tagline": <= 60 characters
  - "directory_pitch": <= 140 characters
  - "directory_summary": <= 250 characters
  - "directory_description": full product overview${extraPostingRules}${modeHintBlock}

SUPPORTED "suggestedModule" VALUES:
- "social_post", "comment", "contact", "email", "dm", "article", "support_faq", "support_macro", "directory_tagline", "directory_pitch", "directory_summary", "directory_description", "vault"

${brandContextBlock}

${scannedBlock}

RESPONSE FORMAT (CRITICAL):
Respond with ONLY a valid JSON object matching this exact schema (no markdown code fences wrapping the outer JSON):
{
  "reply": "Conversational co-founder strategy, teardown notes, or concise summary in plain markdown",
  "assets": [
    {
      "id": "asset-1",
      "suggestedModule": "email",
      "label": "Short display label e.g. Email #1 - Direct Angle",
      "platform": "optional e.g. X|LinkedIn|Reddit",
      "hook": "optional opening hook for social_post",
      "title": "Article title / FAQ question / Macro title / Vault title",
      "subject": "Email or Contact subject if email/contact",
      "category": "optional Support FAQ/Macro category",
      "body": "Ready-to-use copy"
    }
  ]
}`;

    const effectiveModel = String(aiModel || '').trim() || 'deepseek/deepseek-chat';
    let rawContent = '';
    let responseSource = '';
    let responseModel = effectiveModel;
    let responseUsage: any = null;
    let lastOpenRouterStatus = 0;
    let lastOpenRouterError = '';

    const openRouterMessages = sanitizedMessages.map((m) => {
      if (m.images && m.images.length > 0 && m.role === 'user') {
        const contentParts: any[] = [];
        if (m.content) contentParts.push({ type: 'text', text: m.content });
        m.images.forEach((img) => {
          contentParts.push({ type: 'image_url', image_url: { url: img.url } });
        });
        return { role: m.role, content: contentParts };
      }
      return { role: m.role, content: m.content };
    });

    if (effectiveOrKey) {
      const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${effectiveOrKey}`,
          'HTTP-Referer': 'https://smartposter.pro',
          'X-Title': 'Smart Poster AI Marketer Assistant',
        },
        body: JSON.stringify({
          model: effectiveModel,
          messages: [
            { role: 'system', content: systemPrompt },
            ...openRouterMessages,
          ],
          temperature: mode === 'refine' ? 0.45 : 0.72,
          max_tokens: 4000,
        }),
      });

      if (orRes.ok) {
        const orData: any = await orRes.json();
        rawContent = String(orData?.choices?.[0]?.message?.content || '').trim();
        responseSource = `openrouter (${effectiveModel})`;
        responseUsage = orData?.usage || null;
      } else {
        lastOpenRouterStatus = orRes.status;
        const errText = await orRes.text().catch(() => '');
        lastOpenRouterError = `OpenRouter returned HTTP ${orRes.status}`;
        try {
          const parsedErr = JSON.parse(errText);
          if (parsedErr?.error?.message) lastOpenRouterError = parsedErr.error.message;
        } catch {
          if (errText) lastOpenRouterError = errText.slice(0, 220);
        }
      }
    }

    if (!rawContent && userGeminiKey) {
      try {
        const toBase64 = (ab: ArrayBuffer) => {
          const bytes = new Uint8Array(ab);
          let bin = '';
          for (let i = 0; i < bytes.length; i += 8192) {
            bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
          }
          return btoa(bin);
        };
        const geminiImages: Array<{ mimeType: string; data: string }> = [];
        for (const m of sanitizedMessages) {
          if (m.role !== 'user' || !m.images?.length) continue;
          for (const img of m.images) {
            if (geminiImages.length >= 4) break;
            if (img.url.startsWith('data:image/')) {
              const match = img.url.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
              if (match) geminiImages.push({ mimeType: match[1], data: match[2] });
            } else if (/^https?:\/\//i.test(img.url)) {
              try {
                const imgRes = await fetch(img.url);
                if (imgRes.ok) {
                  const ct = imgRes.headers.get('content-type') || 'image/webp';
                  const ab = await imgRes.arrayBuffer();
                  if (ab.byteLength <= 2_500_000) {
                    geminiImages.push({ mimeType: ct.split(';')[0], data: toBase64(ab) });
                  }
                }
              } catch {}
            }
          }
        }
        const transcriptPrompt = sanitizedMessages
          .map((m) => `${m.role === 'user' ? 'USER' : 'ASSISTANT'}: ${m.content}${m.images?.length ? ` [${m.images.length} attached image(s)]` : ''}`)
          .join('\n\n');
        const gemResult = await callUserGeminiRestCf({
          apiKey: userGeminiKey,
          model: aiModel,
          systemInstruction: systemPrompt,
          prompt: transcriptPrompt,
          images: geminiImages.length > 0 ? geminiImages : undefined,
          temperature: mode === 'refine' ? 0.45 : 0.72,
          maxOutputTokens: 4000,
          jsonMode: true,
        });
        if (gemResult.ok && gemResult.text) {
          rawContent = gemResult.text;
          responseSource = `gemini (${gemResult.model})`;
          responseModel = gemResult.model;
        } else if (!lastOpenRouterStatus && gemResult.status) {
          lastOpenRouterStatus = gemResult.status;
          lastOpenRouterError = gemResult.error || 'Gemini request failed';
        }
      } catch (e: any) {
        if (!lastOpenRouterError) lastOpenRouterError = e?.message || 'Gemini request failed';
      }
    }

    if (!rawContent) {
      if (lastOpenRouterStatus) {
        return new Response(
          JSON.stringify({
            success: false,
            needsApiKey: lastOpenRouterStatus === 401 || lastOpenRouterStatus === 403,
            error: lastOpenRouterError,
          }),
          { status: lastOpenRouterStatus, headers: corsHeaders }
        );
      }
      return new Response(
        JSON.stringify({ success: false, error: 'AI model returned an empty response.' }),
        { status: 502, headers: corsHeaders }
      );
    }

    const parsed = parseAssistantStructuredJson(rawContent);
    const assets = normalizeMarketerAssets(parsed.assets);

    return new Response(
      JSON.stringify({
        success: true,
        reply: parsed.reply,
        assets,
        deliverables: assets,
        scannedSources: newlyScannedSources,
        model: responseModel,
        source: responseSource,
        usage: responseUsage,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'AI Assistant chat error' }),
      { status: 500, headers: corsHeaders }
    );
  }
}
