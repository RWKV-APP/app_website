'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ThemeSwitcher } from '@/components';
import { fetchAdminSession } from '@/utils/api';
import {
  resolveAndroidSocName,
  resolveAppleDevicePresentation,
  summarizeHeaderDeviceModels,
} from '@/utils/appleDeviceInfo';
import styles from './page.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LeaderboardEntry {
  os: string;
  modelSha256: string;
  modelName: string;
  modelFileName: string;
  modelSizeB: number | null;
  quantization: string | null;
  socName: string;
  socBrand: string;
  deviceModels: string[];
  deviceDisplayNames: string[];
  backend: string;
  isBatch: boolean;
  batchCount: number;
  sampleCount: number;
  decodeSpeed: { avg: number; max: number | null; top10: number | null };
  prefillSpeed: { avg: number; max: number | null; top10: number | null };
}

interface RecordEntry {
  id: number;
  socName: string;
  socBrand: string;
  os: string;
  osVersion: string | null;
  deviceModel: string | null;
  deviceDisplayName: string | null;
  cpuName: string | null;
  gpuName: string | null;
  totalMemoryMb: number | null;
  totalVramMb: number | null;
  appVersion: string;
  appBuild: string;
  modelName: string;
  modelFileName: string;
  modelSha256: string;
  modelSizeB: number | null;
  quantization: string | null;
  backend: string;
  isBatch: boolean;
  batchCount: number;
  prefillSpeed: number;
  decodeSpeed: number;
  clientTimestamp: string;
  createdAt: string;
}

interface WeightColumn {
  key: string; // modelSha256 + backend + batch dimension
  label: string;
  quant: string;
  backend: string;
  modelTag: string; // Chat / VL / TTS / Translate / Neko
  isBatch: boolean;
  batchCount: number;
  sortOrder: number;
}

type CellMetricBasis = 'top10' | 'decode_div_batch';

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

function readLs(key: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  return localStorage.getItem(key) ?? fallback;
}
function writeLs(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, value);
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

const OS_LABELS: Record<string, string> = {
  macos: 'macOS',
  android: '安卓',
  ios: 'iOS',
  windows: 'Windows',
  linux: 'Linux',
};

const OS_ORDER = ['macos', 'android', 'ios', 'windows', 'linux'];

const ALL_TAB_ID = '__all__';

const BRAND_LABELS: Record<string, string> = {
  apple: 'Apple',
  qualcomm: 'Qualcomm',
  snapdragon: 'Qualcomm',
  nvidia: 'NVIDIA',
  amd: 'AMD',
  intel: 'Intel',
  mediatek: 'MediaTek',
  samsung: 'Samsung',
};

const BRAND_ORDER = ['apple', 'qualcomm', 'nvidia', 'amd', 'intel', 'mediatek', 'samsung'];

/** 从 socName 推断 brand（当 socBrand 为 unknown 时） */
function inferBrand(socName: string, socBrand: string): string {
  if (socBrand && socBrand !== 'unknown') {
    // 统一 snapdragon → qualcomm
    if (socBrand.toLowerCase() === 'snapdragon') return 'qualcomm';
    return socBrand.toLowerCase();
  }
  const lower = socName.toLowerCase();
  if (lower.includes('rtx') || lower.includes('gtx') || lower.includes('nvidia')) return 'nvidia';
  if (lower.includes('radeon') || lower.includes('amd') || lower.includes('rx ')) return 'amd';
  if (lower.includes('intel') || lower.includes('arc ')) return 'intel';
  if (
    lower.includes('apple') ||
    lower.includes('iphone') ||
    lower.includes('ipad') ||
    lower.includes('ipod') ||
    /^a\d+(?:\s+(?:pro|max|bionic))?$/.test(lower.trim()) ||
    lower.includes(' m1') ||
    lower.includes(' m2') ||
    lower.includes(' m3') ||
    lower.includes(' m4')
  )
    return 'apple';
  if (lower.includes('mediatek') || lower.includes('dimensity') || lower.includes('helio'))
    return 'mediatek';
  if (lower.includes('exynos') || lower.includes('samsung')) return 'samsung';
  return 'unknown';
}

const MODEL_TAG_LABELS: Record<string, string> = {
  Chat: 'Chat',
  VL: 'VL',
  TTS: 'TTS',
  Translate: 'Translate',
  Neko: 'Neko',
};

