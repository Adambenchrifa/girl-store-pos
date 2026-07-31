import { Request, Response } from "express";
import { asyncHandler } from "../middleware/error";
import { getDashboardStats } from "../database";

export const getDashboardStatsHandler = asyncHandler(async (req: Request, res: Response) => {
  // Use new optimized SQL-based dashboard stats
  const stats = getDashboardStats();
  res.json(stats);
});
