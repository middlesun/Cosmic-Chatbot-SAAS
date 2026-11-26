import heroHumanCounselImg from '../../src/assets/images/hero_human_counsel_1795581606668.jpg';
import heroHumanReflectionImg from '../../src/assets/images/hero_human_reflection_1795582207524.jpg';
import heroHumanConnectionImg from '../../src/assets/images/hero_human_connection_1795582207788.jpg';
import heroHumanClarityImg from '../../src/assets/images/hero_human_clarity_1795582208303.jpg';

export interface EditorialFeatureItem {
  title: string;
  description: string;
}

export interface ConversationLine {
  sender: 'user' | 'companion';
  text: string;
}

export interface CompanionCarouselItem {
  name: string;
  role: string;
  imageUrl: string;
  alt: string;
  imgClassName?: string;
}

export interface LifeAreaItem {
  title: string;
  description: string;
  imageUrl: string;
  alt: string;
}

export interface HeroBackdropOption {
  id: 'human-counsel' | 'human-reflection' | 'human-connection' | 'human-clarity';
  label: string;
  imageUrl: string;
  imageAlt: string;
  tone: 'light' | 'dark';
  objectPositionClass: string;
  canvasBgClass: string;
}

export const HERO_CONTENT = {
  headlineLine1: 'Clarity & Guidance',
  headlineLine2: 'When you need it the most.',
  body: "When life doesn't go as planned. When the future feels uncertain. When you're searching for answers, struggling to make a decision or simply trying to find your way forward. Find the insights, guidance and emotional support to navigate life's most challenging moments and realise your highest potential.",
  imageUrl: heroHumanCounselImg,
  imageAlt: 'Thoughtful woman seated by a warm sunlit wooden window with tea in calm morning light',
  backdrops: [
    {
      id: 'human-counsel',
      label: 'Human Counsel',
      imageUrl: heroHumanCounselImg,
      imageAlt: 'Thoughtful woman seated by a warm sunlit wooden window with tea in calm morning light',
      tone: 'light',
      objectPositionClass: 'object-[70%_center] md:object-right',
      canvasBgClass: 'bg-[#F3ECE1]',
    },
    {
      id: 'human-reflection',
      label: 'Morning Reflection',
      imageUrl: heroHumanReflectionImg,
      imageAlt: 'Thoughtful man seated at a timber table near a sunlit window with an open notebook',
      tone: 'light',
      objectPositionClass: 'object-[75%_center] md:object-right',
      canvasBgClass: 'bg-[#F3ECE1]',
    },
    {
      id: 'human-connection',
      label: 'Quiet Conversation',
      imageUrl: heroHumanConnectionImg,
      imageAlt: 'Couple sharing an empathetic conversation beside sunlit sheer curtains',
      tone: 'light',
      objectPositionClass: 'object-[76%_center] md:object-right',
      canvasBgClass: 'bg-[#F3ECE1]',
    },
    {
      id: 'human-clarity',
      label: 'Open Window',
      imageUrl: heroHumanClarityImg,
      imageAlt: 'Serene woman standing by an open sunlit wooden window with calm clarity',
      tone: 'light',
      objectPositionClass: 'object-[78%_center] md:object-right',
      canvasBgClass: 'bg-[#F3ECE1]',
    },
  ] satisfies HeroBackdropOption[],
  pillars: [
    { id: 'birthchart', label: 'Birth Chart' },
    { id: 'consultation', label: 'Consultation' },
    { id: 'guidance', label: 'Guidance' },
    { id: 'support', label: 'Support' },
  ] as const,
};

