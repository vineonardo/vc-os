import { get, put } from "@vercel/blob";
import type { PoolClient } from "pg";
import { CREDIT_COSTS } from "@/lib/constants";
import { stripCreditBalanceCopy } from "@/lib/credit-copy";
import { normalizeDemoSessionId } from "@/lib/demo-cookie";
import { hasDatabaseEnv } from "@/lib/config";
import { withPg } from "@/lib/postgres";
import type { Asset, AssetType, ChatMessage, CreditTransaction, CreditTransactionType } from "@/types";

const DEMO_STARTING_CREDITS = 250;

export type DemoSessionState = {
  sessionId: string;
  conversationId: string;
  credits: number;
  messages: ChatMessage[];
  assets: Asset[];
  updatedAt: string;
};

export type DemoCreditActivity = CreditTransaction & {
  balance_after?: number;
};

function hasBlobStore() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

function sessionPath(sessionId: string) {
  return `venture-wolf/demo-sessions/${normalizeDemoSessionId(sessionId)}.json`;
}

function assetPath(sessionId: string, assetId: string, type: AssetType, extension: "pdf" | "xlsx") {
  return `venture-wolf/demo-assets/${normalizeDemoSessionId(sessionId)}/${assetId}-${type}.${extension}`;
}

function defaultSession(sessionId: string): DemoSessionState {
  const safeSessionId = normalizeDemoSessionId(sessionId);
  return {
    sessionId: safeSessionId,
    conversationId: `demo-${safeSessionId}`,
    credits: DEMO_STARTING_CREDITS,
    messages: [],
    assets: [],
    updatedAt: new Date().toISOString(),
  };
}

function assetLabel(type: AssetType) {
  return type === "financial_model"
    ? "financial-model"
    : type === "investor_memo"
      ? "investor-memo"
      : "pitch-deck";
}

function assetReason(type: AssetType) {
  return type === "financial_model"
    ? "Financial model"
    : type === "investor_memo"
      ? "Investor memo"
      : "Pitch deck";
}

async function insertCreditEvent(
  client: PoolClient,
  {
    sessionId,
    amount,
    type,
    reason,
    referenceId,
    balanceAfter,
  }: {
    sessionId: string;
    amount: number;
    type: CreditTransactionType;
    reason: string;
    referenceId?: string | null;
    balanceAfter: number;
  },
) {
  await client.query(
    `
      insert into vc_os.demo_credit_events (
        id, session_id, amount, type, reason, reference_id, balance_after, created_at
      )
      values ($1::uuid, $2, $3, $4, $5, $6, $7, now())
    `,
    [crypto.randomUUID(), sessionId, amount, type, reason, referenceId || null, balanceAfter],
  );
}

function coerceMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === "object")
    .map((item) => item as Partial<ChatMessage>)
    .filter((item) => item.role === "user" || item.role === "assistant")
    .map((item) => ({
      id: typeof item.id === "string" ? item.id : crypto.randomUUID(),
      role: item.role as "user" | "assistant",
      content:
        typeof item.content === "string"
          ? stripCreditBalanceCopy(item.content)
          : "",
      credits_used: typeof item.credits_used === "number" ? item.credits_used : 0,
      created_at: typeof item.created_at === "string" ? item.created_at : new Date().toISOString(),
    }));
}

function coerceAssets(value: unknown): Asset[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === "object") as Asset[];
}

async function readSession(sessionId: string): Promise<DemoSessionState | null> {
  if (hasDatabaseEnv()) return readPostgresSession(sessionId);
  if (!hasBlobStore()) return null;

  try {
    const result = await get(sessionPath(sessionId), { access: "public" });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    const parsed = (await new Response(result.stream).json()) as Partial<DemoSessionState>;
    const fallback = defaultSession(sessionId);
    return {
      sessionId: fallback.sessionId,
      conversationId:
        typeof parsed.conversationId === "string" ? parsed.conversationId : fallback.conversationId,
      credits: typeof parsed.credits === "number" ? Math.max(0, parsed.credits) : fallback.credits,
      messages: coerceMessages(parsed.messages).slice(-80),
      assets: coerceAssets(parsed.assets).slice(0, 40),
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : fallback.updatedAt,
    };
  } catch (error) {
    console.error("Demo session read failed", error instanceof Error ? error.message : "unknown");
    return null;
  }
}

