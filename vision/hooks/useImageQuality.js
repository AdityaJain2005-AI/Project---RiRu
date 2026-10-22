import { useEffect, useRef, useState } from 'react'
import { analyzeImageQuality, QUALITY_STATES, SCAN_QUALITY_CONFIG, smoothQualitySamples } from '../quality'

const INITIAL_QUALITY = {
  lighting: QUALITY_STATES.TOO_DARK,
  sharpness: QUALITY_STATES.TOO_BLURRY,
  meanLuma: 0,
  lumaVariance: 0,
  darkClipPct: 0,
  brightClipPct: 0,
  regionalVariation: 0,
  glareRatio: 0,
  qualityScore: 0,
  sharpnessValue: 0,
  isAcceptable: false,
  isValid: false,
}

export function useImageQuality(videoRef, landmarks, enabled = true, config = SCAN_QUALITY_CONFIG) {
  const [quality, setQuality] = useState(INITIAL_QUALITY)
  const samplesRef = useRef([])
  const lastSampleAtRef = useRef(0)

  useEffect(() => {
    if (!enabled) {
      samplesRef.current = []
      setQuality(INITIAL_QUALITY)
      return undefined
    }

    let animationFrameId
    const processQuality = (timestamp) => {
      if (timestamp - lastSampleAtRef.current >= config.sampleIntervalMs) {
        lastSampleAtRef.current = timestamp
        const sample = analyzeImageQuality(videoRef?.current, landmarks, config)
        samplesRef.current = [...samplesRef.current, sample].slice(-config.stability.smoothingFrames)
        setQuality(smoothQualitySamples(samplesRef.current, config) || sample)
      }

      animationFrameId = requestAnimationFrame(processQuality)
    }

    animationFrameId = requestAnimationFrame(processQuality)
    return () => cancelAnimationFrame(animationFrameId)
  }, [config, enabled, landmarks, videoRef])

  return quality
}

export default useImageQuality