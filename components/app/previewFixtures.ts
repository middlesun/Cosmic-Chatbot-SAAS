import type { AppUser } from './AuthContext';
import type {
  ChatCatalog,
  ChatMessageRecord,
  ChatProfile,
  ConversationRecord,
  CustomPromptRecord,
  FavoriteMessageRecord,
} from './chatTypes';

export const PREVIEW_APP_USER: AppUser = {
  id: 'preview-user',
  email: 'preview@cosmiccouncil.pro',
  full_name: 'Observatory Preview',
  tier: 'pro',
  credits_balance: 14500,
  currency_pref: 'INR',
  default_expert: 'council_synthesis',
  default_output: 'detailed',
  default_language: 'English',
  default_astrology_mode: 'vedic',
  preferred_call_name: null,
  chat_font_size: 'base',
  suggestions_auto_expand: true,
  referral_code: 'CC-PREVIEW',
  referred_by: null,
  must_change_password: false,
  is_admin: true,
  account_status: 'active',
  created_at: '2026-01-15T08:00:00.000Z',
};

export const PREVIEW_CHAT_CATALOG: ChatCatalog = {
  experts: [
    {
      slug: 'council_synthesis',
      category: 'expert',
      displayName: 'Vedic Astrologer',
      subtitle: 'Complete Jyotish synthesis across Parashari, KP Sub-Lords, Jaimini, Nadi & Vargas.',
    },
    {
      slug: 'western_astrologer',
      category: 'expert',
      displayName: 'Western Astrologer',
      subtitle: 'Tropical Zodiac, Placidus houses, planetary aspects, progressions & transits.',
    },
    {
      slug: 'modern_astrologer',
      category: 'expert',
      displayName: 'Modern Astrologer',
      subtitle: 'Psychological & evolutionary astrology blending natal structure with grounded reflection.',
    },
    {
      slug: 'tarot_reader',
      category: 'expert',
      displayName: 'Tarot',
      subtitle: '78-card Rider-Waite symbolic spreads drawn fresh for clarity, timing & perspective.',
    },
    {
      slug: 'numerologist',
      category: 'expert',
      displayName: 'Numerology',
      subtitle: 'Pythagorean Life Path, Expression, Soul Urge & Personal Year cycle calculations.',
    },
    {
      slug: 'learn_astrology',
      category: 'expert',
      displayName: 'Learn Astrology',
      subtitle: 'Pedagogical breakdowns showing the Jyotish mechanics behind the reading.',
    },
  ],
  modes: [
    {
      slug: 'general',
      category: 'mode',
      displayName: 'General',
      subtitle: 'Open-ended Vedic guidance across any life topic.',
    },
    {
      slug: 'life',
      category: 'mode',
      displayName: 'Life & Dharma',
      subtitle: 'Holistic clarity on life path, timing cycles, and personal alignment.',
    },
    {
      slug: 'career',
      category: 'mode',
      displayName: 'Career & Vocation',
      subtitle: '10th house, D10 Dasamsa, AmK, 2/6/10/11 KP links & leadership timing.',
    },
    {
      slug: 'love',
      category: 'mode',
      displayName: 'Love & Romance',
      subtitle: '5th house, Venus/Moon, emotional resonance, attraction & compatibility.',
    },
    {
      slug: 'marriage',
      category: 'mode',
      displayName: 'Marriage & Partnership',
      subtitle: '7th house, D9 Navamsa, Jupiter/Venus, DK, longevity & timing windows.',
    },
    {
      slug: 'health',
      category: 'mode',
      displayName: 'Health & Vitality',
      subtitle: 'Lagna, 6th/8th/12th houses, constitution, stress cycles & preventive pacing.',
    },
    {
      slug: 'wealth',
      category: 'mode',
      displayName: 'Wealth & Assets',
      subtitle: '2nd/11th Dhana yogas, D2 Hora, 4th/9th assets, risk vs compounding.',
    },
  ],
  outputs: [
    {
      slug: 'detailed',
      category: 'output',
      displayName: 'Detailed Explanation',
      subtitle: 'Comprehensive observatory analysis with multi-factor reasoning & timing.',
    },
    {
      slug: 'concise',
      category: 'output',
      displayName: 'Concise Summary',
      subtitle: 'Crisp, high-signal answer in under 300 words.',
    },
    {
      slug: 'bullets',
      category: 'output',
      displayName: 'Structured Bullet Points',
      subtitle: 'Scannable tactical breakdown with clean lists and timing table.',
    },
  ],
  languages: [
    {
      slug: 'English',
      category: 'language',
      displayName: 'English',
      subtitle: 'Refined, natural modern English with Sanskrit Jyotish terms explained clearly.',
    },
    {
      slug: 'Hindi',
      category: 'language',
      displayName: 'Hindi',
      subtitle: 'शुद्ध, सहज और सटीक हिंदी में विस्तृत ज्योतिषीय मार्गदर्शन।',
    },
    {
      slug: 'Hinglish',
      category: 'language',
      displayName: 'Hinglish',
      subtitle: 'Conversational Roman Hindi + English for effortless everyday clarity.',
    },
  ],
  tools: [
    {
      slug: 'question_generator',
      category: 'tool',
      displayName: 'Question Generator',
      subtitle: 'Crafts 5 high-impact questions tailored to this profile & life domain.',
    },
    {
      slug: 'prompt_expander',
      category: 'tool',
      displayName: 'Prompt Expander',
      subtitle: 'Transforms a brief note into a rich, structured multi-angle inquiry.',
    },
    {
      slug: 'prompt_optimizer',
      category: 'tool',
      displayName: 'Prompt Optimizer',
      subtitle: 'Sharpens an existing draft prompt for maximum analytical precision.',
    },
  ],
};

