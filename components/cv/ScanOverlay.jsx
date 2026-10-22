import { useEffect, useRef } from 'react'
import {
  drawFaceDebugOverlay,
  getFaceBoundsFromLandmarks,
  getObjectFitCoverTransform,
  mapNormalizedPointToDisplay,
  mapSourceRectToDisplay,
} from '@/vision/faceGeometry'

function ScanOverlay({
  videoWidth,
  videoHeight,
  faceCount,
  faceFill,
  completeness,
  pose,
  quality,
  scannerState,
  canCapture,
  blockingReason,
  faceCenter,
  landmarks,
  bounds,
  positioningState,
  debugMode,
  visible,
}) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !visible || !debugMode) {
      if (canvas) {
        const context = canvas.getContext('2d')
        context?.clearRect(0, 0, canvas.width, canvas.height)
      }
      return
    }

    const context = canvas.getContext('2d')
    if (!context) return

    const displayWidth = canvas.clientWidth || videoWidth || 1280
    const displayHeight = canvas.clientHeight || videoHeight || 720
    const pixelRatio = window.devicePixelRatio || 1
    const transform = getObjectFitCoverTransform(videoWidth, videoHeight, displayWidth, displayHeight)

    canvas.width = Math.round(displayWidth * pixelRatio)
    canvas.height = Math.round(displayHeight * pixelRatio)
    canvas.style.width = `${displayWidth}px`
    canvas.style.height = `${displayHeight}px`
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    context.clearRect(0, 0, canvas.width, canvas.height)

    if (landmarks && landmarks.length > 0) {
      const sourceBounds = bounds || getFaceBoundsFromLandmarks(landmarks, videoWidth, videoHeight)
      const faceBounds = sourceBounds ? mapSourceRectToDisplay(sourceBounds, transform) : null

      if (faceBounds) {
        context.save()
        context.strokeStyle = '#38bdf8'
        context.lineWidth = 2
        context.strokeRect(faceBounds.x, faceBounds.y, faceBounds.width, faceBounds.height)
        context.restore()
      }

      drawFaceDebugOverlay(context, landmarks, {
        width: canvas.width,
        height: canvas.height,
        pointRadius: 2,
        pointColor: '#f8fafc',
        outlineColor: '#38bdf8',
        mapPoint: (point) => mapNormalizedPointToDisplay(point, transform, videoWidth, videoHeight),
      })
    }

    if (faceCenter) {
      const mappedFaceCenter = mapSourceRectToDisplay(
        { x: faceCenter.x, y: faceCenter.y, width: 0, height: 0, centerX: faceCenter.x, centerY: faceCenter.y },
        transform,
      )
      context.save()
      context.fillStyle = '#34d399'
      context.beginPath()
      context.arc(mappedFaceCenter.centerX, mappedFaceCenter.centerY, 5, 0, Math.PI * 2)
      context.fill()
      context.restore()
    }
  }, [bounds, debugMode, faceCenter, faceCount, landmarks, positioningState, videoHeight, videoWidth, visible])

  if (!visible || !debugMode) {
    return null
  }

  return (
    <>
      <canvas
        ref={canvasRef}
        className="camera-debug-canvas pointer-events-none absolute inset-0 h-full w-full"
        aria-label="Face detection debug overlay"
      />
      <div className="camera-debug-panel" aria-live="polite">
        <div>Faces: {faceCount}</div>
        <div>State: {scannerState || positioningState}</div>
        <div>Can capture: {canCapture ? 'true' : 'false'}</div>
        <div>Blocking: {blockingReason || 'READY'}</div>
        <div>Face center: {faceCenter ? `${Math.round(faceCenter.x)}, ${Math.round(faceCenter.y)}` : 'n/a'}</div>
        <div>Frame center: {videoWidth && videoHeight ? `${Math.round(videoWidth / 2)}, ${Math.round(videoHeight / 2)}` : 'n/a'}</div>
        <div>Face fill: {(faceFill * 100).toFixed(1)}%</div>
        <div>Completeness: {completeness?.isComplete ? 'PASS' : 'PARTIAL'}</div>
        <div>Yaw: {pose?.isValid ? `${pose.yaw.toFixed(1)}°` : 'n/a'}</div>
        <div>Pitch: {pose?.isValid ? `${pose.pitch.toFixed(1)}°` : 'n/a'}</div>
        <div>Roll: {pose?.isValid ? `${pose.roll.toFixed(1)}°` : 'n/a'}</div>
        <div>Pose: {pose?.state || 'LOOK_STRAIGHT'}</div>
        <div>Lighting: {quality?.lighting || 'TOO_DARK'}</div>
        <div>Mean Luma: {quality?.meanLuma?.toFixed(1) || '0.0'}</div>
        <div>Dark %: {quality ? `${(quality.darkClipPct * 100).toFixed(1)}%` : '0.0%'}</div>
        <div>Bright %: {quality ? `${(quality.brightClipPct * 100).toFixed(1)}%` : '0.0%'}</div>
        <div>Regional variation: {quality ? quality.regionalVariation.toFixed(3) : '0.000'}</div>
        <div>Glare: {quality ? `${(quality.glareRatio * 100).toFixed(1)}%` : '0.0%'}</div>
        <div>Quality score: {quality ? quality.qualityScore.toFixed(2) : '0.00'}</div>
        <div>Sharpness: {quality?.sharpnessValue?.toFixed(1) || '0.0'}</div>
        <div>Quality: {quality?.isAcceptable ? 'PASS' : 'FAIL'}</div>
      </div>
    </>
  )
}

export default ScanOverlay
