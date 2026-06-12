'use client';

import dynamic from 'next/dynamic';
import { DragEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type * as Monaco from 'monaco-editor';
import { APP_CONFIG_SECTIONS } from '@app/contracts';
import {
  downloadRemoteConfigArchive,
  downloadRemoteConfigVersion,
  fetchAdminRemoteConfigActivities,
  fetchAdminRemoteConfigFiles,
  fetchAdminSession,
  fetchRemoteConfigVersionContent,
  logoutAdmin,
  publishRemoteConfigVersion,
  uploadRemoteConfig,
} from '@/utils';
import {
  AdminSessionResponse,
  RemoteConfigActivityRecord,
  RemoteConfigFileRecord,
  RemoteConfigVersionRecord,
} from '@/types/remote-config';
import styles from './page.module.css';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
});

const NEXT_PATH = '/admin/configs';
const SUPPORTED_FILE_NAMES = ['latest.json', 'suggestions.json', '{build}.json'];
const AUTH_ERROR_SNIPPETS = [
  'Missing bearer token',
  'Invalid token',
  'Session expired',
  'Invalid username or password',
];
const JSON_FORMAT_OPTIONS = {
  indentSize: 2,
  insertSpaces: true,
  eol: '\n',
  finalNewline: true,
} as const;
const INLINE_STRING_ARRAY_KEYS = new Set([
  'platforms',
  'backends',
  'tags',
  'socLimitations',
  'unsupportedSocBrand',
]);
const REMOTE_CONFIG_EDITOR_PATH_PREFIX = '/remote-config/';
const SHANGHAI_TIME_ZONE = 'Asia/Shanghai';
const JSON_DATE_VALUE_PATTERN = /"date"\s*:\s*(-?\d{8,13})\b/g;

let monacoConfigured = false;

const shanghaiDateFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: SHANGHAI_TIME_ZONE,
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

const appSectionSchema = {
  type: 'object',
  properties: {
    model_config: {
      type: 'array',
      description: 'List of model config objects used by the app.',
    },
    controlled_rollout: {
      type: 'object',
      description: 'Optional rollout config, typically used in chat section.',
    },
  },
  required: ['model_config'],
  additionalProperties: true,
};

const appConfigSchema = {
  type: 'object',
  properties: Object.fromEntries(APP_CONFIG_SECTIONS.map((section) => [section, appSectionSchema])),
  additionalProperties: true,
};

const suggestionsSchema = {
  type: 'object',
  additionalProperties: {
    type: 'object',
    properties: {
      chat: {
        type: 'array',
        items: { type: 'string' },
      },
      tts: {
        type: 'array',
        items: { type: 'string' },
      },
    },
    additionalProperties: true,
  },
};

