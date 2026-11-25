/**
 * MeshBuilder helpers for fuzzy ridged pipe-cleaner strands (no custom shaders).
 */

export type Vec3 = [number, number, number]
export type Color4 = [number, number, number, number]

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]
}

export function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

export function pathLength(pts: Vec3[]): number {
  let len = 0
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0]
    const dy = pts[i][1] - pts[i - 1][1]
    const dz = pts[i][2] - pts[i - 1][2]
    len += Math.hypot(dx, dy, dz)
  }
  return len
}

/** Resample a polyline to exactly `count` points, evenly by arc length. */
export function resamplePath(pts: Vec3[], count: number): Vec3[] {
  if (pts.length === 0) return []
  if (pts.length === 1 || count <= 1) {
    const out: Vec3[] = []
    for (let i = 0; i < count; i++) out.push([...pts[0]] as Vec3)
    return out
  }
  const segLens: number[] = [0]
  let total = 0
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(
      pts[i][0] - pts[i - 1][0],
      pts[i][1] - pts[i - 1][1],
      pts[i][2] - pts[i - 1][2],
    )
    total += d
    segLens.push(total)
  }
  if (total < 1e-6) {
    const out: Vec3[] = []
    for (let i = 0; i < count; i++) out.push([...pts[0]] as Vec3)
    return out
  }
  const out: Vec3[] = []
  for (let i = 0; i < count; i++) {
    const target = (i / (count - 1)) * total
    let s = 1
    while (s < segLens.length && segLens[s] < target) s++
    const s0 = s - 1
    const span = segLens[s] - segLens[s0] || 1
    const u = (target - segLens[s0]) / span
    out.push(lerpVec3(pts[s0], pts[s], u))
  }
  return out
}

export function morphPaths(a: Vec3[], b: Vec3[], t: number, count: number): Vec3[] {
  const A = resamplePath(a, count)
  const B = resamplePath(b, count)
  const out: Vec3[] = []
  for (let i = 0; i < count; i++) out.push(lerpVec3(A[i], B[i], t))
  return out
}

/** Tight coil along +Y (legacy / later steps). */
export function makeCoilPath(centerX: number, centerZ: number, height: number, turns: number, coilR: number, samples: number): Vec3[] {
  const pts: Vec3[] = []
  for (let i = 0; i < samples; i++) {
    const u = i / (samples - 1)
    const ang = u * turns * Math.PI * 2
    pts.push([
      centerX + Math.cos(ang) * coilR,
      -height * 0.5 + u * height,
      centerZ + Math.sin(ang) * coilR,
    ])
  }
  return pts
}

/** Wavy ridged strand ~20 cm along +Y (legacy / later steps). */
export function makeStretchedPath(centerX: number, centerZ: number, length: number, samples: number, phase: number): Vec3[] {
  const pts: Vec3[] = []
  for (let i = 0; i < samples; i++) {
    const u = i / (samples - 1)
    const y = -length * 0.5 + u * length
    const wave = Math.sin(u * Math.PI * 10 + phase) * 0.45
    const wave2 = Math.cos(u * Math.PI * 6 + phase * 0.7) * 0.25
    pts.push([centerX + wave, y, centerZ + wave2])
  }
  return pts
}

/**
 * Horizontal coil along +X, level, facing the viewer (spiral in YZ).
 * Left end is fixed at leftX — stretch grows to the right.
 */
export function makeHorizontalCoil(
  leftX: number,
  length: number,
  turns: number,
  radius: number,
  samples: number,
  zOffset: number = 0,
): Vec3[] {
  const pts: Vec3[] = []
  for (let i = 0; i < samples; i++) {
    const u = i / (samples - 1)
    const ang = u * turns * Math.PI * 2
    pts.push([
      leftX + u * length,
      Math.cos(ang) * radius,
      zOffset + Math.sin(ang) * radius,
    ])
  }
  return pts
}

