<script setup lang="ts">
import type { AiAgentTrace, AiAgentTraceSpan } from '#/api/ai';

import { onMounted, ref } from 'vue';

import {
  ElButton,
  ElDescriptions,
  ElDescriptionsItem,
  ElDialog,
  ElMessage,
  ElOption,
  ElSelect,
  ElTable,
  ElTableColumn,
  ElTag,
} from 'element-plus';

import { aiTraceApi } from '#/api/ai';

const traces = ref<AiAgentTrace[]>([]);
const spans = ref<AiAgentTraceSpan[]>([]);
const selected = ref<AiAgentTrace | null>(null);
const status = ref('');
const loading = ref(false);
const detailLoading = ref(false);
const detailVisible = ref(false);

function statusType(value?: string) {
  return value === 'SUCCESS'
    ? 'success'
    : value === 'RUNNING'
      ? 'warning'
      : value === 'CANCELLED'
        ? 'info'
        : 'danger';
}

function prettyJson(value?: string) {
  if (!value) {
    return '-';
  }
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function duration(value?: number) {
  return value == null ? '-' : `${value} ms`;
}

async function load() {
  loading.value = true;
  try {
    traces.value = await aiTraceApi.list(status.value || undefined);
  } catch (error: any) {
    ElMessage.error(error?.message || 'Trace 加载失败');
  } finally {
    loading.value = false;
  }
}

async function openDetail(row: AiAgentTrace) {
  selected.value = row;
  detailVisible.value = true;
  spans.value = [];
  detailLoading.value = true;
  try {
    const detail = await aiTraceApi.detail(row.id);
    selected.value = detail.trace;
    spans.value = detail.spans;
  } catch (error: any) {
    ElMessage.error(error?.message || 'Trace 详情加载失败');
  } finally {
    detailLoading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="trace-page">
    <div class="trace-header">
      <span class="title">Agent Trace</span>
      <ElSelect
        v-model="status"
        size="small"
        style="width: 150px"
        @change="load"
      >
        <ElOption label="全部状态" value="" />
        <ElOption label="运行中" value="RUNNING" />
        <ElOption label="成功" value="SUCCESS" />
        <ElOption label="失败" value="ERROR" />
        <ElOption label="已取消" value="CANCELLED" />
      </ElSelect>
      <ElButton size="small" @click="load">刷新</ElButton>
    </div>

    <ElTable
      v-loading="loading"
      :data="traces"
      border
      size="small"
      max-height="calc(100vh - 190px)"
    >
      <ElTableColumn prop="startedAt" label="开始时间" width="185" />
      <ElTableColumn
        prop="agentName"
        label="专家"
        min-width="130"
        show-overflow-tooltip
      />
      <ElTableColumn
        prop="modelName"
        label="模型"
        min-width="130"
        show-overflow-tooltip
      />
      <ElTableColumn label="状态" width="90">
        <template #default="{ row }">
          <ElTag :type="statusType(row.status)" size="small">
            {{ row.status }}
          </ElTag>
        </template>
      </ElTableColumn>
      <ElTableColumn prop="durationMs" label="耗时" width="100">
        <template #default="{ row }">{{ duration(row.durationMs) }}</template>
      </ElTableColumn>
      <ElTableColumn prop="inputTokens" label="输入 Token" width="105" />
      <ElTableColumn prop="outputTokens" label="输出 Token" width="105" />
      <ElTableColumn
        prop="conversationId"
        label="会话 ID"
        min-width="180"
        show-overflow-tooltip
      />
      <ElTableColumn
        prop="errorMessage"
        label="错误"
        min-width="180"
        show-overflow-tooltip
      />
      <ElTableColumn label="操作" width="90" fixed="right">
        <template #default="{ row }">
          <ElButton
            link
            type="primary"
            size="small"
            @click="openDetail(row as AiAgentTrace)"
          >
            详情
          </ElButton>
        </template>
      </ElTableColumn>
    </ElTable>

    <ElDialog v-model="detailVisible" title="Trace 详情" width="80%" top="5vh">
      <template v-if="selected">
        <ElDescriptions :column="3" border size="small">
          <ElDescriptionsItem label="Run ID">
            {{ selected.runId }}
          </ElDescriptionsItem>
          <ElDescriptionsItem label="专家">
            {{ selected.agentName }}
          </ElDescriptionsItem>
          <ElDescriptionsItem label="模型">
            {{ selected.modelName }}
          </ElDescriptionsItem>
          <ElDescriptionsItem label="状态">
            <ElTag :type="statusType(selected.status)" size="small">
              {{ selected.status }}
            </ElTag>
          </ElDescriptionsItem>
          <ElDescriptionsItem label="总耗时">
            {{ duration(selected.durationMs) }}
          </ElDescriptionsItem>
          <ElDescriptionsItem label="Token">
            {{ selected.inputTokens ?? 0 }} / {{ selected.outputTokens ?? 0 }} /
            {{ selected.totalTokens ?? 0 }}
          </ElDescriptionsItem>
          <ElDescriptionsItem label="错误" :span="3">
            {{ selected.errorMessage || '-' }}
          </ElDescriptionsItem>
        </ElDescriptions>

        <h4>模型 / 工具调用</h4>
        <ElTable
          v-loading="detailLoading"
          :data="spans"
          border
          size="small"
          max-height="300"
        >
          <ElTableColumn prop="spanType" label="类型" width="80" />
          <ElTableColumn
            prop="name"
            label="名称"
            min-width="150"
            show-overflow-tooltip
          />
          <ElTableColumn
            prop="externalId"
            label="调用 ID"
            min-width="160"
            show-overflow-tooltip
          />
          <ElTableColumn label="状态" width="90">
            <template #default="{ row }">
              <ElTag :type="statusType(row.status)" size="small">
                {{ row.status }}
              </ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn prop="durationMs" label="耗时" width="100">
            <template #default="{ row }">
              {{ duration(row.durationMs) }}
            </template>
          </ElTableColumn>
          <ElTableColumn
            prop="errorMessage"
            label="错误"
            show-overflow-tooltip
          />
        </ElTable>

        <div class="trace-json-grid">
          <section>
            <h4>输入</h4>
            <pre>{{ prettyJson(selected.inputJson) }}</pre>
          </section>
          <section>
            <h4>输出</h4>
            <pre>{{ prettyJson(selected.outputJson) }}</pre>
          </section>
        </div>
        <section v-for="span in spans" :key="span.id" class="trace-span">
          <h4>{{ span.spanType }} · {{ span.name || '-' }}</h4>
          <div class="trace-json-grid">
            <pre>{{ prettyJson(span.inputJson) }}</pre>
            <pre>{{ prettyJson(span.outputJson) }}</pre>
          </div>
        </section>
      </template>
    </ElDialog>
  </div>
</template>

<style scoped>
.trace-page {
  padding: 12px;
}

.trace-header {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
}

.title {
  margin-right: auto;
  font-size: 16px;
  font-weight: 600;
}

h4 {
  margin: 16px 0 8px;
}

.trace-json-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.trace-span {
  margin-top: 12px;
}

.trace-span h4 {
  margin-top: 0;
}

pre {
  max-height: 240px;
  padding: 10px;
  margin: 0;
  overflow: auto;
  font-size: 12px;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
}

@media (max-width: 900px) {
  .trace-json-grid {
    grid-template-columns: 1fr;
  }
}
</style>
