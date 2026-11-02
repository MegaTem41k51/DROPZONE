require("dotenv").config();
const express = require("express");
const session = require("express-session");
const passport = require("passport");
const SteamStrategy = require("passport-steam").Strategy;
const { Pool } = require("pg");
const PgSession = require("connect-pg-simple")(session);
const path = require("path");

const app = express();
const port = process.env.PORT || 3000;
const baseUrl = (process.env.BASE_URL || `http://localhost:${port}`).replace(/\/$/, "");
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
});

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use(session({
  store: new PgSession({ pool, tableName: "user_sessions", createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET || "dev-only-change-me",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 24 * 14
  }
}));
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user.steam_id));
passport.deserializeUser(async (steamId, done) => {
  try {
    const result = await pool.query("SELECT * FROM users WHERE steam_id = $1", [steamId]);
    done(null, result.rows[0] || false);
  } catch (err) { done(err); }
});

passport.use(new SteamStrategy({
  returnURL: `${baseUrl}/auth/steam/return`,
  realm: `${baseUrl}/`,
  apiKey: process.env.STEAM_API_KEY
}, async (identifier, profile, done) => {
  try {
    const steamId = profile.id;
    const displayName = profile.displayName || "Steam user";
    const avatar = profile.photos?.[2]?.value || profile.photos?.[0]?.value || "";
    const result = await pool.query(`
      INSERT INTO users (steam_id, display_name, avatar_url)
      VALUES ($1, $2, $3)
      ON CONFLICT (steam_id) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        avatar_url = EXCLUDED.avatar_url,
        updated_at = NOW()
      RETURNING *
    `, [steamId, displayName, avatar]);
    done(null, result.rows[0]);
  } catch (err) { done(err); }
}));

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      steam_id VARCHAR(32) UNIQUE NOT NULL,
      display_name TEXT NOT NULL DEFAULT 'Steam user',
      avatar_url TEXT NOT NULL DEFAULT '',
      virtual_points INTEGER NOT NULL DEFAULT 1000 CHECK (virtual_points >= 0),
      is_banned BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS collection_items (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      item_key TEXT NOT NULL,
      item_name TEXT NOT NULL,
      rarity TEXT NOT NULL DEFAULT 'consumer',
      image_url TEXT NOT NULL DEFAULT '',
      obtained_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS activity_log (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      details TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

app.use(async (req, res, next) => {
  res.locals.currentUser = req.user || null;
  res.locals.isAdmin = !!req.user && !!process.env.ADMIN_STEAM_ID &&
    req.user.steam_id === process.env.ADMIN_STEAM_ID;
  res.locals.currentPath = req.path;
  next();
});

function requireLogin(req, res, next) {
  if (!req.isAuthenticated?.() || !req.user) return res.redirect("/?login=required");
  if (req.user.is_banned) return res.status(403).render("message", {
    title: "Доступ ограничен", message: "Доступ к этому аккаунту ограничен. Если это ошибка, обратитесь к администрации."
  });
  next();
}
function requireAdmin(req, res, next) {
  if (!req.user || !process.env.ADMIN_STEAM_ID || req.user.steam_id !== process.env.ADMIN_STEAM_ID) {
    return res.status(404).render("message", { title: "Страница не найдена", message: "Запрошенная страница не найдена." });
  }
  next();
}
async function logAction(userId, action, details = "") {
  await pool.query("INSERT INTO activity_log(user_id, action, details) VALUES($1,$2,$3)", [userId || null, action, details]);
}

app.get("/health", (req, res) => res.json({ ok: true, app: "DROPZONE" }));
app.get("/", async (req, res) => {
  const featured = [
    { name: "AK-47 | Изумрудный вихрь", rarity: "Тайное", tone: "emerald", image: "https://community.cloudflare.steamstatic.com/economy/image/placeholder" },
    { name: "AWP | Неоновая сетка", rarity: "Засекреченное", tone: "violet", image: "" },
    { name: "★ Перчатки | Тёмный импульс", rarity: "Особое", tone: "gold", image: "" },
    { name: "M4A1-S | Ночной поток", rarity: "Запрещённое", tone: "blue", image: "" }
  ];
  let stats = { users: 0, items: 0 };
  try {
    const [u, i] = await Promise.all([
      pool.query("SELECT COUNT(*)::int AS count FROM users"),
      pool.query("SELECT COUNT(*)::int AS count FROM collection_items")
    ]);
    stats = { users: u.rows[0].count, items: i.rows[0].count };
  } catch (_) {}
  res.render("home", { title: "DROPZONE — коллекционируй по-своему", featured, stats });
});
app.get("/auth/steam", passport.authenticate("steam", { failureRedirect: "/?auth=failed" }));
app.get("/auth/steam/return", passport.authenticate("steam", { failureRedirect: "/?auth=failed" }), async (req, res) => {
  await logAction(req.user.id, "steam_login", "Успешный вход через Steam");
  res.redirect("/profile");
});
app.post("/logout", (req, res, next) => {
  req.logout(err => {
    if (err) return next(err);
    req.session.destroy(() => res.redirect("/"));
  });
});

app.get("/profile", requireLogin, async (req, res) => {
  const [items, logs] = await Promise.all([
    pool.query("SELECT * FROM collection_items WHERE user_id = $1 ORDER BY obtained_at DESC LIMIT 30", [req.user.id]),
    pool.query("SELECT action, details, created_at FROM activity_log WHERE user_id = $1 ORDER BY created_at DESC LIMIT 8", [req.user.id])
  ]);
  res.render("profile", { title: "Профиль — DROPZONE", items: items.rows, logs: logs.rows });
});
app.get("/collection", requireLogin, async (req, res) => {
  const result = await pool.query("SELECT * FROM collection_items WHERE user_id = $1 ORDER BY obtained_at DESC", [req.user.id]);
  res.render("collection", { title: "Моя коллекция — DROPZONE", items: result.rows });
});
app.get("/leaderboard", async (req, res) => {
  const result = await pool.query(`
    SELECT u.display_name, u.avatar_url, u.virtual_points, COUNT(c.id)::int AS items_count
    FROM users u LEFT JOIN collection_items c ON c.user_id = u.id
    WHERE u.is_banned = FALSE
    GROUP BY u.id ORDER BY items_count DESC, u.virtual_points DESC LIMIT 50
  `);
  res.render("leaderboard", { title: "Рейтинг — DROPZONE", users: result.rows });
});

/* Deterministic, non-monetary starter collection: one claim per account.
   No paid packs, random rewards, item trading, cashout, or wager mechanics. */
app.post("/claim-starter", requireLogin, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const exists = await client.query("SELECT id FROM collection_items WHERE user_id = $1 AND item_key = 'starter_badge' LIMIT 1", [req.user.id]);
    if (!exists.rowCount) {
      await client.query(
        "INSERT INTO collection_items(user_id,item_key,item_name,rarity,image_url) VALUES($1,$2,$3,$4,$5)",
        [req.user.id, "starter_badge", "DROPZONE — Стартовый жетон", "Базовый", ""]
      );
      await client.query("UPDATE users SET virtual_points = virtual_points + 250 WHERE id = $1", [req.user.id]);
      await client.query("INSERT INTO activity_log(user_id,action,details) VALUES($1,$2,$3)", [req.user.id, "starter_claim", "Получен стартовый жетон и 250 виртуальных очков"]);
    }
    await client.query("COMMIT");
    res.redirect("/profile?starter=claimed");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(e);
    res.status(500).render("message", { title: "Ошибка", message: "Не удалось получить стартовый набор. Попробуйте позже." });
  } finally { client.release(); }
});

