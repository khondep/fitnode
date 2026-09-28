// FitNode 2.0 — input validation helpers.
// Enums mirror the CHECK constraints in supabase/migrations — the SQL file
// remains the single source of truth; these guards keep invalid values out
// of the API before they reach Postgres.

import {
  APPLICATION_STATUSES,
  APPLICATION_EVENT_TYPES,
  INTERVIEW_TYPES,
  INTERVIEW_STATUSES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_SOURCES,
  CONTACT_RELATIONSHIPS,
} from "./types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

function makeOneOf<T extends readonly string[]>(
  allowed: T
): (value: unknown) => value is T[number] {
  return (value: unknown): value is T[number] =>
    typeof value === "string" && (allowed as readonly string[]).includes(value);
}

export const isApplicationStatus = makeOneOf(APPLICATION_STATUSES);
export const isApplicationEventType = makeOneOf(APPLICATION_EVENT_TYPES);
export const isInterviewType = makeOneOf(INTERVIEW_TYPES);
export const isInterviewStatus = makeOneOf(INTERVIEW_STATUSES);
export const isTaskPriority = makeOneOf(TASK_PRIORITIES);
export const isTaskStatus = makeOneOf(TASK_STATUSES);
export const isTaskSource = makeOneOf(TASK_SOURCES);
export const isContactRelationship = makeOneOf(CONTACT_RELATIONSHIPS);

/** Trim and cap a free-text field. Returns null for empty/undefined input. */
export function sanitizeText(
  value: unknown,
  maxLength: number
): string | null | undefined {
  if (value === undefined) return undefined; // field not present in patch
  if (value === null) return null; // explicit clear
  if (typeof value !== "string") return undefined; // wrong type → ignore
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, maxLength);
}

/** Require a non-empty text field (for POST bodies). */
export function requireText(
  value: unknown,
  maxLength: number
): string | null {
  const sanitized = sanitizeText(value, maxLength);
  return typeof sanitized === "string" && sanitized.length > 0
    ? sanitized
    : null;
}

/**
 * Parse `?page` and `?pageSize` with sane caps. Returns null when the
 * supplied values are invalid (caller decides: 400 or defaults).
 */
export function parsePagination(searchParams: URLSearchParams): {
  page: number;
  pageSize: number;
  from: number;
  to: number;
} | null {
  const pageRaw = searchParams.get("page") ?? "1";
  const sizeRaw = searchParams.get("pageSize") ?? "50";

  const page = Number.parseInt(pageRaw, 10);
  const pageSize = Number.parseInt(sizeRaw, 10);

  if (!Number.isInteger(page) || page < 1 || page > 10_000) return null;
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) return null;

  const from = (page - 1) * pageSize;
  return { page, pageSize, from, to: from + pageSize - 1 };
}

/**
 * Validate an ISO-8601 timestamp string ("2026-10-02T14:00:00Z").
 * Returns undefined when absent, null when invalid — callers distinguish.
 */
export function parseIsoTimestamp(
  value: unknown
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Validate an integer field. undefined → not present, null → invalid. */
export function parseIntField(
  value: unknown,
  min: number,
  max: number
): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  if (value < min || value > max) return null;
  return value;
}
