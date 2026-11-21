# Cosmic Council — Desh-Kaal-Patra Life Context Form & Stage 1 `Jev` Decision Schema

> **Purpose:**  
> 1. Prevent blind/embarrassing predictions caused by missing reality context (e.g., married users testing *"When will I get married?"*, retirees asked about promotions, or unknown birth times).  
> 2. Lock the exact **Stage 1 `Jev` (System-1) Routing & Clarification Contract** that runs in `70–500ms` before Stage 2 slices the chart.

---

## Part 1: Desh-Kaal-Patra ("Time, Place & Circumstance") Profile Form

Stored as `profiles.life_context_json` (optional during quick signup, surfaced cleanly on the Profile Card & Overview with a gentle progress meter).

> **User-Facing Framing (Calm Observatory Voice):**  
> *"For a genuinely accurate reading, your real-world context and major turning points matter as much as your birth time. Add what you're comfortable sharing—it helps the astrologer anchor timing windows to your actual life."*

### 1. Schema, Fields & Progress Bar Weights (`Total = 100%`)

*(Note: This is currently the architectural specification—we will build this interactive UI modal/drawer on Profiles & Overview when implementation starts.)*

| Field Key | Question / UI Label | Options / Input Type | Progress Weight | Why It Prevents Bad Readings |
| :--- | :--- | :--- | :---: | :--- |
| **`birth_time_accuracy`** | **How reliable is your birth time?** | `hospital_exact` (Within 5m) · `family_memory` (±15m) · `approximate` (±1 hr) · `sunrise_unknown` (No exact time) | **20%** *(Critical)* | Immediately guards D9/D10/D60 & KP Sub-Lord claims if Lagna/cusp is near `Sandhi`. |
| **`relationship_status`** | **Marital & Family Status** | `single` · `dating_committed` · `engaged` · `married_no_children` *(optional wedding year)* · `married_with_children` · `divorced_separated` · `widowed` | **25%** | Stops embarrassing *"you'll meet your spouse in 2027"* answers when already married; unlocks `remarriage` / `family harmony` lenses cleanly. |
| **`children_details`** *(Conditional)* | **Children Details** *(Shown if `married_with_children` or has children)* | Repeatable rows: **`Gender`** (`Male / Son` · `Female / Daughter`) + **`Year of Birth`** · **Optional Full Chart Details** (`Exact Birth Date`, `Time`, `Place` if they wish to link/cross-verify later) | **15%** *(auto-awarded if `single` / `married_no_children`)* | Grounds `5H / D7` progeny questions, child timing verification, and family Dasha milestones cleanly. |
| **`career_mode`** | **Work & Income Structure** | `job_salaried` · `business_owner` · `freelancer_consultant` · `hybrid_job_and_business` · `student` · `homemaker` · `career_break_pivot` · `retired` *(+ optional Role/Industry)* | **20%** | Calibrates `6H` (service/job) vs. `7H/3H/11H` (business/venture) immediately; avoids predicting corporate promotions to founders or retirees. |
| **`location_status`** | **Living Location vs. Birthplace** | `hometown` · `relocated_same_country` · `living_abroad` *(settled)* · `living_abroad_temp` *(student/work visa)* · `planning_move` | **10%** | Stops predicting *"you will move abroad soon"* when the user already moved abroad years ago (`4H/9H/12H`). |
| **`past_anchors`** | **2–3 Major Life Turning Points (Optional)** | Simple year + tag list (e.g., `2019: Married`, `2022: Moved Abroad`, `2024: Started Business`) | **10%** | Lets the engine sanity-check active Vimshottari/Chara Dasha windows against real past events! |

#### Example `profiles.life_context_json` Payload
```json
{
  "birth_time_accuracy": "hospital_exact",
  "relationship_status": "married_with_children",
  "marriage_year": 2018,
  "children": [
    {
      "gender": "male",
      "birth_year": 2020,
      "optional_birth_date": "2020-05-14",
      "optional_birth_time": "09:42",
      "optional_birth_place": "Pune, India"
    },
    {
      "gender": "female",
      "birth_year": 2023
    }
  ],
  "career_mode": "business_owner",
  "location_status": "relocated_same_country",
  "past_anchors": [
    { "year": 2018, "tag": "married" },
    { "year": 2021, "tag": "business_launch" }
  ]
}
```

### 2. Automatic Trap-Detection & Graceful Redirect Rules (0ms TypeScript Guards)

Before Stage 3 generates prose, TypeScript compares `Question Playbook` vs. `life_context_json`:

