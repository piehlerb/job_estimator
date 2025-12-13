# Photo Integration Feature

## Overview

The Job Estimator PWA now includes Google Drive photo integration, allowing you to capture and automatically backup job photos to the cloud.

## Quick Start

1. **Setup Google Drive** (one-time setup):
   - Follow the detailed instructions in [GOOGLE_DRIVE_SETUP.md](./GOOGLE_DRIVE_SETUP.md)
   - Obtain Google Cloud API credentials
   - Configure `.env.local` with your credentials

2. **Connect Your Account**:
   - Open the app
   - Go to Settings → Google Drive tab
   - Click "Connect to Google Drive"
   - Sign in and authorize the app

3. **Start Taking Photos**:
   - Create or edit a job
   - Scroll to "Job Photos" section
   - Click "Take Photo" (mobile) or "Upload Photo" (desktop)
   - Select category (Before/During/After)
   - Photos automatically upload to Google Drive!

## Features

### ✅ Core Functionality

- **Camera Integration**: Use your device camera to capture photos directly in the app
- **File Upload**: Upload existing photos from your device
- **Photo Categories**: Organize photos as Before, During, or After
- **Automatic Upload**: Photos upload automatically to Google Drive when online
- **Offline Support**: Photos captured offline queue for upload when connection restores
- **Photo Gallery**: View thumbnails with category labels and sync status
- **Full-Size Viewer**: Click any thumbnail to view full-size in a modal
- **Google Drive Folders**: Each job gets its own folder: `Jobs/{JobName}_{JobId}/`

### 📱 Mobile Optimized

- Large touch targets for easy photo capture
- Native camera integration on mobile devices
- Handles device orientation changes
- Responsive photo gallery grid

### 🔄 Sync & Status

- Real-time sync status indicators:
  - ✅ **Uploaded**: Successfully saved to Google Drive
  - ⏰ **Pending**: Waiting to upload
  - 🔄 **Uploading**: Currently uploading
  - ❌ **Failed**: Upload error (with retry option)
- Automatic retry for failed uploads
- Background upload when app is open

### 💾 Storage

- **Image Compression**: Photos compressed to max 2MB before upload
- **Local Storage**: Uses IndexedDB for offline photo storage
- **Cloud Backup**: Uploaded photos stored in your Google Drive
- **Storage Cleanup**: Local data cleared after successful upload to save space

## Architecture

### File Structure

```
src/
├── components/
│   ├── PhotoCapture.tsx         # Camera/upload interface
│   └── PhotoGallery.tsx         # Photo display with modal viewer
├── lib/
│   ├── googleDrive.ts           # Google Drive API wrapper
│   ├── photoStorage.ts          # Photo compression and storage utilities
│   ├── photoUploadManager.ts   # Upload coordination
│   └── db.ts                    # IndexedDB (updated for photos)
├── types/
│   └── index.ts                 # TypeScript interfaces (JobPhoto, GoogleDriveAuth, etc.)
└── pages/
    ├── JobForm.tsx              # Job form with photo section
    └── Settings.tsx             # Settings with Google Drive tab
```

### Data Model

#### JobPhoto Interface
```typescript
interface JobPhoto {
  id: string;
  category: 'Before' | 'During' | 'After';
  localUri?: string;              // Base64 for offline storage
  driveFileId?: string;           // Google Drive file ID
  fileName: string;               // Generated filename
  uploadedAt?: string;            // Upload timestamp
  syncStatus: 'pending' | 'uploading' | 'uploaded' | 'failed';
  capturedAt: string;             // Capture timestamp
  errorMessage?: string;          // Error details if failed
}
```

#### Job Interface (Extended)
```typescript
interface Job {
  // ... existing fields
  googleDriveFolderId?: string;   // Drive folder for this job
  photos?: JobPhoto[];            // Array of photos
}
```

### Upload Flow

1. **Photo Capture**:
   ```
   User captures photo → Compress image → Convert to base64 → Save to JobPhoto object
   ```

2. **Save Job**:
   ```
   Job saved to IndexedDB with photos array → Trigger upload if online
   ```

3. **Upload Process**:
   ```
   Check Google Drive auth → Get/create root folder "Jobs"
   → Get/create job folder "{JobName}_{JobId}"
   → Upload each pending photo → Update sync status
   → Clear local data after successful upload
   ```

4. **Offline Handling**:
   ```
   Photos saved locally → Marked as 'pending'
   → When online: Auto-upload triggered → Status updated
   ```

## Dependencies

### New Packages

- **browser-image-compression** (^2.x): Client-side image compression
  ```bash
  npm install browser-image-compression
  ```

### Google APIs (Loaded at Runtime)

- Google API Client Library (gapi)
- Google Identity Services (GIS)

These are loaded dynamically from CDN, no npm package required.

## Environment Variables

Create `.env.local` in the project root:

```env
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
VITE_GOOGLE_API_KEY=your-api-key
```

See [GOOGLE_DRIVE_SETUP.md](./GOOGLE_DRIVE_SETUP.md) for how to obtain these credentials.

## IndexedDB Schema

### New Object Stores (DB Version 6)

1. **googleDriveAuth**
   - Stores: OAuth access token, expiration, user email
   - Single record with id='current'

2. **googleDriveSettings**
   - Stores: Root folder name, auto-upload preference
   - Single record with id='current'

3. **Updated: jobs**
   - Added fields: `googleDriveFolderId`, `photos`

