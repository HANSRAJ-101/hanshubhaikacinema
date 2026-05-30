import React from 'react';
import { Play, Headphones, Film, Eye, Clock } from 'lucide-react';
import { MediaItem } from '../types';

interface MediaCardProps {
  key?: React.Key;
  media: MediaItem;
  onClick: () => void;
  savedProgress?: { currentTime: number; duration: number }; // tracks watched status
}

export default function MediaCard({ media, onClick, savedProgress }: MediaCardProps) {
  
  // Calculate percentage watched
  const watchedPercent = savedProgress && savedProgress.duration > 0
    ? Math.min(100, Math.round((savedProgress.currentTime / savedProgress.duration) * 100))
    : 0;

  // Format dynamic display duration (secs to mins)
  const formatSecs = (secs: number) => {
    if (!secs) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div 
      id={`media-card-${media.id}`}
      onClick={onClick}
      className="group bg-[#0d0d0d] border border-zinc-900/90 rounded-2xl overflow-hidden cursor-pointer shadow-lg hover:shadow-2xl hover:border-amber-500/20 hover:bg-zinc-900/40 transition-all duration-300 transform flex flex-col justify-between"
    >
      {/* Thumbnail block */}
      <div className="relative aspect-video w-full bg-[#050505] overflow-hidden shrink-0">
        <img
          src={media.thumbnailUrl || 'https://images.unsplash.com/photo-1542204172-e7052809a936?w=800'}
          alt={media.title}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover group-hover:scale-105 transition duration-550"
          loading="lazy"
        />

        {/* Play control Hover Trigger Overlay */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <div className="p-3 bg-gradient-to-br from-amber-400 to-amber-600 text-black rounded-full shadow-xl transform scale-90 group-hover:scale-100 transition duration-300">
            {media.type === 'video' ? <Play size={20} fill="currentColor" /> : <Headphones size={20} />}
          </div>
        </div>

        {/* Overlay category and duration pills */}
        <div className="absolute top-2.5 left-2.5 flex gap-1.5 pointer-events-none">
          <span className="px-2.5 py-0.5 text-[9px] font-mono font-bold tracking-wider text-amber-500 bg-[#050505]/95 border border-zinc-805 rounded backdrop-blur uppercase">
            {media.category}
          </span>
        </div>

        <div className="absolute bottom-2.5 right-2.5 pointer-events-none">
          <span className="px-2 py-0.5 text-[10px] font-mono text-zinc-350 bg-[#050505]/95 border border-zinc-850/80 rounded backdrop-blur flex items-center gap-1">
            <Clock size={10} className="text-amber-500/80" />
            <span>{formatSecs(media.duration)}</span>
          </span>
        </div>

        {/* Dynamic watched progress bar */}
        {watchedPercent > 0 && watchedPercent < 98 && (
          <div className="absolute bottom-0 inset-x-0 h-1 bg-[#050505]/80">
            <div 
              className="h-full bg-gradient-to-r from-amber-500 to-yellow-500 animate-pulse" 
              style={{ width: `${watchedPercent}%` }}
              title={`${watchedPercent}% watched`}
            />
          </div>
        )}
      </div>

      {/* Narrative Section */}
      <div className="p-4 flex-1 flex flex-col justify-between gap-3">
        <div className="space-y-1">
          <h3 className="font-serif font-bold text-zinc-200 group-hover:text-amber-400 text-sm line-clamp-2 leading-relaxed tracking-tight transition-colors duration-250">
            {media.title}
          </h3>
          <p className="text-xs text-zinc-450 line-clamp-1 leading-snug font-sans">
            {media.description || "No plot outline provided."}
          </p>
        </div>

        {/* Meta Stats row */}
        <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 border-t border-zinc-900/60 pt-2.5 mt-auto">
          <div className="flex items-center gap-1 shrink-0">
            <Eye size={11} className="text-zinc-655" />
            <span>{(media.views || 0).toLocaleString()} views</span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {watchedPercent > 0 && (
              <span className="text-[9px] font-bold text-amber-500 uppercase tracking-tight">
                {watchedPercent === 100 ? '✅ Finished' : `• Resume ${watchedPercent}%`}
              </span>
            )}
            <span>{media.uploadDate}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
