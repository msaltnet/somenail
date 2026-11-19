/**
 * Traces an uploaded image's alpha silhouette into vector paths.
 * Clean: antialiased, simplified Bézier outline.
 * Rough: smooth, repeatable paper-cut undulations over the same silhouette.
 *
 * The source image remains untouched and all processing runs in the browser.
 * Opaque photos have a rectangular silhouette; transparency is required to
 * outline a subject rather than the complete image.
 */
export type OutlineStyle = "none" | "clean" | "rough";
export type Point = { x: number; y: number };
export type VectorOutline = {
  paths: string[];
  scale: number;
  padding: number;
};

type Edge = { x: number; y: number; direction: number };
const DX = [1, 0, -1, 0];
const DY = [0, 1, 0, -1];

function polygonArea(points: Point[]): number {
  let result = 0;
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    result += current.x * next.y - next.x * current.y;
  }
  return result / 2;
}

/**
 * Trace the oriented pixel boundary into closed loops, including holes.
 * Right-turn priority separates components which only touch diagonally.
 * This is a vector outline, not a pixel dilation/distance-transform effect.
 */
export function traceContours(mask: Uint8Array, width: number, height: number): Point[][] {
  if (width < 1 || height < 1 || mask.length !== width * height) {
    throw new Error("Invalid alpha mask dimensions");
  }
  const edges: Edge[] = [];
  const starts = new Map<number, number[]>();
  const vertexKey = (x: number, y: number) => y * (width + 1) + x;
  const add = (x: number, y: number, direction: number) => {
    const id = edges.length;
    edges.push({ x, y, direction });
    const key = vertexKey(x, y);
    const from = starts.get(key);
    if (from) from.push(id);
    else starts.set(key, [id]);
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      if (mask[i] === 0) continue;
      if (y === 0 || !mask[i - width]) add(x, y, 0);
      if (x === width - 1 || !mask[i + 1]) add(x + 1, y, 1);
      if (y === height - 1 || !mask[i + width]) add(x + 1, y + 1, 2);
      if (x === 0 || !mask[i - 1]) add(x, y + 1, 3);
    }
  }

  // Avoid pathological outlines with excessive noisy or transparent detail.
  if (edges.length > 300_000) return [];
  const visited = new Uint8Array(edges.length);
  const result: Point[][] = [];
  for (let start = 0; start < edges.length; start += 1) {
    if (visited[start]) continue;
    const points: Point[] = [];
    let id = start;
    let closed = false;
    for (let steps = 0; steps < edges.length; steps += 1) {
      if (visited[id]) break;
      visited[id] = 1;
      const edge = edges[id];
      points.push({ x: edge.x, y: edge.y });
      const ex = edge.x + DX[edge.direction];
      const ey = edge.y + DY[edge.direction];
      const options = starts.get(vertexKey(ex, ey)) ?? [];
      let nextId = -1;
      let best = 100;
      for (const candidateId of options) {
        if (visited[candidateId] && candidateId !== start) continue;
        const direction = edges[candidateId].direction;
        const turn = (direction - edge.direction + 4) % 4;
        const priority = [1, 0, 3, 2].indexOf(turn);
        if (priority < best) {
          nextId = candidateId;
          best = priority;
        }
      }
      if (nextId === start) {
        closed = true;
        break;
      }
      if (nextId < 0) break;
      id = nextId;
    }
    if (closed && points.length >= 4 && Math.abs(polygonArea(points)) >= 6) {
      result.push(points);
    }
  }
  return result;
}

function lineDistanceSquared(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = dx * dx + dy * dy;
  if (!length) return (point.x - a.x) ** 2 + (point.y - a.y) ** 2;
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length));
  return (point.x - a.x - t * dx) ** 2 + (point.y - a.y - t * dy) ** 2;
}

function simplifyOpen(points: Point[], tolerance: number): Point[] {
  if (points.length <= 2) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  const limit = tolerance * tolerance;
  while (stack.length) {
    const [start, end] = stack.pop()!;
    let farthest = -1;
    let farDistance = limit;
    for (let i = start + 1; i < end; i += 1) {
      const distance = lineDistanceSquared(points[i], points[start], points[end]);
      if (distance > farDistance) {
        farthest = i;
        farDistance = distance;
      }
    }
    if (farthest >= 0) {
      keep[farthest] = 1;
      stack.push([start, farthest], [farthest, end]);
    }
  }
  return points.filter((_point, index) => keep[index]);
}

/** Preserve meaningful corners while discarding microscopic stair steps. */
export function simplifyContour(points: Point[], tolerance = 1.35): Point[] {
  if (points.length <= 3) return points;
  const corners = points.filter((point, index) => {
    const prev = points[(index - 1 + points.length) % points.length];
    const next = points[(index + 1) % points.length];
    return (point.x - prev.x) * (next.y - point.y) !==
      (point.y - prev.y) * (next.x - point.x);
  });
  if (corners.length <= 3) return corners;
  const first = corners[0];
  let split = 1;
  let largest = 0;
  for (let i = 1; i < corners.length; i += 1) {
    const distance = (corners[i].x - first.x) ** 2 + (corners[i].y - first.y) ** 2;
    if (distance > largest) {
      largest = distance;
      split = i;
    }
  }
  const left = simplifyOpen(corners.slice(0, split + 1), tolerance);
  const right = simplifyOpen([...corners.slice(split), corners[0]], tolerance);
  return [...left.slice(0, -1), ...right.slice(0, -1)];
}

