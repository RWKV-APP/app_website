import { createHash, createHmac } from 'crypto';

export type RwkvSearchProviderKey =
  | 'rwkv_app_search'
  | 'rwkv_app_deep_search'
  | 'qwen'
  | 'kimi'
  | 'zhipu'
  | 'stepfun'
  | 'qianfan'
  | 'tencent_wsa'
  | 'ark_doubao'
  | 'deepseek_search';

export interface RwkvSearchReference {
  title: string;
  url: string;
  summary: string;
  source?: string;
}

export interface RwkvSearchResult {
  references: RwkvSearchReference[];
}

export interface RwkvSearchOptions {
  query: string;
  signal: AbortSignal;
  timeoutMs: number;
}

export interface RwkvSearchProvider {
  key: RwkvSearchProviderKey;
  label: string;
  isConfigured: () => boolean;
  missingReason: string;
  search: (options: RwkvSearchOptions) => Promise<RwkvSearchResult>;
}

const MAX_REFERENCE_COUNT = 8;
const DEFAULT_TOP_N = 3;

interface FetchJsonResult {
  response: Response;
  text: string;
  payload: unknown;
}

export function getRwkvSearchProviders(): RwkvSearchProvider[] {
  return [
    {
      key: 'rwkv_app_search',
      label: 'RWKV App Search',
      isConfigured: () =>
        Boolean(readEnv('RWKV_APP_WEB_SEARCH_TOKEN', 'RWKV_APP_INTERNET_SEARCH_TOKEN')),
      missingReason: 'RWKV App web search token is not configured.',
      search: (options) => searchRwkvApp(options, false),
    },
    {
      key: 'rwkv_app_deep_search',
      label: 'RWKV App Deep Search',
      isConfigured: () =>
        Boolean(readEnv('RWKV_APP_WEB_SEARCH_TOKEN', 'RWKV_APP_INTERNET_SEARCH_TOKEN')),
      missingReason: 'RWKV App web search token is not configured.',
      search: (options) => searchRwkvApp(options, true),
    },
    {
      key: 'qwen',
      label: 'DashScope Qwen',
      isConfigured: () =>
        Boolean(
          readEnv(
            'GEO_PRESALES_QWEN_API_KEY',
            'DASHSCOPE_API_KEY',
            'DASHSCOPE_API_KEY_ID',
            'ALIBABA_CLOUD_API_KEY',
            'GEO_PRESALES_PLATFORM_QWEN_API_KEY',
          ),
        ),
      missingReason: 'DashScope Qwen API key is not configured.',
      search: searchQwen,
    },
    {
      key: 'kimi',
      label: 'Kimi Web Search',
      isConfigured: () =>
        Boolean(
          readEnv(
            'GEO_PRESALES_KIMI_API_KEY',
            'MOONSHOT_API_KEY',
            'KIMI_API_KEY',
            'GEO_PRESALES_PLATFORM_KIMI_API_KEY',
          ),
        ),
      missingReason: 'Kimi API key is not configured.',
      search: searchKimi,
    },
    {
      key: 'zhipu',
      label: 'Zhipu Web Search',
      isConfigured: () =>
        Boolean(
          readEnv(
            'GEO_PRESALES_ZHIPU_API_KEY',
            'ZHIPU_API_KEY',
            'BIGMODEL_API_KEY',
            'GEO_PRESALES_PLATFORM_ZHIPU_API_KEY',
          ),
        ),
      missingReason: 'Zhipu API key is not configured.',
      search: searchZhipu,
    },
    {
      key: 'stepfun',
      label: 'StepFun Search',
      isConfigured: () =>
        Boolean(
          readEnv(
            'GEO_PRESALES_STEPFUN_API_KEY',
            'STEPFUN_API_KEY',
            'STEP_API_KEY',
            'GEO_PRESALES_PLATFORM_STEPFUN_API_KEY',
          ),
        ),
      missingReason: 'StepFun API key is not configured.',
      search: searchStepFun,
    },
    {
      key: 'qianfan',
      label: 'Qianfan Web Search',
      isConfigured: () =>
        Boolean(
          readEnv(
            'GEO_PRESALES_QIANFAN_API_KEY',
            'QIANFAN_API_KEY',
            'BAIDU_QIANFAN_API_KEY',
            'GEO_PRESALES_PLATFORM_WENXIN_API_KEY',
          ),
        ),
      missingReason: 'Baidu Qianfan API key is not configured.',
      search: searchQianfan,
    },
    {
      key: 'tencent_wsa',
      label: 'Tencent WSA',
      isConfigured: () =>
        Boolean(
          readEnv('GEO_PRESALES_TENCENT_WSA_API_KEY', 'TENCENTCLOUD_WSA_APIKEY') ||
          (readEnv('GEO_PRESALES_TENCENT_WSA_SECRET_ID', 'TENCENTCLOUD_SECRET_ID') &&
            readEnv('GEO_PRESALES_TENCENT_WSA_SECRET_KEY', 'TENCENTCLOUD_SECRET_KEY')),
        ),
      missingReason: 'Tencent WSA credentials are not configured.',
      search: searchTencentWsa,
    },
    {
      key: 'ark_doubao',
      label: 'Ark Doubao Search',
      isConfigured: () => Boolean(readEnv('GEO_PRESALES_ARK_API_KEY', 'ARK_API_KEY')),
      missingReason: 'Volcengine Ark API key is not configured.',
      search: searchArkDoubao,
    },
    {
      key: 'deepseek_search',
      label: 'DeepSeek Search',
      isConfigured: () => Boolean(readEnv('GEO_PRESALES_DEEPSEEK_API_KEY', 'DEEPSEEK_API_KEY')),
      missingReason: 'DeepSeek API key is not configured.',
      search: searchDeepSeek,
    },
  ];
}

