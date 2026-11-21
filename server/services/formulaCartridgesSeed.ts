export type SeedPromptCategory = 'formula_cartridge' | 'priority_rule';

export interface SutradharaPromptSeed {
  slug: string;
  category: SeedPromptCategory;
  display_name: string;
  subtitle: string;
  description: string;
  tags: string[];
  sort_order: number;
  prompt_body: string;
}

export interface FormulaCartridgeMeta {
  slug: string;
  canonicalKey: string;
  group: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  domains: string[];
  triggerFlags?: string[];
  basePriority: number;
}

export const FORMULA_CARTRIDGES_SEED: SutradharaPromptSeed[] = [
  // =========================================================================
  // GROUP A: Conflict, Cancellation & Modifying Principles (12)
  // =========================================================================
  {
    slug: 'f_neecha_bhanga',
    category: 'formula_cartridge',
    display_name: 'F_NEECHA_BHANGA — Debilitation & Cancellation Law',
    subtitle: 'Group A: Distinguishes uncancelled weakness from earned Neecha Bhanga mastery.',
    description: 'Injected when a focal planet is debilitated or carries Neecha Bhanga Raja Yoga.',
    tags: ['sutra', 'group_a', 'cancellation', 'dignity'],
    sort_order: 501,
    prompt_body: `FORMULA CARTRIDGE — NEECHA BHANGA (CANCELLED DEBILITATION):
When a planet is debilitated in D1 with verified cancellation (lord of debilitation sign or exaltation lord in Kendra from Lagna/Moon, sign exchange, or strong D9 uplift), NEVER label it flatly broken or deny the house promise.
Interpret Neecha Bhanga strictly as an earned arc: early insecurity, trial-and-error, or self-doubt in youth that matures into uncommon technical depth, resilience, and specialized authority once the planet's Dasha or age maturity arrives.
If NO cancellation exists and D9 also remains weak, treat delivery as compromised or requiring disciplined external scaffolding rather than effortless luck.`,
  },
  {
    slug: 'f_d1_d9_inversion',
    category: 'formula_cartridge',
    display_name: 'F_D1_D9_INVERSION — Rashi vs. Navamsa Quality Split',
    subtitle: 'Group A: Separates outward early promise (D1) from lasting substance (D9).',
    description: 'Injected when D1 strength and D9 Navamsa strength diverge sharply.',
    tags: ['sutra', 'group_a', 'd9', 'navamsa'],
    sort_order: 502,
    prompt_body: `FORMULA CARTRIDGE — D1 vs. D9 INVERSION:
Always compare D1 surface promise against D9 (Navamsa) inner maturity and endurance:
- D1 Strong + D9 Weak: Visible early opportunity, title, or strong outward projection that feels hollow inside, erodes after the honeymoon phase, or struggles to retain gains unless consciously stabilized.
- D1 Weak + D9 Strong: Slow start, early self-doubt, or delayed traction that compounds quietly into durable second-half strength and lasting satisfaction.
Never invent divisional degrees for D9; read D9 strictly by sign, house, dignity, and Vargottama status.`,
  },
  {
    slug: 'f_karako_bhava_nashaya',
    category: 'formula_cartridge',
    display_name: 'F_KARAKO_BHAVA_NASHAYA — Karaka in Own Bhava Audit',
    subtitle: 'Group A: Tests Jupiter in 5H, Venus in 7H, Sun in 9H, Saturn in 8H, Mars in 3H.',
    description: 'Evaluates over-identification vs. own/exalted/benefic rescue when a Karaka sits in its own house.',
    tags: ['sutra', 'group_a', 'karaka', 'cancellation'],
    sort_order: 503,
    prompt_body: `FORMULA CARTRIDGE — KARAKO BHAVA NASHAYA AUDIT:
When a natural Karaka sits directly in its signified house (Jupiter in 5H, Venus in 7H, Sun in 9H, Saturn in 8H, Mars in 3H), check rescue factors before judging friction:
1. Own-sign, exaltation, or strong benefic aspect (especially Jupiter/Moon) converts friction into elevated standards and intentional care.
2. Unmitigated placement creates over-identification, perfectionism, delay, or hyper-sensitivity around that house's affairs rather than literal destruction.
Explain the exact psychological and practical tension clearly without fear-mongering.`,
  },
  {
    slug: 'f_bhavat_bhavam',
    category: 'formula_cartridge',
    display_name: 'F_BHAVAT_BHAVAM — House-from-House Amplification',
    subtitle: 'Group A: Cross-checks secondary mirrors (7H=10th-from-10th, 3H=2nd-from-2nd, 9H=5th-from-5th).',
    description: 'Adds Bhavat Bhavam secondary confirmation across career, wealth, marriage, and progeny.',
    tags: ['sutra', 'group_a', 'bhavat_bhavam'],
    sort_order: 504,
    prompt_body: `FORMULA CARTRIDGE — BHAVAT BHAVAM (HOUSE-FROM-HOUSE MIRROR):
Cross-verify primary houses through their secondary mirror houses:
- Career scale & public partnerships: 7H (10th from 10H).
- Sustaining earned savings & skills: 3H (2nd from 2H).
- Progeny continuity & creative luck: 9H (5th from 5H).
- Post-marriage gains & social expansion: 11H (5th from 7H).
- Mental steadiness & deeper domestic security: 7H/10H echoes from 4H.
Use the mirror house to refine HOW an outcome sustains itself rather than repeating D1 textbook lines.`,
  },
  {
    slug: 'f_nakshatra_override',
    category: 'formula_cartridge',
    display_name: 'F_NAKSHATRA_OVERRIDE — Sign Lord vs. Nakshatra Lord',
    subtitle: 'Group A: Nakshatra dispositor dictates lived texture and delivery mechanism.',
    description: 'Injected when a focal planet sits in a 6/8/12 Nakshatra lord or Gandanta zone.',
    tags: ['sutra', 'group_a', 'nakshatra', 'override'],
    sort_order: 505,
    prompt_body: `FORMULA CARTRIDGE — NAKSHATRA OVERRIDE LAW:
Sign placement shows the stage and style, while the Nakshatra lord acts as the hidden engine delivering the real-world event texture.
If a well-placed planet sits in the Nakshatra of a 6th, 8th, or 12th lord (or in Gandanta), qualify the outcome: progress arrives through pivots, problem-solving, behind-the-scenes restructuring, or non-linear steps rather than a straight road.
Conversely, if a stressed planet sits in an auspicious Kendra/Trikona Nakshatra lord, note how skilled guidance or steady effort unlocks cleaner results.`,
  },
  {
    slug: 'f_nodal_proxy',
    category: 'formula_cartridge',
    display_name: 'F_NODAL_PROXY — Rahu/Ketu Dispositor & Conjunction Proxy',
    subtitle: 'Group A: Evaluates Rahu/Ketu via dispositor health, conjunct planets, and Nakshatra lord.',
    description: 'Injected when Rahu or Ketu occupies sliced houses or leads active Dasha.',
    tags: ['sutra', 'group_a', 'rahu', 'ketu', 'nodes'],
    sort_order: 506,
    prompt_body: `FORMULA CARTRIDGE — NODAL PROXY (RAHU & KETU):
Rahu and Ketu have no independent sign lordship; judge their results strictly in this 4-step proxy order:
1. Sign Dispositor's PHI health, house placement, and D9 shift (weak dispositor = erratic obsession or instability; strong dispositor = strategic breakthrough).
2. Tightly conjunct planets (within 5-8 degrees) whose agenda the node amplifies or detaches.
3. Aspects received (Jupiter stabilizes; Mars/Saturn intensifies pressure).
4. Nakshatra lord.
Frame Rahu as uncharted appetite/innovation and Ketu as past mastery/detachment rather than superstition.`,
  },
  {
    slug: 'f_maraka_and_dusthana_flip',
    category: 'formula_cartridge',
    display_name: 'F_MARAKA_AND_DUSTHANA_FLIP — Functional Lordship & Vipareeta',
    subtitle: 'Group A: Lagna-specific functional roles override generic natural benefic/malefic labels.',
    description: 'Applies functional lordship and Vipareeta Raja Yoga reversal mechanics.',
    tags: ['sutra', 'group_a', 'functional_lordship', 'vipareeta'],
    sort_order: 507,
    prompt_body: `FORMULA CARTRIDGE — FUNCTIONAL LORDSHIP & DUSTHANA FLIP:
Always prioritize Lagna-specific functional lordship over generic natural labels (for instance, Jupiter acts as functional challenging lord for Taurus/Libra, while Saturn acts as Yogakaraka for Taurus/Libra).
When a 6th, 8th, or 12th lord sits in 6H/8H/12H (Vipareeta Raja Yoga), check if Lagnesh is strong enough to capitalize: strong Lagnesh turns crisis, rivals, or upheaval into unexpected advantage after an initial shakeup; weak Lagnesh experiences the friction first before stabilizing.`,
  },
  {
    slug: 'f_chalit_cusp_shift',
    category: 'formula_cartridge',
    display_name: 'F_CHALIT_CUSP_SHIFT — Rashi Sign vs. Bhava Chalit House',
    subtitle: 'Group A: Separates planetary psychology (D1 sign) from life arena (Chalit house).',
    description: 'Triggered automatically when any sliced planet shifts house in Placidus Bhava Chalit.',
    tags: ['sutra', 'group_a', 'bhava_chalit', 'kp'],
    sort_order: 508,
    prompt_body: `FORMULA CARTRIDGE — BHAVA CHALIT CUSP SHIFT:
When a planet sits near a cusp and shifts houses between Whole-Sign D1 and Placidus Bhava Chalit:
- Read the D1 Rashi sign (and dignity/aspects) for HOW the planet thinks and behaves internally.
- Read the Bhava Chalit house for WHERE external life events, responsibilities, and tangible results actually land.
Never ignore a Chalit shift; explicitly clarify how energy that looks aimed at one life area in Rashi manifests in the adjacent Chalit house in practice.`,
  },
  {
    slug: 'f_planet_distance_lens',
    category: 'formula_cartridge',
    display_name: 'F_PLANET_DISTANCE_LENS — Single-Planet Distance Matrix',
    subtitle: 'Group A: Judges focal planets via 6/8/12 from Lagna and 2/12 from own ruled houses.',
    description: 'Used for single-planet audits, active Dasha lords, and deep placement breakdowns.',
    tags: ['sutra', 'group_a', 'single_planet', 'distance'],
    sort_order: 509,
    prompt_body: `FORMULA CARTRIDGE — PLANET DISTANCE LENS:
Evaluate any focal planet (or active Mahadasha/Antardasha lord) across three structural distances:
1. Distance from Lagna (especially 6/8/12 placement causing effort, pivot, or hidden expenditure).
2. Distance from its OWN ruled houses (placed 2nd or 12th from its own sign creates maintenance cost or leakage in that house; 5/9/10/11 from own sign sustains growth).
3. Functional ties to 1/7/9/10.
Translate this into conscious strengths, subconscious friction, and practical pacing.`,
  },
  {
    slug: 'f_kendradhipati_dosha',
    category: 'formula_cartridge',
    display_name: 'F_KENDRADHIPATI_DOSHA — Benefic Kendra Lordship Audit',
    subtitle: 'Group A: Checks Jupiter/Venus/Mercury owning two Kendras without Trikona support.',
    description: 'Triggered when a sliced house lord carries Kendradhipati Dosha.',
    tags: ['sutra', 'group_a', 'kendradhipati', 'dosha'],
    sort_order: 510,
    prompt_body: `FORMULA CARTRIDGE — KENDRADHIPATI DOSHA:
When a natural benefic (Jupiter, Venus, Mercury, or waxing Moon) rules two Kendra houses (4/7/10) without simultaneously ruling a Trikona (1/5/9), it loses automatic protective softness and delivers procedural, rule-bound, or delayed results unless rescued by:
- Own/exalted placement,
- Association/aspect with a 5th/9th Trikona lord, or
- Strong D9 support.
Explain this calmly as "results require deliberate alignment and structure rather than passive luck."`,
  },
  {
    slug: 'f_badhaka_obstruction',
    category: 'formula_cartridge',
    display_name: 'F_BADHAKA_OBSTRUCTION — Movable/Fixed/Dual Badhakesh Check',
    subtitle: 'Group A: Spots non-linear delays from 11H (Movable), 9H (Fixed), or 7H (Dual) Badhakesh.',
    description: 'Triggered when the Badhakesh planet sits in, rules, or touches sliced houses/Dashas.',
    tags: ['sutra', 'group_a', 'badhaka', 'obstruction'],
    sort_order: 511,
    prompt_body: `FORMULA CARTRIDGE — BADHAKA OBSTRUCTION:
Verify Badhakesh status by Ascendant modality (Movable Lagna = 11H/11L; Fixed Lagna = 9H/9L; Dual Lagna = 7H/7L).
When the Badhakesh occupies, rules, or conjuncts the query's focal house or active Dasha lord, expect non-linear friction, administrative delays, mixed advice, or blind spots rather than flat denial.
Identify the exact source of the bottleneck and note how patience, second opinions, or structured follow-through clears it.`,
  },
  {
    slug: 'f_maraka_activation',
    category: 'formula_cartridge',
    display_name: 'F_MARAKA_ACTIVATION — Non-Fatalistic 2L/7L Chapter Transition',
    subtitle: 'Group A: Interprets 2nd/7th lord Dashas as lifestyle resets and chapter pivots, never doom.',
    description: 'Triggered when 2L or 7L leads active MD/AD or sits in focal houses.',
    tags: ['sutra', 'group_a', 'maraka', 'non_fatalistic'],
    sort_order: 512,
    prompt_body: `FORMULA CARTRIDGE — MARAKA ACTIVATION (NON-FATALISTIC):
When 2nd or 7th house lords lead an active Mahadasha/Antardasha or receive heavy transit triggers, NEVER predict death, fatal illness, or doom.
Interpret Maraka activation strictly as a grounded chapter threshold: vitality dips from overwork, family/financial obligations reshuffling, relationship boundary resets, or closing one demanding phase to protect long-term sustainability. Recommend calm pacing and preventative routine adjustments.`,
  },

  // =========================================================================
  // GROUP B: Dasha & Slow/Fast Gochar Timing Formulas (5)
  // =========================================================================
  {
    slug: 'f_dasha_ladder',
    category: 'formula_cartridge',
    display_name: 'F_DASHA_LADDER — MD/AD/PD Hierarchy & 10% Dasha Sandhi',
    subtitle: 'Group B: Assigns MD season, AD catalyst, PD trigger, and Dasha Sandhi transition zones.',
    description: 'Core Vimshottari & Chara Dasha synthesis across timing and decision playbooks.',
    tags: ['sutra', 'group_b', 'dasha', 'sandhi', 'timing'],
    sort_order: 513,
    prompt_body: `FORMULA CARTRIDGE — DASHA LADDER & SANDHI:
Read the Vimshottari stack strictly by scale: Mahadasha (MD) = macro season, Antardasha (AD) = active chapter/catalyst, Pratyantardasha (PD) = specific trigger window.
- If the AD lord has higher PHI/authority than the MD lord, AD steers the visible direction; if AD sits 6/8/12 from MD, expect internal restructuring or friction before gains settle.
- Dasha Sandhi Rule: If MD or AD is in its final 10% (or opening 5%) transition zone, explicitly name it as a natural transition window where old commitments wrap up and clarity sharpens once the new lord settles.
Classify the active period mode cleanly (Growth, Correction, Expansion, Transformation, Consolidation, or Spiritualization).`,
  },
  {
    slug: 'f_degree_maturity',
    category: 'formula_cartridge',
    display_name: 'F_DEGREE_MATURITY — Lagna & Planet Degree Activation',
    subtitle: 'Group B: Evaluates <5° early, 5–25° stable, >25° seasoned, and 0–1°/29–30° Sandhi.',
    description: 'Interprets Ascendant and focal planet degree maturity and Sandhi sensitivity.',
    tags: ['sutra', 'group_b', 'degrees', 'maturity', 'sandhi'],
    sort_order: 514,
    prompt_body: `FORMULA CARTRIDGE — DEGREE MATURITY & SANDHI:
Check degree position on D1 Ascendant and focal planets (never invent degrees for divisional charts):
- <5°: Emerging, early hesitation, skills still forming before stabilizing with age.
- 5°–25°: Prime, steady, predictable expression.
- >25°: Seasoned, intensified, or late-blooming delivery that peaks after thorough experience.
- Sandhi (<1° or >29°) or Gandanta: Threshold sensitivity, abrupt transitions, and (on Lagna) a gentle reminder to verify birth-time accuracy if minute-level KP claims matter.`,
  },
  {
    slug: 'f_double_transit_witnesses',
    category: 'formula_cartridge',
    display_name: 'F_DOUBLE_TRANSIT_WITNESSES — Jupiter + Saturn + SAV Volume Knob',
    subtitle: 'Group B: Law of Two Witnesses paired with Mars trigger and SAV <20 / 20–27 / >=28.',
    description: 'Core milestone timing verification combining Double Transit with natal Ashtakavarga.',
    tags: ['sutra', 'group_b', 'double_transit', 'sav', 'ashtakavarga'],
    sort_order: 515,
    prompt_body: `FORMULA CARTRIDGE — DOUBLE TRANSIT ("LAW OF TWO WITNESSES") + SAV VOLUME:
Major durable milestones require BOTH active Dasha support AND the Double Transit witness lock on the target house/sign:
- Jupiter = Vision / Permission ("Yes") via 1/5/7/9 aspect.
- Saturn = Bricks / Permanence ("Locks it in") via 1/3/7/10 aspect.
- Mars = Short-term execution trigger crossing the active sign.
Scale transit ease by natal Sarvashtakavarga (SAV) bindus in the target sign: >=28 High (smooth tailwind), 20–27 Standard (mixed/earned), <20 Low (heavy lift requiring structured effort). Cross-check against Moon, Lagna, active MD/AD lords, and natal house.`,
  },
  {
    slug: 'f_slow_planet_transit',
    category: 'formula_cartridge',
    display_name: 'F_SLOW_PLANET_TRANSIT — Current & Next Sign-Change Transit Pairs',
    subtitle: 'Group B: Evaluates Jupiter, Saturn, Rahu/Ketu from Lagna & Moon plus upcoming ingress.',
    description: 'Uses current and upcoming slow-planet sign-change transit windows with BAV scores.',
    tags: ['sutra', 'group_b', 'gochar', 'transits'],
    sort_order: 516,
    prompt_body: `FORMULA CARTRIDGE — SLOW PLANET TRANSIT PROTOCOL:
Evaluate slow transits (Jupiter, Saturn, Rahu, Ketu) across both Current Placement AND Upcoming Next Sign-Change Ingress:
1. House from both Natal Lagna and Natal Moon (Chandra Lagna).
2. Natal houses ruled by that transiting planet.
3. Special aspects (Jupiter 5/7/9, Saturn 3/7/10) and Bhinnashtakavarga (BAV) bindus in that sign (>=5 supportive, <=3 friction).
4. Sync with active MD/AD/PD: a great transit without Dasha support produces modest buzz, while aligned transit + Dasha marks the true inflection window.`,
  },
  {
    slug: 'f_obstruction_gate',
    category: 'formula_cartridge',
    display_name: 'F_OBSTRUCTION_GATE — Friction & Resistance Audit Before Approval',
    subtitle: 'Group B: Checks Sade Sati, Ashtama Shani, 6/8/12 AD, and combustion before optimism.',
    description: 'Prevents overly rosy timing predictions when structural or transit resistance is active.',
    tags: ['sutra', 'group_b', 'obstruction', 'sade_sati'],
    sort_order: 517,
    prompt_body: `FORMULA CARTRIDGE — OBSTRUCTION GATE:
Before calling any timing window "smooth," scan for active resistance gates:
- Sade Sati or Ashtama Shani (Saturn transiting 12/1/2/8 from Moon),
- 6th/8th/12th Antardasha from MD or Lagna,
- Severe combustion or un-cancelled debilitation of the active Dasha lord,
- Nodal transit across 1/7 or 4/10 axes.
If an obstruction gate is active alongside supportive factors, frame the window honestly as "productive progress that demands patience, pacing, and clean execution" rather than effortless smooth sailing.`,
  },

  // =========================================================================
  // GROUP C: Marriage, Love & Compatibility Formulas (6)
  // =========================================================================
  {
    slug: 'f_marriage_reality_d9',
    category: 'formula_cartridge',
    display_name: 'F_MARRIAGE_REALITY_D9 — 7H/7L, D9 Navamsa, UL & DK Matrix',
    subtitle: 'Group C: Separates attraction/image (D1) from lived post-marriage reality (D9 & UL).',
    description: 'Core marriage quality, spouse profile, and emotional durability synthesis.',
    tags: ['sutra', 'group_c', 'marriage', 'd9', 'upapada'],
    sort_order: 518,
    prompt_body: `FORMULA CARTRIDGE — MARRIAGE REALITY (D9 + UL + DK):
Never judge marriage from D1 7th house alone. Synthesize:
1. D1 7th house & 7th lord placement in D9 (measures post-honeymoon durability and mutual adaptation).
2. D9 Lagna & D9 7th house (reflects partner's authentic inner temperament and maturity).
3. Darakaraka (DK) sign, house, and D9 dignity + Venus (or Jupiter) strength.
4. Upapada Lagna (UL) & 2nd from UL (formal bond continuity and family integration).
5. Red/Yellow Flag Calibration: Verify Punarphoo (Saturn-Moon), Angarak (Mars-Rahu), or Shrapit (Saturn-Rahu) against Jupiter/benefic D9 protections before flagging loyalty or temperament stress.`,
  },
  {
    slug: 'f_marriage_10_timing_locks',
    category: 'formula_cartridge',
    display_name: 'F_MARRIAGE_10_TIMING_LOCKS — Multi-Clock Marriage Timing Gate',
    subtitle: 'Group C: Requires >=3 converging locks across Dasha, KP 2-7-11, D9/DK, and Double Transit.',
    description: 'Locks realistic marriage/commitment timing windows with multi-system convergence.',
    tags: ['sutra', 'group_c', 'marriage', 'timing'],
    sort_order: 519,
    prompt_body: `FORMULA CARTRIDGE — MARRIAGE 10 TIMING LOCKS:
Rank marriage or serious commitment windows highest when >=3 independent locks align simultaneously:
(1) 7L MD/AD, (2) 7H occupant or aspecting planet MD/AD, (3) Venus/Jupiter MD/AD, (4) D9 7H/D9 Lagnesh/DK Dasha, (5) 2H family-addition link, (6) Jupiter transit touching 7H/7L/Venus/D9 Lagna, (7) Saturn transit stabilizing 7H/7L (often maturing 28–32+), (8) Nodal 1-7 axis activation, (9) KP 2-7-11 significators overriding 1-6-10, (10) (if synastry) mutual partner Dasha sync.
Present the top 2–3 realistic date windows and specify what breaks or triggers each.`,
  },
  {
    slug: 'f_marriage_conditional_reorder',
    category: 'formula_cartridge',
    display_name: 'F_MARRIAGE_CONDITIONAL_REORDER — Adaptive Marriage Framing',
    subtitle: 'Group C: Reorders response when 7H friction, 8/12 links, or 10H career dominance appear.',
    description: 'Dynamically reorders marriage analysis priority based on chart archetype & user state.',
    tags: ['sutra', 'group_c', 'marriage', 'priority_override'],
    sort_order: 520,
    prompt_body: `FORMULA CARTRIDGE — MARRIAGE CONDITIONAL REORDER:
Adapt the narrative opening sequence to match what the chart and Desh-Kaal-Patra actually show:
- Heavy 7H/Saturn-Rahu doubt or past delay: Lead immediately with honest chart support vs. delay calibration and validate why earlier chapters felt heavy before listing timing dates.
- 8H/12H links to 7H or dual-marriage flags: Address stability habits and communication boundaries calmly upfront.
- Strong 10H/11H career focus: Explain how partnership weaves through work, ambition, or shared social networks.
- Intense Moon-Rahu/Ketu/8H: Address attachment style and emotional safety patterns before giving timeline dates.`,
  },
  {
    slug: 'f_divorce_risk_6_pillars',
    category: 'formula_cartridge',
    display_name: 'F_DIVORCE_RISK_6_PILLARS — Marital Friction vs. Protective Anchors',
    subtitle: 'Group C: Balances 6-pillar risk signals with D9/Jupiter/UL protective stabilizers.',
    description: 'Non-alarmist marital strain, separation risk, and reconciliation evaluation.',
    tags: ['sutra', 'group_c', 'divorce', 'separation', 'marriage'],
    sort_order: 521,
    prompt_body: `FORMULA CARTRIDGE — SEPARATION & STABILITY 6-PILLAR AUDIT:
Assess marital strain calmly across 6 structural pillars—never predict inevitable divorce from 1 isolated flaw:
(1) 7L in 6/8/12, (2) Saturn + Mars stacking on 7H/7L/UL (Saturn alone = endurance, Mars alone = heat, both = cold fatigue + conflict), (3) UL & 2nd-from-UL affliction, (4) Venus combust + afflicted + weak D9, (5) D9 7H/Lagnesh breakdown, (6) Darakaraka affliction.
ALWAYS balance any risk score with explicit Protective Factors (Jupiter aspect on 7H/UL, strong D9, Venus/Moon stability, favorable upcoming AD) and distinguish 12H emotional distance/exhaustion from Mars-Rahu acute conflict.`,
  },
  {
    slug: 'f_wealth_after_marriage_index',
    category: 'formula_cartridge',
    display_name: 'F_WEALTH_AFTER_MARRIAGE_INDEX — Partnership Prosperity Shift',
    subtitle: 'Group C: Checks 7L linking 2/8/11, UL, 8H joint assets, and D9 wealth uplift.',
    description: 'Evaluates post-marriage financial momentum, joint assets, and spouse resource synergy.',
    tags: ['sutra', 'group_c', 'wealth', 'marriage', 'upapada'],
    sort_order: 522,
    prompt_body: `FORMULA CARTRIDGE — WEALTH AFTER MARRIAGE INDEX:
Evaluate whether partnership accelerates or reshapes material stability by weighing:
- 2H (family wealth) + 8H (joint assets/partner equity) + 11H (income expansion) + Dhana Yogas,
- Links between 7L and 2/8/11 (or 9L Bhagya uplift post-commitment),
- Upapada Lagna (UL) & 2nd from UL financial steadiness,
- D9 financial reinforcement and active Dashas.
If a partner chart is attached, check cross-synergy (Partner A's 2L/11L with Partner B's 2H/8H/11H). Frame clearly as shared stewardship and timing rather than passive windfall guarantees.`,
  },
  {
    slug: 'f_synastry_core',
    category: 'formula_cartridge',
    display_name: 'F_SYNASTRY_CORE — Cross-Chart Synastry & Dosha Samyam',
    subtitle: 'Group C: Overlays 7L-to-Lagna, D9 alignment, Venus-Mars 2/12, AK-AK, and Dasha sync.',
    description: 'Primary compatibility synthesis when two birth charts are attached.',
    tags: ['sutra', 'group_c', 'synastry', 'compatibility'],
    sort_order: 523,
    prompt_body: `FORMULA CARTRIDGE — CROSS-CHART SYNASTRY CORE:
When comparing two charts, NEVER rely on raw Ashtakoot Gun Milan points alone. Prioritize structural synastry:
1. Dosha Samyam (balanced 1/2/4/7/8/12 malefic intensity across both charts rather than one-sided fear of Manglik).
2. Person A's 7L / DK / D9 Lagna intersecting Person B's D1/D9 Lagna or Moon.
3. Emotional & communication sync: Moon-to-Moon distance (avoiding unmitigated 6/8 unless D9/Jupiter bridges it) and Mercury-from-Moon communication rhythm.
4. Venus-Mars attraction vs. 2/12 burnout axis; Saturn on partner's Moon (duty vs. heaviness); Nodal ties on Lagna/7H (magnetic pull).
5. Joint Dasha timing: Do both charts enter supportive or stressful chapters together?`,
  },

  // =========================================================================
  // GROUP D: Career, Authority, Wealth, Debt & Foreign Formulas (5)
  // =========================================================================
  {
    slug: 'f_career_d10_and_amk',
    category: 'formula_cartridge',
    display_name: 'F_CAREER_D10_AND_AMK — 10H/10L, D10 Dasamsa, AmK & KP 2-6-10-11',
    subtitle: 'Group D: Cross-verifies career authority, D10 endurance, Amatyakaraka, and A10.',
    description: 'Core career growth, role fit, leadership, and promotion timing lens.',
    tags: ['sutra', 'group_d', 'career', 'd10', 'amk'],
    sort_order: 524,
    prompt_body: `FORMULA CARTRIDGE — CAREER D10 & AMK SYNTHESIS:
Cross-verify career trajectory strictly across four layers:
1. D1 10H/10L + 6H (execution/service) + 11H (gains/promotions) + Saturn/Sun/Mercury health.
2. D10 (Dasamsa) Lagna, 10th house, and D1 10L's dignity inside D10 (never cite D10 degrees; check sign, house, dignity, Vargottama).
3. Jaimini Amatyakaraka (AmK) and Arudha 10 (A10) to separate true daily craft from public title/reputation.
4. KP 10th CSL: Check whether 2-6-10-11 significators dominate over 5-8-12 (which signal sudden pivots, research, or restructuring).`,
  },
  {
    slug: 'f_job_vs_business',
    category: 'formula_cartridge',
    display_name: 'F_JOB_VS_BUSINESS — 6H Service Endurance vs. 7H/3H/11H Enterprise',
    subtitle: 'Group D: Adjudicates salaried leadership vs. independent entrepreneurship or hybrid.',
    description: 'Resolves employment vs. business/freelance/consulting trade-offs.',
    tags: ['sutra', 'group_d', 'career', 'business', 'job'],
    sort_order: 525,
    prompt_body: `FORMULA CARTRIDGE — JOB VS. BUSINESS ADJUDICATION:
Compare two distinct structural engines:
- Structured Career / Salaried Authority: 6H/6L + 10H + Saturn + KP 2-6-10-11 + strong 10L in D10. Thrives on institutional leverage, specialist mastery, and predictable compounding.
- Independent Business / Venture / Advisory: 7H/7L (client trade/partnerships) + 3H (self-initiated risk/marketing) + 11H (scalable upside) + Mercury/Rahu/Mars + D10 7H/11H.
Also test the "Hybrid" option (intrapreneurship, consulting alongside steady anchor, or building side equity during a favorable AD before leaving a paycheck). Anchor to user's confirmed career_mode.`,
  },
  {
    slug: 'f_artha_shastra_wealth',
    category: 'formula_cartridge',
    display_name: 'F_ARTHA_SHASTRA_WEALTH — Inflow vs. Retention, D2 Hora & Indu/Shri Lagna',
    subtitle: 'Group D: Separates earning (10/11) from net retention (2/4/5/9/D2/Indu Lagna).',
    description: 'Core wealth architecture combining Dhana Yogas, D2 Hora, AL, and Indu/Shri Lagna.',
    tags: ['sutra', 'group_d', 'wealth', 'd2_hora', 'indu_lagna'],
    sort_order: 526,
    prompt_body: `FORMULA CARTRIDGE — ARTHA SHASTRA WEALTH ARCHITECTURE:
Always separate INCOME VELOCITY from WEALTH RETENTION:
1. Inflow Engine: 10H, 11H/11L, Upachaya houses (3/6/10/11), and 11th from Arudha Lagna (AL).
2. Retention & Compounding: 2H/2L, 4H/D4 assets, 5H/9H Lakshmi sthanas, Jupiter health, and absence of unmitigated 2L-12H or Daridra leakage.
3. D2 Hora Split: Solar Hora favors steady self-earned institutional wealth; Lunar Hora favors cyclical, advisory, or public-facing flows + inspect D2 2nd house occupants.
4. Special Wealth Anchors: Use Indu Lagna (and Dashas of planets in/aspecting Indu Lagna) plus Shri Lagna for peak accumulation windows.`,
  },
  {
    slug: 'f_debt_recovery_strategy',
    category: 'formula_cartridge',
    display_name: 'F_DEBT_RECOVERY_STRATEGY — 6/8/12 Leak Diagnosis & Inflection Dates',
    subtitle: 'Group D: Identifies debt/outflow root cause and times cashflow stabilization.',
    description: 'Practical debt, financial pressure, and recovery timing protocol without ritual upsells.',
    tags: ['sutra', 'group_d', 'debt', 'wealth', 'recovery'],
    sort_order: 527,
    prompt_body: `FORMULA CARTRIDGE — DEBT & CASHFLOW RECOVERY STRATEGY:
Pinpoint the exact structural leak before advising strategy:
- 6H dominant: Servicing debt, operational overhead, or underpriced effort.
- 8H dominant: Sudden shocks, taxes, partner/joint liabilities, or volatile bets.
- 12H dominant: Chronic outflow, lifestyle burn, or unmonitored expenses (2L in 12H).
Check 2L and 11L inside D9: if stronger in D9 than D1, pressure is a temporary karma-clearing chapter rather than permanent baseline. Time the turnaround by the exit of hostile Saturn/Rahu/12L AD, entry of Yogakaraka/11L AD, and Jupiter Gochar on 2/11/Moon. Recommend grounded strategy (debt restructuring vs. steady salary anchor vs. trimming 12H burn)—zero ritual upsells.`,
  },
  {
    slug: 'f_foreign_relocation',
    category: 'formula_cartridge',
    display_name: 'F_FOREIGN_RELOCATION — 9H/12H, 4H Roots, Rahu, D4 & KP 3-9-12',
    subtitle: 'Group D: Evaluates overseas moves, residency permanence, and career-abroad links.',
    description: 'Synthesizes foreign settlement, immigration, visa timing, and homeland vs. abroad.',
    tags: ['sutra', 'group_d', 'foreign', 'relocation', 'd4'],
    sort_order: 528,
    prompt_body: `FORMULA CARTRIDGE — FOREIGN & RELOCATION MATRIX:
Evaluate overseas movement vs. long-term settlement across:
1. 9H (long-distance expansion, visas, higher path) + 12H (distant lands, residence abroad) + 3H (short moves/relocation triggers).
2. 4H/4L condition & D4 (Chaturthamsa): Movable signs, Rahu in 4H/12H, or 4L linked to 9/12 point to thriving away from birthplace; strong fixed 4H/4L pulls toward eventual property roots or homeland return.
3. KP 3-9-12 significators + active 9L/12L/Rahu Dasha.
Adapt to user's location_status: if already living abroad, focus on residency permanence, civic stability, and career roots rather than predicting a first move.`,
  },

  // =========================================================================
  // GROUP E: Physical & Mental Health Formulas (2)
  // =========================================================================
  {
    slug: 'f_physical_vitality_and_recovery',
    category: 'formula_cartridge',
    display_name: 'F_PHYSICAL_VITALITY_AND_RECOVERY — Lagnesh, Sun, 6/8/12 & Resilience',
    subtitle: 'Group E: Preventive vitality and recovery pacing without medical diagnosis.',
    description: 'Evaluates baseline constitutional resilience vs. temporary Dasha/transit fatigue.',
    tags: ['sutra', 'group_e', 'health', 'vitality', 'non_medical'],
    sort_order: 529,
    prompt_body: `FORMULA CARTRIDGE — PHYSICAL VITALITY & RECOVERY (NON-DIAGNOSTIC):
Evaluate vitality strictly as constitutional pacing and recovery resilience—NEVER diagnose diseases, prescribe treatments, or cause health anxiety:
1. Baseline Buffer: Lagna + Lagnesh PHI + Sun strength + D45/Swamsha resilience.
2. Stress Axes: 6H (daily habits, inflammation, overwork), 8H (sudden depletion/chronic resets), 12H (sleep quality, burnout, rest needs) + low SAV bindus (<20) in 1/6/8/12.
3. Recovery Test: Strong Lagnesh, benefic aspect on 1H/6H/8H, or dignified Jupiter shows strong rebound once pacing improves. Frame dips as temporary Dasha/transit load calling for sleep, routine, and preventive medical checkups.`,
  },
  {
    slug: 'f_mental_wellness_axis',
    category: 'formula_cartridge',
    display_name: 'F_MENTAL_WELLNESS_AXIS — Moon, Mercury, 4H/5H & Temporary Clouds',
    subtitle: 'Group E: Separates baseline emotional sensitivity from temporary Sade Sati/Dasha clouds.',
    description: 'Compassionate, non-clinical emotional & mental clarity synthesis.',
    tags: ['sutra', 'group_e', 'mental', 'moon', 'wellness'],
    sort_order: 530,
    prompt_body: `FORMULA CARTRIDGE — MENTAL WELLNESS & EMOTIONAL NERVOUS SYSTEM:
Evaluate inner steadiness across Moon (D1 & D9), Mercury, 4H/4L, and 5H:
- Distinguish baseline nervous-system wiring (Moon-Rahu/Ketu overthinking, Moon-Saturn emotional guard, or uncancelled Kemadruma solitude) from TEMPORARY transit/Dasha clouds (Sade Sati, Ashtama Shani, 8H/12H AD).
- Highlight existing stabilizers (Waxing Moon, Jupiter aspect, Kendra planets from Moon, strong 4H/D9 Moon).
Keep tone calm, normalizing, and grounding—encourage supportive routine, boundaries, and professional care when appropriate without fatalism.`,
  },

  // =========================================================================
  // GROUP F: Progeny, Education, Property, Litigation, Spirituality & Annual (6)
  // =========================================================================
  {
    slug: 'f_progeny_d7_and_pk',
    category: 'formula_cartridge',
    display_name: 'F_PROGENY_D7_AND_PK — 5H/5L, D7 Saptamsha, Putrakaraka & KP 2-5-11',
    subtitle: 'Group F: Balanced progeny timing & parent-child bond without absolute fertility claims.',
    description: 'Cross-checks D1 5H, D7 Saptamsha, Jupiter, Putrakaraka, and 9H backup.',
    tags: ['sutra', 'group_f', 'progeny', 'd7', 'children'],
    sort_order: 531,
    prompt_body: `FORMULA CARTRIDGE — PROGENY, D7 SAPTAMSHA & PUTRAKARAKA:
Cross-verify children and parenting themes across:
1. D1 5H/5L + 9H (5th from 5th backup) + Jupiter (natural Putrakaraka) + Jaimini Putrakaraka (PK).
2. D7 (Saptamsha) Lagna, Lagnesh, and 5th house/lord (dignity and sign only—never D7 degrees).
3. KP 5th CSL favoring 2-5-11 over 1-4-10.
4. Nuance Rules: Ketu in 5H or Jupiter in 5H (Karako Bhava Nashaya) signals deliberate planning, delayed timing, or an independent-minded child—NEVER pronounce absolute medical infertility or denial. Respect existing children in life_context_json.`,
  },
  {
    slug: 'f_education_d24_and_exams',
    category: 'formula_cartridge',
    display_name: 'F_EDUCATION_D24_AND_EXAMS — D24, 4H/5H/9H & Competitive vs. Research',
    subtitle: 'Group F: Separates competitive exam grit (6H/11H) from PhD/research depth (5H/8H/9H).',
    description: 'Evaluates academic focus, degrees, study abroad, and competitive exams.',
    tags: ['sutra', 'group_f', 'education', 'd24', 'exams'],
    sort_order: 532,
    prompt_body: `FORMULA CARTRIDGE — EDUCATION, D24 & EXAM STRATEGY:
Cross-check learning and academic execution across 4H (foundational degrees), 5H (retention/analytical spark), 9H (higher/postgrad study), Mercury, Jupiter, and D24 (Chaturvimshamsha Lagna/4H/5H):
- Competitive / Govt / Entrance Exams: Require 6H + 11H resilience (KP 4-6-9-11) alongside Mars/Saturn discipline and supportive active AD/PD during exam dates.
- Research / PhD / Deep Specialization: Thrives on 5H + 8H + 9H + Ketu/Saturn focus.
Flag Badhaka or Rahu-Moon distraction patterns calmly so the user can tighten study structure.`,
  },
  {
    slug: 'f_property_d4_and_assets',
    category: 'formula_cartridge',
    display_name: 'F_PROPERTY_D4_AND_ASSETS — 4H/4L, D4 Chaturthamsa, Mars/Venus & KP 4-11-12',
    subtitle: 'Group F: Evaluates home purchase, land equity, vehicles, and hometown vs. abroad.',
    description: 'Real estate acquisition, mortgage/asset retention, and relocation property patterns.',
    tags: ['sutra', 'group_f', 'property', 'd4', 'assets'],
    sort_order: 533,
    prompt_body: `FORMULA CARTRIDGE — PROPERTY, D4 CHATURTHAMSA & FIXED ASSETS:
Cross-check real estate, home stability, and vehicles across:
1. D1 4H/4L + Mars (land, construction, real estate equity) + Venus (vehicles, interior comfort).
2. D4 (Chaturthamsa) Lagna, 4th house, and D1 4L dignity in D4.
3. KP 4th CSL linking 4-11-12 (acquisition and loan closure) vs. 3-8 (delays or repairs).
4. Relocation Nuance: 4L in 12H or Rahu in 4H favors investment property, rentals, or owning homes away from birthplace rather than staying rooted in one hometown address. Time purchase via 4L/Mars/Venus Dasha + Double Transit over 4H.`,
  },
  {
    slug: 'f_litigation_and_rivals',
    category: 'formula_cartridge',
    display_name: 'F_LITIGATION_AND_RIVALS — 6H/8H/12H, Vipareeta & KP 6-11 vs. 6-8-12',
    subtitle: 'Group F: Evaluates dispute endurance, settlement timing, and cost vs. recovery.',
    description: 'Strategic timing and resolution framing for conflicts/disputes without legal advice.',
    tags: ['sutra', 'group_f', 'litigation', 'disputes', '6h'],
    sort_order: 534,
    prompt_body: `FORMULA CARTRIDGE — LITIGATION, DISPUTES & RIVALS (NON-LEGAL):
Evaluate conflict resilience and resolution timing strictly strategically (never provide formal legal advice):
1. Compare 6H/6L (dispute stamina) + Mars/Saturn/Rahu against Jupiter's grace on 6H/9H (fair resolution) and Lagnesh strength.
2. Check KP 6th/11th significators (favorable resolution/recovery) vs. entangled 6-8-12 links (prolonged legal/financial drain).
3. Test Vipareeta Raja Yoga: Strong Lagnesh converts drawn-out rivalry into eventual leverage once hostile AD exits. Always highlight when negotiated settlement saves time and capital over escalation.`,
  },
  {
    slug: 'f_spirituality_d20_and_moksha',
    category: 'formula_cartridge',
    display_name: 'F_SPIRITUALITY_D20_AND_MOKSHA — D20, Karakamsha, 4/8/12 & Grounded Dharma',
    subtitle: 'Group F: Distinguishes mature contemplative growth from avoidant escapism.',
    description: 'Synthesizes spiritual inclination, D20 Vimshamsha, Atmakaraka, and Ketu/Jupiter.',
    tags: ['sutra', 'group_f', 'spirituality', 'd20', 'moksha'],
    sort_order: 535,
    prompt_body: `FORMULA CARTRIDGE — SPIRITUALITY, D20 & GROUNDED DHARMA:
Examine inner evolution across 9H (Dharma/mentorship), Moksha Trikonas (4/8/12), Atmakaraka / Karakamsha / Swamsha (especially 12th from Karakamsha), Ketu, Jupiter, and D20 (Vimshamsha Lagna/5H/9H):
- Separate GROUNDED CONTEMPLATIVE MATURITY (strong Lagnesh + Jupiter + D9/D20 alignment turning insight into steady ethics and daily peace) from AVOIDANT ESCAPISM (stressed Moon/12H seeking spiritual bypass during difficult responsibilities).
Keep tone luminous, practical, and free of dogma or fatalism.`,
  },
  {
    slug: 'f_varshaphala_and_panchanga',
    category: 'formula_cartridge',
    display_name: 'F_VARSHAPHALA_AND_PANCHANGA — 5-Limb Birth Baseline & Annual Themes',
    subtitle: 'Group F: Weaves Vara/Tithi/Nakshatra/Yoga/Karana baseline with annual timing arcs.',
    description: 'Anchors annual birth-year outlook and natal Panchanga temperament.',
    tags: ['sutra', 'group_f', 'panchanga', 'varshaphala', 'annual'],
    sort_order: 536,
    prompt_body: `FORMULA CARTRIDGE — NATAL PANCHANGA & ANNUAL YEAR-ARC:
When framing annual themes or baseline temperament, anchor into the 5-limb Panchanga signature alongside active Vimshottari MD/AD and slow Gochar transits:
- Vara (Weekday ruler): baseline vitality & action driver.
- Tithi (Lunar day): emotional & relational fuel.
- Nakshatra: instinctual reflex & response pattern.
- Nitya Yoga & Karana: mental cohesion and day-to-day execution rhythm.
Pair this baseline with current Solar-year / Dasha themes and upcoming slow-planet ingress shifts to highlight the year's highest-leverage focus.`,
  },
];

