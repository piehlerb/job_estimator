/**
 * Google Drive API Integration
 * Handles OAuth authentication, folder creation, and file uploads
 */

import { GoogleDriveAuth } from '../types';

const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';

// Credentials are now stored in IndexedDB via GoogleDriveSettings
let GOOGLE_CLIENT_ID = '';
let GOOGLE_API_KEY = '';

// Google API client types
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initCodeClient: (config: any) => any;
          initTokenClient: (config: any) => any;
        };
      };
    };
    gapi?: {
      load: (api: string, callback: () => void) => void;
      client: {
        init: (config: any) => Promise<void>;
        setToken: (token: { access_token: string }) => void;
        getToken: () => { access_token: string } | null;
        drive: {
          files: {
            create: (params: any) => Promise<any>;
            get: (params: any) => Promise<any>;
            list: (params: any) => Promise<any>;
          };
        };
      };
    };
  }
}

let gisInited = false;
let gapiInited = false;
let tokenClient: any = null;

/**
 * Set Google API credentials (from user input in settings)
 */
export function setGoogleCredentials(clientId: string, apiKey: string): void {
  GOOGLE_CLIENT_ID = clientId;
  GOOGLE_API_KEY = apiKey;
}

/**
 * Check if credentials are configured
 * Note: Only Client ID is required for OAuth. API Key is optional.
 */
export function hasCredentials(): boolean {
  return GOOGLE_CLIENT_ID !== '';
}

/**
 * Load the Google API client library
 */
export async function loadGoogleAPI(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if script already loaded
    if (window.gapi) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google API'));
    document.body.appendChild(script);
  });
}

/**
 * Load the Google Identity Services library
 */
export async function loadGoogleIdentity(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if script already loaded
    if (window.google?.accounts) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.body.appendChild(script);
  });
}

/**
 * Initialize the Google API client
 */
async function initializeGapiClient(): Promise<void> {
  if (!window.gapi) {
    throw new Error('Google API not loaded');
  }

  const config: any = {
    discoveryDocs: [DISCOVERY_DOC],
  };

  // API Key is optional - only include if provided
  if (GOOGLE_API_KEY) {
    config.apiKey = GOOGLE_API_KEY;
  }

  console.log('[initializeGapiClient] Initializing with discovery docs');
  await window.gapi.client.init(config);
  console.log('[initializeGapiClient] Initialized. Checking drive API:', !!window.gapi.client.drive);
}

/**
 * Initialize the Google Identity Services client
 */
function initializeGisClient(callback: (response: any) => void): void {
  if (!window.google?.accounts) {
    throw new Error('Google Identity Services not loaded');
  }

  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: SCOPES,
    callback: callback,
    // Request longer-lived access tokens
    prompt: '', // Empty prompt for better UX - only show consent on first use
  });
  gisInited = true;
}

/**
 * Initialize both Google API and Identity Services
 */
export async function initGoogleDrive(): Promise<void> {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error('Google Client ID not configured. Please enter your Client ID in Settings → Google Drive.');
  }

  // Skip if already initialized
  if (gapiInited && window.gapi?.client) {
    console.log('Google Drive API already initialized');
    return;
  }

  try {
    await Promise.all([loadGoogleAPI(), loadGoogleIdentity()]);

    // Initialize GAPI client
    await new Promise<void>((resolve) => {
      window.gapi!.load('client', async () => {
        await initializeGapiClient();
        gapiInited = true;
        resolve();
      });
    });

    console.log('Google Drive API initialized');
  } catch (error) {
    console.error('Error initializing Google Drive:', error);
    throw error;
  }
}

/**
 * Request OAuth token from user
 * @param forceConsent - Force the consent screen to appear
 */
