import type { Node } from '@xyflow/react';

export type ImageFormat = 'png' | 'jpeg';

const PAD = 48;
const ZOOM = 1.5;

/** SVG presentation properties that page CSS sets on edges and labels. */
const SVG_PROPS = [
  'fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-dasharray',
  'opacity', 'font-family', 'font-size', 'font-weight', 'visibility',
];

/** File-name-safe slug of a diagram name. */
export function fileSlug(name: string): string {
  return name.trim().toLowerCase().replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'diagram';
}

/** Starts a download and releases the object URL later (revoking at once can cancel it). */
export function downloadHref(href: string, filename: string, revoke = false): void {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (revoke) setTimeout(() => URL.revokeObjectURL(href), 10_000);
}

/** Bounds of top-level nodes from their measured size (no deprecated getNodesBounds). */
function boundsOf(nodes: Node[]): { x: number; y: number; width: number; height: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    const w = n.measured?.width ?? n.width ?? 0;
    const h = n.measured?.height ?? n.height ?? 0;
    minX = Math.min(minX, n.position.x);
    minY = Math.min(minY, n.position.y);
    maxX = Math.max(maxX, n.position.x + w);
    maxY = Math.max(maxY, n.position.y + h);
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, width: 0, height: 0 };
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * html-to-image deep-clones an <svg> without copying computed styles to its children, so
 * class-based fills (edge labels, edge strokes) are lost and render black. Inline the
 * computed values for the capture and put the previous inline values back afterwards.
 */
function inlineSvgStyles(root: HTMLElement): () => void {
  const restore: Array<() => void> = [];
  root.querySelectorAll<SVGElement>('svg *').forEach(el => {
    const computed = getComputedStyle(el);
    for (const prop of SVG_PROPS) {
      const prev = el.style.getPropertyValue(prop);
      const prio = el.style.getPropertyPriority(prop);
      el.style.setProperty(prop, computed.getPropertyValue(prop));
      restore.push(() => {
        if (prev) el.style.setProperty(prop, prev, prio);
        else el.style.removeProperty(prop);
      });
    }
  });
  return () => restore.forEach(r => r());
}

/** Renders the whole diagram (not just the visible part) to an image and downloads it. */
export async function renderViewport(format: ImageFormat, nodes: Node[], name: string): Promise<void> {
  const viewport = document.querySelector<HTMLElement>('.react-flow__viewport');
  if (!viewport) throw new Error('Open the playground to export an image');
  if (nodes.length === 0) throw new Error('The canvas is empty');

  const { toPng, toJpeg } = await import('html-to-image');
  const b = boundsOf(nodes);
  const W = Math.ceil(b.width * ZOOM) + PAD * 2;
  const H = Math.ceil(b.height * ZOOM) + PAD * 2;
  const tx = -b.x * ZOOM + PAD;
  const ty = -b.y * ZOOM + PAD;
  const bg = getComputedStyle(document.body).getPropertyValue('--bg-base').trim() || '#0a0f1e';
  const options = {
    width: W,
    height: H,
    backgroundColor: bg,
    style: { width: `${W}px`, height: `${H}px`, transform: `translate(${tx}px, ${ty}px) scale(${ZOOM})` },
  };

  const restore = inlineSvgStyles(viewport);
  let dataUrl: string;
  try {
    dataUrl = format === 'png'
      ? await toPng(viewport, options)
      : await toJpeg(viewport, { ...options, quality: 0.92 });
  } finally {
    restore();
  }
  downloadHref(dataUrl, `${fileSlug(name)}.${format === 'png' ? 'png' : 'jpg'}`);
}