interface EditorTarget {
  file: RemoteConfigFileRecord;
  version: RemoteConfigVersionRecord;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function formatBytes(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`;
  }
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}

function formatModelCounts(record: RemoteConfigVersionRecord) {
  const entries = Object.entries(record.modelCounts);
  if (entries.length === 0) {
    return 'n/a';
  }

  return entries.map(([key, count]) => `${key}:${count}`).join(' ');
}

function formatType(type: RemoteConfigFileRecord['type']) {
  return type === 'suggestions' ? 'Suggestions' : 'App Config';
}

function getFileSortPriority(file: RemoteConfigFileRecord) {
  if (file.fileName === 'latest.json') {
    return 0;
  }

  if (file.fileName === 'suggestions.json') {
    return 1;
  }

  return 2;
}

function getFileBuildValue(file: RemoteConfigFileRecord) {
  const matched = file.fileName.match(/^(\d+)\.json$/);
  if (matched) {
    return Number.parseInt(matched[1], 10);
  }

  return file.effectiveBuild ?? -1;
}

function sortFiles(left: RemoteConfigFileRecord, right: RemoteConfigFileRecord) {
  const priorityDiff = getFileSortPriority(left) - getFileSortPriority(right);
  if (priorityDiff !== 0) {
    return priorityDiff;
  }

  const leftBuild = getFileBuildValue(left);
  const rightBuild = getFileBuildValue(right);
  if (leftBuild !== rightBuild) {
    return rightBuild - leftBuild;
  }

  return left.fileName.localeCompare(right.fileName);
}

function formatActivityAction(action: string) {
  return action.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatActivityDetail(detail: Record<string, unknown> | null) {
  if (!detail) {
    return 'n/a';
  }

  const parts = Object.entries(detail).map(([key, value]) => {
    if (Array.isArray(value)) {
      return `${key}: ${value.join(', ') || '[]'}`;
    }

    if (value && typeof value === 'object') {
      return `${key}: ${JSON.stringify(value)}`;
    }

    return `${key}: ${String(value)}`;
  });

  return parts.join(' | ') || 'n/a';
}

function getVersionActionLabel(file: RemoteConfigFileRecord, version: RemoteConfigVersionRecord) {
  if (version.published) {
    return 'Published';
  }

  if (!file.publishedVersion) {
    return 'Publish';
  }

  const targetCreatedAt = new Date(version.createdAt).getTime();
  const currentCreatedAt = new Date(file.publishedVersion.createdAt).getTime();

  return targetCreatedAt < currentCreatedAt ? 'Rollback' : 'Publish';
}

function getActiveVersion(file: RemoteConfigFileRecord) {
  return file.publishedVersion || file.latestVersion;
}

function isAuthError(message: string) {
  return AUTH_ERROR_SNIPPETS.some((snippet) => message.includes(snippet));
}

function normalizeError(error: unknown) {
  return error instanceof Error ? error.message : 'Operation failed';
}

function isRemoteConfigEditorModel(model: Monaco.editor.ITextModel) {
  return model.uri.path.startsWith(REMOTE_CONFIG_EDITOR_PATH_PREFIX);
}

function toUnixTimestampMs(rawValue: number) {
  const absolute = Math.abs(rawValue);
  if (absolute >= 100_000_000 && absolute < 1_000_000_000_000) {
    return rawValue * 1000;
  }
  if (absolute >= 1_000_000_000_000 && absolute < 10_000_000_000_000) {
    return rawValue;
  }
  return null;
}

function formatShanghaiDateTime(rawValue: number) {
  const timestampMs = toUnixTimestampMs(rawValue);
  if (timestampMs === null) {
    return null;
  }

  const date = new Date(timestampMs);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const parts = shanghaiDateFormatter
    .formatToParts(date)
    .reduce<Record<string, string>>((result, part) => {
      if (part.type !== 'literal') {
        result[part.type] = part.value;
      }
      return result;
    }, {});

  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

function getDatePreviewMatches(lineContent: string) {
  const matches: Array<{ rawValue: string; startColumn: number; endColumn: number }> = [];

  const matcher = new RegExp(JSON_DATE_VALUE_PATTERN.source, JSON_DATE_VALUE_PATTERN.flags);
  let match = matcher.exec(lineContent);
  while (match) {
    const rawValue = match[1];
    const valueOffset = match[0].lastIndexOf(rawValue);
    const startColumn = match.index + valueOffset + 1;
    const endColumn = startColumn + rawValue.length;
    matches.push({ rawValue, startColumn, endColumn });

    match = matcher.exec(lineContent);
  }

  return matches;
}

function configureMonaco(monaco: typeof Monaco) {
  if (monacoConfigured) {
    return;
  }

  monacoConfigured = true;
  const jsonLanguage = monaco.languages as unknown as {
    json: {
      jsonDefaults: {
        setDiagnosticsOptions: (options: {
          validate: boolean;
          allowComments: boolean;
          schemas: Array<{
            uri: string;
            fileMatch: string[];
            schema: Record<string, unknown>;
          }>;
        }) => void;
      };
    };
  };

  jsonLanguage.json.jsonDefaults.setDiagnosticsOptions({
    validate: true,
    allowComments: false,
    schemas: [
      {
        uri: 'app://schemas/app-config.json',
        fileMatch: ['**/latest.json', '**/[0-9]*.json'],
        schema: appConfigSchema,
      },
      {
        uri: 'app://schemas/suggestions.json',
        fileMatch: ['**/suggestions.json'],
        schema: suggestionsSchema,
      },
    ],
  });

  monaco.languages.registerInlayHintsProvider('json', {
    provideInlayHints(model, range) {
      if (!isRemoteConfigEditorModel(model)) {
        return { hints: [], dispose: () => {} };
      }

      const hints: Monaco.languages.InlayHint[] = [];
      for (
        let lineNumber = range.startLineNumber;
        lineNumber <= range.endLineNumber;
        lineNumber += 1
      ) {
        const lineContent = model.getLineContent(lineNumber);
        for (const match of getDatePreviewMatches(lineContent)) {
          const preview = formatShanghaiDateTime(Number.parseInt(match.rawValue, 10));
          if (!preview) {
            continue;
          }

          hints.push({
            position: {
              lineNumber,
              column: match.endColumn + 1,
            },
            label: ` UTC+8 ${preview}`,
            paddingLeft: true,
          });
        }
      }

      return { hints, dispose: () => {} };
    },
  });

  monaco.languages.registerHoverProvider('json', {
    provideHover(model, position) {
      if (!isRemoteConfigEditorModel(model)) {
        return null;
      }

      const lineContent = model.getLineContent(position.lineNumber);
      for (const match of getDatePreviewMatches(lineContent)) {
        if (position.column < match.startColumn || position.column > match.endColumn + 1) {
          continue;
        }

        const preview = formatShanghaiDateTime(Number.parseInt(match.rawValue, 10));
        if (!preview) {
          return null;
        }

        return {
          range: new monaco.Range(
            position.lineNumber,
            match.startColumn,
            position.lineNumber,
            match.endColumn + 1,
          ),
          contents: [
            {
              value: `**东八区时间** ${preview} (${SHANGHAI_TIME_ZONE})`,
            },
            {
              value: `点击后仍然编辑原始 Unix 时间戳: \`${match.rawValue}\``,
            },
          ],
        };
      }

      return null;
    },
  });
}

