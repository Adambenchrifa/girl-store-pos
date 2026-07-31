import { Router } from "express";
import {
  getEmailSettings,
  postEmailSettings,
  getSmtpSettingsHandler,
  postSmtpSettingsHandler,
  postSendReportEmail,
  postTestConnection,
  postTestEmail
} from "../controllers/settingController";

const router = Router();

router.get("/email", getEmailSettings);
router.post("/email", postEmailSettings);
router.get("/smtp", getSmtpSettingsHandler);
router.post("/smtp", postSmtpSettingsHandler);
router.post("/smtp/test-connection", postTestConnection);
router.post("/smtp/test-email", postTestEmail);
router.post("/reports/send-email", postSendReportEmail);

export default router;
