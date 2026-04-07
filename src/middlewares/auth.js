function attachCurrentUser(req, res, next) {
  res.locals.currentUser = req.session?.user || null;
  next();
}

function ensureAuth(req, res, next) {
  if (req.session?.user) {
    return next();
  }

  if (req.method === 'GET') {
    req.session.returnTo = req.originalUrl;
  }

  return res.redirect('/login');
}

function redirectIfAuthenticated(req, res, next) {
  if (req.session?.user) {
    return res.redirect('/');
  }

  return next();
}

module.exports = {
  attachCurrentUser,
  ensureAuth,
  redirectIfAuthenticated,
};
