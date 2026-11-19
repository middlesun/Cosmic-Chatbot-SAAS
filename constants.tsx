import { Category, Product, SubCategory } from './types';

export const PRODUCTS: Product[] = [
  {
    id: '1042',
    name: 'Free Consultation',
    shortDescription: 'The Quick Free Consultation - completely no strings attached.',
    longDescription: "Experience my quality of analysis by asking a question to me.\n\nThe only qualification is that, your question must be (detailed, specific and serious)-bold enough for me to consider a free reading. \n\nSame level of service like the paid consultation, but for people who's trying my service for the first time.",
    priceINR: 0,
    category: Category.CONSULTATIONS,
    icon: 'sparkle',
    bullets: [
      'Delivered in 7-10 days',
      'Based on D1 & D9 analysis',
      'Dasha & Transit consideration',
      'Response sent to your email'
    ]
  },
  {
    id: '2093',
    name: 'Instant Clarity',
    shortDescription: 'Get immediate clarity on a single, burning question.',
    longDescription: 'Sometimes you just need a straight answer. \n\nThis package is designed for those "crossroads" moments where you have one specific, focused question. Whether it’s about a job offer, a specific date, or a single relationship concern, you’ll receive a clear astrological analysis and actionable guidance. \n\nIt is designed to address one clearly defined question through a focused analysis of your birth chart. Even in this short-format reading, I apply advanced astrological techniques, including (relevant Dashas, current transits, and supporting divisional charts,)-bold to deliver a grounded, evidence-based response. \n\n(Ensure that the question is not broad like "Tell me about my career", in that case, kindly choose detailed analysis package.)-bold',
    priceINR: 999,
    category: Category.CONSULTATIONS,
    icon: 'search',
    bullets: [
      'Delivered in 7-10 days',
      'Based on D1 & D9 analysis',
      'Dasha & Transit consideration',
      'Response sent to your email'
    ]
  },
  {
    id: '3072',
    name: 'Deep Dive - 1 Topic',
    shortDescription: 'An in-depth examination of one key area of your life.',
    longDescription: 'This package allows me to look deeply into one specific area of your life (such as Marriage, Career, or Finances). You may ask up to three interrelated questions to gain a well-rounded understanding.\n\nBy evaluating your (D1, D9, Dashas, Transits,)-bold I provide a 360-degree view of a given area of life, also includes strategies, remedies if needed.\n\nExample: "When will I get married? What will my partner be like? Will it be arranged or love?"',
    priceINR: 1999,
    category: Category.CONSULTATIONS,
    icon: 'scroll',
    bullets: [
      'Delivered in 7-10 days',
      'Based on D1 & D9 analysis',
      'Dasha & Transit consideration',
      'Includes Strategies & remedies',
      'Response sent to your email'
    ]
  },
  {
    id: '4045',
    name: 'Deep Dive - 2 Topics',
    shortDescription: 'A structured analysis across two important areas of life.',
    longDescription: 'This package allows me to look deeply into (two specific areas)-bold of your life. \n\nYou can ask up to three related questions for each area of your life. Based on deep analysis of your D1, D9, Dashas, Transits, I provide a 360-degree view of a given area of life, also includes strategies, remedies if needed.',
    priceINR: 3999,
    category: Category.CONSULTATIONS,
    icon: 'layout',
    bullets: [
      'Delivered in 7-10 days',
      'Based on D1 & D9 analysis',
      'Dasha & Transit consideration',
      'Includes Strategies & remedies',
      'Response sent to your email'
    ]
  },
  {
    id: '5031',
    name: 'Deep Dive - 3 Topics',
    shortDescription: 'A balanced, multi-dimensional consultation covering three key areas of life.',
    longDescription: 'You may choose three distinct areas of life and ask up to three related questions per area. \n\nEach topic is analyzed independently using (birth chart interpretation, divisional charts, Dashas, and transits,)-bold while also considering how planetary influences overlap across areas. Where applicable, strategic guidance and remedies are included to help you navigate the phase more consciously.',
    priceINR: 5999,
    category: Category.CONSULTATIONS,
    icon: 'grid',
    bullets: [
      'Delivered in 7-10 days',
      'Based on D1 & D9 analysis',
      'Dasha & Transit consideration',
      'Includes Strategies & remedies',
      'Response sent to your email'
    ]
  },
  {
    id: '6074',
    name: 'Life Blueprint Report',
    shortDescription: 'A comprehensive astrological map of your life path.',
    longDescription: 'This is my most detailed offering — a long-form report that provides a complete understanding of your chart’s structure, strengths, challenges, and long-term karmic patterns.\n\nThis package is suited for individuals seeking clarity across several aspects of life. I synthesize insights from multiple charts and timelines to present a cohesive understanding rather than fragmented answers. \n\nThe Life Blueprint Report includes:\n\n- (Detailed birth chart interpretation)-bold\n- (Extensive use of divisional charts)-bold\n- (Upcoming dasha & Transit analysis)-bold\n- (Deep dive into each areas of life)-bold\n- (Warnings, remedies & strategies)-bold',
    priceINR: 3999,
    category: Category.CONSULTATIONS,
    icon: 'map',
    isPopular: true,
    bullets: [
      'Delivered in 10-15 days',
      'Detailed birth chart interpretation',
      'Extensive use of divisional charts',
      'Upcoming dasha & Transit analysis',
      'Deep dive into each areas of life',
      'Warnings, remedies & strategies'
    ]
  },
  {
    id: '5528',
    name: 'Love Life Analysis',
    shortDescription: 'When will I find love, what to expect, ....',
    longDescription: 'When will you find love? What kind of partner are you destined for? \n\nI analyze your (7th and 5th house dynamics)-bold to reveal the timeline of your romantic journey. It is specifically designed to help you navigate your romantic crossroads with clarity.',
    priceINR: 1999,
    category: Category.LOVE,
    subCategory: SubCategory.LOVE,
    icon: 'heart',
    bullets: [
      'Destined partner traits',
      'Timing of significant encounters',
      'Emotional patterns to navigate',
      'Specific relationship advice'
    ]
  },
  {
    id: '5529',
    name: 'Love Encounter Timing Windows',
    shortDescription: 'Know exactly when you are most likely to meet someone significant.',
    longDescription: 'Using focused (transit and dasha synchronization,)-bold I identify the specific windows where romantic opportunities are highest. This report helps you stay prepared and conscious during your most auspicious cosmic windows.',
    priceINR: 1999,
    category: Category.LOVE,
    subCategory: SubCategory.LOVE,
    icon: 'calendar',
    bullets: [
      'Specific monthly windows',
      'Planetary triggers for meeting',
      'Conducive environments to visit',
      'Advice for peak timing'
    ]
  },
  {
    id: '5530',
    name: 'Love & Married Life Analysis',
    shortDescription: 'A dual-phase report covering courtship and eventual marriage.',
    longDescription: 'A comprehensive study of your (romantic trajectory and domestic destiny.)-bold This analysis looks at how your current love patterns will evolve into long-term marital dynamics, giving you a complete picture of your relationship life cycle.',
    priceINR: 3999,
    category: Category.LOVE,
    subCategory: SubCategory.LOVE,
    icon: 'heart-pulse',
    bullets: [
      'Love life evolution',
      'Marriage transition analysis',
      'Domestic harmony assessment',
      'Long-term planetary impacts'
    ]
  },
  {
    id: '5531',
    name: 'Boyfriend Profile Analysis',
    shortDescription: "A profile snapshot based on your boyfriend's birth details.",
    longDescription: "Understand the (nature, temperament, and hidden inclinations)-bold of your partner. This report provides strategic insights into his psychological makeup and how he functions in a relationship context.",
    priceINR: 1999,
    category: Category.LOVE,
    subCategory: SubCategory.LOVE,
    icon: 'user-check',
    bullets: [
      "Psychological profile",
      "Relationship temperament",
      "Hidden career inclinations",
      "Emotional loyalty analysis"
    ]
  },
  {
    id: '5532',
    name: 'Girlfriend Profile Analysis',
    shortDescription: "A profile snapshot based on your girlfriend's birth details.",
    longDescription: "Gain clarity on your partner's (inner personality and long-term values.)-bold This analysis examines her approach to relationships, career ambitions, and domestic expectations based on her personal chart.",
    priceINR: 1999,
    category: Category.LOVE,
    subCategory: SubCategory.LOVE,
    icon: 'user-check',
    bullets: [
      "Personality dynamics",
      "Relational expectations",
      "Domestic & Career values",
      "Loyalty & Nature snapshot"
    ]
  },
  {
    id: '5534',
    name: 'Relationship Compatibility Report',
    shortDescription: 'Extensive 2-chart analysis for deep relationship insight.',
    longDescription: 'My most in-depth relationship tool. This report involves (cross-charting multiple divisional houses and dasha overlaps)-bold between two individuals. It reveals the deeper karmic reason for your meeting and the long-term survival potential of the bond.',
    priceINR: 3999,
    category: Category.LOVE,
    subCategory: SubCategory.LOVE,
    icon: 'sparkles',
    bullets: [
      'Deep karmic connection',
      'Detailed dasha overlap',
      'Obstacles & Strategies',
      'Comprehensive final verdict'
    ]
  },
  {
    id: '8471',
    name: 'Husband Profile Report',
    shortDescription: 'Get a detailed report beyond the snapshot.',
    longDescription: 'A deep dive beyond the surface. \n\nLearn about their (emotional maturity, loyalty, expectations as a parent, and family values.)-bold This is for those seeking the deepest understanding of their future spouse.',
    priceINR: 3999,
    category: Category.MARRIAGE,
    subCategory: SubCategory.MARRIAGE,
    icon: 'crown',
    bullets: [
      'Deep emotional inclinations',
      'Loyalty & Commitment levels',
      'Values as a parent',
      'Long-term marriage stability'
    ]
  },
  {
    id: '2021',
    name: 'My Married Life Report',
    shortDescription: 'Full analysis of your marriage indicators across charts.',
    longDescription: 'A comprehensive investigation into your (marital happiness, challenges, and growth.)-bold I synthesize insights from the 7th house, Navamsha (D9), and current dashas to give you a long-term roadmap of your married life.',
    priceINR: 3999,
    category: Category.MARRIAGE,
    subCategory: SubCategory.MARRIAGE,
    icon: 'book-open',
    bullets: [
      'In-depth D9 interpretation',
      'Challenge & Remedy mapping',
      'Spousal contribution study',
      'Full life-stage progression'
    ]
  },
  {
    id: '2023',
    name: 'Wife Profile Analysis Report',
    shortDescription: 'Detailed deep-dive into your future wife\'s persona.',
    longDescription: 'A thorough report examining the (psychological depth, loyalty, and family values)-bold of your destined spouse. Beyond the surface traits, I look at her deeper karmic patterns and domestic expectations.',
    priceINR: 3999,
    category: Category.MARRIAGE,
    subCategory: SubCategory.MARRIAGE,
    icon: 'award',
    bullets: [
      'Emotional maturity levels',
      'Loyalty & Attachment styles',
      'Maternal & Family values',
      'Long-term stability'
    ]
  },
  {
    id: '2025',
    name: 'Marriage Compatibility Report',
    shortDescription: 'Strategic 2-chart analysis for marriage finalization.',
    longDescription: 'My most comprehensive compatibility tool for marriage. This involves a (cross-synthesis of D1, D9, and Saptamsha charts)-bold for both individuals, identifying potential roadblocks and providing remedies for a stable union.',
    priceINR: 3999,
    category: Category.MARRIAGE,
    subCategory: SubCategory.MARRIAGE,
    icon: 'stars',
    bullets: [
      'Karmic marital overlap',
      'Progeny & Wealth synergy',
      'Conflict management zones',
      'Comprehensive final verdict'
    ]
  },
  {
    id: '2026',
    name: 'Divorce Advice',
    shortDescription: 'Clarity on separation timing and legal possibilities.',
    longDescription: 'Is your marriage at a point of no return? I evaluate (6th and 8th house influences)-bold to determine if a separation is karmically indicated or if a reconciliation is still possible under current transits.',
    priceINR: 3999,
    category: Category.MARRIAGE,
    subCategory: SubCategory.MARRIAGE,
    icon: 'scissors',
    bullets: [
      'Legal outcome likelihood',
      'Separation timing windows',
      'Reconciliation possibility',
      'Strategic timing for filings'
    ]
  },
  {
    id: '2027',
    name: 'Second Marriage Advice',
    shortDescription: 'Insights into the timing and nature of a second union.',
    longDescription: 'Analysis of the (2nd and 9th house dynamics)-bold to see if a second marriage is indicated. I identify the timing windows and the likely nature of your second partner compared to the first.',
    priceINR: 1999,
    category: Category.MARRIAGE,
    subCategory: SubCategory.SECOND_MARRIAGE,
    icon: 'refresh-cw',
    bullets: [
      'Second marriage indicators',
      'Timing of the next union',
      'Partner traits & background',
      'Lessons from the past'
    ]
  },
  {
    id: '1163',
    name: 'Marriage Timing Windows',
    shortDescription: 'Know exactly when the bells will ring based on Dasha.',
    longDescription: 'Using advanced (Vimshottari Dasha and planetary transits,)-bold I pinpoint the most conducive periods for you to get hitched. Find the strategic timing you need.',
    priceINR: 1999,
    category: Category.MARRIAGE,
    subCategory: SubCategory.MARRIAGE,
    icon: 'bell',
    bullets: [
      'Specific month/year windows',
      'Planetary obstacles to avoid',
      'Conducive dates for functions',
      'Strategic advice for delay'
    ]
  },
  {
    id: '4720',
    name: 'Breakup Advice',
    shortDescription: 'Stay or move on? Find clarity in karmic connections.',
    longDescription: 'Is this a (karmic relationship meant for growth,)-bold or a lasting bond facing a temporary storm? I provide the cosmic perspective on your relationship crossroads.',
    priceINR: 1999,
    category: Category.LOVE,
    subCategory: SubCategory.BREAKUP,
    icon: 'heart-off',
    bullets: [
      'Karmic bond assessment',
      'Likelihood of reconciliation',
      'Healing strategies',
      'Emotional timing'
    ]
  },
  {
    id: '3001',
    name: 'Career Decision Clarity',
    shortDescription: 'Focused advice for jobs, exams, or career changes.',
    longDescription: 'Get clear answers for your immediate professional crossroads. Whether it is a (job offer evaluation, choosing an educational stream, or exam timing,)-bold I provide a data-backed astrological recommendation.',
    priceINR: 1999,
    category: Category.CAREER,
    subCategory: SubCategory.JOB,
    icon: 'target',
    bullets: [
      'Single topic focus',
      'Job offer suitability',
      'Exam & Interview timing',
      'Clear Go/No-Go verdict'
    ]
  },
  {
    id: '3003',
    name: 'Career Analysis Report',
    shortDescription: 'Detailed deep-dive into all professional indicators.',
    longDescription: 'My most comprehensive career report. I analyze (all planets, Yogas, Doshas, and Dasha/Transit cycles)-bold influencing your professional path. Includes strategic advice, warnings, and specific remedies to clear obstacles.',
    priceINR: 3999,
    category: Category.CAREER,
    subCategory: SubCategory.JOB,
    icon: 'trending-up',
    bullets: [
      'Full D10 chart synthesis',
      'Long-term career timing',
      'Wealth through career',
      'Remedies & Strategies'
    ]
  },
  {
    id: '4002',
    name: 'My Wealth Profile Report',
    shortDescription: 'Full report on your financial destiny and timing.',
    longDescription: 'A deep-dive analysis of your (Wealth Yogas (Dhana Yogas))-bold and financial obstacles. I map your wealth journey through the dashas to identify when you will hit your financial peak and when to be cautious.',
    priceINR: 3999,
    category: Category.FINANCE,
    subCategory: SubCategory.WEALTH,
    icon: 'bank',
    bullets: [
      'Detailed wealth yoga check',
      'Long-term wealth timing',
      'Asset accumulation windows',
      'Obstacle removal remedies'
    ]
  },
  {
    id: '4003',
    name: 'Debt Analysis & Remedies',
    shortDescription: 'Focused report for managing and clearing liabilities.',
    longDescription: 'Struggling with debt? I analyze your (6th house and its connections)-bold to identify the root cause of financial drain. Includes specific planetary remedies to ease the burden of liabilities.',
    priceINR: 1999,
    category: Category.FINANCE,
    subCategory: SubCategory.WEALTH,
    icon: 'list-x',
    bullets: [
      'Debt cause identification',
      'Repayment timing windows',
      'Planetary remedies for relief',
      'Future liability warnings'
    ]
  },
  {
    id: '4005',
    name: 'Investment Strategies Pro',
    shortDescription: 'High-level investment planning based on Dasha overlaps.',
    longDescription: 'A professional-grade financial roadmap. I analyze (5th and 8th house connectivity)-bold to identify high-reward windows and risky periods. Designed for serious investors and wealth builders.',
    priceINR: 5999,
    category: Category.FINANCE,
    subCategory: SubCategory.WEALTH,
    icon: 'bank',
    bullets: [
      'Detailed sector mapping',
      '5-year investment timing',
      'Speculative gain potential',
      'Risk mitigation strategies'
    ]
  },
  {
    id: '4006',
    name: 'Premium Wealth Profile',
    shortDescription: 'My elite-level wealth and legacy planning report.',
    longDescription: 'An advanced Birth Chart Analysis to determine your most powerful Yogas, Planets, Placements influencing your Wealth accumulation Potential\n\nThe Premium Wealth Profile is a high-precision financial intelligence report designed for individuals who are serious about their entrepreneurial aspirations, capital growth, and long-term wealth positioning.\n\nIt is a structured, score-based evaluation of whether your birth chart statistically aligns with patterns seen in extraordinary entrepreneurs, wealth creators, and power operators.\n\n(What This Analysis Actually Does)-bold\n\nCore Components of the Premium Wealth Profile\n\n1️⃣ (Extreme Success Index (25-Point Test))-bold\n\nUsing my proprietary Extreme Success Index (ESI) — a 25-point quantitative test — I evaluate whether your chart structurally matches the patterns consistently observed in outlier success charts.\n\nEach factor is scored, ranked, and weighted, removing vague interpretations and replacing them with clear probability signals.\n\nA rigorous pattern-matching system that measures:\n- Asymmetric load\n- Non-linear growth\n- Upachay house analysis\n- Malefic advantages\n- Dispositor chain loops\n- Nakshatra intent\n- Reversal of fortunes indicators\n\nEach parameter is scored to produce a clear Success Alignment Rating, indicating whether your chart supports:\n• Ordinary growth\n• High financial upside\n• Rare, outsized wealth potential\n\n2️⃣ (Dhana Yoga Strength Calculator & Ranking System)-bold\n\nThere are people with extra ordinary royal charts with multiple Dhana Yogas but rarely do they manifest in real life - mostly because of their purity, strength, conflicting doshas and activation.\n\nInstead of identifying yogas, I stress test and rank them.\n\nEvery wealth-related configuration is evaluated based on:\n• Structural purity\n• Degree-level precision\n• Divisional reinforcement (D1 + D9 + D10)\n\nThis reveals:\n• Which yogas are theoretically present but practically weak\n• Which yogas are active, usable, and scalable\n• Where false expectations need to be eliminated\n\n3️⃣ (Dominant Wealth Driver Identification)-bold\n\nI isolate the single most influential planet and house driving your financial trajectory.\n\nThis determines:\n• Where your growth actually comes from (not where you hope it does)\n• Whether your chart favors:\n○ Business ownership\n○ Investing\n○ Leadership roles\n○ Strategic partnerships\n• The environments and decisions that amplify results fastest\n\n4️⃣ (Growth Leverage & Strategic Alignment)-bold\n\nBased on your strongest chart mechanics, I derive:\n• Actionable strategies to exploit natural strengths\n• Structural adjustments to avoid self-sabotaging paths\n• Recognise patterns to avoid avoidable mistakes\n\n5️⃣ (Dasha-Based Timing Windows)-bold\n\nDasha and transit analysis to determine;\n• When to push aggressively\n• When to consolidate or restructure\n• When to avoid big decisions\n\nThis allows you to:\n• Align execution with favorable cycles\n• Reduce losses caused by mistimed expansion\n• Use timing as a force multiplier, not a guessing game\n\n6️⃣ (Risk Controls & Corrective measures)-bold\n\nInstead of generic remedies, I provide:\n• Targeted corrective actions tied to specific weaknesses\n• Focused adjustments aimed at:\n○ Decision clarity\n○ Risk mitigation\n○ Strength activation',
    priceINR: 19999,
    category: Category.FINANCE,
    subCategory: SubCategory.WEALTH,
    icon: 'diamond',
    bullets: [
      'Extreme Success indicator Analysis',
      'Advanced Yoga Analysis',
      'Yoga & Dosha purity based ranking',
      'Wealth accumulation archetype',
      'Natural Strengths & Weakness analysis',
      'Dasha & Transit analysis',
      'Golden Period determination',
      'Strategies & Remedies'
    ]
  },
  {
    id: '7001',
    name: 'Medical Analysis & Remedies',
    shortDescription: 'Focused investigation into specific health concerns.',
    longDescription: 'Dealing with a chronic issue or unexplained symptoms? I examine the (6th, 8th, and 12th house dynamics)-bold to find the planetary root. Includes specific mantra and remedial protocols.',
    priceINR: 3999,
    category: Category.HEALTH,
    subCategory: SubCategory.HEALTH,
    icon: 'activity',
    bullets: [
      'Planetary root analysis',
      'Healing timing windows',
      'Dietary & Herbal alignment',
      'Specific health remedies'
    ]
  },
  {
    id: '7003',
    name: 'My Health Profile Report',
    shortDescription: 'Full report on your long-term health and vitality.',
    longDescription: 'A comprehensive study of your (longevity, vitality, and major life health-stages.)-bold I analyze the dasha timeline to predict periods of low immunity and provide a lifetime health maintenance plan.',
    priceINR: 3999,
    category: Category.HEALTH,
    subCategory: SubCategory.HEALTH,
    icon: 'heart-pulse',
    bullets: [
      'Life-long health roadmap',
      'Vitality & Longevity study',
      'Immunity timing windows',
      'Full remedial protocol'
    ]
  }
];

