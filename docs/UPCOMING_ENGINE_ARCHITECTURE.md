# Cosmic Council — V2 Prompt, Routing & Synthesis Engine Architecture

> **Status:** Upcoming Implementation Blueprint (Brainstorming & Design Locked)  
> **Scope:** Next-generation Chat & Consultation Engine (Vedic first, mirrored for Western next). Covers pre-computed chart intelligence, Desh-Kaal-Patra life-context onboarding, TypeSafe **Jev** System-1 routing, 100–200 Canonical Question Playbooks, the Formula & Priority Library, Convergence-driven scoring, and Optional Multi-Lens Deep Audits.

---

## 1. Core Architectural Shift (Why V2 Exists)

### Current Bottleneck
Today, every chat turn injects a massive monolithic prompt stack (`Constitution + Rules + Expert + Mode + Recipe + Output + Language + Tone + Length + Entire Canonical Chart JSON + Transits + Memory + Suggestions JSON rules`) into a single LLM call. Even strong frontier models suffer from **attention dilution** across 250+ raw chart coordinates—missing Yoga cancellations, repeating placements verbatim, or inventing vague interpretations.

### V2 Paradigm: Deterministic Truth → Calibrated Routing → Targeted Synthesis
```text
[Profile Created / Enriched]
  └─> Pre-Computed "Natal Truth Object" (Code Math + Cached Narrative Kernel)
  └─> Desh-Kaal-Patra "Life Context & Milestones" Form (Optional, Progress-Tracked)

[User Sends Message]
  │
  ▼
STAGE 1: Hybrid System-1 Router (<350ms)
  ├─ 0ms TypeScript Guards (birth-time accuracy, peer keywords, Suggestion directive)
  └─ TypeSafe Jev (or OpenRouter JSON fallback)
       ├─ choice: Canonical Question Playbook (1..200) OR Open-Ended Domain
       ├─ choice: Intent (conversational | clarify | soft_horizon | hard_decision | timing | peer_audit)
       ├─ choice: Fluency (beginner | intermediate | practitioner)
       ├─ bool:   needs_clarification / context_mismatch / prompt_injection
       └─ score:  complexity_intensity (1..10)
  │
  ├──(if confidence < threshold OR missing critical life anchor)──> Ask 1–2 crisp Clarifying Questions
  │
  ▼
STAGE 2: Context Slicer & Formula Selector (0ms TypeScript)
  ├─ Loads Profile's Pre-Computed Natal Truth Object (Command Hierarchy, Validated Yogas, Cancellations)
  ├─ Slices ONLY required Houses, Vargas, KP Cusps, Jaimini Karakas & Dashas for this Playbook/Domain
  └─ Selects ONLY the 4–8 Formula Cartridges whose trigger conditions match THIS chart + THIS question
  │
  ▼
STAGE 3: Synthesis Execution (Two Paths)
  ├─ PATH A (Default Fast Consultation, 2–4s):
  │    Single focused LLM call using Intent Output Contract + Fluency Adapter + Sliced Math + Formulas
  └─ PATH B (Explicit "Deep Council Audit" / High-Stakes Escalation):
       3–5 Parallel Focused Lenses (Parashari/Divisional · KP · Timing Stack · Contrarian Critic)
       ──> 1 Master Convergence Adjudicator (Ranked Outcomes + Convergence Score + Technical Trace)
  │
  ▼
STAGE 4: Decoupled Smart Suggestions & Silent User Intelligence (Async Post-Turn)
  ├─ Generates Followups (human, contextual) + Deeper Analysis (derived from chart contradictions)
  └─ Updates Silent User Profile (inferred mastery, recurring pain points, confirmed life anchors)
```

---

## 2. Pillar 1 — Pre-Computed Birth Chart Breakdown (`Natal Truth Object`)

Generated **once** when a profile is activated/enriched (and re-computable if birth time is rectified or rules update). Eliminates recalculating basic chart strength on every chat turn.

### Layer A: Deterministic Structural Dossier (100% Code, $0 LLM Cost)
Computed by `jyotishMath.ts` + `chartCompiler.ts` and stored compactly in `profiles`:
1. **Command Hierarchy & Lagnesh Health:**
   - Ascendant Lord health score (`0–100`), functional nature, D1/D9/D10 dignity, Shadbala ratio, and top 3 Powerhouse Planets vs. top 3 Vulnerable/Afflicted Planets.
   - Final Dispositor / Dispositor loop detection (who actually controls chart energy).