| Detected Contradiction | How Cosmic Council Handles It (Never Accusatory) |
| :--- | :--- |
| **`MAR_02` ("When will I get married?")** when `relationship_status` is `married_*` | **Graceful Calibration Pause:** *"I see your profile notes you're already married — are you checking your own past marriage window to verify chart accuracy, asking about a second chapter, or exploring how your current partnership evolves next?"* *(3 quick-tap chips)* |
| **`MAR_18` ("Will I have children?")** when `children` array already has entries | Adapts immediately to **relationship/milestones with existing child(ren)** (or asks cleanly if asking about *another* child). |
| **`CAR_02` / `CAR_04` ("Should I quit my job?")** when `career_mode` is `business_owner` \| `student` \| `retired` | Adapts framing automatically to **scaling/pivoting your business**, **campus launch**, or **post-retirement legacy** without awkward employee advice. |
| **`FOR_01` ("Will I move abroad?")** when `location_status === 'living_abroad'` | Automatically pivots `F_FOREIGN_RELOCATION` to **PR/citizenship permanence, thriving abroad vs. returning home**. |
| **`birth_time_accuracy === 'approximate' \| 'sunrise_unknown'`** on KP / D9 / D60 peer question | Injects mandatory calibration honesty: anchors reading in **Moon Chart (Chandra Lagna), Planetary Strength, slow Dashas & D1**, explicitly noting where exact minute-sensitive KP Sub-Lords or D9/D60 shifts shouldn't be over-claimed. |

---

## Part 2: Stage 1 TypeSafe `Jev` Decision Schema (Hybrid System-1 Router)

Stage 1 executes **after** 0ms safety/context checks and completes in **`70–500ms`**.  
If `TYPESAFE_API_KEY` is present → calls **TypeSafe `Jev`** (`bool` / `choice` / `score`). Otherwise → transparent fallback to an ultra-fast utility model via OpenRouter (`temperature: 0`, strict JSON schema).

### 1. Exact `Jev` Evaluation Primitives (Parallel in 1 Call Batch)

```typescript
export interface Stage1RouterResult {
  // 1. choice (up to 255 options): Maps to CANONICAL_QUESTION_LIBRARY IDs + OPEN_ENDED_SYNTHESIS
  playbook_id: string;                 // e.g., "MAR_02", "WLT_06", "OPEN_ENDED_SYNTHESIS"
  playbook_confidence: number;         // 0.00 - 1.00 calibrated probability

  // 2. choice (5 options): Locks response structure, scoring & synthesis format
  intent:
    | 'CONVERSATIONAL'
    | 'SOFT_HORIZON'
    | 'HARD_DECISION'
    | 'TIMING'
    | 'PEER_AUDIT';
  intent_confidence: number;

  // 3. choice (3 options): Sets terminology density (overridden if user explicitly toggles peer/simple)
  detected_user_fluency: 'beginner' | 'guided_bridge' | 'practitioner';

  // 4. bool primitives (calibrated true/false probabilities)
  is_prompt_extraction: boolean;       // Anti-leak shield (prob >= 0.80 -> safe refusal)
  needs_clarification: boolean;        // Missing critical life anchor OR ambiguous question (prob >= 0.72)
  requires_synastry_partner: boolean;  // Asks about compatibility/partner comparison without 2nd chart
  requests_remedy_or_guidance: boolean;// Ensures grounded behavioral guidance (zero superstition)

  // 5. score primitive (2..10): Drives model tier & Deep Council Audit hint
  complexity_intensity: number;        // 2 = quick conceptual Q · 5 = standard reading · 8-10 = multi-system/crisis
}
```

### 2. Deterministic Routing Thresholds (No Guesswork)

| Signal Condition | Action Taken by Orchestrator |
| :--- | :--- |
| **`is_prompt_extraction >= 0.80`** | Immediate calm refusal (never reaches chart synthesis). |
| **`requires_synastry_partner >= 0.75`** & no Partner Profile attached | Prompt 1-tap **"Select or Add Partner Chart"** drawer right inside chat, or offer single-chart 7H/D9 insights meanwhile. |
| **`needs_clarification >= 0.72`** OR **Trap Mismatch** (`MAR_02` while `married`) OR **`playbook_confidence < 0.50`** | Return **1–2 crisp Clarifying Questions + quick-tap option chips** before running full synthesis (0 credit charge for a clarification turn!). |
| **`playbook_confidence >= 0.75`** | Lock exact Playbook → Stage 2 loads exact **Domain Slice + Top 4–8 Formula Cartridges + Context Priority Anchor**. |
| **`playbook_confidence 0.50–0.74`** | Fallback to **Domain General Slice** (e.g., all `marriage` or `career` core tables) + broader domain cartridges. |
| **`complexity_intensity >= 8`** OR (`intent === 'HARD_DECISION'` & Dossier flags high conflict) | Run **Path A** cleanly *and* auto-surface **"Run 4-Lens Deep Council Audit"** prominently inside Stage 4 `'Deeper analysis'`. |

### 3. Suggested `needs_clarification` Chip UX Rule (Mobile-First)
- Never interrogate the user with a 6-field wall inside chat!
- Ask **at most 1–2 concise sentences** with **2–4 tappable chips** (plus typing option), e.g.:
  - *"To give you an honest read on your career timing—where do things stand right now?"*
  - Chips: `[ Planning a job switch ]` `[ Evaluating an offer ]` `[ Starting a business ]` `[ Just feeling stuck ]`
- Selecting a chip **automatically saves that confirmed anchor into `profiles.life_context_json`** (bumping their progress bar upward seamlessly!) and immediately runs the real reading.