function deriveWeightLabel(entry: LeaderboardEntry): string {
  const size = entry.modelSizeB;
  if (size != null && size > 0) {
    return `${size}B`;
  }
  const match = entry.modelFileName.match(/(\d+\.?\d*)B/i);
  if (match) return `${match[1]}B`;
  return entry.modelName || entry.modelFileName;
}

function deriveQuantLabel(entry: LeaderboardEntry): string {
  if (entry.quantization) return entry.quantization.toUpperCase();
  const match = entry.modelFileName.match(/\d+\.?\d*B[_-]?([\w_]+?)\.gguf/i);
  if (match) return match[1].toUpperCase();
  return entry.backend;
}

function deriveSortOrder(entry: LeaderboardEntry): number {
  if (entry.modelSizeB != null && entry.modelSizeB > 0) return entry.modelSizeB;
  const match = entry.modelFileName.match(/(\d+\.?\d*)B/i);
  if (match) return parseFloat(match[1]);
  return 999;
}

function capitalizeBrand(brand: string): string {
  if (!brand) return '';
  const map: Record<string, string> = {
    snapdragon: 'Qualcomm',
    qualcomm: 'Qualcomm',
    mediatek: 'MediaTek',
    apple: 'Apple',
    samsung: 'Samsung',
    nvidia: 'NVIDIA',
    amd: 'AMD',
    intel: 'Intel',
    unknown: '',
  };
  return map[brand.toLowerCase()] ?? brand.charAt(0).toUpperCase() + brand.slice(1);
}

function getSocDisplayInfo(input: {
  socName: string;
  socBrand?: string | null;
  deviceModel?: string | null;
  deviceModels?: string[] | null;
}): SocDisplayInfo {
  const applePresentation = resolveAppleDevicePresentation({
    socName: input.socName,
    deviceModel: input.deviceModel,
  });

  if (applePresentation) {
    const primaryLabel =
      applePresentation.socName ?? applePresentation.modelName ?? applePresentation.identifier ?? input.socName;
    const secondaryLabel =
      applePresentation.socName && applePresentation.modelName && applePresentation.modelName !== primaryLabel
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
  return [display.primaryLabel, display.secondaryLabel].filter(Boolean).join(' · ') || display.primaryLabel;
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
        record.deviceModel && record.deviceModel !== record.deviceDisplayName ? record.deviceModel : null,
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
        rawHardwareSummary !== '—' && rawHardwareSummary !== androidSocName ? rawHardwareSummary : null,
    };
  }

  return {
    primary: rawHardwareSummary,
    secondary: null,
  };
}

function formatSpeed(value: number | null): string {
  if (value === null || value === undefined) return '—';
  return value % 1 === 0 ? value.toFixed(0) : value.toFixed(1);
}

function formatHardwareSummary(cpuName: string | null, gpuName: string | null): string {
  if (cpuName && gpuName) return `${cpuName} / ${gpuName}`;
  if (cpuName) return cpuName;
  if (gpuName) return gpuName;
  return '—';
}

