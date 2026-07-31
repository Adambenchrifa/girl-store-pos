import { Router } from "express";
import {
  getExpenses,
  postCreateExpense,
  deleteExpenseById
} from "../controllers/expenseController";

const router = Router();

router.get("/", getExpenses);
router.post("/", postCreateExpense);
router.delete("/:id", deleteExpenseById);

export default router;
