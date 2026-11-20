<script lang="ts" setup>
/**
 * 单个统计图表卡片（维度+指标聚合，借鉴橙单图表组件的产品能力）。
 * 独立组件承载独立 echarts 实例（@vben/plugins/echarts 的 useEcharts 为单实例设计）。
 */
import type { AggregateChart } from '#/api/online';

import { computed, ref, watch } from 'vue';

import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

const props = defineProps<{ chart: AggregateChart }>();

const chartRef = ref<InstanceType<typeof EchartsUI>>();
const { renderEcharts } = useEcharts(chartRef);

const option = computed(() => {
  const chart = props.chart;
  if (chart.type === 'pie') {
    return {
      tooltip: { trigger: 'item' },
      legend: { bottom: 0 },
      series: [
        {
          type: 'pie',
          radius: '62%',
          data: chart.data.map((d) => ({ name: d.name, value: Number(d.value) || 0 })),
        },
      ],
    };
  }
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 50, right: 20, bottom: 70, top: 30 },
    xAxis: { type: 'category', data: chart.data.map((d) => d.name), axisLabel: { rotate: 30 } },
    yAxis: { type: 'value' },
    series: [
      {
        type: chart.type === 'line' ? 'line' : 'bar',
        data: chart.data.map((d) => Number(d.value) || 0),
        itemStyle: { borderRadius: [4, 4, 0, 0] },
      },
    ],
  };
});

watch(
  () => props.chart,
  async () => {
    await renderEcharts(option.value as never);
  },
  { immediate: true, deep: true },
);
</script>

<template>
  <div class="online-chart-card">
    <div class="oc-title">{{ chart.title }}</div>
    <EchartsUI ref="chartRef" height="260px" />
  </div>
</template>

<style scoped>
.online-chart-card {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 14px;
}
.oc-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
}
</style>
