"""Writes test/fixtures/trees-parity.json: a small trained model, some inputs, and scikit-learn's own
predictions. test/ml.test.mjs checks that js/ml/trees.js gives the same answers, so the browser can
never quietly disagree with training. Run it again if the export format changes.

    python ml/make_parity_fixture.py
"""

import json
from pathlib import Path

import numpy as np

import train

NAMES = ["a", "b", "c", "d"]

rng = np.random.default_rng(3)
X = rng.uniform(-5, 5, size=(120, len(NAMES)))
y = 2 * X[:, 0] - X[:, 1] ** 2 + np.where(X[:, 2] > 0, 3, -3) + rng.normal(0, 0.2, len(X))
model = train.make_model().fit(X, y)
exported = train.export_trees(model, NAMES, "test")
inputs = rng.uniform(-6, 6, size=(25, len(NAMES)))
fixture = {"model": exported, "inputs": inputs.tolist(), "expected": model.predict(inputs).tolist()}
Path("test/fixtures/trees-parity.json").write_text(json.dumps(fixture), encoding="utf-8")
print("wrote test/fixtures/trees-parity.json")
