# Cosmic Council — Canonical Question Library & Playbook Map (v1)

> **Purpose:** 85–90% of user astrology consultations map cleanly to ~150 repeatable questions.  
> TypeSafe **Jev** (`choice` primitive, supports up to 255 options in 70–500ms) classifies incoming messages directly into a **Canonical Question ID** (or `OPEN_ENDED_SYNTHESIS` for the ~10% novel queries).  
> Each Playbook deterministically locks: **(1) Intent Type, (2) Required Clarification Checks, (3) Exact Chart Data Slice, and (4) Formula Cartridges & Priority Rules.**

---

## Legend: Intent Types
- **`CONVERSATIONAL`** — Narrative, warm, minimal jargon, 1–2 anchors (`Moon + current MD/AD/Gochar`).
- **`SOFT_HORIZON`** — 10–40yr open question. **No single binary verdict.** Competing Supporting vs. Friction Weights + Dasha Phase Arcs + Short Synthesis.
- **`HARD_DECISION`** — Yes/No/Choice/Risk adjudication. **3-Gate Law** + **2–4 Ranked Outcomes** with **Convergence Score** + Cancellations.
- **`TIMING`** — "When?" Multi-clock stack (**Vimshottari MD/AD/PD + Chara Dasha + Gochar + KP**), ranked top 2–3 date windows.
- **`PEER_AUDIT`** — Technical chart verification / user asking about specific placements, Yogas, or D-charts.

---

## 1. Marriage, Love & Relationships (`domain: marriage | love | synastry`) — 34 Questions

