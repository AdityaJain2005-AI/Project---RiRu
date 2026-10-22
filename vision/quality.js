export const QUALITY_STATES = Object.freeze({
  TOO_DARK: 'TOO_DARK',
  TOO_BRIGHT: 'TOO_BRIGHT',
  UNEVEN: 'UNEVEN',
  GLARE: 'GLARE',
  ACCEPTABLE: 'ACCEPTABLE',
  TOO_BLURRY: 'TOO_BLURRY',
})

export const SCAN_QUALITY_CONFIG = Object.freeze({
  analysisWidth: 160,
  sampleIntervalMs: 200,
  lighting: {
    darkPixelLuma: 45,
    brightPixelLuma: 235,
    minMeanLuma: 52,
    maxMeanLuma: 218,
    maxDarkPixelPct: 0.48,
    maxBrightPixelPct: 0.38,
    maxRegionalVariation: 0.65,
    glareLuma: 240,
    glareSaturation: 0.18,
    minGlareRatio: 0.035,
  },
  sharpness: {
    minVariance: 45,
  },
  stability: {
    smoothingFrames: 4,
  },
})

const FACE_OVAL_INDICES = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]
const FACE_REGIONS = Object.freeze({
  forehead: [10, 109, 67, 103, 54, 21, 162, 127, 234, 454, 356, 389, 251, 284, 332, 297, 338],
  leftCheek: [234, 93, 132, 172, 136, 150, 149, 176, 148, 152],
  rightCheek: [152, 377, 400, 378, 379, 365, 397, 361, 323, 454],
  chin: [152, 148, 176, 149, 150, 136, 172, 397, 365, 379, 378, 400, 377],
})

function getLuminance(red, green, blue) {
  return red * 0.2126 + green * 0.7152 + blue * 0.0722
}

function getLandmarkPoint(landmarks, index, width, height) {
  const point = landmarks?.[index]
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null
  return { x: point.x * width, y: point.y * height }
}

function getPolygon(landmarks, indices, width, height) {
  return indices.map((index) => getLandmarkPoint(landmarks, index, width, height)).filter(Boolean)
}

function isPointInPolygon(x, y, polygon) {
  let inside = false
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const currentPoint = polygon[index]
    const previousPoint = polygon[previous]
    const intersects = currentPoint.y > y !== previousPoint.y > y &&
      x < ((previousPoint.x - currentPoint.x) * (y - currentPoint.y)) /
        (previousPoint.y - currentPoint.y) + currentPoint.x
    if (intersects) inside = !inside
  }
  return inside
}

function getEmptyQuality() {
  return {
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
}

function getRegionMean(landmarks, regionIndices, luminance, width, height, facePolygon) {
  const regionPolygon = getPolygon(landmarks, regionIndices, width, height)
  if (regionPolygon.length < 3) return null

  let total = 0
  let count = 0
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (isPointInPolygon(x + 0.5, y + 0.5, regionPolygon) && isPointInPolygon(x + 0.5, y + 0.5, facePolygon)) {
        total += luminance[y * width + x]
        count += 1
      }
    }
  }
  return count > 0 ? total / count : null
}

