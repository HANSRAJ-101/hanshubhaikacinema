import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import multer from 'multer';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

// Define __dirname equivalent for ES Modules if needed (not strictly needed because server.ts gets bundled CJS/ESM, but good practice)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Configure directories
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Enable JSON bodies up to 20mb for base64 thumbnails etc.
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Serve uploaded files statically
app.use('/uploads', express.static(UPLOADS_DIR));

// Configure multer file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    // clean filename and keep extension
    const cleanOrigName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
    cb(null, uniqueSuffix + '-' + cleanOrigName);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 150 * 1024 * 1024 // 150MB maximum uploaded media files
  }
});

// Database Operations Helper
function hashPassword(password: string) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function loadDb() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      // Seed default
      return { media: [], playlists: [], playbackPositions: {}, comments: [], users: [] };
    }
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    const db = JSON.parse(raw);
    if (!db.users) db.users = [];
    if (!db.media) db.media = [];
    if (!db.playlists) db.playlists = [];
    if (!db.playbackPositions) db.playbackPositions = {};
    if (!db.comments) db.comments = [];
    return db;
  } catch (error) {
    console.error('Error reading db:', error);
    return { media: [], playlists: [], playbackPositions: {}, comments: [], users: [] };
  }
}

function saveDb(data: any) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving db:', error);
  }
}

// Authentication passcode logic
const getAdminPasscode = () => process.env.ADMIN_PASSCODE || 'admin123';

function checkAdmin(req: express.Request): boolean {
  const passcode = req.headers['x-admin-passcode'] || req.query.passcode;
  return passcode === getAdminPasscode();
}

// ==========================================
// REST API ENDPOINTS
// ==========================================

// Validate Admin Login
app.post('/api/admin/login', (req, res) => {
  const { passcode } = req.body;
  if (passcode === getAdminPasscode()) {
    return res.json({ success: true, message: 'Authenticated successfully' });
  }
  return res.status(401).json({ success: false, message: 'Invalid administrative passcode' });
});

// Register User
app.post('/api/auth/register', (req, res) => {
  const { email, password, nickname } = req.body;
  if (!email || !password || !nickname) {
    return res.status(400).json({ error: 'Missing email, password, or nickname' });
  }

  const db = loadDb();
  if (!db.users) db.users = [];

  const normalizedEmail = email.toLowerCase().trim();
  const existingUser = db.users.find((u: any) => u.email === normalizedEmail);
  if (existingUser) {
    return res.status(400).json({ error: 'An account with this email already exists' });
  }

  const newUser = {
    id: 'user_' + Math.random().toString(36).substring(2, 11),
    email: normalizedEmail,
    nickname: nickname.trim(),
    passwordHash: hashPassword(password),
    registeredAt: new Date().toISOString()
  };

  db.users.push(newUser);
  saveDb(db);

  const { passwordHash, ...safeUser } = newUser;
  res.status(201).json({ success: true, user: safeUser });
});

// Login User
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Missing email or password' });
  }

  const db = loadDb();
  if (!db.users) db.users = [];

  const normalizedEmail = email.toLowerCase().trim();
  const user = db.users.find((u: any) => u.email === normalizedEmail);
  if (!user || user.passwordHash !== hashPassword(password)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const { passwordHash, ...safeUser } = user;
  res.json({ success: true, user: safeUser });
});

// Get Media Catalogue
app.get('/api/media', (req, res) => {
  const db = loadDb();
  res.json(db.media || []);
});

// Add External Media Item (Stream URL)
app.post('/api/media/external', (req, res) => {
  if (!checkAdmin(req)) {
    return res.status(401).json({ error: 'Unauthorized. Admin credential is required' });
  }

  const { title, description, type, category, url, thumbnailUrl, duration } = req.body;
  if (!title || !type || !category || !url) {
    return res.status(400).json({ error: 'Missing required fields: title, type, category, url' });
  }

  const db = loadDb();
  const newItem = {
    id: 'media-' + Math.random().toString(36).substring(2, 11),
    title,
    description: description || '',
    type,
    category,
    url,
    thumbnailUrl: thumbnailUrl || 'https://images.unsplash.com/photo-1542204172-e7052809a936?w=1200',
    duration: Number(duration) || 0,
    uploadDate: new Date().toISOString().split('T')[0],
    views: 0,
    isExternal: true
  };

  db.media.unshift(newItem);
  saveDb(db);

  res.status(201).json(newItem);
});

