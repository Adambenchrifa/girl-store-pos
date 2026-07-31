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
  status?: "In Stock" | "Out of Stock";
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
  discountType: "percent" | "fixed";
  discountValue: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  paymentMethod: "Cash" | "Card";
  amountPaid: number;
  change: number;
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  category: string;
  date: string;
}

export interface User {
  id: string;
  username: string;
  role: "Admin" | "Staff";
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

export interface SmtpSettings {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

export interface AppDatabase {
  products: Product[];
  sales: Sale[];
  expenses: Expense[];
  users: User[];
  passwordHashes: { [username: string]: string };
  lastUpdated?: string;
  reportEmail?: string;
  smtpSettings?: SmtpSettings;
}

// ==========================================
// Generic Interfaces & Specialized Models
// ==========================================

/**
 * Standardized API Response shape utilizing generics.
 */
export interface ApiResponse<T = undefined> {
  success: boolean;
  status?: "success" | "error";
  message?: string;
  data?: T;
  error?: string;
}

/**
 * Standardized Pagination structure utilizing generics.
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

/**
 * Top-selling product entry structure.
 */
export interface TopSoldProduct {
  name: string;
  quantity: number;
  revenue: number;
}

/**
 * Structured Daily Report metrics payload.
 */
export interface DailyReportStats {
  dailyRevenue: number;
  dailyExpenses: number;
  dailyGoodsProfit: number;
  dailyNetProfit: number;
  dailySalesCount: number;
  totalRevenue: number;
  netProfit: number;
  topProducts?: TopSoldProduct[];
}
