import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

// ==========================================
// 1. Directory & Environment Initialization
// ==========================================

let baseDataDir = process.cwd();
let appDir = process.cwd();

// Find the actual application directory where package.json/main files exist
const isMainDbPresent = fs.existsSync(path.join(appDir, "package.json"));
if (!isMainDbPresent) {
  let resolvedDir = "";
  try {
    resolvedDir = __dirname;
  } catch (e) {
    try {
      resolvedDir = path.dirname(fileURLToPath(import.meta.url));
    } catch (err) {
      // Fallback remains process.cwd()
    }
  }
  if (resolvedDir) {
    if (path.basename(resolvedDir) === "dist") {
      appDir = path.join(resolvedDir, "..");
    } else {
      appDir = resolvedDir;
    }
  }
}

const isElectron = process.env.IS_ELECTRON === "true";

if (isElectron) {
  try {
    const { app } = require("electron");
    baseDataDir = app.getPath("userData");
  } catch (e) {
    const homeDir = process.env.APPDATA || (process.platform === "darwin" ? path.join(process.env.HOME || "", "Library/Application Support") : path.join(process.env.HOME || "", ".girlstore"));
    baseDataDir = path.join(homeDir, "GirlStoreData");
  }
} else {
  baseDataDir = appDir;
}

if (!fs.existsSync(baseDataDir)) {
  fs.mkdirSync(baseDataDir, { recursive: true });
}

// Ensure database and backup directories exist
const dbDir = path.join(baseDataDir, "database");
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const backupsDir = path.join(baseDataDir, "backups");
if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir, { recursive: true });
}

const logsDir = path.join(baseDataDir, "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Load Environment Variables (.env) from the application directory
dotenv.config({ path: path.join(appDir, ".env") });
// Fallback: Also load from baseDataDir if different
if (appDir !== baseDataDir) {
  dotenv.config({ path: path.join(baseDataDir, ".env") });
}

// ==========================================
// 2. Configuration Definitions
// ==========================================

export const env = process.env.NODE_ENV || "development";
export const isProduction = env === "production";
export const isDevelopment = env === "development";

export const appConfig = {
  env,
  isProduction,
  isDevelopment,
  isElectron,
  port: Number(process.env.PORT) || 3000,
  appUrl: process.env.APP_URL || "http://localhost:3000",
  appDir,
  baseDataDir,
  uploadsDir: path.join(baseDataDir, "uploads"),
};

// Ensure uploads folder exists
if (!fs.existsSync(appConfig.uploadsDir)) {
  fs.mkdirSync(appConfig.uploadsDir, { recursive: true });
}

export const dbConfig = {
  dbFileName: "store.db",
  mainDbPath: path.join(baseDataDir, "database", "store.db"),
  backupPath: path.join(baseDataDir, "backups", "store.db.bak"),
  backupPath2: path.join(baseDataDir, "backups", "store.db.bak.2"),
  backupPath3: path.join(baseDataDir, "backups", "store.db.bak.3"),
  lockPath: path.join(baseDataDir, "database", "store.db.lock"),
  tempPath: path.join(baseDataDir, "database", "store.db.tmp"),
  usbDbFileName: "pijama_pos_store.db",
  usbSyncFileName: "pijama_sync.txt",
  usbUploadsFolderName: "pijama_pos_uploads",
  usbVolumes: {
    windowsDrivesRange: { start: 68, end: 90 }, // D to Z
    unixSearchDirs: ["/Volumes", "/media", "/media/user", "/mnt"],
  }
};

export const smtpConfig = {
  host: process.env.SMTP_HOST || "",
  port: Number(process.env.SMTP_PORT) || 587,
  user: process.env.SMTP_USER || "",
  pass: process.env.SMTP_PASS || "",
  from: process.env.SMTP_FROM || '"Girl Store" <no-reply@girlstore.com>',
};

export const securityConfig = {
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // max 500 requests per windowMs
  },
  bcryptSaltRounds: 10,
};

// ==========================================
// 3. Configuration Validation
// ==========================================

export function validateConfig(): void {
  const warnings: string[] = [];

  // Warn if essential keys are missing in production
  if (isProduction) {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      warnings.push("SMTP configurations (SMTP_HOST, SMTP_USER, SMTP_PASS) are not fully provided in .env. Daily reports will fallback to simulated console logs.");
    }
  }

  // Log configuration summary and warnings to standard output on initialization
  console.log(`[ConfigSystem] Environment: ${env.toUpperCase()} | Port: ${appConfig.port}`);
  if (warnings.length > 0) {
    warnings.forEach((warning) => {
      console.warn(`[ConfigSystem] [WARNING] ${warning}`);
    });
  }
}

// Automatically validate config upon loading
validateConfig();

// Default bundle export
const config = {
  app: appConfig,
  db: dbConfig,
  smtp: smtpConfig,
  security: securityConfig,
  validate: validateConfig,
};

export default config;
