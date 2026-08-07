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
// NOTE on GCS + CSP: next.config.ts sets `img-src 'self' data: blob:`. Objects
// served from a GCS URL are cross-origin and would be blocked. To serve uploads
// from GCS you must either add the bucket host to `img-src`, or proxy the bytes
// through the app (same-origin). See DEPLOY_GCP.md, "Fase 2".

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
    if (!url.startsWith("/")) return; // not a local-served object
    const abs = path.join(process.cwd(), "public", url.replace(/^\//, ""));
    if (existsSync(abs)) await unlink(abs);
  },
  async get(key) {
    const abs = path.join(process.cwd(), "public", key);
    if (!existsSync(abs)) return null;
    return readFile(abs);
  },
};

// Minimal structural type for the bits of @google-cloud/storage we use, so this
// file typechecks without the package installed (it is an optional dependency,
// only needed when STORAGE_DRIVER=gcs).
type GcsFile = {
  save: (data: Buffer, opts: { contentType: string; resumable: boolean }) => Promise<void>;
  delete: (opts?: { ignoreNotFound?: boolean }) => Promise<unknown>;
  download: () => Promise<[Buffer]>;
  exists: () => Promise<[boolean]>;
};
type GcsBucket = { file: (name: string) => GcsFile };

let bucketPromise: Promise<GcsBucket> | null = null;

async function gcsBucket(): Promise<GcsBucket> {
  if (!BUCKET) throw new Error("GCS_BUCKET is required when STORAGE_DRIVER=gcs");
  if (!bucketPromise) {
    bucketPromise = (async () => {
      // Casting the specifier to `string` keeps `tsc` from resolving the module
      // types, so typecheck passes even when the optional package is absent.
      // `webpackIgnore` stops `next build` (webpack) from statically resolving —
      // and failing on — this optional dependency; it stays a runtime import that
      // only runs when STORAGE_DRIVER=gcs (the VM deploy uses local-disk storage).
      const mod = (await import(/* webpackIgnore: true */ "@google-cloud/storage" as string)) as {
        Storage: new () => { bucket: (name: string) => GcsBucket };
      };
      return new mod.Storage().bucket(BUCKET);
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
    const bucket = await gcsBucket();
    await bucket.file(key).save(data, { contentType, resumable: false });
    return { url: GCS_PUBLIC_BASE ? `${GCS_PUBLIC_BASE}/${key}` : `/${key}` };
  },
  async delete(url) {
    const key = keyFromUrl(url);
    if (!key) return;
    const bucket = await gcsBucket();
    await bucket.file(key).delete({ ignoreNotFound: true }).catch(() => {});
  },
  async get(key) {
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