function segmentLength(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * A rounded polyline encoded as SVG M/L/Q commands. Even though the final
 * export is PNG, the outline stays a resolution-independent Konva path.
 */
export function curvePath(points: Point[], cornerRadius: number): string {
  if (points.length < 3) return "";
  const entries: Point[] = [];
  const exits: Point[] = [];
  for (let i = 0; i < points.length; i += 1) {
    const prev = points[(i - 1 + points.length) % points.length];
    const here = points[i];
    const next = points[(i + 1) % points.length];
    const before = segmentLength(here, prev);
    const after = segmentLength(here, next);
    const incoming = before ? Math.min(0.35, cornerRadius / before) : 0;
    const outgoing = after ? Math.min(0.35, cornerRadius / after) : 0;
    entries.push({
      x: here.x + (prev.x - here.x) * incoming,
      y: here.y + (prev.y - here.y) * incoming,
    });
    exits.push({
      x: here.x + (next.x - here.x) * outgoing,
      y: here.y + (next.y - here.y) * outgoing,
    });
  }
  const fmt = (n: number) => Number(n.toFixed(2));
  const start = exits[points.length - 1];
  let path = "M " + fmt(start.x) + " " + fmt(start.y);
  for (let i = 0; i < points.length; i += 1) {
    const enter = entries[i];
    const corner = points[i];
    const exit = exits[i];
    path += " L " + fmt(enter.x) + " " + fmt(enter.y);
    path += " Q " + fmt(corner.x) + " " + fmt(corner.y) +
      " " + fmt(exit.x) + " " + fmt(exit.y);
  }
  return path + " Z";
}

function roughContour(points: Point[], outlineWidth: number, loopIndex: number): Point[] {
  const samples: Point[] = [];
  const lengths: number[] = [];
  let perimeter = 0;
  const step = 6;
  for (let i = 0; i < points.length; i += 1) {
    const start = points[i];
    const end = points[(i + 1) % points.length];
    const length = segmentLength(start, end);
    const count = Math.max(1, Math.ceil(length / step));
    for (let j = 0; j < count; j += 1) {
      const t = j / count;
      samples.push({
        x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t,
      });
      lengths.push(perimeter + length * t);
    }
    perimeter += length;
  }
  if (samples.length < 3 || perimeter <= 0) return points;
  const orientation = Math.sign(polygonArea(points)) || 1;
  const amplitude = Math.min(4.5, Math.max(1.2, outlineWidth * 0.3));
  const cycles = [Math.max(3, Math.round(perimeter / 120)),
    Math.max(7, Math.round(perimeter / 38)),
    Math.max(13, Math.round(perimeter / 16))];
  const phase = loopIndex * 1.31 + 0.67;
  return samples.map((point, index) => {
    const prev = samples[(index - 1 + samples.length) % samples.length];
    const next = samples[(index + 1) % samples.length];
    const tangentX = next.x - prev.x;
    const tangentY = next.y - prev.y;
    const magnitude = Math.hypot(tangentX, tangentY) || 1;
    const t = lengths[index] / perimeter;
    const wobble = 0.57 * Math.sin(2 * Math.PI * cycles[0] * t + phase) +
      0.31 * Math.sin(2 * Math.PI * cycles[1] * t + phase * 1.6) +
      0.12 * Math.sin(2 * Math.PI * cycles[2] * t - phase * 0.7);
    const offset = amplitude * wobble;
    return {
      x: point.x + orientation * tangentY / magnitude * offset,
      y: point.y - orientation * tangentX / magnitude * offset,
    };
  });
}

export function vectorPathsFromMask(
  mask: Uint8Array,
  width: number,
  height: number,
  style: Exclude<OutlineStyle, "none">,
  outlineWidth: number,
): string[] {
  const contours = traceContours(mask, width, height);
  const result: string[] = [];
  contours.forEach((loop, index) => {
    const simplified = simplifyContour(loop, style === "clean" ? 1.3 : 1.8);
    if (simplified.length < 3) return;
    const points = style === "rough" ? roughContour(simplified, outlineWidth, index) : simplified;
    const path = curvePath(points, style === "clean" ? 2.2 : 2.4);
    if (path) result.push(path);
  });
  return result;
}

export function createOutlinePaths(
  image: HTMLImageElement,
  displayWidth: number,
  displayHeight: number,
  outlineWidth: number,
  style: Exclude<OutlineStyle, "none">,
): VectorOutline {
  if (displayWidth <= 0 || displayHeight <= 0 || outlineWidth <= 0) {
    return { paths: [], scale: 1, padding: 0 };
  }
  const scale = Math.min(1, 960 / Math.max(displayWidth, displayHeight));
  const width = Math.max(1, Math.round(displayWidth * scale));
  const height = Math.max(1, Math.round(displayHeight * scale));
  const padding = 2;
  const canvas = document.createElement("canvas");
  canvas.width = width + padding * 2;
  canvas.height = height + padding * 2;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return { paths: [], scale, padding };
  context.drawImage(image, padding, padding, width, height);
  const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const mask = new Uint8Array(canvas.width * canvas.height);
  for (let i = 0; i < mask.length; i += 1) {
    mask[i] = rgba[i * 4 + 3] >= 128 ? 1 : 0;
  }
  const paths = vectorPathsFromMask(mask, canvas.width, canvas.height, style, outlineWidth * scale);
  // Konva scales/positions these SVG paths into document coordinates.
  return { paths, scale, padding };
}