// ---- Reference wrap geometry (from reference/coil-and-stretch.html), units cm ----
/** 0.5 inch tail */
export const WRAP_TAIL = 1.27
export const WRAP_TURNS = 8
export const WRAP_PITCH = 0.65
/** Finished coil length along X (= turns * pitch) */
export const WRAP_COIL_LEN = WRAP_TURNS * WRAP_PITCH
const WRAP_SPAN = 30 - 2 * WRAP_TAIL
/** Helix radius so turns sit side-by-side along the stick */
export const WRAP_COIL_R = Math.sqrt((WRAP_SPAN / WRAP_TURNS) ** 2 - WRAP_PITCH ** 2) / (2 * Math.PI)
export const WRAP_WIRE = 0.3

export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

/** Smoothstep ease from the HTML reference */
export function easeSmooth(v: number): number {
  v = clamp01(v)
  return v * v * (3 - 2 * v)
}

/** Helix along +X; origin at left of coil (x=0..len). */
export function helixPoint(u: number, len: number, r: number, turns: number = WRAP_TURNS): Vec3 {
  const a = u * turns * 2 * Math.PI
  return [u * len, r * Math.cos(a), r * Math.sin(a)]
}

/**
 * Step 1 wrap path from the HTML `wrapPoints(p)`.
 * p 0..1 wraps. Left 0.5" tail held still; loose end hangs, then becomes right 0.5" tail.
 * `originX` shifts so coil sits at [originX, originX+COIL] (use -COIL/2 to center).
 * `zOffset` added to every z (Lens stage depth).
 */
export function wrapPoints(p: number, originX: number = 0, zOffset: number = 0): Vec3[] {
  p = clamp01(p)
  const pts: Vec3[] = []
  const start = helixPoint(0, WRAP_COIL_LEN, WRAP_COIL_R)
  // Left tail held still (0.5 in)
  for (let i = 60; i > 0; i--) {
    pts.push([originX + start[0] - (WRAP_TAIL * i) / 60, start[1], zOffset + 0])
  }
  // Wrapped helix 0..p
  for (let i = 0; i <= 500; i++) {
    const u = (p * i) / 500
    const h = helixPoint(u, WRAP_COIL_LEN, WRAP_COIL_R)
    pts.push([originX + h[0], h[1], zOffset + h[2]])
  }
  // Loose end → right tail
  const e = helixPoint(p, WRAP_COIL_LEN, WRAP_COIL_R)
  const left = WRAP_SPAN * (1 - p) + WRAP_TAIL
  const k = easeSmooth((p - 0.85) / 0.15)
  for (let i = 1; i <= 100; i++) {
    const d = (left * i) / 100
    pts.push([
      originX + e[0] + d * (0.45 + 0.55 * k),
      e[1] - d * 0.24 * clamp01(d) * (1 - k),
      zOffset + e[2] * (1 - clamp01(d / 0.5)),
    ])
  }
  return pts
}

/** Stick path for step 1 — slides right as `off` 0..1 (HTML: -2+off*10 + u*11). */
export function wrapStickPoints(off: number, originX: number = 0, zOffset: number = 0): Vec3[] {
  off = clamp01(off)
  const pts: Vec3[] = []
  for (let i = 0; i <= 200; i++) {
    const u = i / 200
    pts.push([originX + -2 + off * 10 + u * 11, 0, zOffset])
  }
  return pts
}

/** Finished wrap coil helix only (no tails) — must match step 2 start coil. */
export function finishedWrapCoil(originX: number = 0, zOffset: number = 0): Vec3[] {
  const pts: Vec3[] = []
  for (let i = 0; i <= 500; i++) {
    const h = helixPoint(i / 500, WRAP_COIL_LEN, WRAP_COIL_R)
    pts.push([originX + h[0], h[1], zOffset + h[2]])
  }
  return pts
}

