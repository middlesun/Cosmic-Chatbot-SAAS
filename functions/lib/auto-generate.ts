import { fetchWebsiteCopy } from './url-analyzer';
import { callUserGeminiRestCf } from './workspace-auth';

export type AutoGenModule = 'directory' | 'comments' | 'contact' | 'email' | 'dm' | 'articles' | 'social' | 'support';

function slugifySeoText(str: string): string {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70) || 'article';
}

function cleanDomainFromUrl(rawUrl: string): string {
  return String(rawUrl || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .split('/')[0];
}

function stripEndPunct(str: string): string {
  return String(str || '').trim().replace(/[.!?]+$/, '').trim();
}

function smartTruncate(str: string, maxLen: number): string {
  const s = String(str || '').replace(/\s+/g, ' ').trim();
  if (s.length <= maxLen) return s;
  const sliced = s.slice(0, maxLen);
  const lastSpace = sliced.lastIndexOf(' ');
  return (lastSpace > Math.floor(maxLen * 0.6) ? sliced.slice(0, lastSpace) : sliced)
    .replace(/[,;:\-–—&+]+$/, '')
    .trim();
}

function lcFirst(str: string): string {
  const s = String(str || '').trim();
  if (!s) return '';
  return s.charAt(0).toLowerCase() + s.slice(1);
}

export function buildAutoGenerateFallback(
  mod: AutoGenModule,
  brandCtx: {
    name: string;
    url: string;
    tagline: string;
    description: string;
    category: string;
    pricing: string;
    articlePreset?: string;
    targetKeyword?: string;
  },
  landing: {
    metaTitle: string;
    metaDescription: string;
    heroHeadline: string;
    heroText: string;
    headings: string[];
    ctaTexts: string[];
    bodyCopy: string;
  }
): Record<string, any> {
  const name = brandCtx.name || landing.metaTitle.split(/[-|—]/)[0].trim() || 'Our product';
  const url = brandCtx.url || '';
  const domain = cleanDomainFromUrl(url) || name.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com';
  const metaTitlePart = stripEndPunct(
    landing.metaTitle.includes('-') || landing.metaTitle.includes('|')
      ? landing.metaTitle.split(/[-|—]/).slice(1).join(' ').trim()
      : landing.metaTitle
  );
  const heroHook = stripEndPunct(landing.heroHeadline || brandCtx.tagline || metaTitlePart || name);
  const corePromise = stripEndPunct(brandCtx.tagline || metaTitlePart || landing.heroHeadline || brandCtx.description || name);
  const detailCopy = stripEndPunct(landing.metaDescription || brandCtx.description || landing.heroText || corePromise);
  const sentences = detailCopy.split(/[.!?]+\s+/).map(stripEndPunct).filter(Boolean);
  const firstSentence = sentences[0] || corePromise;
  const secondSentence = sentences[1] || stripEndPunct(landing.headings[1] || '');
  const heroLine = stripEndPunct((landing.heroText || heroHook).slice(0, 200));
  const ctaHint = landing.ctaTexts[0] ? landing.ctaTexts[0] : '';

  if (mod === 'comments') {
    const comments = [
      {
        angle: 'Pain-Point Mirror',
        text: `Dealing with this exact bottleneck is why we built ${name}. ${firstSentence}. If you want the faster route without overthinking it, check out ${domain}.`,
      },
      {
        angle: 'Builder Story',
        text: `When we put ${name} together, the goal was straightforward: ${lcFirst(heroHook)}. Curious how others here handle this right now, or if ${domain} fits your flow.`,
      },
      {
        angle: 'Hero Outcome',
        text: `${heroHook} — that's the exact gap ${name} focuses on. ${secondSentence || firstSentence}. Worth a quick look at ${url || domain}.`,
      },
      {
        angle: 'Helpful Peer Tip',
        text: `What worked best for us was cutting out extra steps and keeping the workflow simple. We built ${name} (${domain}) around ${lcFirst(metaTitlePart || corePromise)}.`,
      },
      {
        angle: 'Fresh Take',
        text: `Most tools make this way heavier than it needs to be. ${name} keeps it light: ${firstSentence}. Easy to test out at ${domain}.`,
      },
      {
        angle: 'Short Micro-Pitch',
        text: `Quick share if this is on your radar: ${name} — ${corePromise}. Take a look at ${domain}.`,
      },
      {
        angle: 'Workflow Drop',
        text: `If you're stuck on this part of the process, ${name} handles it cleanly (${smartTruncate(heroLine, 120)}). Happy to share how we set it up at ${url || domain}.`,
      },
      {
        angle: 'Conversation Starter',
        text: `Honest question — what part of this eats up most of your week? We built ${name} around "${smartTruncate(heroHook, 90)}" to cut down the manual grind: ${domain}.`,
      },
    ];
    return { comments };
  }

  if (mod === 'directory') {
    const cleanName = smartTruncate(name, 40);
    const t1 = smartTruncate(metaTitlePart || corePromise, 60);
    const t2 = smartTruncate(heroHook, 60);
    const t3 = smartTruncate(`${cleanName}: ${firstSentence}`, 60);
    const taglines = Array.from(new Set([t1, t2, t3].filter(Boolean)));
    if (taglines.length < 2) taglines.push(smartTruncate(`${cleanName} — ${corePromise}`, 60));

    const pitch1 = smartTruncate(`${cleanName}: ${heroHook}. ${firstSentence}.`, 140);
    const pitch2 = smartTruncate(`${firstSentence}. Built to help you ${lcFirst(corePromise)}.`, 140);
    const pitch3 = smartTruncate(`${metaTitlePart || cleanName} — try ${domain} for a faster, simpler workflow.`, 140);
    const summary1 = smartTruncate(`${cleanName} (${domain}) — ${detailCopy}.`, 250);
    const summary2 = smartTruncate(`${heroHook}. ${detailCopy}.${ctaHint ? ` ${ctaHint} at ${domain}.` : ''}`, 250);
    const desc1 = `${cleanName} — ${heroHook}\n\n${detailCopy}.${landing.headings.length ? `\n\nHighlights: ${landing.headings.slice(0, 4).join(' • ')}` : ''}\n\nTry it at ${url || domain}.`.trim();
    const desc2 = `${detailCopy}.\n\n${landing.heroText ? `${stripEndPunct(landing.heroText.slice(0, 420))}.\n\n` : ''}Visit ${url || domain} to see ${cleanName} in action.`.trim();
    return {
      productName: cleanName,
      websiteUrl: url,
      category: brandCtx.category || 'Marketing & Sales',
      pricingModel: brandCtx.pricing || 'Freemium',
      taglines,
      pitches: Array.from(new Set([pitch1, pitch2, pitch3].filter(Boolean))),
      summaries: Array.from(new Set([summary1, summary2].filter(Boolean))),
      descriptions: [desc1, desc2].filter(Boolean),
    };
  }

  if (mod === 'contact') {
    // STRICT RULE: Never generate or return name, email, or phone fields
    return {
      company: name,
      website: url,
      subject: smartTruncate(`Introducing ${name} — ${heroHook}`, 75),
      message: `Hi there,\n\nI'm reaching out to introduce ${name} (${url || domain}) — ${lcFirst(firstSentence)}.\n\nWe built ${name} to help with ${lcFirst(corePromise)}${secondSentence ? ` (${lcFirst(secondSentence)})` : ''}.\n\nIf that's relevant to what you're working on, you can take a quick look at ${url || domain} — happy to answer any questions.`,
    };
  }

  if (mod === 'email') {
    return {
      emails: [
        {
          subject: smartTruncate(`Introducing ${name}: ${heroHook}`, 65),
          body: `Hi there,\n\nWanted to briefly introduce ${name} (${url || domain}).\n\n${firstSentence}.${secondSentence ? ` ${secondSentence}.` : ''}\n\nWe built it for people who want a simpler way to handle ${lcFirst(corePromise)} without bloated setup. You can take a quick look at ${url || domain} or reply if you'd like a walkthrough.\n\nBest,\n${name} Team`,
        },
        {
          subject: smartTruncate(`${name} — ${heroHook}`, 65),
          body: `Hi,\n\nI'm writing to introduce ${name} (${url || domain}).\n\nIn short: ${heroHook}. ${smartTruncate(detailCopy, 200)}.\n\nIf you're looking for a simpler way to handle this in your workflow, check out ${url || domain} — happy to share more details anytime.\n\nCheers,\n${name}`,
        },
        {
          subject: smartTruncate(`Meet ${name} (${domain})`, 65),
          body: `Hello,\n\nQuick introduction from our team at ${name} (${url || domain}).\n\nWe created ${name} to help with ${lcFirst(corePromise)}. ${firstSentence}.\n\nIf this fits what you're focused on right now, feel free to explore it at ${url || domain} and let me know what you think.\n\nBest,\n${name}`,
        },
        {
          subject: smartTruncate(`Quick intro: ${name} for ${brandCtx.category || 'your workflow'}`, 65),
          body: `Hi there,\n\nSharing a quick introduction to ${name} (${url || domain}).\n\nMost teams waste hours stitching together manual steps for something that should take minutes. ${name} gives you a direct solution: ${smartTruncate(detailCopy, 220)}.\n\nTake a look at ${url || domain} whenever you have a minute.\n\nBest,\n${name} Team`,
        },
      ],
    };
  }

  if (mod === 'dm') {
    return {
      dms: [
        {
          platform: 'Twitter',
          message: `Hey! Quick intro — we built ${name} (${domain}) to help with ${lcFirst(corePromise)}. Check it out if that's useful for your workflow!`,
        },
        {
          platform: 'LinkedIn',
          message: `Hi! Wanted to introduce ${name} (${url || domain}) — ${firstSentence}. Thought it could be useful for what you're working on.`,
        },
        {
          platform: 'Reddit',
          message: `Hey! Sharing a quick intro to ${name} (${domain}) — ${corePromise} without extra manual work. Happy to share how it works if you're interested.`,
        },
        {
          platform: 'Instagram',
          message: `Hey! Quick intro to ${name} (${domain}) — we built it to help with ${lcFirst(corePromise)}. Worth a quick peek!`,
        },
      ],
    };
  }

  if (mod === 'social') {
    return {
      socialPosts: [
        {
          platform: 'X / Twitter',
          format: 'single',
          hook: smartTruncate(`${heroHook}. Here's why we built ${name}:`, 120),
          body: smartTruncate(`${heroHook}.\n\n${firstSentence}.\n\nNo bloated setup — check out ${domain}`, 275),
          ctaUrl: url || `https://${domain}`,
        },
        {
          platform: 'LinkedIn',
          format: 'single',
          hook: smartTruncate(`Most teams waste hours on ${lcFirst(brandCtx.category || 'manual workflows')}.`, 140),
          body: `Most teams still stitch together disconnected steps to handle ${lcFirst(corePromise)}.\n\nWhen we built ${name}, we focused on one clear outcome: ${firstSentence}.\n\n${secondSentence ? `${secondSentence}.\n\n` : ''}See how it works at ${url || domain}.`,
          ctaUrl: url || `https://${domain}`,
        },
        {
          platform: 'Reddit',
          format: 'launch',
          hook: smartTruncate(`Show & Tell: I built ${name} to help with ${lcFirst(corePromise)}`, 140),
          body: `Hey everyone,\n\nI got tired of complicated workflows for ${lcFirst(corePromise)}, so I built ${name} (${domain}).\n\nWhat it does:\n- ${firstSentence}\n- ${secondSentence || heroHook}\n\nPricing: ${brandCtx.pricing || 'Freemium'}. Happy to hear honest feedback!`,
          ctaUrl: url || `https://${domain}`,
        },
        {
          platform: 'Threads',
          format: 'thread',
          hook: smartTruncate(`Quick breakdown on ${lcFirst(corePromise)} 🧵`, 110),
          body: `1/ The bottleneck: ${firstSentence}.\n\n2/ What actually moves the needle: ${heroHook}.\n\n3/ That's why we built ${name} (${domain}) — try it out when you get a minute.`,
          ctaUrl: url || `https://${domain}`,
        },
      ],
    };
  }

  if (mod === 'support') {
    return {
      faqs: [
        {
          category: 'General',
          question: `What is ${name} and who is it built for?`,
          answer: `${name} is built to help with ${lcFirst(corePromise)}. ${detailCopy}. You can explore full details at ${url || domain}.`,
        },
        {
          category: 'Pricing & Billing',
          question: `How does pricing work for ${name}?`,
          answer: `${name} offers ${brandCtx.pricing || 'flexible plans'}. Visit ${url || domain} for the latest plan breakdown and limits.`,
        },
        {
          category: 'Onboarding',
          question: `How quickly can I get started with ${name}?`,
          answer: `You can set up ${name} in a few minutes. Start by visiting ${url || domain} and following the quick-start workflow for ${lcFirst(corePromise)}.`,
        },
      ],
      macros: [
        {
          category: 'General',
          title: 'Quick Intro & Onboarding Help',
          body: `Hi there!\n\nThanks for reaching out about ${name}. To get started quickly, ${lcFirst(firstSentence)}. You can check ${url || domain} anytime — reply here if you'd like me to walk through your setup!`,
        },
        {
          category: 'Bug Report',
          title: 'Bug Triage & Follow-Up',
          body: `Hi! Thanks for flagging this. Could you share the page URL or a quick screenshot of what happened? We take reliability in ${name} seriously and will look into this right away.`,
        },
        {
          category: 'Feature Request',
          title: 'Feature Request Logged',
          body: `Appreciate you sharing that idea! We're actively improving ${name} (${domain}) around ${lcFirst(corePromise)}, and I've logged this request with our product notes so we can prioritize it.`,
        },
      ],
    };
  }

  const preset = brandCtx.articlePreset || 'problem-solution';
  const kw = String(brandCtx.targetKeyword || '').trim() || smartTruncate(brandCtx.category || heroHook, 40);
  const headingsList = landing.headings.length ? landing.headings.slice(0, 4) : [heroHook, firstSentence];
  const title1 = preset === 'how-to'
    ? `How to Master ${smartTruncate(kw, 40)} Using ${name}`
    : preset === 'comparison'
      ? `Comparing Approaches to ${smartTruncate(kw, 36)}: Why ${name} Keeps It Simple`
      : preset === 'launch-story'
        ? `Why We Built ${name}: Solving ${smartTruncate(heroHook, 45)}`
        : `The Problem With ${smartTruncate(kw, 45)} — And a Simpler Solution`;
  const title2 = `Solving ${smartTruncate(heroHook, 55)}: How ${name} Helps Target Users`;
  return {
    articles: [
      {
        title: title1,
        preset,
        targetKeyword: kw,
        slug: slugifySeoText(title1),
        metaDescription: smartTruncate(`${firstSentence}. Discover how ${name} helps with ${lcFirst(corePromise)}.`, 158),
        body: `The Problem\nWhen you need better results with ${lcFirst(corePromise)}, you quickly run into the same bottleneck: too many disconnected steps, slow manual work, and inconsistent outcomes.\n\nWhy Current Workflows Fall Short\n${stripEndPunct(headingsList[0] || heroHook)}. Most tools either overcomplicate the setup or leave you doing the repetitive parts by hand, which eats up time every single week.\n\nThe Solution: How ${name} Helps\nThat's the exact problem ${name} (${url || domain}) is built to solve. ${detailCopy}.\n\nHere is how ${name} helps target users in practice:\n- Eliminates the manual bottleneck: ${firstSentence}.\n- Keeps execution focused: ${stripEndPunct(headingsList[1] || secondSentence || heroHook)}.\n- Gets you to results faster without heavy setup.\n\nIf you want a simpler way to handle ${lcFirst(corePromise)}, try ${name} at ${url || domain}.`,
      },
      {
        title: title2,
        preset: preset === 'problem-solution' ? 'how-to' : preset,
        targetKeyword: kw,
        slug: slugifySeoText(title2),
        metaDescription: smartTruncate(`${heroHook}. Practical guide to fixing ${lcFirst(corePromise)} with ${name}.`, 158),
        body: `The Problem\nGetting consistent outcomes around ${brandCtx.category || 'growth'} shouldn't require duct-taping multiple workflows together. Yet most people spend more time managing tools and manual tasks than actually shipping.\n\nThe Root Cause\n${landing.heroText ? `${stripEndPunct(landing.heroText.slice(0, 320))}.\n\n` : ''}${firstSentence}.\n\nThe Solution: How ${name} Helps You Fix It\nWe built ${name} (${url || domain}) around one goal: ${heroHook}.\n\nInstead of adding another complex dashboard, ${name} helps you directly:\n1. Cut out repetitive friction: ${firstSentence}.\n2. Focus on what actually moves the needle: ${secondSentence || smartTruncate(detailCopy, 180)}.\n3. Turn your workflow into a repeatable system you can run in minutes.\n\nSee how ${name} solves this for your workflow at ${url || domain}.`,
      },
    ],
  };
}

export async function runAutoGenerateModule(params: {
  module: string;
  brand?: Record<string, any>;
  landingContext?: Record<string, any> | null;
  articlePreset?: string;
  targetKeyword?: string;
  openRouterKey?: string;
  geminiApiKey?: string;
  aiModel?: string;
  env?: any;
}) {
  const mod = String(params.module || '').trim().toLowerCase() as AutoGenModule;
  const validModules = new Set<AutoGenModule>(['directory', 'comments', 'contact', 'email', 'dm', 'articles', 'social', 'support']);
  if (!validModules.has(mod)) {
    return { ok: false as const, status: 400, error: `Unsupported module: ${params.module}` };
  }

  const brand = params.brand || {};
  const brandName = String(brand.name || brand.brandName || '').trim();
  const brandUrl = String(brand.url || brand.websiteUrl || brand.website || '').trim();
  const brandTagline = String(brand.tagline || '').trim();
  const brandDescription = String(brand.description || '').trim();
  const brandCategory = String(brand.category || '').trim() || 'Marketing & Sales';
  const brandPricing = String(brand.pricing || brand.pricingModel || '').trim() || 'Freemium';

  const lc = params.landingContext || null;
  let landing = {
    metaTitle: String(lc?.metaTitle || lc?.title || '').trim(),
    metaDescription: String(lc?.metaDescription || lc?.description || '').trim(),
    heroHeadline: String(lc?.heroHeadline || '').trim(),
    heroText: String(lc?.heroText || '').trim(),
    headings: Array.isArray(lc?.headings) ? lc.headings.map((h: any) => String(h).trim()).filter(Boolean).slice(0, 12) : [],
    ctaTexts: Array.isArray(lc?.ctaTexts) ? lc.ctaTexts.map((c: any) => String(c).trim()).filter(Boolean).slice(0, 8) : [],
    bodyCopy: String(lc?.bodyCopy || lc?.copy || '').trim(),
  };

  const hasInitialProductDetails = Boolean(
    (brandName && (brandUrl || brandTagline || brandDescription)) ||
      (brandUrl && (brandTagline || brandDescription)) ||
      landing.metaTitle ||
      landing.metaDescription ||
      landing.heroText ||
      landing.bodyCopy
  );

  if (!hasInitialProductDetails) {
    return {
      ok: false as const,
      status: 400,
      error: 'Fill out or fetch Product Details first before auto-generating.',
    };
  }

  if (brandUrl && (!landing.heroText || !landing.bodyCopy || !landing.metaTitle)) {
    try {
      const scanned = await fetchWebsiteCopy(brandUrl);
      if (scanned.success && scanned.context) {
        landing = {
          metaTitle: landing.metaTitle || scanned.context.metaTitle || scanned.context.title || '',
          metaDescription: landing.metaDescription || scanned.context.metaDescription || scanned.context.description || '',
          heroHeadline: landing.heroHeadline || scanned.context.heroHeadline || '',
          heroText: landing.heroText || scanned.context.heroText || '',
          headings: landing.headings.length ? landing.headings : scanned.context.headings || [],
          ctaTexts: landing.ctaTexts.length ? landing.ctaTexts : scanned.context.ctaTexts || [],
          bodyCopy: landing.bodyCopy || scanned.context.bodyCopy || '',
        };
      }
    } catch {}
  }

  const brandCtx = {
    name: brandName || landing.metaTitle.split(/[-|—]/)[0].trim() || 'Product',
    url: brandUrl,
    tagline: brandTagline || landing.heroHeadline || '',
    description: brandDescription || landing.metaDescription || '',
    category: brandCategory,
    pricing: brandPricing,
    articlePreset: String(params.articlePreset || brand.articlePreset || 'problem-solution').trim(),
    targetKeyword: String(params.targetKeyword || brand.targetKeyword || '').trim(),
  };

  const ba = (brand.brandAssets && typeof brand.brandAssets === 'object') ? brand.brandAssets : {};
  const extraBaLines: string[] = [];
  if (Array.isArray(ba.shortPitches) && ba.shortPitches.length) {
    const spList = ba.shortPitches.map((s: any) => String(typeof s === 'string' ? s : s?.text || '').trim()).filter(Boolean);
    if (spList.length) extraBaLines.push(`- Short Pitch Variations: ${spList.slice(0, 5).join(' || ')}`);
  } else if (ba.shortPitch) {
    extraBaLines.push(`- Short Pitch: ${String(ba.shortPitch)}`);
  }
  if (ba.targetAudience) extraBaLines.push(`- Target Audience: ${String(ba.targetAudience).slice(0, 320)}`);
  if (ba.founderStory) extraBaLines.push(`- Founder Story: ${String(ba.founderStory).slice(0, 350)}`);
  if (Array.isArray(ba.features) && ba.features.length) {
    extraBaLines.push(`- Key Features: ${ba.features.slice(0, 5).map((f: any) => typeof f === 'string' ? f : [f?.title, f?.detail].filter(Boolean).join(': ')).filter(Boolean).join(' | ').slice(0, 420)}`);
  }
  if (Array.isArray(ba.benefits) && ba.benefits.length) {
    extraBaLines.push(`- Core Benefits: ${ba.benefits.slice(0, 4).map((f: any) => typeof f === 'string' ? f : [f?.title, f?.detail].filter(Boolean).join(': ')).filter(Boolean).join(' | ').slice(0, 350)}`);
  }
  if (Array.isArray(ba.competitors) && ba.competitors.length) {
    extraBaLines.push(`- Competitor Comparisons: ${ba.competitors.slice(0, 3).map((c: any) => `${c?.name || ''}: ${c?.advantage || ''}`).filter(Boolean).join(' || ').slice(0, 340)}`);
  }
  if (ba.tone?.forbiddenWords) extraBaLines.push(`- Forbidden Words / Claims (NEVER USE): ${String(ba.tone.forbiddenWords).slice(0, 180)}`);

  const contextBrief = [
    'PRODUCT DETAILS / BRAND ASSETS:',
    `- Name: ${brandCtx.name}`,
    `- Website URL: ${brandCtx.url || 'N/A'}`,
    `- Tagline: ${brandCtx.tagline || 'N/A'}`,
    `- Description: ${brandCtx.description || 'N/A'}`,
    `- Category: ${brandCtx.category}`,
    `- Pricing: ${brandCtx.pricing}`,
    ...extraBaLines,
    '',
    'SITE LANDING CONTENT:',
    `- Meta Title: ${landing.metaTitle || 'N/A'}`,
    `- Meta Description: ${landing.metaDescription || 'N/A'}`,
    `- Hero Headline: ${landing.heroHeadline || 'N/A'}`,
    `- Hero Section Copy: ${landing.heroText || 'N/A'}`,
    `- Key Headings: ${landing.headings.length ? landing.headings.join(' | ') : 'N/A'}`,
    `- Primary CTAs: ${landing.ctaTexts.length ? landing.ctaTexts.join(' | ') : 'N/A'}`,
    `- Landing Body Excerpt: ${landing.bodyCopy ? landing.bodyCopy.slice(0, 2200) : 'N/A'}`,
  ].join('\n');

  const toneRules = `CRITICAL TONE & QUALITY RULES:
1. MATCH THE PRODUCT & LANDING PAGE TONE & LANGUAGE EXACTLY: Study the voice, vocabulary, sentence rhythm, personality, and language of the Meta Title, Meta Description, Hero Section, Brand Assets, and Landing Body above. Write in THAT exact voice and language automatically.
2. NOT OVERLY PROFESSIONAL / NO CORPORATE STIFFNESS: Do NOT sound like a stiff B2B enterprise agency or generic brochure. Avoid words like "synergy", "leverage", "streamline your acquisition pipeline", "revolutionize", "game-changer", "unlock your potential", "elevate", "esteemed", "in today's fast-paced digital landscape", or "I hope this email finds you well".
3. NO FILLER: Every line must reflect concrete specifics from this product's landing copy (real problems, outcomes, features, and phrasing from the hero section, meta title, and description). Sound like a real maker/founder talking naturally to peers.`;

  let moduleInstructions = '';
  if (mod === 'comments') {
    moduleInstructions = `Generate 8 distinct, high-quality social/community comments for "${brandCtx.name}" using the site's Meta Title, Meta Description, and Hero Section.
Each comment MUST use a genuinely different pitch angle:
1. Pain-Point Mirror
2. Builder / Founder Note
3. Direct Hero Outcome
4. Helpful Peer Tip + Casual Mention
5. Fresh / Contrarian Take
6. Short Micro-Pitch (1-2 punchy sentences)
7. Workflow / How-It-Works Drop
8. Relatable Observation / Question Hook + Soft Mention
Keep each comment 20-65 words. Never use "https://" if writing Twitter-style short copy; clean domain or URL is fine where natural.
Return ONLY valid JSON:
{
  "comments": [
    { "angle": "Pain-Point Mirror", "text": "..." }
  ]
}`;
  } else if (mod === 'directory') {
    moduleInstructions = `Generate complete Directory Submission copy for "${brandCtx.name}" grounded in the site's Meta Title, Meta Description, and Hero Section, matching the landing page's voice.
STRICT LENGTH LIMITS:
- productName: <= 40 characters
- taglines: 3 distinct taglines, EACH <= 60 characters
- pitches: 3 distinct elevator pitches, EACH <= 140 characters
- summaries: 2 distinct summaries, EACH <= 250 characters
- descriptions: 2 rich, natural product descriptions (350-700 chars each, no corporate fluff)
- category: pick the single best match from ["Marketing & Sales","AI & Machine Learning","Developer Tools","Productivity & Workflow","Design & Creative","E-commerce & Retail","Finance & Fintech","Social & Community","Analytics & Data","Education & Learning","Other"]
- pricingModel: pick best match from ["Freemium","Free","Free Trial","Paid","Contact for Pricing"]
Return ONLY valid JSON:
{
  "productName": "...",
  "websiteUrl": "${brandCtx.url}",
  "category": "...",
  "pricingModel": "...",
  "taglines": ["...", "...", "..."],
  "pitches": ["...", "...", "..."],
  "summaries": ["...", "..."],
  "descriptions": ["...", "..."]
}`;
  } else if (mod === 'contact') {
    moduleInstructions = `Generate a DIRECT Product Introduction message for a website Contact Form, sent FROM the maker/team of "${brandCtx.name}" TO the recipient, grounded in the landing page copy and tone.
CRITICAL PERSPECTIVE RULE:
- Write FROM the team/maker of "${brandCtx.name}" directly introducing "${brandCtx.name}" TO the recipient (what "${brandCtx.name}" does, how it helps, and its URL).
- NEVER write as an external user/fan/customer emailing "${brandCtx.name}" or asking questions about "${brandCtx.name}" (e.g., NEVER write "Quick question about ${brandCtx.name}" or "I came across ${brandCtx.name} and love it").
- NEVER write a third-party recommendation email. It must be a direct introduction of "${brandCtx.name}" from us to them.
CRITICAL FIELD RULE: DO NOT generate, include, or invent a person's Name, Email Address, or Phone Number! Only return "company", "website", "subject", and "message".
Keep the subject direct and natural (e.g. "Introducing ${brandCtx.name} — ..."), and the message concise, clear, and human.
Return ONLY valid JSON:
{
  "company": "${brandCtx.name}",
  "website": "${brandCtx.url}",
  "subject": "...",
  "message": "..."
}`;
  } else if (mod === 'email') {
    moduleInstructions = `Generate 4 distinct DIRECT Introduction Email variations for "${brandCtx.name}" grounded in the site's Meta Title, Meta Description, and Hero Section.
CRITICAL PERSPECTIVE RULE:
- Every email MUST be written FROM the maker/team of "${brandCtx.name}" directly introducing "${brandCtx.name}" TO the recipient (what the product is, what problem it solves / how it helps, and its URL).
- NEVER write as a user asking questions about "${brandCtx.name}" or as a third-party recommending it.
Make them conversational, human, direct, and tone-matched to the landing page—NOT stiff corporate templates. Vary the opening hook across the 4 emails.
Return ONLY valid JSON:
{
  "emails": [
    { "subject": "...", "body": "..." }
  ]
}`;
  } else if (mod === 'dm') {
    moduleInstructions = `Generate 4 distinct SHORT Direct Messages (DMs) across platforms ("Twitter", "LinkedIn", "Reddit", "Instagram") that directly introduce "${brandCtx.name}" based on the landing page copy and hero section.
CRITICAL PERSPECTIVE RULE:
- Each DM must be short (1-2 crisp, natural sentences) sent FROM the maker/team directly introducing "${brandCtx.name}" (what it does / how it helps + link/domain).
- Keep it warm, peer-to-peer, and concise—not spammy or overly formal. For Twitter, use clean domain without "https://".
Return ONLY valid JSON:
{
  "dms": [
    { "platform": "Twitter", "message": "..." },
    { "platform": "LinkedIn", "message": "..." },
    { "platform": "Reddit", "message": "..." },
    { "platform": "Instagram", "message": "..." }
  ]
}`;
  } else if (mod === 'social') {
    moduleInstructions = `Generate 4 distinct, platform-native Social Posts for "${brandCtx.name}" grounded in the site's Meta Title, Meta Description, Hero Section, and Brand Assets.
Platforms & formats:
1. X / Twitter ("single" format, crisp hook + body <= 270 chars total, clean domain without "https://")
2. LinkedIn ("single" format, practical builder takeaway)
3. Reddit ("launch" format, honest maker Share & Tell without hype)
4. Threads ("thread" format, 3-part concise breakdown)
Return ONLY valid JSON:
{
  "socialPosts": [
    { "platform": "X / Twitter", "format": "single", "hook": "...", "body": "...", "ctaUrl": "${brandCtx.url}" },
    { "platform": "LinkedIn", "format": "single", "hook": "...", "body": "...", "ctaUrl": "${brandCtx.url}" },
    { "platform": "Reddit", "format": "launch", "hook": "...", "body": "...", "ctaUrl": "${brandCtx.url}" },
    { "platform": "Threads", "format": "thread", "hook": "...", "body": "...", "ctaUrl": "${brandCtx.url}" }
  ]
}`;
  } else if (mod === 'support') {
    moduleInstructions = `Generate Customer Support Knowledge Base entries for "${brandCtx.name}" grounded in the Brand Assets, pricing summary, features, and landing page copy.
Include 3 clear FAQs (covering General, Pricing & Billing, Onboarding) AND 3 warm, human canned Support Macros (General help, Bug Report follow-up, Feature Request acknowledgement).
Return ONLY valid JSON:
{
  "faqs": [
    { "category": "General", "question": "...", "answer": "..." },
    { "category": "Pricing & Billing", "question": "...", "answer": "..." },
    { "category": "Onboarding", "question": "...", "answer": "..." }
  ],
  "macros": [
    { "category": "General", "title": "...", "body": "..." },
    { "category": "Bug Report", "title": "...", "body": "..." },
    { "category": "Feature Request", "title": "...", "body": "..." }
  ]
}`;
  } else if (mod === 'articles') {
    const seoPresetHint = brandCtx.articlePreset ? `Preferred preset style: "${brandCtx.articlePreset}". ` : '';
    const seoKwHint = brandCtx.targetKeyword ? `Target SEO keyword to weave naturally: "${brandCtx.targetKeyword}". ` : '';
    moduleInstructions = `Generate 2 distinct, high-quality Problem/Solution or How-To articles for "${brandCtx.name}" grounded in the site's Meta Title, Meta Description, Hero Section, and landing page copy. ${seoPresetHint}${seoKwHint}
CRITICAL STRUCTURE RULE:
- Write each article around a clear theme focused on the target user:
  1. The Problem: Clearly describe the real pain point / bottleneck the target user struggles with.
  2. Why Existing Approaches Fall Short: Explain the friction or wasted effort in common workflows.
  3. The Solution & How "${brandCtx.name}" Helps: Show practically how "${brandCtx.name}" solves that problem and helps the target user get better results.
- Each article should be ~350-550 words, insightful and practical, matching the landing page's voice/tone (not stiff corporate fluff), with clean paragraph breaks and natural placement of ${brandCtx.url || brandCtx.name}.
- Also generate SEO metadata: "preset" ("problem-solution"|"how-to"|"comparison"|"launch-story"|"changelog"), "targetKeyword", "slug" (lowercase hyphenated), and "metaDescription" (STRICTLY <= 160 characters).
Return ONLY valid JSON:
{
  "articles": [
    { "title": "...", "preset": "problem-solution", "targetKeyword": "...", "slug": "...", "metaDescription": "...", "body": "..." },
    { "title": "...", "preset": "how-to", "targetKeyword": "...", "slug": "...", "metaDescription": "...", "body": "..." }
  ]
}`;
  }

  const systemInstruction = `${toneRules}\n\n${moduleInstructions}`;
  const effectiveOrKey = String(params.openRouterKey || '').trim();
  const userGeminiKey = String(params.geminiApiKey || '').trim();

  let parsedPayload: Record<string, any> | null = null;
  let source = 'local-landing-synthesis';

  if (effectiveOrKey) {
    try {
      const orModel = String(params.aiModel || '').trim() || 'deepseek/deepseek-chat';
      const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${effectiveOrKey}`,
          'HTTP-Referer': 'https://smartposter.pro',
          'X-Title': 'Smart Poster Auto Generate',
        },
        body: JSON.stringify({
          model: orModel,
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: `${contextBrief}\n\nGenerate JSON now.` },
          ],
          temperature: 0.7,
          max_tokens: 3200,
        }),
      });
      if (orRes.ok) {
        const orData: any = await orRes.json();
        const raw = String(orData?.choices?.[0]?.message?.content || '').trim();
        const clean = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
        const firstBrace = clean.indexOf('{');
        const lastBrace = clean.lastIndexOf('}');
        const jsonSlice = firstBrace !== -1 && lastBrace > firstBrace ? clean.slice(firstBrace, lastBrace + 1) : clean;
        const candidate = JSON.parse(jsonSlice);
        if (candidate && typeof candidate === 'object') {
          parsedPayload = candidate;
          source = `openrouter (${orModel})`;
        }
      }
    } catch {}
  }

  if (!parsedPayload && userGeminiKey) {
    try {
      const gemResult = await callUserGeminiRestCf({
        apiKey: userGeminiKey,
        model: params.aiModel,
        systemInstruction,
        prompt: `${contextBrief}\n\nGenerate JSON now.`,
        temperature: 0.7,
        maxOutputTokens: 3200,
        jsonMode: true,
      });
      if (gemResult.ok && gemResult.text) {
        const clean = gemResult.text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
        const candidate = JSON.parse(clean);
        if (candidate && typeof candidate === 'object') {
          parsedPayload = candidate;
          source = `gemini (${gemResult.model})`;
        }
      }
    } catch {}
  }

  if (!parsedPayload) {
    parsedPayload = buildAutoGenerateFallback(mod, brandCtx, landing);
    source = 'local-landing-synthesis';
  }

  // Guardrails
  if (mod === 'contact') {
    delete parsedPayload.name;
    delete parsedPayload.senderName;
    delete parsedPayload.email;
    delete parsedPayload.senderEmail;
    delete parsedPayload.phone;
    parsedPayload.company = String(parsedPayload.company || brandCtx.name || '').trim();
    parsedPayload.website = String(parsedPayload.website || brandCtx.url || '').trim();
    parsedPayload.subject = String(parsedPayload.subject || '').trim();
    parsedPayload.message = String(parsedPayload.message || '').trim();
  } else if (mod === 'directory') {
    parsedPayload.productName = smartTruncate(String(parsedPayload.productName || brandCtx.name || ''), 40);
    parsedPayload.websiteUrl = String(parsedPayload.websiteUrl || brandCtx.url || '').trim();
    if (Array.isArray(parsedPayload.taglines)) {
      parsedPayload.taglines = parsedPayload.taglines.map((t: any) => smartTruncate(String(t || ''), 60)).filter(Boolean);
    }
    if (Array.isArray(parsedPayload.pitches)) {
      parsedPayload.pitches = parsedPayload.pitches.map((p: any) => smartTruncate(String(p || ''), 140)).filter(Boolean);
    }
    if (Array.isArray(parsedPayload.summaries)) {
      parsedPayload.summaries = parsedPayload.summaries.map((s: any) => smartTruncate(String(s || ''), 250)).filter(Boolean);
    }
    if (Array.isArray(parsedPayload.descriptions)) {
      parsedPayload.descriptions = parsedPayload.descriptions.map((d: any) => String(d || '').trim()).filter(Boolean);
    }
  } else if (mod === 'comments') {
    const list = Array.isArray(parsedPayload.comments) ? parsedPayload.comments : [];
    parsedPayload.comments = list
      .map((c: any, idx: number) => {
        if (typeof c === 'string') return { angle: `Pitch ${idx + 1}`, text: c.trim() };
        return { angle: String(c?.angle || `Pitch ${idx + 1}`).trim(), text: String(c?.text || '').trim() };
      })
      .filter((c: any) => c.text);
    if (parsedPayload.comments.length < 6) {
      const fallback = buildAutoGenerateFallback('comments', brandCtx, landing).comments;
      for (const fc of fallback) {
        if (parsedPayload.comments.length >= 8) break;
        parsedPayload.comments.push(fc);
      }
    }
  } else if (mod === 'articles' && Array.isArray(parsedPayload.articles)) {
    parsedPayload.articles = parsedPayload.articles
      .map((a: any) => {
        const title = String(a?.title || '').trim();
        const body = String(a?.body || '').trim();
        if (!title && !body) return null;
        return {
          title: title || `${brandCtx.name} Guide`,
          preset: String(a?.preset || brandCtx.articlePreset || 'problem-solution').trim(),
          targetKeyword: String(a?.targetKeyword || brandCtx.targetKeyword || '').trim(),
          slug: slugifySeoText(a?.slug || title || brandCtx.name),
          metaDescription: smartTruncate(String(a?.metaDescription || brandCtx.description || ''), 160),
          body,
        };
      })
      .filter(Boolean);
  } else if (mod === 'social') {
    const list = Array.isArray(parsedPayload.socialPosts) ? parsedPayload.socialPosts : [];
    parsedPayload.socialPosts = list
      .map((p: any) => ({
        platform: String(p?.platform || 'X / Twitter').trim(),
        format: String(p?.format || 'single').trim(),
        hook: String(p?.hook || '').trim(),
        body: String(p?.body || '').trim(),
        ctaUrl: String(p?.ctaUrl || brandCtx.url || '').trim(),
      }))
      .filter((p: any) => p.hook || p.body);
  } else if (mod === 'support') {
    const faqs = Array.isArray(parsedPayload.faqs) ? parsedPayload.faqs : [];
    const macros = Array.isArray(parsedPayload.macros) ? parsedPayload.macros : [];
    parsedPayload.faqs = faqs
      .map((f: any) => ({
        category: String(f?.category || 'General').trim(),
        question: String(f?.question || '').trim(),
        answer: String(f?.answer || '').trim(),
      }))
      .filter((f: any) => f.question || f.answer);
    parsedPayload.macros = macros
      .map((m: any) => ({
        category: String(m?.category || 'General').trim(),
        title: String(m?.title || '').trim(),
        body: String(m?.body || '').trim(),
      }))
      .filter((m: any) => m.title || m.body);
  }

  return {
    ok: true as const,
    module: mod,
    data: parsedPayload,
    landingContext: landing,
    source,
  };
}
