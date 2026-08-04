import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { BASE_DATA_DIR } from "../config/app";
import { dbConfig } from "../config/index";
import { AppDatabase, User } from "../types";
import { LoggerService } from "../services/LoggerService";

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

class DatabaseServiceImpl {
  private dbPath: string;
  private backupPath: string;
  private backupPath2: string;
  private backupPath3: string;
  private lockPath: string;
  private tempPath: string;
  private db: Database.Database | null = null;

  constructor() {
    this.dbPath = dbConfig.mainDbPath;
    this.backupPath = dbConfig.backupPath;
    this.backupPath2 = dbConfig.backupPath2;
    this.backupPath3 = dbConfig.backupPath3;
    this.lockPath = dbConfig.lockPath;
    this.tempPath = dbConfig.tempPath;
  }

  /**
   * Initializes SQLite database, schemas, WAL mode, integrity checks, and migrates legacy JSON DB if found.
   */
  public init(baseDataDir: string = BASE_DATA_DIR): void {
    // Correct paths if baseDataDir is overridden
    this.dbPath = path.join(baseDataDir, "database", "store.db");
    this.backupPath = path.join(baseDataDir, "backups", "store.db.bak");
    this.backupPath2 = path.join(baseDataDir, "backups", "store.db.bak.2");
    this.backupPath3 = path.join(baseDataDir, "backups", "store.db.bak.3");
    this.lockPath = path.join(baseDataDir, "database", "store.db.lock");
    this.tempPath = path.join(baseDataDir, "database", "store.db.tmp");

    const dbDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    const backupsDir = path.dirname(this.backupPath);
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }

