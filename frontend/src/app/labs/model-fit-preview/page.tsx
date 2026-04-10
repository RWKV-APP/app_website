'use client';

import { useEffect, useState } from 'react';
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
  sampleCount: number;
  decodeSpeed: { max: number | null; avg: number; p90: number | null };
  prefillSpeed: { max: number | null; avg: number };
}

interface WeightColumn {
  key: string; // modelSha256
  label: string; // e.g. "1.5B"
  quant: string; // e.g. "Q4_K_M"
  sortOrder: number; // modelSizeB for sorting
}

interface MatrixCell {
  prefill: number | null;
  decode: number | null;
  sampleCount: number;
  backend: string;
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

const OS_ORDER = ['android', 'ios', 'macos', 'windows', 'linux'];

function deriveWeightLabel(entry: LeaderboardEntry): string {
  const size = entry.modelSizeB;
  if (size != null && size > 0) {
    return size >= 1 ? `${size}B` : `${size}B`;
  }
  // Fallback: try to extract from fileName like "rwkv7-world-1.5B-Q4_K_M.gguf"
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

function formatCompactSpeed(value: number | null): string {
  if (value === null || value === undefined) return '—';
  return value % 1 === 0 ? value.toFixed(0) : value.toFixed(1);
}

function buildCellClass(prefill: number | null, decode: number | null): string {
  if (prefill === null || decode === null) {
    return styles.cellUnavailable;
  }
  if (decode >= 35) return styles.cellStrong;
  if (decode >= 15) return styles.cellGood;
  if (decode >= 4) return styles.cellTight;
  return styles.cellWeak;
}

// ---------------------------------------------------------------------------
// Data transform
// ---------------------------------------------------------------------------

function buildPlatforms(data: LeaderboardEntry[]): {
  platforms: PlatformData[];
  weightColumns: WeightColumn[];
} {
  // Build unique weight columns (by modelSha256)
  const weightMap = new Map<string, WeightColumn>();
  for (const entry of data) {
    if (!weightMap.has(entry.modelSha256)) {
      weightMap.set(entry.modelSha256, {
        key: entry.modelSha256,
        label: deriveWeightLabel(entry),
        quant: deriveQuantLabel(entry),
        sortOrder: deriveSortOrder(entry),
      });
    }
  }
  const weightColumns = Array.from(weightMap.values()).sort((a, b) => a.sortOrder - b.sortOrder);

  // Group entries by OS
  const byOs = new Map<string, LeaderboardEntry[]>();
  for (const entry of data) {
    const os = entry.os || 'unknown';
    if (!byOs.has(os)) byOs.set(os, []);
    byOs.get(os)!.push(entry);
  }

  // Build platform data
  const platforms: PlatformData[] = [];
  // Sort OS by predefined order, then alphabetical for unknowns
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

    // Group by socName within this OS
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
      const existing = row.cells[entry.modelSha256];
      // Keep the entry with the higher decode p90
      const newDecode = entry.decodeSpeed.p90 ?? entry.decodeSpeed.max ?? 0;
      const existingDecode = existing?.decode ?? 0;
      if (!existing || newDecode > existingDecode) {
        row.cells[entry.modelSha256] = {
          prefill: entry.prefillSpeed.max,
          decode: entry.decodeSpeed.p90 ?? entry.decodeSpeed.max,
          sampleCount: entry.sampleCount,
          backend: entry.backend,
        };
      }
    }

    // Sort rows by best average decode speed (descending)
    const rows = Array.from(bySoc.values()).sort((a, b) => {
      const avgA = Object.values(a.cells).reduce((s, c) => s + (c.decode ?? 0), 0) / Math.max(Object.values(a.cells).length, 1);
      const avgB = Object.values(b.cells).reduce((s, c) => s + (c.decode ?? 0), 0) / Math.max(Object.values(b.cells).length, 1);
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
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return '';
    }
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ModelFitPreviewPage() {
  const [data, setData] = useState<LeaderboardEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('');

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

  const { platforms, weightColumns } = data ? buildPlatforms(data) : { platforms: [], weightColumns: [] };

  // Auto-select first platform
  const activePlatformId = selectedPlatform || platforms[0]?.id || '';
  const activePlatform = platforms.find((p) => p.id === activePlatformId);

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <section className={styles.hero}>
          <p className={styles.eyebrow}>Performance Leaderboard</p>
          <h1 className={styles.title}>RWKV prefill / decode matrix</h1>
          <p className={styles.description}>
            按平台切换 Tab，纵轴是芯片，横轴是模型权重。数据来源于用户匿名上传的真实推理速度，展示各组合 top 10% 的成绩。
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
        ) : platforms.length === 0 ? (
          <section className={styles.comingSoonBox}>
            <h3 className={styles.comingSoonTitle}>暂无数据</h3>
            <p className={styles.comingSoonText}>
              还没有收到任何性能上报数据。请在 RWKV Chat App 中运行一次推理，数据会在回复完成后自动上传。
            </p>
          </section>
        ) : (
          <>
            <section className={styles.tabSection}>
              <div className={styles.tabScroller}>
                <div className={styles.tabRow}>
                  {platforms.map((platform) => (
                    <button
                      key={platform.id}
                      type="button"
                      className={`${styles.tabButton} ${activePlatformId === platform.id ? styles.tabButtonSelected : ''}`}
                      onClick={() => setSelectedPlatform(platform.id)}
                    >
                      {platform.label}
                    </button>
                  ))}
                </div>
              </div>

              {activePlatform ? (
                <div className={styles.metaBlock}>
                  <span>{activePlatform.label}</span>
                  <span>Chips: {activePlatform.rows.length}</span>
                  <span>Models: {weightColumns.length}</span>
                </div>
              ) : null}
            </section>

            {activePlatform ? (
              <>
                <section className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>
                    {activePlatform.label} SoC × Model
                  </h2>
                  <p className={styles.sectionDescription}>
                    展示 top 10% (P90) 的 Prefill / Decode 速度 (tokens/s)，按 Decode 速度着色
                  </p>
                </section>

                {activePlatform.rows.length === 0 ? (
                  <section className={styles.comingSoonBox}>
                    <h3 className={styles.comingSoonTitle}>该平台暂无数据</h3>
                    <p className={styles.comingSoonText}>等待用户上报</p>
                  </section>
                ) : (
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
                          {activePlatform.rows.map((row) => (
                            <tr key={row.socName}>
                              <th className={styles.rowCell}>
                                <div className={styles.rowTopline}>
                                  {row.socBrand && row.socBrand !== 'unknown' ? (
                                    <span className={styles.vendorTag}>{capitalizeBrand(row.socBrand)}</span>
                                  ) : null}
                                  <strong className={styles.rowName}>{row.socName}</strong>
                                </div>
                              </th>

                              {weightColumns.map((col) => {
                                const cell = row.cells[col.key];
                                const prefill = cell?.prefill ?? null;
                                const decode = cell?.decode ?? null;
                                return (
                                  <td
                                    key={col.key}
                                    className={`${styles.speedCell} ${buildCellClass(prefill, decode)}`}
                                  >
                                    <div className={styles.metricLine}>
                                      <span className={styles.metricLabel}>Prefill</span>
                                      <strong className={styles.metricValue}>
                                        {formatCompactSpeed(prefill)}
                                      </strong>
                                    </div>
                                    <div className={styles.metricLine}>
                                      <span className={styles.metricLabel}>Decode</span>
                                      <strong className={styles.metricValue}>
                                        {formatCompactSpeed(decode)}
                                      </strong>
                                    </div>
                                    {cell && cell.sampleCount > 0 ? (
                                      <div className={styles.noteTag}>
                                        n={cell.sampleCount} · {cell.backend}
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
                )}
              </>
            ) : null}

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
    </main>
  );
}
