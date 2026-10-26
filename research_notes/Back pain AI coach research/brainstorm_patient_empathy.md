# SpineSense brainstorm: the patient-empathy lens

Lens: a person with low back pain, exercising alone at home, often afraid of making it worse.
Date: 2026-10-17. Author role: brainstorm agent "patient empathy".

Source tags used below:
- [PC] patient_concerns_reddit.md (Q1 = ranked concerns, Q2 = what helped, Q3 = home-exercise drop-off, Q4 = Hinge/Sword/AI physio views, Q5 = privacy)
- [CE] clinical_evidence.md (section numbers 1-7)
- [AI] ai_digital_landscape.md (section numbers 1-7)
- [DP] datasets_exercise_pose.md (KQ1-KQ4)
- [DB] datasets_pain_behaviour.md (Q1-Q6)
- Code refs are to files I read in D:/Antigravity/spinesense (README.md, js/core/exercises.js, js/core/discomfort.js, js/program.js, js/views/session.js, js/views/settings.js, plus targeted greps of js/).

## What this person needs, in order

1. "Is it safe for me today, and how will I know if it is not?" This is the #1 concern by a wide margin (~38 of ~190 threads) [PC Q1 #1].
2. "Tell me what a bad sign looks like, especially in my leg." Nerve-damage fear is concern #3 [PC Q1 #3]. A camera cannot see tingling or numbness, so the app has to ask.
3. "Did that exercise make me worse?" Patients judge this 24-48 hours later, not mid-rep [PC Q2 folk rules, CE §5].
4. "Do not make me more afraid." Physios on r/backpain warn that fear of movement becomes its own problem, and that it "feels like you're being careful, not afraid" [PC Q1 #1].
5. "Do not lie to me about what you can see." Tracking misreads are a top complaint even for well-funded products [AI §5, PC Q4].
6. "Make it cheap to show up and let me see progress that is not pain." 76% do not finish assigned home exercises; the top reasons are forgetting (40%), no time (33%), boring (22%), no quick results (19%) and pain or fear (18%) [PC Q3].

## What already exists (so I do not re-propose it)

- A one-time safety screen with six red flags, three cautions, aggravators, pain location and duration (js/program.js:5-39, js/views/safety.js). I found no re-screen after onboarding.
- A pause/pain-check flow with a 0-10 scale: 0-3 carry on, 4-5 easier level, 6+ stop; 8+ shows "get medical help" text (js/views/session.js:565-634).
- Pause by raised hand (gesturePause) or the spoken word "stop" (voice input is off by default) (session.js:381, 640).
- Level regression after pain of 6+ or an early stop, and a 2-day rest only for an early stop at level 0 (js/program.js:130-141).
- A "Watch facial expression" toggle, **default on** (js/store.js:13, js/views/settings.js:26).
- Basic "step back / can't see you" messages (js/core/engine.js:117, 137).
- A "Day streak" tile with a flame and "Keep it going" copy (js/views/dashboard.js:56, 85).
- Not found anywhere in js/: a next-day check, a walking activity, flare handling, reminders, mood or crisis resources, a clinician export, or any outcome measure such as RMDQ.
- README admits that thresholds are tuned on simulated movement, and that the grimace score is unvalidated for pain.

---

## Top 10 improvements (ranked, 1 = most important)

### 1. Leg-symptom and sharp-pain branch in every pain check, plus a weekly red-flag re-screen
- **Category:** safety
- **Patient concern it addresses:** #1 fear of making it worse; #3 sciatica and nerve-damage anxiety (one story is an emergency cauda equina surgery, "Get the MRI asap") [PC Q1 #3].
- **Concrete change in SpineSense:**
  - `js/views/session.js` `painCheck()` and `pause()`: after any "I feel pain" or rating of 4 or more, add one plain question: "Where do you feel it?" with options "Back only", "Spreads into buttock or thigh", "Below the knee, or tingling, numbness or weakness", and "Sharp or shooting". Add "Is this new or worse than usual?"
  - "Below the knee / tingling / numb / weak" or "spreading further than your screening answer" means stop that exercise (not just "easier"). Set `restUntil` for that exercise for 48 h in `js/program.js` and show a short plain-language card. The card says what is common, what to watch, and that new saddle numbness, bladder or bowel change, or fast-worsening leg weakness means emergency care today (GIRFT triggers [CE §7]).
  - `js/program.js` and `js/views/safety.js`: re-ask the six RED_FLAGS weekly, after any rating of 8 or more, and when a flare is declared (item 7). Saddle or bladder answers block sessions, as the first screen already does.
  - The camera and face detector cannot see nerve symptoms. This item is the only way the app can address the most feared outcome.
- **Effort:** S-M
- **Impact:** 10
- **Confidence:** 8
- **Main risk:** Alarm fatigue or false alarms for people whose chronic sciatica is their normal. Mitigate by asking "new or worse than usual?" and comparing with `screening.location`. The mid-session stop rule is an inference from the centralisation literature, not a sourced rule [CE §7 Inferences].

### 2. Next-day "how is your back this morning?" check that changes tomorrow's dose
- **Category:** clinical (safety-adjacent)
- **Patient concern it addresses:** #1 (aggravation shows up later: "stop any that increase pain within 24-48 hours" [PC Q2]); #7 flare-ups.
- **Concrete change in SpineSense:**
  - `js/program.js`: store a `pendingCheck` after each saved session. `js/views/dashboard.js` shows a three-tap banner on the next open: "Back to usual / A bit worse / Clearly worse". `applyProgression()` reads the answer.
  - Usual or better: progression is allowed. A bit worse: hold progression for 3 days, drop to Gentle, and rest whichever exercise had amber or red events for 48 h. Clearly worse or new leg symptoms: show the item 1 card and suggest a clinician.
  - No answer means no level-ups.
  - The result screen ends with an honest expectation: "Some soreness that settles by tomorrow is normal. I'll check in tomorrow."
  - Evidence: pain-monitoring model (settle by next morning, do not build week to week) [CE §5]; painful exercise is no worse than pain-free (SMD -0.27) [CE §5].
- **Effort:** M
- **Impact:** 9
- **Confidence:** 7
- **Main risk:** The numeric rules come from tendinopathy and are not validated for low back pain [CE §5 Gaps]. Unaccustomed trunk soreness peaks at 24 h in 57.5% and at 48 h in 32.5% [CE §5, Bishop 2011], so users may read normal soreness as harm. Keep the soreness-versus-worse copy short. Users who do not return get no check, so non-response must default to conservative.

### 3. Camera honesty: placement check, tracking-confidence gate, and progression that does not depend on shaky form scores
- **Category:** UX (safety and ML-model)
- **Patient concern it addresses:** #1 (a wrong correction feels like "I'm doing it wrong and will hurt myself"); the Q3 "am I doing it right?" need [PC Q3]; tracking complaints for Hinge and Kaia [PC Q4, AI §5].
- **Concrete change in SpineSense:**
  - `js/vision/tracker.js` and `js/core/engine.js`: compute a per-exercise `trackingQuality` from the minimum visibility of `required()` landmarks plus jitter. When it is low, suppress form cues, show "I'm less sure from this angle, go by feel", and exclude that set from `formScore`.
  - `js/views/session.js` setup screen: skeleton-only preview with per-joint ticks ("hips seen, ankles not seen") using each exercise's `camera` hint. The preview doubles as a privacy comfort.
  - `js/program.js:143` levels up only when `formScore >= 75`, and `engine.js:272` computes formScore as 100 minus 25 per issue from angle rules with an expected error of 5-10 degrees [AI §2 Inferences]. Gate progression on completion, pain and "how did it feel" instead. Use form only when `trackingQuality` is high. This also avoids the "Level 55, now what?" plateau [PC Q4].
  - Check that hold timers never require the full target range before counting (Hinge complaint [PC Q4 Inferences]). I did not verify `engine.js` for this.
- **Effort:** M
- **Impact:** 8
- **Confidence:** 8
- **Main risk:** "Can't see you" interruptions are worst for floor exercises, where webcam tracking is least reliable [README Known limits, AI §2 Gaps]. One pre-session check and then quiet degradation, not repeated pop-ups.

### 4. Make the discomfort detector trustworthy: face off by default, de-confound effort, and a one-tap "was that check-in right?"
- **Category:** ML-model (privacy)
- **Patient concern it addresses:** #1. A false alarm tells a frightened person "you are hurting" and teaches hypervigilance [PC Q1 inferences]. A silent miss gives false comfort. Also the privacy worry about being watched in pain [PC Q5].
- **Concrete change in SpineSense:**
  - `js/store.js:13`: `faceSignal` defaults to `false`. First run explains in one sentence what it does, that it stays on the device, and that body-only mode loses little. Evidence: the face channel is weak during exercise (EmoPain face CCC 0.06; cross-dataset MediaPipe F1 about 0.52) [DB Q4, AI §3].
  - `js/core/discomfort.js`:
    - Lower the face weight from 1.0 to 0.5 or less, and stop it triggering a pause alone. Require corroboration from at least one movement signal (range, guard, shake).
    - In `grimaceScore()`, require sustained eye closure (about 0.4 s or more) for the AU43 term, since ordinary blinks inflate it [DB Q3 Inferences].
    - Weight orbital (AU6/7) and levator (AU9/10) above brow lowering (AU4), because effort also lowers the brow [DB Q5 Inferences].
    - Capture an "effort baseline" from the first demanding-but-comfortable rep.
  - `session.js` after a pause: "Was that check-in helpful? Yes / False alarm". Store it locally and nudge that user's threshold. This is also the labelled data source for the optional features-only donation described in the datasets section.
  - Before shipping, run the detector in silent shadow mode with 10-20 real volunteers. The thresholds have only been tuned on a simulator.
- **Effort:** M
- **Impact:** 8
- **Confidence:** 7
- **Main risk:** Down-weighting the face may miss genuine pain. Self-report stays the decision variable [CE §5 Inferences], so the cost is acceptable. Personal calibration helped most subjects but not all (MAE 3.67 to 2.47 on UNBC, 3 subjects unchanged) [DB Q5].

### 5. Fear-aware language: "hurt does not equal harm" micro-education at the moment of worry
- **Category:** UX (clinical)
- **Patient concern it addresses:** #1; #2 (scary MRI language and being dismissed); #4 (conflicting advice).
- **Concrete change in SpineSense:**
  - `js/views/session.js:556-558` currently tells the user "I noticed grimace and guarding". Replace the default with neutral wording ("Let's make this a bit easier"). Keep signal names behind a "Why did you say that?" tap. Naming "guarding" to a person who is already guarding can reinforce the very vigilance physios warn about [PC Q1 inferences].
  - Add 6-8 static, vetted cards shown at specific moments:
    - First run: "some discomfort that settles by tomorrow is common and not harm" [CE §5].
    - After an ease-off and after a stop.
    - On the history page: a "scary scan words" card [PC Q1 #2].
    - A myth-correcting card on posture (chatbots repeat the "posture causes back pain" myth 88% of the time) [AI §4].
  - Reuse the existing `why` and `caution` fields in `js/core/exercises.js` as the "why this is okay" line.
  - No LLM. Keep content static and reviewed.
- **Effort:** S
- **Impact:** 8
- **Confidence:** 7
- **Main risk:** Over-reassurance could talk someone out of a real problem. Always pair with item 1. Avoid marketing this as psychological therapy: NICE withdrew its psychological-therapy recommendations on 29 July 2026 [CE §2].

### 6. Symptom-responsive plan v2: "this one made it worse" button, 7-day swap, and "why this for you"
- **Category:** clinical
- **Patient concern it addresses:** #4 conflicting advice and not knowing which exercise fits me [PC Q1 #4]; #1 (PT or stretches that aggravated it).
- **Concrete change in SpineSense:**
  - `session.js` `completeExercise()` already asks pain and "too easy / just right / too hard". Add "Made my back worse" (and, via item 1, a leg-symptom option). Store the flag in `state.progress[id]`.
  - `js/program.js` `todaysPlan()` currently uses aggravators for two rules only (knee-to-chest, hip-hinge). Extend it: a flagged exercise is rested for 7 days, replaced from a small "if X hurt, try Y" table, and the reason is shown ("You said this aggravated your back on 12 Oct").
  - Optional later step: one very gentle standing extension option for people whose pain is aggravated by sitting or bending, offered only after item 1 is live (McKenzie press-ups provoked tingling for some Reddit users [PC Q2]).
- **Effort:** M
- **Impact:** 7
- **Confidence:** 6
- **Main risk:** Looks like a diagnosis. Directional preference is prognostic but not a proven treatment modifier, and its reliability is inconsistent (kappa 0.15-0.9) [CE §7]. Use "choose by comfort" language, never "your directional preference is".

### 7. Walking plan and a one-tap flare mode
- **Category:** clinical (adherence)
- **Patient concern it addresses:** #7 flares from trivial movements (~14 threads); what helped most is walking and gentle movement [PC Q2]; #1.
- **Concrete change in SpineSense:**
  - New non-camera "Walk" item in `js/program.js` and `js/views/dashboard.js`. The user self-reports minutes, the app proposes a progressive target, and offers "short bouts if walking brings on symptoms".
  - A "I'm in a flare" button on the dashboard sets everything to Gentle with fewer reps, drops floor-loaded exercises, adds walking in short bouts, and shows a short reassurance card ("flares are common and can last hours to weeks" [CE §4, Costa definition]). It exits after two days back at baseline and triggers the item 1 re-screen on entry.
  - Evidence: WalkBack cut activity-limiting recurrences (HR 0.72; median 208 vs 112 days) [CE §3]; NICE suggests exercise for a flare, scaled to tolerance [CE §2].
- **Effort:** M
- **Impact:** 8
- **Confidence:** 7
- **Main risk:** WalkBack was supervised (6 physio sessions) in people who had already recovered, so unsupervised effect is unknown [CE §3]. Some people's symptoms are provoked by walking [PC Q2 counterpoint]. Keep walking as a suggestion that respects the aggravator list.

### 8. Adherence kit: "Quick 5" session, opt-in reminder, week view instead of streak, confidence and goal tracking
- **Category:** adherence
- **Patient concern it addresses:** #8 sticking with home exercises (and the Q3 survey: forgot 40%, no time 33%, boring 22%, no quick results 19%, no accountability 15%) [PC Q3]; #6 low mood making it harder.
- **Concrete change in SpineSense:**
  - "Quick 5" button on the dashboard: two exercises only (the estimator in `todaysPlan()` already floors the plan at 5 minutes).
  - Reminder with no server and no push: a downloadable repeating calendar event (.ics) plus an in-page notice when the app is open. Opt-in only; Hinge's pushy outreach is a stated complaint [PC Q4].
  - Replace the flame and "Keep it going" (`dashboard.js:56, 85`) with "days active this week" where rest and flare days are never counted against the user. A streak invites exercising through a flare.
  - Add a 0-10 "How confident are you about bending / sitting today?" before and after sessions, and 1-3 personal activity goals scored 0-10 (PSFS-style). Self-efficacy is a better-supported predictor of adherence than reminders [CE §4, Essery 2016] and rises faster than pain.
  - RMDQ every 2-4 weeks (public domain, may be adapted online [CE §6]) with a "meaningful change" message at 5 points or 30% [CE §6, Ostelo 2008].
- **Effort:** M
- **Impact:** 7
- **Confidence:** 6
- **Main risk:** Generic adherence tactics have not been shown to work long-term [CE §4, McLean 2010]. RMDQ completed inside an app is unvalidated [CE §6 Gaps]. Daily confidence ratings may increase body-monitoring. Keep them to once per session.

### 9. One-page summary the user can show their own physio or doctor
- **Category:** UX (clinical bridge)
- **Patient concern it addresses:** #2 (feeling dismissed, "deal with the pain") and #5 (cost and access: waiting weeks for an NHS physio, or giving up on PT) [PC Q1]; physio scepticism about "standalone" apps [PC Q4, AI §5].
- **Concrete change in SpineSense:**
  - `js/views/history.js`: a "Print summary" button that uses a print stylesheet and never leaves the device. Contents: pain before and after trend, range per exercise, stop and ease-off events with the reasons the user gave (including item 1 leg answers), next-day responses (item 2), the date of the last red-flag screen, and a line saying what the app is not.
  - No face data and no images.
- **Effort:** S
- **Impact:** 6
- **Confidence:** 7
- **Main risk:** The reader may over-trust unvalidated process metrics. Label rep, range and form numbers as engagement data, not clinical outcomes [CE §6 Inferences].

### 10. Gentle crisis and low-mood pathway, plus a "bad day" option
- **Category:** safety
- **Patient concern it addresses:** #6 mental-health impact (~16 threads, including "Life doesn't feel worth it" and "What's the point of living") [PC Q1 #6].
- **Concrete change in SpineSense:**
  - New small static "Support" page linked from Settings and the stop screens. It asks the user's country and links to a directory of crisis lines (for example findahelpline.com; this is my suggestion, it is not in the research notes).
  - Optional single weekly item ("How have you been feeling in yourself?"). Two low answers in a row show a calm message and a suggestion to speak to a GP or doctor. No scoring, no labels, no diagnosis.
  - A "bad day" option on the dashboard: a two-minute breathing and gentle-movement choice instead of a full session.
  - The inferred need is written down in [PC Q1 Inferences].
- **Effort:** S
- **Impact:** 6 (rare but severe)
- **Confidence:** 6
- **Main risk:** Intrusive, mis-localised or liability-adding if it looks like screening. Keep it opt-out, static and unscored. Whether a validated tool such as PHQ-2 is free to embed is not covered in the notes, so I did not propose one.

### Considered and left below the line
- #9 sleep and night pain: night pain is already one of the six red flags (js/program.js:11). A sleep-position tip card is cheap but low evidence in the notes.
- #10 desk sitting: "stand up and move" nudges fit item 8's reminder, but they need no new model.
- #5 cost: SpineSense being free and ungated is already the answer [AI §7]. Item 9 helps people stretch scarce physio time.

---

## Top 5 datasets to train with first (ranked)

Principle: SpineSense's user chooses the exercise, so exercise recognition is not the bottleneck. The bottlenecks that hurt this user are quality and error scoring, rep segmentation, camera-angle robustness (item 3), and discomfort and protective-behaviour logic (item 4). I ranked by fit to those, ease of access for an individual owner, and licence risk. Everything below should be re-extracted with the same MediaPipe model variant SpineSense runs in the browser [DP KQ4].

| Rank | Dataset | What model it trains | Why | Licence caveat |
|---|---|---|---|---|
| 1 | **KERAAL** (low back pain patients; Kinect, RGB, OpenPose and **BlazePose 33-keypoint** streams, Vicon for some) [DP KQ1] | Quality and error scoring for standing trunk movements: flank stretch (lateral trunk bend, the closest match to the side bend), torso rotation, and "hiding face" (a partial arm-raise match). Also rep and error-window logic and measuring the Kinect-to-BlazePose gap. | Only open set with real LBP patients, MediaPipe-family keypoints already included, and fine labels: error type, body part, per-frame time window. Annotator kappa 0.63, about the same as the Kaia-versus-physio benchmark [AI §2]. | Repo is BSD-2-Clause but the **data licence is not stated**. Get written confirmation from the authors (Nguyen, Devanne et al.) before shipping any weights. Only 12 annotated patients; the paper's LSTM baselines are weak (31-54%), so use it to validate and calibrate rules and train small heads, not a deep net. |
| 2 | **KIMORE** (78 subjects; RGB, depth, skeleton; clinician score 0-50; low back pain exercises) [DP KQ1] | Continuous quality-score regression for arm lift, lateral trunk tilt (side bend) and squat (a proxy for sit-to-stand and hinge). Also population range-of-motion norms. | LBP-oriented exercises with a clinical quality score. RGB is included, so MediaPipe can be re-extracted (done in published work). | **Licence not stated**, and the VRAI server refused connections on 2026-10-16 (availability unverified). The 34 patients include stroke and Parkinson's, not all LBP. MediaPipe's z-axis is weak for pelvis rotation, so skip that exercise [DP KQ3]. |
| 3 | **REHAB26-ViewAngles** and **REHAB24-6** (native MediaPipe 33-joint 2D and 3D, RGB; correct/incorrect, error type, rep boundaries; 29 viewing angles) [DP KQ1] | Rep segmentation and correct/incorrect classification. Most importantly, a **camera-angle robustness / tracking-confidence model** that feeds item 3. | Directly targets the user-facing problem of "does the app see me properly from where I put the phone?" It is the only dataset built to study viewing angle with MediaPipe. | **CC BY-NC 4.0, academic or non-profit only** per Zenodo. A free app is not automatically "non-commercial research". Ask the authors for written permission before shipping weights, and re-ask if the app is ever monetised or sponsored. Tiny (5 and 10 subjects), healthy people, only arm abduction, squat and shoulder extension. |
| 4 | **UI-PRMD** (public domain) and, as an add-on, **KINECAL** (CC0, ages 18-92, includes 5x sit-to-stand) [DP KQ1] | Pre-training for quality scoring of sit-to-stand and squat (hinge proxy), and older-adult sit-to-stand baselines for range and tempo. | The only quality-labelled sets with clean licences. Ageing is the growth driver of LBP [CE §1], and KINECAL covers older bodies that lab sets miss. If you want to ship weights without legal back-and-forth, rank this above #3. | UI-PRMD is ODC PDDL (public domain), but the official page is 404 (copy via the EGCN GitHub). Skeleton only, so it needs a Kinect-to-MediaPipe joint mapping and is for pre-training only. "Incorrect" means performed non-optimally by 10 healthy adults, not injury-specific. KINECAL is 180 GB and skeleton only. |
| 5 | **EmoPain** (and EmoPain@Home) (chronic low back pain; protective-behaviour labels; sit-to-stand and bend-down) [DB Q2] | The discomfort and protective-behaviour logic: guarding, hesitation, bracing, abrupt action, rubbing. Use the taxonomy now to label SpineSense's own data; use the data later for validation. | The only dataset that labels protective behaviour in people with chronic LBP. Its six behaviours line up closely with SpineSense's range-drop, slowing, guard, shake and shrug signals [DB Q2 Inferences]. | **Licence not stated; request-only** via Prof. Nadia Berthouze, and requests normally need an academic. Body data are IMU joint angles, not video; raw video exists only for consenting participants, and the 2020 challenge released features only [DB Q2]. Face pain recognition during exercise was near chance (CCC 0.06), and webcam performance of any body model is unknown [DB Q4]. Start the request early because it has lead time. |

Not chosen first, and why:
- **UNBC-McMaster, BioVid, MIntPAIN, X-ITE:** academic and non-commercial only; MIntPAIN bans training or testing commercial systems; UNBC bans uploading to model repositories [DB Q1, Q6]. They are useful only for offline validation of the grimace score through an academic partner. Most use stimulus-level labels, not observed pain.
- **Fit3D, QEVD, MM-Fit, FLAG3D, Fitness-AQA:** mainly exercise recognition and generic gym error types. The user already picks the exercise. Licences are research-only or unstated [DP KQ1].

The honest data gap: no downloadable dataset has pose labels for **glute bridge, bird dog, single knee-to-chest or the unloaded hip hinge** [DP KQ2]. Those four are three of the exercises that are hardest to track on a webcam. Plan:
1. Keep the existing angle rules as the primary scorer. Angle rules matched or beat deep models on a comparable small set (IMCD) [DP KQ3].
2. Add an **opt-in, off-by-default "help improve SpineSense" donation of features only** (MediaPipe landmarks plus the user's own "was that right?" and pain labels from items 4 and 1). Never video. It needs explicit consent for training [DP KQ4, DB Q6].
3. Have a physio label a sample using KERAAL's taxonomy (error, body part, time window) and report inter-rater kappa [DP KQ4].

---

## 3 things SpineSense must NOT do

1. **Must not present camera output as a pain measurement, a diagnosis, or an all-clear.**
   - No "pain detected: 7/10", "your form is safe", "good posture", "unstable spine", and no recommending belts, TENS or medicines.
   - Absence of a flag never means safe. The camera cannot see tingling or numbness, and the face channel is near chance during exercise [DB Q4].
   - "Detects pain" is a regulated medical-device claim (PainChek needed FDA De Novo, CE and UKCA routes); the wellness framing is "notices signs you may be straining and checks in" [AI §6].
   - Chatbot-style posture myths feed kinesiophobia [AI §4, CE §4]. Self-report remains the decision variable [CE §5].
2. **Must not push someone past a symptom or into a streak.**
   - No automatic progression after a worse next day, after leg symptoms, or while a red flag is open. No streak or flame pressure that rewards training through a flare (dashboard.js currently shows one).
   - No hold timer that only counts at full range (Hinge complaint [PC Q4]). No "pain is your teacher" messaging [PC Q3]. No unsolicited push messages [PC Q4].
   - Never let a user continue after saddle numbness or bladder or bowel change [CE §7].
3. **Must not let health-inferred data leave the device, or train on people without explicit opt-in.**
   - No video, landmarks, blendshape streams, grimace scores or pain ratings in analytics, crash logs, cloud LLM calls or third-party pixels. No employer or insurer link. Keep the "no network during sessions" claim technically verifiable [AI §6, PC Q5].
   - The optional "ow/stop" speech feature already sends audio to the browser maker's speech service (README Privacy). Keep it off by default and clearly disclosed.
   - No shipping of model weights trained on non-commercial or academic-only data (UNBC, BioVid, MIntPAIN, REHAB24-6/26, Fitness-AQA) without written permission [DB Q6, DP KQ1]. Free is not the same as non-commercial academic research.

---

## One bold idea (an outlier others might not propose)

**"Prove it to yourself": a prediction-versus-reality ledger for feared movements.**

Everyone else will propose more sensing. This idea points the camera at the belief that keeps people stuck.

- The user picks one feared everyday movement from a short list (bending to pick up laundry, getting out of a chair, putting on socks, carrying a bag) and answers two taps: "How much pain do you expect, 0-10?" and "How confident are you?".
- SpineSense runs a graded, camera-checked version using movements it already has: hip hinge at Gentle, sit-to-stand with hands allowed. Item 1's leg-symptom check runs throughout.
- Afterwards it records actual pain, then the next-day answer from item 2. The result is a simple ledger: "You expected 7. During it you felt 3. Next day: same as usual." Over weeks the gap between expectation and outcome is the user's own evidence that the movement is safe.
- Why it might work: the largest effect in the clinical notes comes from cognitive functional therapy (RESTORE, RMDQ -4.6 versus usual care, sustained to 3 years), and adding biofeedback sensors on top added nothing. That points at changing beliefs and graded exposure, not at better sensing [CE §3]. The Reddit physio comment ("fear of movement can become its own problem") and the "damage beliefs" literature say the same [PC Q1 #1].
- It is cheap: it reuses existing exercises, the pain scale and the item 2 check-in. The ledger is private and stays on the device.
- Effort M-L. Impact 8 if it works. **Confidence only 4-5.** There is no trial in the notes of an app-delivered version, and RESTORE was delivered by therapists.
- Risks:
  - It can backfire in highly fearful users, or nocebo them with a high prediction.
  - Never offer it with a red flag, leg symptoms or pain of 7 or more.
  - Do not call it therapy: the claim could pull it toward regulated treatment, and NICE withdrew its psychological-therapy recommendations in July 2026 [CE §2].
  - Pilot it first with a handful of low-risk movements and a physio reviewing the wording.

---

## Caveats on this brainstorm

- The five research notes are the evidence base. I did no new web research.
- Code statements come from the files I read plus keyword searches of js/. I did not read all of js/core/engine.js, js/views/dashboard.js or js/vision/tracker.js. "Not found" means a search of js/ returned nothing, not that I proved absence.
- Impact and confidence scores are my judgement. They are not measured. The highest-confidence items (1, 3) are mostly about plumbing that the notes support; the lowest (bold idea, item 6) rest on low-certainty or untested evidence.
- Several clinical thresholds (the next-day rule, the leg-symptom stop rule) are extrapolated from tendinopathy or the centralisation literature, and the notes say so [CE §5, §7].
