'use client';

import { useState, useEffect, useCallback } from 'react';
import { loadFromLocalStorage, saveToLocalStorage, removeFromLocalStorage } from '@/app/lib/storage';

// Re-define or import the Region type
interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Define the structure for settings stored in localStorage
interface StoredSettings {
  selectedRegion: Region | null;
  baselineImageSrc: string | null; // Store as Base64 data URL
}

const REGION_STORAGE_KEY = 'medicationReminder_selectedRegion';
const BASELINE_IMAGE_STORAGE_KEY = 'medicationReminder_baselineImage';

export const useSettings = () => {
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const [baselineImageSrc, setBaselineImageSrc] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false); // Track if settings have been loaded

  // Load settings from localStorage on initial mount
  useEffect(() => {
    console.log('useSettings: Initializing and loading from LocalStorage...');
    const loadedRegion = loadFromLocalStorage<Region>(REGION_STORAGE_KEY);
    const loadedBaseline = loadFromLocalStorage<string>(BASELINE_IMAGE_STORAGE_KEY);

    if (loadedRegion) {
      setSelectedRegion(loadedRegion);
      console.log('useSettings: Loaded region from storage:', loadedRegion);
    }
    if (loadedBaseline) {
      setBaselineImageSrc(loadedBaseline);
      console.log('useSettings: Loaded baseline image source from storage (truncated):', loadedBaseline.substring(0, 50) + '...');
    }
    setIsInitialized(true); // Mark as initialized
  }, []); // Empty dependency array ensures this runs only once on mount

  // Save selectedRegion to localStorage whenever it changes
  useEffect(() => {
    if (!isInitialized) return; // Don't save until initial load is complete
    console.log('useSettings: Saving region to LocalStorage:', selectedRegion);
    if (selectedRegion) {
      saveToLocalStorage(REGION_STORAGE_KEY, selectedRegion);
    } else {
      // If region is null (cleared), remove it from storage
      removeFromLocalStorage(REGION_STORAGE_KEY);
    }
  }, [selectedRegion, isInitialized]);

  // Save baselineImageSrc to localStorage whenever it changes
  useEffect(() => {
    if (!isInitialized) return; // Don't save until initial load is complete
    console.log('useSettings: Saving baseline image source to LocalStorage (truncated):', baselineImageSrc ? baselineImageSrc.substring(0, 50) + '...' : 'null');
    if (baselineImageSrc) {
      saveToLocalStorage(BASELINE_IMAGE_STORAGE_KEY, baselineImageSrc);
    } else {
      // If baseline is null (cleared), remove it from storage
      removeFromLocalStorage(BASELINE_IMAGE_STORAGE_KEY);
    }
  }, [baselineImageSrc, isInitialized]);

  // Function to update the region (typically called from RegionSelector)
  const updateRegion = useCallback((newRegion: Region | null) => {
    setSelectedRegion(newRegion);
  }, []);

  // Function to set the baseline image source (typically called after capturing)
  const setBaseline = useCallback((imageDataUrl: string | null) => {
    setBaselineImageSrc(imageDataUrl);
  }, []);

  // Function to clear all settings
  const clearSettings = useCallback(() => {
    setSelectedRegion(null);
    setBaselineImageSrc(null);
    // LocalStorage removal will be handled by the useEffect hooks
    console.log('useSettings: Cleared settings.');
  }, []);


  return {
    selectedRegion,
    baselineImageSrc,
    updateRegion,
    setBaseline,
    clearSettings,
    isInitialized, // Expose initialization status if needed elsewhere
  };
};