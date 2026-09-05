import { Expense } from "../types";
import { AppError } from "../middleware/error";
import { checkRequiredFields, checkPositiveNumber } from "../utils/validation";
import {
  getAllExpenses as dbGetAllExpenses,
  createExpense as dbCreateExpense,
  deleteExpense as dbDeleteExpense
} from "../database";

export function getExpensesList(): Expense[] {
  return dbGetAllExpenses();
}

export interface CreateExpenseData extends Record<string, unknown> {
  title?: string;
  amount?: number;
  category?: string;
  date?: string;
  description?: string;
  operatorName?: string;
}

export function createNewExpense(data: CreateExpenseData): Expense {
  const { title, amount, category, date } = data;

  checkRequiredFields(data, ["title", "amount"]);
  checkPositiveNumber(amount, "amount");

  const newExpense: Expense = {
    id: `exp-${Date.now()}`,
    title: (title || "").trim(),
    amount: Math.abs(Number(amount)),
    category: category || "General Overhead",
    date: date || new Date().toISOString().slice(0, 10)
  };

  dbCreateExpense(newExpense);
  return newExpense;
}

export function deleteExpenseItem(id: string): void {
  const deleted = dbDeleteExpense(id);
  if (!deleted) {
    throw new AppError("Expense entry not found / لم يتم العثور على قيد المصروف", 404);
  }
}
