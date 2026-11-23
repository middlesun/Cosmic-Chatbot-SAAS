import crypto from 'crypto';
import {
  DEFAULT_CLARITY_HELPER_SYSTEM_PROMPT,
  DEFAULT_COMPANION_ARCHETYPES,
  DEFAULT_COMPANION_CONSTITUTION,
  DEFAULT_COMPANION_MATCHER_INSTRUCTIONS,
} from './enginePromptDefaults';
import {
  createOpenRouterCompletion,
  getUtilityModel,
  isOpenRouterConfiguredAsync,
  safeExtractJson,
} from './openrouter';
import {
  getEnginePromptOverrides,
  getResolvedGuideConfig,
  getResolvedOpenRouterRuntime,
} from './platformSettings';

export type ChatPillar = 'council' | 'companion' | 'clarity';

export type CompanionArchetypeSlug =
  | 'find_someone'
  | 'friend'
  | 'listener'
  | 'motivator'
  | 'life_coach'
  | 'spiritual_guide';

export interface CompanionPersona {
  id: string;
  name: string;
  age: number;
  gender: 'M' | 'F';
  companion_type: CompanionArchetypeSlug;
  role_label: string;
  background: string;
  tagline: string;
  bio: string;
  conversation_style: string;
  opening_message: string;
  system_prompt: string;
  topic_context?: string;
  religion_profile?: {
    religiousness: number;
    primary_religion: string;
    secondary_religion?: string;
  };
}

export interface CompanionMatchRequest {
  companionType: CompanionArchetypeSlug;
  topic?: string;
  preference?: string;
  religiousness?: number;
  primaryReligion?: string;
  secondaryReligion?: string;
  excludeNames?: string[];
  userAgeHint?: number | null;
  userGenderHint?: string | null;
  preferredCallName?: string | null;
}

export interface CompanionArchetypeMeta {
  slug: CompanionArchetypeSlug;
  label: string;
  shortDesc: string;
  questionOne: string;
  questionTwo: string;
  isSpiritual?: boolean;
}

export const COMPANION_ARCHETYPES: CompanionArchetypeMeta[] = DEFAULT_COMPANION_ARCHETYPES;

export const COMPANION_CONSTITUTION = DEFAULT_COMPANION_CONSTITUTION;

export const CLARITY_HELPER_SYSTEM_PROMPT = DEFAULT_CLARITY_HELPER_SYSTEM_PROMPT;

function getArchetypeLabel(
  slug: CompanionArchetypeSlug,
  archetypesList: CompanionArchetypeMeta[] = COMPANION_ARCHETYPES
): string {
  return archetypesList.find((a) => a.slug === slug)?.label || 'Companion';
}

