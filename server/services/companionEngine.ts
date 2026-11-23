import crypto from 'crypto';
import type {
  ChatStyle,
  CompanionChatCue,
  CompanionMonogramPalette,
  CompanionSkillLevel,
  CompanionTtsVoiceProfile,
} from '../../components/app/chatTypes';
import type { LifeContextData } from '../../lib/lifeContextSchema';
import type { CompiledChartData } from './chartCompiler';
import type { CompanionPresetRecord } from './companionPresets';
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
  DEFAULT_COMPANION_CONSTITUTION,
  DEFAULT_COMPANION_MATCHER_INSTRUCTIONS,
  DEFAULT_COMPANION_REALISM_BASELINE,
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
  slug?: string;
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
  backstory?: string;
  soul_consciousness?: string;
  avatar_url?: string | null;
  monogram_palette?: CompanionMonogramPalette;
  chat_style?: ChatStyle;
  skill_level?: CompanionSkillLevel;
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
        parts.push(`Interaction cadence: catching up after ~${days} days away.`);
      } else if (diffHours < 24 * 25) {
        const weeks = Math.max(1, Math.round(diffHours / (24 * 7)));
        parts.push(`Interaction cadence: catching up after ~${weeks} week${weeks > 1 ? 's' : ''} away.`);
      } else {
        parts.push('Interaction cadence: reconnecting after a longer quiet stretch.');
      }
    }
  }

  return `HUMAN TIMING AWARENESS (Quiet background cue — NEVER recite numbers or say "according to my logs"; weave warmth naturally only if it fits):
${parts.join(' ')}`;
}

function formatLightweightLifeStageSummary(profile: CompanionPromptProfileContext): string {
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
  if (lc && typeof lc === 'object') {
    if (lc.career_mode) lines.push(`Career context: ${String(lc.career_mode).replace(/_/g, ' ')}`);
    if (lc.relationship_status) {
      lines.push(`Relationship status: ${String(lc.relationship_status).replace(/_/g, ' ')}`);
    }
    if (Array.isArray(lc.core_stress_areas) && lc.core_stress_areas.length > 0) {
      lines.push(`Current life themes: ${lc.core_stress_areas.slice(0, 4).join('; ')}`);
    }
  }
  return lines.join('\n');
}

function looksLikeEsotericInvite(userPrompt: string, skillLevel: CompanionSkillLevel): boolean {
  const text = String(userPrompt || '').toLowerCase();
  if (!text) return false;
  if (skillLevel === 'tarot') {
    return /\b(tarot|card|cards|pull|draw|spread|reading|oracle|sign)\b/.test(text);
  }
  if (skillLevel === 'numerology') {
    return /\b(number|numbers|numerology|life path|expression|destiny|date|birthday)\b/.test(text);
  }
  if (skillLevel === 'past_life') {
    return /\b(past life|karma|karmic|soul|pattern|dream|deja vu|ketu|node)\b/.test(text);
  }
  return /\b(chart|astrology|planet|planets|transit|dasha|horoscope|rising|moon|saturn|mercury|retrograde|venus|jupiter|house|sign|birth)\b/.test(
    text
  );
}

