export const DEFAULT_CAPTURE_QUALITY = 0.85
export const DEFAULT_CAPTURE_NAME = 'facelab-scan.jpg'

export function formatFileSize(bytes) {
  if (bytes === 0) return '0 KB'

  const units = ['B', 'KB', 'MB', 'GB']
  const sizeIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** sizeIndex

  return `${value.toFixed(sizeIndex === 0 ? 0 : 1)} ${units[sizeIndex]}`
}

export async function prepareCapturedFrame(canvas, options = {}) {
  const { quality = DEFAULT_CAPTURE_QUALITY, fileName = DEFAULT_CAPTURE_NAME } = options

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) {
          resolve(result)
          return
        }

        reject(new Error('Unable to encode the captured frame.'))
      },
      'image/jpeg',
      quality,
    )
  })

  const file = new File([blob], fileName, { type: 'image/jpeg' })

  return { blob, file }
}

export function buildScanFormData(file) {
  const formData = new FormData()
  formData.append('file', file, file.name || DEFAULT_CAPTURE_NAME)
  return formData
}
