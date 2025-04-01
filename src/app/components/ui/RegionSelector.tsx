'use client';

import React, { useState, useRef, useCallback, MouseEvent } from 'react';

interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface RegionSelectorProps {
  onRegionChange: (region: Region | null) => void;
  containerWidth: number;
  containerHeight: number;
  disabled?: boolean; // Optional prop to disable selection
  initialRegion?: Region | null; // Add prop to display saved region
}

const RegionSelector: React.FC<RegionSelectorProps> = ({
  onRegionChange,
  containerWidth,
  containerHeight,
  disabled = false,
  initialRegion = null, // Default to null
}) => {
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [currentRect, setCurrentRect] = useState<Region | null>(null); // This is for the *drawing* rect
  const containerRef = useRef<HTMLDivElement>(null);

  // Determine the rectangle to display: drawing rect if active, otherwise the initial/saved one
  const displayRect = isDrawing ? currentRect : initialRegion;

  const getCoordinates = (event: MouseEvent<HTMLDivElement>): { x: number; y: number } => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    // Adjust for potential scaling or transforms if necessary, but basic case:
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    // Clamp coordinates within the container bounds
    return {
      x: Math.max(0, Math.min(x, containerWidth)),
      y: Math.max(0, Math.min(y, containerHeight)),
    };
  };

  const handleMouseDown = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (disabled) return;
    event.preventDefault();
    const coords = getCoordinates(event);
    setIsDrawing(true);
    setStartPoint(coords);
    setCurrentRect({ ...coords, width: 0, height: 0 }); // Start drawing
    onRegionChange(null); // Clear previous region when starting new one
    console.log('Mouse Down:', coords);
  }, [disabled, onRegionChange, containerWidth, containerHeight]); // Added dependencies

  const handleMouseMove = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !startPoint || disabled) return;
    event.preventDefault();
    const currentCoords = getCoordinates(event);
    const width = Math.abs(currentCoords.x - startPoint.x);
    const height = Math.abs(currentCoords.y - startPoint.y);
    const newRect: Region = {
      x: Math.min(startPoint.x, currentCoords.x),
      y: Math.min(startPoint.y, currentCoords.y),
      width: width,
      height: height,
    };
    setCurrentRect(newRect);
    // Optionally call onRegionChange during move, or wait until mouse up
    // console.log('Mouse Move - Rect:', newRect);
  }, [isDrawing, startPoint, disabled, containerWidth, containerHeight]); // Added dependencies

  const handleMouseUp = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || disabled) return;
    event.preventDefault();
    setIsDrawing(false);
    setStartPoint(null);
    if (currentRect && (currentRect.width > 5 && currentRect.height > 5)) { // Minimum size threshold
      console.log('Mouse Up - Final Rect:', currentRect);
      onRegionChange(currentRect);
    } else {
      // If the rectangle is too small, consider it a click and clear the selection
      console.log('Mouse Up - Rect too small, clearing.');
      setCurrentRect(null);
      onRegionChange(null);
    }
  }, [isDrawing, disabled, currentRect, onRegionChange]);

  const handleMouseLeave = useCallback((event: MouseEvent<HTMLDivElement>) => {
    // If drawing and mouse leaves container, finalize the drawing
    if (isDrawing) {
        handleMouseUp(event);
    }
  }, [isDrawing, handleMouseUp]);


  return (
    <div
      ref={containerRef}
      className="absolute top-0 left-0 cursor-crosshair"
      style={{ width: `${containerWidth}px`, height: `${containerHeight}px`, touchAction: 'none' }} // touchAction for mobile potentially
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave} // Handle mouse leaving the area while drawing
    >
      {/* Display either the drawing rectangle or the initial/saved one */}
      {displayRect && (
        <div
          className={`absolute border-2 ${isDrawing ? 'border-dashed border-red-500 bg-red-500 bg-opacity-20' : 'border-solid border-blue-500 bg-blue-500 bg-opacity-10'} pointer-events-none`}
          style={{
            left: `${displayRect.x}px`,
            top: `${displayRect.y}px`,
            width: `${displayRect.width}px`,
            height: `${displayRect.height}px`,
          }}
        />
      )}
    </div>
  );
};

export default RegionSelector;