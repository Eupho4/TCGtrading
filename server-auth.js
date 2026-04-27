const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { createAuthMiddleware } = require('./auth-middleware');

const SALT_ROUNDS = 12;
const SESSION_DAYS = Number(process.env.SESSION_DAYS) || 30;
const BCRYPT_PEPPER = process.env.BCRYPT_SALT || '';

function getJwtSecret() {
    const s = process.env.JWT_SECRET;
    if (!s) {
        throw new Error('JWT_SECRET no está definido en el entorno');
    }
    return s;
}

function jwtOptions() {
    return { audience: 'tcgtrade-app', issuer: 'tcgtrade' };
}

/**
 * @param {import('pg').Client} client
 */
async function initAuthTables(client) {
    await client.query(`
        CREATE TABLE IF NOT EXISTS app_users (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email           VARCHAR(255) NOT NULL UNIQUE,
            password_hash   TEXT,
            display_name    VARCHAR(100) NOT NULL,
            auth_provider   VARCHAR(32)  NOT NULL DEFAULT 'password',
            email_verified  BOOLEAN        NOT NULL DEFAULT FALSE,
            profile_metadata JSONB         NOT NULL DEFAULT '{}'::jsonb,
            created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        )
    `);
    await client.query(
        'ALTER TABLE app_users ADD COLUMN IF NOT EXISTS profile_metadata JSONB NOT NULL DEFAULT \'{}\'::jsonb'
    );
    await client.query(`CREATE INDEX IF NOT EXISTS idx_app_users_email ON app_users (email)`);
    await client.query(`
        CREATE TABLE IF NOT EXISTS app_sessions (
            id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id    UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            expires_at TIMESTAMPTZ NOT NULL
        )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_app_sessions_user_id ON app_sessions (user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_app_sessions_expires ON app_sessions (expires_at)`);
    // Tras quitar Google/Firebase: filas con auth_provider=google y contraseña en BD deben tratarse como locales.
    await client.query(`
        UPDATE app_users
        SET auth_provider = 'password', updated_at = NOW()
        WHERE auth_provider = 'google' AND password_hash IS NOT NULL
    `);
}

function pepper(plain) {
    return BCRYPT_PEPPER ? `${plain}${BCRYPT_PEPPER}` : plain;
}

async function hashPassword(plain) {
    return bcrypt.hash(pepper(plain), SALT_ROUNDS);
}

async function verifyPassword(plain, hash) {
    return bcrypt.compare(pepper(plain), hash);
}

/**
 * @param {import('pg').Pool} pool
 */
