<script lang="ts" setup>
/** 我的抄送：抄送/传阅/沟通记录，支持未读筛选、标记已阅与工单详情。 */
import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { FlowCcVO, FlowTaskQuery } from '#/api/flow';

import { ref } from 'vue';

import { Page } from '@vben/common-ui';

import { ElButton, ElTag } from 'element-plus';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { executeFlowAction, getFlowCcPage } from '#/api/flow';

import { withFeedback } from '../../system/shared/helpers';
import OrderDetailDrawer from '../runtime/OrderDetailDrawer.vue';

const detailVisible = ref(false);
const currentOrderId = ref('');

const searchSchema: VbenFormSchema[] = [
  {
    component: 'Select',
    fieldName: 'readFlag',
    label: '阅读状态',
    componentProps: {
      clearable: true,
      options: [
        { label: '未读', value: 0 },
        { label: '已读', value: 1 },
      ],
      placeholder: '全部',
    },
  },
];

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: { schema: searchSchema, submitOnChange: true },
  gridOptions: {
    columns: [
      { field: 'orderTitle', title: '流程标题', minWidth: 200 },
      { field: 'ccType', title: '抄送类型', width: 120 },
      { field: 'initiatorName', title: '发起人', width: 120 },
      { field: 'senderId', title: '抄送人', width: 120 },
      { field: 'content', title: '附言', minWidth: 160 },
      {
        field: 'readFlag',
        title: '阅读状态',
        width: 110,
        slots: { default: 'read' },
      },
      { field: 'orderStatusName', title: '工单状态', width: 120 },
      { field: 'createTime', title: '抄送时间', width: 170 },
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
          await getFlowCcPage({
            pageNum: page.currentPage,
            pageSize: page.pageSize,
            readFlag: formValues?.readFlag,
          }),
      },
    },
    rowConfig: { keyField: 'id' },
    toolbarConfig: { custom: true, refresh: true, zoom: true },
  } as VxeTableGridOptions<FlowCcVO>,
});

async function onRead(row: FlowCcVO) {
  const ok = await withFeedback(
    () =>
      executeFlowAction({
        action: 'READ',
        taskInstanceId: row.taskInstanceId,
        workOrderId: row.workOrderId,
      }),
    '已标记为已阅',
  );
  if (ok) gridApi.query();
}

function openDetail(row: FlowCcVO) {
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
      <template #read="{ row }">
        <ElTag :type="row.readFlag === 0 ? 'warning' : 'info'" size="small">
          {{ row.readFlag === 0 ? '未读' : '已读' }}
        </ElTag>
      </template>
      <template #action="{ row }">
        <ElButton
          v-if="row.readFlag === 0"
          link
          type="primary"
          @click="onRead(row)"
        >
          标记已阅
        </ElButton>
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