export function analyzeImageQuality(video, landmarks, config = SCAN_QUALITY_CONFIG) {
  if (!video || !video.videoWidth || !video.videoHeight || video.readyState < 2 || !Array.isArray(landmarks)) {
    return getEmptyQuality()
  }

  const width = config.analysisWidth
  const height = Math.max(1, Math.round((video.videoHeight / video.videoWidth) * width))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return getEmptyQuality()

  context.drawImage(video, 0, 0, width, height)
  const pixels = context.getImageData(0, 0, width, height).data
  const facePolygon = getPolygon(landmarks, FACE_OVAL_INDICES, width, height)
  if (facePolygon.length < 3) return getEmptyQuality()

  const luminance = new Float32Array(width * height)
  let lumaTotal = 0
  let lumaSquaredTotal = 0
  let darkPixels = 0
  let brightPixels = 0
  let glarePixels = 0
  let facePixels = 0

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!isPointInPolygon(x + 0.5, y + 0.5, facePolygon)) continue
      const pixelIndex = (y * width + x) * 4
      const red = pixels[pixelIndex]
      const green = pixels[pixelIndex + 1]
      const blue = pixels[pixelIndex + 2]
      const value = getLuminance(red, green, blue)
      const maxChannel = Math.max(red, green, blue)
      const minChannel = Math.min(red, green, blue)
      const saturation = maxChannel > 0 ? (maxChannel - minChannel) / maxChannel : 0
      luminance[y * width + x] = value
      lumaTotal += value
      lumaSquaredTotal += value * value
      if (value <= config.lighting.darkPixelLuma) darkPixels += 1
      if (value >= config.lighting.brightPixelLuma) brightPixels += 1
      if (value >= config.lighting.glareLuma && saturation <= config.lighting.glareSaturation) glarePixels += 1
      facePixels += 1
    }
  }

  if (facePixels === 0) return getEmptyQuality()

  let laplacianTotal = 0
  let laplacianSquaredTotal = 0
  let sampleCount = 0
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x
      if (!isPointInPolygon(x + 0.5, y + 0.5, facePolygon)) continue
      const laplacian = luminance[index] * 8 - luminance[index - 1] - luminance[index + 1] -
        luminance[index - width] - luminance[index + width] - luminance[index - width - 1] -
        luminance[index - width + 1] - luminance[index + width - 1] - luminance[index + width + 1]
      laplacianTotal += laplacian
      laplacianSquaredTotal += laplacian * laplacian
      sampleCount += 1
    }
  }

  const meanLuma = lumaTotal / facePixels
  const lumaVariance = Math.max(0, lumaSquaredTotal / facePixels - meanLuma * meanLuma)
  const regionalMeans = Object.values(FACE_REGIONS)
    .map((region) => getRegionMean(landmarks, region, luminance, width, height, facePolygon))
    .filter((value) => value !== null)
  const regionalVariation = regionalMeans.length > 1
    ? (Math.max(...regionalMeans) - Math.min(...regionalMeans)) / Math.max(1, meanLuma)
    : 0
  const darkClipPct = darkPixels / facePixels
  const brightClipPct = brightPixels / facePixels
  const glareRatio = glarePixels / facePixels
  const lighting = glareRatio >= config.lighting.minGlareRatio
    ? QUALITY_STATES.GLARE
    : meanLuma < config.lighting.minMeanLuma || darkClipPct >= config.lighting.maxDarkPixelPct
      ? QUALITY_STATES.TOO_DARK
      : meanLuma > config.lighting.maxMeanLuma || brightClipPct >= config.lighting.maxBrightPixelPct
        ? QUALITY_STATES.TOO_BRIGHT
        : regionalVariation >= config.lighting.maxRegionalVariation
          ? QUALITY_STATES.UNEVEN
          : QUALITY_STATES.ACCEPTABLE
  const sharpnessValue = sampleCount
    ? Math.max(0, laplacianSquaredTotal / sampleCount - (laplacianTotal / sampleCount) ** 2)
    : 0
  const sharpness = sharpnessValue < config.sharpness.minVariance
    ? QUALITY_STATES.TOO_BLURRY
    : QUALITY_STATES.ACCEPTABLE
  const qualityScore = Math.max(0, Math.min(1, 1 - darkClipPct * 0.5 - brightClipPct * 0.5 - regionalVariation * 0.5 - glareRatio))

  return {
    lighting,
    sharpness,
    meanLuma,
    darkClipPct,
    brightClipPct,
    regionalVariation,
    glareRatio,
    qualityScore,
    sharpnessValue,
    isAcceptable: lighting === QUALITY_STATES.ACCEPTABLE && sharpness === QUALITY_STATES.ACCEPTABLE,
    isValid: true,
    lumaVariance,
  }
}

export function smoothQualitySamples(samples, config = SCAN_QUALITY_CONFIG) {
  const recentSamples = samples.slice(-config.stability.smoothingFrames)
  if (recentSamples.length === 0) return null

  const getMajority = (key) => {
    const counts = recentSamples.reduce((result, sample) => {
      result[sample[key]] = (result[sample[key]] || 0) + 1
      return result
    }, {})
    return Object.entries(counts).sort((first, second) => second[1] - first[1])[0][0]
  }
  const lighting = getMajority('lighting')
  const sharpness = getMajority('sharpness')
  const average = (key) => recentSamples.reduce((total, sample) => total + sample[key], 0) / recentSamples.length

  return {
    ...recentSamples[recentSamples.length - 1],
    lighting,
    sharpness,
    meanLuma: average('meanLuma'),
    lumaVariance: average('lumaVariance'),
    darkClipPct: average('darkClipPct'),
    brightClipPct: average('brightClipPct'),
    regionalVariation: average('regionalVariation'),
    glareRatio: average('glareRatio'),
    qualityScore: average('qualityScore'),
    sharpnessValue: average('sharpnessValue'),
    isAcceptable: lighting === QUALITY_STATES.ACCEPTABLE && sharpness === QUALITY_STATES.ACCEPTABLE,
  }
}