function deriveModelTag(entry: LeaderboardEntry): string {
  const name = (entry.modelName || entry.modelFileName).toLowerCase();
  if (
    name.includes('-vl') ||
    name.includes('_vl') ||
    name.includes(' vl') ||
    name.includes('rwkv-vl')
  )
    return 'VL';
  if (name.includes('tts') || name.includes('spark') || name.includes('voice')) return 'TTS';
  if (name.includes('translate') || name.includes('-trans') || name.includes('translation'))
    return 'Translate';
  if (name.includes('neko')) return 'Neko';
  return 'Chat';
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

function isBatchColumn(input: { isBatch: boolean; batchCount: number }): boolean {
  return input.isBatch && input.batchCount > 1;
}

function getMetricBasis(input: { isBatch: boolean; batchCount: number }): CellMetricBasis {
  return isBatchColumn(input) ? 'decode_div_batch' : 'top10';
}

function getDisplaySpeeds(entry: LeaderboardEntry): {
  prefill: number | null;
  decode: number | null;
  decodeRaw: number | null;
  metricBasis: CellMetricBasis;
} {
  const metricBasis = getMetricBasis(entry);
  const prefillBase = entry.prefillSpeed.top10 ?? entry.prefillSpeed.max ?? entry.prefillSpeed.avg;
  const decodeBase = entry.decodeSpeed.top10 ?? entry.decodeSpeed.max ?? entry.decodeSpeed.avg;
  if (metricBasis === 'decode_div_batch') {
    return {
      prefill: prefillBase,
      decode: entry.batchCount > 0 ? decodeBase / entry.batchCount : decodeBase,
      decodeRaw: decodeBase,
      metricBasis,
    };
  }
  return {
    prefill: prefillBase,
    decode: decodeBase,
    decodeRaw: decodeBase,
    metricBasis,
  };
}

function formatMetricBasisLabel(metricBasis: CellMetricBasis): string {
  return metricBasis === 'decode_div_batch' ? 'decode / batchCount' : 'top10';
}

function getCellFooterNote(cell: MatrixCell): string {
  if (cell.isBatch && cell.batchCount > 1) {
    return `Batch ×${cell.batchCount} · ${cell.sampleCount}次测评`;
  }
  return `${cell.sampleCount}次测评`;
}

function filterLeaderboardData(
  data: LeaderboardEntry[],
  filters: {
    selectedBatch: string;
    selectedSize: string;
    selectedModelTag: string;
    selectedBrand: string;
    selectedSoc: string;
  },
): LeaderboardEntry[] {
  let filtered = data;
  if (filters.selectedBatch !== 'all') {
    const batchCount = parseInt(filters.selectedBatch, 10);
    filtered = filtered.filter((entry) => entry.batchCount === batchCount);
  }
  if (filters.selectedSize !== 'all') {
    filtered = filtered.filter((entry) => deriveWeightLabel(entry) === filters.selectedSize);
  }
  if (filters.selectedModelTag !== 'all') {
    filtered = filtered.filter((entry) => deriveModelTag(entry) === filters.selectedModelTag);
  }
  if (filters.selectedBrand !== 'all') {
    filtered = filtered.filter((entry) => inferBrand(entry.socName, entry.socBrand) === filters.selectedBrand);
  }
  if (filters.selectedSoc !== 'all') {
    filtered = filtered.filter((entry) => entry.socName === filters.selectedSoc);
  }
  return filtered;
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
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'all';
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
    .map((item) => `<span class="chip"><strong>${escapeHtml(item.label)}:</strong> ${escapeHtml(item.value)}</span>`)
    .join('');

  const rowsHtml = input.weights
    .map((item) => `
      <tr>
        <td>${escapeHtml(input.title)}</td>
        <td>${escapeHtml(item.label)}</td>
        <td>${escapeHtml(formatSpeed(item.prefill))}</td>
        <td>${escapeHtml(formatSpeed(item.decodeRaw))}</td>
        <td>${escapeHtml(item.isBatch ? formatSpeed(item.decodePerBatch) : '—')}</td>
        <td>${escapeHtml(item.metricNote)}</td>
        <td>${escapeHtml(String(item.sampleCount))}</td>
      </tr>
    `)
    .join('');

  const statisticsRowsHtml = input.statistics
    .map((item) => `
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
    `)
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

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

const getApiBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'rwkv.halowang.cloud') {
      return 'https://api.rwkv.halowang.cloud';
    }
    // dev 模式：Next.js rewrites 已将 /public-api/* 代理到 localhost:3001
    return '';
  }
  return '';
};

