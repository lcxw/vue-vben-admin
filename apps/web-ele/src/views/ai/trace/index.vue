<script setup lang="ts">
import type {
  AiAgentTrace,
  AiAgentTraceDetail,
  AiAgentTraceSpan,
  AiTraceQuery,
  AiTraceSummary,
} from '#/api/ai';

import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';

import {
  ElAlert,
  ElButton,
  ElDatePicker,
  ElDescriptions,
  ElDescriptionsItem,
  ElDrawer,
  ElEmpty,
  ElInput,
  ElMessage,
  ElOption,
  ElPagination,
  ElSelect,
  ElSwitch,
  ElTable,
  ElTableColumn,
  ElTabPane,
  ElTabs,
  ElTag,
  ElTimeline,
  ElTimelineItem,
} from 'element-plus';

import { aiExpertApi, aiTraceApi } from '#/api/ai';

const traces = ref<AiAgentTrace[]>([]);
const experts = ref<{ code: string; name: string }[]>([]);
const summary = ref<AiTraceSummary>({
  total: 0,
  running: 0,
  success: 0,
  error: 0,
  cancelled: 0,
  totalTokens: 0,
  avgDurationMs: 0,
});
const filters = reactive({
  keyword: '',
  status: '',
  expertCode: '',
  startTime: '',
  endTime: '',
});
const pageNum = ref(1);
const pageSize = ref(20);
const listTotal = ref(0);
const loading = ref(false);
const autoRefresh = ref(true);
const detailVisible = ref(false);
const detailLoading = ref(false);
const detail = ref<AiAgentTraceDetail | null>(null);
const selectedSpanId = ref('');
const spanType = ref('');
const spanKeyword = ref('');
const detailTab = ref('input');
const now = ref(Date.now());
let refreshTimer: ReturnType<typeof setInterval> | undefined;

const filterQuery = computed<Omit<AiTraceQuery, 'pageNum' | 'pageSize'>>(() => ({
  keyword: filters.keyword.trim() || undefined,
  status: filters.status || undefined,
  expertCode: filters.expertCode || undefined,
  startTime: filters.startTime || undefined,
  endTime: filters.endTime || undefined,
}));

const visibleSpans = computed(() =>
  (detail.value?.spans ?? []).filter((span) => {
    const matchesType = !spanType.value || span.spanType === spanType.value;
    const keyword = spanKeyword.value.trim().toLowerCase();
    const matchesKeyword =
      !keyword ||
      `${span.name ?? ''} ${span.externalId ?? ''} ${span.errorMessage ?? ''}`
        .toLowerCase()
        .includes(keyword);
    return matchesType && matchesKeyword;
  }),
);

const selectedSpan = computed(
  () => detail.value?.spans.find((span) => span.id === selectedSpanId.value) ?? null,
);

const successRate = computed(() => {
  const completed = summary.value.total - summary.value.running;
  return completed > 0 ? Math.round((summary.value.success / completed) * 100) : 0;
});

function statusType(value?: string) {
  return value === 'SUCCESS'
    ? 'success'
    : value === 'RUNNING'
      ? 'warning'
      : value === 'CANCELLED'
        ? 'info'
        : 'danger';
}

function statusText(value?: string) {
  return (
    {
      RUNNING: '运行中',
      SUCCESS: '成功',
      ERROR: '失败',
      CANCELLED: '已取消',
    }[value ?? ''] ?? value ?? '-'
  );
}

function formatDate(value?: string) {
  return value ? value.replace('T', ' ').slice(0, 23) : '-';
}

function formatDuration(value?: number) {
  if (value == null) {
    return '-';
  }
  return value < 1000 ? `${value} ms` : `${(value / 1000).toFixed(2)} s`;
}

function runningDuration(trace: AiAgentTrace) {
  if (trace.status !== 'RUNNING' || !trace.startedAt) {
    return formatDuration(trace.durationMs);
  }
  const startedAt = new Date(trace.startedAt).getTime();
  return formatDuration(Math.max(0, now.value - startedAt));
}

function formatNumber(value?: number) {
  return (value ?? 0).toLocaleString('zh-CN');
}

