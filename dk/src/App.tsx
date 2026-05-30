import React, { useState, useEffect } from 'react';
import { Play, List, Tv, Headphones, Lock, Unlock, Search, Sparkles, User, Settings, FolderClosed, History, Library, ArrowRight, RotateCw, Plus, Mail, LogOut, Disc } from 'lucide-react';
import { MediaItem, Playlist, PlaybackPosition } from './types';
import MediaCard from './components/MediaCard';
import MediaPlayer from './components/MediaPlayer';
import PlaylistManager from './components/PlaylistManager';
import AdminPanel from './components/AdminPanel';

export default function App() {
  // Navigation Sections: 'library' | 'playlists' | 'admin' 
  const [activeSection, setActiveSection] = useState<'library' | 'playlists' | 'admin'>('library');

  // Media & DB states
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [playbackPositions, setPlaybackPositions] = useState<Record<string, PlaybackPosition>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Active watching media
  const [activePlayingMedia, setActivePlayingMedia] = useState<MediaItem | null>(null);

  // Auth States
  const [auth, setAuth] = useState<{ id: string; email: string; nickname: string } | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authNickname, setAuthNickname] = useState('');
  const [authError, setAuthError] = useState('');
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);

  // Profile watch session nickname (enables personalized "when I relogin" history sync)
  const [userId, setUserId] = useState<string>('');
  const [viewerNickname, setViewerNickname] = useState('');
  const [showProfileConfig, setShowProfileConfig] = useState(false);
  const [nicknameInput, setNicknameInput] = useState('');

  // Filtering controls
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  // Admin lock persistent credentials
  const [adminPasscode, setAdminPasscode] = useState('');
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);

  // Initial Seed loaders inside the authenticated context (performs auto-login securely)
  useEffect(() => {
    const savedAuth = localStorage.getItem('mediastream_auth_user');
    if (savedAuth) {
      try {
        const parsed = JSON.parse(savedAuth);
        setAuth(parsed);
        setUserId(parsed.id);
        setViewerNickname(parsed.nickname);
        setNicknameInput(parsed.nickname);
        refreshData(parsed.id);
      } catch (err) {
        console.error('Failed to restore active authentication session:', err);
        setAuth(null);
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  }, []);

  const refreshData = async (activeUid = userId) => {
    setIsLoading(true);
    const targetUid = activeUid || localStorage.getItem('mediastream_user_id') || 'anonymous';
    try {
      // 1. Fetch Media items list
      const mediaRes = await fetch('/api/media');
      const mediaData = await mediaRes.json();
      setMediaItems(mediaData);

      // 2. Fetch Playlists Curation
      const plRes = await fetch('/api/playlists');
      const plData = await plRes.json();
      setPlaylists(plData);

      // 3. Sync player timestamps
      const progressRes = await fetch(`/api/playback-positions?userId=${targetUid}`);
      const progressData = await progressRes.json();
      setPlaybackPositions(progressData || {});
    } catch (err) {
      console.error('Failed to parse database sync:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Auth Submit Handlers
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsAuthSubmitting(true);

    const url = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
    const payload = authMode === 'login'
      ? { email: authEmail, password: authPassword }
      : { email: authEmail, password: authPassword, nickname: authNickname };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Authentication details invalid');
      }

      const userSession = data.user;
      localStorage.setItem('mediastream_auth_user', JSON.stringify(userSession));
      localStorage.setItem('mediastream_user_id', userSession.id);
      localStorage.setItem('mediastream_nickname', userSession.nickname);

      setAuth(userSession);
      setUserId(userSession.id);
      setViewerNickname(userSession.nickname);
      setNicknameInput(userSession.nickname);

      // Refresh loaded media
      refreshData(userSession.id);
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed');
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  // Clear Session Logout Handler
  const handleLogout = () => {
    localStorage.removeItem('mediastream_auth_user');
    localStorage.removeItem('mediastream_user_id');
    localStorage.removeItem('mediastream_nickname');
    setAuth(null);
    setUserId('');
    setViewerNickname('');
    setActivePlayingMedia(null);
  };

  // Re-fetch progress whenever media player closes
  const handleExitPlayer = () => {
    setActivePlayingMedia(null);
    refreshData(userId);
  };

  // Handle Nickname profile update
  const handleSaveProfile = () => {
    if (!nicknameInput.trim() || !auth) return;
    
    // Update local profile visual nickname & storage config
    const updatedAuth = { ...auth, nickname: nicknameInput.trim() };
    localStorage.setItem('mediastream_auth_user', JSON.stringify(updatedAuth));
    localStorage.setItem('mediastream_nickname', updatedAuth.nickname);
    
    setAuth(updatedAuth);
    setViewerNickname(updatedAuth.nickname);
    setShowProfileConfig(false);
  };

  // Handle Quick Add to Playlist
  const handleAddMediaToPlaylist = async (playlistId: string, mediaId: string) => {
    try {
      const response = await fetch(`/api/playlists/${playlistId}/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaId })
      });
      if (response.ok) {
        refreshData(userId);
      }
    } catch {}
  };

  // Categories lists
  const categories = ['All', 'Anime', 'Movies', 'Series', 'Music Video', 'Audio Tracks'];

  // Filter computation
  const filteredMedia = mediaItems.filter(item => {
    const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Highlight featured spotlight asset
  const spotlightItem = mediaItems.find(m => m.category === 'Anime' || m.category === 'Movies') || mediaItems[0];

  if (!auth && !isLoading) {
    return (
      <div className="bg-[#050505] text-zinc-100 min-h-screen flex items-center justify-center p-4 font-sans selection:bg-amber-500 selection:text-black antialiased relative overflow-hidden">
        {/* Decorative background gradients */}
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-amber-500/5 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] rounded-full bg-yellow-600/5 blur-[100px] pointer-events-none" />

        <div className="w-full max-w-md bg-[#0b0b0b] border border-zinc-900 rounded-3xl p-8 shadow-2xl space-y-8 relative z-10 animate-fade-in duration-300">
          
          {/* Logo Brand Header */}
          <div className="text-center space-y-3">
            <div className="inline-flex p-3.5 rounded-2xl bg-gradient-to-br from-amber-500 via-yellow-600 to-amber-700 text-black shadow-xl shadow-amber-500/15 border border-amber-400/20">
              <Tv size={24} className="text-black" />
            </div>
            <div>
              <h1 className="text-2xl font-serif font-bold tracking-tight text-white">
                Animedia <span className="text-amber-500">Stream</span>
              </h1>
              <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mt-1">
                Cinema Portal & Archive Gate
              </p>
            </div>
          </div>

          {/* Form container */}
          <div className="space-y-6">
            <div className="flex border-b border-zinc-900 pb-1 gap-4 text-xs font-semibold">
              <button
                type="button"
                id="toggle-auth-login"
                onClick={() => { setAuthMode('login'); setAuthError(''); }}
                className={`pb-2.5 transition-colors border-b-2 px-1 ${
                  authMode === 'login' ? 'text-amber-500 border-amber-500 font-bold' : 'text-zinc-500 border-transparent hover:text-zinc-450'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                id="toggle-auth-register"
                onClick={() => { setAuthMode('register'); setAuthError(''); }}
                className={`pb-2.5 transition-colors border-b-2 px-1 ${
                  authMode === 'register' ? 'text-amber-500 border-amber-500 font-bold' : 'text-zinc-500 border-transparent hover:text-zinc-455'
                }`}
              >
                Register Account
              </button>
            </div>

            <form onSubmit={handleAuth} className="space-y-4 font-sans">
              {authMode === 'register' && (
                <div className="space-y-1.5 font-sans">
                  <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500" htmlFor="auth-nickname">
                    Display Name
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-3 flex items-center text-zinc-650">
                      <User size={14} />
                    </span>
                    <input
                      id="auth-nickname"
                      type="text"
                      placeholder="e.g. CinemaFan"
                      required
                      value={authNickname}
                      onChange={(e) => setAuthNickname(e.target.value)}
                      className="w-full bg-[#050505] border border-zinc-900 rounded-xl pl-9 pr-4 py-3 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-amber-500/50 transition font-sans"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5 font-sans">
                <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500" htmlFor="auth-email">
                  Email Address
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-3 flex items-center text-zinc-655">
                    <Mail size={14} />
                  </span>
                  <input
                    id="auth-email"
                    type="email"
                    placeholder="name@domain.com"
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="w-full bg-[#050505] border border-zinc-900 rounded-xl pl-9 pr-4 py-3 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-amber-500/50 transition font-sans"
                  />
                </div>
              </div>

              <div className="space-y-1.5 font-sans">
                <label className="block text-[10px] uppercase font-mono tracking-wider text-zinc-500" htmlFor="auth-password">
                  Security Passcode
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-3 flex items-center text-zinc-655">
                    <Lock size={14} />
                  </span>
                  <input
                    id="auth-password"
                    type="password"
                    placeholder="••••••••"
                    required
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className="w-full bg-[#050505] border border-zinc-900 rounded-xl pl-9 pr-4 py-3 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-amber-500/50 transition font-sans"
                  />
                </div>
              </div>

              {authError && (
                <div id="auth-error-msg" className="p-3 bg-red-955/10 border border-red-900/30 text-red-405 text-xs rounded-xl font-sans leading-relaxed">
                  {authError}
                </div>
              )}

              <button
                type="submit"
                id="auth-submit-btn"
                disabled={isAuthSubmitting}
                className="w-full py-3 bg-[#0d0d0d] hover:bg-[#121212] border border-amber-500/35 font-semibold text-xs text-amber-500 rounded-xl tracking-wide transition shadow-lg hover:border-amber-400 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 font-sans"
              >
                {isAuthSubmitting ? (
                  <Disc size={14} className="animate-spin text-amber-500" />
                ) : null}
                <span>{authMode === 'login' ? 'Confirm & Enter Portal' : 'Register & Log In'}</span>
              </button>
            </form>
          </div>

          <div className="text-center pt-2 text-[10px] text-zinc-500 font-mono">
            {authMode === 'login' ? (
              <span>Not registered? <button onClick={() => { setAuthMode('register'); setAuthError(''); }} className="text-amber-500 hover:underline cursor-pointer">Create an account</button></span>
            ) : (
              <span>Already have an account? <button onClick={() => { setAuthMode('login'); setAuthError(''); }} className="text-amber-500 hover:underline cursor-pointer">Log in here</button></span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#050505] text-zinc-100 min-h-screen font-sans selection:bg-amber-500 selection:text-black antialiased">
      
      {/* 1. Global Navigation Row Header */}
      <header className="sticky top-0 z-50 bg-[#050505]/90 backdrop-blur-md border-b border-zinc-900/80 px-4 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          
          {/* Brand Logo Branding */}
          <div 
            onClick={() => { setActiveSection('library'); setActivePlayingMedia(null); }}
            className="flex items-center gap-2.5 cursor-pointer transition select-none group shrink-0"
          >
            <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500 via-yellow-600 to-amber-700 text-black shadow-lg shadow-amber-500/10 border border-amber-400/20">
              <Tv size={18} className="text-black group-hover:rotate-6 transition duration-300" />
            </div>
            <div>
              <span className="font-serif font-bold tracking-tight text-lg text-zinc-100 group-hover:text-amber-400 transition">
                Animedia <span className="font-sans font-light tracking-wide text-amber-500">Stream</span>
              </span>
              <span className="block text-[8px] font-mono text-amber-500/60 uppercase tracking-widest leading-none">
                Cinema Portal & Archive
              </span>
            </div>
          </div>

          {/* Central Interactive Search Controller */}
          {activeSection === 'library' && !activePlayingMedia && (
            <div className="relative max-w-sm w-full hidden md:block group">
              <div className="absolute inset-y-0 left-3.5 flex items-center text-zinc-500 group-focus-within:text-amber-500 transition-colors">
                <Search size={14} />
              </div>
              <input
                id="header-search-input"
                type="text"
                placeholder="Search movies, anime series, original streams..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800/80 rounded-full pl-10 pr-4 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition duration-300 bg-zinc-950/40"
              />
            </div>
          )}

          {/* Quick Action Navigation Buttons & Custom Session Profile Info */}
          <div className="flex items-center gap-3">
            <nav className="flex items-center gap-1.5">
              <button
                id="nav-library-btn"
                onClick={() => { setActiveSection('library'); setActivePlayingMedia(null); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition cursor-pointer flex items-center gap-1.5 ${
                  activeSection === 'library' && !activePlayingMedia
                    ? 'bg-zinc-900 border border-zinc-800 text-amber-500' 
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/30'
                }`}
              >
                <Library size={13} />
                <span>Browse</span>
              </button>

              <button
                id="nav-playlists-btn"
                onClick={() => { setActiveSection('playlists'); setActivePlayingMedia(null); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition cursor-pointer flex items-center gap-1.5 ${
                  activeSection === 'playlists' && !activePlayingMedia 
                    ? 'bg-zinc-900 border border-zinc-800 text-amber-500' 
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/30'
                }`}
              >
                <List size={13} />
                <span>Playlists</span>
              </button>

              <button
                id="nav-admin-btn"
                onClick={() => { setActiveSection('admin'); setActivePlayingMedia(null); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition cursor-pointer flex items-center gap-1.5 ${
                  activeSection === 'admin' && !activePlayingMedia 
                    ? 'bg-amber-950/20 border border-amber-900/50 text-amber-400' 
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/30'
                }`}
              >
                {isAdminLoggedIn ? <Unlock size={13} className="text-emerald-400 animate-pulse" /> : <Lock size={13} />}
                <span>Owner Console</span>
              </button>
            </nav>

            <span className="w-px h-5 bg-zinc-900 hidden sm:block" />

            {/* Profile Watch Account Configurator (Authenticated Member Workspace) */}
            <div className="relative shrink-0">
              <button
                id="toggle-profile-btn"
                onClick={() => setShowProfileConfig(!showProfileConfig)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-zinc-950 border border-zinc-805/80 text-xs text-zinc-300 hover:text-white transition cursor-pointer hover:border-amber-500/30"
                title="Profile Settings"
              >
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-amber-700 to-amber-950 text-amber-200 border border-amber-500/30 flex items-center justify-center font-semibold text-[9px] uppercase font-mono">
                  {viewerNickname ? viewerNickname.substring(0, 2) : 'US'}
                </div>
                <span className="font-semibold max-w-[90px] truncate hidden sm:inline text-zinc-300">{viewerNickname}</span>
              </button>

              {showProfileConfig && (
                <div className="absolute right-0 mt-3 w-64 bg-[#0a0a0a] border border-zinc-900 rounded-2xl p-4 shadow-2xl z-50 space-y-4 animate-fade-in animate-duration-200">
                  <div className="space-y-1 pb-2 border-b border-zinc-900">
                    <h4 className="text-xs font-serif font-bold text-amber-400">Authenticated Member</h4>
                    <p className="text-[10px] text-zinc-400 truncate leading-relaxed">
                      {auth?.email}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[9px] uppercase font-mono text-zinc-500">Edit Nickname</label>
                    <input
                      id="nickname-config-input"
                      type="text"
                      placeholder="Enter Username"
                      value={nicknameInput}
                      onChange={(e) => setNicknameInput(e.target.value)}
                      className="w-full bg-[#050505] border border-zinc-900 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500/50 transition-colors"
                    />
                    
                    <button
                      id="save-profile-btn"
                      onClick={handleSaveProfile}
                      className="w-full py-1.5 bg-[#0e0e0e] hover:bg-[#141414] border border-amber-500/30 text-amber-500 font-medium text-xs transition cursor-pointer rounded-xl hover:border-amber-400 font-sans"
                    >
                      Update Nickname
                    </button>
                  </div>

                  <div className="pt-1">
                    <button
                      id="logout-btn"
                      onClick={handleLogout}
                      className="w-full py-2 bg-red-955/10 hover:bg-red-955/20 border border-red-900/30 text-red-400 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 hover:border-red-500/40"
                    >
                      <LogOut size={12} />
                      <span>Log Out Session</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>

        </div>
      </header>

      {/* 2. Main Platform Routing Display Frame */}
      <main>
        {activePlayingMedia ? (
          
          /* IMMERSIVE VIDEO THEATER PLAYER FRAME */
          <MediaPlayer
            media={activePlayingMedia}
            userId={userId}
            onBack={handleExitPlayer}
            onMediaFinished={() => {
              // Mark the progress as completed when done
              console.log('Finished watching', activePlayingMedia.title);
            }}
          />

        ) : (
          
          /* PRIMARY VISUAL HOMEVIEWS */
          <div className="animate-fade-in animate-duration-400">
            
            {activeSection === 'library' && (
              <div className="pb-16 space-y-8">
                
                {/* A) Cinema spotlight top banner */}
                {!searchQuery && activeCategory === 'All' && spotlightItem && (
                  <section className="max-w-7xl mx-auto px-4 pt-6">
                    <div className="relative rounded-3xl overflow-hidden aspect-[21/9] bg-zinc-950 shadow-2xl group border border-zinc-900/60">
                      
                      {/* Ambient glowing imagery */}
                      <div className="absolute inset-0 bg-black">
                        <img
                          src={spotlightItem.thumbnailUrl || 'https://images.unsplash.com/photo-1542204172-e7052809a936?w=1200'}
                          alt="Cinema Spotlight"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover opacity-25 scale-100 transition duration-1000 group-hover:scale-105"
                        />
                      </div>

                      {/* Black Vignette Overlays */}
                      <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-transparent" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent hidden sm:block" />

                      {/* Spotlight Bio Data content */}
                      <div className="absolute inset-y-0 left-0 max-w-lg md:max-w-xl p-6 sm:p-10 lg:p-14 flex flex-col justify-center space-y-4">
                        <div className="flex items-center gap-2 text-xs font-mono">
                          <span className="flex items-center gap-1.5 text-amber-400 bg-amber-950/20 border border-amber-500/30 rounded-full px-3 py-0.5">
                            <Sparkles size={11} className="animate-pulse" />
                            <span className="font-semibold tracking-wider text-[9px]">Featured Spotlight</span>
                          </span>
                          <span className="text-zinc-600">•</span>
                          <span className="bg-zinc-900/40 border border-zinc-800 px-2 py-0.5 rounded text-zinc-300">
                            {spotlightItem.category}
                          </span>
                        </div>

                        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-bold tracking-tight text-white leading-tight">
                          {spotlightItem.title}
                        </h2>

                        <p className="text-xs sm:text-sm text-zinc-300 line-clamp-3 leading-relaxed font-sans">
                          {spotlightItem.description}
                        </p>

                        <div className="pt-2 flex flex-wrap items-center gap-4">
                          <button
                            id="spotlight-play-btn"
                            onClick={() => setActivePlayingMedia(spotlightItem)}
                            className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl text-xs transition cursor-pointer transform hover:scale-102 shadow-lg shadow-amber-500/10"
                          >
                            <Play size={14} fill="currentColor" />
                            <span>Watch Spotlight Stream</span>
                          </button>
                        </div>
                      </div>

                    </div>
                  </section>
                )}

                {/* B) Categories slider tag controller */}
                <section className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="overflow-x-auto w-full">
                    <div className="flex gap-2 pb-1.5">
                      {categories.map(cat => (
                        <button
                          key={cat}
                          id={`category-pill-${cat.replace(/\s+/g, '-')}`}
                          onClick={() => setActiveCategory(cat)}
                          className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer border ${
                            activeCategory === cat
                              ? 'bg-amber-500 border-amber-405 text-black shadow-lg shadow-amber-500/10'
                              : 'bg-zinc-950 hover:bg-zinc-900 border-zinc-900 text-zinc-400 hover:text-zinc-250'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Watch Count Overview metrics */}
                  <div className="text-[10px] font-mono text-zinc-500 whitespace-nowrap hidden lg:block uppercase tracking-wider bg-zinc-950 border border-zinc-905 px-3 py-1.5 rounded-xl">
                    Synced Account: <span className="text-amber-500">{viewerNickname}</span>
                  </div>
                </section>

                {/* C) Grid Content display */}
                <section className="max-w-7xl mx-auto px-4">
                  
                  {isLoading ? (
                    <div className="text-center py-24 text-zinc-500 text-sm space-y-4">
                      <div className="w-8 h-8 rounded-full border-2 border-zinc-800 border-t-amber-500 animate-spin mx-auto" />
                      <p className="font-mono text-xs text-zinc-500 uppercase tracking-widest">Hydrating Media Slate</p>
                    </div>
                  ) : filteredMedia.length === 0 ? (
                    <div className="text-center py-20 border border-dashed border-zinc-900 rounded-3xl space-y-3 bg-zinc-950/20">
                      <p className="text-zinc-400 text-sm font-serif">No streaming content found in this archive selection.</p>
                      <button
                        id="reset-filters-btn"
                        onClick={() => { setSearchQuery(''); setActiveCategory('All'); }}
                        className="px-4 py-1.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-xs font-medium text-amber-500 rounded-xl transition cursor-pointer"
                      >
                        Clear All Filters
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                      {filteredMedia.map(item => {
                        // Retrieve watched positions linked to the persistent watcher session ID!
                        const savedPos = playbackPositions[item.id];
                        return (
                          <MediaCard
                            key={item.id}
                            media={item}
                            onClick={() => setActivePlayingMedia(item)}
                            savedProgress={savedPos}
                          />
                        );
                      })}
                    </div>
                  )}

                </section>

              </div>
            )}

            {activeSection === 'playlists' && (
              <PlaylistManager
                playlists={playlists}
                mediaItems={mediaItems}
                onPlaylistChange={() => refreshData(userId)}
                onPlayMedia={(item) => setActivePlayingMedia(item)}
                activeMedia={activePlayingMedia || undefined}
              />
            )}

            {activeSection === 'admin' && (
              <AdminPanel
                mediaItems={mediaItems}
                onMediaChange={() => refreshData(userId)}
                adminPasscode={adminPasscode}
                setAdminPasscode={setAdminPasscode}
                isAdminLoggedIn={isAdminLoggedIn}
                setIsAdminLoggedIn={setIsAdminLoggedIn}
              />
            )}

          </div>
        )}
      </main>

      {/* 3. Universal Footer Info bar */}
      <footer className="border-t border-zinc-950 bg-[#020202] py-10 text-center text-[10px] font-mono text-zinc-500 tracking-wider">
        <div className="max-w-7xl mx-auto px-4 space-y-2">
          <p className="text-zinc-450">
            Animedia Stream Hub • Custom Curation and Interactive Local Multi-user Playing Sync System.
          </p>
          <p className="text-zinc-600">
            Sophisticated Dark Aesthetics &bull; HTML5 Media Controllers & Persistent Timestamp Resumption.
          </p>
        </div>
      </footer>

    </div>
  );
}
