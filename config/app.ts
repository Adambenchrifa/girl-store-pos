import { appConfig } from "./index";

/**
 * Re-exported compatibility variables to prevent breaking existing imports in the application.
 */
export const PORT = appConfig.port;
export const APP_DIR = appConfig.appDir;
export const BASE_DATA_DIR = appConfig.baseDataDir;
export const UPLOAD_DIR = appConfig.uploadsDir;
