import { Request, Response } from "express";
import { asyncHandler } from "../middleware/error";
import { checkUsbStatus } from "../services/usbService";

export const getUsbStatus = asyncHandler(async (req: Request, res: Response) => {
  res.json(checkUsbStatus());
});
