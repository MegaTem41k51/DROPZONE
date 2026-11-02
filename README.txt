DROPZONE — CS2 case simulator

LOCAL DEMO (no server):
1. Unzip the archive.
2. Open index.html in Chrome/Edge/Firefox.
3. The demo balance, case opening, inventory, upgrade and contracts work locally.
   Steam sign-in requires the optional backend below.

STEAM OPENID BACKEND:
1. Install Node.js 20+.
2. In this folder run: npm install
3. Copy .env.example to .env.
4. Set BASE_URL to your own HTTPS domain, SESSION_SECRET to a long random value,
   and STEAM_API_KEY to a key kept ONLY on the server. Set ADMIN_PASSWORD to a long unique password for the hidden /admin panel.
5. Run: npm start
6. Configure your domain/reverse proxy to forward to the Node app.

The Steam button redirects to your own /auth/steam endpoint. Steam OpenID handles
authentication; the site never asks for or receives a Steam password or Steam Guard code.
Do not use another site's OpenID return_to URL. The callback must be your own domain.
For production, add HTTPS, secure session storage, CSRF protection, rate limiting,
database persistence and legal review. Admin settings are written to site-settings.json; Render filesystems are ephemeral unless a Persistent Disk is attached.

FEATURES:
- 30 cases priced 25–50,000 ₽ with 30 individually generated case illustrations.
- CS2-themed item cards and optional public item-image metadata enrichment from ByMykel CSGO-API.
- 1–5 simultaneous case openings with separate animated roulette rows; drops are saved before animation finishes so refresh does not lose the results.
- Local browser persistence for demo balance and inventory across F5.
- Hidden /admin dashboard protected by ADMIN_PASSWORD; edit maintenance notice and announcement.
- Upgrade screen with source item and target skin selection, x1.5/x2/x3/manual multiplier controls, and animated center wheel.
- Contracts for 3–10 items, inventory and demo-balance sale.
- Age gate, Steam profile area, trade URL field, privacy policy and terms.

IMPORTANT:
All balance, item prices, odds, rewards, sales, upgrades and contracts are virtual demo data.
No real money, Steam items or withdrawals are supported. No Steam trade is performed.
The skin catalog is a curated sample; optional public metadata enrichment supplies item
names/images when reachable. It does not provide a live verified market valuation.
The generated case illustrations are original concept art, not Valve assets.
DROPZONE is not affiliated with Valve, Counter-Strike 2 or Steam.
\nCS2 item metadata source: ByMykel CSGO-API public dataset (MIT-licensed project; see https://github.com/ByMykel/CSGO-API). The frontend optionally requests its English all.json file at runtime.\n