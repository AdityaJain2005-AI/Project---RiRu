import { useEffect, useRef, useState } from 'react'
import { estimateHeadPose, POSE_CONFIG, POSE_STATES, smoothPose } from '../pose'

export function useFacePose(landmarks, config = POSE_CONFIG) {
  const [pose, setPose] = useState({
    yaw: 0,
    pitch: 0,
    roll: 0,
    state: POSE_STATES.LOOK_STRAIGHT,
    isValid: false,
  })
  const poseRef = useRef(pose)
  const candidateRef = useRef({ state: pose.state, count: 0 })

  useEffect(() => {
    const nextPose = estimateHeadPose(landmarks, config)
    const smoothedPose = smoothPose(poseRef.current, nextPose, config.smoothing, config)
    poseRef.current = smoothedPose

    const candidate = candidateRef.current
    if (candidate.state === smoothedPose.state) {
      candidate.count += 1
    } else {
      candidate.state = smoothedPose.state
      candidate.count = 1
    }

    if (candidate.count >= config.stabilizationFrames) {
      setPose(smoothedPose)
    }
  }, [config, landmarks])

  return pose
}

export default useFacePose