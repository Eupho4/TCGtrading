# AGENTS.md

## Cursor Cloud specific instructions

### Architecture

TCGtrade is a single Node.js/Express application (`server-simple.js`) that serves both the REST API and static frontend files (HTML/JS/CSS). There is no separate build step for the frontend—it uses vanilla HTML + ES modules loaded from CDN (Firebase SDK).

### Required services

| Service | Purpose | How to start |
|---------|---------|--------------|
| PostgreSQL | Card catalog, Stripe accounts, payment records | `sudo service postgresql start` |
| Node.js server | API + static frontend (port 3000) | `npm start` (or `npm run dev`) |

### Running the app

```bash
sudo service postgresql start
npm start
# App available at http://localhost:3000
```

### Environment variables

Copy `.env.example` to `.env`. The only required variable for core functionality is `DATABASE_URL`. Stripe keys are optional (payment features degrade gracefully without them). Firebase Auth/Firestore are configured via CDN in the frontend (`js/modules/firebase-config.js`) and work without backend env vars.

For local development:
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tcgtrade
```

### Database setup (first time only)

PostgreSQL must be running. Create the `tcgtrade` database and run the server—it auto-creates payment tables on startup via `initializePaymentTables()`. The card catalog tables (series, sets, rarities, cards) must be created manually; see the schema in `server-hybrid.js` lines 458-517 or `create-tables.js`.

### Testing

There are no automated tests configured (`npm test` exits with error by default). Validation is done via:
- `curl http://localhost:3000/api/health` — health check
- `curl 'http://localhost:3000/api/pokemontcg/cards?q=pikachu'` — card search

### Linting

No linter is configured in this project (no ESLint/Prettier config files).

### Key gotchas

- The server creates payment tables (`user_stripe_accounts`, `trade_payments`) automatically on startup, but the core card catalog tables (series, sets, cards, rarities, types) must exist beforehand.
- Stripe features fail gracefully if `STRIPE_SECRET_KEY` is not set—the app still loads and card browsing works.
- The `local-api-server.js` (port 8080, SQLite-based) is an alternative offline mode—not used in production. The main entry point is always `server-simple.js`.
- `package.json` uses `"type": "commonjs"` — all server files use `require()`.
