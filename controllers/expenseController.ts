import { Request, Response } from "express";
import { asyncHandler } from "../middleware/error";
import { getExpensesList, createNewExpense, deleteExpenseItem } from "../services/expenseService";

export const getExpenses = asyncHandler(async (req: Request, res: Response) => {
  res.json(getExpensesList());
});

export const postCreateExpense = asyncHandler(async (req: Request, res: Response) => {
  const newExpense = createNewExpense(req.body);
  res.status(201).json(newExpense);
});

export const deleteExpenseById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  deleteExpenseItem(id);
  res.json({ success: true, message: "Expense entry unregistered successfully / تم حذف قيد المصروف بنجاح" });
});