2. **Filtered & Scored Yoga Registry (Solves "90% of Yogas Are Useless"):**
   - Evaluates Classical (Parashari/Jaimini/Parivartana/Vipareeta/Neecha Bhanga), Structural (Vargottama clusters, Upachaya dominance, `<=5°` stelliums, Nakshatra links), and Argala interventions.
   - Scores each via **Yoga Strength Index (YSI 0–100+)** and tags status: `Foundational | Active | Conditional | Latent | Blocked`.
3. **Dosha & Hidden Weakness Matrix:**
   - Grahan, Kemadruma (+ cancellation checks), Daridra, Papakartari, Combustion orb, Graha Yuddha, `6/8/12` entanglements, `2L in 12H`, `10L combust`, Maraka intensification.
   - Explicitly links offsets/cancellations (Neecha Bhanga, Jupiter aspect, Vargottama).
4. **House Health & KP Promise Matrix (Houses 1–12):**
   - Composite House Score (`0–100`), SAV bindus, Benefic/Malefic load, D9 reinforcement, and KP Cuspal Sub-Lord verdict (`Strong | Conditional | Obstructed`).
5. **Birth-Time Sensitivity Flag:**
   - `exact` | `within_15m` | `approximate` | `unknown` — tracks whether Lagna, D9, D10, D60, or KP Sub-Lords are near cusp/sign boundaries (`Sandhi`).

### Layer B: Cached Master Narrative Kernel (~500–700 Tokens, 1-Time LLM Pass)
- Synthesizes Layer A into the chart's 3–4 core structural tensions, dominant life arc, and key D1↔D9 contrasts (e.g., *"Slow-burn Saturn-ruled career consolidation; early self-doubt via debilitated Mercury with Neecha Bhanga maturation after 30s"*).
- Injected as lightweight macro-context on every chat turn so the assistant never forgets the big picture.

---

## 3. Pillar 2 — Desh-Kaal-Patra Life Context Form & Trap Prevention

### The Real-World Problem
1. Users ask broad questions (*"How will my married life be?"*) with zero life context.
2. Users deliberately test astrologers (*"When will I get married?"* when already married for 5 years, or asking about career promotion while retired/student).
3. Same placements manifest radically differently at age 21 vs. 34 vs. 52.

### The Solution
1. **One-Time Profile "Life Context & Anchors" Drawer / Prompt (with Progress Bar):**
   - Messaging: *"For a genuinely accurate reading, your life context and past turning points matter as much as your birth time."*
   - Lightweight structured fields stored per profile (`profiles.life_context_json`):
     - **Relationship Status:** Single / Dating / Engaged / Married (year) / Divorced-Separated / Widowed
     - **Career Stage:** Student / Early Career / Mid-Career / Leadership-Founder / Business / Transition / Retired
     - **Birth-Time Certainty:** Hospital-exact / Family memory (±15m) / Approximate (±1 hr) / Unknown
     - **Children:** None / Yes (count/years optional)
     - **2–3 Past Milestone Anchors (Optional Calibration):** e.g., *"Moved abroad 2022, career shift 2024"* (gold for verifying Dasha & chart rectification).
   - Gentle completion progress bar on Overview & Profile Card (`0% → 100% Context Calibrated`), never forced as a hard wall.
2. **In-Chat Conversational Clarification (`needs_clarification` route):**
   - If a user skips the form and asks an underspecified or contradictory question, Stage 1 triggers a **1–2 question conversational pause** (with quick-tap chips) before running a heavy prediction.
   - Prevents embarrassing misreads and builds instant trust (*"Before I read your 7th house timing—are you currently single looking ahead, or navigating an existing relationship?"*).

---

## 4. Pillar 3 — TypeSafe `Jev` System-1 Router + 100–200 Canonical Question Playbooks

### Why Canonical Question Playbooks Change Everything
Even with infinite astrological complexity, **85–90% of real user queries fall into ~120–200 repeatable questions** (marriage timing, marriage quality, divorce vs. reconcile, job switch, business vs. job, foreign settlement, wealth stability, exam/visa, Rahu/Saturn fear, Sade Sati, compatibility). Only ~10% are truly novel edge cases.

