import { Router } from "express";
import {
  getProducts,
  getProductByBarcodeHandler,
  postCreateProduct,
  putUpdateProduct,
  deleteProductById
} from "../controllers/productController";

const router = Router();

router.get("/", getProducts);
router.get("/barcode/:barcode", getProductByBarcodeHandler);
router.post("/", postCreateProduct);
router.put("/:id", putUpdateProduct);
router.delete("/:id", deleteProductById);

export default router;
