# SpineSense: ML-engineer brainstorm (what is measurable, trainable and shippable by one developer)

Date: 2026-10-17. Method: read README, `js/core/{engine,exercises,discomfort,sim,geometry,filters}.js`, `js/vision/tracker.js`, `js/program.js`, `js/store.js`, `js/views/{session,safety,diagnostics}.js`, `test/engine.test.mjs` and the five research notes. No new web research. I did not run the app or the tests. Every number below comes from the notes unless marked "my estimate".

Source tags: **[PC]** patient_concerns_reddit.md, **[CE]** clinical_evidence.md, **[AI]** ai_digital_landscape.md, **[DP]** datasets_exercise_pose.md, **[DB]** datasets_pain_behaviour.md. Effort scale for one developer: S = up to 2 days, M = up to 2 weeks, L = more than 2 weeks.

## Framing: four facts that drive every recommendation

1. **Nothing in SpineSense has ever met a real body.** README "Known limits": thresholds are tuned on simulated movement. The unit tests assert zero false cues and zero false alarms on a clean synthetic person (`test/engine.test.mjs`), which is nearly a tautology. The first job is to measure the false-cue and false-alarm rate on real people, because every later ML choice depends on that number.
2. **Labels are the binding constraint, not model capacity.**
   - Public data covers the standing and upper-body exercises (arm raise, side bend, sit-to-stand) [DP KQ2].
   - It covers none of glute bridge, bird dog, knee-to-chest or hip hinge [DP KQ2].
   - No webcam dataset exists with pain or guarding labels [DB Q2 gaps, AI §3 gaps].
   - Human raters themselves only reach kappa of about 0.6 on form: KERAAL 0.63, Kaia vs physio 0.55-0.63, physio vs physio 0.61 [DP KQ1, AI §2]. Any form model claiming far above that is fitting rater noise or leaking subjects.
3. **Rules are a strong baseline here.** A hand-written angle classifier beat a 2s-AGCN on 4 of 6 poses (IMCD) [DP KQ3]. KERAAL's deep baselines get only 31-54% on 4-class error labels [DP KQ3]. So a learned model must earn its place against the rules on held-out people. Default to "rules decide, models advise".
4. **The face channel is the weakest evidence in the product but carries the highest weight.**
   - Face pain estimation during exercise (EmoPain 2020) has test CCC 0.06 [DB Q4].
   - MediaPipe-landmark pain models score F1 about 0.52 on unseen datasets [AI §3].
   - Effort shares the frown and jaw clench with pain [DB Q5].
   - In `discomfort.js`, `face` has weight 1.0, the largest, while `grimaceScore` sums brow, orbit, levator and blink.

**Thesis.** The best "AI" for SpineSense is, in order:
- (a) a measurement harness;
- (b) a closed safety loop built on the user's own self-report, including a next-day check;
- (c) personal calibration of the discomfort detector on that self-report;
- (d) small learned models only where public or own labels exist.

Deep models come last.

---

## Top 10 improvements (ranked, 1 = most important)

Ranking logic: safety and lowest-effort evidence-backed items first. Anything that creates labels for later learning goes before the learning itself.

**1. Close the safety loop: structured leg-symptom check + next-day "back to your usual?" check that drives progression** | safety / clinical | #1 fear of making it worse (about 38 threads), #3 sciatica and nerve anxiety (about 22), #7 flares (about 14) [PC Q1] | `js/views/session.js` `painCheck()/answerPain()`: add a one-tap "New leg pain, numbness or tingling, or pain moving further down the leg?" (Yes = stop that exercise, show the existing red-flag text, store `event.neuro = true`). `js/store.js`: add `followUps[]`. On the next app open at least 12 h later, show a 2-question card ("back to your usual level? / worse than usual?") and write `session.nextDay`. `js/program.js` `applyProgression()` currently uses only the same-session `painRating` and `formScore >= 75`; make it hold or regress when the next-day answer is "not back to usual within about 24 h" and allow 48 h for newly introduced exercises. `todaysPlan()` reads the same flag. Rules only, no ML. This is also the delayed-outcome label factory for items 5 and 6 and for the bold idea | M | 9 | 8 | The pain-monitoring thresholds are extrapolated from tendinopathy, not validated in LBP, and the peripheralisation stop rule is an inference, not a sourced rule [CE §5, §7]. Extra questions can cause fatigue or unsent follow-ups. Wording must not breed hypervigilance (physios: "fear of movement can become its own problem" [PC Q1]).

