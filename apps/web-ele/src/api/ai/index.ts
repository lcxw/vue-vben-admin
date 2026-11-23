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
  enabled?: number;
  isDefault?: number;
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
  maxIters?: number;
  enabled?: number;
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
  contentJson: string;
  createdAt?: string;
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
  test: (id: string) => requestClient.post<string>('/ai/model/test', { id }),
};

export const aiMcpApi = {
  ...crud<AiMcpServer>('/ai/mcp'),
  tools: (code: string) =>
    requestClient.post<string[]>('/ai/mcp/tools', { code }),
  reload: () => requestClient.post<void>('/ai/mcp/reload', {}),
};

export const aiSkillApi = crud<AiSkill>('/ai/skill');

export const aiPromptApi = {
  ...crud<AiPrompt>('/ai/prompt'),
  publish: (id: string) => requestClient.post<AiPrompt>('/ai/prompt/publish', { id }),
};

export const aiExpertApi = {
  ...crud<AiExpert>('/ai/expert'),
  options: () => requestClient.post<AiExpert[]>('/ai/expert/options', {}),
};

export const aiConversationApi = {
  list: () => requestClient.post<AiConversation[]>('/ai/conversation/list', {}),
  messages: (conversationId: string) =>
    requestClient.post<AiMessage[]>('/ai/conversation/messages', { conversationId }),
  sync: (payload: {
    conversationId: string;
    expertCode: string;
    title?: string;
    messages: { role: string; content: string }[];
  }) => requestClient.post<void>('/ai/conversation/sync', payload),
  remove: (id: string) => requestClient.post<void>('/ai/conversation/delete', { id }),
};

/** AG-UI 端点：由 @ag-ui/client 的 HttpAgent 直连，不走 requestClient。 */
export const AI_AGUI_RUN_URL = '/api/ai/agui/run';
