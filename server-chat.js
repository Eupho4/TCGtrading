const express = require('express');
const { createAuthMiddleware } = require('./auth-middleware');

const MAX_MSG_LEN = 5000;
const TYPING_TTL_SEC = 12;

/**
 * @param {import('pg').PoolClient} client
 */
async function initChatTables(client) {
    await client.query(`
        CREATE TABLE IF NOT EXISTS app_chat_rooms (
            id              TEXT         PRIMARY KEY,
            trade_id        TEXT,
            metadata        JSONB        NOT NULL DEFAULT '{}'::jsonb,
            is_trade_chat   BOOLEAN      NOT NULL DEFAULT FALSE,
            last_message    TEXT,
            last_message_time TIMESTAMPTZ,
            last_message_sender_id UUID,
            created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        )`);
    await client.query(`
        CREATE TABLE IF NOT EXISTS app_chat_participants (
            room_id     TEXT   NOT NULL REFERENCES app_chat_rooms(id) ON DELETE CASCADE,
            user_id     UUID   NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
            display_name TEXT  NOT NULL DEFAULT '',
            email       TEXT   NOT NULL DEFAULT '',
            is_online   BOOLEAN NOT NULL DEFAULT FALSE,
            last_seen   TIMESTAMPTZ,
            last_read_at TIMESTAMPTZ,
            is_hidden   BOOLEAN NOT NULL DEFAULT FALSE,
            has_unread  BOOLEAN NOT NULL DEFAULT FALSE,
            data        JSONB  NOT NULL DEFAULT '{}'::jsonb,
            updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (room_id, user_id)
        )`);
    await client.query(`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'app_chat_participants' AND column_name = 'data'
            ) THEN
                ALTER TABLE app_chat_participants
                    ADD COLUMN data JSONB NOT NULL DEFAULT '{}'::jsonb;
            END IF;
        END
        $$`);
    await client.query(`
        CREATE TABLE IF NOT EXISTS app_chat_messages (
            id          UUID   PRIMARY KEY DEFAULT gen_random_uuid(),
            room_id     TEXT   NOT NULL REFERENCES app_chat_rooms(id) ON DELETE CASCADE,
            sender_id   UUID   NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
            sender_name TEXT   NOT NULL DEFAULT '',
            body        TEXT   NOT NULL,
            msg_type    VARCHAR(32) NOT NULL DEFAULT 'text',
            delivered   BOOLEAN NOT NULL DEFAULT TRUE,
            read_at     TIMESTAMPTZ,
            data        JSONB  NOT NULL DEFAULT '{}'::jsonb,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_app_chat_messages_room_time ON app_chat_messages (room_id, created_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_app_chat_participants_user ON app_chat_participants (user_id)`);
}

/**
 * @param {import('express').Application} app
 * @param {import('pg').Pool} pool
 * @param {() => string} getJwtSecret
 * @param {() => object} jwtOptions
 * @param {import('express-rate-limit').RateLimitRequestHandler} [dbReadLimiter]
 */
