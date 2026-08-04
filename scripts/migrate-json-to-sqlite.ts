/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Script de migration autonome : JSON → SQLite
 * 
 * Usage : npx tsx scripts/migrate-json-to-sqlite.ts
 * 
 * Ce script lit l'ancien fichier db.json et migre toutes les données
 * vers la base SQLite store.db, avec backup automatique de l'ancien fichier.
 */

import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

// ==========================================
// Configuration des chemins
// ==========================================

const BASE_DATA_DIR = process.cwd();
const DB_DIR = path.join(BASE_DATA_DIR, "database");
const BACKUPS_DIR = path.join(BASE_DATA_DIR, "backups");

const LEGACY_JSON_PATH = path.join(BASE_DATA_DIR, "db.json");
const SQLITE_DB_PATH = path.join(DB_DIR, "store.db");
const BACKUP_JSON_PATH = path.join(BASE_DATA_DIR, "db.backup.json");

// ==========================================
// Schéma SQLite
// ==========================================

const SCHEMA_PRODUCTS = `
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    arabicName TEXT,
    category TEXT,
    barcode TEXT,
    price REAL NOT NULL,
    image TEXT,
    variants TEXT NOT NULL,
    imagePath TEXT,
    purchasePrice REAL,
    sellingPrice REAL,
    status TEXT
  );
`;

const SCHEMA_SALES = `
  CREATE TABLE IF NOT EXISTS sales (
    id TEXT PRIMARY KEY,
    receiptNo TEXT NOT NULL,
    dateTime TEXT NOT NULL,
    userId TEXT,
    staffName TEXT,
    items TEXT NOT NULL,
    subtotal REAL NOT NULL,
    discountType TEXT,
    discountValue REAL,
    discountAmount REAL,
    taxRate REAL,
    taxAmount REAL,
    total REAL NOT NULL,
    paymentMethod TEXT,
    amountPaid REAL,
    change REAL
  );
`;

const SCHEMA_EXPENSES = `
  CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    amount REAL NOT NULL,
    category TEXT,
    date TEXT NOT NULL
  );
`;

const SCHEMA_USERS = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL,
    name TEXT NOT NULL
  );
`;

const SCHEMA_PASSWORD_HASHES = `
  CREATE TABLE IF NOT EXISTS password_hashes (
    username TEXT PRIMARY KEY,
    passwordHash TEXT NOT NULL
  );