/**
 * Stretch a horizontal coil: left end fixed, length grows, radius shrinks,
 * same turn count spreads evenly → ridged stick. `t` in [0,1].
 */
export function makeStretchingHorizontalCoil(
  t: number,
  leftX: number,
  startLen: number,
  endLen: number,
  turns: number,
  startR: number,
  endR: number,
  samples: number,
  zOffset: number = 0,
): Vec3[] {
  const length = lerp(startLen, endLen, t)
  // Keep a tiny ridge amplitude even when "straight" so it reads as pipe-cleaner
  const radius = lerp(startR, endR, t)
  const ridge = lerp(0.05, 0.22, t) // ridges become more visible as turns open
  const pts: Vec3[] = []
  for (let i = 0; i < samples; i++) {
    const u = i / (samples - 1)
    const ang = u * turns * Math.PI * 2
    const r = radius + Math.sin(ang) * ridge * radius
    pts.push([
      leftX + u * length,
      Math.cos(ang) * r,
      zOffset + Math.sin(ang) * r,
    ])
  }
  return pts
}

// ---- Step 3 twist (from reference/coil-and-stretch.html) ----
export const TWIST_STRETCHED = 20
export const TWIST_LEN = TWIST_STRETCHED + 2 * WRAP_TAIL // full strand with 0.5 in tails
export const TWIST_W = 4.5
export const TWIST_APART = 1.7
export const TWIST_CONTACT = 0.32
/** Ridge radius matching a finished stretched stick (HTML END_R; readable, not physical). */
export const TWIST_END_R = 0.12

/**
 * Two equal stretched strands, no offset. `side` is +1 or -1.
 * `cross` 0..1 brings them together; `twist` 0..1 = exactly 2 full turns at the middle.
 * Centered on x=0. Outer ends stay free (apart outside the twist window).
 */
export function twistPoints(
  side: number,
  cross: number,
  twist: number,
  zOffset: number = 0,
  endR: number = TWIST_END_R,
  turns: number = WRAP_TURNS,
): Vec3[] {
  cross = clamp01(cross)
  twist = clamp01(twist)
  const total = Math.PI * cross + 4 * Math.PI * twist
  const mid = TWIST_APART + (TWIST_CONTACT - TWIST_APART) * cross
  const pts: Vec3[] = []
  for (let i = 0; i <= 700; i++) {
    const x = -TWIST_LEN / 2 + (TWIST_LEN * i) / 700
    const u = clamp01((x + TWIST_W / 2) / TWIST_W)
    const a = total * u
    const d = side * (mid + (TWIST_APART - mid) * easeSmooth((Math.abs(x) - TWIST_W / 2) / 3))
    const c = clamp01((x + TWIST_STRETCHED / 2) / TWIST_STRETCHED)
    const b = c * turns * 2 * Math.PI
    const rip = c > 0 && c < 1 ? endR : 0 // stretched-coil ripple
    pts.push([
      x,
      d * Math.cos(a) + rip * (Math.cos(b) - 1),
      zOffset + d * Math.sin(a) + rip * Math.sin(b),
    ])
  }
  return pts
}

// ---- Step 4 fold (from reference/coil-and-stretch.html) ----
export const FOLD_BEND = 1.2

/**
 * Starts from finished twist (cross=1, twist=1). `f` 0..1 bends both halves down at the middle;
 * `pinch` 0..1 squeezes the top. Middle (x=0) becomes the top of the fold.
 */
