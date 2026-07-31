import { Request, Response } from "express";
import { Product, ProductVariant } from "../types";
import { AppError, asyncHandler } from "../middleware/error";
import { checkRequiredFields, checkArray } from "../utils/validation";
import {
  getAllProducts,
  getProductsPaginated,
  getProductByBarcode,
  createProduct,
  updateProduct,
  deleteProduct
} from "../database";

export const getProducts = asyncHandler(async (req: Request, res: Response) => {
  // Support pagination query params for new clients
  const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
  const search = req.query.search as string | undefined;
  
  // If pagination params provided, use new optimized method
  if (page !== undefined || limit !== undefined) {
    const result = getProductsPaginated(page || 1, limit || 50, search);
    return res.json(result);
  }
  
  // Otherwise, preserve backward compatibility with legacy method
  res.json(getAllProducts());
});

/**
 * Get single product by barcode (new endpoint)
 */
export const getProductByBarcodeHandler = asyncHandler(async (req: Request, res: Response) => {
  const { barcode } = req.params;
  
  if (!barcode) {
    throw new AppError("Barcode parameter is required / مطلوب رمز الباركود", 400);
  }
  
  const product = getProductByBarcode(barcode);
  
  if (!product) {
    throw new AppError("Product not found with this barcode / لم يتم العثور على منتج بهذا الباركود", 404);
  }
  
  res.json(product);
});

export const postCreateProduct = asyncHandler(async (req: Request, res: Response) => {
  const { name, arabicName, category, barcode, price, image, variants, imagePath, purchasePrice, sellingPrice, status } = req.body;

  checkRequiredFields(req.body, ["name", "variants"]);
  checkArray(variants, "variants");

  const finalPrice = sellingPrice !== undefined ? Number(sellingPrice) : (price !== undefined ? Number(price) : undefined);
  if (finalPrice === undefined || isNaN(finalPrice)) {
    throw new AppError("Selling price is required and must be a valid number / سعر البيع مطلوب ويجب أن يكون رقماً صالحاً", 400);
  }

  const mVariants = (variants as Array<Partial<ProductVariant>>).map((v, index) => ({
    sku: v.sku || `SKU-${Date.now()}-${index}`,
    size: v.size || "M",
    color: v.color || "Default",
    stock: Number(v.stock ?? 0)
  }));

  const totalStock = mVariants.reduce((sum, v) => sum + v.stock, 0);
  const finalStatus = status || (totalStock > 0 ? "In Stock" : "Out of Stock");

  const newProduct: Product = {
    id: `prod-${Date.now()}`,
    name: name.trim(),
    arabicName: arabicName ? arabicName.trim() : name.trim(),
    category: category || "Other",
    barcode: barcode || `BC-${Date.now()}`,
    price: finalPrice,
    image: image || "https://images.unsplash.com/photo-1590736969955-71cb94801759?auto=format&fit=crop&q=80&w=600",
    variants: mVariants,
    imagePath: imagePath || "",
    purchasePrice: purchasePrice !== undefined ? Number(purchasePrice) : 0,
    sellingPrice: finalPrice,
    status: finalStatus as "In Stock" | "Out of Stock"
  };

  createProduct(newProduct);
  res.status(201).json(newProduct);
});

export const putUpdateProduct = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, arabicName, category, barcode, price, image, variants, imagePath, purchasePrice, sellingPrice, status } = req.body;

  const products = getAllProducts();
  const existingProduct = products.find(p => p.id === id);
  if (!existingProduct) {
    throw new AppError("Product not found / لم يتم العثور على المنتج", 404);
  }

  let finalVariants = existingProduct.variants;
  if (variants !== undefined) {
    checkArray(variants, "variants");
    finalVariants = (variants as Array<Partial<ProductVariant>>).map((v, index) => ({
      sku: v.sku || `SKU-${Date.now()}-${index}`,
      size: v.size || "M",
      color: v.color || "Default",
      stock: Number(v.stock ?? 0)
    }));
  }

  const totalStock = finalVariants.reduce((sum: number, v: ProductVariant) => sum + Number(v.stock ?? 0), 0);
  const calculatedStatus = variants !== undefined ? (totalStock > 0 ? "In Stock" : "Out of Stock") : (status !== undefined ? status : existingProduct.status);

  const updates: Partial<Product> = {
    name: name ? name.trim() : undefined,
    arabicName: arabicName ? arabicName.trim() : undefined,
    category,
    barcode,
    price: price !== undefined ? Number(price) : (sellingPrice !== undefined ? Number(sellingPrice) : undefined),
    image,
    variants: finalVariants,
    imagePath,
    purchasePrice: purchasePrice !== undefined ? Number(purchasePrice) : undefined,
    sellingPrice: sellingPrice !== undefined ? Number(sellingPrice) : (price !== undefined ? Number(price) : undefined),
    status: calculatedStatus as "In Stock" | "Out of Stock"
  };

  updateProduct(id, updates);

  const updatedProducts = getAllProducts();
  const updatedProduct = updatedProducts.find(p => p.id === id);
  res.json(updatedProduct);
});

export const deleteProductById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const deleted = deleteProduct(id);
  if (!deleted) {
    throw new AppError("Product not found / لم يتم العثور على المنتج", 404);
  }
  res.json({ success: true, message: "Product deleted successfully / تم حذف المنتج بنجاح" });
});