app.get("/admin", requireLogin, requireAdmin, async (req, res) => {
  const [users, logs, counts] = await Promise.all([
    pool.query("SELECT id, steam_id, display_name, avatar_url, virtual_points, is_banned, created_at FROM users ORDER BY created_at DESC LIMIT 100"),
    pool.query("SELECT a.action,a.details,a.created_at,u.display_name,u.steam_id FROM activity_log a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC LIMIT 40"),
    pool.query("SELECT COUNT(*)::int AS users, (SELECT COUNT(*)::int FROM collection_items) AS items FROM users")
  ]);
  res.render("admin", { title: "Админ-панель — DROPZONE", users: users.rows, logs: logs.rows, counts: counts.rows[0] });
});
app.post("/admin/user/:id/points", requireLogin, requireAdmin, async (req, res) => {
  const points = Number.parseInt(req.body.points, 10);
  if (!Number.isInteger(points) || points < 0 || points > 1000000) return res.redirect("/admin?error=points");
  const result = await pool.query("UPDATE users SET virtual_points=$1 WHERE id=$2 RETURNING id", [points, req.params.id]);
  if (result.rowCount) await logAction(result.rows[0].id, "admin_points_update", `Виртуальные очки установлены: ${points}`);
  res.redirect("/admin");
});
app.post("/admin/user/:id/ban", requireLogin, requireAdmin, async (req, res) => {
  const result = await pool.query("UPDATE users SET is_banned = NOT is_banned WHERE id=$1 RETURNING id,is_banned", [req.params.id]);
  if (result.rowCount) await logAction(result.rows[0].id, result.rows[0].is_banned ? "user_banned" : "user_unbanned", "Изменено администратором");
  res.redirect("/admin");
});
app.post("/admin/user/:id/rename", requireLogin, requireAdmin, async (req, res) => {
  const name = String(req.body.display_name || "").trim().slice(0, 40);
  if (name) await pool.query("UPDATE users SET display_name=$1 WHERE id=$2", [name, req.params.id]);
  res.redirect("/admin");
});

app.get("/rules", (req, res) => res.render("legal", { title: "Правила использования — DROPZONE", page: "rules" }));
app.get("/privacy", (req, res) => res.render("legal", { title: "Политика конфиденциальности — DROPZONE", page: "privacy" }));
app.get("/terms", (req, res) => res.redirect("/rules"));
app.use((req, res) => res.status(404).render("message", { title: "404 — не найдено", message: "Такой страницы нет. Вернитесь на главную DROPZONE." }));

initDb().then(() => {
  app.listen(port, () => console.log(`DROPZONE listening on ${port}`));
}).catch(err => {
  console.error("Database initialization failed:", err);
  process.exit(1);
});
