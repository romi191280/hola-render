const $ = id => document.getElementById(id);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
let adminKey = "", rows = [], pendingDelete = null;

function say(el, text, kind) { el.textContent = text; el.className = kind || ""; }

$("form").addEventListener("submit", async e => {
  e.preventDefault();
  const body = { nombre: $("nombre").value.trim(), apellido: $("apellido").value.trim(), email: $("email").value.trim() };
  if (!body.nombre || !body.apellido || !body.email) return say($("msg"), "Completa nombre, apellido y correo.", "error");
  if (!EMAIL_RE.test(body.email)) return say($("msg"), "El correo no parece válido. Revisa que tenga la forma nombre@dominio.com.", "error");
  $("submit").disabled = true;
  try {
    const r = await fetch("/api/personas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await r.json();
    if (!r.ok) return say($("msg"), data.error, "error");
    $("form").reset();
    say($("msg"), "Registrado: " + body.nombre + " " + body.apellido + ".", "ok");
    if (adminKey) load();
  } catch { say($("msg"), "No hay conexión con el servidor. Inténtalo de nuevo.", "error"); }
  finally { $("submit").disabled = false; }
});

$("login").addEventListener("submit", e => { e.preventDefault(); adminKey = $("key").value; load(); });

async function api(path, opts = {}) {
  const r = await fetch(path, { ...opts, headers: { "x-admin-key": adminKey } });
  if (r.status === 401) { adminKey = ""; $("list").hidden = true; $("count").textContent = ""; throw new Error("Clave de administración incorrecta."); }
  if (!r.ok) throw new Error("El servidor no respondió bien. Inténtalo de nuevo.");
  return r.json();
}

async function load() {
  try { rows = await api("/api/personas"); say($("adminMsg"), ""); render(); }
  catch (err) { say($("adminMsg"), err.message, "error"); }
}

function render() {
  const list = $("list");
  list.hidden = false;
  $("count").textContent = rows.length + (rows.length === 1 ? " persona" : " personas");
  list.replaceChildren();
  if (!rows.length) {
    const li = document.createElement("li");
    li.className = "empty"; li.style.display = "block";
    li.textContent = "Aún no hay nadie registrado.";
    return list.append(li);
  }
  for (const p of rows) {
    const li = document.createElement("li");
    const who = document.createElement("div"); who.className = "who";
    const name = document.createElement("div"); name.className = "name"; name.textContent = p.nombre + " " + p.apellido;
    const email = document.createElement("div"); email.className = "email"; email.textContent = p.email;
    const date = document.createElement("div"); date.className = "date";
    date.textContent = new Date(p.creado).toLocaleString("es", { dateStyle: "medium", timeStyle: "short" });
    who.append(name, email, date);
    const del = document.createElement("button");
    del.type = "button"; del.className = "del" + (pendingDelete === p.id ? " confirm" : "");
    del.textContent = pendingDelete === p.id ? "¿Confirmar?" : "Eliminar";
    del.addEventListener("click", () => onDelete(p.id));
    li.append(who, del);
    list.append(li);
  }
}

async function onDelete(id) {
  if (pendingDelete !== id) { pendingDelete = id; return render(); }
  pendingDelete = null;
  try { await api("/api/personas/" + id, { method: "DELETE" }); await load(); }
  catch (err) { say($("adminMsg"), err.message, "error"); }
}
