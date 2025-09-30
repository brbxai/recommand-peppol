import { describe, it, expect } from "bun:test";
import { extractTotals } from "../utils/parsing/invoice/calculations";
import type { Totals } from "../utils/parsing/invoice/schemas";
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
