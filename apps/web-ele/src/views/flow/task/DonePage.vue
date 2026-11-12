<script lang="ts" setup>
/** 我的已办：只读列表 + 实例详情（流程图高亮 / 审批历史 / 变量）。 */
import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { FlowTaskQuery, FlowTaskVO } from '#/api/flow';

import { ref } from 'vue';

import { Page } from '@vben/common-ui';

import { ElButton, ElTag } from 'element-plus';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { FLOW_TASK_STATUS, getFlowDonePage } from '#/api/flow';

import OrderDetailDrawer from '../runtime/OrderDetailDrawer.vue';

const detailVisible = ref(false);
const currentOrderId = ref('');

const searchSchema: VbenFormSchema[] = [
  { component: 'Input', fieldName: 'keyword', label: '关键字' },
  {
    component: 'Select',
    fieldName: 'status',
    label: '任务状态',
    componentProps: {
      clearable: true,
      options: FLOW_TASK_STATUS.map((item) => ({
        label: item.label,
        value: item.value,
      })),
      placeholder: '全部',
    },
  },
];

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: { schema: searchSchema, submitOnChange: true },
  gridOptions: {
    columns: [
      { field: 'orderTitle', title: '流程标题', minWidth: 200 },
      { field: 'taskName', title: '办理节点', minWidth: 140 },
      { field: 'initiatorName', title: '发起人', width: 120 },
      {
        field: 'status',
        title: '状态',
        width: 110,
        slots: { default: 'status' },
      },
      { field: 'approvalModeName', title: '审批模式', width: 130 },
      { field: 'durationMs', title: '耗时(ms)', width: 120 },
      { field: 'createTime', title: '到达时间', width: 170 },
      { field: 'endTime', title: '办理时间', width: 170 },
      {
        align: 'center',
        field: 'operation',
        fixed: 'right',
        slots: { default: 'action' },
        title: '操作',
        width: 100,
      },
    ],
    height: 'auto',
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues: Partial<FlowTaskQuery>) =>
          await getFlowDonePage({
            keyword: formValues?.keyword,
            pageNum: page.currentPage,
            pageSize: page.pageSize,
            status: formValues?.status,
          }),
      },
    },
    rowConfig: { keyField: 'id' },
    toolbarConfig: { custom: true, refresh: true, zoom: true },
  } as VxeTableGridOptions<FlowTaskVO>,
});

function openDetail(row: FlowTaskVO) {
  currentOrderId.value = row.workOrderId ?? '';
  detailVisible.value = true;
}
</script>

<template>
  <Page auto-content-height>
    <Grid>
      <template #status="{ row }">
        <ElTag :type="row.status === 2 ? 'success' : 'info'" size="small">
          {{ row.statusName }}
        </ElTag>
      </template>
      <template #action="{ row }">
        <ElButton link type="primary" @click="openDetail(row)">详情</ElButton>
      </template>
    </Grid>

    <OrderDetailDrawer
      v-model="detailVisible"
      :work-order-id="currentOrderId"
      @changed="gridApi.query()"
    />
  </Page>
</template>
