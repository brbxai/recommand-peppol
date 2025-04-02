export type Plan = {
  id: string;
  isAvailable: boolean;
} & BillingConfig;

export type BillingConfig = {
  name: string;
  basePrice: number;
  vatRate: number;
  includedMonthlyDocuments: number;
  documentOveragePrice: number;
}

export const allPlans: Plan[] = [
  {
    id: "developer",
    isAvailable: true,
    name: "Developer",
    basePrice: 0,
    vatRate: 0.21,
    includedMonthlyDocuments: 25,
    documentOveragePrice: 0.3,
  },
  {
    id: "starter",
    isAvailable: true,
    name: "Starter",
    basePrice: 29,
    vatRate: 0.21,
    includedMonthlyDocuments: 200,
    documentOveragePrice: 0.2,
  },
  {
    id: "professional",
    isAvailable: true,
    name: "Professional",
    basePrice: 99,
    vatRate: 0.21,
    includedMonthlyDocuments: 1000,
    documentOveragePrice: 0.1,
  },
]

export const availablePlans = allPlans.filter((plan) => plan.isAvailable);