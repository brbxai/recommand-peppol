import type { BillingConfig } from "data/plans";
import { teams } from "@core/db/schema";
import { timestamp, pgTable, text, jsonb, pgEnum, decimal } from "drizzle-orm/pg-core";
import { ulid } from "ulid";
import { sql } from "drizzle-orm";

export const paymentStatusEnum = pgEnum("peppol_payment_status", [
  "none",
  "open",
  "pending",
  "authorized",
  "paid",
  "canceled",
  "expired",
  "failed",
]);

export const validCountryCodes = pgEnum("peppol_valid_country_codes", [
  "BE",
]);

export const billingProfiles = pgTable("peppol_billing_profiles", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => "bp_" + ulid()),
  teamId: text("team_id").references(() => teams.id).notNull().unique(),
  mollieCustomerId: text("mollie_customer_id"),

  companyName: text("company_name").notNull(),
  address: text("address").notNull(),
  postalCode: text("postal_code").notNull(),
  city: text("city").notNull(),
  country: validCountryCodes("country").notNull(),
  vatNumber: text("vat_number"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "string" })
    .defaultNow()
    .notNull()
    .$onUpdate(() => sql`now()`),
});

export const subscriptions = pgTable("peppol_subscriptions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => "sub_" + ulid()),
  teamId: text("team_id").references(() => teams.id).notNull(),
  planId: text("plan_id"),
  planName: text("plan_name").notNull(),
  billingConfig: jsonb("billing_config").$type<BillingConfig>().notNull(),
  startDate: timestamp("start_date", { withTimezone: true }).defaultNow().notNull(),
  endDate: timestamp("end_date", { withTimezone: true }),
  lastBilledAt: timestamp("last_billed_at", { withTimezone: true }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "string" })
    .defaultNow()
    .notNull()
    .$onUpdate(() => sql`now()`),
});

export const subscriptionBillingEvents = pgTable("peppol_subscription_billing_events", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => "sbe_" + ulid()),
  teamId: text("team_id").references(() => teams.id).notNull(),
  subscriptionId: text("subscription_id").references(() => subscriptions.id).notNull(),
  billingProfileId: text("billing_profile_id").references(() => billingProfiles.id).notNull(),
  billingDate: timestamp("billing_date", { withTimezone: true }).notNull(),
  billingPeriodStart: timestamp("billing_period_start", { withTimezone: true }).notNull(),
  billingPeriodEnd: timestamp("billing_period_end", { withTimezone: true }).notNull(),
  exclVatAmount: decimal("excl_vat_amount").notNull(),
  vatAmount: decimal("vat_amount").notNull(),
  totalAmount: decimal("total_amount").notNull(),
  billingConfig: jsonb("billing_config").$type<BillingConfig>().notNull(),
  includedQty: decimal("included_qty").notNull(),
  overageQty: decimal("overage_qty").notNull(),

  // Payment
  paymentStatus: paymentStatusEnum("payment_status").notNull().default("none"),
  paymentId: text("payment_id").notNull(),
  paidAmount: decimal("paid_amount"),
  paymentMethod: text("payment_method"),
  paymentDate: timestamp("payment_date"),


  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "string" })
    .defaultNow()
    .notNull()
    .$onUpdate(() => sql`now()`),
});