export const PRIORITY_RULES_SEED: SutradharaPromptSeed[] = [
  {
    slug: 'prio_marriage',
    category: 'priority_rule',
    display_name: 'PRIO_MARRIAGE — Marriage Timing & Long-Term Quality Matrix',
    subtitle: 'Domain Priority #1: Locks 7H/KP 7th CSL/D9/UL/DK order + Conditional 7H Reorder.',
    description: 'Context priority matrix for marriage timing, quality, partner traits, and delay.',
    tags: ['sutra', 'priority', 'marriage'],
    sort_order: 601,
    prompt_body: `DOMAIN PRIORITY MATRIX — MARRIAGE & PARTNERSHIP:
#1 Lead Anchor: 7H/7L + KP 7th Cusp Sub-Lord (2-7-11 vs 1-6-10) + Active Vimshottari MD/AD/PD + Confirmed Relationship Status (Desh-Kaal-Patra).
#2 Cross-Verification: D1 7L in D9 + D9 Lagna/7H + Upapada Lagna (UL & 2nd from UL) + Darakaraka (DK) + Jupiter/Saturn Double Transit.
#3 Priority Override: If 7H carries heavy Saturn/Rahu friction or Punarphoo/Shrapit, calibrate structural support and validate past friction FIRST before giving timeline dates; distinguish external milestone from inner emotional compatibility.`,
  },
  {
    slug: 'prio_synastry',
    category: 'priority_rule',
    display_name: 'PRIO_SYNASTRY — Cross-Chart Compatibility & Relationships Matrix',
    subtitle: 'Domain Priority #2: Locks Dosha Samyam, D9/Lagna overlays, Moon/Mercury, and Dasha sync.',
    description: 'Context priority matrix for partner synastry and interpersonal relationships.',
    tags: ['sutra', 'priority', 'synastry', 'relationships'],
    sort_order: 602,
    prompt_body: `DOMAIN PRIORITY MATRIX — SYNASTRY & RELATIONSHIPS:
#1 Lead Anchor: Structural chart overlay (A's 7L/DK/D9 Lagna with B's D1/D9 Lagna & Moon) + Dosha Samyam balance (never raw Gun Milan alone).
#2 Cross-Verification: Emotional rhythm (Moon-Moon & 4H) + Communication (Mercury-from-Moon) + Venus/Mars attraction vs. 2/12 burnout + UL stability.
#3 Priority Override: Joint Dasha timeline comparison—highlight where both partners hit supportive vs. demanding chapters simultaneously, and separate shared longevity from short-term chemistry.`,
  },
  {
    slug: 'prio_career',
    category: 'priority_rule',
    display_name: 'PRIO_CAREER — Career Growth, Leadership & Role Switch Matrix',
    subtitle: 'Domain Priority #3: Locks Active Dasha, 10H/10L, KP 6/10/11 CSL, D10 & AmK.',
    description: 'Context priority matrix for career direction, promotions, and switches.',
    tags: ['sutra', 'priority', 'career'],
    sort_order: 603,
    prompt_body: `DOMAIN PRIORITY MATRIX — CAREER & VOCATION:
#1 Lead Anchor: Active MD/AD/PD + 10H/10L + KP 10th Cusp Sub-Lord (2-6-10-11 vs 5-8-12) + Confirmed Career Mode.
#2 Cross-Verification: D10 (Dasamsa) 10L/Lagna + Amatyakaraka (AmK) + A10 reputation + Saturn/Jupiter transit over 10H/Moon.
#3 Priority Override: D1 vs. D10 divergence, Kendradhipati/Badhaka friction, or 6/8/12 AD pivots (reframe pivots as strategic repositioning rather than failure).`,
  },
  {
    slug: 'prio_business_vs_job',
    category: 'priority_rule',
    display_name: 'PRIO_BUSINESS_VS_JOB — Employment vs. Entrepreneurship Adjudication',
    subtitle: 'Domain Priority #4: Compares 6H/Saturn service stability vs. 7H/3H/11H/Rahu venture drive.',
    description: 'Context priority matrix for job vs. business, freelance, and partnership decisions.',
    tags: ['sutra', 'priority', 'career', 'business'],
    sort_order: 604,
    prompt_body: `DOMAIN PRIORITY MATRIX — JOB VS. BUSINESS ADJUDICATION:
#1 Lead Anchor: Direct structural comparison between 6H/Saturn/10H (institutional authority & specialist mastery) vs. 7H/3H/11H/Mercury/Rahu (client trade, risk appetite & independent ventures).
#2 Cross-Verification: D10 6H vs. 7H/11H + KP 6-10-11 vs. 7-10-11 + Capital retention check (2H/D2/11H).
#3 Priority Override: Never glorify entrepreneurship if 2H/12H cashflow volatility or hostile AD is active; explicitly test a phased/hybrid transition window.`,
  },
  {
    slug: 'prio_wealth_debt',
    category: 'priority_rule',
    display_name: 'PRIO_WEALTH_DEBT — Wealth Retention, Assets & Debt Recovery Matrix',
    subtitle: 'Domain Priority #5: Locks 2H/11H/5H/9H, Indu/Shri Lagna, D2 Hora & leakage checks.',
    description: 'Context priority matrix for wealth building, windfalls, and debt resolution.',
    tags: ['sutra', 'priority', 'wealth', 'debt'],
    sort_order: 605,
    prompt_body: `DOMAIN PRIORITY MATRIX — WEALTH, ASSETS & DEBT:
#1 Lead Anchor: 2H/11H/5H/9H lords + Indu Lagna & Shri Lagna + Dhana YSI strength.
#2 Cross-Verification: D2 Hora (Solar vs. Lunar) + D4 fixed assets + Arudha Lagna (AL & 11th from AL) + SAV bindu volume.
#3 Priority Override: Check 2L-12H leakage, 6H/8H/12H debt drain, and 2L/11L D9 recovery status before promising accumulation—pair upside with cashflow discipline.`,
  },
  {
    slug: 'prio_foreign',
    category: 'priority_rule',
    display_name: 'PRIO_FOREIGN — Foreign Settlement, Visas & Relocation Matrix',
    subtitle: 'Domain Priority #6: Locks 4H/9H/12H, Rahu, KP 3-9-12, D4 & current location anchor.',
    description: 'Context priority matrix for overseas travel, immigration, and relocation.',
    tags: ['sutra', 'priority', 'foreign', 'relocation'],
    sort_order: 606,
    prompt_body: `DOMAIN PRIORITY MATRIX — FOREIGN SETTLEMENT & RELOCATION:
#1 Lead Anchor: 4H/9H/12H balance + Rahu links + KP 3-9-12 significators + Current Location Anchor.
#2 Cross-Verification: D4 (Chaturthamsa) + 9L/12L Dasha activation + career/spouse 7H/10H foreign ties.
#3 Priority Override: If user already lives abroad (Desh-Kaal-Patra), pivot immediately from "whether you will move" to residency stability, career rooting, and homeland ties.`,
  },
  {
    slug: 'prio_health',
    category: 'priority_rule',
    display_name: 'PRIO_HEALTH — Physical Vitality & Preventive Pacing Matrix',
    subtitle: 'Domain Priority #7: Locks Lagna/Lagnesh/Sun, 6/8/12 load, D45/SAV & recovery resilience.',
    description: 'Context priority matrix for health vitality, routine pacing, and non-medical guidance.',
    tags: ['sutra', 'priority', 'health', 'remedies'],
    sort_order: 607,
    prompt_body: `DOMAIN PRIORITY MATRIX — PHYSICAL VITALITY & RECOVERY:
#1 Lead Anchor: Lagna maturity + Lagnesh PHI + Sun vitality + Active MD/AD load.
#2 Cross-Verification: 6H/8H/12H stress axes + D45/Swamsha + SAV low-bindu houses (<20) + Jupiter protective aspects.
#3 Priority Override: Distinguish temporary Dasha/Sade Sati/Maraka fatigue from chronic baseline; maintain strictly preventive, non-diagnostic framing with zero fear-mongering or ritual upsells.`,
  },
  {
    slug: 'prio_mental',
    category: 'priority_rule',
    display_name: 'PRIO_MENTAL — Emotional Steadiness & Mental Wellness Matrix',
    subtitle: 'Domain Priority #8: Locks Moon (D1/D9), Mercury, 4H/5H & temporary cloud separation.',
    description: 'Context priority matrix for stress, anxiety, overthinking, and emotional clarity.',
    tags: ['sutra', 'priority', 'mental', 'moon'],
    sort_order: 608,
    prompt_body: `DOMAIN PRIORITY MATRIX — MENTAL WELLNESS & INNER CLARITY:
#1 Lead Anchor: Moon health (D1 & D9) + Mercury + 4H/4L emotional sanctuary + 5H cognitive steadiness.
#2 Cross-Verification: Moon-Saturn / Moon-Rahu-Ketu / Kemadruma cancellations + active Sade Sati or 8H/12H transit.
#3 Priority Override: Explicitly separate temporary transit/Dasha mental fog from permanent personality wiring, highlighting protective anchors and grounded daily rhythms.`,
  },
  {
    slug: 'prio_progeny',
    category: 'priority_rule',
    display_name: 'PRIO_PROGENY — Progeny, D7 Saptamsha & Parent-Child Matrix',
    subtitle: 'Domain Priority #9: Locks 5H/5L, Putrakaraka, Jupiter, D7 & existing-children check.',
    description: 'Context priority matrix for fertility timing, childbirth, and child relationship.',
    tags: ['sutra', 'priority', 'progeny', 'children'],
    sort_order: 609,
    prompt_body: `DOMAIN PRIORITY MATRIX — PROGENY & CHILDREN:
#1 Lead Anchor: 5H/5L + Putrakaraka (PK) + Jupiter + Confirmed Children Context (Desh-Kaal-Patra).
#2 Cross-Verification: D7 (Saptamsha Lagna/5H) + 9H (5th-from-5th backup) + KP 2-5-11 significators.
#3 Priority Override: Ketu in 5H or Jupiter in 5H indicates timing nuance or independent child temperament—never absolute denial or medical claims.`,
  },
  {
    slug: 'prio_education',
    category: 'priority_rule',
    display_name: 'PRIO_EDUCATION — Academic Degrees, Exams & Learning Matrix',
    subtitle: 'Domain Priority #10: Locks 4H/5H/9H, Mercury/Jupiter, D24 & competitive vs. research.',
    description: 'Context priority matrix for education, competitive exams, and Vedic learning.',
    tags: ['sutra', 'priority', 'education', 'learning'],
    sort_order: 610,
    prompt_body: `DOMAIN PRIORITY MATRIX — EDUCATION, EXAMS & LEARNING:
#1 Lead Anchor: 4H/5H/9H + Mercury (intellect) + Jupiter (wisdom/mentorship).
#2 Cross-Verification: D24 (Chaturvimshamsha) + 6H/11H (competitive exams) vs. 8H/Ketu (deep research).
#3 Priority Override: Align exam/admission confidence strictly with active AD/PD timing and flag Badhaka distraction early.`,
  },
  {
    slug: 'prio_property',
    category: 'priority_rule',
    display_name: 'PRIO_PROPERTY — Real Estate, Home & Vehicles Matrix',
    subtitle: 'Domain Priority #11: Locks 4H/4L, Mars/Venus, D4 Chaturthamsa & KP 4-11-12.',
    description: 'Context priority matrix for property acquisition, home stability, and vehicles.',
    tags: ['sutra', 'priority', 'property', 'd4'],
    sort_order: 611,
    prompt_body: `DOMAIN PRIORITY MATRIX — PROPERTY & VEHICLES:
#1 Lead Anchor: 4H/4L + Mars (land/property) + Venus (vehicles/comfort).
#2 Cross-Verification: D4 (Chaturthamsa) + KP 4-11-12 + 4H SAV bindus.
#3 Priority Override: 4L-12H or Rahu in 4H points toward investment/away-from-hometown property; require Double Transit + Dasha confirmation for purchase timing.`,
  },
  {
    slug: 'prio_litigation',
    category: 'priority_rule',
    display_name: 'PRIO_LITIGATION — Disputes, Rivals & Resolution Matrix',
    subtitle: 'Domain Priority #12: Locks 6H/6L, Mars/Saturn, KP 6-11 vs. 6-8-12 & Vipareeta check.',
    description: 'Context priority matrix for disputes, legal battles, and conflict exit timing.',
    tags: ['sutra', 'priority', 'litigation', 'disputes'],
    sort_order: 612,
    prompt_body: `DOMAIN PRIORITY MATRIX — LITIGATION & DISPUTES:
#1 Lead Anchor: 6H/6L + Mars/Saturn + KP 6-11 (recovery/settlement) vs. 6-8-12 (drain).
#2 Cross-Verification: Vipareeta Raja Yoga + Jupiter aspect on 6H/9H + Lagnesh stamina.
#3 Priority Override: Anchor advice around exact exit dates of hostile Antardashas and cost-vs-settlement calibration—never give formal legal counsel.`,
  },
  {
    slug: 'prio_spirituality',
    category: 'priority_rule',
    display_name: 'PRIO_SPIRITUALITY — Dharma, Inner Growth & Moksha Matrix',
    subtitle: 'Domain Priority #13: Locks 9H/12H, AK/Karakamsha, D20 & grounded growth test.',
    description: 'Context priority matrix for spiritual growth, meditation, and life purpose.',
    tags: ['sutra', 'priority', 'spirituality', 'd20'],
    sort_order: 613,
    prompt_body: `DOMAIN PRIORITY MATRIX — SPIRITUALITY & INNER PATH:
#1 Lead Anchor: 9H/12H + Atmakaraka / Karakamsha + Ketu & Jupiter.
#2 Cross-Verification: D20 (Vimshamsha) + Swamsha + 4/8/12 Moksha Trikona balance.
#3 Priority Override: Test Moon/12H/Lagnesh grounding to distinguish genuine contemplative maturity from escapism during hard life chapters.`,
  },
  {
    slug: 'prio_varshaphala',
    category: 'priority_rule',
    display_name: 'PRIO_VARSHAPHALA — Life Overview, Annual Arc & General Timing Matrix',
    subtitle: 'Domain Priority #14: Locks Lagna Maturity, Command Hierarchy, Panchanga & Dasha/Transit Arc.',
    description: 'Context priority matrix for general life overviews, annual timing, and open-ended readings.',
    tags: ['sutra', 'priority', 'timing', 'overview', 'varshaphala'],
    sort_order: 614,
    prompt_body: `DOMAIN PRIORITY MATRIX — GENERAL LIFE OVERVIEW & ANNUAL TIMING:
#1 Lead Anchor: Ascendant Degree Maturity + Lagnesh PHI + Command Hierarchy (top powerhouse vs. vulnerable planets).
#2 Cross-Verification: Atmakaraka + Moon + Top Foundational Yogas (YSI >= 75) + Panchanga baseline + Active MD/AD/PD season.
#3 Priority Override: Highlight primary structural Dosha/contradiction, Bhava-Chalit shifts, and Current vs. Upcoming Slow-Planet Ingress windows clearly.`,
  },
];

