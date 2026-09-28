import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/lib/auth", () => ({ getSupabaseServerClient: vi.fn() }));

import { getSupabaseServerClient } from "@/lib/auth";
import { GET, POST } from "./route";

const USER_ID = "9b2f5b1e-0c1d-4e2a-9f3b-7c8d1e2f3a4b";
const JOB_ID = "c1a7e5d3-2b4f-4a6c-8e9d-0f1a2b3c4d5e";
const APP_ID = "e5d3c1a7-2b4f-4a6c-8e9d-0f1a2b3c4d5e";

type TableResult = {
  data: unknown;
  error?: { code?: string; message?: string } | null;
};

type QueryBuilder = {
  select: (...args: unknown[]) => QueryBuilder;
  eq: (col: string, val: unknown) => QueryBuilder;
  order: (...args: unknown[]) => QueryBuilder;
  range: (...args: unknown[]) => QueryBuilder;
  maybeSingle: () => Promise<TableResult>;
  insert: (payload: unknown) => {
    select: () => { single: () => Promise<TableResult> };
  };
  then: (resolve: (value: TableResult) => void) => void;
};

type FakeRequest = { url: string; json: () => Promise<unknown> };

function asRequest(fake: FakeRequest): NextRequest {
  return fake as unknown as NextRequest;
}

/**
 * Minimal chainable Supabase stub:
 *  - `tables` maps table name -> result for maybeSingle()/awaited queries
 *  - `insertResult` is returned by insert().select().single()
 *  - `queries` records every query (table, op, filters) for assertions
 */
function makeClient(opts: {
  user?: { id: string } | null;
  tables?: Record<string, TableResult>;
  insertResult?: { data: Record<string, unknown> | null; error?: { code?: string; message?: string } | null };
}) {
  const queries: { table: string; op: string; filters: Record<string, unknown> }[] = [];
  const insertPayloads: unknown[] = [];

  const makeChain = (table: string): QueryBuilder => {
    const filters: Record<string, unknown> = {};
    const resolveTable = (): TableResult =>
      opts.tables?.[table] ?? { data: null, error: null };
    const chain: QueryBuilder = {
      select: vi.fn(() => chain),
      eq: vi.fn((col: string, val: unknown) => {
        filters[col] = val;
        return chain;
      }),
      order: vi.fn(() => chain),
      range: vi.fn(() => chain),
      maybeSingle: vi.fn(async () => {
        queries.push({ table, op: "maybeSingle", filters });
        return resolveTable();
      }),
      insert: vi.fn((payload: unknown) => {
        insertPayloads.push(payload);
        return {
          select: () => ({
            single: async () => {
              queries.push({ table, op: "insert", filters });
              return (
                opts.insertResult ?? { data: null, error: null }
              );
            },
          }),
        };
      }),
      then: (resolve: (value: TableResult) => void) => {
        queries.push({ table, op: "await", filters });
        resolve(resolveTable());
      },
    };
    return chain;
  };

  const client = {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: opts.user === undefined ? { id: USER_ID } : opts.user },
        error: null,
      })),
    },
    from: vi.fn((table: string) => makeChain(table)),
  } as unknown as SupabaseClient;

  return { client, queries, insertPayloads };
}

beforeEach(() => {
  vi.mocked(getSupabaseServerClient).mockReset();
});

// ---- GET /api/applications -------------------------------------------------

