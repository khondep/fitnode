import { describe, it, expect } from "vitest";
import {
  isUuid,
  isApplicationStatus,
  isApplicationEventType,
  isInterviewType,
  isTaskPriority,
  isContactRelationship,
  sanitizeText,
  requireText,
  parsePagination,
  parseIsoTimestamp,
  parseIntField,
  isValidEmail,
  isValidHttpUrl,
} from "./validation";

describe("isUuid", () => {
  it("accepts canonical v4 uuids", () => {
    expect(isUuid("9b2f5b1e-0c1d-4e2a-9f3b-7c8d1e2f3a4b")).toBe(true);
  });
  it("is case-insensitive", () => {
    expect(isUuid("9B2F5B1E-0C1D-4E2A-9F3B-7C8D1E2F3A4B")).toBe(true);
  });
  it("rejects non-uuid strings, wrong types, and malformed versions", () => {
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid("")).toBe(false);
    expect(isUuid(123)).toBe(false);
    expect(isUuid(null)).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });
});

describe("enum guards", () => {
  it("accepts every declared application status", () => {
    for (const s of [
      "SAVED", "APPLIED", "RECRUITER_CONTACT", "OA", "INTERVIEW",
      "FINAL_ROUND", "OFFER", "REJECTED", "WITHDRAWN", "GHOSTED",
    ]) {
      expect(isApplicationStatus(s)).toBe(true);
    }
  });
  it("rejects statuses that are not in the CHECK constraint", () => {
    expect(isApplicationStatus("MAYBE")).toBe(false);
    expect(isApplicationStatus("saved")).toBe(false); // case-sensitive
    expect(isApplicationStatus(null)).toBe(false);
    expect(isApplicationStatus(undefined)).toBe(false);
  });
  it("accepts declared event types and rejects unknown ones", () => {
    expect(isApplicationEventType("JOB_SAVED")).toBe(true);
    expect(isApplicationEventType("APPLICATION_SUBMITTED")).toBe(true);
    expect(isApplicationEventType("MADE_UP_EVENT")).toBe(false);
  });
  it("accepts declared interview types and rejects unknown ones", () => {
    expect(isInterviewType("TECHNICAL")).toBe(true);
    expect(isInterviewType("PHONE_SCREEN")).toBe(true);
    expect(isInterviewType("COFFEE_CHAT")).toBe(false);
  });
  it("accepts declared task priorities and rejects unknown ones", () => {
    expect(isTaskPriority("HIGH")).toBe(true);
    expect(isTaskPriority("URGENT")).toBe(false);
  });
  it("accepts declared contact relationships and rejects unknown ones", () => {
    expect(isContactRelationship("RECRUITER")).toBe(true);
    expect(isContactRelationship("FRIEND")).toBe(false);
  });
});

describe("sanitizeText", () => {
  it("trims whitespace and returns trimmed value", () => {
    expect(sanitizeText("  hello  ", 100)).toBe("hello");
  });
  it("caps length", () => {
    expect(sanitizeText("abcdef", 3)).toBe("abc");
  });
  it("maps empty/whitespace-only to null (explicit clear)", () => {
    expect(sanitizeText("   ", 100)).toBeNull();
    expect(sanitizeText("", 100)).toBeNull();
  });
  it("passes null through as an explicit clear", () => {
    expect(sanitizeText(null, 100)).toBeNull();
  });
  it("treats undefined as field-absent", () => {
    expect(sanitizeText(undefined, 100)).toBeUndefined();
  });
  it("ignores non-string values (treated as absent, not an error)", () => {
    expect(sanitizeText(42, 100)).toBeUndefined();
  });
});

describe("requireText", () => {
  it("returns the trimmed string when present", () => {
    expect(requireText(" Amazon ", 200)).toBe("Amazon");
  });
  it("returns null for missing or empty values", () => {
    expect(requireText(undefined, 200)).toBeNull();
    expect(requireText("", 200)).toBeNull();
    expect(requireText("   ", 200)).toBeNull();
  });
});

describe("parsePagination", () => {
  it("defaults to page 1 / pageSize 50", () => {
    const p = parsePagination(new URLSearchParams(""));
    expect(p).toEqual({ page: 1, pageSize: 50, from: 0, to: 49 });
  });
  it("computes the range window for later pages", () => {
    const p = parsePagination(new URLSearchParams("page=3&pageSize=10"));
    expect(p).toEqual({ page: 3, pageSize: 10, from: 20, to: 29 });
  });
  it("rejects non-numeric, zero, negative, and oversized values", () => {
    expect(parsePagination(new URLSearchParams("page=abc"))).toBeNull();
    expect(parsePagination(new URLSearchParams("page=0"))).toBeNull();
    expect(parsePagination(new URLSearchParams("page=-1"))).toBeNull();
    expect(parsePagination(new URLSearchParams("pageSize=101"))).toBeNull();
    expect(parsePagination(new URLSearchParams("pageSize=0"))).toBeNull();
  });
});

describe("parseIsoTimestamp", () => {
  it("normalizes valid timestamps to ISO strings", () => {
    expect(parseIsoTimestamp("2026-10-02T14:00:00Z")).toBe(
      "2026-10-02T14:00:00.000Z"
    );
    expect(parseIsoTimestamp("2026-10-02T10:00:00-04:00")).toBe(
      "2026-10-02T14:00:00.000Z"
    );
  });
  it("returns null for invalid date strings", () => {
    expect(parseIsoTimestamp("not a date")).toBeNull();
    expect(parseIsoTimestamp("2026-13-45T99:99:99Z")).toBeNull();
  });
  it("distinguishes absent (undefined) from explicit null", () => {
    expect(parseIsoTimestamp(undefined)).toBeUndefined();
    expect(parseIsoTimestamp(null)).toBeNull();
  });
  it("treats non-string values as absent", () => {
    expect(parseIsoTimestamp(12345)).toBeUndefined();
  });
});

describe("parseIntField", () => {
  it("accepts integers within range", () => {
    expect(parseIntField(60, 1, 600)).toBe(60);
    expect(parseIntField(1, 1, 600)).toBe(1);
    expect(parseIntField(600, 1, 600)).toBe(600);
  });
  it("rejects out-of-range, non-integer, and wrong-type values", () => {
    expect(parseIntField(0, 1, 600)).toBeNull();
    expect(parseIntField(601, 1, 600)).toBeNull();
    expect(parseIntField(30.5, 1, 600)).toBeNull();
    expect(parseIntField("60", 1, 600)).toBeNull();
  });
  it("distinguishes absent (undefined) from explicit null", () => {
    expect(parseIntField(undefined, 1, 600)).toBeUndefined();
    expect(parseIntField(null, 1, 600)).toBeNull();
  });
});

describe("isValidEmail", () => {
  it("accepts ordinary addresses", () => {
    expect(isValidEmail("sarah@amazon.com")).toBe(true);
    expect(isValidEmail("a.b+tag@sub.domain.org")).toBe(true);
  });
  it("rejects malformed addresses", () => {
    expect(isValidEmail("no-at-sign")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
    expect(isValidEmail("has space@x.com")).toBe(false);
  });
});

describe("isValidHttpUrl", () => {
  it("accepts http(s) URLs", () => {
    expect(isValidHttpUrl("https://linkedin.com/in/someone")).toBe(true);
    expect(isValidHttpUrl("http://example.com")).toBe(true);
  });
  it("rejects other schemes and garbage", () => {
    expect(isValidHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isValidHttpUrl("ftp://example.com")).toBe(false);
    expect(isValidHttpUrl("not a url")).toBe(false);
  });
});
