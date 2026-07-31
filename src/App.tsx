/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  LogOut, 
  Search, 
  Barcode, 
  DollarSign, 
  CreditCard, 
  Trash2, 
  Calculator,
  Instagram,
  Phone,
  MapPin,
  X,
  Usb
} from 'lucide-react';

import { motion, AnimatePresence } from 'motion/react';

import { Product, ProductVariant, CartItem, Sale, Expense, User as UserType } from './types';
import LoginScreen from './components/LoginScreen';
import CheckoutReceipt from './components/CheckoutReceipt';
const ExpensesTab = React.lazy(() => import('./components/ExpensesTab'));
const InventoryTab = React.lazy(() => import('./components/InventoryTab'));
const ReportsTab = React.lazy(() => import('./components/ReportsTab'));
const AdminUsersTab = React.lazy(() => import('./components/AdminUsersTab'));

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserType | null>(() => {
    try {
      const stored = sessionStorage.getItem('girlstore_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [activeTab, setActiveTab] = useState<'sales' | 'inventory' | 'expenses' | 'reports' | 'users'>(() => {
    try {
      const stored = sessionStorage.getItem('girlstore_active_tab');
      return (stored as any) || 'sales';
    } catch {
      return 'sales';
    }
  });

  useEffect(() => {
    if (activeTab) {
      sessionStorage.setItem('girlstore_active_tab', activeTab);
    }
  }, [activeTab]);

  // Database core tables
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  // Cash Register State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');

  // Settle & Pricing calculations State
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card'>('Cash');
  const [amountPaid, setAmountPaid] = useState<string>('');

  // Modals state triggers
  const [settledSaleReceipt, setSettledSaleReceipt] = useState<Sale | null>(null);
  const [lowStockAlerts, setLowStockAlerts] = useState<string[]>([]);
  const [zoomedImage, setZoomedImage] = useState<{ src: string; alt: string; name: string; price?: number } | null>(null);

  // Async indicators
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSettingUpCheckout, setIsSettingUpCheckout] = useState(false);
  const [usbConnected, setUsbConnected] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Sync Master catalog, Sales log, and overhead Costs
  const syncStoreData = React.useCallback(async () => {
    if (!currentUser) return;
    setIsSyncing(true);
    try {
      // Products sync
      const pRes = await fetch('/api/products');
      if (pRes.ok) {
        const pData = await pRes.json();
        setProducts(pData);
      }

      // Sales journal sync
      const sRes = await fetch('/api/sales');
      if (sRes.ok) {
        const sData = await sRes.json();
        setSales(sData);
      }

      // Overhead costs sync
      const eRes = await fetch('/api/expenses');
      if (eRes.ok) {
        const eData = await eRes.json();
        setExpenses(eData);
      }
    } catch (err) {
      console.error("Database synchronization failure:", err);
    } finally {
      setIsSyncing(false);
    }
  }, [currentUser]);

  const checkUsbStatus = React.useCallback(async () => {
    if (!currentUser) return;
    try {
      const res = await fetch('/api/usb/status');
      if (res.ok) {
        const data = await res.json();
        setUsbConnected((prev) => {
          if (data.connected !== prev) {
            // Auto-refresh when USB connection changes to make sure data pulls
            syncStoreData();
          }
          return data.connected;
        });
      }
    } catch (e) {
      console.error("Failed to check USB status:", e);
    }
  }, [currentUser, syncStoreData]);

  useEffect(() => {
    if (currentUser) {
      syncStoreData();
      checkUsbStatus();
      const interval = setInterval(checkUsbStatus, 10000);
      return () => clearInterval(interval);
    }
  }, [currentUser, syncStoreData, checkUsbStatus]);

  // Handle Barcode simulated hardware trigger
  // Add any product directly to the cart using its flat tracking variant
  const handleAddProductToCart = React.useCallback((product: Product, qty: number = 1) => {
    // Grab the primary tracking variant or construct a fallback
    let variant = product.variants?.[0];
    if (!variant) {
      variant = {
        sku: `PJ-${product.name.replace(/[^a-zA-Z0-9]+/g, '-').slice(0, 10).toUpperCase()}`,
        size: "",
        color: "",
        stock: 9999
      };
    }

    const totalStock = product.variants ? product.variants.reduce((sum, v) => sum + v.stock, 0) : 9999;

    setCart((prevCart) => {
      // Check if product is already in our cart
      const existingIndex = prevCart.findIndex(item => item.product.id === product.id);

      if (existingIndex > -1) {
        const updatedCart = [...prevCart];
        const newQty = updatedCart[existingIndex].quantity + qty;
        if (newQty > totalStock) {
          alert(`Insufficient stock balance inside the warehouse record. Max available: ${totalStock} units.`);
          return prevCart;
        }
        updatedCart[existingIndex].quantity = newQty;
        return updatedCart;
      } else {
        if (totalStock <= 0) {
          alert(`Insufficient stock balance. This article is currently out of stock.`);
          return prevCart;
        }
        if (qty > totalStock) {
          alert(`Insufficient stock balance inside the warehouse record. Max available: ${totalStock} units.`);
          return prevCart;
        }
        return [...prevCart, {
          product,
          variant,
          quantity: qty
        }];
      }
    });

    // Auto-Add/Clear: Reset the dynamic reveal search state back to Empty State
    setSearchQuery('');
    setBarcodeInput('');
  }, []);

  // Handle Barcode simulated hardware trigger with fast scan logic
  const handleBarcodeSubmit = React.useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const normalized = barcodeInput.trim();
    if (!normalized) return;

    // Direct registry look-up
    const match = products.find(p => p.barcode === normalized);
    if (match) {
      // Set matching search query to dynamically reveal the product card under the search bar
      setSearchQuery(match.barcode);
      setBarcodeInput('');
    } else {
      alert(`Barcode '${normalized}' not mapped to any sleepwear product.`);
      setBarcodeInput('');
    }
  }, [barcodeInput, products]);

  // Alter single quantities inside cart
  const updateCartQty = React.useCallback((idx: number, delta: number) => {
    setCart((prevCart) => {
      const updated = [...prevCart];
      const item = updated[idx];
      const targetQty = item.quantity + delta;

      if (targetQty <= 0) {
        updated.splice(idx, 1);
      } else {
        if (targetQty > item.variant.stock) {
          alert(`Insufficient stock. Max available: ${item.variant.stock}`);
          return prevCart;
        }
        item.quantity = targetQty;
      }
      return updated;
    });
  }, []);

  const removeCartItem = React.useCallback((idx: number) => {
    setCart((prevCart) => {
      const updated = [...prevCart];
      updated.splice(idx, 1);
      return updated;
    });
  }, []);

  // Checkout Math Logic
  const subtotal = React.useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  }, [cart]);
  const total = subtotal;

  const discountType = 'percent';
  const discountValue = 0;
  const taxRate = 0;
  const discountAmount = 0;
  const taxAmount = 0;

  // Tender settle logic
  const handleCheckoutSettle = React.useCallback(async () => {
    if (cart.length === 0) {
      alert("No apparel articles added to order.");
      return;
    }

    const payVal = paymentMethod === 'Card' ? total : Number(amountPaid || total);
    if (payVal < total) {
      alert(`Insufficient cash tendered. Balance due: ${(total - payVal).toFixed(2)} DH`);
      return;
    }

    setIsSettingUpCheckout(true);
    setLowStockAlerts([]);

    // Translate cart schemas for server-end inventory deductions
    const checkoutItems = cart.map(item => ({
      productId: item.product.id,
      sku: item.variant.sku,
      quantity: item.quantity
    }));

    try {
      const response = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: checkoutItems,
          discountType,
          discountValue,
          taxRate,
          paymentMethod,
          amountPaid: payVal,
          staffId: currentUser?.id,
          staffName: currentUser?.name
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Checkout processor failed.");
      }

      // Success settle!
      setSettledSaleReceipt(data.sale);
      if (data.lowStockAlerts && data.lowStockAlerts.length > 0) {
        setLowStockAlerts(data.lowStockAlerts);
      }

      // Empty states on registers
      setCart([]);
      setAmountPaid('');
      
      // Auto-update master copies
      syncStoreData();
    } catch (err: any) {
      alert(err.message || "Checkout settle failed.");
    } finally {
      setIsSettingUpCheckout(false);
    }
  }, [cart, paymentMethod, total, amountPaid, currentUser, syncStoreData]);

  // Formulate filtered listings (removed categories, flat-scan search model)
  const filteredProducts = React.useMemo(() => {
    if (searchQuery.trim() === '') return [];
    const rawSearch = searchQuery.toLowerCase().trim();
    return products.filter(p => {
      return p.name.toLowerCase().includes(rawSearch) || 
             p.barcode === rawSearch ||
             p.category.toLowerCase().includes(rawSearch);
    });
  }, [searchQuery, products]);

  // Access check filters
  const isAdmin = currentUser?.role === 'Admin';

  if (!currentUser) {
    return (
      <LoginScreen 
        onLoginSuccess={(user) => {
          sessionStorage.setItem('girlstore_user', JSON.stringify(user));
          setCurrentUser(user);
        }} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0F0F0F] text-slate-200 font-sans flex flex-col select-none">
      
      {/* --- TOP HIGH-FIDELITY BRAND BANNER HEADER --- */}
      <header className="bg-[#161616] border-b border-white/5 h-16 shrink-0 flex items-center justify-between px-6 relative z-30 shadow-md">
        
        {/* Brand name and user info */}
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <h1 className="font-sans text-xl tracking-tight text-white font-light">
              GIRL STORE <span className="text-indigo-500 font-bold italic ml-1">.</span>
            </h1>
          </div>

          <div className="h-6 w-[1px] bg-white/10 hidden sm:block" />

          {/* User label and Role badges */}
          <div className="hidden sm:flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse border border-emerald-950" />
            <span className="text-xs font-medium text-slate-400">
              Active: <span className="text-slate-200 capitalize font-semibold">{currentUser.name}</span>
            </span>
            <span className={`text-[9px] uppercase tracking-wider font-mono font-bold px-2 py-0.5 rounded-md border ${
              isAdmin ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500/25' : 'bg-[#121212] text-slate-400 border-white/5'
            }`}>
              {currentUser.role}
            </span>

            {/* USB Sync Status Indicator */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-black/25 rounded-lg border border-white/5 font-mono text-[10px] tracking-wide select-none">
              <Usb size={11} className={usbConnected ? "text-emerald-400 animate-pulse" : "text-slate-600"} />
              <span className={usbConnected ? "text-emerald-400 font-bold" : "text-slate-500 font-medium"}>
                {usbConnected ? "USB SYNCED" : "USB OFF"}
              </span>
            </div>
          </div>
        </div>

        {/* --- DYNAMIC MIDDLE NAVIGATION TAB SWITCHER (DESKTOP MODE) --- */}
        <nav className="hidden lg:flex items-center gap-1.5 bg-[#0f0f0f] p-1 rounded-xl border border-white/5">
          <button
            id="nav-tab-sales"
            onClick={() => setActiveTab('sales')}
            className={`px-4 py-2 rounded-lg text-xs font-medium tracking-wide transition-all ${
              activeTab === 'sales'
                ? 'bg-indigo-600 text-white font-medium shadow shadow-indigo-600/25'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            Sales Desk
          </button>
          
          <button
            id="nav-tab-inventory"
            onClick={() => setActiveTab('inventory')}
            className={`px-4 py-2 rounded-lg text-xs font-medium tracking-wide transition-all ${
              activeTab === 'inventory'
                ? 'bg-indigo-600 text-white font-medium shadow shadow-indigo-600/25'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            Inventory Master
          </button>

          {isAdmin && (
            <>
              <button
                id="nav-tab-expenses"
                onClick={() => setActiveTab('expenses')}
                className={`px-4 py-2 rounded-lg text-xs font-medium tracking-wide transition-all ${
                  activeTab === 'expenses'
                    ? 'bg-indigo-600 text-white font-medium shadow shadow-indigo-600/25'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                Expenses Ledger
              </button>

              <button
                id="nav-tab-reports"
                onClick={() => setActiveTab('reports')}
                className={`px-4 py-2 rounded-lg text-xs font-medium tracking-wide transition-all ${
                  activeTab === 'reports'
                    ? 'bg-indigo-600 text-white font-medium shadow shadow-indigo-600/25'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                P&L Reports
              </button>

              <button
                id="nav-tab-users"
                onClick={() => setActiveTab('users')}
                className={`px-4 py-2 rounded-lg text-xs font-medium tracking-wide transition-all ${
                  activeTab === 'users'
                    ? 'bg-indigo-600 text-white font-medium shadow shadow-indigo-600/25'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                Operators
              </button>
            </>
          )}
        </nav>

        {/* Global Exit */}
        <button
          id="logout-btn"
          onClick={() => setShowLogoutConfirm(true)}
          className="px-3.5 py-1.5 h-9 bg-white/5 hover:bg-red-950/20 text-slate-400 hover:text-red-400 border border-white/5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
        >
          <LogOut size={14} /> Exit System
        </button>
      </header>

      {/* --- RESPONSIVE TAB OVERLAY STRIP (MOBILE VIEWPORT) --- */}
      <div className="lg:hidden bg-[#0f0f0f] p-2 border-b border-white/5 flex overflow-x-auto gap-1 gap-y-1 scrollbar-none">
        {[
          { key: 'sales', label: 'Sales Desk', roleCheck: true },
          { key: 'inventory', label: 'Inventory', roleCheck: true },
          { key: 'expenses', label: 'Expenses', roleCheck: isAdmin },
          { key: 'reports', label: 'P&L Reports', roleCheck: isAdmin },
          { key: 'users', label: 'Operators', roleCheck: isAdmin }
        ].filter(t => t.roleCheck).map(t => (
          <button
            key={t.key}
            id={`mobile-tab-${t.key}`}
            onClick={() => setActiveTab(t.key as any)}
            className={`px-3.5 py-1.5 rounded-lg text-xs whitespace-nowrap font-sans font-medium transition-all ${
              activeTab === t.key
                ? 'bg-indigo-600 text-white font-bold shadow shadow-indigo-600/25'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* --- MAIN ROOT GRID VIEWS --- */}
      <main className="flex-1 overflow-hidden p-6 relative">
        
        {/* Alerts / Push system messages list overlay banner */}
        {lowStockAlerts.length > 0 && (
          <div className="absolute top-4 inset-x-6 z-40 bg-zinc-950/90 border border-red-900/40 p-3 rounded-2xl flex items-center justify-between text-xs text-red-400 shadow-xl backdrop-blur">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping shrink-0" />
              <span>
                <strong>System Notice:</strong> {lowStockAlerts[0]} 
                {lowStockAlerts.length > 1 && ` (+${lowStockAlerts.length - 1} other variant stock shortfalls!)`}
              </span>
            </div>
            <button 
              id="close-lowstock-alert"
              onClick={() => setLowStockAlerts([])} 
              className="text-[10px] font-bold font-mono px-2.5 py-1 bg-red-950 hover:bg-red-900 rounded-lg text-white border border-red-900 text-center"
            >
              Examine Stock Sheets
            </button>
          </div>
        )}

        {/* --- 1. SALES REGISTER WORKSPACE --- */}
        {activeTab === 'sales' && (
          <div id="sales-register-grid" className="h-full grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            
            {/* LEFT 7-COLUMN PANEL: PRODUCT GRID SELECTOR */}
            <div className="lg:col-span-7 flex flex-col gap-6 overflow-hidden min-h-[400px]">
              
              {/* FILTERING HEADER BAR */}
              <div className="bg-[#161616] p-4 rounded-2xl border border-white/5 flex flex-col md:flex-row gap-3 items-stretch justify-between shadow-sm">
                
                {/* Search Text Pill */}
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                    <Search size={16} />
                  </span>
                  <input
                    id="search-articles-filter"
                    type="text"
                    placeholder="Search Article by name, category or barcode..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 focus:border-indigo-500 rounded-xl py-2 pl-9 pr-16 text-xs text-slate-200 outline-none transition-all placeholder-slate-500"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setBarcodeInput('');
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-red-400 hover:text-red-300 transition-colors cursor-pointer uppercase"
                    >
                      CLEAR
                    </button>
                  )}
                </div>

                {/* Barcode scanner quick submit simulation container */}
                <form onSubmit={handleBarcodeSubmit} className="flex gap-2">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                      <Barcode size={15} />
                    </span>
                    <input
                      id="scanner-mock-input"
                      type="text"
                      placeholder="Simulate tag scan..."
                      value={barcodeInput}
                      onChange={(e) => setBarcodeInput(e.target.value)}
                      className="w-[140px] bg-white/5 border border-white/10 focus:border-indigo-500 rounded-xl py-2 pl-9 pr-3 text-xs text-slate-200 font-mono outline-none placeholder-slate-500"
                    />
                  </div>
                  <button
                    id="trigger-scanner-simulation"
                    type="submit"
                    className="px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-all shadow-md shadow-indigo-600/15"
                  >
                    Scan
                  </button>
                </form>

              </div>

              {/* PRODUCT GRID - CORE AREA (mimics exactly image_7b7ee1.jpg aesthetic but follows strict Scan-to-Display workflow) */}
              <div className="flex-1 overflow-y-auto pr-1">
                {searchQuery.trim() === '' ? (
                  /* empty state screen when opened */
                  <div className="h-full flex flex-col items-center justify-center p-8 border border-dashed border-white/5 rounded-3xl min-h-[350px] bg-white/[0.01]">
                    <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center text-slate-600 mb-4">
                      <Barcode size={26} />
                    </div>
                    <p className="text-xs font-mono text-slate-400 font-bold tracking-wider uppercase mb-1">
                      Scan-To-Display Enabled
                    </p>
                    <p className="text-[11px] text-slate-500 text-center max-w-sm leading-relaxed">
                      Main content area is empty by default. Scan a physical barcode tag or type the article code/name above to dynamically reveal sleepwear details.
                    </p>
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="py-24 text-center text-slate-500 text-xs italic bg-[#161616] rounded-2xl border border-white/5">
                    No sleepwear articles matched "{searchQuery}" inside the warehouse inventory system.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-400 font-bold">
                        Dynamic Scan Result ({filteredProducts.length} Match{filteredProducts.length > 1 ? 'es' : ''})
                      </span>
                      <button
                        onClick={() => {
                          setSearchQuery('');
                          setBarcodeInput('');
                        }}
                        className="text-[10px] font-mono text-slate-500 hover:text-red-400 transition-colors uppercase cursor-pointer"
                      >
                        [Clear Scan]
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {filteredProducts.map((product) => {
                        const totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0);

                        return (
                          <div
                            key={product.id}
                            id={`catalogue-card-${product.id}`}
                            className="bg-[#161616] border border-white/5 hover:border-indigo-500/50 rounded-2xl overflow-hidden transition-all duration-300 relative flex flex-col h-full shadow-lg"
                          >
                            {/* Product Image Frame */}
                            <div 
                              onClick={() => setZoomedImage({ src: product.image, alt: product.name, name: product.name, price: product.price })}
                              className="aspect-video bg-black/40 overflow-hidden relative border-b border-white/5 group cursor-zoom-in"
                            >
                              <img
                                src={product.image}
                                alt={product.name}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover bg-center group-hover:scale-105 transition-transform duration-350"
                              />
                              
                              {/* Sleek Zoom Hover Overlay */}
                              <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity duration-250 flex flex-col items-center justify-center gap-2">
                                <div className="p-2.5 bg-black/60 backdrop-blur-md border border-white/10 rounded-full text-white shadow-lg">
                                  <Search size={16} />
                                </div>
                                <span className="text-[10px] font-mono tracking-wider text-white bg-black/65 backdrop-blur-md px-2.5 py-1 border border-white/10 rounded-full font-bold uppercase">
                                  Click to Zoom
                                </span>
                              </div>

                              <div className="absolute top-2.5 right-2.5 z-10">
                                {totalStock > 0 ? (
                                  <span className="text-[8px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 py-0.5 px-1.5 rounded-full font-bold uppercase">
                                    IN STOCK ({totalStock})
                                  </span>
                                ) : (
                                  <span className="text-[8px] font-mono bg-red-500/10 text-red-400 border border-red-500/20 py-0.5 px-1.5 rounded-full font-bold uppercase">
                                    OUT OF STOCK
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Box textual details */}
                            <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
                              <div className="space-y-1">
                                <span className="text-[9px] font-mono uppercase tracking-widest text-indigo-400 font-semibold">
                                  {product.category}
                                </span>
                                <h3 className="text-sm text-white font-normal line-clamp-2 leading-snug">
                                  {product.name}
                                </h3>
                              </div>

                              <div className="flex items-center justify-between border-t border-white/5 pt-3">
                                <div className="flex flex-col">
                                  <span className="text-[9px] font-mono uppercase text-slate-500">Retail price</span>
                                  <span className="text-sm font-semibold text-indigo-400 font-mono">
                                    {product.price.toFixed(2)} DH
                                  </span>
                                </div>
                                <div className="flex flex-col text-right">
                                  <span className="text-[9px] font-mono uppercase text-slate-500">Available Stock</span>
                                  <span className="text-xs font-mono text-slate-350">
                                    {totalStock} units
                                  </span>
                                </div>
                              </div>

                              {/* Action Trigger */}
                              <button
                                id={`add-revealed-article-${product.id}`}
                                onClick={() => handleAddProductToCart(product, 1)}
                                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold uppercase transition-all shadow-md shadow-indigo-600/15 cursor-pointer hover:scale-[1.01]"
                              >
                                Add to Order
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* RIGHT 5-COLUMN PANEL: ACTIVE RECEIPT BASKET REGISTER (visual match) */}
            <div className="lg:col-span-5 bg-[#161616] border border-white/5 rounded-3xl flex flex-col overflow-hidden min-h-[400px] shadow-2xl">
              
              {/* Basket Branded Header */}
              <div className="p-5 border-b border-white/5 bg-black/15 text-center relative shrink-0">
                <h3 className="font-sans text-lg tracking-tight text-white font-light">
                  GIRL STORE <span className="text-indigo-500 font-bold italic ml-1">.</span>
                </h3>
                <div className="h-[2px] w-8 bg-indigo-500 mx-auto mt-3" />
              </div>

              {/* Basket Scrolling grid - displaying Article Name, Qty, Price, Total */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-2">
                    <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-500 border border-white/5">
                      <Calculator size={18} />
                    </div>
                    <h4 className="text-xs font-semibold text-slate-400">Register Empty</h4>
                    <p className="text-[10px] text-slate-500 leading-relaxed max-w-[200px]">
                      Articles selected from the left apparel catalog grid will accumulate here for checkout tendering.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {/* Headers */}
                    <div className="grid grid-cols-12 gap-1 text-[9px] font-mono uppercase tracking-wider text-slate-500 font-bold border-b border-white/5 pb-1.5">
                      <span className="col-span-6">Article Name</span>
                      <span className="col-span-2 text-center">Qty</span>
                      <span className="col-span-2 text-right">Price</span>
                      <span className="col-span-2 text-right">Total</span>
                    </div>

                    {cart.map((item, idx) => (
                      <div 
                        key={`${item.product.id}-${item.variant.sku}`} 
                        id={`cart-line-${idx}`}
                        className="grid grid-cols-12 gap-1 items-center bg-white/5 p-2.5 rounded-xl border border-white/5 hover:border-indigo-500/30 transition-all text-xs"
                      >
                        <div className="col-span-6 flex flex-col">
                          <span className="font-semibold text-slate-200 truncate">{item.product.name}</span>
                        </div>

                        {/* Qty increment controls */}
                        <div className="col-span-2 flex items-center justify-center gap-1 shrink-0">
                          <button
                            id={`qty-dec-cart-${idx}`}
                            onClick={() => updateCartQty(idx, -1)}
                            className="w-5 h-5 rounded bg-white/5 border border-white/10 text-slate-400 hover:text-white flex items-center justify-center text-[11px]"
                          >
                            -
                          </button>
                          <span className="font-mono text-slate-200 text-center font-bold min-w-4 text-[10px]">
                            {item.quantity}
                          </span>
                          <button
                            id={`qty-inc-cart-${idx}`}
                            onClick={() => updateCartQty(idx, 1)}
                            className="w-5 h-5 rounded bg-white/5 border border-white/10 text-slate-400 hover:text-white flex items-center justify-center text-[11px]"
                          >
                            +
                          </button>
                        </div>

                        <span className="col-span-2 text-right font-mono text-[10px] text-slate-400">
                          {item.product.price.toFixed(2)} DH
                        </span>
                        
                        <div className="col-span-2 flex items-center justify-end gap-1 font-mono text-slate-150 font-semibold relative group">
                          <span>{(item.product.price * item.quantity).toFixed(2)} DH</span>
                          
                          {/* Instant lines write-off button */}
                          <button
                            id={`remove-line-${idx}`}
                            onClick={() => removeCartItem(idx)}
                            className="absolute -right-2 p-1 w-5 h-5 bg-white/5 border border-white/10 text-slate-500 hover:text-red-400 rounded cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-white/10"
                            title="Remove article line"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Bottom calculations & discounts settle controls panel */}
              <div className="p-5 border-t border-white/5 bg-black/15 shrink-0 space-y-4">
                
                {/* 2. Subtotal and Total records */}
                <div className="space-y-1.5 text-xs text-slate-400 font-sans">
                  <div className="flex justify-between font-medium">
                    <span>Item Net Subtotal:</span>
                    <span className="font-mono text-slate-300">{subtotal.toFixed(2)} DH</span>
                  </div>
                </div>

                {/* Divider */}
                <div className="h-[1px] bg-white/5" />

                {/* 3. Cash tender entry & card select */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Settle pay method */}
                  <div>
                    <label className="block text-[10px] font-mono tracking-wider uppercase text-slate-500 mb-1.5">
                      Tendering Method
                    </label>
                    <div className="grid grid-cols-2 gap-2 bg-black/25 p-1 border border-white/5 rounded-xl">
                      <button
                        id="payment-cash-btn"
                        onClick={() => { setPaymentMethod('Cash'); setAmountPaid(''); }}
                        className={`py-1.5 rounded-lg text-[10.5px] font-bold flex items-center justify-center gap-1 transition-all ${
                          paymentMethod === 'Cash'
                            ? 'bg-indigo-600 text-white shadow shadow-indigo-600/15'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <DollarSign size={12} /> Cash
                      </button>
                      <button
                        id="payment-card-btn"
                        onClick={() => { setPaymentMethod('Card'); setAmountPaid(''); }}
                        className={`py-1.5 rounded-lg text-[10.5px] font-bold flex items-center justify-center gap-1 transition-all ${
                          paymentMethod === 'Card'
                            ? 'bg-indigo-600 text-white shadow shadow-indigo-600/15'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <CreditCard size={12} /> Card
                      </button>
                    </div>
                  </div>

                  {/* Cash received calculator for change! */}
                  <div>
                    <label className="block text-[10px] font-mono tracking-wider uppercase text-slate-500 mb-1.5">
                      {paymentMethod === 'Card' ? 'Card Tendering' : 'Cash Received (DH)'}
                    </label>
                    {paymentMethod === 'Card' ? (
                      <div className="w-full bg-black/20 text-slate-500 border border-white/5 rounded-xl py-2 px-3 text-xs italic">
                        Swipe terminal direct
                      </div>
                    ) : (
                      <input
                        id="cash-received-input"
                        type="number"
                        step="0.01"
                        placeholder={total.toFixed(2)}
                        value={amountPaid}
                        onChange={(e) => setAmountPaid(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 focus:border-indigo-500 rounded-xl py-2 px-3 text-xs font-mono text-slate-200 outline-none placeholder-slate-500"
                      />
                    )}
                  </div>
                </div>

                {/* 4. TOTAL & MASTER CTA EXECUTION BUTTON (corresponds to visual board) */}
                <div className="bg-black/30 border border-white/5 rounded-2xl p-4 flex items-center justify-between shadow-inner gap-4">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-mono text-slate-500 uppercase">Order Drawer Total</span>
                    <span className="text-2xl font-mono text-white font-semibold tracking-tight mt-0.5">
                      {total.toFixed(2)} DH
                    </span>
                  </div>

                  <button
                    id="checkout-pay-print-btn"
                    onClick={handleCheckoutSettle}
                    disabled={cart.length === 0 || isSettingUpCheckout}
                    className="h-12 bg-indigo-600 hover:bg-indigo-500 text-white disabled:bg-white/5 disabled:text-slate-600 px-6 rounded-xl text-xs font-bold tracking-wide uppercase transition-colors shadow-lg shadow-indigo-600/20 flex items-center gap-1.5 shrink-0 hover:scale-[1.01]"
                  >
                    {isSettingUpCheckout ? "Processing..." : "PAY / PRINT RECEIPT"}
                  </button>
                </div>

              </div>

            </div>

          </div>
        )}

        <React.Suspense fallback={
          <div className="py-24 text-center font-mono text-xs text-zinc-500 animate-pulse">
            Loading workspace module...
          </div>
        }>
          {/* --- 2. INVENTORY WORKSPACE TAB --- */}
          {activeTab === 'inventory' && (
            <InventoryTab 
              currentUser={currentUser} 
              products={products} 
              onRefreshProducts={syncStoreData} 
              onZoomImage={(src, name, price) => setZoomedImage({ src, alt: name, name, price })}
            />
          )}

          {/* --- 3. EXPENSES WORKSPACE TAB --- */}
          {activeTab === 'expenses' && (
            <ExpensesTab 
              currentUser={currentUser} 
              expenses={expenses} 
              onRefreshExpenses={syncStoreData}
            />
          )}

          {/* --- 4. REPORTS WORKSPACE TAB --- */}
          {activeTab === 'reports' && (
            <ReportsTab 
              sales={sales} 
              expenses={expenses} 
              products={products}
            />
          )}

          {/* --- 5. REGISTERED USERS DESK WORKSPACE TAB --- */}
          {activeTab === 'users' && (
            <AdminUsersTab 
              currentUser={currentUser} 
              onResetDatabase={syncStoreData}
            />
          )}
        </React.Suspense>

      </main>

      {/* Footer Contact Details */}
      <footer className="bg-[#121212] border-t border-white/5 py-4 px-6 shrink-0 text-center flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-500 z-10">
        <div className="flex items-center gap-1.5 font-mono">
          <span>&copy; {new Date().getFullYear()}</span>
          <span className="font-bold text-slate-400">GIRL STORE</span>
          <span>&bull; POS System</span>
        </div>
        
        <div className="flex flex-wrap justify-center items-center gap-6 text-[11px]">
          <a 
            href="https://instagram.com/girl46store" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="flex items-center gap-1.5 text-slate-400 hover:text-indigo-400 transition-colors"
          >
            <Instagram size={13} className="text-pink-500" />
            <span>@girl46store</span>
          </a>

          <a 
            href="https://wa.me/212751859558" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-slate-400 hover:text-emerald-400 transition-colors"
          >
            <Phone size={13} className="text-emerald-500" />
            <span>0751859558</span>
          </a>

          <div className="flex items-center gap-1.5 text-slate-400">
            <MapPin size={13} className="text-indigo-400" />
            <span>Bin Jeradi, à côté de Café Eglo</span>
          </div>
        </div>
      </footer>

      {/* --- EXTRA ABSOLUTE PORTALS FOR DIALOGS AND POPUPS --- */}

      {/* Modal - Settled Receipt View */}
      {settledSaleReceipt && (
        <CheckoutReceipt
          sale={settledSaleReceipt}
          onClose={() => setSettledSaleReceipt(null)}
        />
      )}

      {/* Lightbox / Image Zoom Modal */}
      <AnimatePresence>
        {zoomedImage && (
          <motion.div
            id="image-zoom-lightbox"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setZoomedImage(null)}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out select-none"
          >
            {/* Close button top right */}
            <button
              id="close-lightbox"
              onClick={(e) => {
                e.stopPropagation();
                setZoomedImage(null);
              }}
              className="absolute top-4 right-4 z-50 p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>

            {/* Container for Image & Details */}
            <motion.div
              initial={{ scale: 0.9, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-2xl w-full bg-[#161616] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col cursor-default"
            >
              {/* Aspect Ratio / Responsive image container */}
              <div className="relative aspect-square sm:aspect-[4/3] bg-black/40 overflow-hidden flex items-center justify-center">
                <img
                  src={zoomedImage.src}
                  alt={zoomedImage.alt}
                  referrerPolicy="no-referrer"
                  className="max-h-[60vh] max-w-full object-contain"
                />
              </div>

              {/* Text Description Drawer */}
              <div className="p-5 border-t border-white/5 bg-[#121212] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-indigo-400 font-bold">
                    Article Zoom View
                  </span>
                  <h3 className="text-base text-white font-normal leading-snug">
                    {zoomedImage.name}
                  </h3>
                </div>
                
                {zoomedImage.price !== undefined && (
                  <div className="flex flex-col sm:text-right shrink-0">
                    <span className="text-[9px] font-mono uppercase text-slate-500">Retail price</span>
                    <span className="text-lg font-bold text-indigo-400 font-mono">
                      {zoomedImage.price.toFixed(2)} DH
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Logout Confirmation Dialogue Modal */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <motion.div
            id="logout-confirm-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 select-none"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-[#161616] border border-white/5 max-w-sm w-full rounded-2xl p-6 shadow-2xl relative overflow-hidden text-center space-y-5"
            >
              <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-2">
                <LogOut size={22} />
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-bold text-white font-sans">Exit System / تسجيل الخروج</h3>
                <p className="text-xs text-slate-400 leading-normal font-sans">
                  Are you sure you want to end your session? All daily sales will be consolidated into the monthly database ledger.
                </p>
                <p className="text-[11px] text-indigo-400 font-sans font-semibold">
                  هل أنت متأكد من رغبتك في الخروج من النظام؟
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  id="confirm-logout-cancel-btn"
                  onClick={() => setShowLogoutConfirm(false)}
                  className="px-4 py-2.5 bg-white/5 border border-white/5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 text-xs font-semibold transition-colors"
                >
                  Cancel / إلغاء
                </button>
                <button
                  id="confirm-logout-yes-btn"
                  onClick={() => {
                    sessionStorage.removeItem('girlstore_user');
                    sessionStorage.removeItem('girlstore_active_tab');
                    setCurrentUser(null);
                    setCart([]);
                    setAmountPaid('');
                    setShowLogoutConfirm(false);
                  }}
                  className="px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-semibold transition-colors shadow-lg shadow-red-600/10"
                >
                  Confirm Exit / خروج
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