export const BIRTHCHART_CONTENT = {
  indexLabel: 'Deep Birth Chart Analysis',
  headline: 'Your birth chart holds more clues than you realise.',
  lead: 'The relationships you attract. The patterns that repeat. Your natural strengths, untapped potential and the unexpected turning points that shape your life.',
  chartImageUrl: '/assets/landing/chart-parchment.jpg',
  chartImageAlt: 'Luminous parchment engraving of a celestial natal birth chart with zodiac rings and house divisions',
  closingLead:
    'Discover the hidden promises and patterns within your birth chart. Understand your experiences through a deeper astrological perspective, explore the karmic themes of your life and make more considered decisions as you navigate its changing cycles.',
  depthHeading: '6 ways AI astrology is better than human astrology',
  depthIntro:
    "Traditional consultations are often limited by time and the scope of an individual astrologer's expertise. Cosmic Council brings together hundreds of chart indicators, multiple analytical techniques and different astrological traditions to produce comprehensive, nuanced interpretations.",
  features: [
    {
      title: 'Beyond the surface',
      description:
        'Deep analysis across multiple layers of your birth chart, not just isolated placements.',
    },
    {
      title: 'Every promise examined',
      description:
        'Chart promises assessed against cancellations, afflictions and modifying influences.',
    },
    {
      title: 'Multiple perspectives',
      description:
        'Interpretations cross-checked across different astrological traditions and disciplines.',
    },
    {
      title: 'Intelligent synthesis',
      description:
        'Individual findings brought together into a comprehensive interpretation.',
    },
    {
      title: 'Strengths & weaknesses',
      description:
        'Multi-step scoring, ranking and evaluation of planetary and house strengths.',
    },
    {
      title: "Your life's timeline",
      description:
        'Explore past experiences and recurring themes alongside planetary periods and transitions.',
    },
  ] satisfies EditorialFeatureItem[],
};

export const CONSULTATION_CONTENT = {
  indexLabel: 'One-on-One Consultations',
  headline: 'An astrologer who understands more than just your birth chart.',
  lead: "Your circumstances. Your relationships. Your past experiences. Your ambitions. The questions you've been carrying for years.",
  triptych: [
    {
      src: '/assets/companions/nandini.jpg',
      alt: 'Nandini, Vedic relationships astrologer in warm study light',
      caption: 'Vedic Tradition & Timing',
    },
    {
      src: '/assets/landing/astrologer-woman.jpg',
      alt: 'Warm portrait of an astrologer with celestial chart artwork behind her',
      caption: 'Life Context & Counsel',
    },
    {
      src: '/assets/landing/astrologer-man.jpg',
      alt: 'Calm portrait of an astrologer seated outdoors in golden afternoon light',
      caption: 'Thoughtful Dialogue',
    },
  ],
  bridgeCopy:
    'Imagine having an astrologer who can examine your entire birth chart, understand the context of your life and explore your questions in as much depth as you need. Without rushing through a consultation or having to explain your circumstances all over again.',
  dialogueHeading: 'Ask the questions that really matter.',
  dialogueCompanion: {
    name: 'Dev',
    role: 'Vedic Astrology · Life & Wisdom',
    avatarUrl: '/assets/landing/astrologer-man.jpg',
  },
  dialogueLines: [
    {
      sender: 'user',
      text: "I've worked incredibly hard for the last five years, but my career just doesn't seem to take off. Is there something in my chart that explains this?",
    },
    {
      sender: 'companion',
      text: "Let's look beyond your 10th house. I'd like to examine your Dasha sequence, the strength of your career significators and your D10 chart together.",
    },
    {
      sender: 'companion',
      text: "There's an important distinction in Jyotish between the potential for professional success and the periods in which that potential may manifest.",
    },
    {
      sender: 'user',
      text: "Can we also look at whether I'm better suited to business or employment?",
    },
    {
      sender: 'companion',
      text: "Absolutely. That's worth examining separately. We can compare the indicators for independent enterprise and structured employment, alongside your actual experience and appetite for risk.",
    },
  ] satisfies ConversationLine[],
  dialogueFootnote: '',
  features: [
    {
      title: 'Deeply personal consultations',
      description:
        'Chat with AI astrologers who understand both your birth chart and the context of your life.',
    },
    {
      title: 'Your story continues',
      description:
        'Build upon your previous conversations without repeatedly explaining your circumstances',
    },
    {
      title: 'Go as deep as you need',
      description:
        'Ask follow-up questions, challenge interpretations and explore the finer nuances of your chart.',
    },
    {
      title: 'Diverse perspectives',
      description:
        'Understand your life through different traditions, philosophies and interpretive approaches.',
    },
    {
      title: 'Guidance for everyday life',
      description:
        'Personalised horoscopes, astrological timing and perspectives on important decisions.',
    },
    {
      title: 'Guidance without fear',
      description:
        'No fearmongering. No sensational predictions. Only genuine grounded analysis',
    },
    {
      title: 'Ask the uncomfortable questions',
      description: 'Explore sensitive and deeply personal subjects at your own pace.',
    },
    {
      title: 'On your time',
      description:
        'Return to a conversation whenever you have another question or something changes in your life.',
    },
  ] satisfies EditorialFeatureItem[],
  carouselTitle: 'Esoteric guides',
  carouselItems: [
    {
      name: 'Nandini',
      role: 'Vedic Relationships',
      imageUrl: '/assets/companions/nandini.jpg',
      alt: 'Nandini — Vedic Relationships portrait',
    },
    {
      name: 'Marc',
      role: 'Western Astrology',
      imageUrl: '/assets/landing/astrologer-man.jpg',
      alt: 'Marc — Western Astrology portrait',
    },
    {
      name: 'Luna',
      role: 'Love & Connection',
      imageUrl: '/assets/aistudio/image_e0027d30.png',
      alt: 'Luna — Love & Connection portrait',
    },
    {
      name: 'Tara',
      role: 'Modern Astrology',
      imageUrl: '/assets/landing/astrologer-woman.jpg',
      alt: 'Tara — Modern Astrology portrait',
    },
    {
      name: 'Bella',
      role: 'Tarot',
      imageUrl: '/assets/landing/dp-bella.jpg',
      alt: 'Bella — Tarot portrait',
    },
  ] satisfies CompanionCarouselItem[],
};

