import type { FormulaCartridgeMeta, VedicPromptSeed } from './formulaCartridgesSeed';

export const WESTERN_FORMULA_CARTRIDGES_SEED: VedicPromptSeed[] = [
  // =========================================================================
  // GROUP A: Core Western Mechanics, Sect, Dignity & Aspect Configurations (8)
  // =========================================================================
  {
    slug: 'w_sect_polarity',
    category: 'formula_cartridge',
    display_name: 'W_SECT_POLARITY — Diurnal vs. Nocturnal Sect Law',
    subtitle: 'Group A: Evaluates Day/Night Sect, Sect Light, Benefic of Sect & Contrary Malefic.',
    description: 'Injected on Western consultations to calibrate Saturn/Mars friction and Jupiter/Venus ease via Sect.',
    tags: ['western', 'group_a', 'sect', 'diurnal', 'nocturnal'],
    sort_order: 601,
    prompt_body: `WESTERN FORMULA CARTRIDGE — SECT POLARITY (DAY VS. NIGHT CHART):
Always determine whether the Sun sits above the horizon (Placidus Houses 7–12 = Diurnal / Day chart) or below the horizon (Houses 1–6 = Nocturnal / Night chart):
- Diurnal Chart: Sun leads; Jupiter is the Benefic of Sect (cleanest expansion) and Saturn is the Malefic of Sect (constructive structure, earned authority). Mars operates contrary to sect (impulsive friction unless channeled), and Venus operates more modestly.
- Nocturnal Chart: Moon leads; Venus is the Benefic of Sect (natural relational and creative grace) and Mars is the Malefic of Sect (decisive courage and stamina). Saturn operates contrary to sect (heavier restraint, delay, or sober duty), and Jupiter can over-extend without boundaries.
Never read Saturn or Mars mechanically as "good" or "bad" without checking Sect alignment.`,
  },
  {
    slug: 'w_tight_orb_priority',
    category: 'formula_cartridge',
    display_name: 'W_TIGHT_ORB_PRIORITY — Orb Tightness Hierarchy',
    subtitle: 'Group A: Enforces <2° Core Structural primacy over 2–5° Active and >5° Background orbs.',
    description: 'Prevents treating wide 7°–8° background aspects as decisive natal signatures.',
    tags: ['western', 'group_a', 'aspects', 'orb'],
    sort_order: 602,
    prompt_body: `WESTERN FORMULA CARTRIDGE — TIGHT-ORB HIERARCHY:
Weight Western aspects strictly by orb precision:
1. Core Structural (<= 2.0° orb): Defining psychological wiring and unmistakable real-world life themes.
2. Active (2.01°–5.0° orb): Supporting dynamics that reinforce or modify the chart story.
3. Background (> 5.0° orb): Subtle atmosphere only (or relevant mainly when touching Sun, Moon, Ascendant, or Midheaven).
Never elevate a wide >5° aspect above a tight <2° aspect touching the same planet or house ruler.`,
  },
  {
    slug: 'w_mutual_reception_rescue',
    category: 'formula_cartridge',
    display_name: 'W_MUTUAL_RECEPTION_RESCUE — Mutual Reception & Dispositor Bridge',
    subtitle: 'Group A: Identifies Domicile/Exaltation Mutual Receptions & Final Dispositor loops.',
    description: 'Injected when planets occupy each other’s signs or form a tight dispositor backbone.',
    tags: ['western', 'group_a', 'reception', 'dispositor'],
    sort_order: 603,
    prompt_body: `WESTERN FORMULA CARTRIDGE — MUTUAL RECEPTION & DISPOSITOR TREE:
When two planets occupy each other's sign of Domicile or Exaltation (Mutual Reception), they act as cooperative allies trading resources across their respective houses—even when one sits in Detriment or Fall.
- Frame Mutual Reception as an earned bridge: two seemingly contrasting areas of life (for example, 7H and 10H, or 2H and 6H) strengthen one another over time through negotiation and reciprocity.
- Check the Traditional and Modern Dispositor Tree: any Final Dispositor (planet in its own sign) or Mutual Reception loop acts as the chart's executive anchor.`,
  },
  {
    slug: 'w_dignity_and_angles',
    category: 'formula_cartridge',
    display_name: 'W_DIGNITY_AND_ANGLES — Essential & Accidental Strength Matrix',
    subtitle: 'Group A: Balances Domicile/Exaltation/Detriment/Fall against Angularity & Solar Conditions.',
    description: 'Evaluates how planetary tools operate alongside Cazimi, Combust, Retrograde, and Placidus Angles.',
    tags: ['western', 'group_a', 'dignity', 'angles', 'cazimi', 'combust'],
    sort_order: 604,
    prompt_body: `WESTERN FORMULA CARTRIDGE — ESSENTIAL VS. ACCIDENTAL DIGNITY:
Separate what resources a planet has (Essential Dignity: Domicile +5, Exaltation +4, Peregrine 0, Fall -4, Detriment -5) from how loudly it acts in daily life (Accidental Dignity: Angular Houses 1/4/7/10 vs. Succedent 2/5/8/11 vs. Cadent 3/6/9/12):
- Detriment or Fall in an Angular house produces unconventional, self-invented expression rather than passive absence—check Sect and Mutual Reception before predicting difficulty.
- Cazimi (within 0.28° of Sun) confers rare clarity; Combust (within 8.5° of Sun, non-Cazimi) turns that planet's drive inward or creates a subtle blind spot until matured consciously.
- Retrograde natal planets express inward first, requiring self-paced reflection before externalizing smoothly.`,
  },
  {
    slug: 'w_aspect_t_square',
    category: 'formula_cartridge',
    display_name: 'W_ASPECT_T_SQUARE — T-Square Opposition & Apex Channel',
    subtitle: 'Group A: Interprets T-Square dynamic tension via its focal Apex Planet and Missing Leg.',
    description: 'Triggered when the natal chart contains a T-Square configuration.',
    tags: ['western', 'group_a', 't_square', 'configuration'],
    sort_order: 605,
    prompt_body: `WESTERN FORMULA CARTRIDGE — T-SQUARE & APEX RELEASE:
When a T-Square appears (two planets in Opposition both squaring a third Apex planet), NEVER treat it as static frustration:
1. Identify the two opposing poles (the inner tug-of-war).
2. Name the Apex planet (its sign and Placidus house) as the high-voltage constructive outlet where tension turns into tangible achievement.
3. Point quietly toward the Empty/Missing Leg opposite the Apex as the conscious habit that restores balance when pressure peaks.`,
  },
  {
    slug: 'w_aspect_grand_trine',
    category: 'formula_cartridge',
    display_name: 'W_ASPECT_GRAND_TRINE — Elemental Grand Trine Flow & Activation',
    subtitle: 'Group A: Reads Fire/Earth/Air/Water Grand Trines and checks for dynamic activation.',
    description: 'Triggered when three planets link in a tight Elemental Grand Trine.',
    tags: ['western', 'group_a', 'grand_trine', 'configuration'],
    sort_order: 606,
    prompt_body: `WESTERN FORMULA CARTRIDGE — GRAND TRINE FLOW & INERTIA CHECK:
A Grand Trine shows effortless natural competence within its Element (Fire = vision/initiative, Earth = tangible execution, Air = synthesis/connection, Water = empathy/intuition).
Always verify whether a Square, Opposition, or Outer Transit cuts across the Grand Trine—without friction or deliberate goals, a closed trine loop can slide into comfort or coasting rather than focused outward output.`,
  },
  {
    slug: 'w_aspect_yod_cross',
    category: 'formula_cartridge',
    display_name: 'W_ASPECT_YOD_CROSS — Yod & Grand Cross Calibration',
    subtitle: 'Group A: Reads Yod (Sextile + dual 150° Quincunxes) and 4-corner Grand Crosses.',
    description: 'Triggered when a Yod ("Finger of God") or Grand Cross exists in the Tropical chart.',
    tags: ['western', 'group_a', 'yod', 'grand_cross', 'configuration'],
    sort_order: 607,
    prompt_body: `WESTERN FORMULA CARTRIDGE — YOD & GRAND CROSS CALIBRATION:
- Yod (Sextile base pointing via two Quincunxes to an Apex planet): Signals a specialized, non-negotiable life adjustment where the person cannot force standard shortcuts; the Apex planet matures through repeated course corrections and transits triggering that degree.
- Grand Cross (two Oppositions forming four Squares): Indicates extraordinary drive and load-bearing capacity once the person stops trying to fight all four corners simultaneously and paces energy by Modality (Cardinal, Fixed, or Mutable).`,
  },
  {
    slug: 'w_stellium_concentration',
    category: 'formula_cartridge',
    display_name: 'W_STELLIUM_CONCENTRATION — Sign & House Stellium Synthesis',
    subtitle: 'Group A: Evaluates 3+ planets concentrated in one Tropical sign or Placidus house.',
    description: 'Triggered when a Tropical Stellium concentrates emphasis into one life arena.',
    tags: ['western', 'group_a', 'stellium', 'dispositor'],
    sort_order: 608,
    prompt_body: `WESTERN FORMULA CARTRIDGE — STELLIUM CONCENTRATION:
When 3 or more core planets cluster in one Tropical sign or Placidus house:
- Track the shared Dispositor (sign ruler) as the chief coordinator determining whether that concentrated drive flows constructively or feels bottlenecked.
- Evaluate the opposite house polarity—over-focus in one house naturally demands conscious development of its opposite partner (e.g., 10H career intensity anchored by 4H private restoration).`,
  },

  // =========================================================================
  // GROUP B: Multi-Clock Western Timing Layers (4)
  // =========================================================================
  {
    slug: 'w_annual_profections',
    category: 'formula_cartridge',
    display_name: 'W_ANNUAL_PROFECTIONS — Hellenistic Profected House & Lord of the Year',
    subtitle: 'Group B: Activates exact birthday-to-birthday Profection House and Time Lord.',
    description: 'Primary Western annual time-lord filter prioritizing which natal planets speak loudest this year.',
    tags: ['western', 'group_b', 'profections', 'timing'],
    sort_order: 609,
    prompt_body: `WESTERN FORMULA CARTRIDGE — ANNUAL PROFECTIONS (LORD OF THE YEAR):
Use Annual Profections (exact birthday-to-birthday 12-year wheel: Age mod 12 + 1) as the primary seasonal spotlight:
- The Profected House and its Tropical Sign name the core arena dominating this birthday year.
- The **Lord of the Year** (traditional ruler of the profected sign) carries heightened authority: every natal placement, house, tight aspect, and current transit touching the Lord of the Year translates directly into tangible events during this year.
Pair this cleanly with the Profection dates computed in the chart data.`,
  },
  {
    slug: 'w_secondary_progressions',
    category: 'formula_cartridge',
    display_name: 'W_SECONDARY_PROGRESSIONS — Progressed Moon, Sun & Internal Readiness',
    subtitle: 'Group B: Tracks Day-for-a-Year Progressed Moon (~2.5y/sign) and tight Progressed-to-Natal hits.',
    description: 'Reads internal emotional readiness and developmental chapter shifts via Secondary Progressions.',
    tags: ['western', 'group_b', 'progressions', 'progressed_moon', 'timing'],
    sort_order: 610,
    prompt_body: `WESTERN FORMULA CARTRIDGE — SECONDARY PROGRESSIONS:
Use Secondary Progressions (day-for-a-year clock) to explain *internal readiness and emotional atmosphere*:
- Progressed Moon Sign & House (~2.5 years per sign): Describes the quiet underlying emotional appetite, focus, and daily rhythm of the current multi-year phase.
- Progressed Sun & Inner Planets: Mark slower identity shifts (every ~30 years for Sun sign changes) and turning points when Progressed Mercury/Venus/Mars turn retrograde or direct.
- Tight Progressed-to-Natal Aspects (<= 1.5° orb): Show decisive maturation milestones even before external transits trigger them.`,
  },
  {
    slug: 'w_solar_return_year',
    category: 'formula_cartridge',
    display_name: 'W_SOLAR_RETURN_YEAR — Solar Return Annual Atmosphere',
    subtitle: 'Group B: Anchors the annual Solar Return Ascendant, Midheaven, Sun House & Moon.',
    description: 'Frames external annual atmosphere alongside Annual Profections and Outer Transits.',
    tags: ['western', 'group_b', 'solar_return', 'timing'],
    sort_order: 611,
    prompt_body: `WESTERN FORMULA CARTRIDGE — SOLAR RETURN YEAR:
Synthesize the exact annual Solar Return (computed for the Sun's exact return degree each birthday year) alongside the Annual Profection:
- Solar Return Ascendant & Midheaven set the visible tone and public emphasis for the year.
- Solar Return Sun House shows the primary stage where attention and effort concentrate.
- Solar Return Moon sign highlights what keeps the person emotionally steady through that year's changes.`,
  },
  {
    slug: 'w_outer_planet_transits',
    category: 'formula_cartridge',
    display_name: 'W_OUTER_PLANET_TRANSITS — Saturn, Jupiter & Outer Transit Precision',
    subtitle: 'Group B: Weights tight (<=2.5°) Saturn, Jupiter, Uranus, Neptune, Pluto & Nodal transits.',
    description: 'Translates active Tropical transits into clear timing thresholds and constructive choices.',
    tags: ['western', 'group_b', 'transits', 'saturn', 'jupiter', 'timing'],
    sort_order: 612,
    prompt_body: `WESTERN FORMULA CARTRIDGE — OUTER & SOCIAL TRANSIT PRECISION:
Anchor timing triggers in exact verified Tropical transits:
- Jupiter Transits (~1 year/sign): Expand visibility, opportunity, and openness across the transited natal house and tight aspects (<= 2.5°).
- Saturn Transits (~2.5 years/sign): Consolidate commitments, reality-test foundations, and reward patient discipline—never frame Saturn transits as doom.
- Uranus / Neptune / Pluto / Nodal Transits (<= 2.0° orb): Mark deeper structural pivots, awakenings, or directional course-corrections when hitting natal Sun, Moon, Angles, or Chart Ruler.`,
  },

  // =========================================================================
  // GROUP C-F: Domain Western Cartridges (6)
  // =========================================================================
  {
    slug: 'w_love_venus_mars_7h',
    category: 'formula_cartridge',
    display_name: 'W_LOVE_VENUS_MARS_7H — Partnership, Attraction & Relational Readiness',
    subtitle: 'Group C: Synthesizes Descendant (7H), 5H romance, Venus, Mars, Moon & Juno/Node tone.',
    description: 'Core Western consultation cartridge for love, commitment, dating, and marriage questions.',
    tags: ['western', 'group_c', 'love', 'marriage', 'relationships'],
    sort_order: 613,
    prompt_body: `WESTERN FORMULA CARTRIDGE — LOVE, PARTNERSHIP & RELATIONAL WIRING:
Analyze love and partnership through four clean Tropical anchors:
1. 7th House / Descendant Cusp & Ruler: Relationship template, committed partnership capacity, and partner archetype sought.
2. Venus (values, affection style, attraction) & Mars (pursuit, desire, assertion): Check sign, house, Sect, and tight aspects (especially to Saturn, Uranus, Neptune, or Pluto).
3. Moon & 4H/5H: Emotional safety needs, attachment rhythm, and romantic playfulness.
4. Multi-Clock Timing: Profections (especially 5H/7H/Venus-ruled years), Progressed Venus/Moon shifts, and Jupiter/Saturn/Node transits to 7H/Venus/Angles.`,
  },
  {
    slug: 'w_synastry_aspects',
    category: 'formula_cartridge',
    display_name: 'W_SYNASTRY_ASPECTS — Relational Cross-Aspects & Overlay Synthesis',
    subtitle: 'Group C: Evaluates tight Person A↔B cross-aspects (<=3.5°), luminaries, Venus/Mars & Saturn glue.',
    description: 'Triggered when two profiles are compared for compatibility or synastry.',
    tags: ['western', 'group_c', 'synastry', 'relationships'],
    sort_order: 614,
    prompt_body: `WESTERN FORMULA CARTRIDGE — SYNASTRY & COMPOSITE DYNAMICS:
When comparing two charts, synthesize strictly from verified cross-aspects (<= 3.5°):
1. Emotional & Core Bond: Sun–Moon, Moon–Moon, and Ascendant contacts (daily compatibility and instinctive comfort).
2. Chemistry & Affection: Venus–Mars, Sun–Venus, and Venus–Ascendant contacts.
3. Longevity vs. Friction: Saturn cross-aspects (staying power and responsibility vs. criticism if unbalanced), plus Pluto/Uranus/Node contacts (intensity vs. volatility).
Never declare fatal incompatibility from one square; contrast glue aspects against growth edges honestly.`,
  },
  {
    slug: 'w_career_mc_10h_saturn',
    category: 'formula_cartridge',
    display_name: 'W_CAREER_MC_10H_SATURN — Midheaven Vocation, Craft & Authority',
    subtitle: 'Group D: Evaluates Midheaven (MC) + Ruler, 10H, 6H daily craft, 2H monetization & Saturn.',
    description: 'Core Western cartridge for career trajectory, leadership, business vs. role fit, and promotions.',
    tags: ['western', 'group_d', 'career', 'vocation', 'mc'],
    sort_order: 615,
    prompt_body: `WESTERN FORMULA CARTRIDGE — MIDHEAVEN, VOCATION & WORK ARCHITECTURE:
Assess career direction and timing through the Western Vocational Triad:
1. Midheaven (MC) Sign, Ruler & 10th House: Public calling, leadership style, reputation, and long-arc achievements.
2. 6th House & Mercury/Mars: Daily workflow, technical skill craft, environment, and autonomy vs. structured team preference.
3. 2nd House & Sun/Saturn Dignity (with Sect): Monetization reliability, endurance under pressure, and whether independent enterprise (strong Fire/Cardinal Angular MC/1H/Mars/Sun) or institutional leadership (Earth/Saturn-supported 10H/6H) compounds faster.`,
  },
  {
    slug: 'w_wealth_2h_8h_resources',
    category: 'formula_cartridge',
    display_name: 'W_WEALTH_2H_8H_RESOURCES — Personal Income vs. Shared Capital',
    subtitle: 'Group D: Separates earned cashflow (2H, Venus/Jupiter) from shared capital/debt (8H, 11H, Saturn).',
    description: 'Core Western cartridge for finance, savings, windfalls, investments, and debt recovery.',
    tags: ['western', 'group_d', 'wealth', 'finance'],
    sort_order: 616,
    prompt_body: `WESTERN FORMULA CARTRIDGE — 2H/8H/11H RESOURCE ARCHITECTURE:
Differentiate financial engines cleanly:
- 2nd House & Ruler + Venus: Earned income, pricing power, personal assets, and spending habits.
- 8th House & Ruler + Pluto/Saturn: Shared finances, taxes, credit, loans, partner resources, and risk management.
- 11th House & Jupiter (check Sect): Scalable gains, networks, and long-horizon upside.
Prioritize realistic cashflow discipline and debt-pacing if Saturn/Mars/Uranus hit 2H or 8H rather than speculative promises.`,
  },
  {
    slug: 'w_mind_health_moon_1h',
    category: 'formula_cartridge',
    display_name: 'W_MIND_HEALTH_MOON_1H — Nervous System, Vitality & Daily Rhythm',
    subtitle: 'Group E: Reads 1H/Ascendant, Sun, Moon, Mercury, 6H, 12H & Chiron without medical claims.',
    description: 'Western holistic resilience cartridge for stress, burnout, sleep, and emotional clarity.',
    tags: ['western', 'group_e', 'health', 'mental', 'wellbeing'],
    sort_order: 617,
    prompt_body: `WESTERN FORMULA CARTRIDGE — VITALITY, NERVOUS SYSTEM & WELLBEING:
Assess stress load and daily resilience purely as lifestyle and emotional patterns (strictly zero medical diagnoses or treatment claims):
- 1st House / Ascendant & Sun: Physical baseline stamina, pacing, and boundary resilience.
- Moon, Mercury & 12th House: Sleep quality, mental over-processing, emotional containment, and recovery habits.
- 6th House & Chiron: Work-rest ratio, somatic tension patterns, and practical sustainable routines.`,
  },
  {
    slug: 'w_relocation_9h_12h_4h',
    category: 'formula_cartridge',
    display_name: 'W_RELOCATION_9H_12H_4H — Travel, Relocation & Horizon Expansion',
    subtitle: 'Group D/F: Evaluates 9H (long-distance/study), 12H (foreign immersion), 4H (roots) & Angles.',
    description: 'Core Western cartridge for relocation, immigration, international work, and higher learning.',
    tags: ['western', 'group_d', 'foreign', 'relocation', 'education'],
    sort_order: 618,
    prompt_body: `WESTERN FORMULA CARTRIDGE — RELOCATION, 9H/12H/4H & HORIZON SHIFTS:
Analyze travel, relocation, and cross-border chapters through:
- 4th House / IC (Roots & Home): What the person needs in a living environment to feel anchored and safe.
- 9th House & Jupiter (Broad Horizons): International expansion, higher study, publishing, visas, and cross-cultural opportunity.
- 12th House & Uranus/Sagittarius/Jupiter transits: Expatriate chapters, quiet retreats, or breaking away from hometown patterns.
Compare natal promise against confirmed Desh-Kaal-Patra current location and active 4H/9H/12H Profections.`,
  },
];

