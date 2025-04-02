'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic'; // Import dynamic
// import CameraPreview from '@/app/components/ui/CameraPreview'; // Remove static import
import RegionSelector from '@/app/components/ui/RegionSelector';
import NotificationDisplay from '@/app/components/ui/NotificationDisplay';
// Import types and hook (useSettings will be adapted later)
import { Region, BaselineData, DetectionStatus, DifferencePercentage } from '@/app/lib/types';
// import { useSettings } from '@/app/hooks/useSettings'; // Temporarily disable direct use
import {
  captureRegionImageData,
  compareImageData,
  base64ToImageData,
} from '@/app/lib/imageUtils';


const COMPARISON_INTERVAL = 1000; // Compare every 1 second
const DIFF_THRESHOLD = 10; // 10% difference threshold
const GRID_ROWS = 7;
const GRID_COLS = 4;

// Dynamically import CameraPreview with SSR disabled
const CameraPreview = dynamic(() => import('@/app/components/ui/CameraPreview'), {
  ssr: false,
  loading: () => <div className="w-[640px] h-[480px] bg-gray-200 flex items-center justify-center text-gray-500">Loading Camera...</div>, // Optional loading state
});

export default function Home() {
  // --- Settings Hook (will be adapted later) ---
  // const {
  //   loadSettings, // Function to load from storage
  //   saveSettings, // Function to save to storage
  //   isInitialized,
  // } = useSettings(); // Placeholder for now

  const isInitialized = true; // Assume initialized for now

  // --- Component State ---
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [currentStream, setCurrentStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null); // Used for capturing images
  const comparisonCanvasRef = useRef<HTMLCanvasElement>(null); // Used for processing images

  // --- Grid and Region State ---
  const [masterRegion, setMasterRegion] = useState<Region | null>(null); // The single region selected by the user
  const [gridCells, setGridCells] = useState<Region[]>([]); // Array of 28 calculated grid cells

  // --- Baseline and Detection State (per cell) ---
  const [baselineImages, setBaselineImages] = useState<BaselineData>({}); // Base64 images keyed by cell ID
  const [baselineImageDatas, setBaselineImageDatas] = useState<Record<string, ImageData | null>>({}); // ImageData keyed by cell ID
  const [differencePercentages, setDifferencePercentages] = useState<DifferencePercentage>({}); // Difference keyed by cell ID
  const [detectionStatuses, setDetectionStatuses] = useState<DetectionStatus>({}); // Status string keyed by cell ID

  // --- UI State ---
  const [isMonitoring, setIsMonitoring] = useState<boolean>(false); // Overall monitoring status flag
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);
  const [notificationType, setNotificationType] = useState<'info' | 'success' | 'warning' | 'error'>('info');
  const notificationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const cameraWidth = 640;
  const cameraHeight = 480;

  // --- Utility Functions ---

  // Function to show a notification
  const showNotification = useCallback((message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info', duration: number = 5000) => {
    setNotificationMessage(message);
    setNotificationType(type);
    if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current);
    notificationTimeoutRef.current = setTimeout(() => {
      setNotificationMessage(null);
      notificationTimeoutRef.current = null;
    }, duration);
  }, []); // useCallback to memoize

  // Clear notification timeout on unmount
  useEffect(() => {
    return () => { if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current); };
  }, []);

  // --- Grid Calculation ---
  const generateGridCells = useCallback((master: Region): Region[] => {
    const cells: Region[] = [];
    const cellWidth = master.width / GRID_COLS;
    const cellHeight = master.height / GRID_ROWS;
    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const timeLabels = ['AM', 'Lunch', 'PM', 'Night']; // Adjusted labels

    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const cellId = `cell-${r}-${c}`;
        const cellX = master.x + c * cellWidth;
        const cellY = master.y + r * cellHeight;
        const cellLabel = `${dayLabels[r]}-${timeLabels[c]}`;
        cells.push({
          id: cellId,
          x: cellX,
          y: cellY,
          width: cellWidth,
          height: cellHeight,
          row: r,
          col: c,
          label: cellLabel,
        });
      }
    }
    console.log("Generated Grid Cells:", cells); // Debug log
    return cells;
  }, []); // No dependencies needed if GRID constants are stable

  // Effect to generate grid cells when masterRegion changes
  useEffect(() => {
    if (masterRegion) {
      const newGridCells = generateGridCells(masterRegion);
      setGridCells(newGridCells);
      // Reset statuses when grid changes
      setBaselineImages({});
      setBaselineImageDatas({});
      setDifferencePercentages({});
      const initialStatuses: DetectionStatus = {};
      newGridCells.forEach(cell => { initialStatuses[cell.id] = "No Baseline"; });
      setDetectionStatuses(initialStatuses);
      setIsMonitoring(false); // Stop monitoring until new baselines are set
      showNotification("Master region set. Grid generated. Set baselines to start monitoring.", "info");
    } else {
      setGridCells([]); // Clear grid if master region is cleared
    }
  }, [masterRegion, generateGridCells, showNotification]);


  // --- Baseline Processing ---
  // Effect to convert Base64 baseline images to ImageData
  useEffect(() => {
    // Ensure canvas ref is available and there are baseline strings to process
    if (!comparisonCanvasRef.current || Object.keys(baselineImages).length === 0) {
      // If no baselines strings exist, clear any existing ImageData
      if (Object.keys(baselineImageDatas).length > 0) {
        console.log("Clearing existing baseline ImageData.");
        setBaselineImageDatas({});
      }
      // Ensure monitoring is off if no baselines are set
      setIsMonitoring(false);
      // Update statuses to reflect no baseline
      setDetectionStatuses(prev => {
        const newStatuses = { ...prev };
        gridCells.forEach(cell => {
          if (newStatuses[cell.id] !== "No Baseline") {
            newStatuses[cell.id] = "No Baseline";
          }
        });
        return newStatuses;
      });
      return; // Exit early
    }

    console.log("Processing baselines from state...");
    const newBaselineImageDatas: Record<string, ImageData | null> = {};
    const promises: Promise<void>[] = [];
    let processedCount = 0;

    // Process each baseline string associated with a grid cell
    gridCells.forEach(cell => {
      const base64Src = baselineImages[cell.id];
      if (base64Src) {
        promises.push(
          base64ToImageData(base64Src, comparisonCanvasRef.current!)
            .then(imgData => {
              if (imgData) {
                newBaselineImageDatas[cell.id] = imgData;
                processedCount++;
              } else {
                console.error(`Failed to convert baseline Base64 for cell ${cell.label}.`);
                newBaselineImageDatas[cell.id] = null;
                // Update status immediately for this specific cell on error
                setDetectionStatuses(prev => ({ ...prev, [cell.id]: "Baseline Error" }));
              }
            })
        );
      } else {
        // Ensure entry exists even if null (important for status updates)
        newBaselineImageDatas[cell.id] = null;
      }
    });

    // After all conversions attempt to finish
    Promise.all(promises).then(() => {
      console.log(`Finished processing ${promises.length} baselines. ${processedCount} successful.`);
      setBaselineImageDatas(newBaselineImageDatas); // Update state with processed ImageData
      console.log("Set baselineImageDatas state:", newBaselineImageDatas); // Log the processed ImageData

      // Update detection statuses based on the processing results
      setDetectionStatuses(prev => {
        const newStatuses = { ...prev };
        gridCells.forEach(cell => {
          const hasProcessedBaseline = !!newBaselineImageDatas[cell.id];
          // Update status if it was previously 'No Baseline' or 'Baseline Error'
          if (prev[cell.id] === "No Baseline" || prev[cell.id] === "Baseline Error") {
            newStatuses[cell.id] = hasProcessedBaseline ? "Monitoring Idle" : "No Baseline";
          } else if (!hasProcessedBaseline && prev[cell.id] !== "No Baseline") {
            // If baseline was removed/failed, ensure status reflects 'No Baseline'
             newStatuses[cell.id] = "No Baseline";
          }
          // Keep existing status like "Change Detected" if baseline is still valid
        });
        // Clean up statuses for cells that no longer exist (if gridCells could change dynamically)
        Object.keys(newStatuses).forEach(id => {
            if (!gridCells.some(cell => cell.id === id)) {
                delete newStatuses[id];
            }
        });
        return newStatuses;
      });

      // Determine if monitoring should be active
      const monitoringShouldStart = processedCount > 0;
      setIsMonitoring(monitoringShouldStart);

      // Provide user feedback via notifications
      if (monitoringShouldStart) {
        console.log("Monitoring started for processed cells.");
        showNotification(`Baselines processed (${processedCount}/${gridCells.length}). Monitoring started.`, "success");
      } else if (Object.keys(baselineImages).length > 0) {
        // This case means baselines were set but all failed processing
        console.log("Baseline processing failed for all cells.");
        showNotification("Failed to process all baseline images. Please try setting them again.", "error");
      } else {
        // This case means no baselines were set in the first place
        console.log("No baselines to process.");
        // Optionally clear notification or set to idle message
        // showNotification("Ready to set baselines.", "info");
      }
    });

    // Dependency array: run when baseline strings change, grid definition changes, or canvas ref becomes available
  }, [baselineImages, gridCells, comparisonCanvasRef, showNotification]);


  // --- Periodic Comparison ---
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    // Track previous detection state per cell to notify only on change
    const changeDetectedPreviously: Record<string, boolean> = {};

    // Determine which cells have valid baseline ImageData and should be monitored
    const cellsToMonitor = gridCells.filter(cell => baselineImageDatas[cell.id]);

    // Start interval only if monitoring is enabled, refs are ready, and there are cells to monitor
    if (isMonitoring && videoRef.current && comparisonCanvasRef.current && cellsToMonitor.length > 0) {
      const videoElement = videoRef.current;
      const canvasElement = comparisonCanvasRef.current; // Use the comparison canvas

      console.log(`Starting monitoring interval for ${cellsToMonitor.length} cells.`);

      intervalId = setInterval(() => {
        const newDiffs: DifferencePercentage = {};
        const newStatuses: DetectionStatus = {};

        // Process each cell that has a valid baseline
        cellsToMonitor.forEach(cell => {
          let statusString = ""; // Define statusString at the beginning of the loop
          const baselineData = baselineImageDatas[cell.id]; // Already filtered, should exist
          let diffPercent: number | null = null; // Define diffPercent here for logging scope
          const cellLabel = cell.label || `Cell ${cell.id.substring(0, 6)}`; // Define cellLabel here

          if (!baselineData) {
            // Safety check, should ideally not happen
            console.error(`Missing baseline ImageData for cell ${cellLabel} during monitoring loop.`);
            statusString = "Error: Baseline data missing";
            newStatuses[cell.id] = statusString;
            newDiffs[cell.id] = null;
            // Log the result for this cell inside the loop
            console.log(`Cell ${cellLabel}: Diff: N/A, Status: ${statusString}`);
            return; // Skip this cell
          }

          // Capture current image data for the cell region
          const currentImageData = captureRegionImageData(videoElement, cell, canvasElement);

          if (currentImageData) {
            // Compare current image with baseline
            diffPercent = compareImageData(baselineData, currentImageData); // Assign to loop-scoped variable
            newDiffs[cell.id] = diffPercent >= 0 ? diffPercent : null; // Store percentage or null on error

            if (diffPercent >= 0) {
              const changeDetectedNow = diffPercent > DIFF_THRESHOLD;
              // cellLabel is already defined above

              // Update status based on threshold
              if (changeDetectedNow) {
                statusString = `Change Detected (${diffPercent.toFixed(1)}%)`;
                newStatuses[cell.id] = statusString;
                // Trigger notification only when the state changes to detected
                if (!changeDetectedPreviously[cell.id]) {
                  showNotification(`Change detected in ${cellLabel}!`, "warning");
                }
                changeDetectedPreviously[cell.id] = true; // Mark as detected for next interval
              } else {
                statusString = `No Change (${diffPercent.toFixed(1)}%)`;
                newStatuses[cell.id] = statusString;
                // Optional: Notify on return to baseline state
                // if (changeDetectedPreviously[cell.id]) { showNotification(`${cellLabel} returned to baseline.`, "info"); }
                changeDetectedPreviously[cell.id] = false; // Mark as not detected
              }
            } else {
              // Comparison function returned an error code
              statusString = "Comparison Error";
              newStatuses[cell.id] = statusString;
              changeDetectedPreviously[cell.id] = false;
            }
          } else {
            // Failed to capture current image data
            statusString = "Capture Error";
            newStatuses[cell.id] = statusString;
            newDiffs[cell.id] = null;
            changeDetectedPreviously[cell.id] = false;
          }
           // Log the result for this cell inside the loop
           console.log(`Cell ${cellLabel}: Diff: ${diffPercent?.toFixed(1) ?? 'N/A'}%, Status: ${statusString}`);
        }); // End of cellsToMonitor.forEach

        // Batch update states for performance
        setDifferencePercentages(prev => ({ ...prev, ...newDiffs }));
        setDetectionStatuses(prev => ({ ...prev, ...newStatuses }));

      }, COMPARISON_INTERVAL);

    } else {
      // If monitoring is stopped or conditions aren't met, ensure statuses reflect this
      if (!isMonitoring && gridCells.length > 0) {
        console.log("Monitoring stopped or conditions not met. Setting statuses to Idle/No Baseline.");
        setDetectionStatuses(prev => {
          const idleStatuses: DetectionStatus = {};
          gridCells.forEach(cell => {
            // Keep existing status if it's an error, otherwise set based on baseline presence
            if (prev[cell.id]?.includes("Error")) {
                 idleStatuses[cell.id] = prev[cell.id];
            } else {
                 idleStatuses[cell.id] = baselineImages[cell.id] ? "Monitoring Idle" : "No Baseline";
            }
          });
          return idleStatuses;
        });
        // Clear percentages when not actively monitoring
        setDifferencePercentages({});
      }
    }

    // Cleanup function: clear interval when component unmounts or dependencies change
    return () => {
      if (intervalId) {
        console.log("Clearing monitoring interval.");
        clearInterval(intervalId);
      }
    };
    // Dependencies: monitoring flag, processed baseline data, grid definition, refs, notification function
  }, [isMonitoring, baselineImageDatas, gridCells, videoRef, comparisonCanvasRef, showNotification, baselineImages]); // Added baselineImages to update idle status correctly


  // --- Camera Callbacks ---
  const handleStreamReady = useCallback((stream: MediaStream) => {
    setCurrentStream(stream);
    setCameraError(null);
  }, []);

  const handleError = useCallback((error: Error) => {
    setCameraError(error.message);
    setCurrentStream(null);
    setIsMonitoring(false); // Stop monitoring on camera error
    setMasterRegion(null); // Clear region on error
    setGridCells([]);
    showNotification(`Camera Error: ${error.message}`, "error");
  }, [showNotification]); // Added showNotification dependency


  // --- Action Handlers ---

  // Called by RegionSelector when the user finishes drawing/selecting the master region
  const handleMasterRegionChange = useCallback((region: Region | null) => {
     console.log("Master Region Changed:", region); // Debug log
     setMasterRegion(region);
     // Grid generation is handled by the useEffect watching masterRegion
  }, []);


  // Capture baselines for all defined grid cells
  const captureAllBaselines = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || gridCells.length === 0) {
      showNotification('Camera not ready or no grid defined.', 'error');
      return;
    }
    const video = videoRef.current;
    const canvas = canvasRef.current; // Use the single canvas for capture
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    console.log(`Capturing baselines for ${gridCells.length} cells...`);
    const newBaselines: BaselineData = {};
    let captureErrors = 0;

    gridCells.forEach(cell => {
      try {
        // Adjust canvas size for each cell, ensuring integer dimensions
        const cellWidthInt = Math.max(1, Math.round(cell.width));
        const cellHeightInt = Math.max(1, Math.round(cell.height));
        canvas.width = cellWidthInt; // Use rounded integer
        canvas.height = cellHeightInt; // Use rounded integer

        // Calculate source x based on video width (assuming non-mirrored preview)
        // Ensure coordinates are within video bounds
        const sourceX = Math.max(0, Math.min(video.videoWidth - cellWidthInt, Math.round(video.videoWidth - cell.x - cell.width)));
        const sourceY = Math.max(0, Math.min(video.videoHeight - cellHeightInt, Math.round(cell.y)));

        // Use rounded integer dimensions for drawing
        ctx.drawImage(video, sourceX, sourceY, cellWidthInt, cellHeightInt, 0, 0, cellWidthInt, cellHeightInt);
        newBaselines[cell.id] = canvas.toDataURL('image/png');
      } catch (error) {
        console.error(`Error capturing baseline for cell ${cell.label}:`, error);
        newBaselines[cell.id] = null; // Mark as null on error
        captureErrors++;
      }
    });

    setBaselineImages(newBaselines); // Update state, triggering the processing useEffect
    console.log("Set baselineImages state with captured Base64 data:", Object.keys(newBaselines).length, "images"); // Log after setting state
    // Notification is handled in the baseline processing useEffect

    if (captureErrors > 0) {
        showNotification(`Captured baselines for ${gridCells.length - captureErrors} cells. ${captureErrors} errors occurred.`, "warning");
    } else {
        // Success notification will be shown after processing
        console.log("Baseline capture initiated.");
    }

  }, [videoRef, canvasRef, gridCells, showNotification]); // Dependencies


  // Clear all baselines
  const clearAllBaselines = useCallback(() => {
    setBaselineImages({}); // Clear base64 images, triggers processing useEffect to clear ImageData
    setIsMonitoring(false); // Stop monitoring
    setDifferencePercentages({});
    // Set statuses to "No Baseline"
    setDetectionStatuses(prev => {
        const clearedStatuses: DetectionStatus = {};
        gridCells.forEach(cell => { clearedStatuses[cell.id] = "No Baseline"; }); // Update based on current gridCells
        return clearedStatuses;
    });
    showNotification("All baselines cleared. Monitoring stopped.", "info");
  }, [showNotification, gridCells]); // Added gridCells dependency


  // Clear everything: master region, grid, baselines, statuses
  const handleClearAllSettings = useCallback(() => {
    setMasterRegion(null); // Clears master region, triggers useEffect to clear grid
    // No need to clear gridCells explicitly, handled by useEffect
    setBaselineImages({}); // Triggers useEffect to clear processed baselines
    setIsMonitoring(false);
    setDifferencePercentages({});
    setDetectionStatuses({});
    // Potentially clear settings from storage via useSettings hook later
    showNotification("All settings cleared.", "info");
  }, [showNotification]); // Added showNotification


  // --- Initial Load / Placeholder ---
  useEffect(() => {
    // Placeholder for loading settings from storage via useSettings hook
    if (isInitialized) {
        console.log('Settings assumed loaded (placeholder).');
        // Example: Load masterRegion and baselineImages from storage here
        // const loadedSettings = loadSettings();
        // if (loadedSettings.masterRegion) setMasterRegion(loadedSettings.masterRegion);
        // if (loadedSettings.baselineImages) setBaselineImages(loadedSettings.baselineImages);
    }
  }, [isInitialized]); // Placeholder dependency


  // --- Render ---
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 sm:p-12 bg-gray-50">
      {/* Hidden canvases for image processing */}
      <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
      <canvas ref={comparisonCanvasRef} style={{ display: 'none' }}></canvas>

      {/* Further increased max-width and adjusted panel widths */}
      <div className="w-full max-w-7xl bg-white p-6 sm:p-8 rounded-xl shadow-lg flex space-x-6"> {/* Increased to 7xl, reduced spacing */}

         {/* Left Panel: Camera and Controls */}
         <div className="w-3/5"> {/* Set specific width for left panel */}
             <h1 className="text-2xl sm:text-3xl font-bold mb-4 text-center text-gray-800">
                 Medication Monitor (Grid Mode)
             </h1>
             <div className="mb-4 h-12"><NotificationDisplay message={notificationMessage} type={notificationType} /></div>
             <p className="text-center text-gray-600 mb-4">
                 {cameraError ? 'Error accessing camera.' : masterRegion ? 'Drag to adjust master region or set baselines.' : 'Click and drag on video to define the calendar area.'}
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
                     {/* RegionSelector now handles the master region and displays grid */}
                     <RegionSelector
                         onRegionChange={handleMasterRegionChange} // Pass the correct handler
                         containerWidth={cameraWidth}
                         containerHeight={cameraHeight}
                         disabled={!!cameraError || !isInitialized || isMonitoring} // Disable if monitoring active
                         initialRegion={masterRegion} // Pass masterRegion state
                         showGrid={!!masterRegion} // Control grid visibility
                         gridRows={GRID_ROWS}
                         gridCols={GRID_COLS}
                         baselinesAreSet={Object.keys(baselineImages).length > 0} // Pass baseline status
                     />
                 </div>
             </div>
             {/* Action Buttons */}
             <div className="flex justify-center space-x-4 mb-6">
                 {/* Changed captureBaseline to captureAllBaselines */}
                 <button onClick={captureAllBaselines} disabled={!masterRegion || !!cameraError || !isInitialized} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400">
                     Set All Baselines
                 </button>
                 {/* Changed clearBaseline to clearAllBaselines */}
                 <button onClick={clearAllBaselines} disabled={Object.keys(baselineImages).length === 0 || !isInitialized} className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:bg-gray-400">
                     Clear All Baselines
                 </button>
                 {/* Updated disabled condition for Clear All Settings */}
                 <button onClick={handleClearAllSettings} disabled={!masterRegion && Object.keys(baselineImages).length === 0 || !isInitialized} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400">
                     Clear All Settings
                 </button>
             </div>
         </div>

         {/* Right Panel: Grid Status Display */}
         <div className="w-2/5 flex flex-col space-y-4"> {/* Increased width for right panel */}
             <h2 className="text-xl font-semibold border-b pb-2">Grid Cell Status</h2>
             {!isInitialized && <p className="text-gray-500 text-sm">Loading settings...</p>}
             {/* Show message when no master region is defined */}
             {isInitialized && !masterRegion && <p className="text-gray-500 text-sm">Define master region using the camera view.</p>}
             {/* Show message when master region is defined but grid hasn't been generated yet (should be quick) */}
             {isInitialized && masterRegion && gridCells.length === 0 && <p className="text-gray-500 text-sm">Generating grid...</p>}

             {/* Grid Display Area - Use Tailwind Grid for layout */}
             {isInitialized && gridCells.length > 0 && (
                 <div className="flex-grow overflow-y-auto border rounded p-2 bg-gray-50 max-h-[calc(100vh-300px)]"> {/* Adjusted max-height */}
                     {/* Dynamically set grid columns based on GRID_COLS */}
                     {/* Ensure Tailwind JIT recognizes grid-cols-4 */}
                     <div className={`grid gap-2 grid-cols-4`}>
                         {gridCells.map((cell) => {
                             const status = detectionStatuses[cell.id] || "Unknown";
                             const diff = differencePercentages[cell.id];
                             const baselineSet = !!baselineImages[cell.id]; // Check if baseline string exists
                             const baselineProcessed = !!baselineImageDatas[cell.id]; // Check if ImageData exists

                             // Determine background and text color based on status
                             let bgColor = 'bg-white';
                             let textColor = 'text-gray-800'; // Default text color for better contrast
                             if (status.includes("Change Detected")) {
                                 bgColor = 'bg-yellow-200';
                                 textColor = 'text-yellow-900';
                             } else if (status === "No Baseline") {
                                 bgColor = 'bg-gray-200';
                                 textColor = 'text-gray-600';
                             } else if (status === "Baseline Error") {
                                 bgColor = 'bg-red-200';
                                 textColor = 'text-red-900';
                             } else if (baselineProcessed) {
                                 bgColor = 'bg-green-100';
                                 textColor = 'text-green-900';
                             } else if (baselineSet) {
                                 bgColor = 'bg-blue-100';
                                 textColor = 'text-blue-900';
                             }


                             return (
                                 <div key={cell.id} className={`p-1.5 border rounded text-xs ${bgColor} ${textColor} transition-colors duration-200 flex flex-col justify-between min-h-[60px]`}> {/* Added padding, flex, min-height and text color */}
                                     <p className="font-semibold truncate" title={cell.label}>{cell.label}</p>
                                     <p>Status: {status}</p>
                                     {/* Show difference only if monitoring and baseline is processed */}
                                     {(isMonitoring && baselineProcessed && diff !== null && diff !== undefined) && <p>Diff: {diff.toFixed(1)}%</p>}
                                     {/* Indicate if baseline is set but not yet processed */}
                                     {baselineSet && !baselineProcessed && status !== "Baseline Error" && <p className="text-blue-700 italic">Processing...</p>}
                                     {/* Indicate clearly if no baseline was ever set */}
                                     {!baselineSet && status === "No Baseline" && <p className="text-gray-500 italic">Not Set</p>}
                                 </div>
                             );
                         })}
                     </div>
                 </div>
             )}
         </div>
      </div>
    </main>
  );
}
