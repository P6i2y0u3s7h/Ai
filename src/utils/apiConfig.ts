/**
 * Centralized API endpoint resolution for StudyAI.
 * In local development, defaults to relative '/api' proxied by Vite.
 * In production (e.g. Vercel frontend + separate backend), uses VITE_API_BASE_URL if set.
 */

export const API_BASE_URL = (
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) ||
  (typeof process !== 'undefined' && process.env?.VITE_API_BASE_URL) ||
  ''
).replace(/\/+$/, '');

export function apiUrl(endpoint: string): string {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_BASE_URL}${cleanEndpoint}`;
}

