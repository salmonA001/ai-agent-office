import { CanvasTexture, MeshBasicMaterial, SRGBColorSpace } from "three";

/**
 * RGB lighting shared by every custom PC in the office. A handful of materials are shared, and
 * one frame callback (see RgbDriver in OfficeScene) cycles their colour, so a room full of
 * glowing towers costs no more than one.
 */
type RgbMaterials = { strip: MeshBasicMaterial; fans: MeshBasicMaterial; off: MeshBasicMaterial; fansOff: MeshBasicMaterial };

let materials: RgbMaterials | null = null;

/** Glass side panel: three fans and a graphics card, drawn white so the material colour tints them. */
function fansTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#0b0d12";
  g.fillRect(0, 0, 128, 256);
  for (const y of [48, 128]) {
    g.strokeStyle = "#ffffff";
    g.lineWidth = 7;
    g.beginPath();
    g.arc(64, y, 34, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = "rgba(255,255,255,0.35)";
    for (let k = 0; k < 7; k++) {
      g.save();
      g.translate(64, y);
      g.rotate((k / 7) * Math.PI * 2);
      g.beginPath();
      g.ellipse(14, 0, 14, 5, 0.5, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  }
  // graphics card with a light bar
  g.fillStyle = "#2b2f36";
  g.fillRect(14, 186, 100, 34);
  g.fillStyle = "#ffffff";
  g.fillRect(14, 186, 100, 5);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

export function rgbMaterials(): RgbMaterials {
  if (!materials) {
    const tex = fansTexture();
    materials = {
      strip: new MeshBasicMaterial({ color: "#ff3cac", toneMapped: false }),
      fans: new MeshBasicMaterial({ color: "#7c3aed", map: tex, toneMapped: false }),
      off: new MeshBasicMaterial({ color: "#1f2937" }),
      fansOff: new MeshBasicMaterial({ color: "#3f4652", map: tex }),
    };
  }
  return materials;
}

/** Advance the colour cycle (called once per frame). */
export function tickRgb(t: number) {
  const m = rgbMaterials();
  m.strip.color.setHSL((t * 0.07) % 1, 1, 0.55);
  m.fans.color.setHSL((t * 0.07 + 0.33) % 1, 1, 0.62);
}
