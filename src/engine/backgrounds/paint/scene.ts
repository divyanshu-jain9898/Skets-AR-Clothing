import type { Ctx, Rng } from './kit';
import type { PainterlyOptions } from './painterly';

/** Normalised rectangle [x0, y0, x1, y1] in 0..1 image coordinates (y down). */
export type NRect = [number, number, number, number];

/**
 * A scene lays itself out for a canvas size and returns its drawing passes:
 *
 *  1. `base`   - the scene itself. It then goes through the painterly
 *                (oil-on-canvas) filter, which smooths it into brush strokes.
 *  2. `lights` - crisp luminous details drawn on top of the painting:
 *                flames, bulbs, sparks, window lights. Use additive glows.
 *                Anything finer than ~4 px (stars, firework trails, tiny
 *                windows) belongs here, or the oil filter smears it away.
 *  3. `sky`    - optional: paint white where live fireworks may appear (the
 *                open night sky) and black over anything in front of it.
 *                Drawn on a small black canvas with the same coordinates.
 *
 * Scenes must work for portrait and landscape canvases. Keep the centre
 * third calmer: that is where the person stands. Use only the given `rng`
 * (and `fork` it for detail whose amount depends on pixel size) so the
 * thumbnail and the full painting match.
 */
export interface ScenePlan {
  base(g: Ctx): void;
  lights?(g: Ctx): void;
  sky?(g: Ctx): void;
  /** Where live firework bursts may be centred (normalised). */
  skyRects?: NRect[];
  /** Overrides for the oil-paint filter (radius is scaled automatically). */
  painterly?: Partial<Omit<PainterlyOptions, 'radius'>> & { radiusScale?: number };
}

export interface SceneSpec {
  id: string;
  compose(w: number, h: number, rng: Rng): ScenePlan;
}
