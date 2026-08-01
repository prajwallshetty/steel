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
  HEADER_ROWS,
  PAGE,
  ROW_HEIGHT_MM,
  SHEET_COLORS,
  SHEET_FONT_PT,
  CONTENT_WIDTH_MM,
  mmToPt,
  type HeaderCellSpec,
} from "@/lib/template/sheet-template";
import {
  formatMoney,
  formatPercent,
  formatQuantity,
  formatSheetDate,
} from "@/lib/format/number";

/**
 * The A4-landscape vector PDF.
 *
 * Drawn as real PDF primitives — filled rectangles, stroked rules and embedded
 * text — so the output stays selectable, searchable and sharp at any zoom.
 * There is no canvas or image rasterisation anywhere in this path.
 *
 * Geometry is derived from the same millimetre constants the HTML sheet uses,
 * converted to PDF points, so preview and print cannot drift apart.
 */

const BORDER = mmToPt(0.25);
const CELL_PADDING = mmToPt(1.4);

/** Column widths in points, summing to the printable content width. */
const COLUMN_WIDTHS_PT = COLUMNS.map((column) =>
  mmToPt(column.share * CONTENT_WIDTH_MM),
);

const styles = StyleSheet.create({
  page: {
    paddingTop: mmToPt(PAGE.marginMm),
    paddingBottom: mmToPt(PAGE.marginMm),
    paddingLeft: mmToPt(PAGE.marginMm),
    paddingRight: mmToPt(PAGE.marginMm),
    backgroundColor: SHEET_COLORS.white,
    // Helvetica is one of the PDF standard-14 fonts: no embedding, no
    // rasterisation, and metrically close to the workbook's Calibri.
    fontFamily: "Helvetica",
    color: SHEET_COLORS.text,
  },
  grid: {
    borderTopWidth: BORDER,
    borderLeftWidth: BORDER,
    borderColor: SHEET_COLORS.border,
    borderStyle: "solid",
  },
  row: {
    flexDirection: "row",
  },
  cell: {
    borderRightWidth: BORDER,
    borderBottomWidth: BORDER,
    borderColor: SHEET_COLORS.border,
    borderStyle: "solid",
    paddingHorizontal: CELL_PADDING,
    justifyContent: "center",
  },
  note: {
    marginTop: mmToPt(1.2),
    fontSize: SHEET_FONT_PT.note,
    fontFamily: "Helvetica-Oblique",
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

  const headerValues: Record<NonNullable<HeaderCellSpec["field"]>, string> = {
    date: formatSheetDate(header.date),
    location: header.location,
    partyName: header.partyName,
    brand: header.brand,
    basicRateLabel: header.basicRateLabel,
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

  const fullWidth = COLUMN_WIDTHS_PT.reduce((sum, width) => sum + width, 0);

  return (
    <Document
      title={`${quotation.reference} — ${header.partyName}`}
      author="Steel Quotation System"
      subject={`${header.title} quotation for ${header.partyName}`}
      creator="Steel Quotation System"
    >
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.grid}>
          {/* Title band */}
          <View style={[styles.row, { height: mmToPt(ROW_HEIGHT_MM.title) }]}>
            <Cell
              width={fullWidth}
              text={header.title}
              align="left"
              bold
              fontSize={SHEET_FONT_PT.title}
            />
          </View>

          {/* Merged header block */}
          {HEADER_ROWS.map((cells, rowIndex) => (
            <View
              key={`header-${rowIndex}`}
              style={[styles.row, { height: mmToPt(ROW_HEIGHT_MM.header) }]}
            >
              {cells.map((cell, cellIndex) => (
                <Cell
                  key={`header-${rowIndex}-${cellIndex}`}
                  width={spanWidth(cells, cellIndex)}
                  text={
                    cell.kind === "label"
                      ? (cell.text ?? "")
                      : headerValues[
                          cell.field as NonNullable<HeaderCellSpec["field"]>
                        ]
                  }
                  align={cell.align}
                  bold={cell.kind === "label"}
                  fill={cell.fill}
                  fontSize={SHEET_FONT_PT.header}
                />
              ))}
            </View>
          ))}

          {/* Column headings */}
          <View style={[styles.row, { height: mmToPt(ROW_HEIGHT_MM.tableHead) }]}>
            {columnHeadings.map((heading, index) => (
              <Cell
                key={COLUMNS[index].key}
                width={COLUMN_WIDTHS_PT[index]}
                text={heading}
                align="center"
                bold
                fill={SHEET_COLORS.amber}
                fontSize={SHEET_FONT_PT.tableHead}
              />
            ))}
          </View>

          {/* Material rows */}
          {rows.map((row) => (
            <PdfRow key={row.id} row={row} money={money} />
          ))}

          {/* Totals */}
          <View style={[styles.row, { height: mmToPt(ROW_HEIGHT_MM.total) }]}>
            <Cell width={COLUMN_WIDTHS_PT[0]} text="TOTAL" align="center" bold />
            <Cell
              width={COLUMN_WIDTHS_PT[1]}
              text={formatQuantity(totals.totalQuantity)}
              align="center"
              bold
            />
            <Cell width={COLUMN_WIDTHS_PT[2]} text="" align="center" />
            <Cell width={COLUMN_WIDTHS_PT[3]} text="" align="center" />
            <Cell width={COLUMN_WIDTHS_PT[4]} text="" align="center" />
            <Cell width={COLUMN_WIDTHS_PT[5]} text="" align="center" />
            <Cell width={COLUMN_WIDTHS_PT[6]} text="TOTAL" align="center" bold />
            <Cell
              width={COLUMN_WIDTHS_PT[7]}
              text={money(totals.grandTotal)}
              align="center"
              bold
              color={SHEET_COLORS.danger}
            />
          </View>
        </View>

        <Text style={styles.note}>NOTE: {remarks}</Text>
      </Page>
    </Document>
  );
}

function PdfRow({
  row,
  money,
}: {
  readonly row: CalculatedRow;
  readonly money: (value: number) => string;
}) {
  const highlight = row.isHighlighted ? SHEET_COLORS.green : undefined;
  const height = mmToPt(ROW_HEIGHT_MM.data);

  return (
    <View style={[styles.row, { height }]}>
      <Cell
        width={COLUMN_WIDTHS_PT[0]}
        text={row.size}
        align="center"
        bold
        fill={highlight}
      />
      <Cell
        width={COLUMN_WIDTHS_PT[1]}
        text={formatQuantity(row.quantity)}
        align="center"
      />
      <Cell width={COLUMN_WIDTHS_PT[2]} text={money(row.basic)} align="center" />
      <Cell
        width={COLUMN_WIDTHS_PT[3]}
        text={money(row.differencePlusLoading)}
        align="center"
        fill={highlight}
      />
      <Cell
        width={COLUMN_WIDTHS_PT[4]}
        text={money(row.discountAmount)}
        align="center"
      />
      <Cell
        width={COLUMN_WIDTHS_PT[5]}
        text={money(row.gstAmount)}
        align="center"
      />
      <Cell
        width={COLUMN_WIDTHS_PT[6]}
        text={money(row.rate)}
        align="center"
        bold
      />
      <Cell width={COLUMN_WIDTHS_PT[7]} text={money(row.total)} align="center" />
    </View>
  );
}

interface CellProps {
  readonly width: number;
  readonly text: string;
  readonly align: "left" | "center";
  readonly bold?: boolean;
  readonly fill?: string;
  readonly color?: string;
  readonly fontSize?: number;
}

function Cell({
  width,
  text,
  align,
  bold = false,
  fill,
  color,
  fontSize = SHEET_FONT_PT.data,
}: CellProps) {
  return (
    <View style={[styles.cell, { width, backgroundColor: fill }]}>
      <Text
        style={{
          fontFamily: bold ? "Helvetica-Bold" : "Helvetica",
          fontSize,
          textAlign: align,
          color: color ?? SHEET_COLORS.text,
        }}
      >
        {text}
      </Text>
    </View>
  );
}

/** Width of a merged header cell: the sum of the columns it spans. */
function spanWidth(cells: readonly HeaderCellSpec[], index: number): number {
  const offset = cells
    .slice(0, index)
    .reduce((sum, cell) => sum + cell.span, 0);
  return COLUMN_WIDTHS_PT.slice(offset, offset + cells[index].span).reduce(
    (sum, width) => sum + width,
    0,
  );
}
