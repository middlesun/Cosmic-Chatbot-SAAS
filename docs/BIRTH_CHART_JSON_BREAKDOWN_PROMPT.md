# Cosmic Council — Initial Birth Chart Breakdown JSON Prompt & Schema (`NatalTruthDossierV1`)

> **Purpose:** Runs **once** when a profile is activated/enriched (and optionally re-run if birth time is rectified).  
> Consumes the verified deterministic payload produced by `chartCompiler.ts` (16 Vargas, Shadbala, BAV/SAV, KP Placidus cusps + ABCD, Jaimini Karakas/Arudhas/Chara Dasha/Argala, Lal Kitab, Yogas, Vimshottari) and compiles a **compact, reusable `NatalTruthDossierV1` JSON** saved on `profiles`.  
> Every future chat turn reads this pre-validated JSON instead of re-deriving basic chart strength or drowning in 250+ raw coordinates.

---

## 1. Exact Target JSON Schema (`NatalTruthDossierV1`)

```json
{
  "schema_version": "natal_truth_v1",
  "birth_time_sensitivity": {
    "lagna_near_sandhi": false,
    "d9_or_d10_boundary_risk": false,
    "kp_sublord_minute_sensitive": true,
    "caution_note": "String or null"
  },
  "snapshot_scores": {
    "overall_natal_power_0_100": 74,
    "stability_index_0_10": 6.8,
    "career_potential_0_10": 8.2,
    "wealth_potential_0_10": 7.5,
    "marriage_support_0_10": 6.4,
    "health_resilience_0_10": 7.1,
    "d9_amplification_0_10": 7.8,
    "chart_archetype_label": "Slow-Burn Institutional Builder"
  },
  "lagnesh_profile": {
    "ascendant_sign": "Virgo",
    "ascendant_degree_maturity": "Mid-degree (14°22') - stable expression; Hasta P2 adaptability",
    "lagnesh": "Mercury",
    "health_score_0_100": 66,
    "d1_state": "Debilitated in Pisces (7H) with Neecha Bhanga via Saturn/D9",
    "d9_state": "Exalted in Virgo (D9)",
    "core_implication": "Early self-doubt transforms into refined analytical authority over time."
  },
  "command_hierarchy": {
    "top_powerhouse_planets": [
      {
        "planet": "Saturn",
        "composite_health_0_100": 89,
        "authority_index_0_10": 9.2,
        "why_dominant": "Atmakaraka + Vargottama + Sasa/Dharma-Karma link + 10H authority",
        "primary_domains": ["career", "longevity", "endurance"]
      }
    ],
    "vulnerable_or_afflicted_planets": [
      {
        "planet": "Moon",
        "composite_health_0_100": 44,
        "primary_vulnerability": "Grahan/nodal pressure + Kemadruma check",
        "offset_or_protection": "Own sign retention instinct + Jupiter aspect softens isolation"
      }
    ],
    "dispositor_backbone": {
      "final_dispositor_or_loop": "Saturn-Mercury mutual anchor",
      "bhava_chalit_shifts": ["Mars shifts from 12H (Rashi) to 11H (Bhava Chalit)"],
      "net_control_note": "Chart energy funnels into disciplined execution and structural problem-solving."
    }
  },
  "validated_yogas": [
    {
      "name": "Neecha Bhanga Raja Yoga (Mercury)",
      "classification": "Classical",
      "formula_proof": "Debilitated 1L Mercury in 7H, cancelled by Saturn association + D9 Virgo exaltation",
      "ysi_score_0_110": 84,
      "status": "Active",
      "domains": ["career", "identity"],
      "real_world_expression": "Initial imposter syndrome and delayed clarity giving way to elite specialized expertise."
    }
  ],
  "suppressed_or_cosmetic_yogas": [
    {
      "name": "Partial Gajakesari",
      "reason_downgraded": "YSI 42 - benefic flavor only; lacks tight angular strength to override primary Saturn dominance."
    }
  ],
  "doshas_and_hidden_risks": [
    {
      "name": "7th Lord in 12th + Moon-Saturn Pressure",
      "severity_0_10": 6.5,
      "d1_trigger": "Mars (7L) in 12H Virgo; Moon-Saturn aspect",
      "d9_status": "D9 Venus strengthened - delays and over-analyzes rather than denies marriage",
      "offset_present": "Strong D9 Venus + Saturn endurance",
      "domains": ["marriage", "mental_wellness"]
    }
  ],
  "house_promises": {
    "1": { "score": 70, "sav": 29, "kp_verdict": "supportive", "note": "Resilient identity maturing with age" },
    "2": { "score": 74, "sav": 31, "kp_verdict": "supportive", "note": "Steady compounding; watch 12H spend cycles" },
    "4": { "score": 62, "sav": 26, "kp_verdict": "conditional", "note": "Private emotional peace settles after 30s" },
    "5": { "score": 58, "sav": 25, "kp_verdict": "conditional", "note": "Selective romance; independent progeny" },
    "6": { "score": 72, "sav": 30, "kp_verdict": "supportive", "note": "High competitive endurance; watch work burnout" },
    "7": { "score": 61, "sav": 27, "kp_verdict": "delayed", "note": "Delayed/unconventional commitment; durable once formed" },
    "8": { "score": 65, "sav": 24, "kp_verdict": "mixed", "note": "Deep psychological insight; sudden restructurings" },
    "9": { "score": 78, "sav": 32, "kp_verdict": "supportive", "note": "Protective grace & mentorship override" },
    "10": { "score": 86, "sav": 35, "kp_verdict": "supportive", "note": "Core life anchor; institutional authority" },
    "11": { "score": 79, "sav": 33, "kp_verdict": "supportive", "note": "Gains through networks and specialization" },
    "12": { "score": 59, "sav": 23, "kp_verdict": "mixed", "note": "Foreign/remote channels strong; watch mental overload" }
  },
  "domain_pre_audits": {
    "marriage": {
      "structural_verdict": "Delayed but Supported",
      "positive_weights_0_100": 72,
      "friction_weights_0_100": 54,
      "d1_vs_d9_contrast": "D1 shows search friction and late trust; D9 strengthens partnership durability.",
      "priority_rule_triggered": "Signature_A_Delay_Validation",
      "key_anchors": ["7L Mars in 12H", "D9 Venus strengthened", "UL/DK compatibility"]
    },
    "career": {
      "structural_verdict": "Strong Institutional Rise",
      "positive_weights_0_100": 85,
      "friction_weights_0_100": 38,
      "d1_vs_d10_contrast": "D10 confirms long-term systems authority after early execution friction.",
      "best_mode": "Specialized leadership / architecture / consulting over repetitive ops",
      "key_anchors": ["Saturn AK/10H", "D10 10L", "KP 2-6-10-11"]
    },
    "wealth": {
      "structural_verdict": "Steady Compounding (Low Speculation Fit)",
      "positive_weights_0_100": 76,
      "friction_weights_0_100": 42,
      "d2_hora_and_al_note": "Solar Hora emphasis favors earned authority; 11th from AL supports institutional credibility.",
      "indu_shri_lagna_note": "Indu Lagna supports compounding wealth during Saturn/Venus activations.",
      "leakage_flags": ["Emotional/stress spending cycles under Rahu/12H activation"]
    },
    "health_and_mind": {
      "physical_resilience": "High endurance, stress-sensitive digestion/nerves",
      "mental_pattern": "Over-analysis and silent responsibility load under Moon-Saturn pressure",
      "key_anchors": ["Lagnesh Neecha Bhanga", "D45/D60 recovery", "6H/12H load"]
    },
    "foreign_and_relocation": {
      "promise_level": "Moderate-High",
      "key_anchors": ["7L/12H link", "Rahu 11/12 axis", "KP 3-9-12"]
    }
  },
  "unresolved_contradictions": [
    "Strong 10H/11H material authority vs. debilitated D1 Lagnesh causing chronic self-doubt",
    "D1 7th lord in 12H hesitation vs. strong D9 Venus long-term marital stability"
  ],
  "narrative_kernel": "Concise 300-450 word macro synthesis capturing the chart's true engine, top 2-3 powers, top 2-3 structural bottlenecks, D1-vs-D9 evolution, and overarching life pacing - written with zero fluff or fabricated degrees."
}
```

