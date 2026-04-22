'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ThemeSwitcher } from '@/components';
import {
  AdminTelemetryPerfFilters,
  AdminTelemetryPerfRecord,
  AdminTelemetryPerfRecordsPage,
  fetchAdminSession,
  fetchAdminTelemetryFilters,
  fetchAdminTelemetryRecords,
} from '@/utils/api';
import styles from './page.module.css';

const PAGE_SIZE = 100;
const ALL_FILTER = 'all';

const EMPTY_FILTERS: AdminTelemetryPerfFilters = {
  os: [],
  appVersions: [],
  buildModes: [],
  batchCounts: [],
  modelTags: [],
  modelSizes: [],
  socBrands: [],
  socs: [],
};

const OS_LABELS: Record<string, string> = {
  macos: 'macOS',
  android: '安卓',
  ios: 'iOS',
  windows: 'Windows',
  linux: 'Linux',
};

const MODEL_TAG_LABELS: Record<string, string> = {
  Chat: 'Chat',
  VL: 'VL',
  TTS: 'TTS',
  Translate: 'Translate',
  Neko: 'Neko',
};

const BRAND_LABELS: Record<string, string> = {
  apple: 'Apple',
  qualcomm: 'Qualcomm',
  nvidia: 'NVIDIA',
  amd: 'AMD',
  intel: 'Intel',
  mediatek: 'MediaTek',
  samsung: 'Samsung',
  google: 'Google',
  huawei: 'Huawei',
};

const BUILD_MODE_LABELS: Record<string, string> = {
  debug: 'debug',
  profile: 'profile',
  release: 'release',
  unknown: '未知',
};

function parsePage(value: string | null): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function readSearchParamList(params: URLSearchParams, key: string): string[] {
  const seen = new Set<string>();
  const values: string[] = [];
  for (const rawValue of params.getAll(key)) {
    for (const part of rawValue.split(',')) {
      const value = part.trim();
      if (!value || value === ALL_FILTER) continue;
      const dedupeKey = value.toLowerCase();
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      values.push(value);
    }
  }
  return values;
}

function readRecordId(params: URLSearchParams): string {
  const value = params.get('recordId')?.trim();
  return value && /^\d+$/.test(value) ? value : '';
}

function syncPageToLocation(page: number, options?: { clearRecordId?: boolean }): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (page <= 1) {
    url.searchParams.delete('page');
  } else {
    url.searchParams.set('page', String(page));
  }
  if (options?.clearRecordId) {
    url.searchParams.delete('recordId');
  }
  window.history.pushState(null, '', url);
}

function formatNumber(value: number | null): string {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('zh-CN').format(value);
}

function formatMemory(value: number | null): string {
  if (value === null || value === undefined) return '-';
  if (value >= 1024) {
    return `${(value / 1024).toFixed(value % 1024 === 0 ? 0 : 1)} GB`;
  }
  return `${value} MB`;
}

function formatModelSize(value: number | null): string {
  if (value === null || value === undefined) return '-';
  return `${value}B`;
}

function formatSpeed(value: number): string {
  return `${value.toFixed(2)} t/s`;
}

function displayValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '-';
  return String(value);
}

function toggleFilterValue(values: string[], value: string): string[] {
  if (values.includes(value)) {
    return values.filter((item) => item !== value);
  }
  return [...values, value];
}

function getVisibleRange(pageData: AdminTelemetryPerfRecordsPage | null): string {
  if (!pageData || pageData.total === 0) return '0-0';
  const first = (pageData.page - 1) * pageData.limit + 1;
  const last = Math.min(pageData.page * pageData.limit, pageData.total);
  return `${first}-${last}`;
}

