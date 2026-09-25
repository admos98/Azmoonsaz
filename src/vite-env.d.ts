/// <reference types="vite/client" />

/**
 * App version, injected by Vite from package.json (`define.__APP_VERSION__`).
 * Keep package.json as the single source of truth — bump there, not here.
 */
declare const __APP_VERSION__: string;