**2. Landmark-trace recorder + offline replay and evaluation harness ("measure before you model")** | data / ML-model | #1 and the "am I doing it right?" need [PC Q3]. You cannot reassure people with a coach whose thresholds are untested. | New `js/core/trace.js`: ring buffer of per-frame `{t, lm[33] (x,y,z,vis), world[33], engine state, events, face score as a number only}`, enabled by `?record=1` and exported as a JSON file. Today `js/views/diagnostics.js` samples every 0.5 s and caps at 480 samples (about 4 min), which is too coarse to replay. New `test/replay.test.mjs` feeds real traces through `ExerciseRun` and `DiscomfortDetector` and prints: rep-count error, false-cue rate per minute on correctly performed reps, false check-ins per 10 min on pain-free runs, "can't see you" fraction. Commit 20-30 volunteer traces as fixtures. Landmarks only, never video. The same files become training data (see Training plan). | M | 9 (enabler for everything else) | 9 | Collecting human data brings consent and privacy duties. Landmarks are pseudonymous health data, not anonymous [DP KQ4 inference]. Keep to consenting volunteers, local files, no server.

**3. Re-balance the discomfort detector against real-world confounds** | ML-model / safety | #1 hypervigilance ("it feels like you're being careful, not afraid") and #8 nagging leading to drop-off [PC Q1, Q3] | `js/core/discomfort.js`: (a) cap the `face` weight at about 0.5 and require at least one movement signal (range, tempo, guard, shake) for `moderate`. Today face alone reaches 1.0, above the `medium` mild threshold of 0.7, so a hard rep with a frown triggers a silent 15% target shrink (`easeOff()`), and two such events within 60 s escalate to a pain check. (b) In `grimaceScore`, replace the instant `eyeBlink > 0.55` with sustained closure of at least 0.4 s, since AU43 vs AU45 depends on duration [DB Q3]. (c) Down-weight AU4 brow (effort) relative to AU6/7/9/10 [DB Q5 inference]. (d) Replace the fixed sigma floor of 0.04 with a sigma learned from a 10-second effortful easy rep ("effort baseline"). (e) Add smoothness (normalised jerk) and hesitation (pause count) to the movement signals. Tune on item 2's traces, not on `sim.js`. | S-M | 7 | 6 (changes are plausible, but nobody has tested them on this pipeline) | Lower sensitivity means missed discomfort. Mitigation: the manual "I feel pain" button, voice and movement signals stay, and the app never claims to detect pain. Tuning on a handful of volunteers overfits.

**4. Tracking-quality gate and camera set-up coach (refuse to coach on bad data)** | UX / safety / ML-model | "am I doing it right?" [PC Q3]. Tracking misreads are a top complaint even for funded apps [AI §5]. | New `js/core/quality.js`: a per-frame score from minimum visibility of the exercise's `required()` joints, limb-length consistency over 1 s, high-frequency jitter, and subject height in frame. `engine.js`: below the threshold, suppress form cues and rep-state changes and say "I can't see your hips clearly, lower the camera" instead of issuing a wrong correction. Add a pre-session framing screen colouring required joints by confidence, with a side-on check via the existing `frontalness()`. In the harness, A/B `joint()` 2D vs 3D per exercise. `geometry.joint()` uses world z whenever present, but z is MediaPipe's weakest axis [DP KQ4], and supine and quadruped are the hardest poses [DP KQ2 inference]. Assume +/-5-10 degrees of angle error and avoid thresholds with margins under about 10 degrees [AI §2]. | M | 7 | 8 | Over-gating makes the app refuse in ordinary rooms. Set the threshold from real traces and keep a visible "continue anyway, counting only" mode.

**5. On-device personalisation of detector weights from the user's own check-in answers** | ML-model | #1, #4 ("every back pain has a different source") [PC Q1] | `discomfort.js`: add `PersonalCalibrator`. Every answered check-in already yields a labelled pair (`ev.signals`, `ev.rating`). Fit a ridge-logistic model of P(rating >= 4) on the 6 signals, with the current `SIGNALS` weights as the prior. Require at least 8 labelled checks before any change, clamp each weight change to +/-40%, and never touch safety floors (manual pain, voice, rating >= 6 always stop). Show "your check-ins were >= 4/10 in X% of cases" on the dashboard. Ship in shadow mode first (log the would-be weights, don't apply). Supported by personalisation work: VAS MAE fell from 3.67 to about 2.47 on UNBC, but not for every subject (3 of the subjects did not improve) [DB Q5]. | M | 6 | 5 | Very few labels per user (0-3 per session), noisy self-report (weak face-vs-self-report correlation [DB Q5]). A drift toward under-detection is the main failure mode.

**6. Flare mode + "this made it worse, try X" substitution** | clinical / UX | #7 flares and recurrence (about 14), #4 conflicting advice (about 21), #1 [PC Q1] | `js/program.js` `todaysPlan()`: add a `flare` state. It is triggered by a user tap, by `painNow >= 7`, or by two consecutive "worse than usual" next-day answers (from item 1). It means Gentle only, 5 minutes or less, a walking prompt, and no floor flexion when `flexSensitive`. Add an explicit substitution map reusing the existing `flexSensitive/extSensitive` logic (knee-to-chest <-> glute bridge <-> walk; hip hinge <-> sit-to-stand), surfaced through the existing `reasons[]` strings. Consistent with NICE (group exercise for a flare) and the Costa flare definition [CE §2, §4]. | S-M | 7 | 6 | Extrapolated from guidelines, not tested in-app. Substitutions must not read as diagnoses.

