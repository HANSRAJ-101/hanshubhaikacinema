import React, { useState } from 'react';
import { List, Plus, Music, Trash2, ArrowLeft, Play, Film, ChevronRight } from 'lucide-react';
import { Playlist, MediaItem } from '../types';

interface PlaylistManagerProps {
  playlists: Playlist[];
  mediaItems: MediaItem[];
  onPlaylistChange: () => void;
  onPlayMedia: (item: MediaItem) => void;
  activeMedia?: MediaItem;
}

export default function PlaylistManager({
  playlists,
  mediaItems,
  onPlaylistChange,
  onPlayMedia,
  activeMedia
}: PlaylistManagerProps) {
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  
  // Creation States
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [showCreator, setShowCreator] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Handle Playlist creation
  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsCreating(true);
    setErrorMsg('');

    try {
      const response = await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim()
        })
      });

      if (response.ok) {
        setName('');
        setDescription('');
        setShowCreator(false);
        onPlaylistChange();
      } else {
        setErrorMsg('Failed to create. Check server response.');
      }
    } catch {
      setErrorMsg('Network issue creating playlist.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeletePlaylist = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Delete this playlist? The media items will remain unaffected.')) return;

    try {
      const response = await fetch(`/api/playlists/${id}`, { method: 'DELETE' });
      if (response.ok) {
        if (selectedPlaylist?.id === id) {
          setSelectedPlaylist(null);
        }
        onPlaylistChange();
      }
    } catch {}
  };

  // Add a media item to playlist directly
  const handleAppendMediaToPlaylist = async (playlistId: string, mediaId: string) => {
    try {
      const response = await fetch(`/api/playlists/${playlistId}/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaId })
      });
      if (response.ok) {
        onPlaylistChange();
        // Update selected view state
        const updated = await response.json();
        if (selectedPlaylist?.id === playlistId) {
          setSelectedPlaylist(updated);
        }
      }
    } catch {}
  };

  const handleRemoveMediaFromPlaylist = async (playlistId: string, mediaId: string) => {
    try {
      const response = await fetch(`/api/playlists/${playlistId}/remove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaId })
      });
      if (response.ok) {
        onPlaylistChange();
        // Update selected view state
        const updated = await response.json();
        if (selectedPlaylist?.id === playlistId) {
          setSelectedPlaylist(updated);
        }
      }
    } catch {}
  };

  // Helper: Retrieve media items belonging to playlist
  const getPlaylistMedia = (playlist: Playlist) => {
    return (playlist.mediaIds || [])
      .map(id => mediaItems.find(m => m.id === id))
      .filter((m): m is MediaItem => !!m);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 my-6 space-y-6">
      
      {/* Header bar */}
      <div className="flex justify-between items-center bg-[#0d0d0d] border border-zinc-900 p-5 rounded-3xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-955/20 text-amber-500 border border-amber-900/30 rounded-xl">
            <List size={22} className="text-amber-500" />
          </div>
          <div>
            <h2 className="font-serif font-bold text-zinc-100">Playlists & Curations</h2>
            <p className="text-xs text-zinc-400 font-sans">Assemble collections of video streams or soundtrack archives.</p>
          </div>
        </div>

        <button
          id="toggle-playlist-creator"
          onClick={() => setShowCreator(!showCreator)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-800 hover:from-amber-500 hover:to-amber-700 rounded-xl text-xs font-semibold text-zinc-100 transition shadow-lg cursor-pointer"
        >
          <Plus size={16} />
          <span>New Custom Playlist</span>
        </button>
      </div>

      {/* Playlist Custom Creator Board */}
      {showCreator && (
        <form onSubmit={handleCreatePlaylist} className="bg-[#0d0d0d] border border-zinc-900 p-6 rounded-3xl max-w-lg mx-auto space-y-4 shadow-2xl">
          <h3 className="text-sm font-serif font-bold text-zinc-100 border-b border-zinc-900 pb-2">Generate Custom Playlist Set</h3>
          
          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-zinc-400 mb-1 font-sans">Playlist Name *</label>
              <input
                id="playlist-input-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Best Sci-Fi Shorts to Stream"
                className="w-full bg-[#050505] border border-zinc-900 rounded-lg p-2.5 text-zinc-200 focus:outline-none focus:border-amber-500/50"
                maxLength={45}
                required
              />
            </div>

            <div>
              <label className="block text-zinc-400 mb-1 font-sans">Curation Description</label>
              <textarea
                id="playlist-input-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A collection of dynamic high-fidelity narratives..."
                className="w-full bg-[#050505] border border-zinc-900 rounded-lg p-2.5 text-zinc-200 h-20 focus:outline-none focus:border-amber-500/50 resize-none"
                maxLength={120}
              />
            </div>
          </div>

          {errorMsg && <p className="text-xs text-red-400 font-mono">{errorMsg}</p>}

          <div className="flex justify-end gap-3 text-xs">
            <button
              id="cancel-playlist-creation"
              type="button"
              onClick={() => setShowCreator(false)}
              className="px-3.5 py-1.5 border border-zinc-900 hover:bg-zinc-900 text-zinc-400 rounded-lg transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="submit-playlist-creation"
              type="submit"
              disabled={isCreating}
              className="px-4 py-1.5 bg-amber-500 hover:bg-amber-450 rounded-lg text-black font-semibold transition cursor-pointer"
            >
              Create
            </button>
          </div>
        </form>
      )}

      {selectedPlaylist ? (
        /* Isolated Playlist View */
        <div className="space-y-4">
          <button
            id="back-to-playlists"
            onClick={() => setSelectedPlaylist(null)}
            className="flex items-center gap-1.5 font-medium text-zinc-400 hover:text-amber-500 text-xs transition cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span>Go Back to Playlists Collections</span>
          </button>

          <div className="bg-[#0d0d0d] border border-zinc-900 rounded-3xl p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Playlist Bio info Card */}
            <div className="space-y-4 border-r border-zinc-900 pr-6">
              <span className="text-[10px] font-mono font-bold tracking-wider text-amber-500 bg-amber-955/20 border border-amber-900/40 rounded px-2.5 py-1">
                Playback Playlist Set
              </span>
              <h3 className="text-xl font-serif font-bold text-zinc-100">{selectedPlaylist.name}</h3>
              <p className="text-xs text-zinc-400 leading-relaxed font-sans">
                {selectedPlaylist.description || "A dynamic curation slate on Animedia Stream Hub."}
              </p>
              
              <div className="text-[10px] font-mono text-zinc-500 space-y-1">
                <p>Created: {selectedPlaylist.createdAt}</p>
                <p>Total elements: {selectedPlaylist.mediaIds?.length || 0}</p>
              </div>

              {/* Addable catalog list if they want quick appendings */}
              <div className="space-y-3 pt-4 border-t border-zinc-900">
                <h4 className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold">Append Media item</h4>
                <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 divide-y divide-zinc-900">
                  {mediaItems
                    .filter(m => !selectedPlaylist.mediaIds.includes(m.id))
                    .map(item => (
                      <div key={item.id} className="pt-2 flex justify-between items-center text-xs gap-2">
                        <span className="line-clamp-1 flex-1 text-zinc-300 font-sans">{item.title}</span>
                        <button
                          id={`append-media-${item.id}`}
                          onClick={() => handleAppendMediaToPlaylist(selectedPlaylist.id, item.id)}
                          className="px-2 py-1 bg-zinc-950 border border-zinc-900 hover:bg-zinc-900 text-[10px] text-amber-500 rounded transition cursor-pointer"
                        >
                          + Append
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            {/* List Tracks Grid */}
            <div className="md:col-span-2 space-y-3.5">
              <h4 className="text-xs font-serif font-bold text-zinc-300">Playlist Stream ({getPlaylistMedia(selectedPlaylist).length})</h4>
              
              <div className="space-y-2">
                {getPlaylistMedia(selectedPlaylist).length === 0 ? (
                  <div className="text-center py-16 text-zinc-500 text-xs border border-dashed border-zinc-900 rounded-3xl font-serif">
                    No items in playlist. Select media to populate your stream list.
                  </div>
                ) : (
                  getPlaylistMedia(selectedPlaylist).map((item, index) => (
                    <div
                      key={item.id}
                      className="group p-3 bg-zinc-950 hover:bg-zinc-900 border border-zinc-900 hover:border-amber-500/20 rounded-2xl flex items-center justify-between gap-4 transition duration-200"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="font-mono text-xs text-zinc-500 shrink-0 block w-4">{index + 1}</span>
                        <div className="h-10 w-16 rounded bg-[#050505] overflow-hidden shrink-0">
                          <img
                            src={item.thumbnailUrl || 'https://images.unsplash.com/photo-1542204172-e7052809a936?w=200'}
                            alt={item.title}
                            referrerPolicy="no-referrer"
                            className="object-cover w-full h-full"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-serif font-semibold text-zinc-200 line-clamp-1 group-hover:text-amber-400 transition">
                            {item.title}
                          </p>
                          <span className="text-[10px] text-zinc-500 font-mono">{item.category} • {item.type}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          id={`play-pl-${item.id}`}
                          onClick={() => onPlayMedia(item)}
                          className="p-1.5 rounded-full bg-amber-955/20 border border-amber-900/40 text-amber-500 group-hover:bg-amber-500 group-hover:text-black transition cursor-pointer"
                          title="Stream Media"
                        >
                          <Play size={10} fill="currentColor" />
                        </button>

                        <button
                          id={`remove-pl-${item.id}`}
                          onClick={() => handleRemoveMediaFromPlaylist(selectedPlaylist.id, item.id)}
                          className="p-1.5 rounded-lg border border-transparent text-zinc-500 hover:text-red-400 hover:bg-red-950/10 transition cursor-pointer"
                          title="Erase from Curation List"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      ) : (
        /* Playlists Collections Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {playlists.map((pl) => (
            <div
              key={pl.id}
              onClick={() => setSelectedPlaylist(pl)}
              className="group bg-[#0d0d0d] hover:bg-zinc-900/40 border border-zinc-900 hover:border-amber-500/20 p-5 rounded-3xl cursor-pointer shadow-lg hover:shadow-2xl transition duration-300"
            >
              <div className="flex justify-between items-start gap-3">
                <div className="p-3 bg-amber-955/20 border border-amber-900/30 text-amber-500 rounded-xl group-hover:bg-amber-500 group-hover:text-black transition duration-300">
                  <List size={18} />
                </div>
                <button
                  id={`delete-pl-btn-${pl.id}`}
                  onClick={(e) => handleDeletePlaylist(pl.id, e)}
                  className="p-1 text-zinc-500 hover:text-red-400 hover:bg-red-955/10 rounded transition cursor-pointer"
                >
                  <Trash2 size={12} />
                </button>
              </div>

              <div className="space-y-1 mt-4">
                <h4 className="font-serif font-bold text-zinc-200 group-hover:text-amber-400 transition">
                  {pl.name}
                </h4>
                <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed font-sans">
                  {pl.description || "No curation summary catalogued."}
                </p>
              </div>

              <div className="border-t border-zinc-900 mt-4 pt-3 flex items-center justify-between text-[10px] font-mono text-zinc-500">
                <span>{pl.mediaIds?.length || 0} media streams</span>
                <span className="flex items-center gap-0.5 text-amber-500 opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
                  <span>Explore Series</span>
                  <ChevronRight size={10} />
                </span>
              </div>
            </div>
          ))}

          {playlists.length === 0 && (
            <div className="col-span-full border border-dashed border-zinc-900 rounded-3xl text-center p-16 text-zinc-550 text-sm bg-zinc-950/20 font-serif">
              Your playlist collections are void. Click "New Custom Playlist" above to start curating tracks.
            </div>
          )}
        </div>
      )}

    </div>
  );
}
