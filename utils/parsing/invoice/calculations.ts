import { Decimal } from "decimal.js";
import type { Invoice, DocumentLine, VatCategory } from "./schemas";
import type { CreditNote } from "../creditnote/schemas";

export function calculateLineAmount(line: DocumentLine | DocumentLine) {
  return new Decimal(line.quantity).mul(line.netPriceAmount).toNearest(0.01).toFixed(2);
}

function getNetAmount(line: DocumentLine | DocumentLine) {
  if (line.netAmount) {
    return line.netAmount;
  }
  return new Decimal(line.quantity).mul(line.netPriceAmount).toNearest(0.01).toFixed(2);
}

export function calculateTotals(invoice: Invoice | CreditNote) {
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
  };
}

export function calculatePrepaidAmount(taxInclusiveAmount: string, payableAmount: string) {
  if(new Decimal(payableAmount).gt(new Decimal(taxInclusiveAmount))) {
    return new Decimal(0).toNearest(0.01).toFixed(2);
  }
  return new Decimal(taxInclusiveAmount).minus(new Decimal(payableAmount)).toNearest(0.01).toFixed(2);
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