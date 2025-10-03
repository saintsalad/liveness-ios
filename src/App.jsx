import Webcam from 'react-webcam'
import { useRef, useState, useEffect, useCallback } from 'react'
import './App.css'

function App() {
  // States
  const [recording, setRecording] = useState(false)
  const [videoURL, setVideoURL] = useState(null)
  const [cameras, setCameras] = useState([])
  const [selectedDeviceId, setSelectedDeviceId] = useState(null)
  const [loadingCameras, setLoadingCameras] = useState(true)
  const [seconds, setSeconds] = useState(0)
  const [permissionError, setPermissionError] = useState(null)
  const [permissionState, setPermissionState] = useState('requesting') // 'requesting', 'granted', 'denied'

  // Refs
  const webcamRef = useRef(null)
  const streamRef = useRef(null)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)

  // Timer functions
  const startTimer = (limit = 15) => {
    setSeconds(limit)
    timerRef.current = setInterval(() => setSeconds(prev => prev - 1), 1000)
  }

  const stopTimer = () => {
    clearInterval(timerRef.current)
    timerRef.current = null
  }

  // Stop stream
  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (webcamRef.current && webcamRef.current.stream) {
      webcamRef.current.stream.getTracks().forEach(track => track.stop())
      webcamRef.current.stream = null
    }
  }

  // Reset video
  const resetVideo = () => {
    setVideoURL(null)
    chunksRef.current = []
    setSeconds(0)
    stopTimer()
  }

  // Recording functions
  const handleRecordingStop = (recorder) => {
    const mimeType = recorder.mimeType
    const blob = new Blob(chunksRef.current, { type: mimeType })
    setVideoURL(URL.createObjectURL(blob))
    setRecording(false)
    stopTimer()
    stopStream()
  }

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop()
    }
    stopStream()
    setRecording(false)
  }, [])

  const startRecording = async () => {
    try {
      const constraints = {
        audio: true,
        video: { deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined }
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      if (!stream.getVideoTracks().length) throw new Error("No video track found")

      streamRef.current = stream
      chunksRef.current = []
      const recorder = new MediaRecorder(stream)
      recorderRef.current = recorder

      recorder.ondataavailable = e => e.data.size > 0 && chunksRef.current.push(e.data)
      recorder.onstop = () => handleRecordingStop(recorder)

      recorder.start()
      setRecording(true)
      startTimer()
    } catch (err) {
      alert(err.message)
      setRecording(false)
    }
  }

  // Switch camera
  const switchCamera = () => {
    stopStream()
    const idx = cameras.findIndex(cam => cam.deviceId === selectedDeviceId)
    const next = cameras[(idx + 1) % cameras.length].deviceId
    setSelectedDeviceId(next)
    resetVideo()
  }


  // Get available cameras
  const detectCameras = async () => {
    console.log("Starting camera detection...")
    setLoadingCameras(true)
    setPermissionError(null)
    setPermissionState('requesting')

    // Add timeout to prevent stuck loading
    const timeout = setTimeout(() => {
      console.log("Camera detection timeout, stopping loading")
      setLoadingCameras(false)
      setPermissionState('denied')
      setPermissionError('Camera access timed out. Please try again.')
    }, 10000) // 10 second timeout

    try {
      console.log("Requesting camera permission...")
      const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
      console.log("Camera permission granted:", tempStream)
      tempStream.getTracks().forEach(track => track.stop())

      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = devices.filter(d => d.kind === "videoinput")
      console.log("Found video devices:", videoDevices)
      setCameras(videoDevices)

      if (videoDevices.length > 0) {
        setSelectedDeviceId(videoDevices[0].deviceId)
        console.log("Selected device:", videoDevices[0].deviceId)
        setPermissionState('granted')
      } else {
        setPermissionState('denied')
        setPermissionError('No camera devices found on this device.')
      }
    } catch (err) {
      console.error("Camera detection error:", err)
      console.log("Error details:", err.name, err.message)

      setPermissionState('denied')
      if (err.name === 'NotAllowedError') {
        setPermissionError('Camera access was denied. Please allow camera permissions and refresh the page.')
      } else if (err.name === 'NotFoundError') {
        setPermissionError('No camera found on this device.')
      } else if (err.name === 'NotReadableError') {
        setPermissionError('Camera is already in use by another application.')
      } else {
        setPermissionError(`Camera access failed: ${err.message}`)
      }
    } finally {
      clearTimeout(timeout)
      setLoadingCameras(false)
      console.log("Camera detection completed")
    }
  }

  useEffect(() => {
    detectCameras()
  }, [])

  // Auto-stop recording when timer reaches 0
  useEffect(() => {
    if (recording && seconds <= 0) {
      stopRecording()
    }
  }, [seconds, recording, stopRecording])

  useEffect(() => () => stopTimer(), [])

  return (
    <div className="app-container">
      {/* Loading Screen */}
      {loadingCameras && (
        <div className="loading-screen">
          <div className="loading-spinner" />
          <div className="loading-title">
            {permissionState === 'requesting' ? 'Requesting Camera Access' : 'Initializing Camera'}
          </div>
          <div className="loading-subtitle">
            {permissionState === 'requesting'
              ? 'Please allow camera and microphone access when prompted'
              : 'Setting up your camera...'
            }
          </div>
        </div>
      )}

      {/* Permission Denied Screen */}
      {!loadingCameras && permissionState === 'denied' && (
        <div className="permission-denied-screen">
          <div className="permission-icon">📷</div>
          <div className="permission-title">
            Camera Access Required
          </div>
          <div className="permission-message">
            {permissionError || 'Camera access is required to use this application.'}
          </div>
          <div className="permission-instructions">
            <div className="instruction-step">
              <span className="step-number">1</span>
              <span>Click the camera icon in your browser's address bar</span>
            </div>
            <div className="instruction-step">
              <span className="step-number">2</span>
              <span>Select "Allow" for camera and microphone access</span>
            </div>
            <div className="instruction-step">
              <span className="step-number">3</span>
              <span>Refresh this page to continue</span>
            </div>
          </div>
          <button
            onClick={detectCameras}
            className="retry-button"
          >
            Try Again
          </button>
        </div>
      )}


      {/* Main Camera Interface */}
      {!loadingCameras && permissionState === 'granted' && (
        <>
          {/* Camera Feed */}
          {!videoURL && (
            <div className="camera-container">
              <Webcam
                key={selectedDeviceId}
                ref={webcamRef}
                audio
                muted
                videoConstraints={{
                  deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined
                }}
                className="webcam-video"
              />

              {/* Recording Indicator */}
              {recording && (
                <div className="recording-indicator">
                  <div className="recording-dot" />
                  REC {String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}
                </div>
              )}
            </div>
          )}

          {/* Video Preview */}
          {videoURL && (
            <div className="video-preview-container">
              <video
                src={videoURL}
                controls
                className="video-preview"
              />
            </div>
          )}

          {/* Control Panel */}
          <div className="control-panel">
            <div className="controls-container">
              {/* Video Controls */}
              {videoURL && !recording ? (
                <button
                  onClick={resetVideo}
                  className="btn-secondary"
                >
                  Record Again
                </button>
              ) : (
                /* Recording Controls */
                cameras.length > 0 && (
                  <>
                    {!recording ? (
                      <button
                        onClick={startRecording}
                        className="btn-primary"
                      >
                        <div className="record-button" />
                      </button>
                    ) : (
                      <button
                        onClick={stopRecording}
                        className="btn-primary"
                      >
                        <div className="stop-button" />
                      </button>
                    )}

                    {/* Camera Switch */}
                    {!recording && cameras.length > 1 && (
                      <button
                        onClick={switchCamera}
                        className="btn-switch"
                      >
                        🔄
                      </button>
                    )}
                  </>
                )
              )}
            </div>
          </div>
        </>
      )}

    </div>
  )
}

export default App