// One Euro filter (Casiez et al. 2012): smooths jitter when still, stays responsive when moving.

const alpha = (cutoff, dt) => 1 / (1 + 1 / (2 * Math.PI * cutoff * dt));

export class OneEuro {
  constructor(minCutoff = 1.0, beta = 4.0, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.x = null;
    this.dx = 0;
    this.t = null;
  }

  filter(v, t) {
    if (this.x === null) {
      this.x = v;
      this.t = t;
      return v;
    }
    const dt = Math.max(1e-3, t - this.t);
    this.t = t;
    const d = (v - this.x) / dt;
    this.dx += alpha(this.dCutoff, dt) * (d - this.dx);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += alpha(cutoff, dt) * (v - this.x);
    return this.x;
  }
}

/** Smooths every coordinate of a landmark list; visibility passes through. */
export class LandmarkSmoother {
  constructor(minCutoff = 1.0, beta = 4.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.filters = null;
  }

  apply(points, t) {
    if (!this.filters || this.filters.length !== points.length) {
      this.filters = points.map(() => [0, 1, 2].map(() => new OneEuro(this.minCutoff, this.beta)));
    }
    return points.map((p, i) => {
      const [fx, fy, fz] = this.filters[i];
      return { x: fx.filter(p.x, t), y: fy.filter(p.y, t), z: fz.filter(p.z ?? 0, t), visibility: p.visibility };
    });
  }

  reset() {
    this.filters = null;
  }
}
