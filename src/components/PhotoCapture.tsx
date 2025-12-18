/**
 * PhotoCapture Component
 * Handles camera capture and file upload for job photos
 */

import { Camera, Upload } from 'lucide-react';
import { useState } from 'react';
import { JobPhoto } from '../types';
import {
  captureFromCamera,
  selectMultipleFiles,
  blobToBase64,
  generatePhotoFileName,
  getFileExtension,
  createJobPhoto,
} from '../lib/photoStorage';

interface PhotoCaptureProps {
  onPhotoCapture: (photo: JobPhoto) => void;
  disabled?: boolean;
}

export default function PhotoCapture({ onPhotoCapture, disabled }: PhotoCaptureProps) {
  const [category, setCategory] = useState<'Estimate' | 'Before' | 'During' | 'After'>('Estimate');
  const [capturing, setCapturing] = useState(false);

  const handleCapture = async (source: 'camera' | 'file') => {
    if (disabled || capturing) return;

    setCapturing(true);
    try {
      // Get file(s) from camera or file system
      let files: File[];
      if (source === 'camera') {
        const file = await captureFromCamera();
        files = file ? [file] : [];
      } else {
        // For file uploads, allow multiple selection
        files = await selectMultipleFiles();
      }

      if (files.length === 0) {
        setCapturing(false);
        return;
      }

      // Process each file
      for (const file of files) {
        try {
          // Convert to base64 for local storage (no compression)
          const base64 = await blobToBase64(file);

          // Generate filename
          const extension = getFileExtension(file.name, file.type);
          const fileName = generatePhotoFileName(category, extension);

          // Create photo object
          const photo = createJobPhoto(category, fileName, base64);

          // Return to parent
          onPhotoCapture(photo);
        } catch (error) {
          console.error('Error processing file:', file.name, error);
          // Continue processing other files even if one fails
        }
      }
    } catch (error) {
      console.error('Error capturing photo:', error);
      alert('Failed to capture photo. Please try again.');
    } finally {
      setCapturing(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Category Selection */}
      <div>
        <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-2">
          Photo Category
        </label>
        <div className="flex flex-wrap gap-2">
          {(['Estimate', 'Before', 'During', 'After'] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              disabled={disabled || capturing}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                category === cat
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Capture Buttons */}
      <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          onClick={() => handleCapture('camera')}
          disabled={disabled || capturing}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 active:bg-blue-800 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed text-sm sm:text-base"
        >
          <Camera size={18} className="sm:w-5 sm:h-5" />
          {capturing ? 'Capturing...' : 'Take Photo'}
        </button>

        <button
          type="button"
          onClick={() => handleCapture('file')}
          disabled={disabled || capturing}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-600 text-white rounded-lg font-medium hover:bg-slate-700 active:bg-slate-800 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed text-sm sm:text-base"
        >
          <Upload size={18} className="sm:w-5 sm:h-5" />
          {capturing ? 'Uploading...' : 'Upload Photos'}
        </button>
      </div>

      <p className="text-xs text-slate-500">
        Select multiple photos at once when uploading. Photos will be uploaded at full size to Google Drive when online.
      </p>
    </div>
  );
}
