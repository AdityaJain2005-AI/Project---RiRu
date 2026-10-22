import { useCallback, useEffect, useRef, useState } from 'react'
import {
  MULTI_ANGLE_CONFIG,
  MULTI_ANGLE_STATES,
  VIEW_CAPTURE_STATES,
  getNextPendingView,
  isViewPoseReady,
} from '../multiAngle'

const INITIAL_VIEWS = {
  [MULTI_ANGLE_STATES.FRONT]: { status: VIEW_CAPTURE_STATES.NOT_CAPTURED, metadata: null },
  [MULTI_ANGLE_STATES.LEFT]: { status: VIEW_CAPTURE_STATES.NOT_CAPTURED, metadata: null },
  [MULTI_ANGLE_STATES.RIGHT]: { status: VIEW_CAPTURE_STATES.NOT_CAPTURED, metadata: null },
}

function isSideView(view) {
  return view === MULTI_ANGLE_STATES.LEFT || view === MULTI_ANGLE_STATES.RIGHT
}

export function useMultiAngleScan({
  scannerValidation,
  pose,
  captureFrame,
  faceCount = 0,
  config = MULTI_ANGLE_CONFIG,
} = {}) {
  const [requiredView, setRequiredView] = useState(MULTI_ANGLE_STATES.FRONT)
  const [views, setViews] = useState(INITIAL_VIEWS)
  const [countdown, setCountdown] = useState(null)
  const [isCapturing, setIsCapturing] = useState(false)
  const validSinceRef = useRef(null)
  const stabilityTimeoutRef = useRef(null)
  const countdownIntervalRef = useRef(null)
  const viewsRef = useRef(views)
  const requiredViewRef = useRef(requiredView)
  viewsRef.current = views
  requiredViewRef.current = requiredView

  const viewPoseReady = isViewPoseReady(requiredView, pose, config)
  const side = isSideView(requiredView)
  const viewReady = requiredView !== MULTI_ANGLE_STATES.COMPLETE && viewPoseReady && (
    side
      ? faceCount >= 1
      : Boolean(scannerValidation?.canCapture)
  )

  useEffect(() => () => {
    if (stabilityTimeoutRef.current) clearTimeout(stabilityTimeoutRef.current)
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
  }, [])

  useEffect(() => {
    if (requiredView === MULTI_ANGLE_STATES.COMPLETE || !viewReady || isCapturing) {
      validSinceRef.current = null
      if (stabilityTimeoutRef.current) clearTimeout(stabilityTimeoutRef.current)
      stabilityTimeoutRef.current = null
      if (!viewReady && countdown !== null) setCountdown(null)
      return undefined
    }

    if (countdown !== null || validSinceRef.current !== null) return undefined

    validSinceRef.current = performance.now()
    setViews((current) => ({
      ...current,
      [requiredView]: { ...current[requiredView], status: VIEW_CAPTURE_STATES.READY },
    }))
    stabilityTimeoutRef.current = setTimeout(() => {
      setCountdown(config.countdownSeconds)
      setViews((current) => ({
        ...current,
        [requiredView]: { ...current[requiredView], status: VIEW_CAPTURE_STATES.COUNTDOWN },
      }))
    }, config.stabilityMs)

    return () => {
      if (stabilityTimeoutRef.current) clearTimeout(stabilityTimeoutRef.current)
      stabilityTimeoutRef.current = null
    }
  }, [config.countdownSeconds, config.stabilityMs, countdown, isCapturing, requiredView, viewReady])

  useEffect(() => {
    if (countdown === null || !viewReady || isCapturing) return undefined

    countdownIntervalRef.current = setInterval(() => {
      setCountdown((current) => (current === null ? null : current - 1))
    }, 1000)

    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
      countdownIntervalRef.current = null
    }
  }, [countdown, isCapturing, viewReady])

  const finishCapture = useCallback(async (view) => {
    if (!captureFrame) return
    setIsCapturing(true)
    try {
      const metadata = await captureFrame(view)
      const next = {
        ...viewsRef.current,
        [view]: { status: VIEW_CAPTURE_STATES.CAPTURED, metadata },
      }
      viewsRef.current = next
      setViews(next)
      setRequiredView(getNextPendingView(view, next))
      setCountdown(null)
    } catch (captureError) {
      console.error(captureError)
      setCountdown(null)
    } finally {
      setIsCapturing(false)
    }
  }, [captureFrame])

  useEffect(() => {
    if (countdown !== 0 || !viewReady || isCapturing || requiredView === MULTI_ANGLE_STATES.COMPLETE) return undefined
    void finishCapture(requiredView)
  }, [countdown, finishCapture, isCapturing, requiredView, viewReady])

  const retake = useCallback((view) => {
    setRequiredView(view)
    setCountdown(null)
    setViews((current) => ({
      ...current,
      [view]: { status: VIEW_CAPTURE_STATES.NOT_CAPTURED, metadata: null },
    }))
  }, [])

  const captureNow = useCallback(async () => {
    const view = requiredViewRef.current
    if (isCapturing || view === MULTI_ANGLE_STATES.COMPLETE) return
    if (faceCount < 1) return
    await finishCapture(view)
  }, [faceCount, finishCapture, isCapturing])

  const skipView = useCallback(() => {
    const view = requiredViewRef.current
    if (view === MULTI_ANGLE_STATES.COMPLETE) return
    setCountdown(null)
    setRequiredView(getNextPendingView(view, viewsRef.current))
  }, [])

  return {
    requiredView,
    views,
    countdown,
    viewReady,
    isCapturing,
    session: {
      frontImage: views[MULTI_ANGLE_STATES.FRONT].metadata?.image || null,
      leftImage: views[MULTI_ANGLE_STATES.LEFT].metadata?.image || null,
      rightImage: views[MULTI_ANGLE_STATES.RIGHT].metadata?.image || null,
    },
    retake,
    captureNow,
    skipView,
  }
}

export default useMultiAngleScan
