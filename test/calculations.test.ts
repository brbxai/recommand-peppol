import { describe, it, expect } from "bun:test";
import { extractTotals, calculateTotals, calculateVat } from "../utils/parsing/invoice/calculations";
import type { Totals, Invoice } from "../utils/parsing/invoice/schemas";
import Decimal from "decimal.js";

function recalculatePayableAmount(result: ReturnType<typeof extractTotals>){
    return new Decimal(result.taxInclusiveAmount).minus(new Decimal(result.paidAmount)).plus(new Decimal(result.payableRoundingAmount)).toFixed(2);
}

describe("extractTotals", () => {
    describe("when payableAmount is provided", () => {
        it("should calculate paidAmount when paidAmount is not provided and payableAmount <= taxInclusiveAmount", () => {
            const totals: Totals = {
                taxExclusiveAmount: "100.00",
                taxInclusiveAmount: "121.00",
                payableAmount: "50.00",
                paidAmount: null,
            };

            const result = extractTotals(totals);

            expect(result.taxExclusiveAmount).toBe("100.00");
            expect(result.taxInclusiveAmount).toBe("121.00");
            expect(result.payableAmount).toBe("50.00");
            expect(result.paidAmount).toBe("71.00"); // 121.00 - 50.00
            expect(result.payableRoundingAmount).toBe("0.00"); // 50.00 + 71.00 - 121.00
            expect(result.payableAmount).toBe(recalculatePayableAmount(result)); // BR-CO-16
        });

        it("should set paidAmount to 0 when payableAmount > taxInclusiveAmount", () => {
            const totals: Totals = {
                taxExclusiveAmount: "100.00",
                taxInclusiveAmount: "121.00",
                payableAmount: "150.00",
                paidAmount: null,
            };

            const result = extractTotals(totals);

            expect(result.taxExclusiveAmount).toBe("100.00");
            expect(result.taxInclusiveAmount).toBe("121.00");
            expect(result.payableAmount).toBe("150.00");
            expect(result.paidAmount).toBe("0.00");
            expect(result.payableRoundingAmount).toBe("29.00"); // 150.00 + 0.00 - 121.00
            expect(result.payableAmount).toBe(recalculatePayableAmount(result)); // BR-CO-16
        });

        it("should use provided paidAmount when both payableAmount and paidAmount are provided", () => {
            const totals: Totals = {
                taxExclusiveAmount: "100.00",
                taxInclusiveAmount: "121.00",
                payableAmount: "50.00",
                paidAmount: "30.00",
            };

            const result = extractTotals(totals);

            expect(result.taxExclusiveAmount).toBe("100.00");
            expect(result.taxInclusiveAmount).toBe("121.00");
            expect(result.payableAmount).toBe("50.00");
            expect(result.paidAmount).toBe("30.00");
            expect(result.payableRoundingAmount).toBe("-41.00"); // 50.00 + 30.00 - 121.00
            expect(result.payableAmount).toBe(recalculatePayableAmount(result)); // BR-CO-16
        });
    });

    describe("when payableAmount is not provided", () => {
        it("should calculate payableAmount when paidAmount is provided and paidAmount <= taxInclusiveAmount", () => {
            const totals: Totals = {
                taxExclusiveAmount: "100.00",
                taxInclusiveAmount: "121.00",
                payableAmount: null,
                paidAmount: "30.00",
            };

            const result = extractTotals(totals);

            expect(result.taxExclusiveAmount).toBe("100.00");
            expect(result.taxInclusiveAmount).toBe("121.00");
            expect(result.payableAmount).toBe("91.00"); // 121.00 - 30.00
            expect(result.paidAmount).toBe("30.00");
            expect(result.payableRoundingAmount).toBe("0.00"); // 91.00 + 30.00 - 121.00
            expect(result.payableAmount).toBe(recalculatePayableAmount(result)); // BR-CO-16
        });

        it("should set payableAmount to 0 when paidAmount > taxInclusiveAmount", () => {
            const totals: Totals = {
                taxExclusiveAmount: "100.00",
                taxInclusiveAmount: "121.00",
                payableAmount: null,
                paidAmount: "150.00",
            };

            const result = extractTotals(totals);

            expect(result.taxExclusiveAmount).toBe("100.00");
            expect(result.taxInclusiveAmount).toBe("121.00");
            expect(result.payableAmount).toBe("0.00");
            expect(result.paidAmount).toBe("150.00");
            expect(result.payableRoundingAmount).toBe("29.00"); // 0.00 + 150.00 - 121.00
            expect(result.payableAmount).toBe(recalculatePayableAmount(result)); // BR-CO-16
        });

        it("should set both payableAmount and paidAmount when neither is provided", () => {
            const totals: Totals = {
                taxExclusiveAmount: "100.00",
                taxInclusiveAmount: "121.00",
                payableAmount: null,
                paidAmount: null,
            };

            const result = extractTotals(totals);

            expect(result.taxExclusiveAmount).toBe("100.00");
            expect(result.taxInclusiveAmount).toBe("121.00");
            expect(result.payableAmount).toBe("121.00"); // 121.00 - 0.00
            expect(result.paidAmount).toBe("0.00");
            expect(result.payableRoundingAmount).toBe("0.00"); // 121.00 + 0.00 - 121.00
            expect(result.payableAmount).toBe(recalculatePayableAmount(result)); // BR-CO-16
        });
    });

    describe("rounding behavior", () => {
        it("should round all amounts to 2 decimal places", () => {
            const totals: Totals = {
                taxExclusiveAmount: "100.123456",
                taxInclusiveAmount: "121.123456",
                payableAmount: "50.123456",
                paidAmount: "30.123456",
            };

            const result = extractTotals(totals);

            expect(result.taxExclusiveAmount).toBe("100.12");
            expect(result.taxInclusiveAmount).toBe("121.12");
            expect(result.payableAmount).toBe("50.12");
            expect(result.paidAmount).toBe("30.12");
            expect(result.payableRoundingAmount).toBe("-40.88"); // 50.12 + 30.12 - 121.12
            expect(result.payableAmount).toBe(recalculatePayableAmount(result)); // BR-CO-16
        });

        it("should round all amounts to 2 decimal places (2)", () => {
            const totals: Totals = {
                taxExclusiveAmount: "100.1553456",
                taxInclusiveAmount: "121.1879682",
                payableAmount: "50.125456",
                paidAmount: "30.125456",
            };

            const result = extractTotals(totals);

            expect(result.taxExclusiveAmount).toBe("100.16");
            expect(result.taxInclusiveAmount).toBe("121.19");
            expect(result.payableAmount).toBe("50.13");
            expect(result.paidAmount).toBe("30.13");
            expect(result.payableRoundingAmount).toBe("-40.93"); // 50.13 + 30.13 - 121.19
            expect(result.payableAmount).toBe(recalculatePayableAmount(result)); // BR-CO-16
        });

        it("should handle negative rounding amounts correctly", () => {
            const totals: Totals = {
                taxExclusiveAmount: "100.00",
                taxInclusiveAmount: "121.00",
                payableAmount: "50.00",
                paidAmount: "30.00",
            };

            const result = extractTotals(totals);

            expect(result.payableRoundingAmount).toBe("-41.00"); // 50.00 + 30.00 - 121.00
            expect(result.payableAmount).toBe(recalculatePayableAmount(result)); // BR-CO-16
        });

        it("should handle positive rounding amounts correctly", () => {
            const totals: Totals = {
                taxExclusiveAmount: "100.00",
                taxInclusiveAmount: "121.00",
                payableAmount: "150.00",
                paidAmount: "0.00",
            };

            const result = extractTotals(totals);

            expect(result.payableRoundingAmount).toBe("29.00"); // 150.00 + 0.00 - 121.00
            expect(result.payableAmount).toBe(recalculatePayableAmount(result)); // BR-CO-16
        });

        it("should use provided paidAmount when both payableAmount and paidAmount are provided in a realistic rounding up scenario", () => {
            const totals: Totals = {
                taxExclusiveAmount: "91.10",
                taxInclusiveAmount: "110.23",
                payableAmount: "0.00",
                paidAmount: "110.25",
            };

            const result = extractTotals(totals);

            expect(result.taxExclusiveAmount).toBe("91.10");
            expect(result.taxInclusiveAmount).toBe("110.23");
            expect(result.payableAmount).toBe("0.00");
            expect(result.paidAmount).toBe("110.25");
            expect(result.payableRoundingAmount).toBe("0.02");
            expect(result.payableAmount).toBe(recalculatePayableAmount(result)); // BR-CO-16
        });

        it("should use provided paidAmount when both payableAmount and paidAmount are provided in a realistic rounding down scenario", () => {
            const totals: Totals = {
                taxExclusiveAmount: "91.50",
                taxInclusiveAmount: "110.72",
                payableAmount: "0.00",
                paidAmount: "110.70",
            };

            const result = extractTotals(totals);

            expect(result.taxExclusiveAmount).toBe("91.50");
            expect(result.taxInclusiveAmount).toBe("110.72");
            expect(result.payableAmount).toBe("0.00");
            expect(result.paidAmount).toBe("110.70");
            expect(result.payableRoundingAmount).toBe("-0.02");
            expect(result.payableAmount).toBe(recalculatePayableAmount(result)); // BR-CO-16
        });

        it("should have no rounding amount when only payableAmount is provided in a realistic rounding scenario", () => {
            const totals: Totals = {
                taxExclusiveAmount: "91.50",
                taxInclusiveAmount: "110.72",
                payableAmount: "0.00",
            };

            const result = extractTotals(totals);

            expect(result.taxExclusiveAmount).toBe("91.50");
            expect(result.taxInclusiveAmount).toBe("110.72");
            expect(result.payableAmount).toBe("0.00");
            expect(result.paidAmount).toBe("110.72");
            expect(result.payableRoundingAmount).toBe("0.00");
            expect(result.payableAmount).toBe(recalculatePayableAmount(result)); // BR-CO-16
        });

        it("should have no rounding amount when only paidAmount is provided in a realistic rounding scenario", () => {
            const totals: Totals = {
                taxExclusiveAmount: "91.50",
                taxInclusiveAmount: "110.72",
                paidAmount: "0.00",
            };

            const result = extractTotals(totals);

            expect(result.taxExclusiveAmount).toBe("91.50");
            expect(result.taxInclusiveAmount).toBe("110.72");
            expect(result.payableAmount).toBe("110.72");
            expect(result.paidAmount).toBe("0.00");
            expect(result.payableRoundingAmount).toBe("0.00");
            expect(result.payableAmount).toBe(recalculatePayableAmount(result)); // BR-CO-16
        });

    });

    describe("edge cases", () => {
        it("should handle zero amounts", () => {
            const totals: Totals = {
                linesAmount: "0.00",
                taxExclusiveAmount: "0.00",
                taxInclusiveAmount: "0.00",
                payableAmount: "0.00",
                paidAmount: "0.00",
            };

            const result = extractTotals(totals);

            expect(result.taxExclusiveAmount).toBe("0.00");
            expect(result.taxInclusiveAmount).toBe("0.00");
            expect(result.payableAmount).toBe("0.00");
            expect(result.paidAmount).toBe("0.00");
            expect(result.payableRoundingAmount).toBe("0.00");
            expect(result.payableAmount).toBe(recalculatePayableAmount(result)); // BR-CO-16
        });

        it("should handle very small amounts", () => {
            const totals: Totals = {
                taxExclusiveAmount: "0.01",
                taxInclusiveAmount: "0.01",
                payableAmount: "0.01",
                paidAmount: "0.00",
            };

            const result = extractTotals(totals);

            expect(result.taxExclusiveAmount).toBe("0.01");
            expect(result.taxInclusiveAmount).toBe("0.01");
            expect(result.payableAmount).toBe("0.01");
            expect(result.paidAmount).toBe("0.00");
            expect(result.payableRoundingAmount).toBe("0.00");
            expect(result.payableAmount).toBe(recalculatePayableAmount(result)); // BR-CO-16
        });

        it("should handle very small amounts (2)", () => {
            const totals: Totals = {    
                linesAmount: "0.01",
                taxExclusiveAmount: "0.01",
                taxInclusiveAmount: "0.01",
                payableAmount: "0.01",
                paidAmount: "0.01",
            };

            const result = extractTotals(totals);

            expect(result.taxExclusiveAmount).toBe("0.01");
            expect(result.taxInclusiveAmount).toBe("0.01");
            expect(result.payableAmount).toBe("0.01");
            expect(result.paidAmount).toBe("0.01");
            expect(result.payableRoundingAmount).toBe("0.01");
            expect(result.payableAmount).toBe(recalculatePayableAmount(result)); // BR-CO-16
        });

        it("should handle large amounts", () => {
            const totals: Totals = {
                linesAmount: "1000000.00",
                taxExclusiveAmount: "1000000.00",
                taxInclusiveAmount: "1210000.00",
                payableAmount: "500000.00",
                paidAmount: "300000.00",
            };

            const result = extractTotals(totals);

            expect(result.taxExclusiveAmount).toBe("1000000.00");
            expect(result.taxInclusiveAmount).toBe("1210000.00");
            expect(result.payableAmount).toBe("500000.00");
            expect(result.paidAmount).toBe("300000.00");
            expect(result.payableRoundingAmount).toBe("-410000.00");
            expect(result.payableAmount).toBe(recalculatePayableAmount(result)); // BR-CO-16
        });
        
    });

    describe("complex scenarios", () => {
        it("should handle overpayment scenario", () => {
            const totals: Totals = {
                linesAmount: "100.00",
                taxExclusiveAmount: "100.00",
                taxInclusiveAmount: "121.00",
                payableAmount: "50.00",
                paidAmount: "150.00",
            };

            const result = extractTotals(totals);

            expect(result.taxExclusiveAmount).toBe("100.00");
            expect(result.taxInclusiveAmount).toBe("121.00");
            expect(result.payableAmount).toBe("50.00");
            expect(result.paidAmount).toBe("150.00");
            expect(result.payableRoundingAmount).toBe("79.00"); // 50.00 + 150.00 - 121.00
            expect(result.payableAmount).toBe(recalculatePayableAmount(result)); // BR-CO-16
        });

        it("should handle exact payment scenario", () => {
            const totals: Totals = {
                taxExclusiveAmount: "100.00",
                taxInclusiveAmount: "121.00",
                payableAmount: "121.00",
                paidAmount: "0.00",
            };

            const result = extractTotals(totals);

            expect(result.taxExclusiveAmount).toBe("100.00");
            expect(result.taxInclusiveAmount).toBe("121.00");
            expect(result.payableAmount).toBe("121.00");
            expect(result.paidAmount).toBe("0.00");
            expect(result.payableRoundingAmount).toBe("0.00"); // 121.00 + 0.00 - 121.00
            expect(result.payableAmount).toBe(recalculatePayableAmount(result)); // BR-CO-16
        });

        it("should handle partial payment scenario", () => {
            const totals: Totals = {
                linesAmount: "100.00",
                taxExclusiveAmount: "100.00",
                taxInclusiveAmount: "121.00",
                payableAmount: "60.50",
                paidAmount: "60.50",
            };

            const result = extractTotals(totals);

            expect(result.taxExclusiveAmount).toBe("100.00");
            expect(result.taxInclusiveAmount).toBe("121.00");
            expect(result.payableAmount).toBe("60.50");
            expect(result.paidAmount).toBe("60.50");
            expect(result.payableRoundingAmount).toBe("0.00"); // 60.50 + 60.50 - 121.00
            expect(result.payableAmount).toBe(recalculatePayableAmount(result)); // BR-CO-16
        });

        it("should handle cases where payable amount and paid amount are not set", () => {
            const totals: Totals = {
                linesAmount: "100.00",
                taxExclusiveAmount: "100.00",
                taxInclusiveAmount: "121.00",
                payableAmount: null,
                paidAmount: null,
            };

            const result = extractTotals(totals);

            expect(result.taxExclusiveAmount).toBe("100.00");
            expect(result.taxInclusiveAmount).toBe("121.00");
            expect(result.payableAmount).toBe("121.00");
            expect(result.paidAmount).toBe("0.00");
            expect(result.payableRoundingAmount).toBe("0.00");
            expect(result.payableAmount).toBe(recalculatePayableAmount(result)); // BR-CO-16
        });
    });
});