### Why TypeSafe `Jev` Is Built for This
`Jev` (TypeSafe AI) is a non-generative System-1 decision model (70–500ms) trained via RLCD to return **strongly typed primitives + calibrated probabilities**:
- **`choice` (up to 255 options):** Maps noisy natural phrasing directly to one of our **120–200 Canonical Question Playbooks** (plus `OPEN_ENDED_SYNTHESIS` fallback) AND classifies Intent + Domain + Fluency.
- **`bool` (calibrated yes/no probability):**
  - `needs_clarification`: Does this lack essential Desh-Kaal-Patra context?
  - `is_prompt_extraction`: Anti-leak guardrail check.
  - `requires_timing_stack`: Does this ask "when?" or reference a date window?
- **`score` (2–10 scale):** `complexity_intensity` — determines whether standard consultation model suffices or whether flagship reasoning / Deep Audit suggestion should engage.

### Calibrated Confidence Escalation (Zero Guesswork)
Because `Jev` outputs calibrated confidence scores:
- **High confidence (`>= 0.78`)** → Load the exact **Playbook ID** (which deterministically specifies the exact Chart Slice + Formula Cartridges + Context Priority Order + Output Template).
- **Medium confidence (`0.50–0.77`)** → Load general Domain Slice + ask 1 clarifying check or widen chart slice slightly.
- **Low confidence (`< 0.50`)** → Trigger `needs_clarification` directly instead of guessing wrong.

### Resilience Pattern (Vendor Independence)
Wrap Stage 1 behind a clean `IntentClassifier` interface:
- Primary: `JevClassifier` (when `TYPESAFE_API_KEY` is configured).
- Fallback: `OpenRouterStructuredClassifier` (ultra-fast utility model JSON mode), ensuring local dev, CI, and Cloudflare Workers always run seamlessly.

---

## 5. Pillar 4 — The 5 Intent Types & Output Contracts

| Intent Archetype | User Example | Analysis & Scoring Behavior | Output Shape |
| :--- | :--- | :--- | :--- |
| **1. Conversational / Conceptual** | *"Why do I feel drained lately?"* / *"What is Atmakaraka?"* | 1–2 core anchors + current MD/AD/Moon mood; zero heavy dumps | Calm, warm, human narrative |
| **2. Soft Multi-Decade Horizon** | *"How will my married life be?"* / *"My career trajectory?"* | **NO binary verdict.** Competing **Positive Weights vs. Friction/Cancelling Weights** (scored/100 from deterministic factors) + **Dasha Life-Arc Phases** | Structured Drivers + Phase Arcs + Short Synthesis |
| **3. Hard Deterministic / Decision** | *"Should I take this job?"* / *"Is foreign settlement promised?"* | **3-Gate Adjudication** (`Promise × Strength × Timing`) + **Contrarian Cancellation Check** + **2–4 Ranked Outcomes** with **Evidence Convergence** (e.g., `4/5 Pillars Aligned`) | Direct Adjudication + Ranked Outcomes + Cancellations + Reasoning |
| **4. Timing / "When?"** | *"When will marriage happen?"* / *"Next good career window?"* | Multi-clock stack: **Vimshottari (MD/AD/PD) + Chara Dasha + Gochar (Jupiter/Saturn/Nodes) + KP Significators** | Ranked Top 2–3 Date Windows + Activation Trigger |
| **5. Technical Peer / Audit** | *"Verify 10th CSL and Saturn BAV in D10"* | Bypasses beginner translation; cites degrees, Nakshatra/Pada, Shadbala, BAV, Vargas, KP ABCD directly | Crisp, dense practitioner-to-practitioner proof |

### How Convergence-Driven Scoring Avoids "Fake AI Percentages"
Every predictive score or outcome band is explicitly anchored to **Pillar Agreement** (not LLM vibes):
1. **D1 Structural Promise** (House + Lord + Karaka)
2. **Divisional Confirmation** (D9 / D10 / D7 alignment)
3. **Planetary Delivery Strength** (Shadbala + BAV/SAV + Avastha + Neecha Bhanga)
4. **KP Sub-Lord Gate** (Cuspal significators permit vs. deny)
5. **Active Timing Trigger** (MD/AD/PD + Gochar alignment)

Output displays: **Convergence Band** (e.g., `4 / 5 Pillars Aligned — Strong Conditional Support`) + 1-line **What Boosts It / What Cancels or Delays It**.

---

## 6. Pillar 5 — Formula & Priority Library + Context Priority Engine