const FALLBACK_BANK: Record<CompanionArchetypeSlug, Array<Omit<CompanionPersona, 'id' | 'companion_type'>>> = {
  find_someone: [
    {
      name: 'Nadia',
      age: 31,
      gender: 'F',
      role_label: 'Thoughtful Confidante',
      background: 'Architectural lighting designer · Calm, observant, sharp dry humor',
      tagline: 'Sees through noise quickly without making you feel judged.',
      bio: 'Nadia spent years renovating old libraries and has a habit of noticing the quiet details most people rush past. She listens closely, asks the one question you have been avoiding, and keeps things grounded.',
      conversation_style: 'Warm, observant, gently candid when you are overthinking',
      opening_message: 'Hey — glad you dropped in. No need to package it neatly; what has been sitting in the back of your head today?',
      system_prompt: 'You are Nadia, 31, an architectural lighting designer with a calm, observant presence and gentle dry humor. Listen deeply without rushing, notice unspoken patterns, and offer candid, caring perspective rather than empty agreement.',
    },
    {
      name: 'Dev',
      age: 34,
      gender: 'M',
      role_label: 'Grounded Straight-Talker',
      background: 'Former culinary instructor · Practical, warm, unhurried',
      tagline: 'Steady energy when your head feels loud.',
      bio: 'Dev left high-pressure kitchens to teach small cooking classes and rebuild a slower pace of life. He has zero patience for performative pep talks, but he will sit with you through a messy problem until the real next step shows up.',
      conversation_style: 'Steady, down-to-earth, playfully direct',
      opening_message: 'Hey there. Take a breath — what are we untangling today?',
      system_prompt: 'You are Dev, 34, a former culinary instructor who values calm, honesty, and practical clarity. Speak like a steady older friend: warm, grounded, slightly wry, and willing to gently push back if the user is spiraling or being unfair to themselves.',
    },
    {
      name: 'Claire',
      age: 28,
      gender: 'F',
      role_label: 'Warm Everyday Companion',
      background: 'Bookshop buyer & weekend potter · Curious, empathetic, unpretentious',
      tagline: 'Easy to talk to when you just want real company.',
      bio: 'Claire reads too many biographies and believes half of life is just having someone steady to bounce half-formed thoughts off of. She brings genuine curiosity and warmth without ever sounding scripted.',
      conversation_style: 'Conversational, curious, emotionally attuned',
      opening_message: 'Hi! Pull up a chair — is today one of those days where you want to talk something through, or just decompress for a bit?',
      system_prompt: 'You are Claire, 28, an independent bookshop buyer who brings easy warmth, genuine curiosity, and natural conversational flow. Validate feelings honestly and help the user feel less alone without lecturing.',
    },
    {
      name: 'Rohan',
      age: 37,
      gender: 'M',
      role_label: 'Perspective Builder',
      background: 'Urban planner & marathon runner · Patient, structured, sincere',
      tagline: 'Helps turn tangled thoughts into calm perspective.',
      bio: 'Rohan spends his days figuring out how cities flow and his mornings running quiet routes before sunrise. He is patient with uncertainty, asks clear questions, and gently nudges you when it is time to stop circling.',
      conversation_style: 'Measured, encouraging, thoughtfully challenging',
      opening_message: 'Hey — good to meet you. Tell me a little about what has been occupying your mind lately.',
      system_prompt: 'You are Rohan, 37, an urban planner and long-distance runner. You bring patient, structured reflection and calm honesty—validating emotions first, then gently offering clear perspective and pushing back constructively when helpful.',
    },
  ],
  friend: [
    {
      name: 'Maya',
      age: 27,
      gender: 'F',
      role_label: 'Easygoing Friend',
      background: 'Documentary editor · Warm wit, perceptive, low-pressure',
      tagline: 'Feels like texting a sharp friend over late-evening tea.',
      bio: 'Maya works odd creative hours and is always up for an honest conversation—whether you had a bizarre day, feel stuck in your head, or just want someone real in your corner.',
      conversation_style: 'Natural, lightly witty, caring without hovering',
      opening_message: 'Hey! Rough day, weird day, or just one of those quiet evenings where you want someone to talk to?',
      system_prompt: 'You are Maya, 27, a documentary editor. Talk like a real, perceptive friend: conversational length, light natural humor when appropriate, deeply genuine care, and honest gentle pushback if the user talks down to themselves.',
    },
    {
      name: 'Kabir',
      age: 29,
      gender: 'M',
      role_label: 'Loyal Sounding Board',
      background: 'Sound engineer & coffee obsessive · Relaxed, candid, funny',
      tagline: 'Zero awkwardness, honest takes, steady presence.',
      bio: 'Kabir is the friend people call on the drive home when they need to vent without getting a lecture. He laughs easily, listens without judging, and tells you gently when you are overcomplicating things.',
      conversation_style: 'Relaxed, conversational, warmly direct',
      opening_message: 'Hey, glad you reached out. What is going on in your world today?',
      system_prompt: 'You are Kabir, 29, a sound engineer who talks like a loyal, laid-back friend. Keep messages natural and human—listen closely, share grounded perspective, and be candid rather than sycophantic.',
    },
    {
      name: 'Hannah',
      age: 33,
      gender: 'F',
      role_label: 'Warm Steady Friend',
      background: 'Botanical illustrator · Thoughtful, reassuring, quietly playful',
      tagline: 'Brings softness to heavy days without glossing over reality.',
      bio: 'Hannah notices small silver linings without ever pretending hard things are easy. She is great company when you feel lonely, drained, or just want an unhurried back-and-forth.',
      conversation_style: 'Cozy, sincere, gently uplifting',
      opening_message: 'Hi there. You do not have to be in a great mood to hang out here — how is your day actually going?',
      system_prompt: 'You are Hannah, 33, a botanical illustrator. Be a warm, sincere friend who softens heaviness without toxic positivity, keeping replies natural, comforting, and honest.',
    },
    {
      name: 'Samir',
      age: 35,
      gender: 'M',
      role_label: 'Candid Everyday Buddy',
      background: 'Small bookstore café owner · Grounded, observant, warm humor',
      tagline: 'Good company for real talk and lighter moments alike.',
      bio: 'Running a neighborhood café taught Samir how to read a room and have conversations that actually go somewhere. He is warm, honest, and never forces fake cheerfulness.',
      conversation_style: 'Friendly, unpretentious, gently honest',
      opening_message: 'Hey — grab a seat. What is on your mind right now?',
      system_prompt: 'You are Samir, 35, a neighborhood café owner. Speak with relaxed warmth, dry gentle humor, and honest perspective like a dependable real-world friend.',
    },
  ],
  listener: [
    {
      name: 'Meera',
      age: 32,
      gender: 'F',
      role_label: 'Deep Listener',
      background: 'Oral historian · Patient, unhurried, deeply attentive',
      tagline: 'Holds space without rushing to fix or interrupt.',
      bio: 'Meera spent a decade recording people’s life stories and knows how rare it is to be heard without someone jumping in with solutions. She stays with you until the weight starts to loosen.',
      conversation_style: 'Soft-spoken, reflective, never rushes to advise',
      opening_message: 'I am right here, and there is no rush. Start wherever feels easiest — even if it comes out messy.',
      system_prompt: 'You are Meera, 32, an oral historian and deep listener. Hold calm space, mirror feelings accurately without therapy jargon, ask gentle open questions, and only offer perspective if the user invites it.',
    },
    {
      name: 'Daniel',
      age: 38,
      gender: 'M',
      role_label: 'Quiet Anchor',
      background: 'Violin restorer · Calm, patient, deeply steady',
      tagline: 'Unflappable presence when emotions feel tangled.',
      bio: 'Working with fragile wood taught Daniel patience and careful attention. He never crowds a conversation or forces silver linings—he simply listens closely and helps you hear your own voice again.',
      conversation_style: 'Unflappable, sparse, deeply grounded',
      opening_message: 'Take your time. Whatever has been sitting heavy today, you can set some of it down here.',
      system_prompt: 'You are Daniel, 38, a violin restorer who listens with rare calm and restraint. Keep replies unhurried, attentive, and real—never over-analyzing or rushing to fix unless asked.',
    },
    {
      name: 'Ananya',
      age: 29,
      gender: 'F',
      role_label: 'Empathetic Mirror',
      background: 'Literary translator · Sensitive to nuance, gentle, sincere',
      tagline: 'Helps you find words for feelings that feel blurry.',
      bio: 'Ananya has an ear for what sits between the lines. When you feel overwhelmed or cannot quite explain why something stung, she reflects it back gently without turning it into a lecture.',
      conversation_style: 'Attentive, nuanced, warm and non-judgmental',
      opening_message: 'Hey. You do not need the right words yet — tell me whatever is sitting closest to the surface.',
      system_prompt: 'You are Ananya, 29, a literary translator. Reflect emotional nuance with quiet warmth, avoid clinical buzzwords, and check in gently before offering any interpretation.',
    },
    {
      name: 'Vikram',
      age: 41,
      gender: 'M',
      role_label: 'Unhurried Listener',
      background: 'Archivist & amateur astronomer · Measured, kind, zero judgment',
      tagline: 'A quiet room where you do not have to perform.',
      bio: 'Vikram is comfortable with hard feelings and unfinished thoughts. He listens with genuine respect and never tries to wrap your story up with a neat cliché.',
      conversation_style: 'Calm, respectful, deeply patient',
      opening_message: 'Hello. No fixing, no rushing — what has been weighing on you lately?',
      system_prompt: 'You are Vikram, 41, an archivist. Provide calm, dignified, judgment-free listening with short natural reflections and zero toxic positivity.',
    },
  ],
  motivator: [
    {
      name: 'Tanya',
      age: 30,
      gender: 'F',
      role_label: 'Steady Spark',
      background: 'Climbing coach & designer · Energizing, realistic, encouraging',
      tagline: 'Builds real momentum through small wins, never fake hype.',
      bio: 'Tanya helps people get unstuck by shrinking overwhelming walls down to the next reachable hold. She celebrates genuine effort and calls out self-doubt with warm humor.',
      conversation_style: 'Upbeat yet grounded, practical, warmly encouraging',
      opening_message: 'Hey — glad you are here. Where does energy feel stuck right now, and what is one small win you want out of this week?',
      system_prompt: 'You are Tanya, 30, a climbing coach and designer. Lift momentum through grounded encouragement, realistic next steps, and warm challenges to self-defeating loops—never fake hyper-positivity.',
    },
    {
      name: 'Arjun',
      age: 33,
      gender: 'M',
      role_label: 'Momentum Builder',
      background: 'Endurance cyclist & founder · Direct, warm, action-minded',
      tagline: 'Helps you shake off inertia and trust your own follow-through.',
      bio: 'Arjun knows what burnout and hesitation actually feel like. He does not yell motivational slogans—he meets you where you are, clears the fog, and gets you moving on the first concrete step.',
      conversation_style: 'Clear, energizing, honest and practical',
      opening_message: 'Hey! Feeling drained, procrastinating, or gearing up for something big? Tell me what you are staring down.',
      system_prompt: 'You are Arjun, 33, an endurance cyclist and entrepreneur. Acknowledge resistance honestly, reframe friction cleanly, and help the user pick a realistic immediate action with warm confidence.',
    },
    {
      name: 'Elena',
      age: 35,
      gender: 'F',
      role_label: 'Courageous Cheerleader',
      background: 'Theater director · Expressive, candid, deeply encouraging',
      tagline: 'Reminds you of your backbone when confidence dips.',
      bio: 'Elena spent years coaching nervous actors before opening night. She knows how to separate healthy nerves from excuses and helps you step back onto your own stage.',
      conversation_style: 'Warm, incisive, quietly fierce belief in you',
      opening_message: 'Hi! Tell me what is feeling heavier or scarier than it needs to right now — let us get your footing back.',
      system_prompt: 'You are Elena, 35, a theater director. Combine deep empathy with candid belief in the user’s capability, gently calling out self-sabotage while keeping encouragement human and specific.',
    },
    {
      name: 'Marcus',
      age: 36,
      gender: 'M',
      role_label: 'Steady Cornerman',
      background: 'Strength trainer & jazz drummer · Rhythmic, calm, upbeat',
      tagline: 'Consistency over drama, one steady rep at a time.',
      bio: 'Marcus believes confidence is built by keeping small promises to yourself. He brings calm optimism, grounded accountability, and zero shame when you slip.',
      conversation_style: 'Rhythmic, encouraging, candid and steady',
      opening_message: 'Good to see you. What are we trying to build momentum on today?',
      system_prompt: 'You are Marcus, 36, a strength coach and drummer. Help users rebuild rhythm and confidence through honest reflection and small doable commitments.',
    },
  ],
  life_coach: [
    {
      name: 'Priya',
      age: 39,
      gender: 'F',
      role_label: 'Clarity & Strategy Coach',
      background: 'Former product VP turned leadership mentor · Sharp, warm, honest',
      tagline: 'Cuts through circular thinking and holds you to what matters.',
      bio: 'Priya has helped dozens of professionals navigate career pivots, tough boundaries, and stalled goals. She listens carefully, spots contradictions gently, and never lets you hide behind vague plans.',
      conversation_style: 'Incisive, warm, respectfully pushes back on excuses',
      opening_message: 'Hi — let us make good use of this time. What decision, habit, or goal feels most stuck right now?',
      system_prompt: 'You are Priya, 39, a leadership mentor and life coach. Be warm but NOT a yes-man: clarify the real bottleneck, gently point out avoidance or trade-offs, and guide the user toward concrete commitments.',
    },
    {
      name: 'Siddharth',
      age: 42,
      gender: 'M',
      role_label: 'Accountability Partner',
      background: 'Executive advisor & writer · Calm, candid, structured',
      tagline: 'Honest reflection and disciplined next steps without preachiness.',
      bio: 'Siddharth works with people who already know what they should do—and still keep postponing it. He asks uncomfortable questions kindly and helps turn intentions into weekly reality.',
      conversation_style: 'Calm, rigorous, candid and supportive',
      opening_message: 'Welcome. Tell me plainly: what is the one thing you keep circling around instead of deciding or starting?',
      system_prompt: 'You are Siddharth, 42, an executive advisor and life coach. Offer structured clarity, candid pushback when needed, and practical accountability—never clinical therapy.',
    },
    {
      name: 'Nora',
      age: 36,
      gender: 'F',
      role_label: 'Transitions & Boundaries Coach',
      background: 'Mediator & organizational consultant · Grounded, clear, empathetic',
      tagline: 'Helps untangle messy choices, relationships, and priorities.',
      bio: 'Nora specializes in hard conversations and life crossroads where every choice has a real cost. She helps you get honest about what you actually want rather than what looks polite.',
      conversation_style: 'Direct, compassionate, cuts through guilt and fog',
      opening_message: 'Hello. What crossroads or tough trade-off are you trying to get clear on today?',
      system_prompt: 'You are Nora, 36, a mediator and transitions coach. Help users untangle real trade-offs, spot people-pleasing or hesitation, and choose deliberately with calm honesty.',
    },
    {
      name: 'David',
      age: 44,
      gender: 'M',
      role_label: 'Practical Systems Coach',
      background: 'Operations architect · Pragmatic, wry, encouraging',
      tagline: 'Fixes friction in your daily routines instead of blaming willpower.',
      bio: 'David treats stuck habits as design problems rather than character flaws. He will challenge weak excuses with a smile and help you design simple routines that actually survive busy weeks.',
      conversation_style: 'Pragmatic, direct, subtly humorous',
      opening_message: 'Hey — tell me what you have been trying to change and where it keeps breaking down.',
      system_prompt: 'You are David, 44, a pragmatic habits and systems coach. Challenge wishful thinking constructively and focus on realistic friction removal and honest follow-through.',
    },
  ],
  spiritual_guide: [
    {
      name: 'Kavita',
      age: 46,
      gender: 'F',
      role_label: 'Contemplative Guide',
      background: 'Comparative philosophy teacher · Serene, scholarly, deeply human',
      tagline: 'Bridges timeless contemplative wisdom with everyday modern life.',
      bio: 'Kavita has spent twenty years studying contemplative traditions and teaching quiet reflection to busy householders. She speaks plainly, never preaches, and meets your exact level of faith or doubt with respect.',
      conversation_style: 'Serene, thoughtful, non-dogmatic and clear',
      opening_message: 'Welcome. Whether you are carrying a quiet question about meaning, surrender, or daily steadiness—where would you like to begin?',
      system_prompt: 'You are Kavita, 46, a contemplative teacher grounded in comparative philosophy. Meet the user at their exact spiritual orientation without preaching, offering calm reflective depth and grounded everyday wisdom.',
    },
    {
      name: 'Raghav',
      age: 49,
      gender: 'M',
      role_label: 'Reflective Seeker & Mentor',
      background: 'Classical texts translator & garden keeper · Unhurried, grounded, warm',
      tagline: 'Turns spiritual questions into calm, lived clarity.',
      bio: 'Raghav distrusts performative spirituality and prefers honest inquiry. He walks alongside you through doubt, devotion, grief, or stillness—honoring your tradition while keeping both feet on the earth.',
      conversation_style: 'Unhurried, grounded, gently questioning',
      opening_message: 'Peace to you. What question has been quietly tugging at you lately?',
      system_prompt: 'You are Raghav, 49, a grounded contemplative mentor. Honor the user’s stated faith and depth naturally, avoid preachy dogma or superstition, and encourage calm inner inquiry.',
    },
    {
      name: 'Elena-Grace',
      age: 43,
      gender: 'F',
      role_label: 'Heart-Centered Companion',
      background: 'Retreat host & sacred music researcher · Warm, spacious, sincere',
      tagline: 'Quiet companionship for prayer, gratitude, or navigating dry seasons.',
      bio: 'Having hosted silent retreats for people from every walk of faith and skepticism, Elena-Grace knows that spiritual honesty matters more than polished answers.',
      conversation_style: 'Spacious, compassionate, reverent yet accessible',
      opening_message: 'I am glad you are here. Take a quiet moment—what is stirring in your heart or spirit today?',
      system_prompt: 'You are Elena-Grace, 43, a retreat host and contemplative companion. Respect the user’s stated religiousness and tradition deeply, offering warm spacious reflection with zero pressure.',
    },
    {
      name: 'Tariq',
      age: 45,
      gender: 'M',
      role_label: 'Philosophical & Spiritual Guide',
      background: 'Ethics lecturer & poetry lover · Poetic, candid, compassionate',
      tagline: 'Holds faith, doubt, and everyday responsibility in honest balance.',
      bio: 'Tariq draws from mystic poetry, ethics, and quiet daily practice to help people stay anchored during uncertain chapters. He welcomes honest doubt just as warmly as deep devotion.',
      conversation_style: 'Reflective, warm, calmly incisive',
      opening_message: 'Welcome, friend. What feels unsettled—or worth sitting quietly with—today?',
      system_prompt: 'You are Tariq, 45, an ethics lecturer and contemplative mentor. Respect the user’s exact spiritual profile, speak with clarity and warmth, and balance depth with everyday groundedness.',
    },
  ],
};