## Security Considerations

### OAuth Scopes

The app requests minimal permissions:
- `https://www.googleapis.com/auth/drive.file`
- This scope only allows access to files created by the app
- Cannot access other files in user's Google Drive

### Token Management

- Access tokens stored in IndexedDB (client-side only)
- Tokens expire after ~1 hour (Google security policy)
- User must reconnect when token expires
- No refresh tokens stored for security

### Photo Data

- Photos compressed before upload (max 2MB)
- Local base64 data cleared after successful upload
- Only metadata retained after upload
- User maintains full ownership in Google Drive

## Testing

### Manual Testing Checklist

- [ ] Connect Google Drive account in Settings
- [ ] See connected status with email
- [ ] Take photo with camera (mobile)
- [ ] Upload photo from files (desktop)
- [ ] Photos compressed to <2MB
- [ ] Photos appear in gallery with category badges
- [ ] Click thumbnail opens full-size modal
- [ ] Sync status icons display correctly
- [ ] Photos upload to Google Drive
- [ ] Job folders created with correct naming
- [ ] Delete photo works
- [ ] Retry failed upload works
- [ ] "Open Folder in Drive" link works
- [ ] Offline: Photos queue for upload
- [ ] Online: Queued photos upload automatically
- [ ] Disconnect Drive removes auth
- [ ] Settings saved successfully

### Test Scenarios

1. **New Job with Photos**:
   - Create job → Add photos → Save
   - Verify photos upload to new Drive folder

2. **Edit Existing Job**:
   - Open job → Add more photos → Save
   - Verify new photos added to existing folder

3. **Offline Mode**:
   - Turn off network → Take photos → Save job
   - Turn on network → Verify auto-upload

4. **Failed Upload**:
   - Disconnect Drive mid-job → Take photos
   - Verify failed status → Reconnect → Retry

5. **Multiple Categories**:
   - Add Before, During, and After photos
   - Verify categories display correctly in gallery

## Known Limitations

1. **Token Expiration**:
   - Access tokens expire after ~1 hour
   - User must reconnect to Google Drive
   - Workaround: Implement refresh token flow (future enhancement)

2. **Service Worker Background Sync**:
   - Not yet implemented
   - Photos only upload when app is open
   - Future enhancement: Background sync when app is closed

3. **Photo Editing**:
   - No built-in editing (crop, rotate, filters)
   - Photos uploaded as-is after compression
   - Future enhancement: Basic editing tools

4. **Bulk Operations**:
   - No bulk upload for existing jobs
   - Future enhancement: "Add Photos" to completed jobs

5. **Shared Folders**:
   - No folder sharing with team members
   - Each user manages their own Drive
   - Future enhancement: Team collaboration features

## Future Enhancements

### High Priority
- [ ] Background sync service worker
- [ ] Refresh token implementation for persistent auth
- [ ] Photo captions/notes
- [ ] Export job report as PDF with photos

### Medium Priority
- [ ] Bulk photo upload
- [ ] Photo editing (crop, rotate)
- [ ] Before/After comparison view
- [ ] Shared folder access for team

### Low Priority
- [ ] Photo search and filtering
- [ ] Custom folder structure
- [ ] Multiple Drive accounts
- [ ] Photo analytics (count by category, etc.)

## Troubleshooting

### Photos Not Uploading

1. Check Google Drive connection (Settings → Google Drive)
2. Verify you're online
3. Check browser console for errors
4. Retry failed uploads manually

### "Google Drive not configured"

1. Ensure `.env.local` exists with valid credentials
2. Restart dev server after adding `.env.local`
3. Check credentials are correct (no extra spaces)

### Token Expired

1. Go to Settings → Google Drive
2. Click "Connect to Google Drive" again
3. Re-authorize the app

## Performance Considerations

### Image Compression

- Original 5MB photo → Compressed to ~800KB-1.5MB
- Compression runs in Web Worker (non-blocking)
- Quality optimized for viewing, not printing

### Storage Impact

- IndexedDB: Temporary storage until upload completes
- Google Drive: Uses user's storage quota
- Typical job: 10 photos × 1MB = 10MB per job

### Network Usage

- Photos upload in foreground when online
- No automatic upload on metered connections (future enhancement)
- Failed uploads retry automatically

## Development

### Adding the Feature to an Existing Job Estimator

1. Install dependencies:
   ```bash
   npm install browser-image-compression
   ```

2. Copy these files to your project:
   - All files in `src/components/` (PhotoCapture, PhotoGallery)
   - All files in `src/lib/` (googleDrive, photoStorage, photoUploadManager)
   - Updated type definitions from `src/types/index.ts`

3. Update IndexedDB:
   - Increment DB_VERSION in `src/lib/db.ts`
   - Add new object stores

4. Update JobForm:
   - Import photo components
   - Add photo state and handlers
   - Add Photos section to form

5. Update Settings:
   - Add Google Drive tab
   - Add auth handlers

6. Configure environment:
   - Create `.env.local`
   - Add Google Cloud credentials

## Contributing

When contributing to photo integration:

1. **Test all sync states**: pending, uploading, uploaded, failed
2. **Test offline mode**: Capture offline, verify upload when online
3. **Test error handling**: Disconnect mid-upload, retry logic
4. **Mobile testing**: Camera access, responsive layout
5. **Update documentation**: If adding features, update this README

## License

Same as the main project license.