function mountAuthRoutes(app, pool) {
    const rateLimit = require('express-rate-limit');
    const authLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 40,
        standardHeaders: true,
        legacyHeaders: false,
        message: { success: false, error: 'Demasiados intentos. Prueba más tarde.' }
    });

    const requireAuth = createAuthMiddleware(pool, getJwtSecret(), jwtOptions());
    const r = express.Router();
    r.use(authLimiter);

    async function createSession(userId) {
        const id = crypto.randomUUID();
        const exp = new Date();
        exp.setDate(exp.getDate() + SESSION_DAYS);
        await pool.query('INSERT INTO app_sessions (id, user_id, expires_at) VALUES ($1, $2, $3)', [id, userId, exp]);
        return id;
    }

    function signSessionJwt(sessionId) {
        return jwt.sign({ sid: sessionId, typ: 'session' }, getJwtSecret(), {
            expiresIn: `${SESSION_DAYS}d`,
            ...jwtOptions()
        });
    }

    r.post('/register', async (req, res) => {
        try {
            const { email, password, username } = req.body || {};
            const em = String(email || '').trim().toLowerCase();
            const pass = String(password || '');
            const uname = String(username || '').trim() || em.split('@')[0];

            if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
                return res.status(400).json({ success: false, error: 'Email no válido' });
            }
            if (pass.length < 6) {
                return res.status(400).json({ success: false, error: 'La contraseña debe tener al menos 6 caracteres' });
            }

            const existing = await pool.query(
                'SELECT id, password_hash, auth_provider FROM app_users WHERE email = $1',
                [em]
            );
            if (existing.rows.length) {
                const row = existing.rows[0];
                if (row.password_hash) {
                    return res
                        .status(409)
                        .json({ success: false, error: 'Ya existe una cuenta con este email. Inicia sesión o usa otra dirección.' });
                }
                // Cuenta sin contraseña en servidor (p. ej. marcada Google): permitir fijar contraseña con este registro.
                const passwordHash = await hashPassword(pass);
                const upd = await pool.query(
                    `UPDATE app_users
                     SET password_hash = $1, auth_provider = 'password', display_name = $2, updated_at = NOW()
                     WHERE id = $3
                     RETURNING id, email, display_name, auth_provider, created_at`,
                    [passwordHash, uname, row.id]
                );
                const u = upd.rows[0];
                const sid = await createSession(u.id);
                const token = signSessionJwt(sid);
                return res.json({
                    success: true,
                    user: { id: u.id, email: u.email, displayName: u.display_name, authProvider: u.auth_provider },
                    token,
                    sessionExpiresInDays: SESSION_DAYS
                });
            }

            const passwordHash = await hashPassword(pass);
            const ins = await pool.query(
                `INSERT INTO app_users (email, password_hash, display_name, auth_provider)
                 VALUES ($1, $2, $3, 'password')
                 RETURNING id, email, display_name, auth_provider, created_at`,
                [em, passwordHash, uname]
            );
            const u = ins.rows[0];
            const sid = await createSession(u.id);
            const token = signSessionJwt(sid);
            return res.json({
                success: true,
                user: { id: u.id, email: u.email, displayName: u.display_name, authProvider: u.auth_provider },
                token,
                sessionExpiresInDays: SESSION_DAYS
            });
        } catch (e) {
            console.error('auth register:', e.message);
            return res.status(500).json({ success: false, error: 'Error al registrar' });
        }
    });

    r.post('/reset-password', async (req, res) => {
        const { email } = req.body || {};
        const em = String(email || '').trim().toLowerCase();
        if (em) {
            await pool.query('SELECT id FROM app_users WHERE email = $1', [em]);
        }
        return res.json({
            success: true,
            message: 'Si el correo está registrado, recibirás instrucciones. (Revisa también spam.)'
        });
    });

    r.post('/login', async (req, res) => {
        try {
            const { email, password } = req.body || {};
            const em = String(email || '').trim().toLowerCase();
            const pass = String(password || '');

            if (!em || !pass) {
                return res.status(400).json({ success: false, error: 'Email y contraseña son obligatorios' });
            }

            const q = await pool.query(
                'SELECT id, email, password_hash, display_name, auth_provider FROM app_users WHERE email = $1',
                [em]
            );
            if (q.rows.length === 0) {
                return res.status(401).json({ success: false, error: 'Credenciales incorrectas' });
            }
            const u = q.rows[0];
            if (u.auth_provider === 'google' && !u.password_hash) {
                return res.status(400).json({
                    success: false,
                    error:
                        'Esta cuenta no tiene contraseña en el servidor. Usa el mismo email en «Registrarse» para fijar una contraseña, o contacta al administrador del sitio.'
                });
            }
            if (!u.password_hash) {
                return res.status(400).json({ success: false, error: 'Esta cuenta no tiene contraseña en el servidor' });
            }
            const ok = await verifyPassword(pass, u.password_hash);
            if (!ok) {
                return res.status(401).json({ success: false, error: 'Credenciales incorrectas' });
            }
            if (u.auth_provider === 'google' && u.password_hash) {
                await pool.query(
                    `UPDATE app_users SET auth_provider = 'password', updated_at = NOW() WHERE id = $1`,
                    [u.id]
                );
                u.auth_provider = 'password';
            }

            const sid = await createSession(u.id);
            const token = signSessionJwt(sid);
            return res.json({
                success: true,
                user: { id: u.id, email: u.email, displayName: u.display_name, authProvider: u.auth_provider },
                token,
                sessionExpiresInDays: SESSION_DAYS
            });
        } catch (e) {
            console.error('auth login:', e.message);
            return res.status(500).json({ success: false, error: 'Error al iniciar sesión' });
        }
    });

    r.post('/logout', requireAuth, async (req, res) => {
        try {
            await pool.query('DELETE FROM app_sessions WHERE id = $1', [req.sessionId]);
            return res.json({ success: true });
        } catch (e) {
            console.error('auth logout:', e.message);
            return res.status(500).json({ success: false, error: 'Error al cerrar sesión' });
        }
    });

    r.get('/me', requireAuth, async (req, res) => {
        try {
            const q = await pool.query(
                `SELECT id, email, display_name, auth_provider, created_at, updated_at, email_verified, profile_metadata
                 FROM app_users WHERE id = $1`,
                [req.user.id]
            );
            if (q.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
            }
            const u = q.rows[0];
            return res.json({
                success: true,
                user: {
                    id: u.id,
                    email: u.email,
                    displayName: u.display_name,
                    authProvider: u.auth_provider,
                    emailVerified: u.email_verified,
                    profile: u.profile_metadata && typeof u.profile_metadata === 'object' ? u.profile_metadata : {},
                    createdAt: u.created_at,
                    updatedAt: u.updated_at
                }
            });
        } catch (e) {
            console.error('auth me:', e.message);
            return res.status(500).json({ success: false, error: 'Error al cargar el perfil' });
        }
    });

    r.patch('/me', requireAuth, async (req, res) => {
        try {
            const { displayName, name, lastName, address, birthDate, darkMode, email } = req.body || {};
            const em = email != null ? String(email).trim().toLowerCase() : null;
            if (em && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
                return res.status(400).json({ success: false, error: 'Email no válido' });
            }
            if (em) {
                const taken = await pool.query('SELECT id FROM app_users WHERE email = $1 AND id != $2', [em, req.user.id]);
                if (taken.rows.length) {
                    return res.status(409).json({ success: false, error: 'Ese email ya está en uso' });
                }
            }
            const parts = ['updated_at = NOW()'];
            const vals = [req.user.id];
            let p = 2;
            if (displayName != null) {
                parts.push(`display_name = $${p++}`);
                vals.push(String(displayName).trim());
            }
            if (em) {
                parts.push(`email = $${p++}`);
                vals.push(em);
            }
            const meta = {};
            if (name != null) meta.name = name;
            if (lastName != null) meta.lastName = lastName;
            if (address != null) meta.address = address;
            if (birthDate != null) meta.birthDate = birthDate;
            if (darkMode != null) meta.darkMode = darkMode;
            if (Object.keys(meta).length) {
                parts.push('profile_metadata = profile_metadata || $' + p++ + '::jsonb');
                vals.push(JSON.stringify(meta));
            }
            if (parts.length === 1) {
                return res.status(400).json({ success: false, error: 'Nada que actualizar' });
            }
            const setClause = parts.join(', ');
            const uq = await pool.query(
                `UPDATE app_users SET ${setClause} WHERE id = $1
                 RETURNING id, email, display_name, auth_provider, email_verified, profile_metadata, updated_at`,
                vals
            );
            const u = uq.rows[0];
            return res.json({
                success: true,
                user: {
                    id: u.id,
                    email: u.email,
                    displayName: u.display_name,
                    authProvider: u.auth_provider,
                    emailVerified: u.email_verified,
                    profile: u.profile_metadata || {}
                }
            });
        } catch (e) {
            console.error('auth patch me:', e.message);
            return res.status(500).json({ success: false, error: 'Error al guardar el perfil' });
        }
    });

    r.put('/me/password', requireAuth, async (req, res) => {
        try {
            const { currentPassword, newPassword } = req.body || {};
            const oldP = String(currentPassword || '');
            const newP = String(newPassword || '');
            if (oldP.length < 1 || newP.length < 6) {
                return res.status(400).json({ success: false, error: 'Contraseña inválida' });
            }
            const u = await pool.query('SELECT id, password_hash, auth_provider FROM app_users WHERE id = $1', [req.user.id]);
            if (u.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
            }
            if (u.rows[0].auth_provider === 'google' && !u.rows[0].password_hash) {
                return res.status(400).json({ success: false, error: 'Cuenta de Google: usa el flujo de Google para cambiar el acceso' });
            }
            if (!u.rows[0].password_hash) {
                return res.status(400).json({ success: false, error: 'No hay contraseña local que cambiar' });
            }
            const good = await verifyPassword(oldP, u.rows[0].password_hash);
            if (!good) {
                return res.status(401).json({ success: false, error: 'La contraseña actual no es correcta' });
            }
            const hash = await hashPassword(newP);
            await pool.query('UPDATE app_users SET password_hash = $2, updated_at = NOW() WHERE id = $1', [req.user.id, hash]);
            return res.json({ success: true, message: 'Contraseña actualizada' });
        } catch (e) {
            console.error('auth password:', e.message);
            return res.status(500).json({ success: false, error: 'Error al actualizar la contraseña' });
        }
    });

    app.use('/api/auth', r);
}

/**
 * @param {import('pg').Pool} pool
 */
function createRequireAuthForUserId(pool) {
    return createAuthMiddleware(pool, getJwtSecret(), jwtOptions());
}

module.exports = { initAuthTables, mountAuthRoutes, getJwtSecret, jwtOptions, createRequireAuthForUserId };
