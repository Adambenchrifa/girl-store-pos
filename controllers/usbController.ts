import { Request, Response } from "express";
import { asyncHandler } from "../middleware/error";
import { getUsbDbPath } from "../database";

export const getUsbStatus = asyncHandler(async (req: Request, res: Response) => {
  const usbPath = getUsbDbPath(true);
  res.json({
    connected: !!usbPath,
    path: usbPath || null
  });
});