export function foldPoints(side: number, f: number, pinch: number, zOffset: number = 0): Vec3[] {
  f = clamp01(f)
  pinch = clamp01(pinch)
  const src = twistPoints(side, 1, 1, 0)
  const n = src.length - 1
  const mid = n / 2
  const ds = TWIST_LEN / n
  const angle = (x: number): number => {
    const lim = (Math.PI * FOLD_BEND) / 2
    const t = Math.max(-1, Math.min(1, x / lim))
    return (-f * Math.PI) / 2 * t
  }
  const line: Array<[number, number] | undefined> = []
  line[mid] = [0, 0]
  for (const dir of [1, -1]) {
    for (let i = mid + dir; i >= 0 && i <= n; i += dir) {
      const a = angle((i - dir / 2 - mid) * ds)
      const q = line[i - dir]!
      line[i] = [q[0] + dir * ds * Math.cos(a), q[1] + dir * ds * Math.sin(a)]
    }
  }
  const out: Vec3[] = []
  for (let i = 0; i <= n; i++) {
    const x = src[i][0]
    const a = angle(x)
    const squeeze = 1 - 0.45 * pinch * clamp01(1 - (Math.abs(x) - 1) / 2.5)
    const off = src[i][1] * (1 - 0.68 * f) * squeeze
    const L = line[i]!
    out.push([L[0] * squeeze - off * Math.sin(a), L[1] + off * Math.cos(a), zOffset + src[i][2] * squeeze])
  }
  return out
}

// ---- Step 5 spiral / rope (from reference/coil-and-stretch.html) ----
export const ROPE_R = 0.42
export const ROPE_TURNS = 3.5
export const HANG = TWIST_LEN / 2 - 1

/**
 * Starts from pinched fold. `w` 0..1 winds all four hanging ends into one rope, top to bottom.
 * ASSUMPTION (from HTML): all four ends are twisted around each other together.
 */
export function spiralPoints(side: number, w: number, zOffset: number = 0): Vec3[] {
  w = clamp01(w)
  const src = foldPoints(side, 1, 1, 0)
  const mid = (src.length - 1) / 2
  const front = w * (HANG + 1.8)
  const turn = (d: number): number => (2 * Math.PI * ROPE_TURNS * Math.min(d, HANG)) / HANG
  const spin = (p: Vec3, a: number): Vec3 => [
    p[0] * Math.cos(a) - p[2] * Math.sin(a),
    p[1],
    p[0] * Math.sin(a) + p[2] * Math.cos(a),
  ]
  return src.map((q, i) => {
    const depth = Math.max(0, -q[1])
    const k = easeSmooth((front - depth) / 1.5)
    const phase = i <= mid ? (side > 0 ? Math.PI : Math.PI / 2) : side > 0 ? 1.5 * Math.PI : 0
    const r = ROPE_R * clamp01(depth / 0.9)
    const rope = spin([r * Math.cos(phase), q[1], r * Math.sin(phase)], turn(depth))
    const loose = spin(q, turn(Math.min(front, HANG)) * clamp01(depth / 2))
    return [loose[0] + (rope[0] - loose[0]) * k, loose[1] + (rope[1] - loose[1]) * k, zOffset + loose[2] + (rope[2] - loose[2]) * k] as Vec3
  })
}

/** Two strands crossed at origin (no offset). Legacy helper. */
export function makeCrossedPaths(length: number, samples: number): [Vec3[], Vec3[]] {
  const a: Vec3[] = []
  const b: Vec3[] = []
  for (let i = 0; i < samples; i++) {
    const u = i / (samples - 1)
    const t = (u - 0.5) * length
    a.push([t * 0.55, t * 0.35, 0])
    b.push([-t * 0.55, t * 0.35, 0])
  }
  return [a, b]
}

/** Twist two crossed strands around their midpoint `twists` times. */
export function twistPaths(a: Vec3[], b: Vec3[], twists: number, amount: number): [Vec3[], Vec3[]] {
  const mid = Math.floor(a.length / 2)
  const outA: Vec3[] = []
  const outB: Vec3[] = []
  for (let i = 0; i < a.length; i++) {
    const dist = Math.abs(i - mid) / mid
    const local = Math.max(0, 1 - dist * 2.2) * amount
    const ang = twists * Math.PI * 2 * local
    const c = Math.cos(ang)
    const s = Math.sin(ang)
    // Rotate in XZ around origin
    const ax = a[i][0] * c - a[i][2] * s
    const az = a[i][0] * s + a[i][2] * c
    const bx = b[i][0] * c - b[i][2] * s
    const bz = b[i][0] * s + b[i][2] * c
    outA.push([ax, a[i][1], az])
    outB.push([bx, b[i][1], bz])
  }
  return [outA, outB]
}