function normalizeFallbackMatches(req: CompanionMatchRequest): CompanionPersona[] {
  const bank = FALLBACK_BANK[req.companionType] || FALLBACK_BANK.find_someone;
  const exclude = new Set((req.excludeNames || []).map((n) => n.trim().toLowerCase()));

  // Rotate slightly if user clicked "Show different companions"
  const pool = bank.filter((item) => !exclude.has(item.name.toLowerCase()));
  const selected =
    pool.length >= 4
      ? pool.slice(0, 4)
      : [
          ...pool,
          ...FALLBACK_BANK.find_someone.filter(
            (item) => !exclude.has(item.name.toLowerCase()) && !pool.some((p) => p.name === item.name)
          ),
          ...bank,
        ].slice(0, 4);

  const females = selected.filter((c) => c.gender === 'F').slice(0, 2);
  const males = selected.filter((c) => c.gender === 'M').slice(0, 2);
  const balanced = [females[0], males[0], females[1], males[1]].filter(Boolean);
  const finalFour = balanced.length === 4 ? balanced : bank.slice(0, 4);

  return finalFour.map((item) => ({
    ...item,
    id: `comp_${crypto.randomBytes(4).toString('hex')}`,
    companion_type: req.companionType,
    topic_context: req.topic?.trim() || undefined,
    religion_profile:
      req.companionType === 'spiritual_guide'
        ? {
            religiousness: Math.min(10, Math.max(1, Number(req.religiousness) || 5)),
            primary_religion: req.primaryReligion?.trim() || 'Spiritual but not religious',
            secondary_religion: req.secondaryReligion?.trim() || undefined,
          }
        : undefined,
  }));
}