*(See companion doc: `VEDIC_FORMULA_AND_PRIORITY_LIBRARY.md` for full extracted catalog.)*

1. **Formula Cartridges (Small, Conditional, Admin-Editable):**
   - Replaces monolithic 18,000-char prompts inside live chat.
   - Each cartridge is ~80–250 words with metadata: `slug`, `tradition (vedic|western|universal)`, `domain`, `intent_fit`, `trigger_conditions`, `priority_weight`, and `anti_pattern_check`.
2. **Context Priority Rules (Setting What Leads for THIS Chart):**
   - Before writing a word, Stage 2 supplies the **Active Hierarchy** for the question:
     - *Example (Career):* `Lagnesh Health` → `10L & D10 state` → `Active MD/AD Lord relevance to 2/6/10/11` → `Operative Raj/Dhana Yogas (YSI >= 50)` → `Sat/Jup Gochar`.
     - *Conditional Override:* If the chart has a **High-Doubt / Afflicted 7H**, `Marriage Priority Rule A` forces the engine to address *Chart Support & Past Friction* first—never burying risks under generic romance fluff.
3. **Conflict & Cancellation Resolution (First-Class Citizen):**
   - Explicitly tests vector cancellations: *Neecha Bhanga, Vipareeta Raja Yoga, Combustion vs. Vargottama, D1 promise vs. D9 collapse, functional benefic turning Maraka, Rahu/Ketu dispositor dependency, Karako Bhava Nashaya*.

---

## 7. Pillar 6 — Fast Default vs. Dedicated "Deep Council Audit" (3–5 Parallel Lenses)

### Why Explicit + Escalated Works Better Than Always-On Parallel Calls
Running 5 LLM passes on *every* turn creates 10–18s latency and 5x credit burn—bad UX on mobile.

### Dual Execution Design
1. **Path A — Default Smart Turn (Fast, Single Synthesis Call):**
   - Powered by Stage 1 (`Jev`) + Stage 2 (`Natal Truth Object` + `Filtered Slice` + `Triggered Formulas`).
   - Fast (~2–4s), sharp, already immune to attention dilution.
2. **Path B — "Deep Council Audit" (Explicit Button + Smart Escalation):**
   - Available via a clean toggle/chip next to Send (transparent credit badge / included in Pro & Guru) **AND** offered automatically inside `Deeper analysis` suggestions whenever Path A detects high chart conflict.
   - Fans out **4–5 parallel, isolated specialists** (each seeing *only* its clean slice):
     - **Lens 1:** *Parashari & Divisional Architect* (D1 + D9/D10/D7 + Shadbala/BAV)
     - **Lens 2:** *KP & Nadi Precision Verifier* (Placidus Cuspal Sub-Lords, ABCD, Denial checks)
     - **Lens 3:** *Multi-Clock Timing Engine* (Vimshottari MD/AD/PD + Chara Dasha + Gochar orbs)
     - **Lens 4:** *Contrarian / Falsification Auditor* (Actively tries to break the hypothesis via cancellations, Maraka, 6/8/12, Sandhi, maturity)
   - **Master Convergence Synthesizer:** Merges all 4 into Consensus Verdict, System Agreement vs. Conflict breakdown, Ranked Outcomes, and Technical Trace.

---

## 8. Pillar 7 — Silent User Intelligence & Chart-Aligned Suggestions Engine

1. **Silent Implicit User Profile (`memoryArchivist` v2):**
   - Stored silently on `users` / `profiles`:
     - `inferred_fluency`: `beginner | intermediate | practitioner` (rolling prior—overridden instantly if user asks a peer-level or casual question)
     - `preferred_tradition`: `vedic | western | dual`
     - `recurring_domains`: top ongoing life themes
     - `confirmed_reality_anchors`: merged safely with the Desh-Kaal-Patra form
   - Settings (`ChatSettingsModal`) stays clean as an optional manual override.
