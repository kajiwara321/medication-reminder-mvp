'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import CameraPreview from '@/app/components/ui/CameraPreview';
import RegionSelector from '@/app/components/ui/RegionSelector';
import NotificationDisplay from '@/app/components/ui/NotificationDisplay'; // Import NotificationDisplay
import { useSettings } from '@/app/hooks/useSettings';
import {
  captureRegionImageData,
  compareImageData,
  base64ToImageData,
} from '@/app/lib/imageUtils';

// Define the Region type
interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

const COMPARISON_INTERVAL = 1000; // Compare every 1 second
const DIFF_THRESHOLD = 10; // 10% difference threshold

export default function Home() {
  const {
    selectedRegion,
    baselineImageSrc,
    updateRegion,
    setBaseline,
    clearSettings,
    isInitialized,
  } = useSettings();

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [currentStream, setCurrentStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const comparisonCanvasRef = useRef<HTMLCanvasElement>(null);

  const [baselineImageData, setBaselineImageData] = useState<ImageData | null>(null);
  const [differencePercentage, setDifferencePercentage] = useState<number | null>(null);
  const [isMonitoring, setIsMonitoring] = useState<boolean>(false);
  const [lastDetectionStatus, setLastDetectionStatus] = useState<string>("Idle");

  // State for notifications
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);
  const [notificationType, setNotificationType] = useState<'info' | 'success' | 'warning' | 'error'>('info');
  const notificationTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Ref for notification timeout

  const cameraWidth = 640;
  const cameraHeight = 480;

  // Function to show a notification for a limited time
  const showNotification = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info', duration: number = 5000) => {
    setNotificationMessage(message);
    setNotificationType(type);

    // Clear previous timeout if exists
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
    }

    // Set new timeout to clear the notification
    notificationTimeoutRef.current = setTimeout(() => {
      setNotificationMessage(null);
      notificationTimeoutRef.current = null;
    }, duration);
  };

   // Clear notification timeout on unmount
   useEffect(() => {
    return () => {
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
    };
  }, []);


  // Convert baselineImageSrc to ImageData
  useEffect(() => {
    if (baselineImageSrc && comparisonCanvasRef.current) {
      base64ToImageData(baselineImageSrc, comparisonCanvasRef.current)
        .then(imgData => {
          if (imgData) {
            setBaselineImageData(imgData);
            setIsMonitoring(true);
            showNotification("Baseline set. Monitoring started.", "success");
          } else {
            setBaselineImageData(null);
            setIsMonitoring(false);
             showNotification("Failed to process baseline image.", "error");
          }
        });
    } else {
      setBaselineImageData(null);
      setIsMonitoring(false);
      setDifferencePercentage(null);
      setLastDetectionStatus("Idle");
      if (isInitialized) { // Only show notification if settings were already loaded
         // Don't show notification on initial load if baseline wasn't set
         // showNotification("Baseline cleared. Monitoring stopped.", "info");
      }
    }
  }, [baselineImageSrc, isInitialized]); // Added isInitialized dependency

  // Periodic comparison effect
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    let changeDetectedPreviously = false; // Track if change was detected in the previous interval

    if (isMonitoring && baselineImageData && selectedRegion && videoRef.current && comparisonCanvasRef.current) {
      const videoElement = videoRef.current;
      const canvasElement = comparisonCanvasRef.current;

      intervalId = setInterval(() => {
        const currentImageData = captureRegionImageData(videoElement, selectedRegion, canvasElement);

        if (currentImageData) {
          const diffPercent = compareImageData(baselineImageData, currentImageData);

          if (diffPercent >= 0) {
            setDifferencePercentage(diffPercent);
            const changeDetectedNow = diffPercent > DIFF_THRESHOLD;

            if (changeDetectedNow) {
              setLastDetectionStatus(`Change Detected (${diffPercent.toFixed(1)}%)`);
              if (!changeDetectedPreviously) {
                 // Only show notification on the *first* detection of change
                 showNotification("Change detected! Medication might have been taken.", "warning");
              }
              changeDetectedPreviously = true;
            } else {
              setLastDetectionStatus(`No Significant Change (${diffPercent.toFixed(1)}%)`);
              if (changeDetectedPreviously) {
                 // Optionally notify when state returns to normal
                 // showNotification("Area returned to baseline state.", "info");
              }
              changeDetectedPreviously = false;
            }
          } else {
            setDifferencePercentage(null);
            setLastDetectionStatus("Comparison Error");
            changeDetectedPreviously = false; // Reset on error
          }
        } else {
          setDifferencePercentage(null);
          setLastDetectionStatus("Capture Error");
          changeDetectedPreviously = false; // Reset on error
        }
      }, COMPARISON_INTERVAL);

    } else {
       // Reset status if monitoring stops
       setDifferencePercentage(null);
       setLastDetectionStatus(baselineImageSrc ? "Waiting for baseline processing..." : "Idle");
       changeDetectedPreviously = false;
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isMonitoring, baselineImageData, selectedRegion, videoRef, comparisonCanvasRef]);


  const handleStreamReady = useCallback((stream: MediaStream) => {
    setCurrentStream(stream);
    setCameraError(null);
  }, []);

  const handleError = useCallback((error: Error) => {
    setCameraError(error.message);
    setCurrentStream(null);
    setIsMonitoring(false);
    showNotification(`Camera Error: ${error.message}`, "error");
  }, []);

  const captureBaseline = useCallback(() => {
    if (!videoRef.current || !selectedRegion || !canvasRef.current) {
      showNotification('Please select a region first and ensure the camera is active.', 'error');
      return;
    }
    // ... (rest of capture logic remains the same)
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = selectedRegion.width;
    canvas.height = selectedRegion.height;
    try {
      const sourceX = video.videoWidth - selectedRegion.x - selectedRegion.width;
      ctx.drawImage(video, sourceX, selectedRegion.y, selectedRegion.width, selectedRegion.height, 0, 0, selectedRegion.width, selectedRegion.height);
      const imageDataUrl = canvas.toDataURL('image/png');
      setBaseline(imageDataUrl); // This triggers the useEffect to process and start monitoring
      // Notification is handled in the useEffect for baselineImageSrc
    } catch (error) {
      console.error("Error capturing baseline:", error);
      showNotification("Failed to capture baseline image.", "error");
    }
  }, [videoRef, selectedRegion, canvasRef, setBaseline]);

  const clearBaseline = useCallback(() => {
    setBaseline(null); // This triggers the useEffect to stop monitoring
    showNotification("Baseline cleared. Monitoring stopped.", "info");
  }, [setBaseline]);

  const handleClearAllSettings = useCallback(() => {
    clearSettings(); // This clears region and baseline src
    showNotification("All settings cleared.", "info");
  }, [clearSettings]);

  useEffect(() => {
    if (isInitialized) console.log('Settings loaded.');
  }, [isInitialized]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 sm:p-12 bg-gray-50">
      <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
      <canvas ref={comparisonCanvasRef} style={{ display: 'none' }}></canvas>

      <div className="w-full max-w-3xl bg-white p-6 sm:p-8 rounded-xl shadow-lg">
        <h1 className="text-2xl sm:text-3xl font-bold mb-4 text-center text-gray-800">
          Medication Reminder
        </h1>

        {/* Notification Area */}
        <div className="mb-4 h-12"> {/* Reserve space for notification */}
            <NotificationDisplay message={notificationMessage} type={notificationType} />
        </div>

        <p className="text-center text-gray-600 mb-4">
          {cameraError ? 'Error accessing camera.' : isMonitoring ? 'Monitoring area...' : baselineImageSrc ? 'Baseline set. Ready to monitor.' : 'Select medication area and set baseline.'}
        </p>

        <div className="flex justify-center mb-4">
          <div className="relative">
            <CameraPreview
              videoRefProp={videoRef}
              onStreamReady={handleStreamReady}
              onError={handleError}
              width={cameraWidth}
              height={cameraHeight}
            />
            <RegionSelector
              onRegionChange={updateRegion}
              containerWidth={cameraWidth}
              containerHeight={cameraHeight}
              disabled={!!cameraError || !isInitialized || isMonitoring}
              initialRegion={selectedRegion}
            />
          </div>
        </div>

        <div className="flex justify-center space-x-4 mb-6">
          <button onClick={captureBaseline} disabled={!selectedRegion || !!cameraError || !isInitialized || isMonitoring} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed">
            Set Baseline
          </button>
          <button onClick={clearBaseline} disabled={!baselineImageSrc || !isInitialized} className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:bg-gray-400 disabled:cursor-not-allowed">
            Clear Baseline
          </button>
          <button onClick={handleClearAllSettings} disabled={!isInitialized} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed">
            Clear All Settings
          </button>
        </div>

        <div className="mt-4 text-center text-sm text-gray-600 border-t pt-4">
          <h2 className="font-semibold mb-2">Status & Settings</h2>
          {/* ... (Status display remains largely the same) ... */}
           {!isInitialized && <p>Loading settings...</p>}
           {isInitialized && cameraError && <p className="text-red-600">Camera Error: {cameraError}</p>}
           {isInitialized && !cameraError && <p>Camera: Active</p>}
           {isInitialized && selectedRegion && <p>Region Selected: Yes (w: {selectedRegion.width.toFixed(0)}, h: {selectedRegion.height.toFixed(0)})</p>}
           {isInitialized && !selectedRegion && <p>Region Selected: No</p>}
           {isInitialized && baselineImageSrc && (
             <div className="mt-2 inline-block align-top mr-4">
               <p className="font-medium">Baseline:</p>
               <img src={baselineImageSrc} alt="Baseline Preview" className="mx-auto mt-1 border border-gray-300" style={{ maxWidth: '80px', maxHeight: '80px' }} />
             </div>
           )}
            {isInitialized && !baselineImageSrc && <p className="inline-block align-top mr-4">Baseline: Not Set</p>}

            {/* Monitoring Status */}
            <div className={`mt-2 inline-block align-top p-2 rounded ${isMonitoring ? 'bg-green-100' : 'bg-gray-100'}`}>
                 <p className="font-semibold">{isMonitoring ? 'Monitoring Active' : 'Monitoring Idle'}</p>
                 {isMonitoring && (
                     <>
                         <p>Difference: {differencePercentage !== null ? `${differencePercentage.toFixed(2)}%` : 'N/A'}</p>
                         <p>Status: {lastDetectionStatus}</p>
                     </>
                 )}
            </div>
        </div>
      </div>
    </main>
  );
}