function getIndent(depth: number) {
  return JSON_FORMAT_OPTIONS.insertSpaces
    ? ' '.repeat(JSON_FORMAT_OPTIONS.indentSize * depth)
    : '\t'.repeat(depth);
}

function isInlineStringArray(key: string | null, value: unknown): value is string[] {
  return (
    key !== null &&
    INLINE_STRING_ARRAY_KEYS.has(key) &&
    Array.isArray(value) &&
    value.every((item) => typeof item === 'string')
  );
}

function formatJsonValue(value: unknown, depth: number, key: string | null): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (isInlineStringArray(key, value)) {
    return `[${value.map((item) => JSON.stringify(item)).join(', ')}]`;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '[]';
    }

    const indent = getIndent(depth);
    const childIndent = getIndent(depth + 1);

    return [
      '[',
      ...value.map((item, index) => {
        const suffix = index === value.length - 1 ? '' : ',';
        return `${childIndent}${formatJsonValue(item, depth + 1, null)}${suffix}`;
      }),
      `${indent}]`,
    ].join(JSON_FORMAT_OPTIONS.eol);
  }

  const entries = Object.entries(value);
  if (entries.length === 0) {
    return '{}';
  }

  const indent = getIndent(depth);
  const childIndent = getIndent(depth + 1);

  return [
    '{',
    ...entries.map(([entryKey, entryValue], index) => {
      const suffix = index === entries.length - 1 ? '' : ',';
      return `${childIndent}${JSON.stringify(entryKey)}: ${formatJsonValue(
        entryValue,
        depth + 1,
        entryKey,
      )}${suffix}`;
    }),
    `${indent}}`,
  ].join(JSON_FORMAT_OPTIONS.eol);
}

function formatJsonText(text: string) {
  const parsed = JSON.parse(text);
  const normalized = formatJsonValue(parsed, 0, null).replace(/\r\n/g, '\n');

  return JSON_FORMAT_OPTIONS.finalNewline ? `${normalized}${JSON_FORMAT_OPTIONS.eol}` : normalized;
}

function getJsonSyntaxError(text: string) {
  try {
    JSON.parse(text);
    return null;
  } catch (error) {
    return normalizeError(error);
  }
}

