import numpy as np

import train

NAMES = ["tiltRange", "hipPerTilt", "noise"]


def rows(people=16, reps=20, cue=True, simulated=False, tier="A", seed=1):
    """Fake reps: lumbar flexion is the share of the lean that didn't come from the hips."""
    rng = np.random.default_rng(seed)
    out = []
    for p in range(people):
        style = rng.uniform(0.4, 0.8)
        for r in range(reps):
            tilt = rng.uniform(35, 60)
            share = np.clip(style + rng.normal(0, 0.1), 0.2, 0.9)
            seen = share if cue else rng.uniform(0.2, 0.9)
            out.append({"schema": "t", "subject": f"p{p}", "tier": tier, "simulated": simulated, "features": [tilt, seen, rng.normal()], "label": tilt * (1 - share) + rng.normal(0, 0.5)})
    return out


def test_a_learnable_signal_beats_the_baselines_and_passes():
    report = train.evaluate(rows(), NAMES)
    assert report["methods"]["model"]["mae"] < report["methods"][report["bestBaseline"]]["mae"]
    assert train.gate(report) == []


def test_negative_control_nothing_to_learn_fails_the_gate():
    report = train.evaluate(rows(cue=False), NAMES)
    assert any("doesn't clearly beat" in r or "less than" in r for r in train.gate(report))


def test_gate_refuses_simulated_small_or_restricted_data():
    assert any("simulated" in r for r in train.gate(train.evaluate(rows(simulated=True), NAMES)))
    assert any("only 8 people" in r for r in train.gate(train.evaluate(rows(people=8), NAMES)))
    assert any("only 10 reps" in r for r in train.gate(train.evaluate(rows(reps=10), NAMES)))
    assert any("tier C" in r for r in train.gate(train.evaluate(rows(tier="C"), NAMES)))
    tier_b = train.evaluate(rows(tier="B"), NAMES)
    assert any("tier B" in r for r in train.gate(tier_b))
    assert train.gate(tier_b, permission="letter 2026-11") == []


def test_no_person_is_in_both_training_and_testing(monkeypatch):
    seen = []

    class Spy:
        def fit(self, X, y):
            seen.append(set(map(tuple, X)))
            return self

        def predict(self, X):
            assert not (set(map(tuple, X)) & seen[-1]), "a test row was in the training data"
            return np.zeros(len(X))

    monkeypatch.setattr(train, "make_model", Spy)
    train.evaluate(rows(people=4, reps=5), NAMES)
    assert len(seen) == 4


def test_export_matches_scikit_learn():
    data = rows(people=5, reps=10)
    X = np.array([r["features"] for r in data])
    y = np.array([r["label"] for r in data])
    model = train.make_model().fit(X, y)
    exported = train.export_trees(model, NAMES, "t")
    assert np.allclose(train.predict_exported(exported, X), model.predict(X), atol=1e-9)


def test_card_says_when_data_was_simulated_and_avoids_banned_claims():
    report = train.evaluate(rows(simulated=True), NAMES)
    card = train.model_card("x", report, train.gate(report))
    assert "SIMULATED DATA" in card and "must not ship" in card
    for banned in ("detects pain", "diagnoses", "identifies your condition", "treats", "clinically validated"):
        assert banned not in card.lower()
