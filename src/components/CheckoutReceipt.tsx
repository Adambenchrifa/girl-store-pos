/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { Printer, CheckCircle, Download, ArrowRight } from 'lucide-react';
import { Sale } from '../types';

interface CheckoutReceiptProps {
  sale: Sale;
  onClose: () => void;
}

export default function CheckoutReceipt({ sale, onClose }: CheckoutReceiptProps) {
  
  useEffect(() => {
    const timer = setTimeout(() => {
      handlePrint();
    }, 450);
    return () => clearTimeout(timer);
  }, []);

  const handlePrint = async () => {
    const electronAPI = (window as any).electronAPI;
    const isSilentEnabled = localStorage.getItem('girlstore_silent_printing') === 'true';
    const activePrinter = localStorage.getItem('girlstore_active_printer') || '';

    if (electronAPI && isSilentEnabled) {
      const receiptEl = document.getElementById('printable-receipt-area');
      if (receiptEl) {
        // Create full standalone HTML for the thermal printer, with high-fidelity styles
        const htmlContent = `
          <html>
            <head>
              <meta charset="utf-8" />
              <style>
                body {
                  font-family: monospace;
                  font-size: 11px;
                  line-height: 1.4;
                  margin: 8px;
                  color: #000;
                  background: #fff;
                  width: 280px;
                }
                .text-center { text-align: center; }
                .text-right { text-align: right; }
                .font-bold { font-weight: bold; }
                .border-b { border-bottom: 1px dashed #000; }
                .border-t { border-top: 1px dashed #000; }
                .pb-1 { padding-bottom: 4px; }
                .pt-2 { padding-top: 8px; }
                .mb-3 { margin-bottom: 12px; }
                .mb-4 { margin-bottom: 16px; }
                .mb-5 { margin-bottom: 20px; }
                .space-y-1 > * { margin-top: 2px; margin-bottom: 2px; }
                .flex { display: flex; }
                .justify-between { justify-content: space-between; }
                .grid { display: grid; }
                .grid-cols-12 { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); }
                .col-span-7 { grid-column: span 7 / span 7; }
                .col-span-2 { grid-column: span 2 / span 2; }
                .col-span-3 { grid-column: span 3 / span 3; }
                .text-sm { font-size: 12px; }
                .text-base { font-size: 14px; }
                .font-serif { font-family: "Times New Roman", Times, serif; }
                .font-extrabold { font-weight: bold; }
                .italic { font-style: italic; }
                /* Hide buttons, headers and scrollbars */
                #print-btn-receipt, #download-btn-receipt, #close-btn-receipt { display: none !important; }
              </style>
            </head>
            <body>
              <div class="text-center mb-5">
                <h1 class="font-serif text-base font-bold" style="margin: 0; padding: 0;">GIRL STORE</h1>
              </div>
              ${receiptEl.innerHTML}
            </body>
          </html>
        `;
        try {
          await electronAPI.printSilent({ htmlContent, printerName: activePrinter });
          console.log('[Electron Silent Print] Silent thermal print completed.');
        } catch (err: any) {
          console.error('[Electron Silent Print] Silent printing failed, falling back:', err);
          window.print();
        }
      } else {
        window.print();
      }
    } else {
      window.print();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="flex flex-col items-center max-w-sm w-full gap-5 animate-in zoom-in-95 duration-200">
        
        {/* Confirmatory Spark */}
        <div className="text-center">
          <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-3 text-emerald-400">
            <CheckCircle size={24} />
          </div>
          <h2 className="text-xl font-medium text-zinc-100">Transaction Settled</h2>
          <p className="text-zinc-500 text-xs font-mono mt-1">Receipt reference: {sale.receiptNo}</p>
        </div>

        {/* --- PHYSICAL INVOICE COMPONENT --- */}
        <div 
          id="printable-receipt-area" 
          className="bg-white text-zinc-950 p-6 rounded-sm shadow-2xl relative border-zinc-200 border w-full font-mono text-xs leading-relaxed"
          style={{ width: '100%', maxWidth: '340px' }}
        >
          {/* Jagged thermal paper look (top and bottom simulation dots) */}
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-zinc-100 to-transparent" />
          
          {/* Receipt Brand Heading */}
          <div className="text-center space-y-1 mb-5">
            <h1 className="font-serif text-2xl font-bold tracking-tight text-zinc-900 pr-1">GIRL STORE</h1>
          </div>

          {/* Audit Metadata Info */}
          <div className="space-y-1 text-[10px] text-zinc-600 border-b border-dashed border-zinc-200 pb-3 mb-3">
            <div className="flex justify-between">
              <span>Receipt No:</span>
              <span className="font-bold text-zinc-900">{sale.receiptNo}</span>
            </div>
            <div className="flex justify-between">
              <span>Date/Time:</span>
              <span>{new Date(sale.dateTime).toLocaleString()}</span>
            </div>
          </div>

          {/* Sales Lines */}
          <div className="space-y-3 mb-4">
            <div className="grid grid-cols-12 gap-1 text-[10px] text-zinc-400 font-bold border-b border-zinc-200 pb-1">
              <span className="col-span-7">ARTICLE DESCRIPTION</span>
              <span className="col-span-2 text-center">QTY</span>
              <span className="col-span-3 text-right">TOTAL</span>
            </div>

            {sale.items.map((item, index) => (
              <div key={index} className="grid grid-cols-12 gap-1 items-start text-[10px] text-zinc-800">
                <div className="col-span-7 flex flex-col">
                  <span className="font-semibold text-zinc-950 truncate">{item.productName}</span>
                </div>
                <span className="col-span-2 text-center text-zinc-900 font-bold">{item.quantity}</span>
                <span className="col-span-3 text-right font-semibold font-mono">{item.total.toFixed(2)} DH</span>
              </div>
            ))}
          </div>

          {/* Totals Computations */}
          <div className="border-t border-dashed border-zinc-300 pt-3 space-y-1.5 text-[10px] text-zinc-600">
            <div className="flex justify-between text-sm font-bold text-zinc-950 border-t border-dashed border-zinc-200 pt-2 pb-1">
              <span>GRAND TOTAL (DH):</span>
              <span className="font-mono text-base font-extrabold">{sale.total.toFixed(2)} DH</span>
            </div>
          </div>

          {/* Social and Thank you note */}
          <div className="text-center mt-5 pt-4 border-t border-dashed border-zinc-300 space-y-1 text-[9px] text-zinc-500 font-sans">
            <p className="font-sans text-[11px] font-bold text-zinc-800">Thank you for shopping at GIRL STORE! 💖</p>
            <p>Instagram: <span className="font-semibold text-zinc-700">@girl46store</span> &bull; WhatsApp: <span className="font-semibold text-zinc-700">0751859558</span></p>
            <p className="italic text-zinc-600">Bin Jeradi, à côté de Café Eglo</p>
          </div>
        </div>

        {/* --- POS ACTION PANEL BUTTONS --- */}
        <div className="flex flex-col w-full gap-2">
          <div className="flex gap-2">
            <button
              id="print-btn-receipt"
              onClick={handlePrint}
              className="flex-1 bg-white/5 border border-white/5 text-slate-200 hover:text-white hover:bg-white/10 py-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-lg shadow-black/40"
            >
              <Printer size={15} /> Print Receipt
            </button>
            
            <button
              id="download-btn-receipt"
              onClick={handlePrint} // Trigger standard print -> save to PDF easily
              className="flex-1 bg-white/5 border border-white/5 text-slate-200 hover:text-white hover:bg-white/10 py-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-lg shadow-black/40"
            >
              <Download size={15} /> Save PDF Info
            </button>
          </div>

          <button
            id="dismiss-btn-receipt"
            onClick={onClose}
            className="w-full bg-indigo-600 text-white hover:bg-indigo-500 py-3.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-xl shadow-indigo-600/10 mt-1"
          >
            Start New Checkout Order
            <ArrowRight size={15} />
          </button>
        </div>

      </div>
    </div>
  );
}
