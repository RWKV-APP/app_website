'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { EvalQuestionRecord, EvalRunRecord } from '@/types/eval';
import { fetchPublicEvalQuestions, fetchPublicEvalRuns } from '@/utils';
import styles from './page.module.css';

function formatScore(value: number | null) {
  return value === null ? 'n/a' : value.toFixed(2);
}

function formatModelName(value: string | null | undefined) {
  if (!value) {
    return 'Unknown model';
  }

  return value.replace(/\.(zip|bin|gguf|pth|safetensors|json)$/i, '');
}

function formatDeviceSummary(label: string | null | undefined, chip: string | null | undefined) {
  if (label && chip) {
    return `${label} · ${chip}`;
  }
  return label || chip || 'n/a';
}

function formatDate(value: string | null) {
  if (!value) {
    return 'n/a';
  }
  return new Date(value).toLocaleString();
}

function normalizeError(error: unknown) {
  return error instanceof Error ? error.message : '加载失败';
}

function getScoreBand(score: number | null) {
  if (score === null) {
    return 'pending';
  }
  if (score >= 8) {
    return 'good';
  }
  if (score >= 6) {
    return 'acceptable';
  }
  if (score >= 4) {
    return 'weak';
  }
  return 'unreliable';
}

function getScoreBandLabel(score: number | null) {
  const band = getScoreBand(score);
  switch (band) {
    case 'good':
      return 'Good';
    case 'acceptable':
      return 'Acceptable';
    case 'weak':
      return 'Weak';
    case 'unreliable':
      return 'Unreliable';
    default:
      return 'Pending';
  }
}

