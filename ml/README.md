# Training pipeline

Trains the first SpineSense model: an estimate of how much the lower back flexed during a standing hip hinge, from the webcam's body landmarks, using two back sensors as the answer key.

**No real model exists yet.** It needs at least 15 people, three hinge sets each, wearing two calibrated sensors. Until then this pipeline runs on simulated people only, which proves the plumbing works and says nothing about accuracy on real people. A phone can't supply the label: one phone gives trunk tilt, not the lower-back angle.

## How it fits together

```
clips (Recordings → Download)
   │  tools/build-dataset.mjs     one row per rep: camera features + sensor label
   ▼
ml/data/*.jsonl
   │  ml/train.py                 trees, leave-one-person-out scores, baselines, ship gate
   ▼
ml/artifacts/<name>/              model.json, report.json, MODEL_CARD.md
   │  tools/ship-model.mjs        refuses anything the gate didn't pass
   ▼
models/ + manifest.json           shadow mode in the app (js/ml/bank.js)
```

Features live in one place, `js/core/features.js`, and run in Node for training and in the browser for the app, so there's no second copy to drift. `test/ml.test.mjs` checks that the two give the same numbers for the same reps, and that `js/ml/trees.js` matches scikit-learn exactly.

## Run it

Set up once (needs Python 3.12 and Node 18+):

```bash
python -m venv ml/.venv
ml/.venv/Scripts/python -m pip install -r ml/requirements.txt
```

Check the pipeline on simulated people:

```bash
node tools/build-dataset.mjs --simulate 16 --out ml/data/sim.jsonl
ml/.venv/Scripts/python ml/train.py ml/data/sim.jsonl --out ml/artifacts/sim
```

Run the negative control, where the camera can't see what the sensors measure. The model must fail the gate:

```bash
node tools/build-dataset.mjs --simulate 16 --no-cue --out ml/data/sim-nocue.jsonl
ml/.venv/Scripts/python ml/train.py ml/data/sim-nocue.jsonl --out ml/artifacts/sim-nocue
```

With real clips (download them from Recordings, with two sensors connected):

```bash
node tools/build-dataset.mjs clips/*.json --out ml/data/hinge.jsonl
ml/.venv/Scripts/python ml/train.py ml/data/hinge.jsonl --out ml/artifacts/hinge-lumbar
node tools/ship-model.mjs ml/artifacts/hinge-lumbar
```

`build-dataset` lists every clip it leaves out and why: no participant id, fewer than two sensors, or a failed sync check.

## The ship gate

A model reaches `models/` only if all of these hold (`ml/train.py`, `gate()`):

- real data, never simulated
- at least 15 people, each with at least 18 reps
- no tier C data, and tier B only with written permission
- it beats the best baseline on people it never saw, by at least 10%, with the 95% interval over people above zero

Passing starts a model in **shadow mode**: it runs beside the rules and logs numbers on the device, and changes nothing the user sees. It can't reach the safety rules (`test/release.test.mjs` fails if it could).

## Not built yet

- Public datasets. They need re-extraction with Python MediaPipe, and the only tier A set with video (VIDIMU) has no hip hinges.
- A neural network. The blueprint adds one only if trees plateau, and a few dozen people can't support one.
- Promotion from shadow to beta, which needs real shadow-mode results first.