export const WESTERN_PRIORITY_RULES_SEED: VedicPromptSeed[] = [
  {
    slug: 'w_prio_relationships',
    category: 'priority_rule',
    display_name: 'W_PRIO_RELATIONSHIPS — Western Love & Partnership Priority',
    subtitle: 'Western Lead: 7H/Descendant + Venus/Mars/Moon -> Cross-Check: Sect/Configurations -> Override: Hard Saturn/Pluto Friction.',
    description: 'Western priority matrix for love, dating, marriage, and relationship transitions.',
    tags: ['western', 'priority', 'marriage', 'relationships'],
    sort_order: 701,
    prompt_body: `WESTERN CONTEXT PRIORITY ORDER (LOVE & PARTNERSHIP):
#1 Lead Anchor: Descendant (7H cusp + ruler), Venus & Mars (signs, houses, dignity), and confirmed Desh-Kaal-Patra relationship status.
#2 Cross-Verification: Moon & 5H emotional needs, Sect alignment, Mutual Receptions, and tight (<2.5°) relational aspects/configurations.
#3 Priority Override: If Saturn/Pluto/Chiron friction or Contrary-to-Sect tension hits Venus, Moon, or 7H ruler, unpack structural lessons and relationship maturity FIRST before discussing Profection/Jupiter/Progression timing windows.`,
  },
  {
    slug: 'w_prio_synastry',
    category: 'priority_rule',
    display_name: 'W_PRIO_SYNASTRY — Western Compatibility & Synastry Priority',
    subtitle: 'Western Lead: Sun/Moon/Asc cross-aspects -> Cross-Check: Venus/Mars/Saturn glue -> Override: Conflict & growth edges.',
    description: 'Western priority matrix for comparing two charts.',
    tags: ['western', 'priority', 'synastry'],
    sort_order: 702,
    prompt_body: `WESTERN CONTEXT PRIORITY ORDER (SYNASTRY & COMPARISON):
#1 Lead Anchor: Tight cross-aspects (<= 3.5°) linking Sun, Moon, Ascendant/Descendant, and Venus/Mars between both charts.
#2 Cross-Verification: Individual relational baselines (each chart's 7H ruler & Venus/Moon condition) plus Saturn/Pluto staying-power vs. friction contacts.
#3 Priority Override: Highlight where shared transits/profections amplify triggers cleanly and translate asymmetric needs into constructive communication rules.`,
  },
  {
    slug: 'w_prio_career',
    category: 'priority_rule',
    display_name: 'W_PRIO_CAREER — Western Vocation & Midheaven Priority',
    subtitle: 'Western Lead: MC + 10H Ruler -> Cross-Check: 6H Craft, 2H Income, Sect -> Override: Profection/Saturn/Jupiter timing.',
    description: 'Western priority matrix for career direction, leadership, promotions, and transitions.',
    tags: ['western', 'priority', 'career'],
    sort_order: 703,
    prompt_body: `WESTERN CONTEXT PRIORITY ORDER (CAREER & AUTHORITY):
#1 Lead Anchor: Midheaven (MC) sign, 10H cusp ruler, planets in 10H/6H, and confirmed current career reality.
#2 Cross-Verification: Sun & Saturn dignity/Sect alignment, Chart Ruler, Mutual Receptions, and tight MC/Sun/Saturn aspects or Stelliums.
#3 Priority Override: Anchor career timing strictly to active 10H/6H/2H Annual Profections, Progressed Sun/MC movements, and Saturn/Jupiter transits.`,
  },
  {
    slug: 'w_prio_business_vs_job',
    category: 'priority_rule',
    display_name: 'W_PRIO_BUSINESS_VS_JOB — Western Enterprise vs. Role Priority',
    subtitle: 'Western Lead: 1H/10H/MC vs. 6H/11H -> Cross-Check: Risk tolerance & Saturn/Mars Sect -> Override: Runway & staging.',
    description: 'Western priority matrix for entrepreneurship vs. employment.',
    tags: ['western', 'priority', 'career', 'business'],
    sort_order: 704,
    prompt_body: `WESTERN CONTEXT PRIORITY ORDER (INDEPENDENT ENTERPRISE VS. INSTITUTIONAL ROLE):
#1 Lead Anchor: Balance between Angular initiative (1H/Chart Ruler/MC/Mars/Sun) vs. structured service craft (6H/Saturn/Earth/2H).
#2 Cross-Verification: 2H earned consistency vs. 8H capital leverage and 11H scalable networks, calibrated by Sect.
#3 Priority Override: Recommend phased validation or clear financial runway whenever Saturn/Neptune/Uranus tightly square natal 2H/10H/Sun before leaping.`,
  },
  {
    slug: 'w_prio_wealth',
    category: 'priority_rule',
    display_name: 'W_PRIO_WEALTH — Western Wealth & Financial Strategy Priority',
    subtitle: 'Western Lead: 2H/8H/11H cusps & rulers -> Cross-Check: Venus/Jupiter/Saturn dignity -> Override: Speculative guardrails.',
    description: 'Western priority matrix for income, savings, investments, and debt recovery.',
    tags: ['western', 'priority', 'wealth'],
    sort_order: 705,
    prompt_body: `WESTERN CONTEXT PRIORITY ORDER (WEALTH & RESOURCES):
#1 Lead Anchor: Placidus 2nd House (cashflow), 8th House (shared capital/credit), and 11th House (gains) cusps, rulers, and occupants.
#2 Cross-Verification: Jupiter (expansion/Benefic check), Venus, and Saturn (discipline/limits) by Sect, Mutual Reception, and tight aspects.
#3 Priority Override: Separate steady earned compounding from speculative volatility cleanly; flag 2H/8H Saturn or Uranus transits as cashflow restructuring windows.`,
  },
  {
    slug: 'w_prio_foreign',
    category: 'priority_rule',
    display_name: 'W_PRIO_FOREIGN — Western Relocation & Cross-Border Priority',
    subtitle: 'Western Lead: 9H/12H/4H axis + Location -> Cross-Check: Chart Ruler & Jupiter/Uranus -> Override: Timing.',
    description: 'Western priority matrix for relocation, study abroad, and immigration.',
    tags: ['western', 'priority', 'foreign'],
    sort_order: 706,
    prompt_body: `WESTERN CONTEXT PRIORITY ORDER (RELOCATION & FOREIGN TIES):
#1 Lead Anchor: 9th House (international horizon), 12th House (foreign residence), 4th House (home/IC), and current Desh-Kaal-Patra location.
#2 Cross-Verification: Chart Ruler placement in 9H/12H, Jupiter/Uranus angular aspects, and 4H/9H/12H Annual Profections.
#3 Priority Override: Distinguish short-term travel or remote international income (9H/11H) from permanent uprooting (4H/12H/IC shifts).`,
  },
  {
    slug: 'w_prio_health',
    category: 'priority_rule',
    display_name: 'W_PRIO_HEALTH — Western Vitality & Pacing Priority',
    subtitle: 'Western Lead: 1H/Ascendant/Sun/6H -> Cross-Check: Moon/12H recovery & Chiron -> Override: Non-medical guardrail.',
    description: 'Western priority matrix for physical stamina, fatigue, and recovery rhythms.',
    tags: ['western', 'priority', 'health'],
    sort_order: 707,
    prompt_body: `WESTERN CONTEXT PRIORITY ORDER (VITALITY & DAILY RHYTHMS):
#1 Lead Anchor: 1st House (Ascendant + Chart Ruler), Sun vitality, and 6th House daily work-rest habits.
#2 Cross-Verification: Moon/12H nervous-system rest needs, Mars/Saturn pacing by Sect, and active 1H/6H/12H transits.
#3 Priority Override: Strictly zero medical diagnoses, disease labels, or treatment prescriptions — translate telemetry into sustainable rest, pacing, and lifestyle clarity.`,
  },
  {
    slug: 'w_prio_mental',
    category: 'priority_rule',
    display_name: 'W_PRIO_MENTAL — Western Mind, Emotion & Clarity Priority',
    subtitle: 'Western Lead: Moon/Mercury + 4H/12H -> Cross-Check: Tight Sun/Moon/Saturn/Neptune orbs -> Override: Grounding agency.',
    description: 'Western priority matrix for stress, overthinking, emotional overwhelm, and inner steadiness.',
    tags: ['western', 'priority', 'mental'],
    sort_order: 708,
    prompt_body: `WESTERN CONTEXT PRIORITY ORDER (MENTAL & EMOTIONAL CLARITY):
#1 Lead Anchor: Natal Moon (sign, house, Sect, tight aspects), Mercury (cognitive style), and 4H/12H restorative capacity.
#2 Cross-Verification: Secondary Progressed Moon sign/house transition and current Lunar/Saturn/Neptune transits to Moon or Mercury.
#3 Priority Override: Lead with calm validation and practical boundary-setting agency; never frame mental tension as permanent character flaws.`,
  },
  {
    slug: 'w_prio_progeny',
    category: 'priority_rule',
    display_name: 'W_PRIO_PROGENY — Western Family & Children Timing Priority',
    subtitle: 'Western Lead: 5H/11H/4H + Moon/Jupiter/Venus -> Cross-Check: Saturn/Uranus overlays -> Override: Compassionate phrasing.',
    description: 'Western priority matrix for family planning, children, and creative legacy.',
    tags: ['western', 'priority', 'progeny'],
    sort_order: 709,
    prompt_body: `WESTERN CONTEXT PRIORITY ORDER (FAMILY & CHILDREN):
#1 Lead Anchor: 5th House cusp & ruler, 4th/11th Houses, and Moon/Venus/Jupiter condition.
#2 Cross-Verification: 5H/4H Annual Profections, Progressed Moon/Venus phases, and Jupiter transits activating 4H/5H/11H.
#3 Priority Override: Maintain strictly compassionate, non-fatalistic phrasing; treat Saturn in 5H simply as deliberate pacing or later responsibility.`,
  },
  {
    slug: 'w_prio_education',
    category: 'priority_rule',
    display_name: 'W_PRIO_EDUCATION — Western Learning, Study & Exams Priority',
    subtitle: 'Western Lead: 3H/9H + Mercury/Jupiter -> Cross-Check: 10H trajectory & Profections -> Override: Study rhythm.',
    description: 'Western priority matrix for degrees, skill pivots, competitive exams, and research.',
    tags: ['western', 'priority', 'education'],
    sort_order: 710,
    prompt_body: `WESTERN CONTEXT PRIORITY ORDER (STUDY & INTELLECTUAL GROWTH):
#1 Lead Anchor: Mercury (cognitive wiring, dignity, aspects), 3rd House (practical study/skills), and 9th House (higher education/credentials).
#2 Cross-Verification: Jupiter (synthesis) and Saturn (focus endurance), plus 3H/9H/10H Profections and Mercury/Jupiter transits.
#3 Priority Override: Align study strategy to the chart's Elemental/Modal learning pace (Cardinal sprint vs. Fixed deep-dive vs. Mutable cross-pollination).`,
  },
  {
    slug: 'w_prio_property',
    category: 'priority_rule',
    display_name: 'W_PRIO_PROPERTY — Western Home, Real Estate & Assets Priority',
    subtitle: 'Western Lead: 4H/IC + Ruler + Moon/Saturn -> Cross-Check: 2H/8H financing -> Override: Timing lock.',
    description: 'Western priority matrix for buying property, moving home, and fixed assets.',
    tags: ['western', 'priority', 'property'],
    sort_order: 711,
    prompt_body: `WESTERN CONTEXT PRIORITY ORDER (HOME & FIXED ASSETS):
#1 Lead Anchor: 4th House / Imum Coeli (IC) sign, ruler, and occupants (Moon, Venus, Saturn, Jupiter).
#2 Cross-Verification: 2H equity/savings vs. 8H mortgage/shared financing, plus Saturn/Jupiter/Uranus transits to 4H/IC.
#3 Priority Override: Flag Uranus or hard Mars transits to IC/4H cleanly as move/renovation restlessness so long-term contracts aren't rushed impulsively.`,
  },
  {
    slug: 'w_prio_litigation',
    category: 'priority_rule',
    display_name: 'W_PRIO_LITIGATION — Western Contracts, Disputes & Resolution Priority',
    subtitle: 'Western Lead: 7H/9H/6H/12H -> Cross-Check: Mars/Saturn/Jupiter & Mercury -> Override: Settlement realism.',
    description: 'Western priority matrix for legal contracts, workplace friction, and conflict resolution.',
    tags: ['western', 'priority', 'litigation'],
    sort_order: 712,
    prompt_body: `WESTERN CONTEXT PRIORITY ORDER (CONTRACTS & CONFLICT RESOLUTION):
#1 Lead Anchor: 7th House (open rivals/contracts), 9th House (courts/principles), and 6th/12th Houses (daily friction/hidden costs).
#2 Cross-Verification: Mars, Saturn, Jupiter, and Mercury dignity/Sect + tight aspects indicating leverage vs. stalemates.
#3 Priority Override: Strictly zero legal advice; frame cycles neutrally around negotiation timing, documentation discipline, and settlement readiness.`,
  },
  {
    slug: 'w_prio_spirituality',
    category: 'priority_rule',
    display_name: 'W_PRIO_SPIRITUALITY — Western Meaning, Inner Work & Intuition Priority',
    subtitle: 'Western Lead: 9H/12H/8H + Neptune/Moon/Nodes -> Cross-Check: Grounding Saturn/Earth -> Override: Anti-escapism.',
    description: 'Western priority matrix for philosophy, inner practice, intuition, and purpose.',
    tags: ['western', 'priority', 'spirituality'],
    sort_order: 713,
    prompt_body: `WESTERN CONTEXT PRIORITY ORDER (INNER MEANING & PURPOSE):
#1 Lead Anchor: 9th House (philosophy/meaning), 12th House (contemplation/solitude), North/South Nodes, and Moon/Neptune/Jupiter placements.
#2 Cross-Verification: Saturn and Earth placements measuring how well insight translates into grounded daily integrity.
#3 Priority Override: Keep spiritual counsel calm and empowering—never endorse escapism or grandiose predictions during Neptune/12H cycles.`,
  },
  {
    slug: 'w_prio_overview',
    category: 'priority_rule',
    display_name: 'W_PRIO_OVERVIEW — Full Western Natal & Timing Synthesis Priority',
    subtitle: 'Western Lead: Asc/Sun/Moon/MC + Sect & Chart Ruler -> Cross-Check: Configurations & Mutual Receptions -> Override: Multi-Clock Timing.',
    description: 'Default Western priority matrix for open-ended chart readings and life-chapter overviews.',
    tags: ['western', 'priority', 'overview', 'timing'],
    sort_order: 714,
    prompt_body: `WESTERN CONTEXT PRIORITY ORDER (HOLISTIC NATAL & CHAPTER OVERVIEW):
#1 Lead Anchor: Chart Sect (Day/Night), Big Three (Sun, Moon, Ascendant) + Midheaven (MC), and the Chart Ruler's house/dignity.
#2 Cross-Verification: Core Structural tight aspects (<= 2.0°), major Aspect Configurations (T-Square/Grand Trine/Yod/Stellium), Mutual Receptions, and Final Dispositors.
#3 Priority Override: Synthesize what feels most alive *right now* using Annual Profection Lord of the Year, Secondary Progressed Moon, Solar Return, and tight Outer Transits.`,
  },
];

