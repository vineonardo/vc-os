import Link from "next/link";
import { redirect } from "next/navigation";
import { logoutAction } from "@/app/(auth)/actions";
import { ChatWindow } from "@/components/wolf/ChatWindow";
import { hasSupabaseAdminEnv, hasSupabaseEnv } from "@/lib/config";
import { getBalance } from "@/lib/credits";
import { ensureProfile } from "@/lib/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { INITIAL_WOLF_MESSAGE } from "@/lib/wolf";
import type { ChatMessage } from "@/types";

export const dynamic = "force-dynamic";

const initialMessage: ChatMessage = {
  id: "initial-wolf-message",
  role: "assistant",
  content: INITIAL_WOLF_MESSAGE,
  credits_used: 0,
  created_at: new Date().toISOString(),
};

export default async function ChatPage() {
  if (!hasSupabaseEnv() || !hasSupabaseAdminEnv()) {
    return (
      <>
        <DemoBanner />
        <ChatWindow
          userId="demo"
          conversationId={null}
          initialMessages={[initialMessage]}
          initialCredits={10}
        />
      </>
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  await ensureProfile(user);

  const admin = createAdminClient();
  const existingConversation = await admin
    .from("conversations")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingConversation.error) throw existingConversation.error;
  let conversation = existingConversation.data;

  if (!conversation) {
    const created = await admin
      .from("conversations")
      .insert({ user_id: user.id, title: "Founder screening" })
      .select("id")
      .single();
    if (created.error) throw created.error;
    conversation = created.data;
  }

  const { data: storedMessages, error: messageError } = await admin
    .from("messages")
    .select("id, role, content, credits_used, created_at")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: true });

  if (messageError) throw messageError;

  const messages = (storedMessages || []) as ChatMessage[];
  const balance = await getBalance(user.id);

  return (
    <>
      <FounderLinks />
      <ChatWindow
        userId={user.id}
        conversationId={conversation.id}
        initialMessages={messages.length ? messages : [initialMessage]}
        initialCredits={balance}
      />
    </>
  );
}

function FounderLinks() {
  return (
    <div className="fixed bottom-4 left-4 z-20 flex gap-2 text-xs">
      <Link className="border border-white/10 bg-surface px-3 py-2 text-muted hover:text-text" href="/assets">
        Assets
      </Link>
      <Link className="border border-white/10 bg-surface px-3 py-2 text-muted hover:text-text" href="/credits">
        Credits
      </Link>
      <form action={logoutAction}>
        <button className="border border-white/10 bg-surface px-3 py-2 text-muted hover:text-text">
          Logout
        </button>
      </form>
    </div>
  );
}

function DemoBanner() {
  return (
    <div className="fixed left-1/2 top-2 z-30 -translate-x-1/2 border border-amber/30 bg-amber/10 px-3 py-2 text-xs text-amber">
      Demo mode: add Supabase anon and service keys to persist data.
    </div>
  );
}