---

## 2. Production Prompt for Initial Birth Chart Breakdown JSON

Use this **System + User Prompt** once at profile enrichment (passing the compact JSON emitted by `chartCompiler.ts`). Run with a flagship reasoning model (`temperature: 0.15`, `response_format: json_object`) and validate against the schema above before saving to `profiles`.

### System Prompt
```text
You are a Grandmaster Vedic Astrology Structural Compiler. Your sole job is to audit a verified multi-system Vedic chart payload (D1, D2–D60 Vargas, Shadbala, Bhinna & Sarva Ashtakavarga, KP Placidus Cusps + ABCD Significators, Jaimini Karakas/Arudhas/Argala, Lal Kitab, Yogas, and Vimshottari) and output a strictly grounded, reproducible JSON Natal Truth Dossier (`natal_truth_v1`).

NON-NEGOTIABLE DIAGNOSTIC RULES:
1. ZERO FABRICATION: Use ONLY the exact signs, houses, degrees, Nakshatras, Padas, Vargas, Shadbala ratios, SAV/BAV scores, and KP significators provided in the input JSON. Never invent degrees for D9–D60 (D9–D60 are sign/house/dignity/Vargottama only).
2. KILL THE 90% USELESS YOGAS: Detect classical, Parivartana (Maha/Khala/Dainya), and structural Yogas, then score each strictly via YSI (0–110): Structural Validity (0–25) + Shadbala/Planetary Support (0–25) + D1 Degree/Combustion/Avastha Integrity (0–25) + D9 Reinforcement (0–25) + soft Classical Raj Yoga bias (+5–10 max only if pure). Promote only truly operative Yogas (YSI >= 50) into `validated_yogas` and downgrade weak/textbook-only combinations into `suppressed_or_cosmetic_yogas`.
3. CONFLICT & CANCELLATION FIRST: Never score a debilitation, Dosha, or Dusthana link blindly without checking offsets (Neecha Bhanga, Vipareeta Raja Yoga, Vargottama, Cheshta Bala via retrogression, Jupiter aspect, strong dispositor). Record both severity and offset.
4. D1 VS. D9 REALITY SEPARATION: Explicitly capture where D1 outer promise differs from D9 inner/post-maturity durability, and where D10 alters career authority.
5. KP SUB-LORD & CHALIT REALITY CHECK: Cross-check Houses 1–12 against KP Cusp Sub-Lords & ABCD significators (`supportive | conditional | delayed | mixed | obstructed`), and note any meaningful Bhava Chalit house shifts (Rashi = how a planet acts; Chalit = where results land).
6. BIRTH-TIME SENSITIVITY CHECK: Check if Lagna degree is within 0°00'–1°30' or 28°30'–30°00' (Sandhi) or if D9/D10 Lagna shifts within ±4 minutes, and flag `birth_time_sensitivity` honestly.
7. NO TRANSIT PREDICTION HERE: This dossier captures structural natal architecture + overall domain balance only (live chat injects active Dasha/Gochar dynamically).
8. OUTPUT CONTRACT: Return ONLY valid minified/clean JSON matching the `natal_truth_v1` schema. No markdown fences, no commentary outside JSON.
```

