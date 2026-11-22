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
  aira: [
    'Just hanging out while making tea',
    'Today felt weirdly heavy — soften the mood?',
    'Tell me something small and comforting',
    'Can we just talk about nothing for 5 minutes?',
  ],
  kira: [
    'Need a gentle distraction for a few minutes',
    'Just unwinding after a long day',
    'Can we talk about nothing heavy right now?',
  ],
  mira: [
    'Just hanging out while making tea',
    'Today felt weirdly flat',
    'Can we talk about nothing for a bit?',
    'I just need quiet company right now',
  ],
  aniya: [
    'My head feels crowded — just need someone to listen',
    'Rough day, not looking for advice yet',
    'Just sitting here quietly for a minute',
  ],
  anya: [
    'Today felt strangely quiet and lonely',
    'Tell me something calm',
    'Just sitting with my thoughts — keep me company?',
  ],
  camila: [
    'Missing home a little tonight',
    'Just decompressing after work',
    'Can we hang out and talk about ordinary stuff?',
  ],
  elia: [
    'Brain will not slow down tonight',
    'Just trying to breathe and decompress',
    'Can we talk about nothing complicated?',
  ],
  max: [
    'Half venting, half hanging out',
    'Give me honest perspective — I am procrastinating',
    'Rough week, need steady company',
  ],
  kabir: [
    'Long day — hang out for a bit?',
    'Need a straight-talking friend for 5 minutes',
    'Just talking through random thoughts',
  ],
  leo: [
    'Feeling stuck in low gear today',
    'Help me get a tiny bit of momentum',
    'Just hanging out before I tackle my evening',
  ],
  mateo: [
    'Just decompressing over coffee/tea',
    'Tell me a calmer way to look at today',
    'Can we talk about life in general for a minute?',
  ],
  tara: [
    'Rough week — just need calm company',
    'Just hanging out while making tea',
    'Why does everything feel weirdly slow lately?',
  ],
  sofia: [
    'Just need warm company tonight',
    'Tell me something calm and grounding',
    'Wait — is anything weird going on in my chart lately?',
  ],
  luna_grey: [
    'Just hanging out — mind feels noisy',
    'Trying to make sense of a relationship dynamic',
    'Could my timing be shifting right now?',
  ],
  marc: [
    'Having a quiet coffee — hang out for a bit?',
    'Work has felt heavy this week',
    'What kind of phase does this week feel like?',
  ],
  dev: [
    'Need grounded perspective without sugarcoating',
    'Rough day — help me step back cleanly',
    'Can you glance at my career timing for a second?',
  ],
  valeria: [
    'Feeling pulled in ten directions today',
    'Just need calm, clear company',
    'What feels worth focusing on this month?',
  ],
  rohan: [
    'Feeling tired and in my own head',
    'Just hanging out after work',
    'Does anything in my chart explain this restless energy?',
  ],
  bella: [
    'Just hanging out — pull a gentle reflection card?',
    'My intuition feels foggy today',
    'Can we just talk calmly for a minute?',
  ],
  kai: [
    'Just checking in on an ordinary day',
    'Curious what today’s energy feels like by the numbers',
    'Can we talk about nothing heavy first?',
  ],
  aura: [
    'Tell me something calm',
    'Just sitting with a quiet thought tonight',
    'Why do certain feelings keep coming back?',
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
