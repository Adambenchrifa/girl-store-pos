/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Lock, User as UserIcon, ShieldAlert, KeyRound, CheckCircle2, Instagram, Phone, MapPin } from 'lucide-react';
import { User } from '../types';

interface LoginScreenProps {
  onLoginSuccess: (user: User) => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSetupMode, setIsSetupMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const checkSetupStatus = async () => {
      try {
        const response = await fetch('/api/auth/needs-setup');
        const data = await response.json();
        if (data.needsSetup) {
          setIsSetupMode(true);
          setUsername('admin'); // pre-fill admin username
        }
      } catch (err) {
        console.error("Failed to query database setup state:", err);
      }
    };
    checkSetupStatus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Please fill in all credentials");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password: password.trim()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Authentication failed");
      }

      onLoginSuccess(data.user);
    } catch (err: any) {
      console.error("Login attempt failure:", err);
      setError(err.message || "Invalid account credentials or connection refused.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() || !confirmPassword.trim()) {
      setError("Please fill out both safety fields");
      return;
    }
    if (password !== confirmPassword) {
      setError("Entered passwords do not match");
      return;
    }
    if (password.length < 4) {
      setError("Standard security password must be at least 4 chars");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password.trim() })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "First initialization failed");
      }

      // Automatically sign in
      const pResponse = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: "admin",
          password: password.trim()
        })
      });

      const pData = await pResponse.json();
      if (!pResponse.ok) {
        throw new Error(pData.error || "Authentication auto-fallback failed.");
      }

      onLoginSuccess(pData.user);
    } catch (err: any) {
      setError(err.message || "Uncaught registration issue.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F0F0F] flex flex-col items-center justify-between p-4 relative overflow-hidden">
      {/* Decorative Indigo/Purple Ambient Glow Spotlights */}
      <div className="absolute top-[-300px] left-[-200px] w-[600px] h-[600px] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-300px] right-[-200px] w-[600px] h-[600px] rounded-full bg-purple-600/5 blur-[120px] pointer-events-none" />

      {/* Spacer pushing form to center/balanced layout */}
      <div className="hidden md:block h-6" />

      <div className="w-full max-w-md bg-[#161616] border border-white/5 rounded-3xl p-8 shadow-2xl relative z-10 my-auto">
        
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 mb-4 text-indigo-400">
            <KeyRound size={22} className="text-indigo-400" />
          </div>
          <h1 className="font-sans text-3xl text-white tracking-light font-light">GIRL STORE<span className="text-indigo-500 font-bold italic ml-1">.</span></h1>
          <p className="text-[10px] uppercase font-mono tracking-widest text-slate-500 mt-2">
            {isSetupMode ? "Security Initialization" : "Operator Desk login"}
          </p>
          <div className="h-[1px] w-12 bg-gradient-to-r from-transparent via-white/10 to-transparent mx-auto mt-4" />
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-950/40 border border-red-900/60 p-3 rounded-xl text-xs text-red-400 flex items-start gap-2 mb-6 transition-all duration-300">
            <ShieldAlert size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* First Setup Mode form */}
        {isSetupMode ? (
          <form onSubmit={handleSetupSubmit} className="space-y-5">
            <div className="p-3 bg-indigo-950/20 border border-indigo-500/20 rounded-xl text-xs text-indigo-300 flex items-start gap-2 mb-2">
              <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-indigo-450" />
              <span>
                <strong>First-Run Mode:</strong> Establish the master <strong>admin</strong> password below. You will be automatically authenticated.
              </span>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-slate-405 mb-2 font-medium">
                Admin Security Password
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
                  <Lock size={16} />
                </span>
                <input
                  id="setup-password-input"
                  type="password"
                  placeholder="Set Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl py-3 pl-11 pr-4 text-sm text-slate-200 outline-none transition-all placeholder-slate-650"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-slate-405 mb-2 font-medium">
                Confirm Admin Password
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
                  <Lock size={16} />
                </span>
                <input
                  id="setup-confirm-password-input"
                  type="password"
                  placeholder="Repeat Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl py-3 pl-11 pr-4 text-sm text-slate-200 outline-none transition-all placeholder-slate-650"
                  required
                />
              </div>
            </div>

            <button
              id="setup-submit-btn"
              type="submit"
              disabled={isLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-505 text-white font-medium py-3.5 rounded-xl text-sm transition-all disabled:bg-white/5 disabled:text-slate-505 shadow-xl shadow-indigo-600/10 flex items-center justify-center gap-2 mt-2"
            >
              {isLoading ? "Setting Master Credentials..." : "Configure & Enter System"}
            </button>
          </form>
        ) : (
          /* Standard Login Form */
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-2 font-medium">
                User ID / Operator Name
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
                  <UserIcon size={16} />
                </span>
                <input
                  id="login-username-input"
                  type="text"
                  placeholder="e.g. admin or staff"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl py-3 pl-11 pr-4 text-sm text-slate-200 placeholder-slate-650 outline-none transition-all"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-mono uppercase tracking-wider text-slate-400 font-medium">
                  Security Password
                </label>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
                  <Lock size={16} />
                </span>
                <input
                  id="login-password-input"
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl py-3 pl-11 pr-4 text-sm text-slate-200 placeholder-slate-650 outline-none transition-all"
                  required
                />
              </div>
            </div>

            <button
              id="login-submit-btn"
              type="submit"
              disabled={isLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3.5 rounded-xl text-sm transition-all disabled:bg-white/5 disabled:text-slate-505 shadow-xl shadow-indigo-600/10 flex items-center justify-center gap-2 mt-2"
            >
              {isLoading ? "Validating security context..." : "Sign In to Register"}
            </button>

          </form>
        )}

      </div>

      {/* Login Screen Footer Contact Card */}
      <footer className="w-full max-w-md md:max-w-xl text-center flex flex-col gap-3 py-4 text-[11px] text-slate-500 z-10 relative mt-6 border-t border-white/[0.03]">
        <div className="flex flex-wrap justify-center items-center gap-5 text-slate-400">
          <a 
            href="https://instagram.com/girl46store" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="flex items-center gap-1.5 hover:text-indigo-400 transition-colors"
          >
            <Instagram size={13} className="text-pink-500" />
            <span className="font-semibold">@girl46store</span>
          </a>

          <a 
            href="https://wa.me/212751859558" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 hover:text-emerald-400 transition-colors"
          >
            <Phone size={13} className="text-emerald-500" />
            <span className="font-semibold font-mono">0751859558</span>
          </a>

          <div className="flex items-center gap-1.5">
            <MapPin size={13} className="text-indigo-400" />
            <span>Bin Jeradi, à côté de Café Eglo</span>
          </div>
        </div>
        <div className="text-[10px] font-mono text-slate-650">
          &copy; {new Date().getFullYear()} GIRL STORE • POS Desk Login
        </div>
      </footer>
    </div>
  );
}
