export function analyzeSkinSignals(context, bounds) {
  if (!context || !bounds?.width || !bounds?.height) return null

  const canvasWidth = context.canvas.width
  const canvasHeight = context.canvas.height
  const x = Math.max(0, Math.floor(bounds.x))
  const y = Math.max(0, Math.floor(bounds.y))
  const width = Math.min(canvasWidth - x, Math.floor(bounds.width))
  const height = Math.min(canvasHeight - y, Math.floor(bounds.height))
  if (width < 8 || height < 8) return null

  const data = context.getImageData(x, y, width, height).data
  let lumaSum = 0
  let redSum = 0
  let saturationSum = 0
  let lumaSquared = 0
  let darkPixels = 0
  let brightPixels = 0
  let count = 0

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    lumaSum += luma
    lumaSquared += luma * luma
    redSum += r - (g + b) / 2
    saturationSum += max === 0 ? 0 : (max - min) / max
    if (luma < 45) darkPixels += 1
    if (luma > 235) brightPixels += 1
    count += 1
  }

  const meanLuma = lumaSum / count
  const variance = Math.max(0, lumaSquared / count - meanLuma * meanLuma)
  return {
    meanLuma: Math.round(meanLuma * 100) / 100,
    lumaVariance: Math.round(variance * 100) / 100,
    redness: Math.round((redSum / count) * 100) / 100,
    saturation: Math.round((saturationSum / count) * 10000) / 10000,
    darkRatio: Math.round((darkPixels / count) * 10000) / 10000,
    brightRatio: Math.round((brightPixels / count) * 10000) / 10000,
    sampleCount: count,
  }
}
