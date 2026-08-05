import crypto from "crypto";

export function newPublicToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function hashPublicToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
