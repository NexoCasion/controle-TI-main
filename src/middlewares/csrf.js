const crypto = require('crypto');

function ensureCsrfToken(req, res, next) {
  if (!req.session) return next();

  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }

  res.locals.csrfToken = req.session.csrfToken;
  next();
}

function getSubmittedToken(req) {
  return (
    req.body?._csrf ||
    req.query?._csrf ||
    req.headers['x-csrf-token'] ||
    req.headers['csrf-token'] ||
    ''
  );
}

function csrfProtection(req, res, next) {
  if (req.path === '/api/backups/status') {
    return next();
  }

  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const sessionToken = String(req.session?.csrfToken || '').trim();
  const submittedToken = String(getSubmittedToken(req) || '').trim();

  if (sessionToken && submittedToken && submittedToken === sessionToken) {
    return next();
  }

  const errorMessage = 'Token de segurança inválido ou expirado. Recarregue a página e tente novamente.';
  const accepts = String(req.headers.accept || '').toLowerCase();

  if (accepts.includes('application/json')) {
    return res.status(403).json({ error: errorMessage });
  }

  return res.status(403).send(errorMessage);
}

module.exports = {
  ensureCsrfToken,
  csrfProtection,
};
