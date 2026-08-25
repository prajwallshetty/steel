import { describe, expect, it } from "vitest";

describe("Customer Outstanding Calculation Logic", () => {
  it("calculates status as Pending when totalPaid is 0", () => {
    const totalBilled = 100000;
    const totalPaid = 0;
    const outstanding = Math.max(0, totalBilled - totalPaid);

    let paymentStatus: "Pending" | "Partially Paid" | "Paid" = "Pending";
    if (totalPaid >= totalBilled && totalBilled > 0) {
      paymentStatus = "Paid";
    } else if (totalPaid > 0) {
      paymentStatus = "Partially Paid";
    }

    expect(outstanding).toBe(100000);
    expect(paymentStatus).toBe("Pending");
  });

  it("calculates status as Partially Paid when 0 < totalPaid < totalBilled", () => {
    const totalBilled = 100000;
    const totalPaid = 40000;
    const outstanding = Math.max(0, totalBilled - totalPaid);

    let paymentStatus: "Pending" | "Partially Paid" | "Paid" = "Pending";
    if (totalPaid >= totalBilled && totalBilled > 0) {
      paymentStatus = "Paid";
    } else if (totalPaid > 0) {
      paymentStatus = "Partially Paid";
    }

    expect(outstanding).toBe(60000);
    expect(paymentStatus).toBe("Partially Paid");
  });

  it("calculates status as Paid when totalPaid >= totalBilled", () => {
    const totalBilled = 100000;
    const totalPaid = 100000;
    const outstanding = Math.max(0, totalBilled - totalPaid);

    let paymentStatus: "Pending" | "Partially Paid" | "Paid" = "Pending";
    if (totalPaid >= totalBilled && totalBilled > 0) {
      paymentStatus = "Paid";
    } else if (totalPaid > 0) {
      paymentStatus = "Partially Paid";
    }

    expect(outstanding).toBe(0);
    expect(paymentStatus).toBe("Paid");
  });
});
