/**
 * A tiny in-memory stand-in for the Supabase query builder.
 *
 * It supports only the operators our booking/lesson code uses:
 *   from(table).select(...).eq/neq/in/is/gt/gte/lte/order/limit/maybeSingle/single
 *   from(table).insert(row).select(...).single()
 *   from(table).update(patch).eq(...)
 *
 * Column selection is ignored — whole rows come back, which is fine for
 * assertions and keeps the fake small.
 */

export type Row = Record<string, any>;
export type Tables = Record<string, Row[]>;

type Filter = (row: Row) => boolean;

let idCounter = 0;
function nextId(table: string) {
  idCounter += 1;
  return `${table}-${idCounter}`;
}

export function resetFakeIds() {
  idCounter = 0;
}

class Query implements PromiseLike<{ data: any; error: any }> {
  private filters: Filter[] = [];
  private orderKey: string | null = null;
  private orderAsc = true;
  private limitN: number | null = null;
  private mode: "select" | "insert" | "update" = "select";
  private payload: Row | null = null;
  private singleMode: "none" | "maybe" | "one" = "none";

  constructor(
    private db: Tables,
    private table: string,
  ) {}

  private rows() {
    return (this.db[this.table] ??= []);
  }

  select(_cols?: string) {
    return this;
  }
  eq(col: string, val: any) {
    this.filters.push((r) => r[col] === val);
    return this;
  }
  neq(col: string, val: any) {
    this.filters.push((r) => r[col] !== val);
    return this;
  }
  in(col: string, vals: any[]) {
    this.filters.push((r) => vals.includes(r[col]));
    return this;
  }
  is(col: string, val: null) {
    this.filters.push((r) => (r[col] ?? null) === val);
    return this;
  }
  gt(col: string, val: any) {
    this.filters.push((r) => r[col] > val);
    return this;
  }
  gte(col: string, val: any) {
    this.filters.push((r) => r[col] >= val);
    return this;
  }
  lte(col: string, val: any) {
    this.filters.push((r) => r[col] <= val);
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orderKey = col;
    this.orderAsc = opts?.ascending ?? true;
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }
  insert(row: Row) {
    this.mode = "insert";
    this.payload = row;
    return this;
  }
  update(patch: Row) {
    this.mode = "update";
    this.payload = patch;
    return this;
  }
  maybeSingle() {
    this.singleMode = "maybe";
    return this;
  }
  single() {
    this.singleMode = "one";
    return this;
  }

  private matching() {
    let rows = this.rows().filter((r) => this.filters.every((f) => f(r)));
    if (this.orderKey) {
      const key = this.orderKey;
      rows = [...rows].sort((a, b) => {
        if (a[key] === b[key]) return 0;
        return (a[key] > b[key] ? 1 : -1) * (this.orderAsc ? 1 : -1);
      });
    }
    if (this.limitN !== null) rows = rows.slice(0, this.limitN);
    return rows;
  }

  private run() {
    if (this.mode === "insert") {
      const row = { id: nextId(this.table), ...this.payload };
      this.rows().push(row);
      return { data: this.singleMode === "none" ? [row] : row, error: null };
    }
    if (this.mode === "update") {
      const rows = this.matching();
      rows.forEach((r) => Object.assign(r, this.payload));
      return { data: this.singleMode === "none" ? rows : (rows[0] ?? null), error: null };
    }
    const rows = this.matching();
    if (this.singleMode === "maybe") return { data: rows[0] ?? null, error: null };
    if (this.singleMode === "one") {
      if (rows.length !== 1)
        return { data: null, error: { message: "expected exactly one row" } };
      return { data: rows[0], error: null };
    }
    return { data: rows, error: null };
  }

  then<T1 = { data: any; error: any }, T2 = never>(
    onfulfilled?: ((value: { data: any; error: any }) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
  ): PromiseLike<T1 | T2> {
    return Promise.resolve(this.run()).then(onfulfilled, onrejected);
  }
}

export function createFakeSupabase(seed: Tables = {}) {
  const db: Tables = JSON.parse(JSON.stringify(seed));
  return {
    db,
    from(table: string) {
      return new Query(db, table) as any;
    },
  };
}