const CARTRIDGE_META_LIST: FormulaCartridgeMeta[] = [
  // Group A
  { slug: 'f_neecha_bhanga', canonicalKey: 'F_NEECHA_BHANGA', group: 'A', domains: ['universal'], triggerFlags: ['neecha_bhanga'], basePriority: 88 },
  { slug: 'f_d1_d9_inversion', canonicalKey: 'F_D1_D9_INVERSION', group: 'A', domains: ['universal'], triggerFlags: ['d1_d9_inversion'], basePriority: 85 },
  { slug: 'f_karako_bhava_nashaya', canonicalKey: 'F_KARAKO_BHAVA_NASHAYA', group: 'A', domains: ['universal'], triggerFlags: ['karako_bhava_nashaya'], basePriority: 76 },
  { slug: 'f_bhavat_bhavam', canonicalKey: 'F_BHAVAT_BHAVAM', group: 'A', domains: ['universal'], basePriority: 64 },
  { slug: 'f_nakshatra_override', canonicalKey: 'F_NAKSHATRA_OVERRIDE', group: 'A', domains: ['universal'], triggerFlags: ['nakshatra_6_8_12', 'gandanta'], basePriority: 78 },
  { slug: 'f_nodal_proxy', canonicalKey: 'F_NODAL_PROXY', group: 'A', domains: ['universal'], triggerFlags: ['nodal_focus'], basePriority: 80 },
  { slug: 'f_maraka_and_dusthana_flip', canonicalKey: 'F_MARAKA_AND_DUSTHANA_FLIP', group: 'A', domains: ['universal'], triggerFlags: ['vipareeta', 'functional_flip'], basePriority: 77 },
  { slug: 'f_chalit_cusp_shift', canonicalKey: 'F_CHALIT_CUSP_SHIFT', group: 'A', domains: ['universal'], triggerFlags: ['chalit_shift'], basePriority: 90 },
  { slug: 'f_planet_distance_lens', canonicalKey: 'F_PLANET_DISTANCE_LENS', group: 'A', domains: ['universal', 'learning'], basePriority: 70 },
  { slug: 'f_kendradhipati_dosha', canonicalKey: 'F_KENDRADHIPATI_DOSHA', group: 'A', domains: ['universal'], triggerFlags: ['kendradhipati'], basePriority: 84 },
  { slug: 'f_badhaka_obstruction', canonicalKey: 'F_BADHAKA_OBSTRUCTION', group: 'A', domains: ['universal'], triggerFlags: ['badhaka'], basePriority: 84 },
  { slug: 'f_maraka_activation', canonicalKey: 'F_MARAKA_ACTIVATION', group: 'A', domains: ['universal'], triggerFlags: ['maraka_active'], basePriority: 86 },
  // Group B
  { slug: 'f_dasha_ladder', canonicalKey: 'F_DASHA_LADDER', group: 'B', domains: ['timing', 'universal'], triggerFlags: ['dasha_sandhi'], basePriority: 92 },
  { slug: 'f_degree_maturity', canonicalKey: 'F_DEGREE_MATURITY', group: 'B', domains: ['timing', 'universal'], triggerFlags: ['asc_immature_or_sandhi'], basePriority: 74 },
  { slug: 'f_double_transit_witnesses', canonicalKey: 'F_DOUBLE_TRANSIT_WITNESSES', group: 'B', domains: ['timing', 'universal'], triggerFlags: ['double_transit'], basePriority: 91 },
  { slug: 'f_slow_planet_transit', canonicalKey: 'F_SLOW_PLANET_TRANSIT', group: 'B', domains: ['timing'], basePriority: 86 },
  { slug: 'f_obstruction_gate', canonicalKey: 'F_OBSTRUCTION_GATE', group: 'B', domains: ['timing', 'universal'], triggerFlags: ['obstruction_gate'], basePriority: 87 },
  // Group C
  { slug: 'f_marriage_reality_d9', canonicalKey: 'F_MARRIAGE_REALITY_D9', group: 'C', domains: ['marriage', 'relationships'], basePriority: 95 },
  { slug: 'f_marriage_10_timing_locks', canonicalKey: 'F_MARRIAGE_10_TIMING_LOCKS', group: 'C', domains: ['marriage'], basePriority: 95 },
  { slug: 'f_marriage_conditional_reorder', canonicalKey: 'F_MARRIAGE_CONDITIONAL_REORDER', group: 'C', domains: ['marriage'], triggerFlags: ['7h_friction'], basePriority: 94 },
  { slug: 'f_divorce_risk_6_pillars', canonicalKey: 'F_DIVORCE_RISK_6_PILLARS', group: 'C', domains: ['marriage', 'synastry'], basePriority: 93 },
  { slug: 'f_wealth_after_marriage_index', canonicalKey: 'F_WEALTH_AFTER_MARRIAGE_INDEX', group: 'C', domains: ['marriage', 'wealth'], basePriority: 89 },
  { slug: 'f_synastry_core', canonicalKey: 'F_SYNASTRY_CORE', group: 'C', domains: ['synastry', 'marriage', 'relationships'], basePriority: 96 },
  // Group D
  { slug: 'f_career_d10_and_amk', canonicalKey: 'F_CAREER_D10_AND_AMK', group: 'D', domains: ['career'], basePriority: 95 },
  { slug: 'f_job_vs_business', canonicalKey: 'F_JOB_VS_BUSINESS', group: 'D', domains: ['career'], basePriority: 94 },
  { slug: 'f_artha_shastra_wealth', canonicalKey: 'F_ARTHA_SHASTRA_WEALTH', group: 'D', domains: ['wealth'], basePriority: 95 },
  { slug: 'f_debt_recovery_strategy', canonicalKey: 'F_DEBT_RECOVERY_STRATEGY', group: 'D', domains: ['wealth'], basePriority: 94 },
  { slug: 'f_foreign_relocation', canonicalKey: 'F_FOREIGN_RELOCATION', group: 'D', domains: ['foreign'], basePriority: 95 },
  // Group E
  { slug: 'f_physical_vitality_and_recovery', canonicalKey: 'F_PHYSICAL_VITALITY_AND_RECOVERY', group: 'E', domains: ['health', 'remedies'], basePriority: 95 },
  { slug: 'f_mental_wellness_axis', canonicalKey: 'F_MENTAL_WELLNESS_AXIS', group: 'E', domains: ['mental', 'health'], basePriority: 95 },
  // Group F
  { slug: 'f_progeny_d7_and_pk', canonicalKey: 'F_PROGENY_D7_AND_PK', group: 'F', domains: ['progeny'], basePriority: 95 },
  { slug: 'f_education_d24_and_exams', canonicalKey: 'F_EDUCATION_D24_AND_EXAMS', group: 'F', domains: ['education'], basePriority: 95 },
  { slug: 'f_property_d4_and_assets', canonicalKey: 'F_PROPERTY_D4_AND_ASSETS', group: 'F', domains: ['property'], basePriority: 95 },
  { slug: 'f_litigation_and_rivals', canonicalKey: 'F_LITIGATION_AND_RIVALS', group: 'F', domains: ['litigation'], basePriority: 95 },
  { slug: 'f_spirituality_d20_and_moksha', canonicalKey: 'F_SPIRITUALITY_D20_AND_MOKSHA', group: 'F', domains: ['spirituality'], basePriority: 95 },
  { slug: 'f_varshaphala_and_panchanga', canonicalKey: 'F_VARSHAPHALA_AND_PANCHANGA', group: 'F', domains: ['timing', 'open'], basePriority: 90 },
];

