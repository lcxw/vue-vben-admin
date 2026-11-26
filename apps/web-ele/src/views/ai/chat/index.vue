<script setup lang="ts">
import type { AiConversation, AiExpert, AiWorkspaceFile } from '#/api/ai';

import { nextTick, onMounted, ref } from 'vue';

import { useAccessStore } from '@vben/stores';

import { HttpAgent } from '@ag-ui/client';
import {
  ElButton,
  ElInput,
  ElMessage,
  ElOption,
  ElSelect,
  ElTag,
  ElTree,
} from 'element-plus';
import MarkdownRender from 'markstream-vue';

import {
  AI_AGUI_RUN_URL,
  aiConversationApi,
  aiExpertApi,
  aiWorkspaceApi,
  aiWorkspaceAttachmentApi,
} from '#/api/ai';

import 'markstream-vue/index.css';

type ToolCallStatus = 'cancelled' | 'error' | 'running' | 'success';

interface ToolCall {
  id: string;
  name: string;
  argumentsText: string;
  result: string;
  status: ToolCallStatus;
}

interface ChatMessage {
  id: string;
  clientId?: string;
  role: 'assistant' | 'user';
  content: string;
  complete: boolean;
  toolCalls: ToolCall[];
}

interface WorkspaceTreeNode extends AiWorkspaceFile {
  name: string;
  children?: WorkspaceTreeNode[];
}

async function validatedFetch(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  const contentType = response.headers.get('content-type') || '';
  if (
    response.ok &&
    contentType.includes('text/event-stream') &&
    response.body
  ) {
    return response;
  }
  const copy = response.clone();
  let message = `AI 服务请求失败（HTTP ${response.status}）`;
  const text = await copy.text();
  try {
    const body = JSON.parse(text);
    const detail = body?.msg ?? body?.message ?? body?.error;
    if (typeof detail === 'string' && detail) {
      message = detail;
    }
  } catch {
    if (text.trim() && !text.trimStart().startsWith('<')) {
      message = text.trim().slice(0, 300);
    }
  }
  throw new Error(message);
}

interface ActiveRun {
  agent: HttpAgent;
  conversationId: string;
  expertCode: string;
  assistantId: string;
  messages: ChatMessage[];
  syncPromise: Promise<void>;
}

const accessStore = useAccessStore();
const experts = ref<AiExpert[]>([]);
const conversations = ref<AiConversation[]>([]);
const selectedExpert = ref('');
const threadId = ref<string>(crypto.randomUUID());
const workspaceId = ref<string>(threadId.value);
const workspaceTree = ref<WorkspaceTreeNode[]>([]);
const workspaceReady = ref(false);
const workspaceLoading = ref(false);
const uploading = ref(false);
const uploadingFiles = ref<string[]>([]);
const fileInput = ref<HTMLInputElement>();
const input = ref('');
const sending = ref(false);
const messages = ref<ChatMessage[]>([]);
const scroller = ref<HTMLElement>();
const workspaceTreeProps = {
  children: 'children',
  label: 'name',
  isLeaf: (data: any) => !data.directory,
};
let activeRun: ActiveRun | undefined;

function cancelActiveRun() {
  const run = activeRun;
  if (!run) {
    return;
  }
  for (const message of run.messages) {
    message.complete = true;
    for (const call of message.toolCalls) {
      if (call.status === 'running') {
        call.status = 'cancelled';
      }
    }
  }
  run.messages = run.messages.filter(
    (message) =>
      message.role === 'user' ||
      message.content.trim().length > 0 ||
      message.toolCalls.length > 0,
  );
  messages.value = run.messages;
  activeRun = undefined;
  sending.value = false;
  run.agent.abortRun();
  void persistRun(run).catch(() => undefined);
}

function newChat() {
  if (uploading.value) {
    return;
  }
  cancelActiveRun();
  threadId.value = crypto.randomUUID();
  workspaceId.value = threadId.value;
  workspaceTree.value = [];
  workspaceReady.value = false;
  messages.value = [];
  input.value = '';
}

function normalizeWorkspacePath(path: string) {
  return path.replaceAll('\\', '/').replace(/^\/+/, '').replace(/\/+$/, '');
}

