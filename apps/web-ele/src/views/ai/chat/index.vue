<script setup lang="ts">
import type { AiConversation, AiExpert, AiWorkspaceFile } from '#/api/ai';

import { nextTick, onMounted, ref } from 'vue';

import { useAccessStore } from '@vben/stores';

import { HttpAgent } from '@ag-ui/client';
// 本应用没有全局 app.use(ElementPlus)，模板中使用的组件必须显式导入。
import {
  ElButton,
  ElInput,
  ElMessage,
  ElOption,
  ElSelect,
  ElTag,
} from 'element-plus';
import MarkdownRender from 'markstream-vue';

import {
  AI_AGUI_RUN_URL,
  aiConversationApi,
  aiExpertApi,
  aiWorkspaceApi,
} from '#/api/ai';

import 'markstream-vue/index.css';

interface ChatMessage {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  complete: boolean;
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

const accessStore = useAccessStore();
const experts = ref<AiExpert[]>([]);
const conversations = ref<AiConversation[]>([]);
const selectedExpert = ref('');
const threadId = ref<string>(crypto.randomUUID());
const workspaceId = ref<string>(threadId.value);
const workspaceFiles = ref<AiWorkspaceFile[]>([]);
const workspaceLoading = ref(false);
const input = ref('');
const sending = ref(false);
const messages = ref<ChatMessage[]>([]);
const toolLog = ref<string[]>([]);
const scroller = ref<HTMLElement>();
let activeAgent: HttpAgent | undefined;
let aborted = false;

function newChat() {
  threadId.value = crypto.randomUUID();
  workspaceId.value = threadId.value;
  workspaceFiles.value = [];
  messages.value = [];
  toolLog.value = [];
  input.value = '';
}

async function loadWorkspaceFiles() {
  if (!workspaceId.value) {
    workspaceFiles.value = [];
    return;
  }
  workspaceLoading.value = true;
  try {
    workspaceFiles.value = await aiWorkspaceApi.files(workspaceId.value);
  } catch {
    workspaceFiles.value = [];
  } finally {
    workspaceLoading.value = false;
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
  threadId.value = conv.id;
  workspaceId.value = conv.workspaceId || conv.id;
  selectedExpert.value = conv.expertCode;
  await loadWorkspaceFiles();
  const rows = await aiConversationApi.messages(conv.id);
  messages.value = rows.map((row) => {
    let content = '';
    try {
      content = JSON.parse(row.contentJson);
    } catch {
      content = row.contentJson;
    }
    return {
      id: row.id,
      role: row.role === 'USER' ? 'user' : 'assistant',
      content,
      complete: true,
    };
  });
  toolLog.value = [];
}

async function scrollToBottom() {
  await nextTick();
  scroller.value?.scrollTo({
    top: scroller.value.scrollHeight,
    behavior: 'smooth',
  });
}

async function send() {
  const text = input.value.trim();
  if (!text || sending.value || !selectedExpert.value) {
    return;
  }
  sending.value = true;
  aborted = false;
  input.value = '';
  toolLog.value = [];

  const userId = `u-${crypto.randomUUID()}`;
  const assistantId = `a-${crypto.randomUUID()}`;
  const assistant: ChatMessage = {
    id: assistantId,
    role: 'assistant',
    content: '',
    complete: false,
  };
  messages.value.push(
    { id: userId, role: 'user', content: text, complete: true },
    assistant,
  );
  await scrollToBottom();

  const token = accessStore.accessToken;
  const agent = new HttpAgent({
    url: AI_AGUI_RUN_URL,
    threadId: threadId.value,
    fetch: validatedFetch,
    headers: {
      'Content-Type': 'application/json',
      'X-Agent-Id': selectedExpert.value,
      ...(workspaceId.value ? { 'X-Workspace-Id': workspaceId.value } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  activeAgent = agent;
  let runError = '';
  let sawRunFinished = false;
  agent.setMessages(
    messages.value
      .filter((msg) => msg.id !== assistantId)
      .map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
      })) as any,
  );
  agent.subscribe({
    onEvent: ({ event }: any) => {
      if (
        event.type === 'TEXT_MESSAGE_START' ||
        event.type === 'TEXT_MESSAGE_CONTENT'
      ) {
        const target = event.messageId
          ? messages.value.find((msg) => msg.id === event.messageId) ||
            assistant
          : assistant;
        if (target) {
          if (event.messageId) {
            target.id = event.messageId;
          }
          if (event.type === 'TEXT_MESSAGE_CONTENT') {
            target.content += event.delta || '';
            void scrollToBottom();
          }
        }
      } else if (event.type === 'TOOL_CALL_START') {
        toolLog.value.push(`调用工具 ${event.toolCallName || ''}`);
      } else if (event.type === 'RUN_ERROR') {
        runError = event.message || 'AI 运行失败';
        ElMessage.error(runError);
      } else if (event.type === 'RUN_FINISHED') {
        sawRunFinished = true;
      } else if (event.type === 'RAW') {
        const raw = event.event ?? event.rawEvent;
        if (raw?.error) {
          runError = String(raw.error);
          ElMessage.error(runError);
        }
      }
    },
  });

  try {
    await agent.runAgent({});
    if (aborted) {
      return;
    }
    if (runError) {
      return;
    }
    if (!sawRunFinished) {
      ElMessage.error('AI 服务未返回完整响应，请检查服务日志后重试');
      return;
    }
    try {
      await loadMeta();
      await loadWorkspaceFiles();
    } catch {
      ElMessage.warning('回复已生成，但会话列表刷新失败');
    }
  } catch (error: any) {
    if (!aborted) {
      ElMessage.error(error?.message || '请求失败');
    }
  } finally {
    assistant.complete = true;
    sending.value = false;
    activeAgent = undefined;
  }
}

function abort() {
  aborted = true;
  activeAgent?.abortRun();
  sending.value = false;
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
        <ElButton type="primary" size="small" style="flex: 1" @click="newChat">
          新建会话
        </ElButton>
      </div>
      <div class="side-section-title">选择专家</div>
      <ElSelect v-model="selectedExpert" size="small" style="width: 100%">
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
      <div v-if="toolLog.length" class="tool-log">
        <div v-for="(item, index) in toolLog" :key="index">{{ item }}</div>
      </div>
    </aside>

    <main class="main">
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
            <MarkdownRender
              v-if="msg.role === 'assistant'"
              mode="chat"
              :content="msg.content"
              :final="msg.complete"
              smooth-streaming="auto"
              :fade="false"
            />
            <span v-else>{{ msg.content }}</span>
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
        <div class="actions">
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
    </main>

    <aside class="workspace-panel">
      <div class="workspace-head">
        <div>
          <div class="workspace-title">工作区文件</div>
          <ElTag size="small" effect="plain">
            {{ workspaceId ? workspaceId.slice(0, 8) : '未绑定' }}
          </ElTag>
        </div>
        <ElButton
          size="small"
          :loading="workspaceLoading"
          @click="loadWorkspaceFiles"
        >
          刷新
        </ElButton>
      </div>
      <div v-if="!workspaceFiles.length" class="workspace-empty">
        {{ workspaceLoading ? '加载中…' : '当前工作区暂无文件' }}
      </div>
      <div v-else class="workspace-files">
        <div
          v-for="file in workspaceFiles"
          :key="file.path"
          class="workspace-file"
        >
          <span class="file-icon">{{ file.directory ? 'DIR' : 'FILE' }}</span>
          <span class="file-name" :title="file.path">
            {{ file.path.split('/').pop() || file.path }}
          </span>
          <ElButton
            v-if="!file.directory"
            link
            type="primary"
            size="small"
            @click="downloadWorkspaceFile(file)"
          >
            下载
          </ElButton>
        </div>
      </div>
      <div class="workspace-tip">上传与 Agent 生成的文件都会出现在这里</div>
    </aside>
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

.tool-log {
  max-height: 90px;
  overflow: auto;
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.main {
  display: flex;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
  background: var(--el-bg-color-overlay);
  border-radius: 8px;
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
  padding: 10px 14px;
  line-height: 1.6;
  background: var(--el-fill-color-light);
  border-radius: 8px;
}

.composer {
  padding: 12px 16px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 8px;
}

.workspace-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 260px;
  padding: 12px;
  background: var(--el-bg-color-overlay);
  border-radius: 8px;
}

.workspace-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.workspace-title {
  margin-bottom: 4px;
  font-size: 13px;
  font-weight: 600;
}

.workspace-empty,
.workspace-tip {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.workspace-files {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 6px;
  overflow: auto;
}

.workspace-file {
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 6px;
  font-size: 12px;
  border-radius: 6px;
}

.workspace-file:hover {
  background: var(--el-fill-color-light);
}

.file-icon {
  padding: 1px 4px;
  font-size: 9px;
  color: var(--el-color-primary);
  border: 1px solid var(--el-color-primary-light-5);
  border-radius: 3px;
}

.file-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workspace-tip {
  padding-top: 8px;
  border-top: 1px solid var(--el-border-color-lighter);
}
</style>
