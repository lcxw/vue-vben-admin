<script lang="ts" setup>
/** 全部流程实例（管理视图）：不按发起人过滤，支持按标题/状态检索与查看详情。 */
import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { FlowTaskQuery, FlowWorkOrderVO } from '#/api/flow';

import { ref } from 'vue';

import { Page } from '@vben/common-ui';

import { ElButton } from 'element-plus';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { FLOW_ORDER_STATUS, getFlowInstancePage } from '#/api/flow';

import OrderDetailDrawer from './OrderDetailDrawer.vue';

const detailVisible = ref(false);
const currentOrderId = ref('');

const searchSchema: VbenFormSchema[] = [
  { component: 'Input', fieldName: 'keyword', label: '关键字' },
  {
    component: 'Select',
    fieldName: 'status',
    label: '工单状态',
    componentProps: {
      clearable: true,
      options: FLOW_ORDER_STATUS.map((item) => ({
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
      { field: 'title', title: '流程标题', minWidth: 200 },
      { field: 'entryName', title: '流程定义', minWidth: 160 },
      { field: 'initiatorName', title: '发起人', width: 120 },
      { field: 'statusName', title: '状态', width: 110 },
      { field: 'startTime', title: '开始时间', width: 170 },
      { field: 'endTime', title: '结束时间', width: 170 },
      {
        align: 'center',
        field: 'operation',
        fixed: 'right',
        slots: { default: 'action' },
        title: '操作',
        width: 120,
      },
    ],
    height: 'auto',
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues: Partial<FlowTaskQuery>) =>
          await getFlowInstancePage({
            keyword: formValues?.keyword,
            pageNum: page.currentPage,
            pageSize: page.pageSize,
            status: formValues?.status,
          }),
      },
    },
    rowConfig: { keyField: 'workOrderId' },
    toolbarConfig: { custom: true, refresh: true, zoom: true },
  } as VxeTableGridOptions<FlowWorkOrderVO>,
});

function openDetail(row: FlowWorkOrderVO) {
  currentOrderId.value = row.workOrderId;
  detailVisible.value = true;
}

function refresh() {
  gridApi.query();
}
</script>

<template>
  <Page auto-content-height>
    <Grid>
      <template #action="{ row }">
        <ElButton link @click="openDetail(row)">详情</ElButton>
      </template>
    </Grid>

    <OrderDetailDrawer
      v-model="detailVisible"
      :work-order-id="currentOrderId"
      @changed="refresh"
    />
  </Page>
</template>
