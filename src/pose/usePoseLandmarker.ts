import { useCallback, useEffect, useRef, useState } from 'react'
import {
  FilesetResolver,
  PoseLandmarker,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision'

/**
 * Owns the real-time pose pipeline: MediaPipe init, webcam stream, and the
 * requestAnimationFrame detect loop.
 *
 * Per-frame landmarks are intentionally NOT React state — that would trigger a
 * re-render ~30x/sec. Instead each frame is pushed to the caller via
 * `onFrame`, and the caller draws / feeds the coaching pipeline imperatively.
 * Only the coarse lifecycle `status` lives in state.
 */

/** WASM binaries + model are loaded from the MediaPipe CDN for v1. The webcam
 * video stream never leaves the device — only these static assets are fetched.
 * A later hardening step can self-host these under public/. */
const WASM_BASE =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task'

export type PoseStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface PoseFrame {
  /** Landmarks for the first detected pose, or null if none this frame. */
  landmarks: NormalizedLandmark[] | null
  /** Frame timestamp (ms) passed to MediaPipe. */
  timestamp: number
}

export interface UsePoseLandmarkerOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>
  /** Called once per detected frame. Keep it cheap — runs in the RAF loop. */
  onFrame: (frame: PoseFrame) => void
}

export interface UsePoseLandmarker {
  status: PoseStatus
  error: string | null
  /** Request camera access and begin the detect loop. */
  start: () => Promise<void>
  /** Stop the loop and release the camera. */
  stop: () => void
}

export function usePoseLandmarker({
  videoRef,
  onFrame,
}: UsePoseLandmarkerOptions): UsePoseLandmarker {
  const [status, setStatus] = useState<PoseStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const landmarkerRef = useRef<PoseLandmarker | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  // Timestamp of the last frame handed to detectForVideo; MediaPipe requires
  // strictly increasing timestamps and rejects a repeated frame.
  const lastVideoTimeRef = useRef(-1)

  // Keep onFrame in a ref so the RAF loop always calls the latest closure
  // without needing to restart on every render.
  const onFrameRef = useRef(onFrame)
  useEffect(() => {
    onFrameRef.current = onFrame
  }, [onFrame])

  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    const video = videoRef.current
    if (video) video.srcObject = null
    setStatus((s) => (s === 'error' ? s : 'idle'))
  }, [videoRef])

  const start = useCallback(async () => {
    const video = videoRef.current
    if (!video) return

    setStatus('loading')
    setError(null)

    try {
      // Lazily create the landmarker once; reuse across start/stop cycles.
      if (!landmarkerRef.current) {
        const fileset = await FilesetResolver.forVisionTasks(WASM_BASE)
        landmarkerRef.current = await PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
          runningMode: 'VIDEO',
          numPoses: 1,
        })
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: false,
      })
      streamRef.current = stream
      video.srcObject = stream
      await video.play()

      setStatus('ready')

      const loop = () => {
        const landmarker = landmarkerRef.current
        if (!landmarker || !streamRef.current) return

        // Only run detection when the video has advanced to a new frame.
        if (video.currentTime !== lastVideoTimeRef.current) {
          lastVideoTimeRef.current = video.currentTime
          const timestamp = performance.now()
          const result = landmarker.detectForVideo(video, timestamp)
          onFrameRef.current({
            landmarks: result.landmarks[0] ?? null,
            timestamp,
          })
        }
        rafRef.current = requestAnimationFrame(loop)
      }
      rafRef.current = requestAnimationFrame(loop)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      setStatus('error')
      stop()
    }
  }, [videoRef, stop])

  // Release camera + RAF on unmount. The landmarker itself is left for GC.
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  return { status, error, start, stop }
}
