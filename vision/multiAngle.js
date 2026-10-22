import { POSE_CONFIG, POSE_STATES } from './pose.js'

export const MULTI_ANGLE_STATES = Object.freeze({
  FRONT: 'FRONT',
  LEFT: 'LEFT',
  RIGHT: 'RIGHT',
  COMPLETE: 'COMPLETE',
})

export const VIEW_CAPTURE_STATES = Object.freeze({
  NOT_CAPTURED: 'NOT_CAPTURED',
  READY: 'READY',
  COUNTDOWN: 'COUNTDOWN',
  CAPTURED: 'CAPTURED',
})

export const MULTI_ANGLE_CONFIG = Object.freeze({
  front: { yawMin: -POSE_CONFIG.maxYaw, yawMax: POSE_CONFIG.maxYaw },
  // Wide windows — a clear turn is enough; the old ±14° band was too fussy.
  left: { yawMin: -55, yawMax: -8 },
  right: { yawMin: 8, yawMax: 55 },
  stabilityMs: 280,
  countdownSeconds: 1,
})

export function getYawCorrection(view, yaw) {
  if (view === MULTI_ANGLE_STATES.LEFT) {
    if (yaw > MULTI_ANGLE_CONFIG.left.yawMax) return 'Turn your face slightly left'
    if (yaw < MULTI_ANGLE_CONFIG.left.yawMin) return 'Turn your face slightly right'
  }
  if (view === MULTI_ANGLE_STATES.RIGHT) {
    if (yaw < MULTI_ANGLE_CONFIG.right.yawMin) return 'Turn your face slightly right'
    if (yaw > MULTI_ANGLE_CONFIG.right.yawMax) return 'Turn your face slightly left'
  }
  return null
}

export function isViewPoseReady(view, pose, config = MULTI_ANGLE_CONFIG) {
  if (!pose?.isValid) return false
  if (view === MULTI_ANGLE_STATES.FRONT) {
    return pose.state === POSE_STATES.POSE_OK && pose.yaw >= config.front.yawMin && pose.yaw <= config.front.yawMax
  }
  const range = view === MULTI_ANGLE_STATES.LEFT ? config.left : config.right
  return pose.yaw >= range.yawMin && pose.yaw <= range.yawMax
}

export function getNextView(view) {
  if (view === MULTI_ANGLE_STATES.FRONT) return MULTI_ANGLE_STATES.LEFT
  if (view === MULTI_ANGLE_STATES.LEFT) return MULTI_ANGLE_STATES.RIGHT
  return MULTI_ANGLE_STATES.COMPLETE
}

export function getNextPendingView(view, views) {
  const order = [MULTI_ANGLE_STATES.FRONT, MULTI_ANGLE_STATES.LEFT, MULTI_ANGLE_STATES.RIGHT]
  const startIndex = order.indexOf(view)
  const pending = order.slice(startIndex + 1).find((candidate) => views[candidate]?.status !== 'CAPTURED')
  return pending || MULTI_ANGLE_STATES.COMPLETE
}