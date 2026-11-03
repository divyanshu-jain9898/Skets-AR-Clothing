export type Facing = 'user' | 'environment';

/** getUserMedia wrapper that exposes a playing <video> element. */
export class CameraSource {
  readonly video: HTMLVideoElement;
  stream: MediaStream | null = null;
  facing: Facing = 'user';

  constructor() {
    const v = document.createElement('video');
    v.playsInline = true;
    v.muted = true;
    v.autoplay = true;
    v.setAttribute('playsinline', '');
    v.setAttribute('muted', '');
    this.video = v;
  }

  static get supported() {
    return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  }

  get width() {
    return this.video.videoWidth;
  }
  get height() {
    return this.video.videoHeight;
  }
  get active() {
    return !!this.stream && this.stream.getVideoTracks().some((t) => t.readyState === 'live');
  }

  async start(facing: Facing = this.facing) {
    if (!CameraSource.supported) throw new Error('Camera access is not supported in this browser.');
    this.stop();
    const portrait = window.innerHeight > window.innerWidth;
    const video: MediaTrackConstraints = {
      facingMode: { ideal: facing },
      width: { ideal: portrait ? 720 : 1280 },
      height: { ideal: portrait ? 1280 : 720 },
      frameRate: { ideal: 30, max: 60 },
    };
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video });
    } catch (err) {
      // retry with minimal constraints (some devices reject resolution hints)
      if ((err as DOMException)?.name === 'OverconstrainedError') {
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: facing } });
      } else {
        throw err;
      }
    }
    this.facing = facing;
    this.video.srcObject = this.stream;
    await this.video.play().catch(() => undefined);
    if (!this.video.videoWidth) {
      await new Promise<void>((resolve) => {
        const done = () => resolve();
        this.video.addEventListener('loadedmetadata', done, { once: true });
        setTimeout(done, 3000);
      });
    }
  }

  stop() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video.srcObject = null;
  }

  static async cameraCount(): Promise<number> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter((d) => d.kind === 'videoinput').length;
    } catch {
      return 1;
    }
  }

  static describeError(err: unknown): string {
    const name = (err as DOMException)?.name;
    let embedded = false;
    try {
      embedded = window.self !== window.top;
    } catch {
      embedded = true;
    }
    if (embedded && (name === 'NotAllowedError' || name === 'SecurityError' || !CameraSource.supported))
      return 'This embedded preview cannot use your camera. Run Vastra locally or on any https site for live try-on; photo and mannequin modes work here.';
    switch (name) {
      case 'NotAllowedError':
      case 'SecurityError':
        return 'Camera permission was blocked. Allow camera access in your browser settings, or try a photo instead.';
      case 'NotFoundError':
      case 'OverconstrainedError':
        return 'No camera was found on this device. You can still try outfits on a photo or the 3D mannequin.';
      case 'NotReadableError':
        return 'The camera is busy in another app. Close it there and try again.';
      default:
        return location.protocol !== 'https:' && location.hostname !== 'localhost'
          ? 'Camera needs a secure (https) connection. Open the app over https or on localhost.'
          : `Could not start the camera (${name ?? 'unknown error'}).`;
    }
  }
}