async function readPostgresSession(sessionId: string): Promise<DemoSessionState> {
  const safeSessionId = normalizeDemoSessionId(sessionId);
  return withPg(async (client) => {
    const created = await client.query<{ session_id: string }>(
      `
        insert into vc_os.demo_sessions (session_id, conversation_id, credits)
        values ($1, $2, $3)
        on conflict (session_id) do nothing
        returning session_id
      `,
      [safeSessionId, `demo-${safeSessionId}`, DEMO_STARTING_CREDITS],
    );

    if (created.rowCount) {
      await insertCreditEvent(client, {
        sessionId: safeSessionId,
        amount: DEMO_STARTING_CREDITS,
        type: "grant",
        reason: "Demo starting credits",
        balanceAfter: DEMO_STARTING_CREDITS,
      });
    }

    const sessionResult = await client.query<{
      session_id: string;
      conversation_id: string;
      credits: number;
      messages: unknown;
      updated_at: Date;
    }>(
      `
        select session_id, conversation_id, credits, messages, updated_at
        from vc_os.demo_sessions
        where session_id = $1
      `,
      [safeSessionId],
    );

    const assetResult = await client.query<{
      id: string;
      conversation_id: string;
      type: AssetType;
      status: Asset["status"];
      data: Record<string, unknown> | null;
      credits_used: number;
      created_at: Date;
    }>(
      `
        select id, conversation_id, type, status, data, credits_used, created_at
        from vc_os.demo_assets
        where session_id = $1
        order by created_at desc
        limit 40
      `,
      [safeSessionId],
    );

    const row = sessionResult.rows[0];
    return {
      sessionId: safeSessionId,
      conversationId: row.conversation_id,
      credits: row.credits,
      messages: coerceMessages(row.messages).slice(-80),
      assets: assetResult.rows.map((asset) => ({
        id: asset.id,
        user_id: `demo-${safeSessionId}`,
        conversation_id: asset.conversation_id,
        type: asset.type,
        status: asset.status,
        file_url: `/api/demo-assets/${asset.id}`,
        data: asset.data,
        credits_used: asset.credits_used,
        created_at: asset.created_at.toISOString(),
      })),
      updatedAt: row.updated_at.toISOString(),
    };
  });
}

export async function loadDemoSession(sessionId: string) {
  return (await readSession(sessionId)) || defaultSession(sessionId);
}

function derivedCreditActivity(session: DemoSessionState): DemoCreditActivity[] {
  const activities: DemoCreditActivity[] = [
    {
      id: `grant-${session.sessionId}`,
      user_id: `demo-${session.sessionId}`,
      amount: DEMO_STARTING_CREDITS,
      type: "grant",
      reason: "Demo starting credits",
      reference_id: null,
      created_at: session.updatedAt,
    },
  ];

  for (const message of session.messages) {
    if (message.role !== "assistant" || message.credits_used <= 0) continue;
    activities.push({
      id: `message-${message.id}`,
      user_id: `demo-${session.sessionId}`,
      amount: -message.credits_used,
      type: "deduct",
      reason: "Wolf chat reply",
      reference_id: message.id,
      created_at: message.created_at,
    });
  }

  for (const asset of session.assets) {
    if (asset.credits_used <= 0) continue;
    activities.push({
      id: `asset-${asset.id}`,
      user_id: `demo-${session.sessionId}`,
      amount: -asset.credits_used,
      type: "deduct",
      reason: assetReason(asset.type),
      reference_id: asset.id,
      created_at: asset.created_at,
    });
  }

  return activities.sort(
    (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
  );
}

export async function loadDemoCreditActivity(sessionId: string): Promise<DemoCreditActivity[]> {
  const session = await loadDemoSession(sessionId);

  if (!hasDatabaseEnv()) return derivedCreditActivity(session);

  const databaseEvents = await withPg(async (client) => {
    const result = await client.query<{
      id: string;
      amount: number;
      type: CreditTransactionType;
      reason: string;
      reference_id: string | null;
      balance_after: number;
      created_at: Date;
    }>(
      `
        select id, amount, type, reason, reference_id, balance_after, created_at
        from vc_os.demo_credit_events
        where session_id = $1
        order by created_at desc
        limit 50
      `,
      [session.sessionId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      user_id: `demo-${session.sessionId}`,
      amount: row.amount,
      type: row.type,
      reason: row.reason,
      reference_id: row.reference_id,
      balance_after: row.balance_after,
      created_at: row.created_at.toISOString(),
    }));
  });

  const knownReferences = new Set(databaseEvents.map((event) => event.reference_id).filter(Boolean));
  const derived = derivedCreditActivity(session).filter((event) => {
    if (event.type === "grant") return !databaseEvents.some((row) => row.type === "grant");
    return event.reference_id ? !knownReferences.has(event.reference_id) : true;
  });

  return [...databaseEvents, ...derived]
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
    .slice(0, 50);
}

