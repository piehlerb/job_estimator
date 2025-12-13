# Google Drive Integration Setup Guide

This guide will walk you through setting up Google Drive integration for the Job Estimator PWA, enabling automatic photo backup to Google Drive.

## Overview

The Google Drive integration allows you to:
- Take photos directly in the app (mobile camera or file upload)
- Automatically upload photos to job-specific folders in Google Drive
- Organize photos by category (Before/During/After)
- Access photos from any device via Google Drive
- Offline support: photos queue for upload when connection is restored

## Prerequisites

- A Google account
- Access to [Google Cloud Console](https://console.cloud.google.com)
- The Job Estimator app deployed and accessible via HTTPS (required for OAuth)

## Step-by-Step Setup

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Click the project dropdown in the top navigation bar
3. Click "New Project"
4. Enter a project name (e.g., "Job Estimator PWA")
5. Click "Create"
6. Wait for the project to be created and select it

### 2. Enable the Google Drive API

1. In your project, navigate to "APIs & Services" → "Library" (or click [here](https://console.cloud.google.com/apis/library))
2. Search for "Google Drive API"
3. Click on "Google Drive API"
4. Click "Enable"
5. Wait for the API to be enabled

### 3. Configure OAuth Consent Screen

1. Navigate to "APIs & Services" → "OAuth consent screen"
2. Select "External" user type (unless you're using Google Workspace)
3. Click "Create"
4. Fill in the required fields:
   - **App name**: Job Estimator (or your preferred name)
   - **User support email**: Your email address
   - **Developer contact email**: Your email address
5. Click "Save and Continue"
6. On the "Scopes" page, click "Add or Remove Scopes"
7. Search for and add: `https://www.googleapis.com/auth/drive.file`
   - This scope allows the app to create and manage only files it creates (not access to all Drive files)
8. Click "Save and Continue"
9. On "Test users" page, add your email (and any other testers)
10. Click "Save and Continue"
11. Review and click "Back to Dashboard"

### 4. Create OAuth 2.0 Credentials

1. Navigate to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. Select "Web application" as the application type
4. Enter a name (e.g., "Job Estimator Web Client")
5. Add **Authorized JavaScript origins**:
   - For development: `http://localhost:5173` (or your dev server port)
   - For production: Your deployed app URL (e.g., `https://yourusername.github.io`)
6. Add **Authorized redirect URIs**:
   - For development: `http://localhost:5173`
   - For production: Your deployed app URL (e.g., `https://yourusername.github.io/job_estimator/`)
   - **Important**: Include the trailing slash if your base path has one
7. Click "Create"
8. A dialog will show your **Client ID** and **Client Secret**
9. **Copy the Client ID** - you'll need this

### 5. Create an API Key

1. Still in "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "API Key"
3. A dialog will show your new API key
4. **Copy the API Key** - you'll need this
5. (Optional but recommended) Click "Restrict Key" to add restrictions:
   - Under "API restrictions", select "Restrict key"
   - Select "Google Drive API" from the dropdown
   - Click "Save"

### 6. Configure Your Application

1. In your job estimator project, create a `.env.local` file in the root directory
2. Add your credentials:

```env
VITE_GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
VITE_GOOGLE_API_KEY=your-api-key-here
```

3. Replace `your-client-id-here` with the Client ID from step 4
4. Replace `your-api-key-here` with the API Key from step 5

**Security Note**: Never commit `.env.local` to version control. It's already included in `.gitignore`.

### 7. Test the Integration

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Open the app in your browser

3. Navigate to **Settings** → **Google Drive** tab

4. Click "Connect to Google Drive"

5. You should see a Google sign-in popup:
   - Sign in with your Google account
   - Review the permissions (the app only requests access to files it creates)
   - Click "Allow"

6. You should see "Connected" status with your email address

7. Test photo upload:
   - Go to a job or create a new one
   - Scroll to the "Job Photos" section
   - Click "Take Photo" or "Upload Photo"
   - Select a photo
   - The photo should upload automatically (check the sync status icon)

### 8. Verify in Google Drive

1. Go to [Google Drive](https://drive.google.com)
2. You should see a "Jobs" folder (or your configured root folder name)
3. Inside, you'll find folders named `{JobName}_{JobId}`
4. Inside each job folder, you'll see your uploaded photos

## Folder Structure in Google Drive

```
Google Drive
└── Jobs/                          (root folder, configurable in Settings)
    ├── Smith Garage_abc123/
    │   ├── before_20250113_143022.jpg
    │   ├── before_20250113_143045.jpg
    │   ├── during_20250114_091234.jpg
    │   ├── after_20250115_160815.jpg
    │   └── after_20250115_160832.jpg
    └── Jones Kitchen_xyz789/
        ├── before_20250116_101500.jpg
        └── after_20250118_153000.jpg
```

## Production Deployment

When deploying to production (e.g., GitHub Pages):

1. Add your production URL to the OAuth client:
   - Go back to Google Cloud Console → Credentials
   - Edit your OAuth client
   - Add production URLs to "Authorized JavaScript origins" and "Authorized redirect URIs"
   - Click "Save"

2. Set environment variables in your deployment:
   - For GitHub Pages, create a `.env` file or set repository secrets
   - Ensure the variables are prefixed with `VITE_` for Vite to include them

3. Rebuild and redeploy your app

## Troubleshooting

### "Google Drive not configured" error

- **Cause**: Missing or incorrect environment variables
- **Solution**: Check that `.env.local` exists and contains valid `VITE_GOOGLE_CLIENT_ID` and `VITE_GOOGLE_API_KEY`
- **Solution**: Restart your dev server after adding/changing `.env.local`

### "Failed to connect to Google Drive" error

- **Cause**: Redirect URI mismatch
- **Solution**: Ensure your current URL is listed in "Authorized redirect URIs" in Google Cloud Console
- **Solution**: Check that the URL matches exactly (including http/https, port, and path)

### "This app is blocked" error

- **Cause**: OAuth consent screen not configured or app not verified
- **Solution**: For testing, add your email to "Test users" in OAuth consent screen
- **Solution**: For public use, submit your app for verification (only needed if distributing widely)

### Photos not uploading

- **Cause**: Not connected to Google Drive
- **Solution**: Go to Settings → Google Drive and connect your account

- **Cause**: Offline
- **Solution**: Photos will queue and upload automatically when you're back online

- **Cause**: Token expired
- **Solution**: Reconnect to Google Drive in Settings

### "Token expired - please reconnect" message

- **Cause**: Access tokens expire after ~1 hour for security
- **Solution**: Click "Connect to Google Drive" again in Settings
- **Note**: This is normal behavior. Refresh tokens are not used in the current implementation for security reasons

## Security Best Practices

1. **Never commit credentials**: The `.env.local` file is git-ignored. Never commit API keys or secrets.

2. **Use minimal scopes**: The app only requests `drive.file` scope, which limits access to files created by the app.

3. **API Key restrictions**: Restrict your API key to only the Google Drive API in Cloud Console.

4. **HTTPS required**: OAuth requires HTTPS in production. GitHub Pages provides this automatically.

5. **Regular token refresh**: Users may need to reconnect periodically as tokens expire. This is a security feature.

## Features Overview

### Photo Capture
- **Mobile**: Uses device camera when available
- **Desktop**: File upload from computer
- **Compression**: Photos automatically compressed to max 2MB before upload

### Categories
- **Before**: Photos taken before work begins
- **During**: Progress photos during installation
- **After**: Final photos after completion

### Offline Support
- Photos captured offline are stored locally in IndexedDB
- Automatically upload when connection is restored
- Sync status indicators show upload progress

### Photo Management
- View thumbnails in gallery
- Click to view full-size in modal
- Delete unwanted photos
- Retry failed uploads
- Open folder directly in Google Drive

## Customization

### Change Root Folder Name

1. Go to Settings → Google Drive
2. Change "Root Folder Name" from "Jobs" to your preferred name
3. Click "Save Settings"
4. New folders will be created in the renamed root folder

### Auto-Upload Setting

1. Go to Settings → Google Drive
2. Toggle "Automatically upload photos when online"
3. If disabled, you'll need to manually trigger uploads

## Support

For issues or questions:
- Check the troubleshooting section above
- Review the [Google Drive API documentation](https://developers.google.com/drive/api/guides/about-sdk)
- File an issue in the project repository

## Cost Considerations

- **Google Drive API**: Free tier includes 1 billion requests/day
- **Storage**: Uses your Google Drive storage quota (15 GB free)
- **Typical usage**: Photo uploads are well within free tier limits for individual users

## Privacy & Data

- The app only accesses files it creates (due to `drive.file` scope)
- Cannot see or access your other Google Drive files
- Photos are stored in your personal Google Drive
- You maintain full ownership and control of your data
- You can revoke access anytime in [Google Account Settings](https://myaccount.google.com/permissions)
