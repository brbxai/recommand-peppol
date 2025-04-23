import type { BillingConfig } from "data/plans";
import { teams } from "@core/db/schema";
import {
  timestamp,
  pgTable,
  text,
  jsonb,
  pgEnum,
  decimal,
  boolean,
} from "drizzle-orm/pg-core";
import { ulid } from "ulid";
import { sql } from "drizzle-orm";
import { z } from "zod";
import type { Invoice } from "@peppol/utils/parsing/invoice/schemas";
import type { CreditNote } from "@peppol/utils/parsing/creditnote/schemas";

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

export const zodValidCountryCodes = z.enum(["BE"]);
export const validCountryCodes = pgEnum("peppol_valid_country_codes", zodValidCountryCodes.options);

export const supportedDocumentTypes = z.enum(["invoice", "creditNote", "unknown"]);
export const supportedDocumentTypeEnum = pgEnum(
  "peppol_supported_document_type",
  supportedDocumentTypes.options
);

export const transferEventDirectionEnum = pgEnum(
  "peppol_transfer_event_direction",
  ["incoming", "outgoing"]
);

export const billingProfiles = pgTable("peppol_billing_profiles", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => "bp_" + ulid()),
  teamId: text("team_id")
    .references(() => teams.id)
    .notNull()
    .unique(),
  mollieCustomerId: text("mollie_customer_id"),
  firstPaymentId: text("first_payment_id"),
  firstPaymentStatus: paymentStatusEnum("first_payment_status")
    .notNull()
    .default("none"),
  isMandateValidated: boolean("is_mandate_validated").notNull().default(false),

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
  teamId: text("team_id")
    .references(() => teams.id)
    .notNull(),
  planId: text("plan_id"),
  planName: text("plan_name").notNull(),
  billingConfig: jsonb("billing_config").$type<BillingConfig>().notNull(),
  startDate: timestamp("start_date", { withTimezone: true })
    .defaultNow()
    .notNull(),
  endDate: timestamp("end_date", { withTimezone: true }),
  lastBilledAt: timestamp("last_billed_at", { withTimezone: true }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "string" })
    .defaultNow()
    .notNull()
    .$onUpdate(() => sql`now()`),
});

export const subscriptionBillingEvents = pgTable(
  "peppol_subscription_billing_events",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => "sbe_" + ulid()),
    teamId: text("team_id")
      .references(() => teams.id)
      .notNull(),
    subscriptionId: text("subscription_id")
      .references(() => subscriptions.id)
      .notNull(),
    billingProfileId: text("billing_profile_id")
      .references(() => billingProfiles.id)
      .notNull(),
    billingDate: timestamp("billing_date", { withTimezone: true }).notNull(),
    billingPeriodStart: timestamp("billing_period_start", {
      withTimezone: true,
    }).notNull(),
    billingPeriodEnd: timestamp("billing_period_end", {
      withTimezone: true,
    }).notNull(),
    totalAmountExcl: decimal("total_amount_excl").notNull(),
    vatAmount: decimal("vat_amount").notNull(),
    totalAmountIncl: decimal("total_amount_incl").notNull(),
    billingConfig: jsonb("billing_config").$type<BillingConfig>().notNull(),
    usedQty: decimal("used_qty").notNull(),
    includedQty: decimal("included_qty").notNull(),
    overageQty: decimal("overage_qty").notNull(),

    // Payment
    amountDue: decimal("amount_due").notNull(),
    paymentStatus: paymentStatusEnum("payment_status")
      .notNull()
      .default("none"),
    paymentId: text("payment_id"),
    paidAmount: decimal("paid_amount"),
    paymentMethod: text("payment_method"),
    paymentDate: timestamp("payment_date"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .defaultNow()
      .notNull()
      .$onUpdate(() => sql`now()`),
  }
);

export const companies = pgTable("peppol_companies", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => "c_" + ulid()),
  teamId: text("team_id")
    .references(() => teams.id)
    .notNull(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  postalCode: text("postal_code").notNull(),
  city: text("city").notNull(),
  country: validCountryCodes("country").notNull(),
  enterpriseNumber: text("enterprise_number").unique().notNull(),
  vatNumber: text("vat_number").unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "string" })
    .defaultNow()
    .notNull()
    .$onUpdate(() => sql`now()`),
});

export const webhooks = pgTable("peppol_webhooks", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => "wh_" + ulid()),
  teamId: text("team_id")
    .references(() => teams.id)
    .notNull(),
  companyId: text("company_id")
    .references(() => companies.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "string" })
    .defaultNow()
    .notNull()
    .$onUpdate(() => sql`now()`),
});

export const transferEvents = pgTable("peppol_transfer_events", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => "te_" + ulid()),
  teamId: text("team_id")
    .references(() => teams.id)
    .notNull(),
  companyId: text("company_id")
    .notNull(),
  transmittedDocumentId: text("transmitted_document_id"),
  direction: transferEventDirectionEnum("direction").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const transmittedDocuments = pgTable("peppol_transmitted_documents", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => "doc_" + ulid()),
  teamId: text("team_id")
    .references(() => teams.id)
    .notNull(),
  companyId: text("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),
  direction: transferEventDirectionEnum("direction").notNull(),

  senderId: text("sender_id").notNull(), // e.g. 0208:0659689080
  receiverId: text("receiver_id").notNull(), // e.g. 0208:0659689080
  docTypeId: text("doc_type_id").notNull(), // e.g. urn:oasis:names:specification:ubl:schema:xsd:Invoice-2::Invoice##urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0::2.1
  processId: text("process_id").notNull(), // e.g. urn:fdc:peppol.eu:2017:poacc:billing:01:1.0
  countryC1: text("country_c1").notNull(), // e.g. BE
  xml: text("xml"), // XML body of the document, can be null if the body was not kept

  type: supportedDocumentTypeEnum("type").notNull().default("unknown"),
  parsed: jsonb("parsed").$type<Invoice | CreditNote>(),

  readAt: timestamp("read_at"), // defaults to null, set when the document is read
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "string" })
    .defaultNow()
    .notNull()
    .$onUpdate(() => sql`now()`),
});
