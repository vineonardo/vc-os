import React from "react";
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import writeXlsxFile, { type SheetData } from "write-excel-file/node";
import { createOpenAI, getOpenAIModel } from "@/lib/openai";
import { createAdminClient } from "@/lib/supabase/admin";
import { STRUCTURED_EXTRACTION_PROMPT } from "@/lib/wolf";
import type { AssetType } from "@/types";

export type FounderData = {
  company_name: string;
  tagline: string;
  problem: string;
  solution: string;
  market_size: string;
  traction: string;
  team: string;
  ask_amount: string;
  use_of_funds: string;
  business_model: string;
  customers: string;
  growth_rate: string;
  current_mrr: number;
  customer_count: number;
  monthly_growth_rate: number;
  monthly_burn: number;
  team_size: number;
  cac: number;
  ltv: number;
};

const fallbackFounderData: FounderData = {
  company_name: "Founder Company",
  tagline: "Investment-ready founder narrative",
  problem: "Not provided",
  solution: "Not provided",
  market_size: "Not provided",
  traction: "Not provided",
  team: "Not provided",
  ask_amount: "Not provided",
  use_of_funds: "Not provided",
  business_model: "Not provided",
  customers: "Not provided",
  growth_rate: "Not provided",
  current_mrr: 0,
  customer_count: 0,
  monthly_growth_rate: 0.08,
  monthly_burn: 0,
  team_size: 1,
  cac: 0,
  ltv: 0,
};

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#0A0A0E",
    color: "#ECE9DF",
    padding: 36,
    fontSize: 13,
    fontFamily: "Helvetica",
  },
  memoPage: {
    backgroundColor: "#F8F7F2",
    color: "#161719",
    padding: 34,
    fontSize: 10,
    fontFamily: "Helvetica",
  },
  slideIndex: {
    color: "#FFC01C",
    fontSize: 12,
    marginBottom: 18,
  },
  h1: {
    fontSize: 34,
    lineHeight: 1.08,
    fontWeight: 700,
    marginBottom: 14,
  },
  h2: {
    fontSize: 25,
    lineHeight: 1.12,
    fontWeight: 700,
    marginBottom: 14,
  },
  body: {
    color: "#D8D2C3",
    fontSize: 15,
    lineHeight: 1.45,
  },
  footer: {
    position: "absolute",
    left: 36,
    right: 36,
    bottom: 24,
    color: "#8C8678",
    fontSize: 9,
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  goldBar: {
    width: 58,
    height: 4,
    backgroundColor: "#FFC01C",
    marginBottom: 20,
  },
  statRow: {
    display: "flex",
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
  },
  stat: {
    flexGrow: 1,
    backgroundColor: "#17181E",
    border: "1px solid rgba(255,192,28,0.24)",
    padding: 14,
  },
  statLabel: {
    color: "#8C8678",
    fontSize: 9,
    marginBottom: 5,
    textTransform: "uppercase",
  },
  statValue: {
    color: "#FFC01C",
    fontSize: 15,
    fontWeight: 700,
  },
  memoHeader: {
    borderBottom: "1px solid #D8D2C3",
    paddingBottom: 8,
    marginBottom: 12,
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  memoTitle: {
    fontSize: 17,
    fontWeight: 700,
  },
  memoSection: {
    marginBottom: 9,
  },
  memoSectionTitle: {
    color: "#7A5B00",
    fontSize: 9,
    fontWeight: 700,
    marginBottom: 3,
    textTransform: "uppercase",
  },
  memoBody: {
    fontSize: 9.5,
    lineHeight: 1.35,
  },
});