function toWorkspaceNodes(files: AiWorkspaceFile[]): WorkspaceTreeNode[] {
  return files
    .map((file) => {
      const path = normalizeWorkspacePath(file.path);
      return {
        ...file,
        path,
        name: path.split('/').pop() || file.path,
        children: file.directory ? [] : undefined,
      };
    })
    .sort(
      (left, right) =>
        Number(right.directory) - Number(left.directory) ||
        left.name.localeCompare(right.name, 'zh-CN'),
    );
}

async function loadWorkspaceFiles() {
  const targetWorkspaceId = workspaceId.value;
  if (!targetWorkspaceId || !workspaceReady.value) {
    workspaceTree.value = [];
    return;
  }
  workspaceLoading.value = true;
  try {
    const files = await aiWorkspaceApi.files(targetWorkspaceId);
    if (workspaceId.value === targetWorkspaceId) {
      workspaceTree.value = toWorkspaceNodes(files);
    }
  } catch {
    if (workspaceId.value === targetWorkspaceId) {
      workspaceTree.value = [];
    }
  } finally {
    if (workspaceId.value === targetWorkspaceId) {
      workspaceLoading.value = false;
    }
  }
}

async function loadWorkspaceChildren(
  node: any,
  resolve: (nodes: WorkspaceTreeNode[]) => void,
) {
  const targetWorkspaceId = workspaceId.value;
  try {
    const files = await aiWorkspaceApi.files(targetWorkspaceId, node.data.path);
    resolve(workspaceId.value === targetWorkspaceId ? toWorkspaceNodes(files) : []);
  } catch (error: any) {
    if (workspaceId.value === targetWorkspaceId) {
      ElMessage.error(error?.message || '目录加载失败');
    }
    resolve([]);
  }
}

async function downloadWorkspaceFile(file: AiWorkspaceFile) {
  try {
    await aiWorkspaceApi.download(
      workspaceId.value,
      file.path,
      accessStore.accessToken,
    );
  } catch (error: any) {
    ElMessage.error(error?.message || '下载失败');
  }
}

async function loadMeta() {
  experts.value = await aiExpertApi.options();
  if (!selectedExpert.value && experts.value.length > 0) {
    selectedExpert.value = experts.value[0]?.code || '';
  }
  conversations.value = await aiConversationApi.list();
  const current = conversations.value.find(
    (item) => item.id === threadId.value,
  );
  if (current?.workspaceId) {
    workspaceId.value = current.workspaceId;
  }
}

async function openConversation(conv: AiConversation) {
  if (uploading.value) {
    return;
  }
  cancelActiveRun();
  threadId.value = conv.id;
  workspaceId.value = conv.workspaceId || conv.id;
  selectedExpert.value = conv.expertCode;
  messages.value = [];
  workspaceTree.value = [];
  workspaceReady.value = true;
  const rows = await aiConversationApi.messages(conv.id);
  if (threadId.value !== conv.id) {
    return;
  }
  messages.value = rows.map((row) => {
    let content: string;
    try {
      content = JSON.parse(row.contentJson);
    } catch {
      content = row.contentJson;
    }
    return {
      id: row.id,
      clientId: row.clientMessageId || row.id,
      role: row.role?.toUpperCase() === 'USER' ? 'user' : 'assistant',
      content,
      complete: true,
      toolCalls: [],
    };
  });
  await loadWorkspaceFiles();
}

function onFileSelected(event: Event) {
  const inputElement = event.target as HTMLInputElement;
  const files = [...(inputElement.files || [])];
  inputElement.value = '';
  void uploadFiles(files);
}

