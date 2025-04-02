export interface Region {
  id: string; // Unique identifier for the region/cell
  x: number; // Top-left x coordinate relative to the video frame
  y: number; // Top-left y coordinate relative to the video frame
  width: number; // Width of the region/cell
  height: number; // Height of the region/cell
  // --- Grid Cell Specific Properties ---
  row?: number; // Optional: Row index (0-6 for Mon-Sun)
  col?: number; // Optional: Column index (0-3 for 朝,昼,夜,寝る前)
  label?: string; // Optional: Automatically generated label (e.g., "Mon-AM")
}

// Type for storing baseline image data (Base64 encoded)
export type BaselineData = Record<string, string | null>; // Keyed by Region ID

// Type for storing detection status
export type DetectionStatus = Record<string, string>; // Keyed by Region ID, value is status string

// Type for storing difference percentages
export type DifferencePercentage = Record<string, number | null>; // Keyed by Region ID