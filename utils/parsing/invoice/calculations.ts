import { Decimal } from "decimal.js";
import type { Invoice, DocumentLine, VatCategory, Totals } from "./schemas";
import type { CreditNote } from "../creditnote/schemas";
import type { SelfBillingInvoice } from "../self-billing-invoice/schemas";
import type { SelfBillingCreditNote } from "../self-billing-creditnote/schemas";

// Vat is always rounded to 2 decimal places per invoice line, discount or surcharge, otherwise we can't guarantee the totals will be correct.

export function calculateLineAmount(line: DocumentLine | DocumentLine) {
  return new Decimal(line.quantity).mul(line.netPriceAmount).toNearest(0.01).toFixed(2);
}

function getNetAmount(line: DocumentLine | DocumentLine) {
  if (line.netAmount) {
    return line.netAmount;
  }
  return new Decimal(line.quantity).mul(line.netPriceAmount).toNearest(0.01).toFixed(2);
}

export function calculateTotals(invoice: Invoice | CreditNote | SelfBillingInvoice | SelfBillingCreditNote): Totals {

  // Line totals
  const lineTotalsExcl = invoice.lines.reduce(
    (sum, line) => sum.plus(getNetAmount(line)),
    new Decimal(0)
  ).toNearest(0.01);

  // Discount totals
  const discountTotalsExcl = invoice.discounts?.reduce(
    (sum, discount) => sum.plus(discount.amount),
    new Decimal(0)
  ).toNearest(0.01) ?? new Decimal(0);

  // Surcharge totals
  const surchargeTotalsExcl = invoice.surcharges?.reduce(
    (sum, surcharge) => sum.plus(surcharge.amount),
    new Decimal(0)
  ).toNearest(0.01) ?? new Decimal(0);

  // Vat totals
  const vatTotals = calculateVat(invoice);

  // Totals
  const taxExclusiveAmount = new Decimal(lineTotalsExcl).minus(discountTotalsExcl).plus(surchargeTotalsExcl).toNearest(0.01);
  const taxInclusiveAmount = taxExclusiveAmount.plus(new Decimal(vatTotals.totalVatAmount));

  return {
    linesAmount: invoice.totals?.linesAmount ?? lineTotalsExcl.toFixed(2),
    discountAmount: invoice.totals?.discountAmount ?? discountTotalsExcl.eq(0) ? null : discountTotalsExcl.toFixed(2),
    surchargeAmount: invoice.totals?.surchargeAmount ?? surchargeTotalsExcl.eq(0) ? null : surchargeTotalsExcl.toFixed(2),
    taxExclusiveAmount: invoice.totals?.taxExclusiveAmount ?? taxExclusiveAmount.toFixed(2),
    taxInclusiveAmount: invoice.totals?.taxInclusiveAmount ?? taxInclusiveAmount.toFixed(2),
    payableAmount: invoice.totals?.payableAmount ?? taxInclusiveAmount.toFixed(2),
    paidAmount: "0.00",
  };
}

export function extractTotals(totals: Totals): Totals & { paidAmount: string, payableRoundingAmount: string } {
  // Tax exclusive and inclusive amounts are always provided
  const taxExclusiveAmount = new Decimal(totals.taxExclusiveAmount).toNearest(0.01);
  const taxInclusiveAmount = new Decimal(totals.taxInclusiveAmount).toNearest(0.01);

  // Payable amount and paid amount are optional
  let payableAmountStr = totals.payableAmount ?? null;
  let paidAmountStr = totals.paidAmount ?? null;

  let payableAmount = new Decimal(0);
  let paidAmount = new Decimal(0);

  if(payableAmountStr) {
    // Payable amount is provided
    payableAmount = new Decimal(payableAmountStr).toNearest(0.01);
    if(paidAmountStr) {
      // Paid amount is provided
      paidAmount = new Decimal(paidAmountStr).toNearest(0.01);
    } else {
      // Paid amount is not provided, so we can calculate it from the totals
      if(payableAmount.gt(taxInclusiveAmount)) {
        paidAmount = new Decimal(0);
      }else{
        paidAmount = taxInclusiveAmount.minus(payableAmount).toNearest(0.01);
      }
    }
  }else{
    // Payable amount is not provided, so we have to calculate it from the totals
    if(paidAmountStr) {
      // Paid amount is provided
      paidAmount = new Decimal(paidAmountStr).toNearest(0.01);
    } else {
      // Paid amount is not provided, we assume it to be 0
      paidAmount = new Decimal(0);
    }
    payableAmount = paidAmount.gt(taxInclusiveAmount) ? new Decimal(0) : taxInclusiveAmount.minus(paidAmount).toNearest(0.01);
  }

  // Calculate payable rounding amount
  const payableRoundingAmount = payableAmount.plus(paidAmount).minus(taxInclusiveAmount).toNearest(0.01);

  return {
    linesAmount: totals.linesAmount,
    discountAmount: totals.discountAmount,
    surchargeAmount: totals.surchargeAmount,
    taxExclusiveAmount: taxExclusiveAmount.toNearest(0.01).toFixed(2),
    taxInclusiveAmount: taxInclusiveAmount.toNearest(0.01).toFixed(2),
    payableAmount: payableAmount.toNearest(0.01).toFixed(2),
    paidAmount: paidAmount.toNearest(0.01).toFixed(2),
    payableRoundingAmount: payableRoundingAmount.toNearest(0.01).toFixed(2),
  };
  
}

export function calculateVat(invoice: Invoice | CreditNote) {

  const getKey = (category: VatCategory, percentage: string) => `${category}-${percentage}`;

  // Start with invoice line vat totals
  const subtotalsByKey = invoice.lines.reduce((acc, line) => {
    const category = line.vat.category;
    const key = getKey(category, line.vat.percentage);
    const taxableAmount = new Decimal(getNetAmount(line));

    if (!acc[key]) {
      acc[key] = {
        taxableAmount: new Decimal(0),
        category: category,
        percentage: line.vat.percentage,
      };
    }
    acc[key].taxableAmount = acc[key].taxableAmount.plus(taxableAmount);
    return acc;
  }, {} as Record<string, { taxableAmount: Decimal; category: VatCategory; percentage: string }>);

  // Add global discounts
  for(const discount of invoice.discounts ?? []) {
    const key = getKey(discount.vat.category, discount.vat.percentage);
    const taxableAmount = new Decimal(discount.amount);
    subtotalsByKey[key].taxableAmount = subtotalsByKey[key].taxableAmount.minus(taxableAmount);
  }

  // Add global surcharges
  for(const surcharge of invoice.surcharges ?? []) {
    const key = getKey(surcharge.vat.category, surcharge.vat.percentage);
    const taxableAmount = new Decimal(surcharge.amount);
    subtotalsByKey[key].taxableAmount = subtotalsByKey[key].taxableAmount.plus(taxableAmount);
  }

  const subtotals = Object.values(subtotalsByKey).map(subtotal => ({
    taxableAmount: subtotal.taxableAmount.toNearest(0.01).toFixed(2),
    vatAmount: subtotal.taxableAmount.mul(subtotal.percentage).div(100).toNearest(0.01).toFixed(2),
    category: subtotal.category,
    percentage: subtotal.percentage,
    exemptionReasonCode: null as string | null,
    exemptionReason: null as string | null,
  }));

  const totalVatAmount = subtotals.reduce(
    (sum, subtotal) => sum.plus(new Decimal(subtotal.vatAmount)),
    new Decimal(0)
  ).toNearest(0.01).toFixed(2);

  return { totalVatAmount, subtotals };
} 