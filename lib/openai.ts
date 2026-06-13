import OpenAI from "openai";
import { appConfig } from "@/lib/config";

export function createOpenAI() {
  if (!appConfig.openAiKey) {
    throw new Error("OPENAI_API_KEY is required for Wolf AI features.");
  }

  return new OpenAI({ apiKey: appConfig.openAiKey });
}

export function getOpenAIModel() {
  return appConfig.openAiModel;
}
