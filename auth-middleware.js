const jwt = require('jsonwebtoken');

/**
 * @param {import('pg').Pool} pool
 * @param {import('jsonwebtoken').Secret} secret
 * @param {import('jsonwebtoken').SignOptions} options
 */
function createAuthMiddleware(pool, secret, options) {
    /**
     * @param {import('express').Request} req
     * @param {import('express').Response} res
     * @param {import('express').NextFunction} next
     */
    return async function requireAuth(req, res, next) {
        const h = req.headers.authorization || '';
        const match = h.match(/^Bearer\s+(.+)$/i);
        if (!match) {
            return res.status(401).json({ success: false, error: 'No autenticado' });
        }
        const token = match[1];
        try {
            const payload = jwt.verify(token, secret, options);
            if (!payload.sid) {
                return res.status(401).json({ success: false, error: 'Token inválido' });
            }
            const s = await pool.query(
                'SELECT u.id, u.email, u.display_name, u.auth_provider, s.id AS session_id, s.expires_at FROM app_sessions s JOIN app_users u ON u.id = s.user_id WHERE s.id = $1',
                [payload.sid]
            );
            if (s.rows.length === 0) {
                return res.status(401).json({ success: false, error: 'Sesión inválida' });
            }
            const row = s.rows[0];
            if (row.expires_at < new Date()) {
                return res.status(401).json({ success: false, error: 'Sesión expirada' });
            }
            req.user = {
                id: row.id,
                email: row.email,
                displayName: row.display_name,
                authProvider: row.auth_provider
            };
            req.sessionId = row.session_id;
            next();
        } catch (e) {
            return res.status(401).json({ success: false, error: 'Token inválido o expirado' });
        }
    };
}

/**
 * @param {import('express').Request} req
 * @param {import('pg').Pool} pool
 */
async function getOptionalUserIdFromBody(req, pool) {
    const h = req.headers.authorization || '';
    const match = h.match(/^Bearer\s+(.+)$/i);
    if (!match) return null;
    const token = match[1];
    try {
        const secret = process.env.JWT_SECRET;
        if (!secret) return null;
        const payload = jwt.verify(token, secret);
        if (!payload.sid) return null;
        const s = await pool.query(
            'SELECT u.id FROM app_sessions s JOIN app_users u ON u.id = s.user_id WHERE s.id = $1 AND s.expires_at > NOW()',
            [payload.sid]
        );
        return s.rows[0] ? s.rows[0].id : null;
    } catch {
        return null;
    }
}

module.exports = { createAuthMiddleware, getOptionalUserIdFromBody };
