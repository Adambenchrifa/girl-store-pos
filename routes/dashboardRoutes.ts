import { Router } from "express";
import { getDashboardStatsHandler } from "../controllers/dashboardController";

const router = Router();

router.get("/stats", getDashboardStatsHandler);

export default router;
