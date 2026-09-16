'use client';

import type { CSSProperties, ReactNode } from 'react';
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';
import Link from 'next/link';
import {
  BRAND_LABELS,
  BUILD_MODE_LABELS,
  capitalizeBrand,
  CellMetricBasis,
  deriveModelTag,
  deriveQuantLabel,
  deriveSortOrder,
  deriveWeightLabel,
  filterLeaderboardData,
  formatFilterSelection,
  formatHardwareSummary,
  formatMetricBasisLabel,
  formatSpeed,
  getDisplaySpeeds,
  inferBrand,
  isBatchColumn,
  MODEL_TAG_LABELS,
  OS_LABELS,
  OS_ORDER,
  telemetrySocKey,
} from '@/features/telemetry/telemetryRules';
import { getTelemetryFilterOptions } from '@/features/telemetry/telemetryFilters';
import {
  defaultTelemetryFilters,
  FILTER_STORAGE_KEY,
  parseTelemetryFilterState,
  telemetryQueryKey,
} from '@/features/telemetry/telemetryFilterState';
import { ThemeSwitcher } from '@/components';
import {
  fetchPublicTelemetryFilters,
  fetchPublicTelemetryLeaderboard,
  fetchPublicTelemetryRecords,
} from '@/utils/api';
import type {
  TelemetryLeaderboardEntry as LeaderboardEntry,
  TelemetryRecordEntry as RecordEntry,
} from '@/types/telemetry';
import {
  resolveAndroidSocName,
  resolveAppleDevicePresentation,
  summarizeHeaderDeviceModels,
} from '@/utils/appleDeviceInfo';
import styles from './page.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WeightColumn {
  key: string; // modelSha256 + backend + batch dimension
  label: string;
  modelName: string;
  fileName: string;
  quant: string;
  backend: string;
  modelTag: string; // Chat / VL / TTS / Translate / Neko
  isBatch: boolean;
  batchCount: number;
  sortOrder: number;
}

interface MatrixCell {
  prefillDisplay: number | null;
  decodeDisplay: number | null;
  decodeRawDisplay: number | null;
  metricBasis: CellMetricBasis;
  sampleCount: number;
  backend: string;
  isBatch: boolean;
  batchCount: number;
  // Keys for fetching individual records
  socName: string;
  modelSha256: string;
  os: string;
}

interface MatrixRow {
  socName: string;
  socBrand: string;
  deviceModels: string[];
  deviceDisplayNames: string[];
  cells: Record<string, MatrixCell>; // key = modelSha256
}

interface PlatformData {
  id: string;
  label: string;
  rows: MatrixRow[];
}

type DisplayRow = MatrixRow & { osLabel?: string; osId: string };

interface SidebarState {
  open: boolean;
  loading: boolean;
  records: RecordEntry[];
  cellInfo: {
    socName: string;
    modelSha256: string;
    backend: string;
    isBatch: boolean;
    os: string;
    label: string;
  } | null;
}

interface SocDisplayInfo {
  brand: string;
  primaryLabel: string;
  secondaryLabel: string | null;
  metaLabel: string | null;
}

interface StackedCellLabel {
  primary: string;
  secondary: string | null;
}

// ---------------------------------------------------------------------------
// localStorage persistence keys
// ---------------------------------------------------------------------------

const LS_KEY_MODEL_TAG = 'rwkv-perf-filter-model-tag';
const LS_KEY_SIZE = 'rwkv-perf-filter-size';
const LS_KEY_BRAND = 'rwkv-perf-filter-brand';
const INITIAL_RENDERED_ROWS = 12;
const RENDER_ROW_CHUNK = 12;

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

function scheduleRowRender(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const idleWindow = window as IdleWindow;
  if (idleWindow.requestIdleCallback && idleWindow.cancelIdleCallback) {
    const handle = idleWindow.requestIdleCallback(callback, { timeout: 120 });
    return () => idleWindow.cancelIdleCallback?.(handle);
  }

  const handle = window.setTimeout(callback, 16);
  return () => window.clearTimeout(handle);
}

function parseFilterList(value: string | null | undefined): string[] {
  if (!value) return [];
  const seen = new Set<string>();
  const values: string[] = [];
  for (const part of value.split(',')) {
    const item = part.trim();
    if (!item || item === 'all') continue;
    const dedupeKey = item.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    values.push(item);
  }
  return values;
}

function readLegacyFilter(key: string, fallback: string[]): string[] {
  const value = localStorage.getItem(key);
  return value === null ? fallback : parseFilterList(value);
}

