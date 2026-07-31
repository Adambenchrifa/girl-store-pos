import fs from "fs";
import path from "path";
import { BASE_DATA_DIR } from "../config/app";

export enum LogLevel {
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
  SYSTEM = "SYSTEM",
  SUCCESS = "SUCCESS"
}

interface LogEntry<T = unknown> {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  context?: T;
}

class LoggerServiceImpl {
  private logsDir: string;
  private currentLogDateString: string = "";
  private retentionDays: number = 30; // Clean logs older than 30 days

  constructor() {
    this.logsDir = path.join(BASE_DATA_DIR, "logs");
    this.ensureLogsDirectory();
    this.rotateAndCleanup();
  }

  /**
   * Ensures the logs/ directory exists inside our persistent data root.
   */
  private ensureLogsDirectory(): void {
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  /**
   * Get the current date in YYYY-MM-DD format.
   */
  private getDateString(): string {
    return new Date().toISOString().slice(0, 10);
  }

  /**
   * Get the path to today's log file.
   */
  private getTodayLogPath(): string {
    const today = this.getDateString();
    return path.join(this.logsDir, `app-${today}.log`);
  }

  /**
   * Rotates logs (checks if date changed) and cleans up files older than the retention threshold.
   */
  private rotateAndCleanup(): void {
    try {
      this.ensureLogsDirectory();
      const today = this.getDateString();
      if (this.currentLogDateString !== today) {
        this.currentLogDateString = today;
        this.runRetentionCleanup();
      }
    } catch (err) {
      console.error("[LoggerService] Failed during rotation or cleanup:", err);
    }
  }

  /**
   * Deletes log files older than the specified retention days.
   */
  private runRetentionCleanup(): void {
    try {
      const files = fs.readdirSync(this.logsDir);
      const now = Date.now();
      const thresholdMs = this.retentionDays * 24 * 60 * 60 * 1000;

      for (const file of files) {
        if (file.startsWith("app-") && file.endsWith(".log")) {
          const filePath = path.join(this.logsDir, file);
          const stats = fs.statSync(filePath);
          if (now - stats.mtimeMs > thresholdMs) {
            fs.unlinkSync(filePath);
            console.log(`[LoggerService] Purged stale log file older than ${this.retentionDays} days: ${file}`);
          }
        }
      }
    } catch (err) {
      console.error("[LoggerService] Failed to run log retention cleanup:", err);
    }
  }

  /**
   * Core logging method.
   * Formats the log entry, outputs to standard console, and appends to the daily rotated file.
   */
  public log<T = unknown>(level: LogLevel, category: string, message: string, context?: T): void {
    try {
      this.rotateAndCleanup();

      const timestamp = new Date().toISOString();
      const entry: LogEntry<T> = {
        timestamp,
        level,
        category: category.toUpperCase(),
        message,
        ...(context !== undefined && { context })
      };

      // 1. Construct single-line text format for standard file viewing
      const contextStr = context ? ` | Context: ${JSON.stringify(context)}` : "";
      const logLine = `[${timestamp}] [${level}] [${entry.category}] ${message}${contextStr}\n`;

      // 2. Append to daily rotated file safely
      const logPath = this.getTodayLogPath();
      fs.appendFileSync(logPath, logLine, "utf-8");

      // 3. Output colored, high-readability logs to standard dev console
      const colorMap = {
        [LogLevel.SYSTEM]: "\x1b[35m",  // Magenta
        [LogLevel.INFO]: "\x1b[34m",    // Blue
        [LogLevel.SUCCESS]: "\x1b[32m", // Green
        [LogLevel.WARN]: "\x1b[33m",    // Yellow
        [LogLevel.ERROR]: "\x1b[31m"    // Red
      };
      const resetColor = "\x1b[0m";
      const color = colorMap[level] || resetColor;

      console.log(`${color}[${entry.category}]${resetColor} ${message} ${context ? JSON.stringify(context) : ""}`);
    } catch (err) {
      // Fallback if writing fails to avoid crashing the server due to disk issues
      console.error("[LoggerService] Failed to append log to file:", err);
    }
  }

  // --- Specific Convenient Helpers ---

  public info<T = unknown>(category: string, message: string, context?: T): void {
    this.log<T>(LogLevel.INFO, category, message, context);
  }

  public warn<T = unknown>(category: string, message: string, context?: T): void {
    this.log<T>(LogLevel.WARN, category, message, context);
  }

  public error<T = unknown>(category: string, message: string, context?: T): void {
    this.log<T>(LogLevel.ERROR, category, message, context);
  }

  public success<T = unknown>(category: string, message: string, context?: T): void {
    this.log<T>(LogLevel.SUCCESS, category, message, context);
  }

  public system<T = unknown>(category: string, message: string, context?: T): void {
    this.log<T>(LogLevel.SYSTEM, category, message, context);
  }

  /**
   * System startup logging.
   */
  public logStartup(port: number, env: string): void {
    this.system(
      "startup",
      `System booting up successfully on port ${port} under ${env} mode`,
      { port, env, baseDataDir: BASE_DATA_DIR }
    );
  }

  /**
   * Authenticated actions logging.
   */
  public logLogin(username: string, success: boolean, ip?: string, reason?: string): void {
    const message = success
      ? `User '${username}' successfully signed in`
      : `Failed authentication attempt for user '${username}'${reason ? `: ${reason}` : ""}`;
    
    this.log(
      success ? LogLevel.SUCCESS : LogLevel.WARN,
      "auth",
      message,
      { username, success, ip, ...(reason && { reason }) }
    );
  }

  /**
   * Sales transactions logging.
   */
  public logSale(saleId: string, total: number, itemsCount: number, operatorName: string): void {
    this.success(
      "sales",
      `New sales checkout checkout completed: Receipt ID ${saleId} | Total: ${total} DT`,
      { saleId, total, itemsCount, operator: operatorName }
    );
  }

  /**
   * Database updates logging.
   */
  public logDatabaseWrite(operation: string, details: string, size?: number): void {
    this.info(
      "database",
      `Database write action [${operation}]: ${details}`,
      { operation, details, sizeBytes: size }
    );
  }
}

export const LoggerService = new LoggerServiceImpl();