function readEnv(...keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key];
    if (value && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function readNumberEnv(key: string, fallback: number): number {
  const value = Number(process.env[key]);
  if (Number.isFinite(value) && value > 0) {
    return value;
  }
  return fallback;
}

function readOptionalNumberEnv(key: string): number | undefined {
  const value = Number(process.env[key]);
  if (Number.isFinite(value) && value > 0) {
    return value;
  }
  return undefined;
}

function trimSlashes(value: string): string {
  return value.replace(/\/+$/, '');
}

function buildIsolatedQuery(query: string): string {
  return query.replace(/\s+/g, ' ').trim();
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function pickPath(value: unknown, path: Array<string | number>): unknown {
  let current = value;
  for (const key of path) {
    if (!current || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string | number, unknown>)[key];
  }
  return current;
}

async function fetchJson(
  url: string,
  request: RequestInit,
  options: RwkvSearchOptions,
): Promise<FetchJsonResult> {
  const controller = new AbortController();
  const abortWithParent = () => controller.abort(options.signal.reason);
  if (options.signal.aborted) {
    controller.abort(options.signal.reason);
  } else {
    options.signal.addEventListener('abort', abortWithParent, { once: true });
  }

  const timer = setTimeout(
    () => controller.abort(new Error('Search provider timeout.')),
    options.timeoutMs,
  );

  try {
    const response = await fetch(url, {
      ...request,
      signal: controller.signal,
    });
    const text = await response.text();
    return {
      response,
      text,
      payload: safeJson(text),
    };
  } finally {
    clearTimeout(timer);
    options.signal.removeEventListener('abort', abortWithParent);
  }
}

async function searchRwkvApp(
  options: RwkvSearchOptions,
  deepSearch: boolean,
): Promise<RwkvSearchResult> {
  const token = readEnv('RWKV_APP_WEB_SEARCH_TOKEN', 'RWKV_APP_INTERNET_SEARCH_TOKEN');
  const baseUrl =
    readEnv('RWKV_APP_WEB_SEARCH_URL') || 'https://auth.rwkvos.com/api/internet_search';
  const topN = readNumberEnv('RWKV_APP_WEB_SEARCH_TOP_N', DEFAULT_TOP_N);
  const result = await fetchJson(
    baseUrl,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json; charset=utf-8',
        'Content-Type': 'application/json; charset=utf-8',
        Token: token,
      },
      body: JSON.stringify({
        query: buildIsolatedQuery(options.query),
        top_n: topN,
        is_deepsearch: deepSearch,
      }),
    },
    options,
  );
  assertOk(result, 'RWKV App web search');
  return {
    references: extractRwkvAppReferences(
      result.payload,
      deepSearch ? 'RWKV App Deep Search' : 'RWKV App Search',
    ),
  };
}

