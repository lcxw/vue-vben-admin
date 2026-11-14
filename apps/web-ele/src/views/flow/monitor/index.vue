<script lang="ts" setup>
/**
 * 流程监控（阶段 6 图表化）。
 *
 * 数据来自 /flow/monitor/{statistics,trend,efficiency,ranking}，全部只读。
 * 相比阶段 4B 的「4 卡片 + 2 表格」：
 * 1. 引入项目已有的 EchartsUI：发起/完成趋势折线、状态分布环图、节点耗时条形；
 * 2. 流程定义 / 时间区间 / 分桶筛选联动，变化即自动重载；
 * 3. 新增 Top 流程排行（实例数、完成率、平均耗时）；
 * 4. 统计后端改为 SQL 分组聚合，不再全表拉回内存。
 */
import type { EchartsUIType } from '@vben/plugins/echarts';

import type {
  FlowEntryVO,
  FlowOrderReq,
  FlowRankingRow,
  FlowStatisticsVO,
  FlowTrendRow,
} from '#/api/flow';

import { computed, nextTick, onMounted, ref, watch } from 'vue';

import { Page } from '@vben/common-ui';
import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

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
  getFlowRanking,
  getFlowStatistics,
  getFlowTrend,
} from '#/api/flow';

const loading = ref(false);
const statistics = ref<FlowStatisticsVO>({});
const trendRows = ref<FlowTrendRow[]>([]);
const efficiencyRows = ref<Array<Record<string, unknown>>>([]);
const rankingRows = ref<FlowRankingRow[]>([]);
const entries = ref<FlowEntryVO[]>([]);
const selectedEntryId = ref('');
const range = ref<'7d' | '30d' | 'all'>('30d');
const interval = ref<'day' | 'month' | 'week'>('day');

const trendChartRef = ref<EchartsUIType>();
const statusChartRef = ref<EchartsUIType>();
const efficiencyChartRef = ref<EchartsUIType>();
const { renderEcharts: renderTrend } = useEcharts(trendChartRef);
const { renderEcharts: renderStatus } = useEcharts(statusChartRef);
const { renderEcharts: renderEfficiency } = useEcharts(efficiencyChartRef);

const statusRows = computed(() =>
  Object.entries(statistics.value.byStatus ?? {}).map(([name, count]) => ({
    name,
    value: Number(count ?? 0),
  })),
);

