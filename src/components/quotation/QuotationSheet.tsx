import type { CSSProperties } from "react";
import type { CalculatedQuotation, CalculatedRow } from "@/types/quotation";
import type { AppSettings } from "@/types/settings";
import {
  COLUMNS,
  COLUMN_COUNT,
  HEADER_ROWS,
  ROW_HEIGHT_MM,
  SHEET_COLORS,
  type HeaderCellSpec,
} from "@/lib/template/sheet-template";
import {
  formatMoney,
  formatPercent,
  formatQuantity,
  formatSheetDate,
} from "@/lib/format/number";

interface QuotationSheetProps {
  readonly quotation: CalculatedQuotation;
  readonly settings: AppSettings;
}

/**
 * A facsimile of the source workbook.
 *
 * Purely presentational and free of hooks, so the same component renders on the
 * server for the print route and inside the live editor preview. Every number
 * arrives pre-calculated — this file never does arithmetic.
 */
export function QuotationSheet({ quotation, settings }: QuotationSheetProps) {
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
    <div className="steel-sheet-frame">
      <table className="steel-sheet">
        <colgroup>
          {COLUMNS.map((column) => (
            <col key={column.key} style={{ width: `${column.share * 100}%` }} />
          ))}
        </colgroup>
        <tbody>
          {/* Title band */}
          <tr style={rowHeight(ROW_HEIGHT_MM.title)}>
            <td colSpan={COLUMN_COUNT} className="cell-title">
              {header.title}
            </td>
          </tr>

          {/* Merged header block */}
          {HEADER_ROWS.map((cells, rowIndex) => (
            <tr key={`header-${rowIndex}`} style={rowHeight(ROW_HEIGHT_MM.header)}>
              {cells.map((cell, cellIndex) => (
                <td
                  key={`header-${rowIndex}-${cellIndex}`}
                  colSpan={cell.span}
                  className={`cell-${cell.align}${
                    cell.kind === "label" ? " cell-bold" : ""
                  }`}
                  style={{ backgroundColor: cell.fill }}
                >
                  {cell.kind === "label"
                    ? cell.text
                    : headerValues[cell.field as NonNullable<HeaderCellSpec["field"]>]}
                </td>
              ))}
            </tr>
          ))}

          {/* Column headings */}
          <tr style={rowHeight(ROW_HEIGHT_MM.tableHead)}>
            {columnHeadings.map((heading, index) => (
              <th
                key={COLUMNS[index].key}
                scope="col"
                className="cell-head"
                style={{ backgroundColor: SHEET_COLORS.amber }}
              >
                {heading}
              </th>
            ))}
          </tr>

          {/* Material rows */}
          {rows.map((row) => (
            <SheetRow key={row.id} row={row} money={money} />
          ))}

          {/* Totals */}
          <tr style={rowHeight(ROW_HEIGHT_MM.total)}>
            <td className="cell-center cell-bold">TOTAL</td>
            <td className="cell-center cell-bold">
              {formatQuantity(totals.totalQuantity)}
            </td>
            <td className="cell-center" />
            <td className="cell-center" />
            <td className="cell-center" />
            <td className="cell-center" />
            <td className="cell-center cell-bold">TOTAL</td>
            <td className="cell-center cell-danger">
              {money(totals.grandTotal)}
            </td>
          </tr>

          {/* Footer note */}
          <tr style={rowHeight(ROW_HEIGHT_MM.note)}>
            <td colSpan={COLUMN_COUNT} className="cell-note">
              NOTE: {remarks}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function SheetRow({
  row,
  money,
}: {
  readonly row: CalculatedRow;
  readonly money: (value: number) => string;
}) {
  const highlight = row.isHighlighted
    ? { backgroundColor: SHEET_COLORS.green }
    : undefined;

  return (
    <tr style={rowHeight(ROW_HEIGHT_MM.data)}>
      <th scope="row" className="cell-center cell-bold" style={highlight}>
        {row.size}
      </th>
      <td className="cell-center">{formatQuantity(row.quantity)}</td>
      <td className="cell-center">{money(row.basic)}</td>
      <td className="cell-center" style={highlight}>
        {money(row.differencePlusLoading)}
      </td>
      <td className="cell-center">{money(row.discountAmount)}</td>
      <td className="cell-center">{money(row.gstAmount)}</td>
      <td className="cell-center cell-bold">{money(row.rate)}</td>
      <td className="cell-center">{money(row.total)}</td>
    </tr>
  );
}

const rowHeight = (mm: number): CSSProperties => ({ height: `${mm}mm` });
