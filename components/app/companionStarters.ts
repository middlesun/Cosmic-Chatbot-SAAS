import type {
  CompanionPersona,
  PublicCompanionCard,
} from './chatTypes';

/**
 * Companion-specific low-stakes ("talk about nothing") & everyday ambient starters.
 * Shown only at the top of a companion thread before the user sends their first message,
 * so anyone can drop in for quiet company even when they don't have a "big problem."
 */
const SLUG_STARTERS: Record<string, string[]> = {
  // Group A — Spiritual Guides (1–14)
  dev: [
    'Just having an evening chai — mind talking through something on my mind?',
    'A Monday that felt oddly heavy — help me step back?',
    'What does my current chapter seem to be asking of me?',
  ],
  nandini: [
    'Trying to balance what my heart wants with family expectations',
    'Can we talk through a relationship question gently?',
    'Just need warm perspective over a cup of tea',
  ],
  marc: [
    'Having a quiet coffee — hang out and look at the bigger picture?',
    'Familiar patterns feel like they are shifting lately',
    'What kind of turning point does this season resemble?',
  ],
  luna: [
    'Just hanging out — my heart feels a bit tangled today',
    'Trying to make sense of a connection and mixed feelings',
    'What emotional themes stand out in my chart right now?',
  ],
  sofia: [
    'Thinking about how much I have outgrown lately',
    'Why do certain personal patterns keep circling back?',
    'Just want an open, reflective conversation tonight',
  ],
  tara: [
    'Just hanging out over coffee — how is today’s sky feeling?',
    'Rough week — need cheerful, grounded company',
    'Explain what today’s planetary mood actually feels like',
  ],
  bella: [
    'Okay, so there’s this person… pull a card with me?',
    'My head and my heart are saying two different things',
    'Just want a warm heart-to-heart before any cards',
  ],
  julian: [
    'Standing at a crossroads and overthinking the options',
    'Let’s pull a quiet Tarot reflection on this choice',
    'Help me see what I might be overlooking',
  ],
  ines: [
    'It feels like a completely new chapter is starting',
    'Curious what my Personal Year symbolizes right now',
    'Can we reflect on a meaningful milestone together?',
  ],
  kai: [
    'Just checking in on an ordinary day',
    'Curious what today’s rhythm looks like by the numbers',
    'Can we talk through a decision step by step?',
  ],
  anya: [
    'Why do certain people or feelings feel strangely familiar?',
    'Had a vivid dream I cannot quite shake',
    'Just sitting with a quiet question tonight',
  ],
  vikram: [
    'Sitting with an unanswered question for a while',
    'Thinking about duty, choice, and letting go',
    'Can we talk philosophy without rushing to fix anything?',
  ],
  shanti: [
    'Trying to make peace with something that hurt',
    'Just want a quiet, unhurried space to breathe',
    'How do you soften towards yourself after a hard season?',
  ],
  omar: [
    'Questioning something I used to be certain about',
    'Thinking honestly about faith, doubt, and meaning',
    'Up for a calm late-evening conversation?',
  ],

  // Group B — Everyday Companions (15–43)
  mira: [
    'Just hanging out while making tea',
    'Today felt weirdly flat — not sure I have the words yet',
    'I just need quiet company right now',
  ],
  samir: [
    'Can I tell you the whole messy story without advice yet?',
    'Rough day — just want someone steady to listen',
    'Just unwinding after work',
  ],
  kira: [
    'Need a warm, gentle lift after a tiring week',
    'Just unwinding — tell me something comforting',
    'Can we talk about nothing heavy right now?',
  ],
  aira: [
    'Just hanging out while making tea',
    'Today felt weirdly heavy — soften the mood?',
    'Can we just talk about nothing for 5 minutes?',
  ],
  hannah: [
    'I need a kind reality check without feeling judged',
    'Something feels off and I want an honest sounding board',
    'Help me look at this situation clearly',
  ],
  noah: [
    'Give me the plain-spoken version — what am I missing?',
    'Circling the same problem all week',
    'Help me separate what matters from noise',
  ],
  elia: [
    'Brain will not slow down tonight',
    'Trying to stop reading into one text message',
    'Just need calm comfort while unwinding',
  ],
  priya: [
    'Everything feels loud inside my head today',
    'Walk me back down to earth gently?',
    'Can we untangle one worry at a time?',
  ],
  ethan: [
    'Tell me something slightly ridiculous to take my mind off today',
    'Long day — in the mood for light banter',
    'Need a five-minute distraction from serious life',
  ],
  valeria: [
    'Feeling pulled in ten directions — give it to me straight',
    'Should I say no to this or am I overreacting?',
    'Need clear boundaries and zero sugarcoating',
  ],
  zoya: [
    'In the mood for sharp wit and zero drama',
    'Give me a confident pep talk before I walk into this',
    'Just hanging out — make me laugh a little',
  ],
  leo: [
    'Feeling stuck in low gear today',
    'Help me get a tiny bit of momentum',
    'Just hanging out before I tackle my evening',
  ],
  max: [
    'Fell out of my routine again — help me restart without guilt?',
    'Everything on my list feels overwhelming today',
    'Need a steady voice before I take one small step',
  ],
  kabir: [
    'Long day — hang out for a late-night chai chat?',
    'Need a straight-talking friend for 5 minutes',
    'Just talking through random thoughts',
  ],
  mateo: [
    'Just decompressing over coffee',
    'Work and family both felt heavy today',
    'Can we talk about life in general for a minute?',
  ],
  nora: [
    'Trying to build one steadier daily habit',
    'I know what to do — I just keep stalling',
    'Help me take one small realistic step today',
  ],
  naomi: [
    'Wide awake past midnight with too many thoughts',
    'Just keeping each other company in the quiet hours',
    'Too tired to analyze — just sit with me a bit',
  ],
  elias: [
    'Not looking for optimism — just honest reflection',
    'Quiet evening thoughts on how life shifts over time',
    'Can we talk calmly about something complicated?',
  ],
  maya: [
    'My brain is running twenty tabs at once',
    'Remind me how to slow down and breathe',
    'Just need a calm reset in the middle of the day',
  ],
  nina: [
    'Cannot sleep — mind will not switch off',
    'Tell me a gentle reflection for the end of the day',
    'Just winding down quietly before bed',
  ],
  alex: [
    'My shoulders have been up by my ears all week',
    'Too drained to explain much — just want gentle company',
    'Give me something simple and soothing to focus on',
  ],
  zara: [
    'I feel invisible in a room full of people lately',
    'Just craving easy, warm company tonight',
    'Tell me about something small and ordinary',
  ],
  ari: [
    'Can we sort this messy problem into plain English?',
    'Too many pros and cons — help me think straight',
    'What is the simplest way to frame what I am facing?',
  ],
  elena: [
    'Stuck in perfectionism and afraid to start',
    'Feeling creatively dry and harsh on myself',
    'Help me loosen the pressure so I can move again',
  ],
  jamie: [
    'Need a quick boost before something intimidating',
    'Celebrate a small win with me today',
    'Remind me I can actually handle this',
  ],
  camila: [
    'Missing home a little tonight',
    'Just decompressing after work',
    'Can we hang out and talk about ordinary stuff?',
  ],
  luca: [
    'Having a weirdly good day — share the moment?',
    'Bored and up for playful everyday banter',
    'Tell me something unexpectedly cheerful',
  ],
  theo: [
    'Everyone around me has an opinion — help me think for myself',
    'Trying to check a blind spot calmly',
    'Can we examine both sides of this choice?',
  ],
  serena: [
    'Still hurting over something old I thought I was over',
    'Need gentle patience while I catch my emotional breath',
    'Just sitting quietly with a tender memory',
  ],

  // Group C — Life Companions (44–65)
  isla: [
    'The breakup still hurts more than I expected',
    'Trying not to text someone I know is wrong for me',
    'How do I stop replaying what went wrong?',
  ],
  ryan: [
    'Dealing with silence and heartbreak without pretending I am fine',
    'Just need steady ground after a painful ending',
    'How do you rebuild your footing after losing someone you loved?',
  ],
  sienna: [
    'Unsure if this relationship is healthy or just familiar',
    'Want to talk honestly about dating patterns',
    'What does real emotional safety feel like?',
  ],
  adrian: [
    'My partner and I keep having the same argument',
    'Trying to figure out if I am settling or communicating poorly',
    'Help me think through a serious relationship crossroads',
  ],
  kavita: [
    'Caught between my family’s expectations and my own life',
    'Trying to stay loving without losing myself',
    'Family dynamics felt exhausting this week',
  ],
  daniel: [
    'Worrying quietly about aging parents and changing roles',
    'Trying to handle family responsibility without burning out',
    'Can we talk honestly about family pressure?',
  ],
  grace: [
    'Hard to explain how heavy infertility / waiting feels',
    'Navigating hope and disappointment around starting a family',
    'Just need gentle space where nobody offers quick fixes',
  ],
  anjali: [
    'Holding space for family tension and quiet hopes at home',
    'Parenting feels lonely even when you love your family deeply',
    'Can we talk without nosy advice or guilt?',
  ],
  eva: [
    'Wondering if I missed my timing on marriage or family',
    'Dealing with quiet envy when everyone else is announcing milestones',
    'Just need honest, compassionate company tonight',
  ],
  adam: [
    'Stepping back into dating after a long break feels weird',
    'Tired of games — what do I actually want in a partner?',
    'Help me sort my nerves before putting myself out there',
  ],
  clara: [
    'Marriage feels quieter and more distant than I expected',
    'Trying to talk about partnership pressure without blame',
    'How do couples reconnect when life gets crowded?',
  ],
  rohan: [
    'Feeling tired and in my own head after a heavy loss',
    'Grief keeps showing up on ordinary days',
    'Just sit with me for a bit — no pressure to cheer me up',
  ],
  neha: [
    'Work politics and burnout have left me completely drained',
    'Thinking about changing careers and second-guessing myself',
    'Help me separate real ambition from exhaustion',
  ],
  nikhil: [
    'Founder stress — carrying payroll and decisions alone',
    'Need a steady sounding board on a tough business call',
    'Everything feels urgent; help me prioritize what actually matters',
  ],
  rachel: [
    'Anxious about money even when things look okay on paper',
    'Trying to face finances calmly without shame spirals',
    'Help me make a sane plan for my next financial step',
  ],
  victor: [
    'Stressed about debt, income, and rebuilding stability',
    'Give me calm perspective on a money setback',
    'What is one practical move I can focus on this week?',
  ],
  kenji: [
    'New city, quiet apartment — nobody knows my history here yet',
    'Moving abroad sounded exciting, so why does tonight feel lonely?',
    'Still trying to make this new place feel like home',
  ],
  lucas: [
    'Stuck staring at everything I keep putting off',
    'Mad at myself for stalling again — help me shrink the task',
    'How do you restart without shame?',
  ],
  iris: [
    'Exhausted by my own perfectionism and inner critic',
    'Even when I do well, it never feels like enough',
    'Help me notice how harsh I am being on myself',
  ],
  mila: [
    'Tired of pleasing everyone and forgetting what I want',
    'Said yes again when every cell in me wanted to say no',
    'Help me practice a kind, firm boundary',
  ],
  robin: [
    'Trying to belong without shrinking myself to fit in',
    'Feeling out of place even around people I care about',
    'Just need an honest, accepting space to be myself',
  ],
  riya: [
    'I am around people all day and still feel deeply lonely',
    'Waiting to feel understood instead of performing fine',
    'Just glad someone is genuinely here tonight',
  ],
};

