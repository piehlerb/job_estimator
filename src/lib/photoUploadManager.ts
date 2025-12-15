/**
 * Photo Upload Manager
 * Coordinates photo uploads to Google Drive with job folders
 */

import { JobPhoto } from '../types';
import { Job } from '../types';
import {
  getOrCreateFolder,
  uploadFileToDrive,
  setAuthToken,
  isAuthExpired,
  isAuthExpiringSoon,
} from './googleDrive';
import {
  getGoogleDriveAuth,
  getGoogleDriveSettings,
  getDefaultGoogleDriveSettings,
  updateJob,
} from './db';
import { base64ToBlob } from './photoStorage';

/**
 * Upload a photo to Google Drive for a specific job
 */
export async function uploadPhotoToJob(
  job: Job,
  photo: JobPhoto
): Promise<{ success: boolean; driveFileId?: string; error?: string }> {
  try {
    // Check if we have auth
    let auth = await getGoogleDriveAuth();
    if (!auth) {
      return {
        success: false,
        error: 'Google Drive not connected',
      };
    }

    // Check if token is expired or expiring soon
    if (isAuthExpired(auth)) {
      return {
        success: false,
        error: 'Authentication expired. Please reconnect Google Drive in Settings.',
      };
    }

    // Warn if token is expiring soon
    if (isAuthExpiringSoon(auth)) {
      console.warn('Google Drive token will expire soon. Consider reconnecting in Settings.');
    }

    // Set auth token
    setAuthToken(auth);

    // Get settings
    const settings = (await getGoogleDriveSettings()) || getDefaultGoogleDriveSettings();

    // Get or create root folder
    const rootFolderId = await getOrCreateFolder(settings.rootFolderName);

    // Create job-specific folder name: "{JobName}_{JobId}"
    const jobFolderName = `${job.name}_${job.id}`;
    const jobFolderId = await getOrCreateFolder(jobFolderName, rootFolderId);

    // Update job with folder ID if not already set
    if (!job.googleDriveFolderId) {
      job.googleDriveFolderId = jobFolderId;
      await updateJob(job);
    }

    // Upload photo
    if (!photo.localUri) {
      return {
        success: false,
        error: 'No local photo data available',
      };
    }

    const photoBlob = base64ToBlob(photo.localUri);
    const driveFileId = await uploadFileToDrive(photoBlob, photo.fileName, jobFolderId);

    return {
      success: true,
      driveFileId,
    };
  } catch (error) {
    console.error('Error uploading photo:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Upload all pending photos for a job
 */
export async function uploadPendingPhotos(job: Job): Promise<void> {
  if (!job.photos || job.photos.length === 0) {
    return;
  }

  const pendingPhotos = job.photos.filter(
    (p) => p.syncStatus === 'pending' || p.syncStatus === 'failed'
  );

  for (const photo of pendingPhotos) {
    // Mark as uploading
    photo.syncStatus = 'uploading';
    await updateJob(job);

    const result = await uploadPhotoToJob(job, photo);

    if (result.success && result.driveFileId) {
      photo.driveFileId = result.driveFileId;
      photo.syncStatus = 'uploaded';
      photo.uploadedAt = new Date().toISOString();
      // Clear local data after successful upload to save space
      delete photo.localUri;
    } else {
      photo.syncStatus = 'failed';
      photo.errorMessage = result.error || 'Upload failed';
    }

    await updateJob(job);
  }
}

/**
 * Check if Google Drive is available
 */
export async function isDriveAvailable(): Promise<boolean> {
  try {
    const auth = await getGoogleDriveAuth();
    if (!auth) return false;

    // Check if token is still valid
    return !isAuthExpired(auth);
  } catch {
    return false;
  }
}
