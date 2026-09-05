import { getDashboardStats } from "../database";

export function getDashboardMetrics() {
  return getDashboardStats();
}
