const session = require('express-session');
const database = require('../db/init');

function toExpiresAt(sessionData = {}) {
  const cookie = sessionData.cookie || {};

  if (cookie.expires) {
    const expiresAt = new Date(cookie.expires);
    if (!Number.isNaN(expiresAt.getTime())) return expiresAt;
  }

  if (cookie.maxAge) {
    const maxAge = Number(cookie.maxAge);
    if (Number.isFinite(maxAge) && maxAge > 0) {
      return new Date(Date.now() + maxAge);
    }
  }

  return null;
}

function isExpired(expiresAt) {
  if (!expiresAt) return false;
  const parsed = new Date(expiresAt);
  return !Number.isNaN(parsed.getTime()) && parsed.getTime() <= Date.now();
}

class SequelizeSessionStore extends session.Store {
  constructor() {
    super();
  }

  async get(sid, callback) {
    try {
      const rows = await database.query(
        'SELECT sid, sess, expires_at FROM sessions WHERE sid = ? LIMIT 1;',
        {
          replacements: [String(sid || '')],
          type: database.QueryTypes.SELECT,
        }
      );

      const row = rows[0];
      if (!row) return callback(null, null);

      if (isExpired(row.expires_at)) {
        await this.destroy(sid, () => {});
        return callback(null, null);
      }

      return callback(null, JSON.parse(row.sess));
    } catch (error) {
      return callback(error);
    }
  }

  async set(sid, sessionData, callback = () => {}) {
    try {
      const payload = JSON.stringify(sessionData || {});
      const expiresAt = toExpiresAt(sessionData);

      await database.query(
        `
          INSERT INTO sessions (sid, sess, expires_at, createdAt, updatedAt)
          VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT(sid) DO UPDATE SET
            sess = excluded.sess,
            expires_at = excluded.expires_at,
            updatedAt = CURRENT_TIMESTAMP;
        `,
        {
          replacements: [String(sid || ''), payload, expiresAt ? expiresAt.toISOString() : null],
        }
      );

      return callback(null);
    } catch (error) {
      return callback(error);
    }
  }

  async destroy(sid, callback = () => {}) {
    try {
      await database.query('DELETE FROM sessions WHERE sid = ?;', {
        replacements: [String(sid || '')],
      });

      return callback(null);
    } catch (error) {
      return callback(error);
    }
  }

  async touch(sid, sessionData, callback = () => {}) {
    try {
      const expiresAt = toExpiresAt(sessionData);

      await database.query(
        `
          UPDATE sessions
          SET expires_at = ?, updatedAt = CURRENT_TIMESTAMP
          WHERE sid = ?;
        `,
        {
          replacements: [expiresAt ? expiresAt.toISOString() : null, String(sid || '')],
        }
      );

      return callback(null);
    } catch (error) {
      return callback(error);
    }
  }

  async clearExpired() {
    await database.query(
      `
        DELETE FROM sessions
        WHERE expires_at IS NOT NULL
          AND datetime(expires_at) <= datetime('now');
      `
    );
  }
}

module.exports = SequelizeSessionStore;