async function searchQwen(options: RwkvSearchOptions): Promise<RwkvSearchResult> {
  const apiKey = readEnv(
    'GEO_PRESALES_QWEN_API_KEY',
    'DASHSCOPE_API_KEY',
    'DASHSCOPE_API_KEY_ID',
    'ALIBABA_CLOUD_API_KEY',
    'GEO_PRESALES_PLATFORM_QWEN_API_KEY',
  );
  const baseUrl = trimSlashes(
    readEnv('GEO_PRESALES_QWEN_BASE_URL', 'DASHSCOPE_API_BASE_URL') ||
      'https://dashscope.aliyuncs.com',
  );
  const model =
    readEnv('GEO_PRESALES_QWEN_MODEL', 'GEO_PRESALES_PLATFORM_QWEN_MODEL') || 'qwen-plus';
  const result = await fetchJson(
    `${baseUrl}/api/v1/services/aigc/text-generation/generation`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: {
          messages: [{ role: 'user', content: buildIsolatedQuery(options.query) }],
        },
        parameters: {
          enable_search: true,
          search_options: {
            forced_search: true,
            enable_source: true,
            enable_citation: true,
            citation_format: '[ref_<number>]',
            search_strategy: 'max',
          },
          result_format: 'message',
          temperature: 0.7,
        },
      }),
    },
    options,
  );
  assertOk(result, 'DashScope Qwen web search');
  return { references: extractReferences(result.payload, 'DashScope Qwen') };
}

async function searchKimi(options: RwkvSearchOptions): Promise<RwkvSearchResult> {
  const apiKey = readEnv(
    'GEO_PRESALES_KIMI_API_KEY',
    'MOONSHOT_API_KEY',
    'KIMI_API_KEY',
    'GEO_PRESALES_PLATFORM_KIMI_API_KEY',
  );
  const baseUrl = trimSlashes(
    readEnv('GEO_PRESALES_KIMI_BASE_URL', 'MOONSHOT_API_BASE_URL', 'KIMI_API_BASE_URL') ||
      'https://api.moonshot.cn/v1',
  );
  const model =
    readEnv('GEO_PRESALES_KIMI_MODEL', 'GEO_PRESALES_PLATFORM_KIMI_MODEL') ||
    'kimi-k2-0905-preview';
  const messages: Array<Record<string, unknown>> = [
    {
      role: 'system',
      content: 'Use web search and return useful source links for the user question.',
    },
    { role: 'user', content: buildIsolatedQuery(options.query) },
  ];
  const tools: Array<Record<string, unknown>> = [
    {
      type: 'builtin_function',
      function: { name: '$web_search' },
    },
  ];
  const result = await fetchJson(
    `${baseUrl}/chat/completions`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        max_tokens: 800,
        thinking: { type: 'disabled' },
        tools,
      }),
    },
    options,
  );
  assertOk(result, 'Kimi web search');
  const initialReferences = extractReferences(result.payload, 'Kimi');
  const finishReason = pickPath(result.payload, ['choices', 0, 'finish_reason']);
  const toolCalls = pickPath(result.payload, ['choices', 0, 'message', 'tool_calls']);
  if (initialReferences.length || finishReason !== 'tool_calls' || !Array.isArray(toolCalls)) {
    return { references: initialReferences };
  }

  const assistantMessage = normalizeKimiAssistantMessage(
    pickPath(result.payload, ['choices', 0, 'message']),
  );
  messages.push(assistantMessage);
  for (const toolCall of toolCalls) {
    const toolMessage = buildKimiToolMessage(toolCall);
    if (toolMessage) {
      messages.push(toolMessage);
    }
  }

  const secondResult = await fetchJson(
    `${baseUrl}/chat/completions`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        max_tokens: 800,
        thinking: { type: 'disabled' },
        tools,
      }),
    },
    options,
  );
  assertOk(secondResult, 'Kimi web search');
  return {
    references: dedupeReferences([
      ...initialReferences,
      ...extractReferences(secondResult.payload, 'Kimi'),
    ]),
  };
}

