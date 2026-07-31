/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { DollarSign, Trash2, Calendar, FileText, CheckCircle, Flame, Plus, RefreshCw, X } from 'lucide-react';
import { Expense, User } from '../types';

interface ExpensesTabProps {
  currentUser: User;
  expenses: Expense[];
  onRefreshExpenses: () => void;
}

export default function ExpensesTab({ currentUser, expenses, onRefreshExpenses }: ExpensesTabProps) {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Rent');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const isAdmin = currentUser.role === 'Admin';

  const fetchExpenses = async () => {
    setIsLoading(true);
    setErrorCode(null);
    try {
      await onRefreshExpenses();
    } catch (err: any) {
      console.error(err);
      setErrorCode(err.message || "Network failure");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setErrorCode("Unauthorized operator. Staff can only record sales transactions.");
      return;
    }
    if (!title.trim() || !amount || Number(amount) <= 0) {
      setErrorCode("Please supply a valid expense description and positive amount.");
      return;
    }

    setIsSubmitting(true);
    setErrorCode(null);
    setSuccessMsg(null);

    try {
      const response = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          amount: Number(amount),
          category,
          date
        })
      });

      if (!response.ok) throw new Error("Could not save store expense.");
      
      setTitle('');
      setAmount('');
      setSuccessMsg("Overhead cost logged successfully.");
      onRefreshExpenses();
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setErrorCode(err.message || "Failed saving expense.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin) {
      alert("Only Administrators are permitted to delete overhead expenses.");
      return;
    }
    if (!confirm("Are you sure you want to write off this logged expense?")) return;

    try {
      const response = await fetch(`/api/expenses/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error("Could not delete expense.");
      onRefreshExpenses();
    } catch (err: any) {
      alert(err.message || "Failed writing off expense.");
    }
  };

  // Aggregated totals
  const totalExpenses = expenses.reduce((acc, exp) => acc + exp.amount, 0);

  // Category breakdown object
  const breakdown = expenses.reduce((acc: { [key: string]: number }, exp) => {
    acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
    return acc;
  }, {});

  if (!isAdmin) {
    return (
      <div id="unauthorized-expenses-view" className="bg-[#161616] border border-white/5 rounded-3xl p-12 text-center max-w-xl mx-auto my-12 shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-amber-500 border border-white/5 mx-auto mb-5">
          <Flame size={28} />
        </div>
        <h2 className="text-xl font-sans text-white font-medium mb-2">Security Access Restricted</h2>
        <p className="text-sm text-slate-500 leading-relaxed max-w-sm mx-auto mb-6">
          Under Role-Based Access Control, the store **Expenses Ledger** is strictly restricted to Administrators. Staff operators can only access checkout registers and basic product lookups.
        </p>
        <div className="text-xs font-mono py-2 px-3 bg-[#0F0F0F] rounded-lg inline-block border border-white/5 text-slate-400">
          Current Level: <span className="text-amber-400 font-bold uppercase">{currentUser.role === 'Staff' ? 'Staff Cashier' : currentUser.role}</span>
        </div>
      </div>
    );
  }

  return (
    <div id="expenses-tab-content" className="space-y-6">
      
      {/* Tab Branding Title Bar */}
      <div className="flex justify-between items-center bg-[#161616] p-5 rounded-2xl border border-white/5 shadow-md">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-indigo-400 font-semibold">Administrative Panel</span>
          <h1 className="font-sans text-xl tracking-tight text-white font-light mt-1">Expenses Ledger</h1>
        </div>
        <button
          id="refresh-expenses-btn"
          onClick={fetchExpenses}
          className="p-2 w-10 h-10 rounded-xl bg-white/5 border border-white/5 text-slate-400 hover:text-white flex items-center justify-center transition-colors hover:bg-white/10"
          title="Refresh expense logs"
        >
          <RefreshCw size={16} className={isLoading ? "animate-spin text-amber-400" : ""} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column - Log Form & Breakdown Stats card */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* New Expense Entry Log Form */}
          <div className="bg-[#161616] p-6 border border-white/5 rounded-2xl shadow-xl">
            <h2 className="text-xs font-mono uppercase tracking-wider text-indigo-400 border-b border-white/5 pb-3 mb-5 flex items-center gap-2 font-semibold">
              <Plus size={16} /> Record Overhead Outflow
            </h2>

            {errorCode && (
              <div className="bg-red-950/40 border border-red-900/60 p-3 rounded-xl text-xs text-red-400 mb-5 flex items-start gap-1.5 animate-pulse">
                <X size={15} onClick={() => setErrorCode(null)} className="cursor-pointer shrink-0 mt-0.5" />
                <span>{errorCode}</span>
              </div>
            )}

            {successMsg && (
              <div className="bg-emerald-950/40 border border-[#059669]/30 p-3 rounded-xl text-xs text-emerald-400 mb-5 flex items-center gap-1.5 animate-in fade-in">
                <CheckCircle size={15} />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                  Overhead Description / Vendor
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
                    <FileText size={15} />
                  </span>
                  <input
                    id="expense-title-input"
                    type="text"
                    placeholder="[Insert Expense Description]"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-[#0F0F0F] border border-white/10 focus:border-indigo-500 rounded-xl py-2.5 pl-10 pr-4 text-xs text-slate-200 placeholder-slate-650 outline-none transition-all"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                    Amount Paid (DH)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
                      <DollarSign size={15} />
                    </span>
                    <input
                      id="expense-amount-input"
                      type="number"
                      step="0.01"
                      min="0.1"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full bg-[#0F0F0F] border border-white/10 focus:border-indigo-500 rounded-xl py-2.5 pl-10 pr-4 text-xs text-slate-200 placeholder-slate-600 outline-none transition-all"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                    Billing Date
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
                      <Calendar size={15} />
                    </span>
                    <input
                      id="expense-date-input"
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full bg-[#0F0F0F] border border-white/10 focus:border-indigo-500 rounded-xl py-2.5 pl-10 pr-4 text-xs text-slate-200 outline-none transition-all"
                      required
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                  Overhead Category
                </label>
                <select
                  id="expense-category-select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-[#0F0F0F] border border-white/10 focus:border-indigo-500 rounded-xl py-2.5 px-3 text-xs text-slate-200 outline-none transition-all"
                >
                  <option value="Rent">Rent (Boutique lease)</option>
                  <option value="Electricity">Electricity power bill</option>
                  <option value="Water">Water utilities</option>
                  <option value="Internet">Internet Wi-Fi access</option>
                  <option value="Salaries">Employee Salaries</option>
                  <option value="Advertising">Advertising & Instagram marketing</option>
                  <option value="Other">Other Miscellaneous overheads</option>
                </select>
              </div>

              <button
                id="expense-submit-btn"
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-indigo-600 hover:bg-indigo-505 text-white font-bold h-12 rounded-xl text-xs transition-colors shadow-lg shadow-indigo-600/15 flex items-center justify-center gap-2 mt-4 hover:scale-[1.01]"
              >
                {isSubmitting ? "Saving record..." : "Log Expense Entry"}
              </button>
            </form>
          </div>

          {/* Quick Outflow Summary Widgets */}
          <div className="bg-[#161616] p-5 border border-white/5 rounded-2xl space-y-4">
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-450">Overhead Cost Outflow</h3>
            <div className="text-3xl font-mono font-semibold text-rose-500">
              {totalExpenses.toFixed(2)} DH
            </div>
            
            <div className="h-[1px] bg-white/5" />

            <div className="space-y-2">
              <span className="block text-[10px] font-mono text-slate-500 uppercase">Category Distribution</span>
              {Object.keys(breakdown).length === 0 ? (
                <div className="text-xs text-slate-600 italic">No cost distributions computed yet.</div>
              ) : (
                (Object.entries(breakdown) as [string, number][]).map(([cat, amt]) => {
                  const percentage = totalExpenses > 0 ? (amt / totalExpenses) * 105 : 0;
                  const finalPercentageForBar = Math.min(100, percentage);
                  return (
                    <div key={cat} className="space-y-1">
                      <div className="flex justify-between text-[11px] font-mono text-slate-400">
                        <span>{cat}</span>
                        <span>{amt.toFixed(2)} DH ({percentage.toFixed(0)}%)</span>
                      </div>
                      <div className="w-full bg-black/40 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-indigo-500 h-full rounded-full" 
                          style={{ width: `${finalPercentageForBar}%` }} 
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

        {/* Right Column - Table ledger of logged expenses */}
        <div className="lg:col-span-7 bg-[#161616] p-6 border border-white/5 rounded-2xl shadow-xl space-y-4">
          <h2 className="text-xs font-mono uppercase tracking-wider text-indigo-400 border-b border-white/5 pb-3 font-semibold">
            Logged Overhead Costs Ledger
          </h2>

          {isLoading ? (
            <div className="py-20 text-center text-slate-500 text-xs font-mono animate-pulse">
              Syncing file-based costs ledger...
            </div>
          ) : expenses.length === 0 ? (
            <div className="py-20 text-center text-slate-500 text-xs italic font-sans">
              No overhead costs logged on the database ledger. Get started by tracking a cost outflow!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table id="expenses-ledger-table" className="w-full text-left text-xs border-collapse font-sans">
                <thead>
                  <tr className="border-b border-white/5 text-slate-500 text-[10px] uppercase font-mono tracking-wider h-9">
                    <th className="py-2 pr-2">Date/Time</th>
                    <th className="py-2 px-2">Category</th>
                    <th className="py-2 px-2">Description</th>
                    <th className="py-2 px-2 text-right">Amount</th>
                    <th className="py-2 pl-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {expenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-white/5 text-slate-300 transition-colors h-11">
                      <td className="py-3 pr-2 font-mono text-[11px] min-w-[70px] whitespace-nowrap text-slate-400">
                        {exp.date}
                      </td>
                      <td className="py-3 px-2">
                        <span className="text-[10px] uppercase tracking-wide font-mono px-2 py-0.5 bg-[#121212] rounded border border-white/5 text-slate-400">
                          {exp.category}
                        </span>
                      </td>
                      <td className="py-3 px-2 font-medium font-sans max-w-[150px] truncate text-slate-200" title={exp.title}>
                        {exp.title}
                      </td>
                      <td className="py-3 px-2 text-right font-mono font-semibold text-rose-400">
                        {exp.amount.toFixed(2)} DH
                      </td>
                      <td className="py-3 pl-2 text-center">
                        <button
                          id={`delete-expense-${exp.id}`}
                          onClick={() => handleDelete(exp.id)}
                          className="p-1.5 bg-white/5 hover:bg-red-950/20 text-slate-500 hover:text-red-400 border border-white/5 rounded-lg transition-colors inline-flex hover:border-white/10"
                          title="Remove expense record"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
