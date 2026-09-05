import { Request, Response } from "express";
import { asyncHandler } from "../middleware/error";
import { getSalesList, processNewSale } from "../services/saleService";

export const getSales = asyncHandler(async (req: Request, res: Response) => {
  const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
  const startDate = req.query.startDate as string | undefined;
  const endDate = req.query.endDate as string | undefined;

  const result = getSalesList(page, limit, startDate, endDate);
  res.json(result);
});

export const postCreateSale = asyncHandler(async (req: Request, res: Response) => {
  const result = processNewSale(req.body);
  res.json(result);
});
