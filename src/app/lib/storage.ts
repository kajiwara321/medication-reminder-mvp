/**
 * Utility functions for interacting with localStorage.
 * Handles potential errors during access (e.g., storage disabled, quota exceeded).
 */

/**
 * Saves an item to localStorage.
 * @param key The key under which to store the value.
 * @param value The value to store (will be JSON.stringify'd).
 * @returns True if successful, false otherwise.
 */
export const saveToLocalStorage = <T>(key: string, value: T): boolean => {
  if (typeof window === 'undefined') {
    console.warn('LocalStorage is not available outside the browser.');
    return false;
  }
  try {
    const serializedValue = JSON.stringify(value);
    window.localStorage.setItem(key, serializedValue);
    console.log(`Saved '${key}' to LocalStorage.`);
    return true;
  } catch (error) {
    console.error(`Error saving item "${key}" to localStorage:`, error);
    return false;
  }
};

/**
 * Loads an item from localStorage.
 * @param key The key of the item to retrieve.
 * @returns The parsed value, or null if the key doesn't exist or an error occurs.
 */
export const loadFromLocalStorage = <T>(key: string): T | null => {
  if (typeof window === 'undefined') {
    console.warn('LocalStorage is not available outside the browser.');
    return null;
  }
  try {
    const serializedValue = window.localStorage.getItem(key);
    if (serializedValue === null) {
      // console.log(`Key '${key}' not found in LocalStorage.`);
      return null; // Key not found
    }
    console.log(`Loaded '${key}' from LocalStorage.`);
    return JSON.parse(serializedValue) as T;
  } catch (error) {
    console.error(`Error loading item "${key}" from localStorage:`, error);
    // Optionally remove the corrupted item
    // window.localStorage.removeItem(key);
    return null;
  }
};

/**
 * Removes an item from localStorage.
 * @param key The key of the item to remove.
 * @returns True if successful or key didn't exist, false if an error occurred.
 */
export const removeFromLocalStorage = (key: string): boolean => {
   if (typeof window === 'undefined') {
     console.warn('LocalStorage is not available outside the browser.');
     return false;
   }
  try {
    window.localStorage.removeItem(key);
    console.log(`Removed '${key}' from LocalStorage.`);
    return true;
  } catch (error) {
    console.error(`Error removing item "${key}" from localStorage:`, error);
    return false;
  }
};