export const GUIDANCE_CONTENT = {
  indexLabel: 'Finding Real Solutions',
  headline: 'Understanding your life is only the beginning.',
  lead1:
    "Knowing why certain patterns may be repeating, understanding the phase of life you're in and gaining perspective on what lies ahead can bring tremendous clarity.",
  lead2: 'But ultimately, we have decisions to make. Problems to solve. Habits to change. And a life to build.',
  studioImageUrl: '/assets/landing/guidance-studio.jpg',
  studioImageAlt: 'Sunlit minimalist timber study with linen notebooks, olive tree and calm morning light',
  dialogueHeadingLine1: 'Find real solutions.',
  dialogueHeadingLine2: 'Make meaningful changes.',
  dialogueIntro:
    "Talk through your challenges with companions who understand the complexities of what you're going through. Discover possibilities you may have overlooked, develop practical strategies and find the confidence to take your next step.",
  dialogueCompanion: {
    name: 'Ethan',
    role: 'Candid Friend',
    avatarUrl: '/assets/companions/samir.jpg',
  },
  dialogueLines: [
    {
      sender: 'user',
      text: "I've been thinking about quitting my job for two years. Every time I get close, I talk myself out of it.",
    },
    {
      sender: 'companion',
      text: 'Two years is a long time to keep having the same conversation with yourself.',
    },
    {
      sender: 'companion',
      text: "What's actually stopping you? Money, fear of failure, or not knowing what you'd do next?",
    },
    {
      sender: 'user',
      text: 'Mostly money. I have a family to support.',
    },
    {
      sender: 'companion',
      text: "Fair enough. Then let's stop treating quitting as the immediate goal. Let's figure out what financial position you'd need to be in to give yourself a genuine choice.",
    },
  ] satisfies ConversationLine[],
  dialogueFootnote: '',
  lifeAreasTitle: 'For the things that matter most in your life.',
  lifeAreas: [
    {
      title: 'Love & Relationships',
      description: 'Navigate complicated relationships, heartbreak, marriage and new beginnings.',
      imageUrl: '/assets/landing/life-relationships.jpg',
      alt: 'Couple having an earnest conversation over tea by a sunlit window',
    },
    {
      title: 'Career & Business',
      description: 'Work through professional uncertainty, delayed success and important career decisions.',
      imageUrl: '/assets/landing/life-career.jpg',
      alt: 'Woman pausing thoughtfully at a bright window-side wooden work desk',
    },
    {
      title: 'Family & Life Challenges',
      description:
        'Find perspective through family difficulties, financial pressures, disputes and major life transitions.',
      imageUrl: '/assets/landing/life-family.jpg',
      alt: 'Mother and young child sitting warmly together on a cream sofa',
    },
    {
      title: 'Personal Growth',
      description: 'Break old patterns, build confidence, discover new ideas and live more intentionally.',
      imageUrl: '/assets/landing/life-growth.jpg',
      alt: 'Open linen journal, brass pen and steaming ceramic mug of herbal tea on oak desk',
    },
  ] satisfies LifeAreaItem[],
  featuresTitle: "You don't have to figure everything out on your own.",
  features: [
    {
      title: 'Discover solutions hidden in plain sight',
      description:
        'Talk through your problems freely and in depth. Challenge assumptions and explore alternative perspectives.',
    },
    {
      title: "Make the decisions you've been putting off",
      description:
        'Understand your options, weigh the possibilities and find the confidence to move forward.',
    },
    {
      title: 'Make sense of your thoughts',
      description:
        'Express your ideas, reflect on your experiences and work through the things occupying your mind.',
    },
    {
      title: 'Learn. Reflect. Grow.',
      description:
        'Discover powerful ideas through mentors, philosophy, personal growth and spiritual wisdom.',
    },
    {
      title: 'Turn intentions into action',
      description:
        "Work through your goals, identify what's holding you back and explore practical ways forward.",
    },
    {
      title: 'Your own circle of support',
      description:
        'Find mentors, thought partners, candid friends and companions who encourage your progress.',
    },
  ] satisfies EditorialFeatureItem[],
  carouselTitle: 'Your own circle of guidance.',
  carouselCaption:
    'Your own circle of mentors, guides, thought partners and companions, each bringing something different to your life.',
  carouselItems: [
    {
      name: 'Maya',
      role: 'Wise Mentor',
      imageUrl: '/assets/companions/maya.jpg',
      alt: 'Maya — Wise Mentor portrait',
    },
    {
      name: 'Neha',
      role: 'Career',
      imageUrl: '/assets/landing/dp-neha.jpg',
      alt: 'Neha — Career portrait',
    },
    {
      name: 'Isla',
      role: 'Love & Relationships',
      imageUrl: '/assets/landing/dp-isla.jpg',
      alt: 'Isla — Love & Relationships portrait',
    },
    {
      name: 'Lucas',
      role: 'Life Direction',
      imageUrl: '/assets/landing/dp-lucas.jpg',
      alt: 'Lucas — Life Direction portrait',
    },
    {
      name: 'Nikhil',
      role: 'Business',
      imageUrl: '/assets/landing/dp-nikhil.jpg',
      alt: 'Nikhil — Business portrait',
    },
  ] satisfies CompanionCarouselItem[],
};