| ID | Canonical Question | Intent | Clarify If Missing | Required Chart Slice | Formulas Triggered |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `MAR_01` | Will I get married at all / does my chart support marriage? | `HARD_DECISION` | Marital status, Age | D1(1,2,7,11,Ven,Jup), D9(1,7,Ven), UL, DK, KP 7th CSL, Active MD/AD | `F_MARRIAGE_REALITY_D9`, `F_MARRIAGE_CONDITIONAL_REORDER` |
| `MAR_02` | When am I likely to get married? (Exact timing / age) | `TIMING` | Marital status! (Trap check), Age | D1+D9 7H/7L, Ven/Jup, UL, KP 2-7-11 CSL, Vimshottari MD/AD/PD, Chara Dasha, Jup/Sat Gochar | `F_MARRIAGE_10_TIMING_LOCKS`, `F_DASHA_LADDER`, `F_GOCHAR_TRIGGER` |
| `MAR_03` | How will my married life be overall? (20–40yr trajectory) | `SOFT_HORIZON` | Already married or unmarried? | D1+D9(1,2,4,7,8,12), Ven, Moon, UL+2nd from UL, Yogas/Doshas, MD trajectory | `F_MARRIAGE_REALITY_D9`, `F_D1_D9_INVERSION` |
| `MAR_04` | Love marriage vs. arranged marriage (or hybrid)? | `HARD_DECISION` | Cultural context / current partner? | 5H/7H/9H/11H/12H links, Ven-Rahu/Mars, D9 7H/Ven, KP 5-7-11 vs 2-7-11 | `F_MARRIAGE_REALITY_D9`, `F_NODAL_PROXY` |
| `MAR_05` | What will my spouse be like (13-pillar character, temper, loyalty, profession)? | `CONVERSATIONAL` + `PEER_AUDIT` | — | 7H/7L(D1+D9), D9 Lagna/Lord, DK(D1+D9), Moon/4H, Ven/Jup, Angarak/Shrapit/Punarphoo flags | `F_MARRIAGE_REALITY_D9`, `F_NAKSHATRA_OVERRIDE` |
| `MAR_06` | Where and how am I likely to meet my future spouse? | `CONVERSATIONAL` | Currently dating anyone? | 7L placement/house, 5H/9H/11H/12H, Rahu, DK Nakshatra, active AD/Transit | `F_MARRIAGE_REALITY_D9`, `F_FOREIGN_RELOCATION` |
| `MAR_07` | Spouse from hometown vs. different city/culture/country? | `HARD_DECISION` | — | 7L in 9/12, Rahu/Ven/D9 7H, 3/9/12 links, Moon/4H | `F_FOREIGN_RELOCATION`, `F_NODAL_PROXY` |
| `MAR_08` | Are there chances of separation, divorce, or second marriage? | `HARD_DECISION` | Current marital stress or hypothetical? | 7H/7L, 6/8/12 links, Sat+Mars stack, UL+2nd from UL, Ven combust/D9, DK affliction, Active MD/AD | `F_DIVORCE_RISK_6_PILLARS`, `F_MARRIAGE_CONDITIONAL_REORDER`, `F_OBSTRUCTION_GATE` |
| `MAR_09` | Why is my marriage delayed, and is it delay or denial? | `HARD_DECISION` | Age, relationship history | Saturn/Rahu on 1/7/Ven, KP 7th CSL, D9 7H, Age/Dashas | `F_MARRIAGE_CONDITIONAL_REORDER`, `F_DEGREE_MATURITY` |
| `MAR_10` | Why do my relationships keep failing / karmic patterns in love? | `CONVERSATIONAL` | — | 5H/7H/8H/12H, Moon/Venus D1+D9, Ketu/Rahu, DK-AK link | `F_MARRIAGE_REALITY_D9`, `F_NODAL_PROXY` |
| `MAR_11` | Will I reconcile with an ex / is a current on-off bond my spouse? | `HARD_DECISION` | Timeline of relationship & breakup | 5H/7H/11H, Retrograde 7L/Ven, Dasha/PD continuity, KP 5-7-11 vs 6-8-12 | `F_OBSTRUCTION_GATE`, `F_DOUBLE_TRANSIT_WITNESSES` |
| `MAR_12` | Will I find new love soon? (Dating / romantic timeline) | `TIMING` | Relationship status | 5H/7H/11H, Ven/Moon, Active AD/PD + Venus/Jupiter Gochar | `F_DASHA_LADDER`, `F_SLOW_PLANET_TRANSIT` |
| `MAR_13` | Relationship with in-laws & joint vs. independent living? | `SOFT_HORIZON` | Married or planning? | 2H/4H/8H/9H (3rd from 7th), Moon/Jup in 4H, 7L in 12H | `F_BHAVAT_BHAVAM`, `F_MARRIAGE_REALITY_D9` |
| `MAR_14` | Career, luck, and financial growth after marriage (0–100 index)? | `SOFT_HORIZON` | — | 2H/8H/11H, Dhana Yogas, 7L linking 2/8/11, UL+2nd from UL, D9 wealth | `F_WEALTH_AFTER_MARRIAGE_INDEX`, `F_BHAVAT_BHAVAM` |
| `MAR_15` | Spouse financial background (wealthy / family status / self-made)? | `CONVERSATIONAL` | — | 7L, 8H (spouse wealth), 2nd from 7H, D9 2H/11H, DK strength | `F_WEALTH_AFTER_MARRIAGE_INDEX`, `F_MARRIAGE_REALITY_D9` |
| `MAR_16` | Will my partner support my career & independence (or dominate)? | `SOFT_HORIZON` | — | Sun/Mars/Saturn on 7H/D9 7H, 7L vs Lagnesh Shadbala, 10H-7H link | `F_MARRIAGE_REALITY_D9` |
| `MAR_17` | Emotional, intellectual & physical/sexual compatibility tendencies? | `CONVERSATIONAL` | — | Moon, Venus, Mars, 5H/7H/8H/12H in D1+D9, Scorpio/Ketu | `F_MARRIAGE_REALITY_D9` |
| `MAR_18` | Progeny / children: likelihood, delays, timing, bond with kids? | `HARD_DECISION` + `TIMING` | Married / age / trying? | 5H/5L (D1+D9+D7 Saptamsha), Jupiter, PK, KP 2-5-11, Ketu/5H, Active MD/AD | `F_KARAKO_BHAVA_NASHAYA`, `F_DASHA_LADDER` |
| `MAR_19` | How will we handle conflict & what red flags should I vet for? | `CONVERSATIONAL` | — | 6H/Mars/Moon-Saturn/7L dignity, D9 Moon/Mercury, AL vs D9 | `F_MARRIAGE_REALITY_D9` |
| `MAR_20` | Spouse health or longevity concerns? | `HARD_DECISION` | — | 7H/7L, 8H (2nd from 7th), 12H (6th from 7th), D9 7L | `F_BHAVAT_BHAVAM`, `F_PHYSICAL_VITALITY_AND_RECOVERY` |
| `MAR_21` | Marriage Yogas & Doshas influencing my love/married life (ranked) | `PEER_AUDIT` | — | Full Marriage Yoga/Dosha list from Natal Truth JSON + D9 | `F_MARRIAGE_REALITY_D9`, `F_NEECHA_BHANGA` |
| `MAR_22` | Synastry: Are we genuinely compatible / separation risk score (0–100)? | `HARD_DECISION` | Second profile attached? | Both D1+D9, UL, 6/8/12 overlays, Mutual afflictions, Dosha Samyam, Mutual Dashas | `F_DIVORCE_RISK_6_PILLARS`, `F_SYNASTRY_CORE`, `F_MARRIAGE_10_TIMING_LOCKS` |
| `MAR_23` | Synastry: Karmic vs. sustainable love (attraction vs. longevity)? | `SOFT_HORIZON` | Second profile attached? | Nodes on 1/7/Ven/Moon, Venus-Mars 2/12, Saturn-Moon, D9 lagna match | `F_SYNASTRY_CORE` |
| `MAR_24` | Synastry: Best combined timing window for commitment/wedding? | `TIMING` | Second profile attached? | Dual Vimshottari MD/AD + Dual Jupiter/Saturn Gochar over 7H/D9 | `F_MARRIAGE_10_TIMING_LOCKS` |

