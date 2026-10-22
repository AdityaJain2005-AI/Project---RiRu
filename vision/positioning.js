export const POSITIONING_STATES = Object.freeze({
  NO_FACE: 'NO_FACE',
  MULTIPLE_FACES: 'MULTIPLE_FACES',
  MOVE_CLOSER: 'MOVE_CLOSER',
  MOVE_BACK: 'MOVE_BACK',
  MOVE_LEFT: 'MOVE_LEFT',
  MOVE_RIGHT: 'MOVE_RIGHT',
  MOVE_UP: 'MOVE_UP',
  MOVE_DOWN: 'MOVE_DOWN',
  FACE_PARTIALLY_OBSTRUCTED: 'FACE_PARTIALLY_OBSTRUCTED',
  POSITION_OK: 'POSITION_OK',
})

export const FACE_FILL_CONFIG = Object.freeze({
  minFill: 0.72,
  maxFill: 1.35,
})

export const SCAN_CONFIG = Object.freeze({
  positionTolerance: 0.14,
  minFaceFill: FACE_FILL_CONFIG.minFill,
  maxFaceFill: FACE_FILL_CONFIG.maxFill,
  minimumRegionCoverage: 0.6,
  minimumLandmarkVisibility: 0.2,
  stabilizationFrames: 5,
})

export function getFrameCenter(width = 1, height = 1) {
  return {
    x: width / 2,
    y: height / 2,
  }
}

export function getFaceCenter(bounds) {
  if (!bounds) return null

  return {
    x: bounds.centerX,
    y: bounds.centerY,
  }
}

export function getFaceFill(
  bounds,
  {
    frameWidth = 1,
    frameHeight = 1,
    displayWidth = frameWidth,
    displayHeight = frameHeight,
    guideDiameter = Math.min(displayWidth, displayHeight),
  } = {},
) {
  if (!bounds) return 0

  const sourceScale = Math.max(displayWidth / frameWidth, displayHeight / frameHeight)
  const displayedFaceSize = Math.max(bounds.width, bounds.height) * sourceScale

  return guideDiameter > 0 ? displayedFaceSize / guideDiameter : 0
}

export function evaluateFacePosition({
  faceCount = 0,
  bounds = null,
  frameWidth = 1,
  frameHeight = 1,
  faceFill = null,
  config = SCAN_CONFIG,
} = {}) {
  if (faceCount === 0) return POSITIONING_STATES.NO_FACE
  if (faceCount > 1) return POSITIONING_STATES.MULTIPLE_FACES
  if (!bounds) return POSITIONING_STATES.NO_FACE

  const frameCenter = getFrameCenter(frameWidth, frameHeight)
  const faceCenter = getFaceCenter(bounds)
  const horizontalOffset = (faceCenter.x - frameCenter.x) / frameWidth
  const verticalOffset = (faceCenter.y - frameCenter.y) / frameHeight
  const faceSize = faceFill ?? getFaceFill(bounds, { frameWidth, frameHeight })

  if (faceSize < config.minFaceFill) return POSITIONING_STATES.MOVE_CLOSER
  if (faceSize > config.maxFaceFill) return POSITIONING_STATES.MOVE_BACK
  if (horizontalOffset < -config.positionTolerance) return POSITIONING_STATES.MOVE_RIGHT
  if (horizontalOffset > config.positionTolerance) return POSITIONING_STATES.MOVE_LEFT
  if (verticalOffset < -config.positionTolerance) return POSITIONING_STATES.MOVE_DOWN
  if (verticalOffset > config.positionTolerance) return POSITIONING_STATES.MOVE_UP

  return POSITIONING_STATES.POSITION_OK
}

export function getScannerValidation({
  faceCount = 0,
  positioningState = POSITIONING_STATES.NO_FACE,
  completeness = null,
  pose = null,
  quality = null,
  requireFrontalPose = true,
  mode = 'front',
} = {}) {
  if (faceCount === 0) {
    return { state: POSITIONING_STATES.NO_FACE, blockingReason: 'NO_FACE', canCapture: false }
  }

  if (faceCount > 1) {
    return { state: POSITIONING_STATES.MULTIPLE_FACES, blockingReason: 'MULTIPLE_FACES', canCapture: false }
  }

  if (mode === 'side') {
    return { state: 'READY', blockingReason: null, canCapture: true }
  }

  if (positioningState !== POSITIONING_STATES.POSITION_OK) {
    return { state: positioningState, blockingReason: 'POSITION', canCapture: false }
  }

  if (!completeness?.isComplete) {
    return {
      state: POSITIONING_STATES.FACE_PARTIALLY_OBSTRUCTED,
      blockingReason: 'FACE_COMPLETENESS',
      canCapture: false,
    }
  }

  if (requireFrontalPose && (pose?.state !== 'POSE_OK' || !pose?.isValid)) {
    return { state: pose?.state || 'POSE', blockingReason: 'POSE', canCapture: false }
  }

  if (!quality?.isValid || quality.lighting !== 'ACCEPTABLE') {
    return {
      state: quality?.lighting || 'TOO_DARK',
      blockingReason: 'LIGHTING',
      canCapture: false,
    }
  }

  if (quality.sharpness !== 'ACCEPTABLE') {
    return { state: 'TOO_BLURRY', blockingReason: 'SHARPNESS', canCapture: false }
  }

  return { state: 'READY', blockingReason: null, canCapture: true }
}