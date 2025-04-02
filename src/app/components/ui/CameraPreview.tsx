'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

interface CameraPreviewProps {
  onStreamReady?: (stream: MediaStream) => void;
  onError?: (error: Error) => void;
  width?: number;
  height?: number;
  videoRefProp?: React.RefObject<HTMLVideoElement | null>; // Accept ref from parent
}

const CameraPreview: React.FC<CameraPreviewProps> = ({
  onStreamReady,
  onError,
  width = 640, // Default width
  height = 480, // Default height
  videoRefProp, // Destructure the passed ref
}) => {
  // Use the passed ref if available, otherwise create an internal one (though parent usually provides it now)
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const videoRef = videoRefProp || internalVideoRef; // Use passed ref primarily

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const currentStreamRef = useRef<MediaStream | null>(null);

  // Function to stop the current stream
  const stopCurrentStream = useCallback(() => {
    if (currentStreamRef.current) {
      currentStreamRef.current.getTracks().forEach(track => track.stop());
      currentStreamRef.current = null;
      // Use the potentially external ref
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      console.log('Camera stream stopped.');
    }
  }, [videoRef]); // Added videoRef to dependency array

  // Get available video devices
  useEffect(() => {
    const getDevices = async () => {
      try {
        // Request permission first (can be silent if already granted)
        await navigator.mediaDevices.getUserMedia({ video: true });
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = allDevices.filter(device => device.kind === 'videoinput');
        setDevices(videoDevices);
        if (videoDevices.length > 0 && !selectedDeviceId) {
          // Select the first device by default, or maybe a preferred one if logic exists
          setSelectedDeviceId(videoDevices[0].deviceId);
        } else if (videoDevices.length === 0) {
          setError('No video input devices found.');
          onError?.(new Error('No video input devices found.'));
        }
      } catch (err) {
        console.error('Error enumerating devices:', err);
        let errorMessage = 'Error accessing media devices.';
        if (err instanceof Error) {
            if (err.name === 'NotAllowedError') {
                errorMessage = 'Camera permission denied. Please allow camera access in your browser settings.';
            } else if (err.name === 'NotFoundError') {
                errorMessage = 'No camera found on this device.';
            } else {
                 errorMessage = `Error accessing camera: ${err.message}`;
            }
        }
        setError(errorMessage);
        onError?.(new Error(errorMessage));
      }
    };
    getDevices();

    // Cleanup function to stop stream on unmount
    return () => {
      stopCurrentStream();
    };
  }, [onError, selectedDeviceId, stopCurrentStream]); // Re-run if selectedDeviceId changes (though handled below)

  // Start stream when selectedDeviceId changes
  useEffect(() => {
    if (!selectedDeviceId || devices.length === 0) {
      // Don't start if no device is selected or no devices available
      return;
    }

    const startStream = async () => {
      stopCurrentStream(); // Stop previous stream before starting new one
      console.log(`Attempting to start stream for device: ${selectedDeviceId}`);
      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: { exact: selectedDeviceId },
          width: { ideal: width }, // Use ideal to allow flexibility
          height: { ideal: height },
        },
        audio: false, // No audio needed
      };

      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        currentStreamRef.current = stream; // Store the current stream
        // Use the potentially external ref
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Ensure video plays (some browsers require interaction)
          videoRef.current.play().catch(playErr => {
            console.error("Error attempting to play video:", playErr);
            setError("Could not automatically play video. User interaction might be required.");
            onError?.(new Error("Could not automatically play video."));
          });
          console.log('Camera stream started successfully.');
          onStreamReady?.(stream); // Notify parent component
        }
      } catch (err) {
        console.error('Error starting stream:', err);
        let errorMessage = `Failed to start camera stream for device ${selectedDeviceId}.`;
         if (err instanceof Error) {
             errorMessage = `Error accessing camera (${selectedDeviceId}): ${err.message}`;
         }
        setError(errorMessage);
        onError?.(new Error(errorMessage));
        stopCurrentStream(); // Ensure cleanup if start fails
      }
    };

    startStream();

    // Cleanup function for this effect
    return () => {
      // The main cleanup in the first useEffect handles unmounting.
      // This could potentially stop the stream if the selected device ID changes
      // *before* unmounting, which is handled by stopCurrentStream() in startStream.
    };
  }, [selectedDeviceId, devices.length, width, height, onStreamReady, onError, stopCurrentStream, videoRef]); // Added videoRef to dependency array

  const handleDeviceChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedDeviceId(event.target.value);
    setError(null); // Clear previous errors on device change
  };

  return (
    <div className="camera-preview-container p-4 border rounded-lg shadow-md bg-white">
      {error && <p className="text-red-600 mb-2">Error: {error}</p>}
      {devices.length > 0 && (
        <div className="mb-4">
          <label htmlFor="camera-select" className="block text-sm font-medium text-gray-700 mb-1">
            Select Camera:
          </label>
          <select
            id="camera-select"
            value={selectedDeviceId}
            onChange={handleDeviceChange}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
            disabled={devices.length <= 1} // Disable if only one camera
          >
            {devices.map(device => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Camera ${devices.indexOf(device) + 1}`}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="relative" style={{ width: `${width}px`, height: `${height}px` }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted // Mute to avoid feedback loops if audio was enabled
          className="w-full h-full object-cover rounded border border-gray-300 bg-black"
          style={{ transform: 'scaleX(-1)' }} // Mirror the video feed
        />
        {/* Placeholder for region selector overlay */}
      </div>
       {/* Debug info */}
       {/* <div className="mt-2 text-xs text-gray-500">
         <p>Selected Device ID: {selectedDeviceId || 'None'}</p>
         <p>Stream Active: {currentStreamRef.current ? 'Yes' : 'No'}</p>
       </div> */}
    </div>
  );
};

export default CameraPreview;