async function uploadFiles(files: File[]) {
  if (files.length === 0 || uploading.value || sending.value) {
    return;
  }
  if (!selectedExpert.value) {
    ElMessage.warning('请先选择专家');
    return;
  }
  uploading.value = true;
  uploadingFiles.value = files.map((file) => file.name);
  const conversationId = threadId.value;
  const expertCode = selectedExpert.value;
  let uploaded = 0;
  try {
    for (const file of files) {
      try {
        await aiWorkspaceAttachmentApi.upload(conversationId, expertCode, file);
        uploaded += 1;
      } catch (error: any) {
        ElMessage.error(error?.message || `${file.name} 上传失败`);
      }
    }
    if (uploaded > 0) {
      workspaceReady.value = true;
      try {
        await loadMeta();
        await loadWorkspaceFiles();
        ElMessage.success(`已上传 ${uploaded} 个文件`);
      } catch (error: any) {
        ElMessage.error(error?.message || '文件已上传，但工作区刷新失败');
      }
    }
  } finally {
    uploadingFiles.value = [];
    uploading.value = false;
  }
}

function referenceWorkspaceFile(file: WorkspaceTreeNode) {
  if (file.directory) {
    return;
  }
  const separator = input.value && !input.value.endsWith(' ') ? ' ' : '';
  input.value = `${input.value}${separator}@${file.path} `;
}

function onWorkspaceNodeClick(node: WorkspaceTreeNode) {
  referenceWorkspaceFile(node);
}

function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

async function scrollToBottom() {
  await nextTick();
  scroller.value?.scrollTo({
    top: scroller.value.scrollHeight,
    behavior: 'smooth',
  });
}

function ensureAssistantMessage(run: ActiveRun, messageId: string): ChatMessage {
  let target = run.messages.find(
    (message) => message.role === 'assistant' && message.id === messageId,
  );
  if (!target) {
    const placeholder = run.messages.find(
      (message) =>
        message.role === 'assistant' &&
        (message.clientId || message.id) === run.assistantId &&
        !message.content &&
        message.toolCalls.length === 0,
    );
    if (placeholder) {
      placeholder.id = messageId;
      target = placeholder;
    } else {
      target = {
        id: messageId,
        clientId: messageId,
        role: 'assistant',
        content: '',
        complete: false,
        toolCalls: [],
      };
      run.messages.push(target);
      messages.value = run.messages;
    }
  }
  return target;
}

function currentAssistantMessage(run: ActiveRun): ChatMessage {
  return (
    run.messages.find(
      (message) =>
        message.role === 'assistant' &&
        (message.clientId || message.id) === run.assistantId,
    ) || ensureAssistantMessage(run, run.assistantId)
  );
}

function findToolCall(run: ActiveRun, toolCallId: string) {
  for (const message of run.messages) {
    const call = message.toolCalls.find((item) => item.id === toolCallId);
    if (call) {
      return call;
    }
  }
}

function startToolCall(run: ActiveRun, event: any) {
  const existing = findToolCall(run, event.toolCallId);
  if (existing) {
    return existing;
  }
  const target = event.parentMessageId
    ? ensureAssistantMessage(run, event.parentMessageId)
    : currentAssistantMessage(run);
  const call: ToolCall = {
    id: event.toolCallId,
    name: event.toolCallName || '未知工具',
    argumentsText: '',
    result: '',
    status: 'running',
  };
  target.toolCalls.push(call);
  void scrollToBottom();
  return call;
}

function failRunningToolCalls(run: ActiveRun, message: string) {
  for (const item of run.messages) {
    for (const call of item.toolCalls) {
      if (call.status === 'running') {
        call.status = 'error';
        call.result = message;
      }
    }
  }
}

function toolStatusLabel(status: ToolCallStatus) {
  return {
    cancelled: '已取消',
    error: '失败',
    running: '运行中',
    success: '已完成',
  }[status];
}

function formatToolJson(value: string) {
  if (!value) {
    return '';
  }
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function formatToolResult(content: unknown) {
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part?.text === 'string' ? part.text : ''))
      .filter(Boolean)
      .join('\n');
  }
  return JSON.stringify(content ?? '', null, 2);
}

async function syncRun(run: ActiveRun) {
  const lastUser = run.messages.toReversed().find((msg) => msg.role === 'user');
  await aiConversationApi.sync({
    conversationId: run.conversationId,
    expertCode: run.expertCode,
    title: lastUser?.content.slice(0, 30) || '新会话',
    messages: run.messages
      .filter((msg) => msg.content.trim().length > 0)
      .map((msg) => ({
        id: msg.clientId || msg.id,
        role: msg.role,
        content: msg.content,
      })),
  });
}