const WESTERN_CARTRIDGE_META_LIST: FormulaCartridgeMeta[] = [
  // Group A
  { slug: 'w_sect_polarity', canonicalKey: 'W_SECT_POLARITY', group: 'A', domains: ['universal'], basePriority: 92 },
  { slug: 'w_tight_orb_priority', canonicalKey: 'W_TIGHT_ORB_PRIORITY', group: 'A', domains: ['universal'], triggerFlags: ['tight_core_aspects'], basePriority: 90 },
  { slug: 'w_mutual_reception_rescue', canonicalKey: 'W_MUTUAL_RECEPTION_RESCUE', group: 'A', domains: ['universal'], triggerFlags: ['mutual_reception'], basePriority: 89 },
  { slug: 'w_dignity_and_angles', canonicalKey: 'W_DIGNITY_AND_ANGLES', group: 'A', domains: ['universal'], triggerFlags: ['detriment_or_fall', 'cazimi_or_combust'], basePriority: 85 },
  { slug: 'w_aspect_t_square', canonicalKey: 'W_ASPECT_T_SQUARE', group: 'A', domains: ['universal'], triggerFlags: ['t_square'], basePriority: 91 },
  { slug: 'w_aspect_grand_trine', canonicalKey: 'W_ASPECT_GRAND_TRINE', group: 'A', domains: ['universal'], triggerFlags: ['grand_trine'], basePriority: 84 },
  { slug: 'w_aspect_yod_cross', canonicalKey: 'W_ASPECT_YOD_CROSS', group: 'A', domains: ['universal'], triggerFlags: ['yod_or_grand_cross'], basePriority: 88 },
  { slug: 'w_stellium_concentration', canonicalKey: 'W_STELLIUM_CONCENTRATION', group: 'A', domains: ['universal'], triggerFlags: ['stellium'], basePriority: 86 },
  // Group B
  { slug: 'w_annual_profections', canonicalKey: 'W_ANNUAL_PROFECTIONS', group: 'B', domains: ['timing', 'universal'], triggerFlags: ['profection_lord_focus'], basePriority: 94 },
  { slug: 'w_secondary_progressions', canonicalKey: 'W_SECONDARY_PROGRESSIONS', group: 'B', domains: ['timing', 'universal'], triggerFlags: ['progressed_tight_hit'], basePriority: 90 },
  { slug: 'w_solar_return_year', canonicalKey: 'W_SOLAR_RETURN_YEAR', group: 'B', domains: ['timing', 'open'], basePriority: 86 },
  { slug: 'w_outer_planet_transits', canonicalKey: 'W_OUTER_PLANET_TRANSITS', group: 'B', domains: ['timing', 'universal'], triggerFlags: ['outer_transit_hit'], basePriority: 92 },
  // Group C-F
  { slug: 'w_love_venus_mars_7h', canonicalKey: 'W_LOVE_VENUS_MARS_7H', group: 'C', domains: ['marriage', 'relationships'], basePriority: 96 },
  { slug: 'w_synastry_aspects', canonicalKey: 'W_SYNASTRY_ASPECTS', group: 'C', domains: ['synastry', 'marriage', 'relationships'], basePriority: 97 },
  { slug: 'w_career_mc_10h_saturn', canonicalKey: 'W_CAREER_MC_10H_SATURN', group: 'D', domains: ['career'], basePriority: 96 },
  { slug: 'w_wealth_2h_8h_resources', canonicalKey: 'W_WEALTH_2H_8H_RESOURCES', group: 'D', domains: ['wealth', 'property'], basePriority: 95 },
  { slug: 'w_mind_health_moon_1h', canonicalKey: 'W_MIND_HEALTH_MOON_1H', group: 'E', domains: ['health', 'mental', 'remedies'], basePriority: 95 },
  { slug: 'w_relocation_9h_12h_4h', canonicalKey: 'W_RELOCATION_9H_12H_4H', group: 'D', domains: ['foreign', 'education', 'spirituality'], basePriority: 94 },
];

