const { extractDriveParams } = require('../lib/drive');
const { getRequestOrigin } = require('../lib/request-origin');

module.exports = async function handler(req, res) {
  try {
    const input = req.query.input || req.query.url || req.body?.input || req.body?.url;
    const { fileId, resourceKey } = extractDriveParams(input);
    const isFolderLike = /drive\.google\.com\/drive\/(?:folders\/|my-drive(?:\/|$)|shared-with-me(?:\/|$))/i.test(String(input || ''));

    if (!fileId || isFolderLike) {
      res.status(400).json({
        error: isFolderLike
          ? 'This is a Google Drive folder/location URL. Please provide a file URL (…/file/d/FILE_ID/...).'
          : 'Unrecognized input. Please provide a Google Drive file URL or raw file ID.'
      });
      return;
    }

    const origin = getRequestOrigin(req);
    const mp4Url = new URL(`/mp4/${fileId}.mp4`, origin);
    if (resourceKey) mp4Url.searchParams.set('rk', resourceKey);

    const downloadUrl = new URL(mp4Url.toString());
    downloadUrl.searchParams.set('download', '1');
    const movUrl = new URL(`/mp4/${fileId}.mov`, origin);
    if (resourceKey) movUrl.searchParams.set('rk', resourceKey);

    const downloadMovUrl = new URL(movUrl.toString());
    downloadMovUrl.searchParams.set('download', '1');

    const mkvUrl = new URL(`/mp4/${fileId}.mkv`, origin);
    if (resourceKey) mkvUrl.searchParams.set('rk', resourceKey);

    const downloadMkvUrl = new URL(mkvUrl.toString());
    downloadMkvUrl.searchParams.set('download', '1');

    res.status(200).json({
      fileId,
      resourceKey,
      mp4Url: mp4Url.toString(),
      movUrl: movUrl.toString(),
      mkvUrl: mkvUrl.toString(),
      downloadUrl: downloadUrl.toString(),
      downloadMovUrl: downloadMovUrl.toString(),
      downloadMkvUrl: downloadMkvUrl.toString()
    });
  } catch (error) {
    res.status(502).json({
      error: 'Unable to validate this Google Drive video link.',
      detail: error.message
    });
  }
};