/** Fold at center: tips up become pinched tip, ends hang down. */
export function makeFoldedPaths(length: number, samples: number, pinch: number): [Vec3[], Vec3[], Vec3[], Vec3[]] {
  // Four hanging ends from a pinched tip near +Y
  const tipY = length * 0.35
  const hang = length * 0.55
  const mk = (ox: number, oz: number): Vec3[] => {
    const pts: Vec3[] = []
    for (let i = 0; i < samples; i++) {
      const u = i / (samples - 1)
      const y = tipY - u * hang
      const spread = u * 0.8
      pts.push([ox * spread, y + (1 - u) * pinch * 0.3, oz * spread])
    }
    return pts
  }
  return [mk(1.2, 0.4), mk(-1.2, 0.4), mk(0.5, -1.0), mk(-0.5, -1.0)]
}

/** Slight twist + compact into thick spiral flower head. */
export function makeSpiralHeadPath(length: number, samples: number, radius: number, turns: number): Vec3[] {
  const pts: Vec3[] = []
  for (let i = 0; i < samples; i++) {
    const u = i / (samples - 1)
    const ang = u * turns * Math.PI * 2
    const y = length * 0.35 - u * length * 0.7
    const r = radius * (0.85 + 0.15 * Math.sin(u * Math.PI * 4))
    pts.push([Math.cos(ang) * r, y, Math.sin(ang) * r])
  }
  return pts
}

export function createMeshBuilder(): MeshBuilder {
  const builder = new MeshBuilder([
    { name: "position", components: 3 },
    { name: "normal", components: 3, normalized: true },
    { name: "texture0", components: 2 },
  ])
  builder.topology = MeshTopology.Triangles
  builder.indexType = MeshIndexType.UInt16
  return builder
}

/**
 * Fuzzy ridged tube: core tube with undulating radius + short radial fiber stubs.
 */