export const PREVIEW_PROFILES: ChatProfile[] = [
  {
    id: 'preview-prof-1',
    name: 'Aarav Mehta (Sample)',
    short_name: 'Aarav',
    is_default: true,
    birth_date: '1992-08-14',
    birth_city: 'Mumbai',
    birth_country: 'India',
    current_city: 'Bengaluru',
    current_state: 'Karnataka',
    current_country: 'India',
    relationship: 'Self',
    is_activated: true,
    profile_memory_summary:
      'Virgo Lagna (Hasta Moon). Prior readings explored Saturn Mahadasha career pivot into advisory leadership and 10th-house D10 alignment.',
    life_context_json: {
      birth_time_accuracy: 'hospital_exact',
      relationship_status: 'single',
    },
    life_context_completeness: 60,
    natal_dossier_version: 1,
  },
];

export const PREVIEW_CONVERSATIONS: ConversationRecord[] = [
  {
    id: 'preview-conv-1',
    user_id: 'preview-user',
    profile_id: 'preview-prof-1',
    linked_report_id: null,
    title: 'Career Pivot Timing & D10 Alignment',
    mode_type: 'reading',
    pillar: 'council',
    is_active_tab: true,
    active_tab_order: 0,
    is_bookmarked: true,
    total_word_count: 340,
    use_full_profile_memory: true,
    ask_later_json: [
      {
        id: 'preview-ask-1',
        text: 'Cross-check independent consulting vs equity in D10 Dasamsa & KP 10th CSL',
        tier: 'deeper_analysis',
        technical_directive:
          'Inspect D10 Dasamsa 10th lord, 6th vs 7th house balance for independent consulting vs business partnerships, and verify KP 10th & 7th Cusp Sub-Lord significators.',
        source_message_id: 'preview-msg-2',
        saved_at: '2026-11-17T18:24:00.000Z',
      },
    ],
    updated_at: '2026-11-17T18:30:00.000Z',
    created_at: '2026-11-17T18:20:00.000Z',
  },
  {
    id: 'preview-conv-2',
    user_id: 'preview-user',
    profile_id: null,
    linked_report_id: null,
    title: 'Understanding KP 10th Cusp Sub-Lord',
    mode_type: 'learn_astrology',
    pillar: 'council',
    is_active_tab: false,
    active_tab_order: 1,
    is_bookmarked: false,
    total_word_count: 210,
    use_full_profile_memory: false,
    ask_later_json: [],
    updated_at: '2026-11-16T14:10:00.000Z',
    created_at: '2026-11-16T14:00:00.000Z',
  },
  {
    id: 'preview-conv-companion-1',
    user_id: 'preview-user',
    profile_id: null,
    linked_report_id: null,
    title: 'Nadia · Career Crossroads Decompression',
    mode_type: 'reading',
    pillar: 'companion',
    is_active_tab: true,
    active_tab_order: 1,
    companion_type: 'listener',
    companion_persona_json: {
      id: 'preview-nadia',
      name: 'Nadia',
      age: 31,
      gender: 'F',
      companion_type: 'listener',
      role_label: 'Thoughtful Confidante',
      background: 'Architectural lighting designer · Calm, observant, dry humor',
      tagline: 'Sees through noise quickly without making you feel judged.',
      bio: 'Nadia spent years renovating old libraries and notices the quiet details most people rush past. She listens closely, asks the one question you have been avoiding, and keeps things grounded.',
      conversation_style: 'Warm, observant, gently candid when you are overthinking',
      opening_message:
        'Hey — glad you dropped in. No need to package it neatly; what has been sitting in the back of your head today?',
      system_prompt: '',
      topic_context: 'Career crossroads and decision fatigue',
    },
    is_bookmarked: false,
    total_word_count: 112,
    use_full_profile_memory: true,
    ask_later_json: [],
    last_message_preview:
      'That kind of late-night looping is exhausting — especially when you have already done the hard thinking and your head still will not clock out.',
    updated_at: '2026-11-17T17:15:00.000Z',
    created_at: '2026-11-17T17:00:00.000Z',
  },
];

