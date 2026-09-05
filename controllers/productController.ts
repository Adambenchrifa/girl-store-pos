import { Request, Response } from "express";
import { asyncHandler } from "../middleware/error";
import {
  getProductsList,
  getProductByBarcodeItem,
  createNewProduct,
  updateProductItem,
  deleteProductItem
} from "../services/productService";

export const getProducts = asyncHandler(async (req: Request, res: Response) => {
  const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
  const search = req.query.search as string | undefined;

  const result = getProductsList(page, limit, search);
  res.json(result);
});

export const getProductByBarcodeHandler = asyncHandler(async (req: Request, res: Response) => {
  const { barcode } = req.params;
  const product = getProductByBarcodeItem(barcode);
  res.json(product);
});

export const postCreateProduct = asyncHandler(async (req: Request, res: Response) => {
  const newProduct = createNewProduct(req.body);
  res.status(201).json(newProduct);
});

export const putUpdateProduct = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updatedProduct = updateProductItem({ ...req.body, id });
  res.json(updatedProduct);
});

export const deleteProductById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  deleteProductItem(id);
  res.json({ success: true, message: "Product deleted successfully / تم حذف المنتج بنجاح" });
});
