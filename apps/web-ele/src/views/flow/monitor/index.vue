<script lang="ts" setup>
/**
 * 流程监控：统计概览（总量/积压/退回率/平均耗时）+ 状态分布 + 节点效率瓶颈。
 * 数据来自 /flow/monitor/statistics 与 /flow/monitor/efficiency，均为只读接口。
 */
import type { FlowEntryVO } from '#/api/flow';

import { computed, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  ElButton,
  ElCard,
  ElCol,
  ElOption,
  ElRow,
  ElSelect,
  ElTable,
  ElTableColumn,
} from 'element-plus';

import {
  getFlowEfficiency,
  getFlowEntryList,
  getFlowStatistics,
} from '#/api/flow';

const loading = ref(false);
const statistics = ref<Record<string, unknown>>({});
const efficiencyRows = ref<Array<Record<string, unknown>>>([]);
const entries = ref<FlowEntryVO[]>([]);
const selectedEntryId = ref('');

const statusRows = computed<Array<{ count: unknown; name: string }>>(() => {
  const byStatus = statistics.value.byStatus;
  if (!byStatus || typeof byStatus !== 'object') return [];
  return Object.entries(byStatus as Record<string, unknown>).map(
    ([name, count]) => ({ count, name }),
  );
});

function num(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function durationText(value: unknown): string {
  const ms = num(value);
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${(ms / 60_000).toFixed(1)} min`;
}

async function load() {
  loading.value = true;
  try {
    const [stat, rows] = await Promise.all([
      getFlowStatistics({}),
      getFlowEfficiency(selectedEntryId.value || undefined),
    ]);
    statistics.value = stat ?? {};
    efficiencyRows.value = Array.isArray(rows) ? rows : [];
  } catch (error) {
    console.error('[flow] load monitor statistics failed', error);
    statistics.value = {};
    efficiencyRows.value = [];
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  try {
    entries.value = await getFlowEntryList();
  } catch (error) {
    console.error('[flow] load entries failed', error);
  }
  await load();
});
</script>

<template>
  <Page auto-content-height>
    <div v-loading="loading" class="monitor-page">
      <div class="monitor-toolbar">
        <ElSelect
          v-model="selectedEntryId"
          clearable
          filterable
          placeholder="全部流程（节点效率按流程筛选）"
          style="width: 280px"
        >
          <ElOption
            v-for="item in entries"
            :key="item.entryId"
            :label="item.processDefinitionName"
            :value="item.entryId"
          />
        </ElSelect>
        <ElButton type="primary" @click="load">刷新统计</ElButton>
      </div>

      <ElRow :gutter="12">
        <ElCol :span="6">
          <ElCard shadow="never">
            <div class="metric-label">流程实例总数</div>
            <div class="metric-value">
              {{ num(statistics.totalOrders) }}
            </div>
          </ElCard>
        </ElCol>
        <ElCol :span="6">
          <ElCard shadow="never">
            <div class="metric-label">待办积压任务</div>
            <div class="metric-value">
              {{ num(statistics.backlogTasks) }}
            </div>
          </ElCard>
        </ElCol>
        <ElCol :span="6">
          <ElCard shadow="never">
            <div class="metric-label">退回/驳回实例</div>
            <div class="metric-value">
              {{ num(statistics.returnedOrders) }}
            </div>
            <div class="metric-sub">
              退回率 {{ (num(statistics.returnRate) * 100).toFixed(1) }}%
            </div>
          </ElCard>
        </ElCol>
        <ElCol :span="6">
          <ElCard shadow="never">
            <div class="metric-label">平均耗时</div>
            <div class="metric-value">
              {{ durationText(statistics.avgDurationMs) }}
            </div>
          </ElCard>
        </ElCol>
      </ElRow>

      <ElRow :gutter="12" class="monitor-tables">
        <ElCol :span="10">
          <h4>实例状态分布</h4>
          <ElTable :data="statusRows" border size="small">
            <ElTableColumn prop="name" label="状态" min-width="140" />
            <ElTableColumn prop="count" label="数量" width="100" />
          </ElTable>
        </ElCol>
        <ElCol :span="14">
          <h4>节点效率（按平均耗时倒序，定位瓶颈）</h4>
          <ElTable :data="efficiencyRows" border size="small" max-height="360">
            <ElTableColumn prop="nodeName" label="节点" min-width="160" />
            <ElTableColumn prop="count" label="办理次数" width="110" />
            <ElTableColumn label="平均耗时" width="130">
              <template #default="{ row }">
                {{ durationText(row.avgDurationMs) }}
              </template>
            </ElTableColumn>
            <ElTableColumn label="最大耗时" width="130">
              <template #default="{ row }">
                {{ durationText(row.maxDurationMs) }}
              </template>
            </ElTableColumn>
          </ElTable>
        </ElCol>
      </ElRow>
    </div>
  </Page>
</template>

<style scoped>
.monitor-toolbar {
  display: flex;
  gap: 10px;
  margin-bottom: 14px;
}

.metric-label {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.metric-value {
  margin-top: 6px;
  font-size: 26px;
  font-weight: 600;
}

.metric-sub {
  margin-top: 4px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.monitor-tables {
  margin-top: 18px;
}

.monitor-tables h4 {
  margin: 0 0 8px;
}
</style>
