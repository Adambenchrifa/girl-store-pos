import { Router } from "express";
import { getUsbStatus } from "../controllers/usbController";

const router = Router();

router.get("/status", getUsbStatus);

export default router;
