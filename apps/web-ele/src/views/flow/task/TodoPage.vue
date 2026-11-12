<script lang="ts" setup>
/** 我的待办：查询、办理、认领公共任务、查看实例详情（含流程图高亮）。 */
import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { FlowTaskQuery, FlowTaskVO } from '#/api/flow';

import { ref } from 'vue';

import { Page } from '@vben/common-ui';

import { ElButton, ElTag } from 'element-plus';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { claimFlowTask, FLOW_TASK_STATUS, getFlowTodoPage } from '#/api/flow';

import { withFeedback } from '../../system/shared/helpers';
import OrderDetailDrawer from '../runtime/OrderDetailDrawer.vue';
import TaskActionDialog from '../runtime/TaskActionDialog.vue';

const actionVisible = ref(false);
const detailVisible = ref(false);
const currentTask = ref<FlowTaskVO | null>(null);
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
  {
    component: 'Select',
    fieldName: 'publicPoolOnly',
    label: '任务范围',
    componentProps: {
      clearable: true,
      options: [
        { label: '仅公共任务池', value: true },
        { label: '我的待办', value: false },
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
      { field: 'taskName', title: '当前节点', minWidth: 140 },
      { field: 'initiatorName', title: '发起人', width: 120 },
      {
        field: 'status',
        title: '状态',
        width: 110,
        slots: { default: 'status' },
      },
      { field: 'approvalModeName', title: '审批模式', width: 130 },
      { field: 'assigneeName', title: '办理人', width: 120 },
      { field: 'dueTime', title: '截止时间', width: 170 },
      { field: 'createTime', title: '到达时间', width: 170 },
      {
        align: 'center',
        field: 'operation',
        fixed: 'right',
        slots: { default: 'action' },
        title: '操作',
        width: 230,
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
            publicPoolOnly: formValues?.publicPoolOnly,
            status: formValues?.status,
          }),
      },
    },
    rowConfig: { keyField: 'id' },
    toolbarConfig: { custom: true, refresh: true, zoom: true },
  } as VxeTableGridOptions<FlowTaskVO>,
});

function openAction(row: FlowTaskVO) {
  currentTask.value = row;
  actionVisible.value = true;
}

function openDetail(row: FlowTaskVO) {
  currentOrderId.value = row.workOrderId ?? '';
  detailVisible.value = true;
}

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

function refresh() {
  gridApi.query();
}
</script>

<template>
  <Page auto-content-height>
    <Grid>
      <template #status="{ row }">
        <ElTag :type="row.status === 0 ? 'primary' : 'info'" size="small">
          {{ row.statusName }}
        </ElTag>
      </template>
      <template #action="{ row }">
        <ElButton
          v-if="row.claimed === false"
          link
          type="warning"
          @click="onClaim(row)"
        >
          认领
        </ElButton>
        <ElButton link type="primary" @click="openAction(row)">办理</ElButton>
        <ElButton link @click="openDetail(row)">详情</ElButton>
      </template>
    </Grid>

    <TaskActionDialog
      v-model="actionVisible"
      :task="currentTask ?? undefined"
      @changed="refresh"
    />
    <OrderDetailDrawer
      v-model="detailVisible"
      :work-order-id="currentOrderId"
      @changed="refresh"
    />
  </Page>
</template>
