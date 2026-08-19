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
  COLUMNS,
  COLUMN_COUNT,
  HEADER_ROWS,
  SHEET_COLORS,
  type HeaderCellSpec,
} from "@/lib/template/sheet-template";
import {
  formatMoney,
  formatPercent,
  formatQuantity,
  formatSheetDate,
} from "@/lib/format/number";

const BORDER_COLOR = "#000000";
const BORDER_WIDTH = 0.7;

const styles = StyleSheet.create({
  page: {
    padding: 28.35, // 10mm margin
    backgroundColor: "#ffffff",
    fontFamily: "Helvetica",
    fontSize: 9.5,
    color: "#000000",
  },
  table: {
    width: "100%",
    borderTopWidth: BORDER_WIDTH,
    borderLeftWidth: BORDER_WIDTH,
    borderColor: BORDER_COLOR,
    borderStyle: "solid",
  },
  row: {
    flexDirection: "row",
    width: "100%",
    minHeight: 22,
    alignItems: "stretch",
  },
  cell: {
    borderRightWidth: BORDER_WIDTH,
    borderBottomWidth: BORDER_WIDTH,
    borderColor: BORDER_COLOR,
    paddingVertical: 3,
    paddingHorizontal: 4,
    justifyContent: "center",
  },
  cellLeft: {
    alignItems: "flex-start",
  },
  cellCenter: {
    alignItems: "center",
  },
  cellRight: {
    alignItems: "flex-end",
  },
  text: {
    fontSize: 9.5,
    fontFamily: "Helvetica",
    color: "#000000",
  },
  textBold: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    color: "#000000",
  },
  textDanger: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    color: SHEET_COLORS.danger,
  },
  textNote: {
    fontSize: 8,
    fontFamily: "Helvetica-Oblique",
    color: "#000000",
  },
  noteContainer: {
    paddingTop: 4,
    width: "100%",
  },
});

