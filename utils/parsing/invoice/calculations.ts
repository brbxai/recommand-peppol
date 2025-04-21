import { Decimal } from "decimal.js";
import type { Invoice, InvoiceLine, VatCategory } from "./schemas";

export function calculateLineAmount(line: InvoiceLine) {
  return new Decimal(line.quantity).mul(line.netPriceAmount).toFixed(2);
}

function getNetAmount(line: InvoiceLine) {
  if (line.netAmount) {
    return line.netAmount;
  }
  return new Decimal(line.quantity).mul(line.netPriceAmount).toFixed(2);
}

export function calculateTotals(invoice: Invoice) {
  const taxExclusiveAmount = invoice.lines.reduce(
    (sum, line) => sum.plus(getNetAmount(line)),
    new Decimal(0)
  ).toFixed(2);

  const taxInclusiveAmount = invoice.lines.reduce(
    (sum, line) =>
      sum.plus(
        new Decimal(getNetAmount(line)).plus(
          new Decimal(getNetAmount(line)).mul(line.vat.percentage).div(100)
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

export function calculateVat(invoice: Invoice) {
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