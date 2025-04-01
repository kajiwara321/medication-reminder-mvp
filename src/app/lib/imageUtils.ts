/**
 * Utility functions for image processing, specifically for capturing
 * regions from video and comparing image data.
 */

// Re-define or import the Region type
interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Captures a specific region from a video element and returns its ImageData.
 * Accounts for horizontally flipped (mirrored) video streams.
 * @param videoElement The HTMLVideoElement to capture from.
 * @param region The region {x, y, width, height} to capture within the video frame.
 * @param canvasElement An optional offscreen canvas element to use for drawing.
 * @returns ImageData of the captured region, or null if capture fails.
 */
export const captureRegionImageData = (
  videoElement: HTMLVideoElement,
  region: Region,
  canvasElement?: HTMLCanvasElement // Optional canvas for reuse
): ImageData | null => {
  if (!region || region.width <= 0 || region.height <= 0) {
    console.error("Invalid region provided for capture.");
    return null;
  }

  const canvas = canvasElement || document.createElement('canvas');
  canvas.width = region.width;
  canvas.height = region.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true }); // Optimize for frequent reads

  if (!ctx) {
    console.error("Failed to get 2D context for image capture.");
    return null;
  }

  try {
    // Account for mirrored video: sourceX needs adjustment
    const sourceX = videoElement.videoWidth - region.x - region.width;
    const sourceY = region.y;

    // Clear the canvas before drawing
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw the selected region of the video onto the canvas
    ctx.drawImage(
      videoElement,
      sourceX, // source x (adjusted for mirror)
      sourceY, // source y
      region.width, // source width
      region.height, // source height
      0, // destination x
      0, // destination y
      region.width, // destination width
      region.height // destination height
    );

    // Get the ImageData from the canvas
    return ctx.getImageData(0, 0, region.width, region.height);
  } catch (error) {
    console.error("Error capturing image data from video region:", error);
    return null;
  }
};

/**
 * Compares two ImageData objects and calculates a difference percentage.
 * A simple pixel-by-pixel comparison based on a tolerance threshold.
 * @param baselineImageData The baseline ImageData.
 * @param currentImageData The current ImageData to compare against the baseline.
 * @param tolerance A value (0-255) per color channel. Differences below this are ignored.
 * @returns A percentage (0-100) representing the proportion of differing pixels. Returns -1 on error.
 */
export const compareImageData = (
  baselineImageData: ImageData,
  currentImageData: ImageData,
  tolerance: number = 30 // Default tolerance for minor lighting changes etc.
): number => {
  if (
    baselineImageData.width !== currentImageData.width ||
    baselineImageData.height !== currentImageData.height
  ) {
    console.error("Cannot compare ImageData with different dimensions.");
    return -1; // Indicate error
  }

  const width = baselineImageData.width;
  const height = baselineImageData.height;
  const baseData = baselineImageData.data;
  const currentData = currentImageData.data;
  let differingPixels = 0;
  const totalPixels = width * height;

  if (totalPixels === 0) return 0; // No pixels to compare

  // Iterate through each pixel (RGBA values)
  for (let i = 0; i < baseData.length; i += 4) {
    const rDiff = Math.abs(baseData[i] - currentData[i]);
    const gDiff = Math.abs(baseData[i + 1] - currentData[i + 1]);
    const bDiff = Math.abs(baseData[i + 2] - currentData[i + 2]);
    // We generally ignore the alpha channel (baseData[i + 3]) for this comparison

    // If the difference in any channel exceeds the tolerance, count it as a differing pixel
    if (rDiff > tolerance || gDiff > tolerance || bDiff > tolerance) {
      differingPixels++;
    }
  }

  const differencePercentage = (differingPixels / totalPixels) * 100;
  // console.log(`Image comparison: ${differingPixels}/${totalPixels} pixels differ (${differencePercentage.toFixed(2)}%). Tolerance: ${tolerance}`);
  return differencePercentage;
};


/**
 * Converts a Base64 Data URL string back into an ImageData object.
 * Requires a canvas element to perform the conversion.
 * @param dataUrl The Base64 Data URL (e.g., from canvas.toDataURL()).
 * @param canvasElement An optional canvas element to use.
 * @returns A Promise resolving to the ImageData, or null if conversion fails.
 */
export const base64ToImageData = (
    dataUrl: string,
    canvasElement?: HTMLCanvasElement
): Promise<ImageData | null> => {
    return new Promise((resolve) => {
        const canvas = canvasElement || document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        if (!ctx) {
            console.error("Failed to get 2D context for Base64 conversion.");
            resolve(null);
            return;
        }

        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            try {
                const imageData = ctx.getImageData(0, 0, img.width, img.height);
                resolve(imageData);
            } catch (error) {
                console.error("Error getting ImageData after drawing Base64 image:", error);
                resolve(null);
            }
        };

        img.onerror = (error) => {
            console.error("Error loading Base64 image:", error);
            resolve(null);
        };

        img.src = dataUrl;
    });
};