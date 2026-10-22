export const POSE_STATES = Object.freeze({
  LOOK_STRAIGHT: 'LOOK_STRAIGHT',
  TURN_LEFT: 'TURN_LEFT',
  TURN_RIGHT: 'TURN_RIGHT',
  CHIN_UP: 'CHIN_UP',
  CHIN_DOWN: 'CHIN_DOWN',
  HEAD_LEVEL: 'HEAD_LEVEL',
  POSE_OK: 'POSE_OK',
})

export const POSE_CONFIG = Object.freeze({
  maxYaw: 12,
  maxPitch: 12,
  maxRoll: 10,
  neutralPitchRatio: 1.1,
  yawScale: 45,
  pitchScale: 20,
  smoothing: 0.25,
  stabilizationFrames: 4,
})

function getPoint(landmarks, index) {
  const point = landmarks?.[index]
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null
  return point
}

function getAveragePoint(firstPoint, secondPoint) {
  return {
    x: (firstPoint.x + secondPoint.x) / 2,
    y: (firstPoint.y + secondPoint.y) / 2,
  }
}

export function estimateHeadPose(landmarks, config = POSE_CONFIG) {
  const leftEye = getPoint(landmarks, 33)
  const rightEye = getPoint(landmarks, 263)
  const nose = getPoint(landmarks, 1)
  const chin = getPoint(landmarks, 152)
  const eyeCenter = leftEye && rightEye ? getAveragePoint(leftEye, rightEye) : null

  if (!leftEye || !rightEye || !nose || !chin || !eyeCenter) {
    return {
      yaw: 0,
      pitch: 0,
      roll: 0,
      state: POSE_STATES.LOOK_STRAIGHT,
      isValid: false,
    }
  }

  const eyeDistance = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y)
  if (!Number.isFinite(eyeDistance) || eyeDistance === 0) {
    return { yaw: 0, pitch: 0, roll: 0, state: POSE_STATES.LOOK_STRAIGHT, isValid: false }
  }

  const yawRatio = (eyeCenter.x - nose.x) / eyeDistance
  const pitchRatio = (nose.y - eyeCenter.y) / eyeDistance
  const roll = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * (180 / Math.PI)
  const yaw = yawRatio * config.yawScale
  const pitch = (pitchRatio - config.neutralPitchRatio) * config.pitchScale

  return {
    yaw,
    pitch,
    roll,
    state: getPoseState({ yaw, pitch, roll }, config),
    isValid: true,
  }
}

export function getPoseState({ yaw = 0, pitch = 0, roll = 0 } = {}, config = POSE_CONFIG) {
  let state = POSE_STATES.POSE_OK
  if (yaw < -config.maxYaw) state = POSE_STATES.TURN_LEFT
  else if (yaw > config.maxYaw) state = POSE_STATES.TURN_RIGHT
  else if (pitch < -config.maxPitch) state = POSE_STATES.CHIN_UP
  else if (pitch > config.maxPitch) state = POSE_STATES.CHIN_DOWN
  else if (Math.abs(roll) > config.maxRoll) state = POSE_STATES.HEAD_LEVEL

  return state
}

export function smoothPose(
  previousPose,
  nextPose,
  smoothing = POSE_CONFIG.smoothing,
  config = POSE_CONFIG,
) {
  if (!nextPose?.isValid) return nextPose
  if (!previousPose?.isValid) return nextPose

  const smoothedPose = {
    ...nextPose,
    yaw: previousPose.yaw + (nextPose.yaw - previousPose.yaw) * smoothing,
    pitch: previousPose.pitch + (nextPose.pitch - previousPose.pitch) * smoothing,
    roll: previousPose.roll + (nextPose.roll - previousPose.roll) * smoothing,
  }

  return {
    ...smoothedPose,
    state: getPoseState(smoothedPose, config),
  }
}