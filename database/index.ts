import fs from "fs";
import path from "path";
import { BASE_DATA_DIR } from "../config/app";
import { dbConfig } from "../config/index";
import { Product, Sale, Expense, User, AppDatabase, SmtpSettings } from "../types";
import { DatabaseService } from "./DatabaseService";

const DEFAULT_USERS: User[] = [
  { id: "admin", username: "admin", role: "Admin", name: "Administrator" }
];

const DEFAULT_DB: AppDatabase = {
  products: [],
  sales: [],
  expenses: [],
  users: DEFAULT_USERS,
  passwordHashes: {
    admin: "" // Forces Admin setup flow
  },
  lastUpdated: "1970-01-01T00:00:00.000Z"
};

const DB_FILE = dbConfig.mainDbPath;

export function initDbFile(baseDataDir: string = BASE_DATA_DIR) {
  DatabaseService.init(baseDataDir);
}

let lastUsbCheckTime = 0;
let cachedUsbPath: string | null = null;

// Scans for a connected USB drive containing 'pijama_sync.txt' or 'pijama_pos_db.json'
export function getUsbDbPath(force = false): string | null {
  const now = Date.now();
  if (!force && now - lastUsbCheckTime < 15000 && cachedUsbPath !== null && cachedUsbPath !== undefined) {
    return cachedUsbPath;
  }

  try {
    let usbPath: string | null = null;
    if (process.platform === "win32") {
      const startCode = dbConfig.usbVolumes.windowsDrivesRange.start;
      const endCode = dbConfig.usbVolumes.windowsDrivesRange.end;
      for (let charCode = startCode; charCode <= endCode; charCode++) {
        const drive = String.fromCharCode(charCode) + ":\\";
        try {
          const syncFile = path.join(drive, dbConfig.usbSyncFileName);
          const dbFile = path.join(drive, dbConfig.usbDbFileName);

          if (fs.existsSync(syncFile)) {
            usbPath = dbFile;
            break;
          }
          if (fs.existsSync(dbFile)) {
            usbPath = dbFile;
            break;
          }

          if (drive === "D:\\" && fs.existsSync(drive)) {
            try {
              fs.writeFileSync(syncFile, "GIRL STORE USB AUTO-SYNC INITIALIZED", "utf-8");
              console.log(`[USB Sync] Auto-created ${dbConfig.usbSyncFileName} on D:\\ to enable plug-and-play backups.`);
              usbPath = dbFile;
              break;
            } catch (writeErr) {
              // Ignore if drive is write-protected or read-only
            }
          }
        } catch (e) {
          // Skip unreadable or unmounted drives
        }
      }
    } else {
      const searchDirs = dbConfig.usbVolumes.unixSearchDirs;
      for (const baseDir of searchDirs) {
        if (fs.existsSync(baseDir)) {
          try {
            const subdirs = fs.readdirSync(baseDir);
            for (const subdir of subdirs) {
              const fullSubdir = path.join(baseDir, subdir);
              try {
                if (fs.existsSync(path.join(fullSubdir, dbConfig.usbSyncFileName))) {
                  usbPath = path.join(fullSubdir, dbConfig.usbDbFileName);
                  break;
                }
                if (fs.existsSync(path.join(fullSubdir, dbConfig.usbDbFileName))) {
                  usbPath = path.join(fullSubdir, dbConfig.usbDbFileName);
                  break;
                }
              } catch (e) {
                // Skip unreadable directories
              }
            }
            if (usbPath) break;
          } catch (e) {
            // Ignore error
          }
        }
      }
    }
    
    cachedUsbPath = usbPath;
    lastUsbCheckTime = now;
    return usbPath;
  } catch (err) {
    console.error("Error scanning for USB drives:", err);
    return null;
  }
}

