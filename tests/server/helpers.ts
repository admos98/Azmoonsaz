/**
 * Test doubles for the serverless handlers.
 *
 * The API handlers take `(req, res)` and read `teacher.admin` (a Supabase
 * client) — so a test only needs a fake req/res and a chainable fake client.
 * No network, no database.
 */

type AnyRecord = Record<string, unknown>;

export interface FakeRes {
  statusCode: number;
  body: unknown;
  headers: Record<string, string>;
  status(code: number): FakeRes;
  json(payload: unknown): FakeRes;
  setHeader(name: string, value: string): void;
}

export function createRes(): FakeRes {
  const res: FakeRes = {
    statusCode: 0,
    body: undefined,
    headers: {},
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
    setHeader(name: string, value: string) {
      res.headers[name] = value;
    },
  };
  return res;
}

export function createReq(overrides: AnyRecord = {}) {
  return {
    method: 'GET',
    body: {},
    query: {},
    headers: {},
    socket: { remoteAddress: '127.0.0.1' },
    url: '/api/test',
    ...overrides,
  } as AnyRecord;
}

export interface QueryContext {
  table: string;
  op: 'select' | 'insert' | 'update' | 'upsert' | 'delete';
  filters: Record<string, unknown>;
  payload?: AnyRecord;
}

export interface TableConfig {
  /** Rows returned when the builder is awaited (a PostgREST select). */
  rows?: unknown[] | null;
  /** Row returned by `.single()` / `.maybeSingle()`. */
  single?: unknown;
  /**
   * Full control: return `{ data, error }` to answer, or `undefined` to fall
   * through to the defaults above.
   */
  onResult?: (ctx: QueryContext) => { data?: unknown; error?: unknown } | undefined;
}

export interface FakeAdmin {
  from(table: string): unknown;
  /** Everything `.from()` was called with, in order. */
  readonly calls: string[];
}

/**
 * Chainable PostgREST-ish stub.
 *
 * Supports the shapes the handlers actually use:
 *   `await client.from(t).select().eq().in().order()`
 *   `client.from(t).insert(payload).select().single()`
 *   `client.from(t).select().eq().maybeSingle()`
 */
export function createAdmin(tables: Record<string, TableConfig> = {}): FakeAdmin {
  const calls: string[] = [];

  const admin: FakeAdmin = {
    calls,
    from(table: string) {
      calls.push(table);
      const config = tables[table] || {};
      const state: QueryContext & { pending?: unknown } = {
        table,
        op: 'select',
        filters: {},
      };

      const resolve = (kind: 'single' | 'maybeSingle' | 'await') => {
        const custom = config.onResult?.(state);
        if (custom) return Promise.resolve(custom);
        if (state.op !== 'select' && state.payload) {
          return Promise.resolve({ data: state.payload, error: null });
        }
        if (kind === 'await') return Promise.resolve({ data: config.rows ?? null, error: null });
        return Promise.resolve({ data: config.single ?? null, error: null });
      };

      const builder: AnyRecord = {
        select() {
          return builder;
        },
        insert(payload: unknown) {
          state.op = 'insert';
          state.payload = payload as AnyRecord;
          return builder;
        },
        update(payload: unknown) {
          state.op = 'update';
          state.payload = payload as AnyRecord;
          return builder;
        },
        upsert(payload: unknown) {
          state.op = 'upsert';
          state.payload = payload as AnyRecord;
          return builder;
        },
        delete() {
          state.op = 'delete';
          return builder;
        },
        eq(column: string, value: unknown) {
          state.filters[column] = value;
          return builder;
        },
        in(column: string, values: unknown) {
          state.filters[column] = values;
          return builder;
        },
        order() {
          return builder;
        },
        limit() {
          return builder;
        },
        single: () => resolve('single'),
        maybeSingle: () => resolve('maybeSingle'),
        then: (onFulfilled: unknown, onRejected: unknown) =>
          resolve('await').then(onFulfilled as never, onRejected as never),
      };
      return builder;
    },
  };
  return admin;
}

/** Build a rows-select config that honours `eq`/`in` filters itself. */
export function filterRows(rows: AnyRecord[]): TableConfig {
  return {
    onResult: (ctx) => {
      if (ctx.op !== 'select') return undefined;
      let result = rows;
      for (const [column, value] of Object.entries(ctx.filters)) {
        result = result.filter((row) =>
          Array.isArray(value)
            ? value.includes(row[column])
            : row[column] === value,
        );
      }
      return { data: result, error: null };
    },
  };
}