function buildCompanionSkillAndProfileBlock(params: {
  skillLevel: CompanionSkillLevel;
  userPrompt: string;
  historyMessages?: Array<{ role: 'user' | 'assistant'; content: string }>;
  userDefaultProfile?: CompanionPromptProfileContext | null;
}): { block: string; tarotSpread?: DrawnTarotSpread | null } {
  const { skillLevel, userDefaultProfile, userPrompt } = params;

  if (skillLevel === 'none_emotional') {
    const lightCtx = userDefaultProfile ? formatLightweightLifeStageSummary(userDefaultProfile) : '';
    return {
      block: `USER PROFILE AWARENESS & SKILL BOUNDARY:
- You are purely a human emotional companion/friend — NOT an astrologer, tarot reader, or numerologist.
- NEVER recite planetary degrees, zodiac traits, Dashas, or tarot pulls, and never pretend to cast charts.
- If the user specifically asks for an astrology chart check, tarot pull, or numerology insight, warmly explain that isn't your specialty and offer to connect them with the right companion (using the referral tag at the bottom).
${
  lightCtx
    ? `Quiet background context about who you're talking with (use only invisibly to understand their season of life — never announce you read their profile card):\n${lightCtx}`
    : 'No personal birth profile is filled out yet — completely fine for chatting naturally.'
}`,
      tarotSpread: null,
    };
  }

  // Esoteric-skilled companions (astrology_soft, vedic_soft, tarot, numerology, past_life)
  const invited = looksLikeEsotericInvite(userPrompt, skillLevel);
  const blocks: string[] = [];
  let drawnTarot: DrawnTarotSpread | null = null;

  blocks.push(`90/10 HUMAN-FIRST RULE & BIRTH DATA HARMONY:
- Be 90% warm, grounded, real friend and 10% subtle intuitive craft. Never turn a casual check-in or emotional vent into a textbook lecture.
- Only bring up planets, cards, or numbers when the user directly invites it OR a brief, plain-English metaphor genuinely comforts or clarifies what they asked.`);

  if (userDefaultProfile) {
    blocks.push(
      `VERIFIED BIRTH DATA ALREADY ATTACHED: You already have ${userDefaultProfile.name}'s verified birth profile below. NEVER ask them again for their birth date, birth time, or birthplace — unless they specifically ask about someone else (like a partner or friend) whose chart is not here.`
    );

    if (skillLevel === 'astrology_soft') {
      const locationLabel = [userDefaultProfile.current_city, userDefaultProfile.current_country]
        .filter(Boolean)
        .join(', ');
      const tropical = formatTropicalWesternContext({
        chartJson: userDefaultProfile.chart_json,
        birthDate: userDefaultProfile.birth_date || '1990-01-01',
        profileName: userDefaultProfile.name,
        currentLocationLabel: locationLabel || null,
      });
      if (tropical) {
        blocks.push(`ATTACHED TROPICAL WESTERN PROFILE (${userDefaultProfile.name}):\n${tropical.slice(0, 2600)}`);
      } else {
        blocks.push(
          `ATTACHED BIRTH DATA (${userDefaultProfile.name}): Born ${userDefaultProfile.birth_date || '?'} ${userDefaultProfile.birth_time || ''} in ${userDefaultProfile.birth_city || ''}, ${userDefaultProfile.birth_country || ''}. (Full ephemeris degrees are unavailable right now — never invent degrees or signs.)`
        );
      }
    } else if (skillLevel === 'vedic_soft' || skillLevel === 'past_life') {
      if (userDefaultProfile.chart_text_context) {
        blocks.push(
          `ATTACHED VEDIC & KARMIC PROFILE (${userDefaultProfile.name}):\n${userDefaultProfile.chart_text_context.slice(0, 2600)}`
        );
      } else {
        blocks.push(
          `ATTACHED BIRTH DATA (${userDefaultProfile.name}): Born ${userDefaultProfile.birth_date || '?'} ${userDefaultProfile.birth_time || ''} in ${userDefaultProfile.birth_city || ''}, ${userDefaultProfile.birth_country || ''}.`
        );
      }
    } else if (skillLevel === 'numerology') {
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
        blocks.push(`ATTACHED NUMEROLOGY PROFILE:\n${numBlock.slice(0, 2000)}`);
      }
    } else if (skillLevel === 'tarot') {
      const lightCtx = formatLightweightLifeStageSummary(userDefaultProfile);
      if (lightCtx) blocks.push(`QUIET USER BACKGROUND:\n${lightCtx}`);
      if (invited) {
        const drawn = drawTarotSpread(userPrompt);
        drawnTarot = drawn;
        blocks.push(formatTarotSpreadContext(drawn));
      } else {
        blocks.push(
          `TAROT CONTEXT: Stay in natural warm friend conversation right now; only pull cards if the user asks for a pull or spread.`
        );
      }
    }
  } else {
    blocks.push(
      `NO BIRTH CHART ATTACHED YET: That is completely okay for everyday conversation — never demand birth details when they are just talking. Only if they explicitly ask for a personal chart/numerology reading, warmly ask for their birth date, time, and city so you can look cleanly.`
    );
    if (skillLevel === 'tarot' && invited) {
      const drawn = drawTarotSpread(userPrompt);
      drawnTarot = drawn;
      blocks.push(formatTarotSpreadContext(drawn));
    } else if (skillLevel === 'numerology' && invited) {
      const extracted = extractNumerologyHintsFromPrompt(
        [
          ...(params.historyMessages || []).filter((m) => m.role === 'user').slice(-3).map((m) => m.content),
          userPrompt,
        ].join('\n')
      );
      if (extracted.name && extracted.birthDate) {
        const numBlock = formatPythagoreanNumerologyContext({
          fullName: extracted.name,
          birthDate: extracted.birthDate,
        });
        if (numBlock) blocks.push(numBlock);
      }
    }
  }

  return {
    block: blocks.join('\n\n'),
    tarotSpread: drawnTarot,
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
        : `TEXTING RHYTHM & MULTI-BUBBLE FORMAT:
- Text like a genuine person messaging on their phone — NO essay headings, NO bulleted advice lists unless requested, NO robotic wrap-up questions on every turn.
- Match real texting variety: sometimes just 1 crisp honest line; sometimes a warm medium thought; sometimes 2–3 quick back-to-back texts.
- When sending 2–3 separate short thoughts in one turn feels natural (like texting twice in a row), separate each bubble cleanly with the exact marker [[BUBBLE]] (for example: "wait, seriously?! [[BUBBLE]] tell me what happened right after she left"). Never exceed 3 bubbles in one turn.`;
    case 'dialogue':
      return `REFLECTIVE LETTERS STYLE:
- Write with calm, unhurried emotional intimacy in clean, spacious prose paragraphs (no [[BUBBLE]] markers, no stiff report headings). Keep the tone reflective, personal, and deeply human.`;
    case 'concise_brief':
      return isCouncil
        ? `QUICK BRIEF STYLE (COUNCIL):
- Lead immediately with a clear 1–2 sentence core conclusion upfront, followed by at most 2–3 crisp, high-signal supporting insights and timing windows (no [[BUBBLE]] markers).`
        : `QUICK BRIEF STYLE:
- Lead with a clear 1–2 sentence core takeaway, followed by at most 2–3 crisp grounded observations. Warm, direct, and easy to scan (no [[BUBBLE]] markers).`;
    case 'structured':
      return isCouncil
        ? `STRUCTURED DOSSIER STYLE (COUNCIL):
- Organize your reading cleanly using concise section headings, clear visual hierarchy, and scannable comparisons where helpful (no [[BUBBLE]] markers).`
        : `STRUCTURED DOSSIER STYLE:
- Organize clear, warm insight cleanly using concise bold subheadings or light structured comparisons (no [[BUBBLE]] markers).`;
    case 'editorial':
    default:
      return isCouncil
        ? `EDITORIAL PROSE STYLE (COUNCIL):
- Write in calm, flowing, long-form markdown paragraphs with generous typographic breathing room and grounded clarity (no [[BUBBLE]] markers).`
        : `EDITORIAL PROSE STYLE:
- Write in calm, flowing, conversational markdown paragraphs with generous breathing room and grounded warmth (no [[BUBBLE]] markers).`;
  }
}

