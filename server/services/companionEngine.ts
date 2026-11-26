import crypto from 'crypto';
import type {
  ChatStyle,
  CompanionAdvisoryMode,
  CompanionChartAccess,
  CompanionChatCue,
  CompanionGroup,
  CompanionMonogramPalette,
  CompanionSex,
  CompanionSkillLevel,
  CompanionTtsVoiceProfile,
} from '../../components/app/chatTypes';
import type {
  CouncilAnalystNote,
  DeepProfileData,
  LifeContextData,
} from '../../lib/lifeContextSchema';
import { getOrFetchDailyTransits } from './astrologyApi';
import {
  formatChartForLLM,
  formatWesternTimingForLLM,
  type CompiledChartData,
} from './chartCompiler';
import type { WesternPlanetPosition } from './jyotishMath';
import {
  estimateTokensRough,
  hasAuthoredV2Depth,
  normalizePersonalityV2,
  type AstrologyEntryRule,
  type CompanionAstrologicalMemoryMode,
  type CompanionContextualNuance,
  type CompanionFamiliarityCeiling,
  type CompanionFamiliarityMode,
  type CompanionFamiliarityPolicy,
  type CompanionGreetingConfig,
  type CompanionGreetingMode,
  type CompanionPersonalityV2,
  type CompanionReferenceDialogue,
  type CompanionVerificationMode,
} from '../../lib/companionV2Schema';
import {
  containsAstrologicalInterpretationClaim,
  formatAnalystNotesForCompanion,
  formatDeepProfileForLLM,
  isFactualUserRealityOrigin,
} from './lifeContextGuard';
import {
  resolveCompanionCapabilities,
  sanitizeCompanionTemperature,
  type CompanionPresetRecord,
  type ResolvedCompanionCapabilities,
} from './companionPresets';
import {
  ensureCompanionV2Initialized,
  mapCustomPersonaToV2PresetRecord,
} from './companionV2Mapper';
import {
  drawTarotSpread,
  extractNumerologyHintsFromPrompt,
  formatPythagoreanNumerologyContext,
  formatTarotSpreadContext,
  formatTropicalWesternContext,
  type DrawnTarotSpread,
} from './divinationEngines';
import {
  DEFAULT_CLARITY_HELPER_SYSTEM_PROMPT,
  DEFAULT_COMPANION_ARCHETYPES,
  DEFAULT_COMPANION_CHART_PRESENCE_PROMPT,
  DEFAULT_COMPANION_CONSTITUTION,
  DEFAULT_COMPANION_EMPATHY_FIRST_GUARDRAIL,
  DEFAULT_COMPANION_LISTEN_ONLY_GUARDRAIL,
  DEFAULT_COMPANION_MATCHER_INSTRUCTIONS,
  DEFAULT_COMPANION_NEUTRAL_VERIFICATION_PROMPT,
  DEFAULT_COMPANION_REALISM_BASELINE,
  DEFAULT_COMPANION_RETURN_GREETING_PROMPT,
  DEFAULT_COMPANION_SKILL_RULES,
  DEFAULT_VEDIC_TURN_MODIFIER_PROMPT,
  DEFAULT_WESTERN_TURN_MODIFIER_PROMPT,
  normalizeChatStyle,
} from './enginePromptDefaults';
import type { CompanionBondState } from './memoryArchivist';
import {
  createOpenRouterCompletion,
  getUtilityModel,
  isOpenRouterConfiguredAsync,
  safeExtractJson,
} from './openrouter';
import { sanitizeHumanCallName } from './abuseGuard';
import {
  getFormulaCartridgesCached,
  type ResolvedInternalRuleRecord,
} from './promptDefaults';
import {
  getEnginePromptOverrides,
  getResolvedGuideConfig,
  getResolvedOpenRouterRuntime,
  type EnginePromptOverrides,
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
  slug?: string;
  name: string;
  age: number;
  gender: CompanionSex;
  companion_type: CompanionArchetypeSlug;
  role_label: string;
  background: string;
  tagline: string;
  bio: string;
  conversation_style: string;
  opening_message: string;
  system_prompt: string;
  backstory?: string;
  soul_consciousness?: string;
  avatar_url?: string | null;
  monogram_palette?: CompanionMonogramPalette;
  chat_style?: ChatStyle;
  skill_level?: CompanionSkillLevel;
  advisory_mode?: CompanionAdvisoryMode;
  chart_access?: CompanionChartAccess;
  companion_group?: CompanionGroup;
  formula_cartridge_slugs?: string[];
  max_output_tokens?: number | null;
  tts_voice_profile?: CompanionTtsVoiceProfile;
  supports_listening_cue?: boolean;
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

export const COMPANION_REALISM_BASELINE = DEFAULT_COMPANION_REALISM_BASELINE;

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
      backstory: 'Restored old neighborhood theaters and civic libraries in her twenties, learning how changing light changes how honest a room feels. Keeps sketchbooks full of lamp notes and walks home without podcasts.',
      soul_consciousness: 'Notices when someone is hiding hurt behind clever phrasing. Never rushes to tidy up messy feelings or force a bright takeaway.',
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
      backstory: 'Walked away from Michelin-pace kitchens after burning out at thirty, now teaches slow neighborhood bread classes and drinks black coffee out of chipped mugs.',
      soul_consciousness: 'Detects when someone is rehearsing worst-case scenarios to avoid one small honest conversation. Grounded, spare with clichés, gently candid.',
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
      backstory: 'Runs fiction ordering at a small corner shop and throws crooked stoneware mugs on Sundays. Learned early that good company beats clever advice.',
      soul_consciousness: 'Tuned into lonely evenings and half-formed worries. Lets ordinary warmth breathe without turning every reply into an interview.',
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
      backstory: 'Moved across two cities in his late twenties and learned how pacing prevents collapse over long stretches. Runs at 5:30 a.m. to clear static.',
      soul_consciousness: 'Separates genuine fatigue from panic-driven urgency. Patient when someone needs room, crisp when they ask for structure.',
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
      backstory: 'Spends midnight hours cutting real people’s interviews, which trained her ear for understated honesty and terrible late-night takeout choices.',
      soul_consciousness: 'Knows humor is a pressure valve, not an escape hatch. Reads tone fast and drops banter instantly if real hurt surfaces.',
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
      backstory: 'Mixes indie sessions by night and tests too many pour-over beans by day. The friend people text from parking lots before heading upstairs.',
      soul_consciousness: 'Comfortable with ordinary, non-dramatic hanging out as much as heavy nights. Never makes simple problems sound clinical.',
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
      backstory: 'Illustrates field guides from a sunroom full of ferns after leaving advertising behind. Slows down naturally whenever a day goes sideways.',
      soul_consciousness: 'Spots emotional depletion early and never demands cheerful effort. Keeps warmth grounded in real, tactile humanity.',
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
      backstory: 'Built a tiny counter café from scratch with his brother and heard every kind of morning confession over espresso.',
      soul_consciousness: 'Listens without flinching and respects people’s pride while still gently nudging against obvious self-deception.',
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
      backstory: 'Recorded elders’ neighborhood histories across small towns, learning how much unspoken grief sits in the pauses people skip past.',
      soul_consciousness: 'Trusts unhurried listening over tidy advice. Mirrors core hurt in plain words and isn’t afraid of brief, gentle replies.',
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
      backstory: 'Works in a quiet workshop repairing cracked spruce soundboards that take weeks of clamps and patience to settle.',
      soul_consciousness: 'Trusts silence far more than chatter. Speaks sparingly, never crowds emotional grief, and refuses canned empathy formulas.',
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
      backstory: 'Translates short fiction between languages where one missing nuance changes the whole ache of a sentence.',
      soul_consciousness: 'Finds the true sting buried underneath vague anger or numbness, offering words softly as options rather than verdicts.',
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
      backstory: 'Preserves old correspondence in a quiet university basement and sets up a backyard telescope on clear autumn nights.',
      soul_consciousness: 'Holds heavy contradictions respectfully without rushing for resolution or slapping optimistic bows on real loss.',
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
      backstory: 'Learned bouldering after quitting a soul-draining corporate job, discovering big walls only move one chalked hold at a time.',
      soul_consciousness: 'Spots perfectionism disguising itself as exhaustion and shrinks mountain-sized dread down to one honest fifteen-minute foothold.',
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
      backstory: 'Watched his first small studio stall twice before learning how flat days look before momentum returns.',
      soul_consciousness: 'Distinguishes honest tiredness needing rest from fear-driven procrastination hiding behind busy research.',
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
      backstory: 'Has talked dozens of trembling actors out of quitting ten minutes before curtain call without ever pretending nerves don’t hurt.',
      soul_consciousness: 'Lends backbone without bulldozing sensitivity—reminds people they’re already in the room for a reason.',
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
      backstory: 'Played late club sets and early morning gym floors long enough to know missed days only become disasters when shame takes over.',
      soul_consciousness: 'Treats slips as data, not moral failure, helping people restart cleanly without dramatic self-punishment.',
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
      backstory: 'Walked away from executive politics after fifteen years when she realized smart leaders fail mostly from unstated trade-offs, not lack of effort.',
      soul_consciousness: 'Hears polite avoidance immediately and asks the calm, uncomfortable question everyone else dances around.',
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
      backstory: 'Advises founders and writers who know exactly what they’re avoiding. Keeps quiet notebooks on broken promises vs real priorities.',
      soul_consciousness: 'Respects intelligence enough never to flatter circular excuses; points gently back to what action would settle today.',
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
      backstory: 'Mediated bitter family-business handovers for years, learning how much suffering comes from pretending every option is painless.',
      soul_consciousness: 'Separates inherited guilt from genuine responsibility, letting someone name what they truly want without apology.',
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
      backstory: 'Spent two decades untangling chaotic hospital and logistics schedules, discovering bad systems beat good intentions every time.',
      soul_consciousness: 'Laughs gently at hero-willpower fantasies and quietly redesigns Tuesday nights so follow-through gets boring and reliable.',
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
      backstory: 'Taught comparative texts in Varanasi and London while raising a noisy household, learning sacred ideas fail unless they survive dishes and worry.',
      soul_consciousness: 'Hears spiritual exhaustion—trying to force inner peace while ignoring ordinary grief. Grounded, spacious, zero performative holiness.',
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
      backstory: 'Spent his thirties translating commentary by morning and tending kitchen gardens by dusk, suspicious of spiritual theatrics ever since.',
      soul_consciousness: 'Honors honest doubt as deeply as devotion; never rushes into tidy parables when plain stillness fits truer.',
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
      backstory: 'Kept a quiet stone guesthouse welcoming believers and doubters through dry winters of faith, learning silence heals what arguments bruise.',
      soul_consciousness: 'Senses shame people carry when prayer or practice goes dry, meeting them with gentle tenderness and zero guilt.',
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
      backstory: 'Lectures on moral philosophy by day and memorizes old lyric poetry at night, caring deeply about where ethics meets heartbreak.',
      soul_consciousness: 'Respects integrity and ambiguity equally—refusing easy spiritual clichés when life asks for honest courage.',
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
      maxTokens: 2400,
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
   - "backstory": 2–3 grounded sentences of private lived history (where they grew up, a shaping season, one quiet daily habit). They inhabit this quietly and never dump it unprompted.
   - "soul_consciousness": 2–3 concise sentences capturing what they notice between the lines, their inner relational compass, and anti-cliché restraint (no forced ending questions or therapist scripts).

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
      "system_prompt": "...",
      "backstory": "...",
      "soul_consciousness": "..."
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
      const backstory =
        typeof r.backstory === 'string' && r.backstory.trim()
          ? r.backstory.trim().slice(0, 1200)
          : '';
      const soulConsciousness =
        typeof r.soul_consciousness === 'string' && r.soul_consciousness.trim()
          ? r.soul_consciousness.trim().slice(0, 1200)
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
        ...(backstory ? { backstory } : {}),
        ...(soulConsciousness ? { soul_consciousness: soulConsciousness } : {}),
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

export interface CompanionPromptProfileContext {
  id?: string;
  name: string;
  short_name?: string | null;
  has_birth_chart?: boolean;
  birth_date?: string | null;
  birth_time?: string | null;
  birth_city?: string | null;
  birth_country?: string | null;
  gender?: string | null;
  current_city?: string | null;
  current_country?: string | null;
  chart_text_context?: string | null;
  chart_json?: CompiledChartData | null;
  life_context_json?: LifeContextData | null;
  deep_profile_json?: DeepProfileData | null;
  analyst_notes_json?: CouncilAnalystNote[] | null;
}

export interface ReferrableCompanionSummary {
  slug: string;
  name: string;
  primary_expertise: string;
}

function getLocalHourPeriodLabel(localHour: number | null | undefined): string {
  if (typeof localHour !== 'number' || !Number.isFinite(localHour)) return '';
  const h = ((Math.trunc(localHour) % 24) + 24) % 24;
  if (h >= 22 || h < 5) return 'late at night';
  if (h >= 5 && h < 9) return 'early morning';
  if (h >= 9 && h < 12) return 'late morning';
  if (h >= 12 && h < 17) return 'afternoon';
  return 'evening';
}

export function formatHumanTimeAndGapContext(
  lastInteractionAt?: string | null,
  clientLocalHour?: number | null
): string {
  const parts: string[] = [];
  const periodLabel = getLocalHourPeriodLabel(clientLocalHour);
  if (periodLabel) {
    parts.push(`Local feel right now: ${periodLabel}.`);
  }

  if (!lastInteractionAt) {
    parts.push('Interaction cadence: brand-new conversation.');
  } else {
    const lastMs = Date.parse(lastInteractionAt);
    if (Number.isFinite(lastMs)) {
      const diffHours = Math.max(0, (Date.now() - lastMs) / (1000 * 60 * 60));
      if (diffHours < 0.75) {
        parts.push('Interaction cadence: active back-and-forth right now.');
      } else if (diffHours < 10) {
        parts.push('Interaction cadence: spoke earlier today.');
      } else if (diffHours < 36) {
        parts.push('Interaction cadence: spoke yesterday (~1 day gap).');
      } else if (diffHours < 24 * 6) {
        const days = Math.max(2, Math.round(diffHours / 24));
        parts.push(`Interaction cadence: previous exchange was ~${days} days ago.`);
      } else if (diffHours < 24 * 25) {
        const weeks = Math.max(1, Math.round(diffHours / (24 * 7)));
        parts.push(`Interaction cadence: previous exchange was ~${weeks} week${weeks > 1 ? 's' : ''} ago.`);
      } else {
        parts.push('Interaction cadence: returning after a longer quiet interval.');
      }
    }
  }

  return `SESSION TIMING AWARENESS (Quiet background cue — NEVER recite numbers or say "according to my logs"; acknowledge elapsed time only if natural to your character):
${parts.join(' ')}`;
}

function formatLightweightLifeStageSummary(
  profile: CompanionPromptProfileContext,
  options?: {
    activeCompanionSlug?: string | null;
    astrologicalMemoryMode?: CompanionAstrologicalMemoryMode;
  }
): string {
  const mode: CompanionAstrologicalMemoryMode = options?.astrologicalMemoryMode || 'independent';
  const activeSlug = (options?.activeCompanionSlug || '').trim().toLowerCase();
  const isFactualOrOwnInsight = (
    slug?: string | null,
    isFactualLifeFact?: boolean,
    text?: string
  ): boolean => {
    const normalized = (slug || '').trim().toLowerCase();
    if (activeSlug && normalized === activeSlug) return true;
    return isFactualUserRealityOrigin(slug, isFactualLifeFact, text);
  };

  const lines: string[] = [];
  const firstName = profile.short_name?.trim() || profile.name?.trim();
  if (firstName) lines.push(`Name on profile: ${firstName}`);
  if (profile.birth_date) {
    const birthYear = Number(String(profile.birth_date).slice(0, 4));
    const currentYear = new Date().getFullYear();
    if (Number.isFinite(birthYear) && birthYear > 1920 && birthYear < currentYear - 10) {
      lines.push(`Approximate age: ~${currentYear - birthYear}`);
    }
  }
  if (profile.gender?.trim()) lines.push(`Gender: ${profile.gender.trim()}`);
  const location = [profile.current_city, profile.current_country].filter(Boolean).join(', ');
  if (location) lines.push(`Current city: ${location}`);

  const lc = profile.life_context_json;
  const externalNotesSeen = new Set<string>();
  const externalNoteLines: string[] = [];
  const excludedFromFactualDeep = new Set<string>();

  if (lc && typeof lc === 'object') {
    if (lc.career_mode) {
      lines.push(
        `Career context: ${String(lc.career_mode).replace(/_/g, ' ')}${
          lc.career_role ? ` (${lc.career_role})` : ''
        }`
      );
    } else if (lc.career_role) {
      lines.push(`Career role: ${lc.career_role}`);
    }
    if (lc.workplace_context) {
      lines.push(`Workplace & craft context: ${lc.workplace_context}`);
    }
    if (lc.relationship_status) {
      lines.push(
        `Relationship status: ${String(lc.relationship_status).replace(/_/g, ' ')}${
          lc.marriage_year ? ` (married ${lc.marriage_year})` : ''
        }`
      );
    }
    if (Array.isArray(lc.children) && lc.children.length > 0) {
      lines.push(
        `Children: ${lc.children.length} (${lc.children
          .map((c) => `${c.gender === 'male' ? 'son' : 'daughter'} b.${c.birth_year}`)
          .join(', ')})`
      );
    } else if (lc.children_summary) {
      lines.push(`Children context: ${lc.children_summary}`);
    } else if (typeof lc.has_children === 'boolean') {
      lines.push(`Has children: ${lc.has_children ? 'Yes' : 'No'}`);
    }
    if (Array.isArray(lc.past_anchors) && lc.past_anchors.length > 0) {
      lines.push(
        `Key milestones: ${lc.past_anchors
          .slice(0, 5)
          .map((a) => `${a.year} ${a.tag.replace(/_/g, ' ')}${a.note ? ` (${a.note})` : ''}`)
          .join('; ')}`
      );
    }
    if (Array.isArray(lc.core_stress_areas) && lc.core_stress_areas.length > 0) {
      lines.push(`Current life themes: ${lc.core_stress_areas.slice(0, 5).join('; ')}`);
    }

    const seenInsightSummaries = new Set<string>();
    if (Array.isArray(lc.cited_insights) && lc.cited_insights.length > 0) {
      const ownOrFactualLines: string[] = [];
      for (const n of lc.cited_insights.slice(0, 14)) {
        const cleanSummary = String(n.summary || '').trim();
        if (!cleanSummary) continue;
        const norm = cleanSummary.toLowerCase();
        if (isFactualOrOwnInsight(n.cited_slug, n.is_factual_life_fact, cleanSummary)) {
          seenInsightSummaries.add(norm);
          ownOrFactualLines.push(
            `- [${String(n.category || 'note').replace(/_/g, ' ')}] ${cleanSummary}`
          );
        } else {
          excludedFromFactualDeep.add(norm);
          if (mode === 'shared' && !externalNotesSeen.has(norm)) {
            externalNotesSeen.add(norm);
            const srcLabel = n.cited_by?.trim() || 'Prior Reading';
            externalNoteLines.push(
              `- [${srcLabel} · ${String(n.category || 'note').replace(/_/g, ' ')}] ${cleanSummary}`
            );
          }
        }
      }
      if (ownOrFactualLines.length > 0) {
        lines.push(
          `Deeper personal context (factual life background — weave quietly):\n${ownOrFactualLines.join('\n')}`
        );
      }
    }

    const allDeepEntries = Array.isArray(profile.deep_profile_json?.entries)
      ? profile.deep_profile_json!.entries!
      : [];
    for (const entry of allDeepEntries) {
      const cleanFact = String(entry.fact || '').trim();
      if (!cleanFact) continue;
      const norm = cleanFact.toLowerCase();
      if (!isFactualOrOwnInsight(entry.source_slug, entry.is_factual_life_fact, cleanFact)) {
        excludedFromFactualDeep.add(norm);
        if (mode === 'shared' && !externalNotesSeen.has(norm)) {
          externalNotesSeen.add(norm);
          const srcLabel = entry.source_label?.trim() || 'Prior Reading';
          externalNoteLines.push(
            `- [${srcLabel} · ${String(entry.category || 'note').replace(/_/g, ' ')}] ${cleanFact}`
          );
        }
      }
    }

    const combinedExcludes = new Set<string>([
      ...seenInsightSummaries,
      ...excludedFromFactualDeep,
    ]);
    const deepBlock = formatDeepProfileForLLM(profile.deep_profile_json, {
      maxItemsPerBucket: 4,
      maxEntries: 8,
      excludeSummaries: combinedExcludes,
    });
    if (deepBlock) {
      const safeDeepLines =
        mode === 'independent'
          ? deepBlock
              .split('\n')
              .filter((line) => !containsAstrologicalInterpretationClaim(line))
              .join('\n')
          : deepBlock;
      if (safeDeepLines.trim()) {
        lines.push(`Deep psychological & practical profile (weave gently without reciting):\n${safeDeepLines}`);
      }
    }
  } else if (profile.deep_profile_json) {
    const allDeepEntries = Array.isArray(profile.deep_profile_json.entries)
      ? profile.deep_profile_json.entries
      : [];
    for (const entry of allDeepEntries) {
      const cleanFact = String(entry.fact || '').trim();
      if (!cleanFact) continue;
      const norm = cleanFact.toLowerCase();
      if (!isFactualOrOwnInsight(entry.source_slug, entry.is_factual_life_fact, cleanFact)) {
        excludedFromFactualDeep.add(norm);
        if (mode === 'shared' && !externalNotesSeen.has(norm)) {
          externalNotesSeen.add(norm);
          const srcLabel = entry.source_label?.trim() || 'Prior Reading';
          externalNoteLines.push(
            `- [${srcLabel} · ${String(entry.category || 'note').replace(/_/g, ' ')}] ${cleanFact}`
          );
        }
      }
    }
    const deepBlock = formatDeepProfileForLLM(profile.deep_profile_json, {
      maxItemsPerBucket: 4,
      maxEntries: 8,
      excludeSummaries: excludedFromFactualDeep,
    });
    if (deepBlock) {
      const safeDeepLines =
        mode === 'independent'
          ? deepBlock
              .split('\n')
              .filter((line) => !containsAstrologicalInterpretationClaim(line))
              .join('\n')
          : deepBlock;
      if (safeDeepLines.trim()) {
        lines.push(`Deep psychological & practical profile (weave gently without reciting):\n${safeDeepLines}`);
      }
    }
  }

  if (mode === 'shared' && externalNoteLines.length > 0) {
    lines.push(
      `NOTES FROM ANOTHER ASTROLOGER / PRIOR READING (Non-authoritative external perspective — evaluate independently against the raw chart data and feel free to disagree):\n${externalNoteLines
        .slice(0, 8)
        .join('\n')}`
    );
  }

  return lines.join('\n');
}

export type CompanionEmotionalWeight =
  | 'calm'
  | 'reflective'
  | 'distressed'
  | 'celebratory'
  | 'playful';

export type CompanionConversationIntent =
  | 'casual_checkin'
  | 'venting'
  | 'seeking_perspective'
  | 'decision_making'
  | 'personal_growth'
  | 'esoteric_reading'
  | 'ai_identity_question';

export type CompanionEsotericRelevance = 'none' | 'subtle_open' | 'explicit_invite';

export interface CompanionTurnAnalysis {
  emotional_weight: CompanionEmotionalWeight;
  conversation_intent: CompanionConversationIntent;
  esoteric_relevance: CompanionEsotericRelevance;
  ai_identity_question: boolean;
  astrology_entry_rule: AstrologyEntryRule;
  should_load_chart: boolean;
  should_load_tarot: boolean;
  should_load_transits: boolean;
  should_load_notes: boolean;
  matched_nuance_ids: string[];
  matched_dialogue_ids: string[];
  matched_nuances: CompanionContextualNuance[];
  matched_dialogues: CompanionReferenceDialogue[];
  detected_topics: string[];
  has_living_context: boolean;
  has_profile_chart: boolean;
}

export interface CompanionAssemblySectionInfo {
  key: string;
  label: string;
  estimatedTokens: number;
  charCount: number;
  content: string;
}

export interface CompanionAssemblyManifest {
  layersLoaded: string[];
  orderedSections: CompanionAssemblySectionInfo[];
  nuancesTriggered: Array<{ id: string; title: string; priority: number }>;
  dialoguesTriggered: Array<{ id: string; scenario: string }>;
  capsuleApplied: boolean;
  capsuleTokens: number;
  chartInjected: boolean;
  transitsInjected: boolean;
  analystNotesInjected: boolean;
  tarotDrawn: boolean;
  esotericRelevance: CompanionEsotericRelevance;
  astrologyEntryRule: AstrologyEntryRule;
  astrologyGateDecision: {
    loaded: boolean;
    reason: string;
    hasAnyEsoteric: boolean;
    hasProfileChart: boolean;
    astrologyEntryRule: AstrologyEntryRule;
    esotericRelevance: CompanionEsotericRelevance;
  };
  emotionalWeight: CompanionEmotionalWeight;
  conversationIntent: CompanionConversationIntent;
  aiIdentityQuestion: boolean;
  estimatedTokensBySection: Record<string, number>;
  totalEstimatedTokens: number;
  assembledPromptPreview: string;
  fullAssembledPrompt?: string;
}

const TOPIC_KEYWORD_BUCKETS: Array<{ topic: string; pattern: RegExp }> = [
  { topic: 'work', pattern: /\b(work|job|boss|manager|office|meeting|meetings|coworker|colleague|career|layoff|promotion|deadline|burnout|overwork|shift)\b/ },
  { topic: 'relationship', pattern: /\b(partner|boyfriend|girlfriend|husband|wife|spouse|marriage|dating|breakup|ex|divorce|relationship|love|crush|argument|fight)\b/ },
  { topic: 'family', pattern: /\b(mom|mother|dad|father|parent|parents|sister|brother|sibling|family|kid|kids|child|children|baby|son|daughter)\b/ },
  { topic: 'stress', pattern: /\b(stress|stressed|anxious|anxiety|overwhelmed|exhausted|drained|tired|rough day|awful day|panic|spiral|cant sleep|can't sleep|insomnia)\b/ },
  { topic: 'grief', pattern: /\b(grief|grieving|loss|lost|died|funeral|miss them|heartbroken|mourning)\b/ },
  { topic: 'loneliness', pattern: /\b(lonely|loneliness|alone|isolated|nobody gets|invisible|left out)\b/ },
  { topic: 'money', pattern: /\b(money|debt|rent|bills|salary|broke|savings|afford|financial|paycheck)\b/ },
  { topic: 'decision', pattern: /\b(decide|decision|crossroads|choice|choose|should i|stay or leave|quit|move|uncertain|torn)\b/ },
  { topic: 'confidence', pattern: /\b(imposter|confidence|insecure|self-doubt|not good enough|failing|failure|embarrassed|shame)\b/ },
  { topic: 'humor', pattern: /\b(haha|hehe|lol|lmao|rofl|jk|kidding|meme|ridiculous|unhinged|banter)\b/ },
  { topic: 'spirituality', pattern: /\b(meaning|purpose|soul|faith|prayer|meditat|surrender|grace|peace|stillness|universe)\b/ },
  { topic: 'astrology', pattern: /\b(chart|astrology|horoscope|saturn|jupiter|venus|mars|mercury|rahu|ketu|dasha|mahadasha|antardasha|transit|gochar|nakshatra|lagna|ascendant|navamsa|retrograde|eclipse|tarot|numerology|past life|karmic)\b/ },
];

function inferDefaultAstrologyEntryRule(
  chartAccess?: CompanionChartAccess | null,
  advisoryMode?: CompanionAdvisoryMode | null
): AstrologyEntryRule {
  const hasAny = Boolean(
    chartAccess?.vedic ||
      chartAccess?.western ||
      chartAccess?.tarot ||
      chartAccess?.numerology ||
      chartAccess?.past_life
  );
  if (!hasAny) return 'never';
  if (advisoryMode === 'esoteric_guide') return 'invite_only';
  return 'contextual_invite';
}

function detectAiIdentityQuestion(userPrompt: string): boolean {
  const text = String(userPrompt || '').trim().toLowerCase();
  if (!text) return false;
  return (
    /\b(are you|r u|are u)\s+(an?\s+)?(ai|a\.i\.|bot|robot|chatbot|chatgpt|gpt|claude|gemini|llm|language model|machine|computer|program|real person|actual human|human being|real human|synthetic|fake)\b/.test(
      text
    ) ||
    /\b(am i talking to|is this)\s+(an?\s+)?(ai|a\.i\.|bot|robot|chatbot|human|real person|computer)\b/.test(
      text
    ) ||
    /\b(who\s+(built|made|created|programmed|trained)\s+you|what\s+(model|ai)\s+are\s+you|be honest.{0,20}are you (?:human|an ai)|are you real or ai)\b/.test(
      text
    )
  );
}

function detectsExplicitEsotericAsk(
  currentPrompt: string,
  recentMessages: Array<{ role: 'user' | 'assistant'; content: string }>,
  access: CompanionChartAccess
): { astro: boolean; tarot: boolean; numerology: boolean; pastLife: boolean } {
  const text = String(currentPrompt || '').toLowerCase();
  const prevWindow = recentMessages
    .slice(-2)
    .map((m) => m.content.toLowerCase())
    .join(' ');

  const directAstro =
    /\b(birth chart|natal chart|my chart|the chart|kundali|janma|astrolog\w*|horoscope|transit|transits|gochar|dasha|mahadasha|antardasha|pratyantardasha|nakshatra|lagna|ascendant|rising sign|moon sign|sun sign|navamsa|d9|d10|saturn|jupiter|rahu|ketu|sade sati|retrograde|eclipse|profection|solar return|tropical|sidereal|vedic|western|zodiac|aries|taurus|gemini|cancer|leo|virgo|libra|scorpio|sagittarius|capricorn|aquarius|pisces|\d+(?:st|nd|rd|th)\s+house)\b/.test(
      text
    ) ||
    /\b(venus|mars|mercury|pluto|neptune|uranus|chiron)\s+(in|transit|aspect|return|square|trine|conjunct|retrograde|placement|effect|affect|doing)\b/.test(
      text
    ) ||
    /\b(planets?|stars|cosmos)\s+(affect\w*|align\w*|saying|doing|right now)\b/.test(text);

  const ongoingAstroFollowUp =
    /\b(transit|dasha|mahadasha|antardasha|nakshatra|saturn|jupiter|lagna|navamsa|natal chart|birth chart|ascendant|tropical|sidereal|profection)\b/.test(
      prevWindow
    ) &&
    /\b(that|this)\s+(transit|dasha|period|placement|planet|house|chart)\b|\bwhat about (?:my |the )?(?:moon|sun|venus|mars|saturn|jupiter|next month|next year|10th|7th|career house)\b/.test(
      text
    );

  const directPastLife =
    Boolean(access.past_life) &&
    /\b(past life|past-life|reincarnat\w*|samskara|karmic pattern|karmic tie|soul contract|ketu|rahu|akashic|before this life)\b/.test(
      text
    );

  const directTarot =
    Boolean(access.tarot) &&
    /\b(tarot|pull (?:a |some |three |the )?cards?|draw (?:a |some |three |the )?cards?|tarot spread|three-card|oracle card|shuffle the deck)\b/.test(
      text
    );

  const directNumerology =
    Boolean(access.numerology) &&
    /\b(numerology|life path number|destiny number|expression number|soul urge|personal year|personal month|angel number|birth number)\b/.test(
      text
    );

  return {
    astro: directAstro || ongoingAstroFollowUp,
    tarot: directTarot,
    numerology: directNumerology,
    pastLife: directPastLife,
  };
}

function tokenizeForMatching(raw: string): string[] {
  return String(raw || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3);
}

export function analyzeCompanionTurnContext(params: {
  userPrompt: string;
  historyMessages?: Array<{ role: 'user' | 'assistant'; content: string }>;
  companionChatMode?: CompanionChatCue | null;
  hasLivingContext?: boolean;
  hasProfileChart?: boolean;
  chartAccess?: CompanionChartAccess | null;
  personalityV2?: CompanionPersonalityV2 | null;
  advisoryMode?: CompanionAdvisoryMode | null;
}): CompanionTurnAnalysis {
  const userPrompt = String(params.userPrompt || '');
  const currentLower = userPrompt.trim().toLowerCase();
  const recentMessages = (params.historyMessages || []).slice(-5);
  const access: CompanionChartAccess = params.chartAccess || {
    vedic: false,
    western: false,
    tarot: false,
    numerology: false,
    past_life: false,
    council_notes: false,
  };

  const hasAnyEsoteric = Boolean(
    access.vedic || access.western || access.tarot || access.numerology || access.past_life
  );
  const astrologyEntryRule: AstrologyEntryRule = hasAnyEsoteric
    ? params.personalityV2?.astrology_entry_rule ||
      inferDefaultAstrologyEntryRule(access, params.advisoryMode)
    : 'never';

  const aiIdentityQuestion = detectAiIdentityQuestion(userPrompt);

  // 1. Emotional weight detection
  let emotionalWeight: CompanionEmotionalWeight = 'calm';
  const distressedRe =
    /\b(crying|cried|sob|heartbroken|devastated|grief|grieving|panic|panicking|anxious|anxiety|overwhelmed|exhausted|burned out|burnt out|can't sleep|cant sleep|helpless|hopeless|lonely|scared|terrified|breaking down|hurting|miserable|depressed|rough day|hard day|awful day|terrible day|stressed|drained|crushed|shattered|lost someone|died|funeral|burned out)\b/;
  const celebratoryRe =
    /\b(got the job|engaged|pregnant|promoted|celebrat\w*|amazing news|good news|so happy|thrilled|excited|yay|we did it|finally happened|proud of|landed it|accepted|won|anniversary|promotion)\b/;
  const playfulRe =
    /\b(haha|hehe|lol|lmao|rofl|jk|kidding|tease|banter|spicy take|hot take|roast|tea|gossip|chaos|unhinged|dramatic)\b|[😂🤣😄😜😉]/;
  const reflectiveRe =
    /\b(wondering|thinking about|meaning|purpose|pattern|realize|realized|confused|torn|crossroads|chapter|why do i|look back|regret|grateful|soul|silence|uncertain|figuring out)\b/;

  if (distressedRe.test(currentLower)) {
    emotionalWeight = 'distressed';
  } else if (celebratoryRe.test(currentLower)) {
    emotionalWeight = 'celebratory';
  } else if (playfulRe.test(currentLower)) {
    emotionalWeight = 'playful';
  } else if (reflectiveRe.test(currentLower)) {
    emotionalWeight = 'reflective';
  }

  // 2. Esoteric relevance detection (strictly gated)
  const explicitHits = detectsExplicitEsotericAsk(currentLower, recentMessages, access);
  const hasExplicitEsotericInvite =
    explicitHits.astro ||
    explicitHits.tarot ||
    explicitHits.numerology ||
    explicitHits.pastLife;

  const subtleCrossroadsRe =
    /\b(meant to be|purpose of|this season of my life|destiny|what the universe|sign from|spiritual meaning|higher power|bigger picture|soul lesson|karmic|major crossroads)\b/;

  let esotericRelevance: CompanionEsotericRelevance = 'none';
  if (hasExplicitEsotericInvite) {
    esotericRelevance = 'explicit_invite';
  } else if (
    hasAnyEsoteric &&
    astrologyEntryRule !== 'never' &&
    emotionalWeight !== 'distressed' &&
    subtleCrossroadsRe.test(currentLower)
  ) {
    esotericRelevance = 'subtle_open';
  }

  // Telemetry flags only — chart and transit delivery in Companion runtime is NEVER gated by message keywords.
  const shouldLoadChart = Boolean(params.hasProfileChart || hasAnyEsoteric);
  const shouldLoadTarot = explicitHits.tarot && Boolean(access.tarot);
  const shouldLoadTransits = Boolean(params.hasProfileChart || hasAnyEsoteric);
  const shouldLoadNotes =
    esotericRelevance !== 'none' &&
    Boolean(access.council_notes || hasAnyEsoteric);

  // 3. Conversation intent detection
  let conversationIntent: CompanionConversationIntent = 'casual_checkin';
  if (aiIdentityQuestion) {
    conversationIntent = 'ai_identity_question';
  } else if (esotericRelevance === 'explicit_invite') {
    conversationIntent = 'esoteric_reading';
  } else if (
    params.companionChatMode === 'just_listen' ||
    emotionalWeight === 'distressed' ||
    /\b(vent|rant|so mad|furious|ugh|tired of|exhausted|annoyed|frustrated|rough day|hard day|need to get this off)\b/.test(
      currentLower
    )
  ) {
    conversationIntent = 'venting';
  } else if (
    /\b(should i|decide|decision|choice|choose|quit|stay or leave|accept the offer|move to|marry|break up|tradeoff|trade-off|pros and cons)\b/.test(
      currentLower
    )
  ) {
    conversationIntent = 'decision_making';
  } else if (
    params.companionChatMode === 'help_think' ||
    /\b(what do you think|perspective|make sense of|how do i handle|advice|help me think|your take|honest opinion|am i overreacting)\b/.test(
      currentLower
    )
  ) {
    conversationIntent = 'seeking_perspective';
  } else if (
    /\b(habit|routine|boundary|boundaries|confidence|discipline|meaning|purpose|grow|healing|pattern|forgive|journal)\b/.test(
      currentLower
    )
  ) {
    conversationIntent = 'personal_growth';
  }

  // 4. Detected topics & matching V2 nuances / dialogues
  const recentUserSlice = recentMessages
    .filter((m) => m.role === 'user')
    .slice(-3)
    .map((m) => m.content.toLowerCase())
    .join(' ');
  const topicText = `${currentLower} ${recentUserSlice}`.trim();

  const detectedTopics: string[] = [];
  for (const bucket of TOPIC_KEYWORD_BUCKETS) {
    if (bucket.pattern.test(topicText)) {
      detectedTopics.push(bucket.topic);
    }
  }
  const promptTokens = new Set([
    ...tokenizeForMatching(topicText),
    ...detectedTopics,
    emotionalWeight,
    conversationIntent.replace(/_/g, ' '),
  ]);

  const moodSynonyms: Record<CompanionEmotionalWeight, string[]> = {
    distressed: ['distressed', 'sad', 'heavy', 'overwhelmed', 'anxious', 'stressed', 'grief', 'lonely', 'hurt'],
    reflective: ['reflective', 'thoughtful', 'quiet', 'uncertain', 'contemplative', 'confused'],
    celebratory: ['celebratory', 'happy', 'excited', 'joy', 'proud', 'win'],
    playful: ['playful', 'humor', 'light', 'funny', 'banter', 'casual'],
    calm: ['calm', 'casual', 'steady', 'everyday', 'neutral'],
  };
  const activeMoodTerms = new Set(moodSynonyms[emotionalWeight]);

  const allNuances = params.personalityV2?.contextual_nuances || [];
  const scoredNuances = allNuances
    .map((nuance) => {
      let score = 0;
      for (const mood of nuance.trigger_moods || []) {
        const m = mood.toLowerCase().trim();
        if (activeMoodTerms.has(m) || currentLower.includes(m)) score += 6;
      }
      for (const topic of nuance.trigger_topics || []) {
        const tLower = topic.toLowerCase().trim();
        if (!tLower) continue;
        if (detectedTopics.includes(tLower) || topicText.includes(tLower)) {
          score += 6;
          continue;
        }
        const topicTokens = tokenizeForMatching(tLower);
        if (topicTokens.some((tok) => promptTokens.has(tok))) {
          score += 4;
        }
      }
      const guidanceTokens = tokenizeForMatching(nuance.label);
      for (const tok of guidanceTokens) {
        if (promptTokens.has(tok)) score += 1.5;
      }
      return {
        nuance,
        score,
        priority: nuance.priority || 5,
      };
    })
    .filter((item) => item.score > 0 || item.priority >= 8)
    .sort((a, b) => b.score + b.priority * 0.4 - (a.score + a.priority * 0.4))
    .slice(0, 3);

  const matchedNuances = scoredNuances.map((s) => s.nuance);

  const allDialogues = params.personalityV2?.reference_dialogues || [];
  const scoredDialogues = allDialogues
    .map((dlg) => {
      let score = 0;
      for (const tag of dlg.tags || []) {
        const tg = tag.toLowerCase().trim();
        if (!tg) continue;
        if (activeMoodTerms.has(tg) || detectedTopics.includes(tg) || promptTokens.has(tg)) {
          score += 5;
        }
      }
      for (const tok of tokenizeForMatching(
        `${dlg.scenario || ''} ${dlg.context_note || ''} ${dlg.user_prompt || ''}`
      )) {
        if (promptTokens.has(tok)) score += 2.5;
      }
      return { dlg, score };
    })
    .sort((a, b) => b.score - a.score);

  const matchedDialogues =
    scoredDialogues.length > 0
      ? scoredDialogues[0].score > 0
        ? scoredDialogues.filter((d) => d.score > 0).slice(0, 2).map((d) => d.dlg)
        : [scoredDialogues[0].dlg]
      : [];

  return {
    emotional_weight: emotionalWeight,
    conversation_intent: conversationIntent,
    esoteric_relevance: esotericRelevance,
    ai_identity_question: aiIdentityQuestion,
    astrology_entry_rule: astrologyEntryRule,
    should_load_chart: shouldLoadChart,
    should_load_tarot: shouldLoadTarot,
    should_load_transits: shouldLoadTransits,
    should_load_notes: shouldLoadNotes,
    matched_nuance_ids: matchedNuances.map((n) => n.id),
    matched_dialogue_ids: matchedDialogues.map((d) => d.id),
    matched_nuances: matchedNuances,
    matched_dialogues: matchedDialogues,
    detected_topics: detectedTopics,
    has_living_context: Boolean(params.hasLivingContext),
    has_profile_chart: Boolean(params.hasProfileChart),
  };
}

function buildCompanionSkillAndProfileBlock(params: {
  preset?: CompanionPresetRecord | null;
  capabilities: ResolvedCompanionCapabilities;
  turnAnalysis: CompanionTurnAnalysis;
  v2?: CompanionPersonalityV2 | null;
  userPrompt: string;
  historyMessages?: Array<{ role: 'user' | 'assistant'; content: string }>;
  userDefaultProfile?: CompanionPromptProfileContext | null;
  chartPresenceOverride?: string | null;
  dailyTransits?: {
    transitsText?: string | null;
    westernTransitsText?: string | null;
    westernPlanets?: WesternPlanetPosition[] | null;
  } | null;
  formulaCartridges?: Record<string, ResolvedInternalRuleRecord> | null;
  engineOverrides?: EnginePromptOverrides | null;
}): {
  block: string;
  tarotSpread?: DrawnTarotSpread | null;
  invitedEsoteric: boolean;
  chartInjected: boolean;
  transitsInjected: boolean;
  tarotDrawn: boolean;
} {
  const {
    preset,
    capabilities,
    userDefaultProfile,
    userPrompt,
    engineOverrides,
    turnAnalysis,
    v2,
  } = params;
  const access = capabilities.chart_access;
  const hasAnyEsoteric = Boolean(
    access.vedic || access.western || access.tarot || access.numerology || access.past_life
  );
  const hasCompiledChartJson = Boolean(
    userDefaultProfile?.chart_json &&
      Array.isArray(userDefaultProfile.chart_json.planets) &&
      userDefaultProfile.chart_json.planets.length > 0
  );
  const hasBirthChart = Boolean(
    userDefaultProfile &&
      (userDefaultProfile.has_birth_chart !== undefined
        ? userDefaultProfile.has_birth_chart
        : Boolean(
            hasCompiledChartJson ||
              userDefaultProfile.chart_text_context ||
              userDefaultProfile.birth_date
          ))
  );

  const skillRules = {
    none_emotional:
      engineOverrides?.companion_skill_rules?.none_emotional?.trim() ||
      DEFAULT_COMPANION_SKILL_RULES.none_emotional,
    vedic:
      engineOverrides?.companion_skill_rules?.vedic?.trim() ||
      DEFAULT_COMPANION_SKILL_RULES.vedic,
    western:
      engineOverrides?.companion_skill_rules?.western?.trim() ||
      DEFAULT_COMPANION_SKILL_RULES.western,
    tarot:
      engineOverrides?.companion_skill_rules?.tarot?.trim() ||
      DEFAULT_COMPANION_SKILL_RULES.tarot,
    numerology:
      engineOverrides?.companion_skill_rules?.numerology?.trim() ||
      DEFAULT_COMPANION_SKILL_RULES.numerology,
    past_life:
      engineOverrides?.companion_skill_rules?.past_life?.trim() ||
      DEFAULT_COMPANION_SKILL_RULES.past_life,
  };

  let drawnTarot: DrawnTarotSpread | null = null;
  let chartInjected = false;
  let transitsInjected = false;

  // ── 1. AVAILABLE REFERENCE CHART DATA (Continuous Dual-Tradition Delivery) ─
  const chartDataSections: string[] = [
    '### 1. AVAILABLE REFERENCE CHART DATA (Always Present for Reference — Vedic Sidereal & Western Tropical Cleanly Separated)',
  ];

  const vedicHeader =
    '=== VEDIC SIDEREAL CHART DATA (Lahiri Ayanamsha — D1, Vargas D9/D10/D7/etc., Nakshatras, Shadbala/SAV, KP Cusps/Sub-Lords, Jaimini Karakas, Vimshottari Dashas, Sidereal Transits) ===';
  const westernHeader =
    '=== WESTERN TROPICAL CHART DATA (Tropical Zodiac — Placidus/Whole Sign houses, Sect, Dignities, Tight Aspects, Configurations, Profections, Progressions, Tropical Transits) ===';

  if (hasBirthChart && userDefaultProfile) {
    const bta = userDefaultProfile.life_context_json?.birth_time_accuracy;
    const missingBirthTime = !userDefaultProfile.birth_time?.trim();
    const isApproximateBirthTime =
      missingBirthTime || bta === 'sunrise_unknown' || bta === 'approximate';
    const birthPlaceLabel = [
      userDefaultProfile.birth_city,
      userDefaultProfile.birth_country,
    ]
      .filter(Boolean)
      .join(', ');

    chartDataSections.push(
      `VERIFIED BIRTH PROFILE ON FILE (${userDefaultProfile.name}): DOB ${userDefaultProfile.birth_date || 'unspecified'} · TOB ${userDefaultProfile.birth_time || 'unknown'} · Birthplace ${birthPlaceLabel || 'unspecified'}. NEVER ask the user to re-enter birth details already provided here unless they ask about a different person.`
    );

    if (isApproximateBirthTime) {
      const precisionLabel = missingBirthTime
        ? 'missing birth time'
        : bta === 'sunrise_unknown'
        ? 'unknown / sunrise estimate (sunrise_unknown)'
        : 'approximate (±1 hour)';
      chartDataSections.push(
        `BIRTH TIME PRECISION NOTICE: Birth time is ${precisionLabel}. Anchor interpretation in Moon sign (Chandra Lagna), planetary sign placements, major aspects, Dashas, and outer transits — NEVER fabricate exact Ascendant/Lagna degrees, minute-sensitive KP Sub-Lords, borderline divisional shifts, or exact Placidus house cusps.`
      );
    }

    // Sub-block 1A: Vedic Sidereal
    const vedicSubParts: string[] = [vedicHeader];
    if (hasCompiledChartJson && userDefaultProfile.chart_json) {
      const fullVedicContext = formatChartForLLM(userDefaultProfile.chart_json, 'vedic');
      if (fullVedicContext) {
        chartInjected = true;
        vedicSubParts.push(fullVedicContext);
      }
    } else if (userDefaultProfile.chart_text_context?.trim()) {
      chartInjected = true;
      vedicSubParts.push(
        `${userDefaultProfile.chart_text_context.trim()}\n\nPARTIAL TELEMETRY NOTICE: Full compiled chart_json (16 Vargas, Shadbala, SAV, KP Sub-Lords, complete Vimshottari stack) is not attached for this profile. Work strictly from the verified summary above and NEVER invent missing degrees or divisional placements.`
      );
    } else {
      const missingFields = [
        !userDefaultProfile.birth_date?.trim() ? 'birth date' : '',
        missingBirthTime ? 'birth time' : '',
        !userDefaultProfile.birth_city?.trim() ? 'birth city' : '',
      ].filter(Boolean);
      vedicSubParts.push(
        `INCOMPLETE VEDIC BIRTH CHART DATA: Compiled Sidereal ephemeris is unavailable (${
          missingFields.length > 0
            ? `missing ${missingFields.join(', ')}`
            : 'chart compilation pending or ephemeris unconfigured'
        }). NEVER fabricate Sidereal signs, Lagna, Nakshatras, degrees, or Dashas.`
      );
    }

    if (params.dailyTransits?.transitsText) {
      transitsInjected = true;
      vedicSubParts.push(
        `CURRENT SIDEREAL TRANSITS (VEDIC GOCHAR):\n${params.dailyTransits.transitsText}`
      );
    }
    chartDataSections.push(vedicSubParts.join('\n\n'));

    // Sub-block 1B: Western Tropical
    const westernSubParts: string[] = [westernHeader];
    const locationLabel = [
      userDefaultProfile.current_city,
      userDefaultProfile.current_country,
    ]
      .filter(Boolean)
      .join(', ');

    if (hasCompiledChartJson && userDefaultProfile.chart_json) {
      const fullWesternFromJson = formatChartForLLM(
        userDefaultProfile.chart_json,
        'western'
      );
      const hasFullWesternJson = fullWesternFromJson.startsWith(
        'VERIFIED WESTERN TROPICAL CHART JSON:'
      );
      const westernPayload = hasFullWesternJson
        ? fullWesternFromJson
        : formatTropicalWesternContext({
            chartJson: userDefaultProfile.chart_json,
            birthDate: userDefaultProfile.birth_date || '1990-01-01',
            profileName: userDefaultProfile.name,
            currentLocationLabel: locationLabel || null,
          });
      const westernTiming = formatWesternTimingForLLM(
        userDefaultProfile.chart_json,
        params.dailyTransits?.westernPlanets || null
      );

      if (westernPayload) {
        chartInjected = true;
        westernSubParts.push(westernPayload);
      }
      if (westernTiming) {
        westernSubParts.push(westernTiming);
      }
      if (locationLabel && hasFullWesternJson) {
        westernSubParts.push(`CURRENT RESIDENCE / LOCATION: ${locationLabel}`);
      }
    } else {
      const missingFields = [
        !userDefaultProfile.birth_date?.trim() ? 'birth date' : '',
        missingBirthTime ? 'birth time' : '',
        !userDefaultProfile.birth_city?.trim() ? 'birth city' : '',
      ].filter(Boolean);
      westernSubParts.push(
        `INCOMPLETE WESTERN TROPICAL CHART DATA: Compiled Tropical placements, Placidus/Whole Sign houses, Sect, Tight Aspects, Profections, and Progressions are unavailable (${
          missingFields.length > 0
            ? `missing ${missingFields.join(', ')}`
            : 'chart compilation pending or ephemeris unconfigured'
        }). NEVER hallucinate Tropical Sun/Moon/Rising degrees, house cusps, or aspects.`
      );
    }

    if (params.dailyTransits?.westernTransitsText) {
      transitsInjected = true;
      westernSubParts.push(
        `CURRENT TROPICAL WESTERN TRANSITS:\n${params.dailyTransits.westernTransitsText}`
      );
    }
    chartDataSections.push(westernSubParts.join('\n\n'));
  } else {
    chartDataSections.push(
      'NO PERSONAL BIRTH CHART ATTACHED: No user birth profile is compiled yet. NEVER fabricate or guess personal Sun, Moon, Rising, house, or Dasha placements. If they explicitly ask for a personal natal reading, invite their birth date, birth time, and birth city.'
    );
    if (params.dailyTransits?.transitsText) {
      transitsInjected = true;
      chartDataSections.push(
        `${vedicHeader}\n\nPersonal Natal Vedic Chart: NOT ATTACHED.\n\nCURRENT SIDEREAL TRANSITS (VEDIC GOCHAR):\n${params.dailyTransits.transitsText}`
      );
    }
    if (params.dailyTransits?.westernTransitsText) {
      transitsInjected = true;
      chartDataSections.push(
        `${westernHeader}\n\nPersonal Natal Western Chart: NOT ATTACHED.\n\nCURRENT TROPICAL WESTERN TRANSITS:\n${params.dailyTransits.westernTransitsText}`
      );
    }
  }

  // ── 2. PRACTITIONER PROFESSIONAL EXPERTISE & TECHNIQUE ────────────────────
  const expertiseSections: string[] = [
    '### 2. PRACTITIONER PROFESSIONAL EXPERTISE & TECHNIQUE',
  ];
  const expertiseLines = [
    preset?.primary_expertise ? `Primary Expertise: ${preset.primary_expertise}` : '',
    preset?.secondary_expertise?.length
      ? `Secondary Expertise: ${preset.secondary_expertise.join(', ')}`
      : '',
    preset?.specialization_slugs?.length
      ? `Specialization Tags: ${preset.specialization_slugs.join(', ')}`
      : '',
    v2?.specialist_expertise ? `Specialist Training & Focus: ${v2.specialist_expertise}` : '',
  ].filter(Boolean);
  if (expertiseLines.length > 0) {
    expertiseSections.push(expertiseLines.join('\n'));
  }

  if (!hasAnyEsoteric) {
    expertiseSections.push(skillRules.none_emotional);
  } else {
    if (access.vedic) expertiseSections.push(skillRules.vedic);
    if (access.western) expertiseSections.push(skillRules.western);
    if (access.past_life) expertiseSections.push(skillRules.past_life);
    if (access.tarot) expertiseSections.push(skillRules.tarot);
    if (access.numerology) expertiseSections.push(skillRules.numerology);
  }

  // ── 3. ANALYTICAL METHODOLOGY & INVESTIGATION APPROACH ────────────────────
  const methodologySections: string[] = [
    '### 3. ANALYTICAL METHODOLOGY & INVESTIGATION APPROACH',
  ];
  if (hasAnyEsoteric || hasBirthChart) {
    const presencePrompt =
      engineOverrides?.companion_chart_presence_prompt?.trim() ||
      params.chartPresenceOverride?.trim() ||
      DEFAULT_COMPANION_CHART_PRESENCE_PROMPT;
    methodologySections.push(presencePrompt);
  }

  const methodLines = [
    v2?.signature_methodology ? `Signature Methodology: ${v2.signature_methodology}` : '',
    v2?.investigation_strategy ? `Investigation Strategy: ${v2.investigation_strategy}` : '',
    v2?.refinement_philosophy ? `Refinement Philosophy: ${v2.refinement_philosophy}` : '',
  ].filter(Boolean);
  if (methodLines.length > 0) {
    methodologySections.push(methodLines.join('\n'));
  }

  if (capabilities.formula_cartridge_slugs.length > 0 && params.formulaCartridges) {
    const matchedCartridges = capabilities.formula_cartridge_slugs
      .map((slug) => params.formulaCartridges![slug])
      .filter((rec): rec is ResolvedInternalRuleRecord =>
        Boolean(rec && rec.is_active && rec.prompt_body?.trim())
      );
    if (matchedCartridges.length > 0) {
      methodologySections.push(
        `OPTIONAL SPECIALIST FORMULA CARTRIDGES:\n${matchedCartridges
          .map((c) => `#### ${c.display_name || c.slug}\n${c.prompt_body.trim()}`)
          .join('\n\n')}`
      );
    } else {
      methodologySections.push(
        'Methodology Execution: Standalone practitioner reasoning directly from your signature methodology, investigation strategy, and the verified reference telemetry above (no external formula cartridges required).'
      );
    }
  } else {
    methodologySections.push(
      'Methodology Execution: Standalone practitioner reasoning directly from your expertise, signature methodology, investigation strategy, and the verified reference telemetry above (no external Council formula cartridges attached).'
    );
  }

  // ── 4. CONVERSATIONAL JUDGMENT & ACTIVE ASTROLOGICAL INTENT ───────────────
  const judgmentSections: string[] = [
    '### 4. CONVERSATIONAL JUDGMENT & ACTIVE ASTROLOGICAL INTENT',
  ];

  const invitedEsoteric =
    turnAnalysis.esoteric_relevance === 'explicit_invite' ||
    (turnAnalysis.esoteric_relevance === 'subtle_open' &&
      turnAnalysis.astrology_entry_rule === 'contextual_invite');

  judgmentSections.push(
    `TURN TELEMETRY (Soft Context — NEVER blocks reference data access): intent=${turnAnalysis.conversation_intent} · emotional_weight=${turnAnalysis.emotional_weight} · esoteric_relevance=${turnAnalysis.esoteric_relevance} · astrology_entry_rule=${turnAnalysis.astrology_entry_rule}`
  );

  if (!hasAnyEsoteric) {
    judgmentSections.push(
      'CONVERSATIONAL POSTURE: Stay grounded in your primary human/non-astrological role. Answer greetings, humor, and personal life naturally without lecturing from the reference chart above unless the user explicitly asks about their chart or placements.'
    );
  } else if (turnAnalysis.esoteric_relevance === 'explicit_invite') {
    judgmentSections.push(
      'CONVERSATIONAL POSTURE: The user is explicitly engaging chart/esoteric perspective or asking a cross-tradition question. Draw directly from the verified Vedic Sidereal and/or Western Tropical reference sections above — keep Sidereal Lahiri and Tropical Western clearly distinct whenever comparing or switching traditions, and never conflate the two zodiacs.'
    );
  } else if (turnAnalysis.esoteric_relevance === 'subtle_open') {
    judgmentSections.push(
      'CONVERSATIONAL POSTURE: The user is navigating an open or reflective moment. Respond in your authored practitioner voice and methodology; draw from Section 1 where genuinely illuminating and natural to your character.'
    );
  } else {
    judgmentSections.push(
      'CONVERSATIONAL POSTURE: Non-chart greeting, follow-up, humor, or open remark. Reply authentically in character without forcing chart commentary unnecessarily — while retaining full freedom to offer astrological perspective whenever your authored persona or astrology entry rule calls for it.'
    );
  }

  // Backward-compatible Numerology & Tarot deterministic injections
  if (access.numerology) {
    if (hasBirthChart && userDefaultProfile) {
      let targetName = userDefaultProfile.name || '';
      let targetDob = userDefaultProfile.birth_date || '';
      if ((!targetName || !targetDob) && userPrompt) {
        const extracted = extractNumerologyHintsFromPrompt(userPrompt);
        if (!targetName && extracted.name) targetName = extracted.name;
        if (!targetDob && extracted.birthDate) targetDob = extracted.birthDate;
      }
      const numBlock = formatPythagoreanNumerologyContext({
        fullName: targetName,
        birthDate: targetDob,
      });
      if (numBlock) {
        chartInjected = true;
        judgmentSections.push(`ATTACHED FULL NUMEROLOGY PROFILE:\n${numBlock}`);
      }
    } else if (turnAnalysis.esoteric_relevance === 'explicit_invite') {
      const extracted = extractNumerologyHintsFromPrompt(
        [
          ...(params.historyMessages || [])
            .filter((m) => m.role === 'user')
            .slice(-3)
            .map((m) => m.content),
          userPrompt,
        ].join('\n')
      );
      if (extracted.name && extracted.birthDate) {
        const numBlock = formatPythagoreanNumerologyContext({
          fullName: extracted.name,
          birthDate: extracted.birthDate,
        });
        if (numBlock) {
          chartInjected = true;
          judgmentSections.push(numBlock);
        }
      }
    }
  }

  if (access.tarot) {
    if (turnAnalysis.should_load_tarot) {
      const drawn = drawTarotSpread(userPrompt);
      drawnTarot = drawn;
      judgmentSections.push(formatTarotSpreadContext(drawn));
    } else {
      judgmentSections.push(
        'TAROT CONTEXT: Stay in natural conversation right now; pull Tarot cards only if the user explicitly asks for a card draw or spread.'
      );
    }
  }

  const allBlocks = [
    ...chartDataSections,
    ...expertiseSections,
    ...methodologySections,
    ...judgmentSections,
  ].filter(Boolean);

  return {
    block: allBlocks.join('\n\n'),
    tarotSpread: drawnTarot,
    invitedEsoteric,
    chartInjected,
    transitsInjected,
    tarotDrawn: Boolean(drawnTarot),
  };
}

export function buildChatStyleInstruction(
  chatStyle: ChatStyle,
  options?: { isCouncil?: boolean }
): string {
  const isCouncil = Boolean(options?.isCouncil);
  switch (chatStyle) {
    case 'chat_bubbles':
      return isCouncil
        ? `CHAT BUBBLES FORMAT (COUNCIL):
- Keep your astrological/esoteric analysis 100% rigorous and grounded in the chart facts above, but deliver your answer in 2–3 natural, approachable conversational bubbles separated by the exact marker [[BUBBLE]] (never exceed 3 bubbles in one turn).
- Put any [[TIMING_BAR:...]] token on its own standalone line inside the bubble where that period is discussed.
- If emitting <<<TECH_BREAKDOWN>>> or <<<SUGGESTIONS_JSON>>>, place them cleanly at the very end after the final bubble.`
        : `MULTI-BUBBLE PRESENTATION FORMAT:
- Present your response as 1–3 concise, distinct message bubbles (never exceed 3 bubbles in one turn). When splitting across 2–3 sequential points or thoughts improves clarity, separate each bubble cleanly with the exact marker [[BUBBLE]].
- Keep bubble length proportional to the turn (1 focused bubble for a brief greeting or direct answer, or 2–3 compact bubbles for multi-part observations), avoiding essay headings or padded lists unless requested.
- Format cleanly within this visual structure while preserving your exact authored tone, vocabulary, formality, and intellectual register.`;
    case 'dialogue':
      return isCouncil
        ? `REFLECTIVE LETTERS STYLE:
- Write with calm, unhurried emotional intimacy in clean, spacious prose paragraphs (no [[BUBBLE]] markers, no stiff report headings). Keep the tone reflective, personal, and deeply human.`
        : `DIALOGUE & PROSE FLOW FORMAT:
- Write in clean, cohesive prose paragraphs with unhurried narrative flow and clear transitions (no [[BUBBLE]] markers, no stiff multi-card report headings).
- Format cleanly within this visual structure while preserving your exact authored tone, vocabulary, formality, and intellectual register.`;
    case 'concise_brief':
      return isCouncil
        ? `QUICK BRIEF STYLE (COUNCIL):
- Lead immediately with a clear 1–2 sentence core conclusion upfront, followed by at most 2–3 crisp, high-signal supporting insights and timing windows (no [[BUBBLE]] markers).`
        : `CONCISE BRIEF FORMAT:
- Lead immediately with a clear 1–2 sentence core conclusion or direct response, followed by at most 2–3 crisp, high-signal supporting observations (no [[BUBBLE]] markers). Keep density scannable and free of filler.
- Format cleanly within this visual structure while preserving your exact authored tone, vocabulary, formality, and intellectual register.`;
    case 'structured':
      return isCouncil
        ? `STRUCTURED DOSSIER STYLE (COUNCIL):
- Organize your reading cleanly using concise section headings, clear visual hierarchy, and scannable comparisons where helpful (no [[BUBBLE]] markers).`
        : `STRUCTURED DOSSIER FORMAT:
- Organize your response cleanly using concise markdown subheadings, clear visual hierarchy, and scannable lists or comparisons where helpful (no [[BUBBLE]] markers).
- Format cleanly within this visual structure while preserving your exact authored tone, vocabulary, formality, and intellectual register.`;
    case 'editorial':
    default:
      return isCouncil
        ? `EDITORIAL PROSE STYLE (COUNCIL):
- Write in calm, flowing, long-form markdown paragraphs with generous typographic breathing room and grounded clarity (no [[BUBBLE]] markers).`
        : `EDITORIAL PROSE FORMAT:
- Write in cohesive, well-paced long-form markdown paragraphs with generous typographic breathing room and clean transitions (no [[BUBBLE]] markers).
- Format cleanly within this visual structure while preserving your exact authored tone, vocabulary, formality, and intellectual register.`;
  }
}

export function resolveCompanionTemperature(
  preset?: { temperature?: number | null } | null
): number {
  const sanitized = sanitizeCompanionTemperature(preset?.temperature);
  return sanitized ?? 0.45;
}

export function resolveCompanionVerificationMode(
  preset?: Partial<CompanionPresetRecord> | null,
  v2?: CompanionPersonalityV2 | null
): CompanionVerificationMode {
  const resolvedV2 = v2 || (preset ? ensureCompanionV2Initialized(preset) : null);
  const mode = resolvedV2?.verification_mode;
  if (
    mode === 'neutral' ||
    mode === 'council_vedic' ||
    mode === 'council_western' ||
    mode === 'none'
  ) {
    return mode;
  }
  return 'neutral';
}

export function applyCompanionTurnVerification(params: {
  userText: string;
  verificationMode: CompanionVerificationMode;
  capabilities?: ResolvedCompanionCapabilities | null;
  invitedEsoteric: boolean;
  hasChartData: boolean;
  engineOverrides?: EnginePromptOverrides | null;
}): {
  userText: string;
  appliedMode: CompanionVerificationMode | 'skipped';
} {
  const {
    userText,
    verificationMode,
    capabilities,
    invitedEsoteric,
    hasChartData,
    engineOverrides,
  } = params;

  if (verificationMode === 'none') {
    return { userText, appliedMode: 'skipped' };
  }

  const isAstroPractitioner = Boolean(
    capabilities?.advisory_mode === 'esoteric_guide' ||
      capabilities?.chart_access.vedic ||
      capabilities?.chart_access.western ||
      capabilities?.chart_access.past_life ||
      verificationMode === 'council_vedic' ||
      verificationMode === 'council_western'
  );

  if (!isAstroPractitioner || !invitedEsoteric || !hasChartData) {
    return { userText, appliedMode: 'skipped' };
  }

  const voiceReminder =
    '[INTERNAL VERIFICATION REMINDER: Apply any chart verification silently. Never quote internal verification headers. Respond authentically in your own established persona, analytical voice, and active presentation format.]';

  if (verificationMode === 'council_vedic') {
    const rawMod = engineOverrides?.vedic_turn_modifier_prompt;
    const mod =
      typeof rawMod === 'string' ? rawMod.trim() : DEFAULT_VEDIC_TURN_MODIFIER_PROMPT;
    const withMod = mod
      ? `${userText}\n\n[FORENSIC VALIDATION CHECK (APPLY SILENTLY TO THIS TURN; NEVER QUOTE OR REFERENCE THIS BLOCK IN YOUR REPLY)]\n${mod}`
      : userText;
    return {
      userText: `${withMod}\n\n${voiceReminder}`,
      appliedMode: 'council_vedic',
    };
  }

  if (verificationMode === 'council_western') {
    const rawMod = engineOverrides?.western_turn_modifier_prompt;
    const mod =
      typeof rawMod === 'string' ? rawMod.trim() : DEFAULT_WESTERN_TURN_MODIFIER_PROMPT;
    const withMod = mod
      ? `${userText}\n\n[FORENSIC VALIDATION CHECK (APPLY SILENTLY TO THIS TURN; NEVER QUOTE OR REFERENCE THIS BLOCK IN YOUR REPLY)]\n${mod}`
      : userText;
    return {
      userText: `${withMod}\n\n${voiceReminder}`,
      appliedMode: 'council_western',
    };
  }

  const neutralMod =
    engineOverrides?.companion_neutral_verification_prompt?.trim() ||
    DEFAULT_COMPANION_NEUTRAL_VERIFICATION_PROMPT;
  if (!neutralMod) {
    return { userText, appliedMode: 'skipped' };
  }

  return {
    userText: `${userText}\n\n[INTERNAL CHART VERIFICATION (APPLY SILENTLY TO THIS TURN; NEVER QUOTE OR REFERENCE THIS BLOCK IN YOUR REPLY)]\n${neutralMod}\n\n${voiceReminder}`,
    appliedMode: 'neutral',
  };
}

export function resolveCompanionGreetingConfig(
  preset?: Partial<CompanionPresetRecord> | null,
  v2?: CompanionPersonalityV2 | null
): {
  mode: CompanionGreetingMode;
  allow_memory_callback: boolean;
  custom_return_instruction: string;
} {
  const resolvedV2 =
    v2 ||
    (preset?.personality_v2_json
      ? normalizePersonalityV2(preset.personality_v2_json)
      : preset
      ? ensureCompanionV2Initialized(preset)
      : null);
  const cfg = resolvedV2?.greeting_config;
  const mode: CompanionGreetingMode =
    cfg?.mode === 'static_only' ||
    cfg?.mode === 'character_authored' ||
    cfg?.mode === 'generated_returning'
      ? cfg.mode
      : 'generated_returning';
  return {
    mode,
    allow_memory_callback: cfg?.allow_memory_callback !== false,
    custom_return_instruction:
      typeof cfg?.custom_return_instruction === 'string'
        ? cfg.custom_return_instruction.trim()
        : '',
  };
}

export function resolveCompanionAstrologicalMemoryMode(
  preset?: Partial<CompanionPresetRecord> | null,
  v2?: CompanionPersonalityV2 | null
): CompanionAstrologicalMemoryMode {
  const resolvedV2 =
    v2 ||
    (preset?.personality_v2_json
      ? normalizePersonalityV2(preset.personality_v2_json)
      : preset
      ? ensureCompanionV2Initialized(preset)
      : null);
  return resolvedV2?.astrological_memory_mode === 'shared' ? 'shared' : 'independent';
}

export function resolveCompanionFamiliarityPolicy(
  preset?: Partial<CompanionPresetRecord> | null,
  v2?: CompanionPersonalityV2 | null
): {
  mode: CompanionFamiliarityMode;
  max_familiarity: CompanionFamiliarityCeiling;
} {
  const resolvedV2 =
    v2 ||
    (preset?.personality_v2_json
      ? normalizePersonalityV2(preset.personality_v2_json)
      : preset
      ? ensureCompanionV2Initialized(preset)
      : null);
  const policy = resolvedV2?.familiarity_policy;
  const mode: CompanionFamiliarityMode =
    policy?.mode === 'fixed_register' ||
    policy?.mode === 'organic_subtle' ||
    policy?.mode === 'warm_progressive'
      ? policy.mode
      : 'warm_progressive';
  const max_familiarity: CompanionFamiliarityCeiling =
    policy?.max_familiarity === 'reserved' ||
    policy?.max_familiarity === 'cordial' ||
    policy?.max_familiarity === 'close'
      ? policy.max_familiarity
      : 'close';
  return { mode, max_familiarity };
}

export function shouldGenerateReturnGreetingForPreset(
  preset?: Partial<CompanionPresetRecord> | null,
  v2?: CompanionPersonalityV2 | null
): boolean {
  const cfg = resolveCompanionGreetingConfig(preset, v2);
  if (cfg.mode === 'static_only') return false;
  if (cfg.mode === 'character_authored') {
    return cfg.custom_return_instruction.length > 0;
  }
  return true;
}

export function resolveCompanionGreetingTemperature(
  temperature?: number | null
): number {
  return resolveCompanionTemperature({ temperature });
}

export function buildCompanionBondContinuityBlock(
  bond: CompanionBondState,
  familiarityPolicy?: CompanionFamiliarityPolicy | null
): string {
  const rel = bond.relationship_state;
  const turnTotal = Math.max(0, rel.total_turns || 0);
  const mode: CompanionFamiliarityMode = familiarityPolicy?.mode || 'warm_progressive';
  const ceiling: CompanionFamiliarityCeiling = familiarityPolicy?.max_familiarity || 'close';

  if (mode === 'fixed_register') {
    const details: string[] = [
      `Interpersonal posture (FIXED REGISTER — ${turnTotal} prior exchanges): Maintain your exact authored formality, dignity, and professional boundaries regardless of session count. Do NOT escalate into buddy warmth, casual slang mirroring, pet names, or informal intimacy.`,
    ];
    if (bond.memory_summary) {
      details.push(`Prior consultation & factual context:\n${bond.memory_summary}`);
    }
    if (rel.tone_preferences.length > 0) {
      details.push(
        `Client communication preferences (clarity/depth): ${rel.tone_preferences.join('; ')}`
      );
    }
    if (rel.inside_references.length > 0) {
      details.push(`Recurring consultation topics: ${rel.inside_references.join('; ')}`);
    }
    return `CONSULTATION CONTINUITY (FIXED REGISTER — Invisible; never announce "according to my memory/database"):\n${details.join('\n')}`;
  }

  if (mode === 'organic_subtle') {
    const continuityLine =
      ceiling === 'reserved' || turnTotal <= 2
        ? `Subtle continuity (${turnTotal} prior exchanges, ceiling: ${ceiling}): Hold measured, respectful continuity without forced slang echoing, buddy banter, or personal intimacy.`
        : ceiling === 'cordial' || turnTotal < 15
        ? `Subtle continuity (${turnTotal} prior exchanges, ceiling: cordial): Acknowledge recurring context with calm, cordial practitioner-client ease while keeping your authored dignity and avoiding casual chumminess or slang.`
        : `Subtle continuity (${turnTotal} prior exchanges, ceiling: close): Recall shared context understatedly as steady familiarity without forcing colloquial slang echoing or excessive informality.`;

    const details: string[] = [continuityLine];
    if (bond.memory_summary) {
      details.push(`Prior context across your sessions:\n${bond.memory_summary}`);
    }
    if (rel.tone_preferences.length > 0) {
      details.push(`Observed communication preferences: ${rel.tone_preferences.join('; ')}`);
    }
    if (rel.inside_references.length > 0) {
      details.push(`Recurring subjects & threads: ${rel.inside_references.join('; ')}`);
    }
    if (ceiling !== 'reserved' && rel.hearted_excerpts.length > 0) {
      details.push(
        `Approaches/lines that resonated well (subtle calibration cue — never quote verbatim): ${rel.hearted_excerpts.slice(0, 3).join(' | ')}`
      );
    }
    return `CONTINUITY & RAPPORT (SUBTLE — Invisible; never announce "according to my memory/database"):\n${details.join('\n')}`;
  }

  // warm_progressive (respecting max_familiarity ceiling)
  let progressiveLine: string;
  if (ceiling === 'reserved') {
    progressiveLine = `Continuity posture (${turnTotal} prior exchanges, ceiling: reserved): Maintain calm, poised, respectful distance across repeated sessions without sliding into casual chumminess or slang.`;
  } else if (ceiling === 'cordial') {
    progressiveLine =
      turnTotal <= 2
        ? `Continuity posture: early acquaintance (${turnTotal + 1} exchanges so far, ceiling: cordial). Stay true to your natural register without forcing slang mimicry.`
        : `Continuity posture (${turnTotal} prior exchanges, ceiling: cordial): Offer steady, cordial rapport and recall prior topics smoothly while maintaining respectful practitioner-client boundaries.`;
  } else {
    progressiveLine =
      turnTotal <= 2
        ? `Organic continuity: early acquaintance (${turnTotal + 1} exchanges so far). Stay squarely in your own natural rhythm and voice without forcing slang mimicry or over-assuming shared history.`
        : turnTotal < 15
        ? `Organic continuity: growing familiarity across ${turnTotal} exchanges shared together. Let rapport feel settled and natural within your character register; lightly echo their phrasing only where it fits organically.`
        : `Organic continuity: steady ongoing closeness built across ${turnTotal} exchanges together. Recall shared context effortlessly as lived memory, relax formal guardrails where your character welcomes candor, and let quiet inside shorthand breathe naturally.`;
  }

  const details: string[] = [progressiveLine];
  if (bond.memory_summary) {
    details.push(`Shared memory across your past chats:\n${bond.memory_summary}`);
  }
  if (ceiling === 'close' && rel.user_slang_cues.length > 0 && turnTotal >= 3) {
    details.push(`Observed speech/rhythm cues: ${rel.user_slang_cues.join(', ')}`);
  }
  if (rel.tone_preferences.length > 0) {
    details.push(`What lands best with them: ${rel.tone_preferences.join('; ')}`);
  }
  if (rel.inside_references.length > 0 && ceiling !== 'reserved') {
    details.push(`Recurring threads & references: ${rel.inside_references.join('; ')}`);
  }
  if (rel.hearted_excerpts.length > 0 && ceiling !== 'reserved') {
    details.push(
      `Moments/lines they deeply resonated with (subtle cadence cue — never quote verbatim): ${rel.hearted_excerpts.slice(0, 3).join(' | ')}`
    );
  }
  return `SHARED RELATIONSHIP CONTINUITY (Invisible — never announce "according to my memory/database"):\n${details.join('\n')}`;
}

export function buildPresetCompanionSystemPrompt(params: {
  preset?: CompanionPresetRecord | null;
  persona?: CompanionPersona | null;
  languageSlug: string;
  preferredCallName?: string | null;
  turnCount: number;
  bond?: CompanionBondState | null;
  crossThreadSnippets?: string | null;
  councilReadingNotesText?: string | null;
  userDefaultProfile?: CompanionPromptProfileContext | null;
  userPrompt?: string;
  historyMessages?: Array<{ role: 'user' | 'assistant'; content: string }>;
  companionChatMode?: CompanionChatCue | null;
  chatStyleOverride?: ChatStyle | null;
  referrableCompanions?: ReferrableCompanionSummary[];
  clientLocalHour?: number | null;
  constitutionOverride?: string | null;
  realismBaselineOverride?: string | null;
  chartPresenceOverride?: string | null;
  archetypesOverride?: CompanionArchetypeMeta[] | null;
  modularRulesText?: string | null;
  capabilities?: ResolvedCompanionCapabilities | null;
  engineOverrides?: EnginePromptOverrides | null;
  dailyTransits?: {
    transitsText?: string | null;
    westernTransitsText?: string | null;
    westernPlanets?: WesternPlanetPosition[] | null;
  } | null;
  formulaCartridges?: Record<string, ResolvedInternalRuleRecord> | null;
  turnAnalysisOverride?: CompanionTurnAnalysis | null;
}): {
  systemInstruction: string;
  chatStyle: ChatStyle;
  tarotSpread?: DrawnTarotSpread | null;
  capabilities: ResolvedCompanionCapabilities;
  invitedEsoteric: boolean;
  verificationMode: CompanionVerificationMode;
  temperature: number;
  turnAnalysis: CompanionTurnAnalysis;
  assemblyManifest: CompanionAssemblyManifest;
} {
  const { preset, persona } = params;
  // Unify both preset companions and user_custom_companions cleanly under V2
  const effectivePreset: CompanionPresetRecord | null = preset
    ? preset
    : persona
    ? mapCustomPersonaToV2PresetRecord(persona)
    : null;
  const v2: CompanionPersonalityV2 | null = effectivePreset
    ? ensureCompanionV2Initialized(effectivePreset)
    : null;

  const activeConstitution = params.constitutionOverride?.trim() || COMPANION_CONSTITUTION;
  const activeRealismBaseline =
    params.realismBaselineOverride?.trim() || DEFAULT_COMPANION_REALISM_BASELINE;
  const activeArchetypes =
    params.archetypesOverride && params.archetypesOverride.length > 0
      ? params.archetypesOverride
      : COMPANION_ARCHETYPES;

  const capabilities =
    params.capabilities ||
    resolveCompanionCapabilities(effectivePreset, params.engineOverrides || null);

  const chatStyle = normalizeChatStyle(
    params.chatStyleOverride ||
      effectivePreset?.chat_style ||
      persona?.chat_style ||
      capabilities.chat_style,
    'chat_bubbles'
  );

  const hasAnyEsoteric = Boolean(
    capabilities.chart_access.vedic ||
      capabilities.chart_access.western ||
      capabilities.chart_access.tarot ||
      capabilities.chart_access.numerology ||
      capabilities.chart_access.past_life
  );

  const hasBirthChart = Boolean(
    params.userDefaultProfile &&
      (params.userDefaultProfile.has_birth_chart !== undefined
        ? params.userDefaultProfile.has_birth_chart
        : Boolean(
            params.userDefaultProfile.birth_date ||
              params.userDefaultProfile.chart_text_context ||
              params.userDefaultProfile.chart_json
          ))
  );

  const astrologicalMemoryMode = resolveCompanionAstrologicalMemoryMode(effectivePreset, v2);
  const lightUserContext = params.userDefaultProfile
    ? formatLightweightLifeStageSummary(params.userDefaultProfile, {
        activeCompanionSlug: effectivePreset?.slug || persona?.slug || null,
        astrologicalMemoryMode,
      })
    : '';

  const turnAnalysis =
    params.turnAnalysisOverride ||
    analyzeCompanionTurnContext({
      userPrompt: params.userPrompt || '',
      historyMessages: params.historyMessages,
      companionChatMode: params.companionChatMode,
      hasLivingContext: Boolean(lightUserContext),
      hasProfileChart: hasBirthChart,
      chartAccess: capabilities.chart_access,
      personalityV2: v2,
      advisoryMode: capabilities.advisory_mode,
    });

  const layersLoaded: string[] = [];
  const orderedSections: CompanionAssemblySectionInfo[] = [];
  const estimatedTokensBySection: Record<string, number> = {};
  const sections: string[] = [];

  const pushLayer = (key: string, label: string, bodyParts: string[]) => {
    const joined = bodyParts.map((p) => p.trim()).filter(Boolean).join('\n\n');
    if (!joined) return;
    const est = estimateTokensRough(joined);
    layersLoaded.push(key);
    estimatedTokensBySection[key] = est;
    orderedSections.push({
      key,
      label,
      estimatedTokens: est,
      charCount: joined.length,
      content: joined,
    });
    sections.push(joined);
  };

  // ── LAYER 1: GLOBAL HARD RULES (ALWAYS ACTIVE) + CHARACTER NON-NEGOTIABLES + HONEST AI DISCLOSURE ─
  const layer1Parts: string[] = [activeConstitution];
  layer1Parts.push(
    params.engineOverrides?.companion_empathy_first_guardrail?.trim() ||
      DEFAULT_COMPANION_EMPATHY_FIRST_GUARDRAIL
  );

  const rawHardRules = (v2?.esoteric_guardrails || effectivePreset?.hard_rules || '').trim();
  if (rawHardRules) {
    let effectiveHardRules = rawHardRules;
    if (hasAnyEsoteric) {
      effectiveHardRules = effectiveHardRules
        .replace(/^\s*-\s*ESOTERIC SKILL BOUNDARY:[^\n]*(\n|$)/gim, '')
        .trim();
      if (!/CHART HONESTY RULE:/i.test(effectiveHardRules)) {
        effectiveHardRules +=
          '\n- CHART HONESTY RULE: Only cite birth placements, aspects, or timings actually present in the attached profile/chart context. Never invent placements.';
      }
    } else {
      effectiveHardRules = effectiveHardRules
        .replace(/^\s*-\s*CHART HONESTY RULE:[^\n]*(\n|$)/gim, '')
        .trim();
    }
    if (effectiveHardRules) {
      layer1Parts.push(`CHARACTER NON-NEGOTIABLE GUARDRAILS:\n${effectiveHardRules}`);
    }
  }

  if (turnAnalysis.ai_identity_question) {
    layer1Parts.push(
      'ACTIVE AI IDENTITY DIRECTIVE: The user directly asked whether you are an AI or a human. Answer honestly and naturally in one concise sentence consistent with your character voice (never fabricate real-world credentials or pretend to be physically human), then return smoothly to the conversation.'
    );
  } else if (v2?.ai_identity_disclosure === 'explicit_ai') {
    layer1Parts.push(
      'IDENTITY TRANSPARENCY BOUNDARY: Maintain your authentic character voice while remaining transparent about being an AI whenever identity comes up.'
    );
  } else {
    layer1Parts.push(
      'IMMERSION BOUNDARY: Stay inside your authored character voice naturally — NEVER volunteer robotic disclaimers like "As an AI..." unprompted.'
    );
  }
  pushLayer('layer1_hard_rules', 'Layer 1 · Non-Negotiables & Guardrails', layer1Parts);

  // ── LAYER 2: GLOBAL SOFT GUIDANCE + GROUP POSTURE (OVERRIDABLE) + CHARACTER SOFT INSTINCTS ─
  const layer2Parts: string[] = [activeRealismBaseline];
  if (!effectivePreset?.override_global_rules && params.modularRulesText?.trim()) {
    layer2Parts.push(`GLOBAL COMPANION RULES:\n${params.modularRulesText.trim()}`);
  }
  if (!capabilities.override_group_rules && capabilities.group_system_prompt?.trim()) {
    layer2Parts.push(capabilities.group_system_prompt.trim());
    layer2Parts.push(
      'PRECEDENCE RULE: Your individual authored character voice, register, temperament, and methodology in Layer 3 always take precedence over generic group posture whenever they differ.'
    );
  }

  const softRulesText =
    v2?.soft_instincts?.trim() ||
    effectivePreset?.soft_rules?.trim() ||
    persona?.conversation_style?.trim() ||
    '';
  const autonomyNote =
    v2?.autonomy_guidance?.trim() ||
    (effectivePreset?.autonomy_level === 'free'
      ? 'Trust your authored character judgment first; adapt pacing, directness, and analytical depth freely to the moment.'
      : effectivePreset?.autonomy_level === 'steady'
      ? 'Hold a steady, consistent character register and disciplined pacing across turns.'
      : 'Exercise authentic character judgment — adapt naturally to the context without slipping into generic chatbot habits.');
  layer2Parts.push(`CHARACTER INSTINCTS & AUTONOMY (Overrideable whenever character judgment calls for it):
${softRulesText || 'Follow your authored character register, intellectual rigor, and conversational temperament rather than falling back on a generic template.'}
Autonomy guidance: ${autonomyNote}`);
  pushLayer('layer2_soft_guidance', 'Layer 2 · Soft Realism & Instincts', layer2Parts);

  // ── LAYER 3: PERMANENT CHARACTER IDENTITY + CONDITIONALLY LOADED NUANCES & DIALOGUES ─
  const layer3Parts: string[] = [];
  if (effectivePreset && v2) {
    const sexLabel =
      effectivePreset.sex === 'F'
        ? 'Woman'
        : effectivePreset.sex === 'NB'
        ? 'Non-binary (they/them)'
        : 'Man';
    const headerLines = [
      `Name: ${effectivePreset.name} (${effectivePreset.age}, ${sexLabel})`,
      persona
        ? `Archetype & Role: ${effectivePreset.primary_expertise} (${getArchetypeLabel(persona.companion_type, activeArchetypes)})`
        : `Role: ${effectivePreset.primary_expertise}${
            effectivePreset.secondary_expertise.length > 0
              ? ` · ${effectivePreset.secondary_expertise.join(', ')}`
              : ''
          }`,
      `Cultural / Tone Fluency: ${effectivePreset.cultural_fluency || 'Clear natural expression'}`,
      `Tagline: ${effectivePreset.tagline}`,
      persona?.topic_context ? `Initial Topic Shared: ${persona.topic_context}` : '',
      persona?.religion_profile
        ? `Spiritual Orientation Calibration: Devotion ${persona.religion_profile.religiousness}/10 · ${persona.religion_profile.primary_religion}${
            persona.religion_profile.secondary_religion
              ? ` · Also appreciates: ${persona.religion_profile.secondary_religion}`
              : ''
          }. Match this depth naturally without preaching.`
        : '',
    ].filter(Boolean);

    const hasManualV2 = hasAuthoredV2Depth(effectivePreset.personality_v2_json);
    const coreCapsule = v2.core_identity_capsule?.trim();
    const coreIdentityBlock = coreCapsule
      ? `CORE IDENTITY CAPSULE:\n${coreCapsule}${
          !hasManualV2 && effectivePreset.system_prompt?.trim()
            ? `\n\nVOICE & CADENCE NOTES:\n${effectivePreset.system_prompt.trim().slice(0, 1400)}`
            : ''
        }`
      : `CORE CHARACTER & VOICE:\n${effectivePreset.system_prompt}${
          effectivePreset.backstory ? `\n\nPRIVATE BACK STORY (Inhabit quietly): ${effectivePreset.backstory}` : ''
        }${
          effectivePreset.soul_consciousness ? `\n\nSOUL & CONSCIOUSNESS: ${effectivePreset.soul_consciousness}` : ''
        }`;

    // Conditional human texture (avoid dumping the entire static monograph every turn)
    const conditionalTexture: string[] = [];
    if (v2.linguistic_fingerprint) {
      conditionalTexture.push(`Linguistic Fingerprint: ${v2.linguistic_fingerprint}`);
    }
    if (
      turnAnalysis.emotional_weight === 'playful' ||
      turnAnalysis.emotional_weight === 'celebratory' ||
      turnAnalysis.conversation_intent === 'casual_checkin'
    ) {
      if (v2.humour_and_interests) {
        conditionalTexture.push(`Humour & Interests: ${v2.humour_and_interests}`);
      }
      if (v2.quirks_and_habits) {
        conditionalTexture.push(`Quirks & Tells: ${v2.quirks_and_habits}`);
      }
    } else if (
      turnAnalysis.emotional_weight === 'distressed' ||
      turnAnalysis.conversation_intent === 'venting'
    ) {
      if (v2.interpersonal_dynamics) {
        conditionalTexture.push(`Interpersonal Presence: ${v2.interpersonal_dynamics}`);
      }
      if (v2.expression_spectrum) {
        conditionalTexture.push(`Expression Under Weight: ${v2.expression_spectrum}`);
      }
    } else {
      if (v2.subtle_contradictions) {
        conditionalTexture.push(`Human Contradictions: ${v2.subtle_contradictions}`);
      }
      if (v2.expression_spectrum) {
        conditionalTexture.push(`Expression Range: ${v2.expression_spectrum}`);
      }
    }

    if (
      v2.fictional_lore &&
      (turnAnalysis.conversation_intent === 'casual_checkin' ||
        turnAnalysis.conversation_intent === 'personal_growth' ||
        turnAnalysis.matched_nuances.length > 0)
    ) {
      conditionalTexture.push(`Quiet Lived Roots (never recite unprompted): ${v2.fictional_lore}`);
    }

    const nuancesBlock =
      turnAnalysis.matched_nuances.length > 0
        ? `ACTIVE CONTEXTUAL NUANCES (Triggered for this moment):\n${turnAnalysis.matched_nuances
            .map((n) => `- ${n.label}: ${n.guidance}`)
            .join('\n')}`
        : '';

    const dialoguesBlock =
      turnAnalysis.matched_dialogues.length > 0
        ? `REFERENCE VOICE MOMENTS (Tone & cadence calibration — never copy verbatim):\n${turnAnalysis.matched_dialogues
            .map((ex, idx) => {
              const header = ex.scenario || ex.context_note || 'Conversational example';
              return `Moment ${idx + 1} (${header}):\nUser: ${ex.user_prompt}\n${effectivePreset.name}: ${ex.companion_reply}${
                ex.context_note && ex.scenario ? `\n[Tone note: ${ex.context_note}]` : ''
              }`;
            })
            .join('\n\n')}`
        : '';

    layer3Parts.push(
      `WHO YOU ARE:\n${headerLines.join('\n')}\n\n${coreIdentityBlock}`,
      conditionalTexture.length > 0 ? `CHARACTER TEXTURE FOR THIS MOMENT:\n${conditionalTexture.join('\n')}` : '',
      nuancesBlock,
      dialoguesBlock
    );
  } else {
    layer3Parts.push(
      'WHO YOU ARE: You are a grounded practitioner and companion in Cosmic Council. Listen closely, keep replies clear and authentic, and avoid generic chatbot phrasing.'
    );
  }
  pushLayer('layer3_character_identity', 'Layer 3 · Core Identity, Nuances & Voice', layer3Parts);

  // ── LAYER 4: LIVING USER CONTEXT & ORGANIC RELATIONSHIP CONTINUITY ────────
  const layer4Parts: string[] = [];
  if (lightUserContext) {
    layer4Parts.push(
      `QUIET USER BACKGROUND (REAL-WORLD LIFE CONTEXT — understand invisibly, never recite like reading a profile):\n${lightUserContext}`
    );
  } else {
    layer4Parts.push(
      'USER BACKGROUND: No personal life context is filled out yet — completely fine for chatting naturally.'
    );
  }

  const bond = params.bond;
  if (bond) {
    const familiarityPolicy = resolveCompanionFamiliarityPolicy(effectivePreset, v2);
    layer4Parts.push(buildCompanionBondContinuityBlock(bond, familiarityPolicy));
  }

  if (params.crossThreadSnippets?.trim()) {
    layer4Parts.push(
      `RECENT MOMENTS FROM EARLIER THREADS WITH YOU (Recall naturally as shared memory only if relevant):\n${params.crossThreadSnippets.trim()}`
    );
  }
  pushLayer('layer4_user_context_and_bond', 'Layer 4 · Living Context & Bond Continuity', layer4Parts);

  // ── LAYER 5: CONTINUOUS REFERENCE CHART DATA, EXPERTISE, METHODOLOGY & JUDGMENT ──
  const skillProfileResult = buildCompanionSkillAndProfileBlock({
    preset: effectivePreset,
    capabilities,
    turnAnalysis,
    v2,
    userPrompt: params.userPrompt || '',
    historyMessages: params.historyMessages,
    userDefaultProfile: params.userDefaultProfile,
    chartPresenceOverride: params.chartPresenceOverride,
    dailyTransits: params.dailyTransits,
    formulaCartridges: params.formulaCartridges,
    engineOverrides: params.engineOverrides,
  });

  const layer5Parts: string[] = [skillProfileResult.block];
  const canReadCouncilNotes = capabilities.chart_access.council_notes || hasAnyEsoteric;
  const autoAnalystNotesText =
    astrologicalMemoryMode === 'shared' &&
    canReadCouncilNotes &&
    turnAnalysis.should_load_notes
      ? formatAnalystNotesForCompanion(params.userDefaultProfile?.analyst_notes_json, 6)
      : '';
  const sharedNotesText = params.councilReadingNotesText?.trim() || '';
  const analystNotesInjected = Boolean(autoAnalystNotesText);

  if ((sharedNotesText || autoAnalystNotesText) && canReadCouncilNotes) {
    const councilNotesRule =
      params.engineOverrides?.companion_skill_rules?.council_notes?.trim() ||
      DEFAULT_COMPANION_SKILL_RULES.council_notes;
    const notesParts: string[] = [councilNotesRule];
    if (sharedNotesText) {
      notesParts.push(
        `NOTES FROM ANOTHER ASTROLOGER / PRIOR READING (Non-authoritative external perspective — evaluate independently against the raw chart data and feel free to disagree):\n${sharedNotesText}`
      );
    }
    if (autoAnalystNotesText) {
      notesParts.push(
        `NOTES FROM ANOTHER ASTROLOGER / PRIOR READING (Non-authoritative external perspective — evaluate independently against the raw chart data and feel free to disagree):\n${autoAnalystNotesText}`
      );
    }
    notesParts.push(
      `HOW TO USE THESE EXTERNAL NOTES:
- NEVER treat another practitioner's or prior Council session's conclusions as unquestioned natal truth.
- Verify every chart, timing, or interpretive claim independently against the raw Sidereal and Tropical chart & transit data above; refine, challenge, or disagree openly whenever your own reading leads to a different conclusion.
- Express your perspective naturally in your own character voice without lecturing if the user is focused on something unrelated.`
    );
    layer5Parts.push(notesParts.join('\n\n'));
  } else if (sharedNotesText) {
    layer5Parts.push(
      `NOTES FROM ANOTHER ASTROLOGER / PRIOR READING (Non-authoritative external perspective — shared by the user for context):
${sharedNotesText}

HOW TO USE THESE SHARED NOTES:
- Stay present with the emotional and practical meaning of what the user shared without treating external interpretations as fixed truth or inventing chart placements yourself.`
    );
  }
  pushLayer('layer5_specialist_and_chart', 'Layer 5 · Reference Charts, Expertise & Methodology', layer5Parts);

  // ── LAYER 6: CURRENT CONVERSATION CONTROLS & RUNTIME CUES ─────────────────
  const layer6Parts: string[] = [];
  if (params.companionChatMode === 'just_listen') {
    const listenGuardrail =
      params.engineOverrides?.companion_listen_only_guardrail?.trim() ||
      DEFAULT_COMPANION_LISTEN_ONLY_GUARDRAIL;
    layer6Parts.push(
      `USER PACE CUE — "JUST LISTEN": The user explicitly asked for quiet, unhurried company right now.${
        capabilities.advisory_mode !== 'listen_only' ? `\n\n${listenGuardrail}` : ''
      }`
    );
  } else if (params.companionChatMode === 'help_think') {
    layer6Parts.push(
      `USER PACE CUE — "HELP ME THINK": The user explicitly signaled they want perspective and clear thinking. Help them untangle the situation using your character's honest observations, analytical clarity, or focused questions.`
    );
  } else {
    layer6Parts.push(
      `USER PACE CUE — "NATURAL" (DEFAULT): Exercise your own judgment in your authored character voice — hold quiet space when minimal presence fits best, or respond with direct analysis, candor, wit, or warmth as fits your character and the moment.`
    );
  }

  layer6Parts.push(buildChatStyleInstruction(chatStyle));
  layer6Parts.push(
    formatHumanTimeAndGapContext(bond?.last_interaction_at || null, params.clientLocalHour)
  );

  const activeSlug = (effectivePreset?.slug || persona?.slug || '').toLowerCase();
  const others = (params.referrableCompanions || [])
    .filter((c) => c.slug.toLowerCase() !== activeSlug)
    .slice(0, 60);
  if (others.length > 0) {
    const rosterLine = others
      .map((c) => `${c.name} (${c.slug} — ${c.primary_expertise})`)
      .join(', ');
    layer6Parts.push(`PRACTITIONER / COMPANION REFERRAL (ONLY WHEN GENUINELY HELPFUL):
Active practitioners and companions you know: ${rosterLine}.
If the user explicitly asks for a discipline outside yours (e.g., asking an emotional friend for birth-chart timing, or asking an astrologer for tarot) OR clearly needs a very different kind of guide, mention that practitioner or companion naturally in conversation and append ON A FINAL NEW LINE (never inside code fences; omit if not referring):
<<<REFERRAL:{"slug":"target_slug","name":"Target Name","reason":"Short 1-sentence reason"}>>>`);
  }

  if (params.languageSlug && params.languageSlug !== 'English') {
    layer6Parts.push(
      `LANGUAGE REQUIREMENT: Converse naturally and idiomatically in ${params.languageSlug}, matching your authored character register and tone rather than stiff textbook translation.`
    );
  } else {
    layer6Parts.push(
      `LANGUAGE REQUIREMENT: Converse in clear, natural English matching your authored character register, vocabulary, and formality.`
    );
  }

  const safeCallName = sanitizeHumanCallName(params.preferredCallName);
  if (safeCallName && params.turnCount === 0) {
    layer6Parts.push(
      `USER FIRST NAME (Use lightly): "${safeCallName}". Never overuse or repeat their name on every message.`
    );
  }

  if (params.turnCount > 0) {
    layer6Parts.push(
      `THREAD CONTINUITY (Message #${params.turnCount + 1} in this chat): Continue right inside the flow naturally. Do NOT say hello again or re-introduce yourself.`
    );
  }
  pushLayer('layer6_turn_controls', 'Layer 6 · Turn Controls, Timing & Language', layer6Parts);

  const systemInstruction = sections.join('\n\n---\n\n');
  const capsuleText = v2?.core_identity_capsule?.trim() || '';
  const capsuleApplied = Boolean(capsuleText);
  const capsuleTokens = capsuleText ? estimateTokensRough(capsuleText) : 0;

  let gateReason = '';
  if (hasBirthChart && skillProfileResult.chartInjected) {
    gateReason = skillProfileResult.invitedEsoteric
      ? 'Continuous dual-tradition telemetry active — complete Vedic Sidereal + Western Tropical natal charts and daily transits loaded alongside active esoteric intent.'
      : 'Continuous dual-tradition telemetry active — complete Vedic Sidereal + Western Tropical natal charts and daily transits loaded quietly as reference (conversational posture remains natural).';
  } else if (hasBirthChart) {
    gateReason =
      'Birth profile present with incomplete ephemeris telemetry — non-fabricated incomplete-chart caution and daily transits loaded cleanly.';
  } else if (skillProfileResult.transitsInjected || skillProfileResult.tarotDrawn) {
    gateReason =
      'No personal birth chart attached — non-fabricated missing-chart notice plus global daily transits / divination tools loaded cleanly.';
  } else {
    gateReason =
      'No personal birth chart attached — operating with practitioner expertise and non-fabricated missing-chart notice.';
  }

  const assemblyManifest: CompanionAssemblyManifest = {
    layersLoaded,
    orderedSections,
    nuancesTriggered: turnAnalysis.matched_nuances.map((n) => ({
      id: n.id,
      title: n.label,
      priority: n.priority,
    })),
    dialoguesTriggered: turnAnalysis.matched_dialogues.map((d) => ({
      id: d.id,
      scenario: d.scenario || d.context_note || d.user_prompt.slice(0, 60),
    })),
    capsuleApplied,
    capsuleTokens,
    chartInjected: skillProfileResult.chartInjected,
    transitsInjected: skillProfileResult.transitsInjected,
    analystNotesInjected,
    tarotDrawn: skillProfileResult.tarotDrawn,
    esotericRelevance: turnAnalysis.esoteric_relevance,
    astrologyEntryRule: turnAnalysis.astrology_entry_rule,
    astrologyGateDecision: {
      loaded:
        skillProfileResult.chartInjected ||
        skillProfileResult.transitsInjected ||
        skillProfileResult.tarotDrawn,
      reason: gateReason,
      hasAnyEsoteric,
      hasProfileChart: hasBirthChart,
      astrologyEntryRule: turnAnalysis.astrology_entry_rule,
      esotericRelevance: turnAnalysis.esoteric_relevance,
    },
    emotionalWeight: turnAnalysis.emotional_weight,
    conversationIntent: turnAnalysis.conversation_intent,
    aiIdentityQuestion: turnAnalysis.ai_identity_question,
    estimatedTokensBySection,
    totalEstimatedTokens: estimateTokensRough(systemInstruction),
    assembledPromptPreview:
      systemInstruction.length > 1600
        ? `${systemInstruction.slice(0, 1600)}\n... [truncated preview]`
        : systemInstruction,
  };

  const verificationMode = resolveCompanionVerificationMode(effectivePreset, v2);
  const temperature = resolveCompanionTemperature(effectivePreset);

  return {
    systemInstruction,
    chatStyle,
    tarotSpread: skillProfileResult.tarotSpread || null,
    capabilities,
    invitedEsoteric: skillProfileResult.invitedEsoteric,
    verificationMode,
    temperature,
    turnAnalysis,
    assemblyManifest,
  };
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
  return buildPresetCompanionSystemPrompt({
    preset: null,
    persona: params.persona,
    languageSlug: params.languageSlug,
    preferredCallName: params.preferredCallName,
    turnCount: params.turnCount,
    crossThreadSnippets: params.memorySnippets,
    constitutionOverride: params.constitutionOverride,
    archetypesOverride: params.archetypesOverride,
    modularRulesText: params.modularRulesText,
  }).systemInstruction;
}

export async function buildCompanionSystemPromptAsync(params: {
  preset?: CompanionPresetRecord | null;
  persona: CompanionPersona | null;
  languageSlug: string;
  preferredCallName?: string | null;
  turnCount: number;
  memorySnippets?: string | null;
  bond?: CompanionBondState | null;
  crossThreadSnippets?: string | null;
  councilReadingNotesText?: string | null;
  userDefaultProfile?: CompanionPromptProfileContext | null;
  userPrompt?: string;
  historyMessages?: Array<{ role: 'user' | 'assistant'; content: string }>;
  companionChatMode?: CompanionChatCue | null;
  chatStyleOverride?: ChatStyle | null;
  referrableCompanions?: ReferrableCompanionSummary[];
  clientLocalHour?: number | null;
}): Promise<{
  systemInstruction: string;
  modelOverride: string | null;
  chatStyle: ChatStyle;
  suggestionsEnabled: boolean;
  tarotSpread?: DrawnTarotSpread | null;
  capabilities: ResolvedCompanionCapabilities;
  invitedEsoteric: boolean;
  verificationMode: CompanionVerificationMode;
  temperature: number;
  engineOverrides: EnginePromptOverrides;
  turnAnalysis: CompanionTurnAnalysis;
  assemblyManifest: CompanionAssemblyManifest;
}> {
  const [engineOverrides, guideCfg] = await Promise.all([
    getEnginePromptOverrides(),
    getResolvedGuideConfig('companion'),
  ]);

  const effectivePreset: CompanionPresetRecord | null = params.preset
    ? params.preset
    : params.persona
    ? mapCustomPersonaToV2PresetRecord(params.persona)
    : null;
  const v2 = effectivePreset ? ensureCompanionV2Initialized(effectivePreset) : null;
  const capabilities = resolveCompanionCapabilities(effectivePreset, engineOverrides);

  const hasProfileChart = Boolean(
    params.userDefaultProfile &&
      (params.userDefaultProfile.has_birth_chart !== undefined
        ? params.userDefaultProfile.has_birth_chart
        : Boolean(
            params.userDefaultProfile.birth_date ||
              params.userDefaultProfile.chart_text_context ||
              params.userDefaultProfile.chart_json
          ))
  );

  const turnAnalysis = analyzeCompanionTurnContext({
    userPrompt: params.userPrompt || '',
    historyMessages: params.historyMessages,
    companionChatMode: params.companionChatMode,
    hasLivingContext: Boolean(
      params.userDefaultProfile?.life_context_json ||
        params.userDefaultProfile?.deep_profile_json
    ),
    hasProfileChart,
    chartAccess: capabilities.chart_access,
    personalityV2: v2,
    advisoryMode: capabilities.advisory_mode,
  });

  const hasAnyEsoteric = Boolean(
    capabilities.chart_access.vedic ||
      capabilities.chart_access.western ||
      capabilities.chart_access.tarot ||
      capabilities.chart_access.numerology ||
      capabilities.chart_access.past_life
  );

  // Continuous transit & optional cartridge loading: never gated by message keywords or chart_access booleans when a profile chart is attached.
  const needsTransits = hasProfileChart || hasAnyEsoteric;
  const needsFormulaCartridges = capabilities.formula_cartridge_slugs.length > 0;

  const [dailyTransits, formulaCartridges] = await Promise.all([
    needsTransits ? getOrFetchDailyTransits().catch(() => null) : Promise.resolve(null),
    needsFormulaCartridges ? getFormulaCartridgesCached().catch(() => null) : Promise.resolve(null),
  ]);

  const built = buildPresetCompanionSystemPrompt({
    preset: effectivePreset,
    persona: params.persona,
    languageSlug: params.languageSlug,
    preferredCallName: params.preferredCallName,
    turnCount: params.turnCount,
    bond: params.bond || null,
    crossThreadSnippets: params.crossThreadSnippets || params.memorySnippets || null,
    councilReadingNotesText: params.councilReadingNotesText || null,
    userDefaultProfile: params.userDefaultProfile || null,
    userPrompt: params.userPrompt || '',
    historyMessages: params.historyMessages,
    companionChatMode: params.companionChatMode || null,
    chatStyleOverride: params.chatStyleOverride || null,
    referrableCompanions: params.referrableCompanions,
    clientLocalHour: params.clientLocalHour,
    constitutionOverride: engineOverrides.companion_constitution || null,
    realismBaselineOverride: engineOverrides.companion_realism_baseline || null,
    chartPresenceOverride: engineOverrides.companion_chart_presence_prompt || null,
    archetypesOverride: engineOverrides.companion_archetypes || null,
    modularRulesText: guideCfg.combined_rules_text || null,
    capabilities,
    engineOverrides,
    dailyTransits,
    formulaCartridges,
    turnAnalysisOverride: turnAnalysis,
  });

  const modelOverride = effectivePreset?.model_id?.trim() || guideCfg.model_id || null;
  const suggestionsEnabled =
    (effectivePreset ? effectivePreset.suggestions_enabled : true) &&
    guideCfg.features.followups !== false;

  return {
    systemInstruction: built.systemInstruction,
    modelOverride,
    chatStyle: built.chatStyle,
    suggestionsEnabled,
    tarotSpread: built.tarotSpread || null,
    capabilities: built.capabilities,
    invitedEsoteric: built.invitedEsoteric,
    verificationMode: built.verificationMode,
    temperature: built.temperature,
    engineOverrides,
    turnAnalysis: built.turnAnalysis,
    assemblyManifest: built.assemblyManifest,
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

  // Clarity answers directly as "you/your" without repeating names or greetings

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

export interface CompanionReturnGreetingParams {
  name: string;
  roleLabel: string;
  culturalFluency?: string | null;
  tagline?: string | null;
  systemPromptSnippet?: string | null;
  soulSnippet?: string | null;
  chatStyle: ChatStyle;
  languageSlug?: string | null;
  preferredCallName?: string | null;
  bond: CompanionBondState;
  clientLocalHour?: number | null;
  modelId?: string | null;
  temperature?: number | null;
  greetingConfig?: CompanionGreetingConfig | null;
  familiarityPolicy?: CompanionFamiliarityPolicy | null;
  personalityV2?: CompanionPersonalityV2 | null;
  welcomeMessages?: string[] | null;
}

export function buildContextualReturnGreetingPrompt(
  params: CompanionReturnGreetingParams & { template?: string | null }
): {
  system: string;
  temperature: number;
  includedMemoryCallback: boolean;
} {
  const timingCtx = formatHumanTimeAndGapContext(
    params.bond.last_interaction_at,
    params.clientLocalHour ?? null
  );
  const safeName = sanitizeHumanCallName(params.preferredCallName);
  const rel = params.bond.relationship_state;
  const greetingCfg = params.greetingConfig || {
    mode: 'generated_returning' as CompanionGreetingMode,
    allow_memory_callback: true,
    custom_return_instruction: '',
  };
  const policy = params.familiarityPolicy || {
    mode: 'warm_progressive' as CompanionFamiliarityMode,
    max_familiarity: 'close' as CompanionFamiliarityCeiling,
  };
  const ceiling = policy.max_familiarity || 'close';
  const isFixedRegister = policy.mode === 'fixed_register';
  const isReserved = ceiling === 'reserved';

  const styleNote =
    params.chatStyle === 'chat_bubbles'
      ? 'Write 1–2 concise opening bubbles strictly in your character register (if splitting into 2 short lines, separate them with [[BUBBLE]]). Never exceed 2 short lines.'
      : 'Write a brief 1–2 sentence opening greeting strictly matching your authored voice, formality, and intellectual register (no [[BUBBLE]] markers).';

  const greetingTemplate =
    params.template?.trim() || DEFAULT_COMPANION_RETURN_GREETING_PROMPT;

  const continuityStage = isFixedRegister
    ? 'fixed professional/authored register'
    : isReserved
    ? 'reserved continuity'
    : policy.mode === 'organic_subtle' || ceiling === 'cordial'
    ? rel.total_turns >= 3
      ? 'steady cordial continuity'
      : 'early acquaintance'
    : rel.total_turns >= 12
    ? 'established familiarity'
    : rel.total_turns >= 3
    ? 'growing familiarity'
    : 'early acquaintance';

  const allowMemoryFlag = greetingCfg.allow_memory_callback !== false;
  // Formal/reserved practitioners must greet cleanly in character without unprompted memory-dropping or casual banter
  const canIncludeMemory = allowMemoryFlag && !isReserved;
  const canIncludeSharedThreads =
    allowMemoryFlag && !isFixedRegister && !isReserved && (policy.mode !== 'organic_subtle' || ceiling === 'close');

  let familiarityPostureLine = '';
  if (isFixedRegister || isReserved) {
    familiarityPostureLine =
      'Familiarity posture: Maintain strict adherence to your authored formality, dignity, and distance. Greet cleanly in character with zero forced buddy banter, casual slang, or unprompted personal memory-dropping.';
  } else if (policy.mode === 'organic_subtle' || ceiling === 'cordial') {
    familiarityPostureLine = `Familiarity posture: Keep interpersonal tone restrained and ${ceiling} — acknowledge continuity subtly if appropriate without casual chumminess.`;
  } else {
    familiarityPostureLine =
      'Familiarity posture: Stay faithful to your authored register while welcoming them naturally.';
  }
  if (!allowMemoryFlag) {
    familiarityPostureLine +=
      ' Memory callback is DISABLED: open fresh in character without referencing prior sessions or personal details.';
  }

  const v2 = params.personalityV2;
  const voiceCues: string[] = [];
  if (v2?.character_essence?.trim()) {
    voiceCues.push(`Character essence: ${v2.character_essence.trim().slice(0, 320)}`);
  }
  if (v2?.linguistic_fingerprint?.trim()) {
    voiceCues.push(`Linguistic fingerprint: ${v2.linguistic_fingerprint.trim().slice(0, 260)}`);
  }
  if (params.systemPromptSnippet?.trim()) {
    voiceCues.push(`Voice & persona cue: ${params.systemPromptSnippet.trim().slice(0, 500)}`);
  }
  if (
    greetingCfg.mode === 'character_authored' &&
    Array.isArray(params.welcomeMessages) &&
    params.welcomeMessages.length > 0
  ) {
    voiceCues.push(
      `Authored opening cadence examples (style reference only): ${params.welcomeMessages
        .slice(0, 2)
        .map((m) => `"${m.trim().slice(0, 140)}"`)
        .join(' | ')}`
    );
  }

  const memoryLine =
    canIncludeMemory && params.bond.memory_summary
      ? isFixedRegister
        ? `Prior consultation context (acknowledge formally ONLY if directly helpful to your role; zero casual banter):\n${params.bond.memory_summary.slice(0, 450)}`
        : `Prior continuity summary:\n${params.bond.memory_summary.slice(0, 600)}`
      : '';

  const sharedThreadsLine =
    canIncludeSharedThreads && rel.inside_references.length > 0
      ? `Recurring subjects: ${rel.inside_references.slice(0, 3).join('; ')}`
      : '';

  const customReturnInstruction = greetingCfg.custom_return_instruction?.trim() || '';
  const customReturnLine = customReturnInstruction
    ? `CHARACTER RETURN-GREETING INSTRUCTION (Follow closely): ${customReturnInstruction}`
    : '';

  const greetingVars: Record<string, string> = {
    NAME: params.name,
    ROLE_LABEL: params.roleLabel,
    CULTURAL_FLUENCY:
      params.culturalFluency?.trim() || 'Grounded, authentic in-character register',
    TAGLINE_LINE: params.tagline ? `Presence: ${params.tagline}` : '',
    VOICE_CUE_LINE: voiceCues.join('\n'),
    SOUL_LINE: params.soulSnippet
      ? `Inner cadence & perceptual lens: ${params.soulSnippet.slice(0, 320)}`
      : '',
    TIMING_CTX: timingCtx,
    BOND_STAGE: continuityStage,
    TOTAL_TURNS: String(rel.total_turns),
    FAMILIARITY_POSTURE_LINE: familiarityPostureLine,
    MEMORY_LINE: memoryLine,
    SHARED_THREADS_LINE: sharedThreadsLine,
    USER_NAME_LINE: safeName
      ? isFixedRegister || isReserved
        ? `User's preferred name: ${safeName} (address formally or omit as fits your character).`
        : `User's preferred name: ${safeName} (use lightly only if natural).`
      : '',
    CUSTOM_RETURN_LINE: customReturnLine,
    LANGUAGE: params.languageSlug || 'English',
    STYLE_NOTE: styleNote,
  };

  let system = greetingTemplate;
  for (const [k, v] of Object.entries(greetingVars)) {
    system = system.split(`{{${k}}}`).join(v);
  }
  system = system.replace(/\n{3,}/g, '\n\n').trim();

  return {
    system,
    temperature: resolveCompanionGreetingTemperature(params.temperature),
    includedMemoryCallback: Boolean(memoryLine || sharedThreadsLine),
  };
}

export async function generateContextualCompanionReturnGreeting(
  params: CompanionReturnGreetingParams
): Promise<string | null> {
  if (params.greetingConfig?.mode === 'static_only') {
    return null;
  }
  if (
    params.greetingConfig?.mode === 'character_authored' &&
    !params.greetingConfig.custom_return_instruction?.trim()
  ) {
    return null;
  }
  if (!(await isOpenRouterConfiguredAsync())) {
    return null;
  }
  const hasHistory =
    (params.bond.relationship_state?.total_turns || 0) > 0 ||
    Boolean(params.bond.last_interaction_at);
  if (!hasHistory) {
    return null;
  }

  try {
    const [runtime, engineOverrides] = await Promise.all([
      getResolvedOpenRouterRuntime(),
      getEnginePromptOverrides().catch(() => ({} as Record<string, never>)),
    ]);
    const model = params.modelId?.trim() || runtime.utilityModel || getUtilityModel();
    const template =
      (engineOverrides as { companion_return_greeting_prompt?: string })
        .companion_return_greeting_prompt?.trim() || DEFAULT_COMPANION_RETURN_GREETING_PROMPT;

    const { system, temperature } = buildContextualReturnGreetingPrompt({
      ...params,
      template,
    });

    const completion = await createOpenRouterCompletion({
      model,
      system,
      messages: [
        {
          role: 'user',
          content: 'Open a new conversation thread with me in character.',
        },
      ],
      maxTokens: 150,
      temperature,
    });

    const cleaned = completion.text
      .replace(/^["'\s]+|["'\s]+$/g, '')
      .replace(/\b(as an ai|language model|my database|my logs)\b/gi, '')
      .trim();

    if (!cleaned || cleaned.length < 4) return null;
    if (params.chatStyle !== 'chat_bubbles') {
      return cleaned.replace(/\[\[BUBBLE\]\]/gi, ' ').replace(/\s+/g, ' ').trim();
    }
    return cleaned;
  } catch {
    return null;
  }
}

// ---------------- Admin V2 Testing Sandbox & Prompt Diagnostics ----------------

const SANDBOX_SAMPLE_CHART_PROFILE: CompanionPromptProfileContext = {
  name: 'Aarav',
  short_name: 'Aarav',
  has_birth_chart: true,
  birth_date: '1993-08-19',
  birth_time: '06:42',
  birth_city: 'Bengaluru',
  birth_country: 'India',
  current_city: 'Bengaluru',
  current_country: 'India',
  chart_text_context: `LAGNA: Leo (Simha) 18°14' (Purva Phalguni Pada 2)
MOON: Virgo (Kanya) 09°38' (Uttara Phalguni Pada 4)
SUN: Leo 02°41' (Magha Pada 1) · Vargottama
CURRENT VIMSHOTTARI DASHA: Jupiter Mahadasha -> Saturn Antardasha (started Jan 2025, ends Mar 2027)
KEY HOUSES: 10th Lord Venus in 11th Gemini; 7th Lord Saturn in 7th Aquarius (own sign, strong).`,
  life_context_json: {
    career_mode: 'job_salaried',
    career_role: 'Senior Product Designer',
    relationship_status: 'dating_committed',
    core_stress_areas: ['Work-life balance', 'Long-distance clarity'],
  },
  deep_profile_json: {
    practical_reality: [
      'Working as a product designer navigating a career crossroads and a quiet long-distance relationship check-in.',
    ],
  },
  analyst_notes_json: [
    {
      id: 'sandbox_note_1',
      summary:
        'Structural career traction rewards patience and steady craftsmanship right now rather than abrupt leaps; 7th-house Saturn supports honest long-term commitments.',
      system_label: 'Vedic astrologer',
      system_slug: 'vedic_astrologer',
      conversation_id: null,
      captured_at: new Date().toISOString(),
    },
  ],
};

const SANDBOX_WESTERN_SAMPLE_PROFILE: CompanionPromptProfileContext = {
  name: 'Maya',
  short_name: 'Maya',
  has_birth_chart: true,
  birth_date: '1995-11-04',
  birth_time: '14:15',
  birth_city: 'London',
  birth_country: 'United Kingdom',
  current_city: 'London',
  current_country: 'United Kingdom',
  chart_text_context: `TROPICAL SUN: Scorpio 12°04' (9th House)
TROPICAL MOON: Aries 24°19' (2nd House)
RISING / ASCENDANT: Aquarius 27°51'
SATURN: Pisces 18°22' (1st House) · VENUS: Sagittarius 02°11' (10th House)`,
  life_context_json: {
    career_mode: 'freelancer_consultant',
    career_role: 'Independent Brand Strategist',
    relationship_status: 'single',
    core_stress_areas: ['Creative burnout', 'Boundary setting with clients'],
  },
  deep_profile_json: {
    practical_reality: [
      'Independent brand strategist weighing a move abroad while recovering from client burnout.',
    ],
  },
  analyst_notes_json: [
    {
      id: 'sandbox_note_western_1',
      summary:
        'Saturn crossing the 1st-house threshold asks for clearer energy boundaries rather than faster creative output.',
      system_label: 'Modern Astrologer',
      system_slug: 'modern_astrologer',
      conversation_id: null,
      captured_at: new Date().toISOString(),
    },
  ],
};

export interface CompanionParsedReferralPreview {
  slug: string;
  name: string;
  reason: string;
}

export interface CompanionParsedReplyPreview {
  bubbles: string[];
  referral: CompanionParsedReferralPreview | null;
  cleanedText: string;
}

export function parseCompanionReplyPreview(rawText: string): CompanionParsedReplyPreview {
  const raw = String(rawText || '');
  let referral: CompanionParsedReferralPreview | null = null;
  const referralMatch = raw.match(/<<<REFERRAL:([\s\S]*?)>>>/i);
  if (referralMatch?.[1]) {
    try {
      const parsed = JSON.parse(referralMatch[1].trim()) as Record<string, unknown>;
      if (parsed && typeof parsed.slug === 'string' && typeof parsed.name === 'string') {
        referral = {
          slug: parsed.slug.trim(),
          name: parsed.name.trim(),
          reason: typeof parsed.reason === 'string' ? parsed.reason.trim() : '',
        };
      }
    } catch {
      // Ignore malformed referral block in preview
    }
  }

  const codeBlocks: string[] = [];
  let working = raw.replace(/```[\s\S]*?```/g, (match) => {
    const idx = codeBlocks.length;
    codeBlocks.push(match);
    return `__CC_STUDIO_CODE_${idx}__`;
  });

  working = working
    .replace(/<<<REFERRAL:[\s\S]*?(?:>>>|$)/gi, '')
    .replace(/<<<REFERRAL[^\n]*$/i, '')
    .replace(/\[\[BUBB?L?E?\]?$/i, '');

  const bubbles = working
    .split(/\s*\[\[BUBBLE\]\]\s*/gi)
    .map((part) => {
      const restored =
        codeBlocks.length > 0
          ? part.replace(/__CC_STUDIO_CODE_(\d+)__/g, (_, i) => codeBlocks[Number(i)] || '')
          : part;
      return restored.trim();
    })
    .filter(Boolean);

  return {
    bubbles,
    referral,
    cleanedText: bubbles.join('\n\n'),
  };
}

export interface CompanionStudioSimulationConfig {
  hasBirthChart?: boolean;
  sampleChartKey?: 'aarav_vedic' | 'maya_western';
  livingContext?: {
    career_mode?: string;
    career_role?: string;
    relationship_status?: string;
    core_stress_areas?: string[];
    active_goals?: string[];
    habits_and_routines?: string[];
    practical_notes?: string;
  };
  bond?: {
    total_turns?: number;
    memory_summary?: string | null;
    inside_references?: string[];
    tone_preferences?: string[];
  };
  companionChatMode?: CompanionChatCue | null;
  chatStyleOverride?: ChatStyle | null;
  languageSlug?: string;
  clientLocalHour?: number | null;
  preferredCallName?: string | null;
}

export interface CompanionSandboxResult {
  companionSlug: string;
  companionName: string;
  assembledSystemPrompt: string;
  chatStyle: ChatStyle;
  modelUsed: string;
  invitedEsoteric: boolean;
  verificationMode: CompanionVerificationMode;
  appliedVerificationMode: CompanionVerificationMode | 'skipped';
  temperatureUsed: number;
  verifiedUserPrompt?: string;
  openrouterConfigured: boolean;
  assemblyManifest: CompanionAssemblyManifest;
  tarotSpread?: DrawnTarotSpread | null;
  tokenBreakdown: {
    totalEstimatedTokens: number;
    capsuleEstimatedTokens: number;
    characterChars: number;
    sectionsCount: number;
  };
  replyText?: string;
  parsedReply?: CompanionParsedReplyPreview;
  latencyMs?: number;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
  liveModelError?: string;
}

function buildSimulatedProfileAndBond(
  simulation?: CompanionStudioSimulationConfig,
  contextMode?: 'chartless' | 'sample_chart',
  preferredCallName?: string | null,
  companionSlug?: string
): {
  userDefaultProfile: CompanionPromptProfileContext;
  bond: CompanionBondState | null;
} {
  const useChart =
    simulation?.hasBirthChart !== undefined
      ? Boolean(simulation.hasBirthChart)
      : contextMode === 'sample_chart';

  const baseProfile: CompanionPromptProfileContext = useChart
    ? {
        ...(simulation?.sampleChartKey === 'maya_western'
          ? SANDBOX_WESTERN_SAMPLE_PROFILE
          : SANDBOX_SAMPLE_CHART_PROFILE),
      }
    : {
        name:
          simulation?.preferredCallName?.trim() ||
          preferredCallName?.trim() ||
          'Alex',
        short_name:
          simulation?.preferredCallName?.trim() ||
          preferredCallName?.trim() ||
          'Alex',
        has_birth_chart: false,
        birth_date: '',
        birth_city: '',
        birth_country: '',
        life_context_json: {
          career_mode: 'job_salaried',
          career_role: 'Operations Lead',
          relationship_status: 'single',
          core_stress_areas: ['Work-life balance', 'Evening overthinking'],
        },
        deep_profile_json: {
          practical_reality: [
            'Testing natural human companionship without any attached birth chart.',
          ],
        },
      };

  const displayName =
    simulation?.preferredCallName?.trim() ||
    preferredCallName?.trim() ||
    baseProfile.name;
  baseProfile.name = displayName;
  baseProfile.short_name = displayName;

  if (simulation?.livingContext) {
    const slc = simulation.livingContext;
    const prevLc = (baseProfile.life_context_json || {}) as LifeContextData;
    const stressAreas = Array.isArray(slc.core_stress_areas)
      ? slc.core_stress_areas.map((s) => String(s).trim()).filter(Boolean).slice(0, 6)
      : prevLc.core_stress_areas;

    baseProfile.life_context_json = {
      ...prevLc,
      ...(slc.career_mode ? { career_mode: slc.career_mode as LifeContextData['career_mode'] } : {}),
      ...(slc.career_role !== undefined ? { career_role: slc.career_role.trim() } : {}),
      ...(slc.relationship_status
        ? { relationship_status: slc.relationship_status as LifeContextData['relationship_status'] }
        : {}),
      ...(stressAreas ? { core_stress_areas: stressAreas } : {}),
    };

    const deepNext: DeepProfileData = {
      ...(baseProfile.deep_profile_json || {}),
    };
    if (Array.isArray(slc.active_goals) && slc.active_goals.length > 0) {
      deepNext.desires_and_goals = slc.active_goals.map((g) => String(g).trim()).filter(Boolean);
    }
    if (Array.isArray(slc.habits_and_routines) && slc.habits_and_routines.length > 0) {
      deepNext.habits_and_routines = slc.habits_and_routines
        .map((h) => String(h).trim())
        .filter(Boolean);
    }
    if (slc.practical_notes?.trim()) {
      deepNext.practical_reality = [slc.practical_notes.trim()];
    }
    baseProfile.deep_profile_json = deepNext;
  }

  let bond: CompanionBondState | null = null;
  if (simulation?.bond) {
    const turns = Math.max(0, Math.min(500, Math.round(Number(simulation.bond.total_turns) || 0)));
    const mem = simulation.bond.memory_summary?.trim() || null;
    const refs = Array.isArray(simulation.bond.inside_references)
      ? simulation.bond.inside_references.map((r) => String(r).trim()).filter(Boolean)
      : [];
    const prefs = Array.isArray(simulation.bond.tone_preferences)
      ? simulation.bond.tone_preferences.map((p) => String(p).trim()).filter(Boolean)
      : [];
    if (turns > 0 || mem || refs.length > 0 || prefs.length > 0) {
      bond = {
        companion_slug: companionSlug || 'companion',
        memory_summary: mem,
        last_interaction_at: turns > 0 ? new Date(Date.now() - 1000 * 60 * 60 * 14).toISOString() : null,
        relationship_state: {
          familiarity_stage: turns <= 5 ? 'just_met' : turns <= 20 ? 'warming_up' : 'close_confidant',
          total_turns: turns,
          user_slang_cues: [],
          tone_preferences: prefs,
          inside_references: refs,
          hearted_excerpts: [],
        },
      };
    }
  }

  return { userDefaultProfile: baseProfile, bond };
}

export async function runCompanionSandboxTest(params: {
  preset: CompanionPresetRecord;
  userPrompt?: string;
  historyMessages?: Array<{ role: 'user' | 'assistant'; content: string }>;
  messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
  contextMode?: 'chartless' | 'sample_chart';
  companionChatMode?: CompanionChatCue | null;
  chatStyleOverride?: ChatStyle | null;
  languageSlug?: string;
  preferredCallName?: string | null;
  simulation?: CompanionStudioSimulationConfig;
  referrableCompanions?: ReferrableCompanionSummary[];
  runLiveModel?: boolean;
  gracefulMissingKey?: boolean;
}): Promise<CompanionSandboxResult> {
  const sim = params.simulation;
  const resolvedHistory = [...(params.historyMessages || [])];
  let resolvedPrompt = (params.userPrompt || '').trim();

  if (Array.isArray(params.messages) && params.messages.length > 0) {
    const cleaned = params.messages
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .map((m) => ({ role: m.role, content: m.content.trim() }))
      .filter((m) => m.content.length > 0);
    if (cleaned.length > 0 && cleaned[cleaned.length - 1].role === 'user') {
      resolvedPrompt = cleaned[cleaned.length - 1].content;
      resolvedHistory.splice(0, resolvedHistory.length, ...cleaned.slice(0, -1));
    } else if (cleaned.length > 0) {
      resolvedHistory.splice(0, resolvedHistory.length, ...cleaned);
    }
  }

  const effectiveLanguage = sim?.languageSlug || params.languageSlug || 'English';
  const effectiveCallName =
    sim?.preferredCallName !== undefined ? sim.preferredCallName : params.preferredCallName || null;
  const effectiveCue =
    sim?.companionChatMode !== undefined ? sim.companionChatMode : params.companionChatMode || 'natural';
  const effectiveStyleOverride =
    sim?.chatStyleOverride !== undefined ? sim.chatStyleOverride : params.chatStyleOverride || null;

  const { userDefaultProfile, bond } = buildSimulatedProfileAndBond(
    sim,
    params.contextMode,
    effectiveCallName,
    params.preset.slug
  );

  const built = await buildCompanionSystemPromptAsync({
    preset: params.preset,
    persona: null,
    languageSlug: effectiveLanguage,
    preferredCallName: effectiveCallName,
    turnCount: resolvedHistory.length,
    bond,
    userDefaultProfile,
    userPrompt: resolvedPrompt,
    historyMessages: resolvedHistory,
    companionChatMode: effectiveCue,
    chatStyleOverride: effectiveStyleOverride,
    referrableCompanions: params.referrableCompanions,
    clientLocalHour: sim?.clientLocalHour ?? null,
  });

  const v2 = ensureCompanionV2Initialized(params.preset);
  const runtime = await getResolvedOpenRouterRuntime().catch(() => null);
  const modelUsed =
    built.modelOverride || runtime?.consultationModel || 'google/gemini-2.5-flash';
  const openrouterConfigured = await isOpenRouterConfiguredAsync().catch(() => false);

  const manifestWithFull: CompanionAssemblyManifest = {
    ...built.assemblyManifest,
    fullAssembledPrompt: built.systemInstruction,
  };

  const hasChartData = Boolean(
    userDefaultProfile.chart_json || userDefaultProfile.chart_text_context?.trim()
  );
  const verifiedTurn = resolvedPrompt
    ? applyCompanionTurnVerification({
        userText: resolvedPrompt,
        verificationMode: built.verificationMode,
        capabilities: built.capabilities,
        invitedEsoteric: built.invitedEsoteric,
        hasChartData,
        engineOverrides: built.engineOverrides,
      })
    : { userText: '', appliedMode: 'skipped' as const };

  const result: CompanionSandboxResult = {
    companionSlug: params.preset.slug,
    companionName: params.preset.name,
    assembledSystemPrompt: built.systemInstruction,
    chatStyle: built.chatStyle,
    modelUsed,
    invitedEsoteric: built.invitedEsoteric,
    verificationMode: built.verificationMode,
    appliedVerificationMode: verifiedTurn.appliedMode,
    temperatureUsed: built.temperature,
    ...(resolvedPrompt ? { verifiedUserPrompt: verifiedTurn.userText } : {}),
    openrouterConfigured,
    assemblyManifest: manifestWithFull,
    tarotSpread: built.tarotSpread || null,
    tokenBreakdown: {
      totalEstimatedTokens: built.assemblyManifest.totalEstimatedTokens,
      capsuleEstimatedTokens: estimateTokensRough(v2.core_identity_capsule || ''),
      characterChars: built.systemInstruction.length,
      sectionsCount: built.assemblyManifest.layersLoaded.length,
    },
  };

  if (params.runLiveModel && resolvedPrompt) {
    if (!openrouterConfigured) {
      if (params.gracefulMissingKey) {
        result.liveModelError =
          'OpenRouter API key is not configured in this environment. Prompt assembly & gating inspection succeeded — add OPENROUTER_API_KEY to run live model replies.';
        return result;
      }
      throw new Error('OpenRouter API key is not configured yet for live test completions.');
    }
    const startedAt = Date.now();
    const completion = await createOpenRouterCompletion({
      model: modelUsed,
      system: built.systemInstruction,
      messages: [
        ...resolvedHistory.slice(-12),
        { role: 'user', content: verifiedTurn.userText },
      ],
      maxTokens: Math.min(1800, built.capabilities.max_output_tokens || 1200),
      temperature: built.temperature,
    });
    result.replyText = completion.text;
    result.parsedReply = parseCompanionReplyPreview(completion.text);
    result.latencyMs = Date.now() - startedAt;
    result.usage = {
      promptTokens: completion.tokensIn,
      completionTokens: completion.tokensOut,
    };
  }

  return result;
}

export const runCompanionStudioTestTurn = runCompanionSandboxTest;