async function searchZhipu(options: RwkvSearchOptions): Promise<RwkvSearchResult> {
  const apiKey = readEnv(
    'GEO_PRESALES_ZHIPU_API_KEY',
    'ZHIPU_API_KEY',
    'BIGMODEL_API_KEY',
    'GEO_PRESALES_PLATFORM_ZHIPU_API_KEY',
  );
  const baseUrl = trimSlashes(
    readEnv('GEO_PRESALES_ZHIPU_BASE_URL', 'ZHIPU_API_BASE_URL', 'BIGMODEL_API_BASE_URL') ||
      'https://open.bigmodel.cn/api/paas/v4',
  );
  const model =
    readEnv('GEO_PRESALES_ZHIPU_MODEL', 'GEO_PRESALES_PLATFORM_ZHIPU_MODEL') || 'glm-4.5';
  const count = readNumberEnv('GEO_PRESALES_ZHIPU_WEB_SEARCH_COUNT', 10);
  const result = await fetchJson(
    `${baseUrl}/chat/completions`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: 'Search the web and expose source results for the user question.',
          },
          { role: 'user', content: buildIsolatedQuery(options.query) },
        ],
        tools: [
          {
            type: 'web_search',
            web_search: {
              enable: true,
              search_engine: readEnv('GEO_PRESALES_ZHIPU_WEB_SEARCH_ENGINE') || 'search_pro',
              search_result: true,
              count,
              search_recency_filter: readEnv('GEO_PRESALES_ZHIPU_WEB_SEARCH_RECENCY') || 'noLimit',
              content_size: readEnv('GEO_PRESALES_ZHIPU_WEB_SEARCH_CONTENT_SIZE') || 'medium',
            },
          },
        ],
        tool_choice: 'auto',
        temperature: 0.7,
        stream: false,
      }),
    },
    options,
  );
  assertOk(result, 'Zhipu web search');
  return { references: extractReferences(result.payload, 'Zhipu') };
}

async function searchStepFun(options: RwkvSearchOptions): Promise<RwkvSearchResult> {
  const apiKey = readEnv(
    'GEO_PRESALES_STEPFUN_API_KEY',
    'STEPFUN_API_KEY',
    'STEP_API_KEY',
    'GEO_PRESALES_PLATFORM_STEPFUN_API_KEY',
  );
  const baseUrl = trimSlashes(
    readEnv('GEO_PRESALES_STEPFUN_BASE_URL', 'STEPFUN_API_BASE_URL', 'STEP_API_BASE_URL') ||
      'https://api.stepfun.com/v1',
  );
  const body: Record<string, unknown> = {
    query: buildIsolatedQuery(options.query),
    n: readNumberEnv('GEO_PRESALES_STEPFUN_SEARCH_COUNT', 10),
  };
  const category = readEnv('GEO_PRESALES_STEPFUN_SEARCH_CATEGORY');
  if (category) {
    body.category = category;
  }
  const result = await fetchJson(
    `${baseUrl}/search`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
    options,
  );
  assertOk(result, 'StepFun search');
  return { references: extractReferences(result.payload, 'StepFun') };
}

async function searchQianfan(options: RwkvSearchOptions): Promise<RwkvSearchResult> {
  const apiKey = readEnv(
    'GEO_PRESALES_QIANFAN_API_KEY',
    'QIANFAN_API_KEY',
    'BAIDU_QIANFAN_API_KEY',
    'GEO_PRESALES_PLATFORM_WENXIN_API_KEY',
  );
  const baseUrl = trimSlashes(
    readEnv('GEO_PRESALES_QIANFAN_BASE_URL', 'QIANFAN_API_BASE_URL') ||
      'https://qianfan.baidubce.com',
  );
  const topK = readNumberEnv('GEO_PRESALES_QIANFAN_WEB_SEARCH_TOP_K', 10);
  const configuredRecency = readEnv('GEO_PRESALES_QIANFAN_WEB_SEARCH_RECENCY') || 'noLimit';
  const result = await fetchQianfanSearch(options, baseUrl, apiKey, topK, configuredRecency);
  assertOk(result, 'Qianfan web search');
  const references = extractReferences(result.payload, 'Qianfan');
  if (references.length || configuredRecency === 'noLimit') {
    return { references };
  }

  const retryResult = await fetchQianfanSearch(options, baseUrl, apiKey, topK, 'noLimit');
  assertOk(retryResult, 'Qianfan web search');
  return { references: extractReferences(retryResult.payload, 'Qianfan') };
}

function normalizeKimiAssistantMessage(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    return { role: 'assistant', content: '' };
  }
  const message: Record<string, unknown> = {
    ...(value as Record<string, unknown>),
    role: 'assistant',
  };
  if (!('content' in message)) {
    message.content = '';
  }
  return message;
}

