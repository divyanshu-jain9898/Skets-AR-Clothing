export type Gender = 'women' | 'men';
export type SourceMode = 'mannequin' | 'camera' | 'photo';
export type QualityLevel = 'performance' | 'balanced' | 'quality';

export interface LandmarkIn {
  x: number;
  y: number;
  z: number;
  visibility?: number;
  presence?: number;
}

/** One pose observation in the format produced by MediaPipe (or the synthetic poser). */
export interface PoseInput {
  /** 33 landmarks, x/y normalised to the source frame, z relative depth. */
  landmarks: LandmarkIn[];
  /** 33 landmarks in metres, origin between the hips (MediaPipe world landmarks). */
  world: LandmarkIn[];
  /** Source frame size in pixels. */
  width: number;
  height: number;
}

export interface QualitySettings {
  level: QualityLevel;
  model: 'lite' | 'full';
  pixelRatioCap: number;
  antialias: boolean;
  /** Mesh resolution multiplier (1 = high). */
  meshDetail: number;
  clothIterations: number;
}

export const QUALITY_PRESETS: Record<QualityLevel, QualitySettings> = {
  performance: { level: 'performance', model: 'lite', pixelRatioCap: 1, antialias: false, meshDetail: 0.6, clothIterations: 4 },
  balanced: { level: 'balanced', model: 'lite', pixelRatioCap: 1.5, antialias: true, meshDetail: 0.8, clothIterations: 6 },
  quality: { level: 'quality', model: 'full', pixelRatioCap: 2, antialias: true, meshDetail: 1, clothIterations: 8 },
};

export type TrackingStatus = 'idle' | 'loading' | 'searching' | 'tracking' | 'error';

export interface EngineStats {
  fps: number;
  inferMs: number;
  renderMs: number;
  /** Person segmentation time (only while a backdrop is active). */
  segMs: number;
  delegate: 'GPU' | 'CPU' | '-';
}
