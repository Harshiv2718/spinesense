"""Trains the hip-hinge lumbar model and decides whether it is fit to ship.

    python ml/train.py ml/data/hinge.jsonl --out ml/artifacts/hinge-lumbar

Input rows come from tools/build-dataset.mjs. Output: model.json (trees that js/ml/trees.js can run),
report.json and MODEL_CARD.md. Every score comes from people the model never saw in training
(leave-one-person-out), and is compared with simple baselines. The model is only as trustworthy as
the gate says: tools/ship-model.mjs refuses anything that didn't pass.
"""

import argparse
import json
from pathlib import Path

import numpy as np
from sklearn.ensemble import GradientBoostingRegressor

MIN_SUBJECTS = 15  # docs/architecture.md section 4: 15 people, three hinge sets each
MIN_REPS_PER_SUBJECT = 18
MIN_IMPROVEMENT = 0.10  # must beat the best baseline's error by at least this share
BOOTSTRAP = 5000
TREES_SCHEMA = "trees.v1"
TARGET = "lumbarFlexPeak"


def load_rows(path):
    rows = [json.loads(line) for line in Path(path).read_text(encoding="utf-8").splitlines() if line.strip()]
    if not rows:
        raise SystemExit(f"{path} has no rows")
    schemas = {r["schema"] for r in rows}
    if len(schemas) != 1:
        raise SystemExit(f"{path} mixes feature schemas: {sorted(schemas)}")
    return rows


def make_model():
    # Small on purpose: a few dozen people's reps can't support anything bigger.
    return GradientBoostingRegressor(n_estimators=150, max_depth=2, learning_rate=0.05, subsample=0.8, min_samples_leaf=5, random_state=0)


def leave_one_person_out(X, y, groups, tilt):
    """Predictions for each person from models fitted on everyone else."""
    preds = {"model": np.zeros_like(y), "mean": np.zeros_like(y), "tilt": np.zeros_like(y)}
    for person in np.unique(groups):
        test = groups == person
        train = ~test
        preds["model"][test] = make_model().fit(X[train], y[train]).predict(X[test])
        preds["mean"][test] = y[train].mean()
        # The camera-only rule of thumb: lumbar flexion as a fixed share of the trunk lean.
        share = (tilt[train] @ y[train]) / max(tilt[train] @ tilt[train], 1e-9)
        preds["tilt"][test] = share * tilt[test]
    return preds


def person_mae(pred, y, groups):
    people = np.unique(groups)
    return np.array([np.abs(pred[groups == p] - y[groups == p]).mean() for p in people])


def interval(values, rng):
    """95% bootstrap interval over people: the unit that varies is the person, not the rep."""
    n = len(values)
    means = values[rng.integers(0, n, size=(BOOTSTRAP, n))].mean(axis=1)
    return [float(np.percentile(means, 2.5)), float(np.percentile(means, 97.5))]


def evaluate(rows, names):
    X = np.array([r["features"] for r in rows], dtype=float)
    y = np.array([r["label"] for r in rows], dtype=float)
    groups = np.array([r["subject"] for r in rows])
    preds = leave_one_person_out(X, y, groups, X[:, names.index("tiltRange")])
    rng = np.random.default_rng(0)
    methods = {}
    for name, pred in preds.items():
        per_person = person_mae(pred, y, groups)
        methods[name] = {"mae": float(per_person.mean()), "ci95": interval(per_person, rng), "perPerson": [round(float(v), 3) for v in per_person]}
    best = min(("mean", "tilt"), key=lambda m: methods[m]["mae"])
    gain = person_mae(preds[best], y, groups) - person_mae(preds["model"], y, groups)
    # Calibration: does a predicted 30 degrees mean 30 degrees?
    order = np.argsort(preds["model"])
    calibration = [{"predicted": round(float(preds["model"][b].mean()), 2), "actual": round(float(y[b].mean()), 2)} for b in np.array_split(order, 5) if len(b)]
    subjects, counts = np.unique(groups, return_counts=True)
    return {
        "subjects": int(len(subjects)),
        "reps": int(len(rows)),
        "minRepsPerSubject": int(counts.min()),
        "labelSd": float(y.std()),
        "tiers": sorted({r["tier"] for r in rows}),
        "simulated": any(r["simulated"] for r in rows),
        "methods": methods,
        "bestBaseline": best,
        "improvement": {"mae": float(gain.mean()), "ci95": interval(gain, rng), "share": float(gain.mean() / max(methods[best]["mae"], 1e-9))},
        "calibration": calibration,
    }


def gate(report, permission=None):
    """Reasons this model may not ship. An empty list means it passed."""
    reasons = []
    if report["simulated"]:
        reasons.append("trained on simulated data, which says nothing about real people")
    if report["subjects"] < MIN_SUBJECTS:
        reasons.append(f"only {report['subjects']} people (need {MIN_SUBJECTS})")
    if report["minRepsPerSubject"] < MIN_REPS_PER_SUBJECT:
        reasons.append(f"someone has only {report['minRepsPerSubject']} reps (need {MIN_REPS_PER_SUBJECT})")
    if "C" in report["tiers"]:
        reasons.append("includes tier C data, which can never ship")
    if "B" in report["tiers"] and not permission:
        reasons.append("includes tier B data without written permission")
    if report["improvement"]["ci95"][0] <= 0:
        reasons.append(f"doesn't clearly beat the {report['bestBaseline']} baseline on unseen people")
    elif report["improvement"]["share"] < MIN_IMPROVEMENT:
        reasons.append(f"beats the baseline by less than {MIN_IMPROVEMENT:.0%}")
    return reasons


