import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { TextDecoder } from 'util';
import { PrismaService } from '../prisma/prisma.service';
import {
  RwkvSearchProvider,
  RwkvSearchReference,
  getRwkvSearchProviders,
} from './rwkv-chat.search';

type RwkvChatModel = '7b' | '13b';
type RwkvChatRole = 'user' | 'assistant';
type RwkvBatchSlotStatus = 'queued' | 'searching' | 'generating' | 'done' | 'error' | 'skipped';

interface RwkvChatMessage {
  role?: string;
  content?: string;
}

interface RwkvChatStreamBody {
  model?: string;
  conversationId?: number;
  message?: string;
  messages?: RwkvChatMessage[];
  webSearchEnabled?: boolean;
  batchInferenceEnabled?: boolean;
  batchCount?: number;
  providers?: string[];
}

interface RwkvChatCreateConversationBody {
  title?: string;
}

interface RwkvChatSelectSlotBody {
  slotId?: string;
}

interface LightningChoice {
  index: number;
  content: string;
  finishReason?: string;
}

interface LightningEvent {
  done: boolean;
  choices: LightningChoice[];
}

interface LightningRequestBody {
  contents: string[];
  max_tokens: number;
  stop_tokens: string[];
  temperature: number;
  top_k: number;
  top_p: number;
  pad_zero: boolean;
  alpha_presence: number;
  alpha_frequency: number;
  alpha_decay: number;
  chunk_size: number;
  stream: boolean;
  password: string;
}

interface RwkvBatchSlot {
  id: string;
  providerKey: string;
  providerLabel: string;
  status: RwkvBatchSlotStatus;
  references: RwkvSearchReference[];
  content?: string;
  prompt?: string;
  error?: string;
}

interface RwkvChatPersistenceContext {
  conversationId: number;
  userMessageId: number;
  assistantMessageId: number;
}

interface StreamLightningBatchOptions {
  batchId: string;
  endpoint: string;
  password: string;
  slots: RwkvBatchSlot[];
  persistence: RwkvChatPersistenceContext;
  response: Response;
  signal: AbortSignal;
}

const HISTORY_LIMIT = 12;
const MAX_MESSAGE_LENGTH = 12_000;
const MAX_TOKENS = 4096;
const UPSTREAM_TIMEOUT_MS = 120_000;
const DEFAULT_SEARCH_TIMEOUT_MS = 12_000;
const DEFAULT_SEARCH_CONCURRENCY = 6;
const DEFAULT_BATCH_COUNT = 4;
const MAX_BATCH_COUNT = 10;
const DEFAULT_LIGHTNING_BATCH_SIZE = 4;
const MODEL_ENDPOINTS: Record<RwkvChatModel, string> = {
  '7b': 'http://47.115.88.183:1801/v1/chat/completions',
  '13b': 'http://47.115.88.183:1800/v1/chat/completions',
};

class LightningSseParser {
  private pending = '';

  add(chunk: string): LightningEvent[] {
    this.pending += chunk;
    const events: LightningEvent[] = [];

    while (true) {
      const separatorIndex = this.pending.indexOf('\n\n');
      if (separatorIndex < 0) {
        break;
      }

      const rawEvent = this.pending.slice(0, separatorIndex);
      this.pending = this.pending.slice(separatorIndex + 2);
      const event = this.parseEvent(rawEvent);
      if (event) {
        events.push(event);
      }
    }

    return events;
  }

  private parseEvent(rawEvent: string): LightningEvent | null {
    const dataLines = rawEvent
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart());

    if (dataLines.length === 0) {
      return null;
    }

    const data = dataLines.join('\n').trim();
    if (!data) {
      return null;
    }
    if (data === '[DONE]') {
      return { done: true, choices: [] };
    }

    const decoded = JSON.parse(data) as Record<string, unknown>;
    const rawChoices = decoded.choices;
    if (!Array.isArray(rawChoices)) {
      return { done: false, choices: [] };
    }

    const choices = rawChoices
      .map((rawChoice) => this.parseChoice(rawChoice))
      .filter((choice): choice is LightningChoice => Boolean(choice));

    return { done: false, choices };
  }

  private parseChoice(rawChoice: unknown): LightningChoice | null {
    if (!rawChoice || typeof rawChoice !== 'object') {
      return null;
    }

    const choice = rawChoice as Record<string, unknown>;
    const rawIndex = choice.index;
    const delta = choice.delta;
    const message = choice.message;
    const content =
      this.pickString(delta, 'content') ||
      this.pickString(message, 'content') ||
      this.stringValue(choice.text) ||
      this.stringValue(choice.content) ||
      '';

    return {
      index: typeof rawIndex === 'number' ? rawIndex : 0,
      content,
      finishReason: this.stringValue(choice.finish_reason) || undefined,
    };
  }

  private pickString(value: unknown, key: string): string {
    if (!value || typeof value !== 'object') {
      return '';
    }
    return this.stringValue((value as Record<string, unknown>)[key]);
  }

  private stringValue(value: unknown): string {
    return typeof value === 'string' ? value : '';
  }
}

@Injectable()
export class RwkvChatService {
  constructor(private readonly prisma: PrismaService) {}

