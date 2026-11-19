import {
  buildAutoVaryBatchPrompts,
  buildAutoVaryLocalFallback,
  filterValidatedAutoVariations,
  normalizeCreativityLevel,
  parseVariationsJsonOrList,
} from '../../lib/auto-variation';
import { callUserGeminiRestCf } from '../../lib/workspace-auth';

interface Env {}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

export async function onRequestOptions() {
  return new Response(null, {
    status: 200,
    headers: corsHeaders,
  });
}

function buildFullBrandContextBlock(brand: any): string {
  if (!brand || typeof brand !== 'object') return 'Use ONLY the provided text context.';
  const lines: string[] = [];
  const push = (label: string, val: any, maxLen = 400) => {
    const str = String(val || '').trim();
    if (str) lines.push(`${label}: ${str.slice(0, maxLen)}`);
  };
  const listTexts = (arr: any[], maxItems = 4, maxLen = 220): string => {
    if (!Array.isArray(arr) || arr.length === 0) return '';
    return arr
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (item && typeof item === 'object') {
          if (item.subject && item.body) return `Subject: ${String(item.subject).trim()} | Body: ${String(item.body).trim()}`;
          if (item.title && item.body) return `${String(item.title).trim()}: ${String(item.body).trim()}`;
          return String(item.text || item.message || item.body || item.title || '').trim();
        }
        return '';
      })
      .filter(Boolean)
      .slice(0, maxItems)
      .map((s) => s.slice(0, maxLen))
      .join(' || ');
  };

  push('Brand / Product Name', brand.name || brand.brandName, 120);
  push('Website URL', brand.website || brand.url, 200);
  push('One-Line Tagline', brand.tagline, 200);
  push('Short Pitch', brand.shortPitch || brand.brandAssets?.shortPitch || brand.pitch, 600);
  const shortVars = Array.isArray(brand.brandAssets?.shortPitches)
    ? brand.brandAssets.shortPitches.map((s: any) => String(typeof s === 'string' ? s : s?.text || '').trim()).filter(Boolean)
    : [];
  if (shortVars.length > 1) {
    lines.push(`Short Pitch Variations: ${shortVars.slice(0, 5).map((s: string) => s.slice(0, 400)).join(' || ')}`);
  }
  push('Long Pitch / Description', brand.longPitch || brand.brandAssets?.longPitch || brand.description || brand.pitch, 2500);
  if (brand.description && brand.description !== brand.pitch && brand.description !== brand.longPitch) {
    push('Extended Product Description', brand.description, 1500);
  }
  push('Target Audience', brand.targetAudience || brand.brandAssets?.targetAudience, 350);
  push('Pricing & Offer Summary', brand.pricingSummary || brand.brandAssets?.pricingSummary || brand.pricing, 400);
  push('Founder Story', brand.founderStory || brand.brandAssets?.founderStory, 500);
  push('Twitter / X Handle', brand.twitter || brand.brandAssets?.handles?.twitter, 80);
  push('Instagram Handle', brand.instagram || brand.brandAssets?.handles?.instagram, 80);

  const ba = brand.brandAssets;
  if (ba && typeof ba === 'object') {
    const fmtPairList = (arr: any[], maxItems = 6) => (Array.isArray(arr) ? arr : [])
      .map((x: any) => (typeof x === 'string' ? x.trim() : [x?.title || x?.name, x?.detail].filter(Boolean).join(': ')))
      .filter(Boolean)
      .slice(0, maxItems)
      .map((s: string) => s.slice(0, 160))
      .join(' | ');
    const feats = fmtPairList(ba.features, 6);
    if (feats) lines.push(`Key Features: ${feats}`);
    const bens = fmtPairList(ba.benefits, 5);
    if (bens) lines.push(`Core Benefits: ${bens}`);
    const comps = (Array.isArray(ba.competitors) ? ba.competitors : [])
      .filter((c: any) => c?.name || c?.advantage)
      .slice(0, 4)
      .map((c: any) => `${String(c.name || '').trim()}: ${String(c.advantage || '').trim()}${c.recommendWhen ? ` (When: ${String(c.recommendWhen).trim()})` : ''}`.slice(0, 200));
    if (comps.length > 0) lines.push(`Competitor Comparisons: ${comps.join(' || ')}`);
    const tests = (Array.isArray(ba.proof?.testimonials) ? ba.proof.testimonials : [])
      .filter((t: any) => t?.quote)
      .slice(0, 2)
      .map((t: any) => `"${String(t.quote).trim().slice(0, 180)}"${t.author ? ` — ${String(t.author).trim()}` : ''}`);
    if (tests.length > 0) lines.push(`Testimonials: ${tests.join(' || ')}`);
    const customLinks = (Array.isArray(ba.customLinks) ? ba.customLinks : [])
      .filter((l: any) => l?.name && l?.url)
      .slice(0, 6)
      .map((l: any) => `${String(l.name).trim()}=${String(l.url).trim()}`);
    const extraLinks = [ba.links?.pricingUrl ? `Pricing=${ba.links.pricingUrl}` : '', ba.links?.docsUrl ? `Docs=${ba.links.docsUrl}` : '', ba.links?.bookingUrl ? `Booking=${ba.links.bookingUrl}` : '', ba.videos?.demoUrl ? `Demo=${ba.videos.demoUrl}` : '', ...customLinks].filter(Boolean);
    if (extraLinks.length > 0) lines.push(`Key Links & Videos: ${extraLinks.join(' | ').slice(0, 450)}`);
    const extraHandles = [ba.handles?.linkedin ? `LinkedIn=${ba.handles.linkedin}` : '', ba.handles?.github ? `GitHub=${ba.handles.github}` : '', ba.handles?.youtube ? `YouTube=${ba.handles.youtube}` : '', ba.handles?.productHunt ? `PH=${ba.handles.productHunt}` : ''].filter(Boolean);
    if (extraHandles.length > 0) lines.push(`Social Handles: ${extraHandles.join(' | ').slice(0, 220)}`);
    push('Forbidden Words / Claims (NEVER USE)', ba.tone?.forbiddenWords, 200);
    const customSections = (Array.isArray(ba.customSections) ? ba.customSections : [])
      .filter((s: any) => s?.title && s?.content)
      .slice(0, 5);
    for (const sec of customSections) {
      push(String(sec.title).trim().slice(0, 80), String(sec.content).trim(), 350);
    }
  }

  const dir = brand.directory;
  if (dir && typeof dir === 'object') {
    push('Directory Product Name', dir.productName, 100);
    push('Category', dir.category, 80);
    push('Pricing Model', [dir.pricingModel, dir.startingPrice].filter(Boolean).join(' — '), 120);
    push('Demo URL', dir.demoUrl, 200);
    const dirTags = listTexts(dir.taglines, 12, 100);
    const dirPitches = listTexts(dir.pitches, 12, 180);
    const dirSummaries = listTexts(dir.summaries, 10, 280);
    const dirDescs = listTexts(dir.descriptions, 8, 600);
    if (dirTags) lines.push(`Directory Taglines: ${dirTags}`);
    if (dirPitches) lines.push(`Directory Pitches: ${dirPitches}`);
    if (dirSummaries) lines.push(`Directory Summaries: ${dirSummaries}`);
    if (dirDescs) lines.push(`Directory Descriptions: ${dirDescs}`);
  }

  const contact = brand.contact;
  if (contact && typeof contact === 'object') {
    push('Sender Name', contact.senderName, 100);
    push('Company', contact.company, 100);
    push('Contact Default Subject', contact.subject, 160);
    const contactMsgs = listTexts(contact.messages, 15, 360) || String(contact.message || '').trim().slice(0, 360);
    if (contactMsgs) lines.push(`Contact Form Message Samples: ${contactMsgs}`);
  }

  const commentSamples = listTexts(brand.comments, 25, 300);
  if (commentSamples) lines.push(`Saved Comment Templates (${Array.isArray(brand.comments) ? brand.comments.length : 0}): ${commentSamples}`);
  const emailSamples = listTexts(brand.emails, 15, 450);
  if (emailSamples) lines.push(`Cold Email Templates (${Array.isArray(brand.emails) ? brand.emails.length : 0}): ${emailSamples}`);
  const dmSamples = listTexts(brand.dms, 15, 320);
  if (dmSamples) lines.push(`DM Templates (${Array.isArray(brand.dms) ? brand.dms.length : 0}): ${dmSamples}`);
  const socialPostSamples = (Array.isArray(brand.socialPosts) ? brand.socialPosts : [])
    .slice(0, 15)
    .map((p: any) => [p?.platform ? `[${String(p.platform).trim()}]` : '', p?.hook || '', p?.body || p?.text || ''].filter(Boolean).join(' ').slice(0, 320))
    .filter(Boolean)
    .join(' || ');
  if (socialPostSamples) lines.push(`Social Post Samples (${Array.isArray(brand.socialPosts) ? brand.socialPosts.length : 0}): ${socialPostSamples}`);
  const faqSamples = (Array.isArray(brand.support?.faqs) ? brand.support.faqs : [])
    .slice(0, 15)
    .map((f: any) => `${String(f?.question || '').trim()}: ${String(f?.answer || '').trim()}`.slice(0, 260))
    .filter((s: string) => s.length > 2)
    .join(' || ');
  if (faqSamples) lines.push(`Support FAQs (${Array.isArray(brand.support?.faqs) ? brand.support.faqs.length : 0}): ${faqSamples}`);
  const macroSamples = listTexts(brand.support?.macros, 15, 280);
  if (macroSamples) lines.push(`Support Macros (${Array.isArray(brand.support?.macros) ? brand.support.macros.length : 0}): ${macroSamples}`);
  const articleSamples = listTexts(brand.articles, 10, 500);
  if (articleSamples) lines.push(`Articles & Blogs (${Array.isArray(brand.articles) ? brand.articles.length : 0}): ${articleSamples}`);
  const vaultSamples = (Array.isArray(brand.contentVault) ? brand.contentVault : [])
    .slice(0, 20)
    .map((v: any) => `${v?.title ? `[${String(v.title).trim()}] ` : ''}${String(v?.body || '').trim()}`.slice(0, 260))
    .filter(Boolean)
    .join(' || ');
  if (vaultSamples) lines.push(`Content Vault Ideas & Drafts (${Array.isArray(brand.contentVault) ? brand.contentVault.length : 0}): ${vaultSamples}`);

  return lines.length > 0 ? lines.join('\n').slice(0, 18000) : 'Use ONLY the provided text context.';
}

