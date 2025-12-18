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
  initGoogleDrive,
  setGoogleCredentials,
  hasCredentials,
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
    console.log('[Upload] Starting upload for photo:', photo.fileName);

    // Get settings first
    const settings = (await getGoogleDriveSettings()) || getDefaultGoogleDriveSettings();
    console.log('[Upload] Settings loaded, root folder:', settings.rootFolderName);

    // Initialize Google Drive API if not already initialized
    if (!hasCredentials()) {
      if (!settings.clientId) {
        console.error('[Upload] No Google Drive credentials configured');
        return {
          success: false,
          error: 'Google Drive not configured. Please set up in Settings.',
        };
      }
      console.log('[Upload] Setting Google credentials');
      setGoogleCredentials(settings.clientId, settings.apiKey || '');
    }

    // Initialize Google Drive API
    try {
      console.log('[Upload] Initializing Google Drive API');
      await initGoogleDrive();
    } catch (initError) {
      console.error('[Upload] Failed to initialize Google Drive:', initError);
      return {
        success: false,
        error: 'Failed to initialize Google Drive. Please try again.',
      };
    }

    // Check if we have auth
    let auth = await getGoogleDriveAuth();
    if (!auth) {
      console.error('[Upload] No Google Drive auth found');
      return {
        success: false,
        error: 'Google Drive not connected',
      };
    }

    // Check if token is expired or expiring soon
    if (isAuthExpired(auth)) {
      console.error('[Upload] Auth token expired');
      return {
        success: false,
        error: 'Authentication expired. Please reconnect Google Drive in Settings.',
      };
    }

    // Warn if token is expiring soon
    if (isAuthExpiringSoon(auth)) {
      console.warn('[Upload] Google Drive token will expire soon. Consider reconnecting in Settings.');
    }

    // Set auth token
    console.log('[Upload] Setting auth token');
    await setAuthToken(auth);

    // Get or create root folder
    console.log('[Upload] Getting or creating root folder:', settings.rootFolderName);
    const rootFolderId = await getOrCreateFolder(settings.rootFolderName);
    console.log('[Upload] Root folder ID:', rootFolderId);

    // Create job-specific folder name: "{JobName}_{JobId}"
    const jobFolderName = `${job.name}_${job.id}`;
    console.log('[Upload] Getting or creating job folder:', jobFolderName);
    const jobFolderId = await getOrCreateFolder(jobFolderName, rootFolderId);
    console.log('[Upload] Job folder ID:', jobFolderId);

    // Update job with folder ID if not already set
    if (!job.googleDriveFolderId) {
      console.log('[Upload] Updating job with folder ID');
      job.googleDriveFolderId = jobFolderId;
      await updateJob(job);
    }

    // Upload photo
    if (!photo.localUri) {
      console.error('[Upload] No local photo data available');
      return {
        success: false,
        error: 'No local photo data available',
      };
    }

    console.log('[Upload] Converting photo to blob');
    const photoBlob = base64ToBlob(photo.localUri);
    console.log('[Upload] Uploading file to Drive:', photo.fileName);
    const driveFileId = await uploadFileToDrive(photoBlob, photo.fileName, jobFolderId);
    console.log('[Upload] Upload successful, file ID:', driveFileId);

    return {
      success: true,
      driveFileId,
    };
  } catch (error) {
    console.error('[Upload] Error uploading photo:', error);
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
  console.log('[UploadManager] uploadPendingPhotos called. Job photos:', job.photos?.length || 0);

  if (!job.photos || job.photos.length === 0) {
    console.log('[UploadManager] No photos to upload');
    return;
  }

  const pendingPhotos = job.photos.filter(
    (p) => p.syncStatus === 'pending' || p.syncStatus === 'failed'
  );

  console.log('[UploadManager] Found', pendingPhotos.length, 'pending photos out of', job.photos.length, 'total');

  for (const photo of pendingPhotos) {
    console.log('[UploadManager] Uploading photo:', photo.fileName);
    // Mark as uploading
    photo.syncStatus = 'uploading';
    await updateJob(job);

    const result = await uploadPhotoToJob(job, photo);

    if (result.success && result.driveFileId) {
      console.log('[UploadManager] Photo uploaded successfully:', photo.fileName);
      photo.driveFileId = result.driveFileId;
      photo.syncStatus = 'uploaded';
      photo.uploadedAt = new Date().toISOString();
      // Clear local data after successful upload to save space
      delete photo.localUri;
    } else {
      console.error('[UploadManager] Photo upload failed:', photo.fileName, result.error);
      photo.syncStatus = 'failed';
      photo.errorMessage = result.error || 'Upload failed';
    }

    await updateJob(job);
  }

  console.log('[UploadManager] Finished uploading all pending photos');
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
