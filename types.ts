export enum ImageSize {
  Size1K = '1K',
  Size2K = '2K',
  Size4K = '4K'
}

export type VideoFormat = 'long-form' | 'shorts' | 'facebook';

export interface GeneratedTitle {
  original: string;
  suggestions: string[];
}

export interface GeneratedImage {
  id: string;
  data: string; // Base64
  mimeType: string;
  prompt: string;
  timestamp: number;
  format: VideoFormat;
}

export type LoadingState = 'idle' | 'optimizing_title' | 'generating_image' | 'editing_image';