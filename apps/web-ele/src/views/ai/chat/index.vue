<script setup lang="ts">
import { HttpAgent } from '@ag-ui/client';
import { useAccessStore } from '@vben/stores';
import MarkdownRender from 'markstream-vue';
import 'markstream-vue/index.css';
import { ElMessage } from 'element-plus';
import { nextTick, onMounted, ref } from 'vue';

import {
  AI_AGUI_RUN_URL,
  aiConversationApi,
  aiExpertApi,
  type AiConversation,
  type AiExpert,
} from '#/api/ai';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const accessStore = useAccessStore();
const experts = ref<AiExpert[]>([]);
const conversations = ref<AiConversation[]>([]);
const selectedExpert = ref('');
const threadId = ref<string>(crypto.randomUUID());
const input = ref('');
const sending = ref(false);
const messages = ref<ChatMessage[]>([]);
const toolLog = ref<string[]>([]);
const scroller = ref<HTMLElement>();
let activeAgent: HttpAgent | undefined;

function newChat() {
  threadId.value = crypto.randomUUID();
  messages.value = [];
  toolLog.value = [];
  input.value = '';
}

async function loadMeta() {
  experts.value = await aiExpertApi.options();
  if (!selectedExpert.value && experts.value.length) {
    selectedExpert.value = experts.value[0]?.code || '';
  }
  conversations.value = await aiConversationApi.list();
}

async function openConversation(conv: AiConversation) {
  threadId.value = conv.id;
  selectedExpert.value = conv.expertCode;
  const rows = await aiConversationApi.messages(conv.id);
  messages.value = rows.map((row) => {
    let content = '';
    try {
      content = JSON.parse(row.contentJson);
    } catch {
      content = row.contentJson;
    }
    return { id: row.id, role: row.role === 'USER' ? 'user' : 'assistant', content };
  });
  toolLog.value = [];
}

async function scrollToBottom() {
  await nextTick();
  scroller.value?.scrollTo({ top: scroller.value.scrollHeight, behavior: 'smooth' });
}

async function send() {
  const text = input.value.trim();
  if (!text || sending.value || !selectedExpert.value) {
    return;
  }
  sending.value = true;
  input.value = '';
  toolLog.value = [];

  const userId = `u-${Date.now()}`;
  const assistantId = `a-${Date.now()}`;
  messages.value.push({ id: userId, role: 'user', content: text });
  messages.value.push({ id: assistantId, role: 'assistant', content: '' });
  await scrollToBottom();

  const token = accessStore.accessToken;
  const agent = new HttpAgent({
    url: AI_AGUI_RUN_URL,
    threadId: threadId.value,
    headers: {
      'Content-Type': 'application/json',
      'X-Agent-Id': selectedExpert.value,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  activeAgent = agent;
  agent.setMessages(
    messages.value
      .filter((msg) => msg.id !== assistantId)
      .map((msg) => ({ id: msg.id, role: msg.role, content: msg.content })) as any,
  );
  agent.subscribe({
    onEvent: ({ event }: any) => {
      if (event.type === 'TEXT_MESSAGE_CONTENT') {
        const target = messages.value.find((msg) => msg.id === assistantId);
        if (target) {
          target.content += event.delta || '';
          void scrollToBottom();
        }
      } else if (event.type === 'TOOL_CALL_START') {
        toolLog.value.push(`调用工具 ${event.toolName || ''}`);
      } else if (event.type === 'RUN_ERROR') {
        ElMessage.error(event.message || 'AI 运行失败');
      }
    },
  });

  try {
    await agent.runAgent({});
    const lastUser = [...messages.value].reverse().find((msg) => msg.role === 'user');
    await aiConversationApi.sync({
      conversationId: threadId.value,
      expertCode: selectedExpert.value,
      title: lastUser?.content.slice(0, 30) || '新会话',
      messages: messages.value.map((msg) => ({ role: msg.role, content: msg.content })),
    });
    await loadMeta();
  } catch (error: any) {
    ElMessage.error(error?.message || '请求失败');
  } finally {
    sending.value = false;
    activeAgent = undefined;
  }
}

function abort() {
  activeAgent?.abortRun();
  sending.value = false;
}

onMounted(loadMeta);
</script>

<template>
  <div class="ai-chat">
    <aside class="side">
      <div class="side-header">
        <ElButton type="primary" size="small" style="flex: 1" @click="newChat">新建会话</ElButton>
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
          <ElButton link type="danger" size="small" @click.stop="aiConversationApi.remove(conv.id).then(loadMeta)">
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
        <div v-for="msg in messages" :key="msg.id" class="bubble" :class="msg.role">
          <div class="role">{{ msg.role === 'user' ? '我' : 'AI' }}</div>
          <div class="content">
            <MarkdownRender v-if="msg.role === 'assistant'" :content="msg.content" />
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
          <ElButton type="primary" size="small" :loading="sending" @click="send">发送</ElButton>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.ai-chat {
  display: flex;
  height: calc(100vh - 120px);
  min-height: 520px;
  gap: 12px;
}
.side {
  width: 240px;
  padding: 12px;
  border-radius: 8px;
  background: var(--el-bg-color-overlay);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.side-section-title {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 8px;
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
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
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
  font-size: 11px;
  color: var(--el-text-color-secondary);
  max-height: 90px;
  overflow: auto;
}
.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  border-radius: 8px;
  background: var(--el-bg-color-overlay);
  overflow: hidden;
}
.messages {
  flex: 1;
  overflow: auto;
  padding: 16px;
}
.empty {
  color: var(--el-text-color-secondary);
  text-align: center;
  padding-top: 120px;
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
  line-height: 32px;
  text-align: center;
  border-radius: 50%;
  background: var(--el-color-primary-light-9);
  font-size: 12px;
}
.bubble.user .role {
  background: var(--el-color-success-light-9);
}
.content {
  max-width: 78%;
  padding: 10px 14px;
  border-radius: 8px;
  background: var(--el-fill-color-light);
  line-height: 1.6;
}
.composer {
  padding: 12px 16px;
  border-top: 1px solid var(--el-border-color-lighter);
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}
</style>