function getModuleFormatGuidance(moduleType: string): string {
  const m = String(moduleType || '').toLowerCase();
  if (m === 'directory_tagline' || m === 'directory-taglines' || m === 'taglines') {
    return 'Target Module: Directory Tagline. Keep it crisp and STRICTLY under 60 characters.';
  }
  if (m === 'directory_pitch' || m === 'directory-pitches' || m === 'pitches') {
    return 'Target Module: Directory Elevator Pitch. Keep it compelling and STRICTLY under 140 characters.';
  }
  if (m === 'directory_summary' || m === 'directory-summaries' || m === 'summaries') {
    return 'Target Module: Directory Short Summary. Keep it clear and STRICTLY under 250 characters.';
  }
  if (m === 'directory_description' || m === 'directory-descriptions' || m === 'descriptions') {
    return 'Target Module: Directory Full Description. Provide a well-structured, informative product description.';
  }
  if (m === 'contact_message' || m === 'contact-message' || m === 'contact') {
    return 'Target Module: Contact Form Message body. Write a direct, human B2B/outreach contact form message body.';
  }
  if (m === 'email') {
    return 'Target Module: Cold Outreach Email body. Write a clean, high-converting email body.';
  }
  if (m === 'dm') {
    return 'Target Module: Direct Message (DM). Write a conversational, natural DM.';
  }
  if (m === 'social_post' || m === 'social-post' || m === 'social') {
    return 'Target Module: Native Social Post (X/Twitter, LinkedIn, Threads, Reddit). Write a punchy hook + clean post body. Avoid "https://" for X/Twitter posts unless requested.';
  }
  if (m === 'support_faq' || m === 'support-faq') {
    return 'Target Module: Customer Support FAQ Answer. Write a clear, concise, helpful answer grounded strictly in product details, pricing, and documentation links.';
  }
  if (m === 'support_macro' || m === 'support-macro' || m === 'support') {
    return 'Target Module: Customer Support Reply / Canned Macro. Write a warm, human, non-robotic support reply addressing the issue or question clearly.';
  }
  if (m === 'article') {
    return 'Target Module: Long-Form Article / Blog Post body. Write well-structured, engaging SEO-friendly article prose.';
  }
  return 'Target Module: Social Comment / Outreach post. Keep it natural, human, and concise.';
}

