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

Run the tests with `npm test` (42 tests: exercise engine, discomfort detector, safety rules, sensor maths, and the release checks).

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
| `firmware/` | ESP32 firmware (M5StickC Plus2 or ESP32 + MPU6050): fusion + BLE streaming |
| `js/views/` | Dashboard, live session, exercise library, history, sensors, safety check, settings |

### Back sensors (optional)

Strap one or two cheap motion sensors (ESP32 + IMU, about $6–20 each) to your back. They connect straight to the web page over Web Bluetooth (Chrome/Edge), with no app and no server.

- **One sensor** (upper back) gives an accurate trunk angle.
- **Two sensors** (upper back + sacrum) give the true **lower-back angle** (upper minus lower, the clinical dual-inclinometer method). That lets the coach tell bending from the hips apart from rounding the lower back.
- A 15-second calibration learns how each sensor is strapped on, so orientation doesn't matter.
- **Training clips** save landmarks plus sensor angles (no video), so sensor readings become accurate labels for training better camera-only models.

Try it without hardware: **Sensors → Try simulated sensors**, or the demo session, which can wear simulated sensors and **Simulate rounded lower back**. Hardware, wiring and flashing: [docs/hardware.md](docs/hardware.md). Protocol: [docs/sensor-protocol.md](docs/sensor-protocol.md).

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

Video is processed on-device and never stored or uploaded. The page downloads the MediaPipe engine and models from cdn.jsdelivr.net and storage.googleapis.com, and a Content Security Policy blocks it from contacting any other host. Sessions, pain ratings and settings live in the browser's localStorage (unencrypted), and you can export or delete them in Settings. The optional "listen for ow/stop" feature uses the browser's speech service, which in Chrome and Edge sends audio to the browser maker's servers. It is off by default.

### Known limits

- A single 2D webcam sees the trunk as a line from shoulders to hips. It measures trunk and pelvis angles, but not lumbar curvature.
- Floor exercises need the camera low and side-on. Tracking is less reliable when lying down.
- The grimace score has not been validated for pain. It is one signal among several, and the voice and movement signals carry most of the weight.
- Thresholds are tuned on simulated movement. Expect to adjust sensitivity in Settings after trying it yourself.

## Licence

Copyright 2026 Harshiv2718. Licensed under the [Apache License 2.0](LICENSE).

Third-party pieces keep their own terms: MediaPipe (Apache-2.0) loads from Google's CDN at run time, and the public datasets referenced in `docs/` have their own licences (see the licence tiers in `docs/architecture.md`, section 4).
