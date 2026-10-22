import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { Pool, type QueryResult, type QueryResultRow } from "pg";

export const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";

const globalForPg = globalThis as unknown as { facelabPool?: Pool };
const globalForMem = globalThis as unknown as { facelabMem?: MemStore };

type Json = unknown;

type UserRow = {
  id: string;
  name: string;
  initials: string;
  skin_type: string;
  streak_days: number;
  created_at: string;
  updated_at: string;
};

type ScanRow = {
  id: string;
  user_id: string;
  overall_score: number;
  metrics: Json;
  concerns: Json;
  ingredients: Json;
  summary: string;
  source: string;
  created_at: string;
};

type ChatRow = {
  id: string;
  user_id: string;
  role: string;
  content: string;
  created_at: string;
};

type PrefsRow = {
  user_id: string;
  routine_phase: string;
  favorite_ingredients: string[];
  settings: Record<string, unknown>;
  updated_at: string;
};

type NotifRow = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
};

type ProductRow = {
  id: string;
  user_id: string;
  raw: string;
  ingredients: Json;
  details: Json;
  created_at: string;
};

type MemStore = {
  users: UserRow[];
  skin_scans: ScanRow[];
  chat_messages: ChatRow[];
  user_prefs: PrefsRow[];
  notifications: NotifRow[];
  product_scans: ProductRow[];
};

function nowIso() {
  return new Date().toISOString();
}

function seed(): MemStore {
  return {
    users: [
      {
        id: DEMO_USER_ID,
        name: "Maya Chen",
        initials: "MC",
        skin_type: "Combination",
        streak_days: 12,
        created_at: nowIso(),
        updated_at: nowIso(),
      },
    ],
    skin_scans: [],
    chat_messages: [],
    user_prefs: [
      {
        user_id: DEMO_USER_ID,
        routine_phase: "am",
        favorite_ingredients: [],
        settings: {},
        updated_at: nowIso(),
      },
    ],
    notifications: [],
    product_scans: [],
  };
}

function storePath() {
  return path.join(process.cwd(), "data", "store.json");
}

function loadMem(): MemStore {
  if (globalForMem.facelabMem) return globalForMem.facelabMem;
  const file = storePath();
  try {
    if (fs.existsSync(file)) {
      const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as MemStore;
      globalForMem.facelabMem = {
        ...seed(),
        ...parsed,
        users: parsed.users?.length ? parsed.users : seed().users,
        user_prefs: parsed.user_prefs?.length ? parsed.user_prefs : seed().user_prefs,
      };
      return globalForMem.facelabMem;
    }
  } catch {
    // fall through to seed
  }
  globalForMem.facelabMem = seed();
  return globalForMem.facelabMem;
}

function persistMem(store: MemStore) {
  const dir = path.dirname(storePath());
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(storePath(), JSON.stringify(store, null, 2));
}

function usePostgres() {
  return Boolean(process.env.DB_HOST);
}

export function getPool(): Pool {
  if (!globalForPg.facelabPool) {
    globalForPg.facelabPool = new Pool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT) || 5432,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      max: 8,
      connectionTimeoutMillis: 4000,
    });
  }
  return globalForPg.facelabPool;
}

function ok<T extends QueryResultRow>(rows: T[]): QueryResult<T> {
  return { rows, rowCount: rows.length, command: "SELECT", oid: 0, fields: [] } as QueryResult<T>;
}

function initialsFrom(name: string) {
  const parts = name.trim().split(/\s+/);
  const a = parts[0]?.[0] ?? "U";
  const b = (parts[1]?.[0] ?? parts[0]?.[1] ?? a) as string;
  return (a + b).toUpperCase();
}

