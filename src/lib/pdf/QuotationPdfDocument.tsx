"use client";

import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type { CalculatedQuotation, CalculatedRow } from "@/types/quotation";
import type { AppSettings } from "@/types/settings";
import {
  formatMoney,
  formatPercent,
  formatQuantity,
  formatSheetDate,
} from "@/lib/format/number";

const styles = StyleSheet.create({
  page: {
    padding: 36,
    backgroundColor: "#ffffff",
    fontFamily: "Helvetica",
    color: "#27272a", // text-zinc-800
    flexDirection: "column",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1.5,
    borderBottomColor: "#18181b", // border-zinc-900
    paddingBottom: 12,
    marginBottom: 16,
  },
  brandSection: {
    flexDirection: "column",
  },
  companyName: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a", // slate-900
    letterSpacing: -0.5,
  },
  companySub: {
    fontSize: 8.5,
    color: "#6b7280", // text-gray-500
    marginTop: 2,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  docDetails: {
    flexDirection: "column",
    alignItems: "flex-end",
  },
  docTitle: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
  },
  docRef: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: "#3b82f6", // blue-500
    marginTop: 3,
  },
  metaSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
    gap: 16,
  },
  metaCol: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e4e4e7", // zinc-200
    borderRadius: 6,
    padding: 10,
    backgroundColor: "#fafafa",
  },
  metaHeading: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#71717a", // zinc-500
    borderBottomWidth: 1,
    borderBottomColor: "#e4e4e7",
    paddingBottom: 4,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  metaRow: {
    flexDirection: "row",
    marginBottom: 3.5,
    fontSize: 8.5,
    lineHeight: 1.25,
  },
  metaLabel: {
    width: "35%",
    color: "#71717a",
    fontFamily: "Helvetica-Bold",
  },
  metaValue: {
    width: "65%",
    color: "#18181b",
  },
  table: {
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: 16,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#18181b", // zinc-900
    paddingVertical: 7,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e4e4e7",
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  tableRowAlt: {
    backgroundColor: "#fcfcfc",
  },
  th: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
  },
  td: {
    fontSize: 7.5,
    color: "#27272a",
  },
  colSize: { width: "12%", textAlign: "left" },
  colQty: { width: "12%", textAlign: "right" },
  colBasic: { width: "13%", textAlign: "right" },
  colDiff: { width: "15%", textAlign: "right" },
  colDiscount: { width: "12%", textAlign: "right" },
  colGst: { width: "11%", textAlign: "right" },
  colRate: { width: "12%", textAlign: "right" },
  colTotal: { width: "13%", textAlign: "right" },

  bottomSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
    marginTop: 4,
  },
  remarksCol: {
    width: "55%",
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 6,
    padding: 10,
    backgroundColor: "#fafafa",
  },
  remarksTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#71717a",
    borderBottomWidth: 1,
    borderBottomColor: "#e4e4e7",
    paddingBottom: 4,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  remarksText: {
    fontSize: 8,
    color: "#3f3f46",
    lineHeight: 1.35,
  },
  summaryCol: {
    width: "40%",
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 6,
    padding: 10,
    backgroundColor: "#fafafa",
    alignSelf: "flex-start",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
    fontSize: 8.5,
  },
  summaryRowTotal: {
    borderTopWidth: 1,
    borderTopColor: "#e4e4e7",
    paddingTop: 5,
    marginTop: 5,
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 36,
    right: 36,
    borderTopWidth: 1,
    borderTopColor: "#f4f4f5", // zinc-100
    paddingTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 7,
    color: "#a1a1aa", // zinc-400
  },
});

interface QuotationPdfDocumentProps {
  readonly quotation: CalculatedQuotation;
  readonly settings: AppSettings;
}

