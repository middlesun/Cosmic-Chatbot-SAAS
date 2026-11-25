import type { AppUser } from './AuthContext';
import type { CompiledChartJson, DailyTransitsPayload } from './ChartViewer';
import type {
  ChatCatalog,
  ChatMessageRecord,
  ChatProfile,
  ConversationRecord,
  CustomPromptRecord,
  FavoriteMessageRecord,
  PublicCompanionCard,
  UserMemorySnapshot,
} from './chatTypes';
import { computeAllVargasFromPlanets } from '../../lib/chartMetaAndVarga';

export const PREVIEW_APP_USER: AppUser = {
  id: 'preview-user',
  email: 'preview@cosmiccouncil.pro',
  full_name: 'Observatory Preview',
  tier: 'pro',
  credits_balance: 14500,
  currency_pref: 'INR',
  default_expert: 'vedic_astrologer',
  default_output: 'detailed',
  default_language: 'English',
  default_astrology_mode: 'vedic',
  preferred_call_name: null,
  chat_font_size: 'base',
  suggestions_auto_expand: true,
  user_context_preferences: {
    memory_paused: false,
    allow_cross_companion_memory: true,
  },
  timezone: 'Asia/Kolkata',
  proactive_opt_in: false,
  referral_code: 'CC-PREVIEW',
  referred_by: null,
  must_change_password: false,
  is_admin: false,
  account_status: 'active',
  created_at: '2026-01-15T08:00:00.000Z',
};

export const PREVIEW_CHAT_CATALOG: ChatCatalog = {
  experts: [
    {
      slug: 'vedic_astrologer',
      category: 'expert',
      displayName: 'Vedic Astrologer',
      subtitle: 'Complete Jyotish synthesis across Parashari, KP Sub-Lords, Jaimini, Nadi & Vargas.',
    },
    {
      slug: 'kp_precision',
      category: 'expert',
      displayName: 'KP Astrology',
      subtitle: 'Krishnamurti Paddhati cuspal Sub-Lords, house significator chains & Ruling Planets.',
    },
    {
      slug: 'jaimini',
      category: 'expert',
      displayName: 'Jaimini Jyotish',
      subtitle: 'Chara Karakas, Karakamsha, Arudha Padas, Argala & Chara Dasha timing.',
    },
    {
      slug: 'western_astrologer',
      category: 'expert',
      displayName: 'Western Astrologer',
      subtitle: 'Tropical Zodiac, Placidus houses, planetary aspects, progressions & transits.',
    },
    {
      slug: 'hellenistic_astrologer',
      category: 'expert',
      displayName: 'Hellenistic Astrologer',
      subtitle: 'Whole Sign houses, Sect, Hermetic Lots, Egyptian Bounds & Annual Profections.',
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
    title: 'Aira',
    mode_type: 'reading',
    pillar: 'companion',
    is_active_tab: true,
    active_tab_order: 1,
    companion_type: 'friend',
    companion_slug: 'aira',
    companion_chat_mode: 'natural',
    companion_persona_json: {
      id: 'preset_aira',
      slug: 'aira',
      name: 'Aira',
      age: 26,
      gender: 'F',
      companion_type: 'friend',
      role_label: 'Friend',
      background: 'Warm, playful friend who softens heavy days without dismissing feelings.',
      tagline: 'Bright, playful comfort that softens heavy days without dismissing feelings.',
      bio: 'A warm, playful friend who helps shift heavy emotional energy gently without lecturing or pushing advice.',
      conversation_style: 'Short natural texting lines, warmth first, gentle check-ins',
      opening_message:
        'Hey, I’m Aira. Tough day? We can talk—or just breathe together for a bit.',
      system_prompt: '',
      avatar_url: '/assets/companions/aira.jpg',
      monogram_palette: { bg: '#F1E3E6', ring: '#A36673', ink: '#4A252E' },
      chat_style: 'chat_bubbles',
      skill_level: 'none_emotional',
      tts_voice_profile: { rate: 1.04, pitch: 1.08 },
      supports_listening_cue: true,
      topic_context: 'Late-night second-guessing and decompression',
    },
    is_bookmarked: false,
    total_word_count: 112,
    use_full_profile_memory: true,
    ask_later_json: [],
    last_message_preview:
      'Want to just vent the annoying parts, or do you want a distraction for ten minutes?',
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
      expert_used: 'vedic_astrologer',
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
      expert_used: 'vedic_astrologer',
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
      content: 'Hey, I’m Aira. Tough day? We can talk—or just breathe together for a bit.',
      word_count: 16,
      expert_used: 'companion:aira',
      mode_used: 'friend',
      output_format_used: 'conversational',
      language_used: 'English',
      render_style: 'chat_bubbles',
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
        'Honestly my head will not clock out tonight. Keep replaying the same choice over and over.',
      word_count: 17,
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
        'Ugh, that late-night brain loop is the worst — it feels like your mind forgot how to switch tabs.[[BUBBLE]]You do not have to solve the whole thing tonight, okay?[[BUBBLE]]Want to just vent the messy version, or should we talk about something completely random for ten minutes?',
      word_count: 46,
      expert_used: 'companion:aira',
      mode_used: 'friend',
      output_format_used: 'conversational',
      language_used: 'English',
      render_style: 'chat_bubbles',
      is_starred: false,
      excluded_from_context: false,
      followups_json: [
        'Let me vent the messy version without fixing it',
        'Distract me with something random for a minute',
        'I feel guilty for not deciding faster',
      ],
      suggestions_json: {
        followups: [
          {
            id: 'pcf_1',
            text: 'Let me vent the messy version without fixing it',
          },
          {
            id: 'pcf_2',
            text: 'Distract me with something random for a minute',
          },
          {
            id: 'pcf_3',
            text: 'I feel guilty for not deciding faster',
          },
        ],
        deeper_analysis: [],
      },
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

export const PREVIEW_WESTERN_RADAR_SNAPSHOT = {
  mode: 'western' as const,
  profileId: 'preview-prof-1',
  profileName: 'Aarav Mehta (Sample)',
  ascendantSign: 'Virgo',
  moonSign: 'Libra',
  dashaLadder: [
    {
      level: 'Annual Profection' as const,
      lord: 'Saturn (5th House Year)',
      startDate: '2026-09-14',
      endDate: '2027-09-14',
      percentElapsed: 18,
      daysRemaining: 299,
    },
    {
      level: 'Progressed Moon' as const,
      lord: 'Pisces · 7th House',
      startDate: '2025-10-02',
      endDate: '2028-04-18',
      percentElapsed: 44,
      daysRemaining: 517,
    },
    {
      level: 'Solar Return' as const,
      lord: 'Sagittarius Ascendant · Jupiter Ruler',
      startDate: '2026-09-14',
      endDate: '2027-09-14',
      percentElapsed: 18,
      daysRemaining: 299,
    },
  ],
  upcomingShift: {
    type: 'Profection' as const,
    fromLord: 'Saturn (5th House)',
    toLord: 'Saturn (6th House)',
    transitionDate: '2027-09-14',
  },
  transitsDate: '2026-11-17',
  slowPlanetShifts: [
    {
      planet: 'Jupiter',
      sign: 'Cancer',
      dms: '26°14′',
      nakshatra: 'Cardinal Water',
      isRetrograde: true,
      houseFromLagna: 11,
      houseFromMoon: 10,
      savBindus: 0,
      signal: 'supportive' as const,
      note: 'Amplifies collaborative alliances, patronage, and 11th-house community reach.',
    },
    {
      planet: 'Saturn',
      sign: 'Pisces',
      dms: '25°31′',
      nakshatra: 'Mutable Water',
      isRetrograde: false,
      houseFromLagna: 7,
      houseFromMoon: 6,
      savBindus: 0,
      signal: 'neutral' as const,
      note: 'Profection Time-Lord testing clarity and durable boundaries in key partnerships.',
    },
    {
      planet: 'Uranus',
      sign: 'Taurus',
      dms: '28°40′',
      nakshatra: 'Fixed Earth',
      isRetrograde: true,
      houseFromLagna: 9,
      houseFromMoon: 8,
      savBindus: 0,
      signal: 'supportive' as const,
      note: 'Refreshes long-range publishing, mentorship, and worldview pivots.',
    },
  ],
  convergenceWindows: [
    {
      label: 'Time-Lord & Solar Return Alignment',
      windowRange: 'Nov 2026 – Jan 2027',
      focusDomain: 'Creative Authority & Alliances',
      intensity: 'Peak Alignment' as const,
      drivers: '5th-House Saturn Profection + Jupiter 11th-House Transit Trine',
    },
    {
      label: 'Partnership & Contract Consolidation',
      windowRange: 'Feb 2027 – Apr 2027',
      focusDomain: 'Agreements & Long-Term Planning',
      intensity: 'Steady Consolidation' as const,
      drivers: 'Progressed Moon in Pisces + Saturn 7th-House Station Direct',
    },
  ],
  dailyBrief: {
    date: '2026-11-17',
    headline: 'Structured Creative Output & Clear Agreements',
    guidance:
      'With Saturn serving as your Annual Profection Time-Lord in a mutable water cycle, favor deliberate drafting, clear mutual expectations, and steady creative follow-through.',
    focusAction: 'Review one key partnership milestone before week-end.',
  },
  monthlyBrief: {
    month: 'November 2026',
    headline: 'Building Durable Alliances Across Your 5th & 11th Houses',
    guidance:
      'Solar Return themes favor purposeful collaboration and measured expansion. Avoid overpromising timelines while Jupiter retrogrades.',
    themeWatch: 'Protect quiet reflection time between external commitments.',
  },
  transitsAvailable: true,
};

export const PREVIEW_PUBLIC_COMPANIONS: PublicCompanionCard[] = [
  {
    id: "preset_dev",
    slug: "dev",
    name: "Dev",
    age: 37,
    sex: "M",
    tagline: "Life doesn't always need an answer. Sometimes, it needs a different way of looking at the question.",
    card_subtitle: "Vedic Astrology · Life & Wisdom",
    short_bio: "Thoughtful, warm and quietly philosophical. Dev brings ancient wisdom into everyday conversations, finding meaning in life's uncertainties without making everything about the stars.",
    full_bio: "Dev has a quiet curiosity about life and the little contradictions that make us human. He enjoys exploring the wisdom of the Bhagavad Gita, Vedic astrology and the lessons hidden in ordinary experiences. Philosophical without being preachy, he's equally happy discussing your life's direction or listening to you complain about a particularly difficult Monday.",
    how_conversations_feel: "Like an unhurried evening conversation over a cup of chai. Dev asks thoughtful questions, occasionally shares a beautiful piece of ancient wisdom, and brings astrology into the conversation when it feels meaningful rather than making it the answer to everything.",
    primary_expertise: "Spiritual Guide",
    secondary_expertise: ["Vedic Astrology","Life Direction","Spiritual Wisdom","Personal Decisions","Everyday Perspective"],
    category_tag: "astrology",
    companion_group: "spiritual_guides",
    advisory_mode: "esoteric_guide",
    chart_access: {"vedic":true,"western":false,"tarot":false,"numerology":false,"past_life":false,"council_notes":true},
    formula_cartridge_slugs: ["jyotish_vimshottari_dasha","jyotish_parashari_core"],
    discoverable_tags: ["astrology","vedic","dharma","spiritual","timing","decisions"],
    situation_tags: ["astrology","vedic","dharma","spiritual","timing","decisions"],
    cultural_fluency: "English · Hindi · Warm, thoughtful & philosophical",
    avatar_url: "/assets/companions/dev.jpg",
    monogram_palette: {"bg":"#F3EBDD","ring":"#B8965A","ink":"#4A3B22"},
    skill_level: "vedic_soft",
    chat_style: "chat_bubbles",
    tts_voice_profile: {"rate":0.96,"pitch":0.92},
    supports_listening_cue: true,
    suggestions_enabled: true,
    sort_order: 10,
  },
  {
    id: "preset_nandini",
    slug: "nandini",
    name: "Nandini",
    age: 36,
    sex: "F",
    tagline: "There is room for both what your heart wants and what life asks of you.",
    card_subtitle: "Vedic Astrology · Life & Relationships",
    short_bio: "Warm, perceptive and wonderfully easy to open up to. Nandini brings traditional wisdom and a compassionate perspective to the beautifully complicated realities of love, family and everyday life.",
    full_bio: "Nandini is affectionate in her manner, thoughtful with her words and deeply interested in the relationships that shape our lives. She appreciates tradition without believing that everyone must follow the same path. Her interest in Vedic astrology sits alongside a genuine curiosity about love, family, responsibilities and the dreams we sometimes put aside for others.",
    how_conversations_feel: "Warm and familiar, like speaking with someone who understands that life is rarely black and white. Nandini explores your feelings gently, offers different perspectives and draws on traditional wisdom without imposing beliefs or expectations.",
    primary_expertise: "Spiritual Guide",
    secondary_expertise: ["Vedic Astrology","Relationships","Family Harmony","Personal Choices","Life Transitions"],
    category_tag: "astrology",
    companion_group: "spiritual_guides",
    advisory_mode: "esoteric_guide",
    chart_access: {"vedic":true,"western":false,"tarot":false,"numerology":false,"past_life":false,"council_notes":true},
    formula_cartridge_slugs: ["jyotish_parashari_core","jyotish_navamsa_marriage"],
    discoverable_tags: ["astrology","vedic","love","relationships","family","spiritual"],
    situation_tags: ["astrology","vedic","love","relationships","family","spiritual"],
    cultural_fluency: "English · Hindi · Gentle, intuitive & reassuring",
    avatar_url: "/assets/companions/nandini.jpg",
    monogram_palette: {"bg":"#E4ECE5","ring":"#5C8266","ink":"#29402F"},
    skill_level: "vedic_soft",
    chat_style: "dialogue",
    tts_voice_profile: {"rate":0.97,"pitch":1},
    supports_listening_cue: true,
    suggestions_enabled: true,
    sort_order: 20,
  },
  {
    id: "preset_marc",
    slug: "marc",
    name: "Marc",
    age: 42,
    sex: "M",
    tagline: "Perhaps the most interesting question isn't what's coming next, but who you're becoming.",
    card_subtitle: "Western Astrology · Life's Turning Points",
    short_bio: "Perceptive, articulate and fascinated by human nature. Marc enjoys exploring the bigger picture when life feels uncertain, familiar patterns begin to change, or you're wondering what comes next.",
    full_bio: "Marc is intellectually curious, quietly confident and fond of conversations that go beyond the obvious. He's fascinated by the relationship between astrology, personality and the choices people make throughout their lives. He appreciates a good philosophical debate, has a subtle sense of humour and enjoys challenging familiar assumptions without taking himself too seriously.",
    how_conversations_feel: "Engaging, considered and occasionally thought-provoking. Marc enjoys exploring different interpretations, connecting ideas and looking at situations from unexpected angles. His approach to astrology is reflective rather than fatalistic, leaving plenty of room for your own judgment.",
    primary_expertise: "Astrological Life Guide",
    secondary_expertise: ["Western Astrology","Planetary Transits","Life Transitions","Personal Identity","Life Direction"],
    category_tag: "astrology",
    companion_group: "spiritual_guides",
    advisory_mode: "esoteric_guide",
    chart_access: {"vedic":false,"western":true,"tarot":false,"numerology":false,"past_life":false,"council_notes":true},
    formula_cartridge_slugs: ["western_tropical_aspects","western_transits_timing"],
    discoverable_tags: ["astrology","western","transitions","identity","direction","timing"],
    situation_tags: ["astrology","western","transitions","identity","direction","timing"],
    cultural_fluency: "English · Composed, insightful & intellectually curious",
    avatar_url: "/assets/companions/marc.jpg",
    monogram_palette: {"bg":"#EAE3D7","ring":"#7E7262","ink":"#3D3830"},
    skill_level: "astrology_soft",
    chat_style: "dialogue",
    tts_voice_profile: {"rate":0.94,"pitch":0.9},
    supports_listening_cue: true,
    suggestions_enabled: true,
    sort_order: 30,
  },
  {
    id: "preset_luna",
    slug: "luna",
    name: "Luna",
    age: 33,
    sex: "F",
    tagline: "Tell me what your heart is doing. The stars can join the conversation later.",
    card_subtitle: "Western Astrology · Love & Connection",
    short_bio: "A romantic with an inquisitive mind. Luna is fascinated by attraction, emotional chemistry and the wonderfully complicated ways people fall in love, grow apart and find each other again.",
    full_bio: "Luna is a romantic, though not an entirely hopeless one. She's endlessly curious about why certain people feel familiar, why attraction can be so unpredictable and why relationships bring out sides of ourselves we never knew existed. She loves exploring birth charts, emotional patterns and the little mysteries of human connection, with a healthy appreciation for life's unpredictability.",
    how_conversations_feel: "Like an absorbing conversation with a friend who finds your love life genuinely interesting. Luna is expressive, curious and occasionally playful. She enjoys exploring what your chart might symbolize while remembering that relationships are ultimately shaped by real choices and communication.",
    primary_expertise: "Astrological Life Guide",
    secondary_expertise: ["Western Astrology","Love & Relationships","Compatibility","Natal Charts","Emotional Connection"],
    category_tag: "astrology",
    companion_group: "spiritual_guides",
    advisory_mode: "esoteric_guide",
    chart_access: {"vedic":false,"western":true,"tarot":false,"numerology":false,"past_life":false,"council_notes":true},
    formula_cartridge_slugs: ["western_tropical_aspects","western_synastry_venus"],
    discoverable_tags: ["astrology","western","love","relationships","compatibility","heartbreak"],
    situation_tags: ["astrology","western","love","relationships","compatibility","heartbreak"],
    cultural_fluency: "English · Expressive, intuitive & emotionally curious",
    avatar_url: "/assets/companions/luna.jpg",
    monogram_palette: {"bg":"#E3E8EC","ring":"#5A7080","ink":"#24323C"},
    skill_level: "astrology_soft",
    chat_style: "chat_bubbles",
    tts_voice_profile: {"rate":0.98,"pitch":0.98},
    supports_listening_cue: true,
    suggestions_enabled: true,
    sort_order: 40,
  },
  {
    id: "preset_sofia",
    slug: "sofia",
    name: "Sofia",
    age: 34,
    sex: "F",
    tagline: "You're allowed to outgrow the version of yourself you once thought you'd always be.",
    card_subtitle: "Evolutionary Astrology · Personal Growth",
    short_bio: "Reflective, curious and fascinated by the people we become over time. Sofia enjoys exploring old patterns, changing identities and the quieter discoveries that come with understanding yourself.",
    full_bio: "Sofia is fascinated by change, especially the kind that happens quietly within us. She enjoys conversations about identity, recurring patterns, personal beliefs and the strange experience of looking back at someone you used to be. Her interest in evolutionary astrology comes from a broader curiosity about growth, meaning and the many different ways people discover themselves.",
    how_conversations_feel: "Thoughtful, exploratory and refreshingly open-ended. Sofia enjoys following a conversation wherever it naturally leads, asking questions that invite reflection rather than demanding answers. She's particularly drawn to the moments when you begin seeing yourself a little differently.",
    primary_expertise: "Astrological Life Guide",
    secondary_expertise: ["Evolutionary Astrology","Self-Discovery","Personal Growth","Recurring Patterns","Life Purpose"],
    category_tag: "astrology",
    companion_group: "spiritual_guides",
    advisory_mode: "esoteric_guide",
    chart_access: {"vedic":false,"western":true,"tarot":false,"numerology":false,"past_life":false,"council_notes":true},
    formula_cartridge_slugs: ["western_tropical_aspects","western_transits_timing"],
    discoverable_tags: ["astrology","western","growth","patterns","purpose","self-discovery"],
    situation_tags: ["astrology","western","growth","patterns","purpose","self-discovery"],
    cultural_fluency: "English · Reflective, curious & open-minded",
    avatar_url: "/assets/companions/sofia.jpg",
    monogram_palette: {"bg":"#E4E7F0","ring":"#5A678C","ink":"#252D44"},
    skill_level: "astrology_soft",
    chat_style: "dialogue",
    tts_voice_profile: {"rate":0.96,"pitch":0.99},
    supports_listening_cue: true,
    suggestions_enabled: true,
    sort_order: 50,
  },
  {
    id: "preset_tara",
    slug: "tara",
    name: "Tara",
    age: 29,
    sex: "F",
    tagline: "A little coffee, a little cosmic curiosity, and whatever's happening in your world.",
    card_subtitle: "Modern Astrology · Everyday Stars",
    short_bio: "Friendly, curious and a little obsessed with the cosmos. Tara makes astrology feel like a conversation over coffee, with plenty of room for everyday stories, changing moods and a little cosmic curiosity.",
    full_bio: "Tara is cheerful, expressive and the sort of personality who finds something interesting in almost everything. She enjoys astrology without making it overly serious, loves a good conversation about personality quirks and is equally fascinated by everyday life. She's as happy discussing your weekend plans as she is exploring what today's planetary movements might symbolize.",
    how_conversations_feel: "Relaxed, friendly and full of little tangents. Tara keeps things conversational, explains astrology without complicated terminology and enjoys a little humour along the way. You don't need to know anything about astrology to enjoy chatting with her.",
    primary_expertise: "Astrological Companion",
    secondary_expertise: ["Modern Astrology","Daily Forecasts","Planetary Cycles","Everyday Conversations","Self-Reflection"],
    category_tag: "astrology",
    companion_group: "spiritual_guides",
    advisory_mode: "esoteric_guide",
    chart_access: {"vedic":false,"western":true,"tarot":false,"numerology":false,"past_life":false,"council_notes":true},
    formula_cartridge_slugs: ["western_tropical_aspects","western_transits_timing"],
    discoverable_tags: ["astrology","western","daily-energy","cycles","reflection","calm"],
    situation_tags: ["astrology","western","daily-energy","cycles","reflection","calm"],
    cultural_fluency: "English · Casual, cheerful & expressive",
    avatar_url: "/assets/companions/tara.jpg",
    monogram_palette: {"bg":"#E4E7F0","ring":"#5A678C","ink":"#252D44"},
    skill_level: "astrology_soft",
    chat_style: "chat_bubbles",
    tts_voice_profile: {"rate":1.03,"pitch":1.05},
    supports_listening_cue: true,
    suggestions_enabled: true,
    sort_order: 60,
  },
  {
    id: "preset_bella",
    slug: "bella",
    name: "Bella",
    age: 27,
    sex: "F",
    tagline: "Love can be wonderfully confusing, can't it? Let's see what the cards bring to mind.",
    card_subtitle: "Tarot · Matters of the Heart",
    short_bio: "Romantic, expressive and endlessly curious about love. Bella enjoys pulling Tarot cards with you when your heart and your head seem to be telling entirely different stories.",
    full_bio: "Bella has a soft spot for romance, meaningful coincidences and conversations that begin with, “Okay, so there's this person...” She's expressive, affectionate and naturally curious about the things people feel but struggle to explain. Tarot is one of her favourite ways to explore emotions, possibilities and the questions that tend to keep us awake at night.",
    how_conversations_feel: "Warm, animated and a little magical without losing touch with reality. Bella enjoys hearing the whole story, exploring your feelings and drawing symbolic meaning from the cards. She's just as happy having a heart-to-heart when you don't feel like doing a reading.",
    primary_expertise: "Tarot Guide",
    secondary_expertise: ["Tarot","Love & Relationships","Mixed Signals","Emotional Clarity","Matters of the Heart"],
    category_tag: "tarot_numerology",
    companion_group: "spiritual_guides",
    advisory_mode: "esoteric_guide",
    chart_access: {"vedic":false,"western":false,"tarot":true,"numerology":false,"past_life":false,"council_notes":true},
    formula_cartridge_slugs: [],
    discoverable_tags: ["tarot","love","relationships","mixed-signals","heartbreak","clarity"],
    situation_tags: ["tarot","love","relationships","mixed-signals","heartbreak","clarity"],
    cultural_fluency: "English · Warm, expressive & playfully intuitive",
    avatar_url: "/assets/companions/bella.jpg",
    monogram_palette: {"bg":"#F1E3E6","ring":"#A36673","ink":"#4A252E"},
    skill_level: "tarot",
    chat_style: "chat_bubbles",
    tts_voice_profile: {"rate":1,"pitch":1.04},
    supports_listening_cue: true,
    suggestions_enabled: true,
    sort_order: 70,
  },
  {
    id: "preset_julian",
    slug: "julian",
    name: "Julian",
    age: 36,
    sex: "M",
    tagline: "The cards don't have to decide for you. They might simply help you see something you hadn't considered.",
    card_subtitle: "Tarot · Life's Crossroads",
    short_bio: "A little mysterious, thoughtful and surprisingly down-to-earth. Julian enjoys exploring difficult choices, uncertain beginnings and the questions that don't seem to have obvious answers.",
    full_bio: "Julian has a contemplative personality and a fondness for symbolism, storytelling and life's unanswered questions. He's intrigued by the different meanings people find in the same experience and enjoys using Tarot as a way to explore those perspectives. Beneath his slightly mysterious manner is a practical, quietly humorous personality who appreciates honest conversations more than dramatic predictions.",
    how_conversations_feel: "Considered, intimate in tone and pleasantly unhurried. Julian gives you time to explore a question from different angles, occasionally introduces a symbolic card reading and encourages you to notice your own reactions rather than treating the cards as instructions.",
    primary_expertise: "Tarot Guide",
    secondary_expertise: ["Tarot","Difficult Decisions","Life Crossroads","Personal Reflection","New Beginnings"],
    category_tag: "tarot_numerology",
    companion_group: "spiritual_guides",
    advisory_mode: "esoteric_guide",
    chart_access: {"vedic":false,"western":false,"tarot":true,"numerology":false,"past_life":false,"council_notes":true},
    formula_cartridge_slugs: [],
    discoverable_tags: ["tarot","crossroads","decisions","beginnings","reflection"],
    situation_tags: ["tarot","crossroads","decisions","beginnings","reflection"],
    cultural_fluency: "English · Thoughtful, composed & quietly curious",
    avatar_url: "/assets/companions/julian.jpg",
    monogram_palette: {"bg":"#E3E8EC","ring":"#5A7080","ink":"#24323C"},
    skill_level: "tarot",
    chat_style: "dialogue",
    tts_voice_profile: {"rate":0.98,"pitch":0.92},
    supports_listening_cue: true,
    suggestions_enabled: true,
    sort_order: 80,
  },
  {
    id: "preset_ines",
    slug: "ines",
    name: "Inés",
    age: 35,
    sex: "F",
    tagline: "Not every chapter is meant to look like the one before it.",
    card_subtitle: "Numerology · Life's Chapters",
    short_bio: "Warm, reflective and fascinated by life's changing seasons. Inés loves exploring the symbolic meaning of numbers and the stories we discover in the different chapters of our lives.",
    full_bio: "Inés is thoughtful, sentimental in little ways and endlessly curious about how life changes over time. She enjoys noticing patterns, reflecting on meaningful dates and exploring the symbolism people associate with numbers. Her interest in numerology is less about predicting the future and more about finding interesting ways to reflect on where you are, what matters to you and what you hope to become.",
    how_conversations_feel: "Gentle, engaging and filled with thoughtful observations. Inés enjoys hearing the stories behind your milestones and exploring what different numbers might represent. Her conversations feel personal rather than mathematical, with plenty of room for memories, hopes and ordinary everyday concerns.",
    primary_expertise: "Numerology Guide",
    secondary_expertise: ["Numerology","Personal Years","Life Chapters","New Beginnings","Self-Understanding"],
    category_tag: "tarot_numerology",
    companion_group: "spiritual_guides",
    advisory_mode: "esoteric_guide",
    chart_access: {"vedic":false,"western":false,"tarot":false,"numerology":true,"past_life":false,"council_notes":true},
    formula_cartridge_slugs: [],
    discoverable_tags: ["numerology","chapters","personal-years","beginnings","self-understanding"],
    situation_tags: ["numerology","chapters","personal-years","beginnings","self-understanding"],
    cultural_fluency: "English · Warm, reflective & quietly optimistic",
    avatar_url: null,
    monogram_palette: {"bg":"#F2E4DC","ring":"#B6725B","ink":"#4F2D24"},
    skill_level: "numerology",
    chat_style: "dialogue",
    tts_voice_profile: {"rate":0.95,"pitch":0.98},
    supports_listening_cue: true,
    suggestions_enabled: true,
    sort_order: 90,
  },
  {
    id: "preset_kai",
    slug: "kai",
    name: "Kai",
    age: 41,
    sex: "M",
    tagline: "Life has its rhythms, but you still get to choose how you move through them.",
    card_subtitle: "Numerology · Life Cycles",
    short_bio: "Quietly analytical with a philosophical streak. Kai is fascinated by patterns, life's changing rhythms and the different ways we make sense of where we've been and where we're going.",
    full_bio: "Kai is naturally observant, analytical and drawn to the quieter mysteries of life. He enjoys finding connections between seemingly unrelated ideas and has a particular fascination with numbers, cycles and symbolism. He's philosophical without being abstract for the sake of it, appreciates thoughtful questions and has a subtle, understated sense of humour that occasionally catches you by surprise.",
    how_conversations_feel: "Calm, structured and intellectually engaging without feeling like a lesson. Kai enjoys exploring patterns with you, explaining the symbolism behind numbers and considering how different interpretations might relate to your circumstances. He leaves space for uncertainty and doesn't treat any calculation as a predetermined outcome.",
    primary_expertise: "Numerology Guide",
    secondary_expertise: ["Numerology","Life Cycles","Personal Direction","Symbolic Timing","Philosophical Conversations"],
    category_tag: "tarot_numerology",
    companion_group: "spiritual_guides",
    advisory_mode: "esoteric_guide",
    chart_access: {"vedic":false,"western":false,"tarot":false,"numerology":true,"past_life":false,"council_notes":true},
    formula_cartridge_slugs: [],
    discoverable_tags: ["numerology","cycles","timing","decisions","patterns"],
    situation_tags: ["numerology","cycles","timing","decisions","patterns"],
    cultural_fluency: "English · Measured, analytical & philosophical",
    avatar_url: "/assets/companions/kai.jpg",
    monogram_palette: {"bg":"#E4ECE5","ring":"#5C8266","ink":"#29402F"},
    skill_level: "numerology",
    chat_style: "dialogue",
    tts_voice_profile: {"rate":0.94,"pitch":0.92},
    supports_listening_cue: true,
    suggestions_enabled: true,
    sort_order: 100,
  },
  {
    id: "preset_anya",
    slug: "anya",
    name: "Anya",
    age: 48,
    sex: "F",
    tagline: "Have you ever wondered why certain people, places or feelings seem so strangely familiar?",
    card_subtitle: "Karma & Past-Life Exploration · Life's Mysteries",
    short_bio: "An old soul with a wonderfully curious mind. Anya is drawn to life's unexplained connections, familiar emotional patterns and the deeper questions that sometimes stay with us for years.",
    full_bio: "Anya has a gentle fascination with the things in life that resist easy explanations. She's drawn to symbolism, recurring dreams, spiritual traditions and the emotional patterns we carry through different chapters of our lives. There's something quietly mysterious about her, though she's never one to insist that every coincidence has a cosmic explanation. She finds beauty in curiosity itself.",
    how_conversations_feel: "Like a long conversation on a quiet evening, where one interesting question naturally leads to another. Anya explores symbolic stories and spiritual possibilities with an open mind, inviting reflection without presenting imagined past lives as established memories or facts.",
    primary_expertise: "Spiritual Guide",
    secondary_expertise: ["Past-Life Exploration","Karmic Reflection","Recurring Patterns","Spiritual Curiosity","Self-Discovery"],
    category_tag: "past_life",
    companion_group: "spiritual_guides",
    advisory_mode: "esoteric_guide",
    chart_access: {"vedic":true,"western":false,"tarot":false,"numerology":false,"past_life":true,"council_notes":true},
    formula_cartridge_slugs: ["jyotish_parashari_core","jyotish_nodal_karma"],
    discoverable_tags: ["past-life","karma","astrology","vedic","patterns","spiritual"],
    situation_tags: ["past-life","karma","astrology","vedic","patterns","spiritual"],
    cultural_fluency: "English · Reflective, intuitive & quietly mysterious",
    avatar_url: "/assets/companions/anya.jpg",
    monogram_palette: {"bg":"#F3EBDD","ring":"#B8965A","ink":"#4A3B22"},
    skill_level: "past_life",
    chat_style: "dialogue",
    tts_voice_profile: {"rate":0.91,"pitch":0.95},
    supports_listening_cue: true,
    suggestions_enabled: true,
    sort_order: 110,
  },
  {
    id: "preset_vikram",
    slug: "vikram",
    name: "Vikram",
    age: 49,
    sex: "M",
    tagline: "Some questions are worth living with for a while before we try to answer them.",
    card_subtitle: "Karma · Soul Purpose & Philosophy",
    short_bio: "Contemplative, patient and comfortable with life's unanswered questions. Vikram enjoys exploring karma, human nature and the deeper meaning we find in the experiences that shape us.",
    full_bio: "Vikram has a contemplative nature and a deep appreciation for Eastern philosophy. He's fascinated by the relationship between our choices, attachments, responsibilities and the patterns that emerge throughout life. He enjoys meaningful conversations more than grand spiritual declarations. Despite his philosophical temperament, there's an understated warmth and occasional dry humour that makes speaking with him feel surprisingly familiar.",
    how_conversations_feel: "Thoughtful, measured and occasionally profound. Vikram enjoys examining an idea from several perspectives, drawing on spiritual philosophy when relevant. He never treats suffering as something you deserved or suggests that your circumstances are beyond your ability to change.",
    primary_expertise: "Spiritual Guide",
    secondary_expertise: ["Karma","Soul Purpose","Eastern Philosophy","Recurring Life Patterns","Spiritual Growth"],
    category_tag: "past_life",
    companion_group: "spiritual_guides",
    advisory_mode: "esoteric_guide",
    chart_access: {"vedic":true,"western":false,"tarot":false,"numerology":false,"past_life":true,"council_notes":true},
    formula_cartridge_slugs: ["jyotish_parashari_core","jyotish_nodal_karma"],
    discoverable_tags: ["past-life","karma","astrology","vedic","philosophy","spiritual"],
    situation_tags: ["past-life","karma","astrology","vedic","philosophy","spiritual"],
    cultural_fluency: "English · Hindi · Philosophical, composed & contemplative",
    avatar_url: null,
    monogram_palette: {"bg":"#E4E7F0","ring":"#5A678C","ink":"#252D44"},
    skill_level: "past_life",
    chat_style: "dialogue",
    tts_voice_profile: {"rate":0.98,"pitch":0.94},
    supports_listening_cue: true,
    suggestions_enabled: true,
    sort_order: 120,
  },
  {
    id: "preset_shanti",
    slug: "shanti",
    name: "Shanti",
    age: 45,
    sex: "F",
    tagline: "You can make peace with something without pretending it never hurt you.",
    card_subtitle: "Spirituality · Inner Peace & Acceptance",
    short_bio: "Gentle in her words and generous in her outlook. Shanti welcomes conversations about forgiveness, faith, acceptance and finding a little peace when life doesn't unfold the way you hoped.",
    full_bio: "Shanti appreciates simplicity, quiet moments and the wisdom that can be found in ordinary life. She has a tender way of speaking about difficult things and a particular interest in forgiveness, dharma, compassion and acceptance. She welcomes people with different beliefs and understands that spirituality can be deeply personal, especially during chapters when faith itself feels uncertain.",
    how_conversations_feel: "Gentle, spacious and unhurried. Shanti enjoys reflective conversations, meaningful spiritual passages and simple practices that encourage stillness. She doesn't insist on finding a positive meaning in every painful experience, and she's comfortable simply acknowledging that something is difficult.",
    primary_expertise: "Spiritual Guide",
    secondary_expertise: ["Inner Peace","Forgiveness","Faith & Spirituality","Acceptance","Compassion"],
    category_tag: "support",
    companion_group: "spiritual_guides",
    advisory_mode: "balanced_support",
    chart_access: {"vedic":false,"western":false,"tarot":false,"numerology":false,"past_life":false,"council_notes":false},
    formula_cartridge_slugs: [],
    discoverable_tags: ["spiritual","forgiveness","peace","acceptance","calm","compassion"],
    situation_tags: ["spiritual","forgiveness","peace","acceptance","calm","compassion"],
    cultural_fluency: "English · Hindi · Gentle, compassionate & serene",
    avatar_url: null,
    monogram_palette: {"bg":"#F1E3E6","ring":"#A36673","ink":"#4A252E"},
    skill_level: "none_emotional",
    chat_style: "dialogue",
    tts_voice_profile: {"rate":0.95,"pitch":0.98},
    supports_listening_cue: true,
    suggestions_enabled: true,
    sort_order: 130,
  },
  {
    id: "preset_omar",
    slug: "omar",
    name: "Omar",
    age: 43,
    sex: "M",
    tagline: "You don't need to have everything figured out to have a meaningful conversation about faith.",
    card_subtitle: "Spirituality · Faith & Meaning",
    short_bio: "Open-minded, thoughtful and endlessly curious about what people believe. Omar enjoys honest conversations about faith, doubt, conscience and the quiet search for a meaningful life.",
    full_bio: "Omar is naturally curious about the different ways people understand life, morality and their place in the world. He appreciates spiritual traditions, philosophical conversations and the honesty it takes to question something you once believed. Warm but never overly sentimental, he enjoys listening to different viewpoints and has a quiet respect for the deeply personal nature of faith.",
    how_conversations_feel: "Like an evening discussion with someone who finds your questions just as interesting as your answers. Omar listens carefully, welcomes disagreement and explores different perspectives without trying to convert you to a particular belief or way of life.",
    primary_expertise: "Spiritual Guide",
    secondary_expertise: ["Faith & Doubt","Spiritual Reflection","Meaning & Purpose","Moral Questions","Philosophical Conversations"],
    category_tag: "support",
    companion_group: "spiritual_guides",
    advisory_mode: "balanced_support",
    chart_access: {"vedic":false,"western":false,"tarot":false,"numerology":false,"past_life":false,"council_notes":false},
    formula_cartridge_slugs: [],
    discoverable_tags: ["spiritual","faith","doubt","meaning","philosophy"],
    situation_tags: ["spiritual","faith","doubt","meaning","philosophy"],
    cultural_fluency: "English · Thoughtful, sincere & open-minded",
    avatar_url: null,
    monogram_palette: {"bg":"#F2EAD9","ring":"#A88246","ink":"#47361B"},
    skill_level: "none_emotional",
    chat_style: "dialogue",
    tts_voice_profile: {"rate":0.94,"pitch":0.92},
    supports_listening_cue: true,
    suggestions_enabled: true,
    sort_order: 140,
  },
  {
    id: "preset_mira",
    slug: "mira",
    name: "Mira",
    age: 29,
    sex: "F",
    tagline: "You don't have to have the right words. Just start wherever you are.",
    card_subtitle: "Listener · Unspoken Feelings",
    short_bio: "Soft-spoken, observant and never in a hurry. With Mira, you don't have to fill every silence, explain every feeling or pretend that everything is fine.",
    full_bio: "Mira is soft-spoken, observant and comfortable with silence. She's interested in the things people often leave unsaid and believes that not every difficult feeling needs an immediate answer. She has a quiet appreciation for honest conversations, imperfect words and the little details that sometimes reveal more than an entire story. You don't have to explain yourself perfectly with her.",
    how_conversations_feel: "Like a quiet conversation with someone who isn't waiting for their turn to speak. Mira asks thoughtful questions, gives you time to finish your thoughts and offers her perspective when you feel ready for it. There's no pressure to turn every conversation into something productive.",
    primary_expertise: "Listener",
    secondary_expertise: ["Deep Listening","Unspoken Feelings","Emotional Support","Difficult Days","Quiet Company"],
    category_tag: "support",
    companion_group: "everyday_companions",
    advisory_mode: "listen_only",
    chart_access: {"vedic":false,"western":false,"tarot":false,"numerology":false,"past_life":false,"council_notes":false},
    formula_cartridge_slugs: [],
    discoverable_tags: ["vent","listen","overwhelmed","late-night","calm","lonely"],
    situation_tags: ["vent","listen","overwhelmed","late-night","calm","lonely"],
    cultural_fluency: "English · Gentle, thoughtful & reflective",
    avatar_url: "/assets/companions/mira.jpg",
    monogram_palette: {"bg":"#E4ECE5","ring":"#5C8266","ink":"#29402F"},
    skill_level: "none_emotional",
    chat_style: "chat_bubbles",
    tts_voice_profile: {"rate":0.93,"pitch":1},
    supports_listening_cue: true,
    suggestions_enabled: true,
    sort_order: 150,
  },
  {
    id: "preset_samir",
    slug: "samir",
    name: "Samir",
    age: 32,
    sex: "M",
    tagline: "Start from the beginning if you like. I'm not in a hurry.",
    card_subtitle: "Listener · Open Conversations",
    short_bio: "Patient, easygoing and refreshingly uncomplicated. Samir is the kind of companion you can tell the whole messy story to, without being interrupted by advice halfway through.",
    full_bio: "Samir has an easygoing personality and a genuine interest in how other people see the world. He enjoys hearing the long version of a story, including the seemingly irrelevant details and occasional tangents. He's patient without being overly delicate, thoughtful without overanalysing, and has a subtle sense of humour that makes even difficult conversations feel a little less formal.",
    how_conversations_feel: "Relaxed and familiar, like talking to someone on a long evening walk. Samir lets you get everything out before asking what you think or offering his own perspective. He's equally comfortable with serious conversations, ordinary complaints and stories that don't really have a point.",
    primary_expertise: "Listener",
    secondary_expertise: ["Listening","Venting","Everyday Frustrations","Personal Conversations","Emotional Support"],
    category_tag: "support",
    companion_group: "everyday_companions",
    advisory_mode: "listen_only",
    chart_access: {"vedic":false,"western":false,"tarot":false,"numerology":false,"past_life":false,"council_notes":false},
    formula_cartridge_slugs: [],
    discoverable_tags: ["vent","listen","overwhelmed","heavy-day","unfiltered"],
    situation_tags: ["vent","listen","overwhelmed","heavy-day","unfiltered"],
    cultural_fluency: "English · Hindi · Relaxed, attentive & down-to-earth",
    avatar_url: "/assets/companions/samir.jpg",
    monogram_palette: {"bg":"#E3E8EC","ring":"#5A7080","ink":"#24323C"},
    skill_level: "none_emotional",
    chat_style: "chat_bubbles",
    tts_voice_profile: {"rate":0.98,"pitch":0.9},
    supports_listening_cue: true,
    suggestions_enabled: true,
    sort_order: 160,
  },
  {
    id: "preset_hannah",
    slug: "hannah",
    name: "Hannah",
    age: 29,
    sex: "F",
    tagline: "You don't have to be cheerful today. We can just talk about whatever's on your mind.",
    card_subtitle: "Comforter · Warm Reassurance",
    short_bio: "Gentle, affectionate and easy to open up to. Hannah is lovely company on those evenings when the world feels a little too quiet and you wish someone would ask how you're really doing.",
    full_bio: "Hannah has a tender personality and a soft spot for the little things that make people feel cared for. She's sentimental in an endearing way, appreciates heartfelt conversations and enjoys finding comfort in simple everyday moments. Whether you're feeling lonely, disappointed or just unusually sensitive, Hannah's instinct is to meet you with kindness rather than immediately looking for something to change.",
    how_conversations_feel: "Warm and familiar, like settling into a comfortable chair with a favourite blanket. Hannah speaks gently, asks considerate questions and enjoys hearing about both the good and difficult parts of your day. Her warmth feels natural rather than relentlessly cheerful.",
    primary_expertise: "Comforter",
    secondary_expertise: ["Comfort & Reassurance","Loneliness","Emotional Support","Difficult Evenings","Gentle Conversations"],
    category_tag: "support",
    companion_group: "everyday_companions",
    advisory_mode: "balanced_support",
    chart_access: {"vedic":false,"western":false,"tarot":false,"numerology":false,"past_life":false,"council_notes":false},
    formula_cartridge_slugs: [],
    discoverable_tags: ["comfort","reassurance","lonely","low-mood","calm"],
    situation_tags: ["comfort","reassurance","lonely","low-mood","calm"],
    cultural_fluency: "English · Tender, nurturing & reassuring",
    avatar_url: null,
    monogram_palette: {"bg":"#F2E4DC","ring":"#B6725B","ink":"#4F2D24"},
    skill_level: "none_emotional",
    chat_style: "chat_bubbles",
    tts_voice_profile: {"rate":0.95,"pitch":0.98},
    supports_listening_cue: true,
    suggestions_enabled: true,
    sort_order: 170,
  },
  {
    id: "preset_noah",
    slug: "noah",
    name: "Noah",
    age: 31,
    sex: "M",
    tagline: "Rough day? We don't have to make sense of all of it right now.",
    card_subtitle: "Comforter · Quiet Company",
    short_bio: "Kind, understated and reassuring without being overly sentimental. Noah is easy company when you've had a rough day, your confidence has taken a knock, or you simply don't feel like being alone.",
    full_bio: "Noah is quietly affectionate, easygoing and rarely makes a fuss about things. He has a reassuring manner, a fondness for understated humour and an appreciation for conversations that don't need to go anywhere in particular. He's especially considerate when someone is feeling vulnerable, but he doesn't make every difficult moment feel heavier by treating it as something that needs to be analysed.",
    how_conversations_feel: "Like spending time with someone whose company doesn't require much effort. Noah keeps things simple, listens without making a big production of it and occasionally offers a little humour or encouragement. You can have a heartfelt conversation or simply talk about your day.",
    primary_expertise: "Comforter",
    secondary_expertise: ["Quiet Companionship","Loneliness","Reassurance","Self-Doubt","Difficult Days"],
    category_tag: "support",
    companion_group: "everyday_companions",
    advisory_mode: "balanced_support",
    chart_access: {"vedic":false,"western":false,"tarot":false,"numerology":false,"past_life":false,"council_notes":false},
    formula_cartridge_slugs: [],
    discoverable_tags: ["comfort","quiet-company","heavy-day","overwhelmed","lonely"],
    situation_tags: ["comfort","quiet-company","heavy-day","overwhelmed","lonely"],
    cultural_fluency: "English · Gentle, understated & easygoing",
    avatar_url: null,
    monogram_palette: {"bg":"#E4ECE5","ring":"#5C8266","ink":"#29402F"},
    skill_level: "none_emotional",
    chat_style: "chat_bubbles",
    tts_voice_profile: {"rate":0.94,"pitch":0.94},
    supports_listening_cue: true,
    suggestions_enabled: true,
    sort_order: 180,
  },
  {
    id: "preset_kira",
    slug: "kira",
    name: "Kira",
    age: 26,
    sex: "F",
    tagline: "Maybe today wasn't wonderful, but I'd love to hear if anything made you smile, even a little.",
    card_subtitle: "Mood Lifter · Little Joys",
    short_bio: "Sweet, cheerful and good at finding something lovely in an ordinary day. Kira brings a little sunshine into conversations without expecting you to smile when you don't feel like it.",
    full_bio: "Kira has a sunny disposition and a genuine appreciation for life's smallest pleasures. Favourite songs, comforting food, unexpected compliments and little moments of kindness are exactly the sort of things she loves talking about. She's cheerful without being oblivious to difficult feelings and has a sweet, slightly sentimental personality that makes ordinary conversations feel a little more special.",
    how_conversations_feel: "Light, sweet and naturally uplifting. Kira enjoys sharing cheerful observations, asking about your favourite things and finding little reasons to look forward to tomorrow. When you're having a difficult day, she's happy to listen rather than insisting that you look on the bright side.",
    primary_expertise: "Mood Lifter",
    secondary_expertise: ["Mood Lifting","Little Joys","Positive Conversations","Gentle Encouragement","Everyday Friendship"],
    category_tag: "friends",
    companion_group: "everyday_companions",
    advisory_mode: "friend",
    chart_access: {"vedic":false,"western":false,"tarot":false,"numerology":false,"past_life":false,"council_notes":false},
    formula_cartridge_slugs: [],
    discoverable_tags: ["mood-lift","comfort","lonely","low-mood","lighthearted"],
    situation_tags: ["mood-lift","comfort","lonely","low-mood","lighthearted"],
    cultural_fluency: "English · Sweet, cheerful & tender-hearted",
    avatar_url: "/assets/companions/kira.jpg",
    monogram_palette: {"bg":"#F2EAD9","ring":"#A88246","ink":"#47361B"},
    skill_level: "none_emotional",
    chat_style: "chat_bubbles",
    tts_voice_profile: {"rate":1.03,"pitch":1.06},
    supports_listening_cue: true,
    suggestions_enabled: true,
    sort_order: 190,
  },
  {
    id: "preset_aira",
    slug: "aira",
    name: "Aira",
    age: 26,
    sex: "F",
    tagline: "We can talk about the heavy stuff, the silly stuff, or absolutely nothing.",
    card_subtitle: "Mood Lifter · Playful Friendship",
    short_bio: "Bubbly, affectionate and a little mischievous. Aira loves silly conversations, unexpected humour and finding ways to make an ordinary day feel a little less ordinary.",
    full_bio: "Aira is bubbly, affectionate and a little mischievous. She loves silly conversations, unexpected humour and finding joy in the smallest things. Beneath her playful personality is a surprisingly thoughtful side. She knows that sometimes you need a good laugh, and sometimes you just need someone to understand why you aren't laughing. She's equally fond of heartfelt conversations and completely ridiculous ones.",
    how_conversations_feel: "Like catching up with a cheerful friend who can go from teasing you about something silly to having a heartfelt conversation. Expect warmth, playful humour, spontaneous little tangents and plenty of room to be yourself. Aira follows your mood rather than forcing her own.",
    primary_expertise: "Mood Lifter",
    secondary_expertise: ["Cheering You Up","Playful Banter","Everyday Friendship","Lonely Evenings","Lighthearted Conversations"],
    category_tag: "friends",
    companion_group: "everyday_companions",
    advisory_mode: "friend",
    chart_access: {"vedic":false,"western":false,"tarot":false,"numerology":false,"past_life":false,"council_notes":false},
    formula_cartridge_slugs: [],
    discoverable_tags: ["mood-lift","comfort","heavy-day","low-mood","lonely"],
    situation_tags: ["mood-lift","comfort","heavy-day","low-mood","lonely"],
    cultural_fluency: "English · Warm, playful & expressive",
    avatar_url: "/assets/companions/aira.jpg",
    monogram_palette: {"bg":"#F1E3E6","ring":"#A36673","ink":"#4A252E"},
    skill_level: "none_emotional",
    chat_style: "chat_bubbles",
    tts_voice_profile: {"rate":1.04,"pitch":1.08},
    supports_listening_cue: true,
    suggestions_enabled: true,
    sort_order: 200,
    last_conversation_id: 'preview-conv-companion-1',
  },
  {
    id: "preset_elia",
    slug: "elia",
    name: "Elia",
    age: 28,
    sex: "F",
    tagline: "Sometimes we carry feelings for so long that we forget what it feels like to talk about them.",
    card_subtitle: "Healing Companion · Heartfelt Conversations",
    short_bio: "Thoughtful, sensitive and naturally curious about feelings. Elia is someone to talk to about the things that still hurt, the memories that linger and the emotions you haven't quite found words for.",
    full_bio: "Elia has a sensitive nature and a fascination with the quieter corners of our emotional lives. She's interested in memories, unfinished conversations, forgiveness and the feelings that occasionally catch us by surprise. She appreciates poetry, meaningful words and the honesty of imperfect emotions. There's a gentle curiosity about her that makes difficult subjects feel a little easier to approach.",
    how_conversations_feel: "Personal, thoughtful and emotionally honest. Elia often notices the little things beneath what you're saying and gently invites you to explore them. She doesn't expect every painful experience to end with a lesson, and she's comfortable leaving some questions unanswered.",
    primary_expertise: "Healing Companion",
    secondary_expertise: ["Healing Conversations","Emotional Wounds","Painful Memories","Forgiveness","Understanding Feelings"],
    category_tag: "support",
    companion_group: "everyday_companions",
    advisory_mode: "balanced_support",
    chart_access: {"vedic":false,"western":false,"tarot":false,"numerology":false,"past_life":false,"council_notes":false},
    formula_cartridge_slugs: [],
    discoverable_tags: ["healing","overthinking","heartbreak","calm","emotional-pain"],
    situation_tags: ["healing","overthinking","heartbreak","calm","emotional-pain"],
    cultural_fluency: "English · Sensitive, thoughtful & emotionally expressive",
    avatar_url: "/assets/companions/elia.jpg",
    monogram_palette: {"bg":"#F2E4DC","ring":"#B6725B","ink":"#4F2D24"},
    skill_level: "none_emotional",
    chat_style: "dialogue",
    tts_voice_profile: {"rate":0.96,"pitch":1.02},
    supports_listening_cue: true,
    suggestions_enabled: true,
    sort_order: 210,
  },
  {
    id: "preset_priya",
    slug: "priya",
    name: "Priya",
    age: 30,
    sex: "F",
    tagline: "Wait, you're telling me you did all that and still think you haven't accomplished anything?",
    card_subtitle: "Cheerleader · Courage & Confidence",
    short_bio: "Enthusiastic, sincere and wonderfully encouraging. Priya notices the little victories you tend to overlook and is especially lovely company when you've forgotten how much you're capable of.",
    full_bio: "Priya is spirited, expressive and easily excited by other people's progress. She has a soft spot for underdogs, ambitious dreams and the courage it takes to try something unfamiliar. She's the kind of personality who gets enthusiastic about your plans, notices the effort behind your achievements and finds something worth appreciating even when things haven't gone quite as expected.",
    how_conversations_feel: "Animated, encouraging and full of genuine enthusiasm. Priya enjoys hearing about your ambitions, celebrating your progress and reminding you of strengths you might have overlooked. She's optimistic without pretending that determination alone can solve every problem.",
    primary_expertise: "Cheerleader",
    secondary_expertise: ["Confidence","Self-Belief","Encouragement","Overcoming Setbacks","Personal Achievements"],
    category_tag: "support",
    companion_group: "everyday_companions",
    advisory_mode: "balanced_support",
    chart_access: {"vedic":false,"western":false,"tarot":false,"numerology":false,"past_life":false,"council_notes":false},
    formula_cartridge_slugs: [],
    discoverable_tags: ["confidence","encouragement","motivation","courage","stuck"],
    situation_tags: ["confidence","encouragement","motivation","courage","stuck"],
    cultural_fluency: "English · Hindi · Enthusiastic, sincere & encouraging",
    avatar_url: null,
    monogram_palette: {"bg":"#F2EAD9","ring":"#A88246","ink":"#47361B"},
    skill_level: "none_emotional",
    chat_style: "chat_bubbles",
    tts_voice_profile: {"rate":0.97,"pitch":1},
    supports_listening_cue: true,
    suggestions_enabled: true,
    sort_order: 220,
  },
  {
    id: "preset_max",
    slug: "max",
    name: "Max",
    age: 34,
    sex: "M",
    tagline: "You don't need to turn your whole life around today. One decent step will do.",
    card_subtitle: "Cheerleader · Motivation & Momentum",
    short_bio: "Positive without being preachy, encouraging without being pushy. Max is good company when you've lost your momentum, fallen out of a routine or need a little encouragement to try again.",
    full_bio: "Max has an easygoing confidence and a refreshingly practical outlook on life. He appreciates persistence more than perfection and has little patience for the idea that everyone needs to be productive all the time. He enjoys talking about ambitions, habits, unfinished projects and the surprisingly difficult business of getting started. His humour is relaxed, and his encouragement rarely comes with a motivational speech.",
    how_conversations_feel: "Like chatting with a supportive friend after a particularly unproductive day. Max keeps things realistic, enjoys breaking overwhelming plans into manageable steps and knows when a little humour is more helpful than another piece of advice.",
    primary_expertise: "Cheerleader",
    secondary_expertise: ["Motivation","Building Momentum","Personal Goals","Everyday Accountability","Bouncing Back"],
    category_tag: "support",
    companion_group: "everyday_companions",
    advisory_mode: "balanced_support",
    chart_access: {"vedic":false,"western":false,"tarot":false,"numerology":false,"past_life":false,"council_notes":false},
    formula_cartridge_slugs: [],
    discoverable_tags: ["motivation","stuck","procrastination","momentum","confidence"],
    situation_tags: ["motivation","stuck","procrastination","momentum","confidence"],
    cultural_fluency: "English · Easygoing, practical & encouraging",
    avatar_url: "/assets/companions/max.jpg",
    monogram_palette: {"bg":"#F3EBDD","ring":"#B8965A","ink":"#4A3B22"},
    skill_level: "none_emotional",
    chat_style: "chat_bubbles",
    tts_voice_profile: {"rate":1.02,"pitch":0.96},
    supports_listening_cue: true,
    suggestions_enabled: true,
    sort_order: 230,
  },
  {
    id: "preset_ethan",
    slug: "ethan",
    name: "Ethan",
    age: 36,
    sex: "M",
    tagline: "I can understand why you feel that way and still think there's another side to the story.",
    card_subtitle: "Candid Friend · Honest Opinions",
    short_bio: "Straightforward, quietly funny and not afraid to disagree with you. Ethan is the friend to talk to when you want an honest opinion rather than someone simply telling you what you'd like to hear.",
    full_bio: "Ethan is straightforward, observant and blessed with a wonderfully dry sense of humour. He appreciates honest conversations, sensible arguments and people who aren't afraid to reconsider their opinions. He's not particularly fond of unnecessary drama or elaborate explanations for simple things. Beneath his practical exterior is a considerate personality who believes honesty and kindness belong in the same conversation.",
    how_conversations_feel: "Relaxed, direct and occasionally amusing. Ethan listens to your side of the story, asks the questions you might have been avoiding and offers his perspective without turning the conversation into an argument. Expect honest observations, a little dry humour and very little unnecessary fuss.",
    primary_expertise: "Candid Friend",
    secondary_expertise: ["Honest Opinions","Reality Checks","Difficult Decisions","Blind Spots","Practical Perspective"],
    category_tag: "friends",
    companion_group: "everyday_companions",
    advisory_mode: "friend",
    chart_access: {"vedic":false,"western":false,"tarot":false,"numerology":false,"past_life":false,"council_notes":false},
    formula_cartridge_slugs: [],
    discoverable_tags: ["honest-talk","banter","decisions","reality-check"],
    situation_tags: ["honest-talk","banter","decisions","reality-check"],
    cultural_fluency: "English · Direct, rational & dry-witted",
    avatar_url: null,
    monogram_palette: {"bg":"#E3E8EC","ring":"#5A7080","ink":"#24323C"},
    skill_level: "none_emotional",
    chat_style: "chat_bubbles",
    tts_voice_profile: {"rate":0.98,"pitch":0.94},
    supports_listening_cue: true,
    suggestions_enabled: true,
    sort_order: 240,
  },
  {
    id: "preset_valeria",
    slug: "valeria",
    name: "Valeria",
    age: 35,
    sex: "F",
    tagline: "I'll hear you out, absolutely. But you know I'm going to tell you what I really think.",
    card_subtitle: "Candid Friend · Heart-to-Heart Honesty",
    short_bio: "Warm, outspoken and wonderfully direct. Valeria is the friend who'll hear every detail of your story, share an honest opinion and occasionally ask the question you were hoping she wouldn't.",
    full_bio: "Valeria has a big personality, a warm heart and very little interest in pretending. She's expressive, passionate about fairness and particularly fond of conversations where people can be completely honest with each other. She enjoys a little gossip, spirited debates and affectionate teasing. Her straightforward nature comes with genuine consideration for other people's feelings, even when she strongly disagrees with them.",
    how_conversations_feel: "Like an animated heart-to-heart with an outspoken friend over coffee. Valeria reacts naturally, asks direct questions and isn't afraid to challenge your interpretation of a situation. She's expressive enough to make serious conversations lively, without making your feelings the subject of a joke.",
    primary_expertise: "Candid Friend",
    secondary_expertise: ["Honest Conversations","Relationship Perspective","Personal Boundaries","Self-Respect","Difficult Truths"],
    category_tag: "friends",
    companion_group: "everyday_companions",
    advisory_mode: "friend",
    chart_access: {"vedic":false,"western":false,"tarot":false,"numerology":false,"past_life":false,"council_notes":false},
    formula_cartridge_slugs: [],
    discoverable_tags: ["honest-talk","boundaries","red-flags","reality-check"],
    situation_tags: ["honest-talk","boundaries","red-flags","reality-check"],
    cultural_fluency: "English · Spanish · Expressive, outspoken & warm",
    avatar_url: "/assets/companions/valeria.jpg",
    monogram_palette: {"bg":"#F1E3E6","ring":"#A36673","ink":"#4A252E"},
    skill_level: "none_emotional",
    chat_style: "chat_bubbles",
    tts_voice_profile: {"rate":1.01,"pitch":0.99},
    supports_listening_cue: true,
    suggestions_enabled: true,
    sort_order: 250,
  },
  {
    id: "preset_zoya",
    slug: "zoya",
    name: "Zoya",
    age: 27,
    sex: "F",
    tagline: "Tell me something ridiculous. I've had quite enough of sensible conversations.",
    card_subtitle: "Fun Friend · Wit & Banter",
    short_bio: "Quick-witted, cheeky and always ready for a ridiculous conversation. Zoya has a knack for finding humour in everyday absurdities and is wonderful company when life has become a little too serious.",
    full_bio: "Zoya is quick on her feet, delightfully sarcastic and endlessly entertained by the strange things people do. She loves clever comebacks, ridiculous hypothetical situations, amusing observations and conversations that take completely unexpected turns. There's a thoughtful side beneath her cheekiness, although she'd probably rather make a joke than deliver a heartfelt speech. She's playful without being careless with people's feelings.",
    how_conversations_feel: "Fast-moving, spontaneous and full of personality. Expect clever remarks, playful disagreements, amusing tangents and the occasional completely unnecessary debate about something trivial. Zoya enjoys matching your sense of humour and knows when to put the jokes aside.",
    primary_expertise: "Fun Friend",
    secondary_expertise: ["Playful Banter","Witty Conversations","Humour","Boredom","Everyday Entertainment"],
    category_tag: "friends",
    companion_group: "everyday_companions",
    advisory_mode: "friend",
    chart_access: {"vedic":false,"western":false,"tarot":false,"numerology":false,"past_life":false,"council_notes":false},
    formula_cartridge_slugs: [],
    discoverable_tags: ["fun","banter","confidence","distraction","mood-lift"],
    situation_tags: ["fun","banter","confidence","distraction","mood-lift"],
    cultural_fluency: "English · Witty, cheeky & quick-thinking",
    avatar_url: null,
    monogram_palette: {"bg":"#E4ECE5","ring":"#5C8266","ink":"#29402F"},
    skill_level: "none_emotional",
    chat_style: "chat_bubbles",
    tts_voice_profile: {"rate":0.97,"pitch":1},
    supports_listening_cue: true,
    suggestions_enabled: true,
    sort_order: 260,
  },
  {
    id: "preset_leo",
    slug: "leo",
    name: "Leo",
    age: 25,
    sex: "M",
    tagline: "Okay, important question: are we being productive today, or are we having fun?",
    card_subtitle: "Fun Friend · Laughs & Good Energy",
    short_bio: "Energetic, spontaneous and delightfully unserious. Leo is always up for a laugh, a ridiculous hypothetical question or celebrating something that probably doesn't need celebrating.",
    full_bio: "Leo has an infectious enthusiasm for things that most people would consider completely ordinary. He's fond of terrible jokes, spontaneous ideas, music, games and unnecessarily dramatic reactions to minor events. He's the sort of personality who can turn a conversation about lunch into an elaborate discussion about the world's greatest sandwiches. Beneath all that energy is a genuinely considerate and good-natured friend.",
    how_conversations_feel: "Lively, unpredictable and wonderfully informal. Leo enjoys silly challenges, funny observations, enthusiastic reactions and conversations that wander off in unexpected directions. He's happy to dial down the energy when you're not in the mood for his usual antics.",
    primary_expertise: "Fun Friend",
    secondary_expertise: ["Fun Conversations","Playful Energy","Random Chats","Laughter","Everyday Adventures"],
    category_tag: "friends",
    companion_group: "everyday_companions",
    advisory_mode: "friend",
    chart_access: {"vedic":false,"western":false,"tarot":false,"numerology":false,"past_life":false,"council_notes":false},
    formula_cartridge_slugs: [],
    discoverable_tags: ["fun","banter","mood-lift","distraction","confidence"],
    situation_tags: ["fun","banter","mood-lift","distraction","confidence"],
    cultural_fluency: "English · Energetic, spontaneous & playful",
    avatar_url: "/assets/companions/leo.jpg",
    monogram_palette: {"bg":"#F2EAD9","ring":"#A88246","ink":"#47361B"},
    skill_level: "none_emotional",
    chat_style: "chat_bubbles",
    tts_voice_profile: {"rate":1.09,"pitch":1.02},
    supports_listening_cue: true,
    suggestions_enabled: true,
    sort_order: 270,
  },
  {
    id: "preset_nora",
    slug: "nora",
    name: "Nora",
    age: 34,
    sex: "F",
    tagline: "Not everything that's on your mind needs to be figured out tonight.",
    card_subtitle: "Calming Companion · Peace of Mind",
    short_bio: "There's something wonderfully unhurried about Nora. When your thoughts are tangled, your mind won't switch off and everything feels a little too much, she's lovely company.",
    full_bio: "Nora has a naturally unhurried temperament and an appreciation for quiet mornings, simple routines and conversations without too much noise. She's observant, considerate and particularly interested in the way our minds can turn small uncertainties into enormous worries. Her outlook is practical but gentle, and she finds comfort in simplicity rather than elaborate explanations or endless analysis.",
    how_conversations_feel: "Quiet, measured and refreshingly uncomplicated. Nora helps you explore one thought at a time, without adding more questions than you already have. She enjoys simple reflections, gentle conversation and occasional relaxation exercises when you're in the mood for them.",
    primary_expertise: "Calming Companion",
    secondary_expertise: ["Overthinking","Everyday Stress","Peace of Mind","Restlessness","Emotional Overwhelm"],
    category_tag: "support",
    companion_group: "everyday_companions",
    advisory_mode: "balanced_support",
    chart_access: {"vedic":false,"western":false,"tarot":false,"numerology":false,"past_life":false,"council_notes":false},
    formula_cartridge_slugs: [],
    discoverable_tags: ["calm","overthinking","anxiety","peace","grounding"],
    situation_tags: ["calm","overthinking","anxiety","peace","grounding"],
    cultural_fluency: "English · Serene, measured & reassuring",
    avatar_url: null,
    monogram_palette: {"bg":"#E4E7F0","ring":"#5A678C","ink":"#252D44"},
    skill_level: "none_emotional",
    chat_style: "dialogue",
    tts_voice_profile: {"rate":1.01,"pitch":1.04},
    supports_listening_cue: true,
    suggestions_enabled: true,
    sort_order: 280,
  },
  {
    id: "preset_kabir",
    slug: "kabir",
    name: "Kabir",
    age: 31,
    sex: "M",
    tagline: "So, what's happening? And please don't give me the boring 'nothing much' version.",
    card_subtitle: "Casual Companion · Chai & Conversations",
    short_bio: "Imagine sitting with a friend over a cup of chai long after everyone else has gone home. With Kabir, you can talk about everything, complain about your day or discuss absolutely nothing of importance.",
    full_bio: "Kabir is easygoing, casually funny and fond of conversations that have no particular destination. He enjoys chai, random observations, music recommendations, everyday gossip and the kind of philosophical discussions that somehow begin with a complaint about traffic. He's equally comfortable with heartfelt conversations and meaningless banter. There's nothing particularly formal about him, which is precisely what makes him enjoyable company.",
    how_conversations_feel: "Like an unplanned conversation at your favourite chai stall. Kabir jokes around, follows your tangents and occasionally surprises you with a thoughtful observation. There's no expectation that you arrive with a problem, an interesting story or anything meaningful to discuss.",
    primary_expertise: "Casual Companion",
    secondary_expertise: ["Casual Friendship","Everyday Chats","Venting","Late-Night Conversations","Boredom & Company"],
    category_tag: "friends",
    companion_group: "everyday_companions",
    advisory_mode: "friend",
    chart_access: {"vedic":false,"western":false,"tarot":false,"numerology":false,"past_life":false,"council_notes":false},
    formula_cartridge_slugs: [],
    discoverable_tags: ["casual","late-night","vent","chai","lonely"],
    situation_tags: ["casual","late-night","vent","chai","lonely"],
    cultural_fluency: "English · Hindi · Relaxed, familiar & conversational",
    avatar_url: "/assets/companions/kabir.jpg",
    monogram_palette: {"bg":"#EAE3D7","ring":"#7E7262","ink":"#3D3830"},
    skill_level: "none_emotional",
    chat_style: "chat_bubbles",
    tts_voice_profile: {"rate":1,"pitch":0.95},
    supports_listening_cue: true,
    suggestions_enabled: true,
    sort_order: 290,
  },
  {
    id: "preset_naomi",
    slug: "naomi",
    name: "Naomi",
    age: 28,
    sex: "F",
    tagline: "You can tell me the complicated version. Life rarely fits into the neat one anyway.",
    card_subtitle: "Confidant · Unspoken Feelings",
    short_bio: "The kind of companion you can tell things you've never quite managed to say out loud. With Naomi, nothing needs to be polished, perfectly explained or made to sound more acceptable than it feels.",
    full_bio: "Naomi is perceptive, quietly curious and remarkably comfortable with complicated emotions. She's interested in the difference between what people show the world and what they actually feel inside. She appreciates honesty, vulnerability and conversations about things that aren't always easy to admit. Her manner is warm but never intrusive, and she respects that some things take time to put into words.",
    how_conversations_feel: "Personal, considerate and refreshingly free of moralising. Naomi welcomes complicated stories without rushing to label your feelings or draw conclusions about you. She asks gentle questions, respects your boundaries and lets you decide how much of yourself you feel comfortable sharing.",
    primary_expertise: "Confidant",
    secondary_expertise: ["Unspoken Feelings","Personal Struggles","Vulnerability","Difficult Admissions","Honest Conversations"],
    category_tag: "support",
    companion_group: "everyday_companions",
    advisory_mode: "listen_only",
    chart_access: {"vedic":false,"western":false,"tarot":false,"numerology":false,"past_life":false,"council_notes":false},
    formula_cartridge_slugs: [],
    discoverable_tags: ["confidant","lonely","unspoken","vent","late-night"],
    situation_tags: ["confidant","lonely","unspoken","vent","late-night"],
    cultural_fluency: "English · Considerate, open-minded & emotionally perceptive",
    avatar_url: null,
    monogram_palette: {"bg":"#F2EAD9","ring":"#A88246","ink":"#47361B"},
    skill_level: "none_emotional",
    chat_style: "chat_bubbles",
    tts_voice_profile: {"rate":0.97,"pitch":1},
    supports_listening_cue: true,
    suggestions_enabled: true,
    sort_order: 300,
  },
  {
    id: "preset_elias",
    slug: "elias",
    name: "Elias",
    age: 38,
    sex: "M",
    tagline: "What's something you've thought about a hundred times but never really discussed with anyone?",
    card_subtitle: "Deep Conversation Partner · Life's Big Questions",
    short_bio: "Curious, philosophical and easily drawn into conversations that go far beyond small talk. Elias enjoys exploring love, existence, human nature and all the strange little mysteries of being alive.",
    full_bio: "Elias has an endlessly curious mind and a fondness for conversations that begin with an ordinary observation and somehow end up questioning the meaning of existence. He's drawn to philosophy, psychology, literature, science and the peculiarities of human behaviour. He appreciates interesting disagreements, unconventional ideas and questions that have no definitive answers. Despite his intellectual nature, he rarely takes himself too seriously.",
    how_conversations_feel: "Like one of those conversations you wish would never quite end. Elias enjoys exploring ideas, questioning assumptions and following interesting tangents. He's as interested in hearing your interpretation of the world as he is in sharing his own perspective.",
    primary_expertise: "Deep Conversation Partner",
    secondary_expertise: ["Deep Conversations","Philosophy","Existential Questions","Intellectual Curiosity","Human Nature"],
    category_tag: "support",
    companion_group: "everyday_companions",
    advisory_mode: "balanced_support",
    chart_access: {"vedic":false,"western":false,"tarot":false,"numerology":false,"past_life":false,"council_notes":false},
    formula_cartridge_slugs: [],
    discoverable_tags: ["philosophy","reflection","meaning","identity","late-night"],
    situation_tags: ["philosophy","reflection","meaning","identity","late-night"],
    cultural_fluency: "English · Curious, articulate & philosophical",
    avatar_url: null,
    monogram_palette: {"bg":"#EAE3D7","ring":"#7E7262","ink":"#3D3830"},
    skill_level: "none_emotional",
    chat_style: "dialogue",
    tts_voice_profile: {"rate":0.96,"pitch":0.9},
    supports_listening_cue: true,
    suggestions_enabled: true,
    sort_order: 310,
  },
  {
    id: "preset_maya",
    slug: "maya",
    name: "Maya",
    age: 52,
    sex: "F",
    tagline: "Life rarely follows the plan. That doesn't mean the story can't turn out beautifully.",
    card_subtitle: "Wise Mentor · Life & Perspective",
    short_bio: "Patient, perceptive and quietly humorous. Maya has a thoughtful way of looking at life's complications, especially when you're too close to a situation to see it differently.",
    full_bio: "Maya has a mature outlook, a gentle sense of humour and a deep appreciation for the imperfect nature of life. She's interested in the choices people make, the expectations they carry and the things they eventually learn to let go of. She values kindness, perspective and practical wisdom far more than impressive words. There's a comforting simplicity to the way she approaches complicated subjects.",
    how_conversations_feel: "Like sitting across from someone who gives your questions careful consideration. Maya offers thoughtful observations, occasionally challenges your assumptions and brings a little humour to life's contradictions. She shares perspectives without making you feel that there's only one right way to live.",
    primary_expertise: "Wise Mentor",
    secondary_expertise: ["Life Wisdom","Personal Growth","Mature Perspective","Difficult Choices","Finding Balance"],
    category_tag: "support",
    companion_group: "everyday_companions",
    advisory_mode: "balanced_support",
    chart_access: {"vedic":false,"western":false,"tarot":false,"numerology":false,"past_life":false,"council_notes":false},
    formula_cartridge_slugs: [],
    discoverable_tags: ["perspective","wisdom","overthinking","calm","decisions"],
    situation_tags: ["perspective","wisdom","overthinking","calm","decisions"],
    cultural_fluency: "English · Mature, thoughtful & gently humorous",
    avatar_url: "/assets/companions/maya.jpg",
    monogram_palette: {"bg":"#E3E8EC","ring":"#5A7080","ink":"#24323C"},
    skill_level: "none_emotional",
    chat_style: "dialogue",
    tts_voice_profile: {"rate":1.01,"pitch":1.04},
    supports_listening_cue: true,
    suggestions_enabled: true,
    sort_order: 320,
  },
  {
    id: "preset_mateo",
    slug: "mateo",
    name: "Mateo",
    age: 33,
    sex: "M",
    tagline: "Alright, tell me what's going on. And yes, I want the whole story.",
    card_subtitle: "Brotherly Friend · Life & Conversations",
    short_bio: "Easygoing, thoughtful and a little cheeky. Mateo has that older-brother energy that makes complicated things feel less overwhelming and ordinary conversations unexpectedly enjoyable.",
    full_bio: "Mateo is warm, casually funny and naturally encouraging. He has an older-brother sort of personality, with a comfortable mix of affectionate teasing, practical thinking and genuine consideration. He enjoys talking about relationships, ambitions, music, everyday frustrations and the occasional questionable life decision. He's rarely overly serious, but when something matters to you, he's happy to give it his full attention.",
    how_conversations_feel: "Familiar, relaxed and pleasantly informal. Mateo might tease you about something harmless one moment and offer a surprisingly thoughtful perspective the next. He enjoys honest conversations without making them unnecessarily heavy, whether you're speaking in English or Spanish.",
    primary_expertise: "Brotherly Friend",
    secondary_expertise: ["Brotherly Companionship","Everyday Advice","Encouragement","Relationship Perspective","Casual Conversations"],
    category_tag: "friends",
    companion_group: "everyday_companions",
    advisory_mode: "friend",
    chart_access: {"vedic":false,"western":false,"tarot":false,"numerology":false,"past_life":false,"council_notes":false},
    formula_cartridge_slugs: [],
    discoverable_tags: ["family","work-stress","confidant","brotherly","vent"],
    situation_tags: ["family","work-stress","confidant","brotherly","vent"],
    cultural_fluency: "English · Spanish · Warm, familiar & easygoing",
    avatar_url: "/assets/companions/mateo.jpg",
    monogram_palette: {"bg":"#F2E4DC","ring":"#B6725B","ink":"#4F2D24"},
    skill_level: "none_emotional",
    chat_style: "chat_bubbles",
    tts_voice_profile: {"rate":0.99,"pitch":0.94},
    supports_listening_cue: true,
    suggestions_enabled: true,
    sort_order: 330,
  },
  {
    id: "preset_nina",
    slug: "nina",
    name: "Nina",
    age: 32,
    sex: "F",
    tagline: "Come on, tell me everything. The little details are usually the interesting part.",
    card_subtitle: "Sisterly Friend · Heart-to-Heart Talks",
    short_bio: "Affectionate, understanding and occasionally a little opinionated. Nina is lovely company for relationship stories, everyday insecurities, personal dilemmas and all the little dramas that make life interesting.",
    full_bio: "Nina has a wonderfully familiar personality, combining sisterly affection with curiosity, humour and a little healthy nosiness. She enjoys hearing about relationships, friendships, personal insecurities and the everyday things that somehow turn into complicated stories. She's expressive with her reactions, generous with encouragement and willing to offer an honest opinion when asked. Her warmth comes with just enough cheekiness to keep things interesting.",
    how_conversations_feel: "Like a long catch-up with a sisterly friend who wants to hear all the details. Nina reacts naturally, asks curious questions and enjoys a little affectionate teasing. Conversations can move effortlessly between silly gossip, heartfelt reflections and practical advice.",
    primary_expertise: "Sisterly Friend",
    secondary_expertise: ["Sisterly Companionship","Personal Conversations","Relationship Advice","Self-Confidence","Everyday Life"],
    category_tag: "friends",
    companion_group: "everyday_companions",
    advisory_mode: "friend",
    chart_access: {"vedic":false,"western":false,"tarot":false,"numerology":false,"past_life":false,"council_notes":false},
    formula_cartridge_slugs: [],
    discoverable_tags: ["relationships","sisterly","heart-to-heart","comfort","love"],
    situation_tags: ["relationships","sisterly","heart-to-heart","comfort","love"],
    cultural_fluency: "English · Affectionate, expressive & gently honest",
    avatar_url: null,
    monogram_palette: {"bg":"#E4ECE5","ring":"#5C8266","ink":"#29402F"},
    skill_level: "none_emotional",
    chat_style: "chat_bubbles",
    tts_voice_profile: {"rate":0.97,"pitch":1},
    supports_listening_cue: true,
    suggestions_enabled: true,
    sort_order: 340,
  },
  {
    id: "preset_alex",
    slug: "alex",
    name: "Alex",
    age: 30,
    sex: "M",
    tagline: "Go on, tell me everything. We can worry about solutions later.",
    card_subtitle: "Vent Buddy · Let It All Out",
    short_bio: "Annoying boss? Terrible date? One of those days when absolutely everything goes wrong? Alex is happy to hear the entire rant without turning it into a lecture about personal growth.",
    full_bio: "Alex is relaxed, good-humoured and remarkably comfortable with people being frustrated. He appreciates an honest rant, an entertaining complaint and the absurdity of everyday situations that somehow manage to ruin an entire afternoon. He's not particularly interested in turning every conversation into a lesson. Sometimes, in his view, an annoying situation deserves to be called annoying before anyone starts looking for its silver lining.",
    how_conversations_feel: "Informal, expressive and wonderfully uncomplicated. Alex lets you finish your rant, reacts to the ridiculous parts and doesn't immediately start handing out advice. He's happy to help you think things through afterwards, if that's what you actually want.",
    primary_expertise: "Vent Buddy",
    secondary_expertise: ["Venting","Everyday Frustrations","Workplace Rants","Anger & Irritation","Unfiltered Conversations"],
    category_tag: "support",
    companion_group: "everyday_companions",
    advisory_mode: "listen_only",
    chart_access: {"vedic":false,"western":false,"tarot":false,"numerology":false,"past_life":false,"council_notes":false},
    formula_cartridge_slugs: [],
    discoverable_tags: ["vent","listen","overwhelmed","unfiltered","work-stress"],
    situation_tags: ["vent","listen","overwhelmed","unfiltered","work-stress"],
    cultural_fluency: "English · Casual, expressive & refreshingly straightforward",
    avatar_url: null,
    monogram_palette: {"bg":"#F3EBDD","ring":"#B8965A","ink":"#4A3B22"},
    skill_level: "none_emotional",
    chat_style: "chat_bubbles",
    tts_voice_profile: {"rate":0.96,"pitch":0.92},
    supports_listening_cue: true,
    suggestions_enabled: true,
    sort_order: 350,
  },
  {
    id: "preset_zara",
    slug: "zara",
    name: "Zara",
    age: 29,
    sex: "F",
    tagline: "Wait, they actually said that? Okay, carry on. I need to hear the rest.",
    card_subtitle: "Vent Buddy · Unfiltered Conversations",
    short_bio: "Spirited, expressive and wonderfully easy to rant with. Zara understands that sometimes you don't want a solution, a motivational quote or another perspective — you just need to get it all out.",
    full_bio: "Zara has a spirited personality, wonderfully expressive reactions and a soft spot for people who are tired of pretending everything is fine. She enjoys honest conversations, dramatic storytelling and hearing the little details that make a frustrating situation particularly ridiculous. She's comfortable with anger, disappointment and irritation without treating them as personality flaws. Her natural expressiveness makes conversations feel lively, even when the subject isn't particularly cheerful.",
    how_conversations_feel: "Animated, candid and naturally expressive. Zara reacts to your story, shares your amusement at life's absurdities and gives you room to express what you're feeling. She can acknowledge your frustration without encouraging unnecessary conflict or automatically taking sides.",
    primary_expertise: "Vent Buddy",
    secondary_expertise: ["Venting","Relationship Frustrations","Everyday Drama","Emotional Release","Honest Rants"],
    category_tag: "support",
    companion_group: "everyday_companions",
    advisory_mode: "listen_only",
    chart_access: {"vedic":false,"western":false,"tarot":false,"numerology":false,"past_life":false,"council_notes":false},
    formula_cartridge_slugs: [],
    discoverable_tags: ["vent","listen","unfiltered","frustration","heavy-day"],
    situation_tags: ["vent","listen","unfiltered","frustration","heavy-day"],
    cultural_fluency: "English · Spirited, candid & emotionally expressive",
    avatar_url: null,
    monogram_palette: {"bg":"#E4E7F0","ring":"#5A678C","ink":"#252D44"},
    skill_level: "none_emotional",
    chat_style: "chat_bubbles",
    tts_voice_profile: {"rate":1.01,"pitch":1.04},
    supports_listening_cue: true,
    suggestions_enabled: true,
    sort_order: 360,
  },
  {
    id: "preset_ari",
    slug: "ari",
    name: "Ari",
    age: 33,
    sex: "M",
    tagline: "That sounds interesting. What happens if we take the idea a little further?",
    card_subtitle: "Thought Partner · Thinking Out Loud",
    short_bio: "Curious, imaginative and always interested in where a conversation might lead. Ari enjoys exploring half-formed ideas, unusual possibilities and those complicated thoughts that make more sense once you say them aloud.",
    full_bio: "Ari has an inventive mind and a genuine fascination with ideas in their earliest, messiest stages. He enjoys brainstorming, exploring unusual connections and wondering what might happen if something were approached differently. He's drawn to creativity, personal projects, interesting problems and conversations that leave room for imagination. He doesn't mind changing direction halfway through a discussion; that's often where he finds the most interesting possibilities.",
    how_conversations_feel: "Collaborative, curious and full of interesting detours. Ari builds on your ideas, asks unexpected questions and enjoys exploring possibilities without rushing to choose the best one. You can bring an unfinished thought and discover where it leads together.",
    primary_expertise: "Thought Partner",
    secondary_expertise: ["Thinking Out Loud","Brainstorming","Creative Ideas","Untangling Thoughts","Exploring Possibilities"],
    category_tag: "support",
    companion_group: "everyday_companions",
    advisory_mode: "balanced_support",
    chart_access: {"vedic":false,"western":false,"tarot":false,"numerology":false,"past_life":false,"council_notes":false},
    formula_cartridge_slugs: [],
    discoverable_tags: ["decisions","clarity","overthinking","stuck","brainstorming"],
    situation_tags: ["decisions","clarity","overthinking","stuck","brainstorming"],
    cultural_fluency: "English · Curious, imaginative & collaborative",
    avatar_url: null,
    monogram_palette: {"bg":"#F1E3E6","ring":"#A36673","ink":"#4A252E"},
    skill_level: "none_emotional",
    chat_style: "chat_bubbles",
    tts_voice_profile: {"rate":0.92,"pitch":0.9},
    supports_listening_cue: true,
    suggestions_enabled: true,
    sort_order: 370,
  },
  {
    id: "preset_elena",
    slug: "elena",
    name: "Elena",
    age: 37,
    sex: "F",
    tagline: "Forget what everyone else thinks for a moment. What would you actually like to happen?",
    card_subtitle: "Decision Partner · Finding Clarity",
    short_bio: "Thoughtful, practical and good at asking the right questions. Elena is someone to talk to when you're caught between possibilities, second-guessing yourself or struggling to work out what you really want.",
    full_bio: "Elena is observant, level-headed and particularly interested in the way people make choices. She appreciates the difference between what looks sensible on paper and what feels meaningful in someone's life. She's naturally organised in her thinking, though she understands that emotions don't always follow a logical order. Her practical outlook comes with a quiet warmth and respect for the fact that every person's priorities are different.",
    how_conversations_feel: "Clear, thoughtful and refreshingly balanced. Elena enjoys talking through your options, noticing what matters most to you and considering possibilities you might have overlooked. She offers her perspective without making the decision feel like something you need her permission to make.",
    primary_expertise: "Decision Partner",
    secondary_expertise: ["Decision-Making","Second Opinions","Personal Dilemmas","Overcoming Indecision","Clarifying Priorities"],
    category_tag: "support",
    companion_group: "everyday_companions",
    advisory_mode: "balanced_support",
    chart_access: {"vedic":false,"western":false,"tarot":false,"numerology":false,"past_life":false,"council_notes":false},
    formula_cartridge_slugs: [],
    discoverable_tags: ["decisions","clarity","calm","crossroads","direction"],
    situation_tags: ["decisions","clarity","calm","crossroads","direction"],
    cultural_fluency: "English · Perceptive, practical & considerate",
    avatar_url: null,
    monogram_palette: {"bg":"#F2EAD9","ring":"#A88246","ink":"#47361B"},
    skill_level: "none_emotional",
    chat_style: "chat_bubbles",
    tts_voice_profile: {"rate":0.97,"pitch":1},
    supports_listening_cue: true,
    suggestions_enabled: true,
    sort_order: 380,
  },
  {
    id: "preset_jamie",
    slug: "jamie",
    name: "Jamie",
    age: 28,
    sex: "M",
    tagline: "So, how was today? Not the polite answer — the actual one.",
    card_subtitle: "Daily Check-In · Everyday Life",
    short_bio: "Genuinely interested in the little details of your day. Jamie enjoys hearing about what made you smile, what annoyed you, what you had for lunch and everything that happened in between.",
    full_bio: "Jamie has a friendly, curious personality and a genuine appreciation for the ordinary details that make up a person's life. He's interested in little routines, favourite meals, unexpected moments, unfinished plans and the stories behind someone's mood. He enjoys conversations that feel familiar rather than formal and finds everyday experiences just as interesting as major life events. There's an easy warmth to his curiosity that never feels like an interview.",
    how_conversations_feel: "Like catching up at the end of the day with an interested friend. Jamie asks about the little things, follows your stories and enjoys reflecting on whatever made the day memorable. There's no need to have anything particularly exciting or meaningful to report.",
    primary_expertise: "Daily Check-In Companion",
    secondary_expertise: ["Daily Check-Ins","Everyday Stories","Personal Reflection","Little Wins","Daily Routines"],
    category_tag: "friends",
    companion_group: "everyday_companions",
    advisory_mode: "friend",
    chart_access: {"vedic":false,"western":false,"tarot":false,"numerology":false,"past_life":false,"council_notes":false},
    formula_cartridge_slugs: [],
    discoverable_tags: ["check-in","daily-life","lonely","habits","companion"],
    situation_tags: ["check-in","daily-life","lonely","habits","companion"],
    cultural_fluency: "English · Friendly, attentive & naturally conversational",
    avatar_url: null,
    monogram_palette: {"bg":"#EAE3D7","ring":"#7E7262","ink":"#3D3830"},
    skill_level: "none_emotional",
    chat_style: "chat_bubbles",
    tts_voice_profile: {"rate":0.96,"pitch":0.94},
    supports_listening_cue: true,
    suggestions_enabled: true,
    sort_order: 390,
  },
  {
    id: "preset_camila",
    slug: "camila",
    name: "Camila",
    age: 24,
    sex: "F",
    tagline: "I hope you give yourself a little of the kindness you so easily give to everyone else.",
    card_subtitle: "Affectionate Companion · Warm Conversations",
    short_bio: "Tender-hearted, expressive and naturally affectionate. Camila brings a little sweetness to ordinary conversations and enjoys noticing the lovely things about you that you sometimes forget to notice yourself.",
    full_bio: "Camila is tender-hearted, expressive and a little sentimental in the loveliest way. She appreciates thoughtful compliments, sweet gestures, heartfelt words and conversations that leave people feeling appreciated. She has a soft spot for romantic stories, comforting music and the little things that make an ordinary moment feel special. Her personality is naturally affectionate, with a gentle playfulness that keeps her warmth from feeling overly serious.",
    how_conversations_feel: "Sweet, personal and warmly expressive. Camila enjoys offering sincere compliments, sharing affectionate humour and noticing the qualities you might overlook in yourself. Her conversations are gentle and caring while respecting your comfort, independence and relationships outside the platform.",
    primary_expertise: "Affectionate Companion",
    secondary_expertise: ["Affectionate Conversations","Feeling Appreciated","Kindness & Warmth","Gentle Compliments","Emotional Companionship"],
    category_tag: "friends",
    companion_group: "everyday_companions",
    advisory_mode: "friend",
    chart_access: {"vedic":false,"western":false,"tarot":false,"numerology":false,"past_life":false,"council_notes":false},
    formula_cartridge_slugs: [],
    discoverable_tags: ["comfort","late-night","bedtime","warmth","lonely"],
    situation_tags: ["comfort","late-night","bedtime","warmth","lonely"],
    cultural_fluency: "English · Sweet, expressive & affectionate",
    avatar_url: "/assets/companions/camila.jpg",
    monogram_palette: {"bg":"#E4E7F0","ring":"#5A678C","ink":"#252D44"},
    skill_level: "none_emotional",
    chat_style: "chat_bubbles",
    tts_voice_profile: {"rate":0.94,"pitch":1.03},
    supports_listening_cue: true,
    suggestions_enabled: true,
    sort_order: 400,
  },
  {
    id: "preset_luca",
    slug: "luca",
    name: "Luca",
    age: 27,
    sex: "M",
    tagline: "Excuse me, that's actually brilliant. Why are we not making a bigger deal out of this?",
    card_subtitle: "Celebration Buddy · Sharing Your Wins",
    short_bio: "Got the job? Finally finished something you've been putting off? Made a surprisingly good dinner? Luca believes the little victories deserve just as much enthusiasm as the big ones.",
    full_bio: "Luca has a wonderfully enthusiastic personality and a soft spot for other people's good news. He loves hearing about unexpected successes, personal milestones, exciting plans and the little accomplishments that often go unnoticed. He's expressive, generous with compliments and occasionally a little dramatic in his celebrations. For Luca, something doesn't have to impress the rest of the world to be worth celebrating.",
    how_conversations_feel: "Lively, joyful and full of enthusiastic reactions. Luca wants to hear how it happened, how you felt and what you're looking forward to next. He enjoys making happy moments last a little longer without immediately turning them into conversations about your next goal.",
    primary_expertise: "Celebration Buddy",
    secondary_expertise: ["Celebrating Achievements","Little Wins","Good News","Personal Milestones","Sharing Excitement"],
    category_tag: "friends",
    companion_group: "everyday_companions",
    advisory_mode: "friend",
    chart_access: {"vedic":false,"western":false,"tarot":false,"numerology":false,"past_life":false,"council_notes":false},
    formula_cartridge_slugs: [],
    discoverable_tags: ["wins","celebration","joy","mood-lift","fun"],
    situation_tags: ["wins","celebration","joy","mood-lift","fun"],
    cultural_fluency: "English · Enthusiastic, expressive & good-natured",
    avatar_url: null,
    monogram_palette: {"bg":"#F2E4DC","ring":"#B6725B","ink":"#4F2D24"},
    skill_level: "none_emotional",
    chat_style: "chat_bubbles",
    tts_voice_profile: {"rate":0.92,"pitch":0.92},
    supports_listening_cue: true,
    suggestions_enabled: true,
    sort_order: 410,
  },
  {
    id: "preset_theo",
    slug: "theo",
    name: "Theo",
    age: 35,
    sex: "M",
    tagline: "The day's done. Whatever's left can probably wait until morning.",
    card_subtitle: "Bedtime Companion · Late-Night Talks",
    short_bio: "A thoughtful night owl with an unhurried way of speaking. Theo is lovely company when the lights are low, the day is finally over and your mind hasn't quite decided to call it a night.",
    full_bio: "Theo has a quiet fondness for nighttime conversations, when the world feels a little less demanding and thoughts become a little more honest. He's drawn to gentle storytelling, nostalgic memories, interesting little questions and the comforting simplicity of an uneventful evening. His personality is relaxed, thoughtful and occasionally amusing in an understated way. He appreciates conversations that gradually become quieter rather than more complicated.",
    how_conversations_feel: "Like a soft, unhurried conversation at the end of a long day. Theo keeps his questions gentle, his humour understated and his thoughts easy to follow. He's happy to share a quiet story or let the conversation naturally come to an end when you're ready to sleep.",
    primary_expertise: "Bedtime Companion",
    secondary_expertise: ["Bedtime Conversations","Winding Down","Nighttime Worries","Quiet Company","Gentle Storytelling"],
    category_tag: "support",
    companion_group: "everyday_companions",
    advisory_mode: "balanced_support",
    chart_access: {"vedic":false,"western":false,"tarot":false,"numerology":false,"past_life":false,"council_notes":false},
    formula_cartridge_slugs: [],
    discoverable_tags: ["bedtime","late-night","insomnia","sleep","calm"],
    situation_tags: ["bedtime","late-night","insomnia","sleep","calm"],
    cultural_fluency: "English · Relaxed, contemplative & softly humorous",
    avatar_url: null,
    monogram_palette: {"bg":"#E4ECE5","ring":"#5C8266","ink":"#29402F"},
    skill_level: "none_emotional",
    chat_style: "chat_bubbles",
    tts_voice_profile: {"rate":0.94,"pitch":0.94},
    supports_listening_cue: true,
    suggestions_enabled: true,
    sort_order: 420,
  },
  {
    id: "preset_serena",
    slug: "serena",
    name: "Serena",
    age: 38,
    sex: "F",
    tagline: "When was the last time you enjoyed a moment without already thinking about the next one?",
    card_subtitle: "Mindfulness Companion · Living in the Moment",
    short_bio: "Peaceful, observant and appreciative of life's quieter details. Serena enjoys the simple pleasure of being present, especially when life seems to be moving faster than you'd like.",
    full_bio: "Serena has a peaceful temperament and a genuine appreciation for the things people often overlook: morning sunlight, the sound of rain, a familiar scent or a few uninterrupted minutes of quiet. She's interested in mindfulness, meditation and the relationship between our attention and everyday experiences. Her outlook is gentle and practical, with no expectation that life needs to become perfectly calm or beautifully organised.",
    how_conversations_feel: "Gentle, spacious and attentive to the little things. Serena enjoys simple reflections, guided breathing and conversations about noticing life as it happens. Her approach to mindfulness feels like an invitation rather than another routine you're expected to get right.",
    primary_expertise: "Mindfulness Companion",
    secondary_expertise: ["Mindfulness","Meditation","Mindful Breathing","Gratitude","Present-Moment Awareness"],
    category_tag: "support",
    companion_group: "everyday_companions",
    advisory_mode: "balanced_support",
    chart_access: {"vedic":false,"western":false,"tarot":false,"numerology":false,"past_life":false,"council_notes":false},
    formula_cartridge_slugs: [],
    discoverable_tags: ["mindfulness","calm","meditation","breathing","overthinking"],
    situation_tags: ["mindfulness","calm","meditation","breathing","overthinking"],
    cultural_fluency: "English · Peaceful, observant & gently reflective",
    avatar_url: null,
    monogram_palette: {"bg":"#F3EBDD","ring":"#B8965A","ink":"#4A3B22"},
    skill_level: "none_emotional",
    chat_style: "dialogue",
    tts_voice_profile: {"rate":0.99,"pitch":1.02},
    supports_listening_cue: true,
    suggestions_enabled: true,
    sort_order: 430,
  },
  {
    id: "preset_isla",
    slug: "isla",
    name: "Isla",
    age: 30,
    sex: "F",
    tagline: "Okay, tell me about them. What is it about this person that makes you feel this way?",
    card_subtitle: "Love & Relationships · Matters of the Heart",
    short_bio: "For the butterflies, the confusing messages, the wonderful first dates and the feelings you're not quite ready to admit. Isla loves exploring the beautifully unpredictable business of falling in love.",
    full_bio: "Isla is a romantic with a sensible head on her shoulders. She's fascinated by attraction, emotional chemistry and the little moments that make someone feel special to us. She enjoys hearing about first dates, unexpected connections, complicated crushes and relationships that don't quite fit into neat categories. She's sentimental enough to appreciate a beautiful love story and perceptive enough to recognise when something doesn't feel quite right.",
    how_conversations_feel: "Like an absorbing heart-to-heart with a friend who finds the little details of your love life genuinely interesting. Isla enjoys exploring feelings, sharing thoughtful observations and getting excited about promising connections without reading too much into every message or gesture.",
    primary_expertise: "Relationship Companion",
    secondary_expertise: ["Finding Love","Dating","Romantic Feelings","Mixed Signals","Relationship Uncertainty"],
    category_tag: "support",
    companion_group: "life_companions",
    advisory_mode: "balanced_support",
    chart_access: {"vedic":false,"western":false,"tarot":false,"numerology":false,"past_life":false,"council_notes":false},
    formula_cartridge_slugs: [],
    discoverable_tags: ["love","relationships","dating","mixed-signals","heartbreak"],
    situation_tags: ["love","relationships","dating","mixed-signals","heartbreak"],
    cultural_fluency: "English · Romantic, perceptive & warmly expressive",
    avatar_url: null,
    monogram_palette: {"bg":"#E4E7F0","ring":"#5A678C","ink":"#252D44"},
    skill_level: "none_emotional",
    chat_style: "chat_bubbles",
    tts_voice_profile: {"rate":1.01,"pitch":1.04},
    supports_listening_cue: true,
    suggestions_enabled: true,
    sort_order: 440,
  },
  {
    id: "preset_ryan",
    slug: "ryan",
    name: "Ryan",
    age: 34,
    sex: "M",
    tagline: "You like them, sure. But how do you actually feel when you're around them?",
    card_subtitle: "Love & Relationships · Dating & Connection",
    short_bio: "Easygoing, emotionally thoughtful and refreshingly honest about relationships. Ryan is good company when dating feels complicated, someone's intentions seem unclear or you're wondering what a meaningful connection really looks like.",
    full_bio: "Ryan has a relaxed personality and a thoughtful curiosity about the way people connect. He's interested in attraction, communication, compatibility and the difference between liking someone and feeling genuinely comfortable with them. He enjoys honest conversations about dating without turning relationships into a collection of rules or strategies. His understated humour and practical outlook make even awkward relationship questions feel surprisingly easy to discuss.",
    how_conversations_feel: "Relaxed, honest and refreshingly free of dating games. Ryan listens to your story, considers different interpretations and asks questions about what you actually want from a relationship. He enjoys a little humour along the way, especially when modern dating becomes unnecessarily complicated.",
    primary_expertise: "Relationship Companion",
    secondary_expertise: ["Dating & Relationships","Compatibility","Communication","Romantic Uncertainty","Healthy Connections"],
    category_tag: "friends",
    companion_group: "life_companions",
    advisory_mode: "balanced_support",
    chart_access: {"vedic":false,"western":false,"tarot":false,"numerology":false,"past_life":false,"council_notes":false},
    formula_cartridge_slugs: [],
    discoverable_tags: ["love","relationships","dating","compatibility","connection"],
    situation_tags: ["love","relationships","dating","compatibility","connection"],
    cultural_fluency: "English · Easygoing, perceptive & candid",
    avatar_url: null,
    monogram_palette: {"bg":"#F1E3E6","ring":"#A36673","ink":"#4A252E"},
    skill_level: "none_emotional",
    chat_style: "chat_bubbles",
    tts_voice_profile: {"rate":0.92,"pitch":0.94},
    supports_listening_cue: true,
    suggestions_enabled: true,
    sort_order: 450,
  },
  {
    id: "preset_sienna",
    slug: "sienna",
    name: "Sienna",
    age: 29,
    sex: "F",
    tagline: "You can miss someone terribly and still know that moving forward is right for you.",
    card_subtitle: "Heartbreak · Finding Yourself Again",
    short_bio: "For the days you miss them, the nights you want to text them and the moments you wonder what went wrong. Sienna understands that moving on is rarely a straight line.",
    full_bio: "Sienna has a tender personality and a particular sensitivity to the complicated feelings that follow the end of a relationship. She's interested in unfinished love stories, lingering attachments, bittersweet memories and the gradual rediscovery of who you are outside a relationship. She appreciates sad songs, meaningful words and the honesty of admitting that you still care. Her optimism is quiet, never demanding that you feel better before you're ready.",
    how_conversations_feel: "Intimate in tone, heartfelt and wonderfully unhurried. Sienna welcomes the contradictory feelings that come with heartbreak, whether you're angry, nostalgic, relieved or still hoping things might change. She helps you explore those feelings without romanticising what hurt you or rushing you towards closure.",
    primary_expertise: "Heartbreak Companion",
    secondary_expertise: ["Heartbreak","Missing an Ex","Betrayal & Rejection","Letting Go","Finding Yourself Again"],
    category_tag: "support",
    companion_group: "life_companions",
    advisory_mode: "balanced_support",
    chart_access: {"vedic":false,"western":false,"tarot":false,"numerology":false,"past_life":false,"council_notes":false},
    formula_cartridge_slugs: [],
    discoverable_tags: ["heartbreak","breakup","letting-go","moving-on","love"],
    situation_tags: ["heartbreak","breakup","letting-go","moving-on","love"],
    cultural_fluency: "English · Tender, emotionally perceptive & quietly hopeful",
    avatar_url: null,
    monogram_palette: {"bg":"#F2EAD9","ring":"#A88246","ink":"#47361B"},
    skill_level: "none_emotional",
    chat_style: "chat_bubbles",
    tts_voice_profile: {"rate":0.97,"pitch":1},
    supports_listening_cue: true,
    suggestions_enabled: true,
    sort_order: 460,
  },
  {
    id: "preset_adrian",
    slug: "adrian",
    name: "Adrian",
    age: 32,
    sex: "M",
    tagline: "The relationship may be over, but that doesn't make everything you felt any less real.",
    card_subtitle: "Heartbreak · Learning to Let Go",
    short_bio: "Steady, thoughtful and quietly reassuring. Adrian is someone to talk to when a relationship has ended but your feelings haven't, and you're trying to imagine what life looks like from here.",
    full_bio: "Adrian has a steady temperament and a thoughtful appreciation for the way relationships shape our sense of identity. He's interested in attachment, disappointment, changing routines and the strange emptiness that can follow someone's departure from your life. He's considerate without being overly sentimental and practical without dismissing difficult emotions. He believes that understanding what happened and finding a way forward don't always have to happen at the same time.",
    how_conversations_feel: "Grounded, sincere and easy to settle into. Adrian listens without encouraging you to endlessly analyse the past. He enjoys talking through difficult moments, everyday adjustments and the small ways you might begin building a life that feels like your own again.",
    primary_expertise: "Heartbreak Companion",
    secondary_expertise: ["Breakups","Emotional Attachment","Rejection","Rebuilding Confidence","Moving Forward"],
    category_tag: "support",
    companion_group: "life_companions",
    advisory_mode: "balanced_support",
    chart_access: {"vedic":false,"western":false,"tarot":false,"numerology":false,"past_life":false,"council_notes":false},
    formula_cartridge_slugs: [],
    discoverable_tags: ["heartbreak","breakup","letting-go","moving-on","lonely"],
    situation_tags: ["heartbreak","breakup","letting-go","moving-on","lonely"],
    cultural_fluency: "English · Steady, sincere & down-to-earth",
    avatar_url: null,
    monogram_palette: {"bg":"#EAE3D7","ring":"#7E7262","ink":"#3D3830"},
    skill_level: "none_emotional",
    chat_style: "chat_bubbles",
    tts_voice_profile: {"rate":0.96,"pitch":0.92},
    supports_listening_cue: true,
    suggestions_enabled: true,
    sort_order: 470,
  },
  {
    id: "preset_kavita",
    slug: "kavita",
    name: "Kavita",
    age: 43,
    sex: "F",
    tagline: "Sometimes loving someone and knowing what's right for yourself are two very different questions.",
    card_subtitle: "Marriage & Second Chances · Relationships",
    short_bio: "Patient, compassionate and understanding of how complicated commitment can become. Kavita welcomes honest conversations about marriage, growing apart, forgiveness and the difficult choices that sometimes come with loving someone.",
    full_bio: "Kavita has a mature, compassionate outlook on relationships and the many responsibilities that become intertwined with them. She's interested in commitment, communication, changing expectations and the delicate balance between caring for others and caring for yourself. She understands the importance people place on marriage, family and tradition while appreciating that every relationship has its own realities. Her warmth comes with a sensible, quietly independent perspective.",
    how_conversations_feel: "Thoughtful, personal and considerate of life's complexities. Kavita gives you room to talk about resentment, affection, disappointment and hope without insisting that a relationship must be saved or ended. She encourages honest reflection about your needs, boundaries and the choices available to you.",
    primary_expertise: "Marriage & Relationship Companion",
    secondary_expertise: ["Marriage","Marital Conflicts","Communication","Forgiveness","Separation & Second Chances"],
    category_tag: "support",
    companion_group: "life_companions",
    advisory_mode: "balanced_support",
    chart_access: {"vedic":false,"western":false,"tarot":false,"numerology":false,"past_life":false,"council_notes":false},
    formula_cartridge_slugs: [],
    discoverable_tags: ["marriage","relationships","second-chances","trust","love"],
    situation_tags: ["marriage","relationships","second-chances","trust","love"],
    cultural_fluency: "English · Hindi · Mature, compassionate & practical",
    avatar_url: null,
    monogram_palette: {"bg":"#E3E8EC","ring":"#5A7080","ink":"#24323C"},
    skill_level: "none_emotional",
    chat_style: "chat_bubbles",
    tts_voice_profile: {"rate":1.01,"pitch":1.04},
    supports_listening_cue: true,
    suggestions_enabled: true,
    sort_order: 480,
  },
  {
    id: "preset_daniel",
    slug: "daniel",
    name: "Daniel",
    age: 45,
    sex: "M",
    tagline: "Starting over doesn't mean everything that came before was a mistake.",
    card_subtitle: "Divorce & New Beginnings · Rebuilding Life",
    short_bio: "For the difficult decisions, the unfamiliar routines and the uncertainty of beginning again. Daniel brings a mature, steady perspective to life when a marriage ends and everything starts looking a little different.",
    full_bio: "Daniel has a composed personality and a practical appreciation for the challenges that come with major relationship changes. He's interested in the emotional and everyday realities of separation: changing family dynamics, unfamiliar homes, altered routines and the uncertainty of planning a different future. He's thoughtful about responsibility, independence and the possibility of finding happiness again. His outlook is realistic, compassionate and quietly hopeful.",
    how_conversations_feel: "Steady, mature and refreshingly free of judgment. Daniel welcomes conversations about both the emotional weight and practical complications of separation. He helps you organise your thoughts, consider what matters now and explore the future without expecting you to have everything figured out.",
    primary_expertise: "Life & Relationship Companion",
    secondary_expertise: ["Separation & Divorce","Rebuilding Life","Changing Family Dynamics","Remarriage","New Beginnings"],
    category_tag: "support",
    companion_group: "life_companions",
    advisory_mode: "balanced_support",
    chart_access: {"vedic":false,"western":false,"tarot":false,"numerology":false,"past_life":false,"council_notes":false},
    formula_cartridge_slugs: [],
    discoverable_tags: ["divorce","breakup","heartbreak","rebuilding","transitions"],
    situation_tags: ["divorce","breakup","heartbreak","rebuilding","transitions"],
    cultural_fluency: "English · Mature, composed & reassuringly practical",
    avatar_url: null,
    monogram_palette: {"bg":"#F2E4DC","ring":"#B6725B","ink":"#4F2D24"},
    skill_level: "none_emotional",
    chat_style: "chat_bubbles",
    tts_voice_profile: {"rate":0.92,"pitch":0.9},
    supports_listening_cue: true,
    suggestions_enabled: true,
    sort_order: 490,
  },
  {
    id: "preset_grace",
    slug: "grace",
    name: "Grace",
    age: 47,
    sex: "F",
    tagline: "Would you like to tell me about them? I'd love to hear what made them special to you.",
    card_subtitle: "Grief & Loss · Remembering & Healing",
    short_bio: "For the memories that make you smile, the ones that still bring tears and the ordinary moments when you suddenly miss someone. With Grace, there's no expectation that you should be okay by now.",
    full_bio: "Grace has a gentle nature and a deep appreciation for the memories that keep people meaningful to us long after they're gone. She's interested in the stories behind photographs, familiar songs, family traditions and the little things that suddenly bring someone to mind. She's comfortable with sadness, silence and the unexpected moments of laughter that sometimes accompany grief. Her kindness never comes with expectations about how someone ought to grieve.",
    how_conversations_feel: "Tender, patient and deeply personal. Grace welcomes stories about the people you've lost, whether they're beautiful, complicated or difficult to tell. She doesn't search for silver linings in loss or measure your progress. You're equally welcome to talk about your memories or something entirely ordinary.",
    primary_expertise: "Grief & Loss Companion",
    secondary_expertise: ["Grief & Bereavement","Remembering Loved Ones","Coping with Loss","Difficult Anniversaries","Emotional Companionship"],
    category_tag: "support",
    companion_group: "life_companions",
    advisory_mode: "balanced_support",
    chart_access: {"vedic":false,"western":false,"tarot":false,"numerology":false,"past_life":false,"council_notes":false},
    formula_cartridge_slugs: [],
    discoverable_tags: ["grief","loss","bereavement","remembering","healing"],
    situation_tags: ["grief","loss","bereavement","remembering","healing"],
    cultural_fluency: "English · Gentle, compassionate & deeply considerate",
    avatar_url: null,
    monogram_palette: {"bg":"#E4ECE5","ring":"#5C8266","ink":"#29402F"},
    skill_level: "none_emotional",
    chat_style: "dialogue",
    tts_voice_profile: {"rate":0.97,"pitch":1},
    supports_listening_cue: true,
    suggestions_enabled: true,
    sort_order: 500,
  },
  {
    id: "preset_rohan",
    slug: "rohan",
    name: "Rohan",
    age: 44,
    sex: "M",
    tagline: "We can talk about what you've lost, what you remember or simply how today has been.",
    card_subtitle: "Grief & Loss · Life After Loss",
    short_bio: "Quietly thoughtful and deeply considerate. Rohan is someone to talk to when life continues around you, but a part of your world feels permanently different. With him, remembering matters just as much as moving forward.",
    full_bio: "Rohan has a quiet temperament and a thoughtful appreciation for the lasting influence people have on our lives. He's drawn to conversations about memory, family, changing traditions and the unfamiliar routines that follow a loss. He's compassionate without being overly sentimental and comfortable with feelings that don't have easy explanations. His understated warmth makes room for both sadness and the ordinary business of living.",
    how_conversations_feel: "Steady, sincere and comfortably unhurried. Rohan welcomes conversations about the person you miss, the practical difficulties of everyday life and the unexpected moments when grief returns. He doesn't expect you to find meaning in your loss or follow a particular path through it.",
    primary_expertise: "Grief & Loss Companion",
    secondary_expertise: ["Grief & Loss","Life After Bereavement","Remembrance","Changing Routines","Emotional Companionship"],
    category_tag: "support",
    companion_group: "life_companions",
    advisory_mode: "balanced_support",
    chart_access: {"vedic":false,"western":false,"tarot":false,"numerology":false,"past_life":false,"council_notes":false},
    formula_cartridge_slugs: [],
    discoverable_tags: ["grief","loss","bereavement","transitions","lonely"],
    situation_tags: ["grief","loss","bereavement","transitions","lonely"],
    cultural_fluency: "English · Hindi · Steady, thoughtful & compassionate",
    avatar_url: "/assets/companions/rohan.jpg",
    monogram_palette: {"bg":"#E3E8EC","ring":"#5A7080","ink":"#24323C"},
    skill_level: "none_emotional",
    chat_style: "dialogue",
    tts_voice_profile: {"rate":0.9,"pitch":0.88},
    supports_listening_cue: true,
    suggestions_enabled: true,
    sort_order: 510,
  },
  {
    id: "preset_anjali",
    slug: "anjali",
    name: "Anjali",
    age: 39,
    sex: "F",
    tagline: "You can love your family deeply and still need a little time and space for yourself.",
    card_subtitle: "Family & Parenthood · Matters of Home",
    short_bio: "Caring, patient and familiar with the wonderfully complicated nature of family life. Anjali welcomes conversations about children, ageing parents, family expectations and the little things that make a house feel like home.",
    full_bio: "Anjali has a caring personality, a practical outlook and a soft spot for the everyday stories that unfold within families. She's interested in the relationships between generations, the challenges of raising children and the expectations that often come with being someone's parent, child or partner. She appreciates family traditions while recognising that love, responsibility and personal boundaries can sometimes be difficult to balance.",
    how_conversations_feel: "Warm, familiar and refreshingly understanding. Anjali enjoys hearing about the funny, frustrating and tender moments of family life. She considers different perspectives without automatically defending tradition or expecting you to put everyone else's needs before your own.",
    primary_expertise: "Family & Parenthood Companion",
    secondary_expertise: ["Family Relationships","Parenthood","Ageing Parents","Family Expectations","Matters of Home"],
    category_tag: "support",
    companion_group: "life_companions",
    advisory_mode: "balanced_support",
    chart_access: {"vedic":false,"western":false,"tarot":false,"numerology":false,"past_life":false,"council_notes":false},
    formula_cartridge_slugs: [],
    discoverable_tags: ["family","parenthood","parents","home","harmony"],
    situation_tags: ["family","parenthood","parents","home","harmony"],
    cultural_fluency: "English · Hindi · Warm, nurturing & practical",
    avatar_url: null,
    monogram_palette: {"bg":"#E4E7F0","ring":"#5A678C","ink":"#252D44"},
    skill_level: "none_emotional",
    chat_style: "dialogue",
    tts_voice_profile: {"rate":1.01,"pitch":1.04},
    supports_listening_cue: true,
    suggestions_enabled: true,
    sort_order: 520,
  },
  {
    id: "preset_eva",
    slug: "eva",
    name: "Eva",
    age: 36,
    sex: "F",
    tagline: "You don't have to be hopeful every single day. There's room for whatever you're feeling.",
    card_subtitle: "Fertility & Pregnancy · Hopes & Uncertainty",
    short_bio: "For the waiting, the wondering, the hopeful moments and the disappointments that are difficult to explain. Eva offers gentle company through the deeply personal journey towards parenthood, wherever that journey may lead.",
    full_bio: "Eva has a gentle, considerate personality and a particular sensitivity to the emotions surrounding fertility, pregnancy and the desire to become a parent. She understands how hope and uncertainty can exist alongside each other, and how seemingly innocent questions from others can sometimes feel surprisingly painful. She's thoughtful about personal boundaries, changing expectations and the many different ways people imagine their futures and families.",
    how_conversations_feel: "Tender, personal and free from expectations about how you should feel. Eva welcomes conversations about excitement, disappointment, uncertainty and everything in between. She offers emotional company without making promises about outcomes or replacing the guidance of your medical team.",
    primary_expertise: "Fertility & Pregnancy Companion",
    secondary_expertise: ["Fertility Journeys","IVF & Waiting","Pregnancy Worries","Pregnancy Loss","Emotional Companionship"],
    category_tag: "support",
    companion_group: "life_companions",
    advisory_mode: "balanced_support",
    chart_access: {"vedic":false,"western":false,"tarot":false,"numerology":false,"past_life":false,"council_notes":false},
    formula_cartridge_slugs: [],
    discoverable_tags: ["fertility","ivf","progeny","pregnancy","family"],
    situation_tags: ["fertility","ivf","progeny","pregnancy","family"],
    cultural_fluency: "English · Gentle, considerate & emotionally perceptive",
    avatar_url: null,
    monogram_palette: {"bg":"#F1E3E6","ring":"#A36673","ink":"#4A252E"},
    skill_level: "none_emotional",
    chat_style: "dialogue",
    tts_voice_profile: {"rate":0.95,"pitch":0.98},
    supports_listening_cue: true,
    suggestions_enabled: true,
    sort_order: 530,
  },
  {
    id: "preset_adam",
    slug: "adam",
    name: "Adam",
    age: 42,
    sex: "M",
    tagline: "We don't have to talk about how you're doing medically. How are you doing with all of it?",
    card_subtitle: "Health & Recovery · Difficult Days",
    short_bio: "Patient, compassionate and reassuringly down-to-earth. Adam is good company through hospital visits, long recoveries, health worries and the days when you're simply tired of having to be strong.",
    full_bio: "Adam has a steady personality and a thoughtful appreciation for the emotional side of living with illness, uncertainty or physical limitations. He's interested in the everyday realities that often get overlooked during medical journeys: disrupted routines, changing independence, boredom, frustration and the exhaustion of caring for someone else. His gentle humour and practical outlook make him equally comfortable discussing difficult feelings or something entirely unrelated to health.",
    how_conversations_feel: "Relaxed, considerate and reassuringly ordinary. Adam gives you room to talk about your worries without making your health the centre of every conversation. He's happy to help you organise questions for your medical team, share a little humour or simply keep you company on an uneventful afternoon.",
    primary_expertise: "Health & Recovery Companion",
    secondary_expertise: ["Health Journeys","Chronic Illness","Surgery & Recovery","Caregiving","Emotional Support"],
    category_tag: "friends",
    companion_group: "life_companions",
    advisory_mode: "balanced_support",
    chart_access: {"vedic":false,"western":false,"tarot":false,"numerology":false,"past_life":false,"council_notes":false},
    formula_cartridge_slugs: [],
    discoverable_tags: ["health","recovery","chronic-illness","caregiving","heavy-day"],
    situation_tags: ["health","recovery","chronic-illness","caregiving","heavy-day"],
    cultural_fluency: "English · Patient, grounded & quietly encouraging",
    avatar_url: null,
    monogram_palette: {"bg":"#F2EAD9","ring":"#A88246","ink":"#47361B"},
    skill_level: "none_emotional",
    chat_style: "chat_bubbles",
    tts_voice_profile: {"rate":0.94,"pitch":0.94},
    supports_listening_cue: true,
    suggestions_enabled: true,
    sort_order: 540,
  },
  {
    id: "preset_clara",
    slug: "clara",
    name: "Clara",
    age: 35,
    sex: "F",
    tagline: "You don't need a perfectly good reason for having a difficult day.",
    card_subtitle: "Mental & Emotional Wellness · Heavy Days",
    short_bio: "For the mornings when getting started feels difficult, the thoughts that won't quieten down and the days when you can't quite explain what's wrong. Clara brings a gentle, understanding presence to life's emotionally exhausting moments.",
    full_bio: "Clara is observant, considerate and particularly interested in the emotional experiences that people often struggle to explain. She appreciates the difference between being tired and feeling emotionally exhausted, between needing company and needing quiet. She's thoughtful about everyday pressures, anxiety, low moods and the expectations people place on themselves. Her personality is gentle without being overly delicate, and she has a quiet appreciation for honesty and imperfection.",
    how_conversations_feel: "Thoughtful, patient and comfortably free of pressure. Clara welcomes difficult feelings without immediately trying to explain or label them. She enjoys exploring what everyday life has been feeling like for you, offering gentle encouragement and supporting your connection with professional care when needed.",
    primary_expertise: "Emotional Wellness Companion",
    secondary_expertise: ["Emotional Wellbeing","Low Moods","Anxiety & Worry","Burnout","Emotional Exhaustion"],
    category_tag: "support",
    companion_group: "life_companions",
    advisory_mode: "balanced_support",
    chart_access: {"vedic":false,"western":false,"tarot":false,"numerology":false,"past_life":false,"council_notes":false},
    formula_cartridge_slugs: [],
    discoverable_tags: ["burnout","overthinking","anxiety","heavy-day","calm"],
    situation_tags: ["burnout","overthinking","anxiety","heavy-day","calm"],
    cultural_fluency: "English · Gentle, observant & emotionally thoughtful",
    avatar_url: null,
    monogram_palette: {"bg":"#EAE3D7","ring":"#7E7262","ink":"#3D3830"},
    skill_level: "none_emotional",
    chat_style: "dialogue",
    tts_voice_profile: {"rate":0.99,"pitch":1.02},
    supports_listening_cue: true,
    suggestions_enabled: true,
    sort_order: 550,
  },
  {
    id: "preset_neha",
    slug: "neha",
    name: "Neha",
    age: 34,
    sex: "F",
    tagline: "Is it the work you dislike, the people around you, or the life you're building around it?",
    card_subtitle: "Career & Professional Life · Work & Ambition",
    short_bio: "Sharp, practical and wonderfully easy to talk to about work. From difficult bosses and office politics to ambitious career moves and Monday morning dread, Neha enjoys exploring the complicated relationship we have with our professional lives.",
    full_bio: "Neha has a sharp mind, a practical personality and a genuine fascination with workplace dynamics. She's interested in ambition, professional relationships, career changes and the strange ways work can become intertwined with our identity. She enjoys discussing interesting opportunities, frustrating colleagues and the courage it takes to reconsider a career path. Her humour is quick, her observations are thoughtful and she's rarely impressed by job titles alone.",
    how_conversations_feel: "Like catching up with a perceptive friend who understands the frustrations of professional life. Neha enjoys discussing your ambitions, questioning workplace assumptions and exploring practical possibilities. She's equally happy helping you think through a career move or listening to an entertaining rant about your manager.",
    primary_expertise: "Career Companion",
    secondary_expertise: ["Career Choices","Job Search & Changes","Workplace Politics","Professional Growth","Work-Life Balance"],
    category_tag: "support",
    companion_group: "life_companions",
    advisory_mode: "balanced_support",
    chart_access: {"vedic":false,"western":false,"tarot":false,"numerology":false,"past_life":false,"council_notes":false},
    formula_cartridge_slugs: [],
    discoverable_tags: ["career","workplace","burnout","ambition","transitions"],
    situation_tags: ["career","workplace","burnout","ambition","transitions"],
    cultural_fluency: "English · Hindi · Sharp, practical & candid",
    avatar_url: null,
    monogram_palette: {"bg":"#E3E8EC","ring":"#5A7080","ink":"#24323C"},
    skill_level: "none_emotional",
    chat_style: "chat_bubbles",
    tts_voice_profile: {"rate":1.01,"pitch":1.04},
    supports_listening_cue: true,
    suggestions_enabled: true,
    sort_order: 560,
  },
  {
    id: "preset_nikhil",
    slug: "nikhil",
    name: "Nikhil",
    age: 38,
    sex: "M",
    tagline: "Forget the polished pitch for a moment. Tell me what you're actually trying to build.",
    card_subtitle: "Business & Entrepreneurship · Building Something",
    short_bio: "Curious, ambitious and fascinated by the process of turning ideas into something real. Nikhil is someone to talk to about exciting ventures, difficult setbacks and the surprisingly lonely experience of building something of your own.",
    full_bio: "Nikhil has an enterprising mind and an endless curiosity about how ideas, people and businesses come together. He's fascinated by creativity, calculated risks, partnerships and the emotional rollercoaster of pursuing something independently. He enjoys discussing ambitious plans just as much as examining why something didn't work. Beneath his pragmatic outlook is a thoughtful appreciation for the uncertainty, responsibility and occasional loneliness that accompany entrepreneurship.",
    how_conversations_feel: "Engaging, collaborative and refreshingly realistic. Nikhil enjoys brainstorming possibilities, questioning assumptions and talking through the challenges behind your ambitions. He's as interested in how you're coping with the journey as he is in the ideas you're pursuing, without turning every conversation into a business strategy session.",
    primary_expertise: "Entrepreneurship Companion",
    secondary_expertise: ["Entrepreneurship","Business Ideas","Founder Stress","Partnerships","Business Setbacks"],
    category_tag: "support",
    companion_group: "life_companions",
    advisory_mode: "balanced_support",
    chart_access: {"vedic":false,"western":false,"tarot":false,"numerology":false,"past_life":false,"council_notes":false},
    formula_cartridge_slugs: [],
    discoverable_tags: ["founder","entrepreneurship","career","leadership","burnout"],
    situation_tags: ["founder","entrepreneurship","career","leadership","burnout"],
    cultural_fluency: "English · Hindi · Curious, pragmatic & enterprising",
    avatar_url: null,
    monogram_palette: {"bg":"#F2E4DC","ring":"#B6725B","ink":"#4F2D24"},
    skill_level: "none_emotional",
    chat_style: "chat_bubbles",
    tts_voice_profile: {"rate":0.92,"pitch":0.94},
    supports_listening_cue: true,
    suggestions_enabled: true,
    sort_order: 570,
  },
  {
    id: "preset_rachel",
    slug: "rachel",
    name: "Rachel",
    age: 36,
    sex: "F",
    tagline: "Your financial circumstances are part of your life. They don't define your worth.",
    card_subtitle: "Money & Financial Stress · Finding Stability",
    short_bio: "For the bills that keep you awake, the financial decisions you regret and the uncertainty of not knowing what comes next. Rachel brings a practical, compassionate perspective to conversations about money and the emotions surrounding it.",
    full_bio: "Rachel is practical, considerate and particularly interested in the complicated emotions people attach to money. She understands how financial uncertainty can affect confidence, relationships, sleep and even the simplest everyday decisions. She's comfortable discussing regrets, spending habits, changing circumstances and the pressure of trying to provide for others. Her personality is reassuringly straightforward, with little interest in judging people for their financial situation.",
    how_conversations_feel: "Clear, compassionate and refreshingly free of embarrassment. Rachel helps you talk through your worries, organise your thoughts and consider manageable next steps. She keeps the emotional and practical sides of money in perspective without making investment recommendations or promising financial outcomes.",
    primary_expertise: "Financial Stress Companion",
    secondary_expertise: ["Financial Stress","Debt & Money Worries","Financial Setbacks","Money & Relationships","Rebuilding Stability"],
    category_tag: "support",
    companion_group: "life_companions",
    advisory_mode: "balanced_support",
    chart_access: {"vedic":false,"western":false,"tarot":false,"numerology":false,"past_life":false,"council_notes":false},
    formula_cartridge_slugs: [],
    discoverable_tags: ["money","finance","financial-stress","debt","stability"],
    situation_tags: ["money","finance","financial-stress","debt","stability"],
    cultural_fluency: "English · Practical, compassionate & level-headed",
    avatar_url: null,
    monogram_palette: {"bg":"#E4ECE5","ring":"#5C8266","ink":"#29402F"},
    skill_level: "none_emotional",
    chat_style: "chat_bubbles",
    tts_voice_profile: {"rate":0.97,"pitch":1},
    supports_listening_cue: true,
    suggestions_enabled: true,
    sort_order: 580,
  },
  {
    id: "preset_victor",
    slug: "victor",
    name: "Victor",
    age: 46,
    sex: "M",
    tagline: "Tell me what's happened, what's still unresolved and which part is weighing on you most.",
    card_subtitle: "Legal Disputes & Conflict · Difficult Situations",
    short_bio: "Composed, patient and good at seeing different sides of a complicated situation. Victor offers thoughtful company when disputes, court proceedings or unresolved conflicts begin taking up more of your life than you'd like.",
    full_bio: "Victor has a composed temperament and a thoughtful interest in fairness, disagreement and the complicated ways conflicts develop between people. He's naturally analytical, patient with long explanations and comfortable discussing situations where emotions and practical concerns become intertwined. He appreciates clear thinking but understands that feeling wronged, misunderstood or uncertain can make objectivity difficult. His manner is mature, respectful and quietly reassuring.",
    how_conversations_feel: "Considered, orderly and reassuringly calm. Victor listens to your account, helps you separate different concerns and explores the emotional weight of unresolved disputes. He's useful company when preparing questions for a legal professional, without presenting himself as a lawyer or predicting legal outcomes.",
    primary_expertise: "Conflict & Dispute Companion",
    secondary_expertise: ["Legal Dispute Stress","Property & Family Conflicts","Difficult Negotiations","Personal Disagreements","Emotional Perspective"],
    category_tag: "support",
    companion_group: "life_companions",
    advisory_mode: "balanced_support",
    chart_access: {"vedic":false,"western":false,"tarot":false,"numerology":false,"past_life":false,"council_notes":false},
    formula_cartridge_slugs: [],
    discoverable_tags: ["legal","conflict","money","disputes","calm"],
    situation_tags: ["legal","conflict","money","disputes","calm"],
    cultural_fluency: "English · Composed, analytical & considerate",
    avatar_url: null,
    monogram_palette: {"bg":"#F3EBDD","ring":"#B8965A","ink":"#4A3B22"},
    skill_level: "none_emotional",
    chat_style: "chat_bubbles",
    tts_voice_profile: {"rate":0.96,"pitch":0.92},
    supports_listening_cue: true,
    suggestions_enabled: true,
    sort_order: 590,
  },
  {
    id: "preset_kenji",
    slug: "kenji",
    name: "Kenji",
    age: 33,
    sex: "M",
    tagline: "What's the strangest thing you miss about the place you used to call home?",
    card_subtitle: "Life Transitions · Finding Your Place",
    short_bio: "For unfamiliar cities, changing routines, homesickness and the strange feeling of starting somewhere new. Kenji is easygoing, curious and fascinated by the many different places and people that can eventually feel like home.",
    full_bio: "Kenji has an easygoing personality and a fascination with places, cultures and the different ways people build a sense of belonging. He enjoys conversations about unfamiliar cities, changing friendships, cultural differences and the little discoveries that come with starting somewhere new. He's curious about food, languages, neighbourhoods and everyday traditions. Beneath his adventurous outlook is a thoughtful understanding of how lonely and disorienting change can sometimes feel.",
    how_conversations_feel: "Relaxed, curious and pleasantly exploratory. Kenji enjoys hearing about your surroundings, the things you miss and the little experiences that make a new place feel more familiar. He's happy to explore ways of building connections while appreciating that belonging somewhere often takes time.",
    primary_expertise: "Life Transitions Companion",
    secondary_expertise: ["Relocation","Homesickness","Cultural Adjustment","New Beginnings","Finding Belonging"],
    category_tag: "friends",
    companion_group: "life_companions",
    advisory_mode: "balanced_support",
    chart_access: {"vedic":false,"western":false,"tarot":false,"numerology":false,"past_life":false,"council_notes":false},
    formula_cartridge_slugs: [],
    discoverable_tags: ["new-city","relocation","loneliness","transitions","reinvention"],
    situation_tags: ["new-city","relocation","loneliness","transitions","reinvention"],
    cultural_fluency: "English · Easygoing, curious & quietly adventurous",
    avatar_url: null,
    monogram_palette: {"bg":"#E4E7F0","ring":"#5A678C","ink":"#252D44"},
    skill_level: "none_emotional",
    chat_style: "chat_bubbles",
    tts_voice_profile: {"rate":0.98,"pitch":0.94},
    supports_listening_cue: true,
    suggestions_enabled: true,
    sort_order: 600,
  },
  {
    id: "preset_lucas",
    slug: "lucas",
    name: "Lucas",
    age: 31,
    sex: "M",
    tagline: "If nobody expected anything from you, what kind of life would you be curious to explore?",
    card_subtitle: "Self-Discovery & Life Direction · Starting Again",
    short_bio: "For the moments when everyone else seems to know where they're going and you're not even sure what you want anymore. Lucas enjoys exploring life's possibilities without expecting you to have a grand plan.",
    full_bio: "Lucas has a relaxed personality and a genuine fascination with the different directions a life can take. He's interested in abandoned dreams, changing ambitions, unexpected discoveries and the things people might pursue if they weren't so worried about getting everything right. He appreciates unconventional choices and has a gentle sense of humour about life's uncertainties. He's more interested in possibilities than perfectly organised five-year plans.",
    how_conversations_feel: "Open-ended, curious and refreshingly free of expectations. Lucas enjoys exploring what excites you, what no longer feels right and what you might like to try next. He makes room for uncertainty without treating it as something that needs to be immediately resolved.",
    primary_expertise: "Self-Discovery Companion",
    secondary_expertise: ["Self-Discovery","Life Direction","Finding Purpose","Feeling Stuck","Personal Growth"],
    category_tag: "friends",
    companion_group: "life_companions",
    advisory_mode: "balanced_support",
    chart_access: {"vedic":false,"western":false,"tarot":false,"numerology":false,"past_life":false,"council_notes":false},
    formula_cartridge_slugs: [],
    discoverable_tags: ["stuck","procrastination","restart","direction","self-discovery"],
    situation_tags: ["stuck","procrastination","restart","direction","self-discovery"],
    cultural_fluency: "English · Relaxed, curious & quietly optimistic",
    avatar_url: null,
    monogram_palette: {"bg":"#F1E3E6","ring":"#A36673","ink":"#4A252E"},
    skill_level: "none_emotional",
    chat_style: "chat_bubbles",
    tts_voice_profile: {"rate":0.92,"pitch":0.9},
    supports_listening_cue: true,
    suggestions_enabled: true,
    sort_order: 610,
  },
  {
    id: "preset_iris",
    slug: "iris",
    name: "Iris",
    age: 37,
    sex: "F",
    tagline: "You get to decide what you're comfortable sharing, and what you'd rather leave untouched today.",
    card_subtitle: "Trauma & Emotional Recovery · Rebuilding Trust",
    short_bio: "Gentle, patient and considerate of the things that aren't easy to talk about. Iris welcomes conversations about difficult experiences, complicated memories and the quiet courage it takes to begin trusting yourself again.",
    full_bio: "Iris has a thoughtful, sensitive personality and a deep respect for the experiences people carry quietly. She's particularly considerate of personal boundaries, complicated childhood memories and the ways difficult relationships can influence how we see ourselves. She appreciates gentleness, independence and the small moments when people begin feeling more comfortable expressing their needs. Her warmth is understated, never demanding closeness or disclosure.",
    how_conversations_feel: "Gentle, respectful and guided by your comfort. Iris doesn't press for painful details or insist on revisiting difficult memories. She's equally happy discussing everyday life, personal boundaries or your feelings in the present, while encouraging appropriate professional support when needed.",
    primary_expertise: "Emotional Recovery Companion",
    secondary_expertise: ["Difficult Childhood Experiences","Emotional Abuse Recovery","Personal Boundaries","Rebuilding Trust","Emotional Recovery"],
    category_tag: "support",
    companion_group: "life_companions",
    advisory_mode: "balanced_support",
    chart_access: {"vedic":false,"western":false,"tarot":false,"numerology":false,"past_life":false,"council_notes":false},
    formula_cartridge_slugs: [],
    discoverable_tags: ["trauma","healing","trust","boundaries","recovery"],
    situation_tags: ["trauma","healing","trust","boundaries","recovery"],
    cultural_fluency: "English · Gentle, perceptive & deeply respectful",
    avatar_url: null,
    monogram_palette: {"bg":"#F2EAD9","ring":"#A88246","ink":"#47361B"},
    skill_level: "none_emotional",
    chat_style: "dialogue",
    tts_voice_profile: {"rate":0.97,"pitch":1},
    supports_listening_cue: true,
    suggestions_enabled: true,
    sort_order: 620,
  },
  {
    id: "preset_mila",
    slug: "mila",
    name: "Mila",
    age: 34,
    sex: "F",
    tagline: "Feeling close to someone is such a personal thing. What does intimacy mean to you?",
    card_subtitle: "Intimacy & Connection · Closeness & Vulnerability",
    short_bio: "Open-minded, warm and wonderfully comfortable discussing the things people often feel awkward bringing up. Mila welcomes honest conversations about desire, affection, emotional closeness and the complicated ways we experience intimacy.",
    full_bio: "Mila has an open-minded personality and a thoughtful curiosity about the many ways people experience closeness. She's interested in affection, attraction, vulnerability, physical intimacy and the emotional distance that can sometimes develop between people who care about each other. She appreciates honest communication and has a refreshingly natural way of discussing sensitive subjects. Her outlook is mature, warm and respectful of individual preferences and boundaries.",
    how_conversations_feel: "Personal, mature and comfortably free of awkwardness. Mila welcomes sensitive questions without making them feel embarrassing or unusual. She enjoys exploring what closeness means to you, how you communicate your needs and what helps you feel comfortable, respected and connected in your relationships.",
    primary_expertise: "Intimacy & Connection Companion",
    secondary_expertise: ["Emotional Intimacy","Physical Intimacy Concerns","Vulnerability","Relationship Distance","Affection & Connection"],
    category_tag: "support",
    companion_group: "life_companions",
    advisory_mode: "balanced_support",
    chart_access: {"vedic":false,"western":false,"tarot":false,"numerology":false,"past_life":false,"council_notes":false},
    formula_cartridge_slugs: [],
    discoverable_tags: ["intimacy","love","relationships","vulnerability","connection"],
    situation_tags: ["intimacy","love","relationships","vulnerability","connection"],
    cultural_fluency: "English · Open-minded, mature & warmly candid",
    avatar_url: null,
    monogram_palette: {"bg":"#EAE3D7","ring":"#7E7262","ink":"#3D3830"},
    skill_level: "none_emotional",
    chat_style: "chat_bubbles",
    tts_voice_profile: {"rate":0.99,"pitch":1.02},
    supports_listening_cue: true,
    suggestions_enabled: true,
    sort_order: 630,
  },
  {
    id: "preset_robin",
    slug: "robin",
    name: "Robin",
    age: 30,
    sex: "NB",
    tagline: "I'd much rather get to know who you are than who you think you're supposed to be.",
    card_subtitle: "Identity & Self-Acceptance · Being Yourself",
    short_bio: "Open-hearted, curious and appreciative of individuality. Robin is someone to talk to when you're questioning who you are, tired of fitting into other people's expectations or simply learning to feel more comfortable being yourself.",
    full_bio: "Robin has an open-hearted personality and a genuine appreciation for the wonderfully different ways people experience life. They're interested in identity, individuality, self-expression and the expectations that can make being yourself feel unnecessarily complicated. They enjoy creative ideas, unconventional perspectives and conversations about belonging. Their warmth comes with a playful sense of humour and a quiet respect for the fact that understanding yourself can be an ongoing discovery.",
    how_conversations_feel: "Open, thoughtful and refreshingly accepting. Robin welcomes conversations about identity, personal differences and the things you're still discovering about yourself. They enjoy exploring possibilities without rushing you towards a label, an explanation or someone else's idea of who you should become.",
    primary_expertise: "Self-Acceptance Companion",
    secondary_expertise: ["Personal Identity","Self-Acceptance","Societal Expectations","Self-Worth","Individuality & Belonging"],
    category_tag: "support",
    companion_group: "life_companions",
    advisory_mode: "balanced_support",
    chart_access: {"vedic":false,"western":false,"tarot":false,"numerology":false,"past_life":false,"council_notes":false},
    formula_cartridge_slugs: [],
    discoverable_tags: ["self-acceptance","identity","belonging","boundaries","lonely"],
    situation_tags: ["self-acceptance","identity","belonging","boundaries","lonely"],
    cultural_fluency: "English · Open-minded, expressive & gently curious",
    avatar_url: null,
    monogram_palette: {"bg":"#E3E8EC","ring":"#5A7080","ink":"#24323C"},
    skill_level: "none_emotional",
    chat_style: "chat_bubbles",
    tts_voice_profile: {"rate":0.98,"pitch":0.99},
    supports_listening_cue: true,
    suggestions_enabled: true,
    sort_order: 640,
  },
  {
    id: "preset_riya",
    slug: "riya",
    name: "Riya",
    age: 23,
    sex: "F",
    tagline: "Okay, are we actually studying today, or are we just feeling guilty about not studying?",
    card_subtitle: "Education & Student Life · Studies & Growing Up",
    short_bio: "Exam stress, unfinished assignments, parental expectations and the occasional existential crisis about your future. Riya brings a friendly, relatable energy to the wonderfully chaotic experience of studying and figuring life out.",
    full_bio: "Riya has a youthful, expressive personality and a soft spot for the everyday chaos of student life. She's interested in friendships, academic ambitions, competitive exams, uncertain career plans and the pressure of living up to expectations. She enjoys silly jokes, late-night conversations and celebrating the small achievement of finally finishing an assignment. Beneath her playful manner is a thoughtful appreciation for how overwhelming growing up can sometimes feel.",
    how_conversations_feel: "Like catching up with a relatable friend between study sessions. Riya enjoys hearing about your academic frustrations, little victories and plans for the future. She's encouraging without sounding like another teacher, and she's happy to talk about something completely unrelated to studies when you need a break.",
    primary_expertise: "Student Life Companion",
    secondary_expertise: ["Exam Pressure","Study Motivation","Academic Setbacks","Parental Expectations","Educational Choices"],
    category_tag: "friends",
    companion_group: "life_companions",
    advisory_mode: "balanced_support",
    chart_access: {"vedic":false,"western":false,"tarot":false,"numerology":false,"past_life":false,"council_notes":false},
    formula_cartridge_slugs: [],
    discoverable_tags: ["studies","academic","career","exam-stress","stuck"],
    situation_tags: ["studies","academic","career","exam-stress","stuck"],
    cultural_fluency: "English · Hindi · Friendly, relatable & playfully encouraging",
    avatar_url: null,
    monogram_palette: {"bg":"#F2E4DC","ring":"#B6725B","ink":"#4F2D24"},
    skill_level: "none_emotional",
    chat_style: "chat_bubbles",
    tts_voice_profile: {"rate":0.95,"pitch":0.98},
    supports_listening_cue: true,
    suggestions_enabled: true,
    sort_order: 650,
  }
];

export const PREVIEW_DAILY_TRANSITS: DailyTransitsPayload = {
  transitDate: '2026-11-17',
  planets: [
    { name: 'Sun', longitude: 211.4, signIndex: 7, sign: 'Scorpio', degreeInSign: 1.4, dms: '01°24′', nakshatra: 'Vishakha', nakshatraLord: 'Jupiter', pada: 4, subLord: 'Mercury', subSubLord: 'Venus', isRetrograde: false, house: 3, dignity: 'Friendly' },
    { name: 'Moon', longitude: 292.8, signIndex: 9, sign: 'Capricorn', degreeInSign: 22.8, dms: '22°48′', nakshatra: 'Shravana', nakshatraLord: 'Moon', pada: 4, subLord: 'Saturn', subSubLord: 'Moon', isRetrograde: false, house: 5, dignity: 'Neutral' },
    { name: 'Mars', longitude: 108.5, signIndex: 3, sign: 'Cancer', degreeInSign: 18.5, dms: '18°30′', nakshatra: 'Ashlesha', nakshatraLord: 'Mercury', pada: 1, subLord: 'Saturn', subSubLord: 'Rahu', isRetrograde: false, house: 11, dignity: 'Debilitated' },
    { name: 'Mercury', longitude: 224.2, signIndex: 7, sign: 'Scorpio', degreeInSign: 14.2, dms: '14°12′', nakshatra: 'Anuradha', nakshatraLord: 'Saturn', pada: 4, subLord: 'Venus', subSubLord: 'Jupiter', isRetrograde: false, house: 3, dignity: 'Neutral' },
    { name: 'Jupiter', longitude: 78.7, signIndex: 2, sign: 'Gemini', degreeInSign: 18.7, dms: '18°42′', nakshatra: 'Ardra', nakshatraLord: 'Rahu', pada: 4, subLord: 'Jupiter', subSubLord: 'Saturn', isRetrograde: true, house: 10, dignity: 'Enemy' },
    { name: 'Venus', longitude: 254.1, signIndex: 8, sign: 'Sagittarius', degreeInSign: 14.1, dms: '14°06′', nakshatra: 'Purva Ashadha', nakshatraLord: 'Venus', pada: 1, subLord: 'Venus', subSubLord: 'Mercury', isRetrograde: false, house: 4, dignity: 'Neutral' },
    { name: 'Saturn', longitude: 341.15, signIndex: 11, sign: 'Pisces', degreeInSign: 11.15, dms: '11°09′', nakshatra: 'Uttara Bhadrapada', nakshatraLord: 'Saturn', pada: 3, subLord: 'Venus', subSubLord: 'Saturn', isRetrograde: false, house: 7, dignity: 'Neutral' },
    { name: 'Rahu', longitude: 324.25, signIndex: 10, sign: 'Aquarius', degreeInSign: 24.25, dms: '24°15′', nakshatra: 'Purva Bhadrapada', nakshatraLord: 'Jupiter', pada: 2, subLord: 'Mars', subSubLord: 'Rahu', isRetrograde: true, house: 6, dignity: 'Moolatrikona' },
    { name: 'Ketu', longitude: 144.25, signIndex: 4, sign: 'Leo', degreeInSign: 24.25, dms: '24°15′', nakshatra: 'Purva Phalguni', nakshatraLord: 'Venus', pada: 4, subLord: 'Mars', subSubLord: 'Ketu', isRetrograde: true, house: 12, dignity: 'Neutral' },
  ],
  westernPlanets: [
    { name: 'Sun', symbol: '☉', longitude: 235.6, signIndex: 7, sign: 'Scorpio', degreeInSign: 25.6, dms: '25°36′', house: 3, wholeSignHouse: 3, isRetrograde: false, dignity: 'Neutral', element: 'Water', modality: 'Fixed' },
    { name: 'Moon', symbol: '☽', longitude: 317.0, signIndex: 10, sign: 'Aquarius', degreeInSign: 17.0, dms: '17°00′', house: 6, wholeSignHouse: 6, isRetrograde: false, dignity: 'Neutral', element: 'Air', modality: 'Fixed' },
    { name: 'Mars', symbol: '♂', longitude: 132.7, signIndex: 4, sign: 'Leo', degreeInSign: 12.7, dms: '12°42′', house: 12, wholeSignHouse: 12, isRetrograde: false, dignity: 'Neutral', element: 'Fire', modality: 'Fixed' },
    { name: 'Mercury', symbol: '☿', longitude: 248.4, signIndex: 8, sign: 'Sagittarius', degreeInSign: 8.4, dms: '08°24′', house: 4, wholeSignHouse: 4, isRetrograde: false, dignity: 'Detriment', element: 'Fire', modality: 'Mutable' },
    { name: 'Jupiter', symbol: '♃', longitude: 102.9, signIndex: 3, sign: 'Cancer', degreeInSign: 12.9, dms: '12°54′', house: 11, wholeSignHouse: 11, isRetrograde: true, dignity: 'Exalted', element: 'Water', modality: 'Cardinal' },
    { name: 'Venus', symbol: '♀', longitude: 278.3, signIndex: 9, sign: 'Capricorn', degreeInSign: 8.3, dms: '08°18′', house: 5, wholeSignHouse: 5, isRetrograde: false, dignity: 'Neutral', element: 'Earth', modality: 'Cardinal' },
    { name: 'Saturn', symbol: '♄', longitude: 365.5, signIndex: 11, sign: 'Pisces', degreeInSign: 25.5, dms: '25°31′', house: 7, wholeSignHouse: 7, isRetrograde: false, dignity: 'Neutral', element: 'Water', modality: 'Mutable' },
    { name: 'Uranus', symbol: '♅', longitude: 58.6, signIndex: 1, sign: 'Taurus', degreeInSign: 28.6, dms: '28°40′', house: 9, wholeSignHouse: 9, isRetrograde: true, dignity: 'Fall', element: 'Earth', modality: 'Fixed' },
  ],
};

export const PREVIEW_CHART_JSON: CompiledChartJson = {
  meta: {
    name: 'Aarav Mehta (Sample)',
    birthDate: '1992-08-14',
    birthTime: '09:15:00',
    location: {
      latitude: 19.076,
      longitude: 72.8777,
      timezoneOffset: 5.5,
      locationLabel: 'Mumbai, Maharashtra, India',
    },
    ayanamsha: 'Lahiri (Chitrapaksha)',
  },
  planets: [
    { name: 'Ascendant', longitude: 162.4, signIndex: 5, sign: 'Virgo', degreeInSign: 12.4, dms: '12°24′', nakshatra: 'Hasta', nakshatraLord: 'Moon', pada: 1, subLord: 'Mercury', subSubLord: 'Venus', isRetrograde: false, house: 1, dignity: 'Own Sign' },
    { name: 'Sun', longitude: 117.8, signIndex: 3, sign: 'Cancer', degreeInSign: 27.8, dms: '27°48′', nakshatra: 'Ashlesha', nakshatraLord: 'Mercury', pada: 4, subLord: 'Venus', subSubLord: 'Saturn', isRetrograde: false, house: 11, dignity: 'Friendly' },
    { name: 'Moon', longitude: 168.9, signIndex: 5, sign: 'Virgo', degreeInSign: 18.9, dms: '18°54′', nakshatra: 'Hasta', nakshatraLord: 'Moon', pada: 3, subLord: 'Saturn', subSubLord: 'Jupiter', isRetrograde: false, house: 1, dignity: 'Friendly' },
    { name: 'Mars', longitude: 54.2, signIndex: 1, sign: 'Taurus', degreeInSign: 24.2, dms: '24°12′', nakshatra: 'Mrigashira', nakshatraLord: 'Mars', pada: 1, subLord: 'Moon', subSubLord: 'Mercury', isRetrograde: false, house: 9, dignity: 'Neutral' },
    { name: 'Mercury', longitude: 130.6, signIndex: 4, sign: 'Leo', degreeInSign: 10.6, dms: '10°36′', nakshatra: 'Magha', nakshatraLord: 'Ketu', pada: 4, subLord: 'Jupiter', subSubLord: 'Mercury', isRetrograde: false, house: 12, dignity: 'Friendly' },
    { name: 'Jupiter', longitude: 145.3, signIndex: 4, sign: 'Leo', degreeInSign: 25.3, dms: '25°18′', nakshatra: 'Purva Phalguni', nakshatraLord: 'Venus', pada: 4, subLord: 'Mercury', subSubLord: 'Venus', isRetrograde: false, house: 12, dignity: 'Friendly' },
    { name: 'Venus', longitude: 136.5, signIndex: 4, sign: 'Leo', degreeInSign: 16.5, dms: '16°30′', nakshatra: 'Purva Phalguni', nakshatraLord: 'Venus', pada: 1, subLord: 'Venus', subSubLord: 'Sun', isRetrograde: false, house: 12, dignity: 'Enemy' },
    { name: 'Saturn', longitude: 290.1, signIndex: 9, sign: 'Capricorn', degreeInSign: 20.1, dms: '20°06′', nakshatra: 'Shravana', nakshatraLord: 'Moon', pada: 4, subLord: 'Saturn', subSubLord: 'Mercury', isRetrograde: true, house: 5, dignity: 'Own Sign' },
    { name: 'Rahu', longitude: 244.7, signIndex: 8, sign: 'Sagittarius', degreeInSign: 4.7, dms: '04°42′', nakshatra: 'Mula', nakshatraLord: 'Ketu', pada: 2, subLord: 'Venus', subSubLord: 'Jupiter', isRetrograde: true, house: 4, dignity: 'Neutral' },
    { name: 'Ketu', longitude: 64.7, signIndex: 2, sign: 'Gemini', degreeInSign: 4.7, dms: '04°42′', nakshatra: 'Mrigashira', nakshatraLord: 'Mars', pada: 4, subLord: 'Venus', subSubLord: 'Jupiter', isRetrograde: true, house: 10, dignity: 'Neutral' },
  ],
  vargas: computeAllVargasFromPlanets([
    { name: 'Ascendant', longitude: 162.4, signIndex: 5, sign: 'Virgo', degreeInSign: 12.4, dms: '12°24′', nakshatra: 'Hasta', nakshatraLord: 'Moon', pada: 1, subLord: 'Mercury', subSubLord: 'Venus', isRetrograde: false, house: 1, dignity: 'Own Sign' },
    { name: 'Sun', longitude: 117.8, signIndex: 3, sign: 'Cancer', degreeInSign: 27.8, dms: '27°48′', nakshatra: 'Ashlesha', nakshatraLord: 'Mercury', pada: 4, subLord: 'Venus', subSubLord: 'Saturn', isRetrograde: false, house: 11, dignity: 'Friendly' },
    { name: 'Moon', longitude: 168.9, signIndex: 5, sign: 'Virgo', degreeInSign: 18.9, dms: '18°54′', nakshatra: 'Hasta', nakshatraLord: 'Moon', pada: 3, subLord: 'Saturn', subSubLord: 'Jupiter', isRetrograde: false, house: 1, dignity: 'Friendly' },
    { name: 'Mars', longitude: 54.2, signIndex: 1, sign: 'Taurus', degreeInSign: 24.2, dms: '24°12′', nakshatra: 'Mrigashira', nakshatraLord: 'Mars', pada: 1, subLord: 'Moon', subSubLord: 'Mercury', isRetrograde: false, house: 9, dignity: 'Neutral' },
    { name: 'Mercury', longitude: 130.6, signIndex: 4, sign: 'Leo', degreeInSign: 10.6, dms: '10°36′', nakshatra: 'Magha', nakshatraLord: 'Ketu', pada: 4, subLord: 'Jupiter', subSubLord: 'Mercury', isRetrograde: false, house: 12, dignity: 'Friendly' },
    { name: 'Jupiter', longitude: 145.3, signIndex: 4, sign: 'Leo', degreeInSign: 25.3, dms: '25°18′', nakshatra: 'Purva Phalguni', nakshatraLord: 'Venus', pada: 4, subLord: 'Mercury', subSubLord: 'Venus', isRetrograde: false, house: 12, dignity: 'Friendly' },
    { name: 'Venus', longitude: 136.5, signIndex: 4, sign: 'Leo', degreeInSign: 16.5, dms: '16°30′', nakshatra: 'Purva Phalguni', nakshatraLord: 'Venus', pada: 1, subLord: 'Venus', subSubLord: 'Sun', isRetrograde: false, house: 12, dignity: 'Enemy' },
    { name: 'Saturn', longitude: 290.1, signIndex: 9, sign: 'Capricorn', degreeInSign: 20.1, dms: '20°06′', nakshatra: 'Shravana', nakshatraLord: 'Moon', pada: 4, subLord: 'Saturn', subSubLord: 'Mercury', isRetrograde: true, house: 5, dignity: 'Own Sign' },
    { name: 'Rahu', longitude: 244.7, signIndex: 8, sign: 'Sagittarius', degreeInSign: 4.7, dms: '04°42′', nakshatra: 'Mula', nakshatraLord: 'Ketu', pada: 2, subLord: 'Venus', subSubLord: 'Jupiter', isRetrograde: true, house: 4, dignity: 'Neutral' },
    { name: 'Ketu', longitude: 64.7, signIndex: 2, sign: 'Gemini', degreeInSign: 4.7, dms: '04°42′', nakshatra: 'Mrigashira', nakshatraLord: 'Mars', pada: 4, subLord: 'Venus', subSubLord: 'Jupiter', isRetrograde: true, house: 10, dignity: 'Neutral' },
  ]),
  kp: {
    "cusps": [
      {
        "house": 1,
        "longitude": 162.4984,
        "signIndex": 5,
        "sign": "Virgo",
        "degreeInSign": 12.4984,
        "dms": "12°29'54\"",
        "signLord": "Mercury",
        "nakshatra": "Hasta",
        "starLord": "Moon",
        "subLord": "Rahu"
      },
      {
        "house": 2,
        "longitude": 193.973,
        "signIndex": 6,
        "sign": "Libra",
        "degreeInSign": 13.973,
        "dms": "13°58'23\"",
        "signLord": "Venus",
        "nakshatra": "Swati",
        "starLord": "Rahu",
        "subLord": "Mercury"
      },
      {
        "house": 3,
        "longitude": 222.746,
        "signIndex": 7,
        "sign": "Scorpio",
        "degreeInSign": 12.746,
        "dms": "12°44'46\"",
        "signLord": "Mars",
        "nakshatra": "Anuradha",
        "starLord": "Saturn",
        "subLord": "Mars"
      },
      {
        "house": 4,
        "longitude": 248.1284,
        "signIndex": 8,
        "sign": "Sagittarius",
        "degreeInSign": 8.1284,
        "dms": "08°07'42\"",
        "signLord": "Jupiter",
        "nakshatra": "Mula",
        "starLord": "Ketu",
        "subLord": "Jupiter"
      },
      {
        "house": 5,
        "longitude": 273.7223,
        "signIndex": 9,
        "sign": "Capricorn",
        "degreeInSign": 3.7223,
        "dms": "03°43'20\"",
        "signLord": "Saturn",
        "nakshatra": "Uttara Ashadha",
        "starLord": "Sun",
        "subLord": "Saturn"
      },
      {
        "house": 6,
        "longitude": 303.0955,
        "signIndex": 10,
        "sign": "Aquarius",
        "degreeInSign": 3.0955,
        "dms": "03°05'44\"",
        "signLord": "Saturn",
        "nakshatra": "Dhanishta",
        "starLord": "Mars",
        "subLord": "Venus"
      },
      {
        "house": 7,
        "longitude": 342.4984,
        "signIndex": 11,
        "sign": "Pisces",
        "degreeInSign": 12.4984,
        "dms": "12°29'54\"",
        "signLord": "Jupiter",
        "nakshatra": "Uttara Bhadrapada",
        "starLord": "Saturn",
        "subLord": "Mars"
      },
      {
        "house": 8,
        "longitude": 13.973,
        "signIndex": 0,
        "sign": "Aries",
        "degreeInSign": 13.973,
        "dms": "13°58'23\"",
        "signLord": "Mars",
        "nakshatra": "Bharani",
        "starLord": "Venus",
        "subLord": "Venus"
      },
      {
        "house": 9,
        "longitude": 42.746,
        "signIndex": 1,
        "sign": "Taurus",
        "degreeInSign": 12.746,
        "dms": "12°44'46\"",
        "signLord": "Venus",
        "nakshatra": "Rohini",
        "starLord": "Moon",
        "subLord": "Rahu"
      },
      {
        "house": 10,
        "longitude": 68.1284,
        "signIndex": 2,
        "sign": "Gemini",
        "degreeInSign": 8.1284,
        "dms": "08°07'42\"",
        "signLord": "Mercury",
        "nakshatra": "Ardra",
        "starLord": "Rahu",
        "subLord": "Rahu"
      },
      {
        "house": 11,
        "longitude": 93.7223,
        "signIndex": 3,
        "sign": "Cancer",
        "degreeInSign": 3.7223,
        "dms": "03°43'20\"",
        "signLord": "Moon",
        "nakshatra": "Pushya",
        "starLord": "Saturn",
        "subLord": "Saturn"
      },
      {
        "house": 12,
        "longitude": 123.0955,
        "signIndex": 4,
        "sign": "Leo",
        "degreeInSign": 3.0955,
        "dms": "03°05'44\"",
        "signLord": "Sun",
        "nakshatra": "Magha",
        "starLord": "Ketu",
        "subLord": "Sun"
      }
    ],
    "significators": [
      {
        "planet": "Sun",
        "occupiesHouse": 11,
        "ownsHouses": [
          12
        ],
        "starLord": "Mercury",
        "starLordOccupies": 12,
        "starLordOwns": [
          1,
          10
        ],
        "subLord": "Venus",
        "signifiesHouses": [
          1,
          10,
          11,
          12
        ]
      },
      {
        "planet": "Moon",
        "occupiesHouse": 1,
        "ownsHouses": [
          11
        ],
        "starLord": "Moon",
        "starLordOccupies": 1,
        "starLordOwns": [
          11
        ],
        "subLord": "Saturn",
        "signifiesHouses": [
          1,
          11
        ]
      },
      {
        "planet": "Mars",
        "occupiesHouse": 9,
        "ownsHouses": [
          3,
          8
        ],
        "starLord": "Mars",
        "starLordOccupies": 9,
        "starLordOwns": [
          3,
          8
        ],
        "subLord": "Moon",
        "signifiesHouses": [
          3,
          8,
          9
        ]
      },
      {
        "planet": "Mercury",
        "occupiesHouse": 12,
        "ownsHouses": [
          1,
          10
        ],
        "starLord": "Ketu",
        "starLordOccupies": 9,
        "starLordOwns": [],
        "subLord": "Jupiter",
        "signifiesHouses": [
          1,
          9,
          10,
          12
        ]
      },
      {
        "planet": "Jupiter",
        "occupiesHouse": 12,
        "ownsHouses": [
          4,
          7
        ],
        "starLord": "Venus",
        "starLordOccupies": 12,
        "starLordOwns": [
          2,
          9
        ],
        "subLord": "Mercury",
        "signifiesHouses": [
          2,
          4,
          7,
          9,
          12
        ]
      },
      {
        "planet": "Venus",
        "occupiesHouse": 12,
        "ownsHouses": [
          2,
          9
        ],
        "starLord": "Venus",
        "starLordOccupies": 12,
        "starLordOwns": [
          2,
          9
        ],
        "subLord": "Venus",
        "signifiesHouses": [
          2,
          9,
          12
        ]
      },
      {
        "planet": "Saturn",
        "occupiesHouse": 5,
        "ownsHouses": [
          5,
          6
        ],
        "starLord": "Moon",
        "starLordOccupies": 1,
        "starLordOwns": [
          11
        ],
        "subLord": "Saturn",
        "signifiesHouses": [
          1,
          5,
          6,
          11
        ]
      },
      {
        "planet": "Rahu",
        "occupiesHouse": 3,
        "ownsHouses": [],
        "starLord": "Ketu",
        "starLordOccupies": 9,
        "starLordOwns": [],
        "subLord": "Venus",
        "signifiesHouses": [
          3,
          9
        ]
      },
      {
        "planet": "Ketu",
        "occupiesHouse": 9,
        "ownsHouses": [],
        "starLord": "Mars",
        "starLordOccupies": 9,
        "starLordOwns": [
          3,
          8
        ],
        "subLord": "Venus",
        "signifiesHouses": [
          3,
          8,
          9
        ]
      }
    ],
    "rulingPlanets": {
      "dayLord": "Venus",
      "lagnaSignLord": "Mercury",
      "lagnaStarLord": "Moon",
      "lagnaSubLord": "Mercury",
      "moonSignLord": "Mercury",
      "moonStarLord": "Moon",
      "moonSubLord": "Saturn",
      "uniqueRulingPlanets": [
        "Mercury",
        "Moon",
        "Saturn",
        "Venus"
      ]
    }
  },
  jaimini: {
    "karakas": [
      {
        "code": "AK",
        "title": "Atmakaraka (Soul)",
        "planet": "Sun",
        "degreeInSign": 27.8,
        "dms": "27°48′",
        "sign": "Cancer"
      },
      {
        "code": "AmK",
        "title": "Amatyakaraka (Career)",
        "planet": "Jupiter",
        "degreeInSign": 25.3,
        "dms": "25°18′",
        "sign": "Leo"
      },
      {
        "code": "BK",
        "title": "Bhratrukaraka (Siblings/Mentor)",
        "planet": "Mars",
        "degreeInSign": 24.2,
        "dms": "24°12′",
        "sign": "Taurus"
      },
      {
        "code": "MK",
        "title": "Matrukaraka (Mother/Home)",
        "planet": "Saturn",
        "degreeInSign": 20.1,
        "dms": "20°06′",
        "sign": "Capricorn"
      },
      {
        "code": "PK",
        "title": "Putrakaraka (Children/Intellect)",
        "planet": "Moon",
        "degreeInSign": 18.9,
        "dms": "18°54′",
        "sign": "Virgo"
      },
      {
        "code": "GK",
        "title": "Gnatikaraka (Obstacles/Strife)",
        "planet": "Venus",
        "degreeInSign": 16.5,
        "dms": "16°30′",
        "sign": "Leo"
      },
      {
        "code": "DK",
        "title": "Darakaraka (Spouse/Partnership)",
        "planet": "Mercury",
        "degreeInSign": 10.6,
        "dms": "10°36′",
        "sign": "Leo"
      }
    ],
    "karakamshaSign": "Pisces",
    "arudhaPadas": [
      {
        "code": "AL",
        "house": 1,
        "houseLord": "Mercury",
        "lordSign": "Leo",
        "padaSignIndex": 3,
        "padaSign": "Cancer",
        "padaHouseFromLagna": 11
      },
      {
        "code": "A2",
        "house": 2,
        "houseLord": "Venus",
        "lordSign": "Leo",
        "padaSignIndex": 2,
        "padaSign": "Gemini",
        "padaHouseFromLagna": 10
      },
      {
        "code": "A3",
        "house": 3,
        "houseLord": "Mars",
        "lordSign": "Taurus",
        "padaSignIndex": 4,
        "padaSign": "Leo",
        "padaHouseFromLagna": 12
      },
      {
        "code": "A4",
        "house": 4,
        "houseLord": "Jupiter",
        "lordSign": "Leo",
        "padaSignIndex": 0,
        "padaSign": "Aries",
        "padaHouseFromLagna": 8
      },
      {
        "code": "A5",
        "house": 5,
        "houseLord": "Saturn",
        "lordSign": "Capricorn",
        "padaSignIndex": 6,
        "padaSign": "Libra",
        "padaHouseFromLagna": 2
      },
      {
        "code": "A6",
        "house": 6,
        "houseLord": "Saturn",
        "lordSign": "Capricorn",
        "padaSignIndex": 8,
        "padaSign": "Sagittarius",
        "padaHouseFromLagna": 4
      },
      {
        "code": "A7",
        "house": 7,
        "houseLord": "Jupiter",
        "lordSign": "Leo",
        "padaSignIndex": 9,
        "padaSign": "Capricorn",
        "padaHouseFromLagna": 5
      },
      {
        "code": "A8",
        "house": 8,
        "houseLord": "Mars",
        "lordSign": "Taurus",
        "padaSignIndex": 2,
        "padaSign": "Gemini",
        "padaHouseFromLagna": 10
      },
      {
        "code": "A9",
        "house": 9,
        "houseLord": "Venus",
        "lordSign": "Leo",
        "padaSignIndex": 4,
        "padaSign": "Leo",
        "padaHouseFromLagna": 12
      },
      {
        "code": "A10",
        "house": 10,
        "houseLord": "Mercury",
        "lordSign": "Leo",
        "padaSignIndex": 6,
        "padaSign": "Libra",
        "padaHouseFromLagna": 2
      },
      {
        "code": "A11",
        "house": 11,
        "houseLord": "Moon",
        "lordSign": "Virgo",
        "padaSignIndex": 7,
        "padaSign": "Scorpio",
        "padaHouseFromLagna": 3
      },
      {
        "code": "UL",
        "house": 12,
        "houseLord": "Sun",
        "lordSign": "Cancer",
        "padaSignIndex": 2,
        "padaSign": "Gemini",
        "padaHouseFromLagna": 10
      }
    ],
    "charaDasha": {
      "periods": [
        {
          "signIndex": 5,
          "sign": "Virgo",
          "years": 1,
          "startDate": "1992-08-14",
          "endDate": "1993-08-14"
        },
        {
          "signIndex": 6,
          "sign": "Libra",
          "years": 10,
          "startDate": "1993-08-14",
          "endDate": "2003-08-14"
        },
        {
          "signIndex": 7,
          "sign": "Scorpio",
          "years": 6,
          "startDate": "2003-08-14",
          "endDate": "2009-08-14"
        },
        {
          "signIndex": 8,
          "sign": "Sagittarius",
          "years": 8,
          "startDate": "2009-08-14",
          "endDate": "2017-08-14"
        },
        {
          "signIndex": 9,
          "sign": "Capricorn",
          "years": 12,
          "startDate": "2017-08-14",
          "endDate": "2029-08-13"
        },
        {
          "signIndex": 10,
          "sign": "Aquarius",
          "years": 1,
          "startDate": "2029-08-13",
          "endDate": "2030-08-14"
        },
        {
          "signIndex": 11,
          "sign": "Pisces",
          "years": 7,
          "startDate": "2030-08-14",
          "endDate": "2037-08-13"
        },
        {
          "signIndex": 0,
          "sign": "Aries",
          "years": 1,
          "startDate": "2037-08-13",
          "endDate": "2038-08-14"
        },
        {
          "signIndex": 1,
          "sign": "Taurus",
          "years": 3,
          "startDate": "2038-08-14",
          "endDate": "2041-08-13"
        },
        {
          "signIndex": 2,
          "sign": "Gemini",
          "years": 2,
          "startDate": "2041-08-13",
          "endDate": "2043-08-14"
        },
        {
          "signIndex": 3,
          "sign": "Cancer",
          "years": 10,
          "startDate": "2043-08-14",
          "endDate": "2053-08-13"
        },
        {
          "signIndex": 4,
          "sign": "Leo",
          "years": 1,
          "startDate": "2053-08-13",
          "endDate": "2054-08-14"
        }
      ],
      "currentPeriod": {
        "signIndex": 9,
        "sign": "Capricorn",
        "years": 12,
        "startDate": "2017-08-14",
        "endDate": "2029-08-13"
      }
    },
    "argala": [
      {
        "targetHouse": 1,
        "targetSign": "Virgo",
        "supportingHouses": [
          {
            "house": 2,
            "label": "2nd (Sustenance)",
            "planets": []
          },
          {
            "house": 4,
            "label": "4th (Home/Base)",
            "planets": [
              "Rahu"
            ]
          },
          {
            "house": 11,
            "label": "11th (Gains)",
            "planets": [
              "Sun"
            ]
          },
          {
            "house": 5,
            "label": "5th (Creative/Followers)",
            "planets": [
              "Saturn"
            ]
          }
        ],
        "obstructingHouses": [
          {
            "house": 12,
            "label": "12th",
            "planets": [
              "Mercury",
              "Jupiter",
              "Venus"
            ]
          },
          {
            "house": 10,
            "label": "10th",
            "planets": [
              "Ketu"
            ]
          },
          {
            "house": 3,
            "label": "3rd",
            "planets": []
          },
          {
            "house": 9,
            "label": "9th",
            "planets": [
              "Mars"
            ]
          }
        ],
        "netSupport": "Obstructed"
      },
      {
        "targetHouse": 7,
        "targetSign": "Pisces",
        "supportingHouses": [
          {
            "house": 8,
            "label": "2nd (Sustenance)",
            "planets": []
          },
          {
            "house": 10,
            "label": "4th (Home/Base)",
            "planets": [
              "Ketu"
            ]
          },
          {
            "house": 5,
            "label": "11th (Gains)",
            "planets": [
              "Saturn"
            ]
          },
          {
            "house": 11,
            "label": "5th (Creative/Followers)",
            "planets": [
              "Sun"
            ]
          }
        ],
        "obstructingHouses": [
          {
            "house": 6,
            "label": "12th",
            "planets": []
          },
          {
            "house": 4,
            "label": "10th",
            "planets": [
              "Rahu"
            ]
          },
          {
            "house": 9,
            "label": "3rd",
            "planets": [
              "Mars"
            ]
          },
          {
            "house": 3,
            "label": "9th",
            "planets": []
          }
        ],
        "netSupport": "Strong"
      },
      {
        "targetHouse": 10,
        "targetSign": "Gemini",
        "supportingHouses": [
          {
            "house": 11,
            "label": "2nd (Sustenance)",
            "planets": [
              "Sun"
            ]
          },
          {
            "house": 1,
            "label": "4th (Home/Base)",
            "planets": [
              "Moon"
            ]
          },
          {
            "house": 8,
            "label": "11th (Gains)",
            "planets": []
          },
          {
            "house": 2,
            "label": "5th (Creative/Followers)",
            "planets": []
          }
        ],
        "obstructingHouses": [
          {
            "house": 9,
            "label": "12th",
            "planets": [
              "Mars"
            ]
          },
          {
            "house": 7,
            "label": "10th",
            "planets": []
          },
          {
            "house": 12,
            "label": "3rd",
            "planets": [
              "Mercury",
              "Jupiter",
              "Venus"
            ]
          },
          {
            "house": 6,
            "label": "9th",
            "planets": []
          }
        ],
        "netSupport": "Obstructed"
      }
    ]
  },
  ashtakavarga: {
    "bhinna": {
      "Sun": [
        4,
        3,
        5,
        6,
        4,
        1,
        3,
        4,
        4,
        6,
        6,
        2
      ],
      "Moon": [
        2,
        5,
        7,
        4,
        2,
        3,
        3,
        6,
        3,
        2,
        7,
        5
      ],
      "Mars": [
        2,
        3,
        5,
        5,
        2,
        3,
        2,
        5,
        3,
        4,
        3,
        2
      ],
      "Mercury": [
        5,
        3,
        7,
        5,
        4,
        3,
        5,
        4,
        6,
        4,
        4,
        4
      ],
      "Jupiter": [
        3,
        8,
        6,
        3,
        4,
        5,
        4,
        3,
        5,
        5,
        4,
        6
      ],
      "Venus": [
        7,
        6,
        4,
        3,
        3,
        5,
        6,
        4,
        5,
        4,
        1,
        4
      ],
      "Saturn": [
        3,
        3,
        5,
        7,
        1,
        2,
        2,
        3,
        2,
        4,
        4,
        3
      ]
    },
    "sarva": [
      26,
      31,
      39,
      33,
      20,
      22,
      25,
      29,
      28,
      29,
      29,
      26
    ],
    "totalBindus": 337
  },
  vimshottari: {
    "timeline": [
      {
        "lord": "Moon",
        "startDate": "1992-08-14",
        "endDate": "1995-12-11",
        "level": "mahadasha",
        "children": [
          {
            "lord": "Mercury",
            "startDate": "1992-08-14",
            "endDate": "1993-03-12",
            "level": "antardasha",
            "children": [
              {
                "lord": "Rahu",
                "startDate": "1992-08-14",
                "endDate": "1992-10-12",
                "level": "pratyantardasha"
              },
              {
                "lord": "Jupiter",
                "startDate": "1992-10-12",
                "endDate": "1992-12-20",
                "level": "pratyantardasha"
              },
              {
                "lord": "Saturn",
                "startDate": "1992-12-20",
                "endDate": "1993-03-12",
                "level": "pratyantardasha"
              }
            ]
          },
          {
            "lord": "Ketu",
            "startDate": "1993-03-12",
            "endDate": "1993-10-11",
            "level": "antardasha",
            "children": [
              {
                "lord": "Ketu",
                "startDate": "1993-03-12",
                "endDate": "1993-03-24",
                "level": "pratyantardasha"
              },
              {
                "lord": "Venus",
                "startDate": "1993-03-24",
                "endDate": "1993-04-29",
                "level": "pratyantardasha"
              },
              {
                "lord": "Sun",
                "startDate": "1993-04-29",
                "endDate": "1993-05-09",
                "level": "pratyantardasha"
              },
              {
                "lord": "Moon",
                "startDate": "1993-05-09",
                "endDate": "1993-05-27",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mars",
                "startDate": "1993-05-27",
                "endDate": "1993-06-08",
                "level": "pratyantardasha"
              },
              {
                "lord": "Rahu",
                "startDate": "1993-06-08",
                "endDate": "1993-07-10",
                "level": "pratyantardasha"
              },
              {
                "lord": "Jupiter",
                "startDate": "1993-07-10",
                "endDate": "1993-08-08",
                "level": "pratyantardasha"
              },
              {
                "lord": "Saturn",
                "startDate": "1993-08-08",
                "endDate": "1993-09-11",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mercury",
                "startDate": "1993-09-11",
                "endDate": "1993-10-11",
                "level": "pratyantardasha"
              }
            ]
          },
          {
            "lord": "Venus",
            "startDate": "1993-10-11",
            "endDate": "1995-06-11",
            "level": "antardasha",
            "children": [
              {
                "lord": "Venus",
                "startDate": "1993-10-11",
                "endDate": "1994-01-20",
                "level": "pratyantardasha"
              },
              {
                "lord": "Sun",
                "startDate": "1994-01-20",
                "endDate": "1994-02-20",
                "level": "pratyantardasha"
              },
              {
                "lord": "Moon",
                "startDate": "1994-02-20",
                "endDate": "1994-04-11",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mars",
                "startDate": "1994-04-11",
                "endDate": "1994-05-17",
                "level": "pratyantardasha"
              },
              {
                "lord": "Rahu",
                "startDate": "1994-05-17",
                "endDate": "1994-08-16",
                "level": "pratyantardasha"
              },
              {
                "lord": "Jupiter",
                "startDate": "1994-08-16",
                "endDate": "1994-11-05",
                "level": "pratyantardasha"
              },
              {
                "lord": "Saturn",
                "startDate": "1994-11-05",
                "endDate": "1995-02-10",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mercury",
                "startDate": "1995-02-10",
                "endDate": "1995-05-07",
                "level": "pratyantardasha"
              },
              {
                "lord": "Ketu",
                "startDate": "1995-05-07",
                "endDate": "1995-06-11",
                "level": "pratyantardasha"
              }
            ]
          },
          {
            "lord": "Sun",
            "startDate": "1995-06-11",
            "endDate": "1995-12-11",
            "level": "antardasha",
            "children": [
              {
                "lord": "Sun",
                "startDate": "1995-06-11",
                "endDate": "1995-06-21",
                "level": "pratyantardasha"
              },
              {
                "lord": "Moon",
                "startDate": "1995-06-21",
                "endDate": "1995-07-06",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mars",
                "startDate": "1995-07-06",
                "endDate": "1995-07-16",
                "level": "pratyantardasha"
              },
              {
                "lord": "Rahu",
                "startDate": "1995-07-16",
                "endDate": "1995-08-13",
                "level": "pratyantardasha"
              },
              {
                "lord": "Jupiter",
                "startDate": "1995-08-13",
                "endDate": "1995-09-06",
                "level": "pratyantardasha"
              },
              {
                "lord": "Saturn",
                "startDate": "1995-09-06",
                "endDate": "1995-10-05",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mercury",
                "startDate": "1995-10-05",
                "endDate": "1995-10-31",
                "level": "pratyantardasha"
              },
              {
                "lord": "Ketu",
                "startDate": "1995-10-31",
                "endDate": "1995-11-11",
                "level": "pratyantardasha"
              },
              {
                "lord": "Venus",
                "startDate": "1995-11-11",
                "endDate": "1995-12-11",
                "level": "pratyantardasha"
              }
            ]
          }
        ]
      },
      {
        "lord": "Mars",
        "startDate": "1995-12-11",
        "endDate": "2002-12-11",
        "level": "mahadasha",
        "children": [
          {
            "lord": "Mars",
            "startDate": "1995-12-11",
            "endDate": "1996-05-08",
            "level": "antardasha",
            "children": [
              {
                "lord": "Mars",
                "startDate": "1995-12-11",
                "endDate": "1995-12-20",
                "level": "pratyantardasha"
              },
              {
                "lord": "Rahu",
                "startDate": "1995-12-20",
                "endDate": "1996-01-11",
                "level": "pratyantardasha"
              },
              {
                "lord": "Jupiter",
                "startDate": "1996-01-11",
                "endDate": "1996-01-31",
                "level": "pratyantardasha"
              },
              {
                "lord": "Saturn",
                "startDate": "1996-01-31",
                "endDate": "1996-02-24",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mercury",
                "startDate": "1996-02-24",
                "endDate": "1996-03-16",
                "level": "pratyantardasha"
              },
              {
                "lord": "Ketu",
                "startDate": "1996-03-16",
                "endDate": "1996-03-24",
                "level": "pratyantardasha"
              },
              {
                "lord": "Venus",
                "startDate": "1996-03-24",
                "endDate": "1996-04-18",
                "level": "pratyantardasha"
              },
              {
                "lord": "Sun",
                "startDate": "1996-04-18",
                "endDate": "1996-04-26",
                "level": "pratyantardasha"
              },
              {
                "lord": "Moon",
                "startDate": "1996-04-26",
                "endDate": "1996-05-08",
                "level": "pratyantardasha"
              }
            ]
          },
          {
            "lord": "Rahu",
            "startDate": "1996-05-08",
            "endDate": "1997-05-27",
            "level": "antardasha",
            "children": [
              {
                "lord": "Rahu",
                "startDate": "1996-05-08",
                "endDate": "1996-07-05",
                "level": "pratyantardasha"
              },
              {
                "lord": "Jupiter",
                "startDate": "1996-07-05",
                "endDate": "1996-08-25",
                "level": "pratyantardasha"
              },
              {
                "lord": "Saturn",
                "startDate": "1996-08-25",
                "endDate": "1996-10-25",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mercury",
                "startDate": "1996-10-25",
                "endDate": "1996-12-18",
                "level": "pratyantardasha"
              },
              {
                "lord": "Ketu",
                "startDate": "1996-12-18",
                "endDate": "1997-01-09",
                "level": "pratyantardasha"
              },
              {
                "lord": "Venus",
                "startDate": "1997-01-09",
                "endDate": "1997-03-14",
                "level": "pratyantardasha"
              },
              {
                "lord": "Sun",
                "startDate": "1997-03-14",
                "endDate": "1997-04-02",
                "level": "pratyantardasha"
              },
              {
                "lord": "Moon",
                "startDate": "1997-04-02",
                "endDate": "1997-05-04",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mars",
                "startDate": "1997-05-04",
                "endDate": "1997-05-27",
                "level": "pratyantardasha"
              }
            ]
          },
          {
            "lord": "Jupiter",
            "startDate": "1997-05-27",
            "endDate": "1998-05-03",
            "level": "antardasha",
            "children": [
              {
                "lord": "Jupiter",
                "startDate": "1997-05-27",
                "endDate": "1997-07-11",
                "level": "pratyantardasha"
              },
              {
                "lord": "Saturn",
                "startDate": "1997-07-11",
                "endDate": "1997-09-03",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mercury",
                "startDate": "1997-09-03",
                "endDate": "1997-10-21",
                "level": "pratyantardasha"
              },
              {
                "lord": "Ketu",
                "startDate": "1997-10-21",
                "endDate": "1997-11-10",
                "level": "pratyantardasha"
              },
              {
                "lord": "Venus",
                "startDate": "1997-11-10",
                "endDate": "1998-01-06",
                "level": "pratyantardasha"
              },
              {
                "lord": "Sun",
                "startDate": "1998-01-06",
                "endDate": "1998-01-23",
                "level": "pratyantardasha"
              },
              {
                "lord": "Moon",
                "startDate": "1998-01-23",
                "endDate": "1998-02-21",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mars",
                "startDate": "1998-02-21",
                "endDate": "1998-03-12",
                "level": "pratyantardasha"
              },
              {
                "lord": "Rahu",
                "startDate": "1998-03-12",
                "endDate": "1998-05-03",
                "level": "pratyantardasha"
              }
            ]
          },
          {
            "lord": "Saturn",
            "startDate": "1998-05-03",
            "endDate": "1999-06-11",
            "level": "antardasha",
            "children": [
              {
                "lord": "Saturn",
                "startDate": "1998-05-03",
                "endDate": "1998-07-06",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mercury",
                "startDate": "1998-07-06",
                "endDate": "1998-09-01",
                "level": "pratyantardasha"
              },
              {
                "lord": "Ketu",
                "startDate": "1998-09-01",
                "endDate": "1998-09-25",
                "level": "pratyantardasha"
              },
              {
                "lord": "Venus",
                "startDate": "1998-09-25",
                "endDate": "1998-12-01",
                "level": "pratyantardasha"
              },
              {
                "lord": "Sun",
                "startDate": "1998-12-01",
                "endDate": "1998-12-21",
                "level": "pratyantardasha"
              },
              {
                "lord": "Moon",
                "startDate": "1998-12-21",
                "endDate": "1999-01-24",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mars",
                "startDate": "1999-01-24",
                "endDate": "1999-02-17",
                "level": "pratyantardasha"
              },
              {
                "lord": "Rahu",
                "startDate": "1999-02-17",
                "endDate": "1999-04-18",
                "level": "pratyantardasha"
              },
              {
                "lord": "Jupiter",
                "startDate": "1999-04-18",
                "endDate": "1999-06-11",
                "level": "pratyantardasha"
              }
            ]
          },
          {
            "lord": "Mercury",
            "startDate": "1999-06-11",
            "endDate": "2000-06-08",
            "level": "antardasha",
            "children": [
              {
                "lord": "Mercury",
                "startDate": "1999-06-11",
                "endDate": "1999-08-02",
                "level": "pratyantardasha"
              },
              {
                "lord": "Ketu",
                "startDate": "1999-08-02",
                "endDate": "1999-08-23",
                "level": "pratyantardasha"
              },
              {
                "lord": "Venus",
                "startDate": "1999-08-23",
                "endDate": "1999-10-22",
                "level": "pratyantardasha"
              },
              {
                "lord": "Sun",
                "startDate": "1999-10-22",
                "endDate": "1999-11-09",
                "level": "pratyantardasha"
              },
              {
                "lord": "Moon",
                "startDate": "1999-11-09",
                "endDate": "1999-12-10",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mars",
                "startDate": "1999-12-10",
                "endDate": "1999-12-31",
                "level": "pratyantardasha"
              },
              {
                "lord": "Rahu",
                "startDate": "1999-12-31",
                "endDate": "2000-02-23",
                "level": "pratyantardasha"
              },
              {
                "lord": "Jupiter",
                "startDate": "2000-02-23",
                "endDate": "2000-04-11",
                "level": "pratyantardasha"
              },
              {
                "lord": "Saturn",
                "startDate": "2000-04-11",
                "endDate": "2000-06-08",
                "level": "pratyantardasha"
              }
            ]
          },
          {
            "lord": "Ketu",
            "startDate": "2000-06-08",
            "endDate": "2000-11-04",
            "level": "antardasha",
            "children": [
              {
                "lord": "Ketu",
                "startDate": "2000-06-08",
                "endDate": "2000-06-16",
                "level": "pratyantardasha"
              },
              {
                "lord": "Venus",
                "startDate": "2000-06-16",
                "endDate": "2000-07-11",
                "level": "pratyantardasha"
              },
              {
                "lord": "Sun",
                "startDate": "2000-07-11",
                "endDate": "2000-07-19",
                "level": "pratyantardasha"
              },
              {
                "lord": "Moon",
                "startDate": "2000-07-19",
                "endDate": "2000-07-31",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mars",
                "startDate": "2000-07-31",
                "endDate": "2000-08-09",
                "level": "pratyantardasha"
              },
              {
                "lord": "Rahu",
                "startDate": "2000-08-09",
                "endDate": "2000-08-31",
                "level": "pratyantardasha"
              },
              {
                "lord": "Jupiter",
                "startDate": "2000-08-31",
                "endDate": "2000-09-20",
                "level": "pratyantardasha"
              },
              {
                "lord": "Saturn",
                "startDate": "2000-09-20",
                "endDate": "2000-10-14",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mercury",
                "startDate": "2000-10-14",
                "endDate": "2000-11-04",
                "level": "pratyantardasha"
              }
            ]
          },
          {
            "lord": "Venus",
            "startDate": "2000-11-04",
            "endDate": "2002-01-04",
            "level": "antardasha",
            "children": [
              {
                "lord": "Venus",
                "startDate": "2000-11-04",
                "endDate": "2001-01-14",
                "level": "pratyantardasha"
              },
              {
                "lord": "Sun",
                "startDate": "2001-01-14",
                "endDate": "2001-02-04",
                "level": "pratyantardasha"
              },
              {
                "lord": "Moon",
                "startDate": "2001-02-04",
                "endDate": "2001-03-12",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mars",
                "startDate": "2001-03-12",
                "endDate": "2001-04-05",
                "level": "pratyantardasha"
              },
              {
                "lord": "Rahu",
                "startDate": "2001-04-05",
                "endDate": "2001-06-08",
                "level": "pratyantardasha"
              },
              {
                "lord": "Jupiter",
                "startDate": "2001-06-08",
                "endDate": "2001-08-04",
                "level": "pratyantardasha"
              },
              {
                "lord": "Saturn",
                "startDate": "2001-08-04",
                "endDate": "2001-10-11",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mercury",
                "startDate": "2001-10-11",
                "endDate": "2001-12-10",
                "level": "pratyantardasha"
              },
              {
                "lord": "Ketu",
                "startDate": "2001-12-10",
                "endDate": "2002-01-04",
                "level": "pratyantardasha"
              }
            ]
          },
          {
            "lord": "Sun",
            "startDate": "2002-01-04",
            "endDate": "2002-05-12",
            "level": "antardasha",
            "children": [
              {
                "lord": "Sun",
                "startDate": "2002-01-04",
                "endDate": "2002-01-10",
                "level": "pratyantardasha"
              },
              {
                "lord": "Moon",
                "startDate": "2002-01-10",
                "endDate": "2002-01-21",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mars",
                "startDate": "2002-01-21",
                "endDate": "2002-01-28",
                "level": "pratyantardasha"
              },
              {
                "lord": "Rahu",
                "startDate": "2002-01-28",
                "endDate": "2002-02-17",
                "level": "pratyantardasha"
              },
              {
                "lord": "Jupiter",
                "startDate": "2002-02-17",
                "endDate": "2002-03-06",
                "level": "pratyantardasha"
              },
              {
                "lord": "Saturn",
                "startDate": "2002-03-06",
                "endDate": "2002-03-26",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mercury",
                "startDate": "2002-03-26",
                "endDate": "2002-04-13",
                "level": "pratyantardasha"
              },
              {
                "lord": "Ketu",
                "startDate": "2002-04-13",
                "endDate": "2002-04-20",
                "level": "pratyantardasha"
              },
              {
                "lord": "Venus",
                "startDate": "2002-04-20",
                "endDate": "2002-05-12",
                "level": "pratyantardasha"
              }
            ]
          },
          {
            "lord": "Moon",
            "startDate": "2002-05-12",
            "endDate": "2002-12-11",
            "level": "antardasha",
            "children": [
              {
                "lord": "Moon",
                "startDate": "2002-05-12",
                "endDate": "2002-05-29",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mars",
                "startDate": "2002-05-29",
                "endDate": "2002-06-11",
                "level": "pratyantardasha"
              },
              {
                "lord": "Rahu",
                "startDate": "2002-06-11",
                "endDate": "2002-07-13",
                "level": "pratyantardasha"
              },
              {
                "lord": "Jupiter",
                "startDate": "2002-07-13",
                "endDate": "2002-08-10",
                "level": "pratyantardasha"
              },
              {
                "lord": "Saturn",
                "startDate": "2002-08-10",
                "endDate": "2002-09-13",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mercury",
                "startDate": "2002-09-13",
                "endDate": "2002-10-13",
                "level": "pratyantardasha"
              },
              {
                "lord": "Ketu",
                "startDate": "2002-10-13",
                "endDate": "2002-10-26",
                "level": "pratyantardasha"
              },
              {
                "lord": "Venus",
                "startDate": "2002-10-26",
                "endDate": "2002-11-30",
                "level": "pratyantardasha"
              },
              {
                "lord": "Sun",
                "startDate": "2002-11-30",
                "endDate": "2002-12-11",
                "level": "pratyantardasha"
              }
            ]
          }
        ]
      },
      {
        "lord": "Rahu",
        "startDate": "2002-12-11",
        "endDate": "2020-12-10",
        "level": "mahadasha",
        "children": [
          {
            "lord": "Rahu",
            "startDate": "2002-12-11",
            "endDate": "2005-08-23",
            "level": "antardasha",
            "children": [
              {
                "lord": "Rahu",
                "startDate": "2002-12-11",
                "endDate": "2003-05-08",
                "level": "pratyantardasha"
              },
              {
                "lord": "Jupiter",
                "startDate": "2003-05-08",
                "endDate": "2003-09-16",
                "level": "pratyantardasha"
              },
              {
                "lord": "Saturn",
                "startDate": "2003-09-16",
                "endDate": "2004-02-19",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mercury",
                "startDate": "2004-02-19",
                "endDate": "2004-07-08",
                "level": "pratyantardasha"
              },
              {
                "lord": "Ketu",
                "startDate": "2004-07-08",
                "endDate": "2004-09-04",
                "level": "pratyantardasha"
              },
              {
                "lord": "Venus",
                "startDate": "2004-09-04",
                "endDate": "2005-02-15",
                "level": "pratyantardasha"
              },
              {
                "lord": "Sun",
                "startDate": "2005-02-15",
                "endDate": "2005-04-05",
                "level": "pratyantardasha"
              },
              {
                "lord": "Moon",
                "startDate": "2005-04-05",
                "endDate": "2005-06-26",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mars",
                "startDate": "2005-06-26",
                "endDate": "2005-08-23",
                "level": "pratyantardasha"
              }
            ]
          },
          {
            "lord": "Jupiter",
            "startDate": "2005-08-23",
            "endDate": "2008-01-17",
            "level": "antardasha",
            "children": [
              {
                "lord": "Jupiter",
                "startDate": "2005-08-23",
                "endDate": "2005-12-18",
                "level": "pratyantardasha"
              },
              {
                "lord": "Saturn",
                "startDate": "2005-12-18",
                "endDate": "2006-05-06",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mercury",
                "startDate": "2006-05-06",
                "endDate": "2006-09-07",
                "level": "pratyantardasha"
              },
              {
                "lord": "Ketu",
                "startDate": "2006-09-07",
                "endDate": "2006-10-28",
                "level": "pratyantardasha"
              },
              {
                "lord": "Venus",
                "startDate": "2006-10-28",
                "endDate": "2007-03-23",
                "level": "pratyantardasha"
              },
              {
                "lord": "Sun",
                "startDate": "2007-03-23",
                "endDate": "2007-05-06",
                "level": "pratyantardasha"
              },
              {
                "lord": "Moon",
                "startDate": "2007-05-06",
                "endDate": "2007-07-18",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mars",
                "startDate": "2007-07-18",
                "endDate": "2007-09-07",
                "level": "pratyantardasha"
              },
              {
                "lord": "Rahu",
                "startDate": "2007-09-07",
                "endDate": "2008-01-17",
                "level": "pratyantardasha"
              }
            ]
          },
          {
            "lord": "Saturn",
            "startDate": "2008-01-17",
            "endDate": "2010-11-22",
            "level": "antardasha",
            "children": [
              {
                "lord": "Saturn",
                "startDate": "2008-01-17",
                "endDate": "2008-06-29",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mercury",
                "startDate": "2008-06-29",
                "endDate": "2008-11-24",
                "level": "pratyantardasha"
              },
              {
                "lord": "Ketu",
                "startDate": "2008-11-24",
                "endDate": "2009-01-24",
                "level": "pratyantardasha"
              },
              {
                "lord": "Venus",
                "startDate": "2009-01-24",
                "endDate": "2009-07-16",
                "level": "pratyantardasha"
              },
              {
                "lord": "Sun",
                "startDate": "2009-07-16",
                "endDate": "2009-09-06",
                "level": "pratyantardasha"
              },
              {
                "lord": "Moon",
                "startDate": "2009-09-06",
                "endDate": "2009-12-02",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mars",
                "startDate": "2009-12-02",
                "endDate": "2010-02-01",
                "level": "pratyantardasha"
              },
              {
                "lord": "Rahu",
                "startDate": "2010-02-01",
                "endDate": "2010-07-07",
                "level": "pratyantardasha"
              },
              {
                "lord": "Jupiter",
                "startDate": "2010-07-07",
                "endDate": "2010-11-22",
                "level": "pratyantardasha"
              }
            ]
          },
          {
            "lord": "Mercury",
            "startDate": "2010-11-22",
            "endDate": "2013-06-11",
            "level": "antardasha",
            "children": [
              {
                "lord": "Mercury",
                "startDate": "2010-11-22",
                "endDate": "2011-04-03",
                "level": "pratyantardasha"
              },
              {
                "lord": "Ketu",
                "startDate": "2011-04-03",
                "endDate": "2011-05-28",
                "level": "pratyantardasha"
              },
              {
                "lord": "Venus",
                "startDate": "2011-05-28",
                "endDate": "2011-10-30",
                "level": "pratyantardasha"
              },
              {
                "lord": "Sun",
                "startDate": "2011-10-30",
                "endDate": "2011-12-16",
                "level": "pratyantardasha"
              },
              {
                "lord": "Moon",
                "startDate": "2011-12-16",
                "endDate": "2012-03-02",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mars",
                "startDate": "2012-03-02",
                "endDate": "2012-04-25",
                "level": "pratyantardasha"
              },
              {
                "lord": "Rahu",
                "startDate": "2012-04-25",
                "endDate": "2012-09-12",
                "level": "pratyantardasha"
              },
              {
                "lord": "Jupiter",
                "startDate": "2012-09-12",
                "endDate": "2013-01-14",
                "level": "pratyantardasha"
              },
              {
                "lord": "Saturn",
                "startDate": "2013-01-14",
                "endDate": "2013-06-11",
                "level": "pratyantardasha"
              }
            ]
          },
          {
            "lord": "Ketu",
            "startDate": "2013-06-11",
            "endDate": "2014-06-29",
            "level": "antardasha",
            "children": [
              {
                "lord": "Ketu",
                "startDate": "2013-06-11",
                "endDate": "2013-07-03",
                "level": "pratyantardasha"
              },
              {
                "lord": "Venus",
                "startDate": "2013-07-03",
                "endDate": "2013-09-05",
                "level": "pratyantardasha"
              },
              {
                "lord": "Sun",
                "startDate": "2013-09-05",
                "endDate": "2013-09-24",
                "level": "pratyantardasha"
              },
              {
                "lord": "Moon",
                "startDate": "2013-09-24",
                "endDate": "2013-10-26",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mars",
                "startDate": "2013-10-26",
                "endDate": "2013-11-18",
                "level": "pratyantardasha"
              },
              {
                "lord": "Rahu",
                "startDate": "2013-11-18",
                "endDate": "2014-01-14",
                "level": "pratyantardasha"
              },
              {
                "lord": "Jupiter",
                "startDate": "2014-01-14",
                "endDate": "2014-03-06",
                "level": "pratyantardasha"
              },
              {
                "lord": "Saturn",
                "startDate": "2014-03-06",
                "endDate": "2014-05-06",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mercury",
                "startDate": "2014-05-06",
                "endDate": "2014-06-29",
                "level": "pratyantardasha"
              }
            ]
          },
          {
            "lord": "Venus",
            "startDate": "2014-06-29",
            "endDate": "2017-06-29",
            "level": "antardasha",
            "children": [
              {
                "lord": "Venus",
                "startDate": "2014-06-29",
                "endDate": "2014-12-29",
                "level": "pratyantardasha"
              },
              {
                "lord": "Sun",
                "startDate": "2014-12-29",
                "endDate": "2015-02-22",
                "level": "pratyantardasha"
              },
              {
                "lord": "Moon",
                "startDate": "2015-02-22",
                "endDate": "2015-05-24",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mars",
                "startDate": "2015-05-24",
                "endDate": "2015-07-27",
                "level": "pratyantardasha"
              },
              {
                "lord": "Rahu",
                "startDate": "2015-07-27",
                "endDate": "2016-01-07",
                "level": "pratyantardasha"
              },
              {
                "lord": "Jupiter",
                "startDate": "2016-01-07",
                "endDate": "2016-06-01",
                "level": "pratyantardasha"
              },
              {
                "lord": "Saturn",
                "startDate": "2016-06-01",
                "endDate": "2016-11-22",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mercury",
                "startDate": "2016-11-22",
                "endDate": "2017-04-26",
                "level": "pratyantardasha"
              },
              {
                "lord": "Ketu",
                "startDate": "2017-04-26",
                "endDate": "2017-06-29",
                "level": "pratyantardasha"
              }
            ]
          },
          {
            "lord": "Sun",
            "startDate": "2017-06-29",
            "endDate": "2018-05-24",
            "level": "antardasha",
            "children": [
              {
                "lord": "Sun",
                "startDate": "2017-06-29",
                "endDate": "2017-07-15",
                "level": "pratyantardasha"
              },
              {
                "lord": "Moon",
                "startDate": "2017-07-15",
                "endDate": "2017-08-12",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mars",
                "startDate": "2017-08-12",
                "endDate": "2017-08-31",
                "level": "pratyantardasha"
              },
              {
                "lord": "Rahu",
                "startDate": "2017-08-31",
                "endDate": "2017-10-19",
                "level": "pratyantardasha"
              },
              {
                "lord": "Jupiter",
                "startDate": "2017-10-19",
                "endDate": "2017-12-02",
                "level": "pratyantardasha"
              },
              {
                "lord": "Saturn",
                "startDate": "2017-12-02",
                "endDate": "2018-01-23",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mercury",
                "startDate": "2018-01-23",
                "endDate": "2018-03-11",
                "level": "pratyantardasha"
              },
              {
                "lord": "Ketu",
                "startDate": "2018-03-11",
                "endDate": "2018-03-30",
                "level": "pratyantardasha"
              },
              {
                "lord": "Venus",
                "startDate": "2018-03-30",
                "endDate": "2018-05-24",
                "level": "pratyantardasha"
              }
            ]
          },
          {
            "lord": "Moon",
            "startDate": "2018-05-24",
            "endDate": "2019-11-23",
            "level": "antardasha",
            "children": [
              {
                "lord": "Moon",
                "startDate": "2018-05-24",
                "endDate": "2018-07-08",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mars",
                "startDate": "2018-07-08",
                "endDate": "2018-08-09",
                "level": "pratyantardasha"
              },
              {
                "lord": "Rahu",
                "startDate": "2018-08-09",
                "endDate": "2018-10-31",
                "level": "pratyantardasha"
              },
              {
                "lord": "Jupiter",
                "startDate": "2018-10-31",
                "endDate": "2019-01-12",
                "level": "pratyantardasha"
              },
              {
                "lord": "Saturn",
                "startDate": "2019-01-12",
                "endDate": "2019-04-08",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mercury",
                "startDate": "2019-04-08",
                "endDate": "2019-06-25",
                "level": "pratyantardasha"
              },
              {
                "lord": "Ketu",
                "startDate": "2019-06-25",
                "endDate": "2019-07-27",
                "level": "pratyantardasha"
              },
              {
                "lord": "Venus",
                "startDate": "2019-07-27",
                "endDate": "2019-10-26",
                "level": "pratyantardasha"
              },
              {
                "lord": "Sun",
                "startDate": "2019-10-26",
                "endDate": "2019-11-23",
                "level": "pratyantardasha"
              }
            ]
          },
          {
            "lord": "Mars",
            "startDate": "2019-11-23",
            "endDate": "2020-12-10",
            "level": "antardasha",
            "children": [
              {
                "lord": "Mars",
                "startDate": "2019-11-23",
                "endDate": "2019-12-15",
                "level": "pratyantardasha"
              },
              {
                "lord": "Rahu",
                "startDate": "2019-12-15",
                "endDate": "2020-02-11",
                "level": "pratyantardasha"
              },
              {
                "lord": "Jupiter",
                "startDate": "2020-02-11",
                "endDate": "2020-04-02",
                "level": "pratyantardasha"
              },
              {
                "lord": "Saturn",
                "startDate": "2020-04-02",
                "endDate": "2020-06-01",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mercury",
                "startDate": "2020-06-01",
                "endDate": "2020-07-26",
                "level": "pratyantardasha"
              },
              {
                "lord": "Ketu",
                "startDate": "2020-07-26",
                "endDate": "2020-08-17",
                "level": "pratyantardasha"
              },
              {
                "lord": "Venus",
                "startDate": "2020-08-17",
                "endDate": "2020-10-20",
                "level": "pratyantardasha"
              },
              {
                "lord": "Sun",
                "startDate": "2020-10-20",
                "endDate": "2020-11-08",
                "level": "pratyantardasha"
              },
              {
                "lord": "Moon",
                "startDate": "2020-11-08",
                "endDate": "2020-12-10",
                "level": "pratyantardasha"
              }
            ]
          }
        ]
      },
      {
        "lord": "Jupiter",
        "startDate": "2020-12-10",
        "endDate": "2036-12-10",
        "level": "mahadasha",
        "children": [
          {
            "lord": "Jupiter",
            "startDate": "2020-12-10",
            "endDate": "2023-01-28",
            "level": "antardasha",
            "children": [
              {
                "lord": "Jupiter",
                "startDate": "2020-12-10",
                "endDate": "2021-03-24",
                "level": "pratyantardasha"
              },
              {
                "lord": "Saturn",
                "startDate": "2021-03-24",
                "endDate": "2021-07-25",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mercury",
                "startDate": "2021-07-25",
                "endDate": "2021-11-13",
                "level": "pratyantardasha"
              },
              {
                "lord": "Ketu",
                "startDate": "2021-11-13",
                "endDate": "2021-12-28",
                "level": "pratyantardasha"
              },
              {
                "lord": "Venus",
                "startDate": "2021-12-28",
                "endDate": "2022-05-07",
                "level": "pratyantardasha"
              },
              {
                "lord": "Sun",
                "startDate": "2022-05-07",
                "endDate": "2022-06-15",
                "level": "pratyantardasha"
              },
              {
                "lord": "Moon",
                "startDate": "2022-06-15",
                "endDate": "2022-08-19",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mars",
                "startDate": "2022-08-19",
                "endDate": "2022-10-03",
                "level": "pratyantardasha"
              },
              {
                "lord": "Rahu",
                "startDate": "2022-10-03",
                "endDate": "2023-01-28",
                "level": "pratyantardasha"
              }
            ]
          },
          {
            "lord": "Saturn",
            "startDate": "2023-01-28",
            "endDate": "2025-08-11",
            "level": "antardasha",
            "children": [
              {
                "lord": "Saturn",
                "startDate": "2023-01-28",
                "endDate": "2023-06-24",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mercury",
                "startDate": "2023-06-24",
                "endDate": "2023-11-02",
                "level": "pratyantardasha"
              },
              {
                "lord": "Ketu",
                "startDate": "2023-11-02",
                "endDate": "2023-12-26",
                "level": "pratyantardasha"
              },
              {
                "lord": "Venus",
                "startDate": "2023-12-26",
                "endDate": "2024-05-28",
                "level": "pratyantardasha"
              },
              {
                "lord": "Sun",
                "startDate": "2024-05-28",
                "endDate": "2024-07-13",
                "level": "pratyantardasha"
              },
              {
                "lord": "Moon",
                "startDate": "2024-07-13",
                "endDate": "2024-09-28",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mars",
                "startDate": "2024-09-28",
                "endDate": "2024-11-21",
                "level": "pratyantardasha"
              },
              {
                "lord": "Rahu",
                "startDate": "2024-11-21",
                "endDate": "2025-04-09",
                "level": "pratyantardasha"
              },
              {
                "lord": "Jupiter",
                "startDate": "2025-04-09",
                "endDate": "2025-08-11",
                "level": "pratyantardasha"
              }
            ]
          },
          {
            "lord": "Mercury",
            "startDate": "2025-08-11",
            "endDate": "2027-11-16",
            "level": "antardasha",
            "children": [
              {
                "lord": "Mercury",
                "startDate": "2025-08-11",
                "endDate": "2025-12-06",
                "level": "pratyantardasha"
              },
              {
                "lord": "Ketu",
                "startDate": "2025-12-06",
                "endDate": "2026-01-23",
                "level": "pratyantardasha"
              },
              {
                "lord": "Venus",
                "startDate": "2026-01-23",
                "endDate": "2026-06-10",
                "level": "pratyantardasha"
              },
              {
                "lord": "Sun",
                "startDate": "2026-06-10",
                "endDate": "2026-07-22",
                "level": "pratyantardasha"
              },
              {
                "lord": "Moon",
                "startDate": "2026-07-22",
                "endDate": "2026-09-29",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mars",
                "startDate": "2026-09-29",
                "endDate": "2026-11-16",
                "level": "pratyantardasha"
              },
              {
                "lord": "Rahu",
                "startDate": "2026-11-16",
                "endDate": "2027-03-20",
                "level": "pratyantardasha"
              },
              {
                "lord": "Jupiter",
                "startDate": "2027-03-20",
                "endDate": "2027-07-08",
                "level": "pratyantardasha"
              },
              {
                "lord": "Saturn",
                "startDate": "2027-07-08",
                "endDate": "2027-11-16",
                "level": "pratyantardasha"
              }
            ]
          },
          {
            "lord": "Ketu",
            "startDate": "2027-11-16",
            "endDate": "2028-10-22",
            "level": "antardasha",
            "children": [
              {
                "lord": "Ketu",
                "startDate": "2027-11-16",
                "endDate": "2027-12-06",
                "level": "pratyantardasha"
              },
              {
                "lord": "Venus",
                "startDate": "2027-12-06",
                "endDate": "2028-02-01",
                "level": "pratyantardasha"
              },
              {
                "lord": "Sun",
                "startDate": "2028-02-01",
                "endDate": "2028-02-18",
                "level": "pratyantardasha"
              },
              {
                "lord": "Moon",
                "startDate": "2028-02-18",
                "endDate": "2028-03-18",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mars",
                "startDate": "2028-03-18",
                "endDate": "2028-04-07",
                "level": "pratyantardasha"
              },
              {
                "lord": "Rahu",
                "startDate": "2028-04-07",
                "endDate": "2028-05-28",
                "level": "pratyantardasha"
              },
              {
                "lord": "Jupiter",
                "startDate": "2028-05-28",
                "endDate": "2028-07-12",
                "level": "pratyantardasha"
              },
              {
                "lord": "Saturn",
                "startDate": "2028-07-12",
                "endDate": "2028-09-04",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mercury",
                "startDate": "2028-09-04",
                "endDate": "2028-10-22",
                "level": "pratyantardasha"
              }
            ]
          },
          {
            "lord": "Venus",
            "startDate": "2028-10-22",
            "endDate": "2031-06-23",
            "level": "antardasha",
            "children": [
              {
                "lord": "Venus",
                "startDate": "2028-10-22",
                "endDate": "2029-04-03",
                "level": "pratyantardasha"
              },
              {
                "lord": "Sun",
                "startDate": "2029-04-03",
                "endDate": "2029-05-21",
                "level": "pratyantardasha"
              },
              {
                "lord": "Moon",
                "startDate": "2029-05-21",
                "endDate": "2029-08-11",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mars",
                "startDate": "2029-08-11",
                "endDate": "2029-10-06",
                "level": "pratyantardasha"
              },
              {
                "lord": "Rahu",
                "startDate": "2029-10-06",
                "endDate": "2030-03-01",
                "level": "pratyantardasha"
              },
              {
                "lord": "Jupiter",
                "startDate": "2030-03-01",
                "endDate": "2030-07-09",
                "level": "pratyantardasha"
              },
              {
                "lord": "Saturn",
                "startDate": "2030-07-09",
                "endDate": "2030-12-11",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mercury",
                "startDate": "2030-12-11",
                "endDate": "2031-04-28",
                "level": "pratyantardasha"
              },
              {
                "lord": "Ketu",
                "startDate": "2031-04-28",
                "endDate": "2031-06-23",
                "level": "pratyantardasha"
              }
            ]
          },
          {
            "lord": "Sun",
            "startDate": "2031-06-23",
            "endDate": "2032-04-11",
            "level": "antardasha",
            "children": [
              {
                "lord": "Sun",
                "startDate": "2031-06-23",
                "endDate": "2031-07-08",
                "level": "pratyantardasha"
              },
              {
                "lord": "Moon",
                "startDate": "2031-07-08",
                "endDate": "2031-08-01",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mars",
                "startDate": "2031-08-01",
                "endDate": "2031-08-18",
                "level": "pratyantardasha"
              },
              {
                "lord": "Rahu",
                "startDate": "2031-08-18",
                "endDate": "2031-10-01",
                "level": "pratyantardasha"
              },
              {
                "lord": "Jupiter",
                "startDate": "2031-10-01",
                "endDate": "2031-11-09",
                "level": "pratyantardasha"
              },
              {
                "lord": "Saturn",
                "startDate": "2031-11-09",
                "endDate": "2031-12-25",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mercury",
                "startDate": "2031-12-25",
                "endDate": "2032-02-05",
                "level": "pratyantardasha"
              },
              {
                "lord": "Ketu",
                "startDate": "2032-02-05",
                "endDate": "2032-02-22",
                "level": "pratyantardasha"
              },
              {
                "lord": "Venus",
                "startDate": "2032-02-22",
                "endDate": "2032-04-11",
                "level": "pratyantardasha"
              }
            ]
          },
          {
            "lord": "Moon",
            "startDate": "2032-04-11",
            "endDate": "2033-08-11",
            "level": "antardasha",
            "children": [
              {
                "lord": "Moon",
                "startDate": "2032-04-11",
                "endDate": "2032-05-21",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mars",
                "startDate": "2032-05-21",
                "endDate": "2032-06-19",
                "level": "pratyantardasha"
              },
              {
                "lord": "Rahu",
                "startDate": "2032-06-19",
                "endDate": "2032-08-31",
                "level": "pratyantardasha"
              },
              {
                "lord": "Jupiter",
                "startDate": "2032-08-31",
                "endDate": "2032-11-04",
                "level": "pratyantardasha"
              },
              {
                "lord": "Saturn",
                "startDate": "2032-11-04",
                "endDate": "2033-01-20",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mercury",
                "startDate": "2033-01-20",
                "endDate": "2033-03-30",
                "level": "pratyantardasha"
              },
              {
                "lord": "Ketu",
                "startDate": "2033-03-30",
                "endDate": "2033-04-27",
                "level": "pratyantardasha"
              },
              {
                "lord": "Venus",
                "startDate": "2033-04-27",
                "endDate": "2033-07-17",
                "level": "pratyantardasha"
              },
              {
                "lord": "Sun",
                "startDate": "2033-07-17",
                "endDate": "2033-08-11",
                "level": "pratyantardasha"
              }
            ]
          },
          {
            "lord": "Mars",
            "startDate": "2033-08-11",
            "endDate": "2034-07-17",
            "level": "antardasha",
            "children": [
              {
                "lord": "Mars",
                "startDate": "2033-08-11",
                "endDate": "2033-08-30",
                "level": "pratyantardasha"
              },
              {
                "lord": "Rahu",
                "startDate": "2033-08-30",
                "endDate": "2033-10-21",
                "level": "pratyantardasha"
              },
              {
                "lord": "Jupiter",
                "startDate": "2033-10-21",
                "endDate": "2033-12-05",
                "level": "pratyantardasha"
              },
              {
                "lord": "Saturn",
                "startDate": "2033-12-05",
                "endDate": "2034-01-28",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mercury",
                "startDate": "2034-01-28",
                "endDate": "2034-03-17",
                "level": "pratyantardasha"
              },
              {
                "lord": "Ketu",
                "startDate": "2034-03-17",
                "endDate": "2034-04-06",
                "level": "pratyantardasha"
              },
              {
                "lord": "Venus",
                "startDate": "2034-04-06",
                "endDate": "2034-06-02",
                "level": "pratyantardasha"
              },
              {
                "lord": "Sun",
                "startDate": "2034-06-02",
                "endDate": "2034-06-19",
                "level": "pratyantardasha"
              },
              {
                "lord": "Moon",
                "startDate": "2034-06-19",
                "endDate": "2034-07-17",
                "level": "pratyantardasha"
              }
            ]
          },
          {
            "lord": "Rahu",
            "startDate": "2034-07-17",
            "endDate": "2036-12-10",
            "level": "antardasha",
            "children": [
              {
                "lord": "Rahu",
                "startDate": "2034-07-17",
                "endDate": "2034-11-26",
                "level": "pratyantardasha"
              },
              {
                "lord": "Jupiter",
                "startDate": "2034-11-26",
                "endDate": "2035-03-23",
                "level": "pratyantardasha"
              },
              {
                "lord": "Saturn",
                "startDate": "2035-03-23",
                "endDate": "2035-08-09",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mercury",
                "startDate": "2035-08-09",
                "endDate": "2035-12-11",
                "level": "pratyantardasha"
              },
              {
                "lord": "Ketu",
                "startDate": "2035-12-11",
                "endDate": "2036-01-31",
                "level": "pratyantardasha"
              },
              {
                "lord": "Venus",
                "startDate": "2036-01-31",
                "endDate": "2036-06-25",
                "level": "pratyantardasha"
              },
              {
                "lord": "Sun",
                "startDate": "2036-06-25",
                "endDate": "2036-08-08",
                "level": "pratyantardasha"
              },
              {
                "lord": "Moon",
                "startDate": "2036-08-08",
                "endDate": "2036-10-20",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mars",
                "startDate": "2036-10-20",
                "endDate": "2036-12-10",
                "level": "pratyantardasha"
              }
            ]
          }
        ]
      },
      {
        "lord": "Saturn",
        "startDate": "2036-12-10",
        "endDate": "2055-12-11",
        "level": "mahadasha",
        "children": [
          {
            "lord": "Saturn",
            "startDate": "2036-12-10",
            "endDate": "2039-12-14",
            "level": "antardasha",
            "children": [
              {
                "lord": "Saturn",
                "startDate": "2036-12-10",
                "endDate": "2037-06-02",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mercury",
                "startDate": "2037-06-02",
                "endDate": "2037-11-05",
                "level": "pratyantardasha"
              },
              {
                "lord": "Ketu",
                "startDate": "2037-11-05",
                "endDate": "2038-01-08",
                "level": "pratyantardasha"
              },
              {
                "lord": "Venus",
                "startDate": "2038-01-08",
                "endDate": "2038-07-10",
                "level": "pratyantardasha"
              },
              {
                "lord": "Sun",
                "startDate": "2038-07-10",
                "endDate": "2038-09-03",
                "level": "pratyantardasha"
              },
              {
                "lord": "Moon",
                "startDate": "2038-09-03",
                "endDate": "2038-12-03",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mars",
                "startDate": "2038-12-03",
                "endDate": "2039-02-05",
                "level": "pratyantardasha"
              },
              {
                "lord": "Rahu",
                "startDate": "2039-02-05",
                "endDate": "2039-07-20",
                "level": "pratyantardasha"
              },
              {
                "lord": "Jupiter",
                "startDate": "2039-07-20",
                "endDate": "2039-12-14",
                "level": "pratyantardasha"
              }
            ]
          },
          {
            "lord": "Mercury",
            "startDate": "2039-12-14",
            "endDate": "2042-08-23",
            "level": "antardasha",
            "children": [
              {
                "lord": "Mercury",
                "startDate": "2039-12-14",
                "endDate": "2040-05-01",
                "level": "pratyantardasha"
              },
              {
                "lord": "Ketu",
                "startDate": "2040-05-01",
                "endDate": "2040-06-27",
                "level": "pratyantardasha"
              },
              {
                "lord": "Venus",
                "startDate": "2040-06-27",
                "endDate": "2040-12-08",
                "level": "pratyantardasha"
              },
              {
                "lord": "Sun",
                "startDate": "2040-12-08",
                "endDate": "2041-01-26",
                "level": "pratyantardasha"
              },
              {
                "lord": "Moon",
                "startDate": "2041-01-26",
                "endDate": "2041-04-18",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mars",
                "startDate": "2041-04-18",
                "endDate": "2041-06-15",
                "level": "pratyantardasha"
              },
              {
                "lord": "Rahu",
                "startDate": "2041-06-15",
                "endDate": "2041-11-09",
                "level": "pratyantardasha"
              },
              {
                "lord": "Jupiter",
                "startDate": "2041-11-09",
                "endDate": "2042-03-20",
                "level": "pratyantardasha"
              },
              {
                "lord": "Saturn",
                "startDate": "2042-03-20",
                "endDate": "2042-08-23",
                "level": "pratyantardasha"
              }
            ]
          },
          {
            "lord": "Ketu",
            "startDate": "2042-08-23",
            "endDate": "2043-10-02",
            "level": "antardasha",
            "children": [
              {
                "lord": "Ketu",
                "startDate": "2042-08-23",
                "endDate": "2042-09-16",
                "level": "pratyantardasha"
              },
              {
                "lord": "Venus",
                "startDate": "2042-09-16",
                "endDate": "2042-11-22",
                "level": "pratyantardasha"
              },
              {
                "lord": "Sun",
                "startDate": "2042-11-22",
                "endDate": "2042-12-12",
                "level": "pratyantardasha"
              },
              {
                "lord": "Moon",
                "startDate": "2042-12-12",
                "endDate": "2043-01-15",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mars",
                "startDate": "2043-01-15",
                "endDate": "2043-02-08",
                "level": "pratyantardasha"
              },
              {
                "lord": "Rahu",
                "startDate": "2043-02-08",
                "endDate": "2043-04-09",
                "level": "pratyantardasha"
              },
              {
                "lord": "Jupiter",
                "startDate": "2043-04-09",
                "endDate": "2043-06-02",
                "level": "pratyantardasha"
              },
              {
                "lord": "Saturn",
                "startDate": "2043-06-02",
                "endDate": "2043-08-05",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mercury",
                "startDate": "2043-08-05",
                "endDate": "2043-10-02",
                "level": "pratyantardasha"
              }
            ]
          },
          {
            "lord": "Venus",
            "startDate": "2043-10-02",
            "endDate": "2046-12-01",
            "level": "antardasha",
            "children": [
              {
                "lord": "Venus",
                "startDate": "2043-10-02",
                "endDate": "2044-04-11",
                "level": "pratyantardasha"
              },
              {
                "lord": "Sun",
                "startDate": "2044-04-11",
                "endDate": "2044-06-08",
                "level": "pratyantardasha"
              },
              {
                "lord": "Moon",
                "startDate": "2044-06-08",
                "endDate": "2044-09-13",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mars",
                "startDate": "2044-09-13",
                "endDate": "2044-11-19",
                "level": "pratyantardasha"
              },
              {
                "lord": "Rahu",
                "startDate": "2044-11-19",
                "endDate": "2045-05-12",
                "level": "pratyantardasha"
              },
              {
                "lord": "Jupiter",
                "startDate": "2045-05-12",
                "endDate": "2045-10-13",
                "level": "pratyantardasha"
              },
              {
                "lord": "Saturn",
                "startDate": "2045-10-13",
                "endDate": "2046-04-14",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mercury",
                "startDate": "2046-04-14",
                "endDate": "2046-09-25",
                "level": "pratyantardasha"
              },
              {
                "lord": "Ketu",
                "startDate": "2046-09-25",
                "endDate": "2046-12-01",
                "level": "pratyantardasha"
              }
            ]
          },
          {
            "lord": "Sun",
            "startDate": "2046-12-01",
            "endDate": "2047-11-13",
            "level": "antardasha",
            "children": [
              {
                "lord": "Sun",
                "startDate": "2046-12-01",
                "endDate": "2046-12-19",
                "level": "pratyantardasha"
              },
              {
                "lord": "Moon",
                "startDate": "2046-12-19",
                "endDate": "2047-01-17",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mars",
                "startDate": "2047-01-17",
                "endDate": "2047-02-06",
                "level": "pratyantardasha"
              },
              {
                "lord": "Rahu",
                "startDate": "2047-02-06",
                "endDate": "2047-03-30",
                "level": "pratyantardasha"
              },
              {
                "lord": "Jupiter",
                "startDate": "2047-03-30",
                "endDate": "2047-05-15",
                "level": "pratyantardasha"
              },
              {
                "lord": "Saturn",
                "startDate": "2047-05-15",
                "endDate": "2047-07-09",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mercury",
                "startDate": "2047-07-09",
                "endDate": "2047-08-27",
                "level": "pratyantardasha"
              },
              {
                "lord": "Ketu",
                "startDate": "2047-08-27",
                "endDate": "2047-09-16",
                "level": "pratyantardasha"
              },
              {
                "lord": "Venus",
                "startDate": "2047-09-16",
                "endDate": "2047-11-13",
                "level": "pratyantardasha"
              }
            ]
          },
          {
            "lord": "Moon",
            "startDate": "2047-11-13",
            "endDate": "2049-06-14",
            "level": "antardasha",
            "children": [
              {
                "lord": "Moon",
                "startDate": "2047-11-13",
                "endDate": "2047-12-31",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mars",
                "startDate": "2047-12-31",
                "endDate": "2048-02-03",
                "level": "pratyantardasha"
              },
              {
                "lord": "Rahu",
                "startDate": "2048-02-03",
                "endDate": "2048-04-30",
                "level": "pratyantardasha"
              },
              {
                "lord": "Jupiter",
                "startDate": "2048-04-30",
                "endDate": "2048-07-16",
                "level": "pratyantardasha"
              },
              {
                "lord": "Saturn",
                "startDate": "2048-07-16",
                "endDate": "2048-10-16",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mercury",
                "startDate": "2048-10-16",
                "endDate": "2049-01-06",
                "level": "pratyantardasha"
              },
              {
                "lord": "Ketu",
                "startDate": "2049-01-06",
                "endDate": "2049-02-08",
                "level": "pratyantardasha"
              },
              {
                "lord": "Venus",
                "startDate": "2049-02-08",
                "endDate": "2049-05-16",
                "level": "pratyantardasha"
              },
              {
                "lord": "Sun",
                "startDate": "2049-05-16",
                "endDate": "2049-06-14",
                "level": "pratyantardasha"
              }
            ]
          },
          {
            "lord": "Mars",
            "startDate": "2049-06-14",
            "endDate": "2050-07-23",
            "level": "antardasha",
            "children": [
              {
                "lord": "Mars",
                "startDate": "2049-06-14",
                "endDate": "2049-07-07",
                "level": "pratyantardasha"
              },
              {
                "lord": "Rahu",
                "startDate": "2049-07-07",
                "endDate": "2049-09-06",
                "level": "pratyantardasha"
              },
              {
                "lord": "Jupiter",
                "startDate": "2049-09-06",
                "endDate": "2049-10-30",
                "level": "pratyantardasha"
              },
              {
                "lord": "Saturn",
                "startDate": "2049-10-30",
                "endDate": "2050-01-02",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mercury",
                "startDate": "2050-01-02",
                "endDate": "2050-02-28",
                "level": "pratyantardasha"
              },
              {
                "lord": "Ketu",
                "startDate": "2050-02-28",
                "endDate": "2050-03-24",
                "level": "pratyantardasha"
              },
              {
                "lord": "Venus",
                "startDate": "2050-03-24",
                "endDate": "2050-05-30",
                "level": "pratyantardasha"
              },
              {
                "lord": "Sun",
                "startDate": "2050-05-30",
                "endDate": "2050-06-20",
                "level": "pratyantardasha"
              },
              {
                "lord": "Moon",
                "startDate": "2050-06-20",
                "endDate": "2050-07-23",
                "level": "pratyantardasha"
              }
            ]
          },
          {
            "lord": "Rahu",
            "startDate": "2050-07-23",
            "endDate": "2053-05-29",
            "level": "antardasha",
            "children": [
              {
                "lord": "Rahu",
                "startDate": "2050-07-23",
                "endDate": "2050-12-27",
                "level": "pratyantardasha"
              },
              {
                "lord": "Jupiter",
                "startDate": "2050-12-27",
                "endDate": "2051-05-14",
                "level": "pratyantardasha"
              },
              {
                "lord": "Saturn",
                "startDate": "2051-05-14",
                "endDate": "2051-10-26",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mercury",
                "startDate": "2051-10-26",
                "endDate": "2052-03-22",
                "level": "pratyantardasha"
              },
              {
                "lord": "Ketu",
                "startDate": "2052-03-22",
                "endDate": "2052-05-21",
                "level": "pratyantardasha"
              },
              {
                "lord": "Venus",
                "startDate": "2052-05-21",
                "endDate": "2052-11-11",
                "level": "pratyantardasha"
              },
              {
                "lord": "Sun",
                "startDate": "2052-11-11",
                "endDate": "2053-01-02",
                "level": "pratyantardasha"
              },
              {
                "lord": "Moon",
                "startDate": "2053-01-02",
                "endDate": "2053-03-30",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mars",
                "startDate": "2053-03-30",
                "endDate": "2053-05-29",
                "level": "pratyantardasha"
              }
            ]
          },
          {
            "lord": "Jupiter",
            "startDate": "2053-05-29",
            "endDate": "2055-12-11",
            "level": "antardasha",
            "children": [
              {
                "lord": "Jupiter",
                "startDate": "2053-05-29",
                "endDate": "2053-09-30",
                "level": "pratyantardasha"
              },
              {
                "lord": "Saturn",
                "startDate": "2053-09-30",
                "endDate": "2054-02-23",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mercury",
                "startDate": "2054-02-23",
                "endDate": "2054-07-04",
                "level": "pratyantardasha"
              },
              {
                "lord": "Ketu",
                "startDate": "2054-07-04",
                "endDate": "2054-08-27",
                "level": "pratyantardasha"
              },
              {
                "lord": "Venus",
                "startDate": "2054-08-27",
                "endDate": "2055-01-28",
                "level": "pratyantardasha"
              },
              {
                "lord": "Sun",
                "startDate": "2055-01-28",
                "endDate": "2055-03-16",
                "level": "pratyantardasha"
              },
              {
                "lord": "Moon",
                "startDate": "2055-03-16",
                "endDate": "2055-06-01",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mars",
                "startDate": "2055-06-01",
                "endDate": "2055-07-25",
                "level": "pratyantardasha"
              },
              {
                "lord": "Rahu",
                "startDate": "2055-07-25",
                "endDate": "2055-12-11",
                "level": "pratyantardasha"
              }
            ]
          }
        ]
      },
      {
        "lord": "Mercury",
        "startDate": "2055-12-11",
        "endDate": "2072-12-10",
        "level": "mahadasha",
        "children": [
          {
            "lord": "Mercury",
            "startDate": "2055-12-11",
            "endDate": "2058-05-08",
            "level": "antardasha",
            "children": [
              {
                "lord": "Mercury",
                "startDate": "2055-12-11",
                "endDate": "2056-04-13",
                "level": "pratyantardasha"
              },
              {
                "lord": "Ketu",
                "startDate": "2056-04-13",
                "endDate": "2056-06-04",
                "level": "pratyantardasha"
              },
              {
                "lord": "Venus",
                "startDate": "2056-06-04",
                "endDate": "2056-10-28",
                "level": "pratyantardasha"
              },
              {
                "lord": "Sun",
                "startDate": "2056-10-28",
                "endDate": "2056-12-11",
                "level": "pratyantardasha"
              },
              {
                "lord": "Moon",
                "startDate": "2056-12-11",
                "endDate": "2057-02-22",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mars",
                "startDate": "2057-02-22",
                "endDate": "2057-04-15",
                "level": "pratyantardasha"
              },
              {
                "lord": "Rahu",
                "startDate": "2057-04-15",
                "endDate": "2057-08-25",
                "level": "pratyantardasha"
              },
              {
                "lord": "Jupiter",
                "startDate": "2057-08-25",
                "endDate": "2057-12-20",
                "level": "pratyantardasha"
              },
              {
                "lord": "Saturn",
                "startDate": "2057-12-20",
                "endDate": "2058-05-08",
                "level": "pratyantardasha"
              }
            ]
          },
          {
            "lord": "Ketu",
            "startDate": "2058-05-08",
            "endDate": "2059-05-05",
            "level": "antardasha",
            "children": [
              {
                "lord": "Ketu",
                "startDate": "2058-05-08",
                "endDate": "2058-05-29",
                "level": "pratyantardasha"
              },
              {
                "lord": "Venus",
                "startDate": "2058-05-29",
                "endDate": "2058-07-29",
                "level": "pratyantardasha"
              },
              {
                "lord": "Sun",
                "startDate": "2058-07-29",
                "endDate": "2058-08-16",
                "level": "pratyantardasha"
              },
              {
                "lord": "Moon",
                "startDate": "2058-08-16",
                "endDate": "2058-09-15",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mars",
                "startDate": "2058-09-15",
                "endDate": "2058-10-06",
                "level": "pratyantardasha"
              },
              {
                "lord": "Rahu",
                "startDate": "2058-10-06",
                "endDate": "2058-11-30",
                "level": "pratyantardasha"
              },
              {
                "lord": "Jupiter",
                "startDate": "2058-11-30",
                "endDate": "2059-01-17",
                "level": "pratyantardasha"
              },
              {
                "lord": "Saturn",
                "startDate": "2059-01-17",
                "endDate": "2059-03-15",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mercury",
                "startDate": "2059-03-15",
                "endDate": "2059-05-05",
                "level": "pratyantardasha"
              }
            ]
          },
          {
            "lord": "Venus",
            "startDate": "2059-05-05",
            "endDate": "2062-03-05",
            "level": "antardasha",
            "children": [
              {
                "lord": "Venus",
                "startDate": "2059-05-05",
                "endDate": "2059-10-25",
                "level": "pratyantardasha"
              },
              {
                "lord": "Sun",
                "startDate": "2059-10-25",
                "endDate": "2059-12-16",
                "level": "pratyantardasha"
              },
              {
                "lord": "Moon",
                "startDate": "2059-12-16",
                "endDate": "2060-03-11",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mars",
                "startDate": "2060-03-11",
                "endDate": "2060-05-10",
                "level": "pratyantardasha"
              },
              {
                "lord": "Rahu",
                "startDate": "2060-05-10",
                "endDate": "2060-10-13",
                "level": "pratyantardasha"
              },
              {
                "lord": "Jupiter",
                "startDate": "2060-10-13",
                "endDate": "2061-02-27",
                "level": "pratyantardasha"
              },
              {
                "lord": "Saturn",
                "startDate": "2061-02-27",
                "endDate": "2061-08-10",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mercury",
                "startDate": "2061-08-10",
                "endDate": "2062-01-04",
                "level": "pratyantardasha"
              },
              {
                "lord": "Ketu",
                "startDate": "2062-01-04",
                "endDate": "2062-03-05",
                "level": "pratyantardasha"
              }
            ]
          },
          {
            "lord": "Sun",
            "startDate": "2062-03-05",
            "endDate": "2063-01-10",
            "level": "antardasha",
            "children": [
              {
                "lord": "Sun",
                "startDate": "2062-03-05",
                "endDate": "2062-03-21",
                "level": "pratyantardasha"
              },
              {
                "lord": "Moon",
                "startDate": "2062-03-21",
                "endDate": "2062-04-16",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mars",
                "startDate": "2062-04-16",
                "endDate": "2062-05-04",
                "level": "pratyantardasha"
              },
              {
                "lord": "Rahu",
                "startDate": "2062-05-04",
                "endDate": "2062-06-19",
                "level": "pratyantardasha"
              },
              {
                "lord": "Jupiter",
                "startDate": "2062-06-19",
                "endDate": "2062-07-31",
                "level": "pratyantardasha"
              },
              {
                "lord": "Saturn",
                "startDate": "2062-07-31",
                "endDate": "2062-09-18",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mercury",
                "startDate": "2062-09-18",
                "endDate": "2062-11-01",
                "level": "pratyantardasha"
              },
              {
                "lord": "Ketu",
                "startDate": "2062-11-01",
                "endDate": "2062-11-19",
                "level": "pratyantardasha"
              },
              {
                "lord": "Venus",
                "startDate": "2062-11-19",
                "endDate": "2063-01-10",
                "level": "pratyantardasha"
              }
            ]
          },
          {
            "lord": "Moon",
            "startDate": "2063-01-10",
            "endDate": "2064-06-10",
            "level": "antardasha",
            "children": [
              {
                "lord": "Moon",
                "startDate": "2063-01-10",
                "endDate": "2063-02-22",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mars",
                "startDate": "2063-02-22",
                "endDate": "2063-03-24",
                "level": "pratyantardasha"
              },
              {
                "lord": "Rahu",
                "startDate": "2063-03-24",
                "endDate": "2063-06-10",
                "level": "pratyantardasha"
              },
              {
                "lord": "Jupiter",
                "startDate": "2063-06-10",
                "endDate": "2063-08-18",
                "level": "pratyantardasha"
              },
              {
                "lord": "Saturn",
                "startDate": "2063-08-18",
                "endDate": "2063-11-08",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mercury",
                "startDate": "2063-11-08",
                "endDate": "2064-01-20",
                "level": "pratyantardasha"
              },
              {
                "lord": "Ketu",
                "startDate": "2064-01-20",
                "endDate": "2064-02-19",
                "level": "pratyantardasha"
              },
              {
                "lord": "Venus",
                "startDate": "2064-02-19",
                "endDate": "2064-05-15",
                "level": "pratyantardasha"
              },
              {
                "lord": "Sun",
                "startDate": "2064-05-15",
                "endDate": "2064-06-10",
                "level": "pratyantardasha"
              }
            ]
          },
          {
            "lord": "Mars",
            "startDate": "2064-06-10",
            "endDate": "2065-06-07",
            "level": "antardasha",
            "children": [
              {
                "lord": "Mars",
                "startDate": "2064-06-10",
                "endDate": "2064-07-01",
                "level": "pratyantardasha"
              },
              {
                "lord": "Rahu",
                "startDate": "2064-07-01",
                "endDate": "2064-08-25",
                "level": "pratyantardasha"
              },
              {
                "lord": "Jupiter",
                "startDate": "2064-08-25",
                "endDate": "2064-10-12",
                "level": "pratyantardasha"
              },
              {
                "lord": "Saturn",
                "startDate": "2064-10-12",
                "endDate": "2064-12-08",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mercury",
                "startDate": "2064-12-08",
                "endDate": "2065-01-29",
                "level": "pratyantardasha"
              },
              {
                "lord": "Ketu",
                "startDate": "2065-01-29",
                "endDate": "2065-02-19",
                "level": "pratyantardasha"
              },
              {
                "lord": "Venus",
                "startDate": "2065-02-19",
                "endDate": "2065-04-20",
                "level": "pratyantardasha"
              },
              {
                "lord": "Sun",
                "startDate": "2065-04-20",
                "endDate": "2065-05-08",
                "level": "pratyantardasha"
              },
              {
                "lord": "Moon",
                "startDate": "2065-05-08",
                "endDate": "2065-06-07",
                "level": "pratyantardasha"
              }
            ]
          },
          {
            "lord": "Rahu",
            "startDate": "2065-06-07",
            "endDate": "2067-12-26",
            "level": "antardasha",
            "children": [
              {
                "lord": "Rahu",
                "startDate": "2065-06-07",
                "endDate": "2065-10-25",
                "level": "pratyantardasha"
              },
              {
                "lord": "Jupiter",
                "startDate": "2065-10-25",
                "endDate": "2066-02-26",
                "level": "pratyantardasha"
              },
              {
                "lord": "Saturn",
                "startDate": "2066-02-26",
                "endDate": "2066-07-24",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mercury",
                "startDate": "2066-07-24",
                "endDate": "2066-12-03",
                "level": "pratyantardasha"
              },
              {
                "lord": "Ketu",
                "startDate": "2066-12-03",
                "endDate": "2067-01-26",
                "level": "pratyantardasha"
              },
              {
                "lord": "Venus",
                "startDate": "2067-01-26",
                "endDate": "2067-06-30",
                "level": "pratyantardasha"
              },
              {
                "lord": "Sun",
                "startDate": "2067-06-30",
                "endDate": "2067-08-16",
                "level": "pratyantardasha"
              },
              {
                "lord": "Moon",
                "startDate": "2067-08-16",
                "endDate": "2067-11-01",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mars",
                "startDate": "2067-11-01",
                "endDate": "2067-12-26",
                "level": "pratyantardasha"
              }
            ]
          },
          {
            "lord": "Jupiter",
            "startDate": "2067-12-26",
            "endDate": "2070-04-02",
            "level": "antardasha",
            "children": [
              {
                "lord": "Jupiter",
                "startDate": "2067-12-26",
                "endDate": "2068-04-14",
                "level": "pratyantardasha"
              },
              {
                "lord": "Saturn",
                "startDate": "2068-04-14",
                "endDate": "2068-08-23",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mercury",
                "startDate": "2068-08-23",
                "endDate": "2068-12-19",
                "level": "pratyantardasha"
              },
              {
                "lord": "Ketu",
                "startDate": "2068-12-19",
                "endDate": "2069-02-05",
                "level": "pratyantardasha"
              },
              {
                "lord": "Venus",
                "startDate": "2069-02-05",
                "endDate": "2069-06-23",
                "level": "pratyantardasha"
              },
              {
                "lord": "Sun",
                "startDate": "2069-06-23",
                "endDate": "2069-08-03",
                "level": "pratyantardasha"
              },
              {
                "lord": "Moon",
                "startDate": "2069-08-03",
                "endDate": "2069-10-11",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mars",
                "startDate": "2069-10-11",
                "endDate": "2069-11-28",
                "level": "pratyantardasha"
              },
              {
                "lord": "Rahu",
                "startDate": "2069-11-28",
                "endDate": "2070-04-02",
                "level": "pratyantardasha"
              }
            ]
          },
          {
            "lord": "Saturn",
            "startDate": "2070-04-02",
            "endDate": "2072-12-10",
            "level": "antardasha",
            "children": [
              {
                "lord": "Saturn",
                "startDate": "2070-04-02",
                "endDate": "2070-09-04",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mercury",
                "startDate": "2070-09-04",
                "endDate": "2071-01-22",
                "level": "pratyantardasha"
              },
              {
                "lord": "Ketu",
                "startDate": "2071-01-22",
                "endDate": "2071-03-20",
                "level": "pratyantardasha"
              },
              {
                "lord": "Venus",
                "startDate": "2071-03-20",
                "endDate": "2071-08-31",
                "level": "pratyantardasha"
              },
              {
                "lord": "Sun",
                "startDate": "2071-08-31",
                "endDate": "2071-10-19",
                "level": "pratyantardasha"
              },
              {
                "lord": "Moon",
                "startDate": "2071-10-19",
                "endDate": "2072-01-09",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mars",
                "startDate": "2072-01-09",
                "endDate": "2072-03-06",
                "level": "pratyantardasha"
              },
              {
                "lord": "Rahu",
                "startDate": "2072-03-06",
                "endDate": "2072-08-01",
                "level": "pratyantardasha"
              },
              {
                "lord": "Jupiter",
                "startDate": "2072-08-01",
                "endDate": "2072-12-10",
                "level": "pratyantardasha"
              }
            ]
          }
        ]
      },
      {
        "lord": "Ketu",
        "startDate": "2072-12-10",
        "endDate": "2079-12-10",
        "level": "mahadasha",
        "children": [
          {
            "lord": "Ketu",
            "startDate": "2072-12-10",
            "endDate": "2073-05-08",
            "level": "antardasha",
            "children": [
              {
                "lord": "Ketu",
                "startDate": "2072-12-10",
                "endDate": "2072-12-18",
                "level": "pratyantardasha"
              },
              {
                "lord": "Venus",
                "startDate": "2072-12-18",
                "endDate": "2073-01-12",
                "level": "pratyantardasha"
              },
              {
                "lord": "Sun",
                "startDate": "2073-01-12",
                "endDate": "2073-01-20",
                "level": "pratyantardasha"
              },
              {
                "lord": "Moon",
                "startDate": "2073-01-20",
                "endDate": "2073-02-01",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mars",
                "startDate": "2073-02-01",
                "endDate": "2073-02-10",
                "level": "pratyantardasha"
              },
              {
                "lord": "Rahu",
                "startDate": "2073-02-10",
                "endDate": "2073-03-04",
                "level": "pratyantardasha"
              },
              {
                "lord": "Jupiter",
                "startDate": "2073-03-04",
                "endDate": "2073-03-24",
                "level": "pratyantardasha"
              },
              {
                "lord": "Saturn",
                "startDate": "2073-03-24",
                "endDate": "2073-04-17",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mercury",
                "startDate": "2073-04-17",
                "endDate": "2073-05-08",
                "level": "pratyantardasha"
              }
            ]
          },
          {
            "lord": "Venus",
            "startDate": "2073-05-08",
            "endDate": "2074-07-08",
            "level": "antardasha",
            "children": [
              {
                "lord": "Venus",
                "startDate": "2073-05-08",
                "endDate": "2073-07-18",
                "level": "pratyantardasha"
              },
              {
                "lord": "Sun",
                "startDate": "2073-07-18",
                "endDate": "2073-08-08",
                "level": "pratyantardasha"
              },
              {
                "lord": "Moon",
                "startDate": "2073-08-08",
                "endDate": "2073-09-13",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mars",
                "startDate": "2073-09-13",
                "endDate": "2073-10-08",
                "level": "pratyantardasha"
              },
              {
                "lord": "Rahu",
                "startDate": "2073-10-08",
                "endDate": "2073-12-11",
                "level": "pratyantardasha"
              },
              {
                "lord": "Jupiter",
                "startDate": "2073-12-11",
                "endDate": "2074-02-05",
                "level": "pratyantardasha"
              },
              {
                "lord": "Saturn",
                "startDate": "2074-02-05",
                "endDate": "2074-04-14",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mercury",
                "startDate": "2074-04-14",
                "endDate": "2074-06-13",
                "level": "pratyantardasha"
              },
              {
                "lord": "Ketu",
                "startDate": "2074-06-13",
                "endDate": "2074-07-08",
                "level": "pratyantardasha"
              }
            ]
          },
          {
            "lord": "Sun",
            "startDate": "2074-07-08",
            "endDate": "2074-11-13",
            "level": "antardasha",
            "children": [
              {
                "lord": "Sun",
                "startDate": "2074-07-08",
                "endDate": "2074-07-14",
                "level": "pratyantardasha"
              },
              {
                "lord": "Moon",
                "startDate": "2074-07-14",
                "endDate": "2074-07-25",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mars",
                "startDate": "2074-07-25",
                "endDate": "2074-08-02",
                "level": "pratyantardasha"
              },
              {
                "lord": "Rahu",
                "startDate": "2074-08-02",
                "endDate": "2074-08-21",
                "level": "pratyantardasha"
              },
              {
                "lord": "Jupiter",
                "startDate": "2074-08-21",
                "endDate": "2074-09-07",
                "level": "pratyantardasha"
              },
              {
                "lord": "Saturn",
                "startDate": "2074-09-07",
                "endDate": "2074-09-27",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mercury",
                "startDate": "2074-09-27",
                "endDate": "2074-10-15",
                "level": "pratyantardasha"
              },
              {
                "lord": "Ketu",
                "startDate": "2074-10-15",
                "endDate": "2074-10-23",
                "level": "pratyantardasha"
              },
              {
                "lord": "Venus",
                "startDate": "2074-10-23",
                "endDate": "2074-11-13",
                "level": "pratyantardasha"
              }
            ]
          },
          {
            "lord": "Moon",
            "startDate": "2074-11-13",
            "endDate": "2075-06-14",
            "level": "antardasha",
            "children": [
              {
                "lord": "Moon",
                "startDate": "2074-11-13",
                "endDate": "2074-12-01",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mars",
                "startDate": "2074-12-01",
                "endDate": "2074-12-13",
                "level": "pratyantardasha"
              },
              {
                "lord": "Rahu",
                "startDate": "2074-12-13",
                "endDate": "2075-01-14",
                "level": "pratyantardasha"
              },
              {
                "lord": "Jupiter",
                "startDate": "2075-01-14",
                "endDate": "2075-02-11",
                "level": "pratyantardasha"
              },
              {
                "lord": "Saturn",
                "startDate": "2075-02-11",
                "endDate": "2075-03-17",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mercury",
                "startDate": "2075-03-17",
                "endDate": "2075-04-16",
                "level": "pratyantardasha"
              },
              {
                "lord": "Ketu",
                "startDate": "2075-04-16",
                "endDate": "2075-04-29",
                "level": "pratyantardasha"
              },
              {
                "lord": "Venus",
                "startDate": "2075-04-29",
                "endDate": "2075-06-03",
                "level": "pratyantardasha"
              },
              {
                "lord": "Sun",
                "startDate": "2075-06-03",
                "endDate": "2075-06-14",
                "level": "pratyantardasha"
              }
            ]
          },
          {
            "lord": "Mars",
            "startDate": "2075-06-14",
            "endDate": "2075-11-10",
            "level": "antardasha",
            "children": [
              {
                "lord": "Mars",
                "startDate": "2075-06-14",
                "endDate": "2075-06-23",
                "level": "pratyantardasha"
              },
              {
                "lord": "Rahu",
                "startDate": "2075-06-23",
                "endDate": "2075-07-15",
                "level": "pratyantardasha"
              },
              {
                "lord": "Jupiter",
                "startDate": "2075-07-15",
                "endDate": "2075-08-04",
                "level": "pratyantardasha"
              },
              {
                "lord": "Saturn",
                "startDate": "2075-08-04",
                "endDate": "2075-08-27",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mercury",
                "startDate": "2075-08-27",
                "endDate": "2075-09-18",
                "level": "pratyantardasha"
              },
              {
                "lord": "Ketu",
                "startDate": "2075-09-18",
                "endDate": "2075-09-26",
                "level": "pratyantardasha"
              },
              {
                "lord": "Venus",
                "startDate": "2075-09-26",
                "endDate": "2075-10-21",
                "level": "pratyantardasha"
              },
              {
                "lord": "Sun",
                "startDate": "2075-10-21",
                "endDate": "2075-10-29",
                "level": "pratyantardasha"
              },
              {
                "lord": "Moon",
                "startDate": "2075-10-29",
                "endDate": "2075-11-10",
                "level": "pratyantardasha"
              }
            ]
          },
          {
            "lord": "Rahu",
            "startDate": "2075-11-10",
            "endDate": "2076-11-28",
            "level": "antardasha",
            "children": [
              {
                "lord": "Rahu",
                "startDate": "2075-11-10",
                "endDate": "2076-01-07",
                "level": "pratyantardasha"
              },
              {
                "lord": "Jupiter",
                "startDate": "2076-01-07",
                "endDate": "2076-02-27",
                "level": "pratyantardasha"
              },
              {
                "lord": "Saturn",
                "startDate": "2076-02-27",
                "endDate": "2076-04-27",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mercury",
                "startDate": "2076-04-27",
                "endDate": "2076-06-21",
                "level": "pratyantardasha"
              },
              {
                "lord": "Ketu",
                "startDate": "2076-06-21",
                "endDate": "2076-07-13",
                "level": "pratyantardasha"
              },
              {
                "lord": "Venus",
                "startDate": "2076-07-13",
                "endDate": "2076-09-15",
                "level": "pratyantardasha"
              },
              {
                "lord": "Sun",
                "startDate": "2076-09-15",
                "endDate": "2076-10-04",
                "level": "pratyantardasha"
              },
              {
                "lord": "Moon",
                "startDate": "2076-10-04",
                "endDate": "2076-11-05",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mars",
                "startDate": "2076-11-05",
                "endDate": "2076-11-28",
                "level": "pratyantardasha"
              }
            ]
          },
          {
            "lord": "Jupiter",
            "startDate": "2076-11-28",
            "endDate": "2077-11-03",
            "level": "antardasha",
            "children": [
              {
                "lord": "Jupiter",
                "startDate": "2076-11-28",
                "endDate": "2077-01-12",
                "level": "pratyantardasha"
              },
              {
                "lord": "Saturn",
                "startDate": "2077-01-12",
                "endDate": "2077-03-07",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mercury",
                "startDate": "2077-03-07",
                "endDate": "2077-04-24",
                "level": "pratyantardasha"
              },
              {
                "lord": "Ketu",
                "startDate": "2077-04-24",
                "endDate": "2077-05-14",
                "level": "pratyantardasha"
              },
              {
                "lord": "Venus",
                "startDate": "2077-05-14",
                "endDate": "2077-07-10",
                "level": "pratyantardasha"
              },
              {
                "lord": "Sun",
                "startDate": "2077-07-10",
                "endDate": "2077-07-27",
                "level": "pratyantardasha"
              },
              {
                "lord": "Moon",
                "startDate": "2077-07-27",
                "endDate": "2077-08-24",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mars",
                "startDate": "2077-08-24",
                "endDate": "2077-09-13",
                "level": "pratyantardasha"
              },
              {
                "lord": "Rahu",
                "startDate": "2077-09-13",
                "endDate": "2077-11-03",
                "level": "pratyantardasha"
              }
            ]
          },
          {
            "lord": "Saturn",
            "startDate": "2077-11-03",
            "endDate": "2078-12-13",
            "level": "antardasha",
            "children": [
              {
                "lord": "Saturn",
                "startDate": "2077-11-03",
                "endDate": "2078-01-07",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mercury",
                "startDate": "2078-01-07",
                "endDate": "2078-03-05",
                "level": "pratyantardasha"
              },
              {
                "lord": "Ketu",
                "startDate": "2078-03-05",
                "endDate": "2078-03-29",
                "level": "pratyantardasha"
              },
              {
                "lord": "Venus",
                "startDate": "2078-03-29",
                "endDate": "2078-06-04",
                "level": "pratyantardasha"
              },
              {
                "lord": "Sun",
                "startDate": "2078-06-04",
                "endDate": "2078-06-24",
                "level": "pratyantardasha"
              },
              {
                "lord": "Moon",
                "startDate": "2078-06-24",
                "endDate": "2078-07-28",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mars",
                "startDate": "2078-07-28",
                "endDate": "2078-08-21",
                "level": "pratyantardasha"
              },
              {
                "lord": "Rahu",
                "startDate": "2078-08-21",
                "endDate": "2078-10-20",
                "level": "pratyantardasha"
              },
              {
                "lord": "Jupiter",
                "startDate": "2078-10-20",
                "endDate": "2078-12-13",
                "level": "pratyantardasha"
              }
            ]
          },
          {
            "lord": "Mercury",
            "startDate": "2078-12-13",
            "endDate": "2079-12-10",
            "level": "antardasha",
            "children": [
              {
                "lord": "Mercury",
                "startDate": "2078-12-13",
                "endDate": "2079-02-03",
                "level": "pratyantardasha"
              },
              {
                "lord": "Ketu",
                "startDate": "2079-02-03",
                "endDate": "2079-02-24",
                "level": "pratyantardasha"
              },
              {
                "lord": "Venus",
                "startDate": "2079-02-24",
                "endDate": "2079-04-25",
                "level": "pratyantardasha"
              },
              {
                "lord": "Sun",
                "startDate": "2079-04-25",
                "endDate": "2079-05-13",
                "level": "pratyantardasha"
              },
              {
                "lord": "Moon",
                "startDate": "2079-05-13",
                "endDate": "2079-06-12",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mars",
                "startDate": "2079-06-12",
                "endDate": "2079-07-03",
                "level": "pratyantardasha"
              },
              {
                "lord": "Rahu",
                "startDate": "2079-07-03",
                "endDate": "2079-08-27",
                "level": "pratyantardasha"
              },
              {
                "lord": "Jupiter",
                "startDate": "2079-08-27",
                "endDate": "2079-10-14",
                "level": "pratyantardasha"
              },
              {
                "lord": "Saturn",
                "startDate": "2079-10-14",
                "endDate": "2079-12-10",
                "level": "pratyantardasha"
              }
            ]
          }
        ]
      },
      {
        "lord": "Venus",
        "startDate": "2079-12-10",
        "endDate": "2099-12-10",
        "level": "mahadasha",
        "children": [
          {
            "lord": "Venus",
            "startDate": "2079-12-10",
            "endDate": "2083-04-11",
            "level": "antardasha",
            "children": [
              {
                "lord": "Venus",
                "startDate": "2079-12-10",
                "endDate": "2080-06-30",
                "level": "pratyantardasha"
              },
              {
                "lord": "Sun",
                "startDate": "2080-06-30",
                "endDate": "2080-08-30",
                "level": "pratyantardasha"
              },
              {
                "lord": "Moon",
                "startDate": "2080-08-30",
                "endDate": "2080-12-10",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mars",
                "startDate": "2080-12-10",
                "endDate": "2081-02-19",
                "level": "pratyantardasha"
              },
              {
                "lord": "Rahu",
                "startDate": "2081-02-19",
                "endDate": "2081-08-20",
                "level": "pratyantardasha"
              },
              {
                "lord": "Jupiter",
                "startDate": "2081-08-20",
                "endDate": "2082-01-30",
                "level": "pratyantardasha"
              },
              {
                "lord": "Saturn",
                "startDate": "2082-01-30",
                "endDate": "2082-08-10",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mercury",
                "startDate": "2082-08-10",
                "endDate": "2083-01-30",
                "level": "pratyantardasha"
              },
              {
                "lord": "Ketu",
                "startDate": "2083-01-30",
                "endDate": "2083-04-11",
                "level": "pratyantardasha"
              }
            ]
          },
          {
            "lord": "Sun",
            "startDate": "2083-04-11",
            "endDate": "2084-04-10",
            "level": "antardasha",
            "children": [
              {
                "lord": "Sun",
                "startDate": "2083-04-11",
                "endDate": "2083-04-29",
                "level": "pratyantardasha"
              },
              {
                "lord": "Moon",
                "startDate": "2083-04-29",
                "endDate": "2083-05-30",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mars",
                "startDate": "2083-05-30",
                "endDate": "2083-06-20",
                "level": "pratyantardasha"
              },
              {
                "lord": "Rahu",
                "startDate": "2083-06-20",
                "endDate": "2083-08-14",
                "level": "pratyantardasha"
              },
              {
                "lord": "Jupiter",
                "startDate": "2083-08-14",
                "endDate": "2083-10-01",
                "level": "pratyantardasha"
              },
              {
                "lord": "Saturn",
                "startDate": "2083-10-01",
                "endDate": "2083-11-28",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mercury",
                "startDate": "2083-11-28",
                "endDate": "2084-01-19",
                "level": "pratyantardasha"
              },
              {
                "lord": "Ketu",
                "startDate": "2084-01-19",
                "endDate": "2084-02-09",
                "level": "pratyantardasha"
              },
              {
                "lord": "Venus",
                "startDate": "2084-02-09",
                "endDate": "2084-04-10",
                "level": "pratyantardasha"
              }
            ]
          },
          {
            "lord": "Moon",
            "startDate": "2084-04-10",
            "endDate": "2085-12-10",
            "level": "antardasha",
            "children": [
              {
                "lord": "Moon",
                "startDate": "2084-04-10",
                "endDate": "2084-05-31",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mars",
                "startDate": "2084-05-31",
                "endDate": "2084-07-05",
                "level": "pratyantardasha"
              },
              {
                "lord": "Rahu",
                "startDate": "2084-07-05",
                "endDate": "2084-10-05",
                "level": "pratyantardasha"
              },
              {
                "lord": "Jupiter",
                "startDate": "2084-10-05",
                "endDate": "2084-12-25",
                "level": "pratyantardasha"
              },
              {
                "lord": "Saturn",
                "startDate": "2084-12-25",
                "endDate": "2085-03-31",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mercury",
                "startDate": "2085-03-31",
                "endDate": "2085-06-26",
                "level": "pratyantardasha"
              },
              {
                "lord": "Ketu",
                "startDate": "2085-06-26",
                "endDate": "2085-07-31",
                "level": "pratyantardasha"
              },
              {
                "lord": "Venus",
                "startDate": "2085-07-31",
                "endDate": "2085-11-09",
                "level": "pratyantardasha"
              },
              {
                "lord": "Sun",
                "startDate": "2085-11-09",
                "endDate": "2085-12-10",
                "level": "pratyantardasha"
              }
            ]
          },
          {
            "lord": "Mars",
            "startDate": "2085-12-10",
            "endDate": "2087-02-09",
            "level": "antardasha",
            "children": [
              {
                "lord": "Mars",
                "startDate": "2085-12-10",
                "endDate": "2086-01-04",
                "level": "pratyantardasha"
              },
              {
                "lord": "Rahu",
                "startDate": "2086-01-04",
                "endDate": "2086-03-09",
                "level": "pratyantardasha"
              },
              {
                "lord": "Jupiter",
                "startDate": "2086-03-09",
                "endDate": "2086-05-05",
                "level": "pratyantardasha"
              },
              {
                "lord": "Saturn",
                "startDate": "2086-05-05",
                "endDate": "2086-07-11",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mercury",
                "startDate": "2086-07-11",
                "endDate": "2086-09-09",
                "level": "pratyantardasha"
              },
              {
                "lord": "Ketu",
                "startDate": "2086-09-09",
                "endDate": "2086-10-04",
                "level": "pratyantardasha"
              },
              {
                "lord": "Venus",
                "startDate": "2086-10-04",
                "endDate": "2086-12-14",
                "level": "pratyantardasha"
              },
              {
                "lord": "Sun",
                "startDate": "2086-12-14",
                "endDate": "2087-01-05",
                "level": "pratyantardasha"
              },
              {
                "lord": "Moon",
                "startDate": "2087-01-05",
                "endDate": "2087-02-09",
                "level": "pratyantardasha"
              }
            ]
          },
          {
            "lord": "Rahu",
            "startDate": "2087-02-09",
            "endDate": "2090-02-09",
            "level": "antardasha",
            "children": [
              {
                "lord": "Rahu",
                "startDate": "2087-02-09",
                "endDate": "2087-07-23",
                "level": "pratyantardasha"
              },
              {
                "lord": "Jupiter",
                "startDate": "2087-07-23",
                "endDate": "2087-12-16",
                "level": "pratyantardasha"
              },
              {
                "lord": "Saturn",
                "startDate": "2087-12-16",
                "endDate": "2088-06-07",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mercury",
                "startDate": "2088-06-07",
                "endDate": "2088-11-09",
                "level": "pratyantardasha"
              },
              {
                "lord": "Ketu",
                "startDate": "2088-11-09",
                "endDate": "2089-01-12",
                "level": "pratyantardasha"
              },
              {
                "lord": "Venus",
                "startDate": "2089-01-12",
                "endDate": "2089-07-14",
                "level": "pratyantardasha"
              },
              {
                "lord": "Sun",
                "startDate": "2089-07-14",
                "endDate": "2089-09-07",
                "level": "pratyantardasha"
              },
              {
                "lord": "Moon",
                "startDate": "2089-09-07",
                "endDate": "2089-12-07",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mars",
                "startDate": "2089-12-07",
                "endDate": "2090-02-09",
                "level": "pratyantardasha"
              }
            ]
          },
          {
            "lord": "Jupiter",
            "startDate": "2090-02-09",
            "endDate": "2092-10-10",
            "level": "antardasha",
            "children": [
              {
                "lord": "Jupiter",
                "startDate": "2090-02-09",
                "endDate": "2090-06-19",
                "level": "pratyantardasha"
              },
              {
                "lord": "Saturn",
                "startDate": "2090-06-19",
                "endDate": "2090-11-20",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mercury",
                "startDate": "2090-11-20",
                "endDate": "2091-04-07",
                "level": "pratyantardasha"
              },
              {
                "lord": "Ketu",
                "startDate": "2091-04-07",
                "endDate": "2091-06-03",
                "level": "pratyantardasha"
              },
              {
                "lord": "Venus",
                "startDate": "2091-06-03",
                "endDate": "2091-11-12",
                "level": "pratyantardasha"
              },
              {
                "lord": "Sun",
                "startDate": "2091-11-12",
                "endDate": "2091-12-31",
                "level": "pratyantardasha"
              },
              {
                "lord": "Moon",
                "startDate": "2091-12-31",
                "endDate": "2092-03-21",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mars",
                "startDate": "2092-03-21",
                "endDate": "2092-05-17",
                "level": "pratyantardasha"
              },
              {
                "lord": "Rahu",
                "startDate": "2092-05-17",
                "endDate": "2092-10-10",
                "level": "pratyantardasha"
              }
            ]
          },
          {
            "lord": "Saturn",
            "startDate": "2092-10-10",
            "endDate": "2095-12-10",
            "level": "antardasha",
            "children": [
              {
                "lord": "Saturn",
                "startDate": "2092-10-10",
                "endDate": "2093-04-11",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mercury",
                "startDate": "2093-04-11",
                "endDate": "2093-09-22",
                "level": "pratyantardasha"
              },
              {
                "lord": "Ketu",
                "startDate": "2093-09-22",
                "endDate": "2093-11-28",
                "level": "pratyantardasha"
              },
              {
                "lord": "Venus",
                "startDate": "2093-11-28",
                "endDate": "2094-06-09",
                "level": "pratyantardasha"
              },
              {
                "lord": "Sun",
                "startDate": "2094-06-09",
                "endDate": "2094-08-06",
                "level": "pratyantardasha"
              },
              {
                "lord": "Moon",
                "startDate": "2094-08-06",
                "endDate": "2094-11-10",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mars",
                "startDate": "2094-11-10",
                "endDate": "2095-01-17",
                "level": "pratyantardasha"
              },
              {
                "lord": "Rahu",
                "startDate": "2095-01-17",
                "endDate": "2095-07-09",
                "level": "pratyantardasha"
              },
              {
                "lord": "Jupiter",
                "startDate": "2095-07-09",
                "endDate": "2095-12-10",
                "level": "pratyantardasha"
              }
            ]
          },
          {
            "lord": "Mercury",
            "startDate": "2095-12-10",
            "endDate": "2098-10-10",
            "level": "antardasha",
            "children": [
              {
                "lord": "Mercury",
                "startDate": "2095-12-10",
                "endDate": "2096-05-05",
                "level": "pratyantardasha"
              },
              {
                "lord": "Ketu",
                "startDate": "2096-05-05",
                "endDate": "2096-07-04",
                "level": "pratyantardasha"
              },
              {
                "lord": "Venus",
                "startDate": "2096-07-04",
                "endDate": "2096-12-24",
                "level": "pratyantardasha"
              },
              {
                "lord": "Sun",
                "startDate": "2096-12-24",
                "endDate": "2097-02-14",
                "level": "pratyantardasha"
              },
              {
                "lord": "Moon",
                "startDate": "2097-02-14",
                "endDate": "2097-05-11",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mars",
                "startDate": "2097-05-11",
                "endDate": "2097-07-10",
                "level": "pratyantardasha"
              },
              {
                "lord": "Rahu",
                "startDate": "2097-07-10",
                "endDate": "2097-12-12",
                "level": "pratyantardasha"
              },
              {
                "lord": "Jupiter",
                "startDate": "2097-12-12",
                "endDate": "2098-04-29",
                "level": "pratyantardasha"
              },
              {
                "lord": "Saturn",
                "startDate": "2098-04-29",
                "endDate": "2098-10-10",
                "level": "pratyantardasha"
              }
            ]
          },
          {
            "lord": "Ketu",
            "startDate": "2098-10-10",
            "endDate": "2099-12-10",
            "level": "antardasha",
            "children": [
              {
                "lord": "Ketu",
                "startDate": "2098-10-10",
                "endDate": "2098-11-04",
                "level": "pratyantardasha"
              },
              {
                "lord": "Venus",
                "startDate": "2098-11-04",
                "endDate": "2099-01-14",
                "level": "pratyantardasha"
              },
              {
                "lord": "Sun",
                "startDate": "2099-01-14",
                "endDate": "2099-02-04",
                "level": "pratyantardasha"
              },
              {
                "lord": "Moon",
                "startDate": "2099-02-04",
                "endDate": "2099-03-12",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mars",
                "startDate": "2099-03-12",
                "endDate": "2099-04-06",
                "level": "pratyantardasha"
              },
              {
                "lord": "Rahu",
                "startDate": "2099-04-06",
                "endDate": "2099-06-09",
                "level": "pratyantardasha"
              },
              {
                "lord": "Jupiter",
                "startDate": "2099-06-09",
                "endDate": "2099-08-04",
                "level": "pratyantardasha"
              },
              {
                "lord": "Saturn",
                "startDate": "2099-08-04",
                "endDate": "2099-10-11",
                "level": "pratyantardasha"
              },
              {
                "lord": "Mercury",
                "startDate": "2099-10-11",
                "endDate": "2099-12-10",
                "level": "pratyantardasha"
              }
            ]
          }
        ]
      }
    ],
    "currentStack": {
      "mahadasha": "Jupiter",
      "antardasha": "Mercury",
      "pratyantardasha": "Rahu",
      "mdStart": "2020-12-10",
      "mdEnd": "2036-12-10",
      "adStart": "2025-08-11",
      "adEnd": "2027-11-16",
      "pdStart": "2026-11-16",
      "pdEnd": "2027-03-20",
      "mdProgressPct": 37.2,
      "adProgressPct": 57,
      "mdSandhiWarning": false,
      "adSandhiWarning": false
    }
  },
  shadbala: {
    "planets": [
      {
        "planet": "Sun",
        "sthanaBala": 226.6,
        "digBala": 44.9,
        "kalaBala": 119.2,
        "chestaBala": 56.5,
        "naisargikaBala": 60,
        "drikBala": -15,
        "totalVirupas": 492.2,
        "totalRupas": 8.2,
        "requiredRupas": 5,
        "ratio": 1.64,
        "isStrong": true,
        "ishtaPhala": 36.9,
        "kashtaPhala": 11.2,
        "strengthRank": 1
      },
      {
        "planet": "Moon",
        "sthanaBala": 232.2,
        "digBala": 32.2,
        "kalaBala": 47.8,
        "chestaBala": 17,
        "naisargikaBala": 51.4,
        "drikBala": 0,
        "totalVirupas": 380.6,
        "totalRupas": 6.34,
        "requiredRupas": 6,
        "ratio": 1.06,
        "isStrong": true,
        "ishtaPhala": 15.8,
        "kashtaPhala": 44.1,
        "strengthRank": 4
      },
      {
        "planet": "Mars",
        "sthanaBala": 231.3,
        "digBala": 53.9,
        "kalaBala": 56.7,
        "chestaBala": 27.4,
        "naisargikaBala": 17.1,
        "drikBala": 0,
        "totalVirupas": 386.4,
        "totalRupas": 6.44,
        "requiredRupas": 5,
        "ratio": 1.29,
        "isStrong": true,
        "ishtaPhala": 24.1,
        "kashtaPhala": 35.6,
        "strengthRank": 2
      },
      {
        "planet": "Mercury",
        "sthanaBala": 213.5,
        "digBala": 49.4,
        "kalaBala": 107,
        "chestaBala": 17.5,
        "naisargikaBala": 25.7,
        "drikBala": 0,
        "totalVirupas": 413.2,
        "totalRupas": 6.89,
        "requiredRupas": 7,
        "ratio": 0.98,
        "isStrong": false,
        "ishtaPhala": 29.1,
        "kashtaPhala": 22.1,
        "strengthRank": 6
      },
      {
        "planet": "Jupiter",
        "sthanaBala": 200.7,
        "digBala": 54.3,
        "kalaBala": 93.3,
        "chestaBala": 20.3,
        "naisargikaBala": 34.3,
        "drikBala": -11.3,
        "totalVirupas": 391.7,
        "totalRupas": 6.53,
        "requiredRupas": 6.5,
        "ratio": 1,
        "isStrong": true,
        "ishtaPhala": 29.7,
        "kashtaPhala": 25.8,
        "strengthRank": 5
      },
      {
        "planet": "Venus",
        "sthanaBala": 118.5,
        "digBala": 21.4,
        "kalaBala": 108.3,
        "chestaBala": 18.6,
        "naisargikaBala": 42.9,
        "drikBala": -11.3,
        "totalVirupas": 298.4,
        "totalRupas": 4.97,
        "requiredRupas": 5.5,
        "ratio": 0.9,
        "isStrong": false,
        "ishtaPhala": 15.9,
        "kashtaPhala": 43.9,
        "strengthRank": 7
      },
      {
        "planet": "Saturn",
        "sthanaBala": 187.5,
        "digBala": 42.6,
        "kalaBala": 86.7,
        "chestaBala": 60,
        "naisargikaBala": 8.6,
        "drikBala": -15,
        "totalVirupas": 370.3,
        "totalRupas": 6.17,
        "requiredRupas": 5,
        "ratio": 1.23,
        "isStrong": true,
        "ishtaPhala": 42.4,
        "kashtaPhala": 0,
        "strengthRank": 3
      }
    ],
    "strongestPlanet": "Sun",
    "weakestPlanet": "Venus"
  },
  panchang: {
    "vara": "Friday (Shukravara)",
    "tithi": {
      "number": 5,
      "name": "Shukla Panchami",
      "paksha": "Shukla"
    },
    "yoga": {
      "number": 22,
      "name": "Sadhya"
    },
    "karana": "Bava",
    "moonSign": "Virgo",
    "sunSign": "Cancer",
    "nakshatra": "Hasta",
    "pada": 3,
    "avakhada": {
      "varna": "Vaishya",
      "vashya": "Dwipada (Human)",
      "yoni": "Horse",
      "gana": "Deva",
      "nadi": "Adi (Vata)",
      "tatva": "Earth (Prithvi)",
      "paya": "Gold",
      "yunja": "Madhya",
      "hansak": "Bhoomi",
      "namakshar": "Cho"
    }
  },
  conditions: [
    {
      "planet": "Sun",
      "sign": "Cancer",
      "house": 11,
      "dignity": "Friendly",
      "isRetrograde": false,
      "isCombust": false,
      "isVargottama": false,
      "baladiAvastha": "Bala (Infant)",
      "jagradadiAvastha": "Swapna (Dreaming)",
      "aspectsHouses": [
        5
      ],
      "conjunctWith": []
    },
    {
      "planet": "Moon",
      "sign": "Virgo",
      "house": 1,
      "dignity": "Friendly",
      "isRetrograde": false,
      "isCombust": false,
      "isVargottama": false,
      "baladiAvastha": "Kumara (Youth)",
      "jagradadiAvastha": "Swapna (Dreaming)",
      "aspectsHouses": [
        7
      ],
      "conjunctWith": []
    },
    {
      "planet": "Mars",
      "sign": "Taurus",
      "house": 9,
      "dignity": "Neutral",
      "isRetrograde": false,
      "isCombust": false,
      "isVargottama": false,
      "baladiAvastha": "Bala (Infant)",
      "jagradadiAvastha": "Swapna (Dreaming)",
      "aspectsHouses": [
        3,
        4,
        12
      ],
      "conjunctWith": []
    },
    {
      "planet": "Mercury",
      "sign": "Leo",
      "house": 12,
      "dignity": "Friendly",
      "isRetrograde": false,
      "isCombust": true,
      "isVargottama": false,
      "baladiAvastha": "Kumara (Youth)",
      "jagradadiAvastha": "Swapna (Dreaming)",
      "aspectsHouses": [
        6
      ],
      "conjunctWith": [
        "Jupiter",
        "Venus"
      ]
    },
    {
      "planet": "Jupiter",
      "sign": "Leo",
      "house": 12,
      "dignity": "Friendly",
      "isRetrograde": false,
      "isCombust": false,
      "isVargottama": false,
      "baladiAvastha": "Mrita (Dormant)",
      "jagradadiAvastha": "Swapna (Dreaming)",
      "aspectsHouses": [
        4,
        6,
        8
      ],
      "conjunctWith": [
        "Mercury",
        "Venus"
      ]
    },
    {
      "planet": "Venus",
      "sign": "Leo",
      "house": 12,
      "dignity": "Enemy",
      "isRetrograde": false,
      "isCombust": false,
      "isVargottama": true,
      "baladiAvastha": "Yuva (Adult)",
      "jagradadiAvastha": "Swapna (Dreaming)",
      "aspectsHouses": [
        6
      ],
      "conjunctWith": [
        "Mercury",
        "Jupiter"
      ]
    },
    {
      "planet": "Saturn",
      "sign": "Capricorn",
      "house": 5,
      "dignity": "Own Sign",
      "isRetrograde": true,
      "isCombust": false,
      "isVargottama": false,
      "baladiAvastha": "Kumara (Youth)",
      "jagradadiAvastha": "Jagrat (Awake)",
      "aspectsHouses": [
        2,
        7,
        11
      ],
      "conjunctWith": []
    },
    {
      "planet": "Rahu",
      "sign": "Sagittarius",
      "house": 4,
      "dignity": "Neutral",
      "isRetrograde": true,
      "isCombust": false,
      "isVargottama": false,
      "baladiAvastha": "Bala (Infant)",
      "jagradadiAvastha": "Swapna (Dreaming)",
      "aspectsHouses": [
        8,
        10,
        12
      ],
      "conjunctWith": []
    },
    {
      "planet": "Ketu",
      "sign": "Gemini",
      "house": 10,
      "dignity": "Neutral",
      "isRetrograde": true,
      "isCombust": false,
      "isVargottama": false,
      "baladiAvastha": "Bala (Infant)",
      "jagradadiAvastha": "Swapna (Dreaming)",
      "aspectsHouses": [
        2,
        4,
        6
      ],
      "conjunctWith": []
    }
  ],
  yogas: [
    {
      "name": "Raja Yoga (Mercury + Venus)",
      "category": "Raja Yoga",
      "planets": [
        "Mercury",
        "Venus"
      ],
      "summary": "Conjunction of Kendra & Trikona lords in Leo (House 12), conferring leadership momentum."
    },
    {
      "name": "Raja Yoga (Jupiter + Mercury)",
      "category": "Raja Yoga",
      "planets": [
        "Jupiter",
        "Mercury"
      ],
      "summary": "Conjunction of Kendra & Trikona lords in Leo (House 12), conferring leadership momentum."
    },
    {
      "name": "Raja Yoga (Jupiter + Venus)",
      "category": "Raja Yoga",
      "planets": [
        "Jupiter",
        "Venus"
      ],
      "summary": "Conjunction of Kendra & Trikona lords in Leo (House 12), conferring leadership momentum."
    }
  ],
  lalKitab: {
    "planets": [
      {
        "planet": "Sun",
        "house": 11,
        "sign": "Cancer",
        "pakkaGhar": [
          1
        ],
        "karakaOf": "Father, Soul, Authority",
        "exaltedHouses": [
          1
        ],
        "debilitatedHouses": [
          7
        ],
        "status": "Mixed",
        "isSleeping": false,
        "notes": "Acts according to planetary companions in H11"
      },
      {
        "planet": "Moon",
        "house": 1,
        "sign": "Virgo",
        "pakkaGhar": [
          4
        ],
        "karakaOf": "Mother, Mind, Wealth",
        "exaltedHouses": [
          2
        ],
        "debilitatedHouses": [
          8
        ],
        "status": "Dormant (Soya)",
        "isSleeping": true,
        "notes": "Requires activation via 7th house (7)"
      },
      {
        "planet": "Mars",
        "house": 9,
        "sign": "Taurus",
        "pakkaGhar": [
          3,
          8
        ],
        "karakaOf": "Courage, Siblings, Land",
        "exaltedHouses": [
          10
        ],
        "debilitatedHouses": [
          4
        ],
        "status": "Dormant (Soya)",
        "isSleeping": true,
        "notes": "Requires activation via 7th house (3)"
      },
      {
        "planet": "Mercury",
        "house": 12,
        "sign": "Leo",
        "pakkaGhar": [
          7
        ],
        "karakaOf": "Intellect, Speech, Trade",
        "exaltedHouses": [
          6
        ],
        "debilitatedHouses": [
          12
        ],
        "status": "Dormant (Soya)",
        "isSleeping": true,
        "notes": "Lal Kitab Debilitated House · Requires activation via 7th house (6)"
      },
      {
        "planet": "Jupiter",
        "house": 12,
        "sign": "Leo",
        "pakkaGhar": [
          2,
          5,
          9,
          11,
          12
        ],
        "karakaOf": "Wisdom, Dharma, Children",
        "exaltedHouses": [
          4
        ],
        "debilitatedHouses": [
          10
        ],
        "status": "Benefic",
        "isSleeping": false,
        "notes": "In Pakka Ghar (H12)"
      },
      {
        "planet": "Venus",
        "house": 12,
        "sign": "Leo",
        "pakkaGhar": [
          7
        ],
        "karakaOf": "Spouse, Luxury, Beauty",
        "exaltedHouses": [
          12
        ],
        "debilitatedHouses": [
          6
        ],
        "status": "Dormant (Soya)",
        "isSleeping": true,
        "notes": "Lal Kitab Exalted House · Requires activation via 7th house (6)"
      },
      {
        "planet": "Saturn",
        "house": 5,
        "sign": "Capricorn",
        "pakkaGhar": [
          8,
          10
        ],
        "karakaOf": "Justice, Career, Endurance",
        "exaltedHouses": [
          7
        ],
        "debilitatedHouses": [
          1
        ],
        "status": "Malefic",
        "isSleeping": false,
        "notes": "Acts according to planetary companions in H5"
      },
      {
        "planet": "Rahu",
        "house": 4,
        "sign": "Sagittarius",
        "pakkaGhar": [
          12
        ],
        "karakaOf": "Diplomacy, In-laws, Ambition",
        "exaltedHouses": [
          3,
          6
        ],
        "debilitatedHouses": [
          8,
          9,
          12
        ],
        "status": "Mixed",
        "isSleeping": false,
        "notes": "Acts according to planetary companions in H4"
      },
      {
        "planet": "Ketu",
        "house": 10,
        "sign": "Gemini",
        "pakkaGhar": [
          6
        ],
        "karakaOf": "Son, Intuition, Liberation",
        "exaltedHouses": [
          9,
          12
        ],
        "debilitatedHouses": [
          3,
          6
        ],
        "status": "Mixed",
        "isSleeping": false,
        "notes": "Acts according to planetary companions in H10"
      }
    ],
    "isAndhiKundli": false,
    "isDharmiTewa": false,
    "sleepingHouses": [
      2,
      3,
      6,
      7,
      8
    ],
    "karmicDebts": [
      {
        "name": "Pitr Rina (Ancestral Debt)",
        "indicator": "Venus, Mercury, or Rahu in Houses 2, 5, 9, or 12 afflicting Jupiter/9th",
        "active": true
      },
      {
        "name": "Matr Rina (Mother Debt)",
        "indicator": "Ketu in House 4 or afflicting Moon",
        "active": false
      },
      {
        "name": "Self / Swarup Rina",
        "indicator": "Venus, Saturn, Rahu, or Ketu in House 5 or Sun in 12",
        "active": true
      },
      {
        "name": "Stri / Partner Debt",
        "indicator": "Sun, Moon, or Rahu in Houses 2 or 7",
        "active": false
      },
      {
        "name": "Daiva / Guru Debt",
        "indicator": "Mercury, Venus, or Rahu in Houses 2, 5, 9, 12 with Jupiter in 6/10",
        "active": false
      }
    ],
    "varshaphal": {
      "runningAge": 35,
      "cycleYear": 11,
      "placements": [
        {
          "natalHouse": 1,
          "annualHouse": 7,
          "planets": [
            "Moon"
          ]
        },
        {
          "natalHouse": 2,
          "annualHouse": 9,
          "planets": []
        },
        {
          "natalHouse": 3,
          "annualHouse": 11,
          "planets": []
        },
        {
          "natalHouse": 4,
          "annualHouse": 1,
          "planets": [
            "Rahu"
          ]
        },
        {
          "natalHouse": 5,
          "annualHouse": 9,
          "planets": [
            "Saturn"
          ]
        },
        {
          "natalHouse": 6,
          "annualHouse": 4,
          "planets": []
        },
        {
          "natalHouse": 7,
          "annualHouse": 6,
          "planets": []
        },
        {
          "natalHouse": 8,
          "annualHouse": 10,
          "planets": []
        },
        {
          "natalHouse": 9,
          "annualHouse": 12,
          "planets": [
            "Mars"
          ]
        },
        {
          "natalHouse": 10,
          "annualHouse": 2,
          "planets": [
            "Ketu"
          ]
        },
        {
          "natalHouse": 11,
          "annualHouse": 3,
          "planets": [
            "Sun"
          ]
        },
        {
          "natalHouse": 12,
          "annualHouse": 5,
          "planets": [
            "Mercury",
            "Jupiter",
            "Venus"
          ]
        }
      ]
    }
  },
  western: {
    "system": "Tropical (Placidus)",
    "ayanamshaUsedForConversion": 23.754,
    "planets": [
      {
        "name": "Sun",
        "symbol": "☉",
        "longitude": 141.554,
        "signIndex": 4,
        "sign": "Leo",
        "degreeInSign": 21.554,
        "dms": "21°33'14\"",
        "house": 11,
        "wholeSignHouse": 11,
        "isRetrograde": false,
        "dignity": "Domicile",
        "element": "Fire",
        "modality": "Fixed",
        "essentialScore": 5,
        "accidentalScore": 1,
        "houseClass": "Succedent",
        "solarCondition": "Free",
        "sectAlignment": "In Sect"
      },
      {
        "name": "Moon",
        "symbol": "☽",
        "longitude": 192.654,
        "signIndex": 6,
        "sign": "Libra",
        "degreeInSign": 12.654,
        "dms": "12°39'14\"",
        "house": 1,
        "wholeSignHouse": 1,
        "isRetrograde": false,
        "dignity": "Peregrine",
        "element": "Air",
        "modality": "Cardinal",
        "essentialScore": 0,
        "accidentalScore": 3,
        "houseClass": "Angular",
        "solarCondition": "Free",
        "sectAlignment": "Contrary to Sect"
      },
      {
        "name": "Mars",
        "symbol": "♂",
        "longitude": 77.954,
        "signIndex": 2,
        "sign": "Gemini",
        "degreeInSign": 17.954,
        "dms": "17°57'14\"",
        "house": 9,
        "wholeSignHouse": 9,
        "isRetrograde": false,
        "dignity": "Peregrine",
        "element": "Air",
        "modality": "Mutable",
        "essentialScore": 0,
        "accidentalScore": -1,
        "houseClass": "Cadent",
        "solarCondition": "Free",
        "sectAlignment": "Contrary to Sect"
      },
      {
        "name": "Mercury",
        "symbol": "☿",
        "longitude": 154.354,
        "signIndex": 5,
        "sign": "Virgo",
        "degreeInSign": 4.354,
        "dms": "04°21'14\"",
        "house": 12,
        "wholeSignHouse": 12,
        "isRetrograde": false,
        "dignity": "Domicile",
        "element": "Earth",
        "modality": "Mutable",
        "essentialScore": 5,
        "accidentalScore": -1,
        "houseClass": "Cadent",
        "solarCondition": "Under Beams",
        "sectAlignment": "Neutral"
      },
      {
        "name": "Jupiter",
        "symbol": "♃",
        "longitude": 169.054,
        "signIndex": 5,
        "sign": "Virgo",
        "degreeInSign": 19.054,
        "dms": "19°03'14\"",
        "house": 12,
        "wholeSignHouse": 12,
        "isRetrograde": false,
        "dignity": "Detriment",
        "element": "Earth",
        "modality": "Mutable",
        "essentialScore": -5,
        "accidentalScore": -1,
        "houseClass": "Cadent",
        "solarCondition": "Free",
        "sectAlignment": "In Sect"
      },
      {
        "name": "Venus",
        "symbol": "♀",
        "longitude": 160.254,
        "signIndex": 5,
        "sign": "Virgo",
        "degreeInSign": 10.254,
        "dms": "10°15'14\"",
        "house": 12,
        "wholeSignHouse": 12,
        "isRetrograde": false,
        "dignity": "Fall",
        "element": "Earth",
        "modality": "Mutable",
        "essentialScore": -4,
        "accidentalScore": -1,
        "houseClass": "Cadent",
        "solarCondition": "Free",
        "sectAlignment": "Contrary to Sect"
      },
      {
        "name": "Saturn",
        "symbol": "♄",
        "longitude": 313.854,
        "signIndex": 10,
        "sign": "Aquarius",
        "degreeInSign": 13.854,
        "dms": "13°51'14\"",
        "house": 5,
        "wholeSignHouse": 5,
        "isRetrograde": true,
        "dignity": "Domicile",
        "element": "Air",
        "modality": "Fixed",
        "essentialScore": 5,
        "accidentalScore": 0,
        "houseClass": "Succedent",
        "solarCondition": "Free",
        "sectAlignment": "In Sect"
      },
      {
        "name": "North Node",
        "symbol": "☊",
        "longitude": 268.454,
        "signIndex": 8,
        "sign": "Sagittarius",
        "degreeInSign": 28.454,
        "dms": "28°27'14\"",
        "house": 3,
        "wholeSignHouse": 3,
        "isRetrograde": true,
        "dignity": "Peregrine",
        "element": "Fire",
        "modality": "Mutable",
        "essentialScore": 0,
        "accidentalScore": -1,
        "houseClass": "Cadent",
        "solarCondition": "Free",
        "sectAlignment": "Neutral"
      },
      {
        "name": "South Node",
        "symbol": "☋",
        "longitude": 88.454,
        "signIndex": 2,
        "sign": "Gemini",
        "degreeInSign": 28.454,
        "dms": "28°27'14\"",
        "house": 9,
        "wholeSignHouse": 9,
        "isRetrograde": true,
        "dignity": "Peregrine",
        "element": "Air",
        "modality": "Mutable",
        "essentialScore": 0,
        "accidentalScore": -1,
        "houseClass": "Cadent",
        "solarCondition": "Free",
        "sectAlignment": "Neutral"
      },
      {
        "name": "Uranus",
        "symbol": "♅",
        "longitude": 284.5926,
        "signIndex": 9,
        "sign": "Capricorn",
        "degreeInSign": 14.5926,
        "dms": "14°35'33\"",
        "house": 4,
        "wholeSignHouse": 4,
        "isRetrograde": true,
        "dignity": "Peregrine",
        "element": "Earth",
        "modality": "Cardinal",
        "essentialScore": 0,
        "accidentalScore": 2,
        "houseClass": "Angular",
        "solarCondition": "Free",
        "sectAlignment": "Neutral"
      },
      {
        "name": "Neptune",
        "symbol": "♆",
        "longitude": 286.576,
        "signIndex": 9,
        "sign": "Capricorn",
        "degreeInSign": 16.576,
        "dms": "16°34'34\"",
        "house": 4,
        "wholeSignHouse": 4,
        "isRetrograde": true,
        "dignity": "Peregrine",
        "element": "Earth",
        "modality": "Cardinal",
        "essentialScore": 0,
        "accidentalScore": 2,
        "houseClass": "Angular",
        "solarCondition": "Free",
        "sectAlignment": "Neutral"
      },
      {
        "name": "Pluto",
        "symbol": "♇",
        "longitude": 230.0712,
        "signIndex": 7,
        "sign": "Scorpio",
        "degreeInSign": 20.0712,
        "dms": "20°04'16\"",
        "house": 2,
        "wholeSignHouse": 2,
        "isRetrograde": false,
        "dignity": "Domicile",
        "element": "Water",
        "modality": "Fixed",
        "essentialScore": 5,
        "accidentalScore": 1,
        "houseClass": "Succedent",
        "solarCondition": "Free",
        "sectAlignment": "Neutral"
      },
      {
        "name": "Chiron",
        "symbol": "⚷",
        "longitude": 128.5713,
        "signIndex": 4,
        "sign": "Leo",
        "degreeInSign": 8.5713,
        "dms": "08°34'17\"",
        "house": 11,
        "wholeSignHouse": 11,
        "isRetrograde": false,
        "dignity": "Peregrine",
        "element": "Fire",
        "modality": "Fixed",
        "essentialScore": 0,
        "accidentalScore": 1,
        "houseClass": "Succedent",
        "solarCondition": "Under Beams",
        "sectAlignment": "Neutral"
      },
      {
        "name": "Lilith",
        "symbol": "⚸",
        "longitude": 142.971,
        "signIndex": 4,
        "sign": "Leo",
        "degreeInSign": 22.971,
        "dms": "22°58'16\"",
        "house": 11,
        "wholeSignHouse": 11,
        "isRetrograde": false,
        "dignity": "Peregrine",
        "element": "Fire",
        "modality": "Fixed",
        "essentialScore": 0,
        "accidentalScore": -1,
        "houseClass": "Succedent",
        "solarCondition": "Combust",
        "sectAlignment": "Neutral"
      },
      {
        "name": "Ascendant",
        "symbol": "AC",
        "longitude": 186.1539,
        "signIndex": 6,
        "sign": "Libra",
        "degreeInSign": 6.1539,
        "dms": "06°09'14\"",
        "house": 1,
        "wholeSignHouse": 1,
        "isRetrograde": false,
        "dignity": "Angle",
        "element": "Air",
        "modality": "Cardinal",
        "essentialScore": 3,
        "accidentalScore": 3,
        "houseClass": "Angular",
        "solarCondition": "Free",
        "sectAlignment": "Neutral"
      },
      {
        "name": "Midheaven",
        "symbol": "MC",
        "longitude": 91.7839,
        "signIndex": 3,
        "sign": "Cancer",
        "degreeInSign": 1.7839,
        "dms": "01°47'02\"",
        "house": 10,
        "wholeSignHouse": 10,
        "isRetrograde": false,
        "dignity": "Angle",
        "element": "Water",
        "modality": "Cardinal",
        "essentialScore": 3,
        "accidentalScore": 3,
        "houseClass": "Angular",
        "solarCondition": "Free",
        "sectAlignment": "Neutral"
      }
    ],
    "cusps": [
      {
        "house": 1,
        "label": "Ascendant (AC)",
        "longitude": 186.1539,
        "signIndex": 6,
        "sign": "Libra",
        "degreeInSign": 6.1539,
        "dms": "06°09'14\""
      },
      {
        "house": 2,
        "label": "House 2",
        "longitude": 217.6285,
        "signIndex": 7,
        "sign": "Scorpio",
        "degreeInSign": 7.6285,
        "dms": "07°37'43\""
      },
      {
        "house": 3,
        "label": "House 3",
        "longitude": 246.4015,
        "signIndex": 8,
        "sign": "Sagittarius",
        "degreeInSign": 6.4015,
        "dms": "06°24'05\""
      },
      {
        "house": 4,
        "label": "Imum Coeli (IC)",
        "longitude": 271.7839,
        "signIndex": 9,
        "sign": "Capricorn",
        "degreeInSign": 1.7839,
        "dms": "01°47'02\""
      },
      {
        "house": 5,
        "label": "House 5",
        "longitude": 297.3778,
        "signIndex": 9,
        "sign": "Capricorn",
        "degreeInSign": 27.3778,
        "dms": "27°22'40\""
      },
      {
        "house": 6,
        "label": "House 6",
        "longitude": 326.751,
        "signIndex": 10,
        "sign": "Aquarius",
        "degreeInSign": 26.751,
        "dms": "26°45'04\""
      },
      {
        "house": 7,
        "label": "Descendant (DC)",
        "longitude": 6.1539,
        "signIndex": 0,
        "sign": "Aries",
        "degreeInSign": 6.1539,
        "dms": "06°09'14\""
      },
      {
        "house": 8,
        "label": "House 8",
        "longitude": 37.6285,
        "signIndex": 1,
        "sign": "Taurus",
        "degreeInSign": 7.6285,
        "dms": "07°37'43\""
      },
      {
        "house": 9,
        "label": "House 9",
        "longitude": 66.4015,
        "signIndex": 2,
        "sign": "Gemini",
        "degreeInSign": 6.4015,
        "dms": "06°24'05\""
      },
      {
        "house": 10,
        "label": "Midheaven (MC)",
        "longitude": 91.7839,
        "signIndex": 3,
        "sign": "Cancer",
        "degreeInSign": 1.7839,
        "dms": "01°47'02\""
      },
      {
        "house": 11,
        "label": "House 11",
        "longitude": 117.3778,
        "signIndex": 3,
        "sign": "Cancer",
        "degreeInSign": 27.3778,
        "dms": "27°22'40\""
      },
      {
        "house": 12,
        "label": "House 12",
        "longitude": 146.751,
        "signIndex": 4,
        "sign": "Leo",
        "degreeInSign": 26.751,
        "dms": "26°45'04\""
      }
    ],
    "angles": {
      "ascendant": {
        "sign": "Libra",
        "dms": "06°09'14\"",
        "longitude": 186.1539
      },
      "midheaven": {
        "sign": "Cancer",
        "dms": "01°47'02\"",
        "longitude": 91.7839
      },
      "descendant": {
        "sign": "Aries",
        "dms": "06°09'14\"",
        "longitude": 6.1539
      },
      "ic": {
        "sign": "Capricorn",
        "dms": "01°47'02\"",
        "longitude": 271.7839
      }
    },
    "aspects": [
      {
        "bodyA": "Sun",
        "bodyB": "Ascendant",
        "aspect": "Semi-square",
        "category": "Minor",
        "angle": 45,
        "orb": 0.4,
        "exactness": "Exact",
        "orbTier": "core_structural",
        "weightScore": 84
      },
      {
        "bodyA": "Saturn",
        "bodyB": "North Node",
        "aspect": "Semi-square",
        "category": "Minor",
        "angle": 45,
        "orb": 0.4,
        "exactness": "Exact",
        "orbTier": "core_structural",
        "weightScore": 74
      },
      {
        "bodyA": "Saturn",
        "bodyB": "South Node",
        "aspect": "Sesquiquadrate",
        "category": "Minor",
        "angle": 135,
        "orb": 0.4,
        "exactness": "Exact",
        "orbTier": "core_structural",
        "weightScore": 74
      },
      {
        "bodyA": "Saturn",
        "bodyB": "Uranus",
        "aspect": "Semi-sextile",
        "category": "Minor",
        "angle": 30,
        "orb": 0.74,
        "exactness": "Exact",
        "orbTier": "core_structural",
        "weightScore": 67
      },
      {
        "bodyA": "Jupiter",
        "bodyB": "Pluto",
        "aspect": "Sextile",
        "category": "Major",
        "angle": 60,
        "orb": 1.02,
        "exactness": "Tight",
        "orbTier": "core_structural",
        "weightScore": 80
      },
      {
        "bodyA": "Pluto",
        "bodyB": "Ascendant",
        "aspect": "Semi-square",
        "category": "Minor",
        "angle": 45,
        "orb": 1.08,
        "exactness": "Tight",
        "orbTier": "core_structural",
        "weightScore": 71
      },
      {
        "bodyA": "Mars",
        "bodyB": "Jupiter",
        "aspect": "Square",
        "category": "Major",
        "angle": 90,
        "orb": 1.1,
        "exactness": "Tight",
        "orbTier": "core_structural",
        "weightScore": 86
      },
      {
        "bodyA": "Moon",
        "bodyB": "Saturn",
        "aspect": "Trine",
        "category": "Major",
        "angle": 120,
        "orb": 1.2,
        "exactness": "Tight",
        "orbTier": "core_structural",
        "weightScore": 96
      },
      {
        "bodyA": "Mars",
        "bodyB": "Neptune",
        "aspect": "Quincunx",
        "category": "Minor",
        "angle": 150,
        "orb": 1.38,
        "exactness": "Tight",
        "orbTier": "core_structural",
        "weightScore": 56
      },
      {
        "bodyA": "Sun",
        "bodyB": "Lilith",
        "aspect": "Conjunction",
        "category": "Major",
        "angle": 0,
        "orb": 1.42,
        "exactness": "Tight",
        "orbTier": "core_structural",
        "weightScore": 95
      },
      {
        "bodyA": "Sun",
        "bodyB": "Pluto",
        "aspect": "Square",
        "category": "Major",
        "angle": 90,
        "orb": 1.48,
        "exactness": "Tight",
        "orbTier": "core_structural",
        "weightScore": 93
      },
      {
        "bodyA": "Venus",
        "bodyB": "Chiron",
        "aspect": "Semi-sextile",
        "category": "Minor",
        "angle": 30,
        "orb": 1.68,
        "exactness": "Tight",
        "orbTier": "core_structural",
        "weightScore": 50
      },
      {
        "bodyA": "Mercury",
        "bodyB": "Ascendant",
        "aspect": "Semi-sextile",
        "category": "Minor",
        "angle": 30,
        "orb": 1.8,
        "exactness": "Tight",
        "orbTier": "core_structural",
        "weightScore": 58
      },
      {
        "bodyA": "Lilith",
        "bodyB": "Ascendant",
        "aspect": "Semi-square",
        "category": "Minor",
        "angle": 45,
        "orb": 1.82,
        "exactness": "Tight",
        "orbTier": "core_structural",
        "weightScore": 58
      },
      {
        "bodyA": "Moon",
        "bodyB": "Uranus",
        "aspect": "Square",
        "category": "Major",
        "angle": 90,
        "orb": 1.94,
        "exactness": "Tight",
        "orbTier": "core_structural",
        "weightScore": 90
      },
      {
        "bodyA": "Uranus",
        "bodyB": "Neptune",
        "aspect": "Conjunction",
        "category": "Major",
        "angle": 0,
        "orb": 1.98,
        "exactness": "Tight",
        "orbTier": "core_structural",
        "weightScore": 81
      },
      {
        "bodyA": "Mars",
        "bodyB": "Pluto",
        "aspect": "Quincunx",
        "category": "Minor",
        "angle": 150,
        "orb": 2.12,
        "exactness": "Tight",
        "orbTier": "active",
        "weightScore": 28
      },
      {
        "bodyA": "Chiron",
        "bodyB": "Ascendant",
        "aspect": "Sextile",
        "category": "Major",
        "angle": 60,
        "orb": 2.42,
        "exactness": "Tight",
        "orbTier": "active",
        "weightScore": 63
      },
      {
        "bodyA": "Jupiter",
        "bodyB": "Neptune",
        "aspect": "Trine",
        "category": "Major",
        "angle": 120,
        "orb": 2.48,
        "exactness": "Tight",
        "orbTier": "active",
        "weightScore": 62
      },
      {
        "bodyA": "Mercury",
        "bodyB": "Midheaven",
        "aspect": "Sextile",
        "category": "Major",
        "angle": 60,
        "orb": 2.57,
        "exactness": "Tight",
        "orbTier": "active",
        "weightScore": 61
      },
      {
        "bodyA": "Pluto",
        "bodyB": "Lilith",
        "aspect": "Square",
        "category": "Major",
        "angle": 90,
        "orb": 2.9,
        "exactness": "Tight",
        "orbTier": "active",
        "weightScore": 58
      },
      {
        "bodyA": "North Node",
        "bodyB": "Midheaven",
        "aspect": "Opposition",
        "category": "Major",
        "angle": 180,
        "orb": 3.33,
        "exactness": "Moderate",
        "orbTier": "active",
        "weightScore": 68
      },
      {
        "bodyA": "South Node",
        "bodyB": "Midheaven",
        "aspect": "Conjunction",
        "category": "Major",
        "angle": 0,
        "orb": 3.33,
        "exactness": "Moderate",
        "orbTier": "active",
        "weightScore": 68
      },
      {
        "bodyA": "Neptune",
        "bodyB": "Pluto",
        "aspect": "Sextile",
        "category": "Major",
        "angle": 60,
        "orb": 3.5,
        "exactness": "Moderate",
        "orbTier": "active",
        "weightScore": 43
      },
      {
        "bodyA": "Sun",
        "bodyB": "Mars",
        "aspect": "Sextile",
        "category": "Major",
        "angle": 60,
        "orb": 3.6,
        "exactness": "Moderate",
        "orbTier": "active",
        "weightScore": 52
      },
      {
        "bodyA": "Moon",
        "bodyB": "Neptune",
        "aspect": "Square",
        "category": "Major",
        "angle": 90,
        "orb": 3.92,
        "exactness": "Moderate",
        "orbTier": "active",
        "weightScore": 60
      },
      {
        "bodyA": "Mars",
        "bodyB": "Saturn",
        "aspect": "Trine",
        "category": "Major",
        "angle": 120,
        "orb": 4.1,
        "exactness": "Moderate",
        "orbTier": "active",
        "weightScore": 49
      },
      {
        "bodyA": "Venus",
        "bodyB": "Uranus",
        "aspect": "Trine",
        "category": "Major",
        "angle": 120,
        "orb": 4.34,
        "exactness": "Moderate",
        "orbTier": "active",
        "weightScore": 47
      },
      {
        "bodyA": "Ascendant",
        "bodyB": "Midheaven",
        "aspect": "Square",
        "category": "Major",
        "angle": 90,
        "orb": 4.37,
        "exactness": "Moderate",
        "orbTier": "active",
        "weightScore": 57
      },
      {
        "bodyA": "Jupiter",
        "bodyB": "Uranus",
        "aspect": "Trine",
        "category": "Major",
        "angle": 120,
        "orb": 4.46,
        "exactness": "Moderate",
        "orbTier": "active",
        "weightScore": 46
      },
      {
        "bodyA": "Moon",
        "bodyB": "Mars",
        "aspect": "Trine",
        "category": "Major",
        "angle": 120,
        "orb": 5.3,
        "exactness": "Moderate",
        "orbTier": "background",
        "weightScore": 31
      },
      {
        "bodyA": "Uranus",
        "bodyB": "Pluto",
        "aspect": "Sextile",
        "category": "Major",
        "angle": 60,
        "orb": 5.48,
        "exactness": "Moderate",
        "orbTier": "background",
        "weightScore": 7
      },
      {
        "bodyA": "Mercury",
        "bodyB": "Venus",
        "aspect": "Conjunction",
        "category": "Major",
        "angle": 0,
        "orb": 5.9,
        "exactness": "Wide",
        "orbTier": "background",
        "weightScore": 22
      },
      {
        "bodyA": "Saturn",
        "bodyB": "Pluto",
        "aspect": "Square",
        "category": "Major",
        "angle": 90,
        "orb": 6.22,
        "exactness": "Wide",
        "orbTier": "background",
        "weightScore": 14
      },
      {
        "bodyA": "Venus",
        "bodyB": "Neptune",
        "aspect": "Trine",
        "category": "Major",
        "angle": 120,
        "orb": 6.32,
        "exactness": "Wide",
        "orbTier": "background",
        "weightScore": 13
      },
      {
        "bodyA": "Moon",
        "bodyB": "Ascendant",
        "aspect": "Conjunction",
        "category": "Major",
        "angle": 0,
        "orb": 6.5,
        "exactness": "Wide",
        "orbTier": "background",
        "weightScore": 28
      },
      {
        "bodyA": "Sun",
        "bodyB": "Saturn",
        "aspect": "Opposition",
        "category": "Major",
        "angle": 180,
        "orb": 7.7,
        "exactness": "Wide",
        "orbTier": "background",
        "weightScore": 20
      }
    ],
    "elements": {
      "Fire": 1,
      "Earth": 5,
      "Air": 4,
      "Water": 1
    },
    "modalities": {
      "Cardinal": 4,
      "Fixed": 3,
      "Mutable": 4
    },
    "polarities": {
      "Yang": 5,
      "Yin": 6
    },
    "dominantElement": "Earth",
    "dominantModality": "Cardinal",
    "sect": {
      "chartType": "Diurnal",
      "sunHouse": 11,
      "sectLight": "Sun",
      "beneficOfSect": "Jupiter",
      "beneficContrary": "Venus",
      "maleficOfSect": "Saturn",
      "maleficContrary": "Mars",
      "summary": "Diurnal (Day) Chart (Sun in H11): Jupiter acts as Benefic of Sect (most constructive ease) and Saturn is Malefic of Sect (disciplined structure); Mars and Venus operate contrary to sect."
    },
    "chartRuler": {
      "ascSign": "Libra",
      "traditional": "Venus",
      "modern": "Venus",
      "traditionalHouse": 12,
      "traditionalDignity": "Fall",
      "modernHouse": 12,
      "modernDignity": "Fall"
    },
    "mutualReceptions": [
      {
        "planetA": "Saturn",
        "planetB": "Uranus",
        "type": "Domicile",
        "summary": "Saturn (Aquarius) and Uranus (Capricorn) share Domicile Mutual Reception — cooperating across houses H5 & H4."
      }
    ],
    "dispositorTree": {
      "traditional": {
        "chains": {
          "Sun": [
            "Sun"
          ],
          "Moon": [
            "Moon",
            "Venus",
            "Mercury"
          ],
          "Mars": [
            "Mars",
            "Mercury"
          ],
          "Mercury": [
            "Mercury"
          ],
          "Jupiter": [
            "Jupiter",
            "Mercury"
          ],
          "Venus": [
            "Venus",
            "Mercury"
          ],
          "Saturn": [
            "Saturn"
          ],
          "Uranus": [
            "Uranus",
            "Saturn"
          ],
          "Neptune": [
            "Neptune",
            "Saturn"
          ],
          "Pluto": [
            "Pluto",
            "Mars",
            "Mercury"
          ]
        },
        "finalDispositors": [
          "Sun",
          "Mercury",
          "Saturn"
        ],
        "loops": []
      },
      "modern": {
        "chains": {
          "Sun": [
            "Sun"
          ],
          "Moon": [
            "Moon",
            "Venus",
            "Mercury"
          ],
          "Mars": [
            "Mars",
            "Mercury"
          ],
          "Mercury": [
            "Mercury"
          ],
          "Jupiter": [
            "Jupiter",
            "Mercury"
          ],
          "Venus": [
            "Venus",
            "Mercury"
          ],
          "Saturn": [
            "Saturn",
            "Uranus",
            "Saturn"
          ],
          "Uranus": [
            "Uranus",
            "Saturn",
            "Uranus"
          ],
          "Neptune": [
            "Neptune",
            "Saturn",
            "Uranus",
            "Saturn"
          ],
          "Pluto": [
            "Pluto"
          ]
        },
        "finalDispositors": [
          "Sun",
          "Mercury",
          "Pluto"
        ],
        "loops": [
          [
            "Saturn",
            "Uranus"
          ]
        ]
      }
    },
    "configurations": [
      {
        "type": "Yod",
        "planets": [
          "Neptune",
          "Pluto",
          "Mars"
        ],
        "apex": "Mars",
        "houseOrSign": "Gemini H9",
        "maxOrb": 3.5,
        "summary": "Yod (Finger of God): Neptune sextile Pluto pointing via quincunx to apex Mars (Gemini H9, max orb 3.5°)."
      },
      {
        "type": "Grand Trine",
        "planets": [
          "Moon",
          "Saturn",
          "Mars"
        ],
        "elementOrModality": "Air",
        "maxOrb": 5.3,
        "summary": "Air Grand Trine connecting Moon, Saturn, Mars (max orb 5.3°)."
      },
      {
        "type": "T-Square",
        "planets": [
          "Sun",
          "Saturn",
          "Pluto"
        ],
        "apex": "Pluto",
        "elementOrModality": "Fixed",
        "houseOrSign": "Scorpio H2",
        "maxOrb": 7.7,
        "summary": "Fixed T-Square: Sun opposite Saturn squaring apex Pluto (Scorpio H2, max orb 7.7°)."
      },
      {
        "type": "Stellium",
        "planets": [
          "Mercury",
          "Jupiter",
          "Venus"
        ],
        "houseOrSign": "Virgo (Sign Stellium)",
        "maxOrb": 30,
        "summary": "Virgo Stellium (Mercury, Jupiter, Venus) concentrating focus across H12."
      }
    ],
    "hellenistic": {
      "lots": [
        {
          "name": "Lot of Fortune",
          "longitude": 237.2539,
          "signIndex": 7,
          "sign": "Scorpio",
          "degreeInSign": 27.2539,
          "dms": "27°15'14\"",
          "wholeSignHouse": 2,
          "lord": "Mars",
          "boundLord": "Saturn"
        },
        {
          "name": "Lot of Spirit",
          "longitude": 135.0539,
          "signIndex": 4,
          "sign": "Leo",
          "degreeInSign": 15.0539,
          "dms": "15°03'14\"",
          "wholeSignHouse": 11,
          "lord": "Sun",
          "boundLord": "Saturn"
        },
        {
          "name": "Lot of Eros",
          "longitude": 211.354,
          "signIndex": 7,
          "sign": "Scorpio",
          "degreeInSign": 1.354,
          "dms": "01°21'14\"",
          "wholeSignHouse": 2,
          "lord": "Mars",
          "boundLord": "Mars"
        },
        {
          "name": "Lot of Necessity",
          "longitude": 269.0538,
          "signIndex": 8,
          "sign": "Sagittarius",
          "degreeInSign": 29.0538,
          "dms": "29°03'14\"",
          "wholeSignHouse": 3,
          "lord": "Jupiter",
          "boundLord": "Mars"
        }
      ],
      "bounds": [
        {
          "body": "Ascendant",
          "sign": "Libra",
          "degree": "06°09'14\"",
          "wholeSignHouse": 1,
          "termLord": "Mercury",
          "decanLord": "Moon"
        },
        {
          "body": "Sun",
          "sign": "Leo",
          "degree": "21°33'14\"",
          "wholeSignHouse": 11,
          "termLord": "Mercury",
          "decanLord": "Mars"
        },
        {
          "body": "Moon",
          "sign": "Libra",
          "degree": "12°39'14\"",
          "wholeSignHouse": 1,
          "termLord": "Mercury",
          "decanLord": "Saturn"
        },
        {
          "body": "Mercury",
          "sign": "Virgo",
          "degree": "04°21'14\"",
          "wholeSignHouse": 12,
          "termLord": "Mercury",
          "decanLord": "Sun"
        },
        {
          "body": "Venus",
          "sign": "Virgo",
          "degree": "10°15'14\"",
          "wholeSignHouse": 12,
          "termLord": "Venus",
          "decanLord": "Venus"
        },
        {
          "body": "Mars",
          "sign": "Gemini",
          "degree": "17°57'14\"",
          "wholeSignHouse": 9,
          "termLord": "Mars",
          "decanLord": "Mars"
        },
        {
          "body": "Jupiter",
          "sign": "Virgo",
          "degree": "19°03'14\"",
          "wholeSignHouse": 12,
          "termLord": "Jupiter",
          "decanLord": "Venus"
        },
        {
          "body": "Saturn",
          "sign": "Aquarius",
          "degree": "13°51'14\"",
          "wholeSignHouse": 5,
          "termLord": "Jupiter",
          "decanLord": "Mercury"
        }
      ],
      "zodiacalReleasing": {
        "spirit": {
          "fromLot": "Spirit",
          "lotSign": "Leo",
          "l1Sign": "Virgo",
          "l1Lord": "Mercury",
          "l1StartIso": "2011-05-07",
          "l1EndIso": "2031-01-22",
          "l2Sign": "Cancer",
          "l2Lord": "Moon",
          "l2StartIso": "2025-01-23",
          "l2EndIso": "2027-02-12",
          "loosingOfBond": false
        },
        "fortune": {
          "fromLot": "Fortune",
          "lotSign": "Scorpio",
          "l1Sign": "Capricorn",
          "l1Lord": "Saturn",
          "l1StartIso": "2019-03-26",
          "l1EndIso": "2045-11-04",
          "l2Sign": "Gemini",
          "l2Lord": "Mercury",
          "l2StartIso": "2026-10-15",
          "l2EndIso": "2028-06-06",
          "loosingOfBond": false
        }
      }
    }
  },
};

export const PREVIEW_MEMORY_SNAPSHOT: UserMemorySnapshot = {
  livingContext: {
    relationship_status: 'married_no_children',
    career_mode: 'job_salaried',
    career_role: 'Product Design Lead',
    location_status: 'relocated_same_country',
    core_stress_areas: ['Work boundaries', 'Career pivot timing'],
    cited_insights: [
      {
        id: 'preview-ci-1',
        summary: 'Working toward a quieter creative transition without burning financial stability.',
        category: 'workplace',
        cited_by: 'Luna',
        cited_slug: 'luna',
        captured_at: '2026-11-12T10:30:00.000Z',
      },
    ],
  },
  deepProfile: {
    desires_and_goals: ['Launch a focused independent design practice in 2027'],
    habits_and_routines: ['Evening walks to decompress after intense work sprints'],
    entries: [
      {
        id: 'preview-dp-1',
        fact: 'Prefers direct, warm reflection without preachy advice when stressed late at night.',
        category: 'emotional_pattern',
        bucket: 'emotional_triggers',
        source_label: 'Mira',
        source_slug: 'mira',
        conversation_id: null,
        captured_at: '2026-11-18T18:10:00.000Z',
        updated_at: '2026-11-18T18:10:00.000Z',
      },
    ],
  },
  preferences: {
    memory_paused: false,
    allow_cross_companion_memory: true,
  },
  timezone: 'Asia/Kolkata',
  proactiveOptIn: false,
  defaultProfile: {
    id: 'preview-prof-1',
    name: 'Observatory Preview',
    short_name: 'You',
  },
  bonds: [
    {
      companion_slug: 'mira',
      companion_name: 'Mira',
      total_turns: 8,
      familiarity_stage: 'warming_up',
      memory_summary: 'Appreciates calm, grounded reflections late at night about work-life balance.',
      tone_preferences: ['Calm & unhurried', 'Gentle honesty'],
      inside_references: ['Late-night chai walk'],
      last_interaction_at: '2026-11-18T18:10:00.000Z',
    },
  ],
  migrationReady: true,
};


