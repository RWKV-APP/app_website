'use client';

import ReactMarkdown from 'react-markdown';
import { FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createAdminRwkvChatConversation,
  deleteAdminRwkvChatConversation,
  fetchAdminRwkvChatConversation,
  fetchAdminRwkvChatConversations,
  fetchAdminSession,
  selectAdminRwkvChatMessageSlot,
  stopAdminRwkvChatMessage,
  streamAdminRwkvChat,
} from '@/utils';
import type {
  AdminRwkvChatConversationDetail,
  AdminRwkvChatConversationSummary,
  AdminRwkvChatModel,
  AdminRwkvChatSlot,
  AdminRwkvChatSlotStatus,
  AdminRwkvChatStoredMessage,
  AdminRwkvChatStreamEvent,
} from '@/utils';
import type { AdminSessionResponse } from '@/types/remote-config';
import styles from './page.module.css';

const NEXT_PATH = '/admin/rwkv-chat';

type UserEntry = {
  id: string;
  type: 'user';
  messageId?: number;
  conversationId?: number;
  content: string;
  status: string;
  error?: string | null;
};

type BatchSlotState = AdminRwkvChatSlot & {
  content: string;
};

type BatchEntry = {
  id: string;
  type: 'batch';
  messageId?: number;
  conversationId?: number;
  batchId?: string | null;
  model: AdminRwkvChatModel;
  webSearchEnabled: boolean;
  batchInferenceEnabled: boolean;
  batchCount: number;
  status: string;
  slots: BatchSlotState[];
  selectedSlotId?: string | null;
  error?: string | null;
};

type ChatEntry = UserEntry | BatchEntry;

const MODEL_OPTIONS: Array<{ key: AdminRwkvChatModel; label: string }> = [
  { key: '7b', label: 'RWKV 7.2B' },
  { key: '13b', label: 'RWKV 13.3B' },
];

const STATUS_LABELS: Record<AdminRwkvChatSlotStatus, string> = {
  queued: 'Queued',
  searching: 'Searching',
  generating: 'RWKV',
  done: 'Done',
  error: 'Error',
  skipped: 'Skipped',
};

const MESSAGE_STATUS_LABELS: Record<string, string> = {
  done: 'Saved',
  running: 'Running',
  error: 'Error',
  stopped: 'Stopped',
};

const TERMINAL_STATUSES = new Set<AdminRwkvChatSlotStatus>(['done', 'error', 'skipped']);
const MIN_BATCH_COUNT = 1;
const MAX_BATCH_COUNT = 10;
const DEFAULT_BATCH_COUNT = 4;

function normalizeError(error: unknown) {
  return error instanceof Error ? error.message : 'Request failed';
}