function prettyJson(value?: string) {
  if (!value) {
    return '';
  }
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

async function load(keepPage = false) {
  if (loading.value) {
    return;
  }
  if (!keepPage) {
    pageNum.value = 1;
  }
  loading.value = true;
  try {
    const [page, stats] = await Promise.all([
      aiTraceApi.list({ ...filterQuery.value, pageNum: pageNum.value, pageSize: pageSize.value }),
      aiTraceApi.summary(filterQuery.value),
    ]);
    traces.value = page.list;
    listTotal.value = page.total;
    summary.value = stats;
  } finally {
    loading.value = false;
  }
}

async function openDetail(row: AiAgentTrace) {
  selectedSpanId.value = '';
  spanType.value = '';
  spanKeyword.value = '';
  detailTab.value = 'input';
  detailVisible.value = true;
  await loadDetail(row.id);
}

async function loadDetail(id: string) {
  detailLoading.value = true;
  try {
    detail.value = await aiTraceApi.detail(id);
    if (!selectedSpanId.value && detail.value.spans[0]) {
      selectedSpanId.value = detail.value.spans[0].id;
    }
  } catch (error: any) {
    detailVisible.value = false;
    ElMessage.error(error?.message || 'Trace 详情加载失败');
  } finally {
    detailLoading.value = false;
  }
}

async function refreshDetail() {
  const trace = detail.value?.trace;
  if (detailVisible.value && trace?.status === 'RUNNING') {
    await loadDetail(trace.id);
  }
}

function selectSpan(span: AiAgentTraceSpan) {
  selectedSpanId.value = span.id;
  detailTab.value = 'input';
}

function exportDetail(format: 'json' | 'markdown') {
  if (!detail.value) {
    return;
  }
  const { trace, spans } = detail.value;
  let content: string;
  let extension: string;
  if (format === 'json') {
    content = JSON.stringify(detail.value, null, 2);
    extension = 'json';
  } else {
    const sections = spans.map(
      (span, index) =>
        `### ${index + 1}. ${span.spanType} · ${span.name || '-'}\n\n` +
        `状态：${statusText(span.status)}；耗时：${formatDuration(span.durationMs)}\n\n` +
        `#### 输入\n\n\`\`\`json\n${prettyJson(span.inputJson) || '-'}\n\`\`\`\n\n` +
        `#### 输出\n\n\`\`\`json\n${prettyJson(span.outputJson) || '-'}\n\`\`\`\n\n`,
    );
    content =
      `# Agent Trace · ${trace.agentName || '-'}\n\n` +
      `- Run ID：${trace.runId}\n- 状态：${statusText(trace.status)}\n` +
      `- 模型：${trace.modelName || '-'}\n- 耗时：${formatDuration(trace.durationMs)}\n` +
      `- Token：${trace.inputTokens ?? 0} / ${trace.outputTokens ?? 0} / ${trace.totalTokens ?? 0}\n\n` +
      `## 运行输入\n\n\`\`\`json\n${prettyJson(trace.inputJson) || '-'}\n\`\`\`\n\n` +
      `## 运行输出\n\n\`\`\`json\n${prettyJson(trace.outputJson) || '-'}\n\`\`\`\n\n` +
      `## 调用链\n\n${sections.join('')}`;
    extension = 'md';
  }
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `agent-trace-${trace.runId}.${extension}`;
  link.click();
  URL.revokeObjectURL(url);
}

async function copyRunId() {
  if (!detail.value) {
    return;
  }
  try {
    await navigator.clipboard.writeText(detail.value.trace.runId);
    ElMessage.success('Run ID 已复制');
  } catch {
    ElMessage.warning('复制失败，请手动选择 Run ID');
  }
}

onMounted(() => {
  void load().catch(() => undefined);
  void aiExpertApi
    .list()
    .then((items) => (experts.value = items))
    .catch(() => ElMessage.warning('Agent 筛选项加载失败，Trace 查询仍可正常使用'));
  refreshTimer = setInterval(() => {
    if (!document.hidden) {
      now.value = Date.now();
      if (autoRefresh.value) {
        void load(true);
        void refreshDetail().catch(() => undefined);
      }
    }
  }, 5000);
});

onBeforeUnmount(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }
});
</script>

