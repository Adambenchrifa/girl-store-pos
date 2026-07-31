/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createServer as createViteServer } from "vite";
import { BASE_DATA_DIR, UPLOAD_DIR } from "./config/app";
import { appConfig, securityConfig } from "./config/index";
import { initDbFile } from "./database";
import apiRouter from "./routes";
import { errorHandler } from "./middleware/error";
import { LoggerService } from "./services/LoggerService";

const app = express();

// Trust proxy headers for accurate client IP resolution in reverse-proxy environments (Cloud Run/Nginx)
app.set("trust proxy", 1);

// Initialize JSON database
initDbFile(BASE_DATA_DIR);

// 1. Secure HTTP Headers via Helmet
// Customized to keep CSP and X-Frame-Options permissive enough for Vite and the AI Studio preview iframe
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    frameguard: false // Allows the app to be embedded in the AI Studio iframe preview
  })
);

// 2. Configure Cross-Origin Resource Sharing (CORS)
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

// 3. API Rate Limiting to prevent automated denial-of-service or brute force
const apiLimiter = rateLimit({
  windowMs: securityConfig.rateLimit.windowMs,
  max: securityConfig.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many requests from this IP, please try again after 15 minutes / الكثير من الطلبات من هذا العنوان، يرجى المحاولة لاحقاً"
  }
});

// Apply rate limiting to all /api routes
app.use("/api", apiLimiter);

// Parse JSON request bodies
app.use(express.json());

// Serve uploaded images statically
app.use("/uploads", express.static(UPLOAD_DIR));

// Register all API routes
app.use("/api", apiRouter);

// Centralized API Error Handling Middleware
app.use("/api", errorHandler);

// Set up Vite / SPA static asset serving
async function startServer() {
  if (!appConfig.isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    let distPath = __dirname;
    if (!fs.existsSync(path.join(distPath, "index.html"))) {
      distPath = path.join(__dirname, "dist");
    }
    console.log("[Server] Serving static files from distPath:", distPath);
    console.log("[Server] index.html exists:", fs.existsSync(path.join(distPath, "index.html")));

    app.use(express.static(distPath));
    app.get("*", (req, res, next) => {
      const indexPath = path.join(distPath, "index.html");
      try {
        if (fs.existsSync(indexPath)) {
          const html = fs.readFileSync(indexPath, "utf8");
          res.setHeader("Content-Type", "text/html");
          res.send(html);
        } else {
          console.error(`[Server Error] index.html not found at: ${indexPath}`);
          res.status(404).send("Application files are missing. Please reinstall.");
        }
      } catch (err) {
        console.error(`[Server Error] Failed to read/send index.html from ${indexPath}:`, err);
        next(err);
      }
    });
  }

  app.listen(appConfig.port, "0.0.0.0", () => {
    LoggerService.logStartup(appConfig.port, appConfig.env);
  });
}

startServer();
export default app;
