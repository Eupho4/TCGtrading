const express = require('express');
const { createAuthMiddleware } = require('./auth-middleware');

async function initInboxTradesTables(client) {
    await client.query(`
        CREATE TABLE IF NOT EXISTS app_trades (
            id         TEXT         PRIMARY KEY,
            owner_id   UUID         NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
            data       JSONB        NOT NULL DEFAULT '{}'::jsonb,
            status     VARCHAR(32)  NOT NULL DEFAULT 'active',
            created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        )`);
    await client.query(`
        CREATE TABLE IF NOT EXISTS app_trade_proposals (
            id             TEXT         PRIMARY KEY,
            trade_id       TEXT         NOT NULL,
            owner_user_id  UUID         NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
            from_user_id   UUID         NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
            data           JSONB        NOT NULL DEFAULT '{}'::jsonb,
            status         VARCHAR(32)  NOT NULL DEFAULT 'pending',
            created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
            updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        )`);
    await client.query(`
        CREATE TABLE IF NOT EXISTS app_notifications (
            id         TEXT         NOT NULL,
            user_id    UUID         NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
            data       JSONB        NOT NULL DEFAULT '{}'::jsonb,
            read_at    TIMESTAMPTZ,
            created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
            PRIMARY KEY (id, user_id)
        )`);
    await client.query(`
        CREATE TABLE IF NOT EXISTS app_tradeable_cards (
            user_id    UUID   NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
            card_id    TEXT   NOT NULL,
            data       JSONB  NOT NULL DEFAULT '{}'::jsonb,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (user_id, card_id)
        )`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_app_trades_owner ON app_trades (owner_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_app_trade_proposals_owner ON app_trade_proposals (owner_user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_app_trade_proposals_from ON app_trade_proposals (from_user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_app_notifications_user ON app_notifications (user_id)`);
}

/**
 * @param {import('express').Application} app
 * @param {import('pg').Pool} pool
 * @param {() => string} getJwtSecret
 * @param {() => object} jwtOptions
 * @param {import('express-rate-limit').RateLimitRequestHandler} [dbReadLimiter]
 */
function mountInboxTradesRoutes(app, pool, getJwtSecret, jwtOptions, dbReadLimiter) {
    const limiter = dbReadLimiter || ((_req, _res, next) => next());
    const requireAuth = createAuthMiddleware(pool, getJwtSecret(), jwtOptions());
    const pub = express.Router();
    const api = express.Router();
    api.use(requireAuth);

    pub.get('/trades/public', limiter, async (req, res) => {
        try {
            const { rows } = await pool.query(
                `SELECT t.id, t.owner_id, t.data, t.created_at, t.updated_at
                   FROM app_trades t
                  WHERE COALESCE(t.status, 'active') = 'active'
                  ORDER BY t.updated_at DESC
                  LIMIT 500`
            );
            const list = rows.map((row) => {
                const d = row.data && typeof row.data === 'object' ? { ...row.data } : {};
                d.id = row.id;
                d.userId = row.owner_id;
                if (!d.createdAt) d.createdAt = row.created_at;
                return d;
            });
            res.json({ success: true, data: list });
        } catch (e) {
            console.error('trades public:', e.message);
            res.status(500).json({ success: false, error: 'Error al cargar intercambios' });
        }
    });

    pub.get('/transferable-cards', limiter, async (req, res) => {
        try {
            const { rows } = await pool.query(
                `SELECT c.user_id, c.card_id, c.data, c.updated_at, u.display_name, u.email
                   FROM app_tradeable_cards c
                   JOIN app_users u ON u.id = c.user_id
                  ORDER BY c.updated_at DESC
                  LIMIT 2000`
            );
            res.json({ success: true, data: rows });
        } catch (e) {
            console.error('transferable list:', e.message);
            res.status(500).json({ success: false, error: 'Error' });
        }
    });

    api.get('/trades/mine', limiter, async (req, res) => {
        try {
            const { rows } = await pool.query(
                `SELECT id, owner_id, data, created_at, updated_at FROM app_trades
                  WHERE owner_id = $1 ORDER BY updated_at DESC`,
                [req.user.id]
            );
            const list = rows.map((row) => {
                const d = row.data && typeof row.data === 'object' ? { ...row.data } : {};
                d.id = row.id;
                d.userId = row.owner_id;
                if (!d.createdAt) d.createdAt = row.created_at;
                return d;
            });
            res.json({ success: true, data: list });
        } catch (e) {
            console.error('trades mine:', e.message);
            res.status(500).json({ success: false, error: 'Error' });
        }
    });

    api.post('/trades', async (req, res) => {
        try {
            const body = req.body || {};
            const id = String(body.id || '').trim();
            if (!id) {
                return res.status(400).json({ success: false, error: 'id requerido' });
            }
            if (body.userId != null && String(body.userId) !== String(req.user.id)) {
                return res.status(403).json({ success: false, error: 'userId no coincide con la sesión' });
            }
            const { rows: existing } = await pool.query('SELECT owner_id FROM app_trades WHERE id = $1', [id]);
            if (existing.length && String(existing[0].owner_id) !== String(req.user.id)) {
                return res.status(403).json({ success: false, error: 'No autorizado' });
            }
            const data = { ...body, userId: req.user.id };
            await pool.query(
                `INSERT INTO app_trades (id, owner_id, data, status, updated_at)
                 VALUES ($1, $2, $3::jsonb, COALESCE($4, 'active'), NOW())
                 ON CONFLICT (id) DO UPDATE
                    SET data = $3::jsonb, owner_id = $2, status = COALESCE(EXCLUDED.status, app_trades.status), updated_at = NOW()`,
                [id, req.user.id, JSON.stringify(data), body.status || null]
            );
            res.json({ success: true });
        } catch (e) {
            console.error('POST trades:', e.message);
            res.status(500).json({ success: false, error: 'Error al guardar' });
        }
    });

    api.delete('/trades/:tradeId', async (req, res) => {
        try {
            const r0 = await pool.query('DELETE FROM app_trades WHERE id = $1 AND owner_id = $2', [req.params.tradeId, req.user.id]);
            if (r0.rowCount === 0) {
                return res.status(404).json({ success: false, error: 'No encontrado' });
            }
            res.json({ success: true });
        } catch (e) {
            console.error('DELETE trade:', e.message);
            res.status(500).json({ success: false, error: 'Error' });
        }
    });

    /** Fusión superficial en data (p. ej. contador de propuestas) */
    api.patch('/trades/:tradeId', async (req, res) => {
        try {
            const { rows } = await pool.query('SELECT data FROM app_trades WHERE id = $1 AND owner_id = $2', [req.params.tradeId, req.user.id]);
            if (!rows.length) {
                return res.status(404).json({ success: false, error: 'No encontrado' });
            }
            const old = rows[0].data && typeof rows[0].data === 'object' ? { ...rows[0].data } : {};
            const next = { ...old, ...req.body };
            await pool.query('UPDATE app_trades SET data = $1::jsonb, updated_at = NOW() WHERE id = $2 AND owner_id = $3', [JSON.stringify(next), req.params.tradeId, req.user.id]);
            res.json({ success: true });
        } catch (e) {
            console.error('PATCH trade:', e.message);
            res.status(500).json({ success: false, error: 'Error' });
        }
    });

    api.get('/proposals/received', limiter, async (req, res) => {
        try {
            const { rows } = await pool.query(
                `SELECT id, trade_id, data, created_at FROM app_trade_proposals
                  WHERE owner_user_id = $1 ORDER BY created_at DESC`,
                [req.user.id]
            );
            const list = rows.map((row) => {
                const d = row.data && typeof row.data === 'object' ? { ...row.data } : {};
                d.id = row.id;
                d.tradeId = row.trade_id;
                d.createdAt = d.createdAt || (row.created_at && row.created_at.toISOString());
                return d;
            });
            res.json({ success: true, data: list });
        } catch (e) {
            console.error('proposals received:', e.message);
            res.status(500).json({ success: false, error: 'Error' });
        }
    });

    api.get('/proposals/sent', limiter, async (req, res) => {
        try {
            const { rows } = await pool.query(
                `SELECT id, trade_id, data, created_at FROM app_trade_proposals
                  WHERE from_user_id = $1 ORDER BY created_at DESC`,
                [req.user.id]
            );
            const list = rows.map((row) => {
                const d = row.data && typeof row.data === 'object' ? { ...row.data } : {};
                d.id = row.id;
                d.tradeId = row.trade_id;
                d.createdAt = d.createdAt || (row.created_at && row.created_at.toISOString());
                return d;
            });
            res.json({ success: true, data: list });
        } catch (e) {
            console.error('proposals sent:', e.message);
            res.status(500).json({ success: false, error: 'Error' });
        }
    });

    api.post('/proposals', async (req, res) => {
        try {
            const p = req.body || {};
            const id = String(p.id || '').trim();
            const tradeId = String(p.tradeId || p.originalTradeId || '').trim();
            const ownerId = p.ownerUserId;
            if (!id || !tradeId || !ownerId) {
                return res.status(400).json({ success: false, error: 'id, tradeId y ownerUserId requeridos' });
            }
            if (String(p.fromUserId) !== String(req.user.id)) {
                return res.status(403).json({ success: false, error: 'fromUserId no coincide' });
            }
            const data = { ...p };
            await pool.query(
                `INSERT INTO app_trade_proposals (id, trade_id, owner_user_id, from_user_id, data, status, updated_at)
                 VALUES ($1, $2, $3, $4, $5::jsonb, $6, NOW())
                 ON CONFLICT (id) DO UPDATE
                    SET data = EXCLUDED.data, status = EXCLUDED.status, updated_at = NOW()`,
                [id, tradeId, ownerId, req.user.id, JSON.stringify(data), p.status || 'pending']
            );
            if (p.tradeMeta) {
                const { rows: trr } = await pool.query('SELECT data FROM app_trades WHERE id = $1 AND owner_id = $2', [tradeId, ownerId]);
                if (trr.length) {
                    const oldD = trr[0].data && typeof trr[0].data === 'object' ? { ...trr[0].data } : {};
                    const nextD = { ...oldD, ...p.tradeMeta };
                    await pool.query('UPDATE app_trades SET data = $1::jsonb, updated_at = NOW() WHERE id = $2', [JSON.stringify(nextD), tradeId]);
                }
            }
            res.json({ success: true });
        } catch (e) {
            console.error('POST proposals:', e.message);
            res.status(500).json({ success: false, error: 'Error al guardar propuesta' });
        }
    });

    api.delete('/proposals/:proposalId', async (req, res) => {
        try {
            const r0 = await pool.query(
                `DELETE FROM app_trade_proposals WHERE id = $1
                  AND (owner_user_id = $2 OR from_user_id = $2)`,
                [req.params.proposalId, req.user.id]
            );
            if (r0.rowCount === 0) {
                return res.status(404).json({ success: false, error: 'No encontrada' });
            }
            res.json({ success: true });
        } catch (e) {
            console.error('DELETE proposal:', e.message);
            res.status(500).json({ success: false, error: 'Error' });
        }
    });

    api.get('/notifications', limiter, async (req, res) => {
        try {
            const { rows } = await pool.query(
                `SELECT id, data, read_at, created_at FROM app_notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 200`,
                [req.user.id]
            );
            const list = rows.map((row) => {
                const d = row.data && typeof row.data === 'object' ? { ...row.data } : {};
                d.id = row.id;
                d.read = !!row.read_at;
                d.timestamp = d.timestamp || (row.created_at && row.created_at.toISOString());
                return d;
            });
            res.json({ success: true, data: list });
        } catch (e) {
            console.error('GET notifications:', e.message);
            res.status(500).json({ success: false, error: 'Error' });
        }
    });

    /** Crea notificación para otro usuario (quien envía debe ser fromUserId en el cuerpo) */
    api.post('/notifications', async (req, res) => {
        try {
            const n = req.body || {};
            const id = String(n.id || '').trim();
            const targetUserId = n.targetUserId || n.toUserId;
            if (!id || !targetUserId) {
                return res.status(400).json({ success: false, error: 'id y targetUserId requeridos' });
            }
            if (n.fromUserId && String(n.fromUserId) !== String(req.user.id)) {
                return res.status(403).json({ success: false, error: 'Solo puedes enviar notificaciones como tú mismo' });
            }
            const data = { ...n, fromUserId: req.user.id };
            delete data.targetUserId;
            delete data.toUserId;
            const readAt = n.read ? new Date() : null;
            await pool.query(
                `INSERT INTO app_notifications (id, user_id, data, read_at, created_at)
                 VALUES ($1, $2, $3::jsonb, $4, COALESCE($5::timestamptz, NOW()))
                 ON CONFLICT (id, user_id) DO UPDATE
                    SET data = app_notifications.data || EXCLUDED.data,
                        read_at = COALESCE(EXCLUDED.read_at, app_notifications.read_at)`,
                [id, targetUserId, JSON.stringify(data), readAt, n.timestamp || null]
            );
            res.json({ success: true });
        } catch (e) {
            console.error('POST notification:', e.message);
            res.status(500).json({ success: false, error: 'Error' });
        }
    });

    api.patch('/notifications/:notifId/read', async (req, res) => {
        try {
            await pool.query(
                `UPDATE app_notifications
                    SET read_at = NOW(),
                        data = data || '{"read": true}'::jsonb
                  WHERE id = $1 AND user_id = $2`,
                [req.params.notifId, req.user.id]
            );
            res.json({ success: true });
        } catch (e) {
            console.error('PATCH notif read:', e.message);
            res.status(500).json({ success: false, error: 'Error' });
        }
    });

    api.delete('/notifications/:notifId', async (req, res) => {
        try {
            await pool.query('DELETE FROM app_notifications WHERE id = $1 AND user_id = $2', [req.params.notifId, req.user.id]);
            res.json({ success: true });
        } catch (e) {
            console.error('DELETE notif:', e.message);
            res.status(500).json({ success: false, error: 'Error' });
        }
    });

    api.put('/transferable-cards', async (req, res) => {
        try {
            const b = req.body || {};
            const cardId = String(b.cardId || '').trim();
            if (!cardId) {
                return res.status(400).json({ success: false, error: 'cardId requerido' });
            }
            const data = {
                userId: req.user.id,
                userName: b.userName || req.user.displayName || req.user.email,
                customPrice: b.customPrice,
                condition: b.condition,
                language: b.language,
                cardId,
                cardName: b.cardName,
                imageUrl: b.imageUrl,
                setName: b.setName
            };
            await pool.query(
                `INSERT INTO app_tradeable_cards (user_id, card_id, data, updated_at)
                 VALUES ($1, $2, $3::jsonb, NOW())
                 ON CONFLICT (user_id, card_id) DO UPDATE
                    SET data = EXCLUDED.data, updated_at = NOW()`,
                [req.user.id, cardId, JSON.stringify(data)]
            );
            res.json({ success: true });
        } catch (e) {
            console.error('PUT transferable:', e.message);
            res.status(500).json({ success: false, error: 'Error' });
        }
    });

    api.delete('/transferable-cards/:cardId', async (req, res) => {
        try {
            await pool.query('DELETE FROM app_tradeable_cards WHERE user_id = $1 AND card_id = $2', [req.user.id, req.params.cardId]);
            res.json({ success: true });
        } catch (e) {
            console.error('DELETE transferable:', e.message);
            res.status(500).json({ success: false, error: 'Error' });
        }
    });

    app.use('/api', pub);
    app.use('/api', api);
}

module.exports = { initInboxTradesTables, mountInboxTradesRoutes };
