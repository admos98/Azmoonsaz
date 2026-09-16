/**
 * @license SPDX-License-Identifier: Apache-2.0
 *
 * Centralized logger. In production, only errors are shown.
 * In development, all levels are visible.
 */

const isProd = import.meta.env.PROD;

export const logger = {
  error(...args: unknown[]) {
    console.error(...args);
  },
  warn(...args: unknown[]) {
    if (!isProd) console.warn(...args);
  },
  log(...args: unknown[]) {
    if (!isProd) console.log(...args);
  },
  info(...args: unknown[]) {
    if (!isProd) console.info(...args);
  },
};
