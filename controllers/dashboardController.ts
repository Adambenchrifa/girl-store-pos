import { Request, Response } from "express";
import { asyncHandler } from "../middleware/error";
import { getAllSales, getAllExpenses } from "../database";

export const getDashboardStats = asyncHandler(async (req: Request, res: Response) => {
  const sales = getAllSales();
  const expenses = getAllExpenses();

  const todayString = new Date().toISOString().slice(0, 10);

  // Daily Revenue (where date matches today)
  const todaySales = sales.filter(s => s.dateTime.startsWith(todayString));
  const dailyRevenue = todaySales.reduce((acc, s) => acc + s.total, 0);
  const dailySalesCount = todaySales.length;

  const todayExpensesAmount = expenses
    .filter(e => e.date === todayString)
    .reduce((acc, e) => acc + e.amount, 0);

  // Complete revenues vs total expenses in database
  const totalRevenues = sales.reduce((acc, s) => acc + s.total, 0);
  const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);
  const netProfit = totalRevenues - totalExpenses;

  // Top-selling items aggregation
  const pCount: { [name: string]: { qty: number, rev: number } } = {};
  sales.forEach(sale => {
    sale.items.forEach(item => {
      const label = item.productName;
      if (!pCount[label]) {
        pCount[label] = { qty: 0, rev: 0 };
      }
      pCount[label].qty += item.quantity;
      pCount[label].rev += item.total;
    });
  });

  const topProducts = Object.entries(pCount)
    .map(([name, stat]) => ({
      name,
      quantity: stat.qty,
      revenue: Number(stat.rev.toFixed(2))
    }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  res.json({
    dailyRevenue: Number(dailyRevenue.toFixed(2)),
    dailySalesCount,
    unpaidExpenses: Number(totalExpenses.toFixed(2)), // Represent overhead costs logged
    dailyExpenses: Number(todayExpensesAmount.toFixed(2)),
    profitAndLoss: {
      revenue: Number(totalRevenues.toFixed(2)),
      expenses: Number(totalExpenses.toFixed(2)),
      profit: Number(netProfit.toFixed(2))
    },
    topProducts
  });
});
