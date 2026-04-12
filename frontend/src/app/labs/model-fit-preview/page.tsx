'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ThemeSwitcher } from '@/components';
import { fetchAdminSession } from '@/utils/api';
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
  backend: string;
  isBatch: boolean;
  batchCount: number;
  sampleCount: number;
  decodeSpeed: { avg: number; max: number | null };
  prefillSpeed: { avg: number; max: number | null };
}

interface RecordEntry {
  id: number;
  socName: string;
  socBrand: string;
  os: string;
  osVersion: string | null;
  deviceModel: string | null;
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
  key: string; // modelSha256 + batch dimension
  label: string;
  quant: string;
  backend: string;
  modelTag: string; // Chat / VL / TTS / Translate / Neko
  isBatch: boolean;
  batchCount: number;
  sortOrder: number;
}

interface MatrixCell {
  prefillMax: number | null;
  decodeMax: number | null;
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
  cells: Record<string, MatrixCell>; // key = modelSha256
}

interface PlatformData {
  id: string;
  label: string;
  rows: MatrixRow[];
}

interface SidebarState {
  open: boolean;
  loading: boolean;
  records: RecordEntry[];
  cellInfo: { socName: string; modelSha256: string; backend: string; isBatch: boolean; os: string; label: string } | null;
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
  if (lower.includes('apple') || lower.includes(' m1') || lower.includes(' m2') || lower.includes(' m3') || lower.includes(' m4')) return 'apple';
  if (lower.includes('mediatek') || lower.includes('dimensity') || lower.includes('helio')) return 'mediatek';
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

function formatSpeed(value: number | null): string {
  if (value === null || value === undefined) return '—';
  return value % 1 === 0 ? value.toFixed(0) : value.toFixed(1);
}

function deriveModelTag(entry: LeaderboardEntry): string {
  const name = (entry.modelName || entry.modelFileName).toLowerCase();
  if (name.includes('-vl') || name.includes('_vl') || name.includes(' vl') || name.includes('rwkv-vl')) return 'VL';
  if (name.includes('tts') || name.includes('spark') || name.includes('voice')) return 'TTS';
  if (name.includes('translate') || name.includes('-trans') || name.includes('translation')) return 'Translate';
  if (name.includes('neko')) return 'Neko';
  return 'Chat';
}

function buildCellClass(decode: number | null): string {
  if (decode === null) return '';
  if (decode >= 35) return styles.cellStrong;
  if (decode >= 15) return styles.cellGood;
  if (decode >= 4) return styles.cellTight;
  return styles.cellWeak;
}

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// ---------------------------------------------------------------------------
// Data transform
// ---------------------------------------------------------------------------

/** 生成唯一的列 key：同一个模型的不同 batch 配置视为不同列，不同类型（VL/Chat）也分开 */
function columnKey(entry: LeaderboardEntry): string {
  const tag = deriveModelTag(entry);
  let key = `${entry.modelSha256}__${tag}`;
  if (entry.isBatch && entry.batchCount > 1) {
    key += `__batch${entry.batchCount}`;
  }
  return key;
}

function buildPlatforms(data: LeaderboardEntry[], filterOs: string | null): {
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
          cells: {},
        });
      }
      const row = bySoc.get(entry.socName)!;
      const ck = columnKey(entry);
      const existing = row.cells[ck];
      const entryDecodeMax = entry.decodeSpeed.max ?? entry.decodeSpeed.avg;
      const entryPrefillMax = entry.prefillSpeed.max ?? entry.prefillSpeed.avg;
      // Keep entry with higher decode max
      if (!existing || (entryDecodeMax ?? 0) > (existing.decodeMax ?? 0)) {
        row.cells[ck] = {
          prefillMax: entryPrefillMax,
          decodeMax: entryDecodeMax,
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
      const maxA = Math.max(...Object.values(a.cells).map((c) => c.decodeMax ?? 0));
      const maxB = Math.max(...Object.values(b.cells).map((c) => c.decodeMax ?? 0));
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
  const qs = new URLSearchParams({ limit: '500' });
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
  os?: string;
}): Promise<RecordEntry[]> {
  const base = getApiBaseUrl();
  const qs = new URLSearchParams({
    socName: params.socName,
    modelSha256: params.modelSha256,
    backend: params.backend,
    isBatch: String(params.isBatch),
    limit: '100',
  });
  if (params.os) qs.set('os', params.os);
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
  const [selectedModelTag, setSelectedModelTag] = useState<string>(() => readLs(LS_KEY_MODEL_TAG, 'Chat'));
  const [selectedBrand, setSelectedBrand] = useState<string>(() => readLs(LS_KEY_BRAND, 'all'));
  const [selectedSoc, setSelectedSoc] = useState<string>('all');
  const [sidebar, setSidebar] = useState<SidebarState>({ open: false, loading: false, records: [], cellInfo: null });
  const [hoveredCell, setHoveredCell] = useState<{ rowKey: string; colKey: string } | null>(null);

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
    let filtered = data;
    if (selectedBatch !== 'all') {
      const bc = parseInt(selectedBatch, 10);
      filtered = filtered.filter((e) => e.batchCount === bc);
    }
    if (selectedSize !== 'all') {
      filtered = filtered.filter((e) => deriveWeightLabel(e) === selectedSize);
    }
    if (selectedModelTag !== 'all') {
      filtered = filtered.filter((e) => deriveModelTag(e) === selectedModelTag);
    }
    if (selectedBrand !== 'all') {
      filtered = filtered.filter((e) => inferBrand(e.socName, e.socBrand) === selectedBrand);
    }
    if (selectedSoc !== 'all') {
      filtered = filtered.filter((e) => e.socName === selectedSoc);
    }
    return filtered;
  }, [data, selectedBatch, selectedSize, selectedModelTag, selectedBrand, selectedSoc]);

  // Compute available OS tabs from filtered data
  const availableOsTabs = useMemo(() => {
    const osSet = new Set(filteredData.map((e) => e.os));
    return OS_ORDER.filter((os) => osSet.has(os));
  }, [filteredData]);

  // Auto-select tab: default to "全部"
  const activeTab = useMemo(() => {
    if (selectedTab && (availableOsTabs.includes(selectedTab) || selectedTab === ALL_TAB_ID)) return selectedTab;
    return ALL_TAB_ID;
  }, [selectedTab, availableOsTabs]);

  // Build matrix for current tab
  const { platforms, weightColumns } = useMemo(() => {
    if (filteredData.length === 0) return { platforms: [], weightColumns: [] };
    const filterOs = activeTab === ALL_TAB_ID ? null : activeTab;
    return buildPlatforms(filteredData, filterOs);
  }, [filteredData, activeTab]);

  // Merge all platform rows when viewing single-OS tab, or keep separate for "all"
  const displayRows = useMemo(() => {
    if (activeTab === ALL_TAB_ID) {
      // Flatten all platforms, prefixed with OS
      return platforms.flatMap((p) => p.rows.map((r) => ({ ...r, osLabel: p.label })));
    }
    return platforms.flatMap((p) => p.rows.map((r) => ({ ...r, osLabel: undefined })));
  }, [platforms, activeTab]);

  const handleCellClick = useCallback(async (cell: MatrixCell, weightLabel: string) => {
    const info = {
      socName: cell.socName,
      modelSha256: cell.modelSha256,
      backend: cell.backend,
      isBatch: cell.isBatch,
      os: cell.os,
      label: `${cell.socName} × ${weightLabel}`,
    };
    setSidebar({ open: true, loading: true, records: [], cellInfo: info });

    try {
      const records = await fetchRecords({
        socName: cell.socName,
        modelSha256: cell.modelSha256,
        backend: cell.backend,
        isBatch: cell.isBatch,
        os: cell.os,
      });
      setSidebar((prev) => ({ ...prev, loading: false, records }));
    } catch {
      setSidebar((prev) => ({ ...prev, loading: false }));
    }
  }, []);

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
            按平台切换 Tab，纵轴是芯片，横轴是模型权重。数据来源于用户匿名上传的真实推理速度，展示各组合的最佳成绩。点击单元格查看所有上报记录。
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
              还没有收到任何性能上报数据。请在 RWKV Chat App 中运行一次推理，数据会在回复完成后自动上传。
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
                    >
                      {soc}
                    </button>
                  ))}
                </div>
              ) : null}

              {/* APP version */}
              {appVersions.length > 1 ? (
                <div className={styles.tabRow}>
                  <span className={styles.filterLabel}>版本</span>
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
                    {activeTab === ALL_TAB_ID ? '全平台' : (OS_LABELS[activeTab] ?? activeTab)} SoC × Model
                  </h2>
                  <p className={styles.sectionDescription}>
                    展示所有上报数据的最大 Prefill / Decode 速度 (tokens/s)，按 Decode 速度着色。点击单元格查看明细。
                  </p>
                </section>

                <section className={styles.tableSection}>
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th className={styles.rowHead}>SoC</th>
                          {weightColumns.map((col) => (
                            <th
                              key={col.key}
                              className={`${styles.weightHead} ${hoveredCell?.colKey === col.key ? styles.colHighlight : ''}`}
                            >
                              <div className={styles.weightTitle}>{col.label}</div>
                              <div className={styles.weightMeta}>
                                {col.modelTag !== 'Chat' ? <span className={styles.modelTag}>{col.modelTag}</span> : null}
                                {col.isBatch ? <span className={styles.batchTag}>×{col.batchCount}</span> : null}
                                {col.quant} · {col.backend}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>

                      <tbody>
                        {displayRows.map((row) => {
                          const rowKey = `${row.osLabel ?? ''}-${row.socName}`;
                          const isRowHighlighted = hoveredCell?.rowKey === rowKey;
                          return (
                            <tr key={rowKey}>
                              <th className={`${styles.rowCell} ${isRowHighlighted ? styles.rowHighlight : ''}`}>
                                <div className={styles.rowTopline}>
                                  {(() => {
                                    const brand = inferBrand(row.socName, row.socBrand);
                                    if (brand === 'unknown') return null;
                                    return (
                                      <span className={styles.vendorTag}>
                                        <BrandIcon brand={brand} className={styles.vendorIcon} />
                                        {capitalizeBrand(brand)}
                                      </span>
                                    );
                                  })()}
                                  <strong className={styles.rowName}>{row.socName}</strong>
                                </div>
                                {'osLabel' in row && row.osLabel ? (
                                  <div className={styles.rowMeta}>{row.osLabel}</div>
                                ) : null}
                              </th>

                              {weightColumns.map((col) => {
                                const cell = row.cells[col.key];
                                if (!cell) {
                                  return (
                                    <td
                                      key={col.key}
                                      className={styles.speedCell}
                                      onMouseEnter={() => setHoveredCell({ rowKey, colKey: col.key })}
                                      onMouseLeave={() => setHoveredCell(null)}
                                    />
                                  );
                                }
                                const prefill = cell.prefillMax;
                                const decode = cell.decodeMax;
                                return (
                                  <td
                                    key={col.key}
                                    className={`${styles.speedCell} ${buildCellClass(decode)} ${styles.speedCellClickable}`}
                                    onClick={() => handleCellClick(cell, col.label)}
                                    onMouseEnter={() => setHoveredCell({ rowKey, colKey: col.key })}
                                    onMouseLeave={() => setHoveredCell(null)}
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
                                        {formatSpeed(decode)}
                                      </strong>
                                    </div>
                                    <div className={styles.noteTag}>
                                      {cell.sampleCount}次测评
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}

            {/* Legend */}
            <section className={styles.legend}>
              <div className={styles.legendItem}>
                <span className={`${styles.legendSwatch} ${styles.cellStrong}`} />
                <span>Decode ≥ 35</span>
              </div>
              <div className={styles.legendItem}>
                <span className={`${styles.legendSwatch} ${styles.cellGood}`} />
                <span>Decode 15-34.9</span>
              </div>
              <div className={styles.legendItem}>
                <span className={`${styles.legendSwatch} ${styles.cellTight}`} />
                <span>Decode 4-14.9</span>
              </div>
              <div className={styles.legendItem}>
                <span className={`${styles.legendSwatch} ${styles.cellWeak}`} />
                <span>Decode &lt; 4</span>
              </div>
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
              <button type="button" className={styles.sidebarClose} onClick={closeSidebar}>✕</button>
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
                  return (
                    <div key={r.id} className={styles.recordRow}>
                      <span className={styles.recordColSpeed}><strong>{r.prefillSpeed.toFixed(1)}</strong> t/s</span>
                      <span className={styles.recordColSpeed}><strong>{r.decodeSpeed.toFixed(1)}</strong> t/s</span>
                      <span className={styles.recordColInfo}>{r.backend}{r.isBatch ? ` batch×${r.batchCount}` : ''}</span>
                      <span className={styles.recordColInfo}>{r.deviceModel || '—'}</span>
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
