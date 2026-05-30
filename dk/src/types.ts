export type MediaType = 'video' | 'audio';

export interface MediaItem {
  id: string;
  title: string;
  description: string;
  type: MediaType;
  category: string;
  url: string; // can be local /uploads/filename or external stream URL
  thumbnailUrl?: string;
  duration: number; // in seconds
  uploadDate: string;
  views: number;
  isExternal: boolean;
  filename?: string;
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  mediaIds: string[];
}

export interface PlaybackPosition {
  mediaId: string;
  currentTime: number;
  duration: number;
  updatedAt: string;
}

export interface HistoryItem {
  id: string; // unique history entry id
  mediaId: string;
  watchedAt: string;
  completed: boolean;
  position: number; // last position in seconds
}

export interface Comment {
  id: string;
  mediaId: string;
  authorName: string;
  content: string;
  timestamp: string;
}
