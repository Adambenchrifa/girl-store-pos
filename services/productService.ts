import { Product, ProductVariant } from "../types";
import { AppError } from "../middleware/error";
import { checkRequiredFields, checkArray } from "../utils/validation";
import {
  getAllProducts as dbGetAllProducts,
  getProductsPaginated as dbGetProductsPaginated,
  getProductByBarcode as dbGetProductByBarcode,
  createProduct as dbCreateProduct,
  updateProduct as dbUpdateProduct,
  deleteProduct as dbDeleteProduct
} from "../database";

export function getProductsList(page?: number, limit?: number, search?: string) {
  if (page !== undefined || limit !== undefined) {
    return dbGetProductsPaginated(page || 1, limit || 50, search);
  }
  return dbGetAllProducts();
}

export function getProductByBarcodeItem(barcode: string): Product {
  if (!barcode) {
    throw new AppError("Barcode parameter is required / مطلوب رمز الباركود", 400);
  }

  const product = dbGetProductByBarcode(barcode);

  if (!product) {
    throw new AppError("Product not found with this barcode / لم يتم العثور على منتج بهذا الباركود", 404);
  }

  return product;
}

export interface CreateProductData extends Record<string, unknown> {
  name?: string;
  arabicName?: string;
  category?: string;
  barcode?: string;
  price?: number;
  image?: string;
  variants?: Array<Partial<ProductVariant>>;
  imagePath?: string;
  purchasePrice?: number;
  sellingPrice?: number;
  status?: string;
}

export function createNewProduct(data: CreateProductData): Product {
  const { name, arabicName, category, barcode, price, image, variants, imagePath, purchasePrice, sellingPrice, status } = data;

  checkRequiredFields(data, ["name", "variants"]);
  checkArray(variants, "variants");

  const finalPrice = sellingPrice !== undefined ? Number(sellingPrice) : (price !== undefined ? Number(price) : undefined);
  if (finalPrice === undefined || isNaN(finalPrice)) {
    throw new AppError("Selling price is required and must be a valid number / سعر البيع مطلوب ويجب أن يكون رقماً صالحاً", 400);
  }

  const mVariants = ((variants || []) as Array<Partial<ProductVariant>>).map((v, index) => ({
    sku: v.sku || `SKU-${Date.now()}-${index}`,
    size: v.size || "M",
    color: v.color || "Default",
    stock: Number(v.stock ?? 0)
  }));

  const totalStock = mVariants.reduce((sum, v) => sum + v.stock, 0);
  const finalStatus = status || (totalStock > 0 ? "In Stock" : "Out of Stock");

  const newProduct: Product = {
    id: `prod-${Date.now()}`,
    name: (name || "").trim(),
    arabicName: arabicName ? arabicName.trim() : (name || "").trim(),
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

  dbCreateProduct(newProduct);
  return newProduct;
}

export interface UpdateProductData {
  id: string;
  name?: string;
  arabicName?: string;
  category?: string;
  barcode?: string;
  price?: number;
  image?: string;
  variants?: Array<Partial<ProductVariant>>;
  imagePath?: string;
  purchasePrice?: number;
  sellingPrice?: number;
  status?: string;
}

export function updateProductItem(data: UpdateProductData): Product | undefined {
  const { id, name, arabicName, category, barcode, price, image, variants, imagePath, purchasePrice, sellingPrice, status } = data;

  const products = dbGetAllProducts();
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

  dbUpdateProduct(id, updates);

  const updatedProducts = dbGetAllProducts();
  return updatedProducts.find(p => p.id === id);
}

export function deleteProductItem(id: string): void {
  const deleted = dbDeleteProduct(id);
  if (!deleted) {
    throw new AppError("Product not found / لم يتم العثور على المنتج", 404);
  }
}