2. **Chart-Aligned Decoupled Suggestions Engine (`Followup` vs. `Deeper analysis`):**
   - Moved out of the main prose call into a dedicated Stage 4 step seeded with **four structured inputs from Stages 1–3** (eliminating generic filler chips):
     1. **Unresolved Contradictions & Unused Chart Flags (`Natal Truth Object`):** Seeds `Deeper analysis` directly from `unresolved_contradictions`, `bhava_chalit_shifts`, or secondary `validated_yogas`/`doshas` not covered in the current reply (e.g., *"Check if Mars shifting in Bhava Chalit softens your 7th-house delay"*).
     2. **Playbook Next-Hop Graph:** Maps each Playbook ID to its highest-value natural follow-ups (e.g., `MAR_02` Timing → `MAR_05` Spouse Profile, `MAR_14` Wealth After Marriage, `MAR_04` Love vs. Arranged).
     3. **Cancellation & Low-Convergence Escalation:** When the Cancellation Resolver detects a pivotal offset (`Neecha Bhanga`, `Dasha Sandhi < 10%`, `SAV < 20`) or when Convergence is split (`<= 3/5 Pillars`), `Deeper analysis` offers a targeted verification prompt or 1-tap **`Deep Council Audit`** escalation.
     4. **`+1` Fluency Ladder Progression:** `Followup` chips always match the user's *current* `inferred_fluency` in warm plain language; `Deeper analysis` chips step **one rung deeper** (*Beginner → Guided Bridge → Practitioner Peer*), naturally educating curious users and nudging `inferred_fluency` upward when clicked.

---

## 9. Pillar 8 — Western Astrology Parity Roadmap (Next Phase After Vedic)

Once the **Vedic Formula Library & V2 Pipeline are exhaustively tested and optimized**, Western plugs into the **exact same Stages 1, 3, and 4**—only swapping Stage 2's math slicer & Western Formula Cartridges:
- **Deterministic Math Upgrades (`jyotishMath` / `divinationEngines`):**
  1. Complete outer-planet ephemeris (`Uranus, Neptune, Pluto, Nodes, Chiron`).
  2. Tight-orb weighting (`< 2°` Core Structural vs. `> 5°` background).
  3. **Sect (Day vs. Night chart)** — determines constructive vs. challenging benefic/malefic polarity.
  4. **Essential & Accidental Dignity + Mutual Reception + Chart Ruler Dispositor Tree**.
  5. **Aspect Configurations** (T-Square, Grand Trine, Yod, Grand Cross, Stellium).
  6. **Timing Layers:** **Annual Profections (Lord of the Year)** + **Secondary Progressions** + **Solar Return** + **Outer Transits**.
- **Western Formula Cartridges:** Extracted & structured using the exact same `domain / trigger_condition / cancellation / priority` format proven during Vedic QA.

---

## 10. Recommended Phased Execution Order (Vedic-Exhaustive First)

1. **Phase A — Living Library & Math Foundation (Vedic Complete):**
   - Round out the remaining lighter Vedic domain cartridges (`Progeny/D7`, `Education/D24`, `Property/D4`, `Litigation/6-8-12`, `Spirituality/D20`, `Varshaphala`).
   - Add the 6 deterministic math gaps to `jyotishMath.ts` (`Indu/Shri Lagna`, `64th Navamsa / 22nd Drekkana`, `Bhava-Chalit Shift diff`, `Dasha Sandhi 10%`, `Double Transit + SAV`, `Punarphoo/Angarak/Shrapit/Maturity flags`).
   - Build & benchmark the **Natal Truth Object (`NatalTruthDossierV1`)** on known real charts.
2. **Phase B — Context, Routing, Cartridges & Convergence:**
   - Add Desh-Kaal-Patra **Life Context Form + Progress Bar** on profiles + `needs_clarification` chat branch.
   - Implement **~158 Canonical Question Playbooks** + **Hybrid Router (`Jev` primary + OpenRouter fallback)**.
   - Implement **Stage 2 Context Slicer + Admin-Editable Formula Cartridges (`formula_cartridge` category)** + Cancellation Resolver + 5-Intent Convergence Scoring + Fluency Adapter.
3. **Phase C — Deep Council Audit, Aligned Suggestions & Vedic QA Loop:**
   - Build **4-Lens Parallel Deep Council Audit** + Send toggle & smart escalation.
   - Decouple & align **Stage 4 `Followup` / `Deeper analysis` Suggestions** + `memoryArchivist` v2.
   - Run **Benchmark Chart QA Loop** (test known charts → diagnose misses → hot-add Formula Cartridge or Math Flag → re-verify).
4. **Phase D — Western Parity (Plug-and-Play into Proven Pipeline):**
   - Mirror the proven Stage 2 architecture for Western (Outer Planets, Sect, Essential Dignity, Profections, Secondary Progressions, Western Dossier & Formula Cartridges).