export const COUNTRIES = [
  "United States", "India", "United Kingdom", "Canada", "Australia", 
  "Germany", "France", "Singapore", "UAE", "Others"
];

export const TESTIMONIALS = [
  { name: "", quote: "(Marriage timing window was spot on.)-bold We got engaged exactly during the peak period.", area: "Marriage Timing" },
  { name: "", quote: "(The Husband Profile Snapshot gave me so much hope.)-bold Truly insightful.", area: "Husband Profile Snapshot" },
  { name: "", quote: "(The Husband Report was eerily accurate.)-bold It described my fiancé perfectly.", area: "Husband Profile Report" },
  { name: "", quote: "(The remedies are simple yet effective.)-bold Noticed shifts within weeks.", area: "Remedial Astrology" },
  { name: "", quote: "(Strategic advice for my legal battle saved me a lot of stress.)-bold", area: "Legal Consultation" },
  { name: "", quote: "(The financial wealth report helped me plan my investments)-bold with better timing.", area: "Wealth Blueprint" },
  { name: "", quote: "(Changed my perspective on my relationship.)-bold We are stronger than ever.", area: "Relationship Analysis" },
  { name: "", quote: "(A deep dive into my chart that I didn't know I needed.)-bold Truly mind blowing..", area: "Birth Chart Reading" },
  { name: "", quote: "(The best gift I've given myself this year. Clarity is priceless.)-bold", area: "Full Life Report" },
  { name: "", quote: "I went in expecting a generic chart reading. (This was… not that.)-bold The way my career blocks were explained actually made sense in hindsight. Things I’d been struggling with for years suddenly had context. (I didn’t change everything overnight, but the remedies helped me feel more grounded within a few weeks.)-bold Looking back now, I’m genuinely glad I booked this. It gave me clarity I’d been circling around for a long time.", area: "Detailed Analysis" },
  { name: "", quote: "(The advice was structured. Almost clinical at times.)-bold And yes — a bit confronting. It explained why I kept hitting the same wall professionally, even when I thought I was “doing everything right.” (I’m still processing parts of it. But it gave me direction I clearly needed.)-bold", area: "Career Transition" },
  { name: "", quote: "(What stood out was the tone. No fear. No emotional manipulation. No “this is doomed” energy.)-bold It helped me understand my patterns in relationships instead of blaming luck or timing. (I felt calmer after the session… not anxious. That itself was valuable.)-bold", area: "Love Life Analysis" },
  { name: "", quote: "I was skeptical. Especially since this was for a business decision. (But the timing insights helped me delay a launch I was rushing into.)-bold In hindsight, that pause saved me money — and stress. (I honestly don’t know what would’ve happened if I hadn’t slowed down when I did.)-bold Highly recommended if you’re dealing with big decisions.", area: "Business Strategy Consultation" },
  { name: "", quote: "(AMAZZZIINNNG honestly 😭)-bold Didn’t expect it to hit like that.", area: "Love Question (Quick Session)" },
  { name: "", quote: "(Lowkey shocked how accurate it was 👀)-bold Not in a scary way. Just… precise.", area: "Compatibility Check" },
  { name: "", quote: "I was a mess when I booked this. Honestly. (The reading didn’t magically fix things. But it helped me stop blaming myself for everything.)-bold That shift alone mattered more than I expected. I walked away feeling lighter — and that feeling stayed.", area: "Emotional Clarity Session" },
  { name: "", quote: "Some parts were hard to read. Not gonna lie. (But it explained patterns I keep repeating — clearly, without sugarcoating.)-bold I needed that honesty. This wasn’t filmy Instagram astrology. (It felt more… mature. It slowed me down instead of pushing me into decisions.)-bold", area: "Relationship Doubts" },
  { name: "", quote: "I didn’t believe much in reports earlier. (But this one described my partner dynamic scarily well.)-bold I shared it with my fiancée and we actually talked things through properly. It didn’t label us as “perfect” or “bad.” (It explained how things work between us. That conversation alone made this worth it.)-bold", area: "Partner Dynamics Report" },
  { name: "", quote: "I rarely seek readings for myself, but I was genuinely impressed here. (The analysis was more methodical than most, and certain interpretations helped me see a client case from a different angle.)-bold I’ve already recommended this consultation for situations where clients want depth without sensationalism.", area: "Astrologer & Tarot Reader" },
  { name: "", quote: "As an astrologer myself, I don’t expect to be surprised easily. (Yet the way timing and patterns were synthesized felt refreshing.)-bold It brought clarity to my own chart — and has influenced how I approach complex client readings. (That says a lot.)-bold", area: "Professional Astrologer" },
  { name: "", quote: "I booked this at 2 a.m. after crying for hours. I didn’t want predictions. (I just wanted to understand why I felt so attached to someone who treated me poorly.)-bold The reading didn’t promise reconciliation or a “better person soon.” (It explained why I was stuck in that dynamic. That hurt. But it also made me feel less crazy.)-bold", area: "Breakup Guidance" },
  { name: "", quote: "On paper, the relationship looked perfect. Everyone approved. (But I was constantly anxious and second-guessing myself.)-bold This consultation didn’t villainize my partner. It focused on power dynamics and emotional imbalance. (That made me pause.)-bold It took two months after the reading to actually leave. But I kept returning to what was said. (Looking back now, it was the first time someone explained the situation without drama or blame.)-bold", area: "Toxic Relationship Insight" },
  { name: "", quote: "I stayed longer than I should have. Mostly because of family pressure. Responsibility. Fear. (This consultation didn’t push me toward a decision.)-bold It helped me see how long I’d been carrying emotional weight that wasn’t mine alone. (That realization stayed with me.)-bold", area: "Relationship Breakdown" },
  { name: "", quote: "We broke up and got back together more times than I can count. Every time I thought, this time will be different. (The reading explained why the pull felt so intense — and why it kept draining me.)-bold It was the first time someone didn’t romanticize the chaos.", area: "Repeating Relationship Cycles" },
  { name: "", quote: "I actually laughed at first because I thought, this is getting too specific. (It described situations from the last two years I hadn’t mentioned anywhere)-bold — career frustration, family pressure, even when things started feeling heavy. (I had to pause midway. That’s never happened to me before.)-bold", area: "Detailed Chart Reading" },
  { name: "", quote: "It wasn’t dramatic. That’s what made it unsettling. (The reading captured emotional patterns I’ve struggled to articulate for years)-bold — especially around decision-making and delay. (I didn’t feel scared. Just… deeply seen.)-bold", area: "Life Direction Consultation" },
  { name: "", quote: "Okay this was WILD. (I didn’t even explain my situation properly and it still described exactly what I’m confused about right now.)-bold Like… how?? I sent screenshots to my best friend immediately 😂", area: "Career & Studies" },
  { name: "", quote: "I’ve been exposed to astrology for decades, so I rarely get surprised. (This one surprised me. The timing accuracy around past events was nearly perfect.)-bold It helped me contextualize struggles instead of resisting them. (I can’t thank them enough for that clarity. This is real work — and it shows.)-bold", area: "Full Life Analysis" },
  { name: "", quote: "I expected insight. (I didn’t expect to feel this exposed.)-bold It pointed out repeating relationship themes I thought were just bad luck. (Reading that was validating — and uncomfortable. But necessary.)-bold", area: "Relationship & Life Patterns" },
  { name: "", quote: "That was… BLOODY accurate. (Like I had to put my phone down for a minute.)-bold", area: "Relationship analysis" },
  { name: "", quote: "I was about to change cities. Bags packed and everything. (Didn’t go ahead after this reading — and got a job within a month that paid almost double.)-bold Still can’t believe the timing.", area: "Career Timing" },
  { name: "", quote: "(Helped me pick between two guys.)-bold Not by saying who’s “better”… but by explaining which one would be a better partner for life.", area: "Relationship choice" },
  { name: "", quote: "I wasn’t even emotional when I booked it. (But I was emotional after reading it.)-bold", area: "Emotional impact" },
  { name: "", quote: "I was honestly close to giving up. (The reading showed the exact Dasha and transit phase I was in — and more importantly, how long it would last.)-bold Knowing I wasn’t stuck forever… just in a rough cycle… helped me breathe again. (Things really did start easing after that.)-bold", area: "Life analysis" },
  { name: "", quote: "(What helped me most wasn’t prediction — it was time clarity.)-bold They explained why everything felt blocked right now and how the transit was playing out. (When I heard “this phase peaks in a few months,” something shifted mentally.)-bold I stopped panicking. I stopped forcing outcomes. (That alone changed how I showed up)-bold", area: "Time clarity" },
  { name: "", quote: "I was in a phase where nothing worked no matter how hard I tried. (Understanding that I was in a challenging transit — and that it wasn’t personal failure — lifted so much guilt.)-bold Knowing how much longer I had to endure helped me pace myself. (That knowledge alone was grounding.)-bold", area: "Challenging transit" },
  { name: "", quote: "I was wasting months preparing for exams I wasn’t even sure about. (The reading suggested I focus on job opportunities instead.)-bold Within weeks, I got an interview and an offer I wouldn’t have even considered before. (Honestly… that one piece of guidance changed everything.)-bold", area: "Exam pivot" },
  { name: "", quote: "I was dead set on coding jobs after college. (The consultation pointed out my strengths aligned more with management roles.)-bold I pivoted, applied for a couple of positions in project management, and got an offer paying way more than I expected. (Still can’t believe I almost ignored that advice.)-bold", area: "Career pivot" },
  { name: "", quote: "I kept swiping on dating apps for months with no luck. (The reading told me to focus on my existing circle — friends of friends, colleagues, familiar spaces.)-bold Within a month, I met someone who truly clicked. (I honestly wouldn’t have done it without that nudge.)-bold", area: "Love nudge" },
  { name: "", quote: "I was stuck applying for roles I thought were “prestigious” but weren’t a fit. (The session suggested I explore startups in my network where my skill set really mattered.)-bold Two weeks later, I had multiple offers. (It felt like someone finally showed me where to focus my energy.)-bold", area: "Startup focus" },
  { name: "", quote: "I was torn between moving cities or staying. (The reading suggested exploring opportunities locally first instead of rushing relocation.)-bold Within weeks, a job I loved appeared right in my city. I can’t thank this enough — otherwise, I’d have been exhausted and still unemployed.", area: "Relocation advice" },
  { name: "", quote: "I was endlessly preparing for exams, thinking that was my only path. (Instead, the guidance was to start applying for positions aligned with my chart’s timing.)-bold I landed a role I actually enjoy, and it started paying off immediately. (That strategy literally saved me months of wasted effort.)-bold", area: "Strategic career advice" }
];