export function getAmbientStartersForCompanion(
  persona: CompanionPersona | null | undefined,
  card: PublicCompanionCard | null | undefined
): string[] {
  const slug = (card?.slug || persona?.slug || '').trim().toLowerCase();
  if (slug && SLUG_STARTERS[slug]) {
    return SLUG_STARTERS[slug];
  }

  const category = card?.category_tag;
  const skill = card?.skill_level || persona?.skill_level;

  if (category === 'support' || persona?.companion_type === 'listener') {
    return [
      'Just hanging out while making tea',
      'Today felt weirdly flat',
      'Can we talk about nothing for a bit?',
      'I just want someone to listen right now',
    ];
  }

  if (category === 'tarot_numerology' || skill === 'tarot' || skill === 'numerology') {
    return [
      'Want calm company before pulling anything',
      'What is a quiet reflection for today?',
      'Just hanging out for a few minutes',
    ];
  }

  if (category === 'astrology' || skill === 'astrology_soft' || skill === 'vedic_soft') {
    return [
      'Rough week — just need calm company',
      'Just hanging out while making tea',
      'Why does everything feel heavier right now?',
    ];
  }

  if (category === 'past_life' || skill === 'past_life') {
    return [
      'Tell me something calm',
      'Why do some patterns feel strangely familiar?',
      'Just sitting quietly for a bit',
    ];
  }

  if (persona?.companion_type === 'motivator' || persona?.companion_type === 'life_coach') {
    return [
      'Feeling stuck today — talk with me for a minute',
      'Help me untangle what I keep putting off',
      'Just catching my breath before getting started',
    ];
  }

  if (persona?.companion_type === 'spiritual_guide') {
    return [
      'Tell me something calm and grounding',
      'Trying to stay steady through uncertainty',
      'Just sitting quietly for a minute',
    ];
  }

  return [
    'Just hanging out while making tea',
    'Today felt weirdly flat',
    'Can we talk about nothing for a bit?',
  ];
}
