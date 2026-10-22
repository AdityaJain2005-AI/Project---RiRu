import { useCallback, useEffect, useRef, useState } from 'react'

export function useCamera(initialFacingMode = 'user') {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [stream, setStream] = useState(null)
  const [status, setStatus] = useState('requesting')
  const [error, setError] = useState('')
  const [facingMode, setFacingMode] = useState(initialFacingMode)

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    setStream(null)
  }, [])

  const startCamera = useCallback(
    async (requestedFacingMode = facingMode) => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('This browser does not support camera access.')
        setStatus('error')
        return
      }

      const isSecureContext = window.isSecureContext || window.location.hostname === 'localhost'

      if (!isSecureContext) {
        setError('Camera access requires a secure connection. Please use HTTPS or localhost.')
        setStatus('error')
        return
      }

      setStatus('requesting')
      setError('')
      stopStream()

      try {
        const permissionStatus = await navigator.permissions?.query?.({ name: 'camera' }).catch(() => null)

        if (permissionStatus?.state === 'denied') {
          setError('Camera access was denied. Please enable camera permissions in browser settings.')
          setStatus('error')
          return
        }

        const streamObject = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            facingMode: requestedFacingMode,
          },
          audio: false,
        })

        streamRef.current = streamObject
        setStream(streamObject)

        if (videoRef.current) {
          videoRef.current.srcObject = streamObject
          await videoRef.current.play().catch(() => undefined)
        }

        setStatus('ready')
      } catch (err) {
        let message = 'Unable to open the camera right now.'

        if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
          message = 'Camera access was denied. Please allow the camera and try again.'
        } else if (err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError') {
          message = 'No camera is available on this device.'
        } else if (err?.name === 'NotReadableError') {
          message = 'The camera is already being used by another app.'
        } else if (err?.name === 'SecurityError') {
          message = 'Camera access requires a secure connection.'
        }

        setError(message)
        setStatus('error')
      }
    },
    [facingMode, stopStream],
  )

  const toggleFacingMode = useCallback(() => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'))
  }, [])

  useEffect(() => {
    void startCamera(facingMode)

    return () => {
      stopStream()
    }
  }, [facingMode, startCamera, stopStream])

  return {
    videoRef,
    stream,
    status,
    error,
    facingMode,
    isStreaming: status === 'ready' && Boolean(stream),
    toggleFacingMode,
    startCamera,
    stopStream,
  }
}

export default useCamera
