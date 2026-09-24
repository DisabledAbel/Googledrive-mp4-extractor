const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { PassThrough } = require('node:stream');
const express = require('express');

const drivePath = require.resolve('../lib/drive');
const proxyPath = require.resolve('../lib/streaming-proxy');
const mp4Path = require.resolve('../api/mp4/[fileId]');
const originalDrive = require.cache[drivePath];
let upstreamFactory;

require.cache[drivePath] = {
  id: drivePath,
  filename: drivePath,
  loaded: true,
  exports: {
    extractDriveParams: value => ({ fileId: value, resourceKey: null }),
    sanitizeFileName: value => value,
    fetchDriveStream: async () => ({
      status: 200,
      headers: new Headers({
        'content-type': 'video/mp4',
        'accept-ranges': 'bytes',
        'cache-control': 'public, max-age=3600',
        etag: 'test-etag',
        'last-modified': 'Wed, 21 Oct 2015 07:28:00 GMT'
      }),
      body: upstreamFactory()
    })
  }
};
delete require.cache[proxyPath];
delete require.cache[mp4Path];

const mp4Handler = require('../api/mp4/[fileId]');
const { StreamingProxy, pipeUpstreamStream } = require('../lib/streaming-proxy');

test.after(() => {
  if (originalDrive) require.cache[drivePath] = originalDrive;
  else delete require.cache[drivePath];
  delete require.cache[proxyPath];
  delete require.cache[mp4Path];
});

function listen(handler) {
  const app = express();
  app.get('/video', (req, res) => {
    req.query.fileId = 'test-file-id';
    handler(req, res);
  });
  const server = app.listen(0, '127.0.0.1');
  return new Promise(resolve => server.once('listening', () => resolve(server)));
}

function failingStream({ afterChunk }) {
  return new ReadableStream({
    start(controller) {
      if (afterChunk) controller.enqueue(Buffer.from('video-data'));
      setImmediate(() => controller.error(new Error('upstream connection reset')));
    }
  });
}

function request(server) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port: server.address().port, path: '/video' });
    req.on('response', res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ res, body: Buffer.concat(chunks).toString() }));
      res.on('aborted', () => resolve({ res, aborted: true, body: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject);
  });
}

test('MP4 handler returns 502 when the upstream fails before streaming starts', async t => {
  upstreamFactory = () => failingStream({ afterChunk: false });
  const server = await listen(mp4Handler);
  t.after(() => server.close());

  const { res, body } = await request(server);
  assert.equal(res.statusCode, 502);
  assert.match(res.headers['content-type'], /^application\/json/);
  assert.equal(res.headers['cache-control'], 'no-store');
  assert.equal(res.headers.etag, undefined);
  assert.equal(res.headers['last-modified'], undefined);
  assert.match(body, /Could not fetch video from Google Drive/);
  assert.match(body, /upstream connection reset/);
});

test('MP4 handler contains an upstream failure after a chunk was sent', async t => {
  upstreamFactory = () => failingStream({ afterChunk: true });
  const server = await listen(mp4Handler);
  t.after(() => server.close());

  const result = await request(server);
  assert.equal(result.res.statusCode, 200);
  assert.equal(result.aborted, true);
  assert.equal(result.body, 'video-data');

  // Reaching and executing this assertion verifies no uncaught stream error
  // terminated the test process.
  assert.equal(process.exitCode, undefined);
});

test('streaming proxy contains an upstream failure after a chunk was sent', async t => {
  upstreamFactory = () => failingStream({ afterChunk: true });
  const proxy = new StreamingProxy();
  const server = await listen((req, res) => proxy.streamDirect('test-file-id', null, req, res));
  t.after(() => server.close());

  const result = await request(server);
  assert.equal(result.res.statusCode, 200);
  assert.equal(result.aborted, true);
  assert.equal(result.body, 'video-data');
});

test('client disconnect cancels the upstream stream without an uncaught error', async t => {
  let cancelled;
  const wasCancelled = new Promise(resolve => { cancelled = resolve; });
  upstreamFactory = () => new ReadableStream({
    start(controller) {
      controller.enqueue(Buffer.from('first-chunk'));
    },
    pull(controller) {
      controller.enqueue(Buffer.alloc(1024));
    },
    cancel() {
      cancelled();
    }
  });

  const proxy = new StreamingProxy();
  const server = await listen((req, res) => proxy.streamDirect('test-file-id', null, req, res));
  t.after(() => server.close());

  await new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port: server.address().port, path: '/video' });
    req.on('response', res => res.once('data', () => {
      res.destroy();
      resolve();
    }));
    req.on('error', reject);
  });

  await wasCancelled;
  assert.equal(process.exitCode, undefined);
});

test('an already-closed response is not piped and destroys the upstream', async () => {
  const source = new PassThrough();
  const response = new PassThrough();
  response.destroy();

  await pipeUpstreamStream(source, response);

  assert.equal(source.destroyed, true);
});

test('a response error destroys the upstream before rejecting', async () => {
  const source = new PassThrough();
  const response = new PassThrough();
  const streaming = pipeUpstreamStream(source, response);

  response.emit('error', new Error('client socket failed'));

  await assert.rejects(streaming, /client socket failed/);
  assert.equal(source.destroyed, true);
});