**7. Walking goal and post-session walk prompt (WalkBack-style)** | clinical / adherence | Q2 "what helped": walking is a top-two answer; #7 recurrence; #8 [PC Q2] | `js/program.js`: add a camera-free `walking` item with a daily minutes target, ramped slowly and self-logged, skipped or reduced if the screening aggravator is `walking` or location is `leg`. Show it on the dashboard. WalkBack (n=701) cut activity-limiting recurrence, HR 0.72 [CE §3]. | S | 6 | 6 | The trial was physio-guided, with 6 sessions, in recently recovered people, and had more lower-limb adverse events (100 vs 54). The app-only effect is unknown. Some people flare with walking ("Everybody says walking but it brings on my symptoms" [PC Q2]).

**8. Adherence and progress kit: 5-minute plan, calendar reminder, RMDQ/PSFS with minimal-important-change display, physio summary** | adherence / UX | #8 sticking with exercises (about 13). Survey: forgot 40%, no time 33%, boring 22%, no quick results 19%, pain/fear 18%, no accountability 15% [PC Q3]. Also #5 cost and access [PC Q1]. | `js/views/dashboard.js` + `program.js`: (a) "5-minute plan" that picks one exercise per camera position, so the camera moves once. (b) Download a recurring `.ics` reminder; there is no server, so no push. (c) RMDQ every 2-4 weeks (public domain, online adaptation allowed) and PSFS-style goals; show change against MIC (RMDQ 5 points or 30%; NPRS 2) [CE §6]. (d) One-page printable session summary for the user's physio, which also answers the "standalone" criticism [AI §5, §7]. | M | 6 | 6 | Existing streaks (`computeStats`) can push people to exercise through pain; the pain stop rules must win over streak messaging. PROMs are not validated inside webcam apps [CE §6 gaps]. Do not add ODI (licence needed) and contact Keele before embedding STarT Back.

**9. Vetted, pain-neutral education layer (static, no LLM) with one consistent traffic-light rule** | clinical / UX | #2 diagnosis and MRI confusion (about 29), #1, #4 [PC Q1] | New `js/views/learn.js`: about 10 short cards ("hurt is not always harm", "scans often look scarier than they are", "posture myth", "why gentle is not giving up", "flare plan", "when to see a doctor"). Use one rule everywhere (session modal, plan, dashboard): 0-2 carry on / 3-5 easier / 6+ stop, matching the existing 0-3 / 4-5 / 6+ ladder and resolving the "don't do it if it hurts" contradiction [PC Q3 inference, CE §5]. Audit cue text in `exercises.js` and `session.js` for threat language. No LLM: chatbots said posture causes LBP 88% of the time [AI §4]. | S | 6 | 7 | Claims creep. "Detects pain" or disease-specific thresholds push the app toward device status [AI §6]. Needs regulatory review, not just my opinion.

**10. Verifiable on-device privacy: self-host models and WASM, CSP, face off by default, skeleton-only view** | privacy | Camera and employer/insurer worries are thin on Reddit but real [PC Q5]; face tracking is the most sensitive part [PC Q5 inference, DB Q6] | `js/vision/tracker.js` currently fetches the vision bundle from jsdelivr and the four `.task` models from storage.googleapis.com. Vendor them under `/vendor/`, add a service-worker cache for offline use and a CSP of `connect-src 'self'`. Add a test asserting zero third-party requests during a session, so "nothing leaves your device" is auditable. `store.js` defaults `faceSignal: true`; change to opt-in, with a clear body-only mode and a "hide video, show skeleton" toggle. | S-M | 5 | 8 | Bundling and maintaining about 13 MB of models; check the MediaPipe model licence before redistributing (not covered in the notes).

---

## Top 5 datasets to train with first (ranked)

**1. KERAAL** | Quality/error scoring for side bend (flank stretch = lateral trunk bend) and arm raise (partly "hiding face"); rep and hold segmentation from per-frame error time windows; real LBP movement style; Kinect-vs-BlazePose domain-gap measurement | Only dataset with LBP patients, spine-relevant exercises, error type + body part + time-window labels, BlazePose 33-keypoint 3D already extracted, and RGB; its Kinect/BlazePose/Vicon pairing lets you quantify the domain gap [DP KQ1, KQ4]. 2,622 recordings; 12 annotated LBP patients [DB Q2]. | Repo code is BSD-2; the **data licence is not stated** [DP KQ1]. Email the authors for written permission before shipping any weights. Label quality is modest (kappa 0.63; LSTM baselines 31-54%), and the subject count is small, so expect noisy per-class labels and use it for pretraining plus threshold calibration, not as ground truth.