export default function EvalsPage() {
  const [runs, setRuns] = useState<EvalRunRecord[]>([]);
  const [selectedRunId, setSelectedRunId] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [search, setSearch] = useState('');
  const [minScore, setMinScore] = useState('');
  const [limit, setLimit] = useState('all');
  const [questions, setQuestions] = useState<EvalQuestionRecord[]>([]);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadRuns() {
      setLoadingRuns(true);
      setError('');

      try {
        const nextRuns = await fetchPublicEvalRuns();
        if (cancelled) {
          return;
        }
        setRuns(nextRuns);
        if (nextRuns.length > 0) {
          setSelectedRunId((current) => current || nextRuns[0].runId);
        }
      } catch (nextError) {
        if (cancelled) {
          return;
        }
        setError(normalizeError(nextError));
      } finally {
        if (!cancelled) {
          setLoadingRuns(false);
        }
      }
    }

    void loadRuns();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedRunId) {
      setQuestions([]);
      setTotal(0);
      setAvailableCategories([]);
      setLoadingQuestions(false);
      return;
    }

    let cancelled = false;

    async function loadQuestions() {
      setLoadingQuestions(true);
      setError('');

      try {
        const response = await fetchPublicEvalQuestions({
          runId: selectedRunId,
          category: selectedCategory || undefined,
          search: search.trim() || undefined,
          minAverageScore: minScore ? Number.parseFloat(minScore) : undefined,
          limit: limit === 'all' ? 'all' : Number.parseInt(limit, 10),
        });

        if (cancelled) {
          return;
        }

        setQuestions(response.items);
        setTotal(response.total);
        setAvailableCategories(response.availableCategories);
      } catch (nextError) {
        if (cancelled) {
          return;
        }
        setError(normalizeError(nextError));
      } finally {
        if (!cancelled) {
          setLoadingQuestions(false);
        }
      }
    }

    void loadQuestions();

    return () => {
      cancelled = true;
    };
  }, [selectedRunId, selectedCategory, search, minScore, limit]);

  const selectedRun = useMemo(
    () => runs.find((run) => run.runId === selectedRunId) || null,
    [runs, selectedRunId],
  );

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Public Eval Browser</p>
          <h1 className={styles.title}>RWKV Evaluation Leaderboard</h1>
          <p className={styles.description}>
            按 run、能力分类和平均分筛选高分问题。这里展示的是上传进 SQLite 后聚合出来的 question
            视图，每张卡片下方都能展开查看 5 次 attempts。
          </p>
          <div className={styles.heroLinks}>
            <Link href="/" className={styles.heroLink}>
              返回下载页
            </Link>
            <Link href="/admin/evals" className={styles.heroLinkSecondary}>
              打开上传后台
            </Link>
          </div>
        </div>

        <div className={styles.heroStatCard}>
          <h2 className={styles.heroStatTitle}>Current Run</h2>
          {selectedRun ? (
            <>
              <p className={styles.heroStatRun}>{selectedRun.runId}</p>
              <p className={styles.heroStatDevice}>
                Device: {formatDeviceSummary(selectedRun.evalDeviceLabel, selectedRun.evalDeviceChip)}
              </p>
              <dl className={styles.heroStatGrid}>
                <div>
                  <dt>Questions</dt>
                  <dd>{selectedRun.questionCount}</dd>
                </div>
                <div>
                  <dt>Scored</dt>
                  <dd>{selectedRun.scoredQuestionCount}</dd>
                </div>
                <div>
                  <dt>Avg Score</dt>
                  <dd>{formatScore(selectedRun.averageOfAverageScores)}</dd>
                </div>
                <div>
                  <dt>Updated</dt>
                  <dd>
                    {formatDate(selectedRun.latestUploadedAt || selectedRun.latestSampleUpdatedAt)}
                  </dd>
                </div>
              </dl>
            </>
          ) : (
            <p className={styles.heroStatEmpty}>还没有可公开展示的 eval 数据。</p>
          )}
        </div>
      </section>

      <section className={styles.filters}>
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel} htmlFor="runId">
            Run
          </label>
          <select
            id="runId"
            value={selectedRunId}
            onChange={(event) => {
              setSelectedRunId(event.target.value);
              setSelectedCategory('');
            }}
            className={styles.select}
            disabled={loadingRuns || runs.length === 0}
          >
            {runs.map((run) => (
              <option key={run.runId} value={run.runId}>
                {run.runId}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label className={styles.filterLabel} htmlFor="category">
            Category
          </label>
          <select
            id="category"
            value={selectedCategory}
            onChange={(event) => setSelectedCategory(event.target.value)}
            className={styles.select}
            disabled={!selectedRunId}
          >
            <option value="">全部能力</option>
            {availableCategories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label className={styles.filterLabel} htmlFor="minScore">
            Min Avg Score
          </label>
          <select
            id="minScore"
            value={minScore}
            onChange={(event) => setMinScore(event.target.value)}
            className={styles.select}
          >
            <option value="">全部</option>
            <option value="8">8+</option>
            <option value="7">7+</option>
            <option value="6">6+</option>
            <option value="4">4+</option>
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label className={styles.filterLabel} htmlFor="limit">
            Limit
          </label>
          <select
            id="limit"
            value={limit}
            onChange={(event) => setLimit(event.target.value)}
            className={styles.select}
          >
            <option value="all">全部</option>
            <option value="12">12</option>
            <option value="24">24</option>
            <option value="48">48</option>
            <option value="100">100</option>
          </select>
        </div>

        <div className={`${styles.filterGroup} ${styles.filterGroupSearch}`}>
          <label className={styles.filterLabel} htmlFor="search">
            Search
          </label>
          <input
            id="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className={styles.input}
            placeholder="按 display 或 prompt 搜索"
          />
        </div>
      </section>

      {error && <p className={styles.error}>{error}</p>}

      <section className={styles.resultsHeader}>
        <div>
          <p className={styles.resultsEyebrow}>Leaderboard</p>
          <h2 className={styles.resultsTitle}>
            {loadingQuestions ? 'Loading...' : `Found ${total} matched questions`}
          </h2>
        </div>
        {selectedRun && (
          <p className={styles.resultsSummary}>
            {formatModelName(selectedRun.modelNameReportedByServer)} · {selectedRun.language} ·{' '}
            {formatDeviceSummary(selectedRun.evalDeviceLabel, selectedRun.evalDeviceChip)}
          </p>
        )}
      </section>

      <section className={styles.cards}>
        {loadingQuestions ? (
          <article className={styles.placeholderCard}>正在从公开 API 读取聚合结果...</article>
        ) : questions.length === 0 ? (
          <article className={styles.placeholderCard}>当前筛选条件下没有查到题目。</article>
        ) : (
          questions.map((question, index) => {
            const band = getScoreBand(question.sampleAverageScore);
            return (
              <article key={`${question.runId}-${question.sampleIndex}`} className={styles.card}>
                <div className={styles.cardTop}>
                  <span className={styles.rank}>#{index + 1}</span>
                  <span className={`${styles.scoreBand} ${styles[`band_${band}`]}`}>
                    {getScoreBandLabel(question.sampleAverageScore)}
                  </span>
                </div>

                <div className={styles.cardScoreRow}>
                  <div>
                    <p className={styles.cardScore}>{formatScore(question.sampleAverageScore)}</p>
                    <p className={styles.cardMeta}>
                      sample #{question.sampleIndex} · {question.sourceCategoryName || '未分类'}
                    </p>
                  </div>
                  <div className={styles.cardStats}>
                    <span>
                      {question.scoredAttemptCount}/{question.attemptCount} scored
                    </span>
                    <span>
                      {question.repeatCountDone ?? question.attemptCount}/
                      {question.repeatCountTarget ?? question.attemptCount} attempts
                    </span>
                  </div>
                </div>

                <h3 className={styles.cardTitle}>{question.display}</h3>
                <p className={styles.cardPrompt}>{question.prompt}</p>

                <dl className={styles.metaGrid}>
                  <div>
                    <dt>Model</dt>
                    <dd>{formatModelName(question.modelNameReportedByServer)}</dd>
                  </div>
                  <div>
                    <dt>Device</dt>
                    <dd>{formatDeviceSummary(question.evalDeviceLabel, question.evalDeviceChip)}</dd>
                  </div>
                  <div>
                    <dt>Updated</dt>
                    <dd>{formatDate(question.sampleUpdatedAt)}</dd>
                  </div>
                </dl>

                <details className={styles.details}>
                  <summary className={styles.summary}>展开查看 5 次 attempts</summary>
                  <div className={styles.attempts}>
                    {question.attempts.map((attempt) => (
                      <article key={attempt.id} className={styles.attemptCard}>
                        <div className={styles.attemptHeader}>
                          <div>
                            <h4 className={styles.attemptTitle}>Attempt {attempt.attempt}</h4>
                            <p className={styles.attemptMeta}>
                              {attempt.status} · score {formatScore(attempt.score)} ·{' '}
                              {attempt.durationMs ?? 'n/a'} ms
                            </p>
                          </div>
                          {attempt.scoreNote && (
                            <span className={styles.scoreNote}>{attempt.scoreNote}</span>
                          )}
                        </div>
                        {attempt.errorMessage ? (
                          <p className={styles.attemptError}>{attempt.errorMessage}</p>
                        ) : (
                          <pre className={styles.response}>
                            {attempt.response || 'No response captured.'}
                          </pre>
                        )}
                      </article>
                    ))}
                  </div>
                </details>
              </article>
            );
          })
        )}
      </section>
    </main>
  );
}