`;

const SCHEMA_SETTINGS = `
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`;

const INDEX_PRODUCTS_BARCODE = `CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);`;
const INDEX_SALES_DATETIME = `CREATE INDEX IF NOT EXISTS idx_sales_dateTime ON sales(dateTime);`;
const INDEX_EXPENSES_DATE = `CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);`;

// ==========================================
// Interfaces TypeScript (copie de types/index.ts)
// ==========================================

interface ProductVariant {
  sku: string;
  size: string;
  color: string;
  stock: number;
}

interface Product {
  id: string;
  name: string;
  arabicName: string;
  category: string;
  barcode: string;
  price: number;
  image: string;
  variants: ProductVariant[];
  imagePath?: string;
  purchasePrice?: number;
  sellingPrice?: number;
  status?: "In Stock" | "Out of Stock";
}

interface SaleItem {
  productId: string;
  productName: string;
  sku: string;
  size: string;
  color: string;
  price: number;
  purchasePrice?: number;
  quantity: number;
  total: number;
}

interface Sale {
  id: string;
  receiptNo: string;
  dateTime: string;
  userId: string;
  staffName: string;
  items: SaleItem[];
  subtotal: number;
  discountType: "percent" | "fixed";
  discountValue: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  paymentMethod: "Cash" | "Card";
  amountPaid: number;
  change: number;
}

interface Expense {
  id: string;
  title: string;
  amount: number;
  category: string;
  date: string;
}

interface User {
  id: string;
  username: string;
  role: "Admin" | "Staff";
  name: string;
}

interface SmtpSettings {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

interface AppDatabase {
  products: Product[];
  sales: Sale[];
  expenses: Expense[];
  users: User[];
  passwordHashes: { [username: string]: string };
  lastUpdated?: string;
  reportEmail?: string;
  smtpSettings?: SmtpSettings;
}

// ==========================================
// Fonctions utilitaires
// ==========================================

function log(message: string, type: "info" | "success" | "error" | "warn" = "info"): void {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: "ℹ️",
    success: "✅",
    error: "❌",
    warn: "⚠️"
  }[type];
  
  console.log(`${prefix} [${timestamp}] ${message}`);
}

function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    log(`Created directory: ${dirPath}`);
  }
}

// ==========================================
// Validation et réparation du schéma
// ==========================================

const DEFAULT_USERS: User[] = [
  { id: "admin", username: "admin", role: "Admin", name: "Administrator" }
];

function validateAndRepair(db: unknown): AppDatabase {
  if (!db || typeof db !== "object") {
    return {
      products: [],
      sales: [],
      expenses: [],
      users: DEFAULT_USERS,
      passwordHashes: { admin: "" },
      lastUpdated: new Date().toISOString()
    };
  }
  
  const d = db as Record<string, unknown>;
  const repaired: AppDatabase = {
    products: Array.isArray(d.products) ? (d.products as any[]) : [],
    sales: Array.isArray(d.sales) ? (d.sales as any[]) : [],
    expenses: Array.isArray(d.expenses) ? (d.expenses as any[]) : [],
    users: Array.isArray(d.users) ? (d.users as any[]) : DEFAULT_USERS,
    passwordHashes: (d.passwordHashes && typeof d.passwordHashes === "object") 
      ? (d.passwordHashes as Record<string, string>) 
      : { admin: "" },
    lastUpdated: typeof d.lastUpdated === "string" ? d.lastUpdated : new Date().toISOString()
  };

  if (repaired.users.length === 0) {
    repaired.users = DEFAULT_USERS;
  }

  if (d.reportEmail !== undefined) {
    (repaired as any).reportEmail = String(d.reportEmail);
  }
  if (d.smtpSettings !== undefined && typeof d.smtpSettings === "object" && d.smtpSettings !== null) {
    (repaired as any).smtpSettings = d.smtpSettings as any;
  }

  return repaired;
}

// ==========================================
// Migration principale
// ==========================================

function migrateJsonToSqlite(): void {
  log("=== DÉBUT DE LA MIGRATION JSON → SQLite ===", "info");
  
  // 1. Vérifier que le fichier JSON existe
  if (!fs.existsSync(LEGACY_JSON_PATH)) {
    log(`Fichier legacy non trouvé: ${LEGACY_JSON_PATH}`, "error");
    log("La migration n'est pas nécessaire si vous utilisez déjà SQLite.", "warn");
    return;
  }
  
  log(`Fichier JSON trouvé: ${LEGACY_JSON_PATH}`, "info");
  
  // 2. Lire et parser le JSON
  let jsonData: AppDatabase;
  try {
    const content = fs.readFileSync(LEGACY_JSON_PATH, "utf-8");
    jsonData = JSON.parse(content) as AppDatabase;
    log(`JSON parsé avec succès (${jsonData.products?.length || 0} produits, ${jsonData.sales?.length || 0} ventes)`, "success");
  } catch (err: any) {
    log(`Erreur lors de la lecture du JSON: ${err.message}`, "error");
    throw err;
  }
  
  // 3. Valider et réparer les données
  const validatedDb = validateAndRepair(jsonData);
  log("Données validées et réparées si nécessaire", "success");
  
  // 4. Créer les répertoires nécessaires
  ensureDirectoryExists(DB_DIR);
  ensureDirectoryExists(BACKUPS_DIR);
  
  // 5. Backup de l'ancien fichier JSON
  log(`Backup de ${LEGACY_JSON_PATH} vers ${BACKUP_JSON_PATH}`, "info");
  fs.copyFileSync(LEGACY_JSON_PATH, BACKUP_JSON_PATH);
  log("Backup JSON créé avec succès", "success");
  
  // 6. Initialiser la base SQLite
  log(`Initialisation de la base SQLite: ${SQLITE_DB_PATH}`, "info");
  const db = new Database(SQLITE_DB_PATH);
  
  try {
    // Activer WAL mode pour meilleures performances
    db.pragma("journal_mode = WAL");
    log("WAL mode activé", "info");
    
    // Exécuter le schéma
    log("Création des tables...", "info");
    db.exec(SCHEMA_PRODUCTS);
    db.exec(SCHEMA_SALES);
    db.exec(SCHEMA_EXPENSES);
    db.exec(SCHEMA_USERS);
    db.exec(SCHEMA_PASSWORD_HASHES);
    db.exec(SCHEMA_SETTINGS);
    
    // Créer les index
    log("Création des index...", "info");
    db.exec(INDEX_PRODUCTS_BARCODE);
    db.exec(INDEX_SALES_DATETIME);
    db.exec(INDEX_EXPENSES_DATE);
    
    // 7. Insérer les données dans une transaction
    log("Insertion des données en cours...", "info");
    
    const insertProduct = db.prepare(`
      INSERT OR REPLACE INTO products (id, name, arabicName, category, barcode, price, image, variants, imagePath, purchasePrice, sellingPrice, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const insertSale = db.prepare(`
      INSERT OR REPLACE INTO sales (id, receiptNo, dateTime, userId, staffName, items, subtotal, discountType, discountValue, discountAmount, taxRate, taxAmount, total, paymentMethod, amountPaid, change)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const insertExpense = db.prepare(`
      INSERT OR REPLACE INTO expenses (id, title, amount, category, date)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    const insertUser = db.prepare(`
      INSERT OR REPLACE INTO users (id, username, role, name)
      VALUES (?, ?, ?, ?)
    `);
    
    const insertPass = db.prepare(`
      INSERT OR REPLACE INTO password_hashes (username, passwordHash)
      VALUES (?, ?)
    `);
    
    const insertSetting = db.prepare(`
      INSERT OR REPLACE INTO settings (key, value)
      VALUES (?, ?)
    `);
    
    // Transaction atomique pour toutes les insertions
    const migrateTransaction = db.transaction(() => {
      // Produits
      for (const p of validatedDb.products) {
        insertProduct.run(
          p.id,
          p.name,
          p.arabicName || null,
          p.category || null,
          p.barcode || null,
          p.price,
          p.image || null,
          JSON.stringify(p.variants || []),
          p.imagePath || null,
          p.purchasePrice !== undefined ? p.purchasePrice : null,
          p.sellingPrice !== undefined ? p.sellingPrice : null,
          p.status || null
        );
      }
      
      // Ventes
      for (const s of validatedDb.sales) {
        insertSale.run(
          s.id,
          s.receiptNo,
          s.dateTime,
          s.userId || null,
          s.staffName || null,
          JSON.stringify(s.items || []),
          s.subtotal,
          s.discountType || null,
          s.discountValue !== undefined ? s.discountValue : null,
          s.discountAmount !== undefined ? s.discountAmount : null,
          s.taxRate !== undefined ? s.taxRate : null,
          s.taxAmount !== undefined ? s.taxAmount : null,
          s.total,
          s.paymentMethod || null,
          s.amountPaid !== undefined ? s.amountPaid : null,
          s.change !== undefined ? s.change : null
        );
      }
      
      // Dépenses
      for (const e of validatedDb.expenses) {
        insertExpense.run(
          e.id,
          e.title,
          e.amount,
          e.category || null,
          e.date
        );
      }
      
      // Utilisateurs
      for (const u of validatedDb.users) {
        insertUser.run(u.id, u.username, u.role, u.name);
      }
      
      // Password hashes
      if (validatedDb.passwordHashes) {
        for (const [uname, hash] of Object.entries(validatedDb.passwordHashes)) {
          insertPass.run(uname, hash || "");
        }
      }
      
      // Settings
      if ((validatedDb as any).reportEmail) {
        insertSetting.run("reportEmail", (validatedDb as any).reportEmail);
      }
      if ((validatedDb as any).smtpSettings) {
        insertSetting.run("smtpSettings", JSON.stringify((validatedDb as any).smtpSettings));
      }
      insertSetting.run("lastUpdated", validatedDb.lastUpdated || new Date().toISOString());
    });
    
    // Exécuter la transaction
    migrateTransaction();
    log("Données insérées avec succès", "success");
    
    // 8. Vérification
    const productCount = (db.prepare("SELECT COUNT(*) as count FROM products").get() as any).count;
    const saleCount = (db.prepare("SELECT COUNT(*) as count FROM sales").get() as any).count;
    const expenseCount = (db.prepare("SELECT COUNT(*) as count FROM expenses").get() as any).count;
    const userCount = (db.prepare("SELECT COUNT(*) as count FROM users").get() as any).count;
    
    log("=== RÉSULTATS DE LA MIGRATION ===", "success");
    log(`Produits migrés: ${productCount}`, "success");
    log(`Ventes migrées: ${saleCount}`, "success");
    log(`Dépenses migrées: ${expenseCount}`, "success");
    log(`Utilisateurs migrés: ${userCount}`, "success");
    
    // 9. Renommer l'ancien fichier JSON
    log(`Renommage de ${LEGACY_JSON_PATH} vers ${BACKUP_JSON_PATH}`, "info");
    // Déjà fait plus tôt avec copyFileSync, maintenant on peut supprimer l'original si désiré
    // fs.unlinkSync(LEGACY_JSON_PATH);
    
  } catch (err: any) {
    log(`Erreur pendant la migration: ${err.message}`, "error");
    db.close();
    throw err;
  } finally {
    db.close();
    log("Connexion SQLite fermée", "info");
  }
  
  log("=== MIGRATION TERMINÉE AVEC SUCCÈS ===", "success");
  log(`Base SQLite prête: ${SQLITE_DB_PATH}`, "success");
  log(`Backup JSON conservé: ${BACKUP_JSON_PATH}`, "info");
}

// ==========================================
// Point d'entrée principal
// ==========================================

try {
  migrateJsonToSqlite();
  process.exit(0);
} catch (err: any) {
  console.error("Migration échouée:", err);
  process.exit(1);
}
