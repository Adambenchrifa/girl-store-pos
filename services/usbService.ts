import { getUsbDbPath } from "../database";

export function checkUsbStatus(): { connected: boolean; path: string | null } {
  const usbPath = getUsbDbPath(true);
  return {
    connected: !!usbPath,
    path: usbPath || null
  };
}
