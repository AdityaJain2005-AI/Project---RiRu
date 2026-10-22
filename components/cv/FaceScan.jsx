import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useCamera } from '@/vision/hooks/useCamera'
import { useFaceLandmarker } from '@/vision/hooks/useFaceLandmarker'
import { useFacePose } from '@/vision/hooks/useFacePose'
import { useFacePositioning } from '@/vision/hooks/useFacePositioning'
import { useImageQuality } from '@/vision/hooks/useImageQuality'
import { useMultiAngleScan } from '@/vision/hooks/useMultiAngleScan'
import { analyzeSkinSignals } from '@/vision/skinSignals'
import ScanOverlay from './ScanOverlay'
import ScanProgress from './ScanProgress'
import { getYawCorrection, MULTI_ANGLE_STATES } from '@/vision/multiAngle'
import { POSE_STATES } from '@/vision/pose'
import { getFaceFill, getScannerValidation, POSITIONING_STATES } from '@/vision/positioning'
import { QUALITY_STATES } from '@/vision/quality'
import { prepareCapturedFrame } from '@/vision/camera'
import './Camera.css'

function FaceScan({ onScanSessionChange }) {
  const { videoRef, status, error, facingMode, toggleFacingMode, startCamera, isStreaming } = useCamera()
  const cameraScreenRef = useRef(null)
  const guideRef = useRef(null)
  const [debugMode, setDebugMode] = useState(process.env.NODE_ENV === 'development')
  const [cameraLayout, setCameraLayout] = useState({ width: 1, height: 1, guideDiameter: 1 })
  const [faceAnalysis, setFaceAnalysis] = useState({
    faceCount: 0,
    frameWidth: 1,
    frameHeight: 1,
    landmarks: null,
    bounds: null,
    completeness: null,
  })

  useFaceLandmarker({
    videoRef,
    enabled: isStreaming,
    onFaceResults: setFaceAnalysis,
  })

  useEffect(() => {
    if (!isStreaming || !cameraScreenRef.current || !guideRef.current) return undefined

    const measureLayout = () => {
      const screenRect = cameraScreenRef.current?.getBoundingClientRect()
      const guideRect = guideRef.current?.getBoundingClientRect()
      if (!screenRect || !guideRect) return

      setCameraLayout({
        width: screenRect.width,
        height: screenRect.height,
        guideDiameter: Math.min(guideRect.width, guideRect.height),
      })
    }

    measureLayout()
    const resizeObserver = new ResizeObserver(measureLayout)
    resizeObserver.observe(cameraScreenRef.current)
    resizeObserver.observe(guideRef.current)

    return () => resizeObserver.disconnect()
  }, [isStreaming])

  const faceFill = useMemo(() => getFaceFill(faceAnalysis.bounds, {
    frameWidth: faceAnalysis.frameWidth,
    frameHeight: faceAnalysis.frameHeight,
    displayWidth: cameraLayout.width,
    displayHeight: cameraLayout.height,
    guideDiameter: cameraLayout.guideDiameter,
  }), [cameraLayout, faceAnalysis.bounds, faceAnalysis.frameHeight, faceAnalysis.frameWidth])

  const positioningState = useFacePositioning({ ...faceAnalysis, faceFill })
  const pose = useFacePose(faceAnalysis.landmarks)
  const quality = useImageQuality(videoRef, faceAnalysis.landmarks, isStreaming)
  const scannerValidation = getScannerValidation({
    faceCount: faceAnalysis.faceCount,
    positioningState,
    completeness: faceAnalysis.completeness,
    pose,
    quality,
    requireFrontalPose: false,
  })

  const captureFrame = useCallback(async (view) => {
    const video = videoRef.current
    if (!video || video.readyState < 2) throw new Error('Camera frame is not ready.')

    const canvas = document.createElement('canvas')
    const width = video.videoWidth || 1280
    const height = video.videoHeight || 720
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    context?.drawImage(video, 0, 0, width, height)
    const { file } = await prepareCapturedFrame(canvas)

    return {
      view: view.toLowerCase(),
      image: file,
      yaw: pose.yaw,
      pitch: pose.pitch,
      roll: pose.roll,
      qualityScore: quality.qualityScore,
      skinSignals: analyzeSkinSignals(context, faceAnalysis.bounds),
      timestamp: Date.now(),
    }
  }, [faceAnalysis.bounds, pose.pitch, pose.roll, pose.yaw, quality.qualityScore, videoRef])

  const multiAngleScan = useMultiAngleScan({
    scannerValidation,
    pose,
    captureFrame,
    faceCount: faceAnalysis.faceCount,
  })
  const { frontImage, leftImage, rightImage } = multiAngleScan.session

  useEffect(() => {
    onScanSessionChange?.({
      session: { frontImage, leftImage, rightImage },
      views: multiAngleScan.views,
      isComplete: multiAngleScan.requiredView === MULTI_ANGLE_STATES.COMPLETE,
      retake: multiAngleScan.retake,
    })
  }, [frontImage, leftImage, multiAngleScan.requiredView, multiAngleScan.retake, multiAngleScan.views, onScanSessionChange, rightImage])

  const primaryInstruction = useMemo(() => {
    const messages = {
      [POSITIONING_STATES.NO_FACE]: 'Position your face inside the guide',
      [POSITIONING_STATES.MULTIPLE_FACES]: 'Only one person should be in the frame',
      [POSITIONING_STATES.MOVE_CLOSER]: 'Move closer',
      [POSITIONING_STATES.MOVE_BACK]: 'Move back',
      [POSITIONING_STATES.MOVE_LEFT]: 'Move left',
      [POSITIONING_STATES.MOVE_RIGHT]: 'Move right',
      [POSITIONING_STATES.MOVE_UP]: 'Move up',
      [POSITIONING_STATES.MOVE_DOWN]: 'Move down',
      [POSITIONING_STATES.FACE_PARTIALLY_OBSTRUCTED]: 'Keep your face fully visible',
      [POSITIONING_STATES.POSITION_OK]: 'Look straight at the camera',
      [QUALITY_STATES.TOO_DARK]: 'Move to better lighting',
      [QUALITY_STATES.TOO_BRIGHT]: 'Avoid harsh/direct light',
      [QUALITY_STATES.UNEVEN]: 'Try to face a more even light',
      [QUALITY_STATES.GLARE]: 'Reduce glare and direct light',
      [QUALITY_STATES.TOO_BLURRY]: 'Hold your phone steady',
    }

    const poseMessages = {
      [POSE_STATES.LOOK_STRAIGHT]: 'Look straight at the camera',
      [POSE_STATES.TURN_LEFT]: 'Turn your face slightly left',
      [POSE_STATES.TURN_RIGHT]: 'Turn your face slightly right',
      [POSE_STATES.CHIN_UP]: 'Lower your chin slightly',
      [POSE_STATES.CHIN_DOWN]: 'Raise your chin slightly',
      [POSE_STATES.HEAD_LEVEL]: 'Keep your head level',
      [POSE_STATES.POSE_OK]: 'Good — hold still',
    }

    if (multiAngleScan.requiredView === MULTI_ANGLE_STATES.COMPLETE) return 'Scan complete'

    if (multiAngleScan.requiredView !== MULTI_ANGLE_STATES.FRONT) {
      if (faceAnalysis.faceCount < 1) return 'Keep your face in view, then turn'
      const yawInstruction = getYawCorrection(multiAngleScan.requiredView, pose.yaw)
      if (yawInstruction) return yawInstruction
      if (multiAngleScan.countdown !== null) return 'Hold still'
      return 'Turn a little — or tap Snap now'
    }

    if (!scannerValidation.canCapture) {
      return messages[scannerValidation.state] || 'Position your face inside the guide'
    }

    if (multiAngleScan.requiredView === MULTI_ANGLE_STATES.FRONT && pose.state !== POSE_STATES.POSE_OK) {
      return poseMessages[pose.state] || 'Look straight at the camera'
    }

    if (multiAngleScan.countdown !== null) return 'Hold still'
    if (multiAngleScan.viewReady) return `${multiAngleScan.requiredView[0]}${multiAngleScan.requiredView.slice(1).toLowerCase()} view ready`

    return poseMessages[pose.state] || 'Position your face inside the guide'
  }, [faceAnalysis.faceCount, multiAngleScan.countdown, multiAngleScan.requiredView, multiAngleScan.viewReady, pose.state, pose.yaw, scannerValidation.canCapture, scannerValidation.state])

  return (
    <div className="rounded-[2rem] border border-slate-200/70 bg-white/90 p-3 shadow-[0_20px_80px_-16px_rgba(15,23,42,0.35)] backdrop-blur sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-600">Camera</p>
          <h2 className="text-xl font-semibold text-slate-900">Live scan preview</h2>
        </div>

        <div className="flex items-center gap-2">
          {process.env.NODE_ENV === 'development' ? (
            <button
              type="button"
              onClick={() => setDebugMode((prev) => !prev)}
              className="rounded-full border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-sky-700 transition hover:border-sky-300 hover:bg-sky-100"
            >
              {debugMode ? 'Hide debug' : 'Show debug'}
            </button>
          ) : null}

          <button
            type="button"
            onClick={toggleFacingMode}
            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:bg-sky-50"
          >
            Switch to {facingMode === 'user' ? 'rear' : 'front'} camera
          </button>
        </div>
      </div>

      <div className="camera-shell">
        <div ref={cameraScreenRef} className="camera-screen">
          {status !== 'ready' ? (
            <div className="camera-placeholder">
              <div className="max-w-sm rounded-2xl border border-white/10 bg-slate-950/60 p-6 text-left">
                <p className="mb-2 text-sm font-semibold uppercase tracking-[0.25em] text-sky-300">
                  {status === 'requesting' ? 'Requesting access' : 'Camera unavailable'}
                </p>
                <p className="text-sm text-slate-300">
                  {error || 'The camera stream is preparing. Please allow access when prompted.'}
                </p>
                {status !== 'requesting' ? (
                  <button
                    type="button"
                    onClick={() => startCamera(facingMode)}
                    className="mt-4 rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-600"
                  >
                    Try again
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {isStreaming ? (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover"
              />

              {multiAngleScan.requiredView !== MULTI_ANGLE_STATES.COMPLETE ? (
                <>
                  <div ref={guideRef} className="camera-guide" aria-hidden="true" />
                  <ScanOverlay
                    videoWidth={videoRef.current?.videoWidth || 1280}
                    videoHeight={videoRef.current?.videoHeight || 720}
                    faceCount={faceAnalysis.faceCount}
                    faceFill={faceFill}
                    completeness={faceAnalysis.completeness}
                    pose={pose}
                    quality={quality}
                    scannerState={scannerValidation.state}
                    canCapture={multiAngleScan.viewReady}
                    blockingReason={scannerValidation.blockingReason}
                    faceCenter={faceAnalysis.bounds ? { x: faceAnalysis.bounds.centerX, y: faceAnalysis.bounds.centerY } : null}
                    positioningState={positioningState}
                    landmarks={faceAnalysis.landmarks}
                    bounds={faceAnalysis.bounds}
                    debugMode={debugMode}
                    visible={isStreaming}
                  />
                </>
              ) : null}

              {multiAngleScan.requiredView !== MULTI_ANGLE_STATES.COMPLETE ? (
                <div className="camera-instruction" aria-live="polite">
                  {primaryInstruction}
                </div>
              ) : null}
            </>
          ) : null}

          <ScanProgress
            requiredView={multiAngleScan.requiredView}
            views={multiAngleScan.views}
            countdown={multiAngleScan.countdown}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
        <div>
          <p className="text-sm text-slate-500">Status</p>
          <p className="font-semibold text-slate-800">
            {multiAngleScan.requiredView === MULTI_ANGLE_STATES.COMPLETE ? 'Scan complete' : isStreaming ? 'Guided multi-angle scan active' : 'Waiting for camera'}
          </p>
          {isStreaming ? (
            <p className="text-sm text-slate-600">{primaryInstruction}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {multiAngleScan.requiredView !== MULTI_ANGLE_STATES.COMPLETE && isStreaming ? (
            <>
              <button
                type="button"
                onClick={() => void multiAngleScan.captureNow()}
                disabled={multiAngleScan.isCapturing || faceAnalysis.faceCount < 1}
                className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Snap {String(multiAngleScan.requiredView).toLowerCase()} now
              </button>
              {multiAngleScan.requiredView !== MULTI_ANGLE_STATES.FRONT ? (
                <button
                  type="button"
                  onClick={() => multiAngleScan.skipView()}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Skip this angle
                </button>
              ) : null}
            </>
          ) : null}
          {Object.values(MULTI_ANGLE_STATES).filter((view) => view !== MULTI_ANGLE_STATES.COMPLETE).map((view) => (
            multiAngleScan.views[view].status === 'CAPTURED' ? (
              <button
                key={view}
                type="button"
                onClick={() => multiAngleScan.retake(view)}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Retake {view.toLowerCase()}
              </button>
            ) : null
          ))}
        </div>
      </div>
    </div>
  )
}

export default FaceScan
