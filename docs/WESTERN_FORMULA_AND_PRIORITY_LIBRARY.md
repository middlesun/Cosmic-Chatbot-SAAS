# Western Astrology Formula & Context Priority Library (Cosmic Council v0.8)

> **Purpose:** Complete Western Tropical (Classical + Modern Psychological) interpretive rulebook matching the Vedic library's Tier-1 reasoning rigor, formula cartridges, cancellation/mitigation logic, and domain priority matrices. Plugs directly into Stages 1, 2, 3, and 4 of the Cosmic Council Consultation Engine (`tradition: 'western'`).

---

## 1. Tier-1 Western Adjudication Laws

1. **8 Final Judgment Gradations (No Shallow Binary Bias):**
   - `Strong Manifestation | Moderate Manifestation | Conditional Manifestation | Partial Manifestation | Delayed Manifestation | Temporary Obstruction | Modified Expression | Practical Denial`
2. **Independent Evidence Rule:**
   - Confidence rises ONLY when independent layers converge:
     1. **Natal Promise & Tight-Orb Aspects** (`< 2°` Core Structural aspects + Aspect Configurations)
     2. **Sect & Essential/Accidental Dignity** (Day/Night Sect alignment, Domicile/Exaltation/Detriment/Fall, Mutual Reception, Angularity)
     3. **House Cusp Rulers & Dispositor Tree** (Placidus cusp ruler + occupants + Chart Ruler)
     4. **Multi-Clock Western Timing** (Annual Profection Lord of the Year + Secondary Progressions + Solar Return + Outer Transits `<= 2.5°`)
   - Three restatements of the same sun-sign trait count as **ONE** indicator, never three.
3. **Orb Tightness Tiering (`< 2°` vs `2°–5°` vs `> 5°`):**
   - **Core Structural (`<= 2.0°`):** Defining psychological and event signatures; high predictive weight.
   - **Active (`2.01°–5.0°`):** Clear secondary dynamics and supporting context.
   - **Background (`> 5.0°`):** Subtle atmospheric flavor unless involving Luminaries (`Sun`/`Moon`) or exact Angles (`AC`/`MC`); never treat an `8°` wide aspect as decisive on its own.
4. **Day vs. Night Sect Polarity:**
   - **Diurnal (Day) Chart (`Sun` in Placidus Houses 7–12):** `Sun` is Sect Light; `Jupiter` is Benefic of Sect (most constructive ease); `Saturn` is Malefic of Sect (disciplined, constructive boundary); `Mars` is Contrary-to-Sect Malefic (requires conscious channeling); `Venus` is Contrary-to-Sect Benefic (softer or mixed).
   - **Nocturnal (Night) Chart (`Sun` in Placidus Houses 1–6):** `Moon` is Sect Light; `Venus` is Benefic of Sect (most harmonious flow); `Mars` is Malefic of Sect (focused stamina and drive); `Saturn` is Contrary-to-Sect Malefic (heavier restraint/delay); `Jupiter` is Contrary-to-Sect Benefic (abundant, sometimes excessive).
