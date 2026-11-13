<script lang="ts" setup>
/** 待签任务：公共任务池（无人认领、多人可见），只提供认领与实例详情。 */
import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { FlowTaskQuery, FlowTaskVO } from '#/api/flow';

import { ref } from 'vue';

import { Page } from '@vben/common-ui';

import { ElButton } from 'element-plus';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { claimFlowTask, getFlowTodoPage } from '#/api/flow';

import { withFeedback } from '../../system/shared/helpers';
import OrderDetailDrawer from '../runtime/OrderDetailDrawer.vue';

const detailVisible = ref(false);
const currentOrderId = ref('');

const searchSchema: VbenFormSchema[] = [
  { component: 'Input', fieldName: 'keyword', label: '关键字' },
];

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: { schema: searchSchema, submitOnChange: true },
  gridOptions: {
    columns: [
      { field: 'orderTitle', title: '流程标题', minWidth: 200 },
      { field: 'taskName', title: '当前节点', minWidth: 140 },
      { field: 'initiatorName', title: '发起人', width: 120 },
      { field: 'statusName', title: '状态', width: 110 },
      { field: 'createTime', title: '到达时间', width: 170 },
      {
        align: 'center',
        field: 'operation',
        fixed: 'right',
        slots: { default: 'action' },
        title: '操作',
        width: 180,
      },
    ],
    height: 'auto',
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues: Partial<FlowTaskQuery>) =>
          await getFlowTodoPage({
            keyword: formValues?.keyword,
            pageNum: page.currentPage,
            pageSize: page.pageSize,
            publicPoolOnly: true,
          }),
      },
    },
    rowConfig: { keyField: 'id' },
    toolbarConfig: { custom: true, refresh: true, zoom: true },
  } as VxeTableGridOptions<FlowTaskVO>,
});

async function onClaim(row: FlowTaskVO) {
  const ok = await withFeedback(
    () =>
      claimFlowTask({
        action: 'CLAIM',
        taskInstanceId: row.id,
        workOrderId: row.workOrderId,
      }),
    '认领成功',
  );
  if (ok) gridApi.query();
}

function openDetail(row: FlowTaskVO) {
  currentOrderId.value = row.workOrderId ?? '';
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
        <ElButton link type="warning" @click="onClaim(row)">认领</ElButton>
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
