export function getFaceBoundsFromLandmarks(landmarks, width = 1, height = 1, padding = 18) {
  if (!Array.isArray(landmarks) || landmarks.length === 0) {
    return null
  }

  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  landmarks.forEach((point) => {
    if (!point || typeof point.x !== 'number' || typeof point.y !== 'number') {
      return
    }

    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  })

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return null
  }

  const x = Math.max(0, minX * width - padding)
  const y = Math.max(0, minY * height - padding)
  const right = Math.min(width, maxX * width + padding)
  const bottom = Math.min(height, maxY * height + padding)

  return {
    x,
    y,
    width: Math.max(0, right - x),
    height: Math.max(0, bottom - y),
    centerX: (x + right) / 2,
    centerY: (y + bottom) / 2,
  }
}

export function describeFaceCount(faceCount) {
  if (faceCount === 0) return 'zero faces'
  if (faceCount === 1) return 'one face'
  return 'multiple faces'
}

export function getObjectFitCoverTransform(sourceWidth, sourceHeight, displayWidth, displayHeight) {
  const scale = Math.max(displayWidth / sourceWidth, displayHeight / sourceHeight)
  const renderedWidth = sourceWidth * scale
  const renderedHeight = sourceHeight * scale

  return {
    scale,
    offsetX: (displayWidth - renderedWidth) / 2,
    offsetY: (displayHeight - renderedHeight) / 2,
  }
}

export function mapNormalizedPointToDisplay(point, transform, sourceWidth, sourceHeight) {
  return {
    x: point.x * sourceWidth * transform.scale + transform.offsetX,
    y: point.y * sourceHeight * transform.scale + transform.offsetY,
  }
}

export function mapSourceRectToDisplay(bounds, transform) {
  return {
    x: bounds.x * transform.scale + transform.offsetX,
    y: bounds.y * transform.scale + transform.offsetY,
    width: bounds.width * transform.scale,
    height: bounds.height * transform.scale,
    centerX: bounds.centerX * transform.scale + transform.offsetX,
    centerY: bounds.centerY * transform.scale + transform.offsetY,
  }
}

const FACE_REGIONS = Object.freeze({
  leftEye: [33, 133, 159, 145, 160, 144],
  rightEye: [263, 362, 386, 374, 387, 373],
  nose: [1, 4, 5, 6, 197],
  mouth: [61, 291, 13, 14, 78, 308],
  leftCheek: [50, 101, 118, 123, 234],
  rightCheek: [280, 330, 347, 352, 454],
  jaw: [10, 152, 172, 397, 234, 454],
})

function isValidFacePoint(point) {
  return point && Number.isFinite(point.x) && Number.isFinite(point.y)
}

function getVisibility(point) {
  if (typeof point?.visibility === 'number') return point.visibility
  if (typeof point?.presence === 'number') return point.presence
  return null
}

export function getFaceCompleteness(
  landmarks,
  { minimumVisibility = 0.2, minimumRegionCoverage = 0.6 } = {},
) {
  if (!Array.isArray(landmarks) || landmarks.length === 0) {
    return { status: 'FACE_PARTIALLY_OBSTRUCTED', isComplete: false, hasReliableVisibility: false }
  }

  const allVisibilityValues = landmarks
    .map(getVisibility)
    .filter((value) => value !== null)
  const hasReliableVisibility = allVisibilityValues.length >= 20 &&
    allVisibilityValues.some((value) => value >= minimumVisibility)

  const regionResults = Object.entries(FACE_REGIONS).map(([name, indices]) => {
    const points = indices.map((index) => landmarks[index]).filter(isValidFacePoint)
    const visibilityValues = points.map(getVisibility).filter((value) => value !== null)
    const visiblePoints = hasReliableVisibility
      ? visibilityValues.filter((value) => value >= minimumVisibility).length
      : points.length
    const coverage = visiblePoints / indices.length

    return {
      name,
      coverage,
      isPresent: points.length >= Math.ceil(indices.length * minimumRegionCoverage),
      isObstructed: coverage < minimumRegionCoverage,
      hasReliableVisibility,
    }
  })

  const obstructedRegions = regionResults.filter((region) => region.isObstructed)
  const isComplete = obstructedRegions.length === 0

  return {
    status: isComplete ? 'FACE_COMPLETE' : 'FACE_PARTIALLY_OBSTRUCTED',
    isComplete,
    hasReliableVisibility,
    obstructedRegions: obstructedRegions.map((region) => region.name),
    regions: regionResults,
  }
}

export function drawFaceDebugOverlay(
  context,
  landmarks,
  { width = 1, height = 1, pointRadius = 2, pointColor = '#f8fafc', outlineColor = '#38bdf8', mapPoint } = {},
) {
  if (!context || !Array.isArray(landmarks) || landmarks.length === 0) {
    return
  }

  context.save()
  context.lineWidth = 1.5
  context.strokeStyle = outlineColor
  context.fillStyle = pointColor

  const mappedPoints = landmarks.map((point) => ({
    ...(mapPoint ? mapPoint(point) : { x: point.x * width, y: point.y * height }),
  }))

  mappedPoints.forEach(({ x, y }) => {
    context.beginPath()
    context.arc(x, y, pointRadius, 0, Math.PI * 2)
    context.fill()
  })

  if (mappedPoints.length >= 2) {
    context.beginPath()
    mappedPoints.forEach(({ x, y }, index) => {
      if (index === 0) {
        context.moveTo(x, y)
        return
      }

      context.lineTo(x, y)
    })
    context.stroke()
  }

  context.restore()
}