<template>
  <div class="trace-page">
    <div class="page-heading">
      <div>
        <h2>Agent Trace</h2>
        <p>查看每次 Agent 运行的输入输出、Token 消耗、模型与工具调用链。</p>
      </div>
      <div class="heading-actions">
        <span class="auto-refresh">
          <ElSwitch v-model="autoRefresh" size="small" />
          每 5 秒自动刷新
        </span>
        <ElButton :loading="loading" @click="load()">刷新</ElButton>
      </div>
    </div>

    <div class="stats-grid">
      <button class="stat-card" @click="filters.status = ''; load()">
        <span>运行总数</span>
        <strong>{{ formatNumber(summary.total) }}</strong>
        <small>当前筛选范围</small>
      </button>
      <button class="stat-card" @click="filters.status = 'SUCCESS'; load()">
        <span>成功率</span>
        <strong class="success">{{ successRate }}%</strong>
        <small>成功 {{ summary.success }} · 失败 {{ summary.error }}</small>
      </button>
      <button class="stat-card" @click="filters.status = 'RUNNING'; load()">
        <span>平均耗时</span>
        <strong>{{ formatDuration(summary.avgDurationMs) }}</strong>
        <small>运行中 {{ summary.running }} · 已取消 {{ summary.cancelled }}</small>
      </button>
      <div class="stat-card">
        <span>Token 消耗</span>
        <strong>{{ formatNumber(summary.totalTokens) }}</strong>
        <small>输入 + 输出 Token 总量</small>
      </div>
    </div>

    <div class="filter-panel">
      <ElInput
        v-model="filters.keyword"
        clearable
        style="width: 260px"
        placeholder="搜索 Run ID、会话、Agent 或错误"
        @keyup.enter="load()"
      />
      <ElSelect v-model="filters.status" clearable style="width: 130px" placeholder="全部状态">
        <ElOption label="运行中" value="RUNNING" />
        <ElOption label="成功" value="SUCCESS" />
        <ElOption label="失败" value="ERROR" />
        <ElOption label="已取消" value="CANCELLED" />
      </ElSelect>
      <ElSelect
        v-model="filters.expertCode"
        clearable
        filterable
        style="width: 180px"
        placeholder="全部 Agent"
      >
        <ElOption
          v-for="expert in experts"
          :key="expert.code"
          :label="expert.name"
          :value="expert.code"
        />
      </ElSelect>
      <ElDatePicker
        v-model="filters.startTime"
        type="datetime"
        style="width: 190px"
        placeholder="开始时间"
        value-format="YYYY-MM-DDTHH:mm:ss"
      />
      <span>至</span>
      <ElDatePicker
        v-model="filters.endTime"
        type="datetime"
        style="width: 190px"
        placeholder="结束时间"
        value-format="YYYY-MM-DDTHH:mm:ss"
      />
      <ElButton type="primary" @click="load()">查询</ElButton>
      <ElButton
        @click="filters.keyword = ''; filters.status = ''; filters.expertCode = ''; filters.startTime = ''; filters.endTime = ''; load()"
      >
        重置
      </ElButton>
    </div>

    <ElTable v-loading="loading" :data="traces" border stripe>
      <ElTableColumn label="开始时间" width="165">
        <template #default="{ row }">{{ formatDate(row.startedAt) }}</template>
      </ElTableColumn>
      <ElTableColumn label="Agent" min-width="130">
        <template #default="{ row }">
          <div class="agent-name">{{ row.agentName || row.expertCode || '-' }}</div>
          <div class="subtle">{{ row.expertCode }}</div>
        </template>
      </ElTableColumn>
      <ElTableColumn prop="modelName" label="模型" min-width="140" show-overflow-tooltip />
      <ElTableColumn label="状态" width="95">
        <template #default="{ row }">
          <ElTag :type="statusType(row.status)">{{ statusText(row.status) }}</ElTag>
        </template>
      </ElTableColumn>
      <ElTableColumn label="耗时" width="110">
        <template #default="{ row }">{{ runningDuration(row as AiAgentTrace) }}</template>
      </ElTableColumn>
      <ElTableColumn label="Token" width="135">
        <template #default="{ row }">
          <span>{{ formatNumber(row.inputTokens) }} / {{ formatNumber(row.outputTokens) }}</span>
        </template>
      </ElTableColumn>
      <ElTableColumn label="Run / 会话" min-width="230">
        <template #default="{ row }">
          <div class="mono">{{ row.runId }}</div>
          <div class="subtle mono">{{ row.conversationId }}</div>
        </template>
      </ElTableColumn>
      <ElTableColumn label="错误" min-width="200" show-overflow-tooltip>
        <template #default="{ row }">
          <span :class="row.status === 'ERROR' ? 'error-text' : ''">
            {{ row.errorMessage || '-' }}
          </span>
        </template>
      </ElTableColumn>
      <ElTableColumn label="操作" width="80" fixed="right">
        <template #default="{ row }">
          <ElButton link type="primary" @click="openDetail(row as AiAgentTrace)">详情</ElButton>
        </template>
      </ElTableColumn>
    </ElTable>

    <div class="pagination-bar">
      <span>共 {{ formatNumber(listTotal) }} 条记录</span>
      <ElPagination
        v-model:current-page="pageNum"
        v-model:page-size="pageSize"
        :total="listTotal"
        :page-sizes="[20, 50, 100]"
        layout="sizes, prev, pager, next"
        @current-change="() => load(true)"
        @size-change="load()"
      />
    </div>

    <ElDrawer
      v-model="detailVisible"
      title="运行详情与调用链"
      size="88%"
      destroy-on-close
    >
      <template v-if="detail">
        <div class="detail-heading">
          <div class="detail-title">
            <h3>{{ detail.trace.agentName || detail.trace.expertCode || 'Agent Run' }}</h3>
            <ElTag :type="statusType(detail.trace.status)">{{ statusText(detail.trace.status) }}</ElTag>
          </div>
          <div class="heading-actions">
            <ElButton @click="copyRunId">复制 Run ID</ElButton>
            <ElButton @click="exportDetail('markdown')">导出 Markdown</ElButton>
            <ElButton type="primary" @click="exportDetail('json')">导出 JSON</ElButton>
          </div>
        </div>

        <ElDescriptions :column="4" border size="small" class="run-summary">
          <ElDescriptionsItem label="Run ID" :span="2">
            <span class="mono">{{ detail.trace.runId }}</span>
          </ElDescriptionsItem>
          <ElDescriptionsItem label="会话 ID" :span="2">
            <span class="mono">{{ detail.trace.conversationId }}</span>
          </ElDescriptionsItem>
          <ElDescriptionsItem label="模型">{{ detail.trace.modelName || '-' }}</ElDescriptionsItem>
          <ElDescriptionsItem label="开始时间">{{ formatDate(detail.trace.startedAt) }}</ElDescriptionsItem>
          <ElDescriptionsItem label="耗时">{{ runningDuration(detail.trace) }}</ElDescriptionsItem>
          <ElDescriptionsItem label="Token">
            {{ formatNumber(detail.trace.totalTokens) }}
            <span class="subtle">（入 {{ detail.trace.inputTokens ?? 0 }} / 出 {{ detail.trace.outputTokens ?? 0 }}）</span>
          </ElDescriptionsItem>
        </ElDescriptions>

        <ElAlert
          v-if="detail.trace.errorMessage"
          class="run-error"
          title="运行错误"
          type="error"
          :description="detail.trace.errorMessage"
          show-icon
          :closable="false"
        />

        <div class="detail-layout">
          <aside class="span-panel">
            <div class="span-panel-header">
              <h4>调用链 · {{ detail.spans.length }}</h4>
              <ElButton
                v-if="detail.spans.length"
                size="small"
                :loading="detailLoading"
                @click="loadDetail(detail.trace.id)"
              >
                刷新
              </ElButton>
            </div>
            <ElSelect v-model="spanType" clearable size="small" placeholder="全部类型" style="width: 100%">
              <ElOption label="模型调用 MODEL" value="MODEL" />
              <ElOption label="工具调用 TOOL" value="TOOL" />
            </ElSelect>
            <ElInput
              v-model="spanKeyword"
              clearable
              size="small"
              placeholder="搜索调用名称或 ID"
              style="margin-top: 8px"
            />
            <div v-loading="detailLoading" class="span-list">
              <ElEmpty v-if="!visibleSpans.length" description="没有匹配的调用" :image-size="70" />
              <ElTimeline v-else>
                <ElTimelineItem
                  v-for="(span, index) in visibleSpans"
                  :key="span.id"
                  :timestamp="formatDate(span.startedAt)"
                  :type="statusType(span.status)"
                  placement="top"
                >
                  <button
                    class="span-item"
                    :class="{ active: selectedSpanId === span.id }"
                    @click="selectSpan(span)"
                  >
                    <div class="span-item-title">
                      <ElTag size="small" :type="span.spanType === 'MODEL' ? 'primary' : 'warning'">
                        {{ index + 1 }} · {{ span.spanType }}
                      </ElTag>
                      <span>{{ formatDuration(span.durationMs) }}</span>
                    </div>
                    <strong>{{ span.name || '-' }}</strong>
                    <div class="mono subtle">{{ span.externalId || span.id }}</div>
                    <div v-if="span.errorMessage" class="error-text">{{ span.errorMessage }}</div>
                  </button>
                </ElTimelineItem>
              </ElTimeline>
            </div>
          </aside>

          <section class="payload-panel">
            <div class="payload-heading">
              <div>
                <h4>{{ selectedSpan ? `${selectedSpan.spanType} · ${selectedSpan.name || '-'}` : '运行输入 / 输出' }}</h4>
                <span v-if="selectedSpan" class="subtle mono">{{ selectedSpan.externalId }}</span>
              </div>
              <ElButton v-if="selectedSpan" size="small" @click="selectedSpanId = ''">查看运行总览</ElButton>
            </div>
            <ElTabs v-model="detailTab">
              <ElTabPane label="输入" name="input">
                <pre>{{ prettyJson(selectedSpan ? selectedSpan.inputJson : detail.trace.inputJson) || '无输入数据' }}</pre>
              </ElTabPane>
              <ElTabPane label="输出" name="output">
                <pre>{{ prettyJson(selectedSpan ? selectedSpan.outputJson : detail.trace.outputJson) || '无输出数据' }}</pre>
              </ElTabPane>
              <ElTabPane v-if="selectedSpan" label="元数据" name="metadata">
                <ElDescriptions :column="2" border size="small">
                  <ElDescriptionsItem label="类型">{{ selectedSpan.spanType }}</ElDescriptionsItem>
                  <ElDescriptionsItem label="状态">{{ statusText(selectedSpan.status) }}</ElDescriptionsItem>
                  <ElDescriptionsItem label="调用 ID">{{ selectedSpan.externalId || '-' }}</ElDescriptionsItem>
                  <ElDescriptionsItem label="耗时">{{ formatDuration(selectedSpan.durationMs) }}</ElDescriptionsItem>
                  <ElDescriptionsItem label="Token" :span="2">
                    {{ prettyJson(selectedSpan.tokenUsageJson) || '-' }}
                  </ElDescriptionsItem>
                  <ElDescriptionsItem label="错误" :span="2">{{ selectedSpan.errorMessage || '-' }}</ElDescriptionsItem>
                </ElDescriptions>
              </ElTabPane>
            </ElTabs>
          </section>
        </div>
      </template>
    </ElDrawer>
  </div>
