import { describe, expect, it } from "vitest";

describe("Vendor Outstanding Calculation Logic", () => {
  it("Scenario 1: Vendor has one unpaid bill", () => {
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

  it("Scenario 2: Vendor has one partially paid bill", () => {
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

  it("Scenario 3: Vendor has multiple payments against one bill", () => {
    const billAmount = 100000;
    const payments = [25000, 35000, 15000];
    const totalPaid = payments.reduce((a, b) => a + b, 0);
    const outstanding = billAmount - totalPaid;

    expect(totalPaid).toBe(75000);
    expect(outstanding).toBe(25000);
  });

  it("Scenario 4: Vendor has multiple outstanding bills", () => {
    const bills = [
      { id: "b1", amount: 40000, paid: 40000 },
      { id: "b2", amount: 60000, paid: 20000 },
      { id: "b3", amount: 30000, paid: 0 },
    ];

    const totalPayable = bills.reduce((sum, b) => sum + b.amount, 0);
    const totalPaid = bills.reduce((sum, b) => sum + b.paid, 0);
    const outstanding = totalPayable - totalPaid;

    expect(totalPayable).toBe(130000);
    expect(totalPaid).toBe(60000);
    expect(outstanding).toBe(70000);
  });

  it("Scenario 5: Vendor has fully paid bills", () => {
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

  it("Scenario 6: Vendor has overdue bills and days overdue calculation", () => {
    const today = new Date("2026-10-02");
    const dueDate = new Date("2026-09-02"); // 30 days overdue
    const billAmount = 50000;
    const paidAmount = 10000;
    const outstanding = billAmount - paidAmount;

    const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    const isOverdue = outstanding > 0 && today > dueDate;

    expect(outstanding).toBe(40000);
    expect(daysOverdue).toBe(30);
    expect(isOverdue).toBe(true);
  });

  it("Scenario 7: Vendor has future-due bills", () => {
    const today = new Date("2026-10-02");
    const dueDate = new Date("2026-10-25"); // 23 days in future
    const billAmount = 50000;
    const paidAmount = 0;
    const outstanding = billAmount - paidAmount;

    const isOverdue = outstanding > 0 && today > dueDate;

    expect(outstanding).toBe(50000);
    expect(isOverdue).toBe(false);
  });

  it("Scenario 8: Vendor has credit/debit adjustments", () => {
    const openingBalance = 10000;
    const billTotal = 50000;
    const creditAdjustments = 5000; // Extra credit owed to vendor
    const debitPayments = 30000; // Payments/debit adjustments made to vendor

    const totalPayable = openingBalance + billTotal + creditAdjustments;
    const totalPaid = debitPayments;
    const outstanding = totalPayable - totalPaid;

    expect(totalPayable).toBe(65000);
    expect(totalPaid).toBe(30000);
    expect(outstanding).toBe(35000);
  });
});
