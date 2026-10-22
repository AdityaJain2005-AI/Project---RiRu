import { useCallback, useEffect, useRef, useState } from 'react'
import { getFaceBoundsFromLandmarks, getFaceCompleteness } from '../faceGeometry'
import { SCAN_CONFIG } from '../positioning'

const DEFAULT_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'

export function useFaceLandmarker({
  videoRef,
  enabled = true,
  onFaceResults,
} = {}) {
  const faceLandmarkerRef = useRef(null)
  const animationFrameRef = useRef(null)
  const lastVideoTimeRef = useRef(-1)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [faceCount, setFaceCount] = useState(0)

  const initialize = useCallback(async () => {
    if (!enabled || !videoRef?.current) {
      return
    }

    if (faceLandmarkerRef.current) {
      return
    }

    try {
      setStatus('loading')
      setError('')

      const { FilesetResolver, FaceLandmarker } = await import('@mediapipe/tasks-vision')

      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
      )

      const landmarkDetector = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: DEFAULT_MODEL_URL,
          delegate: 'GPU',
        },
        outputFaceBlendshapes: false,
        runningMode: 'VIDEO',
        numFaces: 5,
      })

      faceLandmarkerRef.current = landmarkDetector
      setStatus('ready')
    } catch (loadError) {
      console.error('Face Landmarker failed to initialize:', loadError)
      setError('MediaPipe Face Landmarker could not be initialized.')
      setStatus('error')
    }
  }, [enabled, videoRef])

  const processFrame = useCallback(() => {
    const video = videoRef?.current
    const landmarker = faceLandmarkerRef.current

    if (!video || !landmarker || video.readyState < 2) {
      animationFrameRef.current = requestAnimationFrame(processFrame)
      return
    }

    const currentTime = video.currentTime

    if (currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = currentTime

      const results = landmarker.detectForVideo(video, performance.now())
      const detections = results?.faceLandmarks ?? []
      const nextFaceCount = detections.length
      const firstFace = detections[0]

      setFaceCount(nextFaceCount)

      const faceSummary = {
        faceCount: nextFaceCount,
        frameWidth: video.videoWidth || 1,
        frameHeight: video.videoHeight || 1,
        hasFace: nextFaceCount > 0,
        isSingleFace: nextFaceCount === 1,
        hasMultipleFaces: nextFaceCount > 1,
        landmarks: firstFace ?? null,
        completeness: firstFace
          ? getFaceCompleteness(firstFace, {
            minimumVisibility: SCAN_CONFIG.minimumLandmarkVisibility,
            minimumRegionCoverage: SCAN_CONFIG.minimumRegionCoverage,
          })
          : null,
        bounds: firstFace
          ? getFaceBoundsFromLandmarks(firstFace, video.videoWidth || 1, video.videoHeight || 1)
          : null,
        rawResults: results,
      }

      if (typeof onFaceResults === 'function') {
        onFaceResults(faceSummary)
      }
    }

    animationFrameRef.current = requestAnimationFrame(processFrame)
  }, [onFaceResults, videoRef])

  useEffect(() => {
    if (!enabled) {
      return undefined
    }

    void initialize()

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (faceLandmarkerRef.current) {
        faceLandmarkerRef.current.close()
        faceLandmarkerRef.current = null
      }
      lastVideoTimeRef.current = -1
    }
  }, [enabled, initialize])

  useEffect(() => {
    if (!enabled || !videoRef?.current || status !== 'ready') {
      return undefined
    }

    animationFrameRef.current = requestAnimationFrame(processFrame)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [enabled, processFrame, status, videoRef])

  return {
    status,
    error,
    faceCount,
    initialize,
    reset: () => {
      if (faceLandmarkerRef.current) {
        faceLandmarkerRef.current.close()
        faceLandmarkerRef.current = null
      }
      setStatus('idle')
      setError('')
      setFaceCount(0)
    },
  }
}

export default useFaceLandmarker
