import crypto from "crypto";
import bcrypt from "bcryptjs";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "girl-store-secret-key-123456789"; // 32 characters or derived
const ALGORITHM = "aes-256-cbc";

/**
 * Checks if a string is a bcrypt hash.
 */
export function isBcryptHash(hash: string): boolean {
  return typeof hash === "string" && (hash.startsWith("$2a$") || hash.startsWith("$2b$") || hash.startsWith("$2y$"));
}

/**
 * Hashes a password using bcrypt (with 10 salt rounds).
 */
export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

/**
 * Compares a password against a hash, supporting legacy SHA-256 for backward compatibility.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  if (isBcryptHash(storedHash)) {
    return bcrypt.compareSync(password, storedHash);
  }
  
  // Fallback to legacy SHA-256 for backward compatibility
  const legacyHash = crypto.createHash("sha256").update(password).digest("hex");
  return legacyHash === storedHash;
}

/**
 * Encrypts sensitive text using AES-256-CBC.
 */
export function encryptText(text: string): string {
  if (!text) return "";
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(ENCRYPTION_KEY, "salt", 32);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return `${iv.toString("hex")}:${encrypted}`;
}

/**
 * Decrypts sensitive text using AES-256-CBC.
 */
export function decryptText(encryptedText: string): string {
  if (!encryptedText) return "";
  try {
    const parts = encryptedText.split(":");
    if (parts.length !== 2) return encryptedText; // If not encrypted, return as is
    const iv = Buffer.from(parts[0], "hex");
    const encrypted = parts[1];
    const key = crypto.scryptSync(ENCRYPTION_KEY, "salt", 32);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (e) {
    // Return original if decryption fails (e.g. it was saved as cleartext before)
    return encryptedText;
  }
}