*(Plus quick sub-variants: domestic peace `MAR_25`, arranged match vetting `MAR_26`, age gap/maturity `MAR_27`, infidelity/secrecy fears `MAR_28`, widowhood/late companion `MAR_29`, live-in vs formal marriage `MAR_30`, spouse looks/temperament `MAR_31`, partner relocation after marriage `MAR_32`, family opposition to marriage `MAR_33`, why attracted to unavailable partners `MAR_34`.)*

---

## 2. Career, Vocation & Authority (`domain: career`) — 28 Questions

| ID | Canonical Question | Intent | Clarify If Missing | Required Chart Slice | Formulas Triggered |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `CAR_01` | Which career, industry, or role fits my talents best? | `SOFT_HORIZON` | Current field / experience level | 10H/10L (D1+D10), Lagnesh, AmK, Sun/Merc/Sat/Mars, Nakshatra of 10L/AmK | `F_CAREER_D10_AND_AMK`, `F_NAKSHATRA_OVERRIDE` |
| `CAR_02` | Job/employee vs. starting my own business / freelancing? | `HARD_DECISION` | Capital / current job status | 6H vs 7H/3H/11H, D10, Rahu/Merc/Sat Shadbala, KP 6-10-11 vs 7-10-11 | `F_JOB_VS_BUSINESS`, `F_CAREER_D10_AND_AMK` |
| `CAR_03` | When is my next promotion, hike, or career breakthrough? | `TIMING` | Current role / industry | Active MD/AD/PD, 10L/11L/6L, D10, KP 2-6-10-11 CSL, Jup/Sat Gochar | `F_DASHA_LADDER`, `F_GOCHAR_TRIGGER`, `F_CAREER_D10_AND_AMK` |
| `CAR_04` | Is now a good time to quit my job or switch careers? | `HARD_DECISION` | Have an offer already, or quitting blind? | Active MD/AD/PD, 6/8/12 AD check, Saturn/Rahu Gochar over 10H/Moon, KP 10/11 | `F_OBSTRUCTION_GATE`, `F_DEGREE_MATURITY`, `F_DASHA_LADDER` |
| `CAR_05` | Why does my career feel stuck lately, and when will it move? | `CONVERSATIONAL` + `TIMING` | — | Current MD/AD/PD, Sandhi/retrograde triggers, Sade Sati, 8/12 transits | `F_DASHA_LADDER`, `F_OBSTRUCTION_GATE`, `F_GOCHAR_TRIGGER` |
| `CAR_06` | What is the golden period / peak of my career life-arc? | `TIMING` + `SOFT_HORIZON` | Age | 100yr Vimshottari MD ladder cross-checked against Top Career Yogas & D10 | `F_CAREER_D10_AND_AMK`, `F_D1_D9_INVERSION` |
| `CAR_07` | Home city vs. moving abroad/other city for career success? | `HARD_DECISION` | Willingness / visa stage | 4H vs 9H/12H/3H, Rahu, D4+D10, KP 3-9-12 vs 4-11 | `F_FOREIGN_RELOCATION`, `F_CAREER_D10_AND_AMK` |
| `CAR_08` | Will I reach leadership, fame, high status, or behind-the-scenes work? | `SOFT_HORIZON` | — | Sun/10H/AL/A10, Mahapurusha/Dharma-Karma YSI, 12H/Ketu influence | `F_CAREER_D10_AND_AMK`, `F_D1_D9_INVERSION` |
| `CAR_09` | Job loss / layoff risk or contract renewal right now? | `HARD_DECISION` | Industry climate / notice status | Active AD/PD 6/8/12 links, KP 5/8/12 vs 6/10/11, Maraka/Rahu transit | `F_OBSTRUCTION_GATE`, `F_GOCHAR_TRIGGER` |
| `CAR_10` | Side hustle / secondary income source alignment? | `CONVERSATIONAL` | — | 3H/5H/11H, Merc/Ven/Rahu, D10 3/11 | `F_JOB_VS_BUSINESS`, `F_WEALTH_VS_RETENTION` |
| `CAR_11` | Workplace politics, relationship with boss & colleagues? | `CONVERSATIONAL` | — | 6H (rivals), 9H/Sun (boss), 11H (peers), Saturn/Mars/Rahu | `F_CAREER_D10_AND_AMK` |
| `CAR_12` | Partnership business vs. solo entrepreneurship? | `HARD_DECISION` | — | 7H/7L + D9 + D10 7H, Mars/Merc/Rahu, 6/8/12 links to 7L | `F_JOB_VS_BUSINESS`, `F_MARRIAGE_REALITY_D9` |
| `CAR_13` | Career Yogas & Doshas ranked (including D10 & Command Hierarchy)? | `PEER_AUDIT` | — | Career Yogas YSI, D10 shifts, AmK, Shadbala, SAV 10H | `F_CAREER_D10_AND_AMK`, `F_NEECHA_BHANGA` |
| `CAR_14` | Major career shifts over the next 5 years? | `TIMING` | — | Next 5yr MD/AD/PD + Saturn/Jupiter/Rahu Gochar | `F_DASHA_LADDER`, `F_GOCHAR_TRIGGER` |