**2. REHAB24-6 + REHAB26-ViewAngles** | Rep counting and segmentation; correct/incorrect and error type for arm abduction (arm raise) and squat (sit-to-stand proxy); camera-angle robustness (0/45/90 degrees, 29 viewing angles) | RGB + mocap ground truth lets you measure MediaPipe's error directly; REHAB26 ships MediaPipe 33-joint 2D+3D [DP KQ1]. Rep boundaries (1,072 + 1,665 reps) are what a rep-phase model needs. | **CC BY-NC 4.0**, academic and non-profit only. Use for internal R&D, benchmarking and as a teacher. Commercial or public release of derived weights needs authors' permission. 10 + 5 subjects only, so LOSO folds are small.

**3. KIMORE** | Quality regression (clinical score 0-50) for arm lifting, lateral trunk tilt (side bend) and squat; the largest subject pool (78, including LBP patients), which makes leave-one-subject-out meaningful | Five LBP-physio exercises with clinician scores, and RGB is included so MediaPipe can be re-extracted [DP KQ1]. | **Licence not stated; the server refused connections on 2026-10-16** [DP gaps]. The skeleton-only copy via EGCN GitHub can serve pretraining after joint mapping. Scores are not comparable across papers unless the protocol matches (0-50 vs 0-100, 78 vs 71 subjects) [DP KQ3]. MediaPipe's z-axis hurt pelvis rotation [DP KQ4].

**4. UI-PRMD** | Pretraining for sit-to-stand, squat, shoulder abduction/scaption quality (correct vs deliberately incorrect, pre-segmented reps) and rep segmentation | The only dataset here with a clean permissive licence (**ODC PDDL v1.0, public domain**), 10 subjects x 10 exercises x 10 reps [DP KQ1]. | Skeleton only (Vicon/Kinect, no RGB), so it needs a Kinect-22-to-MediaPipe subset mapping and is pretrain-only. Incorrect episodes were "non-optimal" movements, not clinically labelled. The official URL redirects to a 404; use the EGCN or Rehab-Pile copies.

**5. EmoPain (request now; it takes weeks)** | Discomfort / protective-behaviour model: use the 6-category taxonomy (guarding, hesitation, bracing, abrupt action, limping, rubbing) to design and validate the detector's movement features; train only if video can be obtained | The only labelled protective-behaviour data in chronic LBP; the categories map one-to-one onto SpineSense's signals (hesitation = tempo/guard, guarding = range, bracing = shrug, rubbing/shaking = shake) [DB Q2 inference]. Participants average age 50.5, closer to real users [DB Q5]. | Request-only (email Prof. Berthouze); **licence not stated**; body data is mocap/IMU, and video exists only for consenting participants [DB Q2]. An independent individual may not qualify. Its raters disagree heavily (alpha as low as 0.18 on some body behaviours) [DB Q5]. Plan for "no access" and rely on item 3 plus own data.

**Not first, and why:**
- Face-pain sets (UNBC, BioVid, MIntPAIN, X-ITE) are non-commercial and faculty-only. MIntPAIN's EULA bans "training or testing of commercial systems", and UNBC bans uploads to model repositories [DB Q1, Q6]. Use them only through an academic partner, for research validation, never for shipped weights. Delaware posed faces are fine for a sanity check if the OSF licence allows.
- Fit3D, MM-Fit, QEVD, FLAG3D: useful for generic rep-segmentation pretraining, but the licences are unstated or restrictive and none contains your floor exercises.
- MEx has "bridging" (CC BY 4.0) but only accelerometer, pressure mat and 12x16 depth, so it is useless for pose [DP KQ2].
- KINECAL (CC0, 5x sit-to-stand, ages 18-92) is skeleton-only and 180 GB; a later option for older-adult range priors.

Coverage gap to say plainly: none of the five covers glute bridge, bird dog, knee-to-chest or hip hinge. Those come only from your own data.

---

## Training plan

### Step 0. Acceptance gates before any model reaches a user (my proposals, not sourced)

| Target | Gate to promote a model above the rules | Metric / protocol |
|---|---|---|
| Rep and hold counting | Exact count >= 90% and off-by-one >= 95% on held-out subjects, and not worse than the rules in a paired subject-bootstrap | OBO, MAE of count, boundary F1 at +/-0.3 s |
| Form cues | Per cue: precision >= 0.8 at recall >= 0.5, and kappa vs physio within 0.1 of the physio-physio kappa | Per-cue PR-AUC, Cohen's kappa; precision is prioritised because false corrections destroy trust (camera-app complaints [PC Q4]) |
| Posture / set-up | Macro-F1 >= 0.95 on held-out subjects | Confusion matrix |
| Discomfort | False check-ins at most 1 per 10 min in pain-free volunteers (revisit after the pilot); trigger precision reported as "share of check-ins rated >= 4", per user, not pooled | Per-subject distributions, bootstrap CIs over subjects |
| Latency | Inference < 5 ms per call at 5-10 Hz, with no more than a 2 fps drop in the Diagnostics fps meter | Mid-range laptop CPU |