export default function TelemetryRecordsPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [pageReady, setPageReady] = useState(false);
  const [page, setPage] = useState(1);
  const [pageData, setPageData] = useState<AdminTelemetryPerfRecordsPage | null>(null);
  const [filters, setFilters] = useState<AdminTelemetryPerfFilters>(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);
  const [loadingFilters, setLoadingFilters] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOs, setSelectedOs] = useState<string[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<string[]>([]);
  const [selectedModelTag, setSelectedModelTag] = useState<string[]>([]);
  const [selectedSize, setSelectedSize] = useState<string[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<string[]>([]);
  const [selectedSoc, setSelectedSoc] = useState<string[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string[]>([]);
  const [selectedBuildMode, setSelectedBuildMode] = useState<string[]>([]);
  const [selectedRecordId, setSelectedRecordId] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setPage(parsePage(params.get('page')));
    setSelectedRecordId(readRecordId(params));
    setSelectedOs(readSearchParamList(params, 'os'));
    setSelectedBatch(readSearchParamList(params, 'batchCount'));
    setSelectedModelTag(readSearchParamList(params, 'modelTag'));
    setSelectedSize(readSearchParamList(params, 'modelSize'));
    setSelectedBrand(readSearchParamList(params, 'socBrand'));
    setSelectedSoc(readSearchParamList(params, 'socName'));
    setSelectedVersion(readSearchParamList(params, 'appVersion'));
    setSelectedBuildMode(readSearchParamList(params, 'buildMode'));
    setPageReady(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const session = await fetchAdminSession();
        if (cancelled) return;
        if (!session) {
          const nextPath =
            typeof window !== 'undefined'
              ? `${window.location.pathname}${window.location.search}`
              : '/labs/model-fit-preview/records';
          router.replace(`/admin/login?next=${encodeURIComponent(nextPath)}`);
          return;
        }
        setAuthed(true);
      } catch {
        if (!cancelled) {
          const nextPath =
            typeof window !== 'undefined'
              ? `${window.location.pathname}${window.location.search}`
              : '/labs/model-fit-preview/records';
          router.replace(`/admin/login?next=${encodeURIComponent(nextPath)}`);
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (!authed) return;
    let cancelled = false;
    setLoadingFilters(true);

    fetchAdminTelemetryFilters()
      .then((nextFilters) => {
        if (!cancelled) {
          setFilters(nextFilters);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFilters(EMPTY_FILTERS);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingFilters(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authed]);

  useEffect(() => {
    if (!authed || !pageReady) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    const selectedBatchCounts = selectedBatch
      .map((batchCount) => Number.parseInt(batchCount, 10))
      .filter((batchCount) => Number.isFinite(batchCount) && batchCount > 0);

    fetchAdminTelemetryRecords({
      page,
      limit: PAGE_SIZE,
      recordId: selectedRecordId ? Number.parseInt(selectedRecordId, 10) : undefined,
      os: selectedOs,
      appVersion: selectedVersion,
      buildMode: selectedBuildMode,
      batchCount: selectedBatchCounts,
      modelTag: selectedModelTag,
      modelSize: selectedSize,
      socBrand: selectedBrand,
      socName: selectedSoc,
    })
      .then((nextPageData) => {
        if (cancelled) return;
        if (nextPageData.page > nextPageData.totalPages) {
          setPage(nextPageData.totalPages);
          syncPageToLocation(nextPageData.totalPages);
          return;
        }
        setPageData(nextPageData);
      })
      .catch((nextError: unknown) => {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : '加载失败');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    authed,
    page,
    pageReady,
    selectedBatch,
    selectedBrand,
    selectedBuildMode,
    selectedModelTag,
    selectedOs,
    selectedRecordId,
    selectedSize,
    selectedSoc,
    selectedVersion,
  ]);

  const rows = pageData?.items ?? [];
  const totalPages = pageData?.totalPages ?? 1;
  const visibleRange = useMemo(() => getVisibleRange(pageData), [pageData]);

  const goToPage = useCallback(
    (nextPage: number) => {
      const clamped = Math.min(Math.max(nextPage, 1), totalPages);
      setPage(clamped);
      syncPageToLocation(clamped);
    },
    [totalPages],
  );

  const resetToFirstPage = useCallback((options?: { clearRecordId?: boolean }) => {
    if (options?.clearRecordId) {
      setSelectedRecordId('');
    }
    setPage(1);
    syncPageToLocation(1, options);
  }, []);

  const resetFilters = useCallback(() => {
    setSelectedOs([]);
    setSelectedBatch([]);
    setSelectedModelTag([]);
    setSelectedSize([]);
    setSelectedBrand([]);
    setSelectedSoc([]);
    setSelectedVersion([]);
    setSelectedBuildMode([]);
    setSelectedRecordId('');
    resetToFirstPage({ clearRecordId: true });
  }, [resetToFirstPage]);

  const hasActiveFilters =
    selectedRecordId !== '' ||
    selectedOs.length > 0 ||
    selectedBatch.length > 0 ||
    selectedModelTag.length > 0 ||
    selectedSize.length > 0 ||
    selectedBrand.length > 0 ||
    selectedSoc.length > 0 ||
    selectedVersion.length > 0 ||
    selectedBuildMode.length > 0;

  const renderStatus = () => {
    if (!authed || !pageReady) {
      return (
        <section className={styles.stateBox}>
          <h2>正在验证登录状态...</h2>
        </section>
      );
    }

    if (loading) {
      return (
        <section className={styles.stateBox}>
          <h2>Loading...</h2>
          <p>正在加载第 {page} 页</p>
        </section>
      );
    }

    if (error) {
      return (
        <section className={styles.stateBox}>
          <h2>加载失败</h2>
          <p>{error}</p>
        </section>
      );
    }

    if (rows.length === 0) {
      return (
        <section className={styles.stateBox}>
          <h2>{hasActiveFilters ? '当前筛选暂无数据' : '暂无上报数据'}</h2>
        </section>
      );
    }

    return null;
  };

  const status = renderStatus();

  return (
    <main className={styles.page}>
      <div className={styles.navbarWrap}>
        <nav className={styles.navbar}>
          <Link href="/" className={styles.navLeft}>
            <span className={styles.navTitle}>RWKV Chat</span>
          </Link>
          <div className={styles.navRight}>
            <Link href="/labs/model-fit-preview" className={styles.navLink}>
              <span aria-hidden="true">←</span>
              Matrix
            </Link>
            <ThemeSwitcher />
          </div>
        </nav>
      </div>

      <div className={styles.shell}>
        <section className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>Telemetry Records</p>
            <h1 className={styles.title}>Benchmark 上报明细</h1>
          </div>
          <div className={styles.heroStats}>
            <div>
              <span>总记录</span>
              <strong>{formatNumber(pageData?.total ?? null)}</strong>
            </div>
            <div>
              <span>当前页</span>
              <strong>
                {pageData?.page ?? page} / {totalPages}
              </strong>
            </div>
            <div>
              <span>范围</span>
              <strong>{visibleRange}</strong>
            </div>
            <div>
              <span>每页</span>
              <strong>{PAGE_SIZE}</strong>
            </div>
          </div>
        </section>

        <section className={styles.filterSection}>
          <FilterRow label="平台">
            <FilterButton
              selected={selectedOs.length === 0}
              onClick={() => {
                setSelectedOs([]);
                resetToFirstPage({ clearRecordId: true });
              }}
            >
              不限制
            </FilterButton>
            {filters.os.map((os) => (
              <FilterButton
                key={os}
                selected={selectedOs.includes(os)}
                onClick={() => {
                  setSelectedOs((current) => toggleFilterValue(current, os));
                  resetToFirstPage({ clearRecordId: true });
                }}
              >
                {OS_LABELS[os] ?? os}
              </FilterButton>
            ))}
          </FilterRow>

          {filters.batchCounts.length > 0 ? (
            <FilterRow label="并发">
              <FilterButton
                selected={selectedBatch.length === 0}
                onClick={() => {
                  setSelectedBatch([]);
                  resetToFirstPage({ clearRecordId: true });
                }}
              >
                不限制
              </FilterButton>
              {filters.batchCounts.map((batchCount) => (
                <FilterButton
                  key={batchCount}
                  selected={selectedBatch.includes(String(batchCount))}
                  onClick={() => {
                    setSelectedBatch((current) => toggleFilterValue(current, String(batchCount)));
                    resetToFirstPage({ clearRecordId: true });
                  }}
                >
                  {batchCount === 1 ? '单条' : `batch×${batchCount}`}
                </FilterButton>
              ))}
            </FilterRow>
          ) : null}

          {filters.modelTags.length > 0 ? (
            <FilterRow label="类型">
              <FilterButton
                selected={selectedModelTag.length === 0}
                onClick={() => {
                  setSelectedModelTag([]);
                  resetToFirstPage({ clearRecordId: true });
                }}
              >
                不限制
              </FilterButton>
              {filters.modelTags.map((tag) => (
                <FilterButton
                  key={tag}
                  selected={selectedModelTag.includes(tag)}
                  onClick={() => {
                    setSelectedModelTag((current) => toggleFilterValue(current, tag));
                    resetToFirstPage({ clearRecordId: true });
                  }}
                >
                  {MODEL_TAG_LABELS[tag] ?? tag}
                </FilterButton>
              ))}
            </FilterRow>
          ) : null}

          {filters.modelSizes.length > 0 ? (
            <FilterRow label="权重">
              <FilterButton
                selected={selectedSize.length === 0}
                onClick={() => {
                  setSelectedSize([]);
                  resetToFirstPage({ clearRecordId: true });
                }}
              >
                不限制
              </FilterButton>
              {filters.modelSizes.map((size) => (
                <FilterButton
                  key={size}
                  selected={selectedSize.includes(size)}
                  onClick={() => {
                    setSelectedSize((current) => toggleFilterValue(current, size));
                    resetToFirstPage({ clearRecordId: true });
                  }}
                >
                  {size}
                </FilterButton>
              ))}
            </FilterRow>
          ) : null}

          {filters.socBrands.length > 0 ? (
            <FilterRow label="芯片">
              <FilterButton
                selected={selectedBrand.length === 0}
                onClick={() => {
                  setSelectedBrand([]);
                  resetToFirstPage({ clearRecordId: true });
                }}
              >
                不限制
              </FilterButton>
              {filters.socBrands.map((brand) => (
                <FilterButton
                  key={brand}
                  selected={selectedBrand.includes(brand)}
                  onClick={() => {
                    setSelectedBrand((current) => toggleFilterValue(current, brand));
                    resetToFirstPage({ clearRecordId: true });
                  }}
                >
                  {BRAND_LABELS[brand] ?? brand}
                </FilterButton>
              ))}
            </FilterRow>
          ) : null}

          {filters.socs.length > 0 ? (
            <FilterRow label="SoC">
              <FilterButton
                selected={selectedSoc.length === 0}
                onClick={() => {
                  setSelectedSoc([]);
                  resetToFirstPage({ clearRecordId: true });
                }}
              >
                不限制
              </FilterButton>
              {filters.socs.map((soc) => (
                <FilterButton
                  key={soc}
                  selected={selectedSoc.includes(soc)}
                  title={soc}
                  onClick={() => {
                    setSelectedSoc((current) => toggleFilterValue(current, soc));
                    resetToFirstPage({ clearRecordId: true });
                  }}
                >
                  {soc}
                </FilterButton>
              ))}
            </FilterRow>
          ) : null}

          {filters.appVersions.length > 0 ? (
            <FilterRow label="APP 版本">
              <FilterButton
                selected={selectedVersion.length === 0}
                onClick={() => {
                  setSelectedVersion([]);
                  resetToFirstPage({ clearRecordId: true });
                }}
              >
                不限制
              </FilterButton>
              {filters.appVersions.map((version) => (
                <FilterButton
                  key={version}
                  selected={selectedVersion.includes(version)}
                  onClick={() => {
                    setSelectedVersion((current) => toggleFilterValue(current, version));
                    resetToFirstPage({ clearRecordId: true });
                  }}
                >
                  v{version}
                </FilterButton>
              ))}
            </FilterRow>
          ) : null}

          {filters.buildModes.length > 0 ? (
            <FilterRow label="构建模式">
              <FilterButton
                selected={selectedBuildMode.length === 0}
                onClick={() => {
                  setSelectedBuildMode([]);
                  resetToFirstPage({ clearRecordId: true });
                }}
              >
                不限制
              </FilterButton>
              {filters.buildModes.map((buildMode) => (
                <FilterButton
                  key={buildMode}
                  selected={selectedBuildMode.includes(buildMode)}
                  onClick={() => {
                    setSelectedBuildMode((current) => toggleFilterValue(current, buildMode));
                    resetToFirstPage({ clearRecordId: true });
                  }}
                >
                  {BUILD_MODE_LABELS[buildMode] ?? buildMode}
                </FilterButton>
              ))}
            </FilterRow>
          ) : null}

          <div className={styles.filterMeta}>
            <button type="button" className={styles.resetButton} onClick={resetFilters}>
              重置筛选
            </button>
            {selectedRecordId ? <span>Record ID: {selectedRecordId}</span> : null}
            {loadingFilters ? <span>正在加载筛选项...</span> : null}
          </div>
        </section>

        {status ? (
          status
        ) : (
          <>
            <PaginationBar
              page={pageData?.page ?? page}
              totalPages={totalPages}
              total={pageData?.total ?? 0}
              visibleRange={visibleRange}
              onPageChange={goToPage}
            />

            <section className={styles.tableSection}>
              <div className={styles.tableScroll}>
                <table className={styles.recordsTable}>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>OS</th>
                      <th>OS Version</th>
                      <th>App Version</th>
                      <th>App Build</th>
                      <th>SoC Brand</th>
                      <th>SoC Name</th>
                      <th>Device Model</th>
                      <th>Device Display</th>
                      <th>CPU</th>
                      <th>GPU</th>
                      <th>RAM</th>
                      <th>VRAM</th>
                      <th>Model Name</th>
                      <th>Model File</th>
                      <th>Model SHA256</th>
                      <th>Size</th>
                      <th>Quant</th>
                      <th>Backend</th>
                      <th>Batch</th>
                      <th>Prefill</th>
                      <th>Decode</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <RecordRow key={row.id} record={row} />
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <PaginationBar
              page={pageData?.page ?? page}
              totalPages={totalPages}
              total={pageData?.total ?? 0}
              visibleRange={visibleRange}
              onPageChange={goToPage}
            />
          </>
        )}
      </div>
    </main>
  );
}

function PaginationBar({
  page,
  totalPages,
  total,
  visibleRange,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  visibleRange: string;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className={styles.paginationBar}>
      <div className={styles.paginationMeta}>
        {visibleRange} / {formatNumber(total)}
      </div>
      <div className={styles.paginationControls}>
        <button type="button" onClick={() => onPageChange(1)} disabled={page <= 1}>
          <span aria-hidden="true">«</span>
          首页
        </button>
        <button type="button" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
          <span aria-hidden="true">‹</span>
          上一页
        </button>
        <span className={styles.pageIndicator}>
          {page} / {totalPages}
        </span>
        <button type="button" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
          下一页
          <span aria-hidden="true">›</span>
        </button>
        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={page >= totalPages}
        >
          末页
          <span aria-hidden="true">»</span>
        </button>
      </div>
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.filterRow}>
      <span className={styles.filterLabel}>{label}</span>
      <div className={styles.filterControls}>{children}</div>
    </div>
  );
}

function FilterButton({
  selected,
  children,
  onClick,
  title,
}: {
  selected: boolean;
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      className={`${styles.filterButton} ${selected ? styles.filterButtonSelected : ''}`}
      onClick={onClick}
      title={title}
    >
      {children}
    </button>
  );
}

function RecordRow({ record }: { record: AdminTelemetryPerfRecord }) {
  return (
    <tr>
      <td className={styles.numericCell}>{record.id}</td>
      <td>{displayValue(record.os)}</td>
      <td>{displayValue(record.osVersion)}</td>
      <td>{displayValue(record.appVersion)}</td>
      <td>{displayValue(record.appBuild)}</td>
      <td>{displayValue(record.socBrand)}</td>
      <td>{displayValue(record.socName)}</td>
      <td>{displayValue(record.deviceModel)}</td>
      <td>{displayValue(record.deviceDisplayName)}</td>
      <td>{displayValue(record.cpuName)}</td>
      <td>{displayValue(record.gpuName)}</td>
      <td>{formatMemory(record.totalMemoryMb)}</td>
      <td>{formatMemory(record.totalVramMb)}</td>
      <td>{displayValue(record.modelName)}</td>
      <td>{displayValue(record.modelFileName)}</td>
      <td className={styles.hashCell}>{displayValue(record.modelSha256)}</td>
      <td className={styles.numericCell}>{formatModelSize(record.modelSizeB)}</td>
      <td>{displayValue(record.quantization)}</td>
      <td>{displayValue(record.backend)}</td>
      <td>{record.isBatch ? `batch x ${record.batchCount}` : 'single'}</td>
      <td className={styles.numericCell}>{formatSpeed(record.prefillSpeed)}</td>
      <td className={styles.numericCell}>{formatSpeed(record.decodeSpeed)}</td>
    </tr>
  );
}