export default function RemoteConfigAdminPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);

  const [session, setSession] = useState<AdminSessionResponse | null>(null);
  const [files, setFiles] = useState<RemoteConfigFileRecord[]>([]);
  const [activities, setActivities] = useState<RemoteConfigActivityRecord[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [publishNow, setPublishNow] = useState(true);
  const [dragActive, setDragActive] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [busyVersionId, setBusyVersionId] = useState<number | null>(null);
  const [busyArchiveScope, setBusyArchiveScope] = useState<'all' | 'published' | null>(null);
  const [historyFile, setHistoryFile] = useState<RemoteConfigFileRecord | null>(null);

  const [editorTarget, setEditorTarget] = useState<EditorTarget | null>(null);
  const [editorContent, setEditorContent] = useState('');
  const [editorInitialContent, setEditorInitialContent] = useState<string | null>(null);
  const [editorLoading, setEditorLoading] = useState(false);
  const [editorSaving, setEditorSaving] = useState(false);
  const [editorDirty, setEditorDirty] = useState(false);
  const [editorError, setEditorError] = useState('');

  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const redirectToLogin = useCallback(() => {
    router.replace(`/admin/login?next=${encodeURIComponent(NEXT_PATH)}`);
  }, [router]);

  const refreshDashboard = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [nextFiles, nextActivities] = await Promise.all([
        fetchAdminRemoteConfigFiles(),
        fetchAdminRemoteConfigActivities(),
      ]);
      setFiles(nextFiles);
      setActivities(nextActivities);
      setHistoryFile((current) => {
        if (!current) {
          return null;
        }

        return (
          nextFiles.find((file) => {
            return file.type === current.type && file.fileName === current.fileName;
          }) || null
        );
      });
      setEditorTarget((current) => {
        if (!current) {
          return null;
        }

        const nextFile = nextFiles.find((file) => {
          return file.type === current.file.type && file.fileName === current.file.fileName;
        });
        if (!nextFile) {
          return null;
        }

        const nextVersion =
          nextFile.versions.find((version) => version.id === current.version.id) || current.version;

        return {
          file: nextFile,
          version: nextVersion,
        };
      });
    } catch (nextError) {
      const message = normalizeError(nextError);
      if (isAuthError(message)) {
        redirectToLogin();
        return;
      }
      setError(message);
    } finally {
      setLoading(false);
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
        await refreshDashboard();
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
  }, [redirectToLogin, refreshDashboard]);

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
      setError('Select one or more JSON files first.');
      return;
    }

    setUploading(true);
    setStatus('');
    setError('');

    try {
      const completed: string[] = [];
      const warnings: string[] = [];

      for (const file of selectedFiles) {
        const content = await file.text();
        const response = await uploadRemoteConfig({
          fileName: file.name,
          content,
          publishNow,
        });

        completed.push(file.name);
        if (response.warnings.length > 0) {
          warnings.push(`${file.name}: ${response.warnings.join('; ')}`);
        }
      }

      setStatus(
        warnings.length > 0
          ? `Validated and uploaded ${completed.length} file(s). Notes: ${warnings.join(' | ')}`
          : `Uploaded ${completed.length} file(s): ${completed.join(', ')}`,
      );
      clearSelection();
      await refreshDashboard();
    } catch (nextError) {
      const message = normalizeError(nextError);
      if (isAuthError(message)) {
        redirectToLogin();
        return;
      }
      setError(message);
    } finally {
      setUploading(false);
    }
  }

  async function handlePublish(file: RemoteConfigFileRecord, version: RemoteConfigVersionRecord) {
    const actionLabel = getVersionActionLabel(file, version);
    if (
      actionLabel === 'Rollback' &&
      !window.confirm(`Rollback ${file.fileName} to version #${version.id}?`)
    ) {
      return;
    }

    setBusyVersionId(version.id);
    setStatus('');
    setError('');

    try {
      await publishRemoteConfigVersion(version.id);
      setStatus(
        actionLabel === 'Rollback'
          ? `Rolled back ${file.fileName} to version #${version.id}.`
          : `Published ${file.fileName} version #${version.id}.`,
      );
      await refreshDashboard();
    } catch (nextError) {
      const message = normalizeError(nextError);
      if (isAuthError(message)) {
        redirectToLogin();
        return;
      }
      setError(message);
    } finally {
      setBusyVersionId(null);
    }
  }

  async function handleDownloadVersion(id: number) {
    setError('');
    setStatus('');

    try {
      await downloadRemoteConfigVersion(id);
      setStatus(`Downloaded version #${id}.`);
    } catch (nextError) {
      const message = normalizeError(nextError);
      if (isAuthError(message)) {
        redirectToLogin();
        return;
      }
      setError(message);
    }
  }

  async function handleDownloadArchive(scope: 'all' | 'published') {
    setBusyArchiveScope(scope);
    setError('');
    setStatus('');

    try {
      await downloadRemoteConfigArchive(scope);
      setStatus(
        scope === 'all'
          ? 'Downloaded archive with all config versions.'
          : 'Downloaded archive with all published configs.',
      );
    } catch (nextError) {
      const message = normalizeError(nextError);
      if (isAuthError(message)) {
        redirectToLogin();
        return;
      }
      setError(message);
    } finally {
      setBusyArchiveScope(null);
    }
  }

  async function handleLogout() {
    try {
      await logoutAdmin();
    } finally {
      redirectToLogin();
    }
  }

  async function openEditor(file: RemoteConfigFileRecord, version: RemoteConfigVersionRecord) {
    setEditorTarget({ file, version });
    setEditorContent('');
    setEditorInitialContent(null);
    setEditorDirty(false);
    setEditorError('');
    setEditorLoading(true);
    setStatus('');
    setError('');

    try {
      const response = await fetchRemoteConfigVersionContent(version.id);
      const formattedContent = formatJsonText(response.content);
      setEditorContent(formattedContent);
      setEditorInitialContent(formattedContent);
    } catch (nextError) {
      const message = normalizeError(nextError);
      if (isAuthError(message)) {
        redirectToLogin();
        return;
      }
      setEditorError(message);
    } finally {
      setEditorLoading(false);
    }
  }

  function closeEditor(force = false) {
    if (!force && editorDirty && !window.confirm('Discard unsaved editor changes?')) {
      return;
    }

    setEditorTarget(null);
    setEditorContent('');
    setEditorInitialContent(null);
    setEditorLoading(false);
    setEditorSaving(false);
    setEditorDirty(false);
    setEditorError('');
  }

  function handleEditorMount(editor: Monaco.editor.IStandaloneCodeEditor, monaco: typeof Monaco) {
    editorRef.current = editor;
    monacoRef.current = monaco;
  }

  async function handleFormatEditor() {
    if (!editorDirty) {
      return;
    }

    try {
      const formatted = formatJsonText(editorContent);
      setEditorContent(formatted);
      setEditorDirty(formatted !== (editorInitialContent ?? ''));
      if (editorRef.current && editorRef.current.getValue() !== formatted) {
        editorRef.current.setValue(formatted);
      }
      setEditorError('');
    } catch (nextError) {
      setEditorError(normalizeError(nextError));
    }
  }

  function handleResetEditor() {
    if (editorInitialContent === null) {
      return;
    }

    setEditorContent(editorInitialContent);
    setEditorDirty(false);
    setEditorError('');
    if (editorRef.current && editorRef.current.getValue() !== editorInitialContent) {
      editorRef.current.setValue(editorInitialContent);
    }
  }

  function getEditorValidationMessage() {
    try {
      JSON.parse(editorContent);
    } catch (nextError) {
      return normalizeError(nextError);
    }

    const model = editorRef.current?.getModel();
    const monaco = monacoRef.current;
    if (!model || !monaco) {
      return null;
    }

    const markers = monaco.editor.getModelMarkers({
      resource: model.uri,
    });
    const blocking = markers.filter((marker) => marker.severity === monaco.MarkerSeverity.Error);
    if (blocking.length > 0) {
      return `Resolve ${blocking.length} validation error(s) before saving.`;
    }

    return null;
  }

  async function handleSaveEditor(publishAfterSave: boolean) {
    if (!editorTarget) {
      return;
    }

    if (!editorDirty) {
      setEditorError('No changes to save.');
      return;
    }

    setEditorSaving(true);
    setEditorError('');
    setStatus('');
    setError('');

    try {
      const validationMessage = getEditorValidationMessage();
      if (validationMessage) {
        throw new Error(validationMessage);
      }

      const normalizedContent = formatJsonText(editorContent);
      const response = await uploadRemoteConfig({
        fileName: editorTarget.file.fileName,
        content: normalizedContent,
        publishNow: publishAfterSave,
      });

      setStatus(
        response.warnings.length > 0
          ? `${publishAfterSave ? 'Saved and published' : 'Saved'} ${editorTarget.file.fileName}. Notes: ${response.warnings.join(' | ')}`
          : `${publishAfterSave ? 'Saved and published' : 'Saved'} ${editorTarget.file.fileName}.`,
      );
      await refreshDashboard();
      closeEditor(true);
    } catch (nextError) {
      const message = normalizeError(nextError);
      if (isAuthError(message)) {
        redirectToLogin();
        return;
      }
      setEditorError(message);
    } finally {
      setEditorSaving(false);
    }
  }

  const orderedFiles = [...files].sort(sortFiles);
  const selectedFileTotalBytes = selectedFiles.reduce((total, file) => total + file.size, 0);
  const editorSyntaxError =
    editorInitialContent !== null && !editorLoading ? getJsonSyntaxError(editorContent) : null;
  const editorHasSyntaxError = editorSyntaxError !== null;
  const editorHasChanges = editorInitialContent !== null && editorContent !== editorInitialContent;
  const editorCanFormat =
    !editorLoading && !editorSaving && !editorHasSyntaxError && editorHasChanges;
  const editorCanSave =
    !editorLoading && !editorSaving && !editorHasSyntaxError && editorHasChanges;
  const editorCanReset = !editorLoading && !editorSaving && editorHasChanges;
  const pageErrorTitle = error.includes('Upload blocked') ? 'Upload blocked' : 'Action failed';

  if (checkingSession) {
    return (
      <main className={styles.page}>
        <section className={styles.loadingPanel}>
          <p className={styles.eyebrow}>Admin</p>
          <h1 className={styles.title}>Checking session...</h1>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroText}>
          <p className={styles.eyebrow}>Remote Config Console</p>
          <h1 className={styles.title}>Remote Config Admin</h1>
          <p className={styles.description}>
            Manage versioned app config JSON and suggestions JSON from one place. Upload files, edit
            them online, and only open history when you need to work on older versions.
          </p>
          <div className={styles.metaRow}>
            <span className={styles.metaPill}>User: {session?.username || 'unknown'}</span>
            <span className={styles.metaPill}>
              Expires: {session ? new Date(session.expiresAt).toLocaleString() : 'n/a'}
            </span>
          </div>
        </div>

        <div className={styles.heroActions}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => void handleDownloadArchive('published')}
            disabled={busyArchiveScope !== null || files.length === 0}
          >
            {busyArchiveScope === 'published' ? 'Preparing...' : 'Download Published ZIP'}
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => void handleDownloadArchive('all')}
            disabled={busyArchiveScope !== null || files.length === 0}
          >
            {busyArchiveScope === 'all' ? 'Preparing...' : 'Download Full ZIP'}
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => void refreshDashboard()}
          >
            Refresh
          </button>
          <button type="button" className={styles.ghostButton} onClick={() => void handleLogout()}>
            Logout
          </button>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2 className={styles.panelTitle}>Upload JSON</h2>
            <p className={styles.panelDescription}>
              Supported names: {SUPPORTED_FILE_NAMES.join(', ')}. Every app config upload now
              validates each model URL against Hugging Face and syncs `fileSize` and `date`
              automatically.
            </p>
          </div>
          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={publishNow}
              onChange={(event) => setPublishNow(event.target.checked)}
            />
            <span>Publish immediately after upload</span>
          </label>
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
          <span className={styles.dropZoneBadge}>Hugging Face Checked</span>
          <span className={styles.dropZoneTitle}>Drag JSON files here or click to browse</span>
          <span className={styles.dropZoneText}>
            Invalid Hugging Face file names are rejected before upload. `fileSize` and `date` are
            rewritten from the source file metadata.
          </span>
        </label>

        {selectedFiles.length > 0 ? (
          <div className={styles.selectionPanel}>
            <div className={styles.selectionHeader}>
              <div>
                <h3 className={styles.selectionTitle}>Ready to upload</h3>
                <p className={styles.selectionStats}>
                  {selectedFiles.length} file(s) selected · {formatBytes(selectedFileTotalBytes)}
                </p>
              </div>
              <button
                type="button"
                className={styles.linkButton}
                onClick={() => clearSelection()}
                disabled={uploading}
              >
                Clear
              </button>
            </div>
            <ul className={styles.fileList}>
              {selectedFiles.map((file) => (
                <li key={`${file.name}-${file.lastModified}`} className={styles.fileListItem}>
                  <span className={styles.fileListName}>{file.name}</span>
                  <span className={styles.fileListMeta}>{formatBytes(file.size)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className={styles.empty}>No files selected.</p>
        )}

        <div className={styles.actionRow}>
          <button
            type="button"
            className={styles.uploadButton}
            onClick={() => void handleUpload()}
            disabled={uploading || selectedFiles.length === 0}
          >
            <span className={styles.uploadButtonLabel}>
              {uploading ? 'Validating on Hugging Face...' : 'Validate on Hugging Face and Upload'}
            </span>
            <span className={styles.uploadButtonMeta}>
              {selectedFiles.length > 0
                ? `${selectedFiles.length} file(s) · ${formatBytes(selectedFileTotalBytes)}`
                : 'Choose JSON files to begin'}
            </span>
          </button>
        </div>

        <p className={styles.uploadHint}>
          Upload is blocked when any model URL does not resolve to an exact Hugging Face file.
        </p>

        {status && (
          <div className={styles.successCard} role="status">
            <p className={styles.successTitle}>Upload status</p>
            <p className={styles.successBody}>{status}</p>
          </div>
        )}
        {error && (
          <div className={styles.errorCard} role="alert">
            <p className={styles.errorTitle}>{pageErrorTitle}</p>
            <p className={styles.errorBody}>{error}</p>
          </div>
        )}
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2 className={styles.panelTitle}>Config Files</h2>
            <p className={styles.panelDescription}>
              {loading ? 'Loading current config state...' : `${files.length} JSON file(s) stored.`}
            </p>
          </div>
        </div>

        {loading ? (
          <p className={styles.empty}>Loading configs...</p>
        ) : files.length === 0 ? (
          <p className={styles.empty}>No configs uploaded yet.</p>
        ) : (
          <div className={styles.fileCardList}>
            {orderedFiles.map((file) => {
              const activeVersion = getActiveVersion(file);
              if (!activeVersion) {
                return null;
              }

              const hasDraft =
                file.latestVersion !== null && file.publishedVersion?.id !== file.latestVersion.id;

              return (
                <article key={`${file.type}:${file.fileName}`} className={styles.fileCard}>
                  <div className={styles.fileCardHeader}>
                    <div className={styles.fileCardLead}>
                      <div className={styles.badgeRow}>
                        <span className={styles.typeBadge}>{formatType(file.type)}</span>
                        <span className={styles.neutralBadge}>{file.versionCount} versions</span>
                        {file.publishedVersion && (
                          <span className={styles.successBadge}>
                            Published #{file.publishedVersion.id}
                          </span>
                        )}
                        {hasDraft && file.latestVersion && (
                          <span className={styles.warningBadge}>
                            Draft #{file.latestVersion.id}
                          </span>
                        )}
                      </div>
                      <h3 className={styles.fileName}>{file.fileName}</h3>
                      <p className={styles.fileHint}>
                        Effective build: {activeVersion.effectiveBuild ?? 'latest'} · Last updated:{' '}
                        {formatDate(activeVersion.updatedAt)}
                      </p>
                    </div>

                    <div className={styles.fileCardActions}>
                      <button
                        type="button"
                        className={styles.smallButton}
                        onClick={() => void openEditor(file, activeVersion)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className={styles.smallButton}
                        onClick={() => void handleDownloadVersion(activeVersion.id)}
                      >
                        Download
                      </button>
                      <button
                        type="button"
                        className={styles.menuButton}
                        aria-label={`Open history for ${file.fileName}`}
                        onClick={() => setHistoryFile(file)}
                      >
                        ...
                      </button>
                    </div>
                  </div>

                  <div className={styles.summaryGrid}>
                    <div className={styles.summaryItem}>
                      <span className={styles.summaryLabel}>Current Version</span>
                      <strong>#{activeVersion.id}</strong>
                    </div>
                    <div className={styles.summaryItem}>
                      <span className={styles.summaryLabel}>Operator</span>
                      <strong>{activeVersion.createdBy || 'unknown'}</strong>
                    </div>
                    <div className={styles.summaryItem}>
                      <span className={styles.summaryLabel}>Updated</span>
                      <strong>{formatDate(activeVersion.updatedAt)}</strong>
                    </div>
                    <div className={styles.summaryItem}>
                      <span className={styles.summaryLabel}>Size</span>
                      <strong>{formatBytes(activeVersion.size)}</strong>
                    </div>
                    <div className={styles.summaryItem}>
                      <span className={styles.summaryLabel}>Model Counts</span>
                      <strong>{formatModelCounts(activeVersion)}</strong>
                    </div>
                    <div className={`${styles.summaryItem} ${styles.summaryItemWide}`}>
                      <span className={styles.summaryLabel}>Warnings</span>
                      <strong>
                        {activeVersion.warnings.length > 0
                          ? activeVersion.warnings.join(' | ')
                          : 'n/a'}
                      </strong>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2 className={styles.panelTitle}>Activity Log</h2>
            <p className={styles.panelDescription}>
              Recent uploads, publications, downloads, archive exports, and sign-in events.
            </p>
          </div>
        </div>

        {activities.length === 0 ? (
          <p className={styles.empty}>No activity recorded yet.</p>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Action</th>
                  <th>User</th>
                  <th>Target</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {activities.map((activity) => (
                  <tr key={activity.id}>
                    <td>{formatDate(activity.createdAt)}</td>
                    <td>{formatActivityAction(activity.action)}</td>
                    <td>{activity.username}</td>
                    <td>
                      {activity.fileName ||
                        (activity.remoteConfigId ? `#${activity.remoteConfigId}` : 'n/a')}
                    </td>
                    <td className={styles.warningCell}>{formatActivityDetail(activity.detail)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {historyFile && (
        <div className={styles.modalBackdrop} onClick={() => setHistoryFile(null)}>
          <section className={styles.modal} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.eyebrow}>History</p>
                <h2 className={styles.modalTitle}>{historyFile.fileName}</h2>
                <p className={styles.panelDescription}>
                  Historical uploads are hidden from the main list. Use this view to publish,
                  rollback, download, or edit older versions.
                </p>
              </div>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => setHistoryFile(null)}
              >
                Close
              </button>
            </div>

            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Version</th>
                    <th>Status</th>
                    <th>Updated</th>
                    <th>Operator</th>
                    <th>Model Counts</th>
                    <th>Warnings</th>
                    <th>Size</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {historyFile.versions.map((version) => {
                    const actionLabel = getVersionActionLabel(historyFile, version);

                    return (
                      <tr key={version.id}>
                        <td>
                          <div className={styles.versionCell}>
                            <strong>#{version.id}</strong>
                            <span>build {version.effectiveBuild ?? 'latest'}</span>
                          </div>
                        </td>
                        <td>
                          <div className={styles.badgeRow}>
                            {version.published && (
                              <span className={styles.successBadge}>Published</span>
                            )}
                            {historyFile.latestVersion?.id === version.id && (
                              <span className={styles.neutralBadge}>Latest Upload</span>
                            )}
                          </div>
                        </td>
                        <td>{formatDate(version.updatedAt)}</td>
                        <td>{version.createdBy || 'unknown'}</td>
                        <td>{formatModelCounts(version)}</td>
                        <td className={styles.warningCell}>
                          {version.warnings.length > 0 ? version.warnings.join(' | ') : 'n/a'}
                        </td>
                        <td>{formatBytes(version.size)}</td>
                        <td>
                          <div className={styles.inlineActions}>
                            <button
                              type="button"
                              className={styles.smallButton}
                              onClick={() => void openEditor(historyFile, version)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className={styles.smallButton}
                              onClick={() => void handleDownloadVersion(version.id)}
                            >
                              Download
                            </button>
                            <button
                              type="button"
                              className={styles.smallSecondaryButton}
                              disabled={version.published || busyVersionId === version.id}
                              onClick={() => void handlePublish(historyFile, version)}
                            >
                              {busyVersionId === version.id ? 'Working...' : actionLabel}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {editorTarget && (
        <div
          className={styles.editorBackdrop}
          onClick={() => {
            if (!editorSaving && !editorHasSyntaxError) {
              closeEditor();
            }
          }}
        >
          <section className={styles.editorModal} onClick={(event) => event.stopPropagation()}>
            <div className={styles.editorHeader}>
              <div className={styles.editorTitleBlock}>
                <p className={styles.eyebrow}>Online Editor</p>
                <h2 className={styles.editorTitle}>{editorTarget.file.fileName}</h2>
                <p className={styles.panelDescription}>
                  Editing version #{editorTarget.version.id}. Saving creates a new version; it does
                  not overwrite history.
                </p>
              </div>
              <div className={styles.editorActions}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => void handleFormatEditor()}
                  disabled={!editorCanFormat}
                >
                  Format
                </button>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => void handleSaveEditor(false)}
                  disabled={!editorCanSave}
                >
                  {editorSaving ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => handleResetEditor()}
                  disabled={!editorCanReset}
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveEditor(true)}
                  disabled={!editorCanSave}
                >
                  {editorSaving ? 'Saving...' : 'Save & Publish'}
                </button>
                <button
                  type="button"
                  className={styles.ghostButton}
                  onClick={() => closeEditor()}
                  disabled={editorSaving || editorHasSyntaxError}
                >
                  Close
                </button>
              </div>
            </div>

            <div className={styles.editorMetaRow}>
              <span className={styles.metaPill}>File: {editorTarget.file.fileName}</span>
              <span className={styles.metaPill}>Source Version: #{editorTarget.version.id}</span>
              <span className={styles.metaPill}>Type: {formatType(editorTarget.file.type)}</span>
            </div>

            <div className={styles.editorSurface}>
              {editorLoading ? (
                <div className={styles.editorPlaceholder}>Loading JSON...</div>
              ) : (
                <MonacoEditor
                  beforeMount={configureMonaco}
                  onMount={handleEditorMount}
                  language="json"
                  path={`file:///remote-config/${editorTarget.file.fileName}`}
                  theme="vs-dark"
                  value={editorContent}
                  onChange={(value) => {
                    const nextContent = value || '';
                    setEditorContent(nextContent);
                    setEditorDirty(nextContent !== (editorInitialContent ?? ''));
                    if (editorError) {
                      setEditorError('');
                    }
                  }}
                  options={{
                    automaticLayout: true,
                    detectIndentation: false,
                    formatOnPaste: true,
                    formatOnType: true,
                    inlayHints: { enabled: 'on' },
                    insertSpaces: JSON_FORMAT_OPTIONS.insertSpaces,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    fontSize: 14,
                    tabSize: JSON_FORMAT_OPTIONS.indentSize,
                    wordWrap: 'on',
                  }}
                />
              )}
            </div>

            <div className={styles.editorFooter}>
              <p className={styles.editorNote}>
                Save creates a draft version. Save & Publish creates a new version and immediately
                makes it active for clients. Reset restores the loaded version content.
              </p>
              <p className={styles.editorNote}>
                `date` fields show an inline UTC+8 preview. Clicking still edits the raw Unix
                timestamp.
              </p>
              {editorSyntaxError && <p className={styles.error}>{editorSyntaxError}</p>}
              {!editorSyntaxError && editorError && <p className={styles.error}>{editorError}</p>}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
