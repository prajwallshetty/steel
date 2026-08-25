import { describe, expect, it } from "vitest";

describe("Vendor Outstanding Calculation Logic", () => {
  it("calculates vendor status as Pending when no payment is recorded", () => {
    const totalPayable = 50000;
    const totalPaid = 0;
    const outstanding = Math.max(0, totalPayable - totalPaid);

    let paymentStatus: "Pending" | "Partially Paid" | "Paid" = "Pending";
    if (totalPaid >= totalPayable && totalPayable > 0) {
      paymentStatus = "Paid";
    } else if (totalPaid > 0) {
      paymentStatus = "Partially Paid";
    }

    expect(outstanding).toBe(50000);
    expect(paymentStatus).toBe("Pending");
  });

  it("calculates vendor status as Partially Paid after partial payment", () => {
    const totalPayable = 50000;
    const totalPaid = 20000;
    const outstanding = Math.max(0, totalPayable - totalPaid);

    let paymentStatus: "Pending" | "Partially Paid" | "Paid" = "Pending";
    if (totalPaid >= totalPayable && totalPayable > 0) {
      paymentStatus = "Paid";
    } else if (totalPaid > 0) {
      paymentStatus = "Partially Paid";
    }

    expect(outstanding).toBe(30000);
    expect(paymentStatus).toBe("Partially Paid");
  });

  it("calculates vendor status as Paid after full payment", () => {
    const totalPayable = 50000;
    const totalPaid = 50000;
    const outstanding = Math.max(0, totalPayable - totalPaid);

    let paymentStatus: "Pending" | "Partially Paid" | "Paid" = "Pending";
    if (totalPaid >= totalPayable && totalPayable > 0) {
      paymentStatus = "Paid";
    } else if (totalPaid > 0) {
      paymentStatus = "Partially Paid";
    }

    expect(outstanding).toBe(0);
    expect(paymentStatus).toBe("Paid");
  });
});