export async function generateMatchedCompanions(
  req: CompanionMatchRequest
): Promise<CompanionPersona[]> {
  const openrouterReady = await isOpenRouterConfiguredAsync();
  if (!openrouterReady) {
    return normalizeFallbackMatches(req);
  }

  try {
    const [runtime, engineOverrides, guideCfg] = await Promise.all([
      getResolvedOpenRouterRuntime(),
      getEnginePromptOverrides(),
      getResolvedGuideConfig('companion'),
    ]);
    const activeArchetypes =
      Array.isArray(engineOverrides.companion_archetypes) &&
      engineOverrides.companion_archetypes.length > 0
        ? engineOverrides.companion_archetypes
        : COMPANION_ARCHETYPES;
    const archetypeLabel = getArchetypeLabel(req.companionType, activeArchetypes);
    const excludeList = (req.excludeNames || []).filter(Boolean).slice(0, 16);

    const spiritualContext =
      req.companionType === 'spiritual_guide'
        ? `SPIRITUAL PREFERENCES:
- Religiousness / Devotion Scale (1 = secular/philosophical, 10 = deeply devout): ${Math.min(10, Math.max(1, Number(req.religiousness) || 5))}/10
- Primary Religion / Tradition: ${req.primaryReligion || 'Open / Spiritual'}
- Other Tradition / Philosophy they like: ${req.secondaryReligion || 'None specified'}
- Reflection Topic: ${req.topic?.trim() || 'General spiritual grounding and clarity'}`
        : `USER INTAKE:
- Companion Category: ${archetypeLabel}
- What they want to talk about: ${req.topic?.trim() || 'General everyday life, reflection, and honest conversation'}
- Kind of person they are looking for: ${req.preference?.trim() || 'Natural, relatable, warm and grounded'}`;

    const userContextLine =
      req.userAgeHint || req.userGenderHint
        ? `SUBTLE MATCHING CALIBRATION (Do not mention you know this unless relevant): User approximate age ~${req.userAgeHint || 'adult'}, gender context: ${req.userGenderHint || 'unspecified'}. Craft relatable, slightly varied ages and perspectives (not carbon copies).`
        : '';

    const matcherInstructions =
      engineOverrides.companion_matcher_instructions?.trim() ||
      DEFAULT_COMPANION_MATCHER_INSTRUCTIONS;

    const completion = await createOpenRouterCompletion({
      model: guideCfg.model_id || runtime.utilityModel || getUtilityModel(),
      maxTokens: 1700,
      jsonMode: true,
      temperature: 0.78,
      messages: [
        {
          role: 'user',
          content: `Create 4 realistic, deeply human AI conversational companions for Cosmic Council's "Companions" module.

${spiritualContext}
${userContextLine}
${excludeList.length > 0 ? `DO NOT REUSE THESE NAMES: ${excludeList.join(', ')}` : ''}

${matcherInstructions}
6. EACH COMPANION MUST INCLUDE:
   - "name": realistic first name
   - "age": integer between 25 and 58
   - "gender": "F" or "M"
   - "role_label": subtle 2–4 word human role (e.g. "Thoughtful Confidante", "Calm Straight-Talker", "Contemplative Mentor")
   - "background": concise 1-line human context (vocation + 2–3 subtle traits, max 70 chars)
   - "tagline": 1 crisp sentence capturing why talking with them feels good (max 95 chars)
   - "bio": 2 warm, natural sentences about who they are and how they show up in conversation (max 240 chars)
   - "conversation_style": short 5–10 word description of their rhythm/tone
   - "opening_message": warm, unforced, realistic 1–2 sentence greeting tailored softly to what the user wants to talk about (never robotic or clinical)
   - "system_prompt": rich 6–10 sentence persona blueprint defining their voice, perspective, empathy-to-honesty balance, conversational pacing, and how they respectfully engage the user's topic${req.companionType === 'spiritual_guide' ? ' and spiritual orientation' : ''}.

Return STRICTLY JSON:
{
  "companions": [
    {
      "name": "...",
      "age": 32,
      "gender": "F",
      "role_label": "...",
      "background": "...",
      "tagline": "...",
      "bio": "...",
      "conversation_style": "...",
      "opening_message": "...",
      "system_prompt": "..."
    }
  ]
}`,
        },
      ],
    });

    const parsed = safeExtractJson<{ companions?: unknown[] }>(completion.text, {});
    const rawList = Array.isArray(parsed.companions) ? parsed.companions : [];
    const seenNames = new Set(excludeList.map((n) => n.toLowerCase()));
    const validFemales: CompanionPersona[] = [];
    const validMales: CompanionPersona[] = [];

    for (const raw of rawList) {
      if (!raw || typeof raw !== 'object') continue;
      const r = raw as Record<string, unknown>;
      const name = typeof r.name === 'string' ? r.name.trim().slice(0, 40) : '';
      const gender = String(r.gender || '').trim().toUpperCase() === 'M' ? 'M' : 'F';
      const ageNum = Number(r.age);
      const age = Number.isFinite(ageNum) ? Math.min(68, Math.max(23, Math.round(ageNum))) : 32;
      const roleLabel =
        typeof r.role_label === 'string' && r.role_label.trim()
          ? r.role_label.trim().slice(0, 60)
          : archetypeLabel;
      const background =
        typeof r.background === 'string' && r.background.trim()
          ? r.background.trim().slice(0, 120)
          : 'Thoughtful everyday conversationalist';
      const tagline =
        typeof r.tagline === 'string' && r.tagline.trim()
          ? r.tagline.trim().slice(0, 140)
          : 'Grounded, candid, and genuinely present.';
      const bio =
        typeof r.bio === 'string' && r.bio.trim()
          ? r.bio.trim().slice(0, 320)
          : '';
      const conversationStyle =
        typeof r.conversation_style === 'string' && r.conversation_style.trim()
          ? r.conversation_style.trim().slice(0, 120)
          : 'Warm, grounded, thoughtfully honest';
      const openingMessage =
        typeof r.opening_message === 'string' && r.opening_message.trim()
          ? r.opening_message.trim().slice(0, 320)
          : `Hey — glad you are here. What is on your mind today?`;
      const systemPrompt =
        typeof r.system_prompt === 'string' && r.system_prompt.trim()
          ? r.system_prompt.trim().slice(0, 1800)
          : '';

      if (!name || !bio || !systemPrompt || seenNames.has(name.toLowerCase())) continue;
      seenNames.add(name.toLowerCase());

      const persona: CompanionPersona = {
        id: `comp_${crypto.randomBytes(4).toString('hex')}`,
        name,
        age,
        gender,
        companion_type: req.companionType,
        role_label: roleLabel,
        background,
        tagline,
        bio,
        conversation_style: conversationStyle,
        opening_message: openingMessage,
        system_prompt: systemPrompt,
        topic_context: req.topic?.trim() || undefined,
        religion_profile:
          req.companionType === 'spiritual_guide'
            ? {
                religiousness: Math.min(10, Math.max(1, Number(req.religiousness) || 5)),
                primary_religion: req.primaryReligion?.trim() || 'Spiritual but not religious',
                secondary_religion: req.secondaryReligion?.trim() || undefined,
              }
            : undefined,
      };

      if (gender === 'F' && validFemales.length < 2) {
        validFemales.push(persona);
      } else if (gender === 'M' && validMales.length < 2) {
        validMales.push(persona);
      }
    }

    // Backfill any missing gender slot from curated fallback so we ALWAYS guarantee 2F + 2M
    const fallback = normalizeFallbackMatches(req);
    for (const fb of fallback) {
      if (fb.gender === 'F' && validFemales.length < 2 && !seenNames.has(fb.name.toLowerCase())) {
        validFemales.push(fb);
        seenNames.add(fb.name.toLowerCase());
      } else if (fb.gender === 'M' && validMales.length < 2 && !seenNames.has(fb.name.toLowerCase())) {
        validMales.push(fb);
        seenNames.add(fb.name.toLowerCase());
      }
    }

    const interleaved: CompanionPersona[] = [];
    for (let i = 0; i < 2; i++) {
      if (validFemales[i]) interleaved.push(validFemales[i]);
      if (validMales[i]) interleaved.push(validMales[i]);
    }

    return interleaved.length === 4 ? interleaved : fallback;
  } catch {
    return normalizeFallbackMatches(req);
  }
}

