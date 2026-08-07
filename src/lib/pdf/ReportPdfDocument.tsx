import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type { ReportTable } from "@/modules/reports/report-service";
import { formatMoney } from "@/lib/format/number";
import type { NumberGrouping } from "@/types/settings";

const styles = StyleSheet.create({
  page: {
    padding: 30,
    backgroundColor: "#ffffff",
    fontFamily: "Helvetica",
    color: "#1f2937", // text-gray-800
    flexDirection: "column",
  },
  headerContainer: {
    marginBottom: 15,
    borderBottomWidth: 1.5,
    borderBottomColor: "#111827", // text-gray-900
    paddingBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111827",
  },
  subtitle: {
    fontSize: 8,
    color: "#4b5563",
    marginTop: 2,
  },
  metaContainer: {
    alignItems: "flex-end",
  },
  metaText: {
    fontSize: 8,
    color: "#6b7280",
  },
  table: {
    flex: 1,
    flexDirection: "column",
    marginTop: 5,
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1.5,
    borderBottomColor: "#374151", // border-gray-700
    backgroundColor: "#f9fafb", // bg-gray-50
    paddingVertical: 6,
    alignItems: "center",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e5e7eb", // border-gray-200
    paddingVertical: 5,
    alignItems: "center",
  },
  totalsRow: {
    flexDirection: "row",
    borderTopWidth: 1.5,
    borderTopColor: "#374151",
    borderBottomWidth: 1.5,
    borderBottomColor: "#374151",
    backgroundColor: "#f3f4f6", // bg-gray-100
    paddingVertical: 6,
    alignItems: "center",
  },
  headerCell: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#374151",
    paddingHorizontal: 3,
  },
  cell: {
    fontSize: 7.5,
    color: "#4b5563", // text-gray-600
    paddingHorizontal: 3,
  },
  totalCell: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#111827",
    paddingHorizontal: 3,
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 30,
    right: 30,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    borderTopColor: "#e5e7eb",
    paddingTop: 8,
  },
  footerText: {
    fontSize: 7.5,
    color: "#9ca3af",
  },
});

function getColumnFlex(key: string): number {
  switch (key) {
    case "customer":
    case "party":
    case "particular":
    case "createdBy":
    case "manager":
    case "branch":
      return 2.2;
    case "reference":
    case "referenceNo":
      return 1.8;
    case "date":
      return 1.6;
    case "status":
    case "code":
    case "method":
      return 1.2;
    default:
      return 1.4;
  }
}

interface ReportPdfDocumentProps {
  readonly report: ReportTable;
  readonly grouping: NumberGrouping;
}

export function ReportPdfDocument({
  report,
  grouping,
}: ReportPdfDocumentProps) {
  const totals = report.columns
    .filter((col) => col.numeric)
    .map((col) => ({
      key: col.key,
      total: report.rows.reduce(
        (sum, row) =>
          sum + (typeof row[col.key] === "number" ? (row[col.key] as number) : 0),
        0,
      ),
    }));

  const totalByKey = new Map(totals.map((t) => [t.key, t.total]));
  const hasTotals = totals.length > 0;

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* Header section */}
        <View style={styles.headerContainer} fixed>
          <View>
            <Text style={styles.title}>{report.title}</Text>
            <Text style={styles.subtitle}>
              Exported on {new Date().toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </Text>
          </View>
          <View style={styles.metaContainer}>
            <Text style={styles.metaText}>
              {report.rows.length} {report.rows.length === 1 ? "row" : "rows"} in scope
            </Text>
          </View>
        </View>

        {/* Table section */}
        <View style={styles.table}>
          {/* Table Header */}
          <View style={styles.tableHeader} fixed>
            {report.columns.map((column) => {
              const flex = getColumnFlex(column.key);
              return (
                <View
                  key={column.key}
                  style={{
                    flex,
                    textAlign: column.numeric ? "right" : "left",
                  }}
                >
                  <Text style={styles.headerCell}>{column.label}</Text>
                </View>
              );
            })}
          </View>

          {/* Table Body */}
          {report.rows.map((row, index) => (
            <View key={index} style={styles.tableRow} wrap={false}>
              {report.columns.map((column) => {
                const flex = getColumnFlex(column.key);
                const value = row[column.key];
                return (
                  <View
                    key={column.key}
                    style={{
                      flex,
                      textAlign: column.numeric ? "right" : "left",
                    }}
                  >
                    <Text style={styles.cell}>
                      {column.numeric && typeof value === "number"
                        ? formatMoney(value, grouping)
                        : String(value ?? "—")}
                    </Text>
                  </View>
                );
              })}
            </View>
          ))}

          {/* Totals Row */}
          {hasTotals && (
            <View style={styles.totalsRow} wrap={false}>
              {report.columns.map((column, index) => {
                const flex = getColumnFlex(column.key);
                return (
                  <View
                    key={column.key}
                    style={{
                      flex,
                      textAlign: column.numeric ? "right" : "left",
                    }}
                  >
                    <Text style={styles.totalCell}>
                      {index === 0
                        ? "Total"
                        : column.numeric
                          ? formatMoney(totalByKey.get(column.key) ?? 0, grouping)
                          : ""}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>LSC Alloys Quotation ERP Report</Text>
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
