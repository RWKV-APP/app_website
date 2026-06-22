'use client';

import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { useAtomValue } from 'jotai';
import { useRouter } from 'next/navigation';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { translationsAtom } from '@/atoms';
import { ThemeSwitcher, LanguageSwitcher } from '@/components';
import {
  EvalCategoryOptionRecord,
  EvalRunDetailRecord,
  EvalRunSummaryRecord,
  EvalSampleRecord,
} from '@/types/eval';
import {
  fetchAdminSession,
  fetchPublicEvalRunDetail,
  fetchPublicEvalRuns,
  fetchPublicEvalSampleDetail,
  fetchPublicEvalSamples,
} from '@/utils';
import styles from './page.module.css';

const NEXT_PATH = '/admin/eval';

type ChartDimension = 'weighted' | 'relevance' | 'quality' | 'fluency' | 'satisfaction';

const CHART_DIMENSIONS: ChartDimension[] = ['weighted', 'relevance', 'quality', 'fluency', 'satisfaction'];

function normalizeError(error: unknown) {
  return error instanceof Error ? error.message : '加载失败';
}

function formatScore(value: number | null | undefined) {
  return typeof value === 'number' ? value.toFixed(2) : 'n/a';
}

function formatModelName(value: string | null | undefined) {
  if (!value) return 'Unknown model';
  return value.replace(/\.(zip|bin|gguf|pth|safetensors|json)$/i, '');
}

function formatJudgeProvider(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value.trim();
  switch (normalized.toLowerCase()) {
    case 'deepseek':
      return 'DeepSeek';
    case 'siliconflow':
      return 'SiliconFlow';
    default:
      return normalized;
  }
}

function formatJudgeModelName(model: string | null | undefined, provider: string | null | undefined) {
  const modelName = model ? formatModelName(model) : 'Unknown model';
  const providerName = formatJudgeProvider(provider);
  return providerName ? `${modelName} (${providerName})` : modelName;
}

function formatChars(value: number | null | undefined) {
  if (typeof value !== 'number') return null;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(value);
}

function isAuthError(message: string) {
  return (
    message.includes('Missing bearer token') ||
    message.includes('Invalid token') ||
    message.includes('Session expired')
  );
}

function getDimensionLabel(dim: ChartDimension, t: { evalWeighted: string; evalRelevance: string; evalQuality: string; evalFluency: string; evalSatisfaction: string }) {
  const map: Record<ChartDimension, string> = {
    weighted: t.evalWeighted,
    relevance: t.evalRelevance,
    quality: t.evalQuality,
    fluency: t.evalFluency,
    satisfaction: t.evalSatisfaction,
  };
  return map[dim];
}

function getSampleDimensionScore(sample: EvalSampleRecord, dim: ChartDimension): number | null {
  switch (dim) {
    case 'weighted': return sample.averageWeightedScore;
    case 'relevance': return sample.averageRelevance;
    case 'quality': return sample.averageQuality;
    case 'fluency': return sample.averageFluency;
    case 'satisfaction': return sample.averageSatisfaction;
  }
}