describe("GET /api/applications", () => {
  it("returns 401 when there is no session", async () => {
    vi.mocked(getSupabaseServerClient).mockResolvedValue(
      makeClient({ user: null }).client
    );

    const res = await GET(
      asRequest({ url: "http://localhost/api/applications", json: async () => undefined })
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 on invalid pagination params", async () => {
    vi.mocked(getSupabaseServerClient).mockResolvedValue(makeClient({}).client);

    const res = await GET(
      asRequest({ url: "http://localhost/api/applications?page=0", json: async () => undefined })
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid pagination parameters" });
  });

  it("returns 400 on an invalid status filter", async () => {
    vi.mocked(getSupabaseServerClient).mockResolvedValue(makeClient({}).client);

    const res = await GET(
      asRequest({ url: "http://localhost/api/applications?status=NOPE", json: async () => undefined })
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid status filter" });
  });

  it("lists applications scoped to the user with pagination metadata", async () => {
    const { client, queries } = makeClient({
      tables: {
        applications: {
          data: [{ id: APP_ID, status: "SAVED", job: { title: "SWE" } }],
        },
      },
    });
    vi.mocked(getSupabaseServerClient).mockResolvedValue(client);

    const res = await GET(
      asRequest({
        url: "http://localhost/api/applications?page=2&pageSize=10",
        json: async () => undefined,
      })
    );
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.applications).toHaveLength(1);
    expect(body.page).toBe(2);
    expect(body.pageSize).toBe(10);

    const listQuery = queries.find((q) => q.table === "applications" && q.op === "await");
    expect(listQuery?.filters.user_id).toBe(USER_ID);
  });
});

// ---- POST /api/applications ------------------------------------------------

describe("POST /api/applications", () => {
  it("returns 401 when there is no session", async () => {
    vi.mocked(getSupabaseServerClient).mockResolvedValue(
      makeClient({ user: null }).client
    );

    const res = await POST(
      asRequest({
        url: "http://localhost/api/applications",
        json: async () => ({ job_id: JOB_ID }),
      })
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when job_id is missing or not a UUID", async () => {
    vi.mocked(getSupabaseServerClient).mockResolvedValue(makeClient({}).client);

    const res = await POST(
      asRequest({
        url: "http://localhost/api/applications",
        json: async () => ({}),
      })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/job_id/i);
  });

  it("returns 404 when the job does not belong to the user", async () => {
    vi.mocked(getSupabaseServerClient).mockResolvedValue(
      makeClient({ tables: { jobs: { data: null } } }).client
    );

    const res = await POST(
      asRequest({
        url: "http://localhost/api/applications",
        json: async () => ({ job_id: JOB_ID }),
      })
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Job not found" });
  });

  it("returns 400 when an explicit status is not in the enum", async () => {
    vi.mocked(getSupabaseServerClient).mockResolvedValue(
      makeClient({ tables: { jobs: { data: { id: JOB_ID } } } }).client
    );

    const res = await POST(
      asRequest({
        url: "http://localhost/api/applications",
        json: async () => ({ job_id: JOB_ID, status: "PENDING" }),
      })
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid status" });
  });

  it("returns 404 when resume_version_id points at someone else's resume", async () => {
    vi.mocked(getSupabaseServerClient).mockResolvedValue(
      makeClient({
        tables: { jobs: { data: { id: JOB_ID } }, resumes: { data: null } },
      }).client
    );

    const res = await POST(
      asRequest({
        url: "http://localhost/api/applications",
        json: async () => ({ job_id: JOB_ID, resume_version_id: APP_ID }),
      })
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Resume version not found" });
  });

  it("creates an application scoped to the user and returns 201", async () => {
    const row = { id: APP_ID, user_id: USER_ID, job_id: JOB_ID, status: "SAVED" };
    const { client, insertPayloads } = makeClient({
      tables: { jobs: { data: { id: JOB_ID } } },
      insertResult: { data: row },
    });
    vi.mocked(getSupabaseServerClient).mockResolvedValue(client);

    const res = await POST(
      asRequest({
        url: "http://localhost/api/applications",
        json: async () => ({ job_id: JOB_ID, source: "adzuna" }),
      })
    );
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.existing).toBe(false);
    expect(body.application).toEqual(row);

    expect(insertPayloads).toHaveLength(1);
    expect(insertPayloads[0]).toMatchObject({
      user_id: USER_ID,
      job_id: JOB_ID,
      source: "adzuna",
    });
  });

  it("is idempotent: a unique violation returns the existing application with 200", async () => {
    const existing = { id: APP_ID, user_id: USER_ID, job_id: JOB_ID, status: "APPLIED" };
    const { client, queries } = makeClient({
      tables: {
        jobs: { data: { id: JOB_ID } },
        applications: { data: existing },
      },
      insertResult: { data: null, error: { code: "23505", message: "duplicate key" } },
    });
    vi.mocked(getSupabaseServerClient).mockResolvedValue(client);

    const res = await POST(
      asRequest({
        url: "http://localhost/api/applications",
        json: async () => ({ job_id: JOB_ID }),
      })
    );
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.existing).toBe(true);
    expect(body.application).toEqual(existing);

    // The fallback lookup must be scoped to both the user and the job.
    const fallback = queries.find(
      (q) => q.table === "applications" && q.op === "maybeSingle"
    );
    expect(fallback?.filters.user_id).toBe(USER_ID);
    expect(fallback?.filters.job_id).toBe(JOB_ID);
  });

  it("returns 500 on unexpected insert errors", async () => {
    vi.mocked(getSupabaseServerClient).mockResolvedValue(
      makeClient({
        tables: { jobs: { data: { id: JOB_ID } } },
        insertResult: { data: null, error: { code: "XX000", message: "boom" } },
      }).client
    );

    const res = await POST(
      asRequest({
        url: "http://localhost/api/applications",
        json: async () => ({ job_id: JOB_ID }),
      })
    );
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("boom");
  });
});
