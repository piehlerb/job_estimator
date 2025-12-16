/**
 * PhotoGallery Component
 * Displays job photos with thumbnails, sync status, and modal viewer
 */

import { X, ExternalLink, Trash2, CheckCircle, AlertCircle, Loader, Clock } from 'lucide-react';
import { useState } from 'react';
import { JobPhoto } from '../types';
import { getDriveFileUrl, getDriveFolderUrl } from '../lib/googleDrive';

interface PhotoGalleryProps {
  photos: JobPhoto[];
  folderId?: string;
  onDeletePhoto?: (photoId: string) => void;
  onRetryUpload?: (photoId: string) => void;
}

export default function PhotoGallery({
  photos,
  folderId,
  onDeletePhoto,
  onRetryUpload,
}: PhotoGalleryProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<JobPhoto | null>(null);

  const getSyncStatusIcon = (status: JobPhoto['syncStatus']) => {
    switch (status) {
      case 'uploaded':
        return <CheckCircle size={16} className="text-green-600" />;
      case 'uploading':
        return <Loader size={16} className="text-blue-600 animate-spin" />;
      case 'failed':
        return <AlertCircle size={16} className="text-red-600" />;
      case 'pending':
        return <Clock size={16} className="text-yellow-600" />;
    }
  };

  const getSyncStatusText = (status: JobPhoto['syncStatus']) => {
    switch (status) {
      case 'uploaded':
        return 'Uploaded';
      case 'uploading':
        return 'Uploading...';
      case 'failed':
        return 'Failed';
      case 'pending':
        return 'Pending';
    }
  };

  const getCategoryColor = (category: JobPhoto['category']) => {
    switch (category) {
      case 'Estimate':
        return 'bg-purple-100 text-purple-800';
      case 'Before':
        return 'bg-blue-100 text-blue-800';
      case 'During':
        return 'bg-yellow-100 text-yellow-800';
      case 'After':
        return 'bg-green-100 text-green-800';
    }
  };

  if (photos.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500 text-sm">
        No photos yet. Add photos using the buttons above.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Open Folder Link */}
      {folderId && (
        <div className="flex justify-end">
          <a
            href={getDriveFolderUrl(folderId)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs sm:text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            <ExternalLink size={14} />
            Open Folder in Drive
          </a>
        </div>
      )}

      {/* Photo Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {photos.map((photo) => (
          <div
            key={photo.id}
            className="relative group bg-slate-100 rounded-lg overflow-hidden border border-slate-200"
          >
            {/* Thumbnail */}
            <button
              type="button"
              onClick={() => setSelectedPhoto(photo)}
              className="w-full aspect-square overflow-hidden"
            >
              <img
                src={photo.localUri || ''}
                alt={`${photo.category} - ${photo.fileName}`}
                className="w-full h-full object-cover hover:scale-105 transition-transform"
              />
            </button>

            {/* Category Badge */}
            <div className="absolute top-1.5 left-1.5">
              <span
                className={`px-1.5 py-0.5 rounded text-xs font-medium ${getCategoryColor(
                  photo.category
                )}`}
              >
                {photo.category}
              </span>
            </div>

            {/* Sync Status */}
            <div className="absolute top-1.5 right-1.5 bg-white/90 backdrop-blur-sm rounded-full p-1">
              {getSyncStatusIcon(photo.syncStatus)}
            </div>

            {/* Delete Button */}
            {onDeletePhoto && (
              <button
                type="button"
                onClick={() => onDeletePhoto(photo.id)}
                className="absolute bottom-1.5 right-1.5 bg-red-600 hover:bg-red-700 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 size={14} />
              </button>
            )}

            {/* File Info */}
            <div className="px-2 py-1.5 bg-white border-t border-slate-200">
              <p className="text-xs text-slate-600 truncate">{photo.fileName}</p>
              <div className="flex items-center gap-1 mt-0.5">
                {getSyncStatusIcon(photo.syncStatus)}
                <span className="text-xs text-slate-500">{getSyncStatusText(photo.syncStatus)}</span>
              </div>
              {photo.syncStatus === 'failed' && photo.errorMessage && (
                <p className="text-xs text-red-600 mt-0.5 truncate">{photo.errorMessage}</p>
              )}
              {photo.syncStatus === 'failed' && onRetryUpload && (
                <button
                  type="button"
                  onClick={() => onRetryUpload(photo.id)}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium mt-1"
                >
                  Retry Upload
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal Viewer */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-white rounded-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute top-2 right-2 bg-white/90 hover:bg-white rounded-full p-2 z-10"
            >
              <X size={20} />
            </button>

            {/* Image */}
            <div className="overflow-auto max-h-[70vh]">
              <img
                src={selectedPhoto.localUri || ''}
                alt={`${selectedPhoto.category} - ${selectedPhoto.fileName}`}
                className="w-full h-auto"
              />
            </div>

            {/* Info */}
            <div className="p-4 bg-slate-50 border-t border-slate-200">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${getCategoryColor(
                        selectedPhoto.category
                      )}`}
                    >
                      {selectedPhoto.category}
                    </span>
                    <div className="flex items-center gap-1">
                      {getSyncStatusIcon(selectedPhoto.syncStatus)}
                      <span className="text-sm text-slate-600">
                        {getSyncStatusText(selectedPhoto.syncStatus)}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm font-medium text-slate-900">{selectedPhoto.fileName}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Captured: {new Date(selectedPhoto.capturedAt).toLocaleString()}
                  </p>
                  {selectedPhoto.uploadedAt && (
                    <p className="text-xs text-slate-500">
                      Uploaded: {new Date(selectedPhoto.uploadedAt).toLocaleString()}
                    </p>
                  )}
                  {selectedPhoto.syncStatus === 'failed' && selectedPhoto.errorMessage && (
                    <p className="text-sm text-red-600 mt-2">{selectedPhoto.errorMessage}</p>
                  )}
                </div>

                <div className="flex gap-2">
                  {selectedPhoto.driveFileId && (
                    <a
                      href={getDriveFileUrl(selectedPhoto.driveFileId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                    >
                      <ExternalLink size={14} />
                      Open in Drive
                    </a>
                  )}
                  {selectedPhoto.syncStatus === 'failed' && onRetryUpload && (
                    <button
                      onClick={() => {
                        onRetryUpload(selectedPhoto.id);
                        setSelectedPhoto(null);
                      }}
                      className="px-3 py-2 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-700"
                    >
                      Retry Upload
                    </button>
                  )}
                  {onDeletePhoto && (
                    <button
                      onClick={() => {
                        onDeletePhoto(selectedPhoto.id);
                        setSelectedPhoto(null);
                      }}
                      className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
