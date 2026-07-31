import { Router } from "express";
import {
  getProducts,
  postCreateProduct,
  putUpdateProduct,
  deleteProductById
} from "../controllers/productController";

const router = Router();

router.get("/", getProducts);
router.post("/", postCreateProduct);
router.put("/:id", putUpdateProduct);
router.delete("/:id", deleteProductById);

export default router;
