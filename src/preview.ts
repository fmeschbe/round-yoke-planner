import { colorAt } from './pattern';
import type { Pattern } from './pattern';
import type { Geometry } from './yoke';

const SVG_NS = 'http://www.w3.org/2000/svg';
const TAU = Math.PI * 2;
const RADIUS = 200;
const MAX_VECTOR_CELLS = 5000;
const MAX_MARKERS = 2000;

function svgElement<K extends keyof SVGElementTagNameMap>(
  tag: K, attributes: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  return element;
}

function point(radius: number, angle: number): string {
  return `${radius * Math.sin(angle)} ${-radius * Math.cos(angle)}`;
}

export function annularPath(inner: number, outer: number, start: number, end: number): string {
  const mid = (start + end) / 2;
  return `M ${point(outer, start)} A ${outer} ${outer} 0 0 1 ${point(outer, mid)} A ${outer} ${outer} 0 0 1 ${point(outer, end)} L ${point(inner, end)} A ${inner} ${inner} 0 0 0 ${point(inner, mid)} A ${inner} ${inner} 0 0 0 ${point(inner, start)} Z`;
}

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

function sectorBounds(inner: number, span: number): Bounds {
  const angles = [0, span];
  for (let angle = Math.PI / 2; angle < span; angle += Math.PI / 2) angles.push(angle);
  const xs = angles.flatMap(angle => [inner * Math.sin(angle), RADIUS * Math.sin(angle)]);
  const ys = angles.flatMap(angle => [-inner * Math.cos(angle), -RADIUS * Math.cos(angle)]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

export class Preview {
  private geometry?: Geometry;
  private visible = 0;
  private svg?: SVGSVGElement;
  private image?: SVGImageElement;
  private paths: { path: SVGPathElement; round: number; column: number }[] = [];
  private bounds?: Bounds;
  private inner = 0;

  constructor(
    private container: HTMLElement,
    private description: HTMLElement,
    private mode: HTMLElement,
    private pattern: Pattern,
  ) {}

  render(): void {
    const { geometry, visibleSegments } = this.pattern;
    if (!geometry.rows.length) {
      this.container.textContent = 'No rounds to preview.';
      this.description.textContent = 'Initial and final stitches are equal.';
      this.mode.textContent = 'No rounds';
      this.geometry = undefined;
      this.svg = undefined;
      this.paths = [];
      this.image = undefined;
      this.bounds = undefined;
      return;
    }
    if (this.geometry !== geometry || this.visible !== visibleSegments) this.build();
    this.updateColors();
  }

  updateColors(): void {
    for (const { path, round, column } of this.paths) {
      path.setAttribute('fill', colorAt(this.pattern, round, column));
    }
    if (this.image) this.renderRaster();
  }

  private build(): void {
    const { geometry, visibleSegments } = this.pattern;
    this.geometry = geometry;
    this.visible = visibleSegments;
    this.paths = [];
    this.image = undefined;
    this.inner = RADIUS * geometry.calculation.si / geometry.calculation.sf;
    const span = TAU * visibleSegments / geometry.segments;
    const sector = TAU / geometry.segments;
    this.bounds = sectorBounds(this.inner, span);
    const { x, y, width, height } = this.bounds;
    const padding = Math.max(width, height) * 0.06;
    this.svg = svgElement('svg', {
      viewBox: `${x - padding} ${y - padding} ${width + padding * 2} ${height + padding * 2}`,
      role: 'img', 'aria-labelledby': 'yoke-title yoke-description',
    });
    const title = svgElement('title', { id: 'yoke-title' });
    title.textContent = 'Colored round-yoke preview';
    const description = svgElement('desc', { id: 'yoke-description' });
    description.textContent = `${visibleSegments} of ${geometry.segments} repeating segments, ${geometry.rows.length} rounds, from ${geometry.calculation.si} to ${geometry.calculation.sf} stitches. Schematic, not physical knitting simulation.`;
    this.svg.append(title, description);
    this.description.textContent = description.textContent;
    const cellCount = geometry.rows.reduce((sum, row) => sum + row.columns.length, 0) * visibleSegments;
    const step = (RADIUS - this.inner) / geometry.rows.length;
    if (cellCount > MAX_VECTOR_CELLS) {
      this.mode.textContent = 'Dense preview';
      this.svg.dataset.renderer = 'raster';
      this.image = svgElement('image', { x, y, width, height, preserveAspectRatio: 'none' });
      this.svg.append(this.image);
    } else {
      this.mode.textContent = visibleSegments === geometry.segments ? 'Full circle' : 'Sector';
      this.svg.dataset.renderer = 'vector';
      const group = svgElement('g', { class: 'preview-stitches' });
      for (const row of geometry.rows) {
        const inner = this.inner + (row.round - 1) * step;
        for (let repeat = 0; repeat < visibleSegments; repeat++) {
          row.columns.forEach((column, index) => {
            const start = repeat * sector + index / row.columns.length * sector;
            const end = repeat * sector + (index + 1) / row.columns.length * sector;
            const path = svgElement('path', {
              d: annularPath(inner, inner + step, start, end),
              'data-round': row.round, 'data-column': column,
              stroke: '#263b3530', 'stroke-width': 0.35,
            });
            group.append(path);
            this.paths.push({ path, round: row.round, column });
          });
        }
      }
      this.svg.append(group);
    }
    const markers = svgElement('g', {
      class: 'preview-increases', fill: 'none', stroke: '#274e45',
      'stroke-width': 1, 'stroke-dasharray': '2 2', 'pointer-events': 'none',
    });
    const perRound = Math.ceil(geometry.calculation.ip * visibleSegments / geometry.segments);
    const denseMarkers = perRound * geometry.calculation.increases > MAX_MARKERS;
    for (const row of geometry.rows) {
      if (!row.increase) continue;
      const inner = this.inner + (row.round - 1) * step;
      if (denseMarkers) {
        markers.append(svgElement('path', {
          d: annularPath(inner, inner + step, 0, span),
          'data-dense-increases': 'true',
        }));
      } else {
        for (let k = 0; k < perRound; k++) {
          const angle = k / geometry.calculation.ip * TAU;
          markers.append(svgElement('path', {
            d: `M ${point(inner, angle)} L ${point(inner + step, angle)}`,
            'data-increase-round': row.round,
          }));
        }
      }
    }
    if (denseMarkers) {
      this.description.textContent += ' Increase points are densely spaced; dashed bands indicate increase rounds.';
      description.textContent = this.description.textContent;
    }
    this.svg.append(markers);
    this.container.replaceChildren(this.svg);
  }

  private renderRaster(): void {
    const { geometry, visibleSegments } = this.pattern;
    const bounds = this.bounds!;
    const canvas = document.createElement('canvas');
    const size = Math.min(1024, Math.round(640 * Math.min(window.devicePixelRatio || 1, 2)));
    const scale = size / Math.max(bounds.width, bounds.height);
    canvas.width = Math.max(1, Math.round(bounds.width * scale));
    canvas.height = Math.max(1, Math.round(bounds.height * scale));
    const context = canvas.getContext('2d')!;
    const image = context.createImageData(canvas.width, canvas.height);
    const sector = TAU / geometry.segments;
    const span = sector * visibleSegments;
    const step = (RADIUS - this.inner) / geometry.rows.length;
    const colors = geometry.rows.map(row => row.columns.map(column => {
      const hex = colorAt(this.pattern, row.round, column);
      return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
    }));
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const px = bounds.x + (x + 0.5) / canvas.width * bounds.width;
        const py = bounds.y + (y + 0.5) / canvas.height * bounds.height;
        const radius = Math.hypot(px, py);
        if (radius < this.inner || radius >= RADIUS) continue;
        let angle = Math.atan2(px, -py);
        if (angle < 0) angle += TAU;
        if (angle >= span) continue;
        const roundIndex = Math.min(colors.length - 1, Math.floor((radius - this.inner) / step));
        const rowColors = colors[roundIndex];
        const columnIndex = Math.min(rowColors.length - 1, Math.floor((angle % sector) / sector * rowColors.length));
        const offset = (y * canvas.width + x) * 4;
        const color = rowColors[columnIndex];
        image.data[offset] = color[0];
        image.data[offset + 1] = color[1];
        image.data[offset + 2] = color[2];
        image.data[offset + 3] = 255;
      }
    }
    context.putImageData(image, 0, 0);
    this.image!.setAttribute('href', canvas.toDataURL('image/png'));
  }
}
