export type UserRole = "founder" | "investor";
export type ConversationStatus = "active" | "archived";
export type MessageRole = "user" | "assistant";
export type AssetType = "pitch_deck" | "financial_model" | "investor_memo";
export type AssetStatus = "pending" | "generating" | "ready" | "failed";
export type CreditTransactionType = "grant" | "purchase" | "deduct";
export type PaymentStatus = "created" | "paid" | "failed";
export type ReadinessLabel =
  | "Most Promising"
  | "High Potential"
  | "Needs Mentorship"
  | "Early Stage";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  company_name: string | null;
  sector: string | null;
  stage: string | null;
  created_at: string;
};

export type Credit = {
  id: string;
  user_id: string;
  balance: number;
  updated_at: string;
};

export type CreditTransaction = {
  id: string;
  user_id: string;
  amount: number;
  type: CreditTransactionType;
  reason: string | null;
  reference_id: string | null;
  created_at: string;
};

export type Conversation = {
  id: string;
  user_id: string;
  title: string | null;
  status: ConversationStatus;
  created_at: string;
  updated_at: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  credits_used: number;
  created_at: string;
};

export type Asset = {
  id: string;
  user_id: string;
  conversation_id: string | null;
  type: AssetType;
  status: AssetStatus;
  file_url: string | null;
  data: Record<string, unknown> | null;
  credits_used: number;
  created_at: string;
};

export type ReadinessScore = {
  id: string;
  user_id: string;
  score: number;
  label: ReadinessLabel;
  breakdown: Record<string, number> | null;
  generated_at: string;
};

export type PaymentOrder = {
  id: string;
  user_id: string;
  razorpay_order_id: string;
  razorpay_payment_id: string | null;
  credits: number;
  amount_paise: number;
  status: PaymentStatus;
  created_at: string;
  paid_at: string | null;
};

export type ChatMessage = Pick<Message, "id" | "role" | "content" | "credits_used" | "created_at">;

export type FounderPipelineRow = {
  id: string;
  email: string;
  full_name: string | null;
  company_name: string | null;
  sector: string | null;
  stage: string | null;
  score: number | null;
  label: ReadinessLabel | null;
  assets_ready: number;
  last_activity: string | null;
};