### Step 1. Baseline the existing rules (week 1-2, no ML)
- Build item 2 (trace recorder + replay).
- Record 8-10 volunteers doing all 7 exercises correctly, so the **false-cue and false-alarm rate on real bodies** becomes the first benchmark. Add 3-4 instructed bad-form takes each.
- Fix anything the rules get wrong (thresholds, 2D vs 3D `joint()`, framing) before collecting more labels. If rep counting already meets Step 0, do **not** train a rep model.

### Step 2. Data prep (shared by all models)
1. **Re-extract landmarks from RGB videos with the same pipeline the browser uses.**
   - Use the same Pose Landmarker `full` float16 `.task` file as `tracker.js` (`MODELS.full`), `numPoses: 1`, 0.5 confidences, and VIDEO mode with monotonic timestamps. Tracking mode differs from per-frame IMAGE mode, so do not extract frame by frame in IMAGE mode.
   - Python `mediapipe` for bulk. Then run a **parity check**: process 3 clips through the real browser path (headless Chrome driving `CameraTracker`-style code) and require a median landmark difference of at most about 0.5% of frame size. If parity fails, extract everything via the JS path.
   - Cost: the UCO study measured MediaPipe at about 66 FPS on CPU [DP KQ3]. REHAB24-6's 185k frames is therefore roughly an hour per camera; treat all extraction as hours on a laptop, not days (my estimate, hardware unverified).
2. **Keep raw landmarks; smooth at feature time.** Store raw `lm` and `world` with timestamps. Apply a copy of `LandmarkSmoother` (One-Euro, `minCutoff` 1.0, `beta` 4.0) inside the feature extractor, because the app feeds smoothed landmarks to the engine.
3. **Write feature extraction once, in JS.** New `js/core/features.js` (pure, no DOM, node-testable) computes the model input; a Node script dumps float32 `.bin` + JSON manifest; Python only trains. This removes train/serve skew. Channels (about 80):
   - angles: hip, knee, elbow, shoulder for both sides, trunk tilt, lateral tilt, `frontalness`, arm and leg elevation (about 16);
   - their finite-difference velocities (16);
   - hip-centred world coordinates for 13 joints, divided by torso length (39);
   - visibility of those 13 joints (13).
   - Time axis: resample by timestamp to 15 Hz, never by frame index; the app's frame rate varies.
4. **Normalisation.** Origin = hip midpoint, scale = shoulder-mid to hip-mid length (3D world). Angles are the view-robust core. Do not rotate world coordinates into a body frame: in side view the hip axis lies along z, MediaPipe's weakest axis. Feed `frontalness` as an input so the model knows the view. (Assumption: world landmarks are hip-centred metres; the notes flag this as unverified [DP KQ4 gaps], so check it on one clip.)
5. **Joint mapping for skeleton-only sets (UI-PRMD, KIMORE skeleton copy, KINECAL, IRDS).** Map **by joint name, never by index**; indices differ per copy (Rehab-Pile uses 18 joints for KIMORE, 22 for UI-PRMD, 25 for IRDS/EHE/KINECAL [DP KQ4]). Use only the 12 shared joints: shoulders, elbows, wrists, hips, knees, ankles (MediaPipe 11-16, 23-28). Drop the Kinect spine joints (MediaPipe has none) and head. Mark those channels missing for datasets lacking them and train with **random joint-group dropout**, which also covers occlusion in lying poses. Add a dataset-id embedding so the network can absorb the Kinect-to-BlazePose shift. Pretrain on these only; fine-tune on RGB-derived data.
6. **Augmentation:**
   - mirror (swap L/R, flip x; swap limb labels);
   - viewpoint jitter (+/-30 degrees yaw, +/-10 degrees camera roll on coordinate channels; angle channels are invariant);
   - frame-rate jitter and random 10% frame drops;
   - Gaussian noise whose amplitude is measured from stationary segments of your own traces;
   - time-warp 0.7-1.3x for labels that are not tempo-related only;
   - skeleton-level error injection in the spirit of EGPA, with parameters tied to the real error classes [DP KQ3].
   - `sim.js` `SimPerson` can generate nominal and injected-error traces, but use them to test plumbing and to pretrain at most. Its z-values and noise are invented, and synthetic augmentation did not help when real data was available (pain-face work) [AI §3].
7. **Splits:** always by subject. Report leave-one-subject-out where subjects number at least 10 (REHAB24-6, KIMORE, KERAAL patients), else grouped 5-fold by subject. Also hold out one **camera angle** (REHAB26) and, separately, one **whole dataset**, and report the gap. Within-subject splits inflate results badly: UNBC F1 91-96% within vs 40-67% leave-one-subject-out [DB Q4].