function buildKimiToolMessage(toolCall: unknown): Record<string, unknown> | null {
  if (!toolCall || typeof toolCall !== 'object') {
    return null;
  }
  const id = String((toolCall as Record<string, unknown>).id || '');
  const name = String(pickPath(toolCall, ['function', 'name']) || '$web_search');
  const rawArguments = pickPath(toolCall, ['function', 'arguments']);
  const argumentsValue =
    typeof rawArguments === 'string'
      ? (safeJson(rawArguments) ?? rawArguments)
      : (rawArguments ?? {});
  return {
    role: 'tool',
    tool_call_id: id,
    name,
    content: JSON.stringify(argumentsValue),
  };
}

async function fetchQianfanSearch(
  options: RwkvSearchOptions,
  baseUrl: string,
  apiKey: string,
  topK: number,
  recency: string,
): Promise<FetchJsonResult> {
  return fetchJson(
    `${baseUrl}/v2/ai_search/web_search`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: buildIsolatedQuery(options.query) }],
        search_source: 'baidu_search_v2',
        resource_type_filter: [{ type: 'web', top_k: topK }],
        search_recency_filter: recency,
        sort: { priority: 'auto' },
      }),
    },
    options,
  );
}

async function searchTencentWsa(options: RwkvSearchOptions): Promise<RwkvSearchResult> {
  const query = buildIsolatedQuery(options.query);
  const body: Record<string, unknown> = {
    Query: query,
    Mode: readNumberEnv('GEO_PRESALES_TENCENT_WSA_MODE', 0),
  };
  const count = readOptionalNumberEnv('GEO_PRESALES_TENCENT_WSA_COUNT');
  if (count) {
    body.Cnt = count;
  }
  const industry = readEnv('GEO_PRESALES_TENCENT_WSA_INDUSTRY');
  if (industry) {
    body.Industry = industry;
  }

  const apiKey = readEnv('GEO_PRESALES_TENCENT_WSA_API_KEY', 'TENCENTCLOUD_WSA_APIKEY');
  if (apiKey) {
    const baseUrl = trimSlashes(
      readEnv('GEO_PRESALES_TENCENT_WSA_API_KEY_BASE_URL') || 'https://wsa.tencentcloudapi.com',
    );
    const result = await fetchJson(
      `${baseUrl}/SearchPro`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify(body),
      },
      options,
    );
    assertOk(result, 'Tencent WSA search');
    return { references: extractReferences(result.payload, 'Tencent WSA') };
  }

  const result = await fetchTencentWsaSigned(body, options);
  assertOk(result, 'Tencent WSA signed search');
  return { references: extractReferences(result.payload, 'Tencent WSA') };
}

async function searchArkDoubao(options: RwkvSearchOptions): Promise<RwkvSearchResult> {
  const apiKey = readEnv('GEO_PRESALES_ARK_API_KEY', 'ARK_API_KEY');
  const baseUrl = trimSlashes(
    readEnv('GEO_PRESALES_ARK_BASE_URL') || 'https://ark.cn-beijing.volces.com/api/v3',
  );
  const model =
    readEnv('GEO_PRESALES_ARK_MODEL', 'GEO_PRESALES_PLATFORM_ARK_MODEL') ||
    'doubao-seed-1-6-251015';
  const result = await fetchJson(
    `${baseUrl}/responses`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: 'system',
            content: [
              { type: 'input_text', text: 'Use web search and return traceable source results.' },
            ],
          },
          {
            role: 'user',
            content: [{ type: 'input_text', text: buildIsolatedQuery(options.query) }],
          },
        ],
        thinking: { type: 'disabled' },
        temperature: 0.35,
        top_p: 0.9,
        max_output_tokens: 800,
        tools: [
          {
            type: 'web_search',
            max_keyword: readNumberEnv('GEO_PRESALES_ARK_WEB_SEARCH_MAX_KEYWORD', 3),
          },
        ],
      }),
    },
    options,
  );
  assertOk(result, 'Ark Doubao web search');
  return { references: extractReferences(result.payload, 'Ark Doubao') };
}

