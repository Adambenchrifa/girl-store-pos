import nodemailer from "nodemailer";
import { getSmtpSettings } from "../database";
import { smtpConfig } from "../config/index";
import { DailyReportStats, SmtpSettings, TopSoldProduct } from "../types";
import { decryptText } from "../utils/crypto";

export async function verifySmtpConnection(settings: SmtpSettings) {
  const host = settings.host;
  const port = Number(settings.port) || 587;
  const user = settings.user;
  const pass = decryptText(settings.pass);

  if (!host || !user || !pass) {
    throw new Error("Host, Username, and Password are required to verify connection.");
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass
    },
    connectionTimeout: 8000,
    greetingTimeout: 8000
  });

  await transporter.verify();
  return true;
}

export async function sendTestEmail(settings: SmtpSettings, toEmail: string) {
  const host = settings.host;
  const port = Number(settings.port) || 587;
  const user = settings.user;
  const pass = decryptText(settings.pass);
  const from = settings.from || `"${user}" <${user}>`;

  if (!host || !user || !pass) {
    throw new Error("Host, Username, and Password are required to send a test email.");
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass
    }
  });

  await transporter.sendMail({
    from,
    to: toEmail,
    subject: "🧪 Test SMTP Connection Success | اختبار الاتصال",
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; border: 1px solid #e0e7ff; border-radius: 12px; padding: 24px; background-color: #fcfdff; text-align: center;">
        <h2 style="color: #4f46e5; margin-top: 0;">SMTP Test Successful!</h2>
        <p style="color: #4b5563; font-size: 14px;">Your Girl Store POS system SMTP mail server has been configured correctly.</p>
        <div style="background-color: #eff6ff; padding: 12px; border-radius: 8px; font-family: monospace; font-size: 12px; text-align: left; color: #1e40af; margin-top: 16px;">
          <strong>Host:</strong> ${host}<br/>
          <strong>Port:</strong> ${port}<br/>
          <strong>User:</strong> ${user}
        </div>
        <p style="font-size: 11px; color: #9ca3af; margin-top: 24px;">© 2026 Girl Store POS</p>
      </div>
    `
  });
  return true;
}

export async function sendDailyReportEmail(toEmail: string, reportDate: string, stats: DailyReportStats) {
  const dbSmtp = (getSmtpSettings() || {}) as Partial<SmtpSettings>;
  const host = dbSmtp.host || smtpConfig.host;
  const port = dbSmtp.port ? Number(dbSmtp.port) : (dbSmtp.port === 0 ? 0 : smtpConfig.port);
  const user = dbSmtp.user || smtpConfig.user;
  const rawPass = dbSmtp.pass || smtpConfig.pass;
  const pass = decryptText(rawPass);
  const from = dbSmtp.from || smtpConfig.from;

  const subject = `📊 Daily Sales & Profit Report - ${reportDate} | تقرير الأرباح والمبيعات`;

  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 16px; overflow: hidden; background-color: #ffffff; color: #1f2937;">
      <div style="background-color: #4f46e5; color: #ffffff; padding: 28px; text-align: center;">
        <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 0.05em;">GIRL STORE</h1>
        <p style="margin: 6px 0 0 0; font-size: 14px; opacity: 0.9;">Daily Financial Report | تقرير المبيعات والأرباح اليومي</p>
        <div style="display: inline-block; background-color: rgba(255,255,255,0.18); padding: 6px 16px; border-radius: 9999px; font-size: 12px; margin-top: 14px; font-weight: bold; letter-spacing: 0.02em;">
          ${reportDate}
        </div>
      </div>
      
      <div style="padding: 24px; background-color: #f9fafb;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 24px;">
          <div style="background-color: #ffffff; padding: 14px; border: 1px solid #e5e7eb; border-radius: 12px; text-align: center;">
            <span style="display: block; font-size: 10px; color: #6b7280; text-transform: uppercase; font-weight: bold; margin-bottom: 4px;">Daily Revenue / المبيعات</span>
            <span style="font-size: 16px; font-weight: bold; color: #111827;">${stats.dailyRevenue.toFixed(2)} DH</span>
          </div>
          <div style="background-color: #ffffff; padding: 14px; border: 1px solid #e5e7eb; border-radius: 12px; text-align: center;">
            <span style="display: block; font-size: 10px; color: #6b7280; text-transform: uppercase; font-weight: bold; margin-bottom: 4px;">Daily Expenses / المصاريف</span>
            <span style="font-size: 16px; font-weight: bold; color: #ef4444;">${stats.dailyExpenses.toFixed(2)} DH</span>
          </div>
          <div style="background-color: #ffffff; padding: 14px; border: 1px solid #e5e7eb; border-radius: 12px; text-align: center;">
            <span style="display: block; font-size: 10px; color: #6b7280; text-transform: uppercase; font-weight: bold; margin-bottom: 4px;">Goods Profit / أرباح السلع</span>
            <span style="font-size: 16px; font-weight: bold; color: #10b981;">${stats.dailyGoodsProfit.toFixed(2)} DH</span>
          </div>
          <div style="background-color: #e0e7ff; padding: 14px; border: 1px solid #c7d2fe; border-radius: 12px; text-align: center;">
            <span style="display: block; font-size: 10px; color: #4338ca; text-transform: uppercase; font-weight: bold; margin-bottom: 4px;">Net Profit / الأرباح الصافية</span>
            <span style="font-size: 16px; font-weight: bold; color: #3730a3;">${stats.dailyNetProfit.toFixed(2)} DH</span>
          </div>
        </div>

        <div style="background-color: #ffffff; padding: 18px; border: 1px solid #e5e7eb; border-radius: 12px; margin-bottom: 24px;">
          <h3 style="margin-top: 0; margin-bottom: 12px; font-size: 12px; color: #4b5563; border-bottom: 1px solid #f3f4f6; padding-bottom: 8px; text-transform: uppercase; font-weight: 700;">
            Transactions Stats / إحصائيات عامة
          </h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #374151;">
            <tr>
              <td style="padding: 6px 0;">Total Sales Checkout / عدد المبيعات:</td>
              <td style="padding: 6px 0; text-align: right; font-weight: bold; color: #111827;">${stats.dailySalesCount} Bills</td>
            </tr>
            <tr>
              <td style="padding: 6px 0;">Cumulated Sales (All Time) / مجموع المداخيل:</td>
              <td style="padding: 6px 0; text-align: right; font-weight: bold; color: #111827;">${stats.totalRevenue.toFixed(2)} DH</td>
            </tr>
            <tr>
              <td style="padding: 6px 0;">Cumulated Net Profit (All Time) / مجموع الأرباح الصافية:</td>
              <td style="padding: 6px 0; text-align: right; font-weight: bold; color: #10b981;">${stats.netProfit.toFixed(2)} DH</td>
            </tr>
          </table>
        </div>

        ${stats.topProducts && stats.topProducts.length > 0 ? `
        <div style="background-color: #ffffff; padding: 18px; border: 1px solid #e5e7eb; border-radius: 12px;">
          <h3 style="margin-top: 0; margin-bottom: 12px; font-size: 12px; color: #4b5563; border-bottom: 1px solid #f3f4f6; padding-bottom: 8px; text-transform: uppercase; font-weight: 700;">
            Best Sellers Today / الأكثر مبيعاً اليوم
          </h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px; color: #374151;">
            <thead>
              <tr style="border-bottom: 1px solid #e5e7eb; text-align: left; color: #6b7280; font-weight: bold;">
                <th style="padding: 6px 0;">Product / المنتج</th>
                <th style="padding: 6px 0; text-align: center;">Qty / الكمية</th>
                <th style="padding: 6px 0; text-align: right;">Revenue / الدخل</th>
              </tr>
            </thead>
            <tbody>
              ${stats.topProducts.slice(0, 5).map((p: TopSoldProduct) => `
                <tr style="border-bottom: 1px dotted #f3f4f6;">
                  <td style="padding: 8px 0; font-weight: 500; color: #111827;">${p.name}</td>
                  <td style="padding: 8px 0; text-align: center; font-weight: bold; color: #4b5563;">${p.quantity}</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #4f46e5;">${p.revenue.toFixed(2)} DH</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
        ` : ""}
      </div>

      <div style="background-color: #f3f4f6; padding: 16px; text-align: center; font-size: 11px; color: #9ca3af; border-top: 1px solid #e5e7eb;">
        <p style="margin: 0;">This email was generated automatically by the Girl Store POS System.</p>
        <p style="margin: 4px 0 0 0;">© 2026 Girl Store POS. All rights reserved.</p>
      </div>
    </div>
  `;

  if (host && user && pass) {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass
      }
    });

    await transporter.sendMail({
      from,
      to: toEmail,
      subject,
      html: htmlContent
    });

    return { success: true, realSent: true };
  } else {
    console.log(`\n======================================================`);
    console.log(`[EMAIL SIMULATION] Sending Daily Report to ${toEmail}`);
    console.log(`Subject: ${subject}`);
    console.log(`Daily Revenue: ${stats.dailyRevenue} DH`);
    console.log(`Daily Expenses: ${stats.dailyExpenses} DH`);
    console.log(`Daily Net Profit: ${stats.dailyNetProfit} DH`);
    console.log(`======================================================\n`);

    return {
      success: true,
      realSent: false,
      simulatedContent: {
        to: toEmail,
        subject,
        stats,
        htmlContent
      }
    };
  }
}