function localDateTime(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  // 后端 JacksonConfiguration 的全局 LocalDateTime 格式是 yyyy-MM-dd HH:mm:ss，
  // 用 ISO 的 T 分隔会被判为「参数转换异常」（index 10），这里必须输出空格。
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function queryParams(): FlowOrderReq {
  const params: FlowOrderReq = {
    entryId: selectedEntryId.value || undefined,
    interval: interval.value,
  };
  if (range.value !== 'all') {
    const days = range.value === '7d' ? 7 : 30;
    params.from = localDateTime(new Date(Date.now() - days * 86_400_000));
    params.to = localDateTime(new Date());
  }
  return params;
}

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

function minutes(value: unknown): number {
  return Number((num(value) / 60_000).toFixed(2));
}

const returnRateText = computed(
  () => `${(num(statistics.value.returnRate) * 100).toFixed(1)}%`,
);

function renderCharts() {
  void nextTick(() => {
    renderTrend({
      grid: { bottom: 40, left: 48, right: 18, top: 24 },
      legend: { bottom: 0, data: ['发起', '完成'] },
      series: [
        {
          data: trendRows.value.map((row) => num(row.started)),
          itemStyle: { color: '#5ab1ef' },
          name: '发起',
          smooth: true,
          type: 'line',
        },
        {
          data: trendRows.value.map((row) => num(row.completed)),
          itemStyle: { color: '#67e0e3' },
          name: '完成',
          smooth: true,
          type: 'line',
        },
      ],
      tooltip: { trigger: 'axis' },
      xAxis: {
        data: trendRows.value.map((row) => row.bucket ?? ''),
        type: 'category',
      },
      yAxis: { type: 'value' },
    });

    renderStatus({
      legend: { bottom: 0, left: 'center' },
      series: [
        {
          data: statusRows.value,
          itemStyle: { borderRadius: 8, borderWidth: 2 },
          name: '实例状态',
          radius: ['42%', '68%'],
          type: 'pie',
        },
      ],
      tooltip: { trigger: 'item' },
    });

    renderEfficiency({
      grid: { bottom: 24, left: 110, right: 28, top: 12 },
      series: [
        {
          data: efficiencyRows.value.map((row) => minutes(row.avgDurationMs)),
          itemStyle: { color: '#b6a2de' },
          type: 'bar',
        },
      ],
      tooltip: {
        formatter: (params: unknown) => {
          const index = (params as { dataIndex?: number })?.dataIndex ?? 0;
          const row = efficiencyRows.value[index] ?? {};
          return `${row.nodeName ?? ''}<br/>平均 ${durationText(row.avgDurationMs)} / 最长 ${durationText(row.maxDurationMs)}`;
        },
        trigger: 'axis',
      },
      xAxis: { name: '分钟', type: 'value' },
      yAxis: {
        data: efficiencyRows.value.map((row) => String(row.nodeName ?? '')),
        type: 'category',
      },
    });
  });
}

async function load() {
  loading.value = true;
  try {
    const params = queryParams();
    const [stat, trends, efficiency, ranking] = await Promise.all([
      getFlowStatistics(params),
      getFlowTrend(params),
      getFlowEfficiency(selectedEntryId.value || undefined),
      getFlowRanking(params),
    ]);
    statistics.value = stat ?? {};
    trendRows.value = Array.isArray(trends) ? trends : [];
    efficiencyRows.value = Array.isArray(efficiency) ? efficiency : [];
    rankingRows.value = Array.isArray(ranking) ? ranking : [];
  } catch (error) {
    console.error('[flow] load monitor statistics failed', error);
    statistics.value = {};
    trendRows.value = [];
    efficiencyRows.value = [];
    rankingRows.value = [];
  } finally {
    loading.value = false;
    renderCharts();
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

// 筛选联动：流程定义 / 时间区间 / 分桶任一变化即自动重载，无需手点刷新
watch([selectedEntryId, range, interval], () => {
  void load();
});
</script>

<template>
  <Page auto-content-height>
    <div class="monitor">
      <div class="monitor__toolbar">
        <ElSelect
          v-model="selectedEntryId"
          clearable
          filterable
          placeholder="全部流程"
          style="width: 230px"
        >
          <ElOption
            v-for="item in entries"
            :key="item.entryId"
            :label="item.processDefinitionName"
            :value="item.entryId"
          />
        </ElSelect>
        <ElSelect v-model="range" style="width: 130px">
          <ElOption label="近 7 天" value="7d" />
          <ElOption label="近 30 天" value="30d" />
          <ElOption label="全部时间" value="all" />
        </ElSelect>
        <ElSelect v-model="interval" style="width: 120px">
          <ElOption label="按日" value="day" />
          <ElOption label="按周" value="week" />
          <ElOption label="按月" value="month" />
        </ElSelect>
        <ElButton :loading="loading" @click="load">刷新统计</ElButton>
      </div>

      <ElRow :gutter="12" class="monitor__cards">
        <ElCol :span="6">
          <ElCard shadow="never">
            <div class="card-label">流程实例总数</div>
            <div class="card-value">{{ num(statistics.totalOrders) }}</div>
          </ElCard>
        </ElCol>
        <ElCol :span="6">
          <ElCard shadow="never">
            <div class="card-label">待办积压任务</div>
            <div class="card-value card-value--warning">
              {{ num(statistics.backlogTasks) }}
            </div>
          </ElCard>
        </ElCol>
        <ElCol :span="6">
          <ElCard shadow="never">
            <div class="card-label">退回 / 驳回实例</div>
            <div class="card-value card-value--danger">
              {{ num(statistics.returnedOrders) }}
              <small>退回率 {{ returnRateText }}</small>
            </div>
          </ElCard>
        </ElCol>
        <ElCol :span="6">
          <ElCard shadow="never">
            <div class="card-label">平均耗时</div>
            <div class="card-value">
              {{ durationText(statistics.avgDurationMs) }}
            </div>
          </ElCard>
        </ElCol>
      </ElRow>

      <ElRow :gutter="12">
        <ElCol :span="16">
          <ElCard shadow="never">
            <template #header>发起 / 完成趋势</template>
            <EchartsUI ref="trendChartRef" height="280px" />
          </ElCard>
        </ElCol>
        <ElCol :span="8">
          <ElCard shadow="never">
            <template #header>实例状态分布</template>
            <EchartsUI ref="statusChartRef" height="280px" />
          </ElCard>
        </ElCol>
      </ElRow>

      <ElRow :gutter="12" class="monitor__bottom">
        <ElCol :span="12">
          <ElCard shadow="never">
            <template #header>节点耗时（分钟，定位瓶颈）</template>
            <EchartsUI ref="efficiencyChartRef" height="260px" />
          </ElCard>
        </ElCol>
        <ElCol :span="12">
          <ElCard shadow="never">
            <template #header>流程排行</template>
            <ElTable :data="rankingRows" height="260" size="small">
              <ElTableColumn
                prop="entryName"
                label="流程定义"
                min-width="150"
                show-overflow-tooltip
              />
              <ElTableColumn prop="total" label="实例数" width="90" />
              <ElTableColumn label="完成率" width="100">
                <template #default="{ row }">
                  {{ (num(row.completionRate) * 100).toFixed(1) }}%
                </template>
              </ElTableColumn>
              <ElTableColumn label="平均耗时" width="120">
                <template #default="{ row }">
                  {{ durationText(row.avgDurationMs) }}
                </template>
              </ElTableColumn>
            </ElTable>
          </ElCard>
        </ElCol>
      </ElRow>
    </div>
  </Page>
</template>

<style scoped>
.monitor {
  padding: 4px;
}

.monitor__toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.monitor__cards {
  margin-bottom: 12px;
}

.monitor__bottom {
  margin-top: 12px;
}

.card-label {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.card-value {
  margin-top: 8px;
  font-size: 24px;
  font-weight: 500;
}

.card-value small {
  margin-left: 8px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  font-weight: 400;
}

.card-value--warning {
  color: var(--el-color-warning);
}

.card-value--danger {
  color: var(--el-color-danger);
}
</style>
