/**
 * Tehran wall-clock <-> absolute-instant conversion.
 *
 * Iran is UTC+03:30 year-round (DST abolished 2022-06-21), so a fixed offset
 * is correct — and, unlike a browser `Date` parse, it is *explicit*.
 *
 * The bug this file exists to kill: exam start/end times used to be sent as
 * naive strings (`2026-06-15T08:30:00`, no offset). Postgres casts those into
 * `timestamptz` using the database session timezone (UTC on Supabase), while
 * the teacher typing "08:30" means 08:30 Tehran. Every exam window was
 * therefore 3h30m away from what the teacher scheduled.
 *
 * Rules:
 *  - `wallClockToIso`  — teacher input (Tehran wall clock) -> unambiguous instant.
 *  - `isoToWallClock`  — persisted instant -> Tehran wall clock for the editor.
 *  - A legacy value with NO offset is interpreted as Tehran wall clock, which
 *    is what its author meant at the time.
 */

/** UTC+03:30 in milliseconds. */
export const TEHRAN_OFFSET_MS = (3 * 60 + 30) * 60 * 1000;

export interface TehranWallClock {
  /** `YYYY-MM-DD` */
  date: string;
  /** `HH:mm` */
  hour: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Convert Tehran wall-clock fields to an ISO-8601 instant (UTC, `Z`).
 * Returns `null` when either input is missing or malformed.
 */
export function wallClockToIso(dateYmd: string, hourHm: string): string | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateYmd || '').trim());
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(String(hourHm || '').trim());
  if (!dateMatch || !timeMatch) return null;

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (hour > 23 || minute > 59) return null;

  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  if (Number.isNaN(wallAsUtc)) return null;

  return new Date(wallAsUtc - TEHRAN_OFFSET_MS).toISOString();
}

/**
 * Convert a persisted instant back to Tehran wall-clock fields.
 * Accepts `Z`/`+03:30` instants and legacy naive strings (read as Tehran).
 * Returns `null` for missing/unparseable input.
 */
export function isoToWallClock(iso: string | null | undefined): TehranWallClock | null {
  const raw = String(iso || '').trim();
  if (!raw) return null;

  const hasOffset = /(?:Z|[+-]\d{2}:?\d{2})$/.test(raw);
  const ms = Date.parse(hasOffset ? raw : `${raw}+03:30`);
  if (Number.isNaN(ms)) return null;

  const shifted = new Date(ms + TEHRAN_OFFSET_MS);
  return {
    date: `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`,
    hour: `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`,
  };
}