function syncUploads(localDir: string, usbDir: string) {
  try {
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    if (!fs.existsSync(usbDir)) {
      fs.mkdirSync(usbDir, { recursive: true });
    }

    // Copy local to USB
    const localFiles = fs.readdirSync(localDir);
    for (const file of localFiles) {
      const localFilePath = path.join(localDir, file);
      const usbFilePath = path.join(usbDir, file);
      if (fs.statSync(localFilePath).isFile() && !fs.existsSync(usbFilePath)) {
        fs.copyFileSync(localFilePath, usbFilePath);
        console.log(`[USB Sync] Copied file to USB: ${file}`);
      }
    }

    // Copy USB to local
    const usbFiles = fs.readdirSync(usbDir);
    for (const file of usbFiles) {
      const localFilePath = path.join(localDir, file);
      const usbFilePath = path.join(usbDir, file);
      if (fs.statSync(usbFilePath).isFile() && !fs.existsSync(localFilePath)) {
        fs.copyFileSync(usbFilePath, localFilePath);
        console.log(`[USB Sync] Copied file from USB: ${file}`);
      }
    }
  } catch (err) {
    console.error("[USB Sync] Failed to sync uploads folders:", err);
  }
}

function mergeDatabases(localDb: AppDatabase, usbDb: AppDatabase): AppDatabase {
  const localTime = new Date(localDb.lastUpdated || 0).getTime();
  const usbTime = new Date(usbDb.lastUpdated || 0).getTime();
  const isLocalNewer = localTime >= usbTime;

  const mergedProductsMap = new Map<string, Product>();
  for (const prod of usbDb.products || []) {
    if (prod && prod.id) {
      mergedProductsMap.set(prod.id, prod);
    }
  }
  for (const prod of localDb.products || []) {
    if (prod && prod.id) {
      if (!mergedProductsMap.has(prod.id) || isLocalNewer) {
        mergedProductsMap.set(prod.id, prod);
      }
    }
  }

  const mergedSalesMap = new Map<string, Sale>();
  for (const sale of usbDb.sales || []) {
    if (sale && sale.id) {
      mergedSalesMap.set(sale.id, sale);
    }
  }
  for (const sale of localDb.sales || []) {
    if (sale && sale.id) {
      if (!mergedSalesMap.has(sale.id) || isLocalNewer) {
        mergedSalesMap.set(sale.id, sale);
      }
    }
  }

  const mergedExpensesMap = new Map<string, Expense>();
  for (const exp of usbDb.expenses || []) {
    if (exp && exp.id) {
      mergedExpensesMap.set(exp.id, exp);
    }
  }
  for (const exp of localDb.expenses || []) {
    if (exp && exp.id) {
      if (!mergedExpensesMap.has(exp.id) || isLocalNewer) {
        mergedExpensesMap.set(exp.id, exp);
      }
    }
  }

  const mergedUsersMap = new Map<string, User>();
  for (const u of usbDb.users || []) {
    if (u && u.id) {
      mergedUsersMap.set(u.id, u);
    }
  }
  for (const u of localDb.users || []) {
    if (u && u.id) {
      if (!mergedUsersMap.has(u.id) || isLocalNewer) {
        mergedUsersMap.set(u.id, u);
      }
    }
  }

  const mergedPasswordHashes = {
    ...(usbDb.passwordHashes || {}),
    ...(localDb.passwordHashes || {})
  };

  const maxTime = Math.max(localTime, usbTime);
  const mergedLastUpdated = new Date(maxTime).toISOString();

  return {
    products: Array.from(mergedProductsMap.values()),
    sales: Array.from(mergedSalesMap.values()),
    expenses: Array.from(mergedExpensesMap.values()),
    users: Array.from(mergedUsersMap.values()),
    passwordHashes: mergedPasswordHashes,
    lastUpdated: mergedLastUpdated
  };
}

let cachedDb: AppDatabase | null = null;

