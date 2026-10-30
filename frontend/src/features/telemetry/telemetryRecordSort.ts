import type { TelemetryRecordEntry } from '../../types/telemetry';

export function sortTelemetryRecords(
  records: TelemetryRecordEntry[],
  value: (record: TelemetryRecordEntry) => string | number | null,
  direction: 'asc' | 'desc',
): TelemetryRecordEntry[] {
  return [...records].sort((a, b) => {
    const left = value(a);
    const right = value(b);
    const leftMissing = left === null || left === '' || left === '—' || Number.isNaN(left);
    const rightMissing = right === null || right === '' || right === '—' || Number.isNaN(right);
    if (leftMissing || rightMissing) return Number(leftMissing) - Number(rightMissing);
    const comparison =
      typeof left === 'number' && typeof right === 'number'
        ? left - right
        : String(left).localeCompare(String(right), undefined, { numeric: true });
    return direction === 'asc' ? comparison : -comparison;
  });
}
