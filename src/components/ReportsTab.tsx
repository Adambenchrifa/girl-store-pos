/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { DollarSign, BarChart3, User, RefreshCw, Award, Mail, Send, Check, Settings, CheckCircle2, Printer, Laptop } from 'lucide-react';
import { Sale, Expense, Product } from '../types';

interface ReportsTabProps {
  sales: Sale[];
  expenses: Expense[];
  products: Product[];
}

interface ExtendedStats {
  dailyRevenue: number;
  dailySalesCount: number;
  dailyExpenses: number;
  dailyGoodsProfit: number;
  dailyNetProfit: number;

  totalRevenue: number;
  totalExpenses: number;
  goodsProfit: number;
  netProfit: number;

  topProducts: {
    name: string;
    quantity: number;
    revenue: number;
  }[];
}

export default function ReportsTab({ sales, expenses, products }: ReportsTabProps) {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [errorWord, setErrorWord] = useState<string | null>(null);

  // Email Reports states
  const [configuredEmail, setConfiguredEmail] = useState('');
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSuccessMsg, setEmailSuccessMsg] = useState<string | null>(null);
  const [emailErrorMsg, setEmailErrorMsg] = useState<string | null>(null);
  const [sentReportPreview, setSentReportPreview] = useState<any | null>(null);

  // SMTP Server Settings States
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpFrom, setSmtpFrom] = useState('');
  const [showSmtpSettings, setShowSmtpSettings] = useState(false);
  const [isSavingSmtp, setIsSavingSmtp] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);

  // Native Electron Desktop Settings States
  const [isElectron, setIsElectron] = useState(false);
  const [printers, setPrinters] = useState<{ name: string; isDefault: boolean }[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState('');
  const [silentPrinting, setSilentPrinting] = useState(false);
  const [autoStart, setAutoStart] = useState(false);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);

  useEffect(() => {
    const electronAPI = (window as any).electronAPI;
    if (electronAPI) {
      setIsElectron(true);
      
      // Load saved printer preferences from local storage
      const savedPrinter = localStorage.getItem('girlstore_active_printer') || '';
      setSelectedPrinter(savedPrinter);
      const isSilent = localStorage.getItem('girlstore_silent_printing') === 'true';
      setSilentPrinting(isSilent);

      // Fetch system printers list
      electronAPI.getPrinters().then((list: any[]) => {
        setPrinters(list || []);
        if (!savedPrinter && list && list.length > 0) {
          const defaultPrinter = list.find(p => p.isDefault) || list[0];
          setSelectedPrinter(defaultPrinter.name);
          localStorage.setItem('girlstore_active_printer', defaultPrinter.name);
        }
      }).catch((err: any) => console.error("Error loading printers list:", err));

      // Fetch windows auto-start boot status
      electronAPI.checkAutoStart().then((res: any) => {
        if (res && res.success) {
          setAutoStart(res.enabled);
        }
      }).catch((err: any) => console.error("Error checking auto-start:", err));
    }
  }, []);

  const handleToggleSilentPrinting = (enabled: boolean) => {
    setSilentPrinting(enabled);
    localStorage.setItem('girlstore_silent_printing', String(enabled));
    if ((window as any).electronAPI) {
      (window as any).electronAPI.logMessage('INFO', 'settings', `Silent printing preference set to: ${enabled}`);
    }
  };

  const handlePrinterChange = (name: string) => {
    setSelectedPrinter(name);
    localStorage.setItem('girlstore_active_printer', name);
    if ((window as any).electronAPI) {
      (window as any).electronAPI.logMessage('INFO', 'settings', `Target thermal printer device set to: ${name}`);
    }
  };

  const handleToggleAutoStart = async (enable: boolean) => {
    const electronAPI = (window as any).electronAPI;
    if (electronAPI) {
      try {
        const res = await electronAPI.toggleAutoStart(enable);
        if (res && res.success) {
          setAutoStart(enable);
        }
      } catch (err) {
        console.error("Failed to register Windows auto-start item:", err);
      }
    }
  };

  const handleCheckForUpdates = async () => {
    const electronAPI = (window as any).electronAPI;
    if (electronAPI) {
      setCheckingUpdates(true);
      setUpdateMessage(null);
      try {
        const res = await electronAPI.checkForUpdates();
        if (res && res.success) {
          setUpdateMessage(res.message);
        }
      } catch (err: any) {
        setUpdateMessage("Auto-update connection failed: " + err.message);
      } finally {
        setCheckingUpdates(false);
      }
    }
  };

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    setEmailSuccessMsg(null);
    setEmailErrorMsg(null);
    try {
      const response = await fetch('/api/settings/smtp/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: smtpHost,
          port: Number(smtpPort) || 587,
          user: smtpUser,
          pass: smtpPass
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to verify SMTP server connection.");
      setEmailSuccessMsg("SMTP Connection Verified Successfully! Your settings are correct. / تم الاتصال بخادم البريد بنجاح! الإعدادات صحيحة");
    } catch (err: any) {
      setEmailErrorMsg(err.message || "Failed to test SMTP Connection.");
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleTestEmail = async () => {
    const destination = prompt("Enter destination email address to send test message: / أدخل البريد الإلكتروني لإرسال رسالة تجريبية", configuredEmail || smtpUser);
    if (!destination) return;
    
    setIsSendingTestEmail(true);
    setEmailSuccessMsg(null);
    setEmailErrorMsg(null);
    try {
      const response = await fetch('/api/settings/smtp/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: smtpHost,
          port: Number(smtpPort) || 587,
          user: smtpUser,
          pass: smtpPass,
          toEmail: destination
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to send test email.");
      setEmailSuccessMsg(`Test email sent successfully to ${destination}! Please check your inbox. / تم إرسال البريد الإلكتروني التجريبي بنجاح إلى ${destination}`);
    } catch (err: any) {
      setEmailErrorMsg(err.message || "Failed to send test email.");
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  const fetchEmailSettings = async () => {
    try {
      const response = await fetch('/api/settings/email');
      if (response.ok) {
        const data = await response.json();
        setConfiguredEmail(data.email || '');
      }
    } catch (err) {
      console.error("Failed to load email settings:", err);
    }
  };

  const fetchSmtpSettings = async () => {
    try {
      const response = await fetch('/api/settings/smtp');
      if (response.ok) {
        const data = await response.json();
        setSmtpHost(data.host || '');
        setSmtpPort(data.port ? String(data.port) : '587');
        setSmtpUser(data.user || '');
        setSmtpPass(data.pass || '');
        setSmtpFrom(data.from || '');
      }
    } catch (err) {
      console.error("Failed to load SMTP settings:", err);
    }
  };

  useEffect(() => {
    fetchEmailSettings();
    fetchSmtpSettings();
  }, []);

  const handleSaveSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSmtp(true);
    setEmailSuccessMsg(null);
    setEmailErrorMsg(null);
    try {
      const response = await fetch('/api/settings/smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: smtpHost,
          port: Number(smtpPort) || 587,
          user: smtpUser,
          pass: smtpPass,
          from: smtpFrom
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to update SMTP settings.");
      setEmailSuccessMsg("SMTP configurations updated successfully! / تم حفظ إعدادات إرسال البريد الإلكتروني بنجاح");
    } catch (err: any) {
      setEmailErrorMsg(err.message || "Failed to save SMTP settings.");
    } finally {
      setIsSavingSmtp(false);
    }
  };

  const handleSaveEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingEmail(true);
    setEmailSuccessMsg(null);
    setEmailErrorMsg(null);
    try {
      const response = await fetch('/api/settings/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: configuredEmail })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to update email.");
      setEmailSuccessMsg("Report email address saved successfully! / تم حفظ البريد الإلكتروني بنجاح");
    } catch (err: any) {
      setEmailErrorMsg(err.message || "Failed to save email address.");
    } finally {
      setIsSavingEmail(false);
    }
  };

  const handleSendReportEmail = async () => {
    if (!configuredEmail.trim()) {
      setEmailErrorMsg("Please enter and save a valid email address first. / يرجى إدخال بريد إلكتروني أولاً");
      return;
    }
    setIsSendingEmail(true);
    setEmailSuccessMsg(null);
    setEmailErrorMsg(null);
    setSentReportPreview(null);
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const response = await fetch('/api/reports/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: configuredEmail,
          reportDate: todayStr,
          stats: stats
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to send email report.");
      
      if (data.realSent) {
        setEmailSuccessMsg("Today's report sent successfully to your email! / تم إرسال التقرير اليومي إلى بريدك الإلكتروني بنجاح");
      } else {
        setEmailSuccessMsg("Report generated successfully (Simulation mode - details logged)! / تم توليد التقرير بنجاح (وضع المحاكاة)");
        if (data.simulatedContent) {
          setSentReportPreview(data.simulatedContent);
        }
      }
    } catch (err: any) {
      setEmailErrorMsg(err.message || "Failed to send daily email report.");
    } finally {
      setIsSendingEmail(false);
    }
  };

  const calculateStats = React.useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  const stats = React.useMemo<ExtendedStats | null>(() => {
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const todaySales = sales.filter(s => s.dateTime.startsWith(todayStr));
      
      // 1. Daily metrics
      const dailyRevenue = todaySales.reduce((acc, s) => acc + s.total, 0);
      const dailyExpenses = expenses.filter(e => e.date === todayStr).reduce((acc, e) => acc + e.amount, 0);
      
      let dailyGoodsProfit = 0;
      todaySales.forEach((sale) => {
        sale.items.forEach((item) => {
          const matchedProd = products.find(p => p.id === item.productId);
          const purchasePrice = item.purchasePrice !== undefined 
            ? item.purchasePrice 
            : (matchedProd?.purchasePrice !== undefined ? matchedProd.purchasePrice : 0);
          dailyGoodsProfit += (item.price - purchasePrice) * item.quantity;
        });
      });
      const dailyNetProfit = dailyGoodsProfit - dailyExpenses;

      // 2. All-Time Cumulative metrics
      const totalRevenue = sales.reduce((acc, s) => acc + s.total, 0);
      const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);

      let goodsProfit = 0;
      sales.forEach((sale) => {
        sale.items.forEach((item) => {
          const matchedProd = products.find(p => p.id === item.productId);
          const purchasePrice = item.purchasePrice !== undefined 
            ? item.purchasePrice 
            : (matchedProd?.purchasePrice !== undefined ? matchedProd.purchasePrice : 0);
          goodsProfit += (item.price - purchasePrice) * item.quantity;
        });
      });
      const netProfit = goodsProfit - totalExpenses;

      // 3. Best-Selling sleepwear products
      const itemsMap: { [name: string]: { qty: number; rev: number } } = {};
      sales.forEach((sale) => {
        sale.items.forEach((item) => {
          if (!itemsMap[item.productName]) {
            itemsMap[item.productName] = { qty: 0, rev: 0 };
          }
          itemsMap[item.productName].qty += item.quantity;
          itemsMap[item.productName].rev += item.total;
        });
      });

      const topProducts = Object.entries(itemsMap)
        .map(([name, val]) => ({
          name,
          quantity: val.qty,
          revenue: Number(val.rev.toFixed(2))
        }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5);

      return {
        dailyRevenue,
        dailySalesCount: todaySales.length,
        dailyExpenses,
        dailyGoodsProfit,
        dailyNetProfit,
        totalRevenue,
        totalExpenses,
        goodsProfit,
        netProfit,
        topProducts
      };
    } catch (e: any) {
      console.error(e);
      return null;
    }
  }, [sales, expenses, products, refreshTrigger]);

  if (!stats) {
    return (
      <div className="py-24 text-center font-mono text-xs text-zinc-500 animate-pulse">
        Compiling transaction reports and aggregate balance sheets...
      </div>
    );
  }

  const {
    dailyRevenue,
    dailyExpenses,
    dailyNetProfit,
    totalRevenue,
    totalExpenses,
    goodsProfit,
    netProfit,
    topProducts
  } = stats;

  const isNetPositive = netProfit >= 0;
  const isDailyPositive = dailyNetProfit >= 0;

  // Best seller product (most sold)
  const bestSeller = topProducts[0] || null;

  // Let's normalize sales and expenses points for custom SVG chart representation
  const chartHeight = 120;
  const maxVal = Math.max(totalRevenue, totalExpenses, 300);
  const revHeight = maxVal > 0 ? (totalRevenue / maxVal) * chartHeight : 4;
  const expHeight = maxVal > 0 ? (totalExpenses / maxVal) * chartHeight : 4;

  return (
    <div id="reports-tab-content" className="space-y-6">
      
      {/* Tab Header branding */}
      <div className="flex justify-between items-center bg-[#161616] p-5 rounded-2xl border border-white/5 shadow-md">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-indigo-400 font-semibold">Administrative Register</span>
          <h1 className="font-sans text-xl tracking-tight text-white font-light mt-1">Analytics & Balance Sheet</h1>
        </div>
        <button
          id="refresh-stats-btn"
          onClick={calculateStats}
          className="p-2 w-10 h-10 bg-white/5 border border-white/5 rounded-xl text-slate-400 hover:text-white flex items-center justify-center transition-colors hover:bg-white/10"
          title="Recalculate statistics sheet"
        >
          <RefreshCw size={15} />
        </button>
      </div>

      {/* 📬 Daily Report Email Configuration Panel */}
      <div className="bg-[#161616] p-5 border border-white/5 rounded-2xl shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-3">
          <div className="space-y-1">
            <h3 className="text-xs font-mono uppercase tracking-wider text-indigo-400 flex items-center gap-2 font-semibold">
              <Mail size={15} /> Daily Report Email Delivery / تقرير الأرباح اليومية عبر البريد الإلكتروني
            </h3>
            <p className="text-xs text-slate-400">
              Configure your email address to receive daily profit calculations, sales summaries, and custom statistics.
            </p>
            <p className="text-[10px] text-indigo-400 font-sans font-medium">
              اضبط عنوان بريدك الإلكتروني لتلقي حسابات الأرباح اليومية وملخصات المبيعات بالتاريخ.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowSmtpSettings(!showSmtpSettings)}
            className="px-3.5 py-2 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/5 rounded-xl text-[11px] font-medium flex items-center gap-1.5 transition-all self-start sm:self-center cursor-pointer whitespace-nowrap"
          >
            <Settings size={13} className={showSmtpSettings ? "animate-spin" : ""} />
            {showSmtpSettings ? "Hide SMTP / إخفاء الإعدادات" : "SMTP Server Settings / إعدادات خادم البريد"}
          </button>
        </div>

        {showSmtpSettings && (
          <form onSubmit={handleSaveSmtp} className="bg-black/35 p-5 border border-white/5 rounded-xl space-y-4">
            <div className="border-b border-white/5 pb-2">
              <h4 className="text-[11px] font-mono uppercase tracking-wider text-indigo-400 font-bold">
                SMTP Mail Server Configuration / إعدادات خادم SMTP لإرسال البريد الإلكتروني
              </h4>
              <p className="text-[10px] text-slate-500 mt-1">
                Enter your SMTP server details to send actual emails. If not provided, the system falls back to simulation mode or .env values.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              {/* Host */}
              <div className="md:col-span-4 space-y-1.5">
                <label className="text-[10px] text-slate-400 font-mono uppercase block">SMTP Host / خادم SMTP</label>
                <input
                  type="text"
                  placeholder="e.g. smtp.gmail.com"
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  className="w-full h-10 bg-black/40 border border-white/15 focus:border-indigo-500 rounded-xl px-3 text-xs text-slate-200 outline-none transition-all font-sans"
                  required
                />
              </div>

              {/* Port */}
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-[10px] text-slate-400 font-mono uppercase block">Port / المنفذ</label>
                <input
                  type="text"
                  placeholder="587 or 465"
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(e.target.value)}
                  className="w-full h-10 bg-black/40 border border-white/15 focus:border-indigo-500 rounded-xl px-3 text-xs text-slate-200 outline-none transition-all font-mono"
                  required
                />
              </div>

              {/* User */}
              <div className="md:col-span-3 space-y-1.5">
                <label className="text-[10px] text-slate-400 font-mono uppercase block">Username / اسم المستخدم (Email)</label>
                <input
                  type="email"
                  placeholder="e.g. your-email@gmail.com"
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                  className="w-full h-10 bg-black/40 border border-white/15 focus:border-indigo-500 rounded-xl px-3 text-xs text-slate-200 outline-none transition-all font-sans"
                  required
                />
              </div>

              {/* Pass */}
              <div className="md:col-span-3 space-y-1.5">
                <label className="text-[10px] text-slate-400 font-mono uppercase block">Password / كلمة المرور (App Password)</label>
                <input
                  type="password"
                  placeholder="SMTP/App Password"
                  value={smtpPass}
                  onChange={(e) => setSmtpPass(e.target.value)}
                  className="w-full h-10 bg-black/40 border border-white/15 focus:border-indigo-500 rounded-xl px-3 text-xs text-slate-200 outline-none transition-all font-sans"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end pt-2">
              {/* From */}
              <div className="md:col-span-6 space-y-1.5">
                <label className="text-[10px] text-slate-400 font-mono uppercase block">Sender From Header / اسم المرسل ومكان الإرسال</label>
                <input
                  type="text"
                  placeholder='e.g. "Girl Store" <your-email@gmail.com>'
                  value={smtpFrom}
                  onChange={(e) => setSmtpFrom(e.target.value)}
                  className="w-full h-10 bg-black/40 border border-white/15 focus:border-indigo-500 rounded-xl px-3 text-xs text-slate-200 outline-none transition-all font-sans"
                />
              </div>

              {/* Action Buttons */}
              <div className="md:col-span-6 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTestingConnection || !smtpHost || !smtpUser || !smtpPass}
                  className="h-10 bg-white/5 hover:bg-white/10 disabled:opacity-50 text-slate-300 rounded-xl text-[11px] font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-white/5"
                >
                  {isTestingConnection ? (
                    <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                  ) : (
                    <CheckCircle2 size={13} className="text-indigo-400" />
                  )}
                  Test Conn
                </button>

                <button
                  type="button"
                  onClick={handleTestEmail}
                  disabled={isSendingTestEmail || !smtpHost || !smtpUser || !smtpPass}
                  className="h-10 bg-white/5 hover:bg-white/10 disabled:opacity-50 text-slate-300 rounded-xl text-[11px] font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-white/5"
                >
                  {isSendingTestEmail ? (
                    <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                  ) : (
                    <Send size={12} className="text-indigo-400" />
                  )}
                  Test Mail
                </button>

                <button
                  type="submit"
                  disabled={isSavingSmtp}
                  className="h-10 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-indigo-600/15"
                >
                  {isSavingSmtp ? (
                    <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  ) : (
                    <Check size={13} />
                  )}
                  Save SMTP
                </button>
              </div>
            </div>
          </form>
        )}

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <form onSubmit={handleSaveEmail} className="md:col-span-8 flex flex-col sm:flex-row gap-3 w-full">
            <div className="relative flex-1">
              <input
                type="email"
                placeholder="Enter your email address (e.g. example@gmail.com)"
                value={configuredEmail}
                onChange={(e) => setConfiguredEmail(e.target.value)}
                className="w-full h-11 bg-black/40 border border-white/15 focus:border-indigo-500 rounded-xl pl-10 pr-4 text-xs text-slate-200 outline-none transition-all placeholder-slate-700 font-sans"
                required
              />
              <div className="absolute left-3.5 top-3.5 text-slate-600">
                <Mail size={16} />
              </div>
            </div>
            <button
              type="submit"
              disabled={isSavingEmail}
              className="h-11 px-6 bg-white/5 hover:bg-white/10 text-white border border-white/5 hover:border-white/10 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap shrink-0"
            >
              {isSavingEmail ? (
                <span className="inline-block w-4 h-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
              ) : (
                <Check size={14} className="text-emerald-400" />
              )}
              Save Email / حفظ البريد
            </button>
          </form>

          <div className="md:col-span-4 w-full">
            <button
              onClick={handleSendReportEmail}
              disabled={isSendingEmail || !configuredEmail}
              className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-950/20 disabled:text-slate-600 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/15 cursor-pointer whitespace-nowrap"
            >
              {isSendingEmail ? (
                <span className="inline-block w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              ) : (
                <Send size={13} />
              )}
              Send Today's Report / إرسال تقرير اليوم
            </button>
          </div>
        </div>

        {/* Feedback messages */}
        {emailSuccessMsg && (
          <div className="p-3 bg-emerald-950/20 border border-emerald-900/30 rounded-xl text-xs text-emerald-400 font-sans">
            {emailSuccessMsg}
          </div>
        )}

        {emailErrorMsg && (
          <div className="p-3 bg-red-950/20 border border-red-900/30 rounded-xl text-xs text-red-400 font-sans">
            {emailErrorMsg}
          </div>
        )}

        {/* Real-time Simulator Report Details Overlay/Drawer */}
        {sentReportPreview && (
          <div className="bg-black/35 p-5 border border-indigo-500/10 rounded-xl space-y-3">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-400 font-bold">
                Logged Email Report Output Preview (Simulation Mode)
              </span>
              <span className="text-[9px] font-sans text-slate-500">
                To send actual emails, configure your SMTP server credentials in Settings (.env)
              </span>
            </div>
            
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-400 font-mono text-[10px] mb-2">
                <span>To: <strong className="text-slate-200">{sentReportPreview.to}</strong></span>
                <span>Subject: <strong className="text-slate-200">{sentReportPreview.subject}</strong></span>
              </div>
              
              {/* HTML frame simulated */}
              <div 
                className="bg-white rounded-lg p-4 max-h-[300px] overflow-y-auto border border-white/10"
                dangerouslySetInnerHTML={{ __html: sentReportPreview.htmlContent }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 💻 Native Desktop Configuration Panel */}
      {isElectron && (
        <div className="bg-[#161616] p-5 border border-white/5 rounded-2xl shadow-xl space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center gap-3 border-b border-white/5 pb-3">
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl">
              <Laptop size={18} />
            </div>
            <div>
              <h3 className="text-sm font-sans font-medium text-slate-100 flex items-center gap-2">
                Desktop Client & Hardware Settings / إعدادات نظام الويندوز والأجهزة
              </h3>
              <p className="text-xs text-slate-400">
                Configure silent thermal receipt printing, local hardware devices, system boot settings, and client auto-updates.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left col: Printer configuration */}
            <div className="bg-black/25 p-4 rounded-xl border border-white/5 space-y-4">
              <h4 className="text-xs font-mono uppercase tracking-wider text-indigo-400 flex items-center gap-2 font-bold">
                <Printer size={14} /> Thermal Printer Configuration / إعدادات طابعة الفواتير
              </h4>

              <div className="space-y-4">
                {/* Printer Select */}
                <div className="space-y-2">
                  <label className="text-[10px] text-slate-400 font-mono uppercase block">Target Printer Device / اختر طابعة الفواتير</label>
                  {printers.length > 0 ? (
                    <select
                      value={selectedPrinter}
                      onChange={(e) => handlePrinterChange(e.target.value)}
                      className="w-full h-10 bg-black/40 border border-white/15 focus:border-indigo-500 rounded-xl px-3 text-xs text-slate-200 outline-none transition-all"
                    >
                      {printers.map((printer) => (
                        <option key={printer.name} value={printer.name} className="bg-zinc-950 text-slate-200">
                          {printer.name} {printer.isDefault ? ' (Default)' : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="text-xs text-slate-500 italic p-2 bg-black/20 rounded-lg">
                      No system printers detected. Standard print fallbacks will be used.
                    </div>
                  )}
                </div>

                {/* Silent printing toggle */}
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-slate-200 block">Silent Receipt Printing / طباعة فواتير بدون حوار</span>
                    <span className="text-[10px] text-slate-400 block">Skip browser print dialog and trigger thermal printer instantly on sales settlement</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleSilentPrinting(!silentPrinting)}
                    className={`w-12 h-6 rounded-full p-0.5 transition-colors duration-200 focus:outline-none cursor-pointer ${silentPrinting ? 'bg-indigo-600' : 'bg-slate-800'}`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white transition-transform duration-200 ${silentPrinting ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
            </div>

            {/* Right col: Windows Boot & Update triggers */}
            <div className="bg-black/25 p-4 rounded-xl border border-white/5 space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <h4 className="text-xs font-mono uppercase tracking-wider text-indigo-400 flex items-center gap-2 font-bold">
                  💻 Client Control & Auto-Run / التحكم في تشغيل النظام
                </h4>

                {/* Windows Auto-start toggle */}
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-slate-200 block">Run on Windows Startup / التشغيل عند بدء تشغيل الكمبيوتر</span>
                    <span className="text-[10px] text-slate-400 block">Automatically open Girl Store POS when you boot your sales register machine</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleAutoStart(!autoStart)}
                    className={`w-12 h-6 rounded-full p-0.5 transition-colors duration-200 focus:outline-none cursor-pointer ${autoStart ? 'bg-indigo-600' : 'bg-slate-800'}`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white transition-transform duration-200 ${autoStart ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>

                {/* Hardware details summary */}
                <div className="text-[10px] text-slate-400 font-mono space-y-1 bg-black/25 p-3 rounded-xl border border-white/5">
                  <div className="flex justify-between">
                    <span>Target Platform:</span>
                    <span className="text-indigo-400 font-bold">Microsoft Windows (x64)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Local Data Path:</span>
                    <span className="text-slate-300">userData/database</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Automatic USB Sync:</span>
                    <span className="text-emerald-400 font-semibold">Enabled (Plug-and-Play ready)</span>
                  </div>
                </div>
              </div>

              {/* Updates checker block */}
              <div className="pt-2 border-t border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-xs text-slate-300 block font-sans">App Updates Management</span>
                  {updateMessage && (
                    <span className="text-[10px] text-indigo-400 block font-semibold">{updateMessage}</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleCheckForUpdates}
                  disabled={checkingUpdates}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all self-end shrink-0 cursor-pointer shadow-md shadow-indigo-600/10"
                >
                  {checkingUpdates ? (
                    <span className="inline-block w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  ) : (
                    <RefreshCw size={11} />
                  )}
                  Check Updates
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Primary KPI Blocks Grid - 6 responsive metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        
        {/* Today's Sales */}
        <div className="bg-[#161616] p-4 border border-white/5 rounded-2xl shadow-lg relative overflow-hidden flex flex-col justify-between min-h-[120px]">
          <div>
            <div className="flex justify-between items-start">
              <span className="block text-[10px] font-mono text-slate-500 uppercase font-bold tracking-wider">Daily Sales</span>
              <span className="text-[9px] font-sans font-bold text-indigo-400">المداخيل اليومية</span>
            </div>
            <div className="text-lg font-mono text-white font-bold mt-2">
              {dailyRevenue.toFixed(2)} DH
            </div>
          </div>
          <span className="text-[9px] text-slate-500 font-sans block mt-1">Today's total gross sales</span>
        </div>

        {/* Today's Net Profit */}
        <div className="bg-[#161616] p-4 border border-[#22c55e]/10 rounded-2xl shadow-lg relative overflow-hidden flex flex-col justify-between min-h-[120px]">
          <div>
            <div className="flex justify-between items-start">
              <span className="block text-[10px] font-mono text-slate-500 uppercase font-bold tracking-wider">Daily Net Profit</span>
              <span className="text-[9px] font-sans font-bold text-emerald-400">الأرباح اليومية</span>
            </div>
            <div className={`text-lg font-mono font-bold mt-2 ${isDailyPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isDailyPositive ? '+' : ''}{dailyNetProfit.toFixed(2)} DH
            </div>
          </div>
          <span className="text-[9px] text-slate-500 font-sans block mt-1">Today's profit (Goods - Expenses)</span>
        </div>

        {/* Gross Sales Revenue (All Time) */}
        <div className="bg-[#161616] p-4 border border-white/5 rounded-2xl shadow-lg relative overflow-hidden flex flex-col justify-between min-h-[120px]">
          <div>
            <div className="flex justify-between items-start">
              <span className="block text-[10px] font-mono text-slate-500 uppercase font-bold tracking-wider">Total Sales</span>
              <span className="text-[9px] font-sans font-bold text-slate-400">مجموع المداخيل</span>
            </div>
            <div className="text-lg font-mono text-white font-bold mt-2">
              {totalRevenue.toFixed(2)} DH
            </div>
          </div>
          <span className="text-[9px] text-slate-500 font-sans block mt-1">All-time gross sales revenue</span>
        </div>

        {/* Total Expenses (All Time) */}
        <div className="bg-[#161616] p-4 border border-white/5 rounded-2xl shadow-lg relative overflow-hidden flex flex-col justify-between min-h-[120px]">
          <div>
            <div className="flex justify-between items-start">
              <span className="block text-[10px] font-mono text-slate-500 uppercase font-bold tracking-wider">Total Expenses</span>
              <span className="text-[9px] font-sans font-bold text-rose-400">مجموع المصاريف</span>
            </div>
            <div className="text-lg font-mono text-white font-bold mt-2">
              {totalExpenses.toFixed(2)} DH
            </div>
          </div>
          <span className="text-[9px] text-slate-500 font-sans block mt-1">All-time operational expenses</span>
        </div>

        {/* Gross Goods Profit */}
        <div className="bg-[#161616] p-4 border border-white/5 rounded-2xl shadow-lg relative overflow-hidden flex flex-col justify-between min-h-[120px]">
          <div>
            <div className="flex justify-between items-start">
              <span className="block text-[10px] font-mono text-slate-500 uppercase font-bold tracking-wider">Goods Profit</span>
              <span className="text-[9px] font-sans font-bold text-emerald-400">أرباح السلع</span>
            </div>
            <div className="text-lg font-mono text-emerald-400 font-bold mt-2">
              {goodsProfit.toFixed(2)} DH
            </div>
          </div>
          <span className="text-[9px] text-slate-500 font-sans block mt-1">Profit on items sold (Price - Cost)</span>
        </div>

        {/* Total Net Profit */}
        <div className="bg-[#161616] p-4 border border-[#818cf8]/10 rounded-2xl shadow-lg relative overflow-hidden flex flex-col justify-between min-h-[120px]">
          <div>
            <div className="flex justify-between items-start">
              <span className="block text-[10px] font-mono text-slate-500 uppercase font-bold tracking-wider">Net Profit</span>
              <span className="text-[9px] font-sans font-bold text-indigo-400">الأرباح الصافية</span>
            </div>
            <div className={`text-lg font-mono font-bold mt-2 ${isNetPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isNetPositive ? '+' : ''}{netProfit.toFixed(2)} DH
            </div>
          </div>
          <span className="text-[9px] text-slate-500 font-sans block mt-1">Final profit after operational expenses</span>
        </div>

      </div>

      {/* Most Sold Highlight Bar */}
      {bestSeller && (
        <div className="bg-[#161616] p-4 rounded-2xl border border-indigo-500/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative overflow-hidden shadow-md">
          <div className="absolute right-0 top-0 bottom-0 w-32 bg-indigo-600/5 pointer-events-none transform skew-x-12" />
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Award size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono uppercase bg-[#0F0F0F] px-2 py-0.5 rounded border border-white/5 text-slate-500 font-bold">BEST SELLER</span>
                <span className="text-[10px] font-sans text-indigo-400 font-semibold">المنتج الأكثر مبيعاً</span>
              </div>
              <h4 className="text-sm font-bold text-slate-200 mt-0.5">{bestSeller.name}</h4>
            </div>
          </div>
          <div className="flex items-center gap-4 shrink-0 font-mono">
            <div className="text-left sm:text-right">
              <span className="block text-[9px] uppercase text-slate-500">Volume Sold</span>
              <span className="text-sm font-bold text-white">{bestSeller.quantity} Units</span>
            </div>
            <div className="w-[1px] h-8 bg-white/10" />
            <div className="text-left sm:text-right">
              <span className="block text-[9px] uppercase text-slate-500">Generated Cash</span>
              <span className="text-sm font-bold text-indigo-400">{bestSeller.revenue.toFixed(2)} DH</span>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column - Profit Graph & Top moving pajamas itemized list */}
        <div className="lg:col-span-6 space-y-6">
          
          {/* Custom Elegant SVG Chart Card */}
          <div className="bg-[#161616] p-6 border border-white/5 rounded-2xl shadow-xl space-y-5">
            <h3 className="text-xs font-mono uppercase tracking-wider text-indigo-400 flex items-center gap-2 font-semibold">
              <BarChart3 size={15} /> Store Financial Matrix
            </h3>

            <div className="flex justify-center items-end py-6 bg-black/20 rounded-xl border border-white/5 p-4">
              
              <div className="flex gap-16 items-end h-[160px] relative w-full justify-center font-mono">
                
                {/* Revenue Bar representing Sales */}
                <div className="flex flex-col items-center gap-2 relative">
                  <span className="text-[10px] font-mono text-slate-400 font-bold">{totalRevenue.toFixed(0)} DH</span>
                  <div 
                    className="w-12 bg-[#818cf8]/80 hover:bg-[#818cf8] rounded-t-lg transition-all duration-300 shadow-md shadow-indigo-600/10"
                    style={{ height: `${Math.max(10, (revHeight / chartHeight) * 120)}px` }}
                  />
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Sales In</span>
                </div>

                {/* Expenses Bar representing Outflow */}
                <div className="flex flex-col items-center gap-2 relative">
                  <span className="text-[10px] font-mono text-slate-400 font-bold">{totalExpenses.toFixed(0)} DH</span>
                  <div 
                    className="w-12 bg-rose-500/70 rounded-t-lg transition-all duration-300 shadow-md shadow-rose-955/20 hover:bg-rose-500"
                    style={{ height: `${Math.max(10, (expHeight / chartHeight) * 120)}px` }}
                  />
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Expenses Out</span>
                </div>

                {/* Profit Margin indicator */}
                <div className="flex flex-col items-center gap-2 relative">
                  <span className={`text-[10px] font-mono font-bold ${isNetPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {netProfit.toFixed(0)} DH
                  </span>
                  <div 
                    className={`w-12 rounded-t-lg transition-all duration-300 shadow-md ${
                      isNetPositive ? 'bg-emerald-500/80 hover:bg-emerald-500' : 'bg-red-950/40 hover:bg-red-900/40'
                    }`}
                    style={{ height: `${Math.max(10, (Math.abs(netProfit) / maxVal) * 120)}px` }}
                  />
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Net Return</span>
                </div>

              </div>

            </div>

            <p className="text-[10px] text-slate-500 leading-normal font-sans">
              *The graph displays cumulative sales income logged on checkout registers against total overhead payouts recorded in the expenses ledger sheet. 
            </p>
          </div>

          {/* Top-Selling Pajamas cards list */}
          <div className="bg-[#161616] p-6 border border-white/5 rounded-2xl shadow-xl space-y-4">
            <h3 className="text-xs font-mono uppercase tracking-wider text-indigo-400 border-b border-white/5 pb-3 font-semibold">
              🔥 Top-Selling Sleepwear
            </h3>

            {topProducts.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs italic">
                No orders compiled yet so best sellers statistics aren't available.
              </div>
            ) : (
              <div className="space-y-3">
                {topProducts.map((item, index) => (
                  <div key={item.name} className="flex justify-between items-center bg-white/[0.01] p-3 rounded-xl border border-white/5 hover:border-white/10 hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded bg-[#0F0F0F] border border-white/5 text-slate-400 font-sans font-semibold flex items-center justify-center text-xs">
                        {index + 1}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-200">{item.name}</h4>
                        <span className="text-[9px] font-mono text-slate-500">{item.quantity} units shipped</span>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono font-semibold text-indigo-400">
                      {item.revenue.toFixed(2)} DH
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Right Column - Comprehensive Sales transactional logs list */}
        <div className="lg:col-span-6 bg-[#161616] p-6 border border-white/5 rounded-2xl shadow-xl space-y-4">
          <h3 className="text-xs font-mono uppercase tracking-wider text-indigo-400 border-b border-white/5 pb-3 flex items-center justify-between font-semibold">
            <span>Historical Registers Journal</span>
            <span className="text-[9px] text-indigo-500/40 tracking-normal font-normal uppercase">Receipt Index list</span>
          </h3>

          {sales.length === 0 ? (
            <div className="py-24 text-center text-slate-550 text-xs italic">
              No sales logged on database. Fire up checkout registers to record sales!
            </div>
          ) : (
            <div className="space-y-4 overflow-y-auto max-h-[500px] pr-1">
              {sales.map((sale) => (
                <div 
                  key={sale.id} 
                  id={`reports-receipt-log-${sale.id}`}
                  className="bg-[#121212] border border-white/5 p-3.5 rounded-xl hover:border-indigo-500/20 transition-colors space-y-3"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-mono font-bold text-slate-300 bg-[#0F0F0F] border border-white/5 px-2 py-0.5 rounded">
                        {sale.receiptNo}
                      </span>
                      <span className="block text-[8px] font-mono text-slate-500 mt-1">
                        {new Date(sale.dateTime).toLocaleString()}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-mono font-semibold text-slate-200 block">
                        {sale.total.toFixed(2)} DH
                      </span>
                      <span className="text-[9px] uppercase tracking-wider font-mono text-slate-500 mt-0.5 block">
                        via {sale.paymentMethod}
                      </span>
                    </div>
                  </div>

                  {/* Summary items lines formatted tiny */}
                  <div className="bg-black/20 p-2.5 rounded-lg border border-white/5 text-[10px] space-y-1">
                    {sale.items.map((line, lIdx) => (
                      <div key={lIdx} className="flex justify-between text-slate-400 font-mono">
                        <span className="font-sans truncate max-w-[170px] text-slate-355">{line.productName}</span>
                        <span>{line.quantity}x @ {line.price} DH</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between items-center text-[9px] text-slate-500 pt-1 border-t border-white/5">
                    <div className="flex items-center gap-1">
                      <div className="w-4 h-4 bg-white/5 rounded-full flex items-center justify-center">
                        <User size={8} />
                      </div>
                      <span>Cashier: <span className="text-slate-400">{sale.staffName}</span></span>
                    </div>

                    {sale.discountAmount > 0 && (
                      <span className="text-rose-400 font-mono">
                        Discount: -{sale.discountAmount.toFixed(2)} DH
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
