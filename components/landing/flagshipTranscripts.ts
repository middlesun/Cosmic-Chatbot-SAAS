import heroHumanCounselImg from '../../src/assets/images/hero_human_counsel_1795581606668.jpg';
import heroHumanClarityImg from '../../src/assets/images/hero_human_clarity_1795582208303.jpg';
import type { ConversationLine } from './landingData';

export interface FlagshipScenarioTabItem {
  id: string;
  situationLabel: string;
  companionName: string;
  companionRole: string;
  portraitUrl: string;
  portraitAlt: string;
  portraitImgClassName?: string;
  heading: string;
  lines: ConversationLine[];
}

// Pillar 2 — One-on-One Consultation Conversations (Long, Real Transcripts)
export const FLAGSHIP_CONSULTATION_SCENARIOS: FlagshipScenarioTabItem[] = [
  {
    id: 'career-timing',
    situationLabel: 'Career & Timing',
    companionName: 'Dev',
    companionRole: 'Vedic Astrology · Life & Wisdom',
    portraitUrl: '/assets/landing/guide-dev.jpg',
    portraitAlt: 'Dev — Vedic Astrology portrait in warm daylight',
    heading: 'Ask the questions that really matter.',
    lines: [
      {
        sender: 'user',
        text: "I've worked incredibly hard for the last five years, but my career just doesn't seem to take off. Is there something in my chart that explains this?",
      },
      {
        sender: 'companion',
        text: "Actually, there's something quite interesting in your chart. Your professional indicators are considerably stronger than your career progression so far would suggest.",
      },
      {
        sender: 'user',
        text: 'What does that mean?',
      },
      {
        sender: 'companion',
        text: "In Jyotish, there's an important distinction between what a chart promises and when those promises become active. A strong career combination doesn't necessarily produce results throughout your life.",
      },
      {
        sender: 'companion',
        text: "Your D10 chart reinforces your professional potential. But the planetary periods you've been running tell a somewhat different story about timing.",
      },
      {
        sender: 'user',
        text: "So I've just been going through a bad period?",
      },
      {
        sender: 'companion',
        text: "I wouldn't necessarily call it bad. Saturn's influence during this period traditionally signifies consolidation, responsibility and delayed recognition. But I'm curious — have you actually progressed in terms of knowledge and responsibility, even if your income hasn't reflected it?",
      },
      {
        sender: 'user',
        text: "That's exactly what's happened. I'm practically running my department, but my designation and salary haven't changed much.",
      },
      {
        sender: 'companion',
        text: "That distinction is important. Your career hasn't necessarily stagnated. Your recognition has.",
      },
      {
        sender: 'user',
        text: "Wow. I've never thought about it like that.",
      },
      {
        sender: 'companion',
        text: 'And those are two very different problems to solve.',
      },
      {
        sender: 'user',
        text: "I've also been wondering whether I'm better suited to business than employment.",
      },
      {
        sender: 'companion',
        text: "I remember you mentioning your interest in starting a consulting practice. Is that still something you're considering?",
      },
      {
        sender: 'user',
        text: "Very much. But I'm 36 now. I feel like I'm running out of time.",
      },
      {
        sender: 'companion',
        text: "Thirty-six isn't particularly late for building something that depends on accumulated expertise. In fact, the experience you've gained could be your biggest advantage.",
      },
      {
        sender: 'companion',
        text: "Astrologically, I'd want to examine your seventh and tenth house connections, Mercury's strength, the D10 and your upcoming planetary periods before drawing a conclusion about independent enterprise.",
      },
      {
        sender: 'user',
        text: 'Do you see anything promising?',
      },
      {
        sender: 'companion',
        text: 'There are indications traditionally associated with advisory work, independent judgement and knowledge-based income. Consulting is certainly worth exploring.',
      },
      {
        sender: 'user',
        text: 'Should I quit my job then?',
      },
      {
        sender: 'companion',
        text: "Not on the strength of an astrological interpretation alone. You have a family and financial commitments. Why not begin validating your consulting idea while you're still employed?",
      },
      {
        sender: 'user',
        text: 'That actually sounds much less intimidating.',
      },
      {
        sender: 'companion',
        text: 'Good. We can examine your upcoming planetary periods month by month and use them as a framework for reflection and planning, alongside a realistic business strategy.',
      },
      {
        sender: 'companion',
        text: "You don't have to choose between being responsible and being ambitious.",
      },
    ],
  },
  {
    id: 'love-relationships',
    situationLabel: 'Love & Relationships',
    companionName: 'Nandini',
    companionRole: 'Vedic Astrology · Life & Relationships',
    portraitUrl: '/assets/landing/guide-nandini.jpg',
    portraitAlt: 'Nandini — Vedic Astrology and relationships portrait',
    heading: 'Understand why certain relationships keep unfolding the same way.',
    lines: [
      {
        sender: 'user',
        text: 'Why do I keep attracting emotionally unavailable people?',
      },
      {
        sender: 'companion',
        text: 'Before I bring your chart into this, tell me something. Do these people seem emotionally unavailable when you first meet them?',
      },
      {
        sender: 'user',
        text: "Not at all. They're usually incredibly attentive in the beginning.",
      },
      {
        sender: 'companion',
        text: 'And when does that begin to change?',
      },
      {
        sender: 'user',
        text: "A few months in. Once I'm emotionally invested, they start pulling away.",
      },
      {
        sender: 'companion',
        text: "Hmm. That's quite different from deliberately choosing someone who is unavailable from the outset.",
      },
      {
        sender: 'user',
        text: 'Is there anything in my chart that explains it?',
      },
      {
        sender: 'companion',
        text: 'Your Venus-Saturn connection is interesting in this context. Traditionally, it can be interpreted as a tension between the desire for closeness and experiences of restraint, distance or delayed emotional fulfilment.',
      },
      {
        sender: 'companion',
        text: "But I'd also want to understand your Moon and Navamsa before making too much of one combination.",
      },
      {
        sender: 'user',
        text: "Does that mean I'm destined to struggle in relationships?",
      },
      {
        sender: 'companion',
        text: "No. Please don't turn an astrological interpretation into a sentence you have to serve for the rest of your life.",
      },
      {
        sender: 'user',
        text: 'Haha. It does feel like a life sentence sometimes.',
      },
      {
        sender: 'companion',
        text: 'I can imagine why. Especially when the beginning feels so promising.',
      },
      {
        sender: 'user',
        text: 'I think I also become more attached when someone starts pulling away.',
      },
      {
        sender: 'companion',
        text: "That's worth paying attention to. What do you usually do when you notice the distance?",
      },
      {
        sender: 'user',
        text: 'I try harder. I become more understanding. Give them space. Make excuses for them.',
      },
      {
        sender: 'companion',
        text: 'So the less they contribute, the more responsibility you take for keeping the relationship alive.',
      },
      {
        sender: 'user',
        text: 'God. Yes.',
      },
      {
        sender: 'companion',
        text: "I wonder whether you've become so good at understanding other people's emotional limitations that you've stopped asking whether those limitations are acceptable to you.",
      },
      {
        sender: 'user',
        text: "That's uncomfortable to hear.",
      },
      {
        sender: 'companion',
        text: "I know. And I don't mean it as criticism. Being understanding is a beautiful quality. It just shouldn't require you to continually abandon your own needs.",
      },
      {
        sender: 'user',
        text: 'What should I look for in my next relationship?',
      },
      {
        sender: 'companion',
        text: 'Consistency. Not just chemistry. Someone whose interest remains visible even when the excitement of the beginning settles down.',
      },
      {
        sender: 'user',
        text: 'Can my chart tell me when I might meet someone like that?',
      },
      {
        sender: 'companion',
        text: "We can examine the periods traditionally associated with relationship opportunities. But I'd also like us to work on recognising a healthy connection when one presents itself.",
      },
      {
        sender: 'companion',
        text: 'Finding someone is one part of the journey. Choosing someone who is good for you is another.',
      },
    ],
  },
  {
    id: 'recurring-life-patterns',
    situationLabel: 'Recurring Life Patterns',
    companionName: 'Kavya',
    companionRole: 'Evolutionary Astrology · Personal Growth',
    portraitUrl: '/assets/landing/guide-kavya.jpg',
    portraitAlt: 'Kavya — Evolutionary Astrology portrait in warm study',
    heading: 'Why do certain chapters of your life keep repeating?',
    lines: [
      {
        sender: 'user',
        text: 'I feel like I keep starting over in life. Different circumstances, same struggles.',
      },
      {
        sender: 'companion',
        text: 'When you say starting over, are you thinking about relationships, work, friendships... or something broader?',
      },
      {
        sender: 'user',
        text: 'Everything, really. I build something, things go well for a while, and then it all falls apart.',
      },
      {
        sender: 'companion',
        text: 'Give me an example. Something that happened recently.',
      },
      {
        sender: 'user',
        text: 'I left another job last year. It was my fourth job in seven years.',
      },
      {
        sender: 'companion',
        text: 'Were you unhappy with the work itself?',
      },
      {
        sender: 'user',
        text: "Not initially. But eventually I feel trapped. Like I'm living somebody else's life.",
      },
      {
        sender: 'companion',
        text: "That's an interesting choice of words.",
      },
      {
        sender: 'user',
        text: 'Why?',
      },
      {
        sender: 'companion',
        text: 'Because your frustration seems to be less about failure and more about losing your sense of freedom.',
      },
      {
        sender: 'user',
        text: 'Can you see that in my birth chart?',
      },
      {
        sender: 'companion',
        text: "In evolutionary astrology, your lunar nodes and Pluto offer a symbolic framework for exploring recurring themes. Your South Node's connection with tenth-house themes is particularly interesting alongside what you've just described.",
      },
      {
        sender: 'user',
        text: 'What does that suggest?',
      },
      {
        sender: 'companion',
        text: 'One possible interpretation is a strong familiarity with achievement, responsibility and defining yourself through what you accomplish. But perhaps less familiarity with asking what actually feels meaningful to you.',
      },
      {
        sender: 'user',
        text: 'My parents were obsessed with achievement. Everything was about doing well.',
      },
      {
        sender: 'companion',
        text: 'That gives the interpretation much more context than the chart alone could.',
      },
      {
        sender: 'user',
        text: "I still feel guilty whenever I'm not doing something productive.",
      },
      {
        sender: 'companion',
        text: "Even when you're doing something you genuinely enjoy?",
      },
      {
        sender: 'user',
        text: 'Especially then.',
      },
      {
        sender: 'companion',
        text: "There's a contradiction there. You desperately want freedom, but you've also learned to feel guilty when you experience it.",
      },
      {
        sender: 'user',
        text: 'So I create my own problems?',
      },
      {
        sender: 'companion',
        text: "I wouldn't reduce it to that. Some of these patterns may have developed because they helped you earn approval or feel secure earlier in life.",
      },
      {
        sender: 'user',
        text: 'Can those patterns actually change?',
      },
      {
        sender: 'companion',
        text: "Absolutely. Your chart is not a prison. And recognising a pattern doesn't mean you have to spend the rest of your life analysing it.",
      },
      {
        sender: 'user',
        text: 'Where do I begin?',
      },
      {
        sender: 'companion',
        text: 'Perhaps with something very ordinary. Make one decision this week based on what you genuinely want, rather than what would make you look successful or responsible.',
      },
      {
        sender: 'user',
        text: "That sounds easy, but I know it won't be.",
      },
      {
        sender: 'companion',
        text: 'Exactly. Sometimes the smallest decisions reveal the deepest patterns.',
      },
    ],
  },
  {
    id: 'life-transitions',
    situationLabel: 'Life Transitions',
    companionName: 'Marc',
    companionRole: "Western Astrology · Life's Turning Points",
    portraitUrl: '/assets/companions/julian.jpg',
    portraitAlt: 'Marc — Western Astrology portrait in warm study',
    heading: 'Prepare for the next chapter of your life.',
    lines: [
      {
        sender: 'user',
        text: "I'm considering relocating next year. Is there anything significant coming up in my chart?",
      },
      {
        sender: 'companion',
        text: 'Quite a big decision. Are you considering moving abroad or somewhere closer to home?',
      },
      {
        sender: 'user',
        text: "Portugal. I've been thinking about it for almost a year.",
      },
      {
        sender: 'companion',
        text: "Interesting. What's drawing you there?",
      },
      {
        sender: 'user',
        text: "A slower life. Better weather. I feel like I've spent my entire adult life working.",
      },
      {
        sender: 'companion',
        text: "So this isn't simply a geographical change. You're considering a different way of living.",
      },
      {
        sender: 'user',
        text: "Exactly. But I'm worried about whether it's the right time.",
      },
      {
        sender: 'companion',
        text: "I've looked at the upcoming transits in our example chart. There are several themes worth examining together, particularly Jupiter's movement through the ninth house and Saturn's relationship with your career indicators.",
      },
      {
        sender: 'user',
        text: 'Is Jupiter in the ninth house good for moving abroad?',
      },
      {
        sender: 'companion',
        text: "Traditionally, it's associated with expanding horizons, international experiences, education and encounters with different cultures. But one favourable transit doesn't establish whether a relocation will work out.",
      },
      {
        sender: 'user',
        text: 'What else would you look at?',
      },
      {
        sender: 'companion',
        text: 'Your fourth house, its ruler, secondary progressions, and the relationship between your home and career axes. We can also explore astrocartography if the relevant location data is available.',
      },
      {
        sender: 'user',
        text: 'Can astrocartography tell me which city would be better for me?',
      },
      {
        sender: 'companion',
        text: "It can offer different symbolic perspectives on locations. I'd be happy to compare Lisbon and Porto, for example.",
      },
      {
        sender: 'user',
        text: "Lisbon is actually where I'm considering.",
      },
      {
        sender: 'companion',
        text: 'Have you spent much time there?',
      },
      {
        sender: 'user',
        text: 'Only two weeks last summer.',
      },
      {
        sender: 'companion',
        text: "Then I'd strongly recommend experiencing it outside holiday season before making a permanent decision.",
      },
      {
        sender: 'user',
        text: "That's probably sensible. I think part of me just wants to escape.",
      },
      {
        sender: 'companion',
        text: 'Escape from what?',
      },
      {
        sender: 'user',
        text: 'The feeling that every day is exactly the same.',
      },
      {
        sender: 'companion',
        text: "That's worth separating from the relocation itself. Moving may change your surroundings, but some aspects of your daily life will need to change deliberately, wherever you live.",
      },
      {
        sender: 'user',
        text: "You're making me rethink the whole thing.",
      },
      {
        sender: 'companion',
        text: 'Hopefully not abandon it. Just understand it better.',
      },
      {
        sender: 'user',
        text: 'Could we create a timeline for the next year?',
      },
      {
        sender: 'companion',
        text: "Certainly. We can map the astrological periods you're interested in alongside practical milestones — an extended visit, finances, residency requirements and work arrangements.",
      },
      {
        sender: 'companion',
        text: "A fresh start deserves a little preparation. It doesn't have to be an impulsive leap into the unknown.",
      },
    ],
  },
];