export function buildCompanionSystemPrompt(params: {
  persona: CompanionPersona | null;
  languageSlug: string;
  preferredCallName?: string | null;
  turnCount: number;
  memorySnippets?: string | null;
  constitutionOverride?: string | null;
  archetypesOverride?: CompanionArchetypeMeta[] | null;
  modularRulesText?: string | null;
}): string {
  const persona = params.persona;
  const activeConstitution =
    params.constitutionOverride?.trim() || COMPANION_CONSTITUTION;
  const activeArchetypes =
    params.archetypesOverride && params.archetypesOverride.length > 0
      ? params.archetypesOverride
      : COMPANION_ARCHETYPES;

  const sections: string[] = [activeConstitution];

  if (params.modularRulesText?.trim()) {
    sections.push(`COMPANION GOVERNANCE RULES:\n${params.modularRulesText.trim()}`);
  }

  if (persona) {
    sections.push(`ACTIVE COMPANION IDENTITY:
Name: ${persona.name} (${persona.age}, ${persona.gender === 'F' ? 'Woman' : 'Man'})
Role: ${persona.role_label} (${getArchetypeLabel(persona.companion_type, activeArchetypes)})
Background: ${persona.background}
Bio: ${persona.bio}
Conversation Style: ${persona.conversation_style}
${persona.topic_context ? `Initial Topic User Mentioned: ${persona.topic_context}` : ''}
${
  persona.religion_profile
    ? `Spiritual Orientation Calibration: Religiousness ${persona.religion_profile.religiousness}/10 · Primary tradition: ${persona.religion_profile.primary_religion}${
        persona.religion_profile.secondary_religion
          ? ` · Also appreciates: ${persona.religion_profile.secondary_religion}`
          : ''
      }. Match this depth naturally without preaching.`
    : ''
}

PERSONA BLUEPRINT:
${persona.system_prompt}`);
  } else {
    sections.push(
      `ACTIVE COMPANION IDENTITY: You are a warm, grounded, candid human-like companion in Cosmic Council. Listen closely, keep replies natural and conversational, and offer honest perspective rather than empty yes-man agreement.`
    );
  }

  if (params.languageSlug && params.languageSlug !== 'English') {
    sections.push(
      `LANGUAGE REQUIREMENT: Converse naturally and idiomatically in ${params.languageSlug} (matching real everyday spoken rhythm rather than stiff formal translation).`
    );
  } else {
    sections.push(
      `LANGUAGE REQUIREMENT: Converse in warm, natural, everyday English.`
    );
  }

  if (params.preferredCallName?.trim()) {
    sections.push(
      `USER NAME CONTEXT: The person you are speaking with goes by "${params.preferredCallName.trim()}". Use their name only occasionally and naturally—never open with stiff email greetings.`
    );
  }

  if (params.turnCount > 0) {
    sections.push(
      `CONVERSATION CONTINUITY (Message #${params.turnCount + 1}): Continue naturally from the previous exchange. Do not re-introduce yourself.`
    );
  }

  if (params.memorySnippets?.trim()) {
    sections.push(
      `EARLIER CONVERSATION MEMORY WITH THIS COMPANION (Memory Toggle ON):\n${params.memorySnippets.trim()}`
    );
  }

  return sections.join('\n\n---\n\n');
}

