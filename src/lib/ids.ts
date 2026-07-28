// Sequential, human-readable IDs: SUP-YYYY-NNNN, BAT-YYYY-NNNN, USR-NNNN, PRT-NNNN.
// NNNN is derived from the count of existing records so IDs stay stable and ordered.

function pad(n: number): string {
  return String(n).padStart(4, "0");
}

export function nextSupplierId(existingCount: number, year: number): string {
  return `SUP-${year}-${pad(existingCount + 1)}`;
}

export function nextBatchId(existingCount: number, year: number): string {
  return `BAT-${year}-${pad(existingCount + 1)}`;
}

export function nextUserId(existingCount: number): string {
  return `USR-${pad(existingCount + 1)}`;
}

export function nextPrintId(existingCount: number): string {
  return `PRT-${pad(existingCount + 1)}`;
}