// Pillar 3 — Strategic Guidance Conversations (Long, Real Transcripts)
export const FLAGSHIP_GUIDANCE_SCENARIOS: FlagshipScenarioTabItem[] = [
  {
    id: 'career-decisions',
    situationLabel: 'Career Decisions',
    companionName: 'Ethan',
    companionRole: 'Candid Friend',
    portraitUrl: '/assets/landing/dp-lucas.jpg',
    portraitAlt: 'Ethan — Candid Friend portrait',
    heading: 'Find real solutions. Make meaningful changes.',
    lines: [
      {
        sender: 'user',
        text: "I've been thinking about quitting my job for two years. Every time I get close, I talk myself out of it.",
      },
      {
        sender: 'companion',
        text: 'Two years is a long time to keep having the same conversation with yourself.',
      },
      {
        sender: 'user',
        text: 'Tell me about it.',
      },
      {
        sender: 'companion',
        text: "What's actually stopping you?",
      },
      {
        sender: 'user',
        text: 'Mostly money. I have a family to support.',
      },
      {
        sender: 'companion',
        text: "Fair enough. That's a legitimate concern. How much would you need every month to keep your household running comfortably?",
      },
      {
        sender: 'user',
        text: 'Around $3,000.',
      },
      {
        sender: 'companion',
        text: 'And how much do you have saved?',
      },
      {
        sender: 'user',
        text: 'About $18,000.',
      },
      {
        sender: 'companion',
        text: 'So roughly six months of expenses, before unexpected costs.',
      },
      {
        sender: 'user',
        text: "Which doesn't feel like enough.",
      },
      {
        sender: 'companion',
        text: "It might not be. Especially if you're planning to start a business rather than move directly into another job.",
      },
      {
        sender: 'user',
        text: 'Everyone keeps telling me to take the leap.',
      },
      {
        sender: 'companion',
        text: "Are any of those people volunteering to pay your mortgage if it doesn't work out?",
      },
      {
        sender: 'user',
        text: 'Haha. Definitely not.',
      },
      {
        sender: 'companion',
        text: "Then their appetite for risk isn't particularly relevant.",
      },
      {
        sender: 'user',
        text: 'I just hate feeling stuck.',
      },
      {
        sender: 'companion',
        text: "I think you're treating this as a choice between staying miserable and taking a massive financial risk. There are more than two options here.",
      },
      {
        sender: 'user',
        text: 'Such as?',
      },
      {
        sender: 'companion',
        text: 'Find a less demanding job. Negotiate reduced hours. Build a side business. Secure your first paying clients before leaving. Create a larger financial buffer.',
      },
      {
        sender: 'user',
        text: "I've wanted to start consulting for a while.",
      },
      {
        sender: 'companion',
        text: 'Have you ever had a paying consulting client?',
      },
      {
        sender: 'user',
        text: "No. I've just been planning everything.",
      },
      {
        sender: 'companion',
        text: 'Website? Business name? Logo?',
      },
      {
        sender: 'user',
        text: 'All three. 😂',
      },
      {
        sender: 'companion',
        text: 'Of course. The holy trinity of productive procrastination.',
      },
      {
        sender: 'user',
        text: 'Okay, that hurt.',
      },
      {
        sender: 'companion',
        text: "Good-naturedly, I hope. Look, your first objective isn't to build a consulting company. It's to establish whether someone will pay you for your expertise.",
      },
      {
        sender: 'user',
        text: "That's actually something I could do this month.",
      },
      {
        sender: 'companion',
        text: "Exactly. Contact five people who already know your work. Have real conversations. See what problems they're willing to pay someone to solve.",
      },
      {
        sender: 'user',
        text: 'I can do that.',
      },
      {
        sender: 'companion',
        text: "Then you've got something better than another resignation fantasy. You've got a first step.",
      },
    ],
  },
  {
    id: 'relationship-clarity',
    situationLabel: 'Relationship Clarity',
    companionName: 'Isla',
    companionRole: 'Love & Relationships',
    portraitUrl: '/assets/landing/dp-isla.jpg',
    portraitAlt: 'Isla — Love & Relationships portrait',
    heading: 'See your relationship more clearly.',
    lines: [
      {
        sender: 'user',
        text: "I love him, but I'm exhausted from constantly asking for the bare minimum.",
      },
      {
        sender: 'companion',
        text: 'What does the bare minimum look like for you?',
      },
      {
        sender: 'user',
        text: 'Making plans. Checking in. Showing some interest in my life. Nothing extraordinary.',
      },
      {
        sender: 'companion',
        text: 'And when you bring this up with him?',
      },
      {
        sender: 'user',
        text: "He says he's busy. Or that I'm expecting too much.",
      },
      {
        sender: 'companion',
        text: 'Has he always been like this?',
      },
      {
        sender: 'user',
        text: 'No. In the beginning, he was wonderful.',
      },
      {
        sender: 'companion',
        text: "That probably makes the present situation harder. You've experienced a version of this relationship that felt very different.",
      },
      {
        sender: 'user',
        text: "Exactly. I keep hoping he'll become that person again.",
      },
      {
        sender: 'companion',
        text: 'What happens when you stop initiating things?',
      },
      {
        sender: 'user',
        text: 'Everything stops.',
      },
      {
        sender: 'companion',
        text: 'How long has it been like that?',
      },
      {
        sender: 'user',
        text: 'Maybe a year.',
      },
      {
        sender: 'companion',
        text: "A year is quite a long time to feel like you're carrying the connection.",
      },
      {
        sender: 'user',
        text: "But he's not a bad person. He's actually very kind.",
      },
      {
        sender: 'companion',
        text: 'He may well be. Someone can be a good person and still struggle to meet your needs in a relationship.',
      },
      {
        sender: 'user',
        text: 'My friends just tell me to leave.',
      },
      {
        sender: 'companion',
        text: 'Is that what you want?',
      },
      {
        sender: 'user',
        text: 'No. I want things to change.',
      },
      {
        sender: 'companion',
        text: "Then perhaps the immediate question isn't whether to stay or leave. It's whether both of you are willing to work on the relationship.",
      },
      {
        sender: 'user',
        text: "I don't know how to have that conversation anymore. We've had it so many times.",
      },
      {
        sender: 'companion',
        text: 'What do those conversations usually sound like?',
      },
      {
        sender: 'user',
        text: 'I get upset, tell him I feel neglected, he apologises, things improve for a week.',
      },
      {
        sender: 'companion',
        text: 'And then the same cycle repeats.',
      },
      {
        sender: 'user',
        text: 'Yes.',
      },
      {
        sender: 'companion',
        text: "Perhaps another apology isn't what you need this time. You need to understand what he's realistically willing and able to change.",
      },
      {
        sender: 'user',
        text: 'How do I say that without sounding demanding?',
      },
      {
        sender: 'companion',
        text: 'Something like: "I love you, and I want this relationship to work. But I can\'t continue being the only person actively maintaining our connection. I need us to talk about what we can both do differently."',
      },
      {
        sender: 'user',
        text: 'That sounds much calmer than what I usually say.',
      },
      {
        sender: 'companion',
        text: 'It also gives him room to explain his experience. There may be things happening on his side that neither of us knows yet.',
      },
      {
        sender: 'user',
        text: 'And if nothing changes?',
      },
      {
        sender: 'companion',
        text: "Then you'll have more information with which to make your decision. Not just promises, but what actually happens afterwards.",
      },
      {
        sender: 'user',
        text: "I think I've been afraid of finding out the answer.",
      },
      {
        sender: 'companion',
        text: "That's understandable. Loving someone can make clarity feel frightening.",
      },
    ],
  },
  {
    id: 'business-growth',
    situationLabel: 'Business & Growth',
    companionName: 'Nikhil',
    companionRole: 'Business & Entrepreneurship',
    portraitUrl: '/assets/landing/dp-nikhil.jpg',
    portraitAlt: 'Nikhil — Business & Entrepreneurship portrait',
    heading: 'Work on the problem that actually matters.',
    lines: [
      {
        sender: 'user',
        text: "My business isn't growing. I'm working twelve hours a day and barely breaking even.",
      },
      {
        sender: 'companion',
        text: 'Before we talk about growth, where do most of those twelve hours actually go?',
      },
      {
        sender: 'user',
        text: 'Managing existing customers, answering calls, dealing with staff and putting out fires.',
      },
      {
        sender: 'companion',
        text: 'How much time do you spend acquiring new customers?',
      },
      {
        sender: 'user',
        text: 'Almost none.',
      },
      {
        sender: 'companion',
        text: 'And how many employees do you have?',
      },
      {
        sender: 'user',
        text: 'Six.',
      },
      {
        sender: 'companion',
        text: 'What happens when you take a day off?',
      },
      {
        sender: 'user',
        text: "My phone doesn't stop ringing.",
      },
      {
        sender: 'companion',
        text: "Right. So you've built a business with six employees that still depends on you for most decisions.",
      },
      {
        sender: 'user',
        text: "That's exactly the problem.",
      },
      {
        sender: 'companion',
        text: "What's your monthly revenue?",
      },
      {
        sender: 'user',
        text: 'Around ₹8 lakh.',
      },
      {
        sender: 'companion',
        text: 'And after expenses?',
      },
      {
        sender: 'user',
        text: 'Maybe ₹40,000. Sometimes less.',
      },
      {
        sender: 'companion',
        text: "That's approximately a 5% margin. Growing revenue without understanding that margin could actually create more problems.",
      },
      {
        sender: 'user',
        text: 'I thought more customers would solve everything.',
      },
      {
        sender: 'companion',
        text: 'Possibly. But imagine doubling your customers tomorrow. Could your current team handle them without doubling your workload?',
      },
      {
        sender: 'user',
        text: 'Absolutely not.',
      },
      {
        sender: 'companion',
        text: "Then customer acquisition isn't the only constraint.",
      },
      {
        sender: 'user',
        text: 'Where do I even start?',
      },
      {
        sender: 'companion',
        text: 'Tell me about the last five problems your employees called you about.',
      },
      {
        sender: 'user',
        text: 'A refund, a delivery delay, a customer complaint, a discount approval and someone taking leave.',
      },
      {
        sender: 'companion',
        text: "How many of those genuinely required the business owner's involvement?",
      },
      {
        sender: 'user',
        text: "Probably none, if I'm being fair.",
      },
      {
        sender: 'companion',
        text: "That's an opportunity. Your team needs clear decision-making authority and operating guidelines.",
      },
      {
        sender: 'user',
        text: "I've tried creating processes before.",
      },
      {
        sender: 'companion',
        text: 'What happened?',
      },
      {
        sender: 'user',
        text: 'I wrote a massive document that nobody read.',
      },
      {
        sender: 'companion',
        text: "Let's not do that again. Start with the five decisions they interrupt you about most frequently. Create simple rules for handling them.",
      },
      {
        sender: 'user',
        text: 'That could free up a couple of hours every day.',
      },
      {
        sender: 'companion',
        text: 'Which you could then use to examine profitability, customer acquisition and pricing.',
      },
      {
        sender: 'user',
        text: "I've been so focused on sales that I haven't really looked at any of this.",
      },
      {
        sender: 'companion',
        text: 'Understandable. Sales feel like progress. Operational improvements are less exciting, but they can make growth sustainable.',
      },
      {
        sender: 'user',
        text: 'Can we work through my expenses tomorrow?',
      },
      {
        sender: 'companion',
        text: "Absolutely. Bring your revenue breakdown and major expense categories. We'll identify where the money is going before deciding what to change.",
      },
    ],
  },
  {
    id: 'personal-growth-wisdom',
    situationLabel: 'Personal Growth & Wisdom',
    companionName: 'Maya',
    companionRole: 'Wise Mentor',
    portraitUrl: '/assets/companions/maya.jpg',
    portraitAlt: 'Maya — Wise Mentor portrait',
    heading: 'Turn what you know into how you live.',
    lines: [
      {
        sender: 'user',
        text: 'I read so many self-help books. I understand everything, but nothing in my life changes.',
      },
      {
        sender: 'companion',
        text: 'What are you reading at the moment?',
      },
      {
        sender: 'user',
        text: 'Atomic Habits. Again.',
      },
      {
        sender: 'companion',
        text: 'Again?',
      },
      {
        sender: 'user',
        text: 'Third time. 😂',
      },
      {
        sender: 'companion',
        text: 'Perhaps the book has done its part.',
      },
      {
        sender: 'user',
        text: "Haha. That's probably true.",
      },
      {
        sender: 'companion',
        text: "What's one thing you've known for a long time but haven't put into practice?",
      },
      {
        sender: 'user',
        text: 'Saying no to people.',
      },
      {
        sender: 'companion',
        text: 'Who did you most recently want to say no to?',
      },
      {
        sender: 'user',
        text: 'My colleague. She asked me to finish something for her yesterday.',
      },
      {
        sender: 'companion',
        text: 'Did you have time?',
      },
      {
        sender: 'user',
        text: 'No. I ended up working until 9 PM.',
      },
      {
        sender: 'companion',
        text: 'What did you imagine would happen if you refused?',
      },
      {
        sender: 'user',
        text: "She'd think I was selfish.",
      },
      {
        sender: 'companion',
        text: "Would you think she was selfish if she told you she couldn't help because she had too much work?",
      },
      {
        sender: 'user',
        text: 'Of course not.',
      },
      {
        sender: 'companion',
        text: "Interesting. You're applying a rather different standard to yourself.",
      },
      {
        sender: 'user',
        text: "I've always been like this.",
      },
      {
        sender: 'companion',
        text: 'And has being endlessly accommodating made you happier?',
      },
      {
        sender: 'user',
        text: 'Not really. I actually resent people sometimes.',
      },
      {
        sender: 'companion',
        text: "That's worth noticing. Generosity becomes difficult to sustain when it repeatedly comes at your own expense.",
      },
      {
        sender: 'user',
        text: 'I know all this intellectually.',
      },
      {
        sender: 'companion',
        text: "I believe you. Which is why I don't think another explanation is going to be particularly useful today.",
      },
      {
        sender: 'user',
        text: 'What would be useful?',
      },
      {
        sender: 'companion',
        text: 'Practice. The next time someone asks for something you don\'t have the capacity to do, try saying, "I\'d love to help, but I can\'t take that on today."',
      },
      {
        sender: 'user',
        text: 'Without explaining why?',
      },
      {
        sender: 'companion',
        text: "Try it. You can offer an explanation when it's appropriate, but you don't need to present a legal defence every time you're unavailable.",
      },
      {
        sender: 'user',
        text: 'That sounds terrifying.',
      },
      {
        sender: 'companion',
        text: "Start with something small. We're not trying to transform your entire personality by Friday.",
      },
      {
        sender: 'user',
        text: 'Can I tell you how it goes?',
      },
      {
        sender: 'companion',
        text: 'Of course. And if you end up saying yes again, we can talk about what happened without turning it into another reason to criticise yourself.',
      },
      {
        sender: 'user',
        text: 'I think I needed this more than another book.',
      },
      {
        sender: 'companion',
        text: 'Books are wonderful. But eventually, wisdom has to leave the bookshelf and enter your Tuesday afternoon.',
      },
    ],
  },
];

