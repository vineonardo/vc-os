import crypto from "node:crypto";
import Razorpay from "razorpay";
import { appConfig } from "@/lib/config";

export function createRazorpay() {
  if (!appConfig.razorpayKeyId || !appConfig.razorpayKeySecret) {
    throw new Error("Razorpay keys are required for credit purchases.");
  }

  return new Razorpay({
    key_id: appConfig.razorpayKeyId,
    key_secret: appConfig.razorpayKeySecret,
  });
}

export function verifyRazorpaySignature({
  orderId,
  paymentId,
  signature,
}: {
  orderId: string;
  paymentId: string;
  signature: string;
}) {
  const expected = crypto
    .createHmac("sha256", appConfig.razorpayKeySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== signatureBuffer.length) return false;

  return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
}
