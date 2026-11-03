// Runs the gradient-boosted trees that ml/train.py exports. test/ml.test.mjs checks the answers match
// scikit-learn's own, so the browser can't quietly disagree with training.

export const TREES_SCHEMA = 'trees.v1';

export function predictTrees(model, x) {
  let total = model.init;
  for (const t of model.trees) {
    let n = 0;
    while (t.l[n] !== -1) n = x[t.f[n]] <= t.t[n] ? t.l[n] : t.r[n];
    total += model.learningRate * t.v[n];
  }
  return total;
}