function cleanString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function cleanNumber(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeFounderData(value: Partial<FounderData>): FounderData {
  return {
    company_name: cleanString(value.company_name, fallbackFounderData.company_name),
    tagline: cleanString(value.tagline, fallbackFounderData.tagline),
    problem: cleanString(value.problem, fallbackFounderData.problem),
    solution: cleanString(value.solution, fallbackFounderData.solution),
    market_size: cleanString(value.market_size, fallbackFounderData.market_size),
    traction: cleanString(value.traction, fallbackFounderData.traction),
    team: cleanString(value.team, fallbackFounderData.team),
    ask_amount: cleanString(value.ask_amount, fallbackFounderData.ask_amount),
    use_of_funds: cleanString(value.use_of_funds, fallbackFounderData.use_of_funds),
    business_model: cleanString(value.business_model, fallbackFounderData.business_model),
    customers: cleanString(value.customers, fallbackFounderData.customers),
    growth_rate: cleanString(value.growth_rate, fallbackFounderData.growth_rate),
    current_mrr: cleanNumber(value.current_mrr, fallbackFounderData.current_mrr),
    customer_count: cleanNumber(value.customer_count, fallbackFounderData.customer_count),
    monthly_growth_rate: cleanNumber(
      value.monthly_growth_rate,
      fallbackFounderData.monthly_growth_rate,
    ),
    monthly_burn: cleanNumber(value.monthly_burn, fallbackFounderData.monthly_burn),
    team_size: cleanNumber(value.team_size, fallbackFounderData.team_size),
    cac: cleanNumber(value.cac, fallbackFounderData.cac),
    ltv: cleanNumber(value.ltv, fallbackFounderData.ltv),
  };
}

async function getTranscript(userId: string) {
  const supabase = createAdminClient();
  const { data: conversations, error: conversationError } = await supabase
    .from("conversations")
    .select("id")
    .eq("user_id", userId);

  if (conversationError) throw conversationError;
  const ids = (conversations || []).map((row) => row.id);
  if (ids.length === 0) return "";

  const { data: messages, error: messageError } = await supabase
    .from("messages")
    .select("role, content, created_at")
    .in("conversation_id", ids)
    .order("created_at", { ascending: true });

  if (messageError) throw messageError;
  return (messages || [])
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join("\n\n");
}

export async function extractFounderData(userId: string) {
  const transcript = await getTranscript(userId);
  if (!transcript) return fallbackFounderData;

  const openai = createOpenAI();
  const completion = await openai.chat.completions.create({
    model: getOpenAIModel(),
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: STRUCTURED_EXTRACTION_PROMPT },
      { role: "user", content: transcript },
    ],
  });

  return normalizeFounderData(
    JSON.parse(completion.choices[0]?.message.content || "{}") as Partial<FounderData>,
  );
}

function Footer({ slide }: { slide: string }) {
  return (
    <View style={styles.footer}>
      <Text>Venture Wolf</Text>
      <Text>{slide}</Text>
    </View>
  );
}

function Slide({
  index,
  title,
  children,
}: {
  index: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Page size="A4" orientation="landscape" style={styles.page}>
      <Text style={styles.slideIndex}>{index}</Text>
      <View style={styles.goldBar} />
      <Text style={styles.h2}>{title}</Text>
      <View>{children}</View>
      <Footer slide={index} />
    </Page>
  );
}

function PitchDeckDocument({ data }: { data: FounderData }) {
  return (
    <Document title={`${data.company_name} Pitch Deck`}>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.goldBar} />
        <Text style={styles.h1}>{data.company_name}</Text>
        <Text style={styles.body}>{data.tagline}</Text>
        <View style={styles.statRow}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Prepared for</Text>
            <Text style={styles.statValue}>Venture Wolf</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Powered by</Text>
            <Text style={styles.statValue}>iKawn</Text>
          </View>
        </View>
        <Footer slide="01 / Cover" />
      </Page>
      <Slide index="02" title="Problem">
        <Text style={styles.body}>{data.problem}</Text>
      </Slide>
      <Slide index="03" title="Solution">
        <Text style={styles.body}>{data.solution}</Text>
      </Slide>
      <Slide index="04" title="Market Size">
        <Text style={styles.body}>{data.market_size}</Text>
      </Slide>
      <Slide index="05" title="Product">
        <Text style={styles.body}>{data.solution}</Text>
      </Slide>
      <Slide index="06" title="Traction">
        <Text style={styles.body}>{data.traction}</Text>
      </Slide>
      <Slide index="07" title="Business Model">
        <Text style={styles.body}>{data.business_model}</Text>
      </Slide>
      <Slide index="08" title="Team">
        <Text style={styles.body}>{data.team}</Text>
      </Slide>
      <Slide index="09" title="Ask">
        <Text style={styles.body}>{data.ask_amount}</Text>
        <Text style={[styles.body, { marginTop: 12 }]}>{data.use_of_funds}</Text>
      </Slide>
      <Slide index="10" title="Contact">
        <Text style={styles.body}>
          Prepared through Wolf by Venture Wolf. Contact details should be confirmed from
          the founder profile before external circulation.
        </Text>
      </Slide>
    </Document>
  );
}