export const FORMULA_CARTRIDGE_META_BY_SLUG: Record<string, FormulaCartridgeMeta> = Object.fromEntries(
  CARTRIDGE_META_LIST.map((m) => [m.slug, m])
);

const DOMAIN_TO_PRIORITY_SLUG: Record<string, string> = {
  marriage: 'prio_marriage',
  synastry: 'prio_synastry',
  relationships: 'prio_synastry',
  career: 'prio_career',
  wealth: 'prio_wealth_debt',
  foreign: 'prio_foreign',
  health: 'prio_health',
  remedies: 'prio_health',
  mental: 'prio_mental',
  progeny: 'prio_progeny',
  education: 'prio_education',
  learning: 'prio_education',
  property: 'prio_property',
  litigation: 'prio_litigation',
  spirituality: 'prio_spirituality',
  timing: 'prio_varshaphala',
  open: 'prio_varshaphala',
};

export function resolvePriorityRuleSlug(
  priorityDomain: string,
  playbookId: string,
  requiresSynastry?: boolean
): string {
  if (requiresSynastry) return 'prio_synastry';
  if (['CAR_02', 'CAR_12', 'CAR_15'].includes(playbookId)) {
    return 'prio_business_vs_job';
  }
  const normalized = (priorityDomain || '').trim().toLowerCase();
  return DOMAIN_TO_PRIORITY_SLUG[normalized] || 'prio_varshaphala';
}
