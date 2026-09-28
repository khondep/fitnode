import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("./auth", () => ({ getSupabaseServerClient: vi.fn() }));

import { getSupabaseServerClient } from "./auth";
import { jsonError, requireUser, readJsonBody, userOwnsRow } from "./api";

// ---- stub helpers ----------------------------------------------------------

type Result = { data: unknown; error?: unknown };

type QueryBuilder = {
  select: (...args: unknown[]) => QueryBuilder;
  eq: (col: string, val: unknown) => QueryBuilder;
  maybeSingle: () => Promise<Result>;
  single: () => Promise<Result>;
};

function makeQueryStub(result: Result): QueryBuilder {
  // Chainable thenable that records filters and resolves to `result`.
  const chain: QueryBuilder = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => result),
    single: vi.fn(async () => result),
  };
  return chain;
}

function makeClientStub(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: overrides.user ?? null },
        error: null,
      })),
    },
    from: vi.fn(() => makeQueryStub({ data: null, error: null })),
  } as unknown as SupabaseClient;
}

type FakeRequest = { json: () => Promise<unknown> };

function asRequest(fake: FakeRequest): NextRequest {
  return fake as unknown as NextRequest;
}

beforeEach(() => {
  vi.mocked(getSupabaseServerClient).mockReset();
});

// ---- jsonError -------------------------------------------------------------

describe("jsonError", () => {
  it("returns the given status with an { error } JSON body", async () => {
    const res = jsonError(400, "Invalid status");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid status" });
  });
});

// ---- requireUser -----------------------------------------------------------

describe("requireUser", () => {
  it("returns ok:false with a 401 response when there is no session", async () => {
    vi.mocked(getSupabaseServerClient).mockResolvedValue(
      makeClientStub({ user: null })
    );

    const result = await requireUser();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
      expect(await result.response.json()).toEqual({ error: "Not authenticated" });
    }
  });

  it("returns the client and user when a session exists", async () => {
    const user = { id: "u-123" };
    const client = makeClientStub({ user });
    vi.mocked(getSupabaseServerClient).mockResolvedValue(client);

    const result = await requireUser();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.ctx.user).toEqual(user);
      expect(result.ctx.supabase).toBe(client);
    }
  });
});

// ---- readJsonBody ----------------------------------------------------------

describe("readJsonBody", () => {
  it("parses a plain object body", async () => {
    expect(
      await readJsonBody(asRequest({ json: async () => ({ job_id: "x" }) }))
    ).toEqual({ job_id: "x" });
  });

  it("returns null for arrays and scalars (must be an object)", async () => {
    expect(await readJsonBody(asRequest({ json: async () => [1, 2] }))).toBeNull();
    expect(await readJsonBody(asRequest({ json: async () => "nope" }))).toBeNull();
    expect(await readJsonBody(asRequest({ json: async () => null }))).toBeNull();
  });

  it("returns null on malformed JSON instead of throwing", async () => {
    const req = asRequest({
      json: async () => {
        throw new Error("bad json");
      },
    });
    expect(await readJsonBody(req)).toBeNull();
  });
});

// ---- userOwnsRow -----------------------------------------------------------

describe("userOwnsRow", () => {
  it("returns true when the scoped select finds the row", async () => {
    const chain = makeQueryStub({ data: { id: "r-1" } });
    const client = { from: vi.fn(() => chain) } as unknown as SupabaseClient;

    expect(await userOwnsRow(client, "resumes", "r-1", "u-1")).toBe(true);
    expect(client.from).toHaveBeenCalledWith("resumes");
  });

  it("returns false when RLS/owner scoping hides the row (null)", async () => {
    const chain = makeQueryStub({ data: null });
    const client = { from: vi.fn(() => chain) } as unknown as SupabaseClient;

    expect(await userOwnsRow(client, "jobs", "foreign-id", "u-1")).toBe(false);
  });
});
