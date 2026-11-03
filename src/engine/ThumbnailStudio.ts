import { ARRenderer } from './render/ARRenderer';
import { Mannequin } from './render/BodyVisuals';
import { BodyRig } from './body/BodyRig';
import { BodyShape } from './body/BodyShape';
import { SyntheticPose } from './tracking/SyntheticPose';
import { Wardrobe } from './Wardrobe';
import type { FabricLibrary } from './materials/FabricLibrary';
import type { OutfitSelection } from './catalog/types';

/**
 * Renders outfit previews on the display mannequin with the same garment
 * engine as the live view, so library cards always match what you get.
 */
export class ThumbnailStudio {
  private canvas = document.createElement('canvas');
  private renderer: ARRenderer;
  private rig = new BodyRig();
  private shape = new BodyShape();
  private synth = new SyntheticPose();
  private wardrobe: Wardrobe;
  private mannequin: Mannequin;
  private fw: number;
  private fh = 1000;

  constructor(lib: FabricLibrary, w = 270, h = 360) {
    this.renderer = new ARRenderer(this.canvas, true);
    this.renderer.pixelRatioCap = 1;
    this.renderer.renderer.setPixelRatio(1);
    this.renderer.renderer.setSize(w, h, false);
    this.renderer.viewW = w;
    this.renderer.viewH = h;
    this.fw = Math.round((this.fh * w) / h);
    this.renderer.setBackground('studio');
    this.renderer.setFrameSize(this.fw, this.fh);
    this.renderer.studioLights();
    this.wardrobe = new Wardrobe({ lib, detail: 0.75, gender: 'women', clothIterations: 6 }, this.renderer.garments);
    this.mannequin = new Mannequin(lib.mannequin());
    this.renderer.root.add(this.mannequin.group);
    this.synth.autoRotate = false;
    this.synth.userYaw = 0.32;
  }

  render(sel: OutfitSelection): string {
    this.wardrobe.ctx.gender = sel.gender;
    this.synth.gender = sel.gender;
    this.wardrobe.apply(sel);
    this.shape.bust = sel.gender === 'women' ? 1 : 0;
    let t = 0;
    const dt = 1 / 30;
    for (let i = 0; i < 26; i++) {
      t += dt;
      const pose = this.synth.generate(t, dt, this.fw, this.fh);
      this.rig.update(pose, t, i === 0);
      this.shape.update(this.rig);
      this.wardrobe.update(this.rig, this.shape, dt);
    }
    this.mannequin.update(this.rig, this.shape);
    this.renderer.placeShadow(this.rig);
    this.renderer.render();
    const url = this.canvas.toDataURL('image/webp', 0.86);
    return url.startsWith('data:image/webp') ? url : this.canvas.toDataURL('image/jpeg', 0.88);
  }

  dispose() {
    this.wardrobe.clear();
    this.renderer.renderer.forceContextLoss();
    this.renderer.dispose();
  }
}
