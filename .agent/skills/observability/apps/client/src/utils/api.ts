/**
 * Dynamic API base URLs that resolve to the current hostname.
 * This allows the dashboards to be accessed from any LAN device.
 */
const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';

export const API_BASE = `http://${host}:4000`;
export const WS_BASE = `ws://${host}:4000`;