describe("calculateTotals", () => {
    function createInvoice(overrides: Partial<Invoice>): Invoice {
        return {
            invoiceNumber: "TEST-001",
            issueDate: "2025-01-01",
            dueDate: "2025-02-01",
            currency: "EUR",
            seller: {
                name: "Seller",
                street: "Street 1",
                city: "City",
                postalZone: "1000",
                country: "BE",
            },
            buyer: {
                name: "Buyer",
                street: "Street 1",
                city: "City",
                postalZone: "1000",
                country: "BE",
            },
            lines: [],
            ...overrides,
        };
    }

    describe("rounding edge cases", () => {
        it("should handle line amounts that round individually but create discrepancy in sum", () => {
            const invoice = createInvoice({
                lines: [
                    { name: "Item 1", quantity: "3.333", unitCode: "C62", netPriceAmount: "1.499", vat: { category: "S", percentage: "21.00" } },
                    { name: "Item 2", quantity: "7.777", unitCode: "C62", netPriceAmount: "0.999", vat: { category: "S", percentage: "21.00" } },
                ],
            });

            const result = calculateTotals(invoice);
            const vat = calculateVat({document: invoice, isDocumentValidationEnforced: false});

            const line1Net = new Decimal("3.333").mul("1.499").toNearest(0.01);
            const line2Net = new Decimal("7.777").mul("0.999").toNearest(0.01);
            const lineNetSum = line1Net.plus(line2Net).toNearest(0.01);
            const calculatedTaxExclusive = new Decimal(result.taxExclusiveAmount);
            const calculatedTaxInclusive = new Decimal(result.taxInclusiveAmount);
            const totalVat = new Decimal(vat.totalVatAmount);

            expect(calculatedTaxExclusive.toFixed(2)).toBe(lineNetSum.toFixed(2));
            expect(calculatedTaxInclusive.toFixed(2)).toBe(calculatedTaxExclusive.plus(totalVat).toNearest(0.01).toFixed(2));
        });

        it("should handle invoice with discounts that create rounding issues", () => {
            const invoice = createInvoice({
                lines: [
                    { name: "Item", quantity: "1", unitCode: "C62", netPriceAmount: "100.00", vat: { category: "S", percentage: "21.00" } },
                ],
                discounts: [
                    { amount: "33.33", reason: "Discount", vat: { category: "S", percentage: "21.00" } },
                ],
            });

            const result = calculateTotals(invoice);
            const vat = calculateVat({document: invoice, isDocumentValidationEnforced: false});

            expect(result.taxExclusiveAmount).toBe("66.67");
            expect(result.discountAmount).toBe("33.33");

            const taxExclusive = new Decimal(result.taxExclusiveAmount);
            const totalVat = new Decimal(vat.totalVatAmount);
            const expectedTaxInclusive = taxExclusive.plus(totalVat).toNearest(0.01);
            expect(result.taxInclusiveAmount).toBe(expectedTaxInclusive.toFixed(2));
        });

        it("should handle invoice with surcharges that create rounding issues", () => {
            const invoice = createInvoice({
                lines: [
                    { name: "Item", quantity: "1", unitCode: "C62", netPriceAmount: "99.99", vat: { category: "S", percentage: "21.00" } },
                ],
                surcharges: [
                    { amount: "6.66", reason: "Surcharge", vat: { category: "S", percentage: "21.00" } },
                ],
            });

            const result = calculateTotals(invoice);
            const vat = calculateVat({document: invoice, isDocumentValidationEnforced: false});

            const lineTotal = new Decimal("99.99");
            const surchargeTotal = new Decimal("6.66");
            const taxExclusive = lineTotal.plus(surchargeTotal).toNearest(0.01);
            const totalVat = new Decimal(vat.totalVatAmount);

            expect(result.taxExclusiveAmount).toBe(taxExclusive.toFixed(2));
            expect(result.surchargeAmount).toBe("6.66");
            expect(new Decimal(result.taxInclusiveAmount).toFixed(2)).toBe(taxExclusive.plus(totalVat).toNearest(0.01).toFixed(2));
        });

        it("should handle multiple lines with different VAT rates and rounding", () => {
            const invoice = createInvoice({
                lines: [
                    { name: "Item 1", quantity: "1.111", unitCode: "C62", netPriceAmount: "9.999", vat: { category: "S", percentage: "21.00" } },
                    { name: "Item 2", quantity: "2.222", unitCode: "C62", netPriceAmount: "4.444", vat: { category: "S", percentage: "6.00" } },
                    { name: "Item 3", quantity: "3.333", unitCode: "C62", netPriceAmount: "3.333", vat: { category: "Z", percentage: "0.00" } },
                ],
            });

            const result = calculateTotals(invoice);
            const vat = calculateVat({document: invoice, isDocumentValidationEnforced: false});

            const line1Net = new Decimal("1.111").mul("9.999").toNearest(0.01);
            const line2Net = new Decimal("2.222").mul("4.444").toNearest(0.01);
            const line3Net = new Decimal("3.333").mul("3.333").toNearest(0.01);
            const taxExclusive = line1Net.plus(line2Net).plus(line3Net).toNearest(0.01);
            const totalVat = new Decimal(vat.totalVatAmount);

            expect(result.taxExclusiveAmount).toBe(taxExclusive.toFixed(2));
            expect(new Decimal(result.taxInclusiveAmount).toFixed(2)).toBe(taxExclusive.plus(totalVat).toNearest(0.01).toFixed(2));
        });

        it("should handle invoice with discounts, surcharges, and multiple lines", () => {
            const invoice = createInvoice({
                lines: [
                    { name: "Item 1", quantity: "1.234", unitCode: "C62", netPriceAmount: "5.678", vat: { category: "S", percentage: "21.00" } },
                    { name: "Item 2", quantity: "9.876", unitCode: "C62", netPriceAmount: "3.210", vat: { category: "S", percentage: "21.00" } },
                ],
                discounts: [
                    { amount: "1.11", reason: "Discount", vat: { category: "S", percentage: "21.00" } },
                ],
                surcharges: [
                    { amount: "2.22", reason: "Surcharge", vat: { category: "S", percentage: "21.00" } },
                ],
            });

            const result = calculateTotals(invoice);
            const vat = calculateVat({document: invoice, isDocumentValidationEnforced: false});

            const line1Net = new Decimal("1.234").mul("5.678").toNearest(0.01);
            const line2Net = new Decimal("9.876").mul("3.210").toNearest(0.01);
            const discountTotal = new Decimal("1.11");
            const surchargeTotal = new Decimal("2.22");
            const expectedTaxExclusive = line1Net.plus(line2Net).minus(discountTotal).plus(surchargeTotal).toNearest(0.01);

            expect(result.taxExclusiveAmount).toBe(expectedTaxExclusive.toFixed(2));
            expect(result.discountAmount).toBe("1.11");
            expect(result.surchargeAmount).toBe("2.22");

            const taxExclusive = new Decimal(result.taxExclusiveAmount);
            const totalVat = new Decimal(vat.totalVatAmount);
            const expectedTaxInclusive = taxExclusive.plus(totalVat).toNearest(0.01);
            expect(result.taxInclusiveAmount).toBe(expectedTaxInclusive.toFixed(2));
            expect(result.taxInclusiveAmount).toBe("48.18");
        });

        it("should validate totals formula: taxExclusiveAmount = sum(lines) - discounts + surcharges", () => {
            const invoice = createInvoice({
                lines: [
                    { name: "Item 1", quantity: "3", unitCode: "C62", netPriceAmount: "33.33", vat: { category: "S", percentage: "21.00" } },
                    { name: "Item 2", quantity: "2", unitCode: "C62", netPriceAmount: "50.005", vat: { category: "S", percentage: "21.00" } },
                ],
                discounts: [
                    { amount: "10.00", reason: "Discount", vat: { category: "S", percentage: "21.00" } },
                ],
                surcharges: [
                    { amount: "5.55", reason: "Surcharge", vat: { category: "S", percentage: "21.00" } },
                ],
            });

            const result = calculateTotals(invoice);

            const line1Net = new Decimal("3").mul("33.33").toNearest(0.01);
            const line2Net = new Decimal("2").mul("50.005").toNearest(0.01);
            const lineSum = line1Net.plus(line2Net).toNearest(0.01);
            const expectedTaxExclusive = lineSum.minus("10.00").plus("5.55").toNearest(0.01);

            expect(result.taxExclusiveAmount).toBe(expectedTaxExclusive.toFixed(2));
        });

        it("should validate BR-CO-15: taxInclusiveAmount = taxExclusiveAmount + totalVat", () => {
            const invoice = createInvoice({
                lines: [
                    { name: "Item", quantity: "1.111", unitCode: "C62", netPriceAmount: "99.999", vat: { category: "S", percentage: "21.00" } },
                ],
            });

            const result = calculateTotals(invoice);
            const vat = calculateVat({document: invoice, isDocumentValidationEnforced: false});

            const taxExclusive = new Decimal(result.taxExclusiveAmount);
            const totalVat = new Decimal(vat.totalVatAmount);
            const expectedTaxInclusive = taxExclusive.plus(totalVat).toNearest(0.01);

            expect(result.taxInclusiveAmount).toBe(expectedTaxInclusive.toFixed(2));
        });

        it("should validate complete calculation chain with extreme rounding case", () => {
            const invoice = createInvoice({
                lines: [
                    { name: "Item 1", quantity: "0.333", unitCode: "C62", netPriceAmount: "0.997", vat: { category: "S", percentage: "21.00" } },
                    { name: "Item 2", quantity: "0.667", unitCode: "C62", netPriceAmount: "0.998", vat: { category: "S", percentage: "21.00" } },
                    { name: "Item 3", quantity: "1.111", unitCode: "C62", netPriceAmount: "0.999", vat: { category: "S", percentage: "21.00" } },
                ],
                discounts: [
                    { amount: "0.11", reason: "Discount", vat: { category: "S", percentage: "21.00" } },
                ],
                surcharges: [
                    { amount: "0.22", reason: "Surcharge", vat: { category: "S", percentage: "21.00" } },
                ],
            });

            const result = calculateTotals(invoice);
            const vat = calculateVat({document: invoice, isDocumentValidationEnforced: false});

            const line1 = new Decimal("0.333").mul("0.997").toNearest(0.01);
            const line2 = new Decimal("0.667").mul("0.998").toNearest(0.01);
            const line3 = new Decimal("1.111").mul("0.999").toNearest(0.01);
            const lineSum = line1.plus(line2).plus(line3).toNearest(0.01);
            const expectedTaxExclusive = lineSum.minus("0.11").plus("0.22").toNearest(0.01);

            expect(result.taxExclusiveAmount).toBe(expectedTaxExclusive.toFixed(2));

            const taxExclusive = new Decimal(result.taxExclusiveAmount);
            const totalVat = new Decimal(vat.totalVatAmount);
            const expectedTaxInclusive = taxExclusive.plus(totalVat).toNearest(0.01);

            expect(result.taxInclusiveAmount).toBe(expectedTaxInclusive.toFixed(2));
        });

        it("should handle high precision rounding with three decimal quantities", () => {
            const invoice = createInvoice({
                lines: [
                    { name: "Item", quantity: "12.345", unitCode: "C62", netPriceAmount: "6.789", vat: { category: "S", percentage: "21.00" } },
                ],
            });

            const result = calculateTotals(invoice);
            const vat = calculateVat({document: invoice, isDocumentValidationEnforced: false});

            const lineNet = new Decimal("12.345").mul("6.789").toNearest(0.01);
            expect(result.taxExclusiveAmount).toBe(lineNet.toFixed(2));

            const taxExclusive = new Decimal(result.taxExclusiveAmount);
            const totalVat = new Decimal(vat.totalVatAmount);
            const expectedTaxInclusive = taxExclusive.plus(totalVat).toNearest(0.01);

            expect(result.taxInclusiveAmount).toBe(expectedTaxInclusive.toFixed(2));
        });

        it("should handle invoice where line VAT rounding differs from total VAT calculation", () => {
            const invoice = createInvoice({
                lines: [
                    { name: "Item 1", quantity: "1", unitCode: "C62", netPriceAmount: "10.01", vat: { category: "S", percentage: "21.00" } },
                    { name: "Item 2", quantity: "1", unitCode: "C62", netPriceAmount: "10.02", vat: { category: "S", percentage: "21.00" } },
                    { name: "Item 3", quantity: "1", unitCode: "C62", netPriceAmount: "10.03", vat: { category: "S", percentage: "21.00" } },
                ],
            });

            const result = calculateTotals(invoice);
            const vat = calculateVat({document: invoice, isDocumentValidationEnforced: false});

            const expectedTaxExclusive = new Decimal("10.01").plus("10.02").plus("10.03").toNearest(0.01);
            expect(result.taxExclusiveAmount).toBe(expectedTaxExclusive.toFixed(2));

            const taxExclusive = new Decimal(result.taxExclusiveAmount);
            const totalVat = new Decimal(vat.totalVatAmount);
            const expectedTaxInclusive = taxExclusive.plus(totalVat).toNearest(0.01);

            expect(result.taxInclusiveAmount).toBe(expectedTaxInclusive.toFixed(2));
        });

        it("should handle discount larger than line total with correct signs", () => {
            const invoice = createInvoice({
                lines: [
                    { name: "Item", quantity: "1", unitCode: "C62", netPriceAmount: "50.00", vat: { category: "S", percentage: "21.00" } },
                ],
                discounts: [
                    { amount: "75.00", reason: "Large discount", vat: { category: "S", percentage: "21.00" } },
                ],
            });

            const result = calculateTotals(invoice);
            const vat = calculateVat({document: invoice, isDocumentValidationEnforced: false});

            const expectedTaxExclusive = new Decimal("50.00").minus("75.00").toNearest(0.01);
            expect(result.taxExclusiveAmount).toBe(expectedTaxExclusive.toFixed(2));
            expect(result.taxExclusiveAmount).toBe("-25.00");

            const taxExclusive = new Decimal(result.taxExclusiveAmount);
            const totalVat = new Decimal(vat.totalVatAmount);
            const expectedTaxInclusive = taxExclusive.plus(totalVat).toNearest(0.01);

            expect(result.taxInclusiveAmount).toBe(expectedTaxInclusive.toFixed(2));
        });
    });

    describe("comprehensive VAT subtotals validation", () => {
        it("should validate VAT subtotals with multiple VAT rates, rounding errors, discounts and surcharges", () => {
            const invoice = createInvoice({
                lines: [
                    // Standard rate 21% - with rounding potential
                    { name: "Item 1", quantity: "1.333", unitCode: "C62", netPriceAmount: "7.499", vat: { category: "S", percentage: "21.00" } },
                    { name: "Item 2", quantity: "2.666", unitCode: "C62", netPriceAmount: "3.333", vat: { category: "S", percentage: "21.00" } },
                    
                    // Reduced rate 6% - with rounding potential
                    { name: "Item 3", quantity: "4.111", unitCode: "C62", netPriceAmount: "2.222", vat: { category: "S", percentage: "6.00" } },
                    { name: "Item 4", quantity: "8.777", unitCode: "C62", netPriceAmount: "1.111", vat: { category: "S", percentage: "6.00" } },
                    
                    // Zero rate - no VAT
                    { name: "Item 5", quantity: "3.333", unitCode: "C62", netPriceAmount: "5.555", vat: { category: "Z", percentage: "0.00" } },
                    
                    // High rate 25% - with rounding potential
                    { name: "Item 6", quantity: "1.111", unitCode: "C62", netPriceAmount: "9.999", vat: { category: "S", percentage: "25.00" } },
                    
                    // Another 21% rate with different rounding
                    { name: "Item 7", quantity: "6.666", unitCode: "C62", netPriceAmount: "1.501", vat: { category: "S", percentage: "21.00" } },
                ],
                discounts: [
                    // Discount on 21% VAT items
                    { amount: "2.22", reason: "Early payment discount", vat: { category: "S", percentage: "21.00" } },
                    // Discount on 6% VAT items
                    { amount: "1.11", reason: "Volume discount", vat: { category: "S", percentage: "6.00" } },
                ],
                surcharges: [
                    // Surcharge on 21% VAT items
                    { amount: "3.33", reason: "Handling fee", vat: { category: "S", percentage: "21.00" } },
                    // Surcharge on 6% VAT items
                    { amount: "0.55", reason: "Processing fee", vat: { category: "S", percentage: "6.00" } },
                ],
            });

            const result = calculateTotals(invoice);
            const vat = calculateVat({document: invoice, isDocumentValidationEnforced: false});

            // Calculate expected line totals manually
            const line1Net = new Decimal("1.333").mul("7.499").toNearest(0.01);
            const line2Net = new Decimal("2.666").mul("3.333").toNearest(0.01);
            const line3Net = new Decimal("4.111").mul("2.222").toNearest(0.01);
            const line4Net = new Decimal("8.777").mul("1.111").toNearest(0.01);
            const line5Net = new Decimal("3.333").mul("5.555").toNearest(0.01);
            const line6Net = new Decimal("1.111").mul("9.999").toNearest(0.01);
            const line7Net = new Decimal("6.666").mul("1.501").toNearest(0.01);

            const totalLineNet = line1Net.plus(line2Net).plus(line3Net).plus(line4Net).plus(line5Net).plus(line6Net).plus(line7Net).toNearest(0.01);
            
            // Calculate discount and surcharge totals
            const discountTotal = new Decimal("2.22").plus("1.11").toNearest(0.01);
            const surchargeTotal = new Decimal("3.33").plus("0.55").toNearest(0.01);
            
            const expectedTaxExclusive = totalLineNet.minus(discountTotal).plus(surchargeTotal).toNearest(0.01);

            // Validate main totals
            expect(result.taxExclusiveAmount).toBe(expectedTaxExclusive.toFixed(2));
            expect(result.discountAmount).toBe(discountTotal.toFixed(2));
            expect(result.surchargeAmount).toBe(surchargeTotal.toFixed(2));

            // Validate tax inclusive amount
            const taxExclusive = new Decimal(result.taxExclusiveAmount);
            const totalVat = new Decimal(vat.totalVatAmount);
            const expectedTaxInclusive = taxExclusive.plus(totalVat).toNearest(0.01);
            expect(result.taxInclusiveAmount).toBe(expectedTaxInclusive.toFixed(2));

            // Validate VAT subtotals by category
            const vatSubtotals = vat.subtotals;
            
            // Find subtotals by category
            const subtotal21 = vatSubtotals.find(s => s.category === "S" && s.percentage === "21.00");
            const subtotal6 = vatSubtotals.find(s => s.category === "S" && s.percentage === "6.00");
            const subtotal25 = vatSubtotals.find(s => s.category === "S" && s.percentage === "25.00");
            const subtotal0 = vatSubtotals.find(s => s.category === "Z" && s.percentage === "0.00");

            // Validate 21% VAT subtotal
            expect(subtotal21).toBeDefined();
            if (subtotal21) {
                // Calculate expected 21% taxable amount (lines 1, 2, 7 + surcharge - discount)
                const expected21Taxable = line1Net.plus(line2Net).plus(line7Net).plus("3.33").minus("2.22").toNearest(0.01);
                expect(subtotal21.taxableAmount).toBe(expected21Taxable.toFixed(2));
                
                // Calculate expected 21% VAT amount
                const expected21Vat = expected21Taxable.mul("21.00").div(100).toNearest(0.01);
                expect(subtotal21.vatAmount).toBe(expected21Vat.toFixed(2));
            }

            // Validate 6% VAT subtotal
            expect(subtotal6).toBeDefined();
            if (subtotal6) {
                // Calculate expected 6% taxable amount (lines 3, 4 + surcharge - discount)
                const expected6Taxable = line3Net.plus(line4Net).plus("0.55").minus("1.11").toNearest(0.01);
                expect(subtotal6.taxableAmount).toBe(expected6Taxable.toFixed(2));
                
                // Calculate expected 6% VAT amount
                const expected6Vat = expected6Taxable.mul("6.00").div(100).toNearest(0.01);
                expect(subtotal6.vatAmount).toBe(expected6Vat.toFixed(2));
            }

            // Validate 25% VAT subtotal
            expect(subtotal25).toBeDefined();
            if (subtotal25) {
                // Calculate expected 25% taxable amount (line 6 only)
                const expected25Taxable = line6Net.toNearest(0.01);
                expect(subtotal25.taxableAmount).toBe(expected25Taxable.toFixed(2));
                
                // Calculate expected 25% VAT amount
                const expected25Vat = expected25Taxable.mul("25.00").div(100).toNearest(0.01);
                expect(subtotal25.vatAmount).toBe(expected25Vat.toFixed(2));
            }

            // Validate 0% VAT subtotal
            expect(subtotal0).toBeDefined();
            if (subtotal0) {
                // Calculate expected 0% taxable amount (line 5 only)
                const expected0Taxable = line5Net.toNearest(0.01);
                expect(subtotal0.taxableAmount).toBe(expected0Taxable.toFixed(2));
                expect(subtotal0.vatAmount).toBe("0.00");
            }

            // Validate total VAT amount equals sum of all subtotals
            const calculatedTotalVat = vatSubtotals.reduce(
                (sum, subtotal) => sum.plus(new Decimal(subtotal.vatAmount)),
                new Decimal(0)
            );
            expect(vat.totalVatAmount).toBe(calculatedTotalVat.toFixed(2));

            // Validate that taxable amounts sum to tax exclusive amount
            const calculatedTaxableTotal = vatSubtotals.reduce(
                (sum, subtotal) => sum.plus(new Decimal(subtotal.taxableAmount)),
                new Decimal(0)
            );
            expect(calculatedTaxableTotal.toFixed(2)).toBe(result.taxExclusiveAmount);

            // Validate BR-CO-15: taxInclusiveAmount = taxExclusiveAmount + totalVat
            const brCo15Validation = new Decimal(result.taxExclusiveAmount).plus(new Decimal(vat.totalVatAmount));
            expect(result.taxInclusiveAmount).toBe(brCo15Validation.toFixed(2));
        });

        it("should handle complex rounding scenarios with multiple VAT rates and edge cases", () => {
            const invoice = createInvoice({
                lines: [
                    // Very small amounts that can cause rounding issues
                    { name: "Micro item 1", quantity: "0.001", unitCode: "C62", netPriceAmount: "0.001", vat: { category: "S", percentage: "21.00" } },
                    { name: "Micro item 2", quantity: "0.002", unitCode: "C62", netPriceAmount: "0.002", vat: { category: "S", percentage: "6.00" } },
                    
                    // Amounts that round to same value but have different VAT
                    { name: "Rounding test 1", quantity: "1.001", unitCode: "C62", netPriceAmount: "1.001", vat: { category: "S", percentage: "21.00" } },
                    { name: "Rounding test 2", quantity: "1.002", unitCode: "C62", netPriceAmount: "1.002", vat: { category: "S", percentage: "6.00" } },
                    
                    // Large quantities with small unit prices
                    { name: "Bulk item", quantity: "1000.001", unitCode: "C62", netPriceAmount: "0.001", vat: { category: "S", percentage: "21.00" } },
                    
                    // Zero VAT item
                    { name: "Zero VAT item", quantity: "1.111", unitCode: "C62", netPriceAmount: "2.222", vat: { category: "Z", percentage: "0.00" } },
                ],
                discounts: [
                    { amount: "0.001", reason: "Micro discount", vat: { category: "S", percentage: "21.00" } },
                ],
                surcharges: [
                    { amount: "0.002", reason: "Micro surcharge", vat: { category: "S", percentage: "6.00" } },
                ],
            });

            const result = calculateTotals(invoice);
            const vat = calculateVat({document: invoice, isDocumentValidationEnforced: false});

            // Validate that all amounts are properly rounded to 2 decimal places
            expect(result.taxExclusiveAmount).toMatch(/^\d+\.\d{2}$/);
            expect(result.taxInclusiveAmount).toMatch(/^\d+\.\d{2}$/);
            expect(vat.totalVatAmount).toMatch(/^\d+\.\d{2}$/);

            // Validate VAT subtotals
            const vatSubtotals = vat.subtotals;
            vatSubtotals.forEach(subtotal => {
                expect(subtotal.taxableAmount).toMatch(/^\d+\.\d{2}$/);
                expect(subtotal.vatAmount).toMatch(/^\d+\.\d{2}$/);
            });

            // Validate that total VAT calculation is correct
            const calculatedTotalVat = vatSubtotals.reduce(
                (sum, subtotal) => sum.plus(new Decimal(subtotal.vatAmount)),
                new Decimal(0)
            );
            expect(vat.totalVatAmount).toBe(calculatedTotalVat.toFixed(2));

            // Validate BR-CO-15
            const brCo15Validation = new Decimal(result.taxExclusiveAmount).plus(new Decimal(vat.totalVatAmount));
            expect(result.taxInclusiveAmount).toBe(brCo15Validation.toFixed(2));
        });
    });

    describe("BR-CO-10 validation: Sum of Invoice line net amount (BT-106) = Σ Invoice line net amount (BT-131)", () => {
        it("should validate that sum of line net amounts equals total line net amount", () => {
            const invoice = createInvoice({
                lines: [
                    { name: "Item 1", quantity: "2", unitCode: "C62", netPriceAmount: "50.00", vat: { category: "S", percentage: "21.00" } },
                    { name: "Item 2", quantity: "3", unitCode: "C62", netPriceAmount: "25.00", vat: { category: "S", percentage: "21.00" } },
                    { name: "Item 3", quantity: "1", unitCode: "C62", netPriceAmount: "100.00", vat: { category: "S", percentage: "21.00" } },
                ],
            });

            const result = calculateTotals(invoice);

            // Calculate expected sum of line net amounts
            const line1Net = new Decimal("2").mul("50.00").toNearest(0.01);
            const line2Net = new Decimal("3").mul("25.00").toNearest(0.01);
            const line3Net = new Decimal("1").mul("100.00").toNearest(0.01);
            const expectedLineNetSum = line1Net.plus(line2Net).plus(line3Net).toNearest(0.01);

            // BR-CO-10: Sum of Invoice line net amount should equal sum of individual line net amounts
            expect(result.taxExclusiveAmount).toBe(expectedLineNetSum.toFixed(2));
        });

        it("should validate BR-CO-10 with rounding edge cases", () => {
            const invoice = createInvoice({
                lines: [
                    { name: "Item 1", quantity: "1.333", unitCode: "C62", netPriceAmount: "7.499", vat: { category: "S", percentage: "21.00" } },
                    { name: "Item 2", quantity: "2.666", unitCode: "C62", netPriceAmount: "3.333", vat: { category: "S", percentage: "21.00" } },
                    { name: "Item 3", quantity: "4.111", unitCode: "C62", netPriceAmount: "2.222", vat: { category: "S", percentage: "21.00" } },
                ],
            });

            const result = calculateTotals(invoice);

            // Calculate expected sum of line net amounts with proper rounding
            const line1Net = new Decimal("1.333").mul("7.499").toNearest(0.01);
            const line2Net = new Decimal("2.666").mul("3.333").toNearest(0.01);
            const line3Net = new Decimal("4.111").mul("2.222").toNearest(0.01);
            const expectedLineNetSum = line1Net.plus(line2Net).plus(line3Net).toNearest(0.01);

            // BR-CO-10: Sum of Invoice line net amount should equal sum of individual line net amounts
            expect(result.taxExclusiveAmount).toBe(expectedLineNetSum.toFixed(2));
        });

        it("should validate BR-CO-10 with multiple VAT rates", () => {
            const invoice = createInvoice({
                lines: [
                    { name: "Item 1", quantity: "2", unitCode: "C62", netPriceAmount: "50.00", vat: { category: "S", percentage: "21.00" } },
                    { name: "Item 2", quantity: "3", unitCode: "C62", netPriceAmount: "25.00", vat: { category: "S", percentage: "6.00" } },
                    { name: "Item 3", quantity: "1", unitCode: "C62", netPriceAmount: "100.00", vat: { category: "Z", percentage: "0.00" } },
                ],
            });

            const result = calculateTotals(invoice);

            // Calculate expected sum of line net amounts
            const line1Net = new Decimal("2").mul("50.00").toNearest(0.01);
            const line2Net = new Decimal("3").mul("25.00").toNearest(0.01);
            const line3Net = new Decimal("1").mul("100.00").toNearest(0.01);
            const expectedLineNetSum = line1Net.plus(line2Net).plus(line3Net).toNearest(0.01);

            // BR-CO-10: Sum of Invoice line net amount should equal sum of individual line net amounts
            expect(result.taxExclusiveAmount).toBe(expectedLineNetSum.toFixed(2));
        });
    });

    describe("BR-CO-13 validation: Invoice total amount without VAT (BT-109) = Σ Invoice line net amount (BT-131) - Sum of allowances on document level (BT-107) + Sum of charges on document level (BT-108)", () => {
        it("should validate BR-CO-13 with discounts and surcharges", () => {
            const invoice = createInvoice({
                lines: [
                    { name: "Item 1", quantity: "2", unitCode: "C62", netPriceAmount: "50.00", vat: { category: "S", percentage: "21.00" } },
                    { name: "Item 2", quantity: "3", unitCode: "C62", netPriceAmount: "25.00", vat: { category: "S", percentage: "21.00" } },
                ],
                discounts: [
                    { amount: "10.00", reason: "Early payment discount", vat: { category: "S", percentage: "21.00" } },
                ],
                surcharges: [
                    { amount: "5.00", reason: "Handling fee", vat: { category: "S", percentage: "21.00" } },
                ],
            });

            const result = calculateTotals(invoice);

            // Calculate expected values according to BR-CO-13 formula
            const line1Net = new Decimal("2").mul("50.00").toNearest(0.01);
            const line2Net = new Decimal("3").mul("25.00").toNearest(0.01);
            const lineNetSum = line1Net.plus(line2Net).toNearest(0.01);
            const discountTotal = new Decimal("10.00");
            const surchargeTotal = new Decimal("5.00");
            
            // BR-CO-13: taxExclusiveAmount = lineNetSum - discounts + surcharges
            const expectedTaxExclusive = lineNetSum.minus(discountTotal).plus(surchargeTotal).toNearest(0.01);

            expect(result.taxExclusiveAmount).toBe(expectedTaxExclusive.toFixed(2));
            expect(result.discountAmount).toBe("10.00");
            expect(result.surchargeAmount).toBe("5.00");
        });

        it("should validate BR-CO-13 with multiple discounts and surcharges", () => {
            const invoice = createInvoice({
                lines: [
                    { name: "Item 1", quantity: "1", unitCode: "C62", netPriceAmount: "100.00", vat: { category: "S", percentage: "21.00" } },
                ],
                discounts: [
                    { amount: "5.00", reason: "Volume discount", vat: { category: "S", percentage: "21.00" } },
                    { amount: "3.00", reason: "Early payment", vat: { category: "S", percentage: "21.00" } },
                ],
                surcharges: [
                    { amount: "2.00", reason: "Handling fee", vat: { category: "S", percentage: "21.00" } },
                    { amount: "1.50", reason: "Processing fee", vat: { category: "S", percentage: "21.00" } },
                ],
            });

            const result = calculateTotals(invoice);

            // Calculate expected values according to BR-CO-13 formula
            const lineNetSum = new Decimal("100.00");
            const totalDiscounts = new Decimal("5.00").plus("3.00").toNearest(0.01);
            const totalSurcharges = new Decimal("2.00").plus("1.50").toNearest(0.01);
            
            // BR-CO-13: taxExclusiveAmount = lineNetSum - discounts + surcharges
            const expectedTaxExclusive = lineNetSum.minus(totalDiscounts).plus(totalSurcharges).toNearest(0.01);

            expect(result.taxExclusiveAmount).toBe(expectedTaxExclusive.toFixed(2));
            expect(result.discountAmount).toBe(totalDiscounts.toFixed(2));
            expect(result.surchargeAmount).toBe(totalSurcharges.toFixed(2));
        });

        it("should validate BR-CO-13 with only discounts (no surcharges)", () => {
            const invoice = createInvoice({
                lines: [
                    { name: "Item 1", quantity: "2", unitCode: "C62", netPriceAmount: "50.00", vat: { category: "S", percentage: "21.00" } },
                ],
                discounts: [
                    { amount: "10.00", reason: "Early payment discount", vat: { category: "S", percentage: "21.00" } },
                ],
            });

            const result = calculateTotals(invoice);

            // Calculate expected values according to BR-CO-13 formula
            const lineNetSum = new Decimal("2").mul("50.00").toNearest(0.01);
            const discountTotal = new Decimal("10.00");
            
            // BR-CO-13: taxExclusiveAmount = lineNetSum - discounts + surcharges (0)
            const expectedTaxExclusive = lineNetSum.minus(discountTotal).toNearest(0.01);

            expect(result.taxExclusiveAmount).toBe(expectedTaxExclusive.toFixed(2));
            expect(result.discountAmount).toBe("10.00");
            expect(result.surchargeAmount).toBeNull();
        });

        it("should validate BR-CO-13 with only surcharges (no discounts)", () => {
            const invoice = createInvoice({
                lines: [
                    { name: "Item 1", quantity: "2", unitCode: "C62", netPriceAmount: "50.00", vat: { category: "S", percentage: "21.00" } },
                ],
                surcharges: [
                    { amount: "5.00", reason: "Handling fee", vat: { category: "S", percentage: "21.00" } },
                ],
            });

            const result = calculateTotals(invoice);

            // Calculate expected values according to BR-CO-13 formula
            const lineNetSum = new Decimal("2").mul("50.00").toNearest(0.01);
            const surchargeTotal = new Decimal("5.00");
            
            // BR-CO-13: taxExclusiveAmount = lineNetSum - discounts (0) + surcharges
            const expectedTaxExclusive = lineNetSum.plus(surchargeTotal).toNearest(0.01);

            expect(result.taxExclusiveAmount).toBe(expectedTaxExclusive.toFixed(2));
            expect(result.discountAmount).toBeNull();
            expect(result.surchargeAmount).toBe("5.00");
        });

        it("should validate BR-CO-13 with no discounts or surcharges", () => {
            const invoice = createInvoice({
                lines: [
                    { name: "Item 1", quantity: "2", unitCode: "C62", netPriceAmount: "50.00", vat: { category: "S", percentage: "21.00" } },
                    { name: "Item 2", quantity: "3", unitCode: "C62", netPriceAmount: "25.00", vat: { category: "S", percentage: "21.00" } },
                ],
            });

            const result = calculateTotals(invoice);

            // Calculate expected values according to BR-CO-13 formula
            const line1Net = new Decimal("2").mul("50.00").toNearest(0.01);
            const line2Net = new Decimal("3").mul("25.00").toNearest(0.01);
            const lineNetSum = line1Net.plus(line2Net).toNearest(0.01);
            
            // BR-CO-13: taxExclusiveAmount = lineNetSum - discounts (0) + surcharges (0)
            const expectedTaxExclusive = lineNetSum.toNearest(0.01);

            expect(result.taxExclusiveAmount).toBe(expectedTaxExclusive.toFixed(2));
            expect(result.discountAmount).toBeNull();
            expect(result.surchargeAmount).toBeNull();
        });

        it("should validate BR-CO-13 with rounding edge cases", () => {
            const invoice = createInvoice({
                lines: [
                    { name: "Item 1", quantity: "1.333", unitCode: "C62", netPriceAmount: "7.499", vat: { category: "S", percentage: "21.00" } },
                    { name: "Item 2", quantity: "2.666", unitCode: "C62", netPriceAmount: "3.333", vat: { category: "S", percentage: "21.00" } },
                ],
                discounts: [
                    { amount: "2.22", reason: "Early payment discount", vat: { category: "S", percentage: "21.00" } },
                ],
                surcharges: [
                    { amount: "1.11", reason: "Handling fee", vat: { category: "S", percentage: "21.00" } },
                ],
            });

            const result = calculateTotals(invoice);

            // Calculate expected values according to BR-CO-13 formula with proper rounding
            const line1Net = new Decimal("1.333").mul("7.499").toNearest(0.01);
            const line2Net = new Decimal("2.666").mul("3.333").toNearest(0.01);
            const lineNetSum = line1Net.plus(line2Net).toNearest(0.01);
            const discountTotal = new Decimal("2.22");
            const surchargeTotal = new Decimal("1.11");
            
            // BR-CO-13: taxExclusiveAmount = lineNetSum - discounts + surcharges
            const expectedTaxExclusive = lineNetSum.minus(discountTotal).plus(surchargeTotal).toNearest(0.01);

            expect(result.taxExclusiveAmount).toBe(expectedTaxExclusive.toFixed(2));
            expect(result.discountAmount).toBe("2.22");
            expect(result.surchargeAmount).toBe("1.11");
        });

        it("should validate BR-CO-13 with different VAT rates for discounts and surcharges", () => {
            const invoice = createInvoice({
                lines: [
                    { name: "Item 1", quantity: "2", unitCode: "C62", netPriceAmount: "50.00", vat: { category: "S", percentage: "21.00" } },
                    { name: "Item 2", quantity: "3", unitCode: "C62", netPriceAmount: "25.00", vat: { category: "S", percentage: "6.00" } },
                ],
                discounts: [
                    { amount: "5.00", reason: "Discount on 21% items", vat: { category: "S", percentage: "21.00" } },
                    { amount: "3.00", reason: "Discount on 6% items", vat: { category: "S", percentage: "6.00" } },
                ],
                surcharges: [
                    { amount: "2.00", reason: "Surcharge on 21% items", vat: { category: "S", percentage: "21.00" } },
                    { amount: "1.00", reason: "Surcharge on 6% items", vat: { category: "S", percentage: "6.00" } },
                ],
            });

            const result = calculateTotals(invoice);

            // Calculate expected values according to BR-CO-13 formula
            const line1Net = new Decimal("2").mul("50.00").toNearest(0.01);
            const line2Net = new Decimal("3").mul("25.00").toNearest(0.01);
            const lineNetSum = line1Net.plus(line2Net).toNearest(0.01);
            const totalDiscounts = new Decimal("5.00").plus("3.00").toNearest(0.01);
            const totalSurcharges = new Decimal("2.00").plus("1.00").toNearest(0.01);
            
            // BR-CO-13: taxExclusiveAmount = lineNetSum - discounts + surcharges
            const expectedTaxExclusive = lineNetSum.minus(totalDiscounts).plus(totalSurcharges).toNearest(0.01);

            expect(result.taxExclusiveAmount).toBe(expectedTaxExclusive.toFixed(2));
            expect(result.discountAmount).toBe(totalDiscounts.toFixed(2));
            expect(result.surchargeAmount).toBe(totalSurcharges.toFixed(2));
        });
    });

    describe("multiple identical lines", () => {
        it("should handle 45 lines of 1 x 9.9174 with 21% VAT each", () => {
            const invoice = createInvoice({
                lines: Array.from({ length: 45 }, (_, i) => ({
                    name: `Item ${i + 1}`,
                    quantity: "1",
                    unitCode: "C62",
                    netPriceAmount: "9.9174",
                    vat: { category: "S", percentage: "21.00" },
                })),
            });

            const result = calculateTotals(invoice);
            const vat = calculateVat({document: invoice, isDocumentValidationEnforced: false});

            const lineNet = new Decimal("1").mul("9.9174").toNearest(0.01);
            const expectedTaxExclusive = lineNet.mul(45).toNearest(0.01);
            const expectedVat = expectedTaxExclusive.mul("21.00").div(100).toNearest(0.01);
            const expectedTaxInclusive = expectedTaxExclusive.plus(expectedVat).toNearest(0.01);

            expect(result.taxExclusiveAmount).toBe(expectedTaxExclusive.toFixed(2));
            expect(result.taxInclusiveAmount).toBe(expectedTaxInclusive.toFixed(2));
            expect(vat.totalVatAmount).toBe(expectedVat.toFixed(2));

            const taxExclusive = new Decimal(result.taxExclusiveAmount);
            const totalVat = new Decimal(vat.totalVatAmount);
            const calculatedTaxInclusive = taxExclusive.plus(totalVat).toNearest(0.01);
            expect(result.taxInclusiveAmount).toBe(calculatedTaxInclusive.toFixed(2));

            expect(result.taxExclusiveAmount).toBe("446.40");
            expect(result.taxInclusiveAmount).toBe("540.14");
            expect(vat.totalVatAmount).toBe("93.74");
        });

        it("should handle one invoice line: 1 x 173.69 with 21% VAT", () => {
            const invoice = createInvoice({
                lines: [
                    { name: "Item", quantity: "1", unitCode: "C62", netPriceAmount: "173.69", vat: { category: "S", percentage: "21.00" } },
                ],
            });

            const result = calculateTotals(invoice);
            const vat = calculateVat({document: invoice, isDocumentValidationEnforced: false});

            const lineNet = new Decimal("1").mul("173.69").toNearest(0.01);
            const expectedVat = lineNet.mul("21.00").div(100).toNearest(0.01);
            const expectedTaxInclusive = lineNet.plus(expectedVat).toNearest(0.01);

            expect(result.taxExclusiveAmount).toBe(lineNet.toFixed(2));
            expect(result.taxInclusiveAmount).toBe(expectedTaxInclusive.toFixed(2));
            expect(vat.totalVatAmount).toBe(expectedVat.toFixed(2));

            const taxExclusive = new Decimal(result.taxExclusiveAmount);
            const totalVat = new Decimal(vat.totalVatAmount);
            const calculatedTaxInclusive = taxExclusive.plus(totalVat).toNearest(0.01);
            expect(result.taxInclusiveAmount).toBe(calculatedTaxInclusive.toFixed(2));
            expect(result.taxExclusiveAmount).toBe("173.69");
            expect(result.taxInclusiveAmount).toBe("210.16");
            expect(vat.totalVatAmount).toBe("36.47");
        });
    });

    describe("line-level discounts and surcharges", () => {
        it("should handle invoice with 2 lines, same VAT, different prices/quantities, 2 discounts on line 1, 1 surcharge on line 2", () => {
            const invoice = createInvoice({
                lines: [
                    {
                        name: "Item 1",
                        quantity: "3.5",
                        unitCode: "C62",
                        netPriceAmount: "50.00",
                        vat: { category: "S", percentage: "21.00" },
                        discounts: [
                            { amount: "10.00", reason: "Early payment discount" },
                            { amount: "5.00", reason: "Volume discount" },
                        ],
                    },
                    {
                        name: "Item 2",
                        quantity: "2.25",
                        unitCode: "C62",
                        netPriceAmount: "75.50",
                        vat: { category: "S", percentage: "21.00" },
                        surcharges: [
                            { amount: "8.50", reason: "Handling fee" },
                        ],
                    },
                ],
            });

            const result = calculateTotals(invoice);
            const vat = calculateVat({document: invoice, isDocumentValidationEnforced: false});

            const line1Base = new Decimal("3.5").mul("50.00").toNearest(0.01);
            const line1Discounts = new Decimal("10.00").plus("5.00").toNearest(0.01);
            const line1Net = line1Base.minus(line1Discounts).toNearest(0.01);

            const line2Base = new Decimal("2.25").mul("75.50").toNearest(0.01);
            const line2Surcharges = new Decimal("8.50");
            const line2Net = line2Base.plus(line2Surcharges).toNearest(0.01);

            const expectedTaxExclusive = line1Net.plus(line2Net).toNearest(0.01);
            const expectedVat = expectedTaxExclusive.mul("21.00").div(100).toNearest(0.01);
            const expectedTaxInclusive = expectedTaxExclusive.plus(expectedVat).toNearest(0.01);

            expect(result.taxExclusiveAmount).toBe(expectedTaxExclusive.toFixed(2));
            expect(result.taxInclusiveAmount).toBe(expectedTaxInclusive.toFixed(2));
            expect(vat.totalVatAmount).toBe(expectedVat.toFixed(2));

            const taxExclusive = new Decimal(result.taxExclusiveAmount);
            const totalVat = new Decimal(vat.totalVatAmount);
            const calculatedTaxInclusive = taxExclusive.plus(totalVat).toNearest(0.01);
            expect(result.taxInclusiveAmount).toBe(calculatedTaxInclusive.toFixed(2));
            expect(result.taxInclusiveAmount).toBe("409.44");
        });

        it("should handle invoice with 3 lines, same VAT, different prices/quantities, discount on line 1, 2 surcharges on line 2, nothing on line 3", () => {
            const invoice = createInvoice({
                lines: [
                    {
                        name: "Item 1",
                        quantity: "4",
                        unitCode: "C62",
                        netPriceAmount: "25.75",
                        vat: { category: "S", percentage: "21.00" },
                        discounts: [
                            { amount: "12.00", reason: "Promotional discount" },
                        ],
                    },
                    {
                        name: "Item 2",
                        quantity: "1.5",
                        unitCode: "C62",
                        netPriceAmount: "100.00",
                        vat: { category: "S", percentage: "21.00" },
                        surcharges: [
                            { amount: "5.25", reason: "Shipping fee" },
                            { amount: "3.75", reason: "Processing fee" },
                        ],
                    },
                    {
                        name: "Item 3",
                        quantity: "2",
                        unitCode: "C62",
                        netPriceAmount: "60.00",
                        vat: { category: "S", percentage: "21.00" },
                    },
                ],
            });

            const result = calculateTotals(invoice);
            const vat = calculateVat({document: invoice, isDocumentValidationEnforced: false});

            const line1Base = new Decimal("4").mul("25.75").toNearest(0.01);
            const line1Net = line1Base.minus("12.00").toNearest(0.01);

            const line2Base = new Decimal("1.5").mul("100.00").toNearest(0.01);
            const line2Surcharges = new Decimal("5.25").plus("3.75").toNearest(0.01);
            const line2Net = line2Base.plus(line2Surcharges).toNearest(0.01);

            const line3Net = new Decimal("2").mul("60.00").toNearest(0.01);

            const expectedTaxExclusive = line1Net.plus(line2Net).plus(line3Net).toNearest(0.01);
            const expectedVat = expectedTaxExclusive.mul("21.00").div(100).toNearest(0.01);
            const expectedTaxInclusive = expectedTaxExclusive.plus(expectedVat).toNearest(0.01);

            expect(result.taxExclusiveAmount).toBe(expectedTaxExclusive.toFixed(2));
            expect(result.taxInclusiveAmount).toBe(expectedTaxInclusive.toFixed(2));
            expect(vat.totalVatAmount).toBe(expectedVat.toFixed(2));

            const taxExclusive = new Decimal(result.taxExclusiveAmount);
            const totalVat = new Decimal(vat.totalVatAmount);
            const calculatedTaxInclusive = taxExclusive.plus(totalVat).toNearest(0.01);
            expect(result.taxInclusiveAmount).toBe(calculatedTaxInclusive.toFixed(2));
            expect(result.taxInclusiveAmount).toBe("447.70");
        });

        it("should handle invoice with 3 lines, different VAT percentages, different prices/quantities, different discounts and surcharges on each line", () => {
            const invoice = createInvoice({
                lines: [
                    {
                        name: "Item 1 - Standard rate",
                        quantity: "2.5",
                        unitCode: "C62",
                        netPriceAmount: "80.00",
                        vat: { category: "S", percentage: "21.00" },
                        discounts: [
                            { amount: "15.00", reason: "Early payment" },
                        ],
                        surcharges: [
                            { amount: "5.00", reason: "Express handling" },
                        ],
                    },
                    {
                        name: "Item 2 - Reduced rate",
                        quantity: "3",
                        unitCode: "C62",
                        netPriceAmount: "45.33",
                        vat: { category: "S", percentage: "6.00" },
                        discounts: [
                            { amount: "8.50", reason: "Volume discount" },
                            { amount: "2.25", reason: "Loyalty discount" },
                        ],
                        surcharges: [
                            { amount: "1.75", reason: "Special packaging" },
                        ],
                    },
                    {
                        name: "Item 3 - Zero rate",
                        quantity: "1.75",
                        unitCode: "C62",
                        netPriceAmount: "120.00",
                        vat: { category: "Z", percentage: "0.00" },
                        discounts: [
                            { amount: "10.00", reason: "Bulk discount" },
                        ],
                        surcharges: [
                            { amount: "3.50", reason: "Custom handling" },
                            { amount: "2.25", reason: "Insurance" },
                        ],
                    },
                ],
            });

            const result = calculateTotals(invoice);
            const vat = calculateVat({document: invoice, isDocumentValidationEnforced: false});

            const line1Base = new Decimal("2.5").mul("80.00").toNearest(0.01);
            const line1Net = line1Base.minus("15.00").plus("5.00").toNearest(0.01);

            const line2Base = new Decimal("3").mul("45.33").toNearest(0.01);
            const line2Discounts = new Decimal("8.50").plus("2.25").toNearest(0.01);
            const line2Net = line2Base.minus(line2Discounts).plus("1.75").toNearest(0.01);

            const line3Base = new Decimal("1.75").mul("120.00").toNearest(0.01);
            const line3Surcharges = new Decimal("3.50").plus("2.25").toNearest(0.01);
            const line3Net = line3Base.minus("10.00").plus(line3Surcharges).toNearest(0.01);

            const expectedTaxExclusive = line1Net.plus(line2Net).plus(line3Net).toNearest(0.01);

            expect(result.taxExclusiveAmount).toBe(expectedTaxExclusive.toFixed(2));

            const vatSubtotals = vat.subtotals;
            const subtotal21 = vatSubtotals.find(s => s.category === "S" && s.percentage === "21.00");
            const subtotal6 = vatSubtotals.find(s => s.category === "S" && s.percentage === "6.00");
            const subtotal0 = vatSubtotals.find(s => s.category === "Z" && s.percentage === "0.00");

            expect(subtotal21).toBeDefined();
            if (subtotal21) {
                expect(subtotal21.taxableAmount).toBe(line1Net.toFixed(2));
                const expected21Vat = line1Net.mul("21.00").div(100).toNearest(0.01);
                expect(subtotal21.vatAmount).toBe(expected21Vat.toFixed(2));
            }

            expect(subtotal6).toBeDefined();
            if (subtotal6) {
                expect(subtotal6.taxableAmount).toBe(line2Net.toFixed(2));
                const expected6Vat = line2Net.mul("6.00").div(100).toNearest(0.01);
                expect(subtotal6.vatAmount).toBe(expected6Vat.toFixed(2));
            }

            expect(subtotal0).toBeDefined();
            if (subtotal0) {
                expect(subtotal0.taxableAmount).toBe(line3Net.toFixed(2));
                expect(subtotal0.vatAmount).toBe("0.00");
            }

            const calculatedTotalVat = vatSubtotals.reduce(
                (sum, subtotal) => sum.plus(new Decimal(subtotal.vatAmount)),
                new Decimal(0)
            );
            expect(vat.totalVatAmount).toBe(calculatedTotalVat.toFixed(2));

            const taxExclusive = new Decimal(result.taxExclusiveAmount);
            const totalVat = new Decimal(vat.totalVatAmount);
            const expectedTaxInclusive = taxExclusive.plus(totalVat).toNearest(0.01);
            expect(result.taxInclusiveAmount).toBe(expectedTaxInclusive.toFixed(2));
            expect(result.taxInclusiveAmount).toBe("570.26");
        });

        it("should handle extreme rounding scenarios with multiple lines, discounts, and surcharges", () => {
            const invoice = createInvoice({
                lines: [
                    {
                        name: "Item 1 - High precision",
                        quantity: "1.333",
                        unitCode: "C62",
                        netPriceAmount: "7.499",
                        vat: { category: "S", percentage: "21.00" },
                        discounts: [
                            { amount: "1.111", reason: "Precision discount 1" },
                            { amount: "0.888", reason: "Precision discount 2" },
                        ],
                        surcharges: [
                            { amount: "0.777", reason: "Precision surcharge" },
                        ],
                    },
                    {
                        name: "Item 2 - More precision",
                        quantity: "2.666",
                        unitCode: "C62",
                        netPriceAmount: "3.333",
                        vat: { category: "S", percentage: "21.00" },
                        discounts: [
                            { amount: "0.444", reason: "Micro discount" },
                        ],
                        surcharges: [
                            { amount: "1.222", reason: "Micro surcharge 1" },
                            { amount: "0.555", reason: "Micro surcharge 2" },
                        ],
                    },
                    {
                        name: "Item 3 - Extreme precision",
                        quantity: "4.111",
                        unitCode: "C62",
                        netPriceAmount: "2.222",
                        vat: { category: "S", percentage: "21.00" },
                        discounts: [
                            { amount: "0.333", reason: "Tiny discount" },
                            { amount: "0.666", reason: "Another tiny discount" },
                            { amount: "0.111", reason: "Minimal discount" },
                        ],
                        surcharges: [
                            { amount: "0.999", reason: "Tiny surcharge" },
                            { amount: "0.123", reason: "Another tiny surcharge" },
                        ],
                    },
                    {
                        name: "Item 4 - Repeating decimals",
                        quantity: "3.333",
                        unitCode: "C62",
                        netPriceAmount: "6.666",
                        vat: { category: "S", percentage: "21.00" },
                        discounts: [
                            { amount: "2.222", reason: "Repeating discount" },
                        ],
                        surcharges: [
                            { amount: "1.111", reason: "Repeating surcharge" },
                            { amount: "0.333", reason: "Another repeating surcharge" },
                        ],
                    },
                ],
            });

            const result = calculateTotals(invoice);
            const vat = calculateVat({document: invoice, isDocumentValidationEnforced: false});

            const line1Base = new Decimal("1.333").mul("7.499").toNearest(0.01);
            const line1Discounts = new Decimal("1.111").plus("0.888").toNearest(0.01);
            const line1Surcharges = new Decimal("0.777");
            const line1Net = line1Base.minus(line1Discounts).plus(line1Surcharges).toNearest(0.01);

            const line2Base = new Decimal("2.666").mul("3.333").toNearest(0.01);
            const line2Discounts = new Decimal("0.444");
            const line2Surcharges = new Decimal("1.222").plus("0.555").toNearest(0.01);
            const line2Net = line2Base.minus(line2Discounts).plus(line2Surcharges).toNearest(0.01);

            const line3Base = new Decimal("4.111").mul("2.222").toNearest(0.01);
            const line3Discounts = new Decimal("0.333").plus("0.666").plus("0.111").toNearest(0.01);
            const line3Surcharges = new Decimal("0.999").plus("0.123").toNearest(0.01);
            const line3Net = line3Base.minus(line3Discounts).plus(line3Surcharges).toNearest(0.01);

            const line4Base = new Decimal("3.333").mul("6.666").toNearest(0.01);
            const line4Discounts = new Decimal("2.222");
            const line4Surcharges = new Decimal("1.111").plus("0.333").toNearest(0.01);
            const line4Net = line4Base.minus(line4Discounts).plus(line4Surcharges).toNearest(0.01);

            const expectedTaxExclusive = line1Net.plus(line2Net).plus(line3Net).plus(line4Net).toNearest(0.01);

            expect(result.taxExclusiveAmount).toBe(expectedTaxExclusive.toFixed(2));

            const expectedVat = expectedTaxExclusive.mul("21.00").div(100).toNearest(0.01);
            const expectedTaxInclusive = expectedTaxExclusive.plus(expectedVat).toNearest(0.01);

            expect(result.taxInclusiveAmount).toBe(expectedTaxInclusive.toFixed(2));
            expect(vat.totalVatAmount).toBe(expectedVat.toFixed(2));

            const taxExclusive = new Decimal(result.taxExclusiveAmount);
            const totalVat = new Decimal(vat.totalVatAmount);
            const calculatedTaxInclusive = taxExclusive.plus(totalVat).toNearest(0.01);
            expect(result.taxInclusiveAmount).toBe(calculatedTaxInclusive.toFixed(2));

            const vatSubtotals = vat.subtotals;
            const subtotal21 = vatSubtotals.find(s => s.category === "S" && s.percentage === "21.00");
            expect(subtotal21).toBeDefined();
            if (subtotal21) {
                const expectedTaxable = expectedTaxExclusive;
                expect(subtotal21.taxableAmount).toBe(expectedTaxable.toFixed(2));
                expect(subtotal21.vatAmount).toBe(expectedVat.toFixed(2));
            }
        });
    });
});
