'use client';

import Link from 'next/link';
import { DragEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EvalImportResult, EvalRunRecord } from '@/types/eval';
import { fetchAdminEvalRuns, fetchAdminSession, uploadEvalSample } from '@/utils';
import { AdminSessionResponse } from '@/types/remote-config';
import styles from './page.module.css';

const NEXT_PATH = '/admin/evals';

interface UploadRow {
  fileName: string;
  status: 'imported' | 'updated' | 'skipped' | 'failed';
  message: string;
  result?: EvalImportResult;
}

function normalizeError(error: unknown) {
  return error instanceof Error ? error.message : 'Operation failed';
}

function formatDate(value: string | null) {
  if (!value) {
    return 'n/a';
  }
  return new Date(value).toLocaleString();
}

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
  return label || chip || '未填写';
}

function formatRunLabel(run: EvalRunRecord) {
  return `${run.runId} · ${run.questionCount} questions`;
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
  const [runs, setRuns] = useState<EvalRunRecord[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadRows, setUploadRows] = useState<UploadRow[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [deviceLabel, setDeviceLabel] = useState('');
  const [deviceChip, setDeviceChip] = useState('');

  const redirectToLogin = useCallback(() => {
    router.replace(`/admin/login?next=${encodeURIComponent(NEXT_PATH)}`);
  }, [router]);

  const refreshRuns = useCallback(async () => {
    setLoadingRuns(true);
    setError('');

    try {
      const nextRuns = await fetchAdminEvalRuns();
      setRuns(nextRuns);
    } catch (nextError) {
      const message = normalizeError(nextError);
      if (isAuthError(message)) {
        redirectToLogin();
        return;
      }
      setError(message);
    } finally {
      setLoadingRuns(false);
    }
  }, [redirectToLogin]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setCheckingSession(true);
      setError('');

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
        await refreshRuns();
      } catch (nextError) {
        if (cancelled) {
          return;
        }
        const message = normalizeError(nextError);
        if (isAuthError(message)) {
          redirectToLogin();
          return;
        }
        setError(message);
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
  }, [redirectToLogin, refreshRuns]);

  function handleSelectedFiles(nextFiles: FileList | null) {
    setSelectedFiles(nextFiles ? Array.from(nextFiles) : []);
    setStatus('');
    setError('');
  }

  function clearSelection() {
    setSelectedFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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
    if (selectedFiles.length === 0) {
      setError('请先选择一个或多个 evaluation JSON 文件。');
      return;
    }

    setUploading(true);
    setStatus('');
    setError('');

    const results: UploadRow[] = [];
    let importedCount = 0;

    for (const file of selectedFiles) {
      try {
        const content = await file.text();
        const result = await uploadEvalSample({
          fileName: file.name,
          content,
          deviceLabel: deviceLabel.trim() || undefined,
          deviceChip: deviceChip.trim() || undefined,
        });

        results.push({
          fileName: file.name,
          status: result.action,
          message: result.message,
          result,
        });
        if (result.action !== 'skipped') {
          importedCount += 1;
        }
      } catch (nextError) {
        const message = normalizeError(nextError);
        if (isAuthError(message)) {
          redirectToLogin();
          return;
        }
        results.push({
          fileName: file.name,
          status: 'failed',
          message,
        });
      }
    }

    setUploadRows(results);
    const failedCount = results.filter((row) => row.status === 'failed').length;
    const skippedCount = results.filter((row) => row.status === 'skipped').length;
    setStatus(
      `完成 ${results.length} 个文件处理：成功导入 ${importedCount} 个，跳过 ${skippedCount} 个，失败 ${failedCount} 个。`,
    );
    clearSelection();

    if (importedCount > 0) {
      await refreshRuns();
    }

    setUploading(false);
  }

  const totalSelectedBytes = useMemo(
    () => selectedFiles.reduce((sum, file) => sum + file.size, 0),
    [selectedFiles],
  );

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
        <div>
          <p className={styles.eyebrow}>Eval Console</p>
          <h1 className={styles.title}>Evaluation Importer</h1>
          <p className={styles.description}>
            上传单个 sample JSON 文件后，我们会把每次 attempt 连同冗余 metadata 一起写入
            SQLite。manifest 会写入 run 级元数据。公开展示页会直接从这些导入后的 row
            和 run metadata 聚合高分问题。
          </p>
          <div className={styles.metaRow}>
            <span className={styles.metaPill}>User: {session?.username || 'unknown'}</span>
            <span className={styles.metaPill}>
              Public URL: <Link href="/evals">/evals</Link>
            </span>
          </div>
        </div>

        <div className={styles.heroActions}>
          <Link href="/evals" className={styles.primaryLink}>
            打开公开展示页
          </Link>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => void refreshRuns()}
          >
            刷新已导入数据
          </button>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2 className={styles.panelTitle}>Upload Eval JSON</h2>
            <p className={styles.panelDescription}>
              直接拖拽 `samples/` 目录里的 JSON 文件即可。如果一起带上 `manifest.json`，
              run 级元数据也会一起导入。接口会按 `run_id + sample_index + attempt` 去重，并用最新上传内容覆盖同一题目的旧 attempts。
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
            accept=".json,application/json"
            multiple
            onChange={(event) => handleSelectedFiles(event.target.files)}
            className={styles.fileInput}
          />
          <span className={styles.dropZoneTitle}>拖拽 evaluation JSON 文件到这里</span>
          <span className={styles.dropZoneText}>
            推荐直接选择一个 run 目录下的 `samples/*.json`，也可以把 `manifest.json`
            一起拖进来。
          </span>
        </label>

        <div className={styles.uploadOptions}>
          <h3 className={styles.selectionTitle}>Optional Run Device</h3>
          <p className={styles.selectionMeta}>
            当前 examples 里没有稳定的设备字段时，可以在这里手动补录。它会应用到本次上传涉及的 run。
          </p>
          <div className={styles.optionGrid}>
            <label className={styles.optionField}>
              <span>设备名称</span>
              <input
                value={deviceLabel}
                onChange={(event) => setDeviceLabel(event.target.value)}
                className={styles.textInput}
                placeholder="例如：MacBook Pro 16-inch"
              />
            </label>
            <label className={styles.optionField}>
              <span>芯片</span>
              <input
                value={deviceChip}
                onChange={(event) => setDeviceChip(event.target.value)}
                className={styles.textInput}
                placeholder="例如：Apple M4 Pro"
              />
            </label>
          </div>
        </div>

        {selectedFiles.length > 0 ? (
          <div className={styles.selectionPanel}>
            <div className={styles.selectionHeader}>
              <h3 className={styles.selectionTitle}>Ready to upload</h3>
              <button
                type="button"
                className={styles.linkButton}
                onClick={() => clearSelection()}
                disabled={uploading}
              >
                清空
              </button>
            </div>
            <p className={styles.selectionMeta}>
              共 {selectedFiles.length} 个文件，约 {(totalSelectedBytes / 1024).toFixed(1)} KB
            </p>
            <p className={styles.selectionMeta}>
              本次设备信息：{formatDeviceSummary(deviceLabel, deviceChip)}
            </p>
            <ul className={styles.fileList}>
              {selectedFiles.slice(0, 20).map((file) => (
                <li key={`${file.name}-${file.lastModified}`} className={styles.fileListItem}>
                  <span>{file.name}</span>
                  <span>{(file.size / 1024).toFixed(1)} KB</span>
                </li>
              ))}
            </ul>
            {selectedFiles.length > 20 && (
              <p className={styles.selectionMeta}>
                其余 {selectedFiles.length - 20} 个文件已省略显示。
              </p>
            )}
          </div>
        ) : (
          <p className={styles.empty}>还没有选择文件。</p>
        )}

        <div className={styles.actionRow}>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => void handleUpload()}
            disabled={uploading || selectedFiles.length === 0}
          >
            {uploading ? 'Uploading...' : 'Upload Selected Files'}
          </button>
        </div>

        {status && <p className={styles.success}>{status}</p>}
        {error && <p className={styles.error}>{error}</p>}
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2 className={styles.panelTitle}>Latest Upload Results</h2>
            <p className={styles.panelDescription}>
              每个文件都会单独给出导入结果，方便你快速定位哪一个 JSON 有问题。
            </p>
          </div>
        </div>

        {uploadRows.length === 0 ? (
          <p className={styles.empty}>本轮还没有上传记录。</p>
        ) : (
          <div className={styles.resultsGrid}>
            {uploadRows.map((row) => (
              <article key={`${row.fileName}-${row.status}`} className={styles.resultCard}>
                <div className={styles.resultHeader}>
                  <h3 className={styles.resultTitle}>{row.fileName}</h3>
                  <span className={`${styles.statusPill} ${styles[`status_${row.status}`]}`}>
                    {row.status}
                  </span>
                </div>
                <p className={styles.resultMessage}>{row.message}</p>
                {row.result && (
                  <dl className={styles.resultMeta}>
                    <div>
                      <dt>kind</dt>
                      <dd>{row.result.kind}</dd>
                    </div>
                    <div>
                      <dt>run</dt>
                      <dd>{row.result.runId || 'n/a'}</dd>
                    </div>
                    <div>
                      <dt>sample</dt>
                      <dd>{row.result.sampleIndex ?? 'n/a'}</dd>
                    </div>
                    <div>
                      <dt>attempts</dt>
                      <dd>{row.result.attemptCount}</dd>
                    </div>
                    <div>
                      <dt>avg score</dt>
                      <dd>{formatScore(row.result.averageScore)}</dd>
                    </div>
                    <div>
                      <dt>device</dt>
                      <dd>
                        {formatDeviceSummary(row.result.evalDeviceLabel, row.result.evalDeviceChip)}
                      </dd>
                    </div>
                  </dl>
                )}
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
              这里展示当前数据库里已经导入的 run 概况，方便你验证上传是否已经被公开页面读到。
            </p>
          </div>
        </div>

        {loadingRuns ? (
          <p className={styles.empty}>Loading imported runs...</p>
        ) : runs.length === 0 ? (
          <p className={styles.empty}>数据库里还没有导入任何 evaluation attempts。</p>
        ) : (
          <div className={styles.runGrid}>
            {runs.map((run) => (
              <article key={run.runId} className={styles.runCard}>
                <div className={styles.runHeader}>
                  <h3 className={styles.runTitle}>{formatRunLabel(run)}</h3>
                  <span className={styles.runLanguage}>{run.language}</span>
                </div>
                <p className={styles.runModel}>
                  {formatModelName(run.modelNameReportedByServer)} · {run.taskType}
                </p>
                <p className={styles.runModel}>
                  Device: {formatDeviceSummary(run.evalDeviceLabel, run.evalDeviceChip)}
                </p>
                <dl className={styles.runStats}>
                  <div>
                    <dt>Scored questions</dt>
                    <dd>
                      {run.scoredQuestionCount}/{run.questionCount}
                    </dd>
                  </div>
                  <div>
                    <dt>Attempts</dt>
                    <dd>{run.attemptCount}</dd>
                  </div>
                  <div>
                    <dt>Average score</dt>
                    <dd>{formatScore(run.averageOfAverageScores)}</dd>
                  </div>
                  <div>
                    <dt>Updated</dt>
                    <dd>{formatDate(run.latestUploadedAt || run.latestSampleUpdatedAt)}</dd>
                  </div>
                </dl>
                <div className={styles.categoryList}>
                  {run.categories.map((category) => (
                    <span key={`${run.runId}-${category}`} className={styles.categoryPill}>
                      {category}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
