import { useCallback, useEffect, useRef } from 'react'
import { DrawingUtils, PoseLandmarker } from '@mediapipe/tasks-vision'
import {
  usePoseLandmarker,
  type PoseFrame,
} from '../pose/usePoseLandmarker'

/**
 * Webcam view with a skeleton overlay. This is roadmap step 1: prove
 * MediaPipe tracks the body at a usable framerate before layering on rep
 * counting and coaching.
 *
 * A `<video>` shows the mirrored camera feed; a `<canvas>` sits on top and
 * draws the detected pose each frame. Both are mirrored so the overlay lines
 * up with the selfie-view video.
 */

interface CameraViewProps {
  /** Receives every detected frame, for downstream coaching (later steps). */
  onFrame?: (frame: PoseFrame) => void
}

export function CameraView({ onFrame }: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef<DrawingUtils | null>(null)

  const handleFrame = useCallback(
    (frame: PoseFrame) => {
      const canvas = canvasRef.current
      const video = videoRef.current
      if (!canvas || !video) return

      // Match the canvas backing store to the actual video resolution so the
      // normalized landmark coords map to pixels correctly.
      if (
        canvas.width !== video.videoWidth ||
        canvas.height !== video.videoHeight
      ) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
      }

      const ctx = canvas.getContext('2d')
      if (!ctx) return
      if (!drawingRef.current) drawingRef.current = new DrawingUtils(ctx)

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      if (frame.landmarks) {
        drawingRef.current.drawConnectors(
          frame.landmarks,
          PoseLandmarker.POSE_CONNECTIONS,
          { color: '#c084fc', lineWidth: 3 },
        )
        drawingRef.current.drawLandmarks(frame.landmarks, {
          color: '#aa3bff',
          radius: 4,
        })
      }

      onFrame?.(frame)
    },
    [onFrame],
  )

  const { status, error, start, stop } = usePoseLandmarker({
    videoRef,
    onFrame: handleFrame,
  })

  // Reset the drawing context if the canvas element changes across mounts.
  useEffect(() => {
    return () => {
      drawingRef.current = null
    }
  }, [])

  return (
    <div className="camera">
      <div className="camera__stage">
        <video ref={videoRef} className="camera__video" playsInline muted />
        <canvas ref={canvasRef} className="camera__overlay" />

        {status !== 'ready' && (
          <div className="camera__placeholder">
            {status === 'idle' && <p>Camera is off.</p>}
            {status === 'loading' && <p>Starting camera & loading model…</p>}
            {status === 'error' && (
              <p className="camera__error">
                Couldn’t start the camera: {error}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="camera__controls">
        {status === 'ready' ? (
          <button type="button" onClick={stop}>
            Stop camera
          </button>
        ) : (
          <button
            type="button"
            onClick={start}
            disabled={status === 'loading'}
          >
            {status === 'loading' ? 'Starting…' : 'Start camera'}
          </button>
        )}
      </div>
    </div>
  )
}
