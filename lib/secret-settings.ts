import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

export const MISTRAL_API_KEY_SETTING = "MISTRAL_API_KEY_ENCRYPTED";

type EncryptedSecretPayload = {
  v: 1;
  alg: "AES-256-GCM";
  iv: string;
  ciphertext: string;
  tag: string;
  sha256: string;
  last4: string;
  updatedAt: string;
};

function encryptionSecret() {
  const secret = process.env.SECRET_ENCRYPTION_KEY || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SECRET_ENCRYPTION_KEY or AUTH_SECRET is required in production.");
  }
  return "sat-platform-dev-secret-change-in-production";
}

function encryptionKey() {
  return createHash("sha256").update(encryptionSecret()).digest();
}

export function sha256Fingerprint(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function encryptSecret(value: string): string {
  const clean = value.trim();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(clean, "utf8"), cipher.final()]);
  const payload: EncryptedSecretPayload = {
    v: 1,
    alg: "AES-256-GCM",
    iv: iv.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    sha256: sha256Fingerprint(clean),
    last4: clean.slice(-4),
    updatedAt: new Date().toISOString(),
  };
  return JSON.stringify(payload);
}

export function decryptSecret(stored: string | null | undefined): string | null {
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored) as Partial<EncryptedSecretPayload>;
    if (!parsed.iv || !parsed.ciphertext || !parsed.tag) return null;
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(parsed.iv, "base64"));
    decipher.setAuthTag(Buffer.from(parsed.tag, "base64"));
    const plain = Buffer.concat([decipher.update(Buffer.from(parsed.ciphertext, "base64")), decipher.final()]);
    return plain.toString("utf8");
  } catch {
    return null;
  }
}

export function secretSummary(value: string | null | undefined) {
  if (!value) return { configured: false, sha256: null, last4: null, updatedAt: null };
  try {
    const parsed = JSON.parse(value) as Partial<EncryptedSecretPayload>;
    return {
      configured: Boolean(parsed.ciphertext && parsed.sha256),
      sha256: parsed.sha256 ?? null,
      last4: parsed.last4 ?? null,
      updatedAt: parsed.updatedAt ?? null,
    };
  } catch {
    return { configured: false, sha256: null, last4: null, updatedAt: null };
  }
}
