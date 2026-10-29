import { describe, expect, it } from "vitest";
import { ledgerEntryDetailsSchema } from "./ledger-schema";

const base = {
  entryDate: "2026-10-01",
  amount: 1500,
  paymentMethod: "CASH" as const,
  referenceNo: "",
  particular: "Part payment",
  note: "",
};

describe("ledgerEntryDetailsSchema", () => {
  it("accepts a valid cash correction", () => {
    expect(ledgerEntryDetailsSchema.safeParse(base).success).toBe(true);
  });

  it("rejects a non-positive amount", () => {
    expect(ledgerEntryDetailsSchema.safeParse({ ...base, amount: 0 }).success).toBe(false);
  });

  it("requires a reference number for bank methods", () => {
    const result = ledgerEntryDetailsSchema.safeParse({ ...base, paymentMethod: "UPI" });
    expect(result.success).toBe(false);
  });

  it("does not carry party, direction or status fields through", () => {
    const parsed = ledgerEntryDetailsSchema.parse({
      ...base,
      direction: "DEBIT",
      status: "CLEARED",
      customerId: "x",
    });
    expect(parsed).not.toHaveProperty("direction");
    expect(parsed).not.toHaveProperty("status");
    expect(parsed).not.toHaveProperty("customerId");
  });
});
