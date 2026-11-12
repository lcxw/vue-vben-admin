<script lang="ts" setup>
/** 我发起的：列表 + 发起 + 暂存提交 + 撤回/终止 + 实例详情。 */
import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { FlowTaskQuery, FlowWorkOrderVO } from '#/api/flow';

import { ref } from 'vue';

import { Page } from '@vben/common-ui';

import { ElButton, ElTag } from 'element-plus';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  FLOW_ORDER_STATUS,
  getFlowMinePage,
  submitFlowDraft,
  terminateFlow,
  withdrawFlow,
} from '#/api/flow';

import { confirmAction, withFeedback } from '../../system/shared/helpers';
import OrderDetailDrawer from './OrderDetailDrawer.vue';
import StartDialog from './StartDialog.vue';

const startVisible = ref(false);
const detailVisible = ref(false);
const currentOrderId = ref('');

const searchSchema: VbenFormSchema[] = [
  { component: 'Input', fieldName: 'keyword', label: '关键字' },
  {
    component: 'Select',
    fieldName: 'status',
    label: '流程状态',
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
      {
        field: 'status',
        title: '状态',
        width: 110,
        slots: { default: 'status' },
      },
      { field: 'publishVersion', title: '版本', width: 80 },
      { field: 'businessKey', title: '业务主键', width: 140 },
      { field: 'startTime', title: '发起时间', width: 170 },
      { field: 'endTime', title: '结束时间', width: 170 },
      {
        align: 'center',
        field: 'operation',
        fixed: 'right',
        slots: { default: 'action' },
        title: '操作',
        width: 220,
      },
    ],
    height: 'auto',
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues: Partial<FlowTaskQuery>) =>
          await getFlowMinePage({
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

function refresh() {
  gridApi.query();
}

function openDetail(row: FlowWorkOrderVO) {
  currentOrderId.value = row.workOrderId;
  detailVisible.value = true;
}

async function onSubmitDraft(row: FlowWorkOrderVO) {
  const ok = await withFeedback(
    () => submitFlowDraft(row.workOrderId),
    '草稿已提交',
  );
  if (ok) refresh();
}

async function onWithdraw(row: FlowWorkOrderVO) {
  if (!(await confirmAction(`确定撤回「${row.title ?? ''}」吗？`))) return;
  const ok = await withFeedback(() => withdrawFlow(row.workOrderId), '已撤回');
  if (ok) refresh();
}

async function onTerminate(row: FlowWorkOrderVO) {
  if (!(await confirmAction(`确定终止「${row.title ?? ''}」吗？`))) return;
  const ok = await withFeedback(
    () => terminateFlow(row.workOrderId, '发起人终止'),
    '已终止',
  );
  if (ok) refresh();
}

type TagType = 'danger' | 'info' | 'primary' | 'success' | 'warning';

function statusTagType(status?: number): TagType {
  if (status === 0) return 'primary';
  if (status === 1) return 'warning';
  if (status === 2) return 'success';
  if (status === 6) return 'info';
  return 'danger';
}
</script>

<template>
  <Page auto-content-height>
    <Grid>
      <template #toolbar-tools>
        <ElButton type="primary" @click="startVisible = true">
          发起流程
        </ElButton>
      </template>
      <template #status="{ row }">
        <ElTag :type="statusTagType(row.status)" size="small">
          {{ row.statusName }}
        </ElTag>
      </template>
      <template #action="{ row }">
        <ElButton
          v-if="row.status === 6"
          link
          type="primary"
          @click="onSubmitDraft(row)"
        >
          提交
        </ElButton>
        <ElButton
          v-if="row.status === 0"
          link
          type="warning"
          @click="onWithdraw(row)"
        >
          撤回
        </ElButton>
        <ElButton
          v-if="row.status === 0 || row.status === 1"
          link
          type="danger"
          @click="onTerminate(row)"
        >
          终止
        </ElButton>
        <ElButton link @click="openDetail(row)">详情</ElButton>
      </template>
    </Grid>

    <StartDialog v-model="startVisible" @changed="refresh" />
    <OrderDetailDrawer
      v-model="detailVisible"
      :work-order-id="currentOrderId"
      @changed="refresh"
    />
  </Page>
</template>