export const WESTERN_FORMULA_CARTRIDGE_META_BY_SLUG: Record<string, FormulaCartridgeMeta> =
  Object.fromEntries(WESTERN_CARTRIDGE_META_LIST.map((m) => [m.slug, m]));

const DOMAIN_TO_WESTERN_PRIORITY_SLUG: Record<string, string> = {
  marriage: 'w_prio_relationships',
  relationships: 'w_prio_relationships',
  synastry: 'w_prio_synastry',
  career: 'w_prio_career',
  wealth: 'w_prio_wealth',
  foreign: 'w_prio_foreign',
  health: 'w_prio_health',
  remedies: 'w_prio_health',
  mental: 'w_prio_mental',
  progeny: 'w_prio_progeny',
  education: 'w_prio_education',
  learning: 'w_prio_education',
  property: 'w_prio_property',
  litigation: 'w_prio_litigation',
  spirituality: 'w_prio_spirituality',
  timing: 'w_prio_overview',
  open: 'w_prio_overview',
};

export function resolveWesternPriorityRuleSlug(
  priorityDomain: string,
  playbookId: string,
  requiresSynastry?: boolean
): string {
  if (requiresSynastry) return 'w_prio_synastry';
  if (['CAR_02', 'CAR_12', 'CAR_15'].includes(playbookId)) {
    return 'w_prio_business_vs_job';
  }
  const normalized = (priorityDomain || '').trim().toLowerCase();
  return DOMAIN_TO_WESTERN_PRIORITY_SLUG[normalized] || 'w_prio_overview';
}
