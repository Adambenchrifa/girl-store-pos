import { Request, Response } from "express";
import { asyncHandler } from "../middleware/error";
import {
  getReportEmailSetting,
  updateReportEmailSetting,
  getSmtpSettingsConfig,
  saveSmtpSettingsConfig,
  testSmtpConnection,
  sendTestSmtpEmail,
  sendDailyReport
} from "../services/settingService";

export const getEmailSettings = asyncHandler(async (req: Request, res: Response) => {
  res.json(getReportEmailSetting());
});

export const postEmailSettings = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;
  const result = updateReportEmailSetting(email);
  res.json({
    success: true,
    email: result.email,
    message: "Daily report email updated successfully! / تم تحديث البريد الإلكتروني للتقارير بنجاح"
  });
});

export const getSmtpSettingsHandler = asyncHandler(async (req: Request, res: Response) => {
  res.json(getSmtpSettingsConfig());
});

export const postSmtpSettingsHandler = asyncHandler(async (req: Request, res: Response) => {
  await saveSmtpSettingsConfig(req.body);
  res.json({
    success: true,
    message: "SMTP credentials validated and saved successfully! / تم التحقق من خادم البريد وحفظ البيانات بنجاح"
  });
});

export const postTestConnection = asyncHandler(async (req: Request, res: Response) => {
  await testSmtpConnection(req.body);
  res.json({
    success: true,
    message: "SMTP Connection verified successfully! / تم الاتصال بخادم البريد بنجاح"
  });
});

export const postTestEmail = asyncHandler(async (req: Request, res: Response) => {
  const { toEmail } = req.body;
  await sendTestSmtpEmail(req.body);
  res.json({
    success: true,
    message: `Test email sent successfully to ${toEmail}! / تم إرسال بريد الاختبار بنجاح`
  });
});

export const postSendReportEmail = asyncHandler(async (req: Request, res: Response) => {
  const result = await sendDailyReport(req.body);
  res.json(result);
});