function MemoDocument({ data }: { data: FounderData }) {
  const date = new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date());

  return (
    <Document title={`${data.company_name} Investor Memo`}>
      <Page size="A4" style={styles.memoPage}>
        <View style={styles.memoHeader}>
          <View>
            <Text style={styles.memoTitle}>{data.company_name}</Text>
            <Text>{data.tagline}</Text>
          </View>
          <View>
            <Text>Confidential</Text>
            <Text>{date}</Text>
          </View>
        </View>
        {[
          ["Executive Summary", data.tagline],
          ["Problem", data.problem],
          ["Solution", data.solution],
          ["Traction", data.traction],
          ["Team", data.team],
          ["Ask", `${data.ask_amount}. ${data.use_of_funds}`],
          [
            "Contact",
            "Prepared through Wolf by Venture Wolf. Confirm founder contact details before circulation.",
          ],
        ].map(([title, body]) => (
          <View key={title} style={styles.memoSection}>
            <Text style={styles.memoSectionTitle}>{title}</Text>
            <Text style={styles.memoBody}>{body}</Text>
          </View>
        ))}
      </Page>
    </Document>
  );
}

export async function createPitchDeckBuffer(data: FounderData) {
  return renderToBuffer(<PitchDeckDocument data={data} />);
}

export async function createInvestorMemoBuffer(data: FounderData) {
  return renderToBuffer(<MemoDocument data={data} />);
}

export async function createFinancialModelBuffer(data: FounderData) {
  const growth = data.monthly_growth_rate > 1 ? data.monthly_growth_rate / 100 : data.monthly_growth_rate;
  const baseRevenue = Math.max(0, data.current_mrr);
  const burn = Math.max(0, data.monthly_burn);
  let cumulativeCash = 0;

  const header = (value: string) => ({
    value,
    type: String,
    fontWeight: "bold" as const,
    textColor: "#FFC01C",
    backgroundColor: "#17181E",
  });

  const summary: SheetData = [
    [
      header("Month"),
      header("Revenue"),
      header("Expenses"),
      header("Net"),
      header("Cumulative Cash"),
    ],
  ];

  for (let index = 0; index < 36; index += 1) {
    const month = index + 1;
    const revenue = Math.round(baseRevenue * Math.pow(1 + growth, index));
    const expenses = Math.round(burn || revenue * 0.75);
    const net = revenue - expenses;
    cumulativeCash += net;
    summary.push([
      { value: month, type: Number },
      { value: revenue, type: Number, format: "#,##0" },
      { value: expenses, type: Number, format: "#,##0" },
      { value: net, type: Number, format: "#,##0" },
      { value: cumulativeCash, type: Number, format: "#,##0" },
    ]);
  }

  const assumptions: SheetData = [
    [header("Assumption"), header("Value")],
    ["Company", data.company_name],
    ["Current MRR", { value: data.current_mrr, type: Number, format: "#,##0" }],
    ["Customer count", { value: data.customer_count, type: Number, format: "#,##0" }],
    ["Monthly growth rate", { value: growth, type: Number, format: "0.00%" }],
    ["Monthly burn", { value: burn, type: Number, format: "#,##0" }],
    ["Team size", { value: data.team_size, type: Number, format: "#,##0" }],
  ];

  const unitEconomics: SheetData = [
    [header("Metric"), header("Value")],
    ["CAC", { value: data.cac, type: Number, format: "#,##0" }],
    ["LTV", { value: data.ltv, type: Number, format: "#,##0" }],
    ["LTV:CAC", { value: data.cac ? Number((data.ltv / data.cac).toFixed(2)) : 0, type: Number }],
    [
      "Payback period months",
      {
        value: data.cac && baseRevenue ? Number((data.cac / (baseRevenue || 1)).toFixed(2)) : 0,
        type: Number,
      },
    ],
  ];

  const buffer = await writeXlsxFile([
    {
      sheet: "Summary",
      data: summary,
      columns: [{ width: 12 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 20 }],
    },
    {
      sheet: "Assumptions",
      data: assumptions,
      columns: [{ width: 24 }, { width: 28 }],
    },
    {
      sheet: "Unit Economics",
      data: unitEconomics,
      columns: [{ width: 24 }, { width: 18 }],
    },
  ]).toBuffer();

  return Buffer.from(buffer);
}

export async function uploadAssetFile({
  userId,
  assetId,
  type,
  buffer,
  extension,
  contentType,
}: {
  userId: string;
  assetId: string;
  type: AssetType;
  buffer: Buffer;
  extension: "pdf" | "xlsx";
  contentType: string;
}) {
  const supabase = createAdminClient();
  const path = `${userId}/${assetId}-${type}.${extension}`;
  const { error } = await supabase.storage.from("assets").upload(path, buffer, {
    contentType,
    upsert: true,
  });

  if (error) throw error;

  const { data, error: signedError } = await supabase.storage
    .from("assets")
    .createSignedUrl(path, 60 * 60 * 24);

  if (signedError) throw signedError;
  return { path, signedUrl: data.signedUrl };
}