export function QuotationPdfDocument({
  quotation,
  settings,
}: QuotationPdfDocumentProps) {
  const { header, rows, totals, remarks } = quotation;
  const grouping = settings.display.numberGrouping;
  const money = (value: number) => formatMoney(value, grouping);

  return (
    <Document
      title={`${quotation.reference} — ${header.partyName}`}
      author="LSC Alloys Quotation System"
      subject={`${header.title} quotation for ${header.partyName}`}
      creator="LSC Alloys Quotation System"
    >
      <Page size="A4" style={styles.page}>
        {/* Document Header */}
        <View style={styles.header}>
          <View style={styles.brandSection}>
            <Text style={styles.companyName}>LSC Alloys ERP</Text>
            <Text style={styles.companySub}>Quotation Document</Text>
          </View>
          <View style={styles.docDetails}>
            <Text style={styles.docTitle}>{header.title || "Sales Quotation"}</Text>
            <Text style={styles.docRef}>Ref: {quotation.reference}</Text>
          </View>
        </View>

        {/* Info Metadata Grid */}
        <View style={styles.metaSection}>
          {/* Client Info */}
          <View style={styles.metaCol}>
            <Text style={styles.metaHeading}>Client Details</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Party Name:</Text>
              <Text style={styles.metaValue}>{header.partyName}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Location:</Text>
              <Text style={styles.metaValue}>{header.location}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Payment:</Text>
              <Text style={styles.metaValue}>{header.payment || "—"}</Text>
            </View>
          </View>

          {/* Delivery & Specifications */}
          <View style={styles.metaCol}>
            <Text style={styles.metaHeading}>Statement Info</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Date:</Text>
              <Text style={styles.metaValue}>{formatSheetDate(header.date)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Brand:</Text>
              <Text style={styles.metaValue}>{header.brand || "—"}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Vehicle No:</Text>
              <Text style={styles.metaValue}>{header.vehicleNo || "—"}</Text>
            </View>
          </View>
        </View>

        {/* Line Items Table */}
        <View style={styles.table}>
          {/* Table Header Row */}
          <View style={styles.tableHeader}>
            <Text style={[styles.th, styles.colSize]}>Size</Text>
            <Text style={[styles.th, styles.colQty]}>Qty (MT)</Text>
            <Text style={[styles.th, styles.colBasic]}>Basic Rate</Text>
            <Text style={[styles.th, styles.colDiff]}>Dia Diff+Ldg</Text>
            <Text style={[styles.th, styles.colDiscount]}>
              CD ({formatPercent(settings.pricing.nominalDiscountPercent)})
            </Text>
            <Text style={[styles.th, styles.colGst]}>
              GST ({formatPercent(settings.pricing.gstPercent)})
            </Text>
            <Text style={[styles.th, styles.colRate]}>Net Rate</Text>
            <Text style={[styles.th, styles.colTotal]}>Total Amount</Text>
          </View>

          {/* Body Rows */}
          {rows.map((row, index) => {
            const isAlt = index % 2 === 1;
            const rowStyle = isAlt ? [styles.tableRow, styles.tableRowAlt] : styles.tableRow;
            return (
              <View key={row.id} style={rowStyle}>
                <Text style={[styles.td, styles.colSize, { fontFamily: "Helvetica-Bold" }]}>
                  {row.size}
                </Text>
                <Text style={[styles.td, styles.colQty]}>
                  {formatQuantity(row.quantity)}
                </Text>
                <Text style={[styles.td, styles.colBasic]}>
                  {money(row.basic)}
                </Text>
                <Text style={[styles.td, styles.colDiff]}>
                  {money(row.differencePlusLoading)}
                </Text>
                <Text style={[styles.td, styles.colDiscount]}>
                  {money(row.discountAmount)}
                </Text>
                <Text style={[styles.td, styles.colGst]}>
                  {money(row.gstAmount)}
                </Text>
                <Text style={[styles.td, styles.colRate, { fontFamily: "Helvetica-Bold" }]}>
                  {money(row.rate)}
                </Text>
                <Text style={[styles.td, styles.colTotal, { fontFamily: "Helvetica-Bold" }]}>
                  {money(row.total)}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Bottom Section */}
        <View style={styles.bottomSection}>
          {/* Remarks & Notes */}
          <View style={styles.remarksCol}>
            <Text style={styles.remarksTitle}>Remarks & Reference Rates</Text>
            {header.basicRateLabel ? (
              <View style={{ marginBottom: 4 }}>
                <Text style={[styles.remarksText, { fontFamily: "Helvetica-Bold" }]}>
                  Basic Rate Ref:
                </Text>
                <Text style={styles.remarksText}>
                  {(() => {
                    const clean = (header.basicRateLabel || "").trim();
                    const match = clean.match(/^(\d+(?:\.\d+)?)/);
                    return match ? match[1] : header.basicRateLabel;
                  })()}
                </Text>
              </View>
            ) : null}
            {header.diaDiffLabel ? (
              <View style={{ marginBottom: 4 }}>
                <Text style={[styles.remarksText, { fontFamily: "Helvetica-Bold" }]}>
                  Dia Difference Ref:
                </Text>
                <Text style={styles.remarksText}>{header.diaDiffLabel}</Text>
              </View>
            ) : null}
            {remarks ? (
              <View style={{ marginTop: 4 }}>
                <Text style={[styles.remarksText, { fontFamily: "Helvetica-Bold" }]}>
                  Notes:
                </Text>
                <Text style={styles.remarksText}>{remarks}</Text>
              </View>
            ) : null}
          </View>

          {/* Totals Summary */}
          <View style={styles.summaryCol}>
            <Text style={styles.remarksTitle}>Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={{ color: "#71717a" }}>Total Weight:</Text>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>
                {formatQuantity(totals.totalQuantity)} MT
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={{ color: "#71717a" }}>Total Base Value:</Text>
              <Text>
                {money(
                  rows.reduce((sum, r) => sum + r.quantity * (r.basic + r.differencePlusLoading), 0)
                )}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={{ color: "#71717a" }}>Cash Discount:</Text>
              <Text style={{ color: "#dc2626" }}>
                -{money(totals.totalDiscount)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={{ color: "#71717a" }}>GST Amount:</Text>
              <Text>+{money(totals.totalGst)}</Text>
            </View>
            <View style={[styles.summaryRow, styles.summaryRowTotal]}>
              <Text>Grand Total:</Text>
              <Text>{money(totals.grandTotal)}</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Generated by LSC Alloys Statement System
          </Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

