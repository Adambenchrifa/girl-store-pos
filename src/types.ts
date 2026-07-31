/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ProductVariant {
  sku: string;
  size: string;
  color: string;
  stock: number;
}

export interface Product {
  id: string;
  name: string;
  arabicName: string;
  category: string;
  barcode: string;
  price: number;
  image: string;
  variants: ProductVariant[];
  imagePath?: string;
  purchasePrice?: number;
  sellingPrice?: number;
  status?: 'In Stock' | 'Out of Stock';
}

export interface CartItem {
  product: Product;
  variant: ProductVariant;
  quantity: number;
}

export interface SaleItem {
  productId: string;
  productName: string;
  sku: string;
  size: string;
  color: string;
  price: number;
  purchasePrice?: number;
  quantity: number;
  total: number;
}

export interface Sale {
  id: string;
  receiptNo: string;
  dateTime: string;
  userId: string;
  staffName: string;
  items: SaleItem[];
  subtotal: number;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  discountAmount: number;
  taxRate: number; // e.g. 0.15 for 15% VAT
  taxAmount: number;
  total: number;
  paymentMethod: 'Cash' | 'Card';
  amountPaid: number;
  change: number;
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  category: string; // "Rent" | "Water" | "Electricity" | "Internet" | "Salaries" | "Other"
  date: string;
}

export interface User {
  id: string;
  username: string;
  role: 'Admin' | 'Staff';
  name: string;
}

export interface DashboardStats {
  dailyRevenue: number;
  dailySalesCount: number;
  unpaidExpenses: number;
  dailyExpenses: number;
  profitAndLoss: {
    revenue: number;
    expenses: number;
    profit: number;
  };
  topProducts: {
    name: string;
    quantity: number;
    revenue: number;
  }[];
}