function mountChatRoutes(app, pool, getJwtSecret, jwtOptions, dbReadLimiter) {
    const limiter = dbReadLimiter || ((_req, _res, next) => next());
    const requireAuth = createAuthMiddleware(pool, getJwtSecret(), jwtOptions());
    const api = express.Router();
    api.use(requireAuth);

    async function ensureParticipant(roomId, userId) {
        const p = await pool.query(
            `SELECT 1 FROM app_chat_participants WHERE room_id = $1 AND user_id = $2`,
            [roomId, userId]
        );
        return p.rows.length > 0;
    }

    function rowToListItem(r, meId) {
        const participants = r.participants || [];
        const other = participants.find((p) => String(p.userId) !== String(meId)) || null;
        const me = participants.find((p) => String(p.userId) === String(meId)) || null;
        const lastTime = r.last_message_time ? new Date(r.last_message_time).getTime() : 0;
        return {
            id: r.id,
            tradeId: r.trade_id,
            isTradeChat: r.is_trade_chat,
            lastMessage: r.last_message,
            lastMessageTime: lastTime,
            lastMessageSender: r.last_message_sender_id,
            lastMessageTimeIso: r.last_message_time,
            createdAt: r.created_at,
            participants: (() => {
                const o = {};
                participants.forEach((p) => {
                    o[p.userId] = {
                        uid: p.userId,
                        displayName: p.displayName,
                        email: p.email,
                        online: p.online,
                        lastSeen: p.lastSeen
                    };
                });
                return o;
            })(),
            otherUser: other
                ? { uid: other.userId, displayName: other.displayName, email: other.email, online: other.online, lastSeen: other.lastSeen }
                : { displayName: 'Chat de intercambio' },
            unreadCount: me && me.hasUnread ? 1 : 0
        };
    }

    /** GET /api/chats */
    api.get('/chats', limiter, async (req, res) => {
        try {
            const me = req.user.id;
            const { rows } = await pool.query(
                `SELECT r.id, r.trade_id, r.metadata, r.is_trade_chat, r.last_message, r.last_message_time,
                        r.last_message_sender_id, r.created_at, r.updated_at
                   FROM app_chat_rooms r
                   JOIN app_chat_participants p ON p.room_id = r.id
                  WHERE p.user_id = $1 AND p.is_hidden = FALSE
                  ORDER BY r.last_message_time DESC NULLS LAST, r.updated_at DESC
                  LIMIT 200`,
                [me]
            );
            const out = [];
            for (const row of rows) {
                const { rows: pr } = await pool.query(
                    `SELECT user_id, display_name, email, is_online, last_seen, has_unread
                       FROM app_chat_participants WHERE room_id = $1`,
                    [row.id]
                );
                const participants = pr.map((p) => ({
                    userId: p.user_id,
                    displayName: p.display_name,
                    email: p.email,
                    online: p.is_online,
                    lastSeen: p.last_seen,
                    hasUnread: p.has_unread
                }));
                out.push(
                    rowToListItem(
                        {
                            id: row.id,
                            trade_id: row.trade_id,
                            metadata: row.metadata,
                            is_trade_chat: row.is_trade_chat,
                            last_message: row.last_message,
                            last_message_time: row.last_message_time,
                            last_message_sender_id: row.last_message_sender_id,
                            created_at: row.created_at,
                            participants
                        },
                        me
                    )
                );
            }
            res.json({ success: true, data: out });
        } catch (e) {
            console.error('chats list:', e.message);
            res.status(500).json({ success: false, error: 'Error al cargar chats' });
        }
    });

    /** GET /api/chats/hidden */
    api.get('/chats/hidden', limiter, async (req, res) => {
        try {
            const me = req.user.id;
            const { rows } = await pool.query(
                `SELECT r.id, r.trade_id, r.metadata, r.is_trade_chat, r.last_message, r.last_message_time,
                        r.last_message_sender_id, r.created_at, r.updated_at
                   FROM app_chat_rooms r
                   JOIN app_chat_participants p ON p.room_id = r.id
                  WHERE p.user_id = $1 AND p.is_hidden = TRUE
                  ORDER BY r.last_message_time DESC NULLS LAST, r.updated_at DESC
                  LIMIT 200`,
                [me]
            );
            const out = [];
            for (const row of rows) {
                const { rows: pr } = await pool.query(
                    `SELECT user_id, display_name, email, is_online, last_seen
                       FROM app_chat_participants WHERE room_id = $1`,
                    [row.id]
                );
                const participants = pr.map((p) => ({
                    userId: p.user_id,
                    displayName: p.display_name,
                    email: p.email,
                    online: p.is_online,
                    lastSeen: p.last_seen,
                    hasUnread: false
                }));
                out.push(
                    rowToListItem(
                        {
                            id: row.id,
                            trade_id: row.trade_id,
                            metadata: row.metadata,
                            is_trade_chat: row.is_trade_chat,
                            last_message: row.last_message,
                            last_message_time: row.last_message_time,
                            last_message_sender_id: row.last_message_sender_id,
                            created_at: row.created_at,
                            participants
                        },
                        me
                    )
                );
            }
            res.json({ success: true, data: out });
        } catch (e) {
            console.error('chats hidden:', e.message);
            res.status(500).json({ success: false, error: 'Error' });
        }
    });

    /**
     * POST /api/chats/initialize-trade
     * body: { tradeId, otherUserId, otherUserName? }
     */
    api.post('/chats/initialize-trade', async (req, res) => {
        const client = await pool.connect();
        try {
            const me = req.user.id;
            const { tradeId, otherUserId, otherUserName = 'Usuario' } = req.body || {};
            if (!tradeId) {
                return res.status(400).json({ success: false, error: 'tradeId requerido' });
            }
            const cleanTrade = String(tradeId).replace(/^trade_+/i, '');
            const roomId = `trade_${cleanTrade}`;

            await client.query('BEGIN');
            const r0 = await client.query(`SELECT * FROM app_chat_rooms WHERE id = $1`, [roomId]);
            if (r0.rows.length === 0) {
                await client.query(
                    `INSERT INTO app_chat_rooms (id, trade_id, is_trade_chat, metadata, updated_at)
                     VALUES ($1, $2, TRUE, $3::jsonb, NOW())`,
                    [roomId, cleanTrade, JSON.stringify({ isTradeChat: true })]
                );
            } else {
                await client.query(`UPDATE app_chat_rooms SET updated_at = NOW() WHERE id = $1`, [roomId]);
            }

            const uRow = await client.query(
                `SELECT id, display_name, email FROM app_users WHERE id = $1`,
                [me]
            );
            const u = uRow.rows[0];
            const myName = u.display_name || (u.email && u.email.split('@')[0]) || 'Usuario';

            await client.query(
                `INSERT INTO app_chat_participants (room_id, user_id, display_name, email, is_online, last_seen, updated_at)
                 VALUES ($1, $2, $3, $4, TRUE, NOW(), NOW())
                 ON CONFLICT (room_id, user_id) DO UPDATE SET
                   display_name = EXCLUDED.display_name,
                   email = EXCLUDED.email,
                   is_online = TRUE,
                   last_seen = NOW(),
                   is_hidden = FALSE,
                   updated_at = NOW()`,
                [roomId, me, myName, u.email || '']
            );

            if (otherUserId && String(otherUserId) !== String(me)) {
                const o = await client.query(
                    `SELECT id, display_name, email FROM app_users WHERE id = $1`,
                    [otherUserId]
                );
                if (o.rows.length) {
                    const ou = o.rows[0];
                    const oname = otherUserName || ou.display_name || (ou.email && ou.email.split('@')[0]) || 'Usuario';
                    await client.query(
                        `INSERT INTO app_chat_participants (room_id, user_id, display_name, email, is_online, last_seen, updated_at)
                         VALUES ($1, $2, $3, $4, FALSE, NULL, NOW())
                         ON CONFLICT (room_id, user_id) DO UPDATE SET
                           display_name = EXCLUDED.display_name,
                           email = EXCLUDED.email,
                           is_hidden = FALSE,
                           updated_at = NOW()`,
                        [roomId, otherUserId, oname, ou.email || '']
                    );
                }
            }

            await client.query('COMMIT');
            res.json({ success: true, chatId: roomId });
        } catch (e) {
            await client.query('ROLLBACK').catch(() => {});
            console.error('chat init trade:', e.message);
            res.status(500).json({ success: false, error: e.message || 'Error' });
        } finally {
            client.release();
        }
    });

    /** GET /api/chats/:roomId/messages?limit=50&since= */
    api.get('/chats/:roomId/messages', limiter, async (req, res) => {
        try {
            const { roomId } = req.params;
            const me = req.user.id;
            if (!(await ensureParticipant(roomId, me))) {
                return res.status(403).json({ success: false, error: 'No autorizado' });
            }
            const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50));
            const since = req.query.since;
            let q;
            let params;
            if (since) {
                q = `SELECT id, sender_id, sender_name, body, msg_type, delivered, read_at, data, created_at
                       FROM app_chat_messages
                      WHERE room_id = $1 AND created_at > $2::timestamptz
                      ORDER BY created_at ASC
                      LIMIT $3`;
                params = [roomId, since, limit];
            } else {
                q = `SELECT id, sender_id, sender_name, body, msg_type, delivered, read_at, data, created_at
                       FROM app_chat_messages
                      WHERE room_id = $1
                      ORDER BY created_at DESC
                      LIMIT $2`;
                params = [roomId, limit];
            }
            const { rows } = await pool.query(q, params);
            const list = (since ? rows : rows.slice().reverse()).map((m) => ({
                id: m.id,
                senderId: m.sender_id,
                senderName: m.sender_name,
                message: m.body,
                type: m.msg_type,
                timestamp: m.created_at && new Date(m.created_at).getTime(),
                delivered: m.delivered,
                read: !!m.read_at,
                data: m.data
            }));
            res.json({ success: true, data: list });
        } catch (e) {
            console.error('chat messages get:', e.message);
            res.status(500).json({ success: false, error: 'Error' });
        }
    });

    /** POST /api/chats/:roomId/messages */
    api.post('/chats/:roomId/messages', async (req, res) => {
        try {
            const { roomId } = req.params;
            const me = req.user.id;
            if (!(await ensureParticipant(roomId, me))) {
                return res.status(403).json({ success: false, error: 'No autorizado' });
            }
            const { message, type = 'text' } = req.body || {};
            const text = String(message == null ? '' : message);
            if (!text || text.length > MAX_MSG_LEN) {
                return res.status(400).json({ success: false, error: 'Mensaje inválido' });
            }
            const u = await pool.query(
                `SELECT display_name, email FROM app_users WHERE id = $1`,
                [me]
            );
            const senderName =
                (u.rows[0] && (u.rows[0].display_name || (u.rows[0].email && u.rows[0].email.split('@')[0]))) || 'Usuario';

            const { rows: ins } = await pool.query(
                `INSERT INTO app_chat_messages (room_id, sender_id, sender_name, body, msg_type, delivered, data)
                 VALUES ($1, $2, $3, $4, $5, TRUE, '{}'::jsonb)
                 RETURNING id, created_at`,
                [roomId, me, senderName, text, type]
            );

            await pool.query(
                `UPDATE app_chat_rooms SET last_message = $1, last_message_time = $2, last_message_sender_id = $3, updated_at = NOW()
                 WHERE id = $4`,
                [text.length > 200 ? text.substring(0, 200) + '…' : text, ins[0].created_at, me, roomId]
            );

            const { rows: others } = await pool.query(
                `SELECT user_id FROM app_chat_participants WHERE room_id = $1 AND user_id != $2`,
                [roomId, me]
            );
            for (const o of others) {
                await pool.query(
                    `UPDATE app_chat_participants SET has_unread = TRUE, updated_at = NOW()
                     WHERE room_id = $1 AND user_id = $2`,
                    [roomId, o.user_id]
                );
            }
            const msgId = ins[0].id;
            res.json({ success: true, id: msgId, createdAt: ins[0].created_at });
        } catch (e) {
            console.error('chat message post:', e.message);
            res.status(500).json({ success: false, error: 'Error al enviar' });
        }
    });

    /** POST /api/chats/:roomId/read */
    api.post('/chats/:roomId/read', async (req, res) => {
        const client = await pool.connect();
        try {
            const { roomId } = req.params;
            const me = req.user.id;
            if (!(await ensureParticipant(roomId, me))) {
                return res.status(403).json({ success: false, error: 'No autorizado' });
            }
            await client.query('BEGIN');
            await client.query(
                `UPDATE app_chat_messages
                    SET read_at = COALESCE(read_at, NOW())
                  WHERE room_id = $1 AND sender_id != $2 AND read_at IS NULL`,
                [roomId, me]
            );
            await client.query(
                `UPDATE app_chat_participants SET has_unread = FALSE, last_read_at = NOW(), updated_at = NOW()
                 WHERE room_id = $1 AND user_id = $2`,
                [roomId, me]
            );
            await client.query('COMMIT');
            res.json({ success: true });
        } catch (e) {
            await client.query('ROLLBACK').catch(() => {});
            console.error('chat read:', e.message);
            res.status(500).json({ success: false, error: 'Error' });
        } finally {
            client.release();
        }
    });

    /** POST /api/chats/:roomId/presence  body: { online: boolean } */
    api.post('/chats/:roomId/presence', async (req, res) => {
        try {
            const { roomId } = req.params;
            const me = req.user.id;
            if (!(await ensureParticipant(roomId, me))) {
                return res.status(403).json({ success: false, error: 'No autorizado' });
            }
            const online = !!req.body?.online;
            await pool.query(
                `UPDATE app_chat_participants
                    SET is_online = $1, last_seen = NOW(), updated_at = NOW()
                  WHERE room_id = $2 AND user_id = $3`,
                [online, roomId, me]
            );
            res.json({ success: true });
        } catch (e) {
            console.error('chat presence:', e.message);
            res.status(500).json({ success: false, error: 'Error' });
        }
    });

    /** GET /api/chats/:roomId/typing */
    api.get('/chats/:roomId/typing', limiter, async (req, res) => {
        try {
            const { roomId } = req.params;
            const me = req.user.id;
            if (!(await ensureParticipant(roomId, me))) {
                return res.status(403).json({ success: false, error: 'No autorizado' });
            }
            const { rows } = await pool.query(
                `SELECT user_id, data FROM app_chat_participants
                  WHERE room_id = $1 AND user_id != $2`,
                [roomId, me]
            );
            const now = Date.now() / 1000;
            const byUser = {};
            rows.forEach((r) => {
                const d = r.data && typeof r.data === 'object' ? r.data : {};
                const until = d.typingUntil ? new Date(d.typingUntil).getTime() / 1000 : 0;
                byUser[r.user_id] = until > now;
            });
            res.json({ success: true, typing: byUser });
        } catch (e) {
            console.error('chat typing get:', e.message);
            res.status(500).json({ success: false, error: 'Error' });
        }
    });

    /** POST /api/chats/:roomId/typing  body: { isTyping: boolean } */
    api.post('/chats/:roomId/typing', async (req, res) => {
        try {
            const { roomId } = req.params;
            const me = req.user.id;
            if (!(await ensureParticipant(roomId, me))) {
                return res.status(403).json({ success: false, error: 'No autorizado' });
            }
            const isTyping = !!req.body?.isTyping;
            const until = isTyping
                ? new Date(Date.now() + TYPING_TTL_SEC * 1000).toISOString()
                : null;
            await pool.query(
                `UPDATE app_chat_participants
                    SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{typingUntil}', to_jsonb($1::text), TRUE),
                        updated_at = NOW()
                  WHERE room_id = $2 AND user_id = $3`,
                [until, roomId, me]
            );
            res.json({ success: true });
        } catch (e) {
            console.error('chat typing post:', e.message);
            res.status(500).json({ success: false, error: 'Error' });
        }
    });

    /** DELETE /api/chats/:roomId — only for that user (soft hide) */
    api.delete('/chats/:roomId', async (req, res) => {
        try {
            const { roomId } = req.params;
            const me = req.user.id;
            const { rows: g } = await pool.query(
                `SELECT 1 FROM app_chat_participants WHERE room_id = $1 AND user_id = $2`,
                [roomId, me]
            );
            if (!g.length) {
                return res.status(404).json({ success: false, error: 'No encontrado' });
            }
            await pool.query(
                `UPDATE app_chat_participants SET is_hidden = TRUE, has_unread = FALSE, updated_at = NOW()
                 WHERE room_id = $1 AND user_id = $2`,
                [roomId, me]
            );
            res.json({ success: true });
        } catch (e) {
            console.error('chat hide:', e.message);
            res.status(500).json({ success: false, error: 'Error' });
        }
    });

    /** POST /api/chats/:roomId/unhide */
    api.post('/chats/:roomId/unhide', async (req, res) => {
        try {
            const { roomId } = req.params;
            const me = req.user.id;
            const { rows: g } = await pool.query(
                `SELECT 1 FROM app_chat_participants WHERE room_id = $1 AND user_id = $2`,
                [roomId, me]
            );
            if (!g.length) {
                return res.status(404).json({ success: false, error: 'No encontrado' });
            }
            await pool.query(
                `UPDATE app_chat_participants SET is_hidden = FALSE, updated_at = NOW()
                 WHERE room_id = $1 AND user_id = $2`,
                [roomId, me]
            );
            res.json({ success: true });
        } catch (e) {
            console.error('chat unhide:', e.message);
            res.status(500).json({ success: false, error: 'Error' });
        }
    });

    /** DELETE /api/chats/:roomId/admin — full delete (both participants' rows + messages) */
    api.delete('/chats/:roomId/admin', async (req, res) => {
        try {
            const { roomId } = req.params;
            const me = req.user.id;
            if (!(await ensureParticipant(roomId, me))) {
                return res.status(403).json({ success: false, error: 'No autorizado' });
            }
            await pool.query(`DELETE FROM app_chat_rooms WHERE id = $1`, [roomId]);
            res.json({ success: true });
        } catch (e) {
            console.error('chat admin delete:', e.message);
            res.status(500).json({ success: false, error: 'Error' });
        }
    });

    app.use('/api', api);
}

module.exports = { initChatTables, mountChatRoutes };
