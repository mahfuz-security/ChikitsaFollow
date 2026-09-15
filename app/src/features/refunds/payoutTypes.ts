import { z } from "zod";

const name = z.string().trim().min(2).max(100).refine(value => !/[\r\n<>]/.test(value));
export const payoutInput = z.discriminatedUnion("method", [
  z.object({ method: z.literal("bank"), accountName: name, accountNumber: z.string().trim().regex(/^[0-9]{6,34}$/), bankName: name, branchName: name, routingNumber: z.string().trim().regex(/^[0-9]{9}$/) }).strict(),
  z.object({ method: z.enum(["bkash", "nagad"]), accountName: name, accountNumber: z.string().trim().regex(/^01[3-9][0-9]{8}$/) }).strict()
]);
export type PayoutInput = z.infer<typeof payoutInput>;
export type PayoutSummary = { method: PayoutInput["method"]; last4: string; updatedAt: string };
export type RefundSummary = { caseId: string; method: string; last4: string; paid: boolean; recordedAt?: string };