async function searchDeepSeek(options: RwkvSearchOptions): Promise<RwkvSearchResult> {
  const apiKey = readEnv('GEO_PRESALES_DEEPSEEK_API_KEY', 'DEEPSEEK_API_KEY');
  const baseUrl = trimSlashes(
    readEnv('GEO_PRESALES_DEEPSEEK_ANTHROPIC_BASE_URL', 'DEEPSEEK_ANTHROPIC_API_BASE_URL') ||
      `${trimSlashes(
        readEnv('GEO_PRESALES_DEEPSEEK_BASE_URL', 'DEEPSEEK_API_BASE_URL') ||
          'https://api.deepseek.com',
      )}/anthropic`,
  );
  const model =
    readEnv('GEO_PRESALES_DEEPSEEK_MODEL', 'GEO_PRESALES_PLATFORM_DEEPSEEK_MODEL') ||
    'deepseek-chat';
  const result = await fetchJson(
    `${baseUrl}/v1/messages`,
    {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 800,
        temperature: 0.35,
        top_p: 0.9,
        system: 'Use web search and return traceable source results.',
        messages: [{ role: 'user', content: buildIsolatedQuery(options.query) }],
        tools: [
          {
            type: 'web_search_20250305',
            name: 'web_search',
            max_uses: readNumberEnv('GEO_PRESALES_DEEPSEEK_WEB_SEARCH_MAX_USES', 5),
          },
        ],
      }),
    },
    options,
  );
  assertOk(result, 'DeepSeek web search');
  return { references: extractReferences(result.payload, 'DeepSeek') };
}

async function fetchTencentWsaSigned(
  requestBody: Record<string, unknown>,
  options: RwkvSearchOptions,
): Promise<FetchJsonResult> {
  const endpoint = new URL(
    readEnv('GEO_PRESALES_TENCENT_WSA_SIGNED_ENDPOINT') || 'https://wsa.tencentcloudapi.com',
  );
  const secretId = readEnv('GEO_PRESALES_TENCENT_WSA_SECRET_ID', 'TENCENTCLOUD_SECRET_ID');
  const secretKey = readEnv('GEO_PRESALES_TENCENT_WSA_SECRET_KEY', 'TENCENTCLOUD_SECRET_KEY');
  const token = readEnv('GEO_PRESALES_TENCENT_WSA_TOKEN', 'TENCENTCLOUD_TOKEN');
  const payload = JSON.stringify(requestBody);
  const timestamp = Math.floor(Date.now() / 1000);
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
  const canonicalHeaders =
    `content-type:application/json; charset=utf-8\n` +
    `host:${endpoint.host}\n` +
    `x-tc-action:searchpro\n`;
  const signedHeaders = 'content-type;host;x-tc-action';
  const hashedRequestPayload = createHash('sha256').update(payload).digest('hex');
  const canonicalRequest = [
    'POST',
    '/',
    '',
    canonicalHeaders,
    signedHeaders,
    hashedRequestPayload,
  ].join('\n');
  const credentialScope = `${date}/wsa/tc3_request`;
  const hashedCanonicalRequest = createHash('sha256').update(canonicalRequest).digest('hex');
  const stringToSign = [
    'TC3-HMAC-SHA256',
    String(timestamp),
    credentialScope,
    hashedCanonicalRequest,
  ].join('\n');
  const secretDate = createHmac('sha256', `TC3${secretKey}`).update(date).digest();
  const secretService = createHmac('sha256', secretDate).update('wsa').digest();
  const secretSigning = createHmac('sha256', secretService).update('tc3_request').digest();
  const signature = createHmac('sha256', secretSigning).update(stringToSign).digest('hex');
  const headers: Record<string, string> = {
    Authorization:
      `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`,
    'Content-Type': 'application/json; charset=utf-8',
    'X-TC-Action': 'SearchPro',
    'X-TC-Version': '2025-05-08',
    'X-TC-Timestamp': String(timestamp),
  };
  if (token) {
    headers['X-TC-Token'] = token;
  }
  return fetchJson(
    endpoint.toString(),
    {
      method: 'POST',
      headers,
      body: payload,
    },
    options,
  );
}

function assertOk(result: FetchJsonResult, provider: string) {
  if (result.response.ok) {
    return;
  }
  const message = extractErrorMessage(result.payload, result.text);
  throw new Error(`${provider} returned ${result.response.status}: ${message}`);
}

function extractErrorMessage(payload: unknown, fallback: string): string {
  const found = firstDeepString(payload, ['message', 'error', 'msg', 'errmsg', 'description']);
  return sanitizeProviderText((found || fallback || '').slice(0, 300));
}