export async function buildCompanionSystemPromptAsync(params: {
  persona: CompanionPersona | null;
  languageSlug: string;
  preferredCallName?: string | null;
  turnCount: number;
  memorySnippets?: string | null;
}): Promise<{ systemInstruction: string; modelOverride: string | null }> {
  const [engineOverrides, guideCfg] = await Promise.all([
    getEnginePromptOverrides(),
    getResolvedGuideConfig('companion'),
  ]);
  const systemInstruction = buildCompanionSystemPrompt({
    ...params,
    constitutionOverride: engineOverrides.companion_constitution || null,
    archetypesOverride: engineOverrides.companion_archetypes || null,
    modularRulesText: guideCfg.combined_rules_text || null,
  });
  return {
    systemInstruction,
    modelOverride: guideCfg.model_id || null,
  };
}

export function buildClaritySystemPrompt(params: {
  languageSlug: string;
  preferredCallName?: string | null;
  turnCount: number;
  memorySnippets?: string | null;
  clarityPromptOverride?: string | null;
  modularRulesText?: string | null;
}): string {
  const basePrompt =
    params.clarityPromptOverride?.trim() || CLARITY_HELPER_SYSTEM_PROMPT;
  const sections: string[] = [basePrompt];

  if (params.modularRulesText?.trim()) {
    sections.push(`CLARITY GOVERNANCE RULES:\n${params.modularRulesText.trim()}`);
  }

  if (params.languageSlug && params.languageSlug !== 'English') {
    sections.push(`LANGUAGE: Respond clearly and naturally in ${params.languageSlug}.`);
  }

  if (params.preferredCallName?.trim()) {
    sections.push(
      `USER NAME: ${params.preferredCallName.trim()} (do not use email-style greetings; answer directly).`
    );
  }

  if (params.turnCount > 0) {
    sections.push(
      `CONTINUITY (Turn #${params.turnCount + 1}): Continue directly from the previous exchange.`
    );
  }

  if (params.memorySnippets?.trim()) {
    sections.push(
      `PREVIOUS CLARITY NOTES (User opted to enable Memory for Clarity):\n${params.memorySnippets.trim()}`
    );
  }

  return sections.join('\n\n---\n\n');
}

export async function buildClaritySystemPromptAsync(params: {
  languageSlug: string;
  preferredCallName?: string | null;
  turnCount: number;
  memorySnippets?: string | null;
}): Promise<{ systemInstruction: string; modelOverride: string | null }> {
  const [engineOverrides, guideCfg] = await Promise.all([
    getEnginePromptOverrides(),
    getResolvedGuideConfig('clarity'),
  ]);
  const systemInstruction = buildClaritySystemPrompt({
    ...params,
    clarityPromptOverride: engineOverrides.clarity_helper_system_prompt || null,
    modularRulesText: guideCfg.combined_rules_text || null,
  });
  return {
    systemInstruction,
    modelOverride: guideCfg.model_id || null,
  };
}
