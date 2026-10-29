# SpineSense architecture blueprint

The target pipeline for SpineSense: what runs where, how data flows, how models get trained and shipped, and which open-source projects each layer borrows from. Status labels: **Built** (in the repo and tested), **Unverified** (in the repo, never run against the real thing), **Next** (planned), **Later** (parked in §13).

## 1. Design principles

1. **Local-first.** Video never leaves the device; models run in the browser; the app is static files. That gives privacy, near-zero hosting cost, and a free HTTPS demo on GitHub Pages. Today the page still fetches MediaPipe code from jsDelivr and `.task` models from Google storage; self-hosting is Next (§4 step 2a).
2. **Safety rules outrank everything.** Red flags, pain thresholds, leg symptoms and the next-day gate are plain, tested rules. Learned models can only *advise*; §10 turns that into a test.
3. **Sensors are optional add-ons.** The camera alone must work. A back sensor adds accuracy.
4. **Everything is measurable, including the reference.** Every model ships with a validation number against a reference, and the reference's own error is published beside it (§5).
5. **Your own baseline first.** Angles, faces and range are compared with *your* calibration, which cancels much of the camera's error.

## 2. System overview

```
┌─ BROWSER (runtime, ~30 Hz) ──────────────────────────────────────────────────────────────────────┐
│  1 CAPTURE      Webcam ─► MediaPipe Pose (33 pts) + Face (52 blendshapes)                [Built] │
│                 BLE back sensors ─► SensorHub (upper/lower IMU, 50 Hz)                   [Built] │
│                 ESP32 sensor firmware (compiles in CI, not yet run on hardware)     [Unverified] │
│                 Phone as stand-in upper sensor (records to file, merged offline)         [Built] │
│                 User input: safety check, pain 0–10, leg symptoms, next-day              [Built] │
│  2 SIGNAL       One-Euro smoothing · visibility & tracking gates · sensor freshness      [Built] │
│                 Camera-to-IMU time alignment (frame-callback time, clock fit)            [Built] │
│  3 CALIBRATION  Start-position baseline · neutral + effort face · 3-step sensor cal.     [Built] │
│  4 FEATURES     Joint & segment angles · trunk/pelvis/lumbar (dual inclinometer) ·               │
│                 rep tempo, hold steadiness · range, asymmetry                            [Built] │
│                 Velocity and jerk features                                                [Next] │
│  5 INFERENCE    Rules: rep/hold state machine, form rules, sensor rules                  [Built] │
│                 Discomfort fusion (movement-first, face advisory)                        [Built] │
│                 Models (advise only): movement-quality score, form-error cues             [Next] │
│  6 DECISION     SAFETY GATES (final authority) ─► coaching policy ─► plan, progression   [Built] │
│  7 EXPERIENCE   Dashboard · session HUD · voice coach · reports                          [Built] │
│  8 LOCAL DATA   localStorage · export/import                                             [Built] │
│                 clip schema v1 (raw landmarks + raw sensor packets, no video) · consent  [Built] │
│                 records · IndexedDB clip library (Recordings page)                               │
└────────│─────────────────────────────────────────────────────────────────────────────────────────┘
         │ clips (consented, user-exported)
┌────────▼─ OFFLINE ML PIPELINE (Python, ml/) ──────────────────────────────────────────── [Next] ─┐
│ public RGB datasets ─► re-extract MediaPipe (pinned) ──┐                                         │
│ own clips ─► raw browser landmarks (pre-filter) ───────┴─► same One-Euro filter ─► normalise     │
│ ─► windows ─► train (rules baseline → trees → 1D-CNN if trees plateau) ─► leave-one-subject-out  │
│ eval ─► fp32 ONNX ─► model card ─► licence-checked manifest ─► shadow mode in app ─► promote     │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
┌─ VALIDATION PIPELINE ───────────────────────────────── [Built, simulated data; real clips Next] ─┐
│ time alignment ─► validate the reference (bench card; re-fusion Next) ─► camera vs back sensor   │
│ (MAE, ICC, Bland–Altman) per exercise ─► cheap third reference (Kinovea, Next) ─► validation.md  │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

## 3. Runtime pipeline, stage by stage

| # | Stage | Module | Status | Borrowed from |
|---|---|---|---|---|
| 1 | Pose + face capture | `js/vision/tracker.js` | Built | MediaPipe |
| 1 | Back sensors over Web Bluetooth | `js/sensors/{ble,hub}.js`, `firmware/` | Built (browser, simulator-tested) / **Unverified** (firmware: compiles in CI, not yet run on hardware) | SlimeVR-Tracker-ESP |
| 2 | Smoothing and gating | `js/core/filters.js`, engine gates | Built | One-Euro; **Sports2D/Pose2Sim** filtering options |
| 1 | Phone as a stand-in upper sensor | `phone.html`, `js/phone.js`, `js/sensors/phone.js`, `js/analysis/phonemerge.js` | Built (simulator-tested; not yet run on a real phone) | W3C DeviceOrientation; the hub's calibration wizard |
| 2 | Camera-to-IMU time alignment | `js/sensors/timesync.js`, `tracker.js`, `hub.js` | Built (simulator-tested) | Lower-envelope clock fit (as in NTP-style one-way sync); cross-correlation |
| 3 | Calibration | engine baseline, `discomfort.js`, `sensors/posture.js` | Built | Clinical dual-inclinometer method |
| 4 | Angle features | `js/core/geometry.js` | Built | **Sports2D** segment angles, plane-of-motion warnings |
| 4 | Velocity and jerk features | `js/core/features.js` | Next | — |
| 5 | Rep segmentation and counting | `js/core/engine.js` | Built (rules) | **PoseRAC**, **Exercise_Recognition_AI**; a model only if rules fail on recorded clips |
| 5 | Movement-quality scoring | `js/ml/quality.js` + `models/*.onnx` | Next | **avakanski** framework; **EGCN**, **RehabExerAssess**; Rehab-Pile (LITEMV) |
| 5 | Form-error classifiers | `js/ml/errors.js` | Next | **Exercise-Correction** |
| 5 | Discomfort fusion | `js/core/discomfort.js` | Built | EmoPain protective-behaviour taxonomy |
| 6 | Safety gates and progression | `js/program.js`, session check-ins | Built | NICE / UK cauda equina pathway |

**Models plug in without risk:** each runs in **shadow mode** first, next to the rule-based prediction, with disagreement counters kept on the device (§11). It is promoted only after passing acceptance gates on held-out people, and even then it changes *cues and scores*, never safety decisions (§10).

## 4. Offline ML pipeline (`ml/`, Python)

| Step | Detail |
|---|---|
| 1 Ingest | KERAAL (already BlazePose), KIMORE, REHAB24-6/26, UI-PRMD, VIDIMU, plus SpineSense clips. Licence tier recorded per sample |
| 2a Re-extract (public RGB datasets only) | Self-host `pose_landmarker_full.task` and record its SHA-256; pin Python `mediapipe` to the `@mediapipe/tasks-vision` release (already pinned in `tracker.js`); use the Tasks `PoseLandmarker` in VIDEO mode, not legacy `mp.solutions.pose`; extract raw plus world landmarks. Models run only for the `full` variant |
| 2b Own clips | No video exists, so train on browser output. Today the One-Euro filter runs before the recorder and clips lack world landmarks. Store raw `detectForVideo` output (landmarks, world landmarks, visibility, capture time) and apply the same filter to both sources in training (a Python port of `js/core/filters.js`, tested on JS fixtures) |
| 2c Parity test | One fixed 30 s video through the browser (GPU and CPU) and through Python; results go in the model card. Pass: median landmark difference ≤ 0.5% of frame size and median model-input angle difference ≤ 2° (proposed; revise after the first run) |
| 3 Normalise | Hip-centred, scaled by torso length, rotated **only about the vertical axis** (yaw, from the world-landmark hip line) so gravity stays the tilt reference; never in the image plane. Mirroring swaps left/right indices and flips side-bend label signs. Visibility is an input; mask below 0.5 |
| 4 Window | Per-rep windows from rule segmentation (or fixed 2 s windows), resampled to 64 frames |
| 5 Train | (a) rules baseline → (b) gradient-boosted trees on engineered angles (Exercise-Correction style) → (c) 1D-CNN (LITEMV-style, best accuracy-to-cost on Rehab-Pile) only if the trees plateau. With 6 annotated KERAAL patients and about 15 own subjects, nothing larger is justified |
| 6 Evaluate | Leave-one-subject-out; per-exercise F1 / MAE; calibration plot; comparison with rules and IMU ground truth; intervals, not point estimates |
| 7 Export | fp32 ONNX via a pinned `onnxruntime-web` (WASM only, `numThreads = 1`: Pages cannot send COOP/COEP), lazy-loaded in a Web Worker so it cannot stall the pose loop. Budget: p95 under 10 ms per 100–200 ms window, measured. For trees, check whether the tree ops run in the web runtime (I believe not); else export JSON to a ~40-line `js/ml/trees.js` |
| 8–9 Document, ship | Model card (data, licence tier, metrics, failure modes, intended use) in `models/<name>/MODEL_CARD.md`; manifest, tier check and rollback below |

**Labels from the sensor:** training clips pair camera landmarks with back-sensor angles recorded at the same moment, so a camera-only model can estimate lumbar angle with the sensor as the answer key. This is the project's most distinctive ML contribution, and it is only as good as the time alignment and sensor validation in §5 steps 1–2. **Minimum data to attempt it:** 15 subjects × 3 hinge sets, each with two calibrated sensors and a passing sync check. With fewer, publish the camera-vs-sensor agreement analysis only and keep the rules as the scorer.

**Licence tiers** (source: `reports/Back pain AI coach research.md`; re-check before each release)

| Tier | Datasets | Allowed use |
|---|---|---|
| A. Ship-safe | UI-PRMD (ODC PDDL, evidenced only by a paper footnote because the official page 404s: keep a copy in `docs/licences/`), KINECAL (CC0), VIDIMU (CC BY 4.0), IRDS (CC BY 4.0), your own consented clips | Train and ship; attribute where required |
| B. Written permission before shipping | KERAAL data (CC BY-NC-SA), REHAB24-6/26 (CC BY-NC 4.0), Fitness-AQA (non-commercial; Zenodo says CC BY, contradictory), KIMORE (unstated: treat as all rights reserved), QEVD (terms unread), FLAG3D (signed agreement) | Internal R&D and benchmarking; no weights in `models/` until permission is in writing |
| C. Validation only, via an academic partner | UNBC-McMaster, BioVid, MIntPAIN, X-ITE, EmoPain | Never train, never ship weights, never upload to model repositories |

Tier A is thin: its Kinect sets are skeleton-only and none covers hip hinge, bridge, bird dog, knee-to-chest or side bend; only VIDIMU has RGB. A shippable back-exercise model realistically comes from your own consented clips.

**Model versioning and rollback** (Next). A model trained on tier B or C data is a derived work, and publishing it through Pages is shipping, so code enforces the tier:

- `models/manifest.json`: `{schema, featureSchema, minApp, models:[{id, version, file (hashed), sha256, licenceTier, permission, poseModelSha256, status: shadow|beta|on|off, previous}]}`. The app refuses a model whose `featureSchema` differs from `js/core/features.js`. `tools/check-models.mjs` (in CI) fails if a file in `models/` is missing from the manifest, or has a tier other than 'A' without a non-null `permission`. `ml/artifacts/` and landmarks from tier B/C data are git-ignored.
- Load and rollback: fetch the manifest with no-cache and the model by hashed name, then verify SHA-256. On any failure (network, hash, ORT load, NaN output, 20 consecutive slow windows) set `bank = null` for the session and log why locally. To roll back, set `status:'off'` or point to `previous` and redeploy (≤ 10 minutes); keep the last two versions. "Use experimental models" is off until beta; promotion goes shadow → beta → on, one cue type at a time.

## 5. Validation pipeline

1. **Time alignment** (Built, simulator-tested; prerequisite for every camera-vs-sensor number). With tens of ms of BLE jitter and 50–100 ms capture-to-detect latency, a 100 ms offset at 30°/s is a 3° label error. Camera time comes from `requestVideoFrameCallback` (`captureTime`). `js/sensors/timesync.js` fits `local = a + b·device_ms` through the per-chunk minimum arrival delay (a lower-envelope fit that removes radio jitter and crystal drift, and handles the 32-bit wrap); in tests it recovers sample times within 4 ms despite up to 140 ms of jitter. `js/analysis/agreement.js` then cross-correlates the unfiltered camera trunk tilt with sensor inclination (±0.5 s) for the remaining constant offset, and reports the One-Euro smoothing delay separately. Still Next: drop clips with corr < 0.9 and report the median residual on real clips.
2. **Validate the reference first.** (Bench card Built on the Sensors page: 0/30/45/60/90°, 2 s still captures, `js/analysis/bench.js`; drift test, side-bend axis, repeats and re-fusion Next.) Bench-test a sensor on a rigid jig with a protractor at 0/15/30/45/60/90° (flexion and side-bend, three repeats): mean absolute error and 10-minute drift. Replay raw `hub.startRecording()` logs through `imufusion` (Fusion) and `vqf`; replace the hand-rolled Madgwick (beta 0.08) only if one beats it by a margin set in advance. Define the label as "lumbar flexion relative to the standing-neutral calibration, in degrees", not absolute lordosis. Copy mobgap's report layout.
3. **Camera vs sensor:** per exercise, camera trunk angle vs upper sensor, and camera hip-hinge pattern vs sensor lumbar angle. Compare **change from each person's calibration pose**, not absolute angle, and use side-on views for sagittal metrics. Report n, ICC(2,1) absolute agreement, MAE and Bland–Altman limits with bootstrap intervals over subjects (pyCompare), always beside the sensor's own error. (Built: `analyzeClip()` computes bias, limits, MAE, RMSE, r, Lin's CCC and ICC(A,1) per exercise from rep peaks and frames, and hides the ICC when reps barely vary; `tools/validate-clips.mjs` writes `docs/validation.md` and its SVG plots. Bootstrap intervals over subjects: Next, once there are subjects.)
4. **Cheap third reference:** Kinovea manual angles on a side-view clip, or a phone IMU on the sternum. Optional later: two cameras synced by a clap, processed offline with Pose2Sim (its README claims 2–6° joint-angle error against marker capture for limb joints; unchecked here and not a lumbar figure).
5. **Rules vs models:** the same held-out clips are scored by both; a model ships only if it beats the rules.
6. Publish everything in `docs/validation.md` (Built, currently simulated results only). A results page with real numbers is what makes a portfolio project credible.

## 6. Data architecture (local-first)

| Store | Content | Where |
|---|---|---|
| `spinesense.v1` | Profile, safety check, progress, sessions, settings | **Stays in localStorage** (Built): seven modules use the synchronous `store`, and `index.html` reads the theme before first paint. Next: `migrate(state)` keyed on `version` in `load()` and `importJSON()` (neither checks it today; reject newer versions), and a toast when `setItem` fails (today only `console.warn`) |
| `spinesense.sensorcal` | Per-sensor calibration, 12-hour expiry | localStorage (Built) |
| Training clips | `clip.v1`: `{schema, consent:{version, at, scope[]}, participant:<random UUID>, env:{app, tasksVision, poseModelSha256, variant, delegate, camera:{w,h,fps}, ua}, sensors:[{role, fw, board, rate, calId}], sync:{offsetMs, corr, method}, frames:[{tCapture, lm33_raw, world33_raw, sensorRaw?}]}` | IndexedDB library, `js/data/{clip,clipstore}.js` (Built): `clip.v1` with a consent record, capture metadata (MediaPipe version, model, delegate, video size), raw and world landmarks as typed arrays, raw sensor packets with device and arrival times, events and results; 10-minute cap; quota errors fall back to download. Still Next: participant UUID, `navigator.storage.persist()`, and keeping pain answers out of clips meant for sharing. A 10-minute clip at 30 fps is about 15–20 MB as JSON |
| Models | ONNX files + manifest | Static files with the app (Next) |

**Clip consent flow** (Built for on-device recording: `js/views/consent.js`, versioned, asked the first time recording is switched on, withdrawable on the Recordings page, which deletes every clip. The research-sharing and open-release boxes are Next, because nothing is shared yet.) Before the first clip and on any schema change: A plain-language screen says what is stored (33 landmarks at 30 Hz, sensor angles, exercise, time; no video), that movement traces can still identify a person, who sees them, retention (12 months) and how to withdraw. Three separate boxes: record on this device; share for research; allow anonymised open release (default off). Names, screening answers and pain ratings never enter a clip. The library offers Export and Delete; with no server, participants send exports to a private channel, and `docs/data-handling.md` states retention. Only pain-free volunteers, or people with back pain doing correct-form reps under a physio, may record; publishing results about people with back pain needs an ethics review through a university or clinic partner.

## 7. Hardware pipeline

- **Status: Unverified.** The firmware (one sketch, two boards: M5StickC Plus2; ESP32 + MPU6050) **compiles in CI for both boards** (first green run 2026-10-26, ESP32 core 3.3.12, M5Unified 0.2.27), but has not been run on hardware, and its hand-rolled Madgwick filter has never been compared with a proven one. Phase 1 exit criterion: both boards compile in CI (**met**), and one board streams 10 minutes into the app with no sequence-number gaps (open).
- **CI** (Next): a `firmware` matrix over both boards, pinning one `esp32:esp32` core and one `M5Unified`. The sketch hard-codes `#define BOARD_M5STICKC_PLUS2` (line 15), so guard it with `#if !defined(...)` and pass `-DBOARD_ESP32_MPU6050` through `--build-property` on the second leg; confirm each FQBN with `arduino-cli board listall`. Attach `.bin` files to tagged releases (the SlimeVR-Tracker-ESP pattern). A green build proves compilation only.
- **Protocol:** the version sits in the packet header (bits 4–7) and is decoded, but unknown versions are **not rejected yet (Next)**. Add `proto=1` to the Info string; `BleSensor.connect()` reads Info first and, if `proto` is missing or above `PROTOCOL_VERSION`, shows "This sensor needs a newer SpineSense" and does not subscribe.

## 8. Target repository layout

```
spinesense/
├── index.html, phone.html, css/, js/   # the web app and the phone sensor page (static, no build step)
│   ├── app.js, store.js, program.js, ui.js, charts.js, figures.js
│   ├── core/ sensors/ vision/ coach/   # logic (features.js: Next), BLE + hub + timesync, MediaPipe, voice
│   ├── data/ analysis/            # clip.v1 recorder + IndexedDB library; agreement stats, plots, bench, simulator
│   ├── ml/                        # onnxruntime-web loaders, shadow-mode harness            (Next)
│   └── views/                     # incl. diagnostics.js (tracking panel + copyable test report)
├── server.mjs                     # dev server (the camera needs localhost or HTTPS)
├── models/, ml/, tools/           # *.onnx + manifest (Next); Python pipeline (Next); build-site, check-models, validate-clips
├── firmware/spinesense-motion/    # ESP32 firmware (compiles in CI; not yet run on hardware)
├── test/                          # node --test (81 tests today)
├── docs/                          # architecture, hardware, sensor-protocol, platform-brainstorm,
│                                  #   validation (+ plots); hazards, data-handling (Next)
├── reports/, research_notes/      # research report, evidence base
├── LICENSE (Apache-2.0); THIRD_PARTY_NOTICES.md                                  (notices: Next)
└── .github/workflows/             # ci.yml, pages.yml
```

## 9. CI/CD and quality

| Workflow | Runs |
|---|---|
| `ci.yml` (Built, green) | One workflow, three jobs until `ml/` has tests: `test` (`node --test`, including the §10 import-boundary test in `test/release.test.mjs`), `firmware` (§7; both boards via a matrix, ESP32 core 3.3.12, M5Unified 0.2.27, arduino-cli 1.5.1), `site` (build the allowlist, run `tools/check-models.mjs`). Add `pytest ml/` once `ml/` has tests. No Prettier ("no dependencies" is a selling point); ESLint is optional via `npx` |
| `pages.yml` (Written, first run pending) | `tools/build-site.mjs` copies an allowlist (`index.html css js docs models`; `docs/` because the Sensors page links the hardware guide) to `_site/`, refuses deny-listed paths, and deploys only that, never the repo root (which would publish `research_notes/`, `reports/`, `.claude/`, `test/`, `firmware/`). Pages gives no custom headers (CSP stays in `index.html`; no cross-origin isolation), a 10-minute cache (so models use hashed names and the manifest is fetched with `cache: 'no-cache'`) and no server logs. HTTPS makes camera and Web Bluetooth work, giving a **live demo link**; the page says Web Bluetooth is Chrome/Edge only. Lighthouse and axe-core on each deploy: Next |

## 10. Safety, privacy and regulatory guardrails (Next unless marked)

1. **Intended use:** an exercise companion that counts reps, gives form cues and asks how you feel; it does not diagnose, screen for disease, classify a condition or replace a clinician. The README says so (Built); repeat it in the app footer and every model card.
2. **Claims vocabulary:** "detects pain", "diagnoses", "identifies your condition", "treats" and "clinically validated" are banned in UI, README, model cards and demo copy; CI greps for them (`docs/platform-brainstorm.md` §8: "detects your problem" wording makes the app a medical device).
3. **Models never touch safety:** `js/program.js`, `js/views/safety.js` and the engine's stop/regress paths may not import from `js/ml/`; a `node --test` test parses imports and fails otherwise. `ModelBank` returns only `{cueAdd, cueSuppress, score, confidence}`.
4. **Hazard log** `docs/hazards.md` (one page): missed red flag, tracking loss shown as "good form", alarm fatigue, model over-confidence, mis-calibrated sensor shown as lumbar angle, clip leak; each row names its control and the test that proves it. Safety-rule edits need a test change and a CHANGELOG line in the same commit.
5. **Health data:** pain ratings, symptoms and landmark traces are special-category data under GDPR. No telemetry and no outbound call beyond the hosts the CSP allows (jsDelivr, Google storage).

## 11. Operations

- **Observability without a server:** no telemetry. Shadow-mode counters (windows, disagreements, p95 latency, fallbacks, model ids) are kept in IndexedDB and added, numbers only, to the "Copy test report" in `js/views/diagnostics.js` (report Built; counters Next). Pilot users send it voluntarily.
- **Failures:** camera denied or missing → message (Built); GPU delegate fails → CPU (Built); BLE drops → 5 retries, then "Signal lost" and camera-only (Built); CDN or model fetch fails → retry, then "needs internet on first use" (Next); storage quota exceeded → toast and offer export (Next); model hash, schema or latency failure → `bank = null` (Next).
- **Accessibility (Next):** HUD readable at 2–3 m (large type, high contrast, no colour-only states); every spoken cue also shown as text; hands-free control (voice and raised-hand pause, both Built) because users are on the floor; `prefers-reduced-motion`; keyboard and ARIA outside the session view, checked with axe-core. **Support:** Chrome/Edge (desktop, Android) for sensors; camera coaching elsewhere only if MediaPipe runs there (untested); no sensors on iOS.

## 12. Roadmap with portfolio milestones

| Phase | Build | Portfolio proof |
|---|---|---|
| **1. Ship** | Pages deploy (allowlist), CI with the firmware matrix, root `LICENSE`, README with GIFs of the demo and sensors | Live demo link; green CI badge; both boards compile and one streams 10 minutes with no gaps |
| **2. Measure** | Time alignment; clip recorder v1 with consent flow and IndexedDB library; reference validation; camera-vs-sensor study | `docs/validation.md` with Bland–Altman plots and the sensor's own error |
| **3. Learn** | `ml/` pipeline; first model (hip-hinge lumbar estimation from camera, labelled by the sensor) in shadow mode | Model card plus "camera-only lumbar flexion within X° (95% CI, n = …)", or the agreement analysis if n < 15 |

## 13. Not before…

Parked on purpose (status Later): each item is speculative, costly, or carries regulatory or privacy risk this blueprint cannot yet control.

| Item | Not before |
|---|---|
| Pattern engine (McKenzie, treatment-based classification, STarT Back) and old roadmap phases 4–5 | A physio reviewer signs off the rules, a written claims position exists, and phase 3 has real numbers. A wellness variant ordering exercises only by the user's own next-day answers is allowed |
| LLM explainer (LIAAD/physio, ExerciseLLM) | Vetted content only, a per-use opt-in, and a deliberately widened CSP: a hosted API breaks local-first |
| Optional sync (encrypted session summaries for a physio) | Consent, end-to-end encryption and a regulatory review |
| Live second camera (WebRTC, `multiview.js`, in-browser calibration) | Offline validation shows camera geometry is the bottleneck; it needs signalling and STUN/TURN, which the app and CSP lack |
| ST-GCN (STGCN-rehab, MIT), spm1d | The 1D-CNN plateaus on far more than about 15 own subjects |
| int8 quantisation, sub-5 ms target | A model exceeds about 2 MB |
| XIAO nRF52840 port, BLE OTA | One ESP32 board has run 10 minutes of clean data; both need a different BLE stack and MCUboot, ending "one sketch, two boards" |
| Rep-counting and exercise-recognition models | Recorded-clip replay shows the rules failing (the user already picks the exercise) |

## 14. What to take from each reference project

| Project | Take | Licence and rule |
|---|---|---|
| Pose2Sim / Sports2D | Filtering, segment-angle definitions, plane-of-motion warnings, optional offline two-camera reference | BSD-3: code reuse OK with notice |
| OpenCap | Validation methodology and reporting style | Core Apache-2.0; Monocular is **non-commercial** (PolyForm NC + SMPL): ideas only |
| Exercise-Correction | Per-exercise error classifiers; its lesson was data scarcity | MIT |
| avakanski framework; Fitness-AQA | Quality metrics → scoring functions; pose-contrastive pretraining | **No licence**; unclear or non-commercial: ideas only |
| EGCN / RehabExerAssess / PoseRAC | Skeleton baselines, rep counting | BSD-2 (code only; the UI-PRMD and KIMORE copies it links carry their own terms) / MIT / MIT |
| DeepRehabPile (LITEMV) | Benchmark protocol, LITEMV | **GPL-3.0**: pip dependency inside `ml/` or re-implement from the paper; never vendor it or ship it in `js/` |
| Fusion, vqf, SlimeVR-Tracker-ESP, mobgap, scikit-digital-health, pyCompare | Re-fusion; firmware CI and board configs; validation layout; lumbar sit-to-stand; Bland–Altman | MIT / MIT / Apache-2.0 or MIT / Apache-2.0 / MIT / MIT: OK with notice (the last three in `ml/`) |
| RepoIMU, ssong47 two-MPU6050 repo, Spinal-Curvature-Dataset | Fusion benchmark; the dual-inclinometer case; spine markers plus IMUs | Not stated / MIT / not stated: read and benchmark; don't copy where unstated |
| Kinovea, freemocap, spm1d | Manual angles; two-camera reference; whole-curve statistics (parked) | GPL-2.0 / **AGPL-3.0** / **GPL-3.0**: external tools only; their outputs are data |
| py-feat, OpenFace, LibreFace | Offline grimace validation, reference action units | py-feat: MIT code, separate weight terms; the others non-commercial: validation only |
| knee-form-check, LIAAD/physio, ExerciseLLM | Architecture and prompt ideas | Not stated / NOASSERTION / none: read, don't copy code |
| STarT Back, ODI | Pattern engine inputs (parked) | Keele asks commercial developers to get in touch; ODI needs a Mapi licence; RMDQ is public domain |
| MediaPipe tasks-vision and `.task` models | Pose and face | Apache-2.0 (confirm on each model card before self-hosting): pin and self-host |
| SpineSense itself | — | **No licence today** (no `LICENSE`, no licence field in `package.json`): add MIT or Apache-2.0 and a `THIRD_PARTY_NOTICES.md` for every BSD/MIT/Apache item reused |

Rule: copyleft or non-commercial tools run outside the shipped app and outside committed source; only their outputs (numbers, plots) are committed.
