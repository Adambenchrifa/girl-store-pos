import { Request, Response } from "express";
import { asyncHandler } from "../middleware/error";
import { getDashboardMetrics } from "../services/dashboardService";

export const getDashboardStatsHandler = asyncHandler(async (req: Request, res: Response) => {
  const stats = getDashboardMetrics();
  res.json(stats);
});