export async function requestGoogleAuth(forceConsent: boolean = false): Promise<GoogleDriveAuth> {
  return new Promise((resolve, reject) => {
    if (!gisInited) {
      initializeGisClient((response: any) => {
        if (response.error) {
          reject(new Error(response.error));
          return;
        }

        // Google OAuth tokens expire in 1 hour (3600 seconds)
        // We'll set expiration slightly earlier to allow for refresh buffer
        const expiresIn = response.expires_in || 3600;
        const auth: GoogleDriveAuth = {
          id: 'current',
          accessToken: response.access_token,
          expiresAt: Date.now() + (expiresIn * 1000) - 60000, // Subtract 1 minute buffer
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // Set token for GAPI client
        window.gapi!.client.setToken({ access_token: response.access_token });

        resolve(auth);
      });
    }

    // Request access token
    // Use empty prompt for silent renewal, or 'consent' to force re-authorization
    if (tokenClient) {
      tokenClient.requestAccessToken({ prompt: forceConsent ? 'consent' : '' });
    } else {
      reject(new Error('Token client not initialized'));
    }
  });
}

/**
 * Set existing auth token
 */
export async function setAuthToken(auth: GoogleDriveAuth): Promise<void> {
  // Wait for GAPI client AND Drive API to be ready
  const maxAttempts = 30;
  let attempts = 0;

  while (attempts < maxAttempts) {
    if (window.gapi?.client?.drive) {
      console.log('[setAuthToken] Setting token, drive API is ready');
      window.gapi.client.setToken({ access_token: auth.accessToken });
      return;
    }

    if (attempts % 5 === 0) {
      console.log('[setAuthToken] Waiting for Drive API... attempt', attempts, 'gapi:', !!window.gapi, 'client:', !!window.gapi?.client, 'drive:', !!window.gapi?.client?.drive);
    }

    // Wait 100ms before checking again
    await new Promise(resolve => setTimeout(resolve, 100));
    attempts++;
  }

  throw new Error('Google API client not initialized after waiting');
}

/**
 * Check if auth token is expired
 */
export function isAuthExpired(auth: GoogleDriveAuth): boolean {
  return Date.now() >= auth.expiresAt;
}

/**
 * Check if auth token is close to expiring (within 5 minutes)
 */
export function isAuthExpiringSoon(auth: GoogleDriveAuth): boolean {
  const fiveMinutes = 5 * 60 * 1000;
  return Date.now() >= (auth.expiresAt - fiveMinutes);
}

/**
 * Refresh the auth token
 * Note: Google OAuth token client requires user interaction for security.
 * This will show a minimal consent screen to get a new token.
 */
export async function refreshAuthToken(): Promise<GoogleDriveAuth> {
  try {
    // Google OAuth requires user interaction - use minimal prompt
    return await requestGoogleAuth(false);
  } catch (error) {
    console.error('Error refreshing auth token:', error);
    throw new Error('Failed to refresh authentication. Please sign in again.');
  }
}

/**
 * Revoke OAuth token
 */
export async function revokeGoogleAuth(auth: GoogleDriveAuth): Promise<void> {
  if (auth.accessToken) {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${auth.accessToken}`, {
      method: 'POST',
    });
  }

  // Clear token from GAPI client
  if (window.gapi?.client) {
    window.gapi.client.setToken({ access_token: '' });
  }
}

/**
 * Create a folder in Google Drive
 */
export async function createDriveFolder(
  folderName: string,
  parentFolderId?: string
): Promise<string> {
  try {
    const metadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      ...(parentFolderId && { parents: [parentFolderId] }),
    };

    const response = await window.gapi!.client.drive.files.create({
      resource: metadata,
      fields: 'id',
    });

    return response.result.id;
  } catch (error) {
    console.error('Error creating folder:', error);
    throw new Error('Failed to create folder in Google Drive');
  }
}

/**
 * Check if a folder exists by name
 */
export async function findFolderByName(
  folderName: string,
  parentFolderId?: string
): Promise<string | null> {
  try {
    let query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    if (parentFolderId) {
      query += ` and '${parentFolderId}' in parents`;
    }

    const response = await window.gapi!.client.drive.files.list({
      q: query,
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    const files = response.result.files;
    if (files && files.length > 0) {
      return files[0].id;
    }

    return null;
  } catch (error) {
    console.error('Error finding folder:', error);
    return null;
  }
}

/**
 * Get or create a folder (checks if exists first)
 */
export async function getOrCreateFolder(
  folderName: string,
  parentFolderId?: string
): Promise<string> {
  const existingId = await findFolderByName(folderName, parentFolderId);
  if (existingId) {
    return existingId;
  }

  return createDriveFolder(folderName, parentFolderId);
}

/**
 * Upload a file to Google Drive
 */
export async function uploadFileToDrive(
  file: Blob,
  fileName: string,
  folderId: string
): Promise<string> {
  try {
    const metadata = {
      name: fileName,
      parents: [folderId],
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);

    const token = window.gapi!.client.getToken();
    if (!token) {
      throw new Error('No authentication token available');
    }

    const response = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token.access_token}`,
        },
        body: form,
      }
    );

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    const result = await response.json();
    return result.id;
  } catch (error) {
    console.error('Error uploading file:', error);
    throw new Error('Failed to upload file to Google Drive');
  }
}

/**
 * Get folder URL for viewing in browser
 */
export function getDriveFolderUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`;
}

/**
 * Get file URL for viewing in browser
 */
export function getDriveFileUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view`;
}

/**
 * Get user's email from auth
 */
export async function getUserEmail(): Promise<string> {
  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${window.gapi!.client.getToken()?.access_token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get user info');
    }

    const data = await response.json();
    return data.email;
  } catch (error) {
    console.error('Error getting user email:', error);
    return '';
  }
}
