import express from "express";
import session from "express-session";
import passport from "passport";
import SteamStrategy from "passport-steam";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();
const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
if (!process.env.SESSION_SECRET || !process.env.STEAM_API_KEY || !process.env.BASE_URL) {
  console.warn("Set BASE_URL, SESSION_SECRET and STEAM_API_KEY in .env before enabling Steam sign-in.");
}
app.set("trust proxy", 1);
app.use(session({
  secret: process.env.SESSION_SECRET || "development-only-change-this",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 7 * 24 * 60 * 60 * 1000 }
}));
app.use(express.json({ limit: "100kb" }));
app.use(passport.initialize());
app.use(passport.session());
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

passport.use(new SteamStrategy({
  returnURL: `${BASE_URL}/auth/steam/return`,
  realm: `${BASE_URL}/`,
  apiKey: process.env.STEAM_API_KEY
}, (identifier, profile, done) => {
  // Steam OpenID authenticates the Steam account; no Steam password is ever handled here.
  done(null, {
    steamid: profile.id,
    personaname: profile.displayName || "Steam user",
    avatar: profile.photos?.[2]?.value || profile.photos?.[1]?.value || profile.photos?.[0]?.value || "",
    avatarfull: profile.photos?.[2]?.value || profile.photos?.[1]?.value || "",
    profileurl: profile._json?.profileurl || `https://steamcommunity.com/profiles/${profile.id}`
  });
}));


const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const settingsPath = path.join(__dirname, "site-settings.json");
function readSettings(){try{return JSON.parse(fs.readFileSync(settingsPath,"utf8"))}catch{return {maintenance:false,announcement:""}}}
function writeSettings(value){fs.writeFileSync(settingsPath,JSON.stringify(value,null,2),"utf8")}
function requireAdmin(req,res,next){if(req.session?.isDropzoneAdmin)return next();return res.status(401).json({error:"admin_auth_required"})}
app.get("/admin", (_req,res) => res.sendFile(path.join(__dirname,"admin.html")));
app.post("/api/admin/login", (req,res)=>{
  if(!ADMIN_PASSWORD)return res.status(503).json({error:"Set ADMIN_PASSWORD in Render environment variables first."});
  const supplied=String(req.body?.password||"");
  const a=Buffer.from(supplied),b=Buffer.from(ADMIN_PASSWORD);
  if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return res.status(401).json({error:"Неверный пароль"});
  req.session.isDropzoneAdmin=true;return res.json({ok:true});
});
app.post("/api/admin/logout",(req,res)=>{req.session.isDropzoneAdmin=false;res.status(204).end()});
app.get("/api/admin/status",requireAdmin,(_req,res)=>res.json({ok:true,uptime:Math.floor(process.uptime()),node:process.version,settings:readSettings(),adminPasswordConfigured:Boolean(ADMIN_PASSWORD)}));
app.post("/api/admin/settings",requireAdmin,(req,res)=>{
  const settings={maintenance:Boolean(req.body?.maintenance),announcement:String(req.body?.announcement||"").slice(0,240)};
  try{writeSettings(settings);res.json({ok:true,settings})}catch(e){res.status(500).json({error:"Не удалось сохранить настройки на сервере"})}
});
app.get("/api/site-settings",(_req,res)=>res.json(readSettings()));

app.get("/auth/steam", passport.authenticate("steam", { failureRedirect: "/?steam=failed" }));
app.get("/auth/steam/return", passport.authenticate("steam", { failureRedirect: "/?steam=failed" }), (req, res) => res.redirect("/"));
app.get("/api/me", (req, res) => req.user ? res.json({ user: req.user }) : res.status(401).json({ error: "not_authenticated" }));
app.post("/auth/logout", (req, res) => req.logout(() => req.session.destroy(() => res.status(204).end())));
app.use(express.static(__dirname));
app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "index.html")));

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`DROPZONE running at ${BASE_URL}`));
