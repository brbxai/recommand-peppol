import { Decimal } from "decimal.js";
import type { Invoice, DocumentLine, VatCategory, Totals } from "./schemas";
import type { CreditNote } from "../creditnote/schemas";
import type { SelfBillingInvoice } from "../self-billing-invoice/schemas";
import type { SelfBillingCreditNote } from "../self-billing-creditnote/schemas";

export function calculateLineAmount(line: DocumentLine | DocumentLine) {
  return new Decimal(line.quantity).mul(line.netPriceAmount).toNearest(0.01).toFixed(2);
}

function getNetAmount(line: DocumentLine | DocumentLine) {
  if (line.netAmount) {
    return line.netAmount;
  }
  return new Decimal(line.quantity).mul(line.netPriceAmount).toNearest(0.01).toFixed(2);
}

export function calculateTotals(invoice: Invoice | CreditNote | SelfBillingInvoice | SelfBillingCreditNote) {
  const taxExclusiveAmount = invoice.lines.reduce(
    (sum, line) => sum.plus(getNetAmount(line)),
    new Decimal(0)
  ).toNearest(0.01).toFixed(2);

  const taxInclusiveAmount = invoice.lines.reduce(
    (sum, line) =>
      sum.plus(
        new Decimal(getNetAmount(line)).plus(
          new Decimal(getNetAmount(line)).mul(line.vat.percentage).div(100)
        )
      ),
    new Decimal(0)
  ).toNearest(0.01).toFixed(2);

  return {
    taxExclusiveAmount,
    taxInclusiveAmount,
    payableAmount: taxInclusiveAmount,
    paidAmount: "0.00",
  };
}

export function extractTotals(totals: Totals){
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
    taxExclusiveAmount: taxExclusiveAmount.toNearest(0.01).toFixed(2),
    taxInclusiveAmount: taxInclusiveAmount.toNearest(0.01).toFixed(2),
    payableAmount: payableAmount.toNearest(0.01).toFixed(2),
    paidAmount: paidAmount.toNearest(0.01).toFixed(2),
    payableRoundingAmount: payableRoundingAmount.toNearest(0.01).toFixed(2),
  };
  
}

export function calculateVat(invoice: Invoice | CreditNote) {
  const subtotalsByCategory = invoice.lines.reduce((acc, line) => {
    const category = line.vat.category;
    const taxableAmount = new Decimal(getNetAmount(line));
    const vatAmount = taxableAmount.mul(line.vat.percentage).div(100);

    if (!acc[category]) {
      acc[category] = {
        taxableAmount: new Decimal(0),
        vatAmount: new Decimal(0),
        category: category,
        percentage: line.vat.percentage,
      };
    }
    acc[category].taxableAmount = acc[category].taxableAmount.plus(taxableAmount);
    acc[category].vatAmount = acc[category].vatAmount.plus(vatAmount);
    return acc;
  }, {} as Record<VatCategory, { taxableAmount: Decimal; vatAmount: Decimal; category: VatCategory; percentage: string }>);

  const subtotals = Object.values(subtotalsByCategory).map(subtotal => ({
    taxableAmount: subtotal.taxableAmount.toNearest(0.01).toFixed(2),
    vatAmount: subtotal.vatAmount.toNearest(0.01).toFixed(2),
    category: subtotal.category,
    percentage: subtotal.percentage,
    exemptionReasonCode: null as string | null,
  }));

  const totalVatAmount = subtotals.reduce(
    (sum, subtotal) => sum.plus(new Decimal(subtotal.vatAmount)),
    new Decimal(0)
  ).toNearest(0.01).toFixed(2);

  return { totalVatAmount, subtotals };
} 