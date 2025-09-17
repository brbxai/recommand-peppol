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
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { ulid } from "ulid";
import { SQL, sql } from "drizzle-orm";
import { uniqueIndex } from "drizzle-orm/pg-core";
import { z } from "zod";
import type { Invoice } from "@peppol/utils/parsing/invoice/schemas";
import type { CreditNote } from "@peppol/utils/parsing/creditnote/schemas";
import { autoUpdateTimestamp } from "@recommand/db/custom-types";
import { COUNTRIES } from "@peppol/utils/countries";

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

export const zodValidCountryCodes = z.enum(COUNTRIES.map((c) => c.code) as [string, ...string[]]);
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

export const transferEventTypeEnum = pgEnum(
  "peppol_transfer_event_type",
  ["peppol", "email"]
);

export const billingProfiles = pgTable("peppol_billing_profiles", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => "bp_" + ulid()),
  teamId: text("team_id") // Not linked to teams table, as we don't want to delete the billing profile when the team is deleted
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

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: autoUpdateTimestamp(),
});

export const subscriptions = pgTable("peppol_subscriptions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => "sub_" + ulid()),
  teamId: text("team_id") // Not linked to teams table, as we don't want to delete the subscription when the team is deleted
    .notNull(),
  planId: text("plan_id"),
  planName: text("plan_name").notNull(),
  billingConfig: jsonb("billing_config").$type<BillingConfig>().notNull(),
  startDate: timestamp("start_date", { withTimezone: true })
    .defaultNow()
    .notNull(),
  endDate: timestamp("end_date", { withTimezone: true }),
  lastBilledAt: timestamp("last_billed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: autoUpdateTimestamp(),
});

export const subscriptionBillingEvents = pgTable(
  "peppol_subscription_billing_events",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => "sbe_" + ulid()),
    teamId: text("team_id") // Not linked to teams table, as we don't want to delete the subscription billing events when the team is deleted
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

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: autoUpdateTimestamp(),
  }
);

export const companies = pgTable("peppol_companies", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => "c_" + ulid()),
  teamId: text("team_id")
    .references(() => teams.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  postalCode: text("postal_code").notNull(),
  city: text("city").notNull(),
  country: validCountryCodes("country").notNull(),
  enterpriseNumber: text("enterprise_number").notNull(),
  vatNumber: text("vat_number"),
  isSmpRecipient: boolean("is_smp_recipient").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: autoUpdateTimestamp(),
});

export const companyIdentifiers = pgTable("peppol_company_identifiers", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => "ci_" + ulid()),
  companyId: text("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),
  scheme: text("scheme").notNull(),
  identifier: text("identifier").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: autoUpdateTimestamp(),
}, (table) => [
  uniqueIndex("peppol_company_identifiers_unique").on(table.companyId, lower(table.scheme), lower(table.identifier)),
]);

export const companyDocumentTypes = pgTable("peppol_company_document_types", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => "cdt_" + ulid()),
  companyId: text("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),
  docTypeId: text("doc_type_id").notNull(),
  processId: text("process_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: autoUpdateTimestamp(),
}, (table) => [
  uniqueIndex("peppol_company_document_types_unique").on(table.companyId, table.docTypeId, table.processId),
]);

export const webhooks = pgTable("peppol_webhooks", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => "wh_" + ulid()),
  teamId: text("team_id")
    .references(() => teams.id, { onDelete: "cascade" })
    .notNull(),
  companyId: text("company_id")
    .references(() => companies.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: autoUpdateTimestamp(),
});

export const transferEvents = pgTable("peppol_transfer_events", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => "te_" + ulid()),
  teamId: text("team_id") // Not linked to teams table, as we don't want to delete the transfer events when the team is deleted
    .notNull(),
  companyId: text("company_id")
    .notNull(),
  type: transferEventTypeEnum("type").notNull().default("peppol"),
  transmittedDocumentId: text("transmitted_document_id"),
  direction: transferEventDirectionEnum("direction").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const transmittedDocuments = pgTable("peppol_transmitted_documents", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => "doc_" + ulid()),
  teamId: text("team_id")
    .references(() => teams.id, { onDelete: "cascade" })
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

  sentOverPeppol: boolean("sent_over_peppol").notNull().default(true),
  sentOverEmail: boolean("sent_over_email").notNull().default(false),
  emailRecipients: text("email_recipients").notNull().array().default([]),

  type: supportedDocumentTypeEnum("type").notNull().default("unknown"),
  parsed: jsonb("parsed").$type<Invoice | CreditNote>(),

  readAt: timestamp("read_at"), // defaults to null, set when the document is read
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: autoUpdateTimestamp(),
});

export const teamExtensions = pgTable("peppol_team_extensions", {
  id: text("id")
    .primaryKey()
    .references(() => teams.id, { onDelete: "cascade" }),
  isPlayground: boolean("is_playground").notNull().default(false),
});

export function lower(email: AnyPgColumn): SQL {
  return sql`lower(${email})`;
}