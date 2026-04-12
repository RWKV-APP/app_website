'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
  key: string; // modelSha256
  label: string;
  quant: string;
  sortOrder: number;
}

interface MatrixCell {
  prefillAvg: number | null;
  decodeAvg: number | null;
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

function detectUserOs(): string {
  if (typeof navigator === 'undefined') return '';
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('mac')) return 'macos';
  if (ua.includes('win')) return 'windows';
  if (ua.includes('android')) return 'android';
  if (ua.includes('iphone') || ua.includes('ipad')) return 'ios';
  if (ua.includes('linux')) return 'linux';
  return '';
}

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

function buildCellClass(decode: number | null): string {
  if (decode === null) return styles.cellUnavailable;
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

/** 生成唯一的列 key：同一个模型的不同 batch 配置视为不同列 */
function columnKey(entry: LeaderboardEntry): string {
  if (entry.isBatch && entry.batchCount > 1) {
    return `${entry.modelSha256}__batch${entry.batchCount}`;
  }
  return entry.modelSha256;
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
      const batchSuffix = (entry.isBatch && entry.batchCount > 1) ? ` ×${entry.batchCount}` : '';
      weightMap.set(ck, {
        key: ck,
        label: deriveWeightLabel(entry) + batchSuffix,
        quant: deriveQuantLabel(entry),
        sortOrder: deriveSortOrder(entry) + (entry.isBatch && entry.batchCount > 1 ? 0.01 * entry.batchCount : 0),
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
      // Keep entry with higher decode avg
      if (!existing || (entry.decodeSpeed.avg ?? 0) > (existing.decodeAvg ?? 0)) {
        row.cells[ck] = {
          prefillAvg: entry.prefillSpeed.avg,
          decodeAvg: entry.decodeSpeed.avg,
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
      const avgA = Object.values(a.cells).reduce((s, c) => s + (c.decodeAvg ?? 0), 0) / Math.max(Object.values(a.cells).length, 1);
      const avgB = Object.values(b.cells).reduce((s, c) => s + (c.decodeAvg ?? 0), 0) / Math.max(Object.values(b.cells).length, 1);
      return avgB - avgA;
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

async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/public-api/telemetry/leaderboard?limit=500`);
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
  const [data, setData] = useState<LeaderboardEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<string>('');
  const [selectedBatch, setSelectedBatch] = useState<string>('all'); // 'all' | '1' | '2' | ... | '12'
  const [sidebar, setSidebar] = useState<SidebarState>({ open: false, loading: false, records: [], cellInfo: null });

  useEffect(() => {
    fetchLeaderboard()
      .then((entries) => {
        setData(entries);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  // Available batch counts from data
  const availableBatchCounts = useMemo(() => {
    if (!data) return [];
    const counts = new Set(data.map((e) => e.batchCount));
    return Array.from(counts).sort((a, b) => a - b);
  }, [data]);

  // Filter data by batch selection
  const filteredData = useMemo(() => {
    if (!data) return [];
    if (selectedBatch === 'all') return data;
    const bc = parseInt(selectedBatch, 10);
    return data.filter((e) => e.batchCount === bc);
  }, [data, selectedBatch]);

  // Compute available OS tabs from filtered data
  const availableOsTabs = useMemo(() => {
    const osSet = new Set(filteredData.map((e) => e.os));
    return OS_ORDER.filter((os) => osSet.has(os));
  }, [filteredData]);

  // Auto-select tab: user's OS if available, otherwise first available
  const activeTab = useMemo(() => {
    if (selectedTab && (availableOsTabs.includes(selectedTab) || selectedTab === ALL_TAB_ID)) return selectedTab;
    const userOs = detectUserOs();
    if (userOs && availableOsTabs.includes(userOs)) return userOs;
    return availableOsTabs[0] || '';
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

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <section className={styles.hero}>
          <p className={styles.eyebrow}>Performance Leaderboard</p>
          <h1 className={styles.title}>RWKV prefill / decode matrix</h1>
          <p className={styles.description}>
            按平台切换 Tab，纵轴是芯片，横轴是模型权重。数据来源于用户匿名上传的真实推理速度，展示各组合的平均成绩。点击单元格查看所有上报记录。
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
            {/* Tabs */}
            <section className={styles.tabSection}>
              <div className={styles.tabScroller}>
                <div className={styles.tabRow}>
                  {availableOsTabs.map((os) => (
                    <button
                      key={os}
                      type="button"
                      className={`${styles.tabButton} ${activeTab === os ? styles.tabButtonSelected : ''}`}
                      onClick={() => setSelectedTab(os)}
                    >
                      {OS_LABELS[os] ?? os}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`${styles.tabButton} ${activeTab === ALL_TAB_ID ? styles.tabButtonSelected : ''}`}
                    onClick={() => setSelectedTab(ALL_TAB_ID)}
                  >
                    全部
                  </button>
                </div>
              </div>

              {availableBatchCounts.length > 1 ? (
                <div className={styles.tabRow}>
                  <button
                    type="button"
                    className={`${styles.tabButtonSmall} ${selectedBatch === 'all' ? styles.tabButtonSelected : ''}`}
                    onClick={() => setSelectedBatch('all')}
                  >
                    全部并发
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

              <div className={styles.metaBlock}>
                <span>{activeTab === ALL_TAB_ID ? '全部平台' : (OS_LABELS[activeTab] ?? activeTab)}</span>
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
                    展示所有上报数据的平均 Prefill / Decode 速度 (tokens/s)，按 Decode 速度着色。点击单元格查看明细。
                  </p>
                </section>

                <section className={styles.tableSection}>
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th className={styles.rowHead}>SoC</th>
                          {weightColumns.map((col) => (
                            <th key={col.key} className={styles.weightHead}>
                              <div className={styles.weightTitle}>{col.label}</div>
                              <div className={styles.weightMeta}>{col.quant}</div>
                            </th>
                          ))}
                        </tr>
                      </thead>

                      <tbody>
                        {displayRows.map((row) => (
                          <tr key={`${row.osLabel ?? ''}-${row.socName}`}>
                            <th className={styles.rowCell}>
                              <div className={styles.rowTopline}>
                                {row.socBrand && row.socBrand !== 'unknown' ? (
                                  <span className={styles.vendorTag}>{capitalizeBrand(row.socBrand)}</span>
                                ) : null}
                                <strong className={styles.rowName}>{row.socName}</strong>
                              </div>
                              {'osLabel' in row && row.osLabel ? (
                                <div className={styles.rowMeta}>{row.osLabel}</div>
                              ) : null}
                            </th>

                            {weightColumns.map((col) => {
                              const cell = row.cells[col.key];
                              const prefill = cell?.prefillAvg ?? null;
                              const decode = cell?.decodeAvg ?? null;
                              return (
                                <td
                                  key={col.key}
                                  className={`${styles.speedCell} ${buildCellClass(decode)} ${cell ? styles.speedCellClickable : ''}`}
                                  onClick={cell ? () => handleCellClick(cell, col.label) : undefined}
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
                                  {cell ? (
                                    <div className={styles.noteTag}>
                                      {cell.backend}{cell.isBatch ? ` · batch×${cell.batchCount}` : ''} · {cell.sampleCount}次测评
                                    </div>
                                  ) : null}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
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
              <div className={styles.legendItem}>
                <span className={`${styles.legendSwatch} ${styles.cellUnavailable}`} />
                <span>No data</span>
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
                  <span className={styles.recordColInfo}>Time</span>
                </div>
                {sidebar.records.map((r) => (
                  <div key={r.id} className={styles.recordRow}>
                    <span className={styles.recordColSpeed}><strong>{r.prefillSpeed.toFixed(1)}</strong> t/s</span>
                    <span className={styles.recordColSpeed}><strong>{r.decodeSpeed.toFixed(1)}</strong> t/s</span>
                    <span className={styles.recordColInfo}>{r.backend}{r.isBatch ? ` batch×${r.batchCount}` : ''}</span>
                    <span className={styles.recordColInfo}>{r.deviceModel || '—'}</span>
                    <span className={styles.recordColInfo}>{r.totalMemoryMb ? `${(r.totalMemoryMb / 1024).toFixed(0)} GB` : '—'}</span>
                    <span className={styles.recordColInfo}>{formatTimestamp(r.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </aside>
        </>
      ) : null}
    </main>
  );
}