export function buildFuzzyTube(
  curve: Vec3[],
  baseRadius: number,
  radialSegments: number,
  ridgeAmp: number,
  fiberCount: number,
): RenderMesh {
  const builder = createMeshBuilder()
  if (curve.length < 2) {
    builder.appendVerticesInterleaved([0, 0, 0, 0, 1, 0, 0, 0])
    builder.appendIndices([0, 0, 0])
    builder.updateMesh()
    return builder.getMesh()
  }

  const N = curve.length
  const T: Vec3[] = []
  for (let i = 0; i < N; i++) {
    const a = curve[Math.max(0, i - 1)]
    const b = curve[Math.min(N - 1, i + 1)]
    const t: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
    const len = Math.hypot(t[0], t[1], t[2]) || 1
    T.push([t[0] / len, t[1] / len, t[2] / len])
  }

  const ax: Vec3 = Math.abs(T[0][0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]
  const d0 = ax[0] * T[0][0] + ax[1] * T[0][1] + ax[2] * T[0][2]
  let Nf: Vec3 = [ax[0] - d0 * T[0][0], ax[1] - d0 * T[0][1], ax[2] - d0 * T[0][2]]
  let nl = Math.hypot(Nf[0], Nf[1], Nf[2]) || 1
  Nf = [Nf[0] / nl, Nf[1] / nl, Nf[2] / nl]

  const frames: { n: Vec3; b: Vec3 }[] = []
  for (let i = 0; i < N; i++) {
    if (i > 0) {
      const tp = T[i - 1]
      const tc = T[i]
      const kx = tp[1] * tc[2] - tp[2] * tc[1]
      const ky = tp[2] * tc[0] - tp[0] * tc[2]
      const kz = tp[0] * tc[1] - tp[1] * tc[0]
      const kl = Math.hypot(kx, ky, kz)
      if (kl > 1e-6) {
        const cosA = Math.max(-1, Math.min(1, tp[0] * tc[0] + tp[1] * tc[1] + tp[2] * tc[2]))
        const ang = Math.acos(cosA)
        const s = Math.sin(ang)
        const c = Math.cos(ang)
        const k: Vec3 = [kx / kl, ky / kl, kz / kl]
        const kxn: Vec3 = [k[1] * Nf[2] - k[2] * Nf[1], k[2] * Nf[0] - k[0] * Nf[2], k[0] * Nf[1] - k[1] * Nf[0]]
        const kdn = k[0] * Nf[0] + k[1] * Nf[1] + k[2] * Nf[2]
        Nf = [
          Nf[0] * c + kxn[0] * s + k[0] * kdn * (1 - c),
          Nf[1] * c + kxn[1] * s + k[1] * kdn * (1 - c),
          Nf[2] * c + kxn[2] * s + k[2] * kdn * (1 - c),
        ]
      }
    }
    const t = T[i]
    const Bf: Vec3 = [t[1] * Nf[2] - t[2] * Nf[1], t[2] * Nf[0] - t[0] * Nf[2], t[0] * Nf[1] - t[1] * Nf[0]]
    frames.push({ n: [...Nf] as Vec3, b: Bf })
  }

  const R = radialSegments + 1
  let vi = 0
  const startIdx = 0
  for (let i = 0; i < N; i++) {
    const p = curve[i]
    const { n, b } = frames[i]
    const ridge = 1 + ridgeAmp * Math.sin((i / (N - 1)) * Math.PI * 14)
    const radius = baseRadius * ridge
    for (let j = 0; j < R; j++) {
      const th = (j / radialSegments) * Math.PI * 2
      const c = Math.cos(th)
      const s = Math.sin(th)
      const nx = n[0] * c + b[0] * s
      const ny = n[1] * c + b[1] * s
      const nz = n[2] * c + b[2] * s
      builder.appendVerticesInterleaved([
        p[0] + nx * radius,
        p[1] + ny * radius,
        p[2] + nz * radius,
        nx,
        ny,
        nz,
        j / radialSegments,
        i / (N - 1),
      ])
      vi++
    }
  }

  const indices: number[] = []
  for (let i = 0; i < N - 1; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const bl = startIdx + i * R + j
      const br = startIdx + i * R + (j + 1)
      const tl = startIdx + (i + 1) * R + j
      const tr = startIdx + (i + 1) * R + (j + 1)
      indices.push(bl, br, tr, bl, tr, tl)
    }
  }

  // Fuzzy stubs: short radial spikes along the path
  const fiberR = Math.max(3, Math.floor(radialSegments * 0.5))
  const step = Math.max(1, Math.floor(N / Math.max(1, fiberCount)))
  for (let i = 0; i < N; i += step) {
    const p = curve[i]
    const { n, b } = frames[i]
    const ridge = 1 + ridgeAmp * Math.sin((i / (N - 1)) * Math.PI * 14)
    const base = baseRadius * ridge
    const fiberLen = baseRadius * 1.8
    for (let f = 0; f < 5; f++) {
      const th = (f / 5) * Math.PI * 2 + i * 0.37
      const c = Math.cos(th)
      const s = Math.sin(th)
      const nx = n[0] * c + b[0] * s
      const ny = n[1] * c + b[1] * s
      const nz = n[2] * c + b[2] * s
      const fiber: Vec3[] = [
        [p[0] + nx * base, p[1] + ny * base, p[2] + nz * base],
        [p[0] + nx * (base + fiberLen), p[1] + ny * (base + fiberLen), p[2] + nz * (base + fiberLen)],
      ]
      const fStart = vi
      for (let fi = 0; fi < 2; fi++) {
        for (let j = 0; j <= fiberR; j++) {
          const fth = (j / fiberR) * Math.PI * 2
          const fc = Math.cos(fth)
          const fs = Math.sin(fth)
          // Tiny tube using n/b as frame around fiber direction approx nx,ny,nz
          const fr = baseRadius * 0.18
          const px = fiber[fi][0] + (n[0] * fc + b[0] * fs) * fr
          const py = fiber[fi][1] + (n[1] * fc + b[1] * fs) * fr
          const pz = fiber[fi][2] + (n[2] * fc + b[2] * fs) * fr
          builder.appendVerticesInterleaved([px, py, pz, nx, ny, nz, fc, fi])
          vi++
        }
      }
      const fR = fiberR + 1
      for (let j = 0; j < fiberR; j++) {
        const bl = fStart + j
        const br = fStart + j + 1
        const tl = fStart + fR + j
        const tr = fStart + fR + j + 1
        indices.push(bl, br, tr, bl, tr, tl)
      }
    }
  }

  builder.appendIndices(indices)
  if (!builder.isValid()) {
    print("PipeCleanerGeom: invalid mesh")
  }
  builder.updateMesh()
  return builder.getMesh()
}