*(Plus sub-variants: startup launch window `CAR_15`, creative vs corporate `CAR_16`, mentorship/consulting fit `CAR_17`, government/PSU vs private `CAR_18`, burnout & career boundaries `CAR_19`, salary negotiation timing `CAR_20`, public visibility/media `CAR_21`, early struggle vs late bloom `CAR_22`, mid-career pivot `CAR_23`, remote/global career `CAR_24`, career recovery after gap `CAR_25`, co-founder compatibility `CAR_26`, licensing/board exams for work `CAR_27`, retirement transition `CAR_28`.)*

---

## 3. Wealth, Finance, Assets & Risk (`domain: wealth`) — 26 Questions

| ID | Canonical Question | Intent | Clarify If Missing | Required Chart Slice | Formulas Triggered |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `WLT_01` | Will I build true financial abundance / high net worth? | `SOFT_HORIZON` | Age / career context | 2/5/9/11 lords, Dhana YSI, Jupiter/Ven/Lagnesh, D2 Hora, Daridra flags | `F_WEALTH_VS_RETENTION`, `F_D1_D9_INVERSION` |
| `WLT_02` | Why do I earn well / work hard but fail to save (money leakage)? | `CONVERSATIONAL` | — | 2L in 12H, 11L afflicted, 8H/12H Ven/Moon, SAV 2H vs 12H | `F_WEALTH_VS_RETENTION`, `F_OBSTRUCTION_GATE` |
| `WLT_03` | Best time to start a business, sign contracts, or make a major investment? | `TIMING` | Type of investment/contract | Active MD/AD/PD, 2/5/9/11 lords, KP 2-6-11, Mercury/Jupiter Gochar | `F_DASHA_LADDER`, `F_GOCHAR_TRIGGER` |
| `WLT_04` | Stock market, trading, crypto, or speculative wealth suitability? | `HARD_DECISION` | Active trader vs long-term investor? | 5H/5L, 8H, Rahu, Mercury, KP 5-8-11 vs 6-12 | `F_WEALTH_VS_RETENTION`, `F_NODAL_PROXY` |
| `WLT_05` | Buying a house, real estate, property, or vehicle timing? | `TIMING` + `HARD_DECISION` | — | 4H/4L, Mars, Venus, D4 Chaturthamsa, KP 4-11-12, Active MD/AD + Gochar | `F_WEALTH_VS_RETENTION`, `F_GOCHAR_TRIGGER` |
| `WLT_06` | Will I clear crushing debt / financial losses, and what's the recovery strategy? | `TIMING` + `HARD_DECISION` | Current income mode (job/business)? | 6H(debt)/8H(loss)/12H(drain), 2L+11L in D1 & D9, Daridra, Sat/Rahu/12L AD exit, Jup Gochar | `F_DEBT_RECOVERY_STRATEGY`, `F_ARTHA_SHASTRA_WEALTH`, `F_OBSTRUCTION_GATE` |
| `WLT_07` | Sudden financial windfall, equity exit, or inheritance? | `HARD_DECISION` | — | 8H/8L, 2H, 5H, Rahu/Ketu, Vipareeta Raja Yoga YSI, D2/D4 | `F_WEALTH_VS_RETENTION`, `F_NODAL_PROXY` |
| `WLT_08` | Risk of financial loss in the near future & years to be cautious? | `TIMING` | — | Upcoming 6/8/12 ADs, Maraka/Daridra activation, Saturn/Rahu Gochar over 2/8/11 | `F_OBSTRUCTION_GATE`, `F_GOCHAR_TRIGGER` |
| `WLT_09` | Self-made wealth vs. family inheritance / spouse support? | `CONVERSATIONAL` | — | 2H/4H/9H (ancestral) vs 3/6/10/11 (self-made) vs 7H/8H (spouse) | `F_WEALTH_VS_RETENTION`, `F_BHAVAT_BHAVAM` |
| `WLT_10` | Wealth comfort & security in retirement / later years? | `SOFT_HORIZON` | Age | 4H, 9H, 11H, D9 reinforcement, Late-life MD sequence | `F_WEALTH_VS_RETENTION`, `F_D1_D9_INVERSION` |