async function fetchLeaderboard(appVersion?: string): Promise<LeaderboardEntry[]> {
  const base = getApiBaseUrl();
  const qs = new URLSearchParams({ limit: '5000' });
  if (appVersion && appVersion !== 'all') qs.set('appVersion', appVersion);
  const res = await fetch(`${base}/public-api/telemetry/leaderboard?${qs}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchFilters(): Promise<{ appVersions: string[] }> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/public-api/telemetry/filters`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchRecords(params: {
  socName: string;
  modelSha256: string;
  backend: string;
  isBatch: boolean;
  batchCount: number;
  os?: string;
  appVersion?: string;
}): Promise<RecordEntry[]> {
  const base = getApiBaseUrl();
  const qs = new URLSearchParams({
    socName: params.socName,
    modelSha256: params.modelSha256,
    backend: params.backend,
    isBatch: String(params.isBatch),
    batchCount: String(params.batchCount),
    limit: '100',
  });
  if (params.os) qs.set('os', params.os);
  if (params.appVersion && params.appVersion !== 'all') qs.set('appVersion', params.appVersion);
  const res = await fetch(`${base}/public-api/telemetry/records?${qs}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ModelFitPreviewPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [data, setData] = useState<LeaderboardEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [appVersions, setAppVersions] = useState<string[]>([]);
  const [selectedTab, setSelectedTab] = useState<string>('');
  const [selectedBatch, setSelectedBatch] = useState<string>('all');
  const [selectedVersion, setSelectedVersion] = useState<string>('all');
  const [selectedSize, setSelectedSize] = useState<string>(() => readLs(LS_KEY_SIZE, 'all'));
  const [selectedModelTag, setSelectedModelTag] = useState<string>(() =>
    readLs(LS_KEY_MODEL_TAG, 'Chat'),
  );
  const [selectedBrand, setSelectedBrand] = useState<string>(() => readLs(LS_KEY_BRAND, 'all'));
  const [selectedSoc, setSelectedSoc] = useState<string>('all');
  const [sidebar, setSidebar] = useState<SidebarState>({
    open: false,
    loading: false,
    records: [],
    cellInfo: null,
  });

  // Auth guard: redirect to login if not authenticated
  useEffect(() => {
    fetchAdminSession()
      .then((session) => {
        if (!session) {
          router.replace('/admin/login?next=/labs/model-fit-preview');
          return;
        }
        setAuthed(true);
      })
      .catch(() => {
        router.replace('/admin/login?next=/labs/model-fit-preview');
      });
  }, [router]);

  // Load available filters once
  useEffect(() => {
    if (!authed) return;
    fetchFilters()
      .then((f) => setAppVersions(f.appVersions))
      .catch(() => {});
  }, [authed]);

  // Fetch leaderboard data (re-fetch when version filter changes)
  useEffect(() => {
    if (!authed) return;
    setLoading(true);
    fetchLeaderboard(selectedVersion)
      .then((entries) => {
        setData(entries);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [authed, selectedVersion]);

  // Available batch counts from data
  const availableBatchCounts = useMemo(() => {
    if (!data) return [];
    const counts = new Set(data.map((e) => e.batchCount));
    return Array.from(counts).sort((a, b) => a - b);
  }, [data]);

  // Available model tags from data
  const availableModelTags = useMemo(() => {
    if (!data) return [];
    const tags = new Set(data.map((e) => deriveModelTag(e)));
    // Fixed order
    return ['Chat', 'VL', 'TTS', 'Translate', 'Neko'].filter((t) => tags.has(t));
  }, [data]);

  // Available weight sizes from data
  const availableSizes = useMemo(() => {
    if (!data) return [];
    const sizes = new Map<string, number>();
    for (const entry of data) {
      const label = deriveWeightLabel(entry);
      const sort = deriveSortOrder(entry);
      if (!sizes.has(label)) sizes.set(label, sort);
    }
    return Array.from(sizes.entries())
      .sort((a, b) => a[1] - b[1])
      .map(([label]) => label);
  }, [data]);

  // Available individual SoCs from data, sorted by data count desc
  const availableSocs = useMemo(() => {
    if (!data) return [];
    const counts = new Map<string, number>();
    for (const entry of data) {
      counts.set(entry.socName, (counts.get(entry.socName) ?? 0) + entry.sampleCount);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);
  }, [data]);

  // Available SoC brands from data
  const availableBrands = useMemo(() => {
    if (!data) return [];
    const brands = new Set(data.map((e) => inferBrand(e.socName, e.socBrand)));
    return BRAND_ORDER.filter((b) => brands.has(b));
  }, [data]);

  // Persist filter selections to localStorage
  const handleModelTagChange = useCallback((tag: string) => {
    setSelectedModelTag(tag);
    writeLs(LS_KEY_MODEL_TAG, tag);
  }, []);

  const handleSizeChange = useCallback((size: string) => {
    setSelectedSize(size);
    writeLs(LS_KEY_SIZE, size);
  }, []);

  const handleBrandChange = useCallback((brand: string) => {
    setSelectedBrand(brand);
    writeLs(LS_KEY_BRAND, brand);
  }, []);

  const handleResetFilters = useCallback(() => {
    setSelectedTab('');
    setSelectedBatch('all');
    setSelectedModelTag('all');
    setSelectedSize('all');
    setSelectedBrand('all');
    setSelectedSoc('all');
    setSelectedVersion('all');
    writeLs(LS_KEY_MODEL_TAG, 'all');
    writeLs(LS_KEY_SIZE, 'all');
    writeLs(LS_KEY_BRAND, 'all');
  }, []);

  // Filter data by batch + size + model tag + brand
  const filteredData = useMemo(() => {
    if (!data) return [];
    return filterLeaderboardData(data, {
      selectedBatch,
      selectedSize,
      selectedModelTag,
      selectedBrand,
      selectedSoc,
    });
  }, [data, selectedBatch, selectedSize, selectedModelTag, selectedBrand, selectedSoc]);

  // Compute available OS tabs from filtered data
  const availableOsTabs = useMemo(() => {
    const osSet = new Set(filteredData.map((e) => e.os));
    return OS_ORDER.filter((os) => osSet.has(os));
  }, [filteredData]);

  // Auto-select tab: default to "全部"
  const activeTab = useMemo(() => {
    if (selectedTab && (availableOsTabs.includes(selectedTab) || selectedTab === ALL_TAB_ID))
      return selectedTab;
    return ALL_TAB_ID;
  }, [selectedTab, availableOsTabs]);

  // Build matrix for current tab
  const { platforms, weightColumns } = useMemo(() => {
    if (filteredData.length === 0) return { platforms: [], weightColumns: [] };
    const filterOs = activeTab === ALL_TAB_ID ? null : activeTab;
    return buildPlatforms(filteredData, filterOs);
  }, [filteredData, activeTab]);

  // Merge all platform rows when viewing single-OS tab, or keep separate for "all"
  const displayRows = useMemo<DisplayRow[]>(() => {
    if (activeTab === ALL_TAB_ID) {
      // Flatten all platforms, prefixed with OS
      return platforms.flatMap((p) => p.rows.map((r) => ({ ...r, osLabel: p.label, osId: p.id })));
    }
    return platforms.flatMap((p) => p.rows.map((r) => ({ ...r, osLabel: undefined, osId: p.id })));
  }, [platforms, activeTab]);

  const matrixGridStyle = useMemo<CSSProperties>(
    () => ({
      gridTemplateColumns: `var(--soc-column-width) repeat(${Math.max(weightColumns.length, 1)}, var(--metric-column-width))`,
    }),
    [weightColumns.length],
  );

  const exportFileBaseName = useMemo(() => {
    const parts = [
      'model-fit-preview',
      activeTab === ALL_TAB_ID ? 'all-platforms' : sanitizeFileNamePart(OS_LABELS[activeTab] ?? activeTab),
      sanitizeFileNamePart(selectedBatch === 'all' ? 'all-batches' : `batch-${selectedBatch}`),
      sanitizeFileNamePart(selectedModelTag),
      sanitizeFileNamePart(selectedSize),
      sanitizeFileNamePart(selectedBrand),
      sanitizeFileNamePart(
        selectedSoc === 'all' ? selectedSoc : formatSocFilterLabel({ socName: selectedSoc }),
      ),
      sanitizeFileNamePart(selectedVersion === 'all' ? 'all-versions' : `v-${selectedVersion}`),
      new Date().toISOString().replace(/[:.]/g, '-'),
    ];
    return parts.join('__');
  }, [activeTab, selectedBatch, selectedModelTag, selectedSize, selectedBrand, selectedSoc, selectedVersion]);

  const handleExportRow = useCallback((row: DisplayRow) => {
    const socDisplay = getSocDisplayInfo({
      socName: row.socName,
      socBrand: row.socBrand,
      deviceModels: row.deviceModels,
    });
    const platform = row.osLabel ?? (OS_LABELS[row.osId] ?? row.osId);
    const vendor = capitalizeBrand(socDisplay.brand) || '—';
    const visibleColumns = weightColumns.filter((column) => row.cells[column.key]);
    const rowEntries = filteredData
      .filter((entry) => entry.socName === row.socName && entry.os === row.osId)
      .filter((entry) => visibleColumns.some((column) => column.key === columnKey(entry)));
    const filename = `${exportFileBaseName}__${sanitizeFileNamePart(socDisplay.primaryLabel)}.html`;
    const generatedAt = new Date().toISOString();
    const filters: Array<{ label: string; value: string }> = [
      { label: 'Platform', value: platform },
      { label: 'Batch', value: selectedBatch === 'all' ? '不限制' : `x${selectedBatch}` },
      { label: 'Type', value: selectedModelTag === 'all' ? '不限制' : selectedModelTag },
      { label: 'Weight', value: selectedSize === 'all' ? '不限制' : selectedSize },
      { label: 'Chip', value: socDisplay.primaryLabel },
      { label: 'App Version', value: selectedVersion === 'all' ? '不限制' : selectedVersion },
    ];
    if (socDisplay.secondaryLabel) {
      filters.splice(5, 0, { label: 'Device', value: socDisplay.secondaryLabel });
    }
    if (socDisplay.metaLabel) {
      filters.splice(6, 0, { label: 'Apple ID', value: socDisplay.metaLabel });
    }
    if (selectedBrand !== 'all') {
      filters.splice(4, 0, { label: 'Vendor Filter', value: capitalizeBrand(selectedBrand) });
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
          displayDecodePerBatch: display.metricBasis === 'decode_div_batch' ? display.decode : null,
          displayMetricBasis: formatMetricBasisLabel(display.metricBasis),
          sampleCount: entry.sampleCount,
          backend: entry.backend,
          batchCount: entry.batchCount,
          isBatch: display.metricBasis === 'decode_div_batch',
        };
      }),
    });

    openHtmlReport(filename, html);
  }, [
    exportFileBaseName,
    filteredData,
    selectedBatch,
    selectedBrand,
    selectedModelTag,
    selectedSize,
    selectedVersion,
    weightColumns,
  ]);

  const handleCellClick = useCallback(
    async (cell: MatrixCell, weightLabel: string) => {
      const socLabel = formatSocFilterLabel({ socName: cell.socName });
      const info = {
        socName: cell.socName,
        modelSha256: cell.modelSha256,
        backend: cell.backend,
        isBatch: cell.isBatch,
        os: cell.os,
        label: `${socLabel} × ${weightLabel}`,
      };
      setSidebar({ open: true, loading: true, records: [], cellInfo: info });

      try {
        const records = await fetchRecords({
          socName: cell.socName,
          modelSha256: cell.modelSha256,
          backend: cell.backend,
          isBatch: cell.isBatch,
          batchCount: cell.batchCount,
          os: cell.os,
          appVersion: selectedVersion,
        });
        setSidebar((prev) => ({ ...prev, loading: false, records }));
      } catch {
        setSidebar((prev) => ({ ...prev, loading: false }));
      }
    },
    [selectedVersion],
  );

  const closeSidebar = useCallback(() => {
    setSidebar({ open: false, loading: false, records: [], cellInfo: null });
  }, []);

  if (!authed) {
    return (
      <main className={styles.main}>
        <div className={styles.navbarWrap}>
          <nav className={styles.navbar}>
            <a href="/" className={styles.navLeft}>
              <span className={styles.navTitle}>RWKV Chat</span>
            </a>
          </nav>
        </div>
        <div className={styles.container}>
          <section className={styles.comingSoonBox}>
            <h3 className={styles.comingSoonTitle}>正在验证登录状态...</h3>
          </section>
        </div>
      </main>
    );
  }

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
          <p className={styles.eyebrow}>Performance Leaderboard</p>
          <h1 className={styles.title}>RWKV prefill / decode matrix</h1>
          <p className={styles.description}>
            按平台切换 Tab，纵轴是芯片，横轴是模型权重。非 batch 单元格展示
            top 10% 位次成绩；batch 单元格同时展示 Decode 总值和 Decode / Batch，并按
            Decode / Batch 着色。每个 SoC 的 header column 可单独导出统计，点击单元格可查看上报记录。
          </p>
        </section>

        {loading ? (
          <section className={styles.comingSoonBox}>
            <h3 className={styles.comingSoonTitle}>Loading...</h3>
            <p className={styles.comingSoonText}>正在从服务器获取性能数据</p>
          </section>
        ) : error ? (
          <section className={styles.comingSoonBox}>
            <h3 className={styles.comingSoonTitle}>加载失败</h3>
            <p className={styles.comingSoonText}>{error}</p>
          </section>
        ) : availableOsTabs.length === 0 ? (
          <section className={styles.comingSoonBox}>
            <h3 className={styles.comingSoonTitle}>暂无数据</h3>
            <p className={styles.comingSoonText}>
              还没有收到任何性能上报数据。请在 RWKV Chat App
              中运行一次推理，数据会在回复完成后自动上传。
            </p>
          </section>
        ) : (
          <>
            {/* Filters */}
            <section className={styles.tabSection}>
              {/* Platform */}
              <div className={styles.tabRow}>
                <span className={styles.filterLabel}>平台</span>
                <button
                  type="button"
                  className={`${styles.tabButtonSmall} ${activeTab === ALL_TAB_ID ? styles.tabButtonSelected : ''}`}
                  onClick={() => setSelectedTab(ALL_TAB_ID)}
                >
                  不限制
                </button>
                {availableOsTabs.map((os) => (
                  <button
                    key={os}
                    type="button"
                    className={`${styles.tabButtonSmall} ${activeTab === os ? styles.tabButtonSelected : ''}`}
                    onClick={() => setSelectedTab(os)}
                  >
                    {OS_LABELS[os] ?? os}
                  </button>
                ))}
              </div>

              {/* Batch */}
              {availableBatchCounts.length > 1 ? (
                <div className={styles.tabRow}>
                  <span className={styles.filterLabel}>并发</span>
                  <button
                    type="button"
                    className={`${styles.tabButtonSmall} ${selectedBatch === 'all' ? styles.tabButtonSelected : ''}`}
                    onClick={() => setSelectedBatch('all')}
                  >
                    不限制
                  </button>
                  {availableBatchCounts.map((bc) => (
                    <button
                      key={bc}
                      type="button"
                      className={`${styles.tabButtonSmall} ${selectedBatch === String(bc) ? styles.tabButtonSelected : ''}`}
                      onClick={() => setSelectedBatch(String(bc))}
                    >
                      {bc === 1 ? '单条' : `batch×${bc}`}
                    </button>
                  ))}
                </div>
              ) : null}

              {/* Model type */}
              {availableModelTags.length > 1 ? (
                <div className={styles.tabRow}>
                  <span className={styles.filterLabel}>类型</span>
                  <button
                    type="button"
                    className={`${styles.tabButtonSmall} ${selectedModelTag === 'all' ? styles.tabButtonSelected : ''}`}
                    onClick={() => handleModelTagChange('all')}
                  >
                    不限制
                  </button>
                  {availableModelTags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className={`${styles.tabButtonSmall} ${selectedModelTag === tag ? styles.tabButtonSelected : ''}`}
                      onClick={() => handleModelTagChange(tag)}
                    >
                      {MODEL_TAG_LABELS[tag] ?? tag}
                    </button>
                  ))}
                </div>
              ) : null}

              {/* Weight size */}
              {availableSizes.length > 1 ? (
                <div className={styles.tabRow}>
                  <span className={styles.filterLabel}>权重</span>
                  <button
                    type="button"
                    className={`${styles.tabButtonSmall} ${selectedSize === 'all' ? styles.tabButtonSelected : ''}`}
                    onClick={() => handleSizeChange('all')}
                  >
                    不限制
                  </button>
                  {availableSizes.map((size) => (
                    <button
                      key={size}
                      type="button"
                      className={`${styles.tabButtonSmall} ${selectedSize === size ? styles.tabButtonSelected : ''}`}
                      onClick={() => handleSizeChange(size)}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              ) : null}

              {/* SoC brand */}
              {availableBrands.length > 1 ? (
                <div className={styles.tabRow}>
                  <span className={styles.filterLabel}>芯片</span>
                  <button
                    type="button"
                    className={`${styles.brandFilterTag} ${selectedBrand === 'all' ? styles.tabButtonSelected : ''}`}
                    onClick={() => handleBrandChange('all')}
                  >
                    不限制
                  </button>
                  {availableBrands.map((brand) => (
                    <button
                      key={brand}
                      type="button"
                      className={`${styles.brandFilterTag} ${selectedBrand === brand ? styles.tabButtonSelected : ''}`}
                      onClick={() => handleBrandChange(brand)}
                    >
                      <BrandIcon brand={brand} className={styles.brandFilterIcon} />
                      {BRAND_LABELS[brand] ?? brand}
                    </button>
                  ))}
                </div>
              ) : null}

              {/* Individual SoC */}
              {availableSocs.length > 1 ? (
                <div className={styles.tabRow}>
                  <span className={styles.filterLabel}>SoC</span>
                  <button
                    type="button"
                    className={`${styles.tabButtonSmall} ${selectedSoc === 'all' ? styles.tabButtonSelected : ''}`}
                    onClick={() => setSelectedSoc('all')}
                  >
                    不限制
                  </button>
                  {availableSocs.map((soc) => (
                    <button
                      key={soc}
                      type="button"
                      className={`${styles.tabButtonSmall} ${selectedSoc === soc ? styles.tabButtonSelected : ''}`}
                      onClick={() => setSelectedSoc(soc)}
                      title={soc}
                    >
                      {formatSocFilterLabel({ socName: soc })}
                    </button>
                  ))}
                </div>
              ) : null}

              {/* APP version */}
              {appVersions.length > 0 ? (
                <div className={styles.tabRow}>
                  <span className={styles.filterLabel}>APP 版本</span>
                  <button
                    type="button"
                    className={`${styles.tabButtonSmall} ${selectedVersion === 'all' ? styles.tabButtonSelected : ''}`}
                    onClick={() => setSelectedVersion('all')}
                  >
                    不限制
                  </button>
                  {appVersions.map((v) => (
                    <button
                      key={v}
                      type="button"
                      className={`${styles.tabButtonSmall} ${selectedVersion === v ? styles.tabButtonSelected : ''}`}
                      onClick={() => setSelectedVersion(v)}
                    >
                      v{v}
                    </button>
                  ))}
                </div>
              ) : null}

              {/* Reset + Meta */}
              <div className={styles.metaBlock}>
                <button type="button" className={styles.resetButton} onClick={handleResetFilters}>
                  重置筛选
                </button>
                <span>Chips: {displayRows.length}</span>
                <span>Models: {weightColumns.length}</span>
              </div>
            </section>

            {/* Table */}
            {displayRows.length === 0 ? (
              <section className={styles.comingSoonBox}>
                <h3 className={styles.comingSoonTitle}>该平台暂无数据</h3>
                <p className={styles.comingSoonText}>等待用户上报</p>
              </section>
            ) : (
              <>
                <section className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>
                    {activeTab === ALL_TAB_ID ? '全平台' : (OS_LABELS[activeTab] ?? activeTab)} SoC
                    × Model
                  </h2>
                  <p className={styles.sectionDescription}>
                    非 batch 单元格展示 top 10% 位次 Prefill / Decode；batch 单元格会同时展示
                    Decode 和 Decode / Batch，单元格颜色按 Decode / Batch 计算。每个 SoC 的
                    header column 内可导出该 SoC 在当前筛选下的报表和全部统计。
                  </p>
                </section>

                <section className={styles.tableSection}>
                  <div className={styles.tableWrap}>
                    <div className={styles.matrixGrid} style={matrixGridStyle}>
                      <div className={`${styles.rowHead} ${styles.cornerHead}`}>SoC</div>
                      {weightColumns.map((col, colIndex) => (
                        <div
                          key={col.key}
                          className={`${styles.weightHead} ${colIndex === weightColumns.length - 1 ? styles.lastCol : ''}`}
                        >
                          <div className={styles.weightTitle}>{col.label}</div>
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

                      {displayRows.flatMap((row, rowIndex) => {
                        const rowKey = `${row.osLabel ?? ''}-${row.socName}`;
                        const isLastRow = rowIndex === displayRows.length - 1;
                        const rowHeadClass = `${styles.rowCell} ${isLastRow ? styles.lastRow : ''}`;
                        const socDisplay = getSocDisplayInfo({
                          socName: row.socName,
                          socBrand: row.socBrand,
                          deviceModels: row.deviceModels,
                        });
                        const rowPlatformLabel = row.osLabel ?? (OS_LABELS[row.osId] ?? row.osId);
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
                              return (
                                <div
                                  key={`${rowKey}__${col.key}`}
                                  className={cellBaseClass}
                                />
                              );
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
                                <div className={styles.noteTag}>
                                  {getCellFooterNote(cell)}
                                </div>
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
                <li>batch 单元格同时显示 Decode 总值和 Decode / Batch，颜色按 Decode / Batch 计算。</li>
                <li>单元格着色值低于 6 时标红，6-14.9 为黄色，15 以上继续按原来的绿色区间显示。</li>
                <li>每个 SoC header column 都有导出按钮，导出的报表首字段是 Headers，对应这个 SoC；没有统计到的权重不会写进报表。</li>
              </ul>
            </section>
          </>
        )}
      </div>

      {/* Sidebar */}
      {sidebar.open ? (
        <>
          <div className={styles.sidebarOverlay} onClick={closeSidebar} />
          <aside className={styles.sidebar}>
            <div className={styles.sidebarHeader}>
              <h3 className={styles.sidebarTitle}>{sidebar.cellInfo?.label ?? 'Records'}</h3>
              <button type="button" className={styles.sidebarClose} onClick={closeSidebar}>
                ✕
              </button>
            </div>

            {sidebar.loading ? (
              <div className={styles.sidebarLoading}>加载中...</div>
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
                    </div>
                  );
                })}
              </div>
            )}
          </aside>
        </>
      ) : null}
    </main>
  );
}