// Upload media file via Form-Data
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!checkAdmin(req)) {
    // If multer has already uploaded the file to disk, clean it up
    if (req.file) {
      try { fs.unlinkSync(req.file.path); } catch {}
    }
    return res.status(401).json({ error: 'Unauthorized. Admin upload credentials required' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No media file provided' });
  }

  const { title, description, type, category, thumbnailUrl, duration } = req.body;
  
  if (!title || !type || !category) {
    // Clean up uploaded file
    try { fs.unlinkSync(req.file.path); } catch {}
    return res.status(400).json({ error: 'Missing required fields: title, type, category' });
  }

  const fileUrl = `/uploads/${req.file.filename}`;
  const db = loadDb();

  const newItem = {
    id: 'media-' + Math.random().toString(36).substring(2, 11),
    title,
    description: description || '',
    type,
    category,
    url: fileUrl,
    thumbnailUrl: thumbnailUrl || (type === 'video' 
      ? 'https://images.unsplash.com/photo-1542204172-e7052809a936?w=1200' 
      : 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1200'),
    duration: Number(duration) || 0,
    uploadDate: new Date().toISOString().split('T')[0],
    views: 0,
    isExternal: false,
    filename: req.file.filename
  };

  db.media.unshift(newItem);
  saveDb(db);

  res.status(201).json(newItem);
});

// Delete media item (Admin only)
app.delete('/api/media/:id', (req, res) => {
  if (!checkAdmin(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id } = req.params;
  const db = loadDb();
  const mediaIdx = db.media.findIndex((m: any) => m.id === id);

  if (mediaIdx === -1) {
    return res.status(404).json({ error: 'Media not found' });
  }

  const mediaItem = db.media[mediaIdx];
  // If it is a local file, remove it from disk
  if (!mediaItem.isExternal && mediaItem.filename) {
    const filePath = path.join(UPLOADS_DIR, mediaItem.filename);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.error('Failed to delete file from disk:', err);
      }
    }
  }

  // Remove playlists associations
  db.playlists = db.playlists.map((pl: any) => ({
    ...pl,
    mediaIds: pl.mediaIds.filter((mid: string) => mid !== id)
  }));

  // Clean playback position
  if (db.playbackPositions && db.playbackPositions[id]) {
    delete db.playbackPositions[id];
  }

  db.media.splice(mediaIdx, 1);
  saveDb(db);

  res.json({ success: true, message: 'Media removed successfully' });
});

// Increment View Counter
app.post('/api/media/:id/view', (req, res) => {
  const { id } = req.params;
  const db = loadDb();
  const item = db.media.find((m: any) => m.id === id);
  if (item) {
    item.views = (item.views || 0) + 1;
    saveDb(db);
    return res.json({ success: true, views: item.views });
  }
  res.status(404).json({ error: 'Media not found' });
});

// PLAYLISTS ENDPOINTS
app.get('/api/playlists', (req, res) => {
  const db = loadDb();
  res.json(db.playlists || []);
});

app.post('/api/playlists', (req, res) => {
  const { name, description } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Playlist name is required' });
  }

  const db = loadDb();
  const newPlaylist = {
    id: 'playlist-' + Math.random().toString(36).substring(2, 11),
    name,
    description: description || '',
    createdAt: new Date().toISOString().split('T')[0],
    mediaIds: []
  };

  db.playlists.push(newPlaylist);
  saveDb(db);

  res.status(201).json(newPlaylist);
});

