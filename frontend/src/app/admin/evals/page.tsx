'use client';

import Link from 'next/link';
import { DragEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EvalRunImportResult, EvalRunSummaryRecord, EvalSettingsRecord } from '@/types/eval';
import {
  fetchAdminEvalRuns,
  fetchAdminEvalSettings,
  fetchAdminSession,
  updateAdminEvalSettings,
  uploadEvalRunArchive,
} from '@/utils';
import { AdminSessionResponse } from '@/types/remote-config';
import styles from './page.module.css';

const NEXT_PATH = '/admin/evals';

interface UploadRow {
  fileName: string;
  status: 'imported' | 'updated' | 'failed';
  message: string;
  createdAt: string;
  result?: EvalRunImportResult;
}

function normalizeError(error: unknown) {
  return error instanceof Error ? error.message : 'Operation failed';
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return 'n/a';
  }
  return new Date(value).toLocaleString();
}

function formatScore(value: number | null | undefined) {
  return typeof value === 'number' ? value.toFixed(2) : 'n/a';
}

function formatBytes(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}

function formatModelName(value: string | null | undefined) {
  if (!value) {
    return 'Unknown model';
  }
  return value.replace(/\.(zip|bin|gguf|pth|safetensors|json)$/i, '');
}

function formatDeviceSummary(run: EvalRunSummaryRecord) {
  const parts = [
    run.evalDeviceLabel,
    run.evalDeviceCpu,
    run.evalDeviceGpu,
    typeof run.evalDeviceMemoryGb === 'number' ? `${run.evalDeviceMemoryGb} GB RAM` : null,
    typeof run.evalDeviceVramGb === 'number' ? `${run.evalDeviceVramGb} GB VRAM` : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(' · ') : '未填写';
}

function formatCategorySummary(run: EvalRunSummaryRecord) {
  if (run.categories.length === 0) {
    return 'No categories';
  }
  return run.categories.slice(0, 4).map((category) => category.displayName).join(' · ');
}

function isAuthError(message: string) {
  return (
    message.includes('Missing bearer token') ||
    message.includes('Invalid token') ||
    message.includes('Session expired')
  );
}

export default function AdminEvalsPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [session, setSession] = useState<AdminSessionResponse | null>(null);
  const [runs, setRuns] = useState<EvalRunSummaryRecord[]>([]);
  const [settings, setSettings] = useState<EvalSettingsRecord | null>(null);
  const [selectedArchive, setSelectedArchive] = useState<File | null>(null);
  const [uploadRows, setUploadRows] = useState<UploadRow[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [archiveStatus, setArchiveStatus] = useState('');
  const [archiveError, setArchiveError] = useState('');
  const [settingsStatus, setSettingsStatus] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [thresholdInput, setThresholdInput] = useState('');

  const redirectToLogin = useCallback(() => {
    router.replace(`/admin/login?next=${encodeURIComponent(NEXT_PATH)}`);
  }, [router]);

  const refreshRuns = useCallback(async () => {
    setLoadingRuns(true);

    try {
      const nextRuns = await fetchAdminEvalRuns();
      setRuns(nextRuns);
    } catch (nextError) {
      const message = normalizeError(nextError);
      if (isAuthError(message)) {
        redirectToLogin();
        return;
      }
      setArchiveError(message);
    } finally {
      setLoadingRuns(false);
    }
  }, [redirectToLogin]);

  const refreshSettings = useCallback(async () => {
    setLoadingSettings(true);

    try {
      const nextSettings = await fetchAdminEvalSettings();
      setSettings(nextSettings);
      setThresholdInput(String(nextSettings.passThreshold));
    } catch (nextError) {
      const message = normalizeError(nextError);
      if (isAuthError(message)) {
        redirectToLogin();
        return;
      }
      setSettingsError(message);
    } finally {
      setLoadingSettings(false);
    }
  }, [redirectToLogin]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setCheckingSession(true);

      try {
        const nextSession = await fetchAdminSession();
        if (cancelled) {
          return;
        }

        if (!nextSession) {
          redirectToLogin();
          return;
        }

        setSession(nextSession);
        await Promise.all([refreshRuns(), refreshSettings()]);
      } catch (nextError) {
        if (cancelled) {
          return;
        }
        const message = normalizeError(nextError);
        if (isAuthError(message)) {
          redirectToLogin();
          return;
        }
        setArchiveError(message);
      } finally {
        if (!cancelled) {
          setCheckingSession(false);
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [redirectToLogin, refreshRuns, refreshSettings]);

  function clearSelectedArchive() {
    setSelectedArchive(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function handleSelectedFiles(fileList: FileList | null) {
    setArchiveStatus('');
    setArchiveError('');

    const files = fileList ? Array.from(fileList) : [];
    if (files.length === 0) {
      setSelectedArchive(null);
      return;
    }

    if (files.length > 1) {
      setSelectedArchive(null);
      setArchiveError('本次只支持上传一个 run zip。');
      return;
    }

    const [file] = files;
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setSelectedArchive(null);
      setArchiveError('只支持 .zip run archive。');
      return;
    }

    setSelectedArchive(file);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragActive(false);
    handleSelectedFiles(event.dataTransfer.files);
  }

  function handleDragOver(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    if (!dragActive) {
      setDragActive(true);
    }
  }

  function handleDragLeave(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragActive(false);
  }

  async function handleUpload() {
    if (!selectedArchive) {
      setArchiveError('请先选择一个 run zip。');
      return;
    }

    setUploading(true);
    setArchiveStatus('');
    setArchiveError('');

    try {
      const result = await uploadEvalRunArchive(selectedArchive);
      const nextRow: UploadRow = {
        fileName: selectedArchive.name,
        status: result.action,
        message: result.message,
        createdAt: new Date().toISOString(),
        result,
      };
      setUploadRows((current) => [nextRow, ...current].slice(0, 8));
      setArchiveStatus(
        `${result.action === 'updated' ? '已替换' : '已导入'} ${result.runId}，${result.sampleCount} 个样本，${result.scoredAttemptCount} 个已评分 attempts。`,
      );
      clearSelectedArchive();
      await refreshRuns();
    } catch (nextError) {
      const message = normalizeError(nextError);
      if (isAuthError(message)) {
        redirectToLogin();
        return;
      }
      const failedRow: UploadRow = {
        fileName: selectedArchive.name,
        status: 'failed',
        message,
        createdAt: new Date().toISOString(),
      };
      setUploadRows((current) => [failedRow, ...current].slice(0, 8));
      setArchiveError(message);
    } finally {
      setUploading(false);
    }
  }

  async function handleSaveThreshold() {
    const parsed = Number.parseFloat(thresholdInput);
    if (!Number.isFinite(parsed)) {
      setSettingsError('Pass threshold 必须是数字。');
      return;
    }

    setSavingSettings(true);
    setSettingsStatus('');
    setSettingsError('');

    try {
      const nextSettings = await updateAdminEvalSettings(parsed);
      setSettings(nextSettings);
      setThresholdInput(String(nextSettings.passThreshold));
      setSettingsStatus(`Pass threshold 已更新为 ${nextSettings.passThreshold.toFixed(2)}。`);
      await refreshRuns();
    } catch (nextError) {
      const message = normalizeError(nextError);
      if (isAuthError(message)) {
        redirectToLogin();
        return;
      }
      setSettingsError(message);
    } finally {
      setSavingSettings(false);
    }
  }

  if (checkingSession) {
    return (
      <main className={styles.page}>
        <section className={styles.hero}>
          <p className={styles.eyebrow}>Admin</p>
          <h1 className={styles.title}>Checking session...</h1>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Eval Console</p>
          <h1 className={styles.title}>Run Zip Importer</h1>
          <p className={styles.description}>
            后台现在只接受整个 run 的 zip 包。上传后会按 run snapshot 覆盖旧数据，并把 generation、
            scoring 和 sample attempts 一起重建到数据库。
          </p>
          <div className={styles.heroMeta}>
            <span className={styles.heroPill}>User: {session?.username || 'unknown'}</span>
            <span className={styles.heroPill}>Public URL: /evals</span>
            <span className={styles.heroPill}>
              Threshold: {settings ? settings.passThreshold.toFixed(2) : '...'}
            </span>
          </div>
        </div>

        <div className={styles.heroActions}>
          <Link href="/admin/eval" className={styles.primaryLink}>
            打开 Eval Browser
          </Link>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => void Promise.all([refreshRuns(), refreshSettings()])}
          >
            刷新数据
          </button>
        </div>
      </section>

      <section className={styles.grid}>
        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>Upload Run Zip</h2>
              <p className={styles.panelDescription}>
                支持拖拽或选择单个 `.zip` 文件。zip 根目录可以直接放 `manifest.json` /
                `generation_summary.json` / `samples/` / `scores/`，也可以外面再包一层 run 目录。
              </p>
            </div>
          </div>

          <label
            className={`${styles.dropZone} ${dragActive ? styles.dropZoneActive : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip,application/zip"
              onChange={(event) => handleSelectedFiles(event.target.files)}
              className={styles.fileInput}
            />
            <span className={styles.dropZoneTitle}>拖拽 run zip 到这里</span>
            <span className={styles.dropZoneText}>
              一个 zip 对应一个 eval run。散装 JSON 和文件夹直传不再支持。
            </span>
          </label>

          {selectedArchive ? (
            <div className={styles.selectionCard}>
              <div>
                <h3 className={styles.selectionTitle}>{selectedArchive.name}</h3>
                <p className={styles.selectionMeta}>{formatBytes(selectedArchive.size)}</p>
              </div>
              <button
                type="button"
                className={styles.linkButton}
                onClick={() => clearSelectedArchive()}
                disabled={uploading}
              >
                清空
              </button>
            </div>
          ) : (
            <p className={styles.empty}>还没有选择 run zip。</p>
          )}

          <div className={styles.actionRow}>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => void handleUpload()}
              disabled={!selectedArchive || uploading}
            >
              {uploading ? 'Uploading...' : 'Upload Run Zip'}
            </button>
          </div>

          {archiveStatus ? <p className={styles.success}>{archiveStatus}</p> : null}
          {archiveError ? <p className={styles.error}>{archiveError}</p> : null}
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>Pass Threshold</h2>
              <p className={styles.panelDescription}>
                通过线写入 `AppConfig` 的 `eval.pass_threshold`，公开页会按当前值实时计算 passed /
                failed / pending。
              </p>
            </div>
          </div>

          <div className={styles.settingsCard}>
            <label className={styles.field}>
              <span>Threshold</span>
              <input
                value={thresholdInput}
                onChange={(event) => setThresholdInput(event.target.value)}
                className={styles.textInput}
                inputMode="decimal"
                placeholder="8.0"
                disabled={loadingSettings || savingSettings}
              />
            </label>
            <p className={styles.settingsHint}>允许 0 到 10，默认 8.0。</p>
            <div className={styles.actionRow}>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => void handleSaveThreshold()}
                disabled={loadingSettings || savingSettings}
              >
                {savingSettings ? 'Saving...' : 'Save Threshold'}
              </button>
            </div>
            {settingsStatus ? <p className={styles.success}>{settingsStatus}</p> : null}
            {settingsError ? <p className={styles.error}>{settingsError}</p> : null}
          </div>
        </article>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2 className={styles.panelTitle}>Recent Imports</h2>
            <p className={styles.panelDescription}>最近几次上传会显示在这里，方便快速看校验结果。</p>
          </div>
        </div>

        {uploadRows.length === 0 ? (
          <p className={styles.empty}>本轮还没有上传记录。</p>
        ) : (
          <div className={styles.resultGrid}>
            {uploadRows.map((row) => (
              <article key={`${row.fileName}-${row.createdAt}`} className={styles.resultCard}>
                <div className={styles.resultHeader}>
                  <div>
                    <h3 className={styles.resultTitle}>{row.fileName}</h3>
                    <p className={styles.resultTime}>{formatDate(row.createdAt)}</p>
                  </div>
                  <span className={`${styles.statusPill} ${styles[`status_${row.status}`]}`}>
                    {row.status}
                  </span>
                </div>
                <p className={styles.resultMessage}>{row.message}</p>
                {row.result ? (
                  <dl className={styles.resultMeta}>
                    <div>
                      <dt>Run</dt>
                      <dd>{row.result.runId}</dd>
                    </div>
                    <div>
                      <dt>Samples</dt>
                      <dd>{row.result.sampleCount}</dd>
                    </div>
                    <div>
                      <dt>Attempts</dt>
                      <dd>{row.result.attemptCount}</dd>
                    </div>
                    <div>
                      <dt>Scored</dt>
                      <dd>{row.result.scoredAttemptCount}</dd>
                    </div>
                    <div>
                      <dt>Avg Score</dt>
                      <dd>{formatScore(row.result.averageWeightedScore)}</dd>
                    </div>
                  </dl>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2 className={styles.panelTitle}>Imported Runs</h2>
            <p className={styles.panelDescription}>
              这里展示当前数据库中的 run 概况。通过线调整后，pass/fail 统计会即时重算。
            </p>
          </div>
        </div>

        {loadingRuns ? (
          <p className={styles.empty}>Loading imported runs...</p>
        ) : runs.length === 0 ? (
          <p className={styles.empty}>数据库里还没有新的 eval run。</p>
        ) : (
          <div className={styles.runGrid}>
            {runs.map((run) => (
              <article key={run.runId} className={styles.runCard}>
                <div className={styles.runHeader}>
                  <div>
                    <p className={styles.runEyebrow}>{run.language}</p>
                    <h3 className={styles.runTitle}>{run.runId}</h3>
                  </div>
                  <span className={styles.runStatus}>{run.status}</span>
                </div>

                <p className={styles.runModel}>
                  {formatModelName(run.modelNameReportedByServer)} · {run.taskType}
                </p>
                <p className={styles.runMetaLine}>{formatDeviceSummary(run)}</p>
                <p className={styles.runMetaLine}>{formatCategorySummary(run)}</p>

                <dl className={styles.runStats}>
                  <div>
                    <dt>Generation</dt>
                    <dd>
                      {run.completedSamples}/{run.totalSamples}
                    </dd>
                  </div>
                  <div>
                    <dt>Scored Samples</dt>
                    <dd>
                      {run.scoredSampleCount}/{run.totalSamples}
                    </dd>
                  </div>
                  <div>
                    <dt>Avg Score</dt>
                    <dd>{formatScore(run.averageWeightedScore)}</dd>
                  </div>
                  <div>
                    <dt>Pass / Fail</dt>
                    <dd>
                      {run.passedSampleCount} / {run.failedSampleCount}
                    </dd>
                  </div>
                  <div>
                    <dt>Attempts</dt>
                    <dd>
                      {run.doneAttempts}/{run.totalAttempts}
                    </dd>
                  </div>
                  <div>
                    <dt>Uploaded</dt>
                    <dd>{formatDate(run.uploadedAt)}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
