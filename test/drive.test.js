const test = require('node:test');
const assert = require('node:assert/strict');

const { extractGoogleDriveFileId } = require('../lib/drive');

const FILE_ID = '1AbCdEfGhIjKlMnOpQrStUvWxYz-1234';
const FOLDER_ID = '0BwwA4oUTeiV1TGRPeTVjaWRDY1E';

const validCases = [
  // Standard share/view
  `https://drive.google.com/file/d/${FILE_ID}/view?usp=sharing`,
  `https://drive.google.com/file/d/${FILE_ID}/view`,
  `https://drive.google.com/open?id=${FILE_ID}`,

  // Direct download
  `https://drive.google.com/uc?export=download&id=${FILE_ID}`,
  `https://docs.google.com/uc?export=download&id=${FILE_ID}`,
  `https://drive.google.com/uc?export=view&id=${FILE_ID}`,

  // Native Google Docs/Sheets/Slides edit links
  `https://docs.google.com/document/d/${FILE_ID}/edit`,
  `https://docs.google.com/document/d/${FILE_ID}/edit?usp=sharing`,
  `https://docs.google.com/spreadsheets/d/${FILE_ID}/edit`,
  `https://docs.google.com/presentation/d/${FILE_ID}/edit`,

  // Preview/embed
  `https://docs.google.com/document/d/${FILE_ID}/preview`,
  `https://docs.google.com/spreadsheets/d/${FILE_ID}/preview`,
  `https://docs.google.com/presentation/d/${FILE_ID}/preview`,

  // Copy-to-drive
  `https://docs.google.com/document/d/${FILE_ID}/copy`,
  `https://docs.google.com/document/d/${FILE_ID}/copy?userstoinvite=email@example.com`,

  // Export links (Docs, Sheets, Slides, Drawings)
  `https://docs.google.com/document/d/${FILE_ID}/export?format=pdf`,
  `https://docs.google.com/spreadsheets/d/${FILE_ID}/export?format=xlsx`,
  `https://docs.google.com/presentation/d/${FILE_ID}/export/pdf`,
  `https://docs.google.com/presentation/d/${FILE_ID}/export/png?pageid=p10`,
  `https://docs.google.com/drawings/d/${FILE_ID}/export/svg`,

  // Resource key variant
  `https://drive.google.com/file/d/${FILE_ID}/view?usp=sharing&resourcekey=KEY`
];

for (const url of validCases) {
  test(`extracts file ID from ${url}`, () => {
    assert.equal(extractGoogleDriveFileId(url), FILE_ID);
  });
}

test('extracts folder ID from folder links', () => {
  assert.equal(extractGoogleDriveFileId(`https://drive.google.com/drive/folders/${FOLDER_ID}`), FOLDER_ID);
  assert.equal(extractGoogleDriveFileId(`https://drive.google.com/drive/folders/${FOLDER_ID}?usp=sharing`), FOLDER_ID);
});

test('returns null for docs web viewer URL without an ID', () => {
  assert.equal(extractGoogleDriveFileId('https://docs.google.com/viewer?url=https://example.com/file.pdf'), null);
});

test('supports trailing slash and extra query parameters', () => {
  const url = `https://docs.google.com/document/d/${FILE_ID}/edit/?usp=sharing&foo=bar&resourcekey=abc`;
  assert.equal(extractGoogleDriveFileId(url), FILE_ID);
});

test('supports raw file IDs', () => {
  assert.equal(extractGoogleDriveFileId(FILE_ID), FILE_ID);
});

test('returns null for malformed, unsupported, or invalid URLs', () => {
  assert.equal(extractGoogleDriveFileId('not a url'), null);
  assert.equal(extractGoogleDriveFileId('https://example.com/file/d/123456789012345'), null);
  assert.equal(extractGoogleDriveFileId('https://drive.google.com/file/d//view'), null);
  assert.equal(extractGoogleDriveFileId('https://drive.google.com/open?usp=sharing'), null);
  assert.equal(extractGoogleDriveFileId(''), null);
});
