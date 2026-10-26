# SpineSense platform brainstorm: an AI back-pain physio

**Goal:** someone with back pain opens SpineSense, answers the questions a physio would ask, does a short camera-guided movement check, and gets told which **pattern** their back pain fits, an exercise plan matched to that pattern, daily coaching, and re-checks. It handles the common case at home and sends people to a clinician when they need one.

**The honest boundary:** about 90% of low back pain is "non-specific". Even an MRI usually can't name the cause, and physios don't diagnose structures either. What a good physio does is **classify** how your back behaves (what eases it, what aggravates it, how you move, how worried you are) and treat that. That reasoning can be written down, so the platform can do it.

---

## 1. What a physio does in a first visit, and how the platform copies it

| Physio step | Platform feature | How the AI does it |
|---|---|---|
| Rule out serious causes | Safety check plus a quick check before every session *(built)* | Rules from NICE and the 2023 UK cauda equina pathway |
| History: where, how long, what eases or aggravates it, goals | **Intake 2.0**: conversational questionnaire | Structured form first; optional LLM chat that fills the same fields |
| Risk of a slow recovery | **STarT Back** (9 questions: low, medium or high risk) | Scoring rules (free for non-commercial use; Keele licenses commercial use) |
| Movement exam: range of motion, repeated movements, function | **Movement Check**: camera tests (section 3) | MediaPipe pose plus the existing engine |
| "What's going on": a working classification | **Pattern engine** (section 2) | Transparent rules first, ML later |
| Exercise prescription and dosage | **Plan generator** | Pattern → exercise families → dose, with progression gates *(gates built)* |
| Education and reassurance | Short lessons ("hurt is not harm", flare plan, sleep, work) | Vetted content; an LLM only rephrases it and answers questions about it |
| Follow-up every 1–2 weeks | **Re-check** every 2 weeks: same tests, pain, RMDQ, PSFS | Compare against your own baseline |
| Refer if not improving | **Escalation rules** | No improvement in 4–6 weeks, worsening, or new red flags: see a clinician |

---

## 2. "Detect the possible problem": the pattern engine

It never names a structure ("disc bulge", "facet joint"). It reports a **movement pattern** with a confidence level and what that means for exercise. These patterns come from physio classification systems: the McKenzie method (directional preference), treatment-based classification (Fritz and Delitto) and STarT Back.

| Pattern | Signs (questions + camera) | Plan focus |
|---|---|---|
| **Emergency or doctor first** | Red flags *(built)* | Stop; send to care |
| **Nerve-related (sciatica-type)** | Leg pain below the knee that is worse than the back pain; tingling or numbness; symptoms spreading down the leg on repeated bending | Gentle nerve glides, walking, positions that ease it. Refer if worsening, or not better in 2–4 weeks |
| **Eases with bending backwards** (extension preference) | Worse with sitting or bending. Repeated standing back-bends ease or **centralise** the pain (it moves from the leg toward the back) | Standing back extensions, prone press-ups, posture breaks, walking |
| **Eases with bending forwards** (flexion preference) | Worse standing or walking, better sitting. Repeated forward bends ease it (common in people over 60) | Knee-to-chest, cycling, seated rest breaks, walking intervals |
| **Stiff and guarded** (movement control) | No direction preference. Restricted, guarded or asymmetric range on camera; pain with sustained postures | Mobility plus control: cat-camel, bird dog, bridges, dead bug |
| **Deconditioned or low capacity** | Low pain, but slow 5× sit-to-stand, poor endurance or balance | Strength and walking progression: sit-to-stand, squats, carries |
| **Worried and stuck** (high STarT Back risk) | High fear or catastrophising scores; pain for longer than 3 months | Education first, graded exposure to feared movements; strongly suggest a clinician |

People usually get a **primary pattern plus modifiers** (for example, "eases with bending backwards" plus "worried and stuck").