function memQuery<T extends QueryResultRow>(text: string, params: unknown[] = []): QueryResult<T> {
  const store = loadMem();
  const sql = text.replace(/\s+/g, " ").trim();
  const p = params;

  if (/^SELECT 1\b/i.test(sql)) return ok<T>([{}] as T[]);

  if (/COUNT\(\*\)/i.test(sql) && /FROM skin_scans/i.test(sql)) {
    const uid = p[0];
    const c = store.skin_scans.filter((s) => (uid ? s.user_id === uid : true)).length;
    return ok<T>([{ c } as unknown as T]);
  }

  if (/INSERT INTO skin_scans/i.test(sql)) {
    const row: ScanRow = {
      id: randomUUID(),
      user_id: String(p[0]),
      overall_score: Number(p[1]),
      metrics: JSON.parse(String(p[2])),
      concerns: JSON.parse(String(p[3])),
      ingredients: JSON.parse(String(p[4])),
      summary: String(p[5]),
      source: String(p[6]),
      created_at: nowIso(),
    };
    store.skin_scans.push(row);
    persistMem(store);
    return ok<T>([{ id: row.id, created_at: row.created_at } as unknown as T]);
  }

  if (/INSERT INTO notifications/i.test(sql)) {
    const row: NotifRow = {
      id: randomUUID(),
      user_id: String(p[0]),
      title: String(p[1]),
      body: String(p[2]),
      read: false,
      created_at: nowIso(),
    };
    store.notifications.unshift(row);
    persistMem(store);
    return ok<T>([row as unknown as T]);
  }

  if (/INSERT INTO chat_messages/i.test(sql) && /VALUES \(\$1, 'user', \$2\), \(\$1, 'ai', \$3\)/i.test(sql)) {
    const user: ChatRow = {
      id: randomUUID(),
      user_id: String(p[0]),
      role: "user",
      content: String(p[1]),
      created_at: nowIso(),
    };
    const ai: ChatRow = {
      id: randomUUID(),
      user_id: String(p[0]),
      role: "ai",
      content: String(p[2]),
      created_at: nowIso(),
    };
    store.chat_messages.push(user, ai);
    persistMem(store);
    return ok<T>([ai as unknown as T]);
  }

  if (/INSERT INTO chat_messages/i.test(sql)) {
    const roleMatch = sql.match(/VALUES \(\$1, '(\w+)', \$2\)/i);
    const role = roleMatch?.[1] ?? String(p[1] ?? "ai");
    const content = roleMatch ? String(p[1]) : String(p[2]);
    const row: ChatRow = {
      id: randomUUID(),
      user_id: String(p[0]),
      role,
      content,
      created_at: nowIso(),
    };
    store.chat_messages.push(row);
    persistMem(store);
    return ok<T>([{ id: row.id, created_at: row.created_at } as unknown as T]);
  }

  if (/INSERT INTO product_scans/i.test(sql)) {
    const row: ProductRow = {
      id: randomUUID(),
      user_id: String(p[0]),
      raw: String(p[1]),
      ingredients: typeof p[2] === "string" ? JSON.parse(String(p[2])) : p[2],
      details: typeof p[3] === "string" ? JSON.parse(String(p[3])) : p[3],
      created_at: nowIso(),
    };
    store.product_scans.unshift(row);
    persistMem(store);
    return ok<T>([{ id: row.id, created_at: row.created_at } as unknown as T]);
  }

  if (/UPDATE users SET streak_days/i.test(sql)) {
    const user = store.users.find((u) => u.id === p[0]);
    if (user) {
      user.streak_days += 1;
      user.updated_at = nowIso();
      persistMem(store);
    }
    return ok<T>([]);
  }

  if (/UPDATE users SET/i.test(sql) && /name = COALESCE/i.test(sql)) {
    const user = store.users.find((u) => u.id === p[0]);
    if (user) {
      if (p[1]) {
        user.name = String(p[1]);
        user.initials = initialsFrom(user.name);
      }
      if (p[2]) user.skin_type = String(p[2]);
      user.updated_at = nowIso();
      persistMem(store);
    }
    return ok<T>([]);
  }

  if (/UPDATE user_prefs SET routine_phase/i.test(sql)) {
    const prefs = store.user_prefs.find((r) => r.user_id === p[0]);
    if (prefs) {
      prefs.routine_phase = String(p[1]);
      prefs.updated_at = nowIso();
      persistMem(store);
    }
    return ok<T>([]);
  }

  if (/UPDATE user_prefs SET favorite_ingredients/i.test(sql)) {
    const prefs = store.user_prefs.find((r) => r.user_id === p[0]);
    if (prefs) {
      prefs.favorite_ingredients = JSON.parse(String(p[1]));
      prefs.updated_at = nowIso();
      persistMem(store);
    }
    return ok<T>([]);
  }

  if (/UPDATE user_prefs SET settings/i.test(sql)) {
    const prefs = store.user_prefs.find((r) => r.user_id === p[0]);
    if (prefs) {
      prefs.settings = JSON.parse(String(p[1]));
      prefs.updated_at = nowIso();
      persistMem(store);
    }
    return ok<T>([]);
  }

  if (/UPDATE notifications SET read/i.test(sql)) {
    for (const n of store.notifications) {
      if (n.user_id === p[0]) n.read = true;
    }
    persistMem(store);
    return ok<T>([]);
  }

  if (/DELETE FROM notifications/i.test(sql)) {
    store.notifications = store.notifications.filter((n) => n.user_id !== p[0]);
    persistMem(store);
    return ok<T>([]);
  }

  if (/DELETE FROM skin_scans/i.test(sql)) {
    const before = store.skin_scans.length;
    const hit = store.skin_scans.find((s) => s.id === p[0] && s.user_id === p[1]);
    store.skin_scans = store.skin_scans.filter((s) => !(s.id === p[0] && s.user_id === p[1]));
    persistMem(store);
    return ok<T>(hit ? ([{ id: hit.id }] as unknown as T[]) : []);
  }

  if (/FROM users WHERE id/i.test(sql)) {
    return ok<T>(store.users.filter((u) => u.id === p[0]) as unknown as T[]);
  }

  if (/FROM user_prefs WHERE user_id/i.test(sql)) {
    return ok<T>(store.user_prefs.filter((r) => r.user_id === p[0]) as unknown as T[]);
  }

  if (/FROM product_scans/i.test(sql)) {
    let rows = store.product_scans.filter((r) => r.user_id === p[0]);
    rows = [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
    const limit = sql.match(/LIMIT (\d+)/i);
    if (limit) rows = rows.slice(0, Number(limit[1]));
    return ok<T>(rows as unknown as T[]);
  }

  if (/FROM notifications/i.test(sql)) {
    const rows = store.notifications
      .filter((n) => n.user_id === p[0])
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 20);
    return ok<T>(rows as unknown as T[]);
  }

  if (/FROM chat_messages/i.test(sql)) {
    const rows = store.chat_messages
      .filter((m) => m.user_id === p[0])
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .slice(0, 50);
    return ok<T>(rows as unknown as T[]);
  }

  if (/FROM skin_scans/i.test(sql)) {
    let rows = store.skin_scans.filter((s) => s.user_id === p[0]);
    if (/AND id = \$2/i.test(sql) || (/id = \$1/i.test(sql) && /user_id = \$2/i.test(sql))) {
      const id = /id = \$1/i.test(sql) && /user_id = \$2/i.test(sql) ? p[0] : p[1];
      const uid = /id = \$1/i.test(sql) && /user_id = \$2/i.test(sql) ? p[1] : p[0];
      rows = store.skin_scans.filter((s) => s.id === id && s.user_id === uid);
    }
    if (/ORDER BY created_at DESC/i.test(sql)) {
      rows = [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
    } else if (/ORDER BY created_at ASC/i.test(sql)) {
      rows = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at));
    }
    const limit = sql.match(/LIMIT (\d+)/i);
    if (limit) rows = rows.slice(0, Number(limit[1]));
    return ok<T>(rows as unknown as T[]);
  }

  throw new Error(`Local store cannot run SQL: ${sql.slice(0, 180)}`);
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
) {
  if (usePostgres()) {
    return getPool().query<T>(text, params);
  }
  return memQuery<T>(text, params ?? []);
}

export function storageMode() {
  return usePostgres() ? "postgres" : "local";
}
