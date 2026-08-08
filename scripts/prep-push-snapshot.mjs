// Prepara un snapshot SANEADO de una BD SQLite local para empujar a producción.
//
// Lo usa deploy/push-db-to-cloud.sh, pero se puede correr solo. Produce una copia
// consolidada (incluye WAL) y, opcionalmente, la sanea para no arrastrar artefactos
// de desarrollo a producción:
//   • Purga AppSetting cifrados (no descifran con la SECRET_ENCRYPTION_KEY de prod).
//   • Inserta/actualiza un admin de prod con contraseña conocida (estable).
//   • Deshabilita cuentas dev con credenciales débiles.
//   • Rota contraseñas de cuentas dev que quieras conservar activas.
//
// Config por variables de entorno (todas opcionales salvo que se indique):
//   SRC                 BD origen (default ./dev.db)
//   OUT                 snapshot destino (default /tmp/push-cloud/dev.db)
//   PURGE_ENCRYPTED     "true"|"false" — purga AppSetting con key '%_ENCRYPTED' (default true)
//   PROD_ADMIN_EMAIL    si se da junto con PROD_ADMIN_PASSWORD, upsert de ese admin
//   PROD_ADMIN_PASSWORD contraseña del admin de prod
//   DISABLE_EMAILS      CSV de emails a deshabilitar (active=0)
//   ROTATE_EMAILS       CSV de emails cuya contraseña se rota (se imprime la nueva)
//
// Imprime un resumen y, al final, líneas `CREDENTIAL <email> <password>` para que
// el orquestador las capture. NUNCA envía correos ni toca la BD origen.
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import fs from "fs";

const SRC = process.env.SRC || "./dev.db";
const OUT = process.env.OUT || "/tmp/push-cloud/dev.db";
const PURGE_ENCRYPTED = (process.env.PURGE_ENCRYPTED ?? "true") !== "false";
const PROD_ADMIN_EMAIL = process.env.PROD_ADMIN_EMAIL?.trim().toLowerCase() || null;
const PROD_ADMIN_PASSWORD = process.env.PROD_ADMIN_PASSWORD || null;
const DISABLE_EMAILS = (process.env.DISABLE_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
const ROTATE_EMAILS = (process.env.ROTATE_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

if (!fs.existsSync(SRC)) {
  console.error(`SRC no existe: ${SRC}`);
  process.exit(1);
}

const nowIso = () => new Date().toISOString().replace("Z", "+00:00");
const cuid = () => "c" + crypto.randomBytes(12).toString("hex");
const genPw = () => crypto.randomBytes(15).toString("base64url");

fs.mkdirSync(OUT.replace(/\/[^/]+$/, ""), { recursive: true });

// 1) Copia consolidada (online backup: incluye lo que esté en el -wal).
const src = new Database(SRC, { readonly: true });
await src.backup(OUT);
src.close();

const db = new Database(OUT);
db.pragma("foreign_keys = OFF");

if (PURGE_ENCRYPTED) {
  const r = db.prepare("DELETE FROM AppSetting WHERE key LIKE '%\\_ENCRYPTED' ESCAPE '\\'").run();
  console.log(`AppSetting cifrados purgados: ${r.changes}`);
}

const creds = [];

if (PROD_ADMIN_EMAIL && PROD_ADMIN_PASSWORD) {
  const hash = bcrypt.hashSync(PROD_ADMIN_PASSWORD, 10);
  const existing = db.prepare("SELECT id FROM User WHERE email=?").get(PROD_ADMIN_EMAIL);
  if (existing) {
    db.prepare("UPDATE User SET passwordHash=?, role='ADMIN', active=1, validationStatus='APPROVED', updatedAt=? WHERE email=?")
      .run(hash, nowIso(), PROD_ADMIN_EMAIL);
    console.log(`admin prod actualizado: ${PROD_ADMIN_EMAIL}`);
  } else {
    db.prepare(`INSERT INTO User (id,name,email,passwordHash,role,active,validationStatus,validationReviewedAt,createdAt,updatedAt)
                VALUES (?,?,?,?,'ADMIN',1,'APPROVED',?,?,?)`)
      .run(cuid(), "Admin", PROD_ADMIN_EMAIL, hash, nowIso(), nowIso(), nowIso());
    console.log(`admin prod insertado: ${PROD_ADMIN_EMAIL}`);
  }
  creds.push([PROD_ADMIN_EMAIL, PROD_ADMIN_PASSWORD]);
} else if (PROD_ADMIN_EMAIL || PROD_ADMIN_PASSWORD) {
  console.error("Aviso: PROD_ADMIN_EMAIL y PROD_ADMIN_PASSWORD deben ir juntos; se omite el admin.");
}

for (const email of DISABLE_EMAILS) {
  const r = db.prepare("UPDATE User SET active=0 WHERE email=?").run(email);
  if (r.changes) console.log(`deshabilitado: ${email}`);
}

for (const email of ROTATE_EMAILS) {
  const found = db.prepare("SELECT id FROM User WHERE email=?").get(email);
  if (!found) continue;
  const pw = genPw();
  db.prepare("UPDATE User SET passwordHash=?, active=1, updatedAt=? WHERE email=?").run(bcrypt.hashSync(pw, 10), nowIso(), email);
  console.log(`rotado: ${email}`);
  creds.push([email, pw]);
}

db.pragma("wal_checkpoint(TRUNCATE)");
db.exec("VACUUM;");

const users = db.prepare("SELECT role,count(*) c FROM User GROUP BY role").all();
db.close();

const sizeMb = (fs.statSync(OUT).size / 1e6).toFixed(1);
console.log(`\n── snapshot saneado ──`);
console.log(`OUT: ${OUT} (${sizeMb} MB)`);
console.log(`Usuarios: ${JSON.stringify(users)}`);
// Líneas que captura el orquestador (fáciles de grep):
for (const [email, pw] of creds) console.log(`CREDENTIAL ${email} ${pw}`);