export const SUPPORT_CONTENT = {
  indexLabel: 'Emotional Support',
  headlineLine1: 'Life can be a lot to carry.',
  headlineLine2: 'Especially when you carry it alone.',
  lead1:
    'As life goes on, our responsibilities grow, our circles become smaller and the things we truly want to talk about become increasingly difficult to share.',
  lead2:
    'There are things we hesitate to tell our families. Feelings our friends may not understand. Questions we feel uncomfortable asking. And moments when we simply wish we had someone to talk to.',
  windowImageUrl: '/assets/landing/support-window.jpg',
  windowImageAlt: 'Woman in a soft knit sweater cradling a warm mug of tea on a sunlit sofa',
  dialogue1Heading: 'A little space to be yourself.',
  dialogue1Intro:
    "At Cosmic Council, find a space to express yourself freely, feel heard, discover new perspectives and find comfort through life's more difficult moments.",
  dialogue1Companion: {
    name: 'Mira',
    role: 'Listener',
    avatarUrl: '/assets/aistudio/image_e0027d30.png',
  },
  dialogue1Lines: [
    {
      sender: 'user',
      text: "I don't know why I'm telling you this. I haven't even told my closest friend.",
    },
    {
      sender: 'companion',
      text: "Sometimes it's easier to say things when you're not worried about how they'll change someone's opinion of you.",
    },
    {
      sender: 'user',
      text: "Exactly. I'm just tired of pretending I'm okay with everything.",
    },
    {
      sender: 'companion',
      text: "Then you don't have to pretend here.",
    },
  ] satisfies ConversationLine[],
  dialogueFootnote: '',
  features: [
    {
      title: 'Feel heard. Feel understood.',
      description:
        'Talk openly with companions who respond with warmth, understanding and without judgement.',
    },
    {
      title: 'Let it all out',
      description:
        'Vent your frustrations, share difficult feelings or talk through the things you normally keep to yourself.',
    },
    {
      title: 'Find a little light on difficult days',
      description:
        'Find comfort, encouragement and perspective when life feels lonely, confusing or overwhelming.',
    },
    {
      title: "When your mind won't switch off",
      description:
        'Work through overthinking, everyday worries, emotional pressure and the thoughts that keep circling in your head.',
    },
    {
      title: 'Conversations with depth',
      description:
        'Have candid discussions, explore philosophy, share spiritual wisdom or simply discover a different way of looking at things.',
    },
    {
      title: 'Share the little things too',
      description:
        "The meal you're cooking. The book you're reading. Something funny that happened today. Not every conversation needs a purpose.",
    },
  ] satisfies EditorialFeatureItem[],
  dialogue2Heading: 'And sometimes, just have a good laugh.',
  dialogue2Companion: {
    name: 'Aira',
    role: 'Mood Lifter',
    avatarUrl: '/assets/landing/dp-aira.jpg',
  },
  dialogue2Lines: [
    {
      sender: 'user',
      text: 'Making pasta tonight. First attempt. Wish me luck 😅',
    },
    {
      sender: 'companion',
      text: 'Excellent. Are we following a recipe or trusting the universe with dinner?',
    },
    {
      sender: 'user',
      text: 'The universe. Obviously.',
    },
    {
      sender: 'companion',
      text: 'Well, the universe would like you to salt the pasta water 😂',
    },
  ] satisfies ConversationLine[],
  carouselTitle: 'Different personalities. Different kinds of connection.',
  carouselItems: [
    {
      name: 'Mira',
      role: 'Listener',
      imageUrl: '/assets/aistudio/image_e0027d30.png',
      alt: 'Mira — Listener portrait',
    },
    {
      name: 'Aira',
      role: 'Mood Lifter',
      imageUrl: '/assets/landing/dp-aira.jpg',
      alt: 'Aira — Mood Lifter portrait',
    },
    {
      name: 'Noah',
      role: 'Comforter',
      imageUrl: '/assets/companions/samir.jpg',
      alt: 'Noah — Comforter portrait',
    },
    {
      name: 'Zoya',
      role: 'Fun Friend',
      imageUrl: '/assets/landing/dp-isla.jpg',
      alt: 'Zoya — Fun Friend portrait',
    },
    {
      name: 'Elias',
      role: 'Deep Conversations',
      imageUrl: '/assets/companions/julian.jpg',
      alt: 'Elias — Deep Conversations portrait',
    },
  ] satisfies CompanionCarouselItem[],
};
