import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createHash, randomUUID } from "node:crypto";
import { copyFile, cp, mkdir, mkdtemp, readFile, readdir, rm, unlink, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { DatabaseSync, backup } from "node:sqlite";

const digest = bytes => createHash("sha256").update(bytes).digest("hex");

export async function fileHash(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

export async function mediaManifest(directory, allowMissing = false) {
  const result = [];
  async function walk(relative) {
    const entries = await readdir(path.join(directory, relative), { withFileTypes: true })
      .catch(error => {
        if (allowMissing && !relative && error.code === "ENOENT") return [];
        throw error;
      });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const name = path.join(relative, entry.name);
      const file = path.join(directory, name);
      if (entry.isDirectory()) await walk(name);
      else if (entry.isFile()) result.push([name, await fileHash(file)]);
      else throw new Error("Unsupported entry in media backup");
    }
  }
  await walk("");
  return result;
}

function databaseManifest(database) {
  assert.deepEqual(database.prepare("PRAGMA integrity_check").all().map(row => row.integrity_check), ["ok"]);
  assert.equal(database.prepare("PRAGMA foreign_key_check").all().length, 0);
  const bookings = database.prepare("SELECT id, customerToken, photos FROM Booking ORDER BY id").all();
  const attachments = database.prepare("SELECT id, bookingId, image FROM Attachment ORDER BY id").all();
  const content = database.prepare("SELECT id, image, accentImage FROM ContentItem ORDER BY id").all();
  const migrations = database.prepare('SELECT migration_name, checksum FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name').all();
  assert.ok(migrations.length);
  return {
    bookings: bookings.length,
    attachments: attachments.length,
    migrations: migrations.length,
    fingerprint: digest(JSON.stringify([bookings, attachments.map(({ image, ...row }) => [row, digest(image)]), content, migrations])),
  };
}

async function verifyRestore(directory, expected) {
  assert.equal(await fileHash(path.join(directory, "snapshot.db")), expected.databaseHash);
  assert.ok(JSON.stringify(await mediaManifest(path.join(directory, "uploads"))) === JSON.stringify(expected.media));
  const db = new DatabaseSync(path.join(directory, "snapshot.db"), { readOnly: true });
  try {
    assert.deepEqual(databaseManifest(db), expected.database);
  } finally {
    db.close();
  }
}

export async function smoke(directory) {
  const { default: sharp } = await import("sharp");
  const { default: bcrypt } = await import("bcrypt");
  const image = await sharp({ create: { width: 12, height: 12, channels: 3, background: "orange" } }).jpeg().toBuffer();
  const id = randomUUID(), token = randomUUID(), attachment = randomUUID(), password = randomUUID();
  const databasePath = path.join(directory, "snapshot.db");
  const uploads = path.join(directory, "uploads");
  const legacy = `recovery-legacy-${id}.jpg`;
  const published = `recovery-cms-${id}.jpg`;
  await mkdir(path.join(uploads, "published"), { recursive: true });
  await writeFile(path.join(uploads, legacy), image, { flag: "wx" });
  await writeFile(path.join(uploads, "published", published), image, { flag: "wx" });
  const db = new DatabaseSync(databasePath);
  try {
    db.prepare('INSERT INTO Admin (id, username, password) VALUES (?, ?, ?)').run(id, id, await bcrypt.hash(password, 10));
    db.prepare('INSERT INTO Booking (id, name, phone, email, address, repairType, customerToken, photos, adminNotes, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)')
      .run(id, "Synthetic recovery", "5145550110", "restore@example.invalid", "Synthetic address", "Door repair", token,
        JSON.stringify([`attachment:${attachment}`, `/uploads/${legacy}`, "/uploads/recovery-missing.jpg"]), "synthetic-internal");
    db.prepare("INSERT INTO Attachment (id, bookingId, image) VALUES (?, ?, ?)").run(attachment, id, image);
  } finally {
    db.close();
  }

  const listener = createServer();
  listener.listen(0, "127.0.0.1");
  await once(listener, "listening");
  const { port } = listener.address();
  await new Promise(resolve => listener.close(resolve));
  const child = spawn(process.execPath, ["dist/index.js"], {
    env: { PATH: process.env.PATH, NODE_ENV: "production", HOST: "127.0.0.1", PORT: String(port),
      DATABASE_URL: "file:" + databasePath.replaceAll("\\", "/"), UPLOAD_DIR: uploads,
      CREATE_DEFAULT_ADMIN: "false", SESSION_SECRET: randomUUID() + randomUUID() },
    stdio: "ignore",
  });
  const finished = new Promise(resolve => {
    child.once("exit", resolve);
    child.once("error", resolve);
  });
  const request = (route, options) => fetch(`http://127.0.0.1:${port}${route}`, {
    ...options, signal: AbortSignal.timeout(3000),
    headers: { "x-forwarded-proto": "https", ...options?.headers },
  });
  try {
    let healthy = false;
    for (let attempt = 0; attempt < 90 && child.exitCode === null; attempt++) {
      const response = await request("/api/health").catch(() => null);
      if (response?.ok && (await response.json()).checks?.database === "connected") {
        healthy = true;
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    assert.ok(healthy, "Restored app failed readiness");
    const tracking = await request(`/api/bookings/track/${token}`);
    assert.equal(tracking.status, 200);
    assert.ok(!(await tracking.text()).includes("synthetic-internal"));
    const photo = index => `/api/admin/bookings/${id}/photos/${index}`;
    assert.equal((await request(photo(0))).status, 401);
    assert.equal((await request(`/uploads/${legacy}`)).status, 404);
    const login = await request("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: id, password }) });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie")?.split(";")[0];
    assert.ok(cookie);
    const privatePhoto = await request(photo(0), { headers: { cookie } });
    assert.equal(privatePhoto.status, 200);
    assert.equal(digest(Buffer.from(await privatePhoto.arrayBuffer())), digest(image));
    assert.equal((await request(photo(1), { headers: { cookie } })).status, 200);
    assert.equal((await request(photo(2), { headers: { cookie } })).status, 404);
    const publicPhoto = await request(`/uploads/${published}`);
    assert.equal(publicPhoto.status, 200);
    assert.equal(digest(Buffer.from(await publicPhoto.arrayBuffer())), digest(image));
  } finally {
    child.kill("SIGKILL");
    await finished;
  }
}

export async function rehearse(sourcePath, mediaPath, { runApp = true } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "fmd-recovery-"));
  const archive = path.join(root, "archive");
  const restore = path.join(root, "restore");
  let source;
  try {
    source = new DatabaseSync(sourcePath, { readOnly: true });
    const media = await mediaManifest(mediaPath, true);
    await mkdir(path.join(archive, "uploads"), { recursive: true });
    const snapshot = path.join(archive, "snapshot.db");
    source.exec("BEGIN");
    const database = databaseManifest(source);
    await backup(source, snapshot);
    source.exec("ROLLBACK");
    if (media.length) await cp(mediaPath, path.join(archive, "uploads"), { recursive: true });
    assert.ok(JSON.stringify(await mediaManifest(mediaPath, true)) === JSON.stringify(media),
      "Source media changed during backup");
    const manifest = { database, databaseHash: await fileHash(snapshot), media };
    await writeFile(path.join(archive, "manifest.json"), JSON.stringify(manifest), { mode: 0o600 });
    await cp(archive, restore, { recursive: true });
    const expected = JSON.parse(await readFile(path.join(restore, "manifest.json"), "utf8"));
    await verifyRestore(restore, expected);
    const restoredDb = path.join(restore, "snapshot.db");
    await writeFile(restoredDb, "corrupt recovery fixture");
    await assert.rejects(verifyRestore(restore, expected));
    await unlink(restoredDb);
    await assert.rejects(verifyRestore(restore, expected), { code: "ENOENT" });
    await copyFile(snapshot, restoredDb);
    if (media.length) {
      const relative = media[0][0];
      await unlink(path.join(restore, "uploads", relative));
      await assert.rejects(verifyRestore(restore, expected), { code: "ERR_ASSERTION" });
      await copyFile(path.join(archive, "uploads", relative), path.join(restore, "uploads", relative));
    }
    await verifyRestore(restore, expected);
    if (runApp) await smoke(restore);
    return { bookings: database.bookings, attachments: database.attachments, migrations: database.migrations,
      mediaFiles: media.length, integrity: "ok", foreignKeys: "ok", corruptAndIncompleteRejected: true, appSmoke: runApp };
  } finally {
    source?.close();
    await rm(root, { recursive: true, force: true });
  }
}

export function isStagingRecoveryTarget(env) {
  return env.STAGING_MODE === "true" &&
    env.RAILWAY_PROJECT_ID === "66faefcb-b523-47b4-b91c-b96126953e39" &&
    env.RAILWAY_ENVIRONMENT_ID === "78c4b506-61e1-4792-937c-c4ca7133d3a4" &&
    env.RAILWAY_SERVICE_ID === "76e8013f-fb71-4aad-8e3b-4c852a3e07c3" &&
    env.DATABASE_URL === "file:/data/fixmydoor.db" &&
    env.UPLOAD_DIR === "/data/uploads";
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!isStagingRecoveryTarget(process.env)) throw new Error("Recovery target is outside approved staging");
  try {
    console.log("STAGING_RECOVERY_PASS", JSON.stringify(await rehearse("/data/fixmydoor.db", "/data/uploads")));
  } catch (error) {
    console.error("STAGING_RECOVERY_FAIL", error.code ?? error.name);
    process.exitCode = 1;
  }
}