function extractReferences(payload: unknown, source: string): RwkvSearchReference[] {
  const references: RwkvSearchReference[] = [];
  const visited = new Set<unknown>();

  const visit = (value: unknown) => {
    if (references.length >= MAX_REFERENCE_COUNT || value === null || value === undefined) {
      return;
    }
    if (typeof value === 'string') {
      collectReferenceFromString(value, source, references);
      return;
    }
    if (typeof value !== 'object') {
      return;
    }
    if (visited.has(value)) {
      return;
    }
    visited.add(value);

    if (Array.isArray(value)) {
      for (const item of value) {
        visit(item);
      }
      return;
    }

    const object = value as Record<string, unknown>;
    collectReferenceFromObject(object, source, references);
    for (const item of Object.values(object)) {
      visit(item);
    }
  };

  visit(payload);
  return dedupeReferences(references).slice(0, MAX_REFERENCE_COUNT);
}

function extractRwkvAppReferences(payload: unknown, source: string): RwkvSearchReference[] {
  const object = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  const data = object.data;
  if (!Array.isArray(data)) {
    return extractReferences(payload, source);
  }

  const references = data.map((item) => {
    const reference = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
    return {
      title: firstString(reference, ['title', 'name', 'url']),
      url: normalizeUrl(firstString(reference, ['url', 'link', 'href'])),
      summary: firstString(reference, ['summary', 'snippet', 'content', 'description']),
      source,
    };
  });

  return dedupeReferences(references).slice(0, MAX_REFERENCE_COUNT);
}

function collectReferenceFromString(
  value: string,
  source: string,
  references: RwkvSearchReference[],
) {
  const urls = value.match(/https?:\/\/[^\s"'<>）)]+/gi) || [];
  for (const rawUrl of urls) {
    references.push({
      title: '',
      url: normalizeUrl(rawUrl),
      summary: '',
      source,
    });
  }
}

function collectReferenceFromObject(
  object: Record<string, unknown>,
  source: string,
  references: RwkvSearchReference[],
) {
  const url =
    firstString(object, [
      'url',
      'link',
      'href',
      'source_url',
      'sourceUrl',
      'page_url',
      'pageUrl',
      'site_url',
      'website',
    ]) || findFirstUrlInObject(object);
  if (!url) {
    return;
  }

  references.push({
    title:
      firstString(object, [
        'title',
        'name',
        'site_name',
        'siteName',
        'source',
        'source_name',
        'page_title',
        'pageTitle',
      ]) || '',
    url: normalizeUrl(url),
    summary:
      firstString(object, [
        'summary',
        'snippet',
        'content',
        'description',
        'text',
        'passage',
        'page_content',
        'pageContent',
        'abstract',
      ]) || '',
    source,
  });
}

function firstString(object: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = object[key];
    if (typeof value === 'string' && value.trim()) {
      return sanitizeProviderText(value);
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }
  return '';
}

function firstDeepString(value: unknown, keys: string[]): string {
  const visited = new Set<unknown>();

  const visit = (item: unknown): string => {
    if (!item || typeof item !== 'object' || visited.has(item)) {
      return '';
    }
    visited.add(item);
    if (Array.isArray(item)) {
      for (const child of item) {
        const found = visit(child);
        if (found) {
          return found;
        }
      }
      return '';
    }
    const object = item as Record<string, unknown>;
    const direct = firstString(object, keys);
    if (direct) {
      return direct;
    }
    for (const child of Object.values(object)) {
      const found = visit(child);
      if (found) {
        return found;
      }
    }
    return '';
  };

  return visit(value);
}

function findFirstUrlInObject(object: Record<string, unknown>): string {
  for (const value of Object.values(object)) {
    if (typeof value !== 'string') {
      continue;
    }
    const match = value.match(/https?:\/\/[^\s"'<>）)]+/i);
    if (match) {
      return match[0];
    }
  }
  return '';
}

function normalizeUrl(value: string): string {
  return value.trim().replace(/[.,;，。；]+$/, '');
}

function sanitizeProviderText(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, 1200);
}

function dedupeReferences(references: RwkvSearchReference[]): RwkvSearchReference[] {
  const seen = new Set<string>();
  const items: RwkvSearchReference[] = [];
  for (const reference of references) {
    if (!reference.url || !/^https?:\/\//i.test(reference.url)) {
      continue;
    }
    const url = reference.url;
    if (seen.has(url)) {
      continue;
    }
    seen.add(url);
    items.push({
      title: reference.title || domainFromUrl(url) || url,
      url,
      summary: reference.summary,
      source: reference.source,
    });
  }
  return items;
}

function domainFromUrl(value: string): string {
  try {
    return new URL(value).hostname;
  } catch {
    return '';
  }
}
