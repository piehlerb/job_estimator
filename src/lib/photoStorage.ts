/**
 * Photo Storage Utilities
 * Handles photo compression, local storage, and sync queue management
 */

import imageCompression from 'browser-image-compression';
import { JobPhoto } from '../types';

const MAX_FILE_SIZE_MB = 2;
const MAX_WIDTH_OR_HEIGHT = 1920;

/**
 * Compress an image file
 */
export async function compressImage(file: File): Promise<Blob> {
  try {
    const options = {
      maxSizeMB: MAX_FILE_SIZE_MB,
      maxWidthOrHeight: MAX_WIDTH_OR_HEIGHT,
      useWebWorker: true,
      fileType: 'image/jpeg',
    };

    const compressedFile = await imageCompression(file, options);
    return compressedFile;
  } catch (error) {
    console.error('Error compressing image:', error);
    throw new Error('Failed to compress image');
  }
}

/**
 * Convert a File or Blob to base64 string for local storage
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert blob to base64'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Convert base64 string back to Blob
 */
export function base64ToBlob(base64: string): Blob {
  const parts = base64.split(';base64,');
  const contentType = parts[0].split(':')[1];
  const raw = window.atob(parts[1]);
  const rawLength = raw.length;
  const uInt8Array = new Uint8Array(rawLength);

  for (let i = 0; i < rawLength; ++i) {
    uInt8Array[i] = raw.charCodeAt(i);
  }

  return new Blob([uInt8Array], { type: contentType });
}

/**
 * Generate a unique filename with timestamp and random suffix
 */
export function generatePhotoFileName(
  category: 'Before' | 'During' | 'After',
  extension: string = 'jpg'
): string {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\..+/, '')
    .replace('T', '_');
  // Add random suffix to ensure uniqueness when processing multiple files quickly
  const randomSuffix = Math.random().toString(36).substring(2, 6);
  return `${category.toLowerCase()}_${timestamp}_${randomSuffix}.${extension}`;
}

/**
 * Get file extension from filename or mime type
 */
export function getFileExtension(filename: string, mimeType?: string): string {
  // Try to get from filename first
  const parts = filename.split('.');
  if (parts.length > 1) {
    return parts[parts.length - 1].toLowerCase();
  }

  // Fallback to mime type
  if (mimeType) {
    const mimeMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/heic': 'heic',
    };
    return mimeMap[mimeType] || 'jpg';
  }

  return 'jpg';
}

/**
 * Create a new JobPhoto object
 */
export function createJobPhoto(
  category: 'Before' | 'During' | 'After',
  fileName: string,
  localUri?: string
): JobPhoto {
  return {
    id: generateId(),
    category,
    fileName,
    localUri,
    syncStatus: 'pending',
    capturedAt: new Date().toISOString(),
  };
}

/**
 * Generate a unique ID
 */
function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * Capture photo from camera (mobile)
 */
export async function captureFromCamera(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment'; // Use back camera on mobile

    input.onchange = (e) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      resolve(file || null);
    };

    input.oncancel = () => resolve(null);

    input.click();
  });
}

/**
 * Select photo from file system
 */
export async function selectFromFiles(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    input.onchange = (e) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      resolve(file || null);
    };

    input.oncancel = () => resolve(null);

    input.click();
  });
}

/**
 * Select multiple photos from file system
 */
export async function selectMultipleFiles(): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true; // Allow multiple file selection

    input.onchange = (e) => {
      const target = e.target as HTMLInputElement;
      const files = target.files;
      if (files && files.length > 0) {
        resolve(Array.from(files));
      } else {
        resolve([]);
      }
    };

    input.oncancel = () => resolve([]);

    input.click();
  });
}

/**
 * Create thumbnail from image file
 */
export async function createThumbnail(file: Blob, maxSize: number = 200): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions
        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Check if device is online
 */
export function isOnline(): boolean {
  return navigator.onLine;
}

/**
 * Get pending photos that need to be uploaded
 */
export function getPendingPhotos(photos: JobPhoto[]): JobPhoto[] {
  return photos.filter(
    (photo) => photo.syncStatus === 'pending' || photo.syncStatus === 'failed'
  );
}

/**
 * Calculate total size of photos in bytes (approximation from base64)
 */
export function calculatePhotosSize(photos: JobPhoto[]): number {
  let totalSize = 0;
  for (const photo of photos) {
    if (photo.localUri) {
      // Approximate size from base64 (base64 is ~1.37x original size)
      const base64Length = photo.localUri.length;
      totalSize += (base64Length * 3) / 4;
    }
  }
  return totalSize;
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