app.post('/api/playlists/:id/add', (req, res) => {
  const { id } = req.params;
  const { mediaId } = req.body;
  if (!mediaId) {
    return res.status(400).json({ error: 'mediaId is required' });
  }

  const db = loadDb();
  const pl = db.playlists.find((p: any) => p.id === id);
  if (!pl) {
    return res.status(404).json({ error: 'Playlist not found' });
  }

  if (!pl.mediaIds.includes(mediaId)) {
    pl.mediaIds.push(mediaId);
    saveDb(db);
  }

  res.json(pl);
});

app.post('/api/playlists/:id/remove', (req, res) => {
  const { id } = req.params;
  const { mediaId } = req.body;
  if (!mediaId) {
    return res.status(400).json({ error: 'mediaId is required' });
  }

  const db = loadDb();
  const pl = db.playlists.find((p: any) => p.id === id);
  if (!pl) {
    return res.status(404).json({ error: 'Playlist not found' });
  }

  pl.mediaIds = pl.mediaIds.filter((mid: string) => mid !== mediaId);
  saveDb(db);

  res.json(pl);
});

app.delete('/api/playlists/:id', (req, res) => {
  const { id } = req.params;
  const db = loadDb();
  db.playlists = db.playlists.filter((p: any) => p.id !== id);
  saveDb(db);
  res.json({ success: true });
});

// PLAYBACK HISTORY AND RESUME-STATE PLAYBACK TRACKING
// GET user-specific or global playback positions
app.get('/api/playback-positions', (req, res) => {
  // We can query custom userId to support multi-user history, or fall back to a global map
  const userId = req.query.userId as string || 'anonymous';
  const db = loadDb();
  
  // Storage schema in db.json can be playbackPositions: { [userId]: { [mediaId]: timestamp_data } }
  const userPositions = db.playbackPositions[userId] || {};
  res.json(userPositions);
});

// POST to update a playback position
app.post('/api/playback-positions', (req, res) => {
  const { mediaId, currentTime, duration, userId: bodyUserId } = req.body;
  const userId = bodyUserId || 'anonymous';

  if (!mediaId || currentTime === undefined) {
    return res.status(400).json({ error: 'Missing required fields: mediaId, currentTime' });
  }

  const db = loadDb();
  if (!db.playbackPositions) {
    db.playbackPositions = {};
  }
  if (!db.playbackPositions[userId]) {
    db.playbackPositions[userId] = {};
  }

  db.playbackPositions[userId][mediaId] = {
    mediaId,
    currentTime: Number(currentTime),
    duration: Number(duration) || 0,
    updatedAt: new Date().toISOString()
  };

  saveDb(db);
  res.json({ success: true });
});

// COMMENTS ENDPOINTS
app.get('/api/media/:mediaId/comments', (req, res) => {
  const { mediaId } = req.params;
  const db = loadDb();
  const comments = (db.comments || []).filter((c: any) => c.mediaId === mediaId);
  res.json(comments);
});

app.post('/api/media/:mediaId/comments', (req, res) => {
  const { mediaId } = req.params;
  const { authorName, content } = req.body;

  if (!content) {
    return res.status(400).json({ error: 'Comment body can not be empty' });
  }

  const db = loadDb();
  const newComment = {
    id: 'comment-' + Math.random().toString(36).substring(2, 11),
    mediaId,
    authorName: authorName || 'Anonymous Viewer',
    content,
    timestamp: new Date().toISOString()
  };

  if (!db.comments) db.comments = [];
  db.comments.push(newComment);
  saveDb(db);

  res.status(201).json(newComment);
});


// ==========================================
// PORT ROUTING & SERVICE INITIALIZATION
// ==========================================

async function startServer() {
  // Vite Integration for Hot Reload (Dev) vs Static Serving (Production)
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Serve index.html for react routes
    app.get('*', (req, res, next) => {
      // Avoid intercepting /api endpoints
      if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) {
        return next();
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Media Stream Server] running on http://localhost:${PORT}`);
  });
}

startServer();
