/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Package, Plus, Trash2, Edit, AlertCircle, Sparkles, CheckCircle, FileCheck2, Barcode, Search } from 'lucide-react';
import { Product, ProductVariant, User } from '../types';

interface InventoryTabProps {
  currentUser: User;
  onRefreshProducts: () => void;
  products: Product[];
  onZoomImage?: (src: string, name: string, price: number) => void;
}

export default function InventoryTab({ currentUser, products, onRefreshProducts, onZoomImage }: InventoryTabProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [arabicName, setArabicName] = useState('');
  const [category, setCategory] = useState('طقم بجامات بنات شتوية');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [barcode, setBarcode] = useState('');
  const [image, setImage] = useState('');
  const [imagePath, setImagePath] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [initialStock, setInitialStock] = useState('10');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdatingVariant, setIsUpdatingVariant] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // States for Inner Tabs
  const [inventorySubTab, setInventorySubTab] = useState<'active' | 'outofstock'>('active');
  const [outOfStockQuery, setOutOfStockQuery] = useState('');
  const [restockingProductId, setRestockingProductId] = useState<string | null>(null);
  const [restockQty, setRestockQty] = useState('10');

  // Edit Product States
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editName, setEditName] = useState('');
  const [editArabicName, setEditArabicName] = useState('');
  const [editCategory, setEditCategory] = useState('طقم بجامات بنات شتوية');
  const [editPurchasePrice, setEditPurchasePrice] = useState('');
  const [editSellingPrice, setEditSellingPrice] = useState('');
  const [editBarcode, setEditBarcode] = useState('');
  const [editImage, setEditImage] = useState('');
  const [editImagePath, setEditImagePath] = useState('');
  const [isEditUploading, setIsEditUploading] = useState(false);
  const editFileInputRef = React.useRef<HTMLInputElement>(null);

  const isAdmin = currentUser.role === 'Admin';

  const clearForm = () => {
    setName('');
    setArabicName('');
    setPurchasePrice('');
    setSellingPrice('');
    setBarcode('');
    setImage('');
    setImagePath('');
    setInitialStock('10');
  };

  const generateBarcode = () => {
    const prefix = "69012";
    const body = String(Math.floor(Math.random() * 10000000)).padStart(7, "0");
    const checkDigit = String(Math.floor(Math.random() * 10));
    setBarcode(`${prefix}${body}${checkDigit}`);
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    setIsUploading(true);
    setErrorMsg(null);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Could not upload file.");
      }
      const data = await response.json();
      
      setImage(data.imageUrl);
      setImagePath(data.imagePath);
    } catch (err: any) {
      setErrorMsg("File upload failed: " + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setErrorMsg("Security violation. Only Administrators are authorized to append catalog inventory.");
      return;
    }

    if (!name.trim() || !sellingPrice || Number(sellingPrice) <= 0) {
      setErrorMsg("Please supply a valid product description and positive selling price.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    // Flat structure: 1 single variant matching the default format
    const variantsList: ProductVariant[] = [{
      sku: `PJ-${name.replace(/[^a-zA-Z0-9]+/g, '-').slice(0, 10).toUpperCase()}-${Date.now()}`,
      size: "",
      color: "",
      stock: Number(initialStock || 0)
    }];

    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          arabicName: arabicName.trim() || name.trim(),
          category,
          barcode: barcode || `BC-${Date.now()}`,
          price: Number(sellingPrice),
          purchasePrice: Number(purchasePrice || 0),
          sellingPrice: Number(sellingPrice),
          image: image.trim() || "https://images.unsplash.com/photo-1590736969955-71cb94801759?auto=format&fit=crop&q=80&w=600",
          imagePath: imagePath.trim(),
          variants: variantsList,
          status: Number(initialStock || 0) > 0 ? "In Stock" : "Out of Stock"
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Could not append catalog entry.");
      }
      await response.json();

      setSuccessMsg("Catalog item launched successfully with detailed warehouse record!");
      onRefreshProducts();
      clearForm();
      setTimeout(() => {
        setSuccessMsg(null);
        setShowAddForm(false);
      }, 2000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed saving catalog entry.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateEditBarcode = () => {
    const prefix = "69012";
    const body = String(Math.floor(Math.random() * 10000000)).padStart(7, "0");
    const checkDigit = String(Math.floor(Math.random() * 10));
    setEditBarcode(`${prefix}${body}${checkDigit}`);
  };

  const handleEditImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    setIsEditUploading(true);
    setErrorMsg(null);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Could not upload file.");
      }
      const data = await response.json();
      
      setEditImage(data.imageUrl);
      setEditImagePath(data.imagePath);
    } catch (err: any) {
      setErrorMsg("File upload failed: " + err.message);
    } finally {
      setIsEditUploading(false);
    }
  };

  const handleEditProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    if (!isAdmin) {
      setErrorMsg("Security violation. Only Administrators are authorized to edit catalog inventory.");
      return;
    }

    if (!editName.trim() || !editSellingPrice || Number(editSellingPrice) <= 0) {
      setErrorMsg("Please supply a valid product description and positive selling price.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const response = await fetch(`/api/products/${editingProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          arabicName: editArabicName.trim() || editName.trim(),
          category: editCategory,
          barcode: editBarcode || editingProduct.barcode,
          price: Number(editSellingPrice),
          purchasePrice: Number(editPurchasePrice || 0),
          sellingPrice: Number(editSellingPrice),
          image: editImage.trim() || "https://images.unsplash.com/photo-1590736969955-71cb94801759?auto=format&fit=crop&q=80&w=600",
          imagePath: editImagePath.trim()
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Could not edit catalog entry.");
      }
      await response.json();

      setSuccessMsg("Catalog item edited successfully!");
      onRefreshProducts();
      setTimeout(() => {
        setSuccessMsg(null);
        setEditingProduct(null);
      }, 2000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed saving catalog entry.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!isAdmin) {
      alert("Unauthorized operator. Staff lack write authority over the master catalogue.");
      return;
    }
    if (!confirm("Are you sure you want to write off this product block from the database catalogue?")) return;

    try {
      const response = await fetch(`/api/products/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error("Could not delete item.");
      setSuccessMsg("Product written off catalog.");
      onRefreshProducts();
      setTimeout(() => setSuccessMsg(null), 1500);
    } catch (err: any) {
      alert(err.message || "Failed removing catalog block.");
    }
  };

  // Adjust product stock directly in a flat way
  const handleUpdateStock = async (product: Product, newStock: number) => {
    if (!isAdmin) {
      alert("Warning: Staff operators are not authorized to adjust core stock sheets.");
      return;
    }

    const targetStock = Math.max(0, newStock);

    // Update the variant stock level, flattening pre-seeded multiple items back-compatibly
    let updatedVariants: ProductVariant[] = [];
    if (product.variants.length === 0) {
      updatedVariants = [{
        sku: `PJ-${product.name.replace(/[^a-zA-Z0-9]+/g, '-').slice(0, 10).toUpperCase()}`,
        size: "",
        color: "",
        stock: targetStock
      }];
    } else {
      updatedVariants = product.variants.map((v, i) => {
        if (i === 0) return { ...v, stock: targetStock };
        return { ...v, stock: 0 }; // Zero-out other variants to achieve absolute flat representation
      });
    }

    setIsUpdatingVariant(product.id);

    try {
      const response = await fetch(`/api/products/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variants: updatedVariants })
      });

      if (!response.ok) throw new Error("Stock state sync failure");
      onRefreshProducts();
    } catch (e: any) {
      alert("Could not update stock level: " + e.message);
    } finally {
      setIsUpdatingVariant(null);
    }
  };

  // Compute stats based on flattened sums
  const totalStockUnits = products.reduce((acc, p) => acc + p.variants.reduce((vAcc, v) => vAcc + v.stock, 0), 0);
  const productsWithLowStock = products.filter(p => {
    const sum = p.variants.reduce((vAcc, v) => vAcc + v.stock, 0);
    return sum < 3;
  });

  return (
    <div id="inventory-tab-content" className="space-y-6">
      
      {/* Visual Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center bg-[#161616] p-5 rounded-2xl border border-white/5 gap-4 shadow-md">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-indigo-400 font-semibold">Administrative Register</span>
          <h1 className="font-sans text-xl tracking-tight text-white font-light mt-1">Master Stock & Catalogue</h1>
        </div>
        
        {isAdmin && (
          <button
            id="toggle-add-product-form"
            onClick={() => {
              setShowAddForm(!showAddForm);
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className="px-4 py-2.5 bg-indigo-600 text-white font-bold hover:bg-indigo-505 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/25 shrink-0 hover:scale-[1.01]"
          >
            <Plus size={16} /> New Apparel Article
          </button>
        )}
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#161616] border border-white/5 rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-slate-450">
            <Package size={18} />
          </div>
          <div>
            <div className="text-[10px] text-slate-500 font-mono uppercase">Unique Articles</div>
            <div className="text-xl font-mono text-slate-200 font-bold mt-0.5">{products.length} Items</div>
          </div>
        </div>

        <div className="bg-[#161616] border border-white/5 rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-indigo-400">
            <FileCheck2 size={18} />
          </div>
          <div>
            <div className="text-[10px] text-slate-500 font-mono uppercase">Total Stock Val</div>
            <div className="text-xl font-mono text-slate-200 font-bold mt-0.5">{totalStockUnits} Units</div>
          </div>
        </div>

        <div className="bg-[#161616] border border-white/5 rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-red-950/20 border border-red-900/30 flex items-center justify-center text-red-450">
            <AlertCircle size={18} />
          </div>
          <div>
            <div className="text-[10px] text-slate-500 font-mono uppercase">Low-Stock Warnings</div>
            <div className="text-xl font-mono text-red-400 font-bold mt-0.5">{productsWithLowStock.length} Alerts</div>
          </div>
        </div>
      </div>

      {/* Add Product Drawer Overlay */}
      {showAddForm && isAdmin && (
        <div className="bg-[#161616] border border-white/5 rounded-2xl p-6 shadow-2xl relative animate-in slide-in-from-top-4 duration-250">
          <h2 className="text-xs font-mono uppercase tracking-wider text-indigo-400 border-b border-white/5 pb-3 mb-5 flex items-center gap-2">
            <Sparkles size={16} /> Load New Product Design
          </h2>

          {errorMsg && (
            <div className="bg-red-950/40 border border-red-900/60 p-3 rounded-xl text-xs text-red-400 mb-5 animate-bounce">
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-950/40 border border-emerald-900/60 p-3 rounded-xl text-xs text-emerald-400 mb-5 flex items-center gap-1.5">
              <CheckCircle size={15} />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleAddProduct} className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                  Apparel Name (English)
                </label>
                <input
                  id="product-eng-name"
                  type="text"
                  placeholder="[Insert Product Name]"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#0F0F0F] border border-white/10 focus:border-indigo-500 rounded-xl py-2.5 px-4 text-xs text-slate-200 outline-none transition-all placeholder-slate-600"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                  Standard Category
                </label>
                <select
                  id="product-cat-select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-[#0F0F0F] border border-white/10 focus:border-indigo-500 rounded-xl py-2.5 px-3 text-xs text-slate-200 outline-none transition-all"
                >
                  <option value="طقم بجامات بنات شتوية">Winter Pajamas Set</option>
                  <option value="بدلات بنات صيفية">Summer Pajamas Set</option>
                  <option value="بجامات نسائية قطنية">Cotton Pajamas</option>
                  <option value="أطقم بجامات ساتان">Luxury Satin</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                  Apparel Barcode (13-Digit)
                </label>
                <div className="flex gap-2">
                  <input
                    id="product-barcode-input"
                    type="text"
                    placeholder="[Enter Barcode]"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    className="w-full bg-[#0F0F0F] border border-white/10 focus:border-indigo-500 rounded-xl py-2.5 px-3 text-xs font-mono text-slate-200 outline-none transition-all placeholder-slate-650"
                  />
                  <button
                    id="gen-barcode-btn"
                    type="button"
                    onClick={generateBarcode}
                    className="px-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-slate-350 flex items-center justify-center transition-colors shrink-0"
                    title="Generate code automatically"
                  >
                    <Barcode size={16} />
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                  Purchase Price (Cost) (DH)
                </label>
                <input
                  id="product-purchase-price-input"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="[Enter purchase cost]"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  className="w-full bg-[#0F0F0F] border border-white/10 focus:border-indigo-500 rounded-xl py-2.5 px-4 text-xs text-slate-200 outline-none transition-all placeholder-slate-650"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                  Selling Price (Retail) (DH)
                </label>
                <input
                  id="product-selling-price-input"
                  type="number"
                  step="0.01"
                  min="0.1"
                  placeholder="[Enter selling price]"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
                  className="w-full bg-[#0F0F0F] border border-white/10 focus:border-indigo-500 rounded-xl py-2.5 px-4 text-xs text-slate-200 outline-none transition-all placeholder-slate-650"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                  Apparel Display Image
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handleImageFileChange}
                />
                <div 
                  id="click-file-upload-trigger"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-32 border-2 border-dashed border-white/10 hover:border-indigo-500/50 rounded-xl bg-[#0F0F0F] flex flex-col items-center justify-center cursor-pointer transition-all gap-2 relative overflow-hidden group"
                >
                  {isUploading ? (
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-[10px] text-slate-500 font-mono">Uploading file...</span>
                    </div>
                  ) : image ? (
                    <>
                      <img src={image} alt="apparel thumbnail" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                        <span className="text-white text-xs font-semibold">Change Image File</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-450 group-hover:text-white transition-colors border border-white/5">
                        <Plus size={18} />
                      </div>
                      <span className="text-[11px] text-slate-400 font-medium">Select apparel picture (+ icon)</span>
                      <span className="text-[9px] text-slate-600 font-mono">JPG, PNG, GIF up to 5MB</span>
                    </>
                  )}
                </div>
              </div>

              {/* Pre-set Image options */}
              <div className="flex flex-col justify-end pb-1 gap-2">
                <span className="text-[10px] text-slate-500 font-mono">Or pick preset illustration:</span>
                <div className="flex gap-2 overflow-x-auto">
                  {[
                    { label: "Classic Plaid", url: "https://images.unsplash.com/photo-1590736969955-71cb94801759?auto=format&fit=crop&q=80&w=600" },
                    { label: "Satin Silk", url: "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&q=80&w=600" },
                    { label: "Cozy Knit", url: "https://images.unsplash.com/photo-1618677831708-0e7fda3148b4?auto=format&fit=crop&q=80&w=600" },
                  ].map((preset, pIdx) => (
                    <button
                      key={pIdx}
                      id={`image-preset-choice-${pIdx}`}
                      type="button"
                      onClick={() => { setImage(preset.url); setImagePath(''); }}
                      className="px-2 py-1 bg-white/5 border border-white/5 hover:border-white/10 rounded text-[9px] font-mono text-slate-400 transition-all whitespace-nowrap cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* INITIAL STOCK ENTRY BOX */}
            <div className="border border-white/5 bg-black/15 p-4 rounded-xl space-y-3">
              <span className="block text-[10px] font-mono uppercase tracking-wider text-indigo-400 font-semibold">
                📦 Initial Stock Balance
              </span>
              
              <div className="max-w-xs">
                <label className="block text-[10px] uppercase font-mono tracking-wider text-slate-400 mb-1.5">
                  Initial Quantity in Warehouse
                </label>
                <input
                  id="product-initial-stock"
                  type="number"
                  min="0"
                  placeholder="e.g. 50"
                  value={initialStock}
                  onChange={(e) => setInitialStock(e.target.value)}
                  className="w-full bg-[#0F0F0F] border border-white/10 focus:border-indigo-500 rounded-xl py-2.5 px-3 text-xs text-slate-200 outline-none transition-all placeholder-slate-600"
                  required
                />
              </div>
              <p className="text-[10px] text-slate-500 font-sans">
                *The initial stock quantity loaded into the warehouse registry for this article name.
              </p>
            </div>

            <div className="flex gap-3 justify-end pt-3">
              <button
                id="cancel-add-product-btn"
                type="button"
                onClick={() => {
                  clearForm();
                  setShowAddForm(false);
                }}
                className="px-4 py-2 w-32 bg-white/5 border border-white/5 text-slate-300 hover:bg-white/10 rounded-xl text-xs font-semibold transition-colors"
              >
                Close Drawer
              </button>
              
              <button
                id="submit-add-product-btn"
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 w-52 bg-indigo-600 hover:bg-indigo-505 text-white rounded-xl text-xs font-bold transition-colors shadow-lg shadow-indigo-600/25"
              >
                {isSubmitting ? "Syncing catalogues..." : "Publish Apparel Set"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Product Drawer Overlay */}
      {editingProduct && isAdmin && (
        <div className="bg-[#161616] border border-white/5 rounded-2xl p-6 shadow-2xl relative animate-in slide-in-from-top-4 duration-250">
          <h2 className="text-xs font-mono uppercase tracking-wider text-indigo-400 border-b border-white/5 pb-3 mb-5 flex items-center gap-2">
            <Edit size={16} /> Edit Product Design: {editingProduct.name}
          </h2>

          {errorMsg && (
            <div className="bg-red-950/40 border border-red-900/60 p-3 rounded-xl text-xs text-red-400 mb-5 animate-bounce">
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-950/40 border border-emerald-900/60 p-3 rounded-xl text-xs text-emerald-400 mb-5 flex items-center gap-1.5">
              <CheckCircle size={15} />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleEditProduct} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                  Apparel Name (English)
                </label>
                <input
                  id="product-edit-eng-name"
                  type="text"
                  placeholder="[Insert Product Name]"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-[#0F0F0F] border border-white/10 focus:border-indigo-500 rounded-xl py-2.5 px-4 text-xs text-slate-200 outline-none transition-all placeholder-slate-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                  Arabic Name
                </label>
                <input
                  id="product-edit-ar-name"
                  type="text"
                  placeholder="[Arabic Name]"
                  value={editArabicName}
                  onChange={(e) => setEditArabicName(e.target.value)}
                  className="w-full bg-[#0F0F0F] border border-white/10 focus:border-indigo-500 rounded-xl py-2.5 px-4 text-xs text-slate-200 outline-none transition-all placeholder-slate-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                  Standard Category
                </label>
                <select
                  id="product-edit-cat-select"
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full bg-[#0F0F0F] border border-white/10 focus:border-indigo-500 rounded-xl py-2.5 px-3 text-xs text-slate-200 outline-none transition-all"
                >
                  <option value="طقم بجامات بنات شتوية">Winter Pajamas Set</option>
                  <option value="بدلات بنات صيفية">Summer Pajamas Set</option>
                  <option value="بجامات نسائية قطنية">Cotton Pajamas</option>
                  <option value="أطقم بجامات ساتان">Luxury Satin</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                  Apparel Barcode (13-Digit)
                </label>
                <div className="flex gap-2">
                  <input
                    id="product-edit-barcode-input"
                    type="text"
                    placeholder="[Enter Barcode]"
                    value={editBarcode}
                    onChange={(e) => setEditBarcode(e.target.value)}
                    className="w-full bg-[#0F0F0F] border border-white/10 focus:border-indigo-500 rounded-xl py-2.5 px-3 text-xs font-mono text-slate-200 outline-none transition-all placeholder-slate-650"
                  />
                  <button
                    id="gen-edit-barcode-btn"
                    type="button"
                    onClick={generateEditBarcode}
                    className="px-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-slate-350 flex items-center justify-center transition-colors shrink-0"
                    title="Generate code automatically"
                  >
                    <Barcode size={16} />
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                  Purchase Price (Cost) (DH)
                </label>
                <input
                  id="product-edit-purchase-price-input"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="[Enter purchase cost]"
                  value={editPurchasePrice}
                  onChange={(e) => setEditPurchasePrice(e.target.value)}
                  className="w-full bg-[#0F0F0F] border border-white/10 focus:border-indigo-500 rounded-xl py-2.5 px-4 text-xs text-slate-200 outline-none transition-all placeholder-slate-650"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                  Selling Price (Retail) (DH)
                </label>
                <input
                  id="product-edit-selling-price-input"
                  type="number"
                  step="0.01"
                  min="0.1"
                  placeholder="[Enter selling price]"
                  value={editSellingPrice}
                  onChange={(e) => setEditSellingPrice(e.target.value)}
                  className="w-full bg-[#0F0F0F] border border-white/10 focus:border-indigo-500 rounded-xl py-2.5 px-4 text-xs text-slate-200 outline-none transition-all placeholder-slate-650"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                  Apparel Display Image
                </label>
                <input
                  type="file"
                  ref={editFileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handleEditImageFileChange}
                />
                <div 
                  id="click-edit-file-upload-trigger"
                  onClick={() => editFileInputRef.current?.click()}
                  className="w-full h-32 border-2 border-dashed border-white/10 hover:border-indigo-500/50 rounded-xl bg-[#0F0F0F] flex flex-col items-center justify-center cursor-pointer transition-all gap-2 relative overflow-hidden group"
                >
                  {isEditUploading ? (
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-[10px] text-slate-500 font-mono">Uploading file...</span>
                    </div>
                  ) : editImage ? (
                    <>
                      <img src={editImage} alt="apparel thumbnail" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                        <span className="text-white text-xs font-semibold">Change Image File</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-450 group-hover:text-white transition-colors border border-white/5">
                        <Plus size={18} />
                      </div>
                      <span className="text-[11px] text-slate-400 font-medium">Select apparel picture (+ icon)</span>
                      <span className="text-[9px] text-slate-600 font-mono">JPG, PNG, GIF up to 5MB</span>
                    </>
                  )}
                </div>
              </div>

              {/* Pre-set Image options */}
              <div className="flex flex-col justify-end pb-1 gap-2">
                <span className="text-[10px] text-slate-500 font-mono">Or pick preset illustration:</span>
                <div className="flex gap-2 overflow-x-auto">
                  {[
                    { label: "Classic Plaid", url: "https://images.unsplash.com/photo-1590736969955-71cb94801759?auto=format&fit=crop&q=80&w=600" },
                    { label: "Satin Silk", url: "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&q=80&w=600" },
                    { label: "Cozy Knit", url: "https://images.unsplash.com/photo-1618677831708-0e7fda3148b4?auto=format&fit=crop&q=80&w=600" },
                  ].map((preset, pIdx) => (
                    <button
                      key={pIdx}
                      id={`edit-image-preset-choice-${pIdx}`}
                      type="button"
                      onClick={() => { setEditImage(preset.url); setEditImagePath(''); }}
                      className="px-2 py-1 bg-white/5 border border-white/5 hover:border-white/10 rounded text-[9px] font-mono text-slate-400 transition-all whitespace-nowrap cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-3">
              <button
                id="cancel-edit-product-btn"
                type="button"
                onClick={() => {
                  setEditingProduct(null);
                }}
                className="px-4 py-2 w-32 bg-white/5 border border-white/5 text-slate-300 hover:bg-white/10 rounded-xl text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              
              <button
                id="submit-edit-product-btn"
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 w-52 bg-indigo-600 hover:bg-indigo-505 text-white rounded-xl text-xs font-bold transition-colors shadow-lg shadow-indigo-600/25"
              >
                {isSubmitting ? "Saving changes..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Catalogue List Spreadsheet styling */}
      <div className="bg-[#161616] p-6 border border-white/5 rounded-2xl shadow-xl space-y-6">
        
        {/* Sub-tabs header block */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-white/5 pb-4 gap-4">
          <div className="flex bg-black/20 p-1 border border-white/5 rounded-xl">
            <button
              id="subtab-active-inventory"
              type="button"
              onClick={() => setInventorySubTab('active')}
              className={`px-4 py-2 rounded-lg text-xs font-medium tracking-wide transition-all uppercase font-mono flex items-center gap-2 cursor-pointer ${
                inventorySubTab === 'active'
                  ? 'bg-indigo-600 text-white font-bold shadow shadow-indigo-600/25'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Active Stocks</span>
              <span className="px-1.5 py-0.5 bg-black/30 rounded text-[9px] border border-white/5 font-bold">
                {products.filter(p => p.variants.reduce((sum, v) => sum + v.stock, 0) > 0).length}
              </span>
            </button>
            <button
              id="subtab-outofstock-inventory"
              type="button"
              onClick={() => setInventorySubTab('outofstock')}
              className={`px-4 py-2 rounded-lg text-xs font-medium tracking-wide transition-all uppercase font-mono flex items-center gap-2 cursor-pointer ${
                inventorySubTab === 'outofstock'
                  ? 'bg-[#2D1616] text-red-400 font-bold border border-red-950 shadow shadow-red-950/25'
                  : 'text-slate-500 hover:text-slate-350'
              }`}
            >
              <span>Out of Stock</span>
              <span className="px-1.5 py-0.5 bg-black/40 rounded text-[9px] border border-white/10 font-bold">
                {products.filter(p => p.variants.reduce((sum, v) => sum + v.stock, 0) === 0).length}
              </span>
            </button>
          </div>

          {/* Search bar specifically for Out of Stock ledger as requested */}
          {inventorySubTab === 'outofstock' && (
            <div className="relative w-full sm:w-80">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                <Search size={14} />
              </span>
              <input
                id="search-outofstock-input"
                type="text"
                placeholder="Search out of stock sleepwear..."
                value={outOfStockQuery}
                onChange={(e) => setOutOfStockQuery(e.target.value)}
                className="w-full bg-[#0F0F0F] border border-white/15 focus:border-red-500 rounded-xl py-2 pl-9 pr-8 text-xs text-slate-200 outline-none transition-all placeholder-slate-600"
              />
              {outOfStockQuery && (
                <button
                  type="button"
                  onClick={() => setOutOfStockQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-500 hover:text-white"
                >
                  X
                </button>
              )}
            </div>
          )}
        </div>

        {/* List Content */}
        {inventorySubTab === 'active' ? (
          /* Active Inventory List */
          <div className="space-y-4">
            {products.filter(p => p.variants.reduce((sum, v) => sum + v.stock, 0) > 0).length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs italic border border-dashed border-white/5 rounded-2xl bg-white/[0.01]">
                No active stock items registered in the warehouse.
              </div>
            ) : (
              products
                .filter(p => p.variants.reduce((sum, v) => sum + v.stock, 0) > 0)
                .map((prod) => {
                  const totalStock = prod.variants.reduce((sum, v) => sum + v.stock, 0);
                  const isLow = totalStock < 3;

                  return (
                    <div 
                      key={prod.id} 
                      id={`product-item-${prod.id}`}
                      className="border border-white/5 bg-white/[0.01] p-4 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-5 hover:border-indigo-500/15 transition-all text-sm font-sans"
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div 
                          onClick={() => onZoomImage?.(prod.image, prod.name, prod.price)}
                          className="relative w-16 h-16 rounded-lg overflow-hidden border border-white/5 bg-black/40 bg-center shadow-md shadow-black/30 group cursor-zoom-in shrink-0"
                          title="Click to zoom image"
                        >
                          <img 
                            src={prod.image} 
                            alt={prod.name} 
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" 
                          />
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Search size={12} className="text-white" />
                          </div>
                        </div>
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-bold text-slate-200 truncate">{prod.name}</h3>
                            <span className="text-[10px] uppercase font-mono tracking-widest px-2 py-0.5 bg-[#0F0F0F] rounded border border-white/5 text-slate-500">
                              {prod.category}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-4 text-xs font-mono text-slate-500">
                            <span>Barcode: <span className="text-slate-400 select-all">{prod.barcode}</span></span>
                            <span>•</span>
                            <span>In-Store Price: <span className="text-indigo-400 font-bold">{prod.price.toFixed(2)} DH</span></span>
                            {prod.purchasePrice !== undefined && prod.purchasePrice > 0 && (
                              <>
                                <span>•</span>
                                <span>Cost: <span className="text-slate-400">{prod.purchasePrice.toFixed(2)} DH</span></span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end shrink-0">
                        {/* Stock Balance display */}
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col items-start md:items-end">
                            <span className="text-[10px] text-slate-500 font-mono uppercase">Stock Balance</span>
                            <span className="text-sm font-mono font-bold text-slate-200 mt-0.5">
                              {totalStock} Units
                            </span>
                          </div>

                          {isLow ? (
                            <span className="text-[9px] font-bold font-sans text-amber-400 bg-amber-950/20 px-2 py-0.5 rounded border border-amber-950/40">LOW</span>
                          ) : (
                            <span className="text-[9px] font-bold font-sans text-emerald-400 bg-emerald-950/20 px-2 py-0.5 rounded border border-emerald-950/45">IN STOCK</span>
                          )}
                        </div>

                        {/* Actions: Re-stock / Adjust directly & Delete */}
                        <div className="flex items-center gap-3">
                          {/* Restock interactive controls (Admin Only) */}
                          <div className="flex items-center gap-1.5 bg-black/25 rounded-lg p-1 border border-white/10 shrink-0">
                            {isAdmin && (
                              <button
                                id={`restock-minus-${prod.id}`}
                                disabled={totalStock === 0 || isUpdatingVariant === prod.id}
                                onClick={() => handleUpdateStock(prod, totalStock - 1)}
                                className="w-6 h-6 rounded hover:bg-white/5 text-slate-400 hover:text-white flex items-center justify-center font-bold font-mono text-xs transition-colors disabled:opacity-30 cursor-pointer"
                                title="Deduct 1 unit"
                              >
                                -
                              </button>
                            )}
                            
                            <span className="w-8 text-center text-xs font-mono font-semibold text-slate-250">
                              {totalStock}
                            </span>

                            {isAdmin && (
                              <button
                                id={`restock-plus-${prod.id}`}
                                disabled={isUpdatingVariant === prod.id}
                                onClick={() => handleUpdateStock(prod, totalStock + 1)}
                                className="w-6 h-6 rounded hover:bg-white/5 text-slate-400 hover:text-white flex items-center justify-center font-bold font-mono text-xs transition-colors cursor-pointer"
                                title="Add 1 unit"
                              >
                                +
                              </button>
                            )}
                          </div>

                          {isAdmin && (
                            <>
                              <button
                                id={`edit-product-${prod.id}`}
                                onClick={() => {
                                  setEditingProduct(prod);
                                  setEditName(prod.name);
                                  setEditArabicName(prod.arabicName || '');
                                  setEditCategory(prod.category || 'طقم بجامات بنات شتوية');
                                  setEditBarcode(prod.barcode || '');
                                  setEditPurchasePrice(prod.purchasePrice !== undefined ? String(prod.purchasePrice) : '');
                                  setEditSellingPrice(prod.sellingPrice !== undefined ? String(prod.sellingPrice) : String(prod.price));
                                  setEditImage(prod.image || '');
                                  setEditImagePath(prod.imagePath || '');
                                  setShowAddForm(false);
                                  setErrorMsg(null);
                                  setSuccessMsg(null);
                                  document.getElementById('inventory-tab-content')?.scrollIntoView({ behavior: 'smooth' });
                                }}
                                className="p-2 bg-white/5 border border-white/5 hover:bg-indigo-950/20 text-slate-500 hover:text-indigo-400 rounded-lg transition-colors flex items-center justify-center hover:border-white/10 cursor-pointer"
                                title="Edit Article"
                              >
                                <Edit size={13} />
                              </button>

                              <button
                                id={`delete-product-${prod.id}`}
                                onClick={() => handleDeleteProduct(prod.id)}
                                className="p-2 bg-white/5 border border-white/5 hover:bg-red-950/20 text-slate-500 hover:text-red-400 rounded-lg transition-colors flex items-center justify-center hover:border-white/10 cursor-pointer"
                                title="Remove Article"
                              >
                                <Trash2 size={13} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        ) : (
          /* Out of Stock Ledger */
          <div className="space-y-4">
            {products.filter(p => p.variants.reduce((sum, v) => sum + v.stock, 0) === 0).length === 0 ? (
              <div className="py-12 text-center text-emerald-400 text-xs italic border border-dashed border-emerald-950 rounded-2xl bg-emerald-950/20">
                Excellent! No products are currently out of stock. All listings are fully supplied inside the warehouse registry.
              </div>
            ) : (() => {
              const outOfStockProducts = products.filter(p => p.variants.reduce((sum, v) => sum + v.stock, 0) === 0);
              const filteredList = outOfStockProducts.filter(p => {
                const qs = outOfStockQuery.toLowerCase().trim();
                if (qs === '') return true;
                return p.name.toLowerCase().includes(qs) || 
                       p.barcode.includes(qs) || 
                       p.category.toLowerCase().includes(qs);
              });

              if (filteredList.length === 0) {
                return (
                  <div className="py-12 text-center text-slate-500 text-xs italic border border-white/5 bg-[#121212] rounded-xl">
                    No out-of-stock sleepwear items matched "{outOfStockQuery}".
                  </div>
                );
              }

              return filteredList.map((prod) => {
                const isEditingThis = restockingProductId === prod.id;

                return (
                  <div 
                    key={prod.id} 
                    id={`product-item-outofstock-${prod.id}`}
                    className="border border-red-900/20 bg-red-950/5 p-4 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-5 hover:border-red-900/40 transition-all text-sm font-sans"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div 
                        onClick={() => onZoomImage?.(prod.image, prod.name, prod.price)}
                        className="relative w-16 h-16 rounded-lg overflow-hidden border border-red-950/30 bg-black/40 bg-center shadow-md shadow-black/30 group cursor-zoom-in shrink-0"
                        title="Click to zoom image"
                      >
                        <img 
                          src={prod.image} 
                          alt={prod.name} 
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" 
                        />
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Search size={12} className="text-white" />
                        </div>
                      </div>
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-bold text-slate-200 truncate">{prod.name}</h3>
                          <span className="text-[10px] uppercase font-mono tracking-widest px-2 py-0.5 bg-red-955/20 rounded border border-red-900/30 text-red-400 uppercase">
                            OUT OF STOCK
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-4 text-xs font-mono text-slate-500">
                          <span>Barcode: <span className="text-slate-400 select-all">{prod.barcode}</span></span>
                          <span>•</span>
                          <span>In-Store Price: <span className="text-slate-350 font-bold">{prod.price.toFixed(2)} DH</span></span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end shrink-0">
                      {/* Action trigger: RESTOCK COUNTER CONTROL */}
                      <div className="flex items-center gap-3">
                        {isEditingThis ? (
                          <div className="flex items-center gap-2 bg-[#0F0F0F] border border-white/10 p-1.5 rounded-xl z-10">
                            <span className="text-[10px] font-mono text-slate-500 px-1">QTY:</span>
                            <div className="flex items-center bg-black/40 rounded-lg border border-white/5 p-0.5 h-8">
                              <button
                                type="button"
                                onClick={() => setRestockQty(q => String(Math.max(1, Number(q) - 5)))}
                                className="w-6 h-6 text-slate-400 hover:text-white hover:bg-white/5 font-mono text-xs rounded transition-all cursor-pointer"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="1"
                                value={restockQty}
                                onChange={(e) => setRestockQty(e.target.value)}
                                className="w-12 bg-transparent text-center font-mono text-xs text-slate-200 font-bold outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => setRestockQty(q => String(Number(q) + 5))}
                                className="w-6 h-6 text-slate-400 hover:text-white hover:bg-white/5 font-mono text-xs rounded transition-all cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                            <button
                              id={`confirm-restock-btn-${prod.id}`}
                              type="button"
                              onClick={async () => {
                                const count = Number(restockQty || 0);
                                if (count <= 0) {
                                  alert("Please choose a quantity greater than zero.");
                                  return;
                                }
                                await handleUpdateStock(prod, count);
                                setRestockingProductId(null);
                              }}
                              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 font-bold text-white text-[10px] rounded-lg transition-colors cursor-pointer"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setRestockingProductId(null)}
                              className="px-2 py-1.5 bg-white/5 border border-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-[10px] rounded-lg transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          isAdmin && (
                            <button
                              id={`restock-action-${prod.id}`}
                              type="button"
                              onClick={() => {
                                setRestockingProductId(prod.id);
                                setRestockQty('20');
                              }}
                              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-505 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-indigo-600/10 cursor-pointer flex items-center gap-1.5 hover:scale-[1.01]"
                            >
                              <Plus size={12} /> Restock
                            </button>
                          )
                        )}

                        {isAdmin && !isEditingThis && (
                          <>
                            <button
                              id={`edit-product-outofstock-${prod.id}`}
                              onClick={() => {
                                setEditingProduct(prod);
                                setEditName(prod.name);
                                setEditArabicName(prod.arabicName || '');
                                setEditCategory(prod.category || 'طقم بجامات بنات شتوية');
                                setEditBarcode(prod.barcode || '');
                                setEditPurchasePrice(prod.purchasePrice !== undefined ? String(prod.purchasePrice) : '');
                                setEditSellingPrice(prod.sellingPrice !== undefined ? String(prod.sellingPrice) : String(prod.price));
                                setEditImage(prod.image || '');
                                setEditImagePath(prod.imagePath || '');
                                setShowAddForm(false);
                                setErrorMsg(null);
                                setSuccessMsg(null);
                                document.getElementById('inventory-tab-content')?.scrollIntoView({ behavior: 'smooth' });
                              }}
                              className="p-2 bg-white/5 border border-white/5 hover:bg-indigo-950/20 text-slate-500 hover:text-indigo-400 rounded-lg transition-colors flex items-center justify-center hover:border-white/10 cursor-pointer"
                              title="Edit Article"
                            >
                              <Edit size={13} />
                            </button>

                            <button
                              id={`delete-product-outofstock-${prod.id}`}
                              onClick={() => handleDeleteProduct(prod.id)}
                              className="p-2 bg-white/5 border border-white/5 hover:bg-red-950/20 text-slate-550 hover:text-red-400 rounded-lg transition-colors flex items-center justify-center hover:border-white/10 cursor-pointer"
                              title="Remove Record"
                            >
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}

      </div>
    </div>
  );
}