*(Plus sub-variants: wealth yogas & doshas audit `WLT_11`, dry-spell navigation `WLT_12`, hometown vs abroad wealth `WLT_13`, luxury & status `WLT_14`, legal/tax dispute risk `WLT_15`, passive rental income `WLT_16`, spending psychology `WLT_17`, inheritance disputes `WLT_18`, legacy for children `WLT_19`, lending money risk `WLT_20`–`WLT_26`.)*

---

## 4. Physical Health, Vitality & Mental Wellness (`domain: health | mental`) — 26 Questions

*(Strict safety guardrail: Preventive, constitutional, and stress-management insight only—never medical diagnosis or treatment claims.)*

| ID | Canonical Question | Intent | Clarify If Missing | Required Chart Slice | Formulas Triggered |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `HLT_01` | General physical vitality, immunity & constitutional vulnerabilities? | `SOFT_HORIZON` | Age / any ongoing concern? | Lagna/Lagnesh, Sun, 6/8/12, D9/D45/D60, Karakamsha/Swamsha, SAV 1/6/8 | `F_PHYSICAL_VITALITY_AND_RECOVERY` |
| `HLT_02` | Why do I feel exhausted / low energy lately, and when will it lift? | `CONVERSATIONAL` + `TIMING` | — | Active MD/AD/PD (Dusthana/Maraka?), Moon/Sun transits, Sade Sati | `F_PHYSICAL_VITALITY_AND_RECOVERY`, `F_GOCHAR_TRIGGER` |
| `HLT_03` | Chronic health tendencies, recovery strength & longevity outlook? | `SOFT_HORIZON` | Age | Lagnesh + 8H/8L + Jupiter protection, D45/D60, Benefic load on 1/6/8 | `F_PHYSICAL_VITALITY_AND_RECOVERY`, `F_D1_D9_INVERSION` |
| `HLT_04` | Accident, surgery, or sudden physical-caution periods? | `TIMING` | — | 6/8/12, Mars/Rahu/Ketu, D30/D45/D60, tight transit triggers | `F_PHYSICAL_VITALITY_AND_RECOVERY`, `F_OBSTRUCTION_GATE` |
| `HLT_05` | Why do I feel anxious / depressed / restless even when life looks fine? | `CONVERSATIONAL` | — | Moon (D1+D9), Mercury, 4H/5H/12H, Moon-Sat/Rahu/Ketu, Kemadruma | `F_MENTAL_WELLNESS_AXIS`, `F_D1_D9_INVERSION` |
| `HLT_06` | When will this heavy emotional cloud lift (mental wellness timing)? | `TIMING` | — | Moon/4L AD/PD shifts, Sade Sati/Dhaiya transit exit dates, Jupiter Gochar | `F_MENTAL_WELLNESS_AXIS`, `F_GOCHAR_TRIGGER` |
| `HLT_07` | Burnout cycles, overthinking, sleep issues & nervous-system load? | `CONVERSATIONAL` | — | 12H (sleep), Moon/Mercury (mind), Mars-Merc, 6H work overload | `F_MENTAL_WELLNESS_AXIS`, `F_PHYSICAL_VITALITY_AND_RECOVERY` |
| `HLT_08` | Career stress spilling into physical/mental health? | `CONVERSATIONAL` | — | 10H-6H-8H-Moon/Lagnesh links, Sat/Rahu on 1/4/10 | `F_MENTAL_WELLNESS_AXIS`, `F_CAREER_D10_AND_AMK` |
| `HLT_09` | Best routine, fitness start timing, and grounding habits for my chart? | `CONVERSATIONAL` | — | Lagna element, 6H/Moon/Mars, upcoming supportive AD/Gochar | `F_PHYSICAL_VITALITY_AND_RECOVERY` |
| `HLT_10` | Health & mental wellness Yogas/Doshas ranked (D45/D60/Ashtakavarga)? | `PEER_AUDIT` | — | Full Health Yoga/Dosha list, D45/D60, Swamsha, SAV/BAV 1/6/8/12 | `F_PHYSICAL_VITALITY_AND_RECOVERY`, `F_MENTAL_WELLNESS_AXIS` |