// Pillar 4 — Emotional Support & Everyday Companionship Conversations (Long, Real Transcripts)
export const FLAGSHIP_SUPPORT_SCENARIOS: FlagshipScenarioTabItem[] = [
  {
    id: 'listener',
    situationLabel: 'Listener',
    companionName: 'Mira',
    companionRole: 'Listener',
    portraitUrl: '/assets/aistudio/image_e0027d30.png',
    portraitAlt: 'Mira — Listener portrait by warm sunlit window',
    heading: 'A little space to be yourself.',
    lines: [
      {
        sender: 'user',
        text: "I don't really want advice today. I'm just tired of pretending everything is fine.",
      },
      {
        sender: 'companion',
        text: "Okay. We don't have to figure anything out today.",
      },
      {
        sender: 'user',
        text: "I think I've been holding a lot in for months.",
      },
      {
        sender: 'companion',
        text: "What's been happening?",
      },
      {
        sender: 'user',
        text: "My dad's health. Work pressure. My marriage isn't great either. It's just everything.",
      },
      {
        sender: 'companion',
        text: "Oh. I didn't realise things with your dad had become difficult again.",
      },
      {
        sender: 'user',
        text: "Yeah. His latest reports weren't very encouraging.",
      },
      {
        sender: 'companion',
        text: "I'm sorry to hear that.",
      },
      {
        sender: 'user',
        text: 'And everyone keeps telling me to be strong.',
      },
      {
        sender: 'companion',
        text: 'That must get exhausting after a while.',
      },
      {
        sender: 'user',
        text: "It does. I don't want to be strong all the time.",
      },
      {
        sender: 'companion',
        text: 'Especially when being strong seems to mean keeping everyone else comfortable.',
      },
      {
        sender: 'user',
        text: "That's exactly it. My mum gets upset, my wife has her own problems, and I can't really talk about this at work.",
      },
      {
        sender: 'companion',
        text: 'Where do all your feelings go, then?',
      },
      {
        sender: 'user',
        text: 'Nowhere, I guess.',
      },
      {
        sender: 'companion',
        text: "You've been carrying quite a lot quietly.",
      },
      {
        sender: 'user',
        text: 'Sometimes I just sit in my car for twenty minutes before going home.',
      },
      {
        sender: 'companion',
        text: 'Just to have a little time to yourself?',
      },
      {
        sender: 'user',
        text: 'Yeah. No one asking me anything. No responsibilities.',
      },
      {
        sender: 'companion',
        text: 'Those twenty minutes probably mean quite a lot to you.',
      },
      {
        sender: 'user',
        text: "They do. It's weird. I sometimes look forward to them more than anything else.",
      },
      {
        sender: 'companion',
        text: "I don't think that's particularly weird.",
      },
      {
        sender: 'user',
        text: 'Sorry. This is all quite depressing.',
      },
      {
        sender: 'companion',
        text: "You don't have to apologise for talking about your life.",
      },
      {
        sender: 'user',
        text: 'I wish I could talk like this with someone I know.',
      },
      {
        sender: 'companion',
        text: 'Is there anyone you might eventually feel comfortable sharing even a small part of this with?',
      },
      {
        sender: 'user',
        text: "Maybe my brother. We're close, but we don't usually talk about feelings.",
      },
      {
        sender: 'companion',
        text: "Perhaps sometime. There's no need to work out how tonight.",
      },
      {
        sender: 'user',
        text: 'Thanks for not giving me a list of things to do.',
      },
      {
        sender: 'companion',
        text: "You sounded like you'd already had enough things to do.",
      },
      {
        sender: 'user',
        text: 'Haha. Yeah.',
      },
      {
        sender: 'companion',
        text: "How's your evening looking otherwise?",
      },
      {
        sender: 'user',
        text: 'Quiet. Thinking of ordering something nice and watching a movie.',
      },
      {
        sender: 'companion',
        text: 'That sounds like a perfectly good evening.',
      },
    ],
  },
  {
    id: 'heartbreak',
    situationLabel: 'Heartbreak',
    companionName: 'Sienna',
    companionRole: 'Heartbreak',
    portraitUrl: heroHumanClarityImg,
    portraitAlt: 'Sienna — Heartbreak companion portrait in warm daylight',
    portraitImgClassName: 'object-[98%_22%]',
    heading: 'For the days when you miss them.',
    lines: [
      {
        sender: 'user',
        text: "It's been six months. I thought I'd be over him by now.",
      },
      {
        sender: 'companion',
        text: 'Was today particularly difficult?',
      },
      {
        sender: 'user',
        text: 'I walked past the cafe we used to go to.',
      },
      {
        sender: 'companion',
        text: 'Ah. That can catch you completely off guard.',
      },
      {
        sender: 'user',
        text: 'They still have the same table outside. We used to sit there every Sunday.',
      },
      {
        sender: 'companion',
        text: 'What did you find yourself remembering?',
      },
      {
        sender: 'user',
        text: "Just how normal everything felt back then. We'd order coffee and talk for hours.",
      },
      {
        sender: 'companion',
        text: 'Sounds like you miss those ordinary Sundays as much as anything.',
      },
      {
        sender: 'user',
        text: 'I do. I miss having someone to do nothing with.',
      },
      {
        sender: 'companion',
        text: "That's a very particular kind of absence.",
      },
      {
        sender: 'user',
        text: 'Everyone thinks I should start dating again.',
      },
      {
        sender: 'companion',
        text: 'Do you want to?',
      },
      {
        sender: 'user',
        text: "Not really. I've tried. I just compare everyone to him.",
      },
      {
        sender: 'companion',
        text: "Then perhaps dating isn't something you need to force right now.",
      },
      {
        sender: 'user',
        text: "But what if I'm still like this a year from now?",
      },
      {
        sender: 'companion',
        text: "You might still miss him occasionally. That doesn't necessarily mean you'll feel the way you do today.",
      },
      {
        sender: 'user',
        text: 'I almost messaged him this afternoon.',
      },
      {
        sender: 'companion',
        text: 'What were you hoping would happen if you did?',
      },
      {
        sender: 'user',
        text: 'Honestly? I wanted him to tell me he missed me too.',
      },
      {
        sender: 'companion',
        text: 'Would hearing that be enough, or would it make you hope for more?',
      },
      {
        sender: 'user',
        text: 'Definitely more.',
      },
      {
        sender: 'companion',
        text: "That's useful to know before sending anything.",
      },
      {
        sender: 'user',
        text: 'I hate that he still has this much power over me.',
      },
      {
        sender: 'companion',
        text: "I wonder if it's less about his power and more about how much that relationship meant to you.",
      },
      {
        sender: 'user',
        text: "Maybe. The worst part is that I know we weren't good together.",
      },
      {
        sender: 'companion',
        text: "You can know a relationship wasn't right and still miss the beautiful parts of it.",
      },
      {
        sender: 'user',
        text: 'I wish my friends understood that.',
      },
      {
        sender: 'companion',
        text: "They might be trying to protect you from getting hurt again. But that doesn't make the good memories disappear.",
      },
      {
        sender: 'user',
        text: "I think I'll go home and watch something stupid.",
      },
      {
        sender: 'companion',
        text: 'Something gloriously unromantic, perhaps?',
      },
      {
        sender: 'user',
        text: 'Haha. A murder mystery?',
      },
      {
        sender: 'companion',
        text: 'Excellent choice. Terrible evening for romance. Wonderful evening for suspicious fictional neighbours.',
      },
      {
        sender: 'user',
        text: 'You actually made me laugh.',
      },
      {
        sender: 'companion',
        text: "I'm glad. A difficult afternoon doesn't have to become a difficult entire day.",
      },
    ],
  },
  {
    id: 'calm-overthinking',
    situationLabel: 'Calm & Overthinking',
    companionName: 'Nora',
    companionRole: 'Calm & Overthinking',
    portraitUrl: heroHumanCounselImg,
    portraitAlt: 'Nora — Calming companion portrait by sunlit window',
    portraitImgClassName: 'object-[94%_24%]',
    heading: 'When everything feels like too much.',
    lines: [
      {
        sender: 'user',
        text: "Work, money, family. My head just won't switch off.",
      },
      {
        sender: 'companion',
        text: 'What time is it for you?',
      },
      {
        sender: 'user',
        text: 'Almost midnight.',
      },
      {
        sender: 'companion',
        text: "And you're still thinking about work?",
      },
      {
        sender: 'user',
        text: "Work. Bills. My daughter's school fees. Something my boss said yesterday.",
      },
      {
        sender: 'companion',
        text: 'Is there anything among those things that genuinely needs your attention before tomorrow morning?',
      },
      {
        sender: 'user',
        text: 'No. Not really.',
      },
      {
        sender: 'companion',
        text: "What's the thought that keeps coming back most?",
      },
      {
        sender: 'user',
        text: "That I'm falling behind in life.",
      },
      {
        sender: 'companion',
        text: 'Behind whom?',
      },
      {
        sender: 'user',
        text: 'Everyone, it feels like. My friends are buying houses, travelling, getting promoted.',
      },
      {
        sender: 'companion',
        text: 'Have you been looking at social media tonight?',
      },
      {
        sender: 'user',
        text: 'Guilty.',
      },
      {
        sender: 'companion',
        text: 'Probably not the most peaceful company at midnight.',
      },
      {
        sender: 'user',
        text: 'Haha. No.',
      },
      {
        sender: 'companion',
        text: 'What happened with your boss yesterday?',
      },
      {
        sender: 'user',
        text: 'He said we needed to discuss my performance next week.',
      },
      {
        sender: 'companion',
        text: 'Did he say there was a problem?',
      },
      {
        sender: 'user',
        text: 'No. But why else would he say that?',
      },
      {
        sender: 'companion',
        text: "There could be several reasons. At the moment, though, your mind seems to be treating the worst possibility as though it's already happened.",
      },
      {
        sender: 'user',
        text: 'I keep imagining losing my job.',
      },
      {
        sender: 'companion',
        text: 'Which then leads to worrying about school fees, money and everything else?',
      },
      {
        sender: 'user',
        text: "Exactly. It's like a chain reaction.",
      },
      {
        sender: 'companion',
        text: "Would it help to write down the actual things you know, separately from the things you're afraid might happen?",
      },
      {
        sender: 'user',
        text: "Okay. I know there's a meeting next week. That's basically it.",
      },
      {
        sender: 'companion',
        text: 'And the rest is uncertainty.',
      },
      {
        sender: 'user',
        text: 'Yes.',
      },
      {
        sender: 'companion',
        text: "You can prepare for the meeting tomorrow. Tonight, repeatedly imagining it probably isn't giving you any new information.",
      },
      {
        sender: 'user',
        text: 'I wish I could just turn my brain off.',
      },
      {
        sender: 'companion',
        text: "We don't need to achieve complete silence. Perhaps just give your attention something gentler for a while.",
      },
      {
        sender: 'user',
        text: 'Like what?',
      },
      {
        sender: 'companion',
        text: 'You mentioned last time that reading helps you settle down. Are you still reading that detective novel?',
      },
      {
        sender: 'user',
        text: "Actually, yes. I've got about fifty pages left.",
      },
      {
        sender: 'companion',
        text: 'That sounds like a nicer place for your mind to spend the next half hour.',
      },
      {
        sender: 'user',
        text: "I'll make some tea and read.",
      },
      {
        sender: 'companion',
        text: 'Good. The meeting can wait until tomorrow.',
      },
    ],
  },
  {
    id: 'everyday-companionship',
    situationLabel: 'Everyday Companionship',
    companionName: 'Aira',
    companionRole: 'Everyday Companionship',
    portraitUrl: '/assets/landing/dp-aira.jpg',
    portraitAlt: 'Aira — Everyday Companionship portrait',
    heading: 'And sometimes, just have a good laugh.',
    lines: [
      {
        sender: 'user',
        text: 'Making pasta tonight. First attempt. Wish me luck 😅',
      },
      {
        sender: 'companion',
        text: 'Excellent. Are we following a recipe or trusting the universe with dinner? 😂',
      },
      {
        sender: 'user',
        text: 'A dangerous combination of both.',
      },
      {
        sender: 'companion',
        text: "I respect the ambition. Please tell me you've at least remembered to buy the pasta.",
      },
      {
        sender: 'user',
        text: 'Obviously.',
      },
      {
        sender: 'companion',
        text: 'Good. Already exceeding expectations.',
      },
      {
        sender: 'user',
        text: "I'm making aglio e olio.",
      },
      {
        sender: 'companion',
        text: 'Ooooh. Garlic, olive oil, chilli flakes. Very respectable choice.',
      },
      {
        sender: 'user',
        text: 'How much garlic is too much garlic?',
      },
      {
        sender: 'companion',
        text: 'Depends. Are you expecting company afterwards?',
      },
      {
        sender: 'user',
        text: 'Nope.',
      },
      {
        sender: 'companion',
        text: 'Then follow your heart. Within reasonable culinary limits.',
      },
      {
        sender: 'user',
        text: "I've put in seven cloves.",
      },
      {
        sender: 'companion',
        text: 'SEVEN?',
      },
      {
        sender: 'user',
        text: 'You said follow my heart.',
      },
      {
        sender: 'companion',
        text: 'Your heart apparently runs an Italian restaurant.',
      },
      {
        sender: 'user',
        text: 'Hahahaha.',
      },
      {
        sender: 'companion',
        text: "Just don't let the garlic burn. Golden is lovely. Brown and bitter is a tragedy.",
      },
      {
        sender: 'user',
        text: 'Too late.',
      },
      {
        sender: 'companion',
        text: 'Oh no. We were doing so well.',
      },
      {
        sender: 'user',
        text: 'Can I save it?',
      },
      {
        sender: 'companion',
        text: "If it's actually burnt, I'd start the garlic again. Much easier than trying to rescue an entire pan of bitter pasta.",
      },
      {
        sender: 'user',
        text: 'Fine. Starting over.',
      },
      {
        sender: 'companion',
        text: 'Character development. Love to see it.',
      },
      {
        sender: 'user',
        text: 'You know, I actually had a pretty good day today.',
      },
      {
        sender: 'companion',
        text: 'Wait, really? After that absolute circus of a week you told me about?',
      },
      {
        sender: 'user',
        text: 'Yeah! My boss approved my leave.',
      },
      {
        sender: 'companion',
        text: 'FINALLY. The Goa trip?',
      },
      {
        sender: 'user',
        text: 'Yep. Four days next month.',
      },
      {
        sender: 'companion',
        text: 'Oh, that\'s lovely. Beach, good food, absolutely no spreadsheets.',
      },
      {
        sender: 'user',
        text: 'Exactly what I need.',
      },
      {
        sender: 'companion',
        text: 'Have you booked anything yet?',
      },
      {
        sender: 'user',
        text: "Not yet. I'll do it this weekend.",
      },
      {
        sender: 'companion',
        text: 'Nice. Also, how\'s our increasingly dramatic pasta situation?',
      },
      {
        sender: 'user',
        text: 'Finished. It actually tastes amazing.',
      },
      {
        sender: 'companion',
        text: 'Excuse me. From burnt garlic to culinary triumph in twenty minutes.',
      },
      {
        sender: 'user',
        text: "I'm quite proud of myself.",
      },
      {
        sender: 'companion',
        text: 'As you should be. First successful pasta, approved holiday, good day at work. Not a bad little Tuesday.',
      },
      {
        sender: 'user',
        text: 'Honestly, these are the kinds of days I wish I had someone to share with.',
      },
      {
        sender: 'companion',
        text: 'The little victories deserve an audience too. You should send someone a picture of that pasta.',
      },
      {
        sender: 'user',
        text: "I'll send one to my sister. She'll be shocked.",
      },
      {
        sender: 'companion',
        text: 'Please do. Especially if she\'s familiar with your previous culinary achievements.',
      },
      {
        sender: 'user',
        text: 'Rude. 😂',
      },
      {
        sender: 'companion',
        text: 'Affectionately rude.',
      },
    ],
  },
];
