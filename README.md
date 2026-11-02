# DROPZONE

DROPZONE is a Node.js + Express + PostgreSQL starter for a virtual CS2 community collection site. It intentionally excludes deposits, withdrawals, real-money mechanics, skin trading, and wagering-style upgrades/contracts/battles.

## Included
- Steam OpenID login via Passport Steam
- PostgreSQL persistence for users, virtual points, collection items, activity log, and sessions
- User profile and collection
- One-time deterministic starter collection reward
- Community leaderboard
- Separate `/admin` page with server-side access control, user ban/unban, virtual-points adjustment, display-name moderation, and audit log
- `/rules` and `/privacy` document templates
- Responsive dark/emerald UI
- `/health` health endpoint

## Run locally
1. Install Node.js 20+ and PostgreSQL.
2. Copy `.env.example` to `.env`.
3. Create a database and set `DATABASE_URL`.
4. Set `SESSION_SECRET` to a long random value.
5. Create a Steam Web API key and set `STEAM_API_KEY`.
6. Set `BASE_URL=http://localhost:3000`.
7. Set `ADMIN_STEAM_ID` to your SteamID64.
8. Run `npm install`, then `npm start`.
9. Visit `http://localhost:3000`.

Steam OpenID callback URL is `${BASE_URL}/auth/steam/return`. Configure your public Render URL as `BASE_URL` in production.

## Deploy on Render
1. Push this folder to a GitHub repository.
2. In Render, create a PostgreSQL database.
3. Create a Web Service from the repository.
4. Build command: `npm install`; start command: `npm start`.
5. Add environment variables:
   - `NODE_ENV=production`
   - `BASE_URL=https://YOUR-SERVICE.onrender.com`
   - `DATABASE_URL` = Render PostgreSQL Internal Database URL (if services are in the same region)
   - `SESSION_SECRET` = long random secret
   - `STEAM_API_KEY` = Steam Web API key
   - `ADMIN_STEAM_ID` = your SteamID64
6. After deployment, check `https://YOUR-SERVICE.onrender.com/health`.
7. Confirm Steam login callback works with the deployed `BASE_URL`.

## Important before public launch
- Keep `.env` out of GitHub. Never commit API keys or secrets.
- Replace `SESSION_SECRET` with a unique random secret.
- Verify database backups, dependency updates, rate limiting, CSRF protection, security headers, and error monitoring before opening the service publicly.
- Fill in the real operator/contact details and have the legal pages reviewed for your jurisdiction. The included rules and privacy policy are templates, not legal advice or a guarantee of GDPR compliance.
- The admin role is based on exact match with `ADMIN_STEAM_ID`. Set it carefully.
- Steam login uses OpenID; the site never asks for the Steam password.
- No real Steam inventory API/trading integration is included. The displayed collection is stored in this site's own database and is not a real Steam inventory.
