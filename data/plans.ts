import { z } from "zod";

export type Plan = {
  id: string;
  isAvailable: boolean;
} & BillingConfig;

export const BillingConfigSchema = z.object({
  name: z.string(),
  basePrice: z.number(),
  includedMonthlyDocuments: z.number(),
  documentOveragePrice: z.number(),
  incomingDocumentOveragePrice: z.number().optional(),
  outgoingDocumentOveragePrice: z.number().optional(),
});

export type BillingConfig = z.infer<typeof BillingConfigSchema>;

export const allPlans: Plan[] = [
  {
    id: "developer",
    isAvailable: true,
    name: "Free",
    basePrice: 0,
    includedMonthlyDocuments: 25,
    documentOveragePrice: 0.3,
  },
  {
    id: "starter",
    isAvailable: true,
    name: "Starter",
    basePrice: 29,
    includedMonthlyDocuments: 200,
    documentOveragePrice: 0.2,
  },
  {
    id: "professional",
    isAvailable: true,
    name: "Professional",
    basePrice: 99,
    includedMonthlyDocuments: 1000,
    documentOveragePrice: 0.1,
  },
  {
    id: "enterprise",
    isAvailable: false,
    name: "Enterprise",
    basePrice: 0,
    includedMonthlyDocuments: 0,
    documentOveragePrice: 0.05,
  }
]

export const availablePlans = allPlans.filter((plan) => plan.isAvailable);