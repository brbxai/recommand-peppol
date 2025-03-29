import { Decimal } from "decimal.js";
import type { SimpleInvoice, VatCategory } from "./schemas";

export function calculateTotals(invoice: SimpleInvoice) {
  const taxExclusiveAmount = invoice.lines.reduce(
    (sum, line) => sum.plus(line.netAmount),
    new Decimal(0)
  ).toFixed(2);

  const taxInclusiveAmount = invoice.lines.reduce(
    (sum, line) =>
      sum.plus(
        new Decimal(line.netAmount).plus(
          new Decimal(line.netAmount).mul(line.vat.percentage).div(100)
        )
      ),
    new Decimal(0)
  ).toFixed(2);

  return {
    taxExclusiveAmount,
    taxInclusiveAmount,
    payableAmount: taxInclusiveAmount,
  };
}

export function calculateVat(invoice: SimpleInvoice) {
  const subtotalsByCategory = invoice.lines.reduce((acc, line) => {
    const category = line.vat.category;
    const taxableAmount = new Decimal(line.netAmount);
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
    taxableAmount: subtotal.taxableAmount.toFixed(2),
    vatAmount: subtotal.vatAmount.toFixed(2),
    category: subtotal.category,
    percentage: subtotal.percentage,
    exemptionReasonCode: null as string | null,
  }));

  const totalVatAmount = subtotals.reduce(
    (sum, subtotal) => sum.plus(new Decimal(subtotal.vatAmount)),
    new Decimal(0)
  ).toFixed(2);

  return { totalVatAmount, subtotals };
} 