export function readDatabase(forceRefresh = false): AppDatabase {
  if (cachedDb && !forceRefresh) {
    return cachedDb;
  }

  let localDb = DatabaseService.read();
  cachedDb = localDb;

  const usbDbPath = getUsbDbPath(forceRefresh);
  if (usbDbPath) {
    try {
      const usbUploadsDir = path.join(path.dirname(usbDbPath), "pijama_pos_uploads");
      const localUploadsDir = path.join(BASE_DATA_DIR, "uploads");
      syncUploads(localUploadsDir, usbUploadsDir);

      if (fs.existsSync(usbDbPath)) {
        const usbDb = DatabaseService.read(usbDbPath);

        const isLocalEmpty = localDb.products.length === 0;
        const isUsbEmpty = usbDb.products.length === 0;

        if (isLocalEmpty && !isUsbEmpty) {
          console.log("[USB Sync] Local products are empty, but USB database contains products. Restoring database from USB.");
          DatabaseService.write(usbDb);
          syncUploads(localUploadsDir, usbUploadsDir);
          cachedDb = usbDb;
          return usbDb;
        } else if (!isLocalEmpty && isUsbEmpty) {
          console.log("[USB Sync] USB database has no products, but local database contains products. Copying local database to USB.");
          DatabaseService.write(localDb, usbDbPath);
        } else {
          console.log("[USB Sync] Both local and USB databases contain products. Performing bi-directional merge.");
          const mergedDb = mergeDatabases(localDb, usbDb);

          DatabaseService.write(mergedDb);
          DatabaseService.write(mergedDb, usbDbPath);
          syncUploads(localUploadsDir, usbUploadsDir);

          cachedDb = mergedDb;
          return mergedDb;
        }
      } else {
        console.log(`[USB Sync] USB connected but has no database. Copying local database to USB.`);
        DatabaseService.write(localDb, usbDbPath);
      }
    } catch (err) {
      console.error("[USB Sync] Error during USB synchronization read/write:", err);
    }
  }

  return localDb;
}

export function writeDatabase(db: AppDatabase) {
  cachedDb = db;
  try {
    DatabaseService.write(db);
  } catch (e) {
    console.error("Failed writing to local database:", e);
  }

  const usbDbPath = getUsbDbPath(false);
  if (usbDbPath) {
    try {
      DatabaseService.write(db, usbDbPath);
      console.log(`[USB Sync] Changes successfully saved to local and USB drive (${usbDbPath})`);

      const usbUploadsDir = path.join(path.dirname(usbDbPath), "pijama_pos_uploads");
      const localUploadsDir = path.join(BASE_DATA_DIR, "uploads");
      syncUploads(localUploadsDir, usbUploadsDir);
    } catch (err) {
      console.error("[USB Sync] Failed writing to USB drive:", err);
    }
  }
}


// --- AUTH DATA FLOWS ---
export function needsSetup(): boolean {
  const db = readDatabase();
  return !db.passwordHashes["admin"] || db.passwordHashes["admin"] === "";
}

export function clearAdminPassword() {
  const db = readDatabase();
  db.passwordHashes["admin"] = "";
  writeDatabase(db);
}

export function setupAdminPassword(passwordHash: string) {
  const db = readDatabase();
  db.passwordHashes["admin"] = passwordHash;
  if (!db.users.some(u => u.username === "admin")) {
    db.users.push({ id: "admin", username: "admin", role: "Admin", name: "Administrator" });
  }
  writeDatabase(db);
}

export function getUserByUsername(username: string): { user: User; passwordHash: string } | null {
  const db = readDatabase();
  const lower = username.toLowerCase().trim();
  const user = db.users.find(u => u.username.toLowerCase() === lower);
  if (!user) return null;
  return {
    user,
    passwordHash: db.passwordHashes[lower] || ""
  };
}

export function getAllUsers(): User[] {
  const db = readDatabase();
  return db.users;
}

export function getAdminCount(): number {
  const db = readDatabase();
  return db.users.filter(u => u.role === "Admin").length;
}

export function createUser(user: User, passwordHash: string) {
  const db = readDatabase();
  db.users.push(user);
  db.passwordHashes[user.username.toLowerCase().trim()] = passwordHash;
  writeDatabase(db);
}

export function updateUser(id: string, name?: string, role?: string, username?: string, passwordHash?: string) {
  const db = readDatabase();
  const userIdx = db.users.findIndex(u => u.id === id);
  if (userIdx !== -1) {
    const user = db.users[userIdx];
    const oldUsername = user.username.toLowerCase();
    if (name !== undefined) user.name = name.trim();
    if (role !== undefined) user.role = role as "Admin" | "Staff";
    if (username !== undefined) {
      user.username = username.toLowerCase().trim();
      if (oldUsername !== user.username) {
        const existingHash = db.passwordHashes[oldUsername];
        db.passwordHashes[user.username] = passwordHash || existingHash || "";
        delete db.passwordHashes[oldUsername];
      }
    }
    if (passwordHash !== undefined) {
      db.passwordHashes[user.username] = passwordHash;
    }
    writeDatabase(db);
  }
}