*(Plus sub-variants: body systems/digestive/heart/bone tendencies `HLT_11`–`HLT_14`, hereditary flags `HLT_15`, sensitivity/absorbing others' emotions `HLT_16`, fear of future/control `HLT_17`, loneliness vs solitude `HLT_18`, healing windows `HLT_19`–`HLT_26`.)*

---

## 5. Timing, Transits & Life Transitions (`domain: timing`) — 14 Questions

| ID | Canonical Question | Intent | Clarify If Missing | Required Chart Slice | Formulas Triggered |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `TIM_01` | What is my current Mahadasha / Antardasha really doing to my life? | `CONVERSATIONAL` + `PEER_AUDIT` | — | Active MD/AD/PD lords (D1+D9+Shadbala+Nakshatra+Lordships+Gochar) | `F_DASHA_LADDER`, `F_DEGREE_MATURITY`, `F_OBSTRUCTION_GATE` |
| `TIM_02` | How will the next 12 months / 2026–2027 unfold for me? | `TIMING` | Primary focus area? | Active MD/AD/PD + Chara Dasha + Jupiter/Saturn/Rahu-Ketu entry-exit dates | `F_DASHA_LADDER`, `F_GOCHAR_TRIGGER` |
| `TIM_03` | Upcoming Mahadasha change / Dasha Sandhi (final 10%): what shifts? | `TIMING` | — | Outgoing vs incoming MD lords (6/8/12 or 5/9/Kendra shift?), D9 comparison, Sandhi timing | `F_DASHA_LADDER`, `F_D1_D9_INVERSION` |
| `TIM_04` | How will Jupiter's / Saturn's Double Transit & Rahu-Ketu affect me? | `TIMING` | — | Dual Sat+Jup aspects over houses/natal planets, Mars trigger, SAV/BAV bindus in transit sign | `F_DOUBLE_TRANSIT_WITNESSES`, `F_SLOW_PLANET_TRANSIT`, `F_OBSTRUCTION_GATE` |
| `TIM_05` | Am I in Sade Sati / Ashtama Shani / Rahu MD — should I worry? | `CONVERSATIONAL` | — | Moon sign vs transit Saturn, Saturn's functional nature + BAV bindus + MD support | `F_GOCHAR_TRIGGER`, `F_MARAKA_AND_DUSTHANA_FLIP`, `F_NODAL_PROXY` |
| `TIM_06` | When will this difficult phase finally stabilize? | `TIMING` | What area feels hardest? | End dates of hostile AD/PD/Gochar + next stabilizing benefic activation | `F_OBSTRUCTION_GATE`, `F_GOCHAR_TRIGGER` |
| `TIM_07` | Best upcoming auspicious window (Muhurta-style) for a major launch? | `TIMING` | Type of milestone (wedding/business/move) | PD + Jupiter/Moon transits + Ruling/supportive days | `F_DASHA_LADDER`, `F_GOCHAR_TRIGGER` |

*(Plus sub-variants: Rahu MD fear `TIM_08`, Ketu MD detachment `TIM_09`, Saturn MD reality `TIM_10`, past-event verification / chart sanity check `TIM_11`–`TIM_14`.)*

---

## 6. Foreign Settlement, Education, Children, Remedies & Learning — 24 Questions

| Group | Canonical Playbook IDs | Intent | Core Chart Slice |
| :--- | :--- | :--- | :--- |
| **Foreign / Relocation** (`FOR_01`–`FOR_05`) | Permanent settlement abroad; Visa/PR approval timing; Study abroad; Return to homeland vs stay abroad | `HARD_DECISION` / `TIMING` | `4H/9H/12H/3H`, `Rahu`, `D4`, `KP 3-9-12`, MD/AD + Gochar |
| **Education & Exams** (`EDU_01`–`EDU_05`) | Best academic field/degree; Clearing competitive/govt/board exams; Research/PhD vs practical degree; Timing of admission | `HARD_DECISION` / `TIMING` | `4H/5H/9H`, `Mercury/Jupiter`, `D24 Chaturvimshamsha`, `KP 4-9-11`, AD/PD |
| **Remedies, Karma & Growth** (`REM_01`–`REM_05`) | Grounded behavioral/lifestyle remedies (zero superstition/expensive rituals!); Past-life karmic themes (`AK/Ketu/D60`); Meditation/spiritual path fit | `CONVERSATIONAL` | `AK/Karakamsha/D20/D60`, afflicted lords, `F_NEECHA_BHANGA` |
| **Chart Mechanics & Technical Audits** (`LRN_01`–`LRN_11`) | *"Explain my Ascendant / Atmakaraka / strongest Yoga"*; *"Test my chart for Neecha Bhanga / Vipareeta"*; *"What does KP Sub-Lord X mean in my chart?"*; *"Which planet is my real powerhouse?"*; **`LRN_10`: Deep Single-Planet Profile** (`F_PLANET_DISTANCE_LENS`); **`LRN_11`: Personality, Attachment & Karmic Wiring** (conscious vs. subconscious vs. karmic, zero prediction) | `CONVERSATIONAL` / `PEER_AUDIT` | Natal Truth Object + Specific Chart Slice |
| **Open-Ended Fallback** (`OPEN_ENDED_SYNTHESIS`) | Novel ~10% edge-case questions that don't match Playbooks `1–158` cleanly | Dynamic (`Jev` picks Intent + Fluency) | Full Natal Truth Object + Dynamic Domain Slicer |

---

## Implementation Note for `Jev` Router
- Total named Playbooks above: **~158** (well within `Jev`'s **255-option `choice` limit**).
- Every Playbook maps cleanly in TypeScript to a typed config object:
  `{ id, domain, defaultIntent, requiredContextFields, dataSliceKeys, formulaCartridgeIds, defaultPriorityRule }`.
- When `Jev` confidence on `choice(playbook)` is `< 0.65`, or when `requiredContextFields` (like `maritalStatus` for `MAR_02`) are missing/conflicting, Stage 1 cleanly triggers **1–2 targeted clarifying questions** instead of guessing.
