const crypto = require('crypto');

function getAdminPassword() {
  return process.env.ADMIN_DASHBOARD_PASSWORD || '';
}

function isAdminAuthConfigured() {
  return getAdminPassword().trim().length > 0;
}

function parseBasicAuthHeader(req) {
  const header = req && req.headers ? req.headers.authorization : '';

  if (typeof header !== 'string' || !header.startsWith('Basic ')) {
    return null;
  }

  try {
    const decoded = Buffer.from(header.slice('Basic '.length), 'base64').toString('utf8');
    const separatorIndex = decoded.indexOf(':');

    if (separatorIndex === -1) {
      return null;
    }

    return {
      username: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1),
    };
  } catch (error) {
    return null;
  }
}

function safeComparePassword(input, expected) {
  if (typeof input !== 'string' || typeof expected !== 'string' || expected.length === 0) {
    return false;
  }

  const inputBuffer = Buffer.from(input);
  const expectedBuffer = Buffer.from(expected);

  if (inputBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(inputBuffer, expectedBuffer);
}

function sendUnauthorized(res) {
  res.statusCode = 401;
  res.setHeader('WWW-Authenticate', 'Basic realm="redefine-admin", charset="UTF-8"');
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end('Unauthorized');
}

function requireAdminAuth(req, res) {
  if (!isAdminAuthConfigured()) {
    sendUnauthorized(res);
    return false;
  }

  const auth = parseBasicAuthHeader(req);
  if (!auth || !safeComparePassword(auth.password, getAdminPassword())) {
    sendUnauthorized(res);
    return false;
  }

  return true;
}

module.exports = {
  isAdminAuthConfigured,
  parseBasicAuthHeader,
  requireAdminAuth,
  safeComparePassword,
};
