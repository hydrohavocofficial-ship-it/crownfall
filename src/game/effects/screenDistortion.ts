/**
 * SCREEN DISTORTION
 *
 * A lens-ripple compositor for the whole frame. Real anime impact is not only a
 * flash — the *picture itself* bends: a shockwave travels outward from the point
 * of contact and smears the image along the wavefront, with the red and blue
 * channels pulled apart as it passes.
 *
 * Canvas 2D has no per-pixel warp, so the ripple is done the way it is done in
 * shipping 2D games: the finished frame is snapshotted and re-composited as
 * full-width horizontal bands, each displaced sideways by an amount that peaks
 * on the wavefront and falls off with the radial distance. The chromatic split
 * falls out of the same pass — the red and blue copies are displaced by a
 * fraction of the main offset, in opposite directions.
 *
 * The whole thing is strictly presentation: it reads the canvas and writes it
 * back, and it never touches the simulation.
 */

export interface DistortionPulse {
  /**
   * Vertical position of the shock origin, in the composite's own pixels.
   *
   * There is deliberately no `x`. A full-width band can only be displaced by one
   * horizontal offset, so the horizontal origin of the lens cannot influence any
   * band — carrying it would be dead state pretending to be a parameter. What the
   * bands *do* reproduce faithfully is the radial falloff in y, which is the part
   * that makes the result read as a circular lens rather than a flat smear.
   */
  y: number;
  /** Frames since it was raised. */
  t: number;
  /** Total lifetime in frames. */
  max: number;
  /** Peak band displacement, in pixels. */
  strength: number;
  /** 0 = off, 1 = full ripple + chromatic split. */
  chroma: number;
}

/**
 * Horizontal displacement of one horizontal band, for a circular shockwave.
 *
 * The radial wave is projected onto the x axis: the horizontal component of the
 * unit radial vector at this band's height is `sqrt(1 - (dy/radius)^2)`. Bands
 * level with the impact therefore move the most and bands far above or below it
 * do not move at all, which is what makes the result read as a circular lens
 * instead of a column of bent slats. The sign flips across the impact's height,
 * so the shear swirls around the epicentre rather than sliding one way.
 *
 * `scale` multiplies the pulse's own strength. That is how the chromatic split
 * is derived from the exact same wavefront without allocating a second pulse
 * object per band per frame.
 */
function ripple(p: DistortionPulse, midY: number, diag: number, scale: number): number {
  const age = p.t / Math.max(1, p.max);
  // The wavefront expands faster than it fades: `1 - (1 - age)^2` is fast out,
  // then eases, which is exactly how a shock dies.
  const radius = (1 - Math.pow(1 - Math.min(1, age), 2)) * diag * 0.9 + 8;
  const dy = midY - p.y;
  const along = 1 - (dy * dy) / (radius * radius);
  // Outside the circle there is no wavefront at all, so no displacement.
  if (along <= 0) return 0;
  // Horizontal component of the radial direction, signed away from the epicentre.
  const dirX = (dy > 0 ? 1 : -1) * Math.sqrt(along);
  const decay = (1 - age) * (1 - age);
  return Math.sin(age * 16) * along * decay * p.strength * scale * dirX;
}

export class ScreenDistortion {
  /** Active pulses, newest last. Capped so three ultimates at once cannot stall. */
  private pulses: DistortionPulse[] = [];
  private buffer: HTMLCanvasElement | null = null;
  private bctx: CanvasRenderingContext2D | null = null;
  /** Horizontal bands used to approximate the warp. */
  private static readonly BANDS = 30;

  /**
   * Raises a shockwave centred on a screen height given in *device* pixels — the
   * same space `ctx` is in after `setTransform(dpr, …)`.
   */
  pulse(y: number, strength = 14, frames = 18, chroma = 1) {
    if (this.pulses.length >= 3) this.pulses.shift();
    this.pulses.push({ y, t: 0, max: Math.max(2, Math.round(frames)), strength, chroma });
  }

  update() {
    if (!this.pulses.length) return;
    for (let i = this.pulses.length - 1; i >= 0; i--) {
      this.pulses[i].t++;
      if (this.pulses[i].t >= this.pulses[i].max) this.pulses.splice(i, 1);
    }
  }

  /**
   * Re-composites `canvas` through the ripple. Returns false when there is
   * nothing to do, so the caller pays nothing on the overwhelming majority of
   * frames.
   */
  draw(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, w: number, h: number): boolean {
    if (!this.pulses.length) return false;
    const buf = this.ensureBuffer(canvas);
    const off = this.bctx;
    if (!buf || !off) { this.pulses.length = 0; return false; }
    // Snapshot the finished frame.
    off.setTransform(1, 0, 0, 1, 0, 0);
    off.clearRect(0, 0, buf.width, buf.height);
    off.drawImage(canvas, 0, 0);

    const bands = ScreenDistortion.BANDS;
    const sh = buf.height / bands;
    const sw = buf.width;
    const diag = Math.hypot(w, h);
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    // Every band is redrawn, displaced or not, so the ripple can never punch a
    // hole in the frame.
    for (let i = 0; i < bands; i++) {
      const sy = i * sh;
      const midY = (sy + sh * 0.5) * (h / buf.height);
      let disp = 0, ca = 0, cb = 0;
      for (const p of this.pulses) {
        disp += ripple(p, midY, diag, 1);
        // The chromatic split rides the same wavefront, an order of magnitude
        // smaller, pulled in opposite directions for the red and blue copies.
        const r = ripple(p, midY, diag, p.chroma * 0.34);
        ca += r; cb -= r;
      }
      const srcY = Math.max(0, Math.min(buf.height - sh, sy));
      if (Math.abs(disp) < 0.05 && Math.abs(ca) < 0.05) {
        ctx.drawImage(buf, 0, srcY, sw, sh, 0, sy, sw, sh);
        continue;
      }
      ctx.drawImage(buf, 0, srcY, sw, sh, disp + ca, sy, sw, sh);
      if (Math.abs(cb) > 0.05) ctx.drawImage(buf, 0, srcY, sw, sh, disp + cb, sy, sw, sh);
      // Overlap the seam by a pixel so a band that moved does not reveal a gap.
      if (i < bands - 1) ctx.drawImage(buf, 0, srcY + sh, sw, 1, disp + ca, sy + sh, sw, 1);
    }
    ctx.restore();
    return true;
  }

  /**
   * Lazily allocates the snapshot framebuffer, resizing it when the real canvas
   * does. Uses the global `document` for the same reason the engine's other
   * screen-space pass (`Game.ensureTimeBuffer`) does, so it works under the
   * headless regression harness and degrades to "no effect" with no DOM at all.
   */
  private ensureBuffer(canvas: HTMLCanvasElement): HTMLCanvasElement | null {
    if (!this.buffer || this.buffer.width !== canvas.width || this.buffer.height !== canvas.height) {
      if (typeof document === 'undefined' || !document.createElement) return null;
      this.buffer = document.createElement('canvas');
      this.buffer.width = canvas.width; this.buffer.height = canvas.height;
      this.bctx = this.buffer.getContext('2d');
    }
    return this.buffer;
  }
}
