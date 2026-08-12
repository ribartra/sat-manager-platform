#!/usr/bin/env node
/**
 * Upload local public/uploads/questions into GCS under media/questions/.
 *
 * Env:
 *   GCS_BUCKET (required)
 *   GCS_API_ENDPOINT or STORAGE_EMULATOR_HOST — use JSON API REST (fake-gcs)
 *   GCS_PROJECT_ID
 *
 * Usage:
 *   GCS_BUCKET=sat-media-local GCS_API_ENDPOINT=http://localhost:4443 \
 *     node scripts/migrate-uploads-to-gcs.mjs [--dir=public/uploads/questions] [--dry-run]
 */
import { Storage } from "@google-cloud/storage";
import { readdir, readFile, stat } from "fs/promises";
import path from "path";

const PREFIX = "media/questions/";
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const dirArg = args.find((a) => a.startsWith("--dir="));
const sourceDir = path.resolve(dirArg ? dirArg.slice("--dir=".length) : "public/uploads/questions");

const bucketName = (process.env.GCS_BUCKET || "").trim();
if (!bucketName) {
  console.error("ERROR: set GCS_BUCKET");
  process.exit(1);
}

const apiEndpoint = (process.env.GCS_API_ENDPOINT || process.env.STORAGE_EMULATOR_HOST || "")
  .trim()
  .replace(/\/$/, "");
const projectId = process.env.GCS_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || "sat-local";

async function listFiles(dir) {
  const names = await readdir(dir);
  const out = [];
  for (const name of names) {
    if (name.startsWith(".")) continue;
    const full = path.join(dir, name);
    const st = await stat(full);
    if (st.isFile()) out.push({ name, full, size: st.size });
  }
  return out;
}

async function emulatorEnsureBucket() {
  const get = await fetch(`${apiEndpoint}/storage/v1/b/${encodeURIComponent(bucketName)}`);
  if (get.ok) return;
  const create = await fetch(`${apiEndpoint}/storage/v1/b?project=${encodeURIComponent(projectId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: bucketName }),
  });
  if (!create.ok && create.status !== 409) {
    throw new Error(`createBucket: ${create.status} ${await create.text()}`);
  }
  console.log(`Created bucket ${bucketName}`);
}

async function emulatorExists(key) {
  const res = await fetch(
    `${apiEndpoint}/storage/v1/b/${encodeURIComponent(bucketName)}/o/${encodeURIComponent(key)}`
  );
  return res.ok;
}

async function emulatorUpload(key, fullPath) {
  const data = await readFile(fullPath);
  const url =
    `${apiEndpoint}/upload/storage/v1/b/${encodeURIComponent(bucketName)}/o` +
    `?uploadType=media&name=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: data,
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
}

async function migrateViaEmulator(files) {
  await emulatorEnsureBucket();
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;
  for (const file of files) {
    const key = `${PREFIX}${file.name}`;
    if (await emulatorExists(key)) {
      skipped += 1;
      continue;
    }
    if (dryRun) {
      uploaded += 1;
      continue;
    }
    try {
      await emulatorUpload(key, file.full);
      uploaded += 1;
      if (uploaded % 50 === 0) console.log(`  … ${uploaded} uploaded`);
    } catch (err) {
      failed += 1;
      console.error(`  FAIL ${file.name}:`, err?.message || err);
    }
  }
  return { uploaded, skipped, failed };
}

async function migrateViaSdk(files) {
  const storage = new Storage({ projectId });
  const bucket = storage.bucket(bucketName);
  const [exists] = await bucket.exists();
  if (!exists) {
    console.log(`Creating bucket ${bucketName}...`);
    await storage.createBucket(bucketName);
  }
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;
  for (const file of files) {
    const key = `${PREFIX}${file.name}`;
    const gcsFile = bucket.file(key);
    const [already] = await gcsFile.exists();
    if (already) {
      skipped += 1;
      continue;
    }
    if (dryRun) {
      uploaded += 1;
      continue;
    }
    try {
      await bucket.upload(file.full, {
        destination: key,
        resumable: false,
        metadata: { cacheControl: "public, max-age=31536000, immutable" },
      });
      uploaded += 1;
      if (uploaded % 50 === 0) console.log(`  … ${uploaded} uploaded`);
    } catch (err) {
      failed += 1;
      console.error(`  FAIL ${file.name}:`, err?.message || err);
    }
  }
  return { uploaded, skipped, failed };
}

const files = await listFiles(sourceDir);
console.log(`Source: ${sourceDir}`);
console.log(`Bucket: ${bucketName} (prefix ${PREFIX})`);
console.log(`Files:  ${files.length}${dryRun ? " [dry-run]" : ""}`);
console.log(`Mode:   ${apiEndpoint ? `emulator REST @ ${apiEndpoint}` : "ADC / @google-cloud/storage"}`);

const result = apiEndpoint ? await migrateViaEmulator(files) : await migrateViaSdk(files);
console.log(
  `Done. uploaded=${result.uploaded} skipped_existing=${result.skipped} failed=${result.failed}`
);
if (result.failed) process.exit(1);