export default function AdminEvalPage() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [evaluations, setEvaluations] = useState<EvalRunSummaryRecord[]>([]);
  const [selectedEvalId, setSelectedEvalId] = useState('');
  const [evalDetail, setEvalDetail] = useState<EvalRunDetailRecord | null>(null);
  const [samples, setSamples] = useState<EvalSampleRecord[]>([]);
  const [availableCategories, setAvailableCategories] = useState<EvalCategoryOptionRecord[]>([]);
  const sortOrder = 'desc';
  const [passThreshold, setPassThreshold] = useState<number | null>(null);
  const [loadingEvals, setLoadingEvals] = useState(false);
  const [loadingEvalDetail, setLoadingEvalDetail] = useState(false);
  const [loadingSamples, setLoadingSamples] = useState(false);
  const [error, setError] = useState('');

  // Detail panel state
  const [activeSample, setActiveSample] = useState<EvalSampleRecord | null>(null);
  const [activeSampleDetail, setActiveSampleDetail] = useState<EvalSampleRecord | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Category loading counter for progressive loading
  const loadingCountRef = useRef(0);

  // Overview inline chart state
  const [overviewChartDimension, setOverviewChartDimension] = useState<ChartDimension>('weighted');

  // Chart popup state
  const [chartCategory, setChartCategory] = useState<string | null>(null);
  const [chartDimension, setChartDimension] = useState<ChartDimension>('weighted');

  const t = useAtomValue(translationsAtom);

  const redirectToLogin = useCallback(() => {
    router.replace(`/admin/login?next=${encodeURIComponent(NEXT_PATH)}`);
  }, [router]);

  const closeDetail = useCallback(() => {
    setActiveSample(null);
    setActiveSampleDetail(null);
    setLoadingDetail(false);
  }, []);

  const handleSampleClick = useCallback(
    async (sample: EvalSampleRecord) => {
      setActiveSample(sample);
      setActiveSampleDetail(null);
      setLoadingDetail(true);
      try {
        const detail = await fetchPublicEvalSampleDetail(sample.runId, sample.sampleIndex);
        setActiveSampleDetail(detail);
      } catch (e) {
        const message = normalizeError(e);
        if (isAuthError(message)) {
          redirectToLogin();
          return;
        }
      } finally {
        setLoadingDetail(false);
      }
    },
    [redirectToLogin],
  );

  // Auth check
  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setCheckingSession(true);
      try {
        const session = await fetchAdminSession();
        if (cancelled) return;
        if (!session) {
          redirectToLogin();
          return;
        }
      } catch {
        if (!cancelled) redirectToLogin();
        return;
      } finally {
        if (!cancelled) setCheckingSession(false);
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [redirectToLogin]);

  // Load eval runs (after auth)
  useEffect(() => {
    if (checkingSession) return;

    let cancelled = false;

    async function load() {
      setLoadingEvals(true);
      setError('');
      try {
        const list = await fetchPublicEvalRuns();
        if (cancelled) return;
        setEvaluations(list);
        if (list.length > 0) {
          setSelectedEvalId((current) => current || list[0].runId);
        }
      } catch (e) {
        if (!cancelled) {
          const message = normalizeError(e);
          if (isAuthError(message)) {
            redirectToLogin();
            return;
          }
          setError(message);
        }
      } finally {
        if (!cancelled) setLoadingEvals(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [checkingSession, redirectToLogin]);

  // Load eval detail
  useEffect(() => {
    if (checkingSession || !selectedEvalId) {
      setEvalDetail(null);
      setLoadingEvalDetail(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoadingEvalDetail(true);
      setError('');
      try {
        const detail = await fetchPublicEvalRunDetail(selectedEvalId);
        if (cancelled) return;
        setEvalDetail(detail);
        setPassThreshold(detail.passThreshold);
      } catch (e) {
        if (!cancelled) setError(normalizeError(e));
      } finally {
        if (!cancelled) setLoadingEvalDetail(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [checkingSession, selectedEvalId]);

  // Load samples category-by-category for progressive rendering
  useEffect(() => {
    if (checkingSession || !selectedEvalId || !evalDetail) {
      setSamples([]);
      setAvailableCategories([]);
      setLoadingSamples(false);
      return;
    }

    let cancelled = false;

    // Extract category keys from evalDetail.categoryStats
    const categories = evalDetail.categoryStats.map((s) => ({
      key: s.key,
      displayName: s.displayName,
    }));

    // Set available categories immediately from evalDetail
    setAvailableCategories(
      evalDetail.categoryStats.map((s) => ({
        key: s.key,
        displayName: s.displayName,
      })),
    );
    setSamples([]);
    setLoadingSamples(true);
    setError('');

    // Load each category independently
    for (const cat of categories) {
      void (async () => {
        try {
          const response = await fetchPublicEvalSamples({
            runId: selectedEvalId,
            sourceCategory: cat.key,
            limit: 'all',
          });
          if (cancelled) return;
          setSamples((prev) => [...prev, ...response.items]);
          if (response.passThreshold !== undefined) {
            setPassThreshold(response.passThreshold);
          }
        } catch (e) {
          if (!cancelled) setError(normalizeError(e));
        } finally {
          if (!cancelled) {
            // Decrement loading counter — hide spinner when all done
            loadingCountRef.current--;
            if (loadingCountRef.current <= 0) {
              setLoadingSamples(false);
            }
          }
        }
      })();
    }

    loadingCountRef.current = categories.length;

    return () => {
      cancelled = true;
    };
  }, [checkingSession, selectedEvalId, evalDetail]);

  const selectedEvalSummary = useMemo(
    () => evaluations.find((ev) => ev.runId === selectedEvalId) || null,
    [evaluations, selectedEvalId],
  );

  const samplesByCategory = useMemo(() => {
    const map = new Map<string, EvalSampleRecord[]>();
    for (const cat of availableCategories) {
      map.set(cat.key, []);
    }
    for (const sample of samples) {
      const list = map.get(sample.sourceCategory);
      if (list) {
        list.push(sample);
      } else {
        map.set(sample.sourceCategory, [sample]);
      }
    }
    Array.from(map.values()).forEach((list) => {
      list.sort((a: EvalSampleRecord, b: EvalSampleRecord) => {
        const aScore = a.averageWeightedScore ?? -1;
        const bScore = b.averageWeightedScore ?? -1;
        return sortOrder === 'desc' ? bScore - aScore : aScore - bScore;
      });
    });
    return map;
  }, [samples, availableCategories, sortOrder]);

  const threshold = passThreshold ?? 8;

  const categoryStats = useMemo(() => {
    const result = new Map<
      string,
      {
        weighted: number; relevance: number; quality: number; fluency: number; satisfaction: number;
        total: number; aboveThreshold: number; belowThreshold: number;
      }
    >();
    for (const [key, list] of Array.from(samplesByCategory.entries())) {
      const scored = list.filter((s) => s.averageWeightedScore !== null);
      const count = scored.length || 1;
      const aboveThreshold = list.filter((s) => (s.averageWeightedScore ?? -1) >= threshold).length;
      result.set(key, {
        weighted: scored.reduce((sum, s) => sum + (s.averageWeightedScore ?? 0), 0) / count,
        relevance: scored.reduce((sum, s) => sum + (s.averageRelevance ?? 0), 0) / count,
        quality: scored.reduce((sum, s) => sum + (s.averageQuality ?? 0), 0) / count,
        fluency: scored.reduce((sum, s) => sum + (s.averageFluency ?? 0), 0) / count,
        satisfaction: scored.reduce((sum, s) => sum + (s.averageSatisfaction ?? 0), 0) / count,
        total: list.length,
        aboveThreshold,
        belowThreshold: list.length - aboveThreshold,
      });
    }
    return result;
  }, [samplesByCategory, threshold]);

  // Chart histogram computation (per-category popup)
  const chartData = useMemo(() => {
    if (!chartCategory) return null;
    const catSamples = samplesByCategory.get(chartCategory) || [];
    const buckets = Array.from({ length: 20 }, (_, i) => ({
      min: i * 0.5,
      max: (i + 1) * 0.5,
      label: `${(i * 0.5).toFixed(1)}`,
      count: 0,
    }));
    for (const sample of catSamples) {
      const score = getSampleDimensionScore(sample, chartDimension);
      if (score === null || score === undefined) continue;
      const bucketIndex = Math.min(Math.floor(score / 0.5), 19);
      buckets[bucketIndex].count++;
    }
    return buckets;
  }, [chartCategory, chartDimension, samplesByCategory]);

  // Overview inline chart — all samples combined
  const overviewChartData = useMemo(() => {
    const buckets = Array.from({ length: 20 }, (_, i) => ({
      min: i * 0.5,
      max: (i + 1) * 0.5,
      label: `${(i * 0.5).toFixed(1)}`,
      count: 0,
    }));
    for (const sample of samples) {
      const score = getSampleDimensionScore(sample, overviewChartDimension);
      if (score === null || score === undefined) continue;
      const bucketIndex = Math.min(Math.floor(score / 0.5), 19);
      buckets[bucketIndex].count++;
    }
    return buckets;
  }, [samples, overviewChartDimension]);

  const overviewTotalAbove = useMemo(
    () => samples.filter((s) => (s.averageWeightedScore ?? -1) >= threshold).length,
    [samples, threshold],
  );
  const overviewTotalBelow = samples.length - overviewTotalAbove;

  if (checkingSession) {
    return (
      <main className={styles.page}>
        <p className={styles.empty}>Checking session...</p>
      </main>
    );
  }

  const detailSample = activeSampleDetail ?? activeSample;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>{t.evalBrowserTitle}</h1>
            <nav className={styles.headerNav}>
              <Link href="/" className={styles.navLink}>
                {t.evalBackToDownload}
              </Link>
              <Link href="/admin/evals" className={styles.navLink}>
                {t.evalUploadAdmin}
              </Link>
            </nav>
          </div>
          {selectedEvalSummary ? (
            <p className={styles.subtitle}>
              {formatModelName(selectedEvalSummary.modelNameReportedByServer)}
            </p>
          ) : null}
        </div>
        <div className={styles.headerRight}>
          <LanguageSwitcher />
          <ThemeSwitcher />
          <label className={styles.field}>
            <span>{t.evalSelectEvaluation}</span>
            <select
              value={selectedEvalId}
              onChange={(e) => setSelectedEvalId(e.target.value)}
              className={styles.select}
              disabled={loadingEvals || evaluations.length === 0}
            >
              {evaluations.map((ev) => (
                <option key={ev.runId} value={ev.runId}>
                  {ev.runId}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      {loadingEvalDetail ? (
        <p className={styles.empty}>{t.evalLoadingEvaluation}</p>
      ) : evalDetail ? (
        <section className={styles.overview}>
          <div className={styles.overviewTop}>
            <p className={styles.overviewLabel}>{t.evalCurrentEvaluation}</p>
            <div className={styles.modelInfo}>
              <span className={styles.modelTag}>
                {t.evalResponseModel}: {formatModelName(evalDetail.modelNameReportedByServer)}
              </span>
              <span className={styles.modelTag}>
                {t.evalJudgeModel}: {formatJudgeModelName(evalDetail.judgeModel, evalDetail.judgeProvider)}
              </span>
            </div>
          </div>
          <div className={styles.categoryPills}>
            {evalDetail.categoryStats.map((stat) => (
              <div key={stat.key} className={styles.categoryPill}>
                <span className={styles.pillName}>{stat.displayName}</span>
                <span className={styles.pillBadge}>
                  {t.evalAvgScore}: {formatScore(stat.averageWeightedScore)}
                </span>
                <span className={styles.pillBadge}>{t.evalTotalQuestions}: {stat.totalSamples}</span>
              </div>
            ))}
          </div>

          {samples.length > 0 && (
            <div className={styles.overviewChart}>
              <div className={styles.overviewChartTop}>
                <div className={styles.overviewChartMeta}>
                  <span className={styles.overviewChartLabel}>{t.evalDistributionChart}</span>
                  <span className={styles.columnStatAbove}>↑ {overviewTotalAbove} {t.evalRecommended}</span>
                  <span className={styles.columnStatBelow}>↓ {overviewTotalBelow} {t.evalNotRecommended}</span>
                  <span className={styles.columnStatTotal}>{t.evalTotalQuestions}: {samples.length}</span>
                </div>
                <div className={styles.chartDimensionTabs}>
                  {CHART_DIMENSIONS.map((dim) => (
                    <button
                      key={dim}
                      type="button"
                      className={`${styles.dimensionTab} ${overviewChartDimension === dim ? styles.dimensionTabActive : ''}`}
                      onClick={() => setOverviewChartDimension(dim)}
                    >
                      {getDimensionLabel(dim, t)}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.overviewChartBody}>
                {(() => {
                  const maxCount = Math.max(...overviewChartData.map((b) => b.count), 1);
                  const thresholdBucketIndex = Math.min(Math.floor(threshold / 0.5), 19);
                  return overviewChartData.map((bucket, i) => {
                    const isAbove = bucket.min >= threshold;
                    const showThresholdLine = i === thresholdBucketIndex;
                    return (
                      <Fragment key={bucket.label}>
                        {showThresholdLine && (
                          <div className={styles.chartThresholdDivider}>
                            <span className={styles.chartThresholdLabel}>
                              {threshold}
                            </span>
                          </div>
                        )}
                        <div className={`${styles.chartCol} ${isAbove ? styles.chartColAbove : styles.chartColBelow}`}>
                          <span className={styles.chartBarCount}>{bucket.count || ''}</span>
                          <div className={styles.chartBarTrack}>
                            <div
                              className={styles.chartBar}
                              style={{ height: `${(bucket.count / maxCount) * 100}%` }}
                            />
                          </div>
                          <span className={styles.chartBucketLabel}>{bucket.label}</span>
                        </div>
                      </Fragment>
                    );
                  });
                })()}
              </div>
            </div>
          )}
        </section>
      ) : null}

      {error ? <p className={styles.errorPill}>{error}</p> : null}

{availableCategories.length === 0 && !loadingSamples ? (
        <p className={styles.empty}>{t.evalNoSamples}</p>
      ) : availableCategories.length === 0 ? (
        <p className={styles.empty}>{t.evalLoadingSamples}</p>
      ) : (
        <div className={styles.columnsWrap}>
          {availableCategories.map((cat) => {
            const catSamples = samplesByCategory.get(cat.key) || [];
            return (
              <section key={cat.key} className={styles.column}>
                <div className={styles.columnHeader}>
                  <div className={styles.columnHeaderTop}>
                    <h2 className={styles.columnTitle}>{cat.displayName}</h2>
                    <div className={styles.columnHeaderActions}>
                      <button
                        type="button"
                        className={styles.chartButton}
                        onClick={() => {
                          setChartCategory(cat.key);
                          setChartDimension('weighted');
                        }}
                        title={t.evalDistributionChart}
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                          <rect x="1" y="8" width="3" height="7" rx="0.5" />
                          <rect x="5.5" y="4" width="3" height="11" rx="0.5" />
                          <rect x="10" y="1" width="3" height="14" rx="0.5" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  {(() => {
                    const stat = categoryStats.get(cat.key);
                    if (!stat) return null;
                    return (
                      <>
                        <div className={styles.columnThresholdStats}>
                          <span className={styles.columnStatAbove}>
                            ↑ {stat.aboveThreshold} {t.evalRecommended}
                          </span>
                          <span className={styles.columnStatBelow}>
                            ↓ {stat.belowThreshold} {t.evalNotRecommended}
                          </span>
                          <span className={styles.columnStatTotal}>
                            {t.evalTotalQuestions}: {stat.total}
                          </span>
                        </div>
                        <dl className={styles.columnStats}>
                          <div>
                            <dt>{t.evalWeighted}</dt>
                            <dd>{stat.weighted.toFixed(2)}</dd>
                          </div>
                          <div>
                            <dt>{t.evalRelevance}</dt>
                            <dd>{stat.relevance.toFixed(2)}</dd>
                          </div>
                          <div>
                            <dt>{t.evalQuality}</dt>
                            <dd>{stat.quality.toFixed(2)}</dd>
                          </div>
                          <div>
                            <dt>{t.evalFluency}</dt>
                            <dd>{stat.fluency.toFixed(2)}</dd>
                          </div>
                          <div>
                            <dt>{t.evalSatisfaction}</dt>
                            <dd>{stat.satisfaction.toFixed(2)}</dd>
                          </div>
                        </dl>
                      </>
                    );
                  })()}
                </div>
                <div className={styles.columnList}>
                  {catSamples.length === 0 && loadingSamples ? (
                    <p className={styles.detailLoading}>{t.evalLoadingSamples}</p>
                  ) : null}
                  {catSamples.map((sample, index) => {
                    const score = sample.averageWeightedScore ?? 0;
                    const prevScore =
                      index > 0 ? (catSamples[index - 1].averageWeightedScore ?? 0) : null;

                    const showDivider =
                      prevScore !== null && prevScore >= threshold && score < threshold;

                    return (
                      <Fragment key={sample.sampleIndex}>
                        {showDivider && (
                          <div className={styles.thresholdDivider}>
                            <span className={styles.thresholdLabel}>{t.evalBelowNotRecommended}</span>
                          </div>
                        )}
                        <article
                          className={styles.sampleCard}
                          onClick={() => void handleSampleClick(sample)}
                        >
                          <div className={styles.sampleText}>
                            <p className={styles.sampleTitle}>{sample.renderingName}</p>
                            <p className={styles.samplePrompt}>{sample.prompt}</p>
                          </div>
                          <span className={styles.sampleScore}>
                            {formatScore(sample.averageWeightedScore)}
                          </span>
                        </article>
                      </Fragment>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Detail bottom panel */}
      {activeSample && detailSample && (
        <div className={styles.backdrop} onClick={closeDetail}>
          <section
            className={styles.detailPanel}
            onClick={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
          >
            <div className={styles.detailHeader}>
              <div>
                <p className={styles.detailCategory}>{detailSample.sourceCategoryDisplayName}</p>
                <p className={styles.detailRenderingName}>{detailSample.renderingName}</p>
                <p className={styles.detailPrompt}>{detailSample.prompt}</p>
                <p className={styles.detailTitleHint}>{t.evalTitleHint}</p>
              </div>
              <div className={styles.detailScores}>
                <span className={styles.detailMainScore}>
                  {formatScore(detailSample.averageWeightedScore)}
                </span>
                <dl className={styles.detailMetrics}>
                  <div>
                    <dt>{t.evalRelevance}</dt>
                    <dd>{formatScore(detailSample.averageRelevance)}</dd>
                  </div>
                  <div>
                    <dt>{t.evalQuality}</dt>
                    <dd>{formatScore(detailSample.averageQuality)}</dd>
                  </div>
                  <div>
                    <dt>{t.evalFluency}</dt>
                    <dd>{formatScore(detailSample.averageFluency)}</dd>
                  </div>
                  <div>
                    <dt>{t.evalSatisfaction}</dt>
                    <dd>{formatScore(detailSample.averageSatisfaction)}</dd>
                  </div>
                </dl>
                <p className={styles.detailFormula}>{t.evalScoringFormula}</p>
              </div>
              <button type="button" className={styles.detailClose} onClick={closeDetail}>
                &times;
              </button>
            </div>
            <div className={styles.detailBody}>
              {loadingDetail ? (
                <p className={styles.detailLoading}>{t.evalLoadingResponses}</p>
              ) : activeSampleDetail ? (
                <div className={styles.attemptList}>
                  {activeSampleDetail.attempts.map((attempt) => {
                    const chars = formatChars(attempt.responseChars);
                    return (
                      <article key={attempt.id} className={styles.attemptCard}>
                        <div className={styles.attemptHead}>
                          <span className={styles.attemptLabel}>
                            {t.evalResponse} #{attempt.attempt}
                          </span>
                          <div className={styles.attemptHeadRight}>
                            {chars ? (
                              <span className={styles.attemptChars}>
                                {chars} {t.evalChars}
                              </span>
                            ) : null}
                            <span className={styles.attemptScore}>
                              {formatScore(attempt.weightedScore)}
                            </span>
                          </div>
                        </div>
                        <dl className={styles.attemptDimensions}>
                          <div>
                            <dt>{t.evalRelevance}</dt>
                            <dd>{formatScore(attempt.relevance)}</dd>
                          </div>
                          <div>
                            <dt>{t.evalQuality}</dt>
                            <dd>{formatScore(attempt.quality)}</dd>
                          </div>
                          <div>
                            <dt>{t.evalFluency}</dt>
                            <dd>{formatScore(attempt.fluency)}</dd>
                          </div>
                          <div>
                            <dt>{t.evalSatisfaction}</dt>
                            <dd>{formatScore(attempt.satisfaction)}</dd>
                          </div>
                        </dl>
                        {attempt.briefNote ? (
                          <p className={styles.attemptNote}>{attempt.briefNote}</p>
                        ) : null}
                        {attempt.response ? (
                          <div className={styles.responseMarkdown}>
                            <ReactMarkdown>{attempt.response}</ReactMarkdown>
                          </div>
                        ) : (
                          <p className={styles.responseEmpty}>
                            {attempt.errorMessage || attempt.errorType || t.evalNoResponse}
                          </p>
                        )}
                      </article>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </section>
        </div>
      )}

      {/* Chart bottom panel */}
      {chartCategory && chartData && (
        <div className={styles.backdrop} onClick={() => setChartCategory(null)}>
          <section
            className={styles.chartPanel}
            onClick={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
          >
            <div className={styles.chartHeader}>
              <div>
                <h2 className={styles.chartTitle}>
                  {availableCategories.find((c) => c.key === chartCategory)?.displayName}
                </h2>
                <p className={styles.chartSubtitle}>{t.evalDistributionChart}</p>
              </div>
              <div className={styles.chartHeaderRight}>
                {(() => {
                  const stat = categoryStats.get(chartCategory);
                  if (!stat) return null;
                  return (
                    <div className={styles.chartHeaderStats}>
                      <span className={styles.chartStatAbove}>↑ {stat.aboveThreshold} {t.evalRecommended}</span>
                      <span className={styles.chartStatBelow}>↓ {stat.belowThreshold} {t.evalNotRecommended}</span>
                      <span className={styles.chartStatTotal}>{t.evalTotalQuestions}: {stat.total}</span>
                    </div>
                  );
                })()}
                <button
                  type="button"
                  className={styles.detailClose}
                  onClick={() => setChartCategory(null)}
                >
                  &times;
                </button>
              </div>
            </div>
            <div className={styles.chartDimensionTabs}>
              {CHART_DIMENSIONS.map((dim) => (
                <button
                  key={dim}
                  type="button"
                  className={`${styles.dimensionTab} ${chartDimension === dim ? styles.dimensionTabActive : ''}`}
                  onClick={() => setChartDimension(dim)}
                >
                  {getDimensionLabel(dim, t)}
                </button>
              ))}
            </div>
            <div className={styles.chartBody}>
              {(() => {
                const maxCount = Math.max(...chartData.map((b) => b.count), 1);
                // threshold bucket index: first bucket whose min >= threshold
                const thresholdBucketIndex = Math.min(Math.floor(threshold / 0.5), 19);
                return chartData.map((bucket, i) => {
                  const isAbove = bucket.min >= threshold;
                  const showThresholdLine = i === thresholdBucketIndex;
                  return (
                    <Fragment key={bucket.label}>
                      {showThresholdLine && (
                        <div className={styles.chartThresholdDivider}>
                          <span className={styles.chartThresholdLabel}>
                            {t.evalChartThresholdLine} ({threshold})
                          </span>
                        </div>
                      )}
                      <div className={`${styles.chartCol} ${isAbove ? styles.chartColAbove : styles.chartColBelow}`}>
                        <span className={styles.chartBarCount}>{bucket.count || ''}</span>
                        <div className={styles.chartBarTrack}>
                          <div
                            className={styles.chartBar}
                            style={{ height: `${(bucket.count / maxCount) * 100}%` }}
                          />
                        </div>
                        <span className={styles.chartBucketLabel}>{bucket.label}</span>
                      </div>
                    </Fragment>
                  );
                });
              })()}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
