import { Router } from "express";
import authRoutes from "./authRoutes";
import productRoutes from "./productRoutes";
import saleRoutes from "./saleRoutes";
import expenseRoutes from "./expenseRoutes";
import dashboardRoutes from "./dashboardRoutes";
import usbRoutes from "./usbRoutes";
import uploadRoutes from "./uploadRoutes";

import { postResetDatabase } from "../controllers/authController";
import {
  getEmailSettings,
  postEmailSettings,
  getSmtpSettingsHandler,
  postSmtpSettingsHandler,
  postSendReportEmail
} from "../controllers/settingController";

const router = Router();

// Auth / Register operators / Security setup
router.use("/auth", authRoutes);

// Admin operations
router.post("/admin/reset-database", postResetDatabase);

// Inventory catalog items
router.use("/products", productRoutes);

// Purchases, checkouts and bills
router.use("/sales", saleRoutes);

// Expenses logs
router.use("/expenses", expenseRoutes);

// USB hardware backups
router.use("/usb", usbRoutes);

// Media uploads
router.use("/upload", uploadRoutes);

// Business stats and profit/losses
router.use("/dashboard", dashboardRoutes);

// Settings and report triggers
router.get("/settings/email", getEmailSettings);
router.post("/settings/email", postEmailSettings);
router.get("/settings/smtp", getSmtpSettingsHandler);
router.post("/settings/smtp", postSmtpSettingsHandler);
router.post("/reports/send-email", postSendReportEmail);

export default router;