    try {
      this.db = new Database(this.dbPath);
      
      // Enable WAL (Write-Ahead Logging) mode for optimal concurrency
      this.db.pragma("journal_mode = WAL");
      
      // Integrity check
      const check = this.db.prepare("PRAGMA integrity_check").get() as any;
      const checkResult = check ? (check.integrity_check || check["integrity_check"] || "") : "";
      if (checkResult !== "ok") {
        LoggerService.error("database", "Primary SQLite database integrity check failed. Triggering recovery...");
        this.recoverCorruptedDatabase();
        return;
      }

      // Initialize schemas
      this.db.exec(SCHEMA_PRODUCTS);
      this.db.exec(SCHEMA_SALES);
      this.db.exec(SCHEMA_EXPENSES);
      this.db.exec(SCHEMA_USERS);
      this.db.exec(SCHEMA_PASSWORD_HASHES);
      this.db.exec(SCHEMA_SETTINGS);

      // Initialize indexes
      this.db.exec(INDEX_PRODUCTS_BARCODE);
      this.db.exec(INDEX_SALES_DATETIME);
      this.db.exec(INDEX_EXPENSES_DATE);

      // Seed default operator records if DB is completely empty
      const usersCount = (this.db.prepare("SELECT COUNT(*) as count FROM users").get() as any).count;
      if (usersCount === 0) {
        LoggerService.info("database", "New SQLite database detected. Seeding default Admin operator...");
        const insertUser = this.db.prepare("INSERT INTO users (id, username, role, name) VALUES (?, ?, ?, ?)");
        const insertPass = this.db.prepare("INSERT INTO password_hashes (username, passwordHash) VALUES (?, ?)");
        this.db.transaction(() => {
          for (const u of DEFAULT_USERS) {
            insertUser.run(u.id, u.username, u.role, u.name);
            insertPass.run(u.username, "");
          }
        })();
      }

      // Check and migrate legacy JSON database (db.json) if it exists
      // Check both baseDataDir/db.json and appDir/db.json
      let legacyJsonPath = path.join(baseDataDir, "db.json");
      if (!fs.existsSync(legacyJsonPath)) {
        const altPath = path.join(process.cwd(), "db.json");
        if (fs.existsSync(altPath)) {
          legacyJsonPath = altPath;
        }
      }

      if (fs.existsSync(legacyJsonPath)) {
        this.migrateLegacyJsonDb(legacyJsonPath);
      }

      // Set up exit hooks for graceful connection close
      process.on("exit", () => this.closeConnection());

    } catch (err: any) {
      LoggerService.error("database", `Failed initializing SQLite database: ${err.message}`);
      this.recoverCorruptedDatabase();
    }
  }

  /**
   * Migrate legacy db.json data directly to SQLite
   */
  private migrateLegacyJsonDb(legacyJsonPath: string): void {
    LoggerService.info("database", `Found legacy db.json at: ${legacyJsonPath}. Starting automatic migration...`);
    try {
      const content = fs.readFileSync(legacyJsonPath, "utf-8");
      const parsed = JSON.parse(content) as AppDatabase;
      if (this.isValidSchema(parsed)) {
        const repaired = this.validateAndRepair(parsed);
        
        // Write parsed data to current active DB
        this.writeToSqliteConnection(repaired, this.db!);

        // Verify count of products in DB matches length of parsed
        const productsCount = (this.db!.prepare("SELECT COUNT(*) as count FROM products").get() as any).count;
        if (productsCount >= repaired.products.length) {
          LoggerService.success("database", `Migration verification success! Imported ${productsCount} products.`);
          
          // Rename db.json to db.backup.json
          const backupJsonPath = path.join(path.dirname(legacyJsonPath), "db.backup.json");
          fs.renameSync(legacyJsonPath, backupJsonPath);
          LoggerService.info("database", `Renamed legacy db.json to db.backup.json successfully.`);
        } else {
          throw new Error("Verification failed: migrated records count mismatch.");
        }
      } else {
        LoggerService.error("database", "Legacy db.json file failed validation schema, skipping automated migration.");
      }
    } catch (err: any) {
      LoggerService.error("database", `Legacy automatic migration failed: ${err.message}`);
    }
  }

  /**
   * Write complete AppDatabase to a SQLite instance using a fast, secure database transaction.
   */
  private writeToSqliteConnection(db: AppDatabase, sqliteDb: Database.Database): void {
    const clearProducts = sqliteDb.prepare("DELETE FROM products");
    const clearSales = sqliteDb.prepare("DELETE FROM sales");
    const clearExpenses = sqliteDb.prepare("DELETE FROM expenses");
    const clearUsers = sqliteDb.prepare("DELETE FROM users");
    const clearPassHashes = sqliteDb.prepare("DELETE FROM password_hashes");
    const clearSettings = sqliteDb.prepare("DELETE FROM settings");

    const insertProduct = sqliteDb.prepare(`
      INSERT OR REPLACE INTO products (id, name, arabicName, category, barcode, price, image, variants, imagePath, purchasePrice, sellingPrice, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertSale = sqliteDb.prepare(`
      INSERT OR REPLACE INTO sales (id, receiptNo, dateTime, userId, staffName, items, subtotal, discountType, discountValue, discountAmount, taxRate, taxAmount, total, paymentMethod, amountPaid, change)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertExpense = sqliteDb.prepare(`
      INSERT OR REPLACE INTO expenses (id, title, amount, category, date)
      VALUES (?, ?, ?, ?, ?)
    `);

    const insertUser = sqliteDb.prepare(`
      INSERT OR REPLACE INTO users (id, username, role, name)
      VALUES (?, ?, ?, ?)
    `);

    const insertPass = sqliteDb.prepare(`
      INSERT OR REPLACE INTO password_hashes (username, passwordHash)
      VALUES (?, ?)
    `);

    const insertSetting = sqliteDb.prepare(`
      INSERT OR REPLACE INTO settings (key, value)
      VALUES (?, ?)
    `);

    sqliteDb.transaction(() => {
      clearProducts.run();
      clearSales.run();
      clearExpenses.run();
      clearUsers.run();
      clearPassHashes.run();
      clearSettings.run();

      for (const p of db.products) {
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

      for (const s of db.sales) {
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

      for (const e of db.expenses) {
        insertExpense.run(
          e.id,
          e.title,
          e.amount,
          e.category || null,
          e.date
        );
      }

      for (const u of db.users) {
        insertUser.run(u.id, u.username, u.role, u.name);
      }

      if (db.passwordHashes) {
        for (const [uname, hash] of Object.entries(db.passwordHashes)) {
          insertPass.run(uname, hash || "");
        }
      }

      if (db.reportEmail) {
        insertSetting.run("reportEmail", db.reportEmail);
      }
      if (db.smtpSettings) {
        insertSetting.run("smtpSettings", JSON.stringify(db.smtpSettings));
      }
      insertSetting.run("lastUpdated", db.lastUpdated || new Date().toISOString());
    })();
  }

  /**
   * Get all products (legacy method - loads everything)
   * @deprecated Use getProductsPaginated() for better performance
   */
  public getAllProducts(): Product[] {
    const stmt = this.db!.prepare("SELECT * FROM products");
    const rows = stmt.all() as any[];
    return rows.map((p) => {
      let variants = [];
      try {
        variants = p.variants ? JSON.parse(p.variants) : [];
      } catch (e) {
        variants = [];
      }
      return {
        id: p.id,
        name: p.name,
        arabicName: p.arabicName || undefined,
        category: p.category || undefined,
        barcode: p.barcode || undefined,
        price: p.price,
        image: p.image || undefined,
        variants: variants,
        imagePath: p.imagePath || undefined,
        purchasePrice: p.purchasePrice !== null ? p.purchasePrice : undefined,
        sellingPrice: p.sellingPrice !== null ? p.sellingPrice : undefined,
        status: p.status || undefined
      };
    });
  }

  /**
   * Get products with pagination and optional search
   */
  public getProductsPaginated(page: number = 1, limit: number = 50, search?: string): { products: Product[], totalItems: number, totalPages: number, currentPage: number } {
    const offset = (page - 1) * limit;
    
    // Build search condition if provided
    let whereClause = "";
    let params: any[] = [];
    if (search) {
      whereClause = " WHERE name LIKE ? OR barcode LIKE ? OR arabicName LIKE ?";
      const searchTerm = `%${search}%`;
      params = [searchTerm, searchTerm, searchTerm];
    }
    
    // Get total count
    const countStmt = this.db!.prepare(`SELECT COUNT(*) as count FROM products${whereClause}`);
    const countResult = countStmt.get(...params) as any;
    const totalItems = countResult.count;
    const totalPages = Math.ceil(totalItems / limit);
    
    // Get paginated results
    const selectStmt = this.db!.prepare(`SELECT * FROM products${whereClause} ORDER BY name LIMIT ? OFFSET ?`);
    const rows = selectStmt.all(...params, limit, offset) as any[];
    
    const products = rows.map((p) => {
      let variants = [];
      try {
        variants = p.variants ? JSON.parse(p.variants) : [];
      } catch (e) {
        variants = [];
      }
      return {
        id: p.id,
        name: p.name,
        arabicName: p.arabicName || undefined,
        category: p.category || undefined,
        barcode: p.barcode || undefined,
        price: p.price,
        image: p.image || undefined,
        variants: variants,
        imagePath: p.imagePath || undefined,
        purchasePrice: p.purchasePrice !== null ? p.purchasePrice : undefined,
        sellingPrice: p.sellingPrice !== null ? p.sellingPrice : undefined,
        status: p.status || undefined
      };
    });
    
    return {
      products,
      totalItems,
      totalPages,
      currentPage: page
    };
  }

  /**
   * Get single product by ID using indexed lookup
   */
  public getProductById(id: string): Product | null {
    const stmt = this.db!.prepare("SELECT * FROM products WHERE id = ?");
    const row = stmt.get(id) as any;
    
    if (!row) {
      return null;
    }
    
    let variants = [];
    try {
      variants = row.variants ? JSON.parse(row.variants) : [];
    } catch (e) {
      variants = [];
    }
    
    return {
      id: row.id,
      name: row.name,
      arabicName: row.arabicName || undefined,
      category: row.category || undefined,
      barcode: row.barcode || undefined,
      price: row.price,
      image: row.image || undefined,
      variants: variants,
      imagePath: row.imagePath || undefined,
      purchasePrice: row.purchasePrice !== null ? row.purchasePrice : undefined,
      sellingPrice: row.sellingPrice !== null ? row.sellingPrice : undefined,
      status: row.status || undefined
    };
  }

  /**
   * Get single product by barcode using indexed lookup
   */
  public getProductByBarcode(barcode: string): Product | null {
    const stmt = this.db!.prepare("SELECT * FROM products WHERE barcode = ?");
    const row = stmt.get(barcode) as any;
    
    if (!row) {
      return null;
    }
    
    let variants = [];
    try {
      variants = row.variants ? JSON.parse(row.variants) : [];
    } catch (e) {
      variants = [];
    }
    
    return {
      id: row.id,
      name: row.name,
      arabicName: row.arabicName || undefined,
      category: row.category || undefined,
      barcode: row.barcode || undefined,
      price: row.price,
      image: row.image || undefined,
      variants: variants,
      imagePath: row.imagePath || undefined,
      purchasePrice: row.purchasePrice !== null ? row.purchasePrice : undefined,
      sellingPrice: row.sellingPrice !== null ? row.sellingPrice : undefined,
      status: row.status || undefined
    };
  }

  /**
   * Get single sale by ID using indexed lookup
   */
  public getSaleById(id: string): Sale | null {
    const stmt = this.db!.prepare("SELECT * FROM sales WHERE id = ?");
    const row = stmt.get(id) as any;
    
    if (!row) {
      return null;
    }
    
    let items = [];
    try {
      items = row.items ? JSON.parse(row.items) : [];
    } catch (e) {
      items = [];
    }
    
    return {
      id: row.id,
      receiptNo: row.receiptNo,
      dateTime: row.dateTime,
      userId: row.userId || undefined,
      staffName: row.staffName || undefined,
      items: items,
      subtotal: row.subtotal,
      discountType: row.discountType || undefined,
      discountValue: row.discountValue !== null ? row.discountValue : undefined,
      discountAmount: row.discountAmount !== null ? row.discountAmount : undefined,
      taxRate: row.taxRate !== null ? row.taxRate : undefined,
      taxAmount: row.taxAmount !== null ? row.taxAmount : undefined,
      total: row.total,
      paymentMethod: row.paymentMethod || undefined,
      amountPaid: row.amountPaid !== null ? row.amountPaid : undefined,
      change: row.change !== null ? row.change : undefined
    };
  }

  /**
   * Get all sales (legacy method - loads everything)
   * @deprecated Use getSalesPaginated() for better performance
   */
  public getAllSales(): Sale[] {
    const stmt = this.db!.prepare("SELECT * FROM sales ORDER BY dateTime DESC");
    const rows = stmt.all() as any[];
    return rows.map((s) => {
      let items = [];
      try {
        items = s.items ? JSON.parse(s.items) : [];
      } catch (e) {
        items = [];
      }
      return {
        id: s.id,
        receiptNo: s.receiptNo,
        dateTime: s.dateTime,
        userId: s.userId || undefined,
        staffName: s.staffName || undefined,
        items: items,
        subtotal: s.subtotal,
        discountType: s.discountType || undefined,
        discountValue: s.discountValue !== null ? s.discountValue : undefined,
        discountAmount: s.discountAmount !== null ? s.discountAmount : undefined,
        taxRate: s.taxRate !== null ? s.taxRate : undefined,
        taxAmount: s.taxAmount !== null ? s.taxAmount : undefined,
        total: s.total,
        paymentMethod: s.paymentMethod || undefined,
        amountPaid: s.amountPaid !== null ? s.amountPaid : undefined,
        change: s.change !== null ? s.change : undefined
      };
    });
  }

  /**
   * Get sales with pagination and optional date filtering
   */
  public getSalesPaginated(page: number = 1, limit: number = 50, startDate?: string, endDate?: string): { sales: Sale[], totalItems: number, totalPages: number, currentPage: number } {
    const offset = (page - 1) * limit;
    
    // Build date filter conditions
    let whereClause = "";
    let params: any[] = [];
    
    if (startDate && endDate) {
      whereClause = " WHERE dateTime >= ? AND dateTime <= ?";
      params = [startDate, endDate];
    } else if (startDate) {
      whereClause = " WHERE dateTime >= ?";
      params = [startDate];
    } else if (endDate) {
      whereClause = " WHERE dateTime <= ?";
      params = [endDate];
    }
    
    // Get total count
    const countStmt = this.db!.prepare(`SELECT COUNT(*) as count FROM sales${whereClause}`);
    const countResult = countStmt.get(...params) as any;
    const totalItems = countResult.count;
    const totalPages = Math.ceil(totalItems / limit);
    
    // Get paginated results
    const selectStmt = this.db!.prepare(`SELECT * FROM sales${whereClause} ORDER BY dateTime DESC LIMIT ? OFFSET ?`);
    const rows = selectStmt.all(...params, limit, offset) as any[];
    
    const sales = rows.map((s) => {
      let items = [];
      try {
        items = s.items ? JSON.parse(s.items) : [];
      } catch (e) {
        items = [];
      }
      return {
        id: s.id,
        receiptNo: s.receiptNo,
        dateTime: s.dateTime,
        userId: s.userId || undefined,
        staffName: s.staffName || undefined,
        items: items,
        subtotal: s.subtotal,
        discountType: s.discountType || undefined,
        discountValue: s.discountValue !== null ? s.discountValue : undefined,
        discountAmount: s.discountAmount !== null ? s.discountAmount : undefined,
        taxRate: s.taxRate !== null ? s.taxRate : undefined,
        taxAmount: s.taxAmount !== null ? s.taxAmount : undefined,
        total: s.total,
        paymentMethod: s.paymentMethod || undefined,
        amountPaid: s.amountPaid !== null ? s.amountPaid : undefined,
        change: s.change !== null ? s.change : undefined
      };
    });
    
    return {
      sales,
      totalItems,
      totalPages,
      currentPage: page
    };
  }

  /**
   * Get dashboard stats using SQL aggregation (optimized - no full table scan)
   */
  public getDashboardStats(): { dailyRevenue: number, dailySalesCount: number, unpaidExpenses: number, dailyExpenses: number, profitAndLoss: { revenue: number, expenses: number, profit: number }, topProducts: Array<{name: string, quantity: number, revenue: number}> } {
    const todayString = new Date().toISOString().slice(0, 10);
    
    // Daily stats using SQL
    const dailyStatsStmt = this.db!.prepare(`
      SELECT 
        COUNT(*) as salesCount,
        COALESCE(SUM(total), 0) as totalRevenue
      FROM sales 
      WHERE dateTime LIKE ?
    `);
    const dailyStats = dailyStatsStmt.get(todayString + '%') as any;
    const dailyRevenue = dailyStats.totalRevenue || 0;
    const dailySalesCount = dailyStats.salesCount || 0;
    
    // Daily expenses using SQL
    const dailyExpensesStmt = this.db!.prepare(`
      SELECT COALESCE(SUM(amount), 0) as totalExpenses
      FROM expenses 
      WHERE date = ?
    `);
    const dailyExpensesResult = dailyExpensesStmt.get(todayString) as any;
    const dailyExpenses = dailyExpensesResult.totalExpenses || 0;
    
    // Total revenues using SQL (for profitAndLoss.revenue)
    const totalRevenueStmt = this.db!.prepare(`SELECT COALESCE(SUM(total), 0) as total FROM sales`);
    const totalRevenues = (totalRevenueStmt.get() as any).total || 0;
    
    // Total expenses using SQL (for profitAndLoss.expenses and unpaidExpenses)
    const totalExpensesStmt = this.db!.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM expenses`);
    const totalExpenses = (totalExpensesStmt.get() as any).total || 0;
    
    // Calculate profit
    const netProfit = totalRevenues - totalExpenses;
    
    // Top products using SQL aggregation
    const topProductsStmt = this.db!.prepare(`
      SELECT 
        json_extract(json_each.value, '$.productName') as productName,
        SUM(json_extract(json_each.value, '$.quantity')) as totalQty,
        SUM(json_extract(json_each.value, '$.total')) as totalRev
      FROM sales, json_each(sales.items)
      GROUP BY productName
      ORDER BY totalQty DESC
      LIMIT 5
    `);
    const topProductsRows = topProductsStmt.all() as any[];
    const topProducts = topProductsRows.map((row) => ({
      name: row.productName,
      quantity: row.totalQty || 0,
      revenue: Number((row.totalRev || 0).toFixed(2))
    }));
    
    // Return structure matching DashboardStats interface exactly
    return {
      dailyRevenue: Number(dailyRevenue.toFixed(2)),
      dailySalesCount,
      unpaidExpenses: Number(totalExpenses.toFixed(2)), // Same as total expenses (all expenses are considered unpaid until paid)
      dailyExpenses: Number(dailyExpenses.toFixed(2)),
      profitAndLoss: {
        revenue: Number(totalRevenues.toFixed(2)),
        expenses: Number(totalExpenses.toFixed(2)),
        profit: Number(netProfit.toFixed(2))
      },
      topProducts
    };
  }

  /**
   * Read and parse complete AppDatabase from SQLite instance.
   */
  private readFromSqliteConnection(sqliteDb: Database.Database): AppDatabase {
    const products = sqliteDb.prepare("SELECT * FROM products").all() as any[];
    const sales = sqliteDb.prepare("SELECT * FROM sales").all() as any[];
    const expenses = sqliteDb.prepare("SELECT * FROM expenses").all() as any[];
    const users = sqliteDb.prepare("SELECT * FROM users").all() as any[];
    const passwordHashesRows = sqliteDb.prepare("SELECT * FROM password_hashes").all() as any[];
    const settingsRows = sqliteDb.prepare("SELECT * FROM settings").all() as any[];

    const parsedProducts = products.map((p) => {
      let variants = [];
      try {
        variants = p.variants ? JSON.parse(p.variants) : [];
      } catch (e) {
        variants = [];
      }
      return {
        id: p.id,
        name: p.name,
        arabicName: p.arabicName || undefined,
        category: p.category || undefined,
        barcode: p.barcode || undefined,
        price: p.price,
        image: p.image || undefined,
        variants: variants,
        imagePath: p.imagePath || undefined,
        purchasePrice: p.purchasePrice !== null ? p.purchasePrice : undefined,
        sellingPrice: p.sellingPrice !== null ? p.sellingPrice : undefined,
        status: p.status || undefined
      };
    });

    const parsedSales = sales.map((s) => {
      let items = [];
      try {
        items = s.items ? JSON.parse(s.items) : [];
      } catch (e) {
        items = [];
      }
      return {
        id: s.id,
        receiptNo: s.receiptNo,
        dateTime: s.dateTime,
        userId: s.userId || undefined,
        staffName: s.staffName || undefined,
        items: items,
        subtotal: s.subtotal,
        discountType: s.discountType || undefined,
        discountValue: s.discountValue !== null ? s.discountValue : undefined,
        discountAmount: s.discountAmount !== null ? s.discountAmount : undefined,
        taxRate: s.taxRate !== null ? s.taxRate : undefined,
        taxAmount: s.taxAmount !== null ? s.taxAmount : undefined,
        total: s.total,
        paymentMethod: s.paymentMethod || undefined,
        amountPaid: s.amountPaid !== null ? s.amountPaid : undefined,
        change: s.change !== null ? s.change : undefined
      };
    });

    const parsedExpenses = expenses.map((e) => ({
      id: e.id,
      title: e.title,
      amount: e.amount,
      category: e.category || undefined,
      date: e.date
    }));

    const parsedUsers = users.map((u) => ({
      id: u.id,
      username: u.username,
      role: u.role,
      name: u.name
    }));

    const passwordHashes: Record<string, string> = {};
    for (const row of passwordHashesRows) {
      passwordHashes[row.username] = row.passwordHash || "";
    }

    let reportEmail = "";
    let smtpSettings: any = undefined;
    let lastUpdated = "1970-01-01T00:00:00.000Z";

    for (const s of settingsRows) {
      if (s.key === "reportEmail") {
        reportEmail = s.value;
      } else if (s.key === "smtpSettings") {
        try {
          smtpSettings = JSON.parse(s.value);
        } catch (e) {
          smtpSettings = undefined;
        }
      } else if (s.key === "lastUpdated") {
        lastUpdated = s.value;
      }
    }

    const db: AppDatabase = {
      products: parsedProducts,
      sales: parsedSales,
      expenses: parsedExpenses,
      users: parsedUsers,
      passwordHashes,
      lastUpdated
    };

    if (reportEmail) {
      db.reportEmail = reportEmail;
    }
    if (smtpSettings) {
      db.smtpSettings = smtpSettings;
    }

    return db;
  }

  /**
   * Safe Atomic Write of the database with backup rotation and transactions.
   */
  public write(db: AppDatabase, targetDbPath: string = this.dbPath): void {
    try {
      const validatedDb = this.validateAndRepair(db);
      validatedDb.lastUpdated = new Date().toISOString();

      if (targetDbPath === this.dbPath) {
        // Safe backup rotation before modifying main DB
        this.rotateBackupsSync();
        
        if (!this.db) {
          throw new Error("Active main database connection is missing.");
        }
        
        // Write to main DB
        this.writeToSqliteConnection(validatedDb, this.db);
        
        LoggerService.logDatabaseWrite(
          "write_main",
          "SQLite Main Database written successfully inside transaction",
          0
        );
      } else {
        // Writing to an external file (e.g. USB Sync)
        const dbDir = path.dirname(targetDbPath);
        if (!fs.existsSync(dbDir)) {
          fs.mkdirSync(dbDir, { recursive: true });
        }
        const tempDb = new Database(targetDbPath);
        try {
          tempDb.exec(SCHEMA_PRODUCTS);
          tempDb.exec(SCHEMA_SALES);
          tempDb.exec(SCHEMA_EXPENSES);
          tempDb.exec(SCHEMA_USERS);
          tempDb.exec(SCHEMA_PASSWORD_HASHES);
          tempDb.exec(SCHEMA_SETTINGS);

          this.writeToSqliteConnection(validatedDb, tempDb);
          
          LoggerService.logDatabaseWrite(
            "write_usb",
            `SQLite Sync Database written successfully to target path: ${path.basename(targetDbPath)}`,
            0
          );
        } finally {
          tempDb.close();
        }
      }
    } catch (err: any) {
      LoggerService.error("database", `Failed writing database: ${err.message}`, { path: targetDbPath });
      throw err;
    }
  }

  /**
   * Safe Read of the database.
   */
  public read(targetDbPath: string = this.dbPath): AppDatabase {
    try {
      if (targetDbPath === this.dbPath) {
        if (!this.db) {
          this.init();
        }
        return this.readFromSqliteConnection(this.db!);
      } else {
        // Reading from an external SQLite file (USB sync)
        if (!fs.existsSync(targetDbPath)) {
          return { ...DEFAULT_DB, lastUpdated: "1970-01-01T00:00:00.000Z" };
        }
        const tempDb = new Database(targetDbPath);
        try {
          tempDb.exec(SCHEMA_PRODUCTS);
          tempDb.exec(SCHEMA_SALES);
          tempDb.exec(SCHEMA_EXPENSES);
          tempDb.exec(SCHEMA_USERS);
          tempDb.exec(SCHEMA_PASSWORD_HASHES);
          tempDb.exec(SCHEMA_SETTINGS);

          return this.readFromSqliteConnection(tempDb);
        } catch (e: any) {
          LoggerService.error("database", `Failed to read target db file at ${targetDbPath}: ${e.message}`);
          return { ...DEFAULT_DB, lastUpdated: "1970-01-01T00:00:00.000Z" };
        } finally {
          tempDb.close();
        }
      }
    } catch (err: any) {
      LoggerService.error("database", `Failed reading database: ${err.message}`, { path: targetDbPath });
      if (targetDbPath === this.dbPath) {
        return this.recoverCorruptedDatabase();
      }
      return { ...DEFAULT_DB, lastUpdated: "1970-01-01T00:00:00.000Z" };
    }
  }

  /**
   * Performs rotating backups to maintain historical states.
   */
  private rotateBackupsSync(): void {
    try {
      if (fs.existsSync(this.dbPath)) {
        if (fs.existsSync(this.backupPath2)) {
          fs.copyFileSync(this.backupPath2, this.backupPath3);
        }
        if (fs.existsSync(this.backupPath)) {
          fs.copyFileSync(this.backupPath, this.backupPath2);
        }
        fs.copyFileSync(this.dbPath, this.backupPath);
      }
    } catch (err) {
      console.error("[DatabaseService] Error during rotating backup cycle:", err);
    }
  }

  /**
   * Closes active SQLite database connection gracefully.
   */
  public closeConnection(): void {
    if (this.db) {
      try {
        this.db.close();
        this.db = null;
        LoggerService.info("database", "SQLite connection closed gracefully.");
      } catch (e) {
        // Fail silently on exit
      }
    }
  }

  /**
   * Validates parsed schema matches AppDatabase.
   */
  private isValidSchema(db: unknown): db is Partial<AppDatabase> {
    if (!db || typeof db !== "object") return false;
    const d = db as Record<string, unknown>;
    return (
      (d.products === undefined || Array.isArray(d.products)) &&
      (d.sales === undefined || Array.isArray(d.sales)) &&
      (d.expenses === undefined || Array.isArray(d.expenses)) &&
      (d.users === undefined || Array.isArray(d.users)) &&
      (d.passwordHashes === undefined || (typeof d.passwordHashes === "object" && d.passwordHashes !== null))
    );
  }

  /**
   * Standard repair and verification utility
   */
  private validateAndRepair(db: unknown): AppDatabase {
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
      passwordHashes: (d.passwordHashes && typeof d.passwordHashes === "object") ? (d.passwordHashes as Record<string, string>) : { admin: "" },
      lastUpdated: typeof d.lastUpdated === "string" ? d.lastUpdated : new Date().toISOString()
    };

    if (repaired.users.length === 0) {
      repaired.users = DEFAULT_USERS;
    }

    if (d.reportEmail !== undefined) {
      repaired.reportEmail = String(d.reportEmail);
    }
    if (d.smtpSettings !== undefined && typeof d.smtpSettings === "object" && d.smtpSettings !== null) {
      repaired.smtpSettings = d.smtpSettings as any;
    }

    return repaired;
  }

  /**
   * Automatic Error Recovery system.
   */
  private recoverCorruptedDatabase(): AppDatabase {
    LoggerService.error("database", "CRITICAL: Automated database recovery sequence initiated...");
    this.closeConnection();

    const recoverySources = [this.backupPath, this.backupPath2, this.backupPath3];

    for (const backupFile of recoverySources) {
      if (fs.existsSync(backupFile)) {
        try {
          LoggerService.info("database", `Attempting database restore from copy: ${path.basename(backupFile)}`);
          fs.copyFileSync(backupFile, this.dbPath);
          this.db = new Database(this.dbPath);
          this.db.pragma("journal_mode = WAL");
          
          const check = this.db.prepare("PRAGMA integrity_check").get() as any;
          const checkResult = check ? (check.integrity_check || check["integrity_check"] || "") : "";
          if (checkResult === "ok") {
            LoggerService.success("database", `Successfully recovered SQLite database state from copy: ${path.basename(backupFile)}`);
            return this.readFromSqliteConnection(this.db);
          }
          this.closeConnection();
        } catch (err: any) {
          LoggerService.error("database", `Copy restore failed from ${path.basename(backupFile)}: ${err.message}`);
        }
      }
    }

    // Emergency Revert to blank state
    LoggerService.error("database", "Forced Recovery Failure: All copies corrupted or missing. Re-initializing fresh blank template.");
    try {
      if (fs.existsSync(this.dbPath)) {
        fs.unlinkSync(this.dbPath);
      }
      this.db = new Database(this.dbPath);
      this.db.pragma("journal_mode = WAL");
      this.db.exec(SCHEMA_PRODUCTS);
      this.db.exec(SCHEMA_SALES);
      this.db.exec(SCHEMA_EXPENSES);
      this.db.exec(SCHEMA_USERS);
      this.db.exec(SCHEMA_PASSWORD_HASHES);
      this.db.exec(SCHEMA_SETTINGS);
      this.db.exec(INDEX_PRODUCTS_BARCODE);
      this.db.exec(INDEX_SALES_DATETIME);
      this.db.exec(INDEX_EXPENSES_DATE);

      const insertUser = this.db.prepare("INSERT INTO users (id, username, role, name) VALUES (?, ?, ?, ?)");
      const insertPass = this.db.prepare("INSERT INTO password_hashes (username, passwordHash) VALUES (?, ?)");
      this.db.transaction(() => {
        for (const u of DEFAULT_USERS) {
          insertUser.run(u.id, u.username, u.role, u.name);
          insertPass.run(u.username, "");
        }
      })();
      return DEFAULT_DB;
    } catch (err: any) {
      LoggerService.error("database", `Emergency initialization crashed: ${err.message}`);
      return DEFAULT_DB;
    }
  }
}

export const DatabaseService = new DatabaseServiceImpl();