### User Prompt Template
```text
Compile the `natal_truth_v1` Structural Dossier for this verified birth chart. Ensure `domain_pre_audits` pre-evaluates Marriage, Career, Wealth, Health & Mind, and Foreign/Relocation weights honestly, and list the top 2–4 genuine structural tensions in `unresolved_contradictions` so live consultations know exactly what to test first.

VERIFIED CHART PAYLOAD:
{{VERIFIED_CANONICAL_VEDIC_CHART_JSON}}
```

---

## 3. Why This Makes Everything Downstream Effortless

1. **Cuts Live Chat Token Cost by ~60%:** Live chat injects the compact `NatalTruthDossierV1` (~1,200–1,600 tokens of already-verified truth) + **only the domain slice** (`D10` for career, `D9+UL+DK` for marriage, `D45/D60` for health) + active MD/AD/PD + Gochar.
2. **Eliminates Yoga & Math Hallucination:** Every turn agrees on which Yogas actually work, which Doshas have offsets, and who leads the `command_hierarchy`.
3. **Powers Smart `Deeper analysis` Suggestions Automatically:** `unresolved_contradictions` hands the post-turn Suggestions generator ready-made, chart-specific puzzles to invite users into!
4. **Powers Your Profile/Overview "Chart DNA" UI (Optional):** Since scores (`overall_natal_power`, `career_potential`, `top_powerhouse_planets`) live cleanly in JSON, you can optionally render a sleek Observatory summary card on the user's Profile page too.
