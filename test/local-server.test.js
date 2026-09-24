const test = require('node:test');
const assert = require('node:assert/strict');

const app = require('../server');

const FILE_ID = '1AbCdEfGhIjKlMnOpQrStUvWxYz-1234';

test('local server serves the app and generates HTTP playback URLs without exposing source', async t => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => server.close());

  const origin = `http://127.0.0.1:${server.address().port}`;
  const request = path => fetch(`${origin}${path}`);

  const pageResponse = await request('/');
  assert.equal(pageResponse.status, 200);
  assert.match(pageResponse.headers.get('content-type'), /^text\/html/);
  assert.match(await pageResponse.text(), /Google Drive MP4/i);

  const resolveResponse = await request(`/api/resolve?input=${FILE_ID}`);
  assert.equal(resolveResponse.status, 200);
  const resolved = await resolveResponse.json();
  assert.match(resolved.mp4Url, /^http:\/\/127\.0\.0\.1:/);

  const deployedResponse = await fetch(`${origin}/api/resolve?input=${FILE_ID}`, {
    headers: { 'x-forwarded-proto': 'https' }
  });
  assert.equal(deployedResponse.status, 200);
  assert.match((await deployedResponse.json()).mp4Url, /^https:\/\/127\.0\.0\.1:/);

  const playlistResponse = await request(`/api/m3u/${FILE_ID}`);
  assert.equal(playlistResponse.status, 200);
  assert.match(await playlistResponse.text(), new RegExp(`http:\\/\\/127\\.0\\.0\\.1:${server.address().port}\\/mp4\\/${FILE_ID}\\.mp4`));

  const deployedPlaylistResponse = await fetch(`${origin}/api/m3u/${FILE_ID}`, {
    headers: { 'x-forwarded-proto': 'https' }
  });
  assert.equal(deployedPlaylistResponse.status, 200);
  assert.match(await deployedPlaylistResponse.text(), new RegExp(`https:\\/\\/127\\.0\\.0\\.1:${server.address().port}\\/mp4\\/${FILE_ID}\\.mp4`));

  const sourceResponse = await request('/lib/drive.js');
  const sourceBody = await sourceResponse.text();
  assert.doesNotMatch(sourceResponse.headers.get('content-type'), /javascript/);
  assert.doesNotMatch(sourceBody, /function extractDriveParams/);
});
