import { writeFile, mkdir, unlink, readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

// Object storage abstraction with two drivers, selected by STORAGE_DRIVER:
//   - "local" (default): writes under <cwd>/public/<key>, served same-origin at /<key>.
//   - "gcs": stores the object in a Google Cloud Storage bucket.
//
// A "key" is a POSIX path WITHOUT a leading slash, rooted at the web "public"
// root, e.g. "uploads/avatars/abc.jpg".
//
// Question images additionally use helpers below that store under
// media/questions/ in the bucket while keeping public URLs /uploads/questions/…

export type StorageDriverName = "local" | "gcs";

const DRIVER: StorageDriverName = (process.env.STORAGE_DRIVER as StorageDriverName) || "local";
const BUCKET = process.env.GCS_BUCKET || "";
const GCS_PUBLIC_BASE = (process.env.GCS_PUBLIC_BASE_URL || "").replace(/\/$/, "");

export interface StoredObject {
  /** URL/path used to reference the object from the app. */
  url: string;
}

export interface ObjectStorage {
  put(key: string, data: Buffer, contentType: string): Promise<StoredObject>;
  delete(url: string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
}

const localStorage: ObjectStorage = {
  async put(key, data) {
    const abs = path.join(process.cwd(), "public", key);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, data);
    return { url: `/${key}` };
  },
  async delete(url) {
    if (!url.startsWith("/")) return;
    const abs = path.join(process.cwd(), "public", url.replace(/^\//, ""));
    if (existsSync(abs)) await unlink(abs);
  },
  async get(key) {
    const abs = path.join(process.cwd(), "public", key);
    if (!existsSync(abs)) return null;
    return readFile(abs);
  },
};

type GcsFile = {
  save: (data: Buffer, opts: { contentType: string; resumable: boolean }) => Promise<void>;
  delete: (opts?: { ignoreNotFound?: boolean }) => Promise<unknown>;
  download: () => Promise<[Buffer]>;
  exists: () => Promise<[boolean]>;
};
type GcsBucket = { file: (name: string) => GcsFile };

let bucketPromise: Promise<GcsBucket> | null = null;

function gcsApiEndpoint() {
  return (process.env.GCS_API_ENDPOINT || process.env.STORAGE_EMULATOR_HOST || "").trim().replace(/\/$/, "");
}

async function emulatorEnsureBucket(bucket: string) {
  const base = gcsApiEndpoint();
  if (!base) return;
  const project = process.env.GCS_PROJECT_ID || "sat-local";
  const get = await fetch(`${base}/storage/v1/b/${encodeURIComponent(bucket)}`);
  if (get.ok) return;
  const create = await fetch(`${base}/storage/v1/b?project=${encodeURIComponent(project)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: bucket }),
  });
  if (!create.ok && create.status !== 409) {
    throw new Error(`fake-gcs createBucket failed: ${create.status} ${await create.text()}`);
  }
}

async function emulatorPut(bucket: string, key: string, data: Buffer, contentType: string) {
  await emulatorEnsureBucket(bucket);
  const base = gcsApiEndpoint();
  const url =
    `${base}/upload/storage/v1/b/${encodeURIComponent(bucket)}/o` +
    `?uploadType=media&name=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": contentType },
    body: new Uint8Array(data),
  });
  if (!res.ok) throw new Error(`fake-gcs upload failed: ${res.status} ${await res.text()}`);
}

async function emulatorGet(bucket: string, key: string): Promise<Buffer | null> {
  const base = gcsApiEndpoint();
  const res = await fetch(
    `${base}/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(key)}?alt=media`
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`fake-gcs download failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function emulatorDelete(bucket: string, key: string) {
  const base = gcsApiEndpoint();
  await fetch(`${base}/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(key)}`, {
    method: "DELETE",
  }).catch(() => {});
}

async function emulatorExists(bucket: string, key: string) {
  const base = gcsApiEndpoint();
  const res = await fetch(
    `${base}/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(key)}`
  );
  return res.ok;
}

async function gcsBucket(): Promise<GcsBucket> {
  if (!BUCKET) throw new Error("GCS_BUCKET is required when STORAGE_DRIVER=gcs");
  if (!bucketPromise) {
    bucketPromise = (async () => {
      const mod = (await import(/* webpackIgnore: true */ "@google-cloud/storage" as string)) as {
        Storage: new (opts?: { projectId?: string }) => { bucket: (name: string) => GcsBucket };
      };
      return new mod.Storage({
        projectId: process.env.GCS_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || undefined,
      }).bucket(BUCKET);
    })();
  }
  return bucketPromise;
}

function keyFromUrl(url: string): string | null {
  if (GCS_PUBLIC_BASE && url.startsWith(`${GCS_PUBLIC_BASE}/`)) return url.slice(GCS_PUBLIC_BASE.length + 1);
  if (url.startsWith("/")) return url.replace(/^\//, "");
  return null;
}

const gcsStorage: ObjectStorage = {
  async put(key, data, contentType) {
    if (gcsApiEndpoint()) {
      await emulatorPut(BUCKET, key, data, contentType);
    } else {
      const bucket = await gcsBucket();
      await bucket.file(key).save(data, { contentType, resumable: false });
    }
    return { url: GCS_PUBLIC_BASE ? `${GCS_PUBLIC_BASE}/${key}` : `/${key}` };
  },
  async delete(url) {
    const key = keyFromUrl(url);
    if (!key) return;
    if (gcsApiEndpoint()) {
      await emulatorDelete(BUCKET, key);
      return;
    }
    const bucket = await gcsBucket();
    await bucket.file(key).delete({ ignoreNotFound: true }).catch(() => {});
  },
  async get(key) {
    if (gcsApiEndpoint()) return emulatorGet(BUCKET, key);
    const bucket = await gcsBucket();
    const file = bucket.file(key);
    const [exists] = await file.exists();
    if (!exists) return null;
    const [buf] = await file.download();
    return buf;
  },
};

export const objectStorage: ObjectStorage = DRIVER === "gcs" ? gcsStorage : localStorage;
export const storageDriver: StorageDriverName = DRIVER;

// ── Question media helpers (plan: media/questions/ + /uploads/questions/ URLs) ─

export const QUESTION_UPLOAD_URL_PREFIX = "/uploads/questions/";
export const QUESTION_OBJECT_PREFIX = "media/questions/";

const QUESTION_CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

export function isObjectStorageConfigured() {
  return Boolean(BUCKET.trim());
}

export function publicQuestionUrl(fileName: string) {
  return `${QUESTION_UPLOAD_URL_PREFIX}${path.basename(fileName)}`;
}

export function objectKeyForQuestionFile(fileName: string) {
  return `${QUESTION_OBJECT_PREFIX}${path.basename(fileName)}`;
}

function questionContentType(fileName: string) {
  return QUESTION_CONTENT_TYPES[path.extname(fileName).toLowerCase()] || "application/octet-stream";
}

function questionDiskPath(fileName: string) {
  return path.join(process.cwd(), "public", "uploads", "questions", path.basename(fileName));
}

/**
 * Write official question image to GCS (media/questions/) when GCS_BUCKET is set,
 * and dual-write to public/uploads/questions unless GCS_DUAL_WRITE_DISK=0.
 */
export async function putQuestionImage(fileName: string, data: Buffer) {
  const safe = path.basename(fileName);
  const skipDisk =
    isObjectStorageConfigured() &&
    (process.env.GCS_DUAL_WRITE_DISK === "0" || process.env.GCS_DUAL_WRITE_DISK === "false");
  const contentType = questionContentType(safe);
  const key = objectKeyForQuestionFile(safe);

  if (isObjectStorageConfigured()) {
    if (gcsApiEndpoint()) {
      await emulatorPut(BUCKET, key, data, contentType);
    } else {
      const bucket = await gcsBucket();
      await bucket.file(key).save(data, {
        contentType,
        resumable: false,
      });
    }
  }

  if (!skipDisk) {
    const abs = questionDiskPath(safe);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, data);
  }

  return publicQuestionUrl(safe);
}

export async function questionImageExists(fileName: string): Promise<boolean> {
  const safe = path.basename(fileName);
  const key = objectKeyForQuestionFile(safe);
  if (isObjectStorageConfigured()) {
    try {
      if (gcsApiEndpoint()) {
        if (await emulatorExists(BUCKET, key)) return true;
      } else {
        const bucket = await gcsBucket();
        const [exists] = await bucket.file(key).exists();
        if (exists) return true;
      }
    } catch {
      // fall through
    }
  }
  return existsSync(questionDiskPath(safe));
}

export type QuestionImageSource = {
  data: Buffer;
  contentType: string;
};

export async function openQuestionImage(fileName: string): Promise<QuestionImageSource | null> {
  const safe = path.basename(fileName);
  const contentType = questionContentType(safe);
  const key = objectKeyForQuestionFile(safe);

  if (isObjectStorageConfigured()) {
    try {
      let data: Buffer | null = null;
      if (gcsApiEndpoint()) {
        data = await emulatorGet(BUCKET, key);
      } else {
        const bucket = await gcsBucket();
        const file = bucket.file(key);
        const [exists] = await file.exists();
        if (exists) {
          const [buf] = await file.download();
          data = buf;
        }
      }
      if (data) return { data, contentType };
    } catch {
      // fall through
    }
  }

  const abs = questionDiskPath(safe);
  if (!existsSync(abs)) return null;
  return { data: await readFile(abs), contentType };
}

export async function uploadLocalQuestionFile(absolutePath: string, fileName?: string) {
  const safe = path.basename(fileName || absolutePath);
  const data = await readFile(absolutePath);
  if (!isObjectStorageConfigured()) throw new Error("GCS_BUCKET is not set");
  const key = objectKeyForQuestionFile(safe);
  const contentType = questionContentType(safe);
  if (gcsApiEndpoint()) {
    await emulatorPut(BUCKET, key, data, contentType);
  } else {
    const bucket = await gcsBucket();
    await bucket.file(key).save(data, { contentType, resumable: false });
  }
  return key;
}