export function deleteUser(id: string) {
  const db = readDatabase();
  const idx = db.users.findIndex(u => u.id === id);
  if (idx !== -1) {
    const user = db.users[idx];
    db.users.splice(idx, 1);
    delete db.passwordHashes[user.username.toLowerCase()];
    writeDatabase(db);
  }
}

// --- DATABASE RESET ---
export function resetDatabase() {
  const db = readDatabase();
  db.products = [];
  db.sales = [];
  db.expenses = [];
  writeDatabase(db);
}

// --- PRODUCTS DATA FLOWS ---
export function getAllProducts(): Product[] {
  const db = readDatabase();
  return db.products;
}

/**
 * Get products with pagination (new optimized method)
 */
export function getProductsPaginated(page?: number, limit?: number, search?: string) {
  return DatabaseService.getProductsPaginated(page, limit, search);
}

/**
 * Get single product by barcode (new optimized method)
 */
export function getProductByBarcode(barcode: string): Product | null {
  return DatabaseService.getProductByBarcode(barcode);
}

export function createProduct(product: Product) {
  const db = readDatabase();
  db.products.push(product);
  writeDatabase(db);
}

export function updateProduct(id: string, updates: Partial<Product>) {
  const db = readDatabase();
  const index = db.products.findIndex(p => p.id === id);
  if (index !== -1) {
    db.products[index] = {
      ...db.products[index],
      ...updates
    };
    writeDatabase(db);
  }
}

export function deleteProduct(id: string): boolean {
  const db = readDatabase();
  const filtered = db.products.filter(p => p.id !== id);
  if (filtered.length === db.products.length) {
    return false;
  }
  db.products = filtered;
  writeDatabase(db);
  return true;
}

// --- SALES & TRANSACTIONS DATA FLOWS ---
export function getSalesCount(): number {
  const db = readDatabase();
  return db.sales.length;
}

export function getAllSales(): Sale[] {
  const db = readDatabase();
  return db.sales;
}

/**
 * Get sales with pagination (new optimized method)
 */
export function getSalesPaginated(page?: number, limit?: number, startDate?: string, endDate?: string) {
  return DatabaseService.getSalesPaginated(page, limit, startDate, endDate);
}

/**
 * Get dashboard stats using SQL aggregation (new optimized method)
 */
export function getDashboardStats() {
  return DatabaseService.getDashboardStats();
}

export function createSale(sale: Sale, updatedProducts: Product[]) {
  const db = readDatabase();
  db.products = updatedProducts;
  db.sales.push(sale);
  writeDatabase(db);
}

// --- EXPENSES MODULE DATA FLOWS ---
export function getAllExpenses(): Expense[] {
  const db = readDatabase();
  return db.expenses;
}

export function createExpense(expense: Expense) {
  const db = readDatabase();
  db.expenses.push(expense);
  writeDatabase(db);
}

export function deleteExpense(id: string): boolean {
  const db = readDatabase();
  const filtered = db.expenses.filter(e => e.id !== id);
  if (filtered.length === db.expenses.length) {
    return false;
  }
  db.expenses = filtered;
  writeDatabase(db);
  return true;
}

// --- EMAIL SETTINGS DATA FLOWS ---
export function getReportEmail(): string {
  const db = readDatabase();
  return db.reportEmail || "";
}

export function saveReportEmail(email: string) {
  const db = readDatabase();
  db.reportEmail = email;
  writeDatabase(db);
}

export function getSmtpSettings(): SmtpSettings | null {
  const db = readDatabase();
  return db.smtpSettings || null;
}

export function saveSmtpSettings(settings: SmtpSettings) {
  const db = readDatabase();
  db.smtpSettings = settings;
  writeDatabase(db);
}