export const PREVIEW_MESSAGES: Record<string, ChatMessageRecord[]> = {
  'preview-conv-1': [
    {
      id: 'preview-msg-1',
      conversation_id: 'preview-conv-1',
      parent_message_id: null,
      role: 'user',
      content:
        'Should I accept the independent strategy advisory role over the next 6 months, or wait for the Antardasha shift?',
      word_count: 19,
      expert_used: null,
      mode_used: null,
      output_format_used: null,
      language_used: null,
      is_starred: false,
      excluded_from_context: false,
      followups_json: [],
      created_at: '2026-11-17T18:22:00.000Z',
    },
    {
      id: 'preview-msg-2',
      conversation_id: 'preview-conv-1',
      parent_message_id: null,
      role: 'assistant',
      content: `### 1. Executive Synthesis
Your **10th House and D10 Dasamsa** strongly favor structured autonomy over rigid corporate hierarchy during the upcoming transition window. Across Parashari, KP, and Jaimini checks, entering an advisory mandate is structurally supported—provided contractual retainers are locked before Mercury enters brief combustion.

### 2. Multi-System Planetary Evidence
| System | Anchor Placement | Key Signal |
| :--- | :--- | :--- |
| **Parashari (D1 & D10)** | 10th Lord Mercury in 11th (Leo, Magha) | Gains through strategic counsel & executive networks |
| **KP Placidus** | 10th Cusp Sub-Lord Jupiter | Signifies houses **2, 6, 10, 11** cleanly without 8/12 obstruction |
| **Jaimini** | Amatyakaraka (AmK) Saturn in Capricorn (5H) | High endurance, methodical institutional authority |

### 3. Timing Window & Strategic Counsel
- **Primary Alignment Window:** Active **Jupiter Antardasha** coupled with Jupiter transiting your 10th house from Lagna brings elevated visibility and higher-trust mandates.
- **Practical Move:** Use the next 45 days to negotiate scope and milestone clarity while avoiding verbal-only commitments.`,
      word_count: 158,
      expert_used: 'council_synthesis',
      mode_used: 'career',
      output_format_used: 'detailed',
      language_used: 'English',
      is_starred: true,
      excluded_from_context: false,
      followups_json: [
        'Which specific months carry the strongest income inflow next year?',
        'What practical terms should I negotiate before signing the advisory contract?',
        'How will this shift affect my work-life balance and stress levels?',
        'Would working with international clients open stronger growth?',
      ],
      suggestions_json: {
        followups: [
          {
            id: 'pf_1',
            text: 'Which specific months carry the strongest income inflow next year?',
          },
          {
            id: 'pf_2',
            text: 'What practical terms should I negotiate before signing the advisory contract?',
          },
          {
            id: 'pf_3',
            text: 'How will this shift affect my work-life balance and stress levels?',
          },
          {
            id: 'pf_4',
            text: 'Would working with international clients open stronger growth?',
          },
        ],
        deeper_analysis: [
          {
            id: 'pd_1',
            text: 'Cross-check independent consulting vs equity in D10 Dasamsa & KP 10th CSL',
            technical_directive:
              'Inspect D10 Dasamsa 10th lord, 6th vs 7th house balance for independent consulting vs business partnerships, and verify KP 10th & 7th Cusp Sub-Lord significators.',
          },
          {
            id: 'pd_2',
            text: 'Audit 2nd & 11th Dhana Yogas with Ashtakavarga transit bindus',
            technical_directive:
              'Evaluate natal 2nd and 11th house Dhana Yogas, Sarvashtakavarga (SAV) bindus for Gemini/Pisces transits, and Jupiter Bhinnashtakavarga over 10H and 11H.',
          },
          {
            id: 'pd_3',
            text: 'Inspect Amatyakaraka Saturn & Jaimini Karakamsha for long-term leadership',
            technical_directive:
              'Analyze Jaimini Amatyakaraka (AmK) Saturn in D1 and D9 Karakamsha, checking 10th from Karakamsha and Chara Dasha timing for institutional authority.',
          },
          {
            id: 'pd_4',
            text: 'Check Pratyantardasha transitions & Mercury combustion risk windows',
            technical_directive:
              'Break down upcoming Saturn-Jupiter Pratyantardasha sub-windows, Mercury transit speed/combustion dates, and 7th/8th house contractual friction triggers.',
          },
        ],
      },
      credits_charged: 120,
      created_at: '2026-11-17T18:22:18.000Z',
    },
  ],
  'preview-conv-2': [
    {
      id: 'preview-msg-3',
      conversation_id: 'preview-conv-2',
      parent_message_id: null,
      role: 'user',
      content: 'Why does the KP 10th Cusp Sub-Lord override the Rashi 10th house planet?',
      word_count: 13,
      expert_used: null,
      mode_used: null,
      output_format_used: null,
      language_used: null,
      is_starred: false,
      excluded_from_context: false,
      followups_json: [],
      created_at: '2026-11-16T14:05:00.000Z',
    },
    {
      id: 'preview-msg-4',
      conversation_id: 'preview-conv-2',
      parent_message_id: null,
      role: 'assistant',
      content: `### Why the Sub-Lord Decides the Outcome in KP Astrology
In **Krishnamurti Paddhati (KP)**, the Rashi sign and Nakshatra set the broad environment, while the **Cusp Sub-Lord (CSL)** acts as the final deciding officer on whether a house's promise manifests.

- **Planet (Level 1):** Shows the general domain or source.
- **Nakshatra Lord (Level 2):** Delivers the actual houses where results land.
- **Sub-Lord (Level 3):** Certifies approval (**2, 6, 10, 11** for profession) or denial/delay (**5, 8, 12**).

> Think of the Rashi lord as the building, the Star lord as the department, and the Sub-Lord as the final signature on the decision.`,
      word_count: 102,
      expert_used: 'council_synthesis',
      mode_used: 'learn_astrology',
      output_format_used: 'detailed',
      language_used: 'English',
      is_starred: false,
      excluded_from_context: false,
      followups_json: [
        'Walk me through an example of 2-7-11 vs 1-6-10 in marriage timing',
        'How are ABCD significator levels prioritized in KP?',
        'Can a debilitated planet still give strong career results in KP?',
      ],
      suggestions_json: {
        followups: [
          {
            id: 'pf_2_1',
            text: 'Walk me through an example of 2-7-11 vs 1-6-10 in marriage timing',
          },
          {
            id: 'pf_2_2',
            text: 'How are ABCD significator levels prioritized in KP?',
          },
          {
            id: 'pf_2_3',
            text: 'Can a debilitated planet still give strong career results in KP?',
          },
        ],
        deeper_analysis: [
          {
            id: 'pd_2_1',
            text: 'Compare KP Placidus house cusps against Parashari Whole Sign bhavas',
            technical_directive:
              'Provide a technical comparative walkthrough showing how unequal Placidus cusps shift house lordships versus Parashari Equal/Whole Sign houses with a concrete degree example.',
          },
          {
            id: 'pd_2_2',
            text: 'Explain Ruling Planets (RP) confirmation for exact event timing',
            technical_directive:
              'Explain KP Ruling Planets (Lagna Lord, Lagna Star Lord, Moon Sign/Star Lord, Day Lord) and how astrologers verify Dasha-Bhukti-Antara fructification.',
          },
        ],
      },
      credits_charged: 85,
      created_at: '2026-11-16T14:05:15.000Z',
    },
  ],
  'preview-conv-companion-1': [
    {
      id: 'preview-comp-msg-1',
      conversation_id: 'preview-conv-companion-1',
      parent_message_id: null,
      role: 'assistant',
      content:
        'Hey — glad you dropped in. No need to package it neatly; what has been sitting in the back of your head today?',
      word_count: 22,
      expert_used: 'companion:listener',
      mode_used: 'listener',
      output_format_used: 'conversational',
      language_used: 'English',
      is_starred: false,
      excluded_from_context: false,
      followups_json: [],
      created_at: '2026-11-17T17:00:00.000Z',
    },
    {
      id: 'preview-comp-msg-2',
      conversation_id: 'preview-conv-companion-1',
      parent_message_id: null,
      role: 'user',
      content:
        'Honestly I know the advisory role makes sense on paper, I am just tired of second-guessing myself every night.',
      word_count: 20,
      expert_used: null,
      mode_used: null,
      output_format_used: null,
      language_used: null,
      is_starred: false,
      excluded_from_context: false,
      followups_json: [],
      created_at: '2026-11-17T17:04:00.000Z',
    },
    {
      id: 'preview-comp-msg-3',
      conversation_id: 'preview-conv-companion-1',
      parent_message_id: null,
      role: 'assistant',
      content:
        'That kind of late-night looping is exhausting — especially when you have already done the hard thinking and your head still will not clock out.\n\nCan I ask something candid? When you picture turning the role down instead, do you feel relieved, or do you feel a quiet pang of regret?',
      word_count: 50,
      expert_used: 'companion:listener',
      mode_used: 'listener',
      output_format_used: 'conversational',
      language_used: 'English',
      is_starred: false,
      excluded_from_context: false,
      followups_json: [],
      created_at: '2026-11-17T17:05:10.000Z',
    },
  ],
};