</template>

<style scoped>
.trace-page {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 100%;
  padding: 16px;
}

.page-heading,
.heading-actions,
.filter-panel,
.pagination-bar,
.detail-heading,
.detail-title,
.span-panel-header,
.payload-heading,
.span-item-title {
  display: flex;
  align-items: center;
}

.page-heading,
.pagination-bar,
.detail-heading,
.payload-heading,
.span-panel-header {
  justify-content: space-between;
}

.page-heading h2,
.detail-title h3,
.span-panel-header h4,
.payload-heading h4 {
  margin: 0;
}

.page-heading p {
  margin: 6px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.heading-actions,
.filter-panel {
  gap: 10px;
}

.auto-refresh {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.stat-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 108px;
  padding: 16px;
  text-align: left;
  color: inherit;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}

.stat-card span,
.stat-card small {
  color: var(--el-text-color-secondary);
}

.stat-card strong {
  font-size: 26px;
  line-height: 1.2;
}

.stat-card .success {
  color: var(--el-color-success);
}

.filter-panel {
  flex-wrap: wrap;
  padding: 14px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}

.agent-name {
  font-weight: 600;
}

.subtle,
.pagination-bar {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 12px;
  overflow-wrap: anywhere;
}

.error-text {
  color: var(--el-color-danger);
}

.pagination-bar {
  align-self: flex-end;
  gap: 14px;
}

.run-summary {
  margin-top: 16px;
}

.run-error {
  margin-top: 12px;
}

.detail-layout {
  display: grid;
  grid-template-columns: 330px minmax(0, 1fr);
  gap: 16px;
  margin-top: 18px;
}

.span-panel,
.payload-panel {
  min-width: 0;
  padding: 14px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}

.span-panel-header,
.payload-heading {
  min-height: 32px;
  margin-bottom: 12px;
}

.span-list {
  max-height: calc(100vh - 390px);
  margin-top: 12px;
  overflow-y: auto;
}

.span-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  padding: 10px;
  text-align: left;
  color: inherit;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
}

.span-item:hover,
.span-item.active {
  background: var(--el-fill-color-light);
  border-color: var(--el-color-primary-light-7);
}

.span-item-title {
  justify-content: space-between;
  gap: 8px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.payload-panel pre {
  min-height: 280px;
  max-height: calc(100vh - 405px);
  padding: 14px;
  margin: 0;
  overflow: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  font-size: 12px;
}

@media (max-width: 1100px) {
  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 850px) {
  .page-heading,
  .detail-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .detail-layout {
    grid-template-columns: 1fr;
  }

  .span-list {
    max-height: 300px;
  }
}
</style>
