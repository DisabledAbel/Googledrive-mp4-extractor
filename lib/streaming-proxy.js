const { fetchDriveStream } = require('./drive');
const { Readable } = require('stream');

const CHUNK_SIZE = 1024 * 1024; // 1MB chunk size

// Simple cache without external dependencies
const cache = new Map();
const MAX_CACHE_ITEMS = 20;

function getCacheKey(fileId, start, end) {
  return `${fileId}:${start}:${end || 'end'}`;
}

function cleanOldCache(fileId) {
  const now = Date.now();
  const keysToDelete = [];
  
  for (const [key, value] of cache.entries()) {
    if (value.fileId === fileId && now - value.timestamp > 5 * 60 * 1000) {
      keysToDelete.push(key);
    }
  }
  
  keysToDelete.forEach(k => cache.delete(k));
}

/**
 * Streaming proxy for smoother video playback
 * 
 * Features:
 * - Chunk caching to reduce repeated Google Drive fetches  
 * - Efficient Range request support for seeking
 * - Proper HTTP 206 Partial Content responses
 * - CORS headers for cross-origin access
 * - Connection: keep-alive for persistent connections
 */
class StreamingProxy {
  constructor(options = {}) {
    this.chunkSize = options.chunkSize || CHUNK_SIZE;
  }

  /**
   * Fetch with caching
   */
  async fetchRange(fileId, resourceKey, start, end) {
    const key = getCacheKey(fileId, start, end);
    
    // Check cache
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
      return { ...cached, cached: true };
    }

    // Fetch from Google Drive
    const rangeHeader = end 
      ? `bytes=${start}-${end - 1}` 
      : `bytes=${start}-`;
    
    const response = await fetchDriveStream(fileId, {
      resourceKey,
      headers: { range: rangeHeader }
    });

    // Convert to buffer
    const chunks = [];
    for await (const chunk of response.body) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // Cache it
    const cacheEntry = { 
      data: buffer, 
      start, 
      end: end || (start + buffer.length),
      status: response.status,
      headers: response.headers,
      fileId,
      timestamp: Date.now(),
      cached: false
    };
    
    cache.set(key, cacheEntry);
    cleanOldCache(fileId);

    // Limit cache size
    if (cache.size > MAX_CACHE_ITEMS) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }

    return cacheEntry;
  }

  /**
   * Build streaming response with proper Range support
   */
  buildStreamResponse(fileId, resourceKey, req, res) {
    const range = req.headers.range;
    let start = 0;
    let end = null;

    // Parse Range header
    if (range) {
      const match = range.match(/bytes=(\d+)?-(\d+)?/);
      if (match) {
        start = match[1] ? parseInt(match[1], 10) : 0;
        end = match[2] ? parseInt(match[2], 10) + 1 : null;
      }
    }

    this.fetchRange(fileId, resourceKey, start, end)
      .then(result => {
        const { data, headers } = result;
        const contentLength = data.length;
        
        // Send proper response
        if (range) {
          res.status(206);
          res.setHeader('Content-Range', `bytes ${start}-${start + contentLength - 1}/*`);
        } else {
          res.status(200);
        }
        
        res.setHeader('Content-Length', contentLength);
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', 'Range');
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Connection', 'keep-alive');
        
        // Forward metadata headers
        const etag = headers.get('etag');
        const lastModified = headers.get('last-modified');
        if (etag) res.setHeader('ETag', etag);
        if (lastModified) res.setHeader('Last-Modified', lastModified);

        res.send(data);
      })
      .catch(error => {
        res.status(502).json({
          error: 'Failed to fetch video stream',
          detail: error.message
        });
      });
  }

  /**
   * Create a direct streaming pipeline (recommended for large files)
   * This pipes data directly without buffering, letting the browser
   * handle buffering via its media player
   */
  async streamDirect(fileId, resourceKey, req, res) {
    try {
      // Fetch from Google Drive
      const response = await fetchDriveStream(fileId, {
        resourceKey,
        headers: req.headers.range ? { range: req.headers.range } : {}
      });

      // Forward all headers
      const upstreamHeaders = response.headers;
      
      res.status(response.status);
      
      const contentType = upstreamHeaders.get('content-type') || 'video/mp4';
      const contentLength = upstreamHeaders.get('content-length');
      const acceptRanges = upstreamHeaders.get('accept-ranges');
      const contentRange = upstreamHeaders.get('content-range');
      const etag = upstreamHeaders.get('etag');
      const lastModified = upstreamHeaders.get('last-modified');
      const contentDisposition = upstreamHeaders.get('content-disposition');

      res.setHeader('Content-Type', contentType);
      if (contentLength) res.setHeader('Content-Length', contentLength);
      if (acceptRanges) res.setHeader('Accept-Ranges', acceptRanges);
      if (contentRange) res.setHeader('Content-Range', contentRange);
      if (etag) res.setHeader('ETag', etag);
      if (lastModified) res.setHeader('Last-Modified', lastModified);
      if (contentDisposition) res.setHeader('Content-Disposition', contentDisposition);
      
      // Streaming-optimized headers
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('X-Proxy', 'streaming-v1');

      // Pipe the stream
      Readable.fromWeb(response.body).pipe(res);
    } catch (error) {
      if (!res.headersSent) {
        res.status(502).json({
          error: 'Failed to stream video',
          detail: error.message
        });
      }
    }
  }
}

function createStreamingProxy(options = {}) {
  return new StreamingProxy(options);
}

module.exports = {
  createStreamingProxy,
  StreamingProxy
};