import { Request, Response } from "express";
import { Expense } from "../types";
import { AppError, asyncHandler } from "../middleware/error";
import { checkRequiredFields, checkPositiveNumber } from "../utils/validation";
import {
  getAllExpenses,
  createExpense,
  deleteExpense
} from "../database";

export const getExpenses = asyncHandler(async (req: Request, res: Response) => {
  res.json(getAllExpenses());
});

export const postCreateExpense = asyncHandler(async (req: Request, res: Response) => {
  const { title, amount, category, date, description, operatorName } = req.body;

  checkRequiredFields(req.body, ["title", "amount"]);
  checkPositiveNumber(amount, "amount");

  const newExpense: Expense = {
    id: `exp-${Date.now()}`,
    title: title.trim(),
    amount: Math.abs(Number(amount)),
    category: category || "General Overhead",
    date: date || new Date().toISOString().slice(0, 10)
  };

  createExpense(newExpense);
  res.status(201).json(newExpense);
});

export const deleteExpenseById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const deleted = deleteExpense(id);
  if (!deleted) {
    throw new AppError("Expense entry not found / لم يتم العثور على قيد المصروف", 404);
  }
  res.json({ success: true, message: "Expense entry unregistered successfully / تم حذف قيد المصروف بنجاح" });
});
