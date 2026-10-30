const express = require("express");
const crypto = require("crypto");
const { Pool } = require("pg");

const { DATABASE_URL, ADMIN_KEY, PORT = 3000 } = process.env;
if (!DATABASE_URL) throw new Error("Falta la variable DATABASE_URL");
if (!ADMIN_KEY) throw new Error("Falta la variable ADMIN_KEY");

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false },
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const app = express();
app.use(express.json({ limit: "10kb" }));
app.use(express.static(__dirname + "/public"));

// Compara la clave en tiempo constante
function isAdmin(req) {
  const given = Buffer.from(req.get("x-admin-key") || "");
  const real = Buffer.from(ADMIN_KEY);
  return given.length === real.length && crypto.timingSafeEqual(given, real);
}
function requireAdmin(req, res, next) {
  if (!isAdmin(req)) return res.status(401).json({ error: "Clave de administración incorrecta." });
  next();
}

app.post("/api/personas", async (req, res) => {
  const nombre = String(req.body.nombre || "").trim().slice(0, 80);
  const apellido = String(req.body.apellido || "").trim().slice(0, 80);
  const email = String(req.body.email || "").trim().toLowerCase().slice(0, 160);
  if (!nombre || !apellido || !email) return res.status(400).json({ error: "Completa nombre, apellido y correo." });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "El correo no parece válido." });
  try {
    await pool.query("INSERT INTO personas (nombre, apellido, email) VALUES ($1, $2, $3)", [nombre, apellido, email]);
    res.status(201).json({ ok: true });
  } catch (e) {
    if (e.code === "23505") return res.status(409).json({ error: "Ese correo ya está registrado." });
    console.error(e);
    res.status(500).json({ error: "No se pudo guardar. Inténtalo de nuevo." });
  }
});

app.get("/api/personas", requireAdmin, async (_req, res) => {
  const { rows } = await pool.query("SELECT id, nombre, apellido, email, creado FROM personas ORDER BY creado DESC");
  res.json(rows);
});

app.delete("/api/personas/:id", requireAdmin, async (req, res) => {
  await pool.query("DELETE FROM personas WHERE id = $1", [Number(req.params.id) || 0]);
  res.json({ ok: true });
});

pool.query(`CREATE TABLE IF NOT EXISTS personas (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  apellido TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  creado TIMESTAMPTZ NOT NULL DEFAULT now()
)`).then(() => {
  app.listen(PORT, () => console.log("Escuchando en el puerto " + PORT));
});