5. **Essential, Accidental & Mutual Reception Rescue:**
   - Never treat `Detriment` or `Fall` as permanent failure without checking **Mutual Reception** (two planets occupying each other's signs of Domicile or Exaltation), **Sect mitigation**, **Angularity (H1/H10/H7/H4)**, or **tight trine/sextile support from the Benefic of Sect**.
   - **Solar Proximity:** `Cazimi` (`< 0.28°` from Sun = rare clarity/elevation) vs. `Combust` (`< 8.5°` from Sun excluding Sun/Cazimi = internal intensity or blind spot needing conscious pacing).
6. **Truth Gate Conflict Hierarchy (Western):**
   1. **Tight Natal Aspects (`< 2°`) & Aspect Configurations** (T-Square, Grand Trine, Grand Cross, Yod, Stellium)
   2. **Essential/Accidental Dignity + Mutual Reception + Sect Polarity**
   3. **Placidus House Cusp Rulers, Chart Ruler & Angles (`AC/MC/DC/IC`)**
   4. **Multi-Clock Timing Gate** (Annual Profection Lord + Secondary Progressed Moon/Sun + Solar Return + Outer Transit `<= 2.5°`)
   5. **Generic Sun-Sign / Stereotype Reading** (lowest authority — never overrides chart-specific aspects or dignity)

---

## 2. Western Formula Cartridges (`w_*`)

### Group A — Core Mechanics, Dignity & Configurations
- **`w_sect_polarity`**: Evaluates Diurnal vs. Nocturnal Sect, Sect Light, Benefic of Sect vs. Contrary-to-Sect, and how Sect alters Saturn/Mars friction and Jupiter/Venus ease.
- **`w_tight_orb_priority`**: Enforces `< 2°` Core Structural aspect primacy over wide `> 5°` background orbs.
- **`w_mutual_reception_rescue`**: Identifies Domicile/Exaltation Mutual Receptions and Final Dispositors/Loops that rescue Detriment, Fall, or strained houses through earned cooperation.
- **`w_dignity_and_angles`**: Weighs Essential Dignity (`Domicile +5`, `Exaltation +4`, `Detriment -5`, `Fall -4`) against Accidental Dignity (`Angular H1/4/7/10`, `Succedent`, `Cadent`, `Cazimi`, `Combust`, `Retrograde`).
- **`w_aspect_t_square`**: Reads T-Square tension (Opposition + two Squares) cleanly through its **Apex Planet** (focal release channel) and **Missing Leg** (integration habit).
- **`w_aspect_grand_trine`**: Reads Grand Trine ease by Element (`Fire/Earth/Air/Water`) and checks for inertia/complacency unless activated by an Opposition/Square or transit.
- **`w_aspect_yod_cross`**: Reads Yod ("Finger of God": Sextile base + two `150°` Quincunxes to Apex) as ongoing recalibration, and Grand Cross as high-capacity four-corner balancing.
- **`w_stellium_concentration`**: Evaluates 3+ core planets in one sign/house (`<= 12°` cluster or co-presence) via their shared Dispositor and opposite-house polarity.

### Group B — Multi-Clock Western Timing Layers
- **`w_annual_profections`**: Uses `Age % 12 + 1` Profected House + Sign + **Lord of the Year** as the primary annual spotlight governing which natal promises awaken from birthday to birthday.
- **`w_secondary_progressions`**: Uses Day-for-a-Year **Progressed Moon** (`~2.5 yrs/sign` emotional climate), **Progressed Sun** sign/house shifts, and tight (`<= 1.5°`) Progressed-to-Natal aspects to track internal readiness.
- **`w_solar_return_year`**: Uses the annual **Solar Return** Ascendant and chart focus to frame birthday-to-birthday external atmosphere alongside Profections.
- **`w_outer_planet_transits`**: Integrates **Saturn** (29.5y maturity cycles / Saturn Return), **Jupiter** (12y expansion windows), **Uranus/Neptune/Pluto** (deep generational restructuring when hitting `< 2°` natal planets/angles), and **Chiron/Lunar Nodes** (healing & directional pivots).

### Group C–F — Domain Cartridges
- **`w_love_venus_mars_7h`**: Evaluates 7H/Descendant + ruler, 5H romance, Venus (affection/values), Mars (pursuit/desire), Moon (attachment safety), and Sect alignment.
- **`w_synastry_aspects`**: Compares Person A & B tight cross-aspects (`< 2.5°` Sun/Moon/Venus/Mars/Saturn/AC/DC/Nodes), house overlays (`1H/5H/7H/8H/4H`), and shared Saturn/Jupiter transit seasons.
- **`w_career_mc_10h_saturn`**: Evaluates MC + ruler, 10H (public vocation), 6H (craft/daily service), 2H (monetization), Sun/Saturn dignity, and Profection/Transit activation.
- **`w_wealth_2h_8h_resources`**: Separates earned cashflow (`2H` + Venus/Jupiter) from shared capital/debt/taxes (`8H` + `11H` + Saturn/Pluto), checking Mutual Receptions and Jupiter/Saturn transits.
- **`w_mind_health_moon_1h`**: Evaluates nervous system & vitality (`1H/Ascendant`, `Moon`, `Mercury`, `6H`, `12H`, `Sun`, `Chiron`) with strictly preventive, non-medical counsel.
- **`w_relocation_9h_12h_4h`**: Evaluates `9H` (long-distance travel, higher study, philosophy), `12H` (retreat, foreign immersion), `4H` (roots/home), and `Desh-Kaal-Patra` current location anchor.

---

## 3. Western Domain Priority Matrices (`w_prio_*`)

All 14 domains map symmetrically to Western equivalents (`w_prio_relationships`, `w_prio_synastry`, `w_prio_career`, `w_prio_business_vs_job`, `w_prio_wealth`, `w_prio_foreign`, `w_prio_health`, `w_prio_mental`, `w_prio_progeny`, `w_prio_education`, `w_prio_property`, `w_prio_litigation`, `w_prio_spirituality`, `w_prio_overview`), each enforcing:
- **#1 Lead Anchor** (Primary Placidus houses + cusp rulers + tightest `<2°` natal aspects + confirmed `Desh-Kaal-Patra` reality)
- **#2 Cross-Verification** (Sect polarity + Essential/Accidental dignity + Mutual Reception + Aspect Configurations + Multi-Clock Timing)
- **#3 Conditional Priority Override** (If heavy Saturn/Pluto/Chiron friction or Contrary-to-Sect detriment hits the focal house, validate structural tension & growth arc BEFORE issuing timing dates)