def export_trees(model, names, schema):
    """The fitted trees as plain arrays, for js/ml/trees.js."""
    trees = []
    for est in model.estimators_[:, 0]:
        t = est.tree_
        trees.append({
            "f": [int(v) for v in t.feature],
            "t": [float(v) for v in t.threshold],
            "l": [int(v) for v in t.children_left],
            "r": [int(v) for v in t.children_right],
            "v": [float(v) for v in t.value[:, 0, 0]],
        })
    return {
        "schema": TREES_SCHEMA,
        "featureSchema": schema,
        "featureNames": names,
        "target": TARGET,
        "unit": "deg",
        "init": float(model.init_.constant_[0][0]),
        "learningRate": float(model.learning_rate),
        "trees": trees,
    }


def predict_exported(exported, X):
    """The same walk js/ml/trees.js does, so tests can check the export against scikit-learn."""
    out = []
    for x in np.asarray(X, dtype=float):
        total = exported["init"]
        for tree in exported["trees"]:
            node = 0
            while tree["l"][node] != -1:
                node = tree["l"][node] if x[tree["f"][node]] <= tree["t"][node] else tree["r"][node]
            total += exported["learningRate"] * tree["v"][node]
        out.append(total)
    return np.array(out)


def model_card(name, report, reasons):
    m = report["methods"]
    row = lambda label, k: f"| {label} | {m[k]['mae']:.2f}° | {m[k]['ci95'][0]:.2f}° to {m[k]['ci95'][1]:.2f}° |"
    imp = report["improvement"]
    lines = [f"# Model card: {name}", ""]
    if report["simulated"]:
        lines += ["> **SIMULATED DATA. This is a pipeline check, not a measure of accuracy on people. It must not ship.**", ""]
    lines += [
        "**Status:** " + ("passed the ship gate; starts in shadow mode" if not reasons else "did not pass the ship gate"), "",
        "## Intended use", "",
        "Estimates how much the lower back flexed during a standing hip hinge, from the webcam's body landmarks, so SpineSense can compare it with its rules. "
        "It runs in shadow mode first: its output is logged on the device and changes nothing the user sees. "
        "SpineSense is an exercise companion, not a medical device. This model does not diagnose anything, and it never touches the safety rules.", "",
        "## Data", "",
        f"- {report['reps']} reps from {report['subjects']} people (at least {report['minRepsPerSubject']} reps each)",
        f"- Licence tiers: {', '.join(report['tiers'])}",
        "- Label: peak lumbar flexion from two back sensors (upper minus lower), relative to the start of the exercise",
        f"- Label spread (SD): {report['labelSd']:.2f}°", "",
        "## Results on people the model never saw", "",
        "Mean absolute error, leave-one-person-out, with 95% intervals over people.", "",
        "| Method | MAE | 95% interval |", "|---|---|---|",
        row("This model", "model"), row("Baseline: always the average", "mean"), row("Baseline: fixed share of trunk lean", "tilt"), "",
        f"Improvement over the best baseline ({report['bestBaseline']}): {imp['mae']:.2f}° ({imp['share']:.0%}), 95% interval {imp['ci95'][0]:.2f}° to {imp['ci95'][1]:.2f}°.", "",
        "## Ship gate", "",
    ]
    lines += [f"- Failed: {r}" for r in reasons] or ["- Passed every check."]
    lines += ["", "## Known limits", "",
              "- Only standing hip hinges, side-on to the camera.",
              "- Depends on the sensors' own accuracy, and on the clocks being lined up.",
              "- People unlike those in the training data (body type, age, clothing, camera height) may get worse results.", ""]
    return "\n".join(lines)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("rows")
    ap.add_argument("--out", default="ml/artifacts/hinge-lumbar")
    ap.add_argument("--name", default="hinge-lumbar")
    ap.add_argument("--permission", help="reference to written permission, for tier B data")
    args = ap.parse_args()

    rows = load_rows(args.rows)
    names = json.loads(Path(f"{args.rows}.names.json").read_text(encoding="utf-8"))  # written by tools/build-dataset.mjs from js/core/features.js
    schema = rows[0]["schema"]
    if schema != names["schema"]:
        raise SystemExit(f"rows use {schema} but the names file says {names['schema']}: run node tools/build-dataset.mjs again")
    report = evaluate(rows, names["names"])
    reasons = gate(report, args.permission)
    report["gate"] = {"passed": not reasons, "reasons": reasons}
    report["featureSchema"] = schema

    X = np.array([r["features"] for r in rows], dtype=float)
    y = np.array([r["label"] for r in rows], dtype=float)
    model = make_model().fit(X, y)

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    (out / "model.json").write_text(json.dumps(export_trees(model, names["names"], schema)), encoding="utf-8")
    (out / "report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    (out / "MODEL_CARD.md").write_text(model_card(args.name, report, reasons), encoding="utf-8")

    m = report["methods"]
    print(f"{report['reps']} reps, {report['subjects']} people{' (SIMULATED)' if report['simulated'] else ''}")
    for k, label in (("model", "model"), ("tilt", "share of lean"), ("mean", "average")):
        print(f"  {label:14s} MAE {m[k]['mae']:.2f} deg  (95% {m[k]['ci95'][0]:.2f} to {m[k]['ci95'][1]:.2f})")
    print(f"  gate: {'PASSED' if not reasons else 'not passed'}")
    for r in reasons:
        print(f"    - {r}")


if __name__ == "__main__":
    main()
