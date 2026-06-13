const path = require('path');
const express = require('express');
const resolveHandler = require('./api/resolve');
const mp4Handler = require('./api/mp4/[fileId]');
const m3uHandler = require('./api/m3u/[fileId]');
const { createStreamingProxy } = require('./lib/streaming-proxy');
const { extractDriveParams } = require('./lib/drive');

const app = express();
const port = process.env.PORT || 3000;

// Create a shared streaming proxy instance
const streamProxy = createStreamingProxy();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/resolve', (req, res) => {
  resolveHandler(req, res);
});

app.get('/api/mp4/:fileId', (req, res) => {
  req.query = { ...req.query, fileId: req.params.fileId };
  mp4Handler(req, res);
});

// M3U8 playlist for video players (HLS)
app.get('/api/m3u/:fileId', (req, res) => {
  req.query = { ...req.query, fileId: req.params.fileId };
  m3uHandler(req, res);
});

// New streaming endpoint with HTTP proxy for smoother playback
app.get('/api/stream/:fileId', async (req, res) => {
  try {
    const rawId = req.query.fileId || req.query.id || req.query.url || req.params.fileId;
    const { fileId, resourceKey } = extractDriveParams(rawId);
    
    if (!fileId) {
      res.status(400).json({ error: 'Missing or invalid Google Drive file ID.' });
      return;
    }

    // Use the streaming proxy for direct streaming with optimized headers
    await streamProxy.streamDirect(fileId, resourceKey, req, res);
  } catch (error) {
    if (!res.headersSent) {
      res.status(502).json({
        error: 'Failed to stream video',
        detail: error.message
      });
    }
  }
});

// Alias for streaming (shorter URL)
app.get('/stream/:fileId', async (req, res) => {
  req.query = { ...req.query, fileId: req.params.fileId };
  // Forward to the stream handler via query
  const rawId = req.query.fileId || req.query.id || req.query.url;
  const { fileId, resourceKey } = extractDriveParams(rawId);
  
  if (!fileId) {
    res.status(400).json({ error: 'Missing or invalid Google Drive file ID.' });
    return;
  }

  await streamProxy.streamDirect(fileId, resourceKey, req, res);
});

app.get('/mp4/:fileId.mp4', (req, res) => {
  req.query = { ...req.query, fileId: req.params.fileId, ext: 'mp4' };
  mp4Handler(req, res);
});

app.get('/mp4/:fileId.mov', (req, res) => {
  req.query = { ...req.query, fileId: req.params.fileId, ext: 'mov' };
  mp4Handler(req, res);
});

app.get('/mp4/:fileId.mkv', (req, res) => {
  req.query = { ...req.query, fileId: req.params.fileId, ext: 'mkv' };
  mp4Handler(req, res);
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`gdrive-mp4-extractor running at http://localhost:${port}`);
});
