/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const { contextBridge, ipcRenderer } = require('electron');

// Protect the preload execution and bridge only allowed APIs to the frontend
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Fetch available system printers
   */
  getPrinters: () => ipcRenderer.invoke('get-printers'),

  /**
   * Print receipt HTML silently on a specific printer
   */
  printSilent: (options) => ipcRenderer.invoke('print-silent', options),

  /**
   * Get packaged application metadata
   */
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  /**
   * Toggle system startup item registration
   */
  toggleAutoStart: (enable) => ipcRenderer.invoke('toggle-autostart', enable),

  /**
   * Read system startup registration status
   */
  checkAutoStart: () => ipcRenderer.invoke('check-autostart'),

  /**
   * Check for updates (pre-configured architecture)
   */
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),

  /**
   * Forward high-priority logs from frontend straight to disk log-rotation
   */
  logMessage: (level, category, message, context) => 
    ipcRenderer.invoke('log-message', { level, category, message, context })
});

console.log('[Electron Preload] Secured Context Bridge fully initialized.');
