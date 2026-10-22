import { useEffect, useRef, useState } from 'react'
import { evaluateFacePosition, POSITIONING_STATES, SCAN_CONFIG } from '../positioning'

export function useFacePositioning(faceAnalysis, config = SCAN_CONFIG) {
  const [positioningState, setPositioningState] = useState(POSITIONING_STATES.NO_FACE)
  const candidateRef = useRef({ state: positioningState, count: 0 })

  useEffect(() => {
    const nextState = evaluateFacePosition({ ...faceAnalysis, config })
    const candidate = candidateRef.current

    if (candidate.state === nextState) {
      candidate.count += 1
    } else {
      candidate.state = nextState
      candidate.count = 1
    }

    if (candidate.count >= config.stabilizationFrames && nextState !== positioningState) {
      setPositioningState(nextState)
    }
  }, [config, faceAnalysis, positioningState])

  return positioningState
}

export default useFacePositioning