
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Timestamp } from "firebase/firestore";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Helper to parse date consistently
export const parseEntryDate = (dateField: Timestamp | Date | string | number | undefined | null): Date => {
  if (!dateField) {
    // Handle null or undefined dateField, perhaps return new Date() or throw an error
    // For now, let's return a very old date or current date as a fallback, or handle as error.
    // Returning current date as a fallback to avoid breaking existing logic that might not expect nulls.
    console.warn("parseEntryDate received undefined or null, returning current date as fallback.");
    return new Date(); 
  }
  if (dateField instanceof Date) { // Check if it's already a Date object
    return dateField;
  }
  // Check if it's a Firestore Timestamp-like object (if not directly an instance)
  if (typeof dateField === 'object' && dateField !== null && 'toDate' in dateField && typeof (dateField as any).toDate === 'function') {
    return (dateField as Timestamp).toDate();
  }
  // Handle string or number (timestamp)
  if (typeof dateField === 'string' || typeof dateField === 'number') {
    const d = new Date(dateField);
    if (!isNaN(d.getTime())) { // Check if date is valid
        return d;
    }
  }
  // Fallback for unexpected types or invalid dates
  console.warn("parseEntryDate received an unexpected dateField type or invalid date, returning current date as fallback. Value:", dateField);
  return new Date();
};