### Step 3. Models, sized for the browser

| Model | Purpose | Architecture | Size / cost |
|---|---|---|---|
| **M1 posture/set-up classifier** | Better "lie on your back" / "get on hands and knees" checks than `trunkTilt > 55` | MLP 80 -> 64 -> 32 -> 6 classes (standing-front, standing-side, seated, supine, quadruped, other) on 0.5 s mean features | about 8k params, trivial |
| **M2 rep/hold phase** (only if Step 1 shows rule failures) | Per-frame phase (rest, moving, top, holding, release) | Causal 1-D CNN, T=48 steps (about 3 s), 3 blocks of depthwise-separable conv (k=5, dilation 1/2/4) at 32-48 channels, BN folded, ReLU6; a LITEMV-style cheap CNN, which was the best and cheapest model on the 60-task Rehab-Pile benchmark [DP KQ3]. PoseRAC-style "two salient poses" is the fallback idea | about 25-40k params, about 1M MACs per call |
| **M3 error heads** | Per-exercise multi-label cue probabilities (trunk sway, low range, too fast, asymmetry, head lift, over-arch, wrong limb, hold wobble) plus an abstain output | Same trunk as M2, sigmoid heads, label smoothing 0.05, class-weighted BCE; pretrain multi-task with a dataset embedding, fine-tune per exercise; calibrate by temperature scaling on held-out subjects | same size |
| **M4 personal discomfort layer** | Item 5 | Ridge-logistic on 6-10 signals, about 10 floats in localStorage, prior = current weights | negligible |

Training uses PyTorch, AdamW, lr 2e-3 with cosine decay, about 60 epochs; everything trains in minutes on a laptop CPU or free Colab (PoseRAC reports about 20 min training [DP KQ3]). Avoid ST-GCN and transformers: STGCN was close to chance on classification and VanTran was the most expensive in the Rehab-Pile benchmark [DP KQ3], and they bring dependency and latency cost for no proven gain here.

**Runtime.** Under about 100k params, ship weights as a Float32 binary plus JSON metadata (normalisation stats, thresholds, training-data hash, dataset licence note) and run a **hand-written JS forward pass** (conv1d, ReLU, linear, sigmoid, roughly 100 lines). That keeps the repo's "no dependencies" property and the `node --test` workflow. Verify it against PyTorch on 20 fixture windows to within 1e-4. Switch to ONNX Runtime Web or TF.js only if you outgrow that (more than a few hundred thousand params or frequent architecture swaps). Either runtime adds a multi-MB payload (my estimate), comparable to the app's whole MediaPipe download (about 13 MB per the README). Run inference in a Web Worker at 5-10 Hz so the MediaPipe loop is not blocked.

### Step 4. Plug-in to the existing engine (rules stay as baseline and fallback)
1. **Shadow mode first.** `session.js` calls `ModelBank.infer()` every 100-200 ms and writes predictions into the trace. Nothing is user-visible. Review disagreements against the rules.
2. **Arbitration table:**

| Decision | Who decides |
|---|---|
| Stop / regress / ease-off ladder, red-flag screening, progression | **Rules + self-report only.** Models never decide these. |
| Form cue | Rule fires, or (model prob >= tau **and** tracking quality OK). The existing `FORM_PERSIST` 0.4 s debounce still applies. |
| Suppressing a rule cue | The model may suppress only when tracking quality is low or the model strongly contradicts a borderline rule. It may never suppress a safety stop. |
| Rep boundary | Rules by default. M2 used as a tie-breaker only where Step 1 showed rule failures. |
| Discomfort bump | M4 re-weights existing signals; hesitation-style features feed `bump('guard', ...)`. |

3. **Hook shape.** The existing interface already fits: `spec.form[].test(f, side, base, ctx)` can read `ctx.ml?.p[id]`. Everything degrades to today's behaviour when `bank == null`, loading fails, latency exceeds budget, or the model abstains. `engine.test.mjs` must keep passing with `bank = null`, unchanged.
4. **Promotion** only when Step 0 gates pass on held-out subjects, behind a Settings flag ("Experimental coaching (beta)"), one cue type at a time.
5. **Progression is not learned.** `applyProgression()` should rely on self-report and the next-day check (item 1). Today it also needs `formScore >= 75`; the form score is rule-derived and untested, so false cues would block levelling up (the "Now what? Level 55" plateau complaint [PC Q4] in reverse), while missed cues would let people progress on bad form. Re-examine once the harness gives a real cue-error rate.

