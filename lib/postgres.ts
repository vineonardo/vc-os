import { Pool, type PoolClient } from "pg";
import { appConfig, hasDatabaseEnv } from "@/lib/config";

let pool: Pool | null = null;
let migrationPromise: Promise<void> | null = null;

function createPool() {
  return new Pool({
    connectionString: appConfig.databaseUrl,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
}

export function getPool() {
  if (!hasDatabaseEnv()) throw new Error("DATABASE_URL is required for Postgres persistence.");
  if (!pool) pool = createPool();
  return pool;
}

export async function withPg<T>(callback: (client: PoolClient) => Promise<T>) {
  await ensurePgSchema();
  const client = await getPool().connect();
  try {
    return await callback(client);
  } finally {
    client.release();
  }
}

export async function ensurePgSchema() {
  if (!hasDatabaseEnv()) return;
  if (!migrationPromise) {
    migrationPromise = getPool()
      .query(`
        create schema if not exists vc_os;

        create table if not exists vc_os.demo_sessions (
          session_id text primary key,
          conversation_id text not null,
          credits integer not null default 250 check (credits >= 0),
          messages jsonb not null default '[]'::jsonb,
          updated_at timestamptz not null default now()
        );

        create table if not exists vc_os.demo_assets (
          id uuid primary key,
          session_id text not null references vc_os.demo_sessions(session_id) on delete cascade,
          conversation_id text not null,
          type text not null check (type in ('pitch_deck', 'financial_model', 'investor_memo')),
          status text not null default 'ready',
          data jsonb,
          credits_used integer not null,
          content_type text not null,
          file_name text not null,
          file_data bytea not null,
          created_at timestamptz not null default now()
        );

        create table if not exists vc_os.demo_credit_events (
          id uuid primary key,
          session_id text not null references vc_os.demo_sessions(session_id) on delete cascade,
          amount integer not null,
          type text not null check (type in ('grant', 'purchase', 'deduct')),
          reason text not null,
          reference_id text,
          balance_after integer not null check (balance_after >= 0),
          created_at timestamptz not null default now()
        );

        create index if not exists demo_assets_session_created_idx
          on vc_os.demo_assets(session_id, created_at desc);

        create index if not exists demo_credit_events_session_created_idx
          on vc_os.demo_credit_events(session_id, created_at desc);
      `)
      .then(() => undefined);
  }
  return migrationPromise;
}