  async listConversations() {
    const conversations = await this.prisma.rwkvChatConversation.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 120,
      include: {
        _count: {
          select: { messages: true },
        },
      },
    });

    return conversations.map((conversation) => ({
      id: conversation.id,
      title: conversation.title,
      status: conversation.status,
      selectedMessageId: conversation.selectedMessageId,
      selectedSlotId: conversation.selectedSlotId,
      lastMessagePreview: conversation.lastMessagePreview,
      messageCount: conversation._count.messages,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    }));
  }

  async createConversation(body: unknown, createdBy: string) {
    const input = this.objectValue(body) as RwkvChatCreateConversationBody;
    const title = this.normalizeConversationTitle(input.title || 'New conversation');
    const conversation = await this.prisma.rwkvChatConversation.create({
      data: {
        title,
        createdBy,
      },
    });
    return this.getConversation(conversation.id);
  }

  async getConversation(id: number) {
    const conversation = await this.prisma.rwkvChatConversation.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            batch: {
              include: {
                slots: {
                  orderBy: { createdAt: 'asc' },
                },
              },
            },
          },
        },
      },
    });

    if (!conversation) {
      throw new BadRequestException('Conversation not found.');
    }

    return this.toPublicConversationDetail(conversation);
  }

  async deleteConversation(id: number) {
    await this.ensureConversation(id);
    await this.prisma.rwkvChatConversation.delete({
      where: { id },
    });
    return { ok: true };
  }

  async selectMessageSlot(messageId: number, body: unknown) {
    const input = this.objectValue(body) as RwkvChatSelectSlotBody;
    const slotId = typeof input.slotId === 'string' ? input.slotId.trim() : '';
    if (!slotId) {
      throw new BadRequestException('slotId is required.');
    }

    const message = await this.prisma.rwkvChatMessage.findUnique({
      where: { id: messageId },
      include: {
        batch: {
          include: { slots: true },
        },
      },
    });
    if (!message?.batch) {
      throw new BadRequestException('Message batch not found.');
    }

    const slot = message.batch.slots.find((item) => item.id === slotId);
    if (!slot) {
      throw new BadRequestException('Slot not found for this message.');
    }

    await this.prisma.rwkvChatMessage.update({
      where: { id: message.id },
      data: {
        selectedSlotId: slot.id,
        content: slot.content,
      },
    });
    await this.prisma.rwkvChatConversation.update({
      where: { id: message.conversationId },
      data: {
        selectedMessageId: message.id,
        selectedSlotId: slot.id,
        lastMessagePreview: this.preview(slot.content || message.content),
      },
    });

    return this.getConversation(message.conversationId);
  }

  async stopMessage(messageId: number) {
    const message = await this.prisma.rwkvChatMessage.findUnique({
      where: { id: messageId },
      include: { batch: true },
    });
    if (!message?.batch) {
      throw new BadRequestException('Message batch not found.');
    }

    const messageStatus = message.status === 'done' ? message.status : 'stopped';
    await this.prisma.rwkvChatMessage.update({
      where: { id: message.id },
      data: {
        status: messageStatus,
        error: messageStatus === 'stopped' ? 'Stopped by user.' : message.error,
      },
    });
    await this.prisma.rwkvChatBatch.update({
      where: { id: message.batch.id },
      data: {
        status: messageStatus,
        error: messageStatus === 'stopped' ? 'Stopped by user.' : message.batch.error,
      },
    });
    if (messageStatus === 'stopped') {
      await this.prisma.rwkvChatSlot.updateMany({
        where: {
          batchId: message.batch.id,
          status: {
            notIn: ['done', 'error', 'skipped'],
          },
        },
        data: {
          status: 'error',
          error: 'Stopped by user.',
        },
      });
    }

    return this.getConversation(message.conversationId);
  }

  async stream(
    body: RwkvChatStreamBody,
    request: Request & { adminUser?: string },
    response: Response,
  ) {
    const model = this.validateModel(body.model);
    const userContent = this.validateCurrentUserMessage(body);
    const requestedProviders = this.validateProviders(body.providers);
    const webSearchEnabled = body.webSearchEnabled !== false;
    const batchInferenceEnabled = body.batchInferenceEnabled !== false;
    const batchCount = this.validateBatchCount(body.batchCount);
    const password = this.resolvePassword(model);
    const endpoint = MODEL_ENDPOINTS[model];
    const batchId = this.createId('batch');
    const conversation = await this.resolveConversation({
      conversationId: body.conversationId,
      userContent,
      createdBy: request.adminUser || 'unknown',
    });
    const slots = this.createSlots({
      requestedProviders,
      webSearchEnabled,
      batchInferenceEnabled,
      batchCount,
    });
    const persistence = await this.createPersistentTurn({
      conversationId: conversation.id,
      batchId,
      userContent,
      model,
      webSearchEnabled,
      batchInferenceEnabled,
      slots,
    });
    const messages = await this.loadHistoryMessages(conversation.id);

    const abortController = new AbortController();
    const abortUpstream = () => abortController.abort();
    request.on('aborted', abortUpstream);
    response.on('close', abortUpstream);

    try {
      this.prepareSseResponse(response);
      this.writeEvent(response, 'batch_start', {
        batchId,
        model,
        webSearchEnabled,
        batchInferenceEnabled,
        batchCount,
        conversation: await this.toPublicConversationSummaryById(conversation.id),
        userMessage: {
          id: persistence.userMessageId,
          conversationId: conversation.id,
          role: 'user',
          content: userContent,
          status: 'done',
        },
        assistantMessage: {
          id: persistence.assistantMessageId,
          conversationId: conversation.id,
          role: 'assistant',
          content: '',
          status: 'running',
          model,
          batchId,
          selectedSlotId: slots[0]?.id,
        },
        slots: slots.map((slot) => this.toPublicSlot(slot)),
      });

      if (webSearchEnabled) {
        await this.searchSlots({
          batchId,
          messages,
          slots,
          response,
          signal: abortController.signal,
        });
      } else {
        for (const slot of slots) {
          slot.status = 'generating';
          slot.prompt = this.buildPrompt(messages);
          await this.writeSlotStatus(response, batchId, slot);
        }
      }

      const runnableSlots = slots.filter((slot) => slot.status === 'generating' && slot.prompt);
      if (!runnableSlots.length || abortController.signal.aborted) {
        await this.finishBatch({
          batchId,
          persistence,
          slots,
          response,
          aborted: abortController.signal.aborted,
        });
        return;
      }

      await this.streamLightningBatch({
        batchId,
        endpoint,
        password,
        slots: runnableSlots,
        persistence,
        response,
        signal: abortController.signal,
      });
      await this.finishBatch({
        batchId,
        persistence,
        slots,
        response,
        aborted: abortController.signal.aborted,
      });
    } catch (error) {
      if (response.headersSent) {
        await this.markBatchFailed(
          batchId,
          persistence.assistantMessageId,
          this.normalizeError(error),
        );
        this.writeErrorEvent(response, this.normalizeError(error));
        return;
      }
      await this.markBatchFailed(
        batchId,
        persistence.assistantMessageId,
        this.normalizeError(error),
      );
      throw error;
    } finally {
      request.off('aborted', abortUpstream);
      response.off('close', abortUpstream);
      if (!response.writableEnded) {
        response.end();
      }
    }
  }

  private validateCurrentUserMessage(body: RwkvChatStreamBody): string {
    if (typeof body.message === 'string') {
      const content = body.message.trim();
      if (!content) {
        throw new BadRequestException('message content is required.');
      }
      if (content.length > MAX_MESSAGE_LENGTH) {
        throw new BadRequestException('message content is too long.');
      }
      return content;
    }

    const messages = this.validateMessages(body.messages);
    return messages[messages.length - 1].content;
  }

  private async resolveConversation(options: {
    conversationId?: number;
    userContent: string;
    createdBy: string;
  }) {
    if (typeof options.conversationId === 'number' && Number.isInteger(options.conversationId)) {
      return this.ensureConversation(options.conversationId);
    }

    return this.prisma.rwkvChatConversation.create({
      data: {
        title: this.normalizeConversationTitle(options.userContent),
        createdBy: options.createdBy,
        lastMessagePreview: this.preview(options.userContent),
      },
    });
  }

  private async ensureConversation(id: number) {
    const conversation = await this.prisma.rwkvChatConversation.findUnique({
      where: { id },
    });
    if (!conversation) {
      throw new BadRequestException('Conversation not found.');
    }
    return conversation;
  }

  private async createPersistentTurn(options: {
    conversationId: number;
    batchId: string;
    userContent: string;
    model: RwkvChatModel;
    webSearchEnabled: boolean;
    batchInferenceEnabled: boolean;
    slots: RwkvBatchSlot[];
  }): Promise<RwkvChatPersistenceContext> {
    const result = await this.prisma.$transaction(async (tx) => {
      const userMessage = await tx.rwkvChatMessage.create({
        data: {
          conversationId: options.conversationId,
          role: 'user',
          content: options.userContent,
          status: 'done',
        },
      });

      const assistantMessage = await tx.rwkvChatMessage.create({
        data: {
          conversationId: options.conversationId,
          role: 'assistant',
          content: '',
          status: 'running',
          model: options.model,
          webSearchEnabled: options.webSearchEnabled,
          batchInferenceEnabled: options.batchInferenceEnabled,
          batchId: options.batchId,
          selectedSlotId: options.slots[0]?.id,
        },
      });

      await tx.rwkvChatBatch.create({
        data: {
          id: options.batchId,
          conversationId: options.conversationId,
          assistantMessageId: assistantMessage.id,
          model: options.model,
          webSearchEnabled: options.webSearchEnabled,
          batchInferenceEnabled: options.batchInferenceEnabled,
          status: 'queued',
          slots: {
            create: options.slots.map((slot) => ({
              id: slot.id,
              providerKey: slot.providerKey,
              providerLabel: slot.providerLabel,
              status: slot.status,
              references: JSON.stringify(slot.references),
              content: slot.content || '',
              error: slot.error,
            })),
          },
        },
      });

      await tx.rwkvChatConversation.update({
        where: { id: options.conversationId },
        data: {
          status: 'active',
          selectedMessageId: assistantMessage.id,
          selectedSlotId: options.slots[0]?.id,
          lastMessagePreview: this.preview(options.userContent),
        },
      });

      return {
        userMessageId: userMessage.id,
        assistantMessageId: assistantMessage.id,
      };
    });

    return {
      conversationId: options.conversationId,
      userMessageId: result.userMessageId,
      assistantMessageId: result.assistantMessageId,
    };
  }

  private async loadHistoryMessages(conversationId: number): Promise<
    Array<{
      role: RwkvChatRole;
      content: string;
    }>
  > {
    const messages = await this.prisma.rwkvChatMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });

    const history: Array<{ role: RwkvChatRole; content: string }> = [];
    for (const message of messages) {
      if (message.role !== 'user' && message.role !== 'assistant') {
        continue;
      }
      const content = message.content.trim();
      if (!content) {
        continue;
      }
      history.push({
        role: message.role,
        content,
      });
    }
    return history.slice(-HISTORY_LIMIT);
  }

  private validateModel(value: string | undefined): RwkvChatModel {
    if (value === '7b' || value === '13b') {
      return value;
    }
    throw new BadRequestException('model must be 7b or 13b.');
  }

  private validateMessages(value: RwkvChatMessage[] | undefined): Array<{
    role: RwkvChatRole;
    content: string;
  }> {
    if (!Array.isArray(value) || value.length === 0) {
      throw new BadRequestException('messages must be a non-empty array.');
    }

    const messages = value.slice(-HISTORY_LIMIT).map((message) => {
      const role = message.role;
      const content = typeof message.content === 'string' ? message.content.trim() : '';
      if (role !== 'user' && role !== 'assistant') {
        throw new BadRequestException('message role must be user or assistant.');
      }
      const normalizedRole: RwkvChatRole = role;
      if (!content) {
        throw new BadRequestException('message content is required.');
      }
      if (content.length > MAX_MESSAGE_LENGTH) {
        throw new BadRequestException('message content is too long.');
      }
      return { role: normalizedRole, content };
    });

    if (messages[messages.length - 1].role !== 'user') {
      throw new BadRequestException('last message must be from user.');
    }

    return messages;
  }

  private validateProviders(value: unknown): string[] | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (!Array.isArray(value)) {
      throw new BadRequestException('providers must be an array of strings.');
    }
    const providers = value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean);
    if (providers.length !== value.length) {
      throw new BadRequestException('providers must be an array of strings.');
    }
    return Array.from(new Set(providers)).slice(0, 20);
  }

  private validateBatchCount(value: unknown): number | undefined {
    if (value === undefined) {
      return undefined;
    }
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed) || parsed < 1) {
      throw new BadRequestException('batchCount must be a positive number.');
    }
    return Math.min(Math.floor(parsed), MAX_BATCH_COUNT);
  }

  private resolvePassword(model: RwkvChatModel): string {
    const specific =
      model === '7b'
        ? process.env.RWKV_LIGHTNING_7B_PASSWORD
        : process.env.RWKV_LIGHTNING_13B_PASSWORD;
    const password = specific || process.env.RWKV_LIGHTNING_PASSWORD || '';
    if (!password.trim()) {
      throw new ServiceUnavailableException('RWKV Lightning password is not configured.');
    }
    return password;
  }

  private createSlots(options: {
    requestedProviders?: string[];
    webSearchEnabled: boolean;
    batchInferenceEnabled: boolean;
    batchCount?: number;
  }): RwkvBatchSlot[] {
    if (!options.webSearchEnabled) {
      const rawSlotCount = options.batchInferenceEnabled
        ? (options.batchCount ?? DEFAULT_BATCH_COUNT)
        : 1;
      return Array.from({ length: rawSlotCount }, (_, index) => ({
        id: this.createId('slot'),
        providerKey: rawSlotCount === 1 ? 'raw_rwkv' : `raw_rwkv_${index + 1}`,
        providerLabel: rawSlotCount === 1 ? 'Raw RWKV' : `Raw RWKV ${index + 1}`,
        status: 'queued' as const,
        references: [],
      }));
    }

    const providers = getRwkvSearchProviders();
    const selectedProviders = (options.batchInferenceEnabled
      ? this.filterRequestedProviders(providers, options.requestedProviders)
      : providers.filter((provider) => provider.key === 'rwkv_app_search')
    ).slice(0, options.batchInferenceEnabled ? (options.batchCount ?? providers.length) : 1);

    const slots: RwkvBatchSlot[] = selectedProviders.map((provider) => ({
      id: this.createId('slot'),
      providerKey: provider.key,
      providerLabel: provider.label,
      status: 'queued',
      references: [],
    }));

    if (!options.batchInferenceEnabled || !options.requestedProviders?.length) {
      return slots;
    }

    const knownKeys = new Set<string>(providers.map((provider) => provider.key));
    const unknownSlots = options.requestedProviders
      .filter((providerKey) => !knownKeys.has(providerKey))
      .map((providerKey) => ({
        id: this.createId('slot'),
        providerKey,
        providerLabel: providerKey,
        status: 'skipped' as const,
        references: [],
        error: 'Search provider is not supported.',
      }));

    return [...slots, ...unknownSlots];
  }

  private filterRequestedProviders(
    providers: RwkvSearchProvider[],
    requestedProviders?: string[],
  ): RwkvSearchProvider[] {
    if (!requestedProviders?.length) {
      return providers;
    }
    const requested = new Set(requestedProviders);
    return providers.filter((provider) => requested.has(provider.key));
  }

  private async searchSlots(options: {
    batchId: string;
    messages: Array<{ role: RwkvChatRole; content: string }>;
    slots: RwkvBatchSlot[];
    response: Response;
    signal: AbortSignal;
  }) {
    const providerByKey = new Map<string, RwkvSearchProvider>(
      getRwkvSearchProviders().map((provider) => [provider.key, provider]),
    );
    const question = options.messages[options.messages.length - 1].content;
    const timeoutMs = this.readNumberEnv('RWKV_CHAT_SEARCH_TIMEOUT_MS', DEFAULT_SEARCH_TIMEOUT_MS);
    const concurrency = this.readNumberEnv(
      'RWKV_CHAT_SEARCH_CONCURRENCY',
      DEFAULT_SEARCH_CONCURRENCY,
    );

    await this.runConcurrent(options.slots, concurrency, async (slot) => {
      if (options.signal.aborted) {
        return;
      }

      const provider = providerByKey.get(slot.providerKey);
      if (!provider) {
        slot.status = 'skipped';
        slot.error = 'Search provider is not supported.';
        await this.writeSlotStatus(options.response, options.batchId, slot);
        return;
      }

      if (!provider.isConfigured()) {
        slot.status = 'skipped';
        slot.error = provider.missingReason;
        await this.writeSlotStatus(options.response, options.batchId, slot);
        return;
      }

      slot.status = 'searching';
      await this.writeSlotStatus(options.response, options.batchId, slot);
      try {
        const result = await provider.search({
          query: question,
          signal: options.signal,
          timeoutMs,
        });
        if (options.signal.aborted) {
          return;
        }
        slot.references = result.references;
        if (!slot.references.length) {
          slot.status = 'error';
          slot.error = 'Search provider returned no usable references.';
          await this.writeSlotError(options.response, options.batchId, slot);
          return;
        }
        slot.prompt = this.buildGroundedPrompt(options.messages, slot);
        await this.writeSlotReferences(options.response, options.batchId, slot);
        slot.status = 'generating';
        await this.writeSlotStatus(options.response, options.batchId, slot);
      } catch (error) {
        if (options.signal.aborted) {
          return;
        }
        slot.status = 'error';
        slot.error = this.normalizeError(error);
        await this.writeSlotError(options.response, options.batchId, slot);
      }
    });
  }

  private async streamLightningBatch(options: StreamLightningBatchOptions) {
    const chunkSize = this.readIntegerEnv(
      'RWKV_CHAT_LIGHTNING_BATCH_SIZE',
      DEFAULT_LIGHTNING_BATCH_SIZE,
    );
    for (let index = 0; index < options.slots.length; index += chunkSize) {
      if (options.signal.aborted) {
        return;
      }
      await this.streamLightningBatchChunk({
        ...options,
        slots: options.slots.slice(index, index + chunkSize),
      });
    }
  }

  private async streamLightningBatchChunk(options: StreamLightningBatchOptions) {
    const abortController = new AbortController();
    const abortWithParent = () => abortController.abort(options.signal.reason);
    if (options.signal.aborted) {
      abortController.abort(options.signal.reason);
    } else {
      options.signal.addEventListener('abort', abortWithParent, { once: true });
    }

    const timeout = setTimeout(
      () => abortController.abort(new Error('RWKV Lightning timeout.')),
      UPSTREAM_TIMEOUT_MS,
    );

    try {
      const upstream = await fetch(options.endpoint, {
        method: 'POST',
        headers: {
          Accept: '*/*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(this.buildLightningRequestBody(options.slots, options.password, true)),
        signal: abortController.signal,
      });

      if (!upstream.ok) {
        const text = await upstream.text();
        throw new ServiceUnavailableException(
          `RWKV Lightning returned ${upstream.status}: ${this.sanitizeError(text)}`,
        );
      }

      if (!upstream.body) {
        throw new ServiceUnavailableException('RWKV Lightning did not return a stream.');
      }

      const streamed = await this.forwardStream(
        options.batchId,
        options.persistence,
        upstream.body,
        options.slots,
        options.response,
      );
      if (!streamed && !abortController.signal.aborted) {
        await this.completeLightningBatchNonStreaming(options, abortController.signal);
      }
    } catch (error) {
      if (options.signal.aborted) {
        return;
      }
      const message = this.normalizeError(error);
      for (const slot of options.slots) {
        if (slot.status === 'done') {
          continue;
        }
        slot.status = 'error';
        slot.error = message;
        await this.writeSlotError(options.response, options.batchId, slot);
      }
    } finally {
      clearTimeout(timeout);
      options.signal.removeEventListener('abort', abortWithParent);
    }
  }

  private buildLightningRequestBody(
    slots: RwkvBatchSlot[],
    password: string,
    stream: boolean,
  ): LightningRequestBody {
    return {
      contents: slots.map((slot) => slot.prompt || ''),
      max_tokens: MAX_TOKENS,
      stop_tokens: ['\nUser:'],
      temperature: 1,
      top_k: 500,
      top_p: 0.5,
      pad_zero: true,
      alpha_presence: 1,
      alpha_frequency: 0.1,
      alpha_decay: 0.99,
      chunk_size: 8,
      stream,
      password,
    };
  }

  private parseLightningChoice(rawChoice: unknown): LightningChoice | null {
    if (!rawChoice || typeof rawChoice !== 'object') {
      return null;
    }

    const choice = rawChoice as Record<string, unknown>;
    const rawIndex = choice.index;
    const delta = choice.delta;
    const message = choice.message;
    const content =
      this.pickLightningString(delta, 'content') ||
      this.pickLightningString(message, 'content') ||
      this.toLightningString(choice.text) ||
      this.toLightningString(choice.content) ||
      '';

    return {
      index: typeof rawIndex === 'number' ? rawIndex : 0,
      content,
      finishReason: this.toLightningString(choice.finish_reason) || undefined,
    };
  }

  private pickLightningString(value: unknown, key: string): string {
    if (!value || typeof value !== 'object') {
      return '';
    }
    return this.toLightningString((value as Record<string, unknown>)[key]);
  }

  private toLightningString(value: unknown): string {
    return typeof value === 'string' ? value : '';
  }

  private async completeLightningBatchNonStreaming(
    options: StreamLightningBatchOptions,
    signal: AbortSignal,
  ) {
    const upstream = await fetch(options.endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(this.buildLightningRequestBody(options.slots, options.password, false)),
      signal,
    });

    const text = await upstream.text();
    if (!upstream.ok) {
      throw new ServiceUnavailableException(
        `RWKV Lightning returned ${upstream.status}: ${this.sanitizeError(text)}`,
      );
    }

    const payload = JSON.parse(text) as Record<string, unknown>;
    const choices = Array.isArray(payload.choices) ? payload.choices : [];
    const contentSlots = new Set<string>();
    for (const rawChoice of choices) {
      const choice = this.parseLightningChoice(rawChoice);
      if (!choice?.content) {
        continue;
      }
      const slot = options.slots[choice.index];
      if (!slot) {
        continue;
      }
      contentSlots.add(slot.id);
      slot.content = `${slot.content || ''}${choice.content}`;
      await this.writeSlotDelta(
        options.response,
        options.batchId,
        options.persistence,
        slot,
        choice.content,
      );
      slot.status = 'done';
      await this.writeSlotDone(options.response, options.batchId, options.persistence, slot);
    }

    for (const slot of options.slots) {
      if (contentSlots.has(slot.id) || this.isTerminalSlot(slot)) {
        continue;
      }
      slot.status = 'error';
      slot.error = 'RWKV Lightning returned no content for this slot.';
      await this.writeSlotError(options.response, options.batchId, slot);
    }
  }

  private async forwardStream(
    batchId: string,
    persistence: RwkvChatPersistenceContext,
    body: ReadableStream<Uint8Array>,
    slots: RwkvBatchSlot[],
    response: Response,
  ): Promise<boolean> {
    const parser = new LightningSseParser();
    const decoder = new TextDecoder();
    const reader = body.getReader();
    const doneSlots = new Set<string>();
    const contentSlots = new Set<string>();
    let chunkCount = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        chunkCount += 1;
        const chunk = decoder.decode(value, { stream: true });
        const events = parser.add(chunk);
        for (const event of events) {
          if (event.done) {
            await this.markOpenSlotsDone(
              batchId,
              persistence,
              slots,
              doneSlots,
              contentSlots,
              response,
            );
            return true;
          }
          for (const choice of event.choices) {
            const slot = slots[choice.index];
            if (!slot) {
              continue;
            }
            if (choice.content) {
              contentSlots.add(slot.id);
              slot.content = `${slot.content || ''}${choice.content}`;
              await this.writeSlotDelta(response, batchId, persistence, slot, choice.content);
            }
            if (choice.finishReason) {
              if (!contentSlots.has(slot.id)) {
                slot.status = 'error';
                slot.error = 'RWKV Lightning returned no content for this slot.';
                doneSlots.add(slot.id);
                await this.writeSlotError(response, batchId, slot);
                continue;
              }
              slot.status = 'done';
              doneSlots.add(slot.id);
              await this.writeSlotDone(response, batchId, persistence, slot);
            }
          }
        }
      }

      if (chunkCount === 0 && contentSlots.size === 0) {
        return false;
      }
      await this.markOpenSlotsDone(batchId, persistence, slots, doneSlots, contentSlots, response);
      return true;
    } finally {
      reader.releaseLock();
    }
  }

  private async markOpenSlotsDone(
    batchId: string,
    persistence: RwkvChatPersistenceContext,
    slots: RwkvBatchSlot[],
    doneSlots: Set<string>,
    contentSlots: Set<string>,
    response: Response,
  ) {
    for (const slot of slots) {
      if (doneSlots.has(slot.id)) {
        continue;
      }
      if (slot.status !== 'generating') {
        continue;
      }
      if (!contentSlots.has(slot.id)) {
        slot.status = 'error';
        slot.error = 'RWKV Lightning returned no content for this slot.';
        doneSlots.add(slot.id);
        await this.writeSlotError(response, batchId, slot);
        continue;
      }
      slot.status = 'done';
      doneSlots.add(slot.id);
      await this.writeSlotDone(response, batchId, persistence, slot);
    }
  }

  private buildPrompt(messages: Array<{ role: RwkvChatRole; content: string }>) {
    const entries = messages.map((message) => {
      const label = message.role === 'user' ? 'User' : 'Assistant';
      return `${label}: ${message.content}`;
    });
    entries.push('Assistant:');
    return entries.join('\n\n');
  }

  private buildGroundedPrompt(
    messages: Array<{ role: RwkvChatRole; content: string }>,
    slot: RwkvBatchSlot,
  ) {
    const nextMessages = [...messages];
    const lastMessage = nextMessages[nextMessages.length - 1];
    nextMessages[nextMessages.length - 1] = {
      ...lastMessage,
      content: this.buildGroundedUserContent(lastMessage.content, slot),
    };
    return this.buildPrompt(nextMessages);
  }

  private buildGroundedUserContent(question: string, slot: RwkvBatchSlot) {
    const searchResult = slot.references
      .map((reference, index) => {
        const title = reference.title || reference.url || `Reference ${index + 1}`;
        const lines = [`${index + 1}. ${title}`, reference.url];
        if (reference.summary) {
          lines.push(reference.summary);
        }
        return lines.join('\n');
      })
      .join('\n\n');
    if (this.containsCjk(question)) {
      return `${searchResult}\n请根据以上信息回答:\n${question}`;
    }
    return `${searchResult}\nPlease answer according to the above information:\n${question}`;
  }

  private containsCjk(value: string) {
    return /[\u3400-\u9fff]/.test(value);
  }

  private prepareSseResponse(response: Response) {
    response.status(200);
    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders?.();
  }

  private async writeSlotStatus(response: Response, batchId: string, slot: RwkvBatchSlot) {
    await this.persistSlot(slot);
    this.writeEvent(response, 'slot_status', {
      batchId,
      slot: this.toPublicSlot(slot),
    });
  }

  private async writeSlotReferences(response: Response, batchId: string, slot: RwkvBatchSlot) {
    await this.persistSlot(slot);
    this.writeEvent(response, 'slot_references', {
      batchId,
      slotId: slot.id,
      providerKey: slot.providerKey,
      references: slot.references,
    });
  }

  private async writeSlotDelta(
    response: Response,
    batchId: string,
    persistence: RwkvChatPersistenceContext,
    slot: RwkvBatchSlot,
    delta: string,
  ) {
    await this.persistSlot(slot);
    await this.persistAssistantContent(persistence, slot);
    this.writeEvent(response, 'slot_delta', {
      batchId,
      slotId: slot.id,
      providerKey: slot.providerKey,
      delta,
    });
  }

  private async writeSlotDone(
    response: Response,
    batchId: string,
    persistence: RwkvChatPersistenceContext,
    slot: RwkvBatchSlot,
  ) {
    await this.persistSlot(slot);
    await this.persistAssistantContent(persistence, slot);
    this.writeEvent(response, 'slot_done', {
      batchId,
      slot: this.toPublicSlot(slot),
    });
  }

  private async writeSlotError(response: Response, batchId: string, slot: RwkvBatchSlot) {
    await this.persistSlot(slot);
    this.writeEvent(response, 'slot_error', {
      batchId,
      slot: this.toPublicSlot(slot),
      message: slot.error || 'Slot failed.',
    });
  }

  private writeBatchDone(response: Response, batchId: string, slots: RwkvBatchSlot[]) {
    this.writeEvent(response, 'batch_done', {
      batchId,
      slots: slots.map((slot) => this.toPublicSlot(slot)),
    });
  }

  private async finishBatch(options: {
    batchId: string;
    persistence: RwkvChatPersistenceContext;
    slots: RwkvBatchSlot[];
    response: Response;
    aborted: boolean;
  }) {
    if (options.aborted) {
      for (const slot of options.slots) {
        if (this.isTerminalSlot(slot)) {
          continue;
        }
        slot.status = 'error';
        slot.error = 'Stopped by user.';
        await this.persistSlot(slot);
      }
    }

    const selectedSlot = this.chooseStoredSlot(options.slots);
    const doneSlot = options.slots.find((slot) => slot.status === 'done' && slot.content?.trim());
    const hasUsableContent = Boolean(doneSlot?.content?.trim() || selectedSlot?.content?.trim());
    const status = options.aborted ? 'stopped' : hasUsableContent ? 'done' : 'error';
    const error =
      status === 'error'
        ? options.slots.find((slot) => slot.error)?.error || 'No RWKV response was generated.'
        : status === 'stopped'
          ? 'Stopped by user.'
          : undefined;

    await this.prisma.rwkvChatMessage.update({
      where: { id: options.persistence.assistantMessageId },
      data: {
        status,
        content: selectedSlot?.content || '',
        selectedSlotId: selectedSlot?.id,
        error,
      },
    });
    await this.prisma.rwkvChatBatch.update({
      where: { id: options.batchId },
      data: {
        status,
        error,
      },
    });
    await this.prisma.rwkvChatConversation.update({
      where: { id: options.persistence.conversationId },
      data: {
        status: 'active',
        selectedMessageId: options.persistence.assistantMessageId,
        selectedSlotId: selectedSlot?.id,
        lastMessagePreview: this.preview(selectedSlot?.content || error || ''),
      },
    });

    this.writeBatchDone(options.response, options.batchId, options.slots);
  }

  private async markBatchFailed(batchId: string, assistantMessageId: number, message: string) {
    await this.prisma.rwkvChatMessage.update({
      where: { id: assistantMessageId },
      data: {
        status: 'error',
        error: message,
      },
    });
    await this.prisma.rwkvChatBatch.update({
      where: { id: batchId },
      data: {
        status: 'error',
        error: message,
      },
    });
  }

  private async persistSlot(slot: RwkvBatchSlot) {
    await this.prisma.rwkvChatSlot.update({
      where: { id: slot.id },
      data: {
        status: slot.status,
        references: JSON.stringify(slot.references || []),
        content: slot.content || '',
        error: slot.error,
      },
    });
  }

  private async persistAssistantContent(
    persistence: RwkvChatPersistenceContext,
    slot: RwkvBatchSlot,
  ) {
    const message = await this.prisma.rwkvChatMessage.findUnique({
      where: { id: persistence.assistantMessageId },
      select: { selectedSlotId: true },
    });
    if (message?.selectedSlotId && message.selectedSlotId !== slot.id) {
      return;
    }

    await this.prisma.rwkvChatMessage.update({
      where: { id: persistence.assistantMessageId },
      data: {
        content: slot.content || '',
        selectedSlotId: slot.id,
        status: 'running',
      },
    });
    await this.prisma.rwkvChatConversation.update({
      where: { id: persistence.conversationId },
      data: {
        selectedMessageId: persistence.assistantMessageId,
        selectedSlotId: slot.id,
        lastMessagePreview: this.preview(slot.content || ''),
      },
    });
  }

  private writeErrorEvent(response: Response, message: string) {
    this.writeEvent(response, 'error', { message });
  }

  private writeEvent(response: Response, event: string, payload: Record<string, unknown>) {
    if (response.writableEnded || response.destroyed) {
      return;
    }
    response.write(`event: ${event}\ndata: ${JSON.stringify({ type: event, ...payload })}\n\n`);
  }

  private toPublicSlot(slot: RwkvBatchSlot) {
    return {
      id: slot.id,
      providerKey: slot.providerKey,
      providerLabel: slot.providerLabel,
      status: slot.status,
      references: slot.references,
      content: slot.content || '',
      error: slot.error,
    };
  }

  private async toPublicConversationSummaryById(id: number) {
    const conversation = await this.prisma.rwkvChatConversation.findUnique({
      where: { id },
      include: {
        _count: {
          select: { messages: true },
        },
      },
    });
    if (!conversation) {
      return undefined;
    }
    return {
      id: conversation.id,
      title: conversation.title,
      status: conversation.status,
      selectedMessageId: conversation.selectedMessageId,
      selectedSlotId: conversation.selectedSlotId,
      lastMessagePreview: conversation.lastMessagePreview,
      messageCount: conversation._count.messages,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };
  }

  private toPublicConversationDetail(conversation: {
    id: number;
    title: string;
    status: string;
    selectedMessageId: number | null;
    selectedSlotId: string | null;
    lastMessagePreview: string | null;
    createdBy: string | null;
    createdAt: Date;
    updatedAt: Date;
    messages: Array<{
      id: number;
      conversationId: number;
      role: string;
      content: string;
      status: string;
      model: string | null;
      webSearchEnabled: boolean | null;
      batchInferenceEnabled: boolean | null;
      batchId: string | null;
      selectedSlotId: string | null;
      error: string | null;
      createdAt: Date;
      updatedAt: Date;
      batch: {
        id: string;
        model: string;
        webSearchEnabled: boolean;
        batchInferenceEnabled: boolean;
        status: string;
        error: string | null;
        createdAt: Date;
        updatedAt: Date;
        slots: Array<{
          id: string;
          providerKey: string;
          providerLabel: string;
          status: string;
          references: string;
          content: string;
          error: string | null;
          createdAt: Date;
          updatedAt: Date;
        }>;
      } | null;
    }>;
  }) {
    return {
      id: conversation.id,
      title: conversation.title,
      status: conversation.status,
      selectedMessageId: conversation.selectedMessageId,
      selectedSlotId: conversation.selectedSlotId,
      lastMessagePreview: conversation.lastMessagePreview,
      createdBy: conversation.createdBy,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      messages: conversation.messages.map((message) => ({
        id: message.id,
        conversationId: message.conversationId,
        role: message.role,
        content: message.content,
        status: message.status,
        model: message.model,
        webSearchEnabled: message.webSearchEnabled,
        batchInferenceEnabled: message.batchInferenceEnabled,
        batchId: message.batchId,
        selectedSlotId: message.selectedSlotId,
        error: message.error,
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
        batch: message.batch
          ? {
              id: message.batch.id,
              model: message.batch.model,
              webSearchEnabled: message.batch.webSearchEnabled,
              batchInferenceEnabled: message.batch.batchInferenceEnabled,
              status: message.batch.status,
              error: message.batch.error,
              createdAt: message.batch.createdAt,
              updatedAt: message.batch.updatedAt,
              slots: message.batch.slots.map((slot) => ({
                id: slot.id,
                providerKey: slot.providerKey,
                providerLabel: slot.providerLabel,
                status: slot.status,
                references: this.parseReferences(slot.references),
                content: slot.content,
                error: slot.error,
                createdAt: slot.createdAt,
                updatedAt: slot.updatedAt,
              })),
            }
          : null,
      })),
    };
  }

  private parseReferences(value: string): RwkvSearchReference[] {
    try {
      const references = JSON.parse(value) as RwkvSearchReference[];
      if (!Array.isArray(references)) {
        return [];
      }
      return references.filter((reference) => reference && typeof reference.url === 'string');
    } catch {
      return [];
    }
  }

  private chooseStoredSlot(slots: RwkvBatchSlot[]): RwkvBatchSlot | undefined {
    return (
      slots.find((slot) => slot.status === 'done' && slot.content?.trim()) ||
      slots.find((slot) => slot.content?.trim()) ||
      slots[0]
    );
  }

  private isTerminalSlot(slot: RwkvBatchSlot) {
    return slot.status === 'done' || slot.status === 'error' || slot.status === 'skipped';
  }

  private objectValue(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return value as Record<string, unknown>;
  }

  private normalizeConversationTitle(value: string) {
    const title = value.replace(/\s+/g, ' ').trim();
    if (!title) {
      return 'New conversation';
    }
    return title.length > 48 ? `${title.slice(0, 48)}...` : title;
  }

  private preview(value: string) {
    const text = value.replace(/\s+/g, ' ').trim();
    if (!text) {
      return undefined;
    }
    return text.length > 120 ? `${text.slice(0, 120)}...` : text;
  }

  private async runConcurrent<T>(
    items: T[],
    limit: number,
    worker: (item: T) => Promise<void>,
  ): Promise<void> {
    const concurrency = Math.max(1, Math.min(limit, items.length || 1));
    let nextIndex = 0;

    const runners = Array.from({ length: concurrency }, async () => {
      while (nextIndex < items.length) {
        const item = items[nextIndex];
        nextIndex += 1;
        await worker(item);
      }
    });

    await Promise.all(runners);
  }

  private readNumberEnv(key: string, fallback: number) {
    const value = Number(process.env[key]);
    if (Number.isFinite(value) && value > 0) {
      return value;
    }
    return fallback;
  }

  private readIntegerEnv(key: string, fallback: number) {
    return Math.max(1, Math.floor(this.readNumberEnv(key, fallback)));
  }

  private createId(prefix: string) {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  private normalizeError(error: unknown) {
    if (error instanceof Error) {
      return this.sanitizeError(error.message);
    }
    return this.sanitizeError(String(error));
  }

  private sanitizeError(value: string) {
    return value
      .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
      .replace(
        /(password|api[_-]?key|authorization|token|secret)["']?\s*[:=]\s*["']?[^"',}\s]+/gi,
        '$1: [redacted]',
      )
      .replace(/TC3-HMAC-SHA256\s+Credential=[^,\s]+/gi, 'TC3-HMAC-SHA256 Credential=[redacted]')
      .slice(0, 600);
  }
}
