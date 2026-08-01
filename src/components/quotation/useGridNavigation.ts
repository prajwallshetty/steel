"use client";

import { useCallback, useRef, type KeyboardEvent } from "react";

const CELL_ATTRIBUTE = "data-grid-cell";

/** Build the value for the `data-grid-cell` attribute of an editable cell. */
export const gridCellId = (row: number, column: number) => `${row}-${column}`;

interface GridPosition {
  readonly row: number;
  readonly column: number;
}

function parsePosition(element: Element | null): GridPosition | null {
  const raw = element?.getAttribute(CELL_ATTRIBUTE);
  if (!raw) return null;
  const [row, column] = raw.split("-").map(Number);
  return Number.isFinite(row) && Number.isFinite(column) ? { row, column } : null;
}

/**
 * Excel-style keyboard movement across a grid of inputs.
 *
 * Arrow up/down and Enter always move between rows. Arrow left/right only move
 * when the caret is already at the edge of the field, so a user can still
 * correct a digit mid-value without the focus jumping away — the behaviour
 * people expect from a spreadsheet, and the reason plain `tabIndex` ordering
 * is not enough on its own.
 */
export function useGridNavigation(rowCount: number, columnCount: number) {
  const containerRef = useRef<HTMLDivElement>(null);

  const focusCell = useCallback((row: number, column: number) => {
    const container = containerRef.current;
    if (!container) return false;

    const clampedRow = Math.max(0, Math.min(rowCount - 1, row));
    const clampedColumn = Math.max(0, Math.min(columnCount - 1, column));

    const target = container.querySelector<HTMLInputElement>(
      `[${CELL_ATTRIBUTE}="${gridCellId(clampedRow, clampedColumn)}"]`,
    );
    if (!target) return false;

    target.focus();
    target.select?.();
    return true;
  }, [rowCount, columnCount]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const input = event.target as HTMLInputElement;
      const position = parsePosition(input);
      if (!position) return;

      const { row, column } = position;
      const length = input.value.length;
      const start = input.selectionStart ?? 0;
      const end = input.selectionEnd ?? 0;

      /*
       * Arriving at a cell selects its whole value, which is Excel's
       * "cell selected" mode — there, a left/right arrow moves to the next
       * cell rather than nudging a caret. So a full selection counts as being
       * at both edges; only a collapsed caret mid-value keeps the arrow local.
       */
      const allSelected = start === 0 && end === length;
      const atStart = allSelected || (start === 0 && end === 0);
      const atEnd = allSelected || (start === length && end === length);

      switch (event.key) {
        case "ArrowUp":
          event.preventDefault();
          focusCell(row - 1, column);
          break;
        case "ArrowDown":
          event.preventDefault();
          focusCell(row + 1, column);
          break;
        case "Enter":
          // Never let Enter submit the form from inside the grid.
          event.preventDefault();
          if (!focusCell(row + 1, column)) focusCell(0, column + 1);
          break;
        case "ArrowLeft":
          if (!atStart) return;
          event.preventDefault();
          focusCell(row, column - 1);
          break;
        case "ArrowRight":
          if (!atEnd) return;
          event.preventDefault();
          focusCell(row, column + 1);
          break;
        default:
          break;
      }
    },
    [focusCell],
  );

  return { containerRef, handleKeyDown, focusCell };
}
