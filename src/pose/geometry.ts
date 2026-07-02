/**
 * Pure geometry helpers over pose landmarks.
 *
 * The fundamental primitive of the whole app is the 3-point joint angle
 * (the angle at joint B formed by points A-B-C). Everything downstream —
 * rep counting, form rules — is geometry on the 33 landmarks, so these
 * functions are deliberately dependency-free and unit-testable.
 */

/** Minimal shape we need from a landmark; MediaPipe's NormalizedLandmark satisfies it. */
export interface Point {
  x: number
  y: number
  z?: number
}

/** Euclidean distance in the 2D image plane (x, y are normalized 0..1). */
export function distance(a: Point, b: Point): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.hypot(dx, dy)
}

/**
 * The angle in degrees at joint `b`, formed by the segments b→a and b→c.
 *
 * Computed in the 2D image plane (z is ignored) since that's what the form
 * rules reason about. Returns a value in [0, 180]. Returns NaN if either
 * segment has zero length (degenerate — coincident points).
 */
export function angle(a: Point, b: Point, c: Point): number {
  const baX = a.x - b.x
  const baY = a.y - b.y
  const bcX = c.x - b.x
  const bcY = c.y - b.y

  const magBa = Math.hypot(baX, baY)
  const magBc = Math.hypot(bcX, bcY)
  if (magBa === 0 || magBc === 0) return NaN

  const dot = baX * bcX + baY * bcY
  // Clamp guards against tiny floating-point overshoot outside [-1, 1].
  const cosine = Math.min(1, Math.max(-1, dot / (magBa * magBc)))
  return (Math.acos(cosine) * 180) / Math.PI
}