### Step 5. Collect SpineSense's own data for glute bridge, bird dog and knee-to-chest
- **Recorder, not a donation server.** Use item 2's `?record=1`. Store pose landmarks + engine events + labels in a local JSON file; no video, and no blendshapes unless a separate face study is consented. You collect the files yourself from volunteers. This avoids server liability and Art. 9 data transfers at this stage [DB Q6, AI §6].
- **Who:** at least 20 volunteers for the first wave, including several aged 50+ and some with non-specific LBP recruited via a physio partner; mixed sex, skin tone, body size, clothing, lighting. Anyone with a red flag in the app's own screening is excluded. If patients are recruited, get ethics review and explicit GDPR Art. 9(2)(a) consent that names model training [DP KQ4, DB Q6].
- **Protocol per person:** 3 floor exercises x 3 camera set-ups (side-on low at 2 m; 45 degrees; phone on the floor) x (5 correct reps + 3 reps of each scripted error), on 2 different days.
  - Glute bridge errors: over-arch (ribs flaring), hips not lifting, pelvis rotation, knees falling in.
  - Bird dog errors: spine sag or rotation, limb raised too high, wobble during hold, wrong limb pairing.
  - Knee-to-chest errors: head lifting, jerky pull, resting leg lifting, short range.
  - The scripted errors are acted. Say so in the paper trail; acted errors are not natural errors.
- **Labels:** two layers.
  1. Free weak labels from the engine (rep boundaries, hold intervals, which cue fired).
  2. Human relabel with the KERAAL taxonomy (error, body part, begin/end time, significant vs small) [DP KQ4], using a small skeleton-replay labelling page (`tools/label.html`), with a physio on at least 30% of the data to compute kappa. If raters need video, record a consented clip locally for the labelling session and delete it afterwards. Retain only traces + labels.
- **Independent reference for the over-arch and hip-lift proxies:** for 3-5 volunteers, strap a phone IMU to the sacrum or lumbar region (free sensor-logger app) and compare pelvic tilt against the MediaPipe-derived `hipAboveLine` and shoulder-hip-knee angles. This goes some way toward the "no single-webcam validation for floor exercises" gap [AI §2 gaps]. Feasibility is my estimate.
- **Honest sample size.** 20 people x about 40 reps x 3 exercises is about 2,400 reps, and perhaps 700 error positives spread across 8-12 error types, which is about 40-80 positives per class. That is enough to **set thresholds and fit regularised logistic or small-GBDT models on about 20 angle features** with the rules as priors. It is **not** enough to train a deep network from scratch. Deep pretraining comes from the public sets in Step 2, then fine-tune.
- **Pain labels cannot come from healthy volunteers.** Real discomfort labels come only from consenting LBP users in deployment (signal vector + 0-10 rating + next-day answer). Add an opt-in "export my anonymised check-in log" file and collect these manually from pilot users.

### Step 6. Evaluation details to report (always with subject-level bootstrap CIs)
- **Classification:** macro-F1 + confusion matrix; calibration (ECE) and a **risk-coverage curve** for the abstain option, which is the main safety lever.
- **Rep counting:** exact count, off-by-one, boundary F1 at +/-0.3 s (the PoseRAC OBO metric [DP KQ3]); the rules' score on the same traces is the baseline.
- **Quality scores (KIMORE-style):** MAD and Spearman; never compare across papers unless the protocol (score scale, subject subset) matches [DP KQ3].
- **Error cues:** per-cue PR-AUC, precision at fixed recall, kappa vs physio against the physio-physio kappa (about 0.6 is the ceiling).
- **Discomfort:** false check-ins per 10 min (pain-free volunteers), time to first check-in after an instructed guarded rep, trigger precision in LBP pilot users as "share rated >= 4", reported per user. Report face-channel results split by skin tone, age and sex, because published pain-AI audits find gender and age/ethnicity gaps [DB Q5].
- **Domain gap:** use KERAAL's paired Kinect/BlazePose streams to quantify the remaining shift after joint mapping [DP KQ4].
- **Robustness sweeps:** camera angle (0/45/90 degrees), distance, lighting, clothing, frame rate (12-30 fps), and the Pose Landmarker `lite` vs `full` variants that `tracker.js` already exposes.

### Step 7. Shadow pilot (4-6 weeks)
Ship the recorder and models in shadow mode to about 15-25 consenting people (volunteers + physio-partner patients). Compare model vs rule outputs offline weekly, retrain once, then promote cues that pass Step 0.

### Step 8. Outcome evidence (what proves it helps; model metrics do not)
No RCT of webcam-guided home exercise for LBP exists [CE §3 gaps]. App engagement has not tracked outcomes (Rise-uP: usage vs pain relief r = -0.042; 44% 12-month dropout [AI §1]). Pre-register a small uncontrolled pilot: RMDQ change at 4 and 12 weeks (>= 5 points or 30% is the MIC), NPRS change (2 points), sessions/week at weeks 4/8/12, adverse events (flare after a session, stop events), and the share of next-day answers "back to usual". Say clearly that it is uncontrolled and that expectations for app-only self-management are modest (SELFBACK RMDQ 0.79 [CE §3]).

