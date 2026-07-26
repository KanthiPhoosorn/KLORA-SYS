// Sequential, human-readable IDs: SUP-YYYY-NNNN and BAT-YYYY-NNNN.
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
