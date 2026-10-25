import { createHmac, timingSafeEqual } from "node:crypto";
export interface PaymentProvider {
  readonly mode: "test" | "live";
  createInvoice(order: { id: string; total: number }): {
    reference: string;
    status: "pending";
  };
  verify(reference: string): { paid: boolean; test: boolean };
}
/** Local test adapter only. No network request or money movement. */
export class TestPayments implements PaymentProvider {
  readonly mode = "test" as const;
  createInvoice(order: { id: string; total: number }) {
    return { reference: `test_${order.id}`, status: "pending" as const };
  }
  verify(reference: string) {
    if (!reference.startsWith("test_")) throw new Error("Unknown test invoice");
    return { paid: true, test: true };
  }
}
export interface SocialAdapter {
  readonly mode: "test" | "live";
  reply(channelId: string, body: string): { externalId: string };
  publish(id: string, caption: string): { externalId: string };
}
export class TestSocial implements SocialAdapter {
  readonly mode = "test" as const;
  reply(channelId: string, body: string) {
    if (!channelId || !body) throw new Error("Missing reply");
    return { externalId: `test_reply_${crypto.randomUUID()}` };
  }
  publish(id: string, caption: string) {
    if (!caption) throw new Error("Caption is required");
    return { externalId: `test_post_${id}` };
  }
}
export function verifySignature(
  raw: Buffer,
  signature: string | undefined,
  secret: string,
) {
  if (!signature?.startsWith("sha256=")) return false;
  const expected = Buffer.from(
    "sha256=" + createHmac("sha256", secret).update(raw).digest("hex"),
  );
  const actual = Buffer.from(signature);
  return actual.length === expected.length && timingSafeEqual(expected, actual);
}
export const syntheticMessage = {
  eventId: "fixture-inbound-001",
  channelId: "synthetic-person-001",
  sender: "Туршилтын зочин",
  body: "Сайн байна уу? Ноолууран цамцны M размер байгаа юу?",
};