---

## 3 things SpineSense must NOT do

1. **Must not claim to detect, measure or diagnose pain, or claim to measure the lumbar spine.**
   - Face and movement signals only prompt a self-reported 0-10 check; the rating stays the decision variable [CE §5 inference].
   - "Detects pain" is a regulated function in the US, EU, UK and Australia (PainChek needed De Novo and CE/UKCA routes) [AI §3, §6].
   - A single webcam sees a shoulder-hip line, not lumbar curvature (README limits; no single-webcam lumbar validation exists [AI §2]).
   - No "bad posture" or "unstable spine" language either; posture myths and threat language feed fear-avoidance [AI §4, CE §4].
2. **Must not let a learned model, the face channel or an LLM override safety rules, relax a stop, or raise load.**
   - Red-flag screening, stop/regress/ease-off, and level-ups stay rule-based plus self-report plus next-day check.
   - No model may auto-progress on a form score.
   - No LLM-written exercise programmes: ChatGPT-4 programmes progressed too fast for disc herniation [AI §4].
   - Learned components can only add caution (extra check-ins, suppress an uncertain cue) or advise in shadow mode.
3. **Must not move user data off the device or ship weights without a clear right to them.**
   - No video, landmarks, blendshapes or pain ratings leave the browser by default; no third-party analytics or ad pixels (FTC Health Breach Notification Rule and GDPR Art. 9 exposure [AI §6, DB Q6]).
   - Any training on user data is explicit opt-in, landmarks and labels only, never video.
   - Do not ship weights derived from non-commercial or unstated-licence data (REHAB24-6/26, UNBC, BioVid, MIntPAIN, Fitness-AQA; KIMORE, KERAAL data) without written permission from the owners [DP KQ1, DB Q6]. Keep a licence note in each model's metadata.

---

## One bold idea (an outlier): an on-device N-of-1 dose-finder, "Which exercise helps *me*?"

**Idea.** Use the app as a personal experiment. Treat the user's own delayed outcome as the label, not their face.

- **Introduction protocol.** Introduce exercises one at a time and wait 24-48 h before adding the next. This automates the folk rule users already share: "re-add exercises one at a time and stop any that increase pain within 24-48 hours" [PC Q2], plus the pain-monitoring model's next-morning check [CE §5].
- **Estimator.** Keep a Beta-Bernoulli estimate per (exercise, level) of P(next day worse than usual), with a conservative prior, updated from item 1's next-day answers. Condition on a context vector (pain before, signals during, flare state).
- **Planner.** Constrained Thompson sampling or a simple "dial down, hold, try up" rule, restricted to levels the screening already allows. Never above the screening cap, never during a flare or when `painNow >= 7`. Light randomisation between two equally appropriate options (order, or +/-1 rep block) gives weak causal leverage for users who opt in.
- **Output.** Descriptive, uncertain, capped at one insight per week: "After Standard hip hinge your back was worse the next day 3 of 4 times; after Gentle, 0 of 5. Stay on Gentle for now?" Include the base rate of bad days on days without that exercise. Provide the same table as a physio export.

**Why it is an outlier.**
- No product in the notes does this. Hinge, Sword and Kaia personalise by clinician or by generic progression; users complain the programme "doesn't adjust to how I feel" [AI §5].
- It targets concern #4 ("every back pain has a different source").
- It needs no external labels, no face and no new hardware; it measures precisely what the patient cares about.

**Measurable.** Calibration of the predicted next-day-worse probability (Brier score); the fraction of users for whom recommended levels were followed by fewer worse days than non-recommended levels (observational, plus the randomised subset); retention.

**Confidence 4/10.** Real risks:
- confounding (sleep, work, weather) and few events per user;
- daily-check burden;
- **nocebo / damage beliefs:** telling people "this exercise makes you worse" can create the fear-avoidance beliefs that predict persistence [PC Q1 Bunzli, CE §4];
- medicalisation.

Mitigate with cautious wording, show the base rate, one insight per week, and a hard rule that it can only recommend dialling down within the safe set, never prescribing. Build only after items 1, 2 and 5 exist.

---

## What I did not verify
- I did not run the app, the tests or any code, and I did no new web research. The Python `mediapipe` vs browser parity, the ONNX/TF.js payload sizes, extraction speed, and the volunteer-data sample-size arithmetic are my estimates.
- Whether MediaPipe world landmarks are hip-centred metres is flagged as unverified in [DP KQ4 gaps]; check one clip before relying on it.
- Dataset licences and availability are as stated in [DP] and [DB]: KIMORE and the UI-PRMD official page were unreachable on 2026-10-16, and KERAAL's data licence is not stated. Confirm each by email before committing to a dataset.
- The numeric acceptance gates in Step 0 are proposals to be revised after Step 1 produces real baseline numbers.