function persistRun(run: ActiveRun) {
  run.syncPromise = run.syncPromise
    .catch(() => undefined)
    .then(() => syncRun(run));
  return run.syncPromise;
}

async function send() {
  const text = input.value.trim();
  if (!text || sending.value || uploading.value || !selectedExpert.value) {
    return;
  }
  sending.value = true;
  input.value = '';

  const conversationId = threadId.value;
  const expertCode = selectedExpert.value;
  const targetWorkspaceId = workspaceId.value;
  const userId = `u-${crypto.randomUUID()}`;
  const assistantId = `a-${crypto.randomUUID()}`;
  const runMessages: ChatMessage[] = [
    ...messages.value,
    {
      id: userId,
      clientId: userId,
      role: 'user',
      content: text,
      complete: true,
      toolCalls: [],
    },
    {
      id: assistantId,
      clientId: assistantId,
      role: 'assistant',
      content: '',
      complete: false,
      toolCalls: [],
    },
  ];
  messages.value = runMessages;

  const token = accessStore.accessToken;
  const agent = new HttpAgent({
    url: AI_AGUI_RUN_URL,
    threadId: conversationId,
    fetch: validatedFetch,
    headers: {
      'Content-Type': 'application/json',
      'X-Agent-Id': expertCode,
      ...(targetWorkspaceId ? { 'X-Workspace-Id': targetWorkspaceId } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const run: ActiveRun = {
    agent,
    conversationId,
    expertCode,
    assistantId,
    messages: messages.value,
    syncPromise: Promise.resolve(),
  };
  activeRun = run;
  let runError = '';
  let sawRunFinished = false;

  agent.setMessages(
    runMessages
      .filter((msg) => msg.id !== assistantId)
      .map((msg) => ({
        id: msg.clientId || msg.id,
        role: msg.role,
        content: msg.content,
      })) as any,
  );
  agent.subscribe({
    onEvent: ({ event }: any) => {
      if (activeRun !== run || threadId.value !== conversationId) {
        return;
      }
      if (
        event.type === 'TEXT_MESSAGE_START' ||
        event.type === 'TEXT_MESSAGE_CONTENT' ||
        event.type === 'TEXT_MESSAGE_CHUNK'
      ) {
        const target = event.messageId
          ? ensureAssistantMessage(run, event.messageId)
          : currentAssistantMessage(run);
        if (
          event.type === 'TEXT_MESSAGE_CONTENT' ||
          event.type === 'TEXT_MESSAGE_CHUNK'
        ) {
          target.content += event.delta ?? event.content ?? '';
          void scrollToBottom();
        }
      } else if (event.type === 'TOOL_CALL_START') {
        startToolCall(run, event);
      } else if (event.type === 'TOOL_CALL_ARGS') {
        const call = findToolCall(run, event.toolCallId);
        if (call) {
          call.argumentsText += event.delta || '';
          void scrollToBottom();
        }
      } else if (event.type === 'TOOL_CALL_CHUNK') {
        if (!event.toolCallId) {
          return;
        }
        const call =
          findToolCall(run, event.toolCallId) || startToolCall(run, event);
        call.argumentsText += event.delta || '';
        void scrollToBottom();
      } else if (event.type === 'TOOL_CALL_RESULT') {
        const call = findToolCall(run, event.toolCallId);
        if (call) {
          call.result = formatToolResult(event.content);
          call.status = 'success';
          void scrollToBottom();
        }
      } else if (event.type === 'RUN_ERROR') {
        runError = event.message || 'AI 运行失败';
        failRunningToolCalls(run, runError);
        void persistRun(run).catch(() => undefined);
        ElMessage.error(runError);
      } else if (event.type === 'RUN_FINISHED') {
        sawRunFinished = true;
        failRunningToolCalls(run, '工具调用未返回结果');
      } else if (event.type === 'RAW') {
        const raw = event.event ?? event.rawEvent;
        if (raw?.error) {
          runError = String(raw.error);
          failRunningToolCalls(run, runError);
          ElMessage.error(runError);
        }
      }
    },
  });

  await scrollToBottom();
  if (activeRun !== run || threadId.value !== conversationId) {
    return;
  }

  try {
    await persistRun(run);
    if (activeRun !== run || threadId.value !== conversationId) {
      return;
    }
    await agent.runAgent({
      forwardedProps: {
        userMessageId: userId,
        assistantMessageId: assistantId,
      },
    });
    if (activeRun !== run || threadId.value !== conversationId) {
      return;
    }
    workspaceReady.value = true;
    if (runError) {
      return;
    }
    if (!sawRunFinished) {
      failRunningToolCalls(run, 'AI 服务未返回完整响应');
      ElMessage.error('AI 服务未返回完整响应，请检查服务日志后重试');
      return;
    }
    await persistRun(run);
    if (activeRun !== run || threadId.value !== conversationId) {
      return;
    }
    try {
      await loadMeta();
      await loadWorkspaceFiles();
    } catch {
      ElMessage.warning('回复已生成，但会话列表刷新失败');
    }
  } catch (error: any) {
    if (activeRun === run && threadId.value === conversationId) {
      failRunningToolCalls(run, error?.message || '请求失败');
      await persistRun(run).catch(() => undefined);
      ElMessage.error(error?.message || '请求失败');
      await loadMeta().catch(() => undefined);
    }
  } finally {
    if (activeRun === run) {
      for (const message of run.messages) {
        message.complete = true;
      }
      run.messages = run.messages.filter(
        (message) =>
          message.role === 'user' ||
          message.content.trim().length > 0 ||
          message.toolCalls.length > 0,
      );
      messages.value = run.messages;
      activeRun = undefined;
      sending.value = false;
    }
  }
}

function abort() {
  cancelActiveRun();
}

onMounted(async () => {
  await loadMeta();
  await loadWorkspaceFiles();
});
</script>

<template>
  <div class="ai-chat">
    <aside class="side">
      <div class="side-header">
        <ElButton
          type="primary"
          size="small"
          style="flex: 1"
          :disabled="uploading"
          @click="newChat"
        >
          新建会话
        </ElButton>
      </div>
      <div class="side-section-title">选择专家</div>
      <ElSelect
        v-model="selectedExpert"
        size="small"
        style="width: 100%"
        :disabled="uploading"
      >
        <ElOption
          v-for="expert in experts"
          :key="expert.code"
          :label="expert.name"
          :value="expert.code"
        />
      </ElSelect>
      <div class="side-section-title">历史会话</div>
      <div class="conv-list">
        <div
          v-for="conv in conversations"
          :key="conv.id"
          class="conv-item"
          :class="{ active: conv.id === threadId }"
          @click="openConversation(conv)"
        >
          <span>{{ conv.title || '新会话' }}</span>
          <ElButton
            link
            type="danger"
            size="small"
            @click.stop="aiConversationApi.remove(conv.id).then(loadMeta)"
          >
            删
          </ElButton>
        </div>
      </div>
    </aside>

    <main class="main">
      <div class="chat-pane">
        <div ref="scroller" class="messages">
          <div v-if="!messages.length" class="empty">选好专家，开始提问吧</div>
          <div
            v-for="msg in messages"
            :key="msg.id"
            class="bubble"
            :class="msg.role"
          >
            <div class="role">{{ msg.role === 'user' ? '我' : 'AI' }}</div>
            <div class="content">
              <div
                v-if="msg.role === 'assistant' && msg.toolCalls.length"
                class="tool-calls"
              >
                <details
                  v-for="call in msg.toolCalls"
                  :key="call.id"
                  class="tool-call"
                  :class="call.status"
                >
                  <summary>
                    <span class="tool-dot"></span>
                    <span class="tool-name">{{ call.name }}</span>
                    <span class="tool-status">
                      {{ toolStatusLabel(call.status) }}
                    </span>
                  </summary>
                  <div v-if="call.argumentsText" class="tool-section">
                    <div class="tool-section-title">参数</div>
                    <pre>{{ formatToolJson(call.argumentsText) }}</pre>
                  </div>
                  <div v-if="call.result" class="tool-section">
                    <div class="tool-section-title">结果</div>
                    <pre>{{ call.result }}</pre>
                  </div>
                </details>
              </div>
              <MarkdownRender
                v-if="msg.role === 'assistant' && msg.content"
                mode="chat"
                :content="msg.content"
                :final="msg.complete"
                smooth-streaming="auto"
                :fade="false"
              />
              <span
                v-else-if="
                  msg.role === 'assistant' &&
                  !msg.complete &&
                  !msg.toolCalls.length
                "
                class="thinking"
              >
                思考中…
              </span>
              <span v-else-if="msg.role === 'user'">{{ msg.content }}</span>
            </div>
          </div>
        </div>
        <div class="composer">
          <ElInput
            v-model="input"
            type="textarea"
            :rows="3"
            placeholder="输入消息，Enter 发送，Shift+Enter 换行"
            :disabled="sending"
            @keydown.enter.exact.prevent="send"
          />
          <div v-if="uploadingFiles.length" class="upload-status">
            <ElTag v-for="name in uploadingFiles" :key="name" size="small">
              {{ name }} · 上传中
            </ElTag>
          </div>
          <div class="actions">
            <input
              ref="fileInput"
              class="file-input"
              type="file"
              multiple
              @change="onFileSelected"
            />
            <ElButton
              size="small"
              :loading="uploading"
              :disabled="sending || !selectedExpert"
              @click="fileInput?.click()"
            >
              上传文件
            </ElButton>
            <span class="composer-hint">上传后可在右侧工作区查看</span>
            <ElButton v-if="sending" size="small" @click="abort">停止</ElButton>
            <ElButton
              type="primary"
              size="small"
              :loading="sending"
              @click="send"
            >
              发送
            </ElButton>
          </div>
        </div>
      </div>

      <aside class="workspace">
        <div class="workspace-header">
          <div>
            <strong>工作区</strong>
            <div class="workspace-subtitle">
              <ElTag size="small" effect="plain">
                {{ workspaceId ? workspaceId.slice(0, 8) : '未绑定' }}
              </ElTag>
            </div>
          </div>
          <ElButton
            size="small"
            :loading="workspaceLoading"
            @click="loadWorkspaceFiles"
          >
            刷新
          </ElButton>
        </div>
        <div v-if="workspaceLoading" class="workspace-empty">加载中…</div>
        <ElTree
          v-else-if="workspaceTree.length"
          class="workspace-tree"
          :data="workspaceTree"
          :props="workspaceTreeProps"
          :load="loadWorkspaceChildren"
          lazy
          highlight-current
          node-key="path"
          @node-click="onWorkspaceNodeClick"
        >
          <template #default="{ data }">
            <div class="tree-row">
              <span class="file-icon">{{ data.directory ? 'DIR' : 'FILE' }}</span>
              <span class="tree-name" :title="data.path">{{ data.name }}</span>
              <span v-if="!data.directory" class="tree-size">
                {{ formatFileSize(data.size) }}
              </span>
              <ElButton
                v-if="!data.directory"
                link
                type="primary"
                size="small"
                @click.stop="downloadWorkspaceFile(data)"
              >
                下载
              </ElButton>
            </div>
          </template>
        </ElTree>
        <div v-else class="workspace-empty">当前工作区暂无文件</div>
        <div class="workspace-tip">
          上传与 Agent 生成的文件统一显示在这里；目录可展开、折叠，点击文件可引用。
        </div>
      </aside>
    </main>
  </div>
</template>

<style scoped>
.ai-chat {
  display: flex;
  gap: 12px;
  height: calc(100vh - 120px);
  min-height: 520px;
}

.side {
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  gap: 8px;
  width: 240px;
  padding: 12px;
  background: var(--el-bg-color-overlay);
  border-radius: 8px;
}

.side-section-title {
  margin-top: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.conv-list {
  flex: 1;
  overflow: auto;
}

.conv-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px;
  font-size: 13px;
  cursor: pointer;
  border-radius: 6px;
}

.conv-item:hover,
.conv-item.active {
  background: var(--el-fill-color-light);
}

.conv-item span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.main {
  display: flex;
  flex: 1;
  flex-direction: row;
  min-width: 0;
  overflow: hidden;
  background: var(--el-bg-color-overlay);
  border-radius: 8px;
}

.chat-pane {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.workspace {
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  width: 280px;
  padding: 12px;
  overflow: hidden;
  border-left: 1px solid var(--el-border-color-lighter);
}

.workspace-header {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 12px;
  font-size: 13px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.workspace-subtitle {
  margin-top: 4px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.file-input {
  display: none;
}

.workspace-empty {
  padding: 24px 8px;
  font-size: 12px;
  line-height: 1.7;
  color: var(--el-text-color-secondary);
  text-align: center;
}

.workspace-tree {
  flex: 1;
  min-height: 0;
  overflow: auto;
  background: transparent;
}

.tree-row {
  display: flex;
  gap: 6px;
  align-items: center;
  width: 100%;
  min-width: 0;
  padding-right: 4px;
  font-size: 12px;
}

.tree-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tree-size {
  flex-shrink: 0;
  font-size: 10px;
  color: var(--el-text-color-secondary);
}

.workspace-tip {
  padding-top: 8px;
  font-size: 11px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
  border-top: 1px solid var(--el-border-color-lighter);
}

.messages {
  flex: 1;
  padding: 16px;
  overflow: auto;
}

.empty {
  padding-top: 120px;
  color: var(--el-text-color-secondary);
  text-align: center;
}

.bubble {
  display: flex;
  gap: 10px;
  margin-bottom: 14px;
}

.bubble.user {
  flex-direction: row-reverse;
}

.role {
  flex: 0 0 32px;
  height: 32px;
  font-size: 12px;
  line-height: 32px;
  text-align: center;
  background: var(--el-color-primary-light-9);
  border-radius: 50%;
}

.bubble.user .role {
  background: var(--el-color-success-light-9);
}

.content {
  max-width: 78%;
  min-width: 0;
  padding: 10px 14px;
  overflow-wrap: anywhere;
  line-height: 1.6;
  background: var(--el-fill-color-light);
  border-radius: 8px;
}

.tool-calls {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 10px;
}

.tool-call {
  overflow: hidden;
  font-size: 12px;
  background: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.tool-call summary {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 8px 10px;
  list-style: none;
  cursor: pointer;
}

.tool-call summary::-webkit-details-marker {
  display: none;
}

.tool-dot {
  width: 7px;
  height: 7px;
  background: var(--el-color-warning);
  border-radius: 50%;
}

.tool-call.success .tool-dot {
  background: var(--el-color-success);
}

.tool-call.error .tool-dot,
.tool-call.cancelled .tool-dot {
  background: var(--el-color-danger);
}

.tool-call.running .tool-dot {
  animation: pulse 1.2s ease-in-out infinite;
}

.tool-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tool-status {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.tool-section {
  padding: 8px 10px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.tool-section-title {
  margin-bottom: 6px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.tool-section pre {
  max-height: 240px;
  margin: 0;
  overflow: auto;
  font-family: var(--el-font-family-mono, monospace);
  font-size: 11px;
  line-height: 1.5;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.thinking {
  color: var(--el-text-color-secondary);
}

@keyframes pulse {
  50% {
    opacity: 0.35;
  }
}

.composer {
  padding: 12px 16px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.actions {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: flex-end;
  margin-top: 8px;
}

.composer-hint {
  margin-right: auto;
  overflow: hidden;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.upload-status {
  display: flex;
  gap: 6px;
  margin-top: 8px;
  overflow: auto;
}

.upload-status .el-tag {
  flex-shrink: 0;
  max-width: 220px;
}

.file-icon {
  padding: 1px 4px;
  font-size: 9px;
  color: var(--el-color-primary);
  border: 1px solid var(--el-color-primary-light-5);
  border-radius: 3px;
}

@media (max-width: 1200px) {
  .workspace {
    width: 240px;
  }

  .tree-size {
    display: none;
  }
}

@media (max-width: 900px) {
  .side {
    width: 200px;
  }

  .workspace {
    width: 210px;
  }

  .composer-hint {
    display: none;
  }
}
</style>
