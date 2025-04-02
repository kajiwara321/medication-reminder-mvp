'use client';

import React, { useState, useRef, useCallback, MouseEvent } from 'react';
import { Region } from '@/app/lib/types'; // Import the shared Region type

// Remove the local Region interface definition

interface RegionSelectorProps {
  onRegionChange: (region: Region | null) => void;
  containerWidth: number;
  containerHeight: number;
  disabled?: boolean; // Optional prop to disable selection
  initialRegion?: Region | null; // Add prop to display saved region
  // Props for grid display
  showGrid?: boolean;
  gridRows?: number;
  gridCols?: number;
  baselinesAreSet?: boolean; // New prop to indicate if baselines are set
}

const RegionSelector: React.FC<RegionSelectorProps> = ({
  onRegionChange,
  containerWidth,
  containerHeight,
  disabled = false,
  initialRegion = null, // Default to null
  showGrid = false, // Default to false
  gridRows = 7,    // Default grid size
  gridCols = 4,     // Default grid size
  baselinesAreSet = false, // Default to false
}) => {
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [currentRect, setCurrentRect] = useState<Region | null>(null); // This is for the *drawing* rect
  const containerRef = useRef<HTMLDivElement>(null);

  // Determine the rectangle to display: drawing rect if active, otherwise the initial/saved one
  // For grid mode, initialRegion represents the master region
  const displayRect = isDrawing ? currentRect : initialRegion;

  const getCoordinates = (event: MouseEvent<HTMLDivElement>): { x: number; y: number } => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
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
    // Start drawing a new region, assign a temporary ID or handle ID generation onMouseUp
    setCurrentRect({ id: `drawing-${Date.now()}`, ...coords, width: 0, height: 0 });
    // In grid mode, we might not want to clear immediately, let page.tsx handle it based on masterRegion state
    // onRegionChange(null);
    console.log('Mouse Down:', coords);
  }, [disabled, containerWidth, containerHeight, getCoordinates]); // Added getCoordinates

  const handleMouseMove = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !startPoint || disabled) return;
    event.preventDefault();
    const currentCoords = getCoordinates(event);
    const width = Math.abs(currentCoords.x - startPoint.x);
    const height = Math.abs(currentCoords.y - startPoint.y);
    // Keep the temporary ID during drawing
    const tempId = currentRect?.id || `drawing-${Date.now()}`;
    const newRect: Region = {
      id: tempId,
      x: Math.min(startPoint.x, currentCoords.x),
      y: Math.min(startPoint.y, currentCoords.y),
      width: width,
      height: height,
    };
    setCurrentRect(newRect);
  }, [isDrawing, startPoint, disabled, containerWidth, containerHeight, currentRect?.id, getCoordinates]); // Added getCoordinates

  const handleMouseUp = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || disabled) return;
    event.preventDefault();
    setIsDrawing(false);
    setStartPoint(null);
    if (currentRect && (currentRect.width > 10 && currentRect.height > 10)) { // Increased minimum size
      console.log('Mouse Up - Final Master Rect:', currentRect);
      // Generate a stable ID if needed, or let the parent handle it
      const finalRegion = { ...currentRect, id: initialRegion?.id || `master-${Date.now()}` }; // Reuse existing ID or create new
      onRegionChange(finalRegion); // Pass the completed region
      setCurrentRect(null); // Clear drawing rect
    } else {
      console.log('Mouse Up - Rect too small, clearing.');
      setCurrentRect(null);
      onRegionChange(null); // Clear selection if too small
    }
  }, [isDrawing, disabled, currentRect, onRegionChange, initialRegion?.id]); // Added initialRegion?.id

  const handleMouseLeave = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (isDrawing) {
        handleMouseUp(event);
    }
  }, [isDrawing, handleMouseUp]);

  // --- Grid Drawing Logic ---
  const renderGridLines = () => {
    if (!showGrid || !initialRegion || gridRows <= 0 || gridCols <= 0) {
      return null;
    }

    const lines = [];
    const cellWidth = initialRegion.width / gridCols;
    const cellHeight = initialRegion.height / gridRows;

    // Vertical lines
    for (let i = 1; i < gridCols; i++) {
      const x = initialRegion.x + i * cellWidth;
      lines.push(
        <div
          key={`v-${i}`}
          className="absolute border-l border-dashed border-green-500 pointer-events-none"
          style={{
            left: `${x}px`,
            top: `${initialRegion.y}px`,
            width: '1px',
            height: `${initialRegion.height}px`,
          }}
        />
      );
    }

    // Horizontal lines
    for (let i = 1; i < gridRows; i++) {
      const y = initialRegion.y + i * cellHeight;
      lines.push(
        <div
          key={`h-${i}`}
          className="absolute border-t border-dashed border-green-500 pointer-events-none"
          style={{
            left: `${initialRegion.x}px`,
            top: `${y}px`,
            width: `${initialRegion.width}px`,
            height: '1px',
          }}
        />
      );
    }

    return lines;
  };


  return (
    <div
      ref={containerRef}
      className="absolute top-0 left-0 cursor-crosshair"
      style={{ width: `${containerWidth}px`, height: `${containerHeight}px`, touchAction: 'none' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      {/* Display the master region (either being drawn or the initial one) */}
      {displayRect && (
        <div
          className={`absolute border-2 pointer-events-none ${
            isDrawing
              ? 'border-dashed border-red-500 bg-red-500 bg-opacity-20' // Drawing style
              : baselinesAreSet
              ? 'border-solid border-blue-500' // Baselines set: only border
              : 'border-solid border-blue-500 bg-blue-500 bg-opacity-10' // Initial selection: border + background
          }`}
          style={{
            left: `${displayRect.x}px`,
            top: `${displayRect.y}px`,
            width: `${displayRect.width}px`,
            height: `${displayRect.height}px`,
          }}
        />
      )}
      {/* Render grid lines if enabled and master region exists */}
      {renderGridLines()}
    </div>
  );
};

export default RegionSelector;