/** Width percentages for header cell spans */
const SPAN_WIDTHS: Record<number, string> = {
  1: "16%",
  2: "24%", // for cols 5&6 (11.5 + 12.5) or 7&8 (11 + 12) depending on position
  3: "37%", // 12.5 + 11.5 + 13
  7: "84%", // 100 - 16
  8: "100%",
};

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

  const headerValues: Record<
    NonNullable<HeaderCellSpec["field"]>,
    string
  > = {
    date: formatSheetDate(header.date),
    location: header.location,
    partyName: header.partyName,
    brand: header.brand,
    basicRateLabel: (() => {
      const clean = (header.basicRateLabel || "").trim();
      const match = clean.match(/^(\d+(?:\.\d+)?)/);
      return match ? match[1] : header.basicRateLabel;
    })(),
    diaDiffLabel: header.diaDiffLabel,
    payment: header.payment,
    vehicleNo: header.vehicleNo,
  };

  const columnHeadings = [
    "SIZES",
    "QUANTITY",
    "BASIC",
    "DIFF+ LDG",
    `${formatPercent(settings.pricing.nominalDiscountPercent)} CD`,
    `${formatPercent(settings.pricing.gstPercent)} GST`,
    "RATE",
    "TOTAL",
  ];

  return (
    <Document
      title={`Quotation ${quotation.reference} — ${header.partyName}`}
      author="Quotation System"
      subject={`${header.title} quotation for ${header.partyName}`}
      creator="Quotation System"
    >
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.table}>
          {/* Title Band */}
          <View style={styles.row}>
            <View
              style={[
                styles.cell,
                styles.cellLeft,
                { width: "100%", backgroundColor: SHEET_COLORS.white },
              ]}
            >
              <Text style={styles.textBold}>{header.title}</Text>
            </View>
          </View>

          {/* Merged Header Rows */}
          {HEADER_ROWS.map((rowCells, rowIndex) => (
            <View key={`header-row-${rowIndex}`} style={styles.row}>
              {rowCells.map((cell, cellIndex) => {
                let cellWidth = SPAN_WIDTHS[cell.span];
                if (cell.span === 2) {
                  // Span 2: if it's cell 2 in row 0/1 (LOCATION / BRAND label), width is 11.5+12.5 = 24%.
                  // If it's cell 3 in row 0/1 (location/brand value), width is 11+12 = 23%.
                  cellWidth = cellIndex === 2 ? "24%" : "23%";
                }

                const textVal =
                  cell.kind === "label"
                    ? cell.text ?? ""
                    : headerValues[
                        cell.field as NonNullable<HeaderCellSpec["field"]>
                      ] ?? "";

                return (
                  <View
                    key={`header-cell-${rowIndex}-${cellIndex}`}
                    style={[
                      styles.cell,
                      cell.align === "center"
                        ? styles.cellCenter
                        : styles.cellLeft,
                      { width: cellWidth, backgroundColor: cell.fill },
                    ]}
                  >
                    <Text
                      style={
                        cell.kind === "label" ? styles.textBold : styles.text
                      }
                    >
                      {textVal}
                    </Text>
                  </View>
                );
              })}
            </View>
          ))}

          {/* Column Headings */}
          <View style={styles.row}>
            {columnHeadings.map((heading, index) => (
              <View
                key={`col-head-${index}`}
                style={[
                  styles.cell,
                  styles.cellCenter,
                  {
                    width: `${COLUMNS[index].share * 100}%`,
                    backgroundColor: SHEET_COLORS.amber,
                  },
                ]}
              >
                <Text style={styles.textBold}>{heading}</Text>
              </View>
            ))}
          </View>

          {/* Material Rows */}
          {rows.map((row) => {
            const isGreen = row.isHighlighted;
            const highlightStyle = isGreen
              ? { backgroundColor: SHEET_COLORS.green }
              : { backgroundColor: SHEET_COLORS.white };

            return (
              <View key={`data-row-${row.id}`} style={styles.row}>
                {/* SIZES */}
                <View
                  style={[
                    styles.cell,
                    styles.cellCenter,
                    highlightStyle,
                    { width: `${COLUMNS[0].share * 100}%` },
                  ]}
                >
                  <Text style={styles.textBold}>{row.size}</Text>
                </View>

                {/* QUANTITY */}
                <View
                  style={[
                    styles.cell,
                    styles.cellCenter,
                    { width: `${COLUMNS[1].share * 100}%` },
                  ]}
                >
                  <Text style={styles.text}>
                    {formatQuantity(row.quantity)}
                  </Text>
                </View>

                {/* BASIC */}
                <View
                  style={[
                    styles.cell,
                    styles.cellCenter,
                    { width: `${COLUMNS[2].share * 100}%` },
                  ]}
                >
                  <Text style={styles.text}>{money(row.basic)}</Text>
                </View>

                {/* DIFF+ LDG */}
                <View
                  style={[
                    styles.cell,
                    styles.cellCenter,
                    highlightStyle,
                    { width: `${COLUMNS[3].share * 100}%` },
                  ]}
                >
                  <Text style={styles.text}>
                    {money(row.differencePlusLoading)}
                  </Text>
                </View>

                {/* CD */}
                <View
                  style={[
                    styles.cell,
                    styles.cellCenter,
                    { width: `${COLUMNS[4].share * 100}%` },
                  ]}
                >
                  <Text style={styles.text}>{money(row.discountAmount)}</Text>
                </View>

                {/* GST */}
                <View
                  style={[
                    styles.cell,
                    styles.cellCenter,
                    { width: `${COLUMNS[5].share * 100}%` },
                  ]}
                >
                  <Text style={styles.text}>{money(row.gstAmount)}</Text>
                </View>

                {/* RATE */}
                <View
                  style={[
                    styles.cell,
                    styles.cellCenter,
                    { width: `${COLUMNS[6].share * 100}%` },
                  ]}
                >
                  <Text style={styles.textBold}>{money(row.rate)}</Text>
                </View>

                {/* TOTAL */}
                <View
                  style={[
                    styles.cell,
                    styles.cellCenter,
                    { width: `${COLUMNS[7].share * 100}%` },
                  ]}
                >
                  <Text style={styles.text}>{money(row.total)}</Text>
                </View>
              </View>
            );
          })}

          {/* Totals Row */}
          <View style={styles.row}>
            <View
              style={[
                styles.cell,
                styles.cellCenter,
                { width: `${COLUMNS[0].share * 100}%` },
              ]}
            >
              <Text style={styles.textBold}>TOTAL</Text>
            </View>

            <View
              style={[
                styles.cell,
                styles.cellCenter,
                { width: `${COLUMNS[1].share * 100}%` },
              ]}
            >
              <Text style={styles.textBold}>
                {formatQuantity(totals.totalQuantity)}
              </Text>
            </View>

            <View
              style={[
                styles.cell,
                styles.cellCenter,
                { width: `${COLUMNS[2].share * 100}%` },
              ]}
            />

            <View
              style={[
                styles.cell,
                styles.cellCenter,
                { width: `${COLUMNS[3].share * 100}%` },
              ]}
            />

            <View
              style={[
                styles.cell,
                styles.cellCenter,
                { width: `${COLUMNS[4].share * 100}%` },
              ]}
            />

            <View
              style={[
                styles.cell,
                styles.cellCenter,
                { width: `${COLUMNS[5].share * 100}%` },
              ]}
            />

            <View
              style={[
                styles.cell,
                styles.cellCenter,
                { width: `${COLUMNS[6].share * 100}%` },
              ]}
            >
              <Text style={styles.textBold}>TOTAL</Text>
            </View>

            <View
              style={[
                styles.cell,
                styles.cellCenter,
                { width: `${COLUMNS[7].share * 100}%` },
              ]}
            >
              <Text style={styles.textDanger}>{money(totals.grandTotal)}</Text>
            </View>
          </View>
        </View>

        {/* Footer Note */}
        <View style={styles.noteContainer}>
          <Text style={styles.textNote}>NOTE: {remarks}</Text>
        </View>
      </Page>
    </Document>
  );
}
