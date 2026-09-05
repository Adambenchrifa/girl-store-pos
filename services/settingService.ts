import { AppError } from "../middleware/error";
import { checkRequiredFields } from "../utils/validation";
import { smtpConfig } from "../config/index";
import {
  getReportEmail as dbGetReportEmail,
  saveReportEmail as dbSaveReportEmail,
  getSmtpSettings as dbGetSmtpSettings,
  saveSmtpSettings as dbSaveSmtpSettings
} from "../database";
import { sendDailyReportEmail, verifySmtpConnection, sendTestEmail } from "./emailService";
import { encryptText } from "../utils/crypto";

export function getReportEmailSetting(): { email: string } {
  return { email: dbGetReportEmail() };
}

export function updateReportEmailSetting(email?: string): { email: string } {
  if (email !== undefined) {
    dbSaveReportEmail(String(email).trim());
  }
  return { email: dbGetReportEmail() };
}

export function getSmtpSettingsConfig() {
  const settings = dbGetSmtpSettings();
  return {
    host: settings?.host || smtpConfig.host || "",
    port: settings?.port || smtpConfig.port,
    user: settings?.user || smtpConfig.user || "",
    pass: settings?.pass ? "••••••••" : "", // Masked to preserve secure rest storage
    from: settings?.from || smtpConfig.from || ""
  };
}

export interface SaveSmtpData extends Record<string, unknown> {
  host: string;
  port: number | string;
  user: string;
  pass: string;
  from?: string;
}

export async function saveSmtpSettingsConfig(data: SaveSmtpData): Promise<void> {
  const { host, port, user, pass, from } = data;
  checkRequiredFields(data, ["host", "port", "user", "pass"]);

  const existingSettings = dbGetSmtpSettings();
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

  dbSaveSmtpSettings(smtpSettings);
}

export interface TestSmtpConnectionData extends Record<string, unknown> {
  host: string;
  port: number | string;
  user: string;
  pass: string;
}

export async function testSmtpConnection(data: TestSmtpConnectionData): Promise<void> {
  const { host, port, user, pass } = data;
  checkRequiredFields(data, ["host", "port", "user", "pass"]);

  const existingSettings = dbGetSmtpSettings();
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
  } catch (err: any) {
    throw new AppError(`SMTP Verification Failed: ${err.message}`, 400);
  }
}

export interface SendTestEmailData extends Record<string, unknown> {
  host: string;
  port: number | string;
  user: string;
  pass: string;
  toEmail: string;
}

export async function sendTestSmtpEmail(data: SendTestEmailData): Promise<void> {
  const { host, port, user, pass, toEmail } = data;
  checkRequiredFields(data, ["host", "port", "user", "pass", "toEmail"]);

  const existingSettings = dbGetSmtpSettings();
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
  } catch (err: any) {
    throw new AppError(`SMTP Send Test Failed: ${err.message}`, 400);
  }
}

export interface SendReportData {
  email?: string;
  reportDate?: string;
  stats?: any;
}

export async function sendDailyReport(data: SendReportData) {
  const { email, reportDate, stats } = data;
  const targetEmail = email || dbGetReportEmail();

  if (!targetEmail || !targetEmail.trim()) {
    throw new AppError("No destination email configured. Please configure an email first in the Reports or Settings tab / لم يتم إعداد بريد إلكتروني مستهدف", 400);
  }

  return await sendDailyReportEmail(targetEmail.trim(), reportDate, stats);
}
