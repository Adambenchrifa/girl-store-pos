import { Router } from "express";
import {
  getSales,
  postCreateSale
} from "../controllers/saleController";

const router = Router();

router.get("/", getSales);
router.post("/", postCreateSale);

export default router;