export const PREVIEW_CUSTOM_PROMPTS: CustomPromptRecord[] = [
  {
    id: 'preview-cp-1',
    user_id: 'preview-user',
    title: 'Annual Career & Wealth Audit',
    prompt_text:
      'Cross-check my D1, D9, and D10 with current Mahadasha/Antardasha and Jupiter/Saturn Gochar for career trajectory and capital decisions over the next 12 months.',
    created_at: '2026-11-10T10:00:00.000Z',
  },
];

export const PREVIEW_FAVORITES: FavoriteMessageRecord[] = [
  {
    ...PREVIEW_MESSAGES['preview-conv-1'][1],
    conversation_title: 'Career Pivot Timing & D10 Alignment',
    profile_id: 'preview-prof-1',
  },
];

export const PREVIEW_RADAR_SNAPSHOT = {
  profileId: 'preview-prof-1',
  profileName: 'Aarav Mehta (Sample)',
  ascendantSign: 'Virgo',
  moonSign: 'Virgo (Hasta)',
  dashaLadder: [
    {
      level: 'Mahadasha' as const,
      lord: 'Saturn',
      startDate: '2018-04-10',
      endDate: '2037-04-10',
      percentElapsed: 45,
      daysRemaining: 3796,
    },
    {
      level: 'Antardasha' as const,
      lord: 'Jupiter',
      startDate: '2025-11-04',
      endDate: '2028-05-17',
      percentElapsed: 41,
      daysRemaining: 547,
    },
    {
      level: 'Pratyantardasha' as const,
      lord: 'Mercury',
      startDate: '2026-09-20',
      endDate: '2027-01-28',
      percentElapsed: 58,
      daysRemaining: 72,
    },
  ],
  upcomingShift: {
    type: 'Pratyantardasha' as const,
    fromLord: 'Mercury',
    toLord: 'Ketu',
    transitionDate: '2027-01-28',
  },
  transitsDate: '2026-11-17',
  slowPlanetShifts: [
    {
      planet: 'Jupiter',
      sign: 'Gemini',
      dms: '18°42′',
      nakshatra: 'Ardra',
      isRetrograde: true,
      houseFromLagna: 10,
      houseFromMoon: 10,
      savBindus: 33,
      signal: 'supportive' as const,
      note: 'Expands visible 10th-house authority & advisory opportunities (SAV 33).',
    },
    {
      planet: 'Saturn',
      sign: 'Pisces',
      dms: '11°09′',
      nakshatra: 'Uttara Bhadrapada',
      isRetrograde: false,
      houseFromLagna: 7,
      houseFromMoon: 7,
      savBindus: 29,
      signal: 'neutral' as const,
      note: 'Demands clear written commitments & patient partnership pacing.',
    },
    {
      planet: 'Rahu',
      sign: 'Aquarius',
      dms: '24°15′',
      nakshatra: 'Purva Bhadrapada',
      isRetrograde: true,
      houseFromLagna: 6,
      houseFromMoon: 6,
      savBindus: 31,
      signal: 'supportive' as const,
      note: 'Sharpens competitive edge & problem-solving execution.',
    },
  ],
  convergenceWindows: [
    {
      label: 'Advisory Mandate Alignment',
      windowRange: 'Nov 2026 – Jan 2027',
      focusDomain: 'Career & Leadership',
      intensity: 'Peak Alignment' as const,
      drivers: 'Saturn–Jupiter–Mercury Dasha + Jupiter 10H Gochar (33 SAV)',
    },
    {
      label: 'Contractual & Partner Review',
      windowRange: 'Feb 2027 – Apr 2027',
      focusDomain: 'Agreements & Partnerships',
      intensity: 'Steady Consolidation' as const,
      drivers: 'Ketu PD inward recalibration + Saturn 7H aspect',
    },
  ],
  dailyBrief: {
    date: '2026-11-17',
    headline: 'High Clarity for Strategic Decisions & Negotiations',
    guidance:
      'Mercury Pratyantardasha aligns cleanly with Jupiter in your 10th house. Prioritize structured writing, executive outreach, and transparent milestone terms.',
    focusAction: 'Finalize priority project scope before evening moon shift.',
  },
  monthlyBrief: {
    month: 'November 2026',
    headline: 'Consolidation Across Vocation & Key Alliances',
    guidance:
      'Saturn and Jupiter emphasize durable credibility over rushed expansion. Steady follow-through compounds reputation through Q1.',
    themeWatch: 'Balance strategic visibility with quiet mental recovery.',
  },
  transitsAvailable: true,
};
