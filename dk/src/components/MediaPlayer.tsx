import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Maximize, Clock, Settings, ArrowLeft, Send, MessageSquare } from 'lucide-react';
import { MediaItem } from '../types';

interface MediaPlayerProps {
  media: MediaItem;
  userId: string;
  onBack: () => void;
  onMediaFinished?: () => void;
}

interface Comment {
  id: string;
  authorName: string;
  content: string;
  timestamp: string;
}

export default function MediaPlayer({ media, userId, onBack, onMediaFinished }: MediaPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressContainerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(media.duration || 0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isToastVisible, setIsToastVisible] = useState(false);
  const [savedOffset, setSavedOffset] = useState<number>(0);
  
  // Comments state
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [authorName, setAuthorName] = useState('Guest Critic');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Get active media player element
  const getMediaElement = () => {
    return media.type === 'video' ? videoRef.current : audioRef.current;
  };

  // Load saved playback position on mount
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setSavedOffset(0);
    setIsToastVisible(false);

    // Fetch from backend
    fetch(`/api/playback-positions?userId=${userId}`)
      .then(res => res.json())
      .then(positions => {
        const saved = positions[media.id];
        if (saved && saved.currentTime > 5 && saved.currentTime < (saved.duration - 5)) {
          setSavedOffset(saved.currentTime);
          setIsToastVisible(true);
          // Auto-seek when player is ready
          const element = getMediaElement();
          if (element) {
            element.currentTime = saved.currentTime;
          }
          // Dismiss toast after 7 seconds
          setTimeout(() => {
            setIsToastVisible(false);
          }, 7000);
        }
      })
      .catch(err => {
        // Fallback from localStorage
        try {
          const localPositions = JSON.parse(localStorage.getItem(`playback_${userId}`) || '{}');
          const saved = localPositions[media.id];
          if (saved && saved.currentTime > 5 && saved.currentTime < (saved.duration - 5)) {
            setSavedOffset(saved.currentTime);
            setIsToastVisible(true);
          }
        } catch {}
      });

    // Load static comments
    fetchComments();

    // Track View Counter
    fetch(`/api/media/${media.id}/view`, { method: 'POST' }).catch(() => {});
  }, [media.id, userId]);

  const fetchComments = () => {
    fetch(`/api/media/${media.id}/comments`)
      .then(res => res.json())
      .then(data => setComments(data))
      .catch(() => {});
  };

  // Save current playback position
  const savePlaybackPosition = (time: number, force = false) => {
    const el = getMediaElement();
    if (!el) return;
    const mediaDuration = el.duration || duration || 1;

    // Save to local Storage for zero-latency fallback
    try {
      const storageKey = `playback_${userId}`;
      const localPositions = JSON.parse(localStorage.getItem(storageKey) || '{}');
      localPositions[media.id] = {
        mediaId: media.id,
        currentTime: time,
        duration: mediaDuration,
        updatedAt: new Date().toISOString()
      };
      localStorage.setItem(storageKey, JSON.stringify(localPositions));
    } catch {}

    // Throttle server requests (only if explicitly forced or every 4 seconds)
    const lastSaved = (el as any).lastSavedTime || 0;
    if (force || Math.abs(time - lastSaved) >= 4) {
      (el as any).lastSavedTime = time;
      
      fetch('/api/playback-positions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          mediaId: media.id,
          currentTime: time,
          duration: mediaDuration,
          userId
        })
      }).catch(() => {});
    }
  };

  // Play/Pause handlers
  const handleTogglePlay = () => {
    const el = getMediaElement();
    if (!el) return;

    if (isPlaying) {
      el.pause();
      setIsPlaying(false);
      savePlaybackPosition(el.currentTime, true);
    } else {
      el.play().then(() => {
        setIsPlaying(true);
      }).catch(err => console.log('Autoplay blocked or playback issue:', err));
    }
  };

  const handleTimeUpdate = () => {
    const el = getMediaElement();
    if (!el) return;
    setCurrentTime(el.currentTime);
    savePlaybackPosition(el.currentTime);
  };

  const handleLoadedMetadata = () => {
    const el = getMediaElement();
    if (!el) return;
    setDuration(el.duration);
    if (savedOffset > 0) {
      el.currentTime = savedOffset;
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = getMediaElement();
    if (!el || !progressContainerRef.current) return;

    const rect = progressContainerRef.current.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const newTime = pos * duration;
    
    el.currentTime = newTime;
    setCurrentTime(newTime);
    savePlaybackPosition(newTime, true);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    setIsMuted(newVol === 0);
    const el = getMediaElement();
    if (el) {
      el.volume = newVol;
      el.muted = newVol === 0;
    }
  };

  const handleToggleMute = () => {
    const el = getMediaElement();
    if (!el) return;
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    el.muted = nextMuted;
  };

  const handleRestartMedia = () => {
    const el = getMediaElement();
    if (el) {
      el.currentTime = 0;
      setCurrentTime(0);
      savePlaybackPosition(0, true);
      setIsToastVisible(false);
      el.play();
      setIsPlaying(true);
    }
  };

  const handleMediaEnded = () => {
    setIsPlaying(false);
    savePlaybackPosition(0, true); // Reset position on finish
    if (onMediaFinished) {
      onMediaFinished();
    }
  };

  const handleFullscreen = () => {
    if (media.type === 'video' && videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      }
    }
  };

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setIsSubmittingComment(true);
    fetch(`/api/media/${media.id}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        authorName: authorName.trim() || 'Anonymous Critic',
        content: newComment.trim()
      })
    })
      .then(res => res.json())
      .then(comment => {
        setComments(prev => [...prev, comment]);
        setNewComment('');
        setIsSubmittingComment(false);
      })
      .catch(() => {
        setIsSubmittingComment(false);
      });
  };

  // Helper formatting minutes:seconds
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="bg-[#050505] text-[#f3f4f6] min-h-screen pb-16">
      {/* Upper action control banner */}
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <button 
          id="back-button"
          onClick={onBack}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-zinc-950 border border-zinc-900 text-zinc-350 hover:text-white hover:bg-zinc-900 transition cursor-pointer text-xs"
        >
          <ArrowLeft size={14} />
          <span>Back to Library</span>
        </button>

        <div className="flex items-center gap-2 text-xs font-mono text-amber-500 bg-amber-955/20 border border-amber-900/30 px-3.5 py-1.5 rounded-full uppercase tracking-wider text-[9px] font-bold">
          <Clock size={11} className="animate-pulse" />
          <span>Sync Session Activated</span>
        </div>
      </div>

      {/* Main Theater Board */}
      <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Media Player Frame */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* Custom Auto Resume Toast Banner */}
          {isToastVisible && savedOffset > 0 && (
            <div className="bg-gradient-to-r from-amber-950/60 to-[#0a0a0a] border border-amber-900/30 p-4 rounded-2xl shadow-2xl flex items-center justify-between text-xs sm:text-sm animate-fade-in">
              <div className="flex items-center gap-3">
                <Clock className="text-amber-500 shrink-0" size={16} />
                <span className="text-zinc-300">
                  Resumed playback from <strong className="text-amber-400 font-serif">{formatTime(savedOffset)}</strong> to save your spot!
                </span>
              </div>
              <button
                id="restart-media-btn"
                onClick={handleRestartMedia}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-805 border border-zinc-800 hover:border-amber-500/20 font-semibold rounded-lg text-xs text-amber-500 transition shrink-0 cursor-pointer"
              >
                <RotateCcw size={12} />
                <span>Start Over</span>
              </button>
            </div>
          )}

          {/* Player Media Container */}
          <div className="relative aspect-video rounded-3xl bg-black border border-zinc-900 overflow-hidden shadow-2xl group flex items-center justify-center">
            {media.type === 'video' ? (
              <video
                id="html5-video-player"
                ref={videoRef}
                src={media.url}
                className="w-full h-full object-contain"
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={handleMediaEnded}
                onClick={handleTogglePlay}
              />
            ) : (
              // Audio visual wrapper
              <div className="w-full h-full bg-gradient-to-b from-[#0d0d0d] via-[#050505] to-[#0a0a0a] flex flex-col items-center justify-center p-8 space-y-6">
                <audio
                  id="html5-audio-player"
                  ref={audioRef}
                  src={media.url}
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onEnded={handleMediaEnded}
                />
                
                {/* Simulated Waveform Visualizer */}
                <div className="flex items-end gap-1.5 h-32 w-64 justify-center">
                  {Array.from({ length: 18 }).map((_, i) => {
                    const randomHeight = isPlaying 
                      ? `${20 + Math.floor(Math.random() * 80)}%` 
                      : '8%';
                    return (
                      <div
                        key={i}
                        className="w-2.5 bg-gradient-to-t from-amber-600 to-amber-400 rounded-full transition-all duration-300"
                        style={{ height: randomHeight }}
                      />
                    );
                  })}
                </div>

                <div className="text-center space-y-2 max-w-md">
                  <span className="px-3 py-1 bg-amber-955/20 border border-amber-900/40 rounded-full text-[9px] text-amber-500 font-mono uppercase tracking-widest font-bold">
                    Audio Soundtrack Mode
                  </span>
                  <h3 className="font-serif font-bold text-lg text-zinc-100">{media.title}</h3>
                  <p className="text-xs text-zinc-400">{media.category}</p>
                </div>
              </div>
            )}

            {/* Custom Control overlay on hover */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent p-4 flex flex-col gap-3 transition-opacity duration-300 opacity-90 lg:opacity-0 lg:group-hover:opacity-100">
              
              {/* Progress Slider Bar */}
              <div 
                id="timeline-scroller"
                ref={progressContainerRef}
                onClick={handleSeek}
                className="h-1.5 bg-zinc-850 rounded-full cursor-pointer relative group/timeline"
              >
                <div 
                  className="absolute h-full bg-gradient-to-r from-amber-500 to-yellow-500 rounded-full"
                  style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                />
                <div 
                  className="absolute h-3 w-3 rounded-full bg-white border border-amber-500 shadow -top-1 opacity-0 group-hover/timeline:opacity-100 transition-opacity"
                  style={{ left: `calc(${(currentTime / (duration || 1)) * 100}% - 6px)` }}
                />
              </div>

              {/* Bottom Row controls */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-4">
                  <button 
                    id="media-play-toggle-btn"
                    onClick={handleTogglePlay}
                    className="p-1.5 hover:text-amber-400 text-zinc-100 transition cursor-pointer"
                  >
                    {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                  </button>

                  <button 
                    id="media-rewind-btn"
                    onClick={() => {
                      const el = getMediaElement();
                      if (el) el.currentTime = Math.max(0, el.currentTime - 10);
                    }}
                    className="p-1 hover:text-amber-400 text-zinc-400 transition text-[10px] font-mono cursor-pointer"
                  >
                    -10s
                  </button>

                  <button 
                    id="media-forward-btn"
                    onClick={() => {
                      const el = getMediaElement();
                      if (el) el.currentTime = Math.min(duration, el.currentTime + 10);
                    }}
                    className="p-1 hover:text-amber-400 text-zinc-400 transition text-[10px] font-mono cursor-pointer"
                  >
                    +10s
                  </button>

                  <div className="text-[11px] font-mono text-zinc-455 text-zinc-400 select-none">
                    <span>{formatTime(currentTime)}</span>
                    <span className="mx-1 text-zinc-700">/</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <button 
                      id="volume-mute-btn"
                      onClick={handleToggleMute}
                      className="p-1 text-zinc-400 hover:text-white transition cursor-pointer"
                    >
                      {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                    </button>
                    <input
                      id="volume-slider"
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      className="w-16 h-1 bg-zinc-800 accent-amber-500 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  {media.type === 'video' && (
                    <button 
                      id="fullscreen-mode-btn"
                      onClick={handleFullscreen}
                      className="p-1 text-zinc-400 hover:text-amber-400 transition cursor-pointer"
                      title="Fullscreen Theater"
                    >
                      <Maximize size={15} />
                    </button>
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* Title & Metadata Sheet */}
          <div className="bg-[#0d0d0d] border border-zinc-900 p-6 rounded-3xl space-y-4">
            <div className="space-y-1.5">
              <span className="px-2.5 py-0.5 text-[9px] font-mono font-bold tracking-wider text-amber-500 bg-amber-955/20 border border-amber-900/30 rounded uppercase">
                {media.category}
              </span>
              <h1 className="text-xl lg:text-2xl font-serif font-bold tracking-tight text-white leading-tight">{media.title}</h1>
              <div className="flex items-center gap-4 text-xs font-mono text-zinc-500">
                <span>{media.views.toLocaleString()} watch views</span>
                <span>•</span>
                <span>Released: {media.uploadDate}</span>
                {media.isExternal && (
                  <>
                    <span>•</span>
                    <span className="text-amber-500 font-semibold uppercase tracking-wider text-[9px]">Curation Stream Link</span>
                  </>
                )}
              </div>
            </div>

            <hr className="border-zinc-900" />

            <div className="text-zinc-350 text-sm leading-relaxed whitespace-pre-line font-sans">
              {media.description || "No supplemental details available for this presentation script."}
            </div>
          </div>

        </div>

        {/* Discussion and Interactive Remarks */}
        <div className="space-y-4">
          <div className="bg-[#0d0d0d] border border-zinc-900 rounded-3xl p-5 flex flex-col h-[520px]">
            
            <div className="flex items-center justify-between pb-4 border-b border-zinc-900 shrink-0">
              <div className="flex items-center gap-2">
                <MessageSquare size={16} className="text-amber-500" />
                <h2 className="font-serif font-bold text-zinc-200">Reactions</h2>
              </div>
              <span className="px-2 py-0.5 rounded bg-zinc-950 border border-zinc-900 text-[10px] font-mono font-bold text-amber-500/80">
                {comments.length}
              </span>
            </div>

            {/* Comments Stream */}
            <div className="flex-1 overflow-y-auto py-4 space-y-3.5 pr-1 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
              {comments.length === 0 ? (
                <div className="text-center py-16 text-zinc-500 text-xs border border-dashed border-zinc-904 rounded-2xl p-4 my-2">
                  No reactions posted yet. Be the first to start the anime discussion!
                </div>
              ) : (
                comments.map((comment, index) => (
                  <div key={comment.id || index} className="p-3 bg-[#050505]/40 rounded-2xl border border-zinc-900 text-xs space-y-1">
                    <div className="flex justify-between items-center text-zinc-400">
                      <span className="font-semibold text-amber-400 font-sans">{comment.authorName}</span>
                      <span className="font-mono text-[9px] text-zinc-650">
                        {new Date(comment.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-zinc-350 leading-relaxed break-words font-sans">{comment.content}</p>
                  </div>
                ))
              )}
            </div>

            {/* Write Reaction */}
            <form onSubmit={handlePostComment} className="pt-4 border-t border-zinc-900 space-y-3 shrink-0">
              <div className="grid grid-cols-3 gap-2">
                <input
                  id="comment-author-input"
                  type="text"
                  placeholder="Your Name"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  className="col-span-1 bg-[#050505] border border-zinc-900 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-zinc-650 focus:outline-none focus:border-amber-500/50 transition font-sans"
                  required
                />
                <span className="col-span-2 text-[10px] text-zinc-500 self-center font-mono">
                  Post review as guest critic
                </span>
              </div>
              <div className="relative">
                <input
                  id="comment-content-input"
                  type="text"
                  placeholder="Add to the conversation..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="w-full bg-[#050505] border border-zinc-900 rounded-xl pl-3 pr-10 py-2 text-xs text-zinc-200 placeholder-zinc-650 focus:outline-none focus:border-amber-500/50 transition font-sans"
                  maxLength={400}
                  required
                />
                <button
                  id="submit-comment-btn"
                  type="submit"
                  disabled={isSubmittingComment}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 text-amber-500 hover:text-amber-400 disabled:text-zinc-800 transition cursor-pointer"
                >
                  <Send size={13} />
                </button>
              </div>
            </form>

          </div>
        </div>

      </div>
    </div>
  );
}
