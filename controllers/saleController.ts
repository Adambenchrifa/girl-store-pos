import { Request, Response } from "express";
import { Sale, SaleItem, Product } from "../types";
import { AppError, asyncHandler } from "../middleware/error";
import { checkRequiredFields, checkArray } from "../utils/validation";
import { LoggerService } from "../services/LoggerService";
import {
  getAllSales,
  getSalesPaginated,
  createSale,
  getAllProducts,
  getSalesCount
} from "../database";

export const getSales = asyncHandler(async (req: Request, res: Response) => {
  // Support pagination query params for new clients
  const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
  const startDate = req.query.startDate as string | undefined;
  const endDate = req.query.endDate as string | undefined;
  
  // If pagination params provided, use new optimized method
  if (page !== undefined || limit !== undefined) {
    const result = getSalesPaginated(page || 1, limit || 50, startDate, endDate);
    return res.json(result);
  }
  
  // Otherwise, preserve backward compatibility with legacy method
  res.json(getAllSales());
});

export const postCreateSale = asyncHandler(async (req: Request, res: Response) => {
  const { items, discountType, discountValue, taxRate, paymentMethod, amountPaid, staffId, staffName } = req.body;

  checkRequiredFields(req.body, ["items"]);
  checkArray(items, "items");

  if (items.length === 0) {
    throw new AppError("Sale must contain at least one checkout item / يجب أن تحتوي عملية البيع على منتج واحد على الأقل", 400);
  }

  const products = getAllProducts();
  const lowStockAlerts: string[] = [];
  const saleItems: SaleItem[] = [];
  let subtotal = 0;

  // 1. Process items and verify stock level bounds, dynamically building the SaleItems array
  for (const item of items) {
    const { productId, sku, quantity } = item;
    if (!productId || !sku || typeof quantity !== "number" || quantity <= 0) {
      throw new AppError("Invalid item fields inside transaction checkout list / تفاصيل المنتج غير صالحة في قائمة الدفع", 400);
    }

    const prod = products.find(p => p.id === productId);
    if (!prod) {
      throw new AppError(`Product with ID '${productId}' not found in catalog / المنتج غير موجود في الكتالوج`, 404);
    }

    const variant = prod.variants.find(v => v.sku === sku);
    if (!variant) {
      throw new AppError(`Variant with SKU '${sku}' not found under product '${prod.name}' / المقاس/اللون غير موجود للمنتج`, 404);
    }

    if (variant.stock < quantity) {
      // Just a warning or we can clamp/cap it to maximum available stock
      console.warn(`[Checkout] Requested quantity ${quantity} exceeds stock ${variant.stock} for ${prod.name} (${sku}).`);
    }

    // Deduct stock
    const newStock = Math.max(0, variant.stock - quantity);
    variant.stock = newStock;

    if (newStock <= 2) {
      lowStockAlerts.push(`Low stock alert: Product '${prod.name}' (${variant.size}/${variant.color}) has only ${newStock} items left! / تنبيه انخفاض المخزون: المنتج '${prod.name}' يتبقى منه ${newStock} فقط!`);
    }

    // Recalculate product status
    const totalStock = prod.variants.reduce((sum, v) => sum + v.stock, 0);
    prod.status = totalStock > 0 ? "In Stock" : "Out of Stock";

    const itemPrice = prod.sellingPrice !== undefined ? prod.sellingPrice : prod.price;
    const itemTotal = Number((itemPrice * quantity).toFixed(2));
    subtotal += itemTotal;

    saleItems.push({
      productId,
      productName: prod.name,
      sku,
      size: variant.size,
      color: variant.color,
      price: itemPrice,
      purchasePrice: prod.purchasePrice || 0,
      quantity,
      total: itemTotal
    });
  }

  // 2. Compute Discounts, Taxes, and Totals
  const dType = discountType === "percent" ? "percent" : "fixed";
  const dValue = Number(discountValue || 0);
  let discountAmount = 0;

  if (dType === "percent") {
    discountAmount = Number(((subtotal * dValue) / 100).toFixed(2));
  } else {
    discountAmount = Math.min(subtotal, dValue);
  }

  const tRate = Number(taxRate || 0);
  const taxAmount = Number(((subtotal - discountAmount) * tRate).toFixed(2));
  const totalVal = Number((subtotal - discountAmount + taxAmount).toFixed(2));

  const finalAmountPaid = amountPaid !== undefined ? Number(amountPaid) : totalVal;
  const changeVal = Number((finalAmountPaid - totalVal).toFixed(2));

  // 3. Generate Receipt Number
  const currentCount = getSalesCount();
  const receiptNo = `REC-${(currentCount + 1).toString().padStart(6, "0")}`;

  const newSale: Sale = {
    id: `sale-${Date.now()}`,
    receiptNo,
    dateTime: new Date().toISOString(),
    userId: staffId || "default",
    staffName: staffName || "Default Operator",
    items: saleItems,
    subtotal: Number(subtotal.toFixed(2)),
    discountType: dType,
    discountValue: dValue,
    discountAmount: Number(discountAmount.toFixed(2)),
    taxRate: tRate,
    taxAmount: Number(taxAmount.toFixed(2)),
    total: totalVal,
    paymentMethod: paymentMethod === "Card" ? "Card" : "Cash",
    amountPaid: finalAmountPaid,
    change: changeVal
  };

  // 4. Save atoms atomically to the local storage using createSale (which updates products & registers the sale)
  createSale(newSale, products);

  // 5. Log the sales transaction using LoggerService
  LoggerService.logSale(
    newSale.receiptNo,
    newSale.total,
    newSale.items.reduce((acc, item) => acc + item.quantity, 0),
    newSale.staffName
  );

  res.json({
    status: "success",
    sale: newSale,
    lowStockAlerts
  });
});
