import { Request, Response } from "express";
import { AppError, asyncHandler } from "../middleware/error";
import { checkRequiredFields } from "../utils/validation";
import { smtpConfig } from "../config/index";
import {
  getReportEmail,
  saveReportEmail,
  getSmtpSettings,
  saveSmtpSettings
} from "../database";
import { sendDailyReportEmail, verifySmtpConnection, sendTestEmail } from "../services/emailService";
import { encryptText } from "../utils/crypto";

export const getEmailSettings = asyncHandler(async (req: Request, res: Response) => {
  res.json({ email: getReportEmail() });
});

export const postEmailSettings = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;
  if (email !== undefined) {
    saveReportEmail(String(email).trim());
  }
  res.json({
    success: true,
    email: getReportEmail(),
    message: "Daily report email updated successfully! / تم تحديث البريد الإلكتروني للتقارير بنجاح"
  });
});

export const getSmtpSettingsHandler = asyncHandler(async (req: Request, res: Response) => {
  const settings = getSmtpSettings();
  res.json({
    host: settings?.host || smtpConfig.host || "",
    port: settings?.port || smtpConfig.port,
    user: settings?.user || smtpConfig.user || "",
    pass: settings?.pass ? "••••••••" : "", // Masked to preserve secure rest storage
    from: settings?.from || smtpConfig.from || ""
  });
});

export const postSmtpSettingsHandler = asyncHandler(async (req: Request, res: Response) => {
  const { host, port, user, pass, from } = req.body;
  
  checkRequiredFields(req.body, ["host", "port", "user", "pass"]);

  const existingSettings = getSmtpSettings();
  let finalPass = String(pass);

  if (finalPass === "••••••••") {
    if (!existingSettings?.pass) {
      throw new AppError("No existing password found. Please provide a valid SMTP password.", 400);
    }
    finalPass = existingSettings.pass;
  } else {
    finalPass = encryptText(finalPass);
  }

  const smtpSettings = {
    host: String(host).trim(),
    port: Number(port) || 587,
    user: String(user).trim(),
    pass: finalPass,
    from: String(from || "").trim()
  };

  // Validate credentials & host connection before writing
  try {
    await verifySmtpConnection(smtpSettings);
  } catch (err: any) {
    throw new AppError(`SMTP Connection Verification Failed: ${err.message}`, 400);
  }

  saveSmtpSettings(smtpSettings);

  res.json({
    success: true,
    message: "SMTP credentials validated and saved successfully! / تم التحقق من خادم البريد وحفظ البيانات بنجاح"
  });
});

export const postTestConnection = asyncHandler(async (req: Request, res: Response) => {
  const { host, port, user, pass } = req.body;
  checkRequiredFields(req.body, ["host", "port", "user", "pass"]);

  const existingSettings = getSmtpSettings();
  let finalPass = String(pass);

  if (finalPass === "••••••••") {
    if (!existingSettings?.pass) {
      throw new AppError("No existing password found.", 400);
    }
    finalPass = existingSettings.pass;
  } else {
    finalPass = encryptText(finalPass);
  }

  const smtpSettings = {
    host: String(host).trim(),
    port: Number(port) || 587,
    user: String(user).trim(),
    pass: finalPass,
    from: ""
  };

  try {
    await verifySmtpConnection(smtpSettings);
    res.json({
      success: true,
      message: "SMTP Connection verified successfully! / تم الاتصال بخادم البريد بنجاح"
    });
  } catch (err: any) {
    throw new AppError(`SMTP Verification Failed: ${err.message}`, 400);
  }
});

export const postTestEmail = asyncHandler(async (req: Request, res: Response) => {
  const { host, port, user, pass, toEmail } = req.body;
  checkRequiredFields(req.body, ["host", "port", "user", "pass", "toEmail"]);

  const existingSettings = getSmtpSettings();
  let finalPass = String(pass);

  if (finalPass === "••••••••") {
    if (!existingSettings?.pass) {
      throw new AppError("No existing password found.", 400);
    }
    finalPass = existingSettings.pass;
  } else {
    finalPass = encryptText(finalPass);
  }

  const smtpSettings = {
    host: String(host).trim(),
    port: Number(port) || 587,
    user: String(user).trim(),
    pass: finalPass,
    from: `"${user}" <${user}>`
  };

  try {
    await sendTestEmail(smtpSettings, String(toEmail).trim());
    res.json({
      success: true,
      message: `Test email sent successfully to ${toEmail}! / تم إرسال بريد الاختبار بنجاح`
    });
  } catch (err: any) {
    throw new AppError(`SMTP Send Test Failed: ${err.message}`, 400);
  }
});

export const postSendReportEmail = asyncHandler(async (req: Request, res: Response) => {
  const { email, reportDate, stats } = req.body;
  const targetEmail = email || getReportEmail();

  if (!targetEmail || !targetEmail.trim()) {
    throw new AppError("No destination email configured. Please configure an email first in the Reports or Settings tab / لم يتم إعداد بريد إلكتروني مستهدف", 400);
  }

  const result = await sendDailyReportEmail(targetEmail.trim(), reportDate, stats);
  res.json(result);
});
