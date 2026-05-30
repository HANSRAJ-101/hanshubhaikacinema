import React, { useState, useEffect } from 'react';
import { Lock, Unlock, Upload, Link, Trash2, CheckCircle2, AlertCircle, Play, Loader2, Music, Clapperboard, Film } from 'lucide-react';
import { MediaItem } from '../types';

interface AdminPanelProps {
  mediaItems: MediaItem[];
  onMediaChange: () => void;
  adminPasscode: string;
  setAdminPasscode: (pass: string) => void;
  isAdminLoggedIn: boolean;
  setIsAdminLoggedIn: (status: boolean) => void;
}

export default function AdminPanel({
  mediaItems,
  onMediaChange,
  adminPasscode,
  setAdminPasscode,
  isAdminLoggedIn,
  setIsAdminLoggedIn
}: AdminPanelProps) {
  // Gated Auth States
  const [passcodeInput, setPasscodeInput] = useState('');
  const [authError, setAuthError] = useState('');
  
  // Tab selector: 'upload-file' | 'external-link' | 'manage'
  const [activeTab, setActiveTab] = useState<'upload-file' | 'external-link' | 'manage'>('upload-file');

  // Input schemas for Media
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [mediaType, setMediaType] = useState<'video' | 'audio'>('video');
  const [category, setCategory] = useState('Anime');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  
  // Upload specific states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [externalUrl, setExternalUrl] = useState('');
  const [duration, setDuration] = useState('300'); // default seconds representation

  // Status logs
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitPercent, setSubmitPercent] = useState(0);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Auto clear feedback
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  // Handle local administrative passcode authentication
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: passcodeInput })
      });
      const data = await response.json();

      if (data.success) {
        setAdminPasscode(passcodeInput);
        setIsAdminLoggedIn(true);
        setFeedback({ type: 'success', message: 'Admin session activated.' });
      } else {
        setAuthError(data.message || 'Passcode rejected. Attempt logged.');
      }
    } catch {
      setAuthError('Error reaching auth gate.');
    }
  };

  const handleLogout = () => {
    setAdminPasscode('');
    setIsAdminLoggedIn(false);
    setPasscodeInput('');
    setFeedback({ type: 'success', message: 'Admin session terminated.' });
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setSelectedFile(null);
    setExternalUrl('');
    setThumbnailUrl('');
    setDuration('300');
  };

  // Handlers for Uploading media files natively (Form-Data)
  const handleUploadFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setFeedback({ type: 'error', message: 'Please select a video or audio file to upload.' });
      return;
    }
    if (!title.trim() || !category) {
      setFeedback({ type: 'error', message: 'Please specify a title and select a category.' });
      return;
    }

    setIsSubmitting(true);
    setSubmitPercent(0);
    setFeedback(null);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('title', title.trim());
    formData.append('description', description.trim());
    formData.append('type', mediaType);
    formData.append('category', category);
    formData.append('thumbnailUrl', thumbnailUrl.trim());
    formData.append('duration', duration);

    try {
      // Direct raw XHR file upload with percentage progress
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload', true);
      xhr.setRequestHeader('x-admin-passcode', adminPasscode);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          setSubmitPercent(percent);
        }
      };

      xhr.onload = () => {
        setIsSubmitting(false);
        if (xhr.status === 201) {
          setFeedback({ type: 'success', message: `"${title}" has been uploaded and queued into catalog.` });
          resetForm();
          onMediaChange();
        } else {
          try {
            const errData = JSON.parse(xhr.responseText);
            setFeedback({ type: 'error', message: errData.error || 'Upload was aborted by server.' });
          } catch {
            setFeedback({ type: 'error', message: 'Failed to upload file. Check connectivity.' });
          }
        }
      };

      xhr.onerror = () => {
        setIsSubmitting(false);
        setFeedback({ type: 'error', message: 'Network breakdown/Interrupted during transmission.' });
      };

      xhr.send(formData);
    } catch (err) {
      setIsSubmitting(false);
      setFeedback({ type: 'error', message: 'Action failed to pipeline.' });
    }
  };

  // Handlers for Registering Live URLs/Streams
  const handleRegisterExternal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!externalUrl.trim()) {
      setFeedback({ type: 'error', message: 'Steam link location is required.' });
      return;
    }
    if (!title.trim() || !category) {
      setFeedback({ type: 'error', message: 'A title and category selection are required.' });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    const payload = {
      title: title.trim(),
      description: description.trim(),
      type: mediaType,
      category,
      url: externalUrl.trim(),
      thumbnailUrl: thumbnailUrl.trim() || undefined,
      duration: Number(duration) || 120
    };

    try {
      const response = await fetch('/api/media/external', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-passcode': adminPasscode
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      setIsSubmitting(false);

      if (response.ok) {
        setFeedback({ type: 'success', message: `External media "${title}" registered.` });
        resetForm();
        onMediaChange();
      } else {
        setFeedback({ type: 'error', message: data.error || 'Server rejected request.' });
      }
    } catch {
      setIsSubmitting(false);
      setFeedback({ type: 'error', message: 'Unable to connect to registry API.' });
    }
  };

  // Handlers for deleting media from database catalogue
  const handleDeleteMedia = async (id: string, title: string) => {
    try {
      const response = await fetch(`/api/media/${id}`, {
        method: 'DELETE',
        headers: {
          'x-admin-passcode': adminPasscode
        }
      });
      const data = await response.json();

      if (response.ok) {
        setFeedback({ type: 'success', message: `"${title}" was removed successfully.` });
        onMediaChange();
      } else {
        setFeedback({ type: 'error', message: data.error || 'Delete process failure.' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Network breakdown connecting to remove action.' });
    }
  };

  // Guard Lock Screen
  if (!isAdminLoggedIn) {
    return (
      <div className="max-w-md mx-auto my-16 bg-[#0d0d0d] border border-zinc-900 rounded-3xl p-8 shadow-2xl space-y-6 animate-fade-in">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-full bg-[#050505] border border-zinc-900 text-amber-500">
            <Lock size={26} className="animate-pulse" />
          </div>
          <h2 className="text-xl font-serif font-bold text-zinc-100">Administrative Gate</h2>
          <p className="text-xs text-zinc-400 font-sans">
            Only the authenticated host curator can upload video or audio. Enter your security passcode.
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500 mb-1.5" htmlFor="admin-passcode-field">
              Creator Security Passcode
            </label>
            <input
              id="admin-passcode-field"
              type="password"
              placeholder="e.g. admin123"
              value={passcodeInput}
              onChange={(e) => setPasscodeInput(e.target.value)}
              className="w-full bg-[#050505] border border-zinc-900 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-700 focus:outline-none focus:border-amber-500/50 transition font-sans"
              required
            />
          </div>

          {authError && (
            <div className="flex items-center gap-2 p-3 bg-red-955/20 border border-red-900/40 rounded-xl text-xs text-red-100 font-mono">
              <AlertCircle size={14} className="shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <button
            id="admin-login-submit"
            type="submit"
            className="w-full py-3 bg-[#0d0d0d] hover:bg-[#121212] border border-amber-500/30 font-semibold text-xs text-amber-500 transition flex items-center justify-center gap-2 rounded-xl cursor-pointer shadow-lg hover:border-amber-400"
          >
            <span>Unlock Control Dashboard</span>
          </button>
        </form>

        <div className="text-center border-t border-zinc-900 pt-4 text-[10px] text-zinc-500 font-mono">
          Default Developer Passcode: <span className="text-zinc-400">admin123</span>
        </div>
      </div>
    );
  }

  // Dashboard Control Panel
  return (
    <div className="max-w-5xl mx-auto my-6 space-y-6">
      
      {/* Header Bar */}
      <div className="bg-[#0d0d0d] border border-zinc-900 p-5 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-955/20 border border-amber-900/35 text-amber-500 rounded-xl">
            <Unlock size={20} />
          </div>
          <div>
            <h2 className="font-serif font-bold text-zinc-100">Owner Terminal Unlocked</h2>
            <p className="text-xs text-zinc-400 font-sans">Add media assets, track storage catalogues, and edit playlists.</p>
          </div>
        </div>

        <button
          id="admin-logout-btn"
          onClick={handleLogout}
          className="px-4 py-2 border border-zinc-900 hover:bg-zinc-900 text-xs font-semibold text-zinc-300 rounded-xl transition cursor-pointer"
        >
          Exit Terminal
        </button>
      </div>

      {/* Global alert feedback */}
      {feedback && (
        <div className={`p-4 rounded-xl border flex items-start gap-3 text-xs ${
          feedback.type === 'success' 
            ? 'bg-amber-955/20 border-amber-900/40 text-amber-500 font-sans' 
            : 'bg-red-955/25 border-red-900/40 text-red-400 font-mono'
        }`}>
          {feedback.type === 'success' ? <CheckCircle2 size={16} className="shrink-0" /> : <AlertCircle size={16} className="shrink-0" />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Sub Tabs Toggle */}
      <div className="flex border-b border-zinc-900 gap-6 text-sm">
        <button
          id="tab-upload-file"
          onClick={() => { setActiveTab('upload-file'); setFeedback(null); }}
          className={`pb-3 font-semibold transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'upload-file' ? 'text-amber-500 border-b-2 border-amber-500' : 'text-zinc-500 hover:text-zinc-350'
          }`}
        >
          <Upload size={16} />
          <span>Upload Real Files</span>
        </button>
        <button
          id="tab-external-link"
          onClick={() => { setActiveTab('external-link'); setFeedback(null); }}
          className={`pb-3 font-semibold transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'external-link' ? 'text-amber-500 border-b-2 border-amber-500' : 'text-zinc-500 hover:text-zinc-350'
          }`}
        >
          <Link size={16} />
          <span>Stream From External URLs</span>
        </button>
        <button
          id="tab-manage"
          onClick={() => { setActiveTab('manage'); setFeedback(null); }}
          className={`pb-3 font-semibold transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'manage' ? 'text-amber-500 border-b-2 border-amber-500' : 'text-zinc-500 hover:text-zinc-350'
          }`}
        >
          <Film size={16} />
          <span>Manage Catalogue ({mediaItems.length})</span>
        </button>
      </div>

      {/* Upload File Form */}
      {activeTab === 'upload-file' && (
        <form onSubmit={handleUploadFile} className="bg-[#0d0d0d] border border-zinc-900 p-6 rounded-3xl space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Left Inputs */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5 font-sans">Media Title *</label>
                <input
                  id="upload-title"
                  type="text"
                  placeholder="e.g., Attack on Titan Season 4 Opening"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-[#050505] border border-zinc-900 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/50 transition font-sans"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1.5 font-sans">Description Details</label>
                <textarea
                  id="upload-desc"
                  placeholder="Insert lyrics, subtitles, cast, synopsis details..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-[#050505] border border-zinc-900 rounded-xl px-3.5 py-2.5 text-sm h-32 text-white focus:outline-none focus:border-amber-500/50 transition resize-none font-sans"
                />
              </div>
            </div>

            {/* Right Inputs */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5 font-sans">Media Class *</label>
                  <select
                    id="upload-type"
                    value={mediaType}
                    onChange={(e) => setMediaType(e.target.value as 'video' | 'audio')}
                    className="w-full bg-[#050505] border border-zinc-900 rounded-xl px-3.5 py-2.5 text-sm text-zinc-300 focus:outline-none focus:border-amber-500/50"
                  >
                    <option value="video">🎥 Video File</option>
                    <option value="audio">🎵 Audio Track</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5 font-sans">Genre & Category *</label>
                  <select
                    id="upload-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-[#050505] border border-zinc-900 rounded-xl px-3.5 py-2.5 text-sm text-zinc-300 focus:outline-none focus:border-amber-500/50"
                  >
                    <option value="Anime">Anime</option>
                    <option value="Movies">Movies</option>
                    <option value="Series">Series</option>
                    <option value="Music Video">Music Video</option>
                    <option value="Audio Tracks">Audio Tracks</option>
                    <option value="Other">Other Category</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5 font-sans">Thumbnail Picture (Optional URL)</label>
                  <input
                    id="upload-thumbnail"
                    type="url"
                    placeholder="https://images.unsplash.com/... or blank"
                    value={thumbnailUrl}
                    onChange={(e) => setThumbnailUrl(e.target.value)}
                    className="w-full bg-[#050505] border border-[#161616] rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/50 font-sans"
                  />
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5 font-sans">Simulated Duration (seconds)</label>
                  <input
                    id="upload-duration"
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="w-full bg-[#050505] border border-[#161616] rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
                    min="1"
                    required
                  />
                </div>
              </div>

              {/* Local File Selector Container */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5 font-sans">Media File Selection * (Max 150MB)</label>
                <div className="border border-dashed border-zinc-850 hover:border-amber-500/30 rounded-xl p-5 bg-[#050505] text-center transition cursor-pointer relative font-sans">
                  <input
                    id="file-element-uploader"
                    type="file"
                    accept={mediaType === 'video' ? 'video/*' : 'audio/*'}
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setSelectedFile(e.target.files[0]);
                      }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer animate-fade-in"
                    disabled={isSubmitting}
                  />
                  <div className="space-y-2 pointer-events-none">
                    <div className="flex justify-center text-amber-550">
                      {mediaType === 'video' ? <Clapperboard size={28} className="text-amber-500" /> : <Music size={28} className="text-amber-500" />}
                    </div>
                    {selectedFile ? (
                      <div>
                        <p className="text-sm font-medium text-amber-500 line-clamp-1">{selectedFile.name}</p>
                        <p className="text-[10px] text-zinc-500 font-mono">Size: {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs text-zinc-300">Click to locate raw {mediaType} file, or drag & drop</p>
                        <p className="text-[10px] text-zinc-500 font-mono">Supports MP4, WebM, MP3, WAV</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Submission bar */}
          <div className="pt-4 border-t border-zinc-900 flex flex-col sm:flex-row items-center justify-between gap-4">
            {isSubmitting ? (
              <div className="w-full sm:w-2/3 flex items-center gap-3 bg-[#050505] p-2.5 rounded-xl border border-zinc-900">
                <Loader2 className="animate-spin text-amber-500 shrink-0" size={16} />
                <div className="flex-1">
                  <div className="flex justify-between items-center text-[10px] font-mono mb-1 text-zinc-400">
                    <span>TRANSMITTING MULTIPART CHUNKS TO SERVLET</span>
                    <span>{submitPercent}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-amber-500 to-yellow-500 transition-all duration-300" style={{ width: `${submitPercent}%` }} />
                  </div>
                </div>
              </div>
            ) : (
              <span className="text-[10px] text-zinc-550 max-w-sm font-mono leading-relaxed">
                * Note: Standard Cloud containers support server-local uploads during runtime lifecycle. Files remain active until rebuild container reset.
              </span>
            )}

            <button
              id="upload-file-submit-btn"
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-3 w-full sm:w-auto bg-[#0d0d0d] hover:bg-[#121212] border border-amber-500/30 text-amber-500 disabled:bg-zinc-950 disabled:text-zinc-700 disabled:border-transparent rounded-xl font-semibold text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow hover:border-amber-400"
            >
              <span>Initiate Server File Upload</span>
            </button>
          </div>
        </form>
      )}

      {/* External Link Form */}
      {activeTab === 'external-link' && (
        <form onSubmit={handleRegisterExternal} className="bg-[#0d0d0d] border border-zinc-900 p-6 rounded-3xl space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Left Column */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5 font-sans">Media Title *</label>
                <input
                  id="external-title"
                  type="text"
                  placeholder="e.g. Sintel - Open CGI Movie"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-[#050505] border border-zinc-900 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/50 font-sans"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1.5 font-sans">Direct Streaming Endpoint Link *</label>
                <input
                  id="external-stream-url"
                  type="url"
                  placeholder="https://...mp4 or https://...mp3 direct url"
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  className="w-full bg-[#050505] border border-zinc-900 rounded-xl px-3.5 py-2.5 text-sm text-amber-400 font-mono focus:outline-none focus:border-amber-500/50"
                  required
                />
                <span className="text-[10px] text-zinc-550 font-mono mt-1 block leading-relaxed">
                  Must be a direct, CORS-open web link with media headers (MP4, MP3).
                </span>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1.5 font-sans">Description Synopsis</label>
                <textarea
                  id="external-desc"
                  placeholder="Enter video timeline, episodes list, synopsis etc..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-[#050505] border border-zinc-900 rounded-xl px-3.5 py-2.5 text-sm h-28 text-white focus:outline-none focus:border-amber-500/50 transition resize-none font-sans"
                />
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5 font-sans">Media Class *</label>
                  <select
                    id="external-type"
                    value={mediaType}
                    onChange={(e) => setMediaType(e.target.value as 'video' | 'audio')}
                    className="w-full bg-[#050505] border border-zinc-900 rounded-xl px-3.5 py-2.5 text-sm text-zinc-350"
                  >
                    <option value="video">🎥 Video URL</option>
                    <option value="audio">🎵 Audio URL</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5 font-sans">Genre & Category *</label>
                  <select
                    id="external-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-[#050505] border border-zinc-900 rounded-xl px-3.5 py-2.5 text-sm text-zinc-350"
                  >
                    <option value="Anime">Anime</option>
                    <option value="Movies">Movies</option>
                    <option value="Series">Series</option>
                    <option value="Music Video">Music Video</option>
                    <option value="Audio Tracks">Audio Tracks</option>
                    <option value="Other">Other Category</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-zinc-300 mb-1.5">Thumbnail Cover Image URL</label>
                <input
                  id="external-thumbnail-url"
                  type="url"
                  placeholder="https://images.unsplash.com/... or search banner"
                  value={thumbnailUrl}
                  onChange={(e) => setThumbnailUrl(e.target.value)}
                  className="w-full bg-[#050505] border border-zinc-900 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                  Copy any image URL to set. Highly recommended to keep visual aesthetic crisp!
                </span>
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1.5">Source Duration (seconds) *</label>
                <input
                  id="external-duration"
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="w-full bg-[#050505] border border-zinc-900 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
                  min="1"
                  required
                />
              </div>
            </div>

          </div>

          <div className="pt-4 border-t border-[#121212] flex justify-end">
            <button
              id="external-submit-btn"
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-3 w-full sm:w-auto bg-[#0d0d0d] hover:bg-[#121212] border border-amber-500/30 text-amber-500 rounded-xl font-semibold text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow hover:border-amber-400"
            >
              {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : null}
              <span>Register Instant Stream Link</span>
            </button>
          </div>
        </form>
      )}

      {/* Catalogue List */}
      {activeTab === 'manage' && (
        <div className="bg-[#0d0d0d] border border-zinc-900 rounded-3xl p-5 overflow-hidden animate-fade-in">
          <div className="overflow-x-auto">
            <table className="w-full text-zinc-300 text-xs">
              <thead>
                <tr className="border-b border-zinc-900 text-amber-500 font-mono uppercase tracking-wider align-middle text-[10px] font-bold">
                  <th className="py-3 px-4 text-left">Asset Info</th>
                  <th className="py-3 px-4 text-left">Classification</th>
                  <th className="py-3 px-4 text-left">Type</th>
                  <th className="py-3 px-4 text-left">Location</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {mediaItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-zinc-500 italic font-serif">
                      Archive is void. No media streaming elements loaded.
                    </td>
                  </tr>
                ) : (
                  mediaItems.map((item) => (
                    <tr key={item.id} className="hover:bg-zinc-950/40 transition align-middle">
                      <td className="py-3.5 px-4 font-serif font-bold text-zinc-100 max-w-xs truncate">
                        {item.title}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-amber-955/20 border border-amber-900/30 text-amber-500 font-mono font-bold uppercase tracking-wider">{item.category}</span>
                      </td>
                      <td className="py-3.5 px-4 font-sans text-zinc-450">
                        <span className="capitalize">{item.type}</span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[10px] max-w-[160px] truncate text-zinc-500">
                        {item.url}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {deletingId === item.id ? (
                          <div className="flex items-center justify-center gap-1.5 animate-fade-in">
                            <button
                              id={`confirm-delete-${item.id}`}
                              onClick={() => {
                                handleDeleteMedia(item.id, item.title);
                                setDeletingId(null);
                              }}
                              className="px-2 py-1 bg-red-650 hover:bg-red-500 border border-red-500/20 text-white rounded text-[10px] font-bold uppercase transition cursor-pointer"
                            >
                              Confirm
                            </button>
                            <button
                              id={`cancel-delete-${item.id}`}
                              onClick={() => setDeletingId(null)}
                              className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-350 rounded text-[10px] font-bold uppercase transition cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            id={`delete-btn-${item.id}`}
                            onClick={() => setDeletingId(item.id)}
                            className="p-1.5 font-medium hover:text-red-400 hover:bg-red-955/10 text-zinc-400 border border-transparent hover:border-red-900/40 rounded-lg transition cursor-pointer"
                            title="Purge Asset"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
