/**
 * Traces an uploaded image's alpha silhouette into vector paths.
 * Clean: antialiased, simplified Bézier outline.
 * Rough: a filled paper cutout — gaps closed, straight scissor cuts, uneven
 * border width — rendered behind the subject.
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

/** Deterministic PRNG so a cutout keeps the same shape across re-renders. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const INF = 1e20;

/** Felzenszwalb 1D squared distance transform, in place on f. */
function edt1d(f: Float64Array, n: number, d: Float64Array, v: Int32Array, z: Float64Array) {
  let k = 0;
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  for (let q = 1; q < n; q += 1) {
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k -= 1;
      s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k += 1;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q += 1) {
    while (z[k + 1] < q) k += 1;
    d[q] = (q - v[k]) ** 2 + f[v[k]];
  }
}

/** Exact squared Euclidean distance from every pixel to the nearest set pixel. */
export function squaredDistanceTo(mask: Uint8Array, width: number, height: number): Float64Array {
  const grid = new Float64Array(width * height);
  for (let i = 0; i < grid.length; i += 1) grid[i] = mask[i] ? 0 : INF;
  const size = Math.max(width, height);
  const f = new Float64Array(size);
  const d = new Float64Array(size);
  const v = new Int32Array(size);
  const z = new Float64Array(size + 1);
  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) f[y] = grid[y * width + x];
    edt1d(f, height, d, v, z);
    for (let y = 0; y < height; y += 1) grid[y * width + x] = d[y];
  }
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) f[x] = grid[y * width + x];
    edt1d(f, width, d, v, z);
    for (let x = 0; x < width; x += 1) grid[y * width + x] = d[x];
  }
  return grid;
}

/** Mark every empty pixel not reachable from the border as filled. */
function fillHoles(mask: Uint8Array, width: number, height: number): Uint8Array {
  const outside = new Uint8Array(mask.length);
  const stack: number[] = [];
  const push = (i: number) => {
    if (!mask[i] && !outside[i]) {
      outside[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < width; x += 1) {
    push(x);
    push((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    push(y * width);
    push(y * width + width - 1);
  }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % width;
    if (x > 0) push(i - 1);
    if (x < width - 1) push(i + 1);
    if (i >= width) push(i - width);
    if (i < mask.length - width) push(i + width);
  }
  const result = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i += 1) result[i] = outside[i] ? 0 : 1;
  return result;
}

/**
 * Paper silhouette: subject dilated by the border width, with narrow gaps and
 * holes closed, as if someone cut loosely around it with scissors.
 */
export function paperMask(mask: Uint8Array, width: number, height: number, outlineWidth: number): Uint8Array {
  const radius = Math.max(1, outlineWidth);
  const bridge = Math.max(4, outlineWidth * 1.6);
  const grow = radius + bridge;
  const toSubject = squaredDistanceTo(mask, width, height);
  const dilated = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i += 1) dilated[i] = toSubject[i] <= grow * grow ? 1 : 0;
  // Erode back by `bridge` (morphological closing) to fill concavities.
  const background = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i += 1) background[i] = dilated[i] ? 0 : 1;
  const toBackground = squaredDistanceTo(background, width, height);
  const closed = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i += 1) {
    closed[i] = mask[i] || toBackground[i] > bridge * bridge ? 1 : 0;
  }
  return fillHoles(closed, width, height);
}

/**
 * Turn a smooth silhouette into straight scissor cuts: uneven segment lengths,
 * sharp corners, and a border that randomly widens and narrows.
 */
export function scissorContour(points: Point[], outlineWidth: number, seed: number): Point[] {
  if (points.length < 3) return points;
  const random = mulberry32(seed);
  const orientation = Math.sign(polygonArea(points)) || 1;
  const w = Math.max(2, outlineWidth);
  const minCut = Math.max(10, w * 2.2);
  const maxCut = Math.max(24, w * 6.5);
  const cuts: Point[] = [];
  const pushJittered = (x: number, y: number, nx: number, ny: number) => {
    // Mostly outward: border gets chunkier in places, never much thinner.
    const offset = w * (-0.22 + random() * 0.72);
    cuts.push({ x: x + nx * offset, y: y + ny * offset });
  };
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const length = segmentLength(a, b);
    if (!length) continue;
    // Outward normal for this segment (y-down screen coordinates).
    const nx = -orientation * (b.y - a.y) / length;
    const ny = orientation * (b.x - a.x) / length;
    pushJittered(a.x, a.y, nx, ny);
    let travelled = minCut + random() * (maxCut - minCut);
    while (travelled < length - minCut * 0.6) {
      const t = travelled / length;
      pushJittered(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, nx, ny);
      travelled += minCut + random() * (maxCut - minCut);
    }
  }
  return cuts.length >= 3 ? cuts : points;
}

/** Straight-edged SVG polygon; scissor cuts keep sharp corners. */
export function polygonPath(points: Point[]): string {
  if (points.length < 3) return "";
  const fmt = (n: number) => Number(n.toFixed(2));
  return "M " + points.map((p) => fmt(p.x) + " " + fmt(p.y)).join(" L ") + " Z";
}

/** Filled paper-cutout shapes placed behind the subject. */
export function cutoutPathsFromMask(
  mask: Uint8Array,
  width: number,
  height: number,
  outlineWidth: number,
): string[] {
  const paper = paperMask(mask, width, height, outlineWidth);
  const minArea = Math.max(24, outlineWidth * outlineWidth * 3);
  const result: string[] = [];
  traceContours(paper, width, height).forEach((loop, index) => {
    if (Math.abs(polygonArea(loop)) < minArea) return;
    const simplified = simplifyContour(loop, Math.max(1.5, outlineWidth * 0.3));
    if (simplified.length < 3) return;
    const seed = 0x5eed + index * 7919 + loop.length;
    const path = polygonPath(scissorContour(simplified, outlineWidth, seed));
    if (path) result.push(path);
  });
  return result;
}

export function vectorPathsFromMask(
  mask: Uint8Array,
  width: number,
  height: number,
  style: Exclude<OutlineStyle, "none">,
  outlineWidth: number,
): string[] {
  if (style === "rough") return cutoutPathsFromMask(mask, width, height, outlineWidth);
  const result: string[] = [];
  traceContours(mask, width, height).forEach((loop) => {
    const simplified = simplifyContour(loop, 1.3);
    if (simplified.length < 3) return;
    const path = curvePath(simplified, 2.2);
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
  // Rough cutouts grow beyond the subject, so leave room for the paper edge.
  const padding = style === "rough" ? Math.ceil(outlineWidth * scale * 1.8) + 4 : 2;
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