function FilterGroup({
  label,
  options,
  selected,
  onChange,
  format = (value) => value,
  valueKey = (value) => value,
  pending = false,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
  format?: (value: string) => ReactNode;
  valueKey?: (value: string) => string;
  pending?: boolean;
}) {
  const selectedKeys = new Set(selected.map(valueKey));
  const optionKeys = new Set(options.map(valueKey));
  const visibleOptions = Array.from(
    new Map([...selected, ...options].map((value) => [valueKey(value), value])).values(),
  );
  return (
    <div className={styles.tabRow} role="group" aria-label={label}>
      <span className={styles.filterLabel}>{label}</span>
      <button
        type="button"
        className={`${styles.tabButtonSmall} ${selected.length === 0 ? styles.tabButtonSelected : ''}`}
        aria-pressed={selected.length === 0}
        onClick={() => onChange([])}
      >
        不限制
      </button>
      {visibleOptions.map((value) => {
        const active = selectedKeys.has(valueKey(value));
        const unavailable = !pending && !optionKeys.has(valueKey(value));
        return (
          <button
            key={value}
            type="button"
            className={`${styles.tabButtonSmall} ${active ? styles.tabButtonSelected : ''} ${unavailable ? styles.unavailableFilter : ''}`}
            aria-pressed={active}
            onClick={() =>
              onChange(
                active
                  ? selected.filter((item) => valueKey(item) !== valueKey(value))
                  : [...selected, value],
              )
            }
            title={unavailable ? '当前条件下无匹配数据，点击取消此条件' : undefined}
          >
            {format(value)}
            {unavailable ? '（无匹配）' : ''}
          </button>
        );
      })}
      {visibleOptions.length === 0 ? (
        <span className={styles.filterHint}>{pending ? '加载中…' : '当前条件下无可选项'}</span>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Brand icons — cdn.simpleicons.org (official Simple Icons CDN)
// Format: /[slug]/[light_color]/[dark_color]
// ---------------------------------------------------------------------------

const BRAND_ICON_SLUGS: Record<string, string> = {
  apple: 'apple',
  qualcomm: 'qualcomm',
  snapdragon: 'qualcomm',
  nvidia: 'nvidia',
  amd: 'amd',
  intel: 'intel',
  mediatek: 'mediatek',
  samsung: 'samsung',
  google: 'google',
  huawei: 'huawei',
};

function brandIconUrl(brand: string): string | null {
  const slug = BRAND_ICON_SLUGS[brand.toLowerCase()];
  if (!slug) return null;
  // 亮色用深灰，暗色用浅灰，确保在两种主题下都清晰可见
  return `https://cdn.simpleicons.org/${slug}/555555/cccccc`;
}

function BrandIcon({ brand, className }: { brand: string; className?: string }) {
  const url = brandIconUrl(brand);
  if (!url) return null;
  return <img src={url} alt={brand} className={className} />;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSocDisplayInfo(input: {
  socName: string;
  socBrand?: string | null;
  deviceModel?: string | null;
  deviceModels?: string[] | null;
}): SocDisplayInfo {
  if (input.socName.toLowerCase() === 'unknown') {
    return { brand: 'unknown', primaryLabel: '芯片未知', secondaryLabel: null, metaLabel: null };
  }
  const applePresentation = resolveAppleDevicePresentation({
    socName: input.socName,
    deviceModel: input.deviceModel,
  });

  if (applePresentation) {
    const primaryLabel =
      applePresentation.socName ??
      applePresentation.modelName ??
      applePresentation.identifier ??
      input.socName;
    const secondaryLabel =
      applePresentation.socName &&
      applePresentation.modelName &&
      applePresentation.modelName !== primaryLabel
        ? applePresentation.modelName
        : null;
    const metaLabel =
      applePresentation.identifier &&
      applePresentation.identifier !== primaryLabel &&
      applePresentation.identifier !== secondaryLabel
        ? applePresentation.identifier
        : null;

    return {
      brand: 'apple',
      primaryLabel,
      secondaryLabel,
      metaLabel,
    };
  }

  const androidSocName = resolveAndroidSocName(input.socName);
  if (androidSocName) {
    return {
      brand: inferBrand(input.socName, input.socBrand ?? 'unknown'),
      primaryLabel: androidSocName,
      secondaryLabel: null,
      metaLabel: null,
    };
  }

  return {
    brand: inferBrand(input.socName, input.socBrand ?? 'unknown'),
    primaryLabel: input.socName,
    secondaryLabel: null,
    metaLabel: null,
  };
}

function formatSocFilterLabel(input: {
  socName: string;
  socBrand?: string | null;
  deviceModel?: string | null;
  deviceModels?: string[] | null;
}): string {
  const display = getSocDisplayInfo(input);
  return (
    [display.primaryLabel, display.secondaryLabel].filter(Boolean).join(' · ') ||
    display.primaryLabel
  );
}

function getRecordDeviceLabel(record: RecordEntry): StackedCellLabel {
  const applePresentation = resolveAppleDevicePresentation({
    socName: record.socName,
    deviceModel: record.deviceModel,
  });

  if (applePresentation) {
    const primary =
      applePresentation.modelName ?? record.deviceModel ?? applePresentation.identifier ?? '—';
    const secondary =
      applePresentation.identifier && applePresentation.identifier !== primary
        ? applePresentation.identifier
        : null;

    return { primary, secondary };
  }

  if (record.deviceDisplayName) {
    return {
      primary: record.deviceDisplayName,
      secondary:
        record.deviceModel && record.deviceModel !== record.deviceDisplayName
          ? record.deviceModel
          : null,
    };
  }

  return {
    primary: record.deviceModel || '—',
    secondary: null,
  };
}

function getRecordHardwareLabel(record: RecordEntry): StackedCellLabel {
  const applePresentation = resolveAppleDevicePresentation({
    socName: record.socName,
    deviceModel: record.deviceModel,
  });
  const rawHardwareSummary = formatHardwareSummary(record.cpuName, record.gpuName);

  if (applePresentation?.socName) {
    return {
      primary: applePresentation.socName,
      secondary:
        rawHardwareSummary !== '—' && rawHardwareSummary !== applePresentation.socName
          ? rawHardwareSummary
          : null,
    };
  }

  const androidSocName = resolveAndroidSocName(record.socName);
  if (androidSocName) {
    return {
      primary: androidSocName,
      secondary:
        rawHardwareSummary !== '—' && rawHardwareSummary !== androidSocName
          ? rawHardwareSummary
          : null,
    };
  }

  return {
    primary: rawHardwareSummary,
    secondary: null,
  };
}

function buildCellClass(decode: number | null): string {
  if (decode === null) return '';
  if (decode >= 35) return styles.cellStrong;
  if (decode >= 15) return styles.cellGood;
  if (decode >= 6) return styles.cellTight;
  return styles.cellWeak;
}

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getCellFooterNote(cell: MatrixCell): string {
  if (cell.isBatch && cell.batchCount > 1) {
    return `Batch ×${cell.batchCount} · ${cell.sampleCount}次测评`;
  }
  return `${cell.sampleCount}次测评`;
}

function getWeightColumnReportLabel(column: WeightColumn): string {
  const parts = [column.label];
  if (column.modelTag !== 'Chat') {
    parts.push(column.modelTag);
  }
  if (column.isBatch) {
    parts.push(`batch×${column.batchCount}`);
  }
  parts.push(column.quant);
  parts.push(column.backend);
  return parts.join(' | ');
}

function getEntryReportLabel(entry: LeaderboardEntry): string {
  return getWeightColumnReportLabel({
    key: columnKey(entry),
    label: deriveWeightLabel(entry),
    modelName: entry.modelName,
    fileName: entry.modelFileName,
    quant: deriveQuantLabel(entry),
    backend: entry.backend,
    modelTag: deriveModelTag(entry),
    isBatch: isBatchColumn(entry),
    batchCount: entry.batchCount,
    sortOrder: deriveSortOrder(entry),
  });
}

function downloadTextFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

function sanitizeFileNamePart(value: string): string {
  return (
    value
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'all'
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function openHtmlReport(filename: string, html: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  if (!opened) {
    downloadTextFile(filename, html, 'text/html');
  }
  window.setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
}

function buildSocReportHtml(input: {
  filename: string;
  title: string;
  generatedAt: string;
  platform: string;
  vendor: string;
  filters: Array<{ label: string; value: string }>;
  weights: Array<{
    label: string;
    prefill: number | null;
    decodeRaw: number | null;
    decodePerBatch: number | null;
    isBatch: boolean;
    metricNote: string;
    sampleCount: number;
  }>;
  statistics: Array<{
    reportColumn: string;
    modelName: string;
    modelFileName: string;
    displayPrefill: number | null;
    displayDecodeRaw: number | null;
    displayDecodePerBatch: number | null;
    displayMetricBasis: string;
    sampleCount: number;
    backend: string;
    batchCount: number;
    isBatch: boolean;
  }>;
}): string {
  const filterHtml = input.filters
    .map(
      (item) =>
        `<span class="chip"><strong>${escapeHtml(item.label)}:</strong> ${escapeHtml(item.value)}</span>`,
    )
    .join('');

  const rowsHtml = input.weights
    .map(
      (item) => `
      <tr>
        <td>${escapeHtml(input.title)}</td>
        <td>${escapeHtml(item.label)}</td>
        <td>${escapeHtml(formatSpeed(item.prefill))}</td>
        <td>${escapeHtml(formatSpeed(item.decodeRaw))}</td>
        <td>${escapeHtml(item.isBatch ? formatSpeed(item.decodePerBatch) : '—')}</td>
        <td>${escapeHtml(item.metricNote)}</td>
        <td>${escapeHtml(String(item.sampleCount))}</td>
      </tr>
    `,
    )
    .join('');

  const statisticsRowsHtml = input.statistics
    .map(
      (item) => `
      <tr>
        <td>${escapeHtml(input.title)}</td>
        <td>${escapeHtml(item.reportColumn)}</td>
        <td>${escapeHtml(item.modelName || item.modelFileName)}</td>
        <td>${escapeHtml(formatSpeed(item.displayPrefill))}</td>
        <td>${escapeHtml(formatSpeed(item.displayDecodeRaw))}</td>
        <td>${escapeHtml(item.isBatch ? formatSpeed(item.displayDecodePerBatch) : '—')}</td>
        <td>${escapeHtml(item.displayMetricBasis)}</td>
        <td>${escapeHtml(item.batchCount > 1 ? `x${item.batchCount}` : 'x1')}</td>
        <td>${escapeHtml(item.backend)}</td>
        <td>${escapeHtml(String(item.sampleCount))}</td>
      </tr>
    `,
    )
    .join('');

  const safeTitle = escapeHtml(input.title);
  const safePlatform = escapeHtml(input.platform);
  const safeVendor = escapeHtml(input.vendor);
  const safeGeneratedAt = escapeHtml(new Date(input.generatedAt).toLocaleString('zh-CN'));

  return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle} Report</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f5f7f6;
        --panel: #ffffff;
        --text: #17201c;
        --muted: #5f6d66;
        --line: #d9e3de;
        --accent: #0f9f88;
        --accent-soft: #e7f6f2;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: var(--bg);
        color: var(--text);
      }
      .page {
        width: min(1200px, calc(100vw - 32px));
        margin: 24px auto 56px;
      }
      .toolbar {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        margin-bottom: 16px;
      }
      .toolbar button {
        border: 1px solid var(--accent);
        background: var(--panel);
        color: var(--accent);
        border-radius: 999px;
        padding: 10px 14px;
        font: inherit;
        cursor: pointer;
      }
      .hero, .panel {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 18px;
        padding: 20px 22px;
      }
      .hero {
        margin-bottom: 16px;
      }
      .eyebrow {
        margin: 0 0 8px;
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--accent);
        font-weight: 700;
      }
      h1 {
        margin: 0;
        font-size: 32px;
        line-height: 1.05;
      }
      .summary {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        margin-top: 14px;
      }
      .chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border-radius: 999px;
        background: var(--accent-soft);
        color: var(--accent);
        padding: 8px 12px;
        font-size: 13px;
      }
      .muted {
        color: var(--muted);
        font-size: 14px;
        line-height: 1.6;
      }
      .panel h2 {
        margin: 0 0 12px;
        font-size: 18px;
      }
      .panel + .panel {
        margin-top: 16px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th, td {
        border-bottom: 1px solid var(--line);
        padding: 12px 10px;
        text-align: left;
        vertical-align: top;
        font-size: 14px;
      }
      th {
        font-size: 12px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--muted);
      }
      tr:last-child td {
        border-bottom: none;
      }
      .note {
        margin-top: 12px;
        color: var(--muted);
        font-size: 13px;
        line-height: 1.6;
      }
      @media print {
        body {
          background: #fff;
        }
        .page {
          width: 100%;
          margin: 0;
        }
        .toolbar {
          display: none;
        }
        .hero, .panel {
          border-radius: 0;
          border-left: none;
          border-right: none;
          padding-left: 0;
          padding-right: 0;
        }
      }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="toolbar">
        <button type="button" onclick="window.print()">打印 / 导出 PDF</button>
        <button type="button" onclick="downloadHtml()">下载 HTML</button>
      </div>

      <section class="hero">
        <p class="eyebrow">RWKV Performance Report</p>
        <h1>${safeTitle}</h1>
        <p class="muted">Platform: ${safePlatform} · Vendor: ${safeVendor} · Generated: ${safeGeneratedAt}</p>
        <div class="summary">${filterHtml}</div>
      </section>

      <section class="panel">
        <h2>各权重表现</h2>
        <table>
          <thead>
            <tr>
              <th>Headers</th>
              <th>Weight</th>
              <th>Prefill</th>
              <th>Decode</th>
              <th>Decode / Batch</th>
              <th>Rule</th>
              <th>Samples</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
        <p class="note">batch 单元格会同时列出 Decode 总值和 Decode / Batch，颜色与判断口径按 Decode / Batch，且低于 6 时标红；没有统计到的数据不会出现在这份报表里。</p>
      </section>

      <section class="panel">
        <h2>统计明细</h2>
        <table>
          <thead>
            <tr>
              <th>Headers</th>
              <th>Weight</th>
              <th>Model</th>
              <th>Prefill</th>
              <th>Decode</th>
              <th>Decode / Batch</th>
              <th>Rule</th>
              <th>Batch</th>
              <th>Backend</th>
              <th>Samples</th>
            </tr>
          </thead>
          <tbody>
            ${statisticsRowsHtml}
          </tbody>
        </table>
      </section>
    </div>
    <script>
      function downloadHtml() {
        var html = '<!DOCTYPE html>\\n' + document.documentElement.outerHTML;
        var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = ${JSON.stringify(input.filename)};
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      }
    </script>
  </body>
</html>`;
}

// ---------------------------------------------------------------------------
// Data transform
// ---------------------------------------------------------------------------

/** 生成唯一的列 key：同一个模型的不同 batch 配置视为不同列，不同类型（VL/Chat）也分开 */
function columnKey(entry: LeaderboardEntry): string {
  const tag = deriveModelTag(entry);
  let key = `${entry.modelSha256}__${entry.backend}__${tag}`;
  if (entry.isBatch && entry.batchCount > 1) {
    key += `__batch${entry.batchCount}`;
  }
  return key;
}

function buildPlatforms(
  data: LeaderboardEntry[],
  filterOs: string | null,
): {
  platforms: PlatformData[];
  weightColumns: WeightColumn[];
} {
  // Filter by OS if not "all"
  const filtered = filterOs ? data.filter((e) => e.os === filterOs) : data;

  // Build unique weight columns (by modelSha256 + batch dimension)
  const weightMap = new Map<string, WeightColumn>();
  for (const entry of filtered) {
    const ck = columnKey(entry);
    if (!weightMap.has(ck)) {
      const tag = deriveModelTag(entry);
      const isBatchCol = entry.isBatch && entry.batchCount > 1;
      weightMap.set(ck, {
        key: ck,
        label: deriveWeightLabel(entry),
        modelName: entry.modelName,
        fileName: entry.modelFileName,
        quant: deriveQuantLabel(entry),
        backend: entry.backend,
        modelTag: tag,
        isBatch: isBatchCol,
        batchCount: entry.batchCount,
        sortOrder: deriveSortOrder(entry) + (isBatchCol ? 0.01 * entry.batchCount : 0),
      });
    }
  }
  const weightColumns = Array.from(weightMap.values()).sort((a, b) => a.sortOrder - b.sortOrder);

  // Group entries by OS
  const byOs = new Map<string, LeaderboardEntry[]>();
  for (const entry of filtered) {
    const os = entry.os || 'unknown';
    if (!byOs.has(os)) byOs.set(os, []);
    byOs.get(os)!.push(entry);
  }

  const platforms: PlatformData[] = [];
  const osKeys = Array.from(byOs.keys()).sort((a, b) => {
    const ia = OS_ORDER.indexOf(a);
    const ib = OS_ORDER.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });

  for (const os of osKeys) {
    const entries = byOs.get(os)!;

    const bySoc = new Map<string, MatrixRow>();
    for (const entry of entries) {
      if (!bySoc.has(entry.socName)) {
        bySoc.set(entry.socName, {
          socName: entry.socName,
          socBrand: entry.socBrand,
          deviceModels: [],
          deviceDisplayNames: [],
          cells: {},
        });
      }
      const row = bySoc.get(entry.socName)!;
      for (const deviceModel of entry.deviceModels ?? []) {
        if (deviceModel && !row.deviceModels.includes(deviceModel)) {
          row.deviceModels.push(deviceModel);
        }
      }
      for (const deviceDisplayName of entry.deviceDisplayNames ?? []) {
        if (deviceDisplayName && !row.deviceDisplayNames.includes(deviceDisplayName)) {
          row.deviceDisplayNames.push(deviceDisplayName);
        }
      }
      const ck = columnKey(entry);
      const existing = row.cells[ck];
      const display = getDisplaySpeeds(entry);
      // Keep entry with higher displayed decode score for the current metric basis.
      if (!existing || (display.decode ?? 0) > (existing.decodeDisplay ?? 0)) {
        row.cells[ck] = {
          prefillDisplay: display.prefill,
          decodeDisplay: display.decode,
          decodeRawDisplay: display.decodeRaw,
          metricBasis: display.metricBasis,
          sampleCount: entry.sampleCount,
          backend: entry.backend,
          isBatch: entry.isBatch,
          batchCount: entry.batchCount,
          socName: entry.socName,
          modelSha256: entry.modelSha256,
          os: entry.os,
        };
      }
    }

    const rows = Array.from(bySoc.values()).sort((a, b) => {
      const maxA = Math.max(...Object.values(a.cells).map((c) => c.decodeDisplay ?? 0));
      const maxB = Math.max(...Object.values(b.cells).map((c) => c.decodeDisplay ?? 0));
      return maxB - maxA;
    });

    platforms.push({
      id: os,
      label: OS_LABELS[os] ?? os,
      rows,
    });
  }

  return { platforms, weightColumns };
}

async function fetchLeaderboard(
  appVersions?: string[],
  buildModes?: string[],
  signal?: AbortSignal,
): Promise<LeaderboardEntry[]> {
  return fetchPublicTelemetryLeaderboard({ appVersions, buildModes, limit: 5000, signal });
}

async function fetchFilters(
  signal?: AbortSignal,
): Promise<{ appVersions: string[]; buildModes: string[] }> {
  return fetchPublicTelemetryFilters(signal);
}

async function fetchRecords(params: {
  socName: string;
  modelSha256: string;
  backend: string;
  isBatch: boolean;
  batchCount: number;
  os?: string;
  appVersions?: string[];
  buildModes?: string[];
  signal?: AbortSignal;
}): Promise<RecordEntry[]> {
  return fetchPublicTelemetryRecords(params);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ModelFitPreviewPage() {
  const [filterPending, startFilterTransition] = useTransition();
  const [data, setData] = useState<LeaderboardEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [appVersions, setAppVersions] = useState<string[]>([]);
  const [buildModes, setBuildModes] = useState<string[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [selectedBackend, setSelectedBackend] = useState<string[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<string[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string[]>([]);
  const [selectedBuildMode, setSelectedBuildMode] = useState<string[]>([]);
  const [selectedSize, setSelectedSize] = useState<string[]>([]);
  const [selectedModelTag, setSelectedModelTag] = useState<string[]>(['Chat']);
  const [selectedBrand, setSelectedBrand] = useState<string[]>([]);
  const [selectedSoc, setSelectedSoc] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const [renderedRowLimit, setRenderedRowLimit] = useState(INITIAL_RENDERED_ROWS);
  const [reloadKey, setReloadKey] = useState(0);
  const [filtersReady, setFiltersReady] = useState(false);
  const [filtersError, setFiltersError] = useState<string | null>(null);
  const [filtersLoading, setFiltersLoading] = useState(true);
  const [loadedQueryKey, setLoadedQueryKey] = useState<string | null>(null);
  const queryKey = telemetryQueryKey(selectedVersion, selectedBuildMode);
  const resultsReady = filtersReady && !loading && !error && loadedQueryKey === queryKey;
  const actionsReady =
    resultsReady && !filterPending && deferredSearch === search.trim().toLowerCase();
  const [sidebarError, setSidebarError] = useState<string | null>(null);
  const recordsRequest = useRef<AbortController | null>(null);
  const sidebarDialog = useRef<HTMLDialogElement>(null);
  const [sidebar, setSidebar] = useState<SidebarState>({
    open: false,
    loading: false,
    records: [],
    cellInfo: null,
  });

  useEffect(() => {
    let saved = defaultTelemetryFilters();
    try {
      saved = parseTelemetryFilterState(localStorage.getItem(FILTER_STORAGE_KEY)) ?? {
        ...saved,
        selectedModelTag: readLegacyFilter(LS_KEY_MODEL_TAG, ['Chat']),
        selectedSize: readLegacyFilter(LS_KEY_SIZE, []),
        selectedBrand: readLegacyFilter(LS_KEY_BRAND, []),
      };
    } catch {
      /* Storage may be unavailable; filters still work in memory. */
    }
    setSelectedPlatforms(saved.selectedPlatforms);
    setSelectedBackend(saved.selectedBackend);
    setSelectedBatch(saved.selectedBatch);
    setSelectedModelTag(saved.selectedModelTag);
    setSelectedSize(saved.selectedSize);
    setSelectedBrand(saved.selectedBrand);
    setSelectedSoc(saved.selectedSoc);
    setSelectedVersion(saved.selectedVersion);
    setSelectedBuildMode(saved.selectedBuildMode);
    setSearch(saved.search);
    setFiltersReady(true);
  }, []);

  useEffect(() => {
    if (!filtersReady) return;
    try {
      localStorage.setItem(
        FILTER_STORAGE_KEY,
        JSON.stringify({
          selectedPlatforms,
          selectedBackend,
          selectedBatch,
          selectedModelTag,
          selectedSize,
          selectedBrand,
          selectedSoc,
          selectedVersion,
          selectedBuildMode,
          search,
        }),
      );
    } catch {
      /* A blocked storage area must not interrupt querying. */
    }
  }, [
    filtersReady,
    selectedPlatforms,
    selectedBackend,
    selectedBatch,
    selectedModelTag,
    selectedSize,
    selectedBrand,
    selectedSoc,
    selectedVersion,
    selectedBuildMode,
    search,
  ]);

  useEffect(() => {
    const controller = new AbortController();
    setFiltersLoading(true);
    setFiltersError(null);
    fetchFilters(controller.signal)
      .then((filters) => {
        if (controller.signal.aborted) return;
        setAppVersions(filters.appVersions);
        setBuildModes(filters.buildModes);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFiltersError('版本与构建模式选项加载失败，请重试。');
      })
      .finally(() => {
        if (!controller.signal.aborted) setFiltersLoading(false);
      });
    return () => controller.abort();
  }, [reloadKey]);

  useEffect(() => {
    if (!filtersReady) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetchLeaderboard(selectedVersion, selectedBuildMode, controller.signal)
      .then((entries) => {
        if (!controller.signal.aborted) {
          setData(entries);
          setLoadedQueryKey(queryKey);
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setError(error instanceof Error ? error.message : '查询失败');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [filtersReady, selectedBuildMode, selectedVersion, queryKey, reloadKey]);

  useEffect(() => () => recordsRequest.current?.abort(), []);

  useEffect(() => {
    if (sidebar.open) sidebarDialog.current?.showModal();
  }, [sidebar.open]);

  const selections = useMemo(
    () => ({
      selectedPlatforms,
      selectedBackend,
      selectedBatch,
      selectedSize,
      selectedModelTag,
      selectedBrand,
      selectedSoc,
    }),
    [
      selectedPlatforms,
      selectedBackend,
      selectedBatch,
      selectedSize,
      selectedModelTag,
      selectedBrand,
      selectedSoc,
    ],
  );

  // Search and facets use the same population. A facet ignores only its own group
  // so multi-select remains OR within a group and AND between groups.
  const searchedData = useMemo(
    () =>
      (data ?? []).filter(
        (entry) =>
          !deferredSearch ||
          [
            entry.socName,
            formatSocFilterLabel(entry),
            ...entry.deviceModels,
            ...entry.deviceDisplayNames,
            entry.modelName,
            entry.modelFileName,
            entry.backend,
          ]
            .join(' ')
            .toLowerCase()
            .includes(deferredSearch),
      ),
    [data, deferredSearch],
  );
  const options = useMemo(
    () => getTelemetryFilterOptions(searchedData, selections),
    [searchedData, selections],
  );
  const filteredData = useMemo(
    () => (resultsReady ? filterLeaderboardData(searchedData, selections) : []),
    [resultsReady, searchedData, selections],
  );

  const handleResetFilters = useCallback(() => {
    setSearch('');
    startFilterTransition(() => {
      setSelectedPlatforms([]);
      setSelectedBackend([]);
      setSelectedBatch([]);
      setSelectedModelTag([]);
      setSelectedSize([]);
      setSelectedBrand([]);
      setSelectedSoc([]);
      setSelectedVersion([]);
      setSelectedBuildMode([]);
    });
  }, [startFilterTransition]);

  // Build matrix for current platform selection.
  const { platforms, weightColumns } = useMemo(() => {
    if (filteredData.length === 0) return { platforms: [], weightColumns: [] };
    return buildPlatforms(filteredData, null);
  }, [filteredData]);

  // Merge all selected platform rows, keeping the platform label visible in the SoC header.
  const displayRows = useMemo<DisplayRow[]>(() => {
    return platforms.flatMap((p) => p.rows.map((r) => ({ ...r, osLabel: p.label, osId: p.id })));
  }, [platforms]);

  useEffect(() => {
    setRenderedRowLimit(Math.min(INITIAL_RENDERED_ROWS, displayRows.length));
  }, [displayRows.length, weightColumns.length]);

  useEffect(() => {
    if (renderedRowLimit >= displayRows.length) return;
    return scheduleRowRender(() => {
      setRenderedRowLimit((current) => Math.min(current + RENDER_ROW_CHUNK, displayRows.length));
    });
  }, [displayRows.length, renderedRowLimit]);

  const renderedDisplayRows = useMemo(
    () => displayRows.slice(0, renderedRowLimit),
    [displayRows, renderedRowLimit],
  );

  const matrixGridStyle = useMemo<CSSProperties>(
    () => ({
      gridTemplateColumns: `var(--soc-column-width) repeat(${Math.max(weightColumns.length, 1)}, var(--metric-column-width))`,
    }),
    [weightColumns.length],
  );

  const exportFileBaseName = useMemo(() => {
    const parts = [
      'model-fit-preview',
      sanitizeFileNamePart(
        formatFilterSelection(selectedPlatforms, 'all-platforms', (os) => OS_LABELS[os] ?? os),
      ),
      sanitizeFileNamePart(
        formatFilterSelection(selectedBatch, 'all-batches', (batchCount) => `batch-${batchCount}`),
      ),
      sanitizeFileNamePart(formatFilterSelection(selectedBackend, 'all-backends')),
      sanitizeFileNamePart(formatFilterSelection(selectedModelTag, 'all-types')),
      sanitizeFileNamePart(formatFilterSelection(selectedSize, 'all-weights')),
      sanitizeFileNamePart(formatFilterSelection(selectedBrand, 'all-brands', capitalizeBrand)),
      sanitizeFileNamePart(
        formatFilterSelection(selectedSoc, 'all-socs', (socName) =>
          formatSocFilterLabel({ socName }),
        ),
      ),
      sanitizeFileNamePart(
        formatFilterSelection(selectedVersion, 'all-versions', (version) => `v-${version}`),
      ),
      sanitizeFileNamePart(
        formatFilterSelection(
          selectedBuildMode,
          'all-build-modes',
          (buildMode) => BUILD_MODE_LABELS[buildMode] ?? buildMode,
        ),
      ),
      new Date().toISOString().replace(/[:.]/g, '-'),
    ];
    return parts.join('__');
  }, [
    selectedBatch,
    selectedBackend,
    selectedBrand,
    selectedBuildMode,
    selectedModelTag,
    selectedPlatforms,
    selectedSize,
    selectedSoc,
    selectedVersion,
  ]);

  const handleExportRow = useCallback(
    (row: DisplayRow) => {
      if (!actionsReady) return;
      const socDisplay = getSocDisplayInfo({
        socName: row.socName,
        socBrand: row.socBrand,
        deviceModels: row.deviceModels,
      });
      const platform = row.osLabel ?? OS_LABELS[row.osId] ?? row.osId;
      const vendor = capitalizeBrand(socDisplay.brand) || '—';
      const visibleColumns = weightColumns.filter((column) => row.cells[column.key]);
      const rowEntries = filteredData
        .filter((entry) => entry.socName === row.socName && entry.os === row.osId)
        .filter((entry) => visibleColumns.some((column) => column.key === columnKey(entry)));
      const filename = `${exportFileBaseName}__${sanitizeFileNamePart(socDisplay.primaryLabel)}.html`;
      const generatedAt = new Date().toISOString();
      const filters: Array<{ label: string; value: string }> = [
        { label: 'Platform', value: platform },
        {
          label: 'Batch',
          value: formatFilterSelection(selectedBatch, '不限制', (value) => `x${value}`),
        },
        { label: 'Backend', value: formatFilterSelection(selectedBackend, '不限制') },
        { label: 'Type', value: formatFilterSelection(selectedModelTag, '不限制') },
        { label: 'Weight', value: formatFilterSelection(selectedSize, '不限制') },
        { label: 'Chip', value: socDisplay.primaryLabel },
        {
          label: 'App Version',
          value: formatFilterSelection(selectedVersion, '不限制', (value) => `v${value}`),
        },
        {
          label: 'Build Mode',
          value: formatFilterSelection(
            selectedBuildMode,
            '不限制',
            (value) => BUILD_MODE_LABELS[value] ?? value,
          ),
        },
      ];
      if (socDisplay.secondaryLabel) {
        filters.splice(5, 0, { label: 'Device', value: socDisplay.secondaryLabel });
      }
      if (socDisplay.metaLabel) {
        filters.splice(6, 0, { label: 'Apple ID', value: socDisplay.metaLabel });
      }
      if (selectedBrand.length > 0) {
        filters.splice(4, 0, {
          label: 'Vendor Filter',
          value: selectedBrand.map((brand) => capitalizeBrand(brand)).join(' / '),
        });
      }

      const html = buildSocReportHtml({
        filename,
        title: socDisplay.primaryLabel,
        generatedAt,
        platform,
        vendor,
        filters,
        weights: visibleColumns.map((column) => {
          const cell = row.cells[column.key]!;
          return {
            label: getWeightColumnReportLabel(column),
            prefill: cell.prefillDisplay,
            decodeRaw: cell.decodeRawDisplay,
            decodePerBatch: cell.metricBasis === 'decode_div_batch' ? cell.decodeDisplay : null,
            isBatch: cell.metricBasis === 'decode_div_batch',
            metricNote: formatMetricBasisLabel(cell.metricBasis),
            sampleCount: cell.sampleCount,
          };
        }),
        statistics: rowEntries.map((entry) => {
          const display = getDisplaySpeeds(entry);
          return {
            reportColumn: getEntryReportLabel(entry),
            modelName: entry.modelName,
            modelFileName: entry.modelFileName,
            displayPrefill: display.prefill,
            displayDecodeRaw: display.decodeRaw,
            displayDecodePerBatch:
              display.metricBasis === 'decode_div_batch' ? display.decode : null,
            displayMetricBasis: formatMetricBasisLabel(display.metricBasis),
            sampleCount: entry.sampleCount,
            backend: entry.backend,
            batchCount: entry.batchCount,
            isBatch: display.metricBasis === 'decode_div_batch',
          };
        }),
      });

      openHtmlReport(filename, html);
    },
    [
      actionsReady,
      exportFileBaseName,
      filteredData,
      selectedBatch,
      selectedBackend,
      selectedBrand,
      selectedBuildMode,
      selectedModelTag,
      selectedSize,
      selectedVersion,
      weightColumns,
    ],
  );

  const handleCellClick = useCallback(
    async (cell: MatrixCell, weightLabel: string) => {
      if (!actionsReady) return;
      const socLabel = formatSocFilterLabel({ socName: cell.socName });
      const info = {
        socName: cell.socName,
        modelSha256: cell.modelSha256,
        backend: cell.backend,
        isBatch: cell.isBatch,
        os: cell.os,
        label: `${socLabel} × ${weightLabel}`,
      };
      recordsRequest.current?.abort();
      const controller = new AbortController();
      recordsRequest.current = controller;
      setSidebarError(null);
      setSidebar({ open: true, loading: true, records: [], cellInfo: info });

      try {
        const records = await fetchRecords({
          signal: controller.signal,
          socName: cell.socName,
          modelSha256: cell.modelSha256,
          backend: cell.backend,
          isBatch: cell.isBatch,
          batchCount: cell.batchCount,
          os: cell.os,
          appVersions: selectedVersion,
          buildModes: selectedBuildMode,
        });
        if (!controller.signal.aborted)
          setSidebar((prev) => ({ ...prev, loading: false, records }));
      } catch {
        if (!controller.signal.aborted) {
          setSidebarError('明细加载失败，请关闭后重试。');
          setSidebar((prev) => ({ ...prev, loading: false }));
        }
      }
    },
    [actionsReady, selectedBuildMode, selectedVersion],
  );

  const closeSidebar = useCallback(() => {
    recordsRequest.current?.abort();
    sidebarDialog.current?.close();
    setSidebar({ open: false, loading: false, records: [], cellInfo: null });
  }, []);

  return (
    <main className={styles.main}>
      {/* Navbar */}
      <div className={styles.navbarWrap}>
        <nav className={styles.navbar}>
          <a href="/" className={styles.navLeft}>
            <span className={styles.navTitle}>RWKV Chat</span>
          </a>
          <div className={styles.navRight}>
            <ThemeSwitcher />
          </div>
        </nav>
      </div>

      <div className={styles.container}>
        <section className={styles.hero}>
          <div className={styles.heroHeader}>
            <p className={styles.eyebrow}>RWKV · 社区实测</p>
            <Link href="/labs/model-fit-preview/records" className={styles.heroActionLink}>
              <span aria-hidden="true">↗</span>
              全部上报数据
            </Link>
          </div>
          <h1 className={styles.title}>模型性能查询</h1>
          <p className={styles.description}>
            查找你的设备，比较不同模型的推理速度。数据来自用户匿名上报，实际表现会随设备状态和运行配置变化。
          </p>
        </section>

        <>
          {/* Filters */}
          <section className={styles.tabSection} aria-label="查询条件">
            <div className={styles.searchToolbar}>
              <label className={styles.searchLabel}>
                <span>查找设备或模型</span>
                <input
                  type="search"
                  placeholder="搜索芯片、设备、模型或推理后端…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
              <button type="button" className={styles.resetButton} onClick={handleResetFilters}>
                重置筛选
              </button>
            </div>
            <FilterGroup
              label="平台"
              options={options.selectedPlatforms}
              selected={selectedPlatforms}
              onChange={(values) => startFilterTransition(() => setSelectedPlatforms(values))}
              pending={!resultsReady}
              format={(value) => OS_LABELS[value] ?? value}
            />
            <FilterGroup
              label="类型"
              options={options.selectedModelTag}
              selected={selectedModelTag}
              onChange={(values) => startFilterTransition(() => setSelectedModelTag(values))}
              pending={!resultsReady}
              format={(value) => MODEL_TAG_LABELS[value] ?? value}
            />
            <FilterGroup
              label="权重大小"
              options={options.selectedSize}
              selected={selectedSize}
              onChange={(values) => startFilterTransition(() => setSelectedSize(values))}
              pending={!resultsReady}
            />
            <FilterGroup
              label="并发"
              options={options.selectedBatch}
              selected={selectedBatch}
              onChange={(values) => startFilterTransition(() => setSelectedBatch(values))}
              pending={!resultsReady}
              format={(value) => (value === '1' ? '单条' : `batch×${value}`)}
            />
            <FilterGroup
              label="Backend"
              options={options.selectedBackend}
              selected={selectedBackend}
              onChange={(values) => startFilterTransition(() => setSelectedBackend(values))}
              pending={!resultsReady}
            />
            <FilterGroup
              label="品牌"
              options={options.selectedBrand}
              selected={selectedBrand}
              onChange={(values) => startFilterTransition(() => setSelectedBrand(values))}
              pending={!resultsReady}
              format={(value) => (
                <>
                  <BrandIcon brand={value} className={styles.brandFilterIcon} />
                  {BRAND_LABELS[value] ?? value}
                </>
              )}
            />
            <FilterGroup
              label="SoC"
              valueKey={telemetrySocKey}
              options={options.selectedSoc}
              selected={selectedSoc}
              onChange={(values) => startFilterTransition(() => setSelectedSoc(values))}
              pending={!resultsReady}
              format={(value) => formatSocFilterLabel({ socName: value })}
            />
            <FilterGroup
              label="APP 版本"
              options={appVersions}
              selected={selectedVersion}
              onChange={setSelectedVersion}
              pending={filtersLoading || !!filtersError}
              format={(value) => `v${value}`}
            />
            <FilterGroup
              label="构建模式"
              options={buildModes}
              selected={selectedBuildMode}
              onChange={setSelectedBuildMode}
              pending={filtersLoading || !!filtersError}
              format={(value) => BUILD_MODE_LABELS[value] ?? value}
            />
            {filtersError ? (
              <div role="alert" className={styles.filterMessage}>
                {filtersError}
                <button
                  className={styles.resetButton}
                  onClick={() => setReloadKey((value) => value + 1)}
                >
                  重试选项
                </button>
              </div>
            ) : null}
            <div className={styles.metaBlock} role="status" aria-live="polite">
              <span>
                <strong>{displayRows.length}</strong> 个芯片 / 平台
              </span>
              <span>
                <strong>{weightColumns.length}</strong> 组模型配置
              </span>
              <span>
                {!resultsReady && !error
                  ? '正在更新查询…'
                  : '组内多选取并集 · 组间取交集 · 单位 tokens/s'}
              </span>
              {error ? (
                <span role="alert">
                  查询失败，请重试；已保留所有筛选条件。
                  <button
                    className={styles.resetButton}
                    onClick={() => setReloadKey((value) => value + 1)}
                  >
                    重试
                  </button>
                </span>
              ) : null}
            </div>
          </section>

          {/* Table */}
          {displayRows.length === 0 ? (
            <section className={styles.comingSoonBox}>
              <h3 className={styles.comingSoonTitle}>
                {error
                  ? '性能数据加载失败'
                  : !resultsReady
                    ? '正在加载性能数据…'
                    : '没有匹配的性能记录'}
              </h3>
              <p className={styles.comingSoonText}>
                {error
                  ? '请使用上方重试按钮重新查询。'
                  : !resultsReady
                    ? '正在获取当前版本与构建模式的数据。'
                    : '已保留所有选择。可取消标注“无匹配”的条件，或减少筛选条件。无上报记录不代表硬件不支持。'}
              </p>
            </section>
          ) : (
            <>
              <section className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>
                  {formatFilterSelection(selectedPlatforms, '全平台', (os) => OS_LABELS[os] ?? os)}{' '}
                  性能矩阵
                </h2>
                <p className={styles.sectionDescription}>
                  Prefill 为输入处理速度，Decode
                  为生成速度。点击成绩查看样本；左右滚动对比模型，芯片名称固定在左侧。
                </p>
              </section>

              <section className={styles.tableSection} aria-busy={loading}>
                <div className={styles.tableWrap}>
                  <div className={styles.matrixGrid} style={matrixGridStyle}>
                    <div className={`${styles.rowHead} ${styles.cornerHead}`}>SoC</div>
                    {weightColumns.map((col, colIndex) => (
                      <div
                        key={col.key}
                        className={`${styles.weightHead} ${colIndex === weightColumns.length - 1 ? styles.lastCol : ''}`}
                      >
                        <div className={styles.weightTitle}>{col.label}</div>
                        <div className={styles.weightName} title={col.fileName}>
                          {col.modelName || col.fileName}
                        </div>
                        <div className={styles.weightMeta}>
                          {col.modelTag !== 'Chat' ? (
                            <span className={styles.modelTag}>{col.modelTag}</span>
                          ) : null}
                          {col.isBatch ? (
                            <span className={styles.batchTag}>×{col.batchCount}</span>
                          ) : null}
                          {col.quant} · {col.backend}
                        </div>
                      </div>
                    ))}

                    {renderedDisplayRows.flatMap((row, rowIndex) => {
                      const rowKey = `${row.osLabel ?? ''}-${row.socName}`;
                      const isLastRow = rowIndex === renderedDisplayRows.length - 1;
                      const rowHeadClass = `${styles.rowCell} ${isLastRow ? styles.lastRow : ''}`;
                      const socDisplay = getSocDisplayInfo({
                        socName: row.socName,
                        socBrand: row.socBrand,
                        deviceModels: row.deviceModels,
                      });
                      const rowPlatformLabel = row.osLabel ?? OS_LABELS[row.osId] ?? row.osId;
                      const rowDeviceSummary = summarizeHeaderDeviceModels({
                        deviceLabels: row.deviceDisplayNames,
                        fallbackDeviceModels: row.deviceModels,
                      });
                      const rowMeta = [
                        rowPlatformLabel,
                        rowDeviceSummary &&
                        rowDeviceSummary !== socDisplay.secondaryLabel &&
                        rowDeviceSummary !== socDisplay.metaLabel
                          ? rowDeviceSummary
                          : null,
                        socDisplay.metaLabel,
                      ]
                        .filter(Boolean)
                        .join(' · ');
                      const ariaSocLabel = formatSocFilterLabel({
                        socName: row.socName,
                        socBrand: row.socBrand,
                        deviceModels: row.deviceModels,
                      });

                      return [
                        <div key={`${rowKey}__head`} className={rowHeadClass}>
                          <div className={styles.rowTopline}>
                            {socDisplay.brand !== 'unknown' ? (
                              <span className={styles.vendorTag}>
                                <BrandIcon brand={socDisplay.brand} className={styles.vendorIcon} />
                                {capitalizeBrand(socDisplay.brand)}
                              </span>
                            ) : null}
                            <strong className={styles.rowName}>{socDisplay.primaryLabel}</strong>
                            <button
                              type="button"
                              className={styles.rowExportButton}
                              disabled={!actionsReady}
                              onClick={() => handleExportRow(row)}
                              aria-label={`打开 ${ariaSocLabel} 报表`}
                            >
                              报表
                            </button>
                          </div>
                          {socDisplay.secondaryLabel ? (
                            <div className={styles.rowSubtitle}>{socDisplay.secondaryLabel}</div>
                          ) : null}
                          {rowMeta ? <div className={styles.rowMeta}>{rowMeta}</div> : null}
                        </div>,
                        ...weightColumns.map((col, colIndex) => {
                          const cell = row.cells[col.key];
                          const isLastCol = colIndex === weightColumns.length - 1;
                          const cellBaseClass = `${styles.speedCell} ${isLastCol ? styles.lastCol : ''} ${isLastRow ? styles.lastRow : ''}`;

                          if (!cell) {
                            return <div key={`${rowKey}__${col.key}`} className={cellBaseClass} />;
                          }

                          const prefill = cell.prefillDisplay;
                          const decode = cell.decodeDisplay;
                          const decodeRaw = cell.decodeRawDisplay;
                          const isBatchMetric = cell.metricBasis === 'decode_div_batch';
                          return (
                            <button
                              key={`${rowKey}__${col.key}`}
                              type="button"
                              className={`${cellBaseClass} ${buildCellClass(decode)} ${styles.speedCellClickable} ${styles.matrixButtonCell}`}
                              disabled={!actionsReady}
                              onClick={() => handleCellClick(cell, col.label)}
                              aria-label={
                                isBatchMetric
                                  ? `${ariaSocLabel} ${col.label} prefill ${formatSpeed(prefill)} decode ${formatSpeed(decodeRaw)} decode per batch ${formatSpeed(decode)}`
                                  : `${ariaSocLabel} ${col.label} prefill ${formatSpeed(prefill)} decode ${formatSpeed(decode)}`
                              }
                            >
                              <div className={styles.metricLine}>
                                <span className={styles.metricLabel}>Prefill</span>
                                <strong className={styles.metricValue}>
                                  {formatSpeed(prefill)}
                                </strong>
                              </div>
                              <div className={styles.metricLine}>
                                <span className={styles.metricLabel}>Decode</span>
                                <strong className={styles.metricValue}>
                                  {formatSpeed(isBatchMetric ? decodeRaw : decode)}
                                </strong>
                              </div>
                              {isBatchMetric ? (
                                <div className={styles.metricLine}>
                                  <span className={styles.metricLabel}>Decode / Batch</span>
                                  <strong className={styles.metricValue}>
                                    {formatSpeed(decode)}
                                  </strong>
                                </div>
                              ) : null}
                              <div className={styles.noteTag}>{getCellFooterNote(cell)}</div>
                            </button>
                          );
                        }),
                      ];
                    })}
                  </div>
                </div>
              </section>
            </>
          )}

          {/* Legend */}
          <section className={styles.legend}>
            <div className={styles.legendItem}>
              <span className={`${styles.legendSwatch} ${styles.cellStrong}`} />
              <span>着色值 ≥ 35</span>
            </div>
            <div className={styles.legendItem}>
              <span className={`${styles.legendSwatch} ${styles.cellGood}`} />
              <span>着色值 15-34.9</span>
            </div>
            <div className={styles.legendItem}>
              <span className={`${styles.legendSwatch} ${styles.cellTight}`} />
              <span>着色值 6-14.9</span>
            </div>
            <div className={styles.legendItem}>
              <span className={`${styles.legendSwatch} ${styles.cellWeak}`} />
              <span>着色值 &lt; 6</span>
            </div>
          </section>

          <section className={styles.notes}>
            <h3 className={styles.notesTitle}>统计与导出说明</h3>
            <ul className={styles.notesList}>
              <li>非 batch 单元格显示 top 10% 位次的 Prefill / Decode。</li>
              <li>
                batch 单元格同时显示 Decode 总值和 Decode / Batch，颜色按 Decode / Batch 计算。
              </li>
              <li>
                样本来自社区上报，不同后端、量化、并发和构建模式应分别比较；不作为官方兼容性保证。
              </li>
              <li>
                芯片旁的「报表」包含当前筛选下的全部模型统计，与矩阵中的筛选结果一致。空白单元格表示暂无样本，不代表不支持。
              </li>
            </ul>
          </section>
        </>
      </div>

      {/* Sidebar */}
      {sidebar.open ? (
        <>
          <dialog
            ref={sidebarDialog}
            className={styles.sidebar}
            aria-label={sidebar.cellInfo?.label ?? '性能样本'}
            onCancel={closeSidebar}
            onClick={(event) => {
              if (event.target === event.currentTarget) closeSidebar();
            }}
          >
            <div className={styles.sidebarHeader}>
              <h3 className={styles.sidebarTitle}>{sidebar.cellInfo?.label ?? 'Records'}</h3>
              <button
                type="button"
                className={styles.sidebarClose}
                aria-label="关闭明细"
                onClick={closeSidebar}
              >
                ✕
              </button>
            </div>

            {sidebar.loading ? (
              <div className={styles.sidebarLoading}>加载中...</div>
            ) : sidebarError ? (
              <div className={styles.sidebarLoading} role="alert">
                {sidebarError}
              </div>
            ) : sidebar.records.length === 0 ? (
              <div className={styles.sidebarLoading}>暂无明细记录</div>
            ) : (
              <div className={styles.sidebarRecords}>
                <div className={styles.recordTableHeader}>
                  <span className={styles.recordColSpeed}>Prefill</span>
                  <span className={styles.recordColSpeed}>Decode</span>
                  <span className={styles.recordColInfo}>Backend</span>
                  <span className={styles.recordColInfo}>Device</span>
                  <span className={styles.recordColInfo}>Hardware</span>
                  <span className={styles.recordColInfo}>Memory</span>
                  <span className={styles.recordColInfo}>Version</span>
                  <span className={styles.recordColInfo}>Time</span>
                  <span className={styles.recordColAction}>Details</span>
                </div>
                {sidebar.records.map((r) => {
                  // Memory: VRAM 优先（Windows/Linux），否则总内存
                  const memoryLabel = r.totalVramMb
                    ? `${(r.totalVramMb / 1024).toFixed(0)} GB VRAM`
                    : r.totalMemoryMb
                      ? `${(r.totalMemoryMb / 1024).toFixed(0)} GB`
                      : '—';
                  const deviceLabel = getRecordDeviceLabel(r);
                  const hardwareLabel = getRecordHardwareLabel(r);
                  return (
                    <div key={r.id} className={styles.recordRow}>
                      <span className={styles.recordColSpeed}>
                        <strong>{r.prefillSpeed.toFixed(1)}</strong> t/s
                      </span>
                      <span className={styles.recordColSpeed}>
                        <strong>{r.decodeSpeed.toFixed(1)}</strong> t/s
                      </span>
                      <span className={styles.recordColInfo}>
                        {r.backend}
                        {r.isBatch ? ` batch×${r.batchCount}` : ''}
                      </span>
                      <span className={styles.recordColInfo}>
                        <span className={styles.recordPrimary}>{deviceLabel.primary}</span>
                        {deviceLabel.secondary ? (
                          <span className={styles.recordSecondary}>{deviceLabel.secondary}</span>
                        ) : null}
                      </span>
                      <span className={styles.recordColInfo}>
                        <span className={styles.recordPrimary}>{hardwareLabel.primary}</span>
                        {hardwareLabel.secondary ? (
                          <span className={styles.recordSecondary}>{hardwareLabel.secondary}</span>
                        ) : null}
                      </span>
                      <span className={styles.recordColInfo}>{memoryLabel}</span>
                      <span className={styles.recordColInfo}>{r.appVersion || '—'}</span>
                      <span className={styles.recordColInfo}>{formatTimestamp(r.createdAt)}</span>
                      <Link
                        href={`/labs/model-fit-preview/records?recordId=${r.id}`}
                        className={styles.recordDetailLink}
                      >
                        详情
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </dialog>
        </>
      ) : null}
    </main>
  );
}
