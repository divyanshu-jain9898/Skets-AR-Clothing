/**
 * One Euro filter (Casiez et al. 2012): a speed-adaptive low-pass filter.
 * Slow movements are smoothed heavily (no jitter), fast movements pass with
 * little lag. Used for every landmark coordinate.
 */
export class OneEuroFilter {
  private x = 0;
  private dx = 0;
  private t = 0;
  private ready = false;

  constructor(
    public minCutoff = 1.5,
    public beta = 0.01,
    public dCutoff = 1.0,
  ) {}

  private static alpha(cutoff: number, dt: number) {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }

  reset(value?: number, t?: number) {
    if (value === undefined) {
      this.ready = false;
      return;
    }
    this.x = value;
    this.dx = 0;
    this.t = t ?? 0;
    this.ready = true;
  }

  get value() {
    return this.x;
  }

  filter(value: number, t: number): number {
    if (!this.ready) {
      this.reset(value, t);
      return value;
    }
    const dt = Math.max(1e-3, t - this.t);
    this.t = t;
    const rawDx = (value - this.x) / dt;
    this.dx += OneEuroFilter.alpha(this.dCutoff, dt) * (rawDx - this.dx);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += OneEuroFilter.alpha(cutoff, dt) * (value - this.x);
    return this.x;
  }
}
