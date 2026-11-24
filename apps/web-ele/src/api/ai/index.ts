import { requestClient } from '#/api/request';

export interface AiModelConfig {
  id?: string;
  code: string;
  name: string;
  provider?: string;
  modelName: string;
  baseUrl?: string;
  apiKeyCipher?: string;
  paramsJson?: string;
  endpointPath?: string;
  timeoutMs?: number;
  vectorDimensions?: number;
  enabled?: number;
  isDefault?: number;
}

export interface McpToolInfo {
  name: string;
  qualifiedName: string;
  title?: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface AiMcpServer {
  id?: string;
  code: string;
  name: string;
  transport?: string;
  commandLine?: string;
  argsJson?: string;
  url?: string;
  headersJson?: string;
  timeoutMs?: number;
  enabled?: number;
}

export interface AiSkill {
  id?: string;
  code: string;
  name: string;
  description?: string;
  contentMd?: string;
  scope?: string;
  version?: string;
  enabled?: number;
}

export interface AiPrompt {
  id?: string;
  code: string;
  title: string;
  content?: string;
  variablesJson?: string;
  version: string;
  status?: string;
}

export interface AiExpert {
  id?: string;
  code: string;
  name: string;
  avatar?: string;
  description?: string;
  modelCode: string;
  promptCode?: string;
  promptVersion?: string;
  skillCodesJson?: string;
  mcpCodesJson?: string;
  kbCodesJson?: string;
  maxIters?: number;
  enabled?: number;
  createTime?: string;
  updateTime?: string;
}

export interface ExpertValidationResult {
  valid: boolean;
  modelName?: string;
  skillCount: number;
  mcpCount: number;
  knowledgeBaseCount: number;
  errors: string[];
  warnings: string[];
}

export interface ExpertFormOption {
  value: string;
  label: string;
  disabled: boolean;
  description?: string;
}

export interface ExpertFormOptions {
  models: ExpertFormOption[];
  prompts: ExpertFormOption[];
  skills: ExpertFormOption[];
  mcpServers: ExpertFormOption[];
  knowledgeBases: ExpertFormOption[];
}

export interface AiConversation {
  id: string;
  userId?: string;
  expertCode: string;
  title?: string;
  updatedAt?: string;
}

export interface AiMessage {
  id: string;
  conversationId: string;
  role: string;
  runId?: string;
  contentJson: string;
  createdAt?: string;
}

export interface AiAgentTrace {
  id: string;
  runId: string;
  conversationId: string;
  userId?: string;
  expertCode?: string;
  agentName?: string;
  modelName?: string;
  status: string;
  startedAt?: string;
  endedAt?: string;
  durationMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  inputJson?: string;
  outputJson?: string;
  errorMessage?: string;
}

export interface AiAgentTraceSpan {
  id: string;
  traceId: string;
  spanType: 'MODEL' | 'TOOL';
  name?: string;
  externalId?: string;
  status: string;
  startedAt?: string;
  endedAt?: string;
  durationMs?: number;
  inputJson?: string;
  outputJson?: string;
  tokenUsageJson?: string;
  errorMessage?: string;
}

export interface AiAgentTraceDetail {
  trace: AiAgentTrace;
  spans: AiAgentTraceSpan[];
}

export interface AiTraceQuery {
  pageNum?: number;
  pageSize?: number;
  keyword?: string;
  status?: string;
  expertCode?: string;
  startTime?: string;
  endTime?: string;
}

export interface AiTracePage {
  list: AiAgentTrace[];
  total: number;
}

export interface AiTraceSummary {
  total: number;
  running: number;
  success: number;
  error: number;
  cancelled: number;
  totalTokens: number;
  avgDurationMs: number;
}

export interface AiAgentState {
  persisted: boolean;
  contextSize: number;
}

function crud<T>(base: string) {
  return {
    list: () => requestClient.post<T[]>(`${base}/list`, {}),
    add: (entity: T) => requestClient.post<T>(`${base}/add`, entity),
    update: (entity: T) => requestClient.post<T>(`${base}/update`, entity),
    remove: (id: string) => requestClient.post<void>(`${base}/delete`, { id }),
    toggle: (id: string, enabled: number) =>
      requestClient.post<void>(`${base}/toggle`, { id, enabled }),
  };
}

export const aiModelApi = {
  ...crud<AiModelConfig>('/ai/model'),
  options: () => requestClient.post<AiModelConfig[]>('/ai/model/options', {}),
  copy: (id: string) =>
    requestClient.post<AiModelConfig>('/ai/model/copy', { id }),
  test: (id: string) => requestClient.post<string>('/ai/model/test', { id }),
};

export const aiMcpApi = {
  ...crud<AiMcpServer>('/ai/mcp'),
  tools: (code: string) =>
    requestClient.post<McpToolInfo[]>('/ai/mcp/tools', { code }),
  reload: () => requestClient.post<void>('/ai/mcp/reload', {}),
};

export const aiSkillApi = crud<AiSkill>('/ai/skill');

export const aiPromptApi = {
  ...crud<AiPrompt>('/ai/prompt'),
  publish: (id: string) =>
    requestClient.post<AiPrompt>('/ai/prompt/publish', { id }),
};

export const aiExpertApi = {
  ...crud<AiExpert>('/ai/expert'),
  options: () => requestClient.post<AiExpert[]>('/ai/expert/options', {}),
  formOptions: () =>
    requestClient.post<ExpertFormOptions>('/ai/expert/form-options', {}),
  validate: (entity: AiExpert) =>
    requestClient.post<ExpertValidationResult>('/ai/expert/validate', entity),
  copy: (id: string) => requestClient.post<AiExpert>('/ai/expert/copy', { id }),
};

export interface AiKnowledgeBase {
  id?: string;
  code: string;
  name: string;
  description?: string;
  embeddingModelCode: string;
  chunkSize?: number;
  chunkOverlap?: number;
  topK?: number;
  scoreThreshold?: number;
  vectorDim?: number;
  enabled?: number;
}

export interface AiKnowledgeDoc {
  id?: string;
  kbCode: string;
  fileName: string;
  fileType?: string;
  fileSize?: number;
  chunkCount?: number;
  status?: string;
  errorMsg?: string;
  createTime?: string;
}

export interface AiKnowledgeHit {
  docId: string;
  fileName: string;
  content: string;
  score: number;
}

export const aiKnowledgeApi = {
  list: () => requestClient.post<AiKnowledgeBase[]>('/ai/kb/list', {}),
  add: (entity: AiKnowledgeBase) =>
    requestClient.post<AiKnowledgeBase>('/ai/kb/add', entity),
  update: (entity: AiKnowledgeBase) =>
    requestClient.post<AiKnowledgeBase>('/ai/kb/update', entity),
  remove: (code: string) => requestClient.post<void>('/ai/kb/delete', { code }),
  toggle: (code: string, enabled: number) =>
    requestClient.post<void>('/ai/kb/toggle', { code, enabled }),
  docs: (kbCode: string) =>
    requestClient.post<AiKnowledgeDoc[]>('/ai/kb/doc/list', { kbCode }),
  upload: (kbCode: string, file: File) => {
    const form = new FormData();
    form.append('kbCode', kbCode);
    form.append('file', file);
    return requestClient.post<AiKnowledgeDoc>('/ai/kb/doc/upload', form);
  },
  removeDoc: (id: string) =>
    requestClient.post<void>('/ai/kb/doc/delete', { id }),
  reindex: (code: string) =>
    requestClient.post<number>('/ai/kb/reindex', { code }),
  search: (kbCode: string, query: string, topK?: number) =>
    requestClient.post<AiKnowledgeHit[]>('/ai/kb/search', {
      kbCode,
      query,
      topK,
    }),
};

export const aiConversationApi = {
  list: () => requestClient.post<AiConversation[]>('/ai/conversation/list', {}),
  messages: (conversationId: string) =>
    requestClient.post<AiMessage[]>('/ai/conversation/messages', {
      conversationId,
    }),
  remove: (id: string) =>
    requestClient.post<void>('/ai/conversation/delete', { id }),
  state: (conversationId: string) =>
    requestClient.post<AiAgentState>('/ai/conversation/state', {
      conversationId,
    }),
};

export const aiTraceApi = {
  list: (query: AiTraceQuery = {}) =>
    requestClient.post<AiTracePage>('/ai/trace/list', query),
  summary: (query: Omit<AiTraceQuery, 'pageNum' | 'pageSize'> = {}) =>
    requestClient.post<AiTraceSummary>('/ai/trace/summary', query),
  detail: (id: string) =>
    requestClient.post<AiAgentTraceDetail>('/ai/trace/detail', { id }),
};

/** AG-UI 端点：由 @ag-ui/client 的 HttpAgent 直连，不走 requestClient。 */
export const AI_AGUI_RUN_URL = '/api/ai/agui/run';