export async function saveDemoSession(session: DemoSessionState) {
  const next = {
    ...session,
    sessionId: normalizeDemoSessionId(session.sessionId),
    conversationId: `demo-${normalizeDemoSessionId(session.sessionId)}`,
    messages: session.messages.slice(-80),
    assets: session.assets.slice(0, 40),
    updatedAt: new Date().toISOString(),
  };

  if (hasDatabaseEnv()) {
    await withPg(async (client) => {
      await client.query(
        `
          insert into vc_os.demo_sessions (session_id, conversation_id, credits, messages, updated_at)
          values ($1, $2, $3, $4::jsonb, now())
          on conflict (session_id) do update set
            conversation_id = excluded.conversation_id,
            credits = excluded.credits,
            messages = excluded.messages,
            updated_at = now()
        `,
        [next.sessionId, next.conversationId, next.credits, JSON.stringify(next.messages)],
      );
    });
    return next;
  }

  if (!hasBlobStore()) return next;

  await put(sessionPath(next.sessionId), JSON.stringify(next), {
    access: "public",
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 60,
  });

  return next;
}

export async function appendDemoExchange(
  sessionId: string,
  userContent: string,
  assistantContent: string,
) {
  const session = await loadDemoSession(sessionId);
  const now = new Date().toISOString();
  const userMessage: ChatMessage = {
    id: crypto.randomUUID(),
    role: "user",
    content: userContent,
    credits_used: 0,
    created_at: now,
  };
  const assistantMessage: ChatMessage = {
    id: crypto.randomUUID(),
    role: "assistant",
    content: assistantContent,
    credits_used: CREDIT_COSTS.CHAT_MESSAGE,
    created_at: now,
  };
  const next: DemoSessionState = {
    ...session,
    credits: Math.max(0, session.credits - CREDIT_COSTS.CHAT_MESSAGE),
    messages: [...session.messages, userMessage, assistantMessage].slice(-80),
  };

  if (hasDatabaseEnv()) {
    await withPg(async (client) => {
      await client.query("begin");
      try {
        await client.query(
          `
            insert into vc_os.demo_sessions (session_id, conversation_id, credits, messages, updated_at)
            values ($1, $2, $3, $4::jsonb, now())
            on conflict (session_id) do update set
              conversation_id = excluded.conversation_id,
              credits = excluded.credits,
              messages = excluded.messages,
              updated_at = now()
          `,
          [next.sessionId, next.conversationId, next.credits, JSON.stringify(next.messages)],
        );
        await insertCreditEvent(client, {
          sessionId: next.sessionId,
          amount: -CREDIT_COSTS.CHAT_MESSAGE,
          type: "deduct",
          reason: "Wolf chat reply",
          referenceId: assistantMessage.id,
          balanceAfter: next.credits,
        });
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    });
    return next;
  }

  return saveDemoSession(next);
}

export async function saveDemoAsset({
  sessionId,
  type,
  buffer,
  extension,
  contentType,
  data,
  creditsUsed,
}: {
  sessionId: string;
  type: AssetType;
  buffer: Buffer;
  extension: "pdf" | "xlsx";
  contentType: string;
  data: Record<string, unknown>;
  creditsUsed: number;
}) {
  const session = await loadDemoSession(sessionId);
  if (session.credits < creditsUsed) {
    throw new Error("Insufficient credits.");
  }

  const assetId = crypto.randomUUID();
  let downloadUrl = `data:${contentType};base64,${buffer.toString("base64")}`;

  if (hasDatabaseEnv()) {
    downloadUrl = `/api/demo-assets/${assetId}`;
  } else if (hasBlobStore()) {
    const blob = await put(assetPath(sessionId, assetId, type, extension), buffer, {
      access: "public",
      allowOverwrite: true,
      contentType,
      cacheControlMaxAge: 60 * 60 * 24,
    });
    downloadUrl = blob.downloadUrl || blob.url;
  }

  const now = new Date().toISOString();
  const asset: Asset = {
    id: assetId,
    user_id: `demo-${normalizeDemoSessionId(sessionId)}`,
    conversation_id: session.conversationId,
    type,
    status: "ready",
    file_url: downloadUrl,
    data,
    credits_used: creditsUsed,
    created_at: now,
  };

  const next: DemoSessionState = {
    ...session,
    credits: Math.max(0, session.credits - creditsUsed),
    assets: [asset, ...session.assets].slice(0, 40),
  };

  if (hasDatabaseEnv()) {
    await withPg(async (client) => {
      await client.query("begin");
      try {
        await client.query(
          `
            insert into vc_os.demo_sessions (session_id, conversation_id, credits, messages, updated_at)
            values ($1, $2, $3, $4::jsonb, now())
            on conflict (session_id) do update set
              credits = excluded.credits,
              messages = excluded.messages,
              updated_at = now()
          `,
          [next.sessionId, next.conversationId, next.credits, JSON.stringify(next.messages)],
        );
        await client.query(
          `
            insert into vc_os.demo_assets (
              id, session_id, conversation_id, type, status, data,
              credits_used, content_type, file_name, file_data, created_at
            )
            values ($1::uuid, $2, $3, $4, 'ready', $5::jsonb, $6, $7, $8, $9, now())
          `,
          [
            assetId,
            next.sessionId,
            next.conversationId,
            type,
            JSON.stringify(data),
            creditsUsed,
            contentType,
            `${assetLabel(type)}.${extension}`,
            buffer,
          ],
        );
        await insertCreditEvent(client, {
          sessionId: next.sessionId,
          amount: -creditsUsed,
          type: "deduct",
          reason: assetReason(type),
          referenceId: assetId,
          balanceAfter: next.credits,
        });
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    });
  } else {
    await saveDemoSession(next);
  }

  return { asset, credits: next.credits, downloadUrl };
}

export async function addDemoCredits(sessionId: string, amount: number) {
  const credits = Math.floor(Number(amount || 0));
  if (!Number.isFinite(credits) || credits <= 0) throw new Error("Credits must be greater than zero.");
  if (credits > 5000) throw new Error("Credit top-up is too large.");

  const session = await loadDemoSession(sessionId);
  const next: DemoSessionState = {
    ...session,
    credits: session.credits + credits,
    updatedAt: new Date().toISOString(),
  };

  if (hasDatabaseEnv()) {
    await withPg(async (client) => {
      await client.query("begin");
      try {
        await client.query(
          `
            insert into vc_os.demo_sessions (session_id, conversation_id, credits, messages, updated_at)
            values ($1, $2, $3, $4::jsonb, now())
            on conflict (session_id) do update set
              credits = excluded.credits,
              messages = excluded.messages,
              updated_at = now()
          `,
          [next.sessionId, next.conversationId, next.credits, JSON.stringify(next.messages)],
        );
        await insertCreditEvent(client, {
          sessionId: next.sessionId,
          amount: credits,
          type: "purchase",
          reason: "Demo credit purchase",
          balanceAfter: next.credits,
        });
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    });
    return next;
  }

  return saveDemoSession(next);
}

export async function getDemoAssetFile(assetId: string) {
  if (!hasDatabaseEnv()) return null;

  return withPg(async (client) => {
    const result = await client.query<{
      content_type: string;
      file_name: string;
      file_data: Buffer;
    }>(
      `
        select content_type, file_name, file_data
        from vc_os.demo_assets
        where id = $1::uuid
      `,
      [assetId],
    );

    return result.rows[0] || null;
  });
}