function parseVariationsFromAiOutput(rawOutput: string, expectedCount: number): string[] {
  const cleaned = String(rawOutput || '').trim();
  if (!cleaned) return [];
  if (expectedCount <= 1) return [cleaned];

  const tryJson = (candidate: string): string[] => {
    try {
      const parsed = JSON.parse(candidate);
      const arr = Array.isArray(parsed)
        ? parsed
        : (Array.isArray(parsed?.variations) ? parsed.variations : []);
      return arr.map((x: unknown) => String(x || '').trim()).filter(Boolean);
    } catch {
      return [];
    }
  };

  const unfenced = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  let items = tryJson(unfenced);
  if (items.length === 0) {
    const jsonMatch = unfenced.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (jsonMatch) items = tryJson(jsonMatch[0]);
  }
  if (items.length === 0) {
    items = unfenced
      .split(/\n(?=\s*(?:\d+[.)]|[-*•])\s+)/)
      .map((s) => s.replace(/^\s*(?:\d+[.)]|[-*•])\s+/, '').replace(/^["']|["']$/g, '').trim())
      .filter(Boolean);
  }
  if (items.length === 0) items = [cleaned];

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const item of items) {
    const key = item.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }
  return unique.slice(0, expectedCount);
}

function normalizeClauseForJoin(raw: string): string {
  const s = String(raw || '').trim().replace(/\s+/g, ' ').replace(/[.!?]+$/, '');
  if (!s) return '';
  if (/^[A-Z][a-z]/.test(s)) return s.charAt(0).toLowerCase() + s.slice(1);
  return s;
}

function formatSentenceCase(raw: string): string {
  const s = String(raw || '').trim().replace(/\s+/g, ' ');
  if (!s) return '';
  const capped = /^[a-z]/.test(s) ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  return /[.!?]$/.test(capped) ? capped : `${capped}.`;
}

function startsWithImperativeVerb(raw: string): boolean {
  const first = String(raw || '').trim().toLowerCase().split(/\s+/)[0] || '';
  const verbs = new Set([
    'automate', 'boost', 'build', 'connect', 'convert', 'create', 'discover', 'drive',
    'eliminate', 'find', 'fix', 'generate', 'get', 'grow', 'help', 'increase', 'launch',
    'manage', 'optimize', 'promote', 'reduce', 'run', 'save', 'scale', 'schedule',
    'send', 'ship', 'simplify', 'speed', 'streamline', 'submit', 'track', 'transform',
    'turn', 'unlock', 'write'
  ]);
  return verbs.has(first);
}

function formatSuperlativePhrase(raw: string): string {
  const s = normalizeClauseForJoin(raw);
  if (!s) return '';
  if (/^(easiest|best|fastest|simplest|quickest|smartest|most|top)\b/i.test(s) && !/^the\s+/i.test(s)) {
    return `the ${s}`;
  }
  return s;
}

