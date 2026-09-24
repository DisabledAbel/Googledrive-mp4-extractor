function getRequestOrigin(req) {
  const forwardedProtocol = req.headers['x-forwarded-proto'];
  const protocol = (Array.isArray(forwardedProtocol) ? forwardedProtocol[0] : forwardedProtocol)
    ?.split(',')[0]
    .trim() || req.protocol || 'https';
  const host = req.headers.host || 'localhost';

  return `${protocol}://${host}`;
}

module.exports = { getRequestOrigin };