function isAuthError(message: string) {
  return (
    message.includes('Missing bearer token') ||
    message.includes('Invalid token') ||
    message.includes('Session expired')
  );
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createUserEntry(content: string, conversationId?: number): UserEntry {
  return {
    id: createId('user'),
    type: 'user',
    conversationId,
    content,
    status: 'running',
  };
}

function createBatchEntry(options: {
  conversationId?: number;
  model: AdminRwkvChatModel;
  webSearchEnabled: boolean;
  batchInferenceEnabled: boolean;
  batchCount: number;
}): BatchEntry {
  return {
    id: createId('batch'),
    type: 'batch',
    conversationId: options.conversationId,
    model: options.model,
    webSearchEnabled: options.webSearchEnabled,
    batchInferenceEnabled: options.batchInferenceEnabled,
    batchCount: options.batchInferenceEnabled ? options.batchCount : 1,
    status: 'running',
    slots: [],
  };
}

function clampBatchCount(value: number) {
  if (!Number.isFinite(value)) {
    return DEFAULT_BATCH_COUNT;
  }
  return Math.min(MAX_BATCH_COUNT, Math.max(MIN_BATCH_COUNT, Math.floor(value)));
}

function mergeSlot(slot: AdminRwkvChatSlot, current?: BatchSlotState): BatchSlotState {
  return {
    ...slot,
    references: slot.references || current?.references || [],
    error: slot.error || current?.error,
    content: current?.content || slot.content || '',
  };
}

function chooseSelectedSlot(entry: BatchEntry): string | undefined {
  if (entry.selectedSlotId && entry.slots.some((slot) => slot.id === entry.selectedSlotId)) {
    return entry.selectedSlotId;
  }
  return (
    entry.slots.find((slot) => slot.content.trim())?.id ||
    entry.slots.find((slot) => slot.status === 'done')?.id ||
    entry.slots[0]?.id
  );
}

function getModelLabel(model: AdminRwkvChatModel) {
  return MODEL_OPTIONS.find((option) => option.key === model)?.label || model;
}

function formatConversationTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat(undefined, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function summaryFromDetail(
  detail: AdminRwkvChatConversationDetail,
): AdminRwkvChatConversationSummary {
  return {
    id: detail.id,
    title: detail.title,
    status: detail.status,
    selectedMessageId: detail.selectedMessageId,
    selectedSlotId: detail.selectedSlotId,
    lastMessagePreview: detail.lastMessagePreview,
    messageCount: detail.messages.length,
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt,
  };
}

function normalizeStoredSlot(slot: AdminRwkvChatSlot): BatchSlotState {
  return {
    ...slot,
    references: slot.references || [],
    content: slot.content || '',
  };
}

function entriesFromConversation(detail: AdminRwkvChatConversationDetail): ChatEntry[] {
  return detail.messages.map((message) => entryFromMessage(message));
}

function entryFromMessage(message: AdminRwkvChatStoredMessage): ChatEntry {
  if (message.role === 'user') {
    return {
      id: `message-${message.id}`,
      type: 'user',
      messageId: message.id,
      conversationId: message.conversationId,
      content: message.content,
      status: message.status || 'done',
      error: message.error,
    };
  }

  const batch = message.batch;
  const model = (message.model || batch?.model || '7b') as AdminRwkvChatModel;
  return {
    id: `message-${message.id}`,
    type: 'batch',
    messageId: message.id,
    conversationId: message.conversationId,
    batchId: message.batchId || batch?.id,
    model,
    webSearchEnabled: Boolean(message.webSearchEnabled ?? batch?.webSearchEnabled ?? true),
    batchInferenceEnabled: Boolean(
      message.batchInferenceEnabled ?? batch?.batchInferenceEnabled ?? true,
    ),
    batchCount: Math.max(1, batch?.slots.length || 1),
    status: message.status || batch?.status || 'done',
    slots: (batch?.slots || []).map(normalizeStoredSlot),
    selectedSlotId: message.selectedSlotId,
    error: message.error || batch?.error,
  };
}

function upsertConversationSummary(
  conversations: AdminRwkvChatConversationSummary[],
  summary: AdminRwkvChatConversationSummary,
) {
  const next = conversations.some((item) => item.id === summary.id)
    ? conversations.map((item) => (item.id === summary.id ? summary : item))
    : [summary, ...conversations];
  return next.sort((left, right) => {
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });
}

function applyBatchEvent(entry: BatchEntry, event: AdminRwkvChatStreamEvent): BatchEntry {
  if (event.type === 'batch_start') {
    const assistant = event.assistantMessage;
    const nextEntry = {
      ...entry,
      messageId: assistant?.id || entry.messageId,
      conversationId: assistant?.conversationId || entry.conversationId,
      batchId: event.batchId,
      status: assistant?.status || entry.status,
      batchCount: event.batchCount || event.slots.length || entry.batchCount,
      selectedSlotId: assistant?.selectedSlotId || entry.selectedSlotId,
      slots: event.slots.map((slot) =>
        mergeSlot(
          slot,
          entry.slots.find((item) => item.id === slot.id),
        ),
      ),
    };
    return {
      ...nextEntry,
      selectedSlotId: nextEntry.selectedSlotId || chooseSelectedSlot(nextEntry),
    };
  }

  if (event.type === 'slot_status' || event.type === 'slot_done' || event.type === 'slot_error') {
    const nextSlots = upsertSlot(entry.slots, event.slot);
    const nextEntry = {
      ...entry,
      batchId: event.batchId,
      status: event.type === 'slot_error' ? entry.status : entry.status,
      slots: nextSlots,
    };
    return {
      ...nextEntry,
      selectedSlotId: nextEntry.selectedSlotId || chooseSelectedSlot(nextEntry),
    };
  }

  if (event.type === 'slot_references') {
    return {
      ...entry,
      batchId: event.batchId,
      slots: entry.slots.map((slot) =>
        slot.id === event.slotId ? { ...slot, references: event.references } : slot,
      ),
    };
  }

  if (event.type === 'slot_delta') {
    const nextEntry = {
      ...entry,
      batchId: event.batchId,
      status: 'running',
      slots: entry.slots.map((slot) =>
        slot.id === event.slotId ? { ...slot, content: `${slot.content}${event.delta}` } : slot,
      ),
    };
    return {
      ...nextEntry,
      selectedSlotId: entry.selectedSlotId || event.slotId,
    };
  }

  if (event.type === 'batch_done') {
    const nextEntry = {
      ...entry,
      batchId: event.batchId,
      status: 'done',
      slots: event.slots.map((slot) =>
        mergeSlot(
          slot,
          entry.slots.find((item) => item.id === slot.id),
        ),
      ),
    };
    return {
      ...nextEntry,
      selectedSlotId: chooseSelectedSlot(nextEntry),
    };
  }

  return entry;
}

function upsertSlot(slots: BatchSlotState[], slot: AdminRwkvChatSlot): BatchSlotState[] {
  if (!slots.some((item) => item.id === slot.id)) {
    return [...slots, mergeSlot(slot)];
  }
  return slots.map((item) => (item.id === slot.id ? mergeSlot(slot, item) : item));
}

export default function AdminRwkvChatPage() {
  const router = useRouter();
  const abortRef = useRef<AbortController | null>(null);
  const activeBatchEntryIdRef = useRef<string>('');
  const activeAssistantMessageIdRef = useRef<number | null>(null);
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const [session, setSession] = useState<AdminSessionResponse | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [conversations, setConversations] = useState<AdminRwkvChatConversationSummary[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  const [model, setModel] = useState<AdminRwkvChatModel>('7b');
  const [webSearchEnabled, setWebSearchEnabled] = useState(true);
  const [batchInferenceEnabled, setBatchInferenceEnabled] = useState(true);
  const [batchCount, setBatchCount] = useState(DEFAULT_BATCH_COUNT);
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const selectedModel = useMemo(
    () => MODEL_OPTIONS.find((option) => option.key === model) || MODEL_OPTIONS[0],
    [model],
  );

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId) || null,
    [conversations, selectedConversationId],
  );

  const updateBatchCount = useCallback((value: number) => {
    setBatchCount(clampBatchCount(value));
  }, []);

  const latestBatch = useMemo(() => {
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const entry = entries[index];
      if (entry.type === 'batch') {
        return entry;
      }
    }
    return undefined;
  }, [entries]);

  const redirectToLogin = useCallback(() => {
    router.replace(`/admin/login?next=${encodeURIComponent(NEXT_PATH)}`);
  }, [router]);

  const handleError = useCallback(
    (nextError: unknown) => {
      const message = normalizeError(nextError);
      if (isAuthError(message)) {
        redirectToLogin();
        return;
      }
      setError(message);
    },
    [redirectToLogin],
  );

  const syncConversationDetail = useCallback((detail: AdminRwkvChatConversationDetail) => {
    setSelectedConversationId(detail.id);
    setEntries(entriesFromConversation(detail));
    setConversations((current) => upsertConversationSummary(current, summaryFromDetail(detail)));
  }, []);

  const loadConversations = useCallback(
    async (preferredId?: number) => {
      const list = await fetchAdminRwkvChatConversations();
      setConversations(list);
      if (!list.length) {
        setSelectedConversationId(null);
        setEntries([]);
        return;
      }

      const nextId =
        preferredId && list.some((conversation) => conversation.id === preferredId)
          ? preferredId
          : list[0].id;
      setSelectedConversationId(nextId);
      const detail = await fetchAdminRwkvChatConversation(nextId);
      syncConversationDetail(detail);
    },
    [syncConversationDetail],
  );

  const loadConversation = useCallback(
    async (conversationId: number) => {
      if (sending) return;
      setConversationLoading(true);
      setError('');
      try {
        const detail = await fetchAdminRwkvChatConversation(conversationId);
        syncConversationDetail(detail);
      } catch (nextError) {
        handleError(nextError);
      } finally {
        setConversationLoading(false);
      }
    },
    [handleError, sending, syncConversationDetail],
  );

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setCheckingSession(true);
      try {
        const nextSession = await fetchAdminSession();
        if (cancelled) return;
        if (!nextSession) {
          redirectToLogin();
          return;
        }
        setSession(nextSession);
        await loadConversations();
      } catch (nextError) {
        if (!cancelled) handleError(nextError);
        return;
      } finally {
        if (!cancelled) setCheckingSession(false);
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
      abortRef.current?.abort();
    };
  }, [handleError, loadConversations, redirectToLogin]);

  useEffect(() => {
    const node = messageListRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [entries]);

  const markActiveBatchStopped = useCallback(() => {
    const batchEntryId = activeBatchEntryIdRef.current;
    if (!batchEntryId) return;
    setEntries((current) =>
      current.map((entry) => {
        if (entry.type !== 'batch' || entry.id !== batchEntryId) {
          return entry;
        }
        return {
          ...entry,
          status: 'stopped',
          slots: entry.slots.map((slot) =>
            TERMINAL_STATUSES.has(slot.status)
              ? slot
              : {
                  ...slot,
                  status: 'error',
                  error: 'Stopped by user.',
                },
          ),
        };
      }),
    );
  }, []);

  const stopStreaming = useCallback(async () => {
    const assistantMessageId = activeAssistantMessageIdRef.current;
    abortRef.current?.abort();
    abortRef.current = null;
    markActiveBatchStopped();
    activeBatchEntryIdRef.current = '';
    activeAssistantMessageIdRef.current = null;
    setSending(false);

    if (!assistantMessageId) return;
    try {
      const detail = await stopAdminRwkvChatMessage(assistantMessageId);
      syncConversationDetail(detail);
    } catch (nextError) {
      handleError(nextError);
    }
  }, [handleError, markActiveBatchStopped, syncConversationDetail]);

  const createConversation = useCallback(async () => {
    if (sending) return;
    setConversationLoading(true);
    setError('');
    try {
      const detail = await createAdminRwkvChatConversation();
      syncConversationDetail(detail);
    } catch (nextError) {
      handleError(nextError);
    } finally {
      setConversationLoading(false);
    }
  }, [handleError, sending, syncConversationDetail]);

  const deleteSelectedConversation = useCallback(async () => {
    if (!selectedConversationId || sending) return;
    setConversationLoading(true);
    setError('');
    try {
      await deleteAdminRwkvChatConversation(selectedConversationId);
      const nextList = conversations.filter(
        (conversation) => conversation.id !== selectedConversationId,
      );
      setConversations(nextList);
      if (!nextList.length) {
        setSelectedConversationId(null);
        setEntries([]);
        return;
      }
      const nextId = nextList[0].id;
      const detail = await fetchAdminRwkvChatConversation(nextId);
      syncConversationDetail(detail);
    } catch (nextError) {
      handleError(nextError);
    } finally {
      setConversationLoading(false);
    }
  }, [conversations, handleError, selectedConversationId, sending, syncConversationDetail]);

  const selectSlot = useCallback(
    async (batchEntryId: string, slotId: string, messageId?: number) => {
      setEntries((current) =>
        current.map((entry) =>
          entry.type === 'batch' && entry.id === batchEntryId
            ? { ...entry, selectedSlotId: slotId }
            : entry,
        ),
      );
      if (!messageId) return;
      try {
        const detail = await selectAdminRwkvChatMessageSlot(messageId, slotId);
        syncConversationDetail(detail);
      } catch (nextError) {
        handleError(nextError);
      }
    },
    [handleError, syncConversationDetail],
  );

  const submitMessage = useCallback(
    async (event?: FormEvent<HTMLFormElement>) => {
      event?.preventDefault();
      const content = input.trim();
      if (!content || sending) return;

      setError('');
      setSending(true);

      let conversationId = selectedConversationId;
      try {
        if (!conversationId) {
          const detail = await createAdminRwkvChatConversation({ title: content });
          conversationId = detail.id;
          syncConversationDetail(detail);
        }
      } catch (nextError) {
        setSending(false);
        handleError(nextError);
        return;
      }

      const userEntry = createUserEntry(content, conversationId);
      const batchEntry = createBatchEntry({
        conversationId,
        model,
        webSearchEnabled,
        batchInferenceEnabled,
        batchCount,
      });

      setEntries((current) => [...current, userEntry, batchEntry]);
      setInput('');

      const controller = new AbortController();
      abortRef.current = controller;
      activeBatchEntryIdRef.current = batchEntry.id;
      activeAssistantMessageIdRef.current = null;

      const applyStreamEvent = (streamEvent: AdminRwkvChatStreamEvent) => {
        if (streamEvent.type === 'batch_start') {
          if (streamEvent.conversation) {
            setConversations((current) =>
              upsertConversationSummary(current, streamEvent.conversation!),
            );
            setSelectedConversationId(streamEvent.conversation.id);
          }
          if (streamEvent.assistantMessage?.id) {
            activeAssistantMessageIdRef.current = streamEvent.assistantMessage.id;
          }
          setEntries((current) =>
            current.map((entry) => {
              if (entry.id === userEntry.id && entry.type === 'user' && streamEvent.userMessage) {
                return entryFromMessage(streamEvent.userMessage) as UserEntry;
              }
              if (entry.type === 'batch' && entry.id === batchEntry.id) {
                return applyBatchEvent(entry, streamEvent);
              }
              return entry;
            }),
          );
          return;
        }

        setEntries((current) =>
          current.map((entry) =>
            entry.type === 'batch' && entry.id === batchEntry.id
              ? applyBatchEvent(entry, streamEvent)
              : entry,
          ),
        );
      };

      try {
        await streamAdminRwkvChat({
          model,
          conversationId,
          message: content,
          messages: [],
          webSearchEnabled,
          batchInferenceEnabled,
          batchCount,
          signal: controller.signal,
          onEvent: applyStreamEvent,
        });
        const detail = await fetchAdminRwkvChatConversation(conversationId);
        syncConversationDetail(detail);
      } catch (nextError) {
        if (controller.signal.aborted) return;
        handleError(nextError);
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
        if (activeBatchEntryIdRef.current === batchEntry.id) {
          activeBatchEntryIdRef.current = '';
        }
        activeAssistantMessageIdRef.current = null;
        setSending(false);
      }
    },
    [
      batchInferenceEnabled,
      batchCount,
      handleError,
      input,
      model,
      selectedConversationId,
      sending,
      syncConversationDetail,
      webSearchEnabled,
    ],
  );

  const handleInputKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key !== 'Enter' || event.shiftKey) return;
      event.preventDefault();
      void submitMessage();
    },
    [submitMessage],
  );

  if (checkingSession) {
    return (
      <main className={styles.page}>
        <section className={styles.loadingPanel}>
          <h1>Checking session...</h1>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <aside className={styles.conversationPanel}>
          <div className={styles.conversationHeader}>
            <div>
              <p className={styles.eyebrow}>Conversations</p>
              <h2>RWKV Chat</h2>
            </div>
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => void createConversation()}
              disabled={sending || conversationLoading}
              aria-label="New conversation"
              title="New conversation"
            >
              +
            </button>
          </div>

          <div className={styles.conversationList}>
            {conversations.length ? (
              conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  className={`${styles.conversationRow} ${
                    conversation.id === selectedConversationId ? styles.conversationRowActive : ''
                  }`}
                  onClick={() => void loadConversation(conversation.id)}
                  disabled={sending}
                >
                  <span className={styles.conversationTitle}>{conversation.title}</span>
                  <span className={styles.conversationPreview}>
                    {conversation.lastMessagePreview || `${conversation.messageCount} messages`}
                  </span>
                  <span className={styles.conversationTime}>
                    {formatConversationTime(conversation.updatedAt)}
                  </span>
                </button>
              ))
            ) : (
              <div className={styles.emptyConversationList}>No conversations</div>
            )}
          </div>
        </aside>

        <div className={styles.chatPanel}>
          <header className={styles.header}>
            <div>
              <p className={styles.eyebrow}>Admin Console</p>
              <h1 className={styles.title}>{selectedConversation?.title || 'RWKV Chat'}</h1>
            </div>
            <div className={styles.statusGroup}>
              <span className={styles.statusPill}>User: {session?.username || 'unknown'}</span>
              <span className={styles.statusPill}>{selectedModel.label}</span>
              <span className={styles.statusPill}>{sending ? 'Streaming' : 'Ready'}</span>
            </div>
          </header>

          <div ref={messageListRef} className={styles.messages}>
            {conversationLoading ? (
              <div className={styles.emptyState}>
                <h2>Loading...</h2>
              </div>
            ) : entries.length === 0 ? (
              <div className={styles.emptyState}>
                <h2>No messages</h2>
              </div>
            ) : (
              entries.map((entry) =>
                entry.type === 'user' ? (
                  <article key={entry.id} className={`${styles.message} ${styles.userMessage}`}>
                    <div className={styles.messageMeta}>
                      <span>You</span>
                      <strong>{MESSAGE_STATUS_LABELS[entry.status] || entry.status}</strong>
                    </div>
                    <div className={styles.messageContent}>{entry.content}</div>
                  </article>
                ) : (
                  <section key={entry.id} className={styles.batchGroup}>
                    <div className={styles.batchHeader}>
                      <div>
                        <div className={styles.messageMeta}>
                          <span>{getModelLabel(entry.model)}</span>
                          <strong>{MESSAGE_STATUS_LABELS[entry.status] || entry.status}</strong>
                        </div>
                        <h2>Batch Response</h2>
                      </div>
                      <div className={styles.batchMeta}>
                        <span>
                          {entry.batchInferenceEnabled
                            ? `Batch x${entry.slots.length || entry.batchCount}`
                            : 'Single Slot'}
                        </span>
                        <span>{entry.webSearchEnabled ? 'Web Search On' : 'Raw RWKV'}</span>
                      </div>
                    </div>

                    {entry.slots.length === 0 ? (
                      <div className={styles.batchPlaceholder}>Preparing batch...</div>
                    ) : (
                      <div className={styles.slotGrid}>
                        {entry.slots.map((slot) => {
                          const selected = chooseSelectedSlot(entry) === slot.id;
                          return (
                            <article
                              key={slot.id}
                              className={`${styles.slotCard} ${selected ? styles.slotCardSelected : ''}`}
                              role="button"
                              tabIndex={0}
                              onClick={() => void selectSlot(entry.id, slot.id, entry.messageId)}
                              onKeyDown={(slotEvent) => {
                                if (slotEvent.key !== 'Enter' && slotEvent.key !== ' ') return;
                                slotEvent.preventDefault();
                                void selectSlot(entry.id, slot.id, entry.messageId);
                              }}
                            >
                              <div className={styles.slotHeader}>
                                <div>
                                  <h3>{slot.providerLabel}</h3>
                                  <span>{slot.providerKey}</span>
                                </div>
                                <span
                                  className={`${styles.slotStatus} ${styles[`status_${slot.status}`]}`}
                                >
                                  {STATUS_LABELS[slot.status]}
                                </span>
                              </div>

                              <div className={styles.slotAnswer}>
                                {slot.content ? (
                                  <ReactMarkdown>{slot.content}</ReactMarkdown>
                                ) : slot.error ? (
                                  <p className={styles.slotErrorText}>{slot.error}</p>
                                ) : slot.status === 'skipped' ? (
                                  <p className={styles.slotMutedText}>Skipped</p>
                                ) : (
                                  <p className={styles.slotMutedText}>
                                    {slot.status === 'searching' ? 'Searching...' : 'Waiting...'}
                                  </p>
                                )}
                              </div>

                              <details
                                className={styles.references}
                                onClick={(detailsEvent) => detailsEvent.stopPropagation()}
                              >
                                <summary>{slot.references.length} references</summary>
                                {slot.references.length ? (
                                  <ol>
                                    {slot.references.map((reference) => (
                                      <li key={`${slot.id}-${reference.url}`}>
                                        <a href={reference.url} target="_blank" rel="noreferrer">
                                          {reference.title || reference.url}
                                        </a>
                                        {reference.summary ? <p>{reference.summary}</p> : null}
                                      </li>
                                    ))}
                                  </ol>
                                ) : (
                                  <p>No references</p>
                                )}
                              </details>
                            </article>
                          );
                        })}
                      </div>
                    )}

                    {entry.error ? <p className={styles.batchError}>{entry.error}</p> : null}
                  </section>
                ),
              )
            )}
          </div>

          {error ? <p className={styles.error}>{error}</p> : null}

          <form className={styles.composer} onSubmit={(event) => void submitMessage(event)}>
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleInputKeyDown}
              disabled={sending}
              rows={4}
              placeholder="Message RWKV"
              className={styles.input}
            />
            <div className={styles.composerActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => void createConversation()}
                disabled={sending || conversationLoading}
              >
                New
              </button>
              {sending ? (
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => void stopStreaming()}
                >
                  Stop
                </button>
              ) : (
                <button type="submit" className={styles.primaryButton} disabled={!input.trim()}>
                  Send
                </button>
              )}
            </div>
          </form>
        </div>

        <aside className={styles.sidePanel}>
          <section className={styles.controlBlock}>
            <h2>Model</h2>
            <div className={styles.segmented}>
              {MODEL_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={`${styles.segmentButton} ${option.key === model ? styles.segmentButtonActive : ''}`}
                  onClick={() => setModel(option.key)}
                  disabled={sending}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </section>

          <section className={styles.controlBlock}>
            <h2>Execution</h2>
            <label className={styles.toggleRow}>
              <span>Batch Inference</span>
              <input
                type="checkbox"
                checked={batchInferenceEnabled}
                onChange={(event) => setBatchInferenceEnabled(event.target.checked)}
                disabled={sending}
              />
            </label>
            <div className={styles.numberRow}>
              <span>Batch Count</span>
              <div className={styles.stepper}>
                <button
                  type="button"
                  className={styles.stepperButton}
                  onClick={() => updateBatchCount(batchCount - 1)}
                  disabled={sending || !batchInferenceEnabled || batchCount <= MIN_BATCH_COUNT}
                  aria-label="Decrease batch count"
                  title="Decrease batch count"
                >
                  -
                </button>
                <input
                  type="number"
                  min={MIN_BATCH_COUNT}
                  max={MAX_BATCH_COUNT}
                  value={batchCount}
                  onChange={(event) => updateBatchCount(Number(event.target.value))}
                  disabled={sending || !batchInferenceEnabled}
                  className={styles.numberInput}
                  aria-label="Batch count"
                />
                <button
                  type="button"
                  className={styles.stepperButton}
                  onClick={() => updateBatchCount(batchCount + 1)}
                  disabled={sending || !batchInferenceEnabled || batchCount >= MAX_BATCH_COUNT}
                  aria-label="Increase batch count"
                  title="Increase batch count"
                >
                  +
                </button>
              </div>
            </div>
            <label className={styles.toggleRow}>
              <span>Web Search</span>
              <input
                type="checkbox"
                checked={webSearchEnabled}
                onChange={(event) => setWebSearchEnabled(event.target.checked)}
                disabled={sending}
              />
            </label>
          </section>

          <section className={styles.controlBlock}>
            <h2>Provider Status</h2>
            {latestBatch?.slots.length ? (
              <div className={styles.providerList}>
                {latestBatch.slots.map((slot) => (
                  <button
                    key={slot.id}
                    type="button"
                    className={`${styles.providerRow} ${
                      chooseSelectedSlot(latestBatch) === slot.id ? styles.providerRowActive : ''
                    }`}
                    onClick={() => void selectSlot(latestBatch.id, slot.id, latestBatch.messageId)}
                  >
                    <span>{slot.providerLabel}</span>
                    <strong>{STATUS_LABELS[slot.status]}</strong>
                  </button>
                ))}
              </div>
            ) : (
              <p className={styles.sideMuted}>No active providers</p>
            )}
          </section>

          <section className={styles.controlBlock}>
            <h2>Conversation</h2>
            <dl className={styles.metaList}>
              <div>
                <dt>Messages</dt>
                <dd>{entries.length}</dd>
              </div>
              <div>
                <dt>Access</dt>
                <dd>Admin session</dd>
              </div>
              <div>
                <dt>Storage</dt>
                <dd>Server SQLite</dd>
              </div>
            </dl>
            <button
              type="button"
              className={styles.dangerButton}
              onClick={() => void deleteSelectedConversation()}
              disabled={!selectedConversationId || sending || conversationLoading}
            >
              Delete Conversation
            </button>
          </section>
        </aside>
      </section>
    </main>
  );
}