**What the evidence says.** Directional preference is common, and it predicts which exercise direction helps; it is one of the better-supported signs. Subgrouping beats one-size-fits-all mainly in acute and subacute pain, with low-quality evidence. So the engine says "your back seems to prefer…" and keeps watching how you actually respond, rather than locking you into a label.

**How the camera helps classify.** The key test is the **repeated-movement test**: 10 standing back-bends, then 10 forward bends. The camera counts them and measures range; after each set the app asks "Is your pain more central, the same, or further down your leg?" Range of motion, guarding (slow or abandoned reps) and side-to-side differences become features.

---

## 3. The camera Movement Check (about 6 minutes)

All results are measured against **your own** first check, so camera error mostly cancels out.

1. **Standing range of motion:** forward bend, back bend, side bends left and right, and rotation (front and side views).
2. **Repeated movements with a symptom question:** extension ×10, then flexion ×10 (only if the first set didn't make leg symptoms spread).
3. **5× sit-to-stand time:** a validated functional test with published age norms.
4. **Single-leg balance:** seconds on each side.
5. **Active straight-leg raise** (lying down): how heavy each leg feels, plus range.
6. **Hip-hinge and squat quality:** form markers from the existing engine.

**Output:** a movement profile card, plus re-check charts showing range, sit-to-stand time and balance improving over weeks. This is the "proof it's working" that keeps people going.

---

## 4. Plan generator and exercise library

- **Library:** grow from 7 exercises to about 25, grouped into families: extension-biased (standing back extension, prone press-up, sphinx), flexion-biased (knee-to-chest, child's pose, seated flexion), nerve glides (sciatic slider, seated), control (bird dog, dead bug, side plank from knees, bridges), strength (sit-to-stand, squat, split squat, hip hinge, carries) and mobility (cat-camel, thoracic rotation). Plus a **walking programme**.
- **Dose:** start Gentle. Progress only through the next-day "back to usual" gate *(built)*. Pain up to about 3/10 during exercise is fine if it settles by the next day.
- **Flare plan:** 3–7 lighter days, positions that ease it, and a re-check. If it isn't settling, a clinician prompt and a full safety re-check.
- **Learning what works for you:** every day logs which exercises you did and how your back was the next day. Over a few weeks the plan favours what calms *your* back.

---

## 5. Where the AI sits

| Layer | Job | Technology | Ships when |
|---|---|---|---|
| Computer vision | Count reps and holds, measure range and form | MediaPipe *(built)*; small trained models later | Now |
| Clinical reasoning | Red flags, pattern, plan, progression, escalation | Transparent rules written from guidelines, reviewed by a physio | Phase 1 |
| Learned models | Exercise-quality scoring, error detection | Trained on KERAAL, KIMORE, REHAB, UI-PRMD, then SpineSense's own data | Phase 3 |
| Personalisation | Which exercises help *this* person | Per-person (N-of-1) statistics on next-day outcomes, on the device | Phase 3 |
| Language assistant | Conversational intake, explaining the plan, answering questions | LLM restricted to vetted content. **It never diagnoses or changes the plan**; red-flag words route to the safety screen | Phase 2 |

The rules, and your own ratings, always have the final say. Models and the LLM advise.

---

## 6. Data: what exists, and what you'll have to build

**The honest answer:** there is no big open dataset of physio records (assessment, then pattern, then plan, then outcome). The pattern engine therefore has to start as rules written from guidelines, and the ML comes later from your own consented data. What does exist:

| Data | What it gives you | Access |
|---|---|---|
| **KERAAL** | Back-pain patients doing rehab exercises, with error labels from physiotherapists, in MediaPipe format | CC BY-NC-SA (non-commercial). Ask the authors before shipping models |
| **KIMORE** | Back-pain rehab exercises with clinical scores | Licence not stated; site currently down |
| **UI-PRMD** | Correct and incorrect rehab movements | Public domain, so safe to ship |
| **REHAB24-6 / REHAB26** | Rep segmentation, error labels, MediaPipe from 29 camera angles | CC BY-NC (non-commercial) |
| **EmoPain** | Guarding, hesitation and bracing in back-pain patients, labelled by experts | Request by email |
| **BACPAC (NIH HEAL)** | 2,000+ deeply profiled chronic low back pain patients | Controlled access through the [BACPAC data portal](https://sites.cscc.unc.edu/cscc/projects/BACPAC) and [Vivli](https://vivli.org/vivli-data-contributor-spotlight-ucsfs-kaitlin-yee-on-navigating-data-sharing-across-a-multi-study-research-initiative/); needs a research application |
| **Repository of patient-level data from therapist-led back-pain trials** | Patient-level data from therapist-delivered back-pain trials | [Described here](https://pmc.ncbi.nlm.nih.gov/articles/PMC5412919/); access by request |
| **STOPS trial** (individualised physio vs advice) | Analysis code and results | [Zenodo 5902763](https://doi.org/10.5281/zenodo.5902763); check whether patient-level data is included |
| **VRNT trial** | Patient-level pain, fear-of-movement and catastrophising scores (not physio) | [Zenodo, CC BY 4.0](https://datasetcatalog.nlm.nih.gov/dataset?q=0002073471) |

**What only you can build:** with consent, store landmark traces only (no video) plus intake answers, pattern, plan, and next-day and 2-weekly outcomes. After a few hundred users, that is the dataset nobody else has. It's what lets you train a real pattern classifier and learn which plan works for which pattern. A physio partner who labels a sample is what makes it credible.

---

## 7. "Save people thousands": the business and the evidence

- **Evidence:** app-only programmes show small effects (selfBACK: under 1 point on the RMDQ disability scale). Therapist-guided digital programmes (Hinge, Sword) do about as well as in-person physio. The strongest product is a **hybrid**.
- **Recommended model:** free self-management (safety check, Movement Check, plan, coaching), plus an **optional paid async physio review**: a licensed physio reviews your Movement Check and plan, and messages you. One review plus the app replaces many visits, which is where the real savings are.
- **Second market:** clinics. Physios prescribe SpineSense as homework and see adherence and re-check data on a dashboard.

---

## 8. Regulation: wording matters

- "Detects your problem", "diagnoses" or "replaces your physio" would make it a **medical device** (FDA, EU MDR, UK MHRA). Kaia, for comparison, is a CE-marked Class I device.
- **Phase 1 wording:** "find your movement pattern" and "exercises matched to how your back responds", plus a clear "not a diagnosis". Get a **physio clinical advisor** early.
- **Later:** if you want the stronger claims, go for Class I (EU/UK) and keep a clinical evaluation file. Pose data and symptoms are health data under GDPR, which needs explicit consent.

---

## 9. Build roadmap

| Phase | What we build | Done when |
|---|---|---|
| **1. Assessment** (start here) | Intake 2.0 (STarT Back, PSFS, RMDQ, easing and aggravating factors), Movement Check v1 (range of motion + repeated-movement test + 5× sit-to-stand), pattern engine v1 (rules), plan generator with about 12 new exercises, movement profile card | A new user gets a pattern, an explanation and a matching plan in about 10 minutes |
| **2. Follow-up** | 2-weekly re-check, outcome charts, escalation rules, clinician PDF report, education lessons, LLM explainer (restricted to vetted content) | A user sees measurable progress and gets referred when they aren't improving |
| **3. Data and ML** | Consent plus landmark recorder; train exercise-quality models (KERAAL and others) in shadow mode; per-person "what works for you" learning | Models beat the rules on held-out people, and the plan adapts to each person's outcomes |
| **4. Validate and launch** | Pilot with a physio partner (RMDQ and pain at 6–12 weeks), async-review marketplace, regulatory file | Published pilot numbers and a clear claims position |

## 10. Decisions for you

1. **Business model:** free only, freemium with physio review (recommended), or clinic-first?
2. **Claims ambition:** stay with wellness wording, or plan for medical-device certification?
3. **A physio partner:** do you know one who could review the pattern rules and label data?
4. **Platform:** stay web-first (works on laptop and phone today), or add a mobile app later?