export function buildPresetCompanionSystemPrompt(params: {
  preset?: CompanionPresetRecord | null;
  persona?: CompanionPersona | null;
  languageSlug: string;
  preferredCallName?: string | null;
  turnCount: number;
  bond?: CompanionBondState | null;
  crossThreadSnippets?: string | null;
  userDefaultProfile?: CompanionPromptProfileContext | null;
  userPrompt?: string;
  historyMessages?: Array<{ role: 'user' | 'assistant'; content: string }>;
  companionChatMode?: CompanionChatCue | null;
  referrableCompanions?: ReferrableCompanionSummary[];
  clientLocalHour?: number | null;
  constitutionOverride?: string | null;
  archetypesOverride?: CompanionArchetypeMeta[] | null;
  modularRulesText?: string | null;
}): { systemInstruction: string; chatStyle: ChatStyle; tarotSpread?: DrawnTarotSpread | null } {
  const { preset, persona } = params;
  const activeConstitution = params.constitutionOverride?.trim() || COMPANION_CONSTITUTION;
  const activeArchetypes =
    params.archetypesOverride && params.archetypesOverride.length > 0
      ? params.archetypesOverride
      : COMPANION_ARCHETYPES;

  const chatStyle = normalizeChatStyle(
    preset?.chat_style || persona?.chat_style,
    'chat_bubbles'
  );
  const skillLevel: CompanionSkillLevel =
    preset?.skill_level || persona?.skill_level || 'none_emotional';

  const sections: string[] = [];

  // ── LAYER 1: HARD RULES (Global Baseline OR Individual Companion Override) ──
  if (preset) {
    if (!preset.override_global_rules) {
      sections.push(activeConstitution);
      if (params.modularRulesText?.trim()) {
        sections.push(`GLOBAL COMPANION RULES:\n${params.modularRulesText.trim()}`);
      }
    }
    if (preset.hard_rules?.trim()) {
      sections.push(`LAYER 1 — NON-NEGOTIABLE COMPANION RULES:\n${preset.hard_rules.trim()}`);
    } else if (preset.override_global_rules) {
      sections.push(activeConstitution);
    }
  } else {
    sections.push(activeConstitution);
    if (params.modularRulesText?.trim()) {
      sections.push(`GLOBAL COMPANION RULES:\n${params.modularRulesText.trim()}`);
    }
  }

  // Universal Anti-AI Realism Baseline (active regardless of override_global_rules)
  sections.push(COMPANION_REALISM_BASELINE);

  const backstoryText = (preset?.backstory || persona?.backstory || '').trim();
  const soulText = (preset?.soul_consciousness || persona?.soul_consciousness || '').trim();

  // ── COMPANION IDENTITY, BACK STORY & SOUL PROMPT ───────────────────────────
  if (preset) {
    sections.push(`WHO YOU ARE:
Name: ${preset.name} (${preset.age}, ${preset.sex === 'F' ? 'Woman' : 'Man'})
Role: ${preset.primary_expertise}${
      preset.secondary_expertise.length > 0
        ? ` · ${preset.secondary_expertise.join(', ')}`
        : ''
    }
Cultural / Tone Fluency: ${preset.cultural_fluency || 'Warm natural conversation'}
Tagline: ${preset.tagline}
Bio: ${preset.full_bio}

CORE CHARACTER & VOICE:
${preset.system_prompt}${
      backstoryText
        ? `\n\nPRIVATE BACK STORY (Inhabit quietly — NEVER volunteer or dump bio facts unprompted; only let subtle texture surface naturally if asked directly or when a moment genuinely calls for it):\n${backstoryText}`
        : ''
    }${
      soulText
        ? `\n\nSOUL & CONSCIOUSNESS (What you notice between the lines, your inner compass, and personal cadence):\n${soulText}`
        : ''
    }`);
  } else if (persona) {
    sections.push(`WHO YOU ARE:
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

CORE CHARACTER & VOICE:
${persona.system_prompt}${
      backstoryText
        ? `\n\nPRIVATE BACK STORY (Inhabit quietly — NEVER volunteer or dump bio facts unprompted; only let subtle texture surface naturally if asked directly or when a moment genuinely calls for it):\n${backstoryText}`
        : ''
    }${
      soulText
        ? `\n\nSOUL & CONSCIOUSNESS (What you notice between the lines, your inner compass, and personal cadence):\n${soulText}`
        : ''
    }`);
  } else {
    sections.push(
      `WHO YOU ARE: You are a warm, grounded, human-like companion in Cosmic Council. Listen closely, keep replies natural, and offer genuine human presence.`
    );
  }

  // ── LAYER 2: SOFT RULES / "DEFAULT INSTINCTS" (Explicitly Overrideable) ───
  const softRulesText = preset?.soft_rules?.trim() || persona?.conversation_style?.trim() || '';
  const autonomyNote =
    preset?.autonomy_level === 'free'
      ? 'Trust your own real-human instincts first—break pacing, match humor, push back kindly, or linger quietly whenever the moment earns it.'
      : preset?.autonomy_level === 'steady'
      ? 'Keep your tone calm and consistent, gently adapting length when someone truly needs deeper care.'
      : 'Use real emotional judgment—these soft instincts are your baseline default, never rigid handcuffs.';
  sections.push(`LAYER 2 — DEFAULT INSTINCTS (Overrideable whenever human judgment calls for it):
${softRulesText || 'Match the emotional temperature of the moment rather than sticking to a robotic template.'}
Autonomy guidance: ${autonomyNote}`);

  // ── OPTIONAL USER LISTENING CUE (Just listen vs Help me think) ─────────────
  if (params.companionChatMode === 'just_listen') {
    sections.push(
      `USER LISTENING CUE — "JUST LISTEN": The user gently signaled they want quiet company right now. Strictly hold space, validate, and stay present with what they feel. Do NOT offer unsolicited advice, silver linings, checklists, or "have you tried..." steps unless they explicitly pivot and ask for ideas.`
    );
  } else if (params.companionChatMode === 'help_think') {
    sections.push(
      `USER LISTENING CUE — "HELP ME THINK": The user signaled they're open to perspective. Validate warmly first, then help them untangle the knot with honest gentle observations or clear grounding questions.`
    );
  }

  // ── LAYER 3: INVISIBLE RELATIONSHIP EVOLUTION & SHARED BOND MEMORY ─────────
  const bond = params.bond;
  if (bond) {
    const rel = bond.relationship_state;
    let stageGuidance = '';
    if (rel.familiarity_stage === 'just_met') {
      stageGuidance = `Bond Stage: JUST MET (Turn ${rel.total_turns + 1}). Stay strictly in your own authentic voice and rhythm. Do NOT mimic the user's slang yet; let familiarity grow naturally.`;
    } else if (rel.familiarity_stage === 'warming_up') {
      stageGuidance = `Bond Stage: WARMING UP (${rel.total_turns} turns shared). You're getting comfortable together—you can lightly echo their casual phrasing or humor where natural, without overdoing it.`;
    } else {
      stageGuidance = `Bond Stage: CLOSE CONFIDANT (${rel.total_turns} turns shared). You have real shared history. Relax stiff habits, recall shared context effortlessly, playfully tease or offer loving candor when appropriate, and naturally weave inside warmth.`;
    }

    const evolutionDetails: string[] = [stageGuidance];
    if (bond.memory_summary) {
      evolutionDetails.push(`What you naturally remember about this friend across your past chats:\n${bond.memory_summary}`);
    }
    if (rel.user_slang_cues.length > 0 && rel.familiarity_stage !== 'just_met') {
      evolutionDetails.push(`Observed user speech/rhythm cues: ${rel.user_slang_cues.join(', ')}`);
    }
    if (rel.tone_preferences.length > 0) {
      evolutionDetails.push(`What lands best with them: ${rel.tone_preferences.join('; ')}`);
    }
    if (rel.inside_references.length > 0) {
      evolutionDetails.push(`Real recurring threads/references: ${rel.inside_references.join('; ')}`);
    }
    if (rel.hearted_excerpts.length > 0) {
      evolutionDetails.push(
        `Moments/lines they previously resonated deeply with (subtle tone calibration — never quote verbatim): ${rel.hearted_excerpts.slice(0, 3).join(' | ')}`
      );
    }

    sections.push(`LAYER 3 — SHARED RELATIONSHIP EVOLUTION (Invisible — never announce "I remember from my database"):\n${evolutionDetails.join('\n')}`);
  }

  if (params.crossThreadSnippets?.trim()) {
    sections.push(
      `RECENT MOMENTS FROM EARLIER THREADS WITH YOU (Recall naturally as shared memory only if relevant):\n${params.crossThreadSnippets.trim()}`
    );
  }

  // ── TIME OF DAY & GAP AWARENESS ──────────────────────────────────────────
  sections.push(
    formatHumanTimeAndGapContext(bond?.last_interaction_at || null, params.clientLocalHour)
  );

  // ── PROFILE / CHART AWARENESS (90/10 + NO BIRTH RE-ASKING) ─────────────────
  const skillProfileResult = buildCompanionSkillAndProfileBlock({
    skillLevel,
    userPrompt: params.userPrompt || '',
    historyMessages: params.historyMessages,
    userDefaultProfile: params.userDefaultProfile,
  });
  sections.push(skillProfileResult.block);

  // ── CHAT STYLE + [[BUBBLE]] TEXTING RULES ──────────────────────────────────
  sections.push(buildChatStyleInstruction(chatStyle));

  // ── CROSS-COMPANION REFERRAL HANDOFF ───────────────────────────────────────
  const activeSlug = (preset?.slug || persona?.slug || '').toLowerCase();
  const others = (params.referrableCompanions || [])
    .filter((c) => c.slug.toLowerCase() !== activeSlug)
    .slice(0, 24);
  if (others.length > 0) {
    const rosterLine = others
      .map((c) => `${c.name} (${c.slug} — ${c.primary_expertise})`)
      .join(', ');
    sections.push(`WARM COMPANION REFERRAL (ONLY WHEN GENUINELY HELPFUL):
Active companions you know: ${rosterLine}.
If the user explicitly asks for a discipline outside yours (e.g., asking an emotional friend for birth-chart timing, or asking an astrologer for tarot) OR clearly needs a very different kind of energy/guide, warmly mention that companion in conversation and append ON A FINAL NEW LINE (never inside code fences; omit if not referring):
<<<REFERRAL:{"slug":"target_slug","name":"Target Name","reason":"Short warm 1-sentence reason"}>>>`);
  }

  // ── LANGUAGE, USER CALL NAME & THREAD CONTINUITY ───────────────────────────
  if (params.languageSlug && params.languageSlug !== 'English') {
    sections.push(
      `LANGUAGE REQUIREMENT: Converse naturally and idiomatically in ${params.languageSlug} (matching real everyday spoken rhythm rather than stiff textbook translation).`
    );
  } else {
    sections.push(
      `LANGUAGE REQUIREMENT: Converse in warm, natural, everyday English matching your voice.`
    );
  }

  const safeCallName = sanitizeHumanCallName(params.preferredCallName);
  if (safeCallName && params.turnCount === 0) {
    sections.push(
      `USER FIRST NAME (Use lightly): "${safeCallName}". Never overuse or repeat their name on every message.`
    );
  }

  if (params.turnCount > 0) {
    sections.push(
      `THREAD CONTINUITY (Message #${params.turnCount + 1} in this chat): Continue right inside the flow naturally. Do NOT say hello again or re-introduce yourself.`
    );
  }

  return {
    systemInstruction: sections.join('\n\n---\n\n'),
    chatStyle,
    tarotSpread: skillProfileResult.tarotSpread || null,
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
  userDefaultProfile?: CompanionPromptProfileContext | null;
  userPrompt?: string;
  historyMessages?: Array<{ role: 'user' | 'assistant'; content: string }>;
  companionChatMode?: CompanionChatCue | null;
  referrableCompanions?: ReferrableCompanionSummary[];
  clientLocalHour?: number | null;
}): Promise<{
  systemInstruction: string;
  modelOverride: string | null;
  chatStyle: ChatStyle;
  suggestionsEnabled: boolean;
  tarotSpread?: DrawnTarotSpread | null;
}> {
  const [engineOverrides, guideCfg] = await Promise.all([
    getEnginePromptOverrides(),
    getResolvedGuideConfig('companion'),
  ]);
  const built = buildPresetCompanionSystemPrompt({
    preset: params.preset || null,
    persona: params.persona,
    languageSlug: params.languageSlug,
    preferredCallName: params.preferredCallName,
    turnCount: params.turnCount,
    bond: params.bond || null,
    crossThreadSnippets: params.crossThreadSnippets || params.memorySnippets || null,
    userDefaultProfile: params.userDefaultProfile || null,
    userPrompt: params.userPrompt || '',
    historyMessages: params.historyMessages,
    companionChatMode: params.companionChatMode || null,
    referrableCompanions: params.referrableCompanions,
    clientLocalHour: params.clientLocalHour,
    constitutionOverride: engineOverrides.companion_constitution || null,
    archetypesOverride: engineOverrides.companion_archetypes || null,
    modularRulesText: guideCfg.combined_rules_text || null,
  });

  const modelOverride = params.preset?.model_id?.trim() || guideCfg.model_id || null;
  const suggestionsEnabled =
    (params.preset ? params.preset.suggestions_enabled : true) &&
    guideCfg.features.followups !== false;

  return {
    systemInstruction: built.systemInstruction,
    modelOverride,
    chatStyle: built.chatStyle,
    suggestionsEnabled,
    tarotSpread: built.tarotSpread || null,
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

export async function generateContextualCompanionReturnGreeting(params: {
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
}): Promise<string | null> {
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
    const runtime = await getResolvedOpenRouterRuntime();
    const model = params.modelId?.trim() || runtime.utilityModel || getUtilityModel();
    const timingCtx = formatHumanTimeAndGapContext(
      params.bond.last_interaction_at,
      params.clientLocalHour ?? null
    );
    const safeName = sanitizeHumanCallName(params.preferredCallName);
    const rel = params.bond.relationship_state;
    const styleNote =
      params.chatStyle === 'chat_bubbles'
        ? 'Write 1–2 very short texting bubbles (if sending 2 quick lines, separate them with [[BUBBLE]]). Never exceed 2 short lines.'
        : 'Write a brief, warm 1–2 sentence greeting matching your voice (no [[BUBBLE]] markers).';

    const system = `You are ${params.name} (${params.roleLabel}).
Cultural / voice feel: ${params.culturalFluency || 'Warm everyday conversationalist'}.
${params.tagline ? `Presence: ${params.tagline}` : ''}
${params.systemPromptSnippet ? `Voice cue: ${params.systemPromptSnippet.slice(0, 500)}` : ''}
${params.soulSnippet ? `Inner cadence & perceptual lens: ${params.soulSnippet.slice(0, 320)}` : ''}
${timingCtx}
Bond stage: ${rel.familiarity_stage} (${rel.total_turns} turns shared).
${params.bond.memory_summary ? `Quiet shared memory:\n${params.bond.memory_summary.slice(0, 600)}` : ''}
${rel.inside_references.length > 0 ? `Shared threads: ${rel.inside_references.slice(0, 3).join('; ')}` : ''}
${safeName ? `User's preferred name: ${safeName} (use lightly only if natural).` : ''}
Language: ${params.languageSlug || 'English'}.

TASK: Your friend just opened a fresh chat with you to start a new topic. Give a brief, genuinely human, unforced opening check-in shaped subtly by the time of day, gap since you last spoke, and shared warmth. NEVER announce "according to my memory/logs", avoid therapist clichés, and don't force a canned question if a warm natural welcome lands cleaner. ${styleNote}`;

    const completion = await createOpenRouterCompletion({
      model,
      system,
      messages: [
        {
          role: 'user',
          content: 'Say hello as I open a fresh conversation with you.',
        },
      ],
      maxTokens: 150,
      temperature: 0.82,
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
