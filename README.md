# SpineSense

[![CI](https://github.com/Harshiv2718/spinesense/actions/workflows/ci.yml/badge.svg)](https://github.com/Harshiv2718/spinesense/actions/workflows/ci.yml)
[![Deploy demo](https://github.com/Harshiv2718/spinesense/actions/workflows/pages.yml/badge.svg)](https://github.com/Harshiv2718/spinesense/actions/workflows/pages.yml)

**Live demo:** https://harshiv2718.github.io/spinesense/ (Chrome or Edge). Click **Demo (no camera)** to see tracking, coaching, check-ins and simulated back sensors without turning on your webcam.

A webcam back-pain exercise coach that runs entirely in your browser. It tracks your body, counts reps and holds, corrects your form out loud, and watches for signs of discomfort. When it sees them, it eases off or stops and checks in with you.

> SpineSense is an exercise companion, not a medical device. It cannot diagnose anything. If pain is severe, spreads down a leg, or comes with numbness, weakness or bladder/bowel changes, see a doctor.

## Run it

Needs Node 18+ and Chrome or Edge. There are no dependencies to install.

```bash
node server.mjs
```

Then open http://localhost:5173 and allow camera access. Browsers only allow the webcam on `localhost` or `https`, which is why you open the app through the server instead of double-clicking `index.html`. The first start downloads the MediaPipe models (~13 MB) from Google's CDN, so you need an internet connection.

No webcam handy? **Demo (no camera)** on the dashboard runs a simulated person through the exercises. Use **Simulate pain on next rep** to watch the discomfort detection respond.

Run the tests with `npm test` (81 tests: exercise engine, discomfort detector, safety rules, sensor maths, time alignment, clip format, agreement statistics, the phone sensor, storage, test-report privacy, and the release checks).

## Help test it

No hardware needed. Open the live demo's **Help & feedback** page for what to try and the feedback form. [docs/testing.md](docs/testing.md) explains how a test round runs: who can take part, what the app enforces during the round, and how to read the results.

## Deploy your own demo (GitHub Pages)

1. Create a public repository named `spinesense` on GitHub.
2. Push this folder:
   ```bash
   git remote add origin https://github.com/Harshiv2718/spinesense.git
   git push -u origin main
   ```
3. On GitHub: **Settings → Pages → Source: GitHub Actions**.

Every push to `main` then runs the tests, builds the site from an allowlist (`tools/build-site.mjs`: the app and public docs only, never research notes or reports), checks the model licence gate, and deploys. Pages serves over HTTPS, so the camera and Web Bluetooth work in the live demo.

CI (`.github/workflows/ci.yml`) runs the unit tests, the site build and model licence gate, and compiles the firmware for both boards with pinned versions (ESP32 core 3.3.12, M5Unified 0.2.27, arduino-cli 1.5.1).

## How it works

```
Webcam ─┬─ MediaPipe Pose (33 body points, 3D) ─► One-Euro smoothing ─► joint angles, trunk tilt
        ├─ head crop ► MediaPipe Face (52 blendshapes) ─► PSPI-style grimace score
        └─ (optional) speech recognition ─► "ow" / "stop" / pain numbers
                          │
        Exercise engine: start-position check → baseline capture → rep/hold state machine → form rules
                          │
        Discomfort detector: fuses signals vs YOUR baseline
          face grimace · range drop · slowing · guarding (abandoned reps, broken holds) · shaking · bracing
                          │
        Response ladder: mild → ease off (smaller target)
                         moderate → pause + "pain 0–10?" → 0–3 continue / 4–5 easier level / 6+ stop
                          │
        Local storage → dashboard (pain trend, range of motion, form, pain triggers) → next session's plan
```

| Folder | What's in it |
|---|---|
| `js/core/` | Pure logic with no DOM, unit-tested: geometry, filters, exercise specs, engine, discomfort detector, pose simulator |
| `js/vision/tracker.js` | Webcam + MediaPipe pipeline, and the simulated tracker used by the demo |
| `js/coach/voice.js` | Spoken coaching and voice commands |
| `js/program.js` | Safety screening, daily plan, progression rules, stats |
| `js/sensors/` | Back-sensor protocol, Web Bluetooth driver, calibration and lumbar-angle maths, simulator, hub |
| `js/data/`, `js/analysis/` | Clip format and IndexedDB library; camera-vs-sensor agreement statistics, Bland–Altman plots, bench test, clip simulator |
| `firmware/` | ESP32 firmware (M5StickC Plus2 or ESP32 + MPU6050): fusion + BLE streaming |
| `js/views/` | Dashboard, live session, exercise library, history, sensors, recordings, safety check, settings |
| `tools/` | Site build (allowlist), model licence gate, validation report generator |
| `phone.html`, `js/phone.js` | Phone sensor page: guided calibration, recording, and sending the file to the computer |

### Back sensors (optional)

Strap one or two cheap motion sensors (ESP32 + IMU, about $6–20 each) to your back. They connect straight to the web page over Web Bluetooth (Chrome/Edge), with no app and no server.

- **One sensor** (upper back) gives an accurate trunk angle.
- **Two sensors** (upper back + sacrum) give the true **lower-back angle** (upper minus lower, the clinical dual-inclinometer method). That lets the coach tell bending from the hips apart from rounding the lower back.
- A 15-second calibration learns how each sensor is strapped on, so orientation doesn't matter.
- **Training clips** save landmarks plus raw sensor readings (no video) to the **Recordings** page, after you agree to it once. Sensor readings then become accurate labels for training better camera-only models.

**No sensor? Use your phone.** Open [phone.html](https://harshiv2718.github.io/spinesense/phone.html) on your phone and strap it to your upper back. It talks you through calibration and records how your trunk tilts. Afterwards, **Add phone data** on the session's clip in Recordings lines the two up and compares them. It's for checking the camera, not live feedback.

Try it without hardware: the demo session wears simulated sensors (try **Simulate rounded lower back**). The Sensors page and the Bluetooth options appear once you turn on **Settings → Back-sensor hardware**, so people testing without hardware never see them. Hardware, wiring and flashing: [docs/hardware.md](docs/hardware.md). Protocol: [docs/sensor-protocol.md](docs/sensor-protocol.md).

### Validation: how close is the camera to the sensor?

[docs/validation.md](docs/validation.md) describes the method and holds the results:

1. **Bench-test the sensor** against known angles (Sensors → Bench test, with hardware sensors turned on in Settings). No sensor yet? A phone on your back can stand in for it.
2. **Line up the clocks.** A clock fit removes Bluetooth jitter and crystal drift, then cross-correlation finds the camera-to-sensor offset.
3. **Compare** the camera's trunk angle with the sensor, exercise by exercise: bias, Bland–Altman limits of agreement, ICC and concordance.

The Recordings page runs the same analysis on any clip and draws the plots. `node tools/validate-clips.mjs clip.json …` regenerates the results page from exported clips. Until real hardware recordings exist, the published numbers come from a **simulated** session: they prove the pipeline works, not that the camera is accurate.

### Exercises

Overhead arm raise, standing side bend, standing hip hinge, sit to stand, single knee to chest, glute bridge, and bird dog. Each has three levels. Add a new exercise by writing a spec in `js/core/exercises.js`: a `setup` check, a `baseline`, a `metric` and `form` rules. Then add a pose to `js/core/sim.js` and the tests cover it automatically.

### Safety rules

- **Emergency signs** (possible cauda equina syndrome: saddle numbness, new bladder, bowel or sexual changes, a leg getting weaker or both legs affected) lock the app with an emergency message. They can never be overridden.
- **See-a-doctor-first signs** need a clinician clearance recorded per sign, dated, and expiring after 30 days. Clearances never carry over to the next safety check.
- **Cautions** (recent spinal surgery, osteoporosis or steroids, pregnancy) keep the plan at Gentle with no level-ups until a clinician OKs more.
- A **quick safety check** runs before every session; the full check must be redone every 4 weeks.
- **Today's pain** drives the plan: 7/10 means Gentle with fewer reps, and 8/10 or more means a rest day. A pain of 8+ during a session ends it.
- Every check-in asks about **new or spreading leg symptoms**, which the camera cannot see. A yes stops the exercise and rests it for 2 days.
- **Level-ups** need two comfortable sessions *and* a "back to usual" answer the next day, at most once a week per exercise. Regressions apply immediately.
- The **facial-strain signal** is opt-in, half weight, never acts alone, ignores blinks, and learns your effort face. The app never claims to detect pain: your own rating decides.

### Privacy

Video is processed on-device and never stored or uploaded. The page downloads the pinned MediaPipe engine from cdn.jsdelivr.net and the models from Google's model folder on storage.googleapis.com, sends no referrer, and a Content Security Policy blocks it from contacting anything else. Those hosts, and GitHub Pages, see your IP address and browser like any website, never your video or answers. Sessions, pain ratings and settings live in the browser's localStorage (unencrypted), and you can export or delete them in Settings (Delete all data also removes clips). Training clips are recorded only after you agree to it. They are stored in the browser's IndexedDB on this device and never uploaded, and withdrawing consent deletes them all; a downloaded clip leaves out pain answers. The optional "listen for ow/stop" feature is the one exception to the policy above: Chrome and Edge send the microphone audio for the whole session to Google's or Microsoft's speech service. It is off by default. The test report you can copy holds tracking numbers, the app version and your browser, with nothing about pain or discomfort.

### Known limits

- A single 2D webcam sees the trunk as a line from shoulders to hips. It measures trunk and pelvis angles, but not lumbar curvature.
- Floor exercises need the camera low and side-on. Tracking is less reliable when lying down.
- The grimace score has not been validated for pain. It is one signal among several, and the voice and movement signals carry most of the weight.
- Thresholds are tuned on simulated movement. Expect to adjust sensitivity in Settings after trying it yourself.
- The back-sensor firmware compiles in CI for both boards but has not yet run on real hardware.

## Licence

Copyright 2026 Harshiv2718. Licensed under the [Apache License 2.0](LICENSE).

Third-party pieces keep their own terms: MediaPipe (Apache-2.0) loads from Google's CDN at run time, and the public datasets referenced in `docs/` have their own licences (see the licence tiers in `docs/architecture.md`, section 4).