export function buildSimpleTube(curve: Vec3[], radius: number, radialSegments: number): RenderMesh {
  return buildFuzzyTube(curve, radius, radialSegments, 0, 0)
}

/** Per-point radius tube (for pointed leaf tips). No ridge/fibers. */
export function buildRadiusTube(curve: Vec3[], radii: number[], radialSegments: number): RenderMesh {
  const builder = createMeshBuilder()
  if (curve.length < 2) {
    builder.appendVerticesInterleaved([0, 0, 0, 0, 1, 0, 0, 0])
    builder.appendIndices([0, 0, 0])
    builder.updateMesh()
    return builder.getMesh()
  }
  const N = curve.length
  const T: Vec3[] = []
  for (let i = 0; i < N; i++) {
    const a = curve[Math.max(0, i - 1)]
    const b = curve[Math.min(N - 1, i + 1)]
    const t: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
    const len = Math.hypot(t[0], t[1], t[2]) || 1
    T.push([t[0] / len, t[1] / len, t[2] / len])
  }
  const ax: Vec3 = Math.abs(T[0][0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]
  const d0 = ax[0] * T[0][0] + ax[1] * T[0][1] + ax[2] * T[0][2]
  let Nf: Vec3 = [ax[0] - d0 * T[0][0], ax[1] - d0 * T[0][1], ax[2] - d0 * T[0][2]]
  let nl = Math.hypot(Nf[0], Nf[1], Nf[2]) || 1
  Nf = [Nf[0] / nl, Nf[1] / nl, Nf[2] / nl]
  const frames: { n: Vec3; b: Vec3 }[] = []
  for (let i = 0; i < N; i++) {
    if (i > 0) {
      const tp = T[i - 1]
      const tc = T[i]
      const kx = tp[1] * tc[2] - tp[2] * tc[1]
      const ky = tp[2] * tc[0] - tp[0] * tc[2]
      const kz = tp[0] * tc[1] - tp[1] * tc[0]
      const kl = Math.hypot(kx, ky, kz)
      if (kl > 1e-6) {
        const cosA = Math.max(-1, Math.min(1, tp[0] * tc[0] + tp[1] * tc[1] + tp[2] * tc[2]))
        const ang = Math.acos(cosA)
        const s = Math.sin(ang)
        const c = Math.cos(ang)
        const k: Vec3 = [kx / kl, ky / kl, kz / kl]
        const kxn: Vec3 = [k[1] * Nf[2] - k[2] * Nf[1], k[2] * Nf[0] - k[0] * Nf[2], k[0] * Nf[1] - k[1] * Nf[0]]
        const kdn = k[0] * Nf[0] + k[1] * Nf[1] + k[2] * Nf[2]
        Nf = [
          Nf[0] * c + kxn[0] * s + k[0] * kdn * (1 - c),
          Nf[1] * c + kxn[1] * s + k[1] * kdn * (1 - c),
          Nf[2] * c + kxn[2] * s + k[2] * kdn * (1 - c),
        ]
      }
    }
    const t = T[i]
    frames.push({
      n: [...Nf] as Vec3,
      b: [t[1] * Nf[2] - t[2] * Nf[1], t[2] * Nf[0] - t[0] * Nf[2], t[0] * Nf[1] - t[1] * Nf[0]],
    })
  }
  const R = radialSegments + 1
  for (let i = 0; i < N; i++) {
    const p = curve[i]
    const { n, b } = frames[i]
    const radius = radii[Math.min(i, radii.length - 1)]
    for (let j = 0; j < R; j++) {
      const th = (j / radialSegments) * Math.PI * 2
      const c = Math.cos(th)
      const s = Math.sin(th)
      const nx = n[0] * c + b[0] * s
      const ny = n[1] * c + b[1] * s
      const nz = n[2] * c + b[2] * s
      builder.appendVerticesInterleaved([p[0] + nx * radius, p[1] + ny * radius, p[2] + nz * radius, nx, ny, nz, j / radialSegments, i / (N - 1)])
    }
  }
  const indices: number[] = []
  for (let i = 0; i < N - 1; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const bl = i * R + j
      const br = i * R + j + 1
      const tl = (i + 1) * R + j
      const tr = (i + 1) * R + j + 1
      indices.push(bl, br, tr, bl, tr, tl)
    }
  }
  builder.appendIndices(indices)
  builder.updateMesh()
  return builder.getMesh()
}