function buildCampaignCandidatePool(
  brand: { brandName: string; brandTagline: string; brandPitch: string; brandWebsite: string; moduleType?: string; brand?: any },
  customPrompt = ''
): string[] {
  const name = brand.brandName || 'this tool';
  const site = brand.brandWebsite || '';
  const rawTag = String(brand.brandTagline || '').trim();
  const rawPitch = String(brand.brandPitch || '').trim();
  const firstPitchSentence = rawPitch.split(/(?<=[.!?])\s+/)[0] || rawPitch;
  const tagJoined = formatSuperlativePhrase(rawTag);
  const pitchJoined = normalizeClauseForJoin(firstPitchSentence);
  const valueSentence = formatSentenceCase(rawPitch || rawTag || 'Built to save hours of manual work');
  const mod = String(brand.moduleType || '').toLowerCase();
  const senderName = String(brand.brand?.contact?.senderName || '').trim();
  const reqLower = String(customPrompt || '').toLowerCase();

  const pool: string[] = [];
  const siteTail = site ? ` (${site})` : '';
  const siteDash = site ? ` — ${site}` : '';
  const siteAt = site ? ` at ${site}` : '';

  if (mod.includes('tagline')) {
    if (rawTag) pool.push(rawTag.slice(0, 60));
    if (tagJoined) pool.push(`${name}: ${tagJoined}`.slice(0, 60));
    if (pitchJoined) pool.push(formatSentenceCase(firstPitchSentence).replace(/\.$/, '').slice(0, 60));
    pool.push(`${name} — Faster, smarter outreach`.slice(0, 60));
    pool.push(`${name} — Built for effortless growth`.slice(0, 60));
  } else if (mod.includes('pitch')) {
    if (rawTag) {
      const verb = startsWithImperativeVerb(rawTag);
      pool.push((verb ? `${name} lets you ${normalizeClauseForJoin(rawTag)}${siteDash}` : `${name} is ${tagJoined}${siteDash}`).slice(0, 140));
    }
    if (firstPitchSentence) pool.push(`${name}: ${formatSentenceCase(firstPitchSentence)}`.slice(0, 140));
    pool.push(`Meet ${name}${tagJoined ? ` — ${tagJoined}` : ''}${siteAt}.`.slice(0, 140));
    pool.push(`${name} streamlines your workflow${site ? ` — explore more at ${site}` : '.'}`.slice(0, 140));
  } else if (mod.includes('summary') || mod.includes('summaries')) {
    const core = rawPitch || rawTag || 'Streamlines daily outreach and saves hours every week.';
    pool.push(`${name}: ${formatSentenceCase(core)}${site ? ` Learn more at ${site}.` : ''}`.slice(0, 250));
    if (tagJoined) {
      pool.push(`Designed as ${tagJoined}, ${name} ${pitchJoined ? `offers ${pitchJoined}` : 'helps teams ship faster'}${siteAt}.`.slice(0, 250));
    }
    pool.push(`If you want a simpler workflow, ${name} brings everything into one place${siteDash}.`.slice(0, 250));
  } else if (mod === 'email') {
    const signOff = senderName ? `\n\nBest,\n${senderName}` : '';
    pool.push(`Hi there,\n\nI wanted to share ${name}${tagJoined ? ` — ${tagJoined}` : ''}. ${valueSentence}${site ? `\n\nYou can take a quick look here: ${site}` : ''}${signOff}`);
    pool.push(`Hello,\n\nQuick note: we built ${name} for teams looking for ${tagJoined || 'a faster workflow'}. ${valueSentence}${site ? `\n\nHappy to share more details or you can explore it at ${site}.` : ''}${signOff}`);
    pool.push(`Hi,\n\nIf ${tagJoined || 'saving time on manual outreach'} is on your radar this quarter, ${name} might be helpful. ${valueSentence}${site ? `\n\nMore info: ${site}` : ''}${signOff}`);
  } else if (mod === 'dm') {
    pool.push(`Hey! Saw your post and thought ${name} might be useful${tagJoined ? ` — it's ${tagJoined}` : ''}.${site ? ` Happy to share the link if helpful: ${site}` : ''}`);
    pool.push(`Quick heads up — if you're exploring options for ${tagJoined || 'this workflow'}, ${name} is worth a look${siteAt}.`);
    pool.push(`Hey! Have you tried ${name} yet? ${valueSentence}${site ? ` ${site}` : ''}`);
  } else if (mod.includes('contact')) {
    const signOff = senderName ? `\n\nThanks,\n${senderName}` : '';
    pool.push(`Hi team,\n\nReaching out regarding ${name}${tagJoined ? ` (${tagJoined})` : ''}. ${valueSentence}${site ? ` Feel free to check out ${site} if that sounds relevant.` : ''}${signOff}`);
    pool.push(`Hello,\n\nWanted to introduce ${name}. ${valueSentence}${site ? ` You can see how it works at ${site}.` : ''}${signOff}`);
    pool.push(`Hi there,\n\nWe've been helping teams with ${tagJoined || 'faster outreach'} through ${name}. ${valueSentence}${site ? ` More details at ${site}.` : ''}${signOff}`);
  } else if (mod === 'article') {
    pool.push(`## Why ${name} Stands Out\n\n${valueSentence}\n\nWhether you're just getting started or scaling an existing workflow${tagJoined ? `, ${name} gives you ${tagJoined}` : ''}.${site ? ` Explore the full feature set at ${site}.` : ''}`);
    pool.push(`### A Smarter Approach with ${name}\n\n${rawTag ? `${formatSentenceCase(rawTag)} ` : ''}${valueSentence}${site ? `\n\nLearn more at ${site}.` : ''}`);
  } else {
    if (rawTag && startsWithImperativeVerb(rawTag)) {
      pool.push(`${name} makes it easy to ${normalizeClauseForJoin(rawTag)}${siteDash}`);
      pool.push(`Been using ${name} to ${normalizeClauseForJoin(rawTag)}${site ? ` — worth checking out at ${site}` : '.'}`);
    } else if (tagJoined) {
      pool.push(`${name} has been my go-to for ${tagJoined}${siteDash}`);
      pool.push(`If you're looking for ${tagJoined}, ${name} is worth a look${siteAt}.`);
      pool.push(`I've been using ${name} lately (${tagJoined})${site ? ` — you can check it out at ${site}` : '.'}`);
      pool.push(`Quick recommendation: ${name} is ${tagJoined}${siteTail}.`);
    }
    if (firstPitchSentence) {
      pool.push(`${formatSentenceCase(firstPitchSentence)} That's why I like ${name}${siteAt}.`);
      pool.push(`Worth checking out ${name} — ${normalizeClauseForJoin(firstPitchSentence)}${siteAt}.`);
    }
    pool.push(`You might find ${name} helpful${tagJoined ? ` if you want ${tagJoined}` : ''}${siteDash}`);
    pool.push(`Check out ${name}${siteAt} — ${rawPitch ? normalizeClauseForJoin(firstPitchSentence) : (tagJoined || 'solid workflow tool')}.`);
    pool.push(`Been testing ${name} recently and it saves a ton of time${site ? ` (${site})` : '.'}`);
    pool.push(`Sharing ${name} in case it helps here${tagJoined ? ` — great for ${tagJoined}` : ''}${siteDash}`);
  }

  if (reqLower) {
    return pool.map((item) => {
      let out = item;
      if (/\b(emoji|emojis)\b/.test(reqLower) && !/[✨🚀💡🔥]/.test(out)) out = `${out} ✨`;
      if (/\b(short|concise|brief|shorter)\b/.test(reqLower) && out.length > 140) {
        out = out.slice(0, 137).replace(/\s+\S*$/, '').trim() + '...';
      }
      if (/\b(professional|formal|b2b|polite)\b/.test(reqLower)) {
        out = out.replace(/^Hey!\s*/i, 'Hello — ').replace(/\bcheck out\b/gi, 'explore');
      }
      return out;
    });
  }
  return pool;
}

function buildEdgeFallback(
  action: string,
  rawText: string,
  brand: { brandName: string; brandTagline: string; brandPitch: string; brandWebsite: string; moduleType?: string; brand?: any },
  customPrompt = ''
): string {
  const clean = String(rawText || '').trim();
  const protectedUrls: string[] = [];
  const mask = (s: string) =>
    s.replace(/https?:\/\/[^\s]+|\b(?:[a-z0-9-]+\.)+(?:com|org|net|io|ai|co|work|dev|app|xyz)(?:\/[^\s]*)?/gi, (m) => {
      const idx = protectedUrls.length;
      protectedUrls.push(m);
      return `__URL_${idx}__`;
    });
  const unmask = (s: string) => s.replace(/__URL_(\d+)__/g, (_, i) => protectedUrls[Number(i)] || '');

  if (action === 'custom') {
    const reqLower = String(customPrompt || '').toLowerCase();
    if (!clean) {
      return buildCampaignCandidatePool(brand, customPrompt)[0] || '';
    }
    if (/\b(short|concise|brief|shorter|condense)\b/.test(reqLower)) {
      return buildEdgeFallback('refine', clean, brand);
    }
    if (/\bemoji\b/.test(reqLower)) {
      return `${clean} ✨`;
    }
    if (/\b(professional|formal|b2b|polite|business)\b/.test(reqLower)) {
      let out = mask(clean)
        .replace(/^(hey|yo|hiya|hi there)[,!.\s]+/i, 'Hello, ')
        .replace(/\bawesome\b/gi, 'valuable')
        .replace(/\bsuper\b/gi, 'highly')
        .replace(/\bcheck out\b/gi, 'explore')
        .replace(/\bguys\b/gi, 'team')
        .replace(/!{2,}/g, '.');
      return unmask(out.replace(/\s{2,}/g, ' ').trim());
    }
    return buildEdgeFallback('rewrite', clean, brand);
  }

  if (action === 'refine') {
    if (!clean) return '';
    let out = mask(clean)
      .replace(/\b(basically|actually|honestly|literally|really|very|quite|simply|just|kind of|sort of)\b\s*/gi, '')
      .replace(/\bin order to\b/gi, 'to')
      .replace(/\bdue to the fact that\b/gi, 'because')
      .replace(/\ba lot of\b/gi, 'many')
      .replace(/\bis able to\b/gi, 'can')
      .replace(/\s+([,.!?;:])/g, '$1')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (out.length > 0) out = out.charAt(0).toUpperCase() + out.slice(1);
    return unmask(out) || clean;
  }

  if (action === 'rewrite') {
    if (!clean) return '';
    let out = mask(clean);
    const swaps: Array<[RegExp, string]> = [
      [/\bcheck out\b/gi, 'take a look at'],
      [/\btake a look at\b/gi, 'try out'],
      [/\bhelps you\b/gi, 'makes it easy to'],
      [/\blets you\b/gi, 'helps you'],
      [/\bbuilt\b/gi, 'put together'],
      [/\bcreated\b/gi, 'built'],
      [/\bgreat\b/gi, 'solid'],
      [/\bawesome\b/gi, 'really helpful'],
      [/\bquick\b/gi, 'fast'],
      [/\bsimple\b/gi, 'straightforward'],
      [/\bwithout\b/gi, 'minus'],
      [/\bbecause\b/gi, 'since'],
    ];
    let changed = false;
    for (const [re, rep] of swaps) {
      if (re.test(out)) {
        out = out.replace(re, rep);
        changed = true;
      }
    }
    if (!changed) {
      out = out.replace(/^(Hey|Hi)[,!\s]+/i, '') || out;
      out = `Worth sharing — ${out.charAt(0).toLowerCase() + out.slice(1)}`;
    }
    return unmask(out.replace(/\s{2,}/g, ' ').trim());
  }

  if (action === 'add_emojis') {
    return clean ? `${clean} ✨🚀` : '';
  }

  const pool = buildCampaignCandidatePool(brand, customPrompt);
  return pool.find((c) => c.trim().toLowerCase() !== clean.toLowerCase()) || pool[0] || clean;
}

function buildEdgeVariations(
  action: string,
  rawText: string,
  brand: { brandName: string; brandTagline: string; brandPitch: string; brandWebsite: string; moduleType?: string; brand?: any },
  customPrompt = '',
  count = 1,
  excludeTexts: string[] = []
): string[] {
  const n = Math.max(1, Math.min(10, count));
  const excluded = new Set(
    [rawText, ...excludeTexts]
      .map((s) => String(s || '').trim().toLowerCase())
      .filter(Boolean)
  );

  if (action === 'generate' || action === 'regenerate' || (action === 'custom' && !String(rawText || '').trim())) {
    const pool = buildCampaignCandidatePool(brand, customPrompt);
    const results: string[] = [];
    for (const cand of pool) {
      const cleanCand = cand.trim();
      if (!cleanCand) continue;
      if (!excluded.has(cleanCand.toLowerCase())) {
        excluded.add(cleanCand.toLowerCase());
        results.push(cleanCand);
        if (results.length >= n) break;
      }
    }
    let fallbackIdx = 0;
    while (results.length < n && pool.length > 0) {
      const base = pool[fallbackIdx % pool.length].trim();
      const suffix = fallbackIdx >= pool.length ? ` (v${Math.floor(fallbackIdx / pool.length) + 1})` : '';
      const candidate = `${base}${suffix}`;
      if (!results.includes(candidate)) results.push(candidate);
      fallbackIdx++;
      if (fallbackIdx > 30) break;
    }
    return results.length > 0 ? results : [pool[0] || `${brand.brandName || 'Our product'}: ${brand.brandWebsite || ''}`.trim()];
  }

  const results: string[] = [];
  let seed = rawText;
  for (let i = 0; i < n; i++) {
    const next = buildEdgeFallback(action, seed, brand, customPrompt);
    const finalItem = next && !results.includes(next)
      ? next
      : (buildCampaignCandidatePool(brand, customPrompt).find((c) => !excluded.has(c.toLowerCase()) && !results.includes(c)) || next);
    if (finalItem) {
      results.push(finalItem);
      excluded.add(finalItem.toLowerCase());
      seed = finalItem;
    }
  }
  return results;
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  try {
    const body = (await context.request.json()) as any;
    const {
      action,
      text = '',
      customPrompt = '',
      moduleType = '',
      brand = {},
      openRouterKey = '',
      geminiApiKey = '',
      aiModel = '',
      variationCount,
      existingTexts = [],
      creativityLevel = 4,
      protectedTokens = []
    } = body;

    const userOrKey = String(openRouterKey || '').trim();
    const userGeminiKey = String(geminiApiKey || '').trim();
    if (!userOrKey && !userGeminiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          needsApiKey: true,
          error: 'Add your own OpenRouter or Google Gemini API key in Settings to use AI actions.',
        }),
        { status: 401, headers: corsHeaders }
      );
    }

    const isAutoVaryBatch = action === 'auto_vary_batch';
    const normalizedCreativity = normalizeCreativityLevel(creativityLevel);
    const defaultCount = isAutoVaryBatch ? 6 : 1;
    const parsedCount = Math.max(1, Math.min(10, parseInt(String(variationCount ?? defaultCount), 10) || defaultCount));
    const excludeList: string[] = Array.isArray(existingTexts)
      ? existingTexts.map((x: unknown) => String(x || '').trim()).filter(Boolean).slice(0, 12)
      : [];
    const explicitProtectedTokens: string[] = Array.isArray(protectedTokens)
      ? protectedTokens.map((x: unknown) => String(x || '').trim()).filter(Boolean).slice(0, 24)
      : [];

    const brandName = String(brand?.name || brand?.brandName || '').trim();
    const brandTagline = String(brand?.tagline || '').trim();
    const brandPitch = String(brand?.pitch || brand?.description || '').trim();
    const brandWebsite = String(brand?.website || brand?.url || '').trim();
    const brandContextBlock = buildFullBrandContextBlock(brand);
    const moduleGuidance = getModuleFormatGuidance(moduleType);
    const cleanCustomPrompt = String(customPrompt || '').trim();
    const hasBoxText = Boolean(String(text || '').trim());

    const supportedActions = [
      'rewrite',
      'refine',
      'add_emojis',
      'generate',
      'regenerate',
      'custom',
      'auto_vary_batch',
      'humanize',
      'shorter',
      'less_salesy',
      'more_casual',
      'spintax',
      'strip_urls_x',
      'translate',
    ];
    if (!supportedActions.includes(action)) {
      return new Response(
        JSON.stringify({ success: false, error: `Unsupported AI action: ${action}` }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (action === 'custom' && !cleanCustomPrompt) {
      return new Response(
        JSON.stringify({ success: false, error: 'Please enter a custom instruction.' }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (isAutoVaryBatch && !hasBoxText) {
      return new Response(
        JSON.stringify({ success: false, error: 'Source text is required for auto_vary_batch.' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const avoidBlock = excludeList.length > 0
      ? `\n\nExisting Variations to Avoid Repeating (write something genuinely fresh and distinct):\n${excludeList.slice(0, 6).map((s, i) => `${i + 1}. ${s.slice(0, 220)}`).join('\n')}`
      : '';
    const multiVarRule = parsedCount > 1
      ? `\n\nCRITICAL OUTPUT FORMAT: Generate EXACTLY ${parsedCount} distinct, non-repetitive variations. Return ONLY valid JSON: {"variations": ["...", "..."]}.`
      : '';

    let prompt = '';
    let systemInstruction = '';
    let batchMeta: { protectedTokens: string[]; temperature: number } | null = null;

    if (isAutoVaryBatch) {
      const batchPrompts = buildAutoVaryBatchPrompts({
        text,
        creativityLevel: normalizedCreativity,
        variationCount: parsedCount,
        brand,
        brandContextBlock,
        moduleType,
        protectedTokens: explicitProtectedTokens,
        existingTexts: excludeList,
      });
      systemInstruction = batchPrompts.systemInstruction;
      prompt = batchPrompts.prompt;
      batchMeta = {
        protectedTokens: batchPrompts.protectedTokens,
        temperature: batchPrompts.temperature,
      };
    } else if (action === 'rewrite') {
      systemInstruction =
        "You are an expert copywriter. Create another distinct variation of the provided text while keeping the core message, pitch, links/URLs, and exact tone/voice consistent. Do NOT change the tone, do NOT just reverse sentences, write natural grammatical English, and output ONLY the rewritten text.";
      prompt = `${moduleGuidance}\n\nActive Campaign Context:\n${brandContextBlock}\n\nText Currently in Box:\n${text}${avoidBlock}\n\nRewritten variation:`;
    } else if (action === 'refine') {
      systemInstruction =
        "You are an expert copy editor. Make the provided text tighter, sharper, clearer, and more effective. Remove filler words and redundancy while keeping 100% of the core message, links/URLs, pitch, and original tone. Output ONLY the refined text.";
      prompt = `${moduleGuidance}\n\nActive Campaign Context:\n${brandContextBlock}\n\nText Currently in Box:\n${text}\n\nRefined text:`;
    } else if (action === 'humanize') {
      systemInstruction =
        "You are a ruthless human editor who removes all traces of AI-sounding writing. Strip robotic buzzwords ('delve', 'testament', 'game-changer', 'revolutionize', 'unlock your potential', 'in today\\'s fast-paced', 'elevate', 'seamless', 'leverage', 'cutting-edge'), eliminate rigid symmetrical templates, vary sentence cadence naturally like a real founder typing to a peer, respect all brand forbidden words, and preserve all core product facts and links. Output ONLY the humanized text.";
      prompt = `${moduleGuidance}\n\nActive Campaign Context:\n${brandContextBlock}\n\nOriginal Copy:\n${text}${cleanCustomPrompt ? `\n\nAdditional Instruction:\n${cleanCustomPrompt}` : ''}\n\nDeliver ONLY the updated copy:`;
    } else if (action === 'shorter') {
      systemInstruction =
        "You are a concise copy editor. Trim the text down by ~35-50% while preserving the hook, core value, CTA, links, and brand voice. Cut every unnecessary word. Output ONLY the shortened text.";
      prompt = `${moduleGuidance}\n\nActive Campaign Context:\n${brandContextBlock}\n\nOriginal Copy:\n${text}\n\nDeliver ONLY the updated copy:`;
    } else if (action === 'less_salesy') {
      systemInstruction =
        "You are an organic community copywriter. Rewrite the draft so it sounds 100% genuine, peer-to-peer, helpful, and non-pushy—removing hype, urgency gimmicks, and promotional adjectives while keeping helpful context and natural product alignment. Output ONLY the updated text.";
      prompt = `${moduleGuidance}\n\nActive Campaign Context:\n${brandContextBlock}\n\nOriginal Copy:\n${text}\n\nDeliver ONLY the updated copy:`;
    } else if (action === 'more_casual') {
      systemInstruction =
        "You are a conversational founder. Rewrite the text to sound relaxed, natural, warm, and unscripted while preserving all product facts and links. Output ONLY the updated text.";
      prompt = `${moduleGuidance}\n\nActive Campaign Context:\n${brandContextBlock}\n\nOriginal Copy:\n${text}\n\nDeliver ONLY the updated copy:`;
    } else if (action === 'spintax') {
      systemInstruction =
        "You are a Smart Poster spintax specialist. Convert key interchangeable words and short phrases in the provided text into clean single-level {option1|option2|option3} spintax syntax compatible with Smart Poster's Randomness Engine. NEVER spin URLs, domain names, email addresses, or brand names. Keep natural grammar across every combination. Output ONLY the spintax-formatted text.";
      prompt = `${moduleGuidance}\n\nActive Campaign Context:\n${brandContextBlock}\n\nOriginal Copy:\n${text}\n\nDeliver ONLY the updated copy:`;
    } else if (action === 'strip_urls_x') {
      systemInstruction =
        "You are an X / Twitter formatting specialist. Strip 'https://' and 'http://' from URLs (converting to clean domain/path text like 'domain.com') and tighten phrasing cleanly to fit X/Twitter norms without losing impact. Output ONLY the formatted post.";
      prompt = `${moduleGuidance}\n\nActive Campaign Context:\n${brandContextBlock}\n\nOriginal Copy:\n${text}\n\nDeliver ONLY the updated copy:`;
    } else if (action === 'translate') {
      systemInstruction =
        "You are an idiomatic native marketing translator. Translate the provided text into the target language requested by the user while preserving brand voice, persuasion, product names, URLs, and formatting. Output ONLY the translated text.";
      prompt = `${moduleGuidance}\n\nActive Campaign Context:\n${brandContextBlock}\n\nOriginal Copy:\n${text}${cleanCustomPrompt ? `\n\nTarget Language / Instruction:\n${cleanCustomPrompt}` : ''}\n\nDeliver ONLY the translated copy:`;
    } else if (action === 'add_emojis') {
      systemInstruction =
        "You are a social engagement specialist. Add 2 to 3 relevant, tasteful emojis to the text at natural breaks. Do NOT alter, add, or delete any words or links. Output ONLY the updated text.";
      prompt = `Text Currently in Box:\n${text}\n\nText with 2-3 emojis:`;
    } else if (action === 'generate') {
      systemInstruction =
        "You are an expert outreach copywriter. Write fresh, natural, grammatically fluent, high-converting copy grounded strictly in the complete active Brand / Campaign details. Automatically match the tone and language of the Brand Assets & existing Product content first, falling back to website voice or niche. Never invent unrelated products or fake URLs. Vary your angle and phrasing from any existing variations. Output ONLY the final copy text.";
      prompt = hasBoxText
        ? `${moduleGuidance}\n\nActive Campaign Context:\n${brandContextBlock}\n\nReference Text Currently in Box:\n${text}${avoidBlock}\n\nGenerate fresh, high-converting copy for this campaign that takes a fresh angle:`
        : `${moduleGuidance}\n\nActive Campaign Context:\n${brandContextBlock}${avoidBlock}\n\nGenerate fresh, natural, high-converting copy for this active campaign:`;
    } else if (action === 'regenerate') {
      systemInstruction =
        "You are an expert outreach copywriter. Regenerate a completely fresh, natural, grammatically fluent alternative based on the complete active Brand / Campaign context. Automatically match the tone and language of the Brand Assets & existing Product content first, falling back to website voice or niche. It MUST differ meaningfully from the previous draft and any existing variations. Output ONLY the regenerated copy text.";
      prompt = hasBoxText
        ? `${moduleGuidance}\n\nActive Campaign Context:\n${brandContextBlock}\n\nPrevious Version to Replace (do NOT repeat this phrasing):\n${text}${avoidBlock}\n\nRegenerate a fresh, distinct alternative:`
        : `${moduleGuidance}\n\nActive Campaign Context:\n${brandContextBlock}${avoidBlock}\n\nRegenerate a fresh, distinct piece of copy for this active campaign:`;
    } else if (action === 'custom') {
      systemInstruction =
        "You are an expert marketing and outreach copywriter inside Smart Poster. Execute the user's custom instruction precisely using BOTH the provided draft text (if present) AND the complete active campaign/brand materials provided in context. Adapt automatically to the tone/language of Brand Assets & saved content first, then website copy, then niche. Never invent unrelated products or fake URLs. Respect any module character limits or formatting guidance." +
        (parsedCount > 1
          ? ` Generate EXACTLY ${parsedCount} distinct variations and return ONLY valid JSON: {"variations": ["..."]}.`
          : ' Output ONLY the final copy text with no surrounding quotes, labels, or commentary.');
      prompt = `${moduleGuidance}\n\nComplete Active Brand / Campaign Materials:\n${brandContextBlock}\n\n${hasBoxText ? `Current Text in Box:\n${text}\n\n` : 'Current Text in Box: (empty — generate directly from the brand/campaign materials above)\n\n'}User Custom Requirement:\n${cleanCustomPrompt}${avoidBlock}${multiVarRule}\n\n${parsedCount > 1 ? `Return valid JSON with ${parsedCount} distinct variations:` : 'Deliver ONLY the final updated copy:'}`;
    }

    const finalizeActionVariations = (rawItems: string[]): { variations: string[]; rejectedCount: number; protectedTokens: string[] } => {
      if (isAutoVaryBatch) {
        const filtered = filterValidatedAutoVariations(text, rawItems, {
          level: normalizedCreativity,
          brandName,
          protectedTokens: batchMeta?.protectedTokens || explicitProtectedTokens,
          existingTexts: excludeList,
          maxCount: parsedCount,
        });
        if (filtered.valid.length >= parsedCount) {
          return {
            variations: filtered.valid.slice(0, parsedCount),
            rejectedCount: filtered.rejectedCount,
            protectedTokens: filtered.protectedTokens,
          };
        }
        const extras = buildAutoVaryLocalFallback({
          text,
          creativityLevel: normalizedCreativity,
          count: parsedCount - filtered.valid.length,
          brandName,
          protectedTokens: filtered.protectedTokens,
          existingTexts: [...excludeList, ...filtered.valid],
        });
        return {
          variations: [...filtered.valid, ...extras].slice(0, parsedCount),
          rejectedCount: filtered.rejectedCount,
          protectedTokens: filtered.protectedTokens,
        };
      }

      const cleanItems = rawItems.map((s) => String(s || '').trim()).filter(Boolean);
      if (cleanItems.length >= parsedCount) {
        return { variations: cleanItems.slice(0, parsedCount), rejectedCount: 0, protectedTokens: [] };
      }
      const extras = buildEdgeVariations(
        action,
        text,
        { brandName, brandTagline, brandPitch, brandWebsite, moduleType, brand },
        cleanCustomPrompt,
        parsedCount - cleanItems.length,
        [...excludeList, ...cleanItems]
      );
      return {
        variations: [...cleanItems, ...extras].slice(0, parsedCount),
        rejectedCount: 0,
        protectedTokens: [],
      };
    };

    // Priority 1: User OpenRouter BYOK execution
    let lastErrorStatus = 0;
    let lastErrorMessage = '';
    if (userOrKey) {
      try {
        const orModel = String(aiModel || '').trim() || 'deepseek/deepseek-chat';
        const baseMaxTokens = String(moduleType || '').toLowerCase() === 'article' ? 1400 : 700;
        const temperature = batchMeta
          ? batchMeta.temperature
          : (action === 'refine' ? 0.35 : (action === 'regenerate' ? 0.85 : 0.72));
        const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userOrKey}`,
          },
          body: JSON.stringify({
            model: orModel,
            messages: [
              { role: 'system', content: systemInstruction },
              { role: 'user', content: prompt }
            ],
            temperature,
            max_tokens: parsedCount > 1 ? Math.min(4000, baseMaxTokens * Math.min(parsedCount, 5)) : baseMaxTokens,
          }),
        });

        if (orRes.ok) {
          const orData: any = await orRes.json();
          const resultText = String(orData?.choices?.[0]?.message?.content || '').trim();
          if (resultText) {
            const parsedList = isAutoVaryBatch
              ? parseVariationsJsonOrList(resultText, parsedCount)
              : parseVariationsFromAiOutput(resultText, parsedCount);
            const finalized = finalizeActionVariations(parsedList);
            return new Response(
              JSON.stringify({
                success: true,
                text: finalized.variations[0] || '',
                variations: finalized.variations,
                ...(isAutoVaryBatch ? {
                  creativityLevel: normalizedCreativity,
                  protectedTokens: finalized.protectedTokens,
                  rejectedCount: finalized.rejectedCount,
                } : {}),
                source: `openrouter (${orModel})`,
              }),
              { status: 200, headers: corsHeaders }
            );
          }
        } else {
          lastErrorStatus = orRes.status;
          const errText = await orRes.text().catch(() => '');
          lastErrorMessage = `OpenRouter returned HTTP ${orRes.status}`;
          try {
            const parsedErr = JSON.parse(errText);
            if (parsedErr?.error?.message) lastErrorMessage = parsedErr.error.message;
          } catch {
            if (errText) lastErrorMessage = errText.slice(0, 220);
          }
        }
      } catch (e: any) {
        lastErrorMessage = e?.message || 'OpenRouter request failed';
      }
    }

    // Priority 2: User Gemini BYOK execution
    if (userGeminiKey) {
      try {
        const baseMaxTokens = String(moduleType || '').toLowerCase() === 'article' ? 1400 : 800;
        const temperature = batchMeta
          ? batchMeta.temperature
          : (action === 'refine' ? 0.35 : (action === 'regenerate' ? 0.85 : 0.72));
        const gemResult = await callUserGeminiRestCf({
          apiKey: userGeminiKey,
          model: aiModel,
          systemInstruction,
          prompt,
          temperature,
          maxOutputTokens: parsedCount > 1 ? Math.min(4096, baseMaxTokens * Math.min(parsedCount, 5)) : baseMaxTokens,
          jsonMode: parsedCount > 1 || isAutoVaryBatch,
        });
        if (gemResult.ok && gemResult.text) {
          const parsedList = isAutoVaryBatch
            ? parseVariationsJsonOrList(gemResult.text, parsedCount)
            : parseVariationsFromAiOutput(gemResult.text, parsedCount);
          const finalized = finalizeActionVariations(parsedList);
          return new Response(
            JSON.stringify({
              success: true,
              text: finalized.variations[0] || '',
              variations: finalized.variations,
              ...(isAutoVaryBatch ? {
                creativityLevel: normalizedCreativity,
                protectedTokens: finalized.protectedTokens,
                rejectedCount: finalized.rejectedCount,
              } : {}),
              source: `gemini (${gemResult.model})`,
            }),
            { status: 200, headers: corsHeaders }
          );
        } else {
          lastErrorStatus = gemResult.status || 502;
          lastErrorMessage = gemResult.error || 'Gemini request failed';
        }
      } catch (e: any) {
        lastErrorMessage = e?.message || 'Gemini request failed';
      }
    }

    if (lastErrorStatus === 401 || lastErrorStatus === 403) {
      return new Response(
        JSON.stringify({
          success: false,
          needsApiKey: true,
          error: lastErrorMessage || 'Invalid or expired API key.',
        }),
        { status: 401, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: lastErrorMessage || 'AI request failed. Please verify your API key and model in Settings.',
      }),
      { status: lastErrorStatus || 502, headers: corsHeaders }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || 'Error processing AI action',
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}