// ---- Steps 6–8: leaves, stem wire (bare), hot glue (no floral tape) ----
export const LEAF_LEN = 15
export const JOIN = -HANG + 1.3
export const WIRE_END = -HANG - 16
export const LEAF_BASE_R = 0.375 // HTML stroke 0.75 / 2

export function line3(a: Vec3, b: Vec3, n: number = 80): Vec3[] {
  const pts: Vec3[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t])
  }
  return pts
}

/** Straight leaf from base along angle (radians from +Y). trim 0..1 sharpens the tip. */
export function leafPoints(base: Vec3, angle: number): Vec3[] {
  const tip: Vec3 = [base[0] + LEAF_LEN * Math.sin(angle), base[1] + LEAF_LEN * Math.cos(angle), base[2]]
  return line3(base, tip, 80)
}

/** Per-point radii matching HTML leafSegments tip taper. */
export function leafRadii(trim: number): number[] {
  trim = clamp01(trim)
  const radii: number[] = []
  for (let i = 0; i <= 80; i++) {
    const taper = clamp01((i - 62) / 18)
    radii.push(LEAF_BASE_R * (1 - 0.85 * trim * taper))
  }
  return radii
}

export function buildLeafMesh(base: Vec3, angle: number, trim: number): RenderMesh {
  return buildRadiusTube(leafPoints(base, angle), leafRadii(trim), 6)
}

/** Bare stem wire from JOIN down to WIRE_END. */
export function stemWirePoints(zOffset: number = 0): Vec3[] {
  return line3([0, JOIN, zOffset - 0.2], [0, WIRE_END, zOffset - 0.2], 120)
}

/** Finished step-5 flower head (both strands), optionally shifted in x. */
export function finishedHeadPaths(dx: number = 0, zOffset: number = 0): [Vec3[], Vec3[]] {
  const a = spiralPoints(1, 1, 0).map((p) => [p[0] + dx, p[1], p[2] + zOffset] as Vec3)
  const b = spiralPoints(-1, 1, 0).map((p) => [p[0] + dx, p[1], p[2] + zOffset] as Vec3)
  return [a, b]
}
