<script lang="ts" setup>
/**
 * 全部流程实例（管理视图，阶段 6）。
 *
 * 相比阶段 4C 只有「详情」：新增流程变量查看/编辑、挂起/唤醒、终止（停止）、
 * 删除实例（仅终态、二次确认）、批量删除，以及状态标签与权限提示。
 */
import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { FlowTaskQuery, FlowWorkOrderVO } from '#/api/flow';

import { ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  ElButton,
  ElDialog,
  ElEmpty,
  ElInput,
  ElMessage,
  ElMessageBox,
  ElTable,
  ElTableColumn,
  ElTag,
} from 'element-plus';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  activateFlow,
  deleteFlowInstance,
  FLOW_ORDER_STATUS,
  getFlowInstancePage,
  getFlowVariables,
  setFlowVariables,
  suspendFlow,
  terminateFlow,
} from '#/api/flow';

import { withFeedback } from '../../system/shared/helpers';
import OrderDetailDrawer from './OrderDetailDrawer.vue';

const FINAL_STATUSES = new Set([2, 3, 4, 5]);

const detailVisible = ref(false);
const currentOrderId = ref('');
const variableVisible = ref(false);
const variableOrderId = ref('');
const variableSaving = ref(false);
const variableRows = ref<Array<{ key: string; value: string }>>([]);

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
    checkboxConfig: { highlight: true },
    columns: [
      { type: 'checkbox', width: 46 },
      { field: 'title', title: '流程标题', minWidth: 200 },
      { field: 'entryName', title: '流程定义', minWidth: 150 },
      { field: 'initiatorName', title: '发起人', width: 110 },
      {
        field: 'status',
        title: '状态',
        width: 110,
        slots: { default: 'status' },
      },
      { field: 'startTime', title: '开始时间', width: 160 },
      { field: 'endTime', title: '结束时间', width: 160 },
      {
        align: 'center',
        field: 'operation',
        fixed: 'right',
        slots: { default: 'action' },
        title: '操作',
        width: 330,
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

function refresh() {
  gridApi.query();
}

function openDetail(row: FlowWorkOrderVO) {
  currentOrderId.value = row.workOrderId;
  detailVisible.value = true;
}

function isFinal(row: FlowWorkOrderVO): boolean {
  return FINAL_STATUSES.has(Number(row.status));
}

function parseValue(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed === '') return '';
  try {
    return JSON.parse(trimmed);
  } catch {
    return text;
  }
}

async function openVariables(row: FlowWorkOrderVO) {
  variableOrderId.value = row.workOrderId;
  try {
    const vars = (await getFlowVariables(row.workOrderId)) ?? {};
    variableRows.value = Object.entries(vars).map(([key, value]) => ({
      key,
      value: typeof value === 'string' ? value : JSON.stringify(value),
    }));
  } catch (error) {
    console.error('[flow] load variables failed', error);
    ElMessage.error('流程变量加载失败');
    return;
  }
  variableVisible.value = true;
}

function addVariableRow() {
  variableRows.value = [...variableRows.value, { key: '', value: '' }];
}

function removeVariableRow(index: number) {
  variableRows.value = variableRows.value.filter((_, i) => i !== index);
}

async function saveVariables() {
  const payload: Record<string, unknown> = {};
  for (const row of variableRows.value) {
    const key = row.key.trim();
    if (key) payload[key] = parseValue(row.value);
  }
  variableSaving.value = true;
  const ok = await withFeedback(
    () => setFlowVariables(variableOrderId.value, payload),
    '流程变量已保存',
  );
  variableSaving.value = false;
  if (ok) variableVisible.value = false;
}

async function onSuspend(row: FlowWorkOrderVO) {
  const ok = await withFeedback(
    () => suspendFlow(row.workOrderId),
    '流程已挂起',
  );
  if (ok) refresh();
}

async function onActivate(row: FlowWorkOrderVO) {
  const ok = await withFeedback(
    () => activateFlow(row.workOrderId),
    '流程已唤醒',
  );
  if (ok) refresh();
}

async function onTerminate(row: FlowWorkOrderVO) {
  try {
    const { value } = await ElMessageBox.prompt(
      '终止后流程不可恢复，请填写原因',
      '终止流程',
      {
        confirmButtonText: '终止',
        inputPlaceholder: '终止原因',
        type: 'warning',
      },
    );
    const ok = await withFeedback(
      () => terminateFlow(row.workOrderId, value),
      '流程已终止',
    );
    if (ok) refresh();
  } catch {
    // 用户取消
  }
}

async function askDeleteReason(count: number): Promise<null | string> {
  try {
    const result = await ElMessageBox.prompt(
      `将删除 ${count} 条已结束实例及其任务、审批意见、抄送、变量与通知记录（逻辑删除）。请输入 DELETE 确认。`,
      '删除流程实例',
      {
        confirmButtonText: '删除',
        inputErrorMessage: '请输入 DELETE',
        inputPattern: /^DELETE$/,
        inputPlaceholder: 'DELETE',
        type: 'warning',
      },
    );
    return result.value;
  } catch {
    return null;
  }
}

async function deleteRows(rows: FlowWorkOrderVO[]) {
  const deletable = rows.filter((row) => isFinal(row));
  if (deletable.length === 0) {
    ElMessage.warning('只能删除已结束的流程实例；运行中的实例请先「终止」');
    return;
  }
  const reason = await askDeleteReason(deletable.length);
  if (reason === null) return;
  let success = 0;
  for (const row of deletable) {
    try {
      await deleteFlowInstance(row.workOrderId, reason || '管理视图删除');
      success += 1;
    } catch (error) {
      console.error('[flow] delete instance failed', row.workOrderId, error);
    }
  }
  if (success > 0) ElMessage.success(`已删除 ${success} 条流程实例`);
  refresh();
}

function onBatchDelete() {
  const rows: FlowWorkOrderVO[] = gridApi.grid.getCheckboxRecords?.() ?? [];
  if (rows.length === 0) {
    ElMessage.warning('请先勾选要删除的流程实例');
    return;
  }
  void deleteRows(rows);
}
</script>

<template>
  <Page auto-content-height>
    <Grid>
      <template #status="{ row }">
        <ElTag
          :type="
            row.status === 0 ? 'primary' : row.status === 1 ? 'warning' : 'info'
          "
          size="small"
        >
          {{ row.statusName }}
        </ElTag>
      </template>
      <template #action="{ row }">
        <ElButton link type="primary" @click="openVariables(row)">
          变量
        </ElButton>
        <ElButton v-if="row.status === 0" link @click="onSuspend(row)">
          挂起
        </ElButton>
        <ElButton v-if="row.status === 1" link @click="onActivate(row)">
          唤醒
        </ElButton>
        <ElButton
          v-if="row.status === 0 || row.status === 1"
          link
          type="danger"
          @click="onTerminate(row)"
        >
          停止
        </ElButton>
        <ElButton
          v-if="isFinal(row)"
          link
          type="danger"
          @click="deleteRows([row])"
        >
          删除
        </ElButton>
        <ElButton link @click="openDetail(row)">详情</ElButton>
      </template>
      <template #toolbar-actions>
        <ElButton type="danger" plain size="small" @click="onBatchDelete">
          批量删除
        </ElButton>
      </template>
    </Grid>

    <OrderDetailDrawer
      v-model="detailVisible"
      :work-order-id="currentOrderId"
      @changed="refresh"
    />

    <ElDialog
      v-model="variableVisible"
      title="流程变量"
      width="680px"
      destroy-on-close
    >
      <ElTable :data="variableRows" size="small" max-height="360">
        <ElTableColumn label="变量名" min-width="180">
          <template #default="{ row }">
            <ElInput v-model="row.key" size="small" placeholder="变量名" />
          </template>
        </ElTableColumn>
        <ElTableColumn label="值（支持 JSON）" min-width="260">
          <template #default="{ row }">
            <ElInput
              v-model="row.value"
              size="small"
              placeholder="字符串或 JSON"
            />
          </template>
        </ElTableColumn>
        <ElTableColumn label="操作" width="80">
          <template #default="{ $index }">
            <ElButton link type="danger" @click="removeVariableRow($index)">
              移除
            </ElButton>
          </template>
        </ElTableColumn>
      </ElTable>
      <ElEmpty
        v-if="variableRows.length === 0"
        description="该实例暂无流程变量"
        :image-size="50"
      />
      <div style="margin-top: 10px">
        <ElButton size="small" @click="addVariableRow">新增变量</ElButton>
      </div>
      <template #footer>
        <ElButton @click="variableVisible = false">取消</ElButton>
        <ElButton
          type="primary"
          :loading="variableSaving"
          @click="saveVariables"
        >
          保存
        </ElButton>
      </template>
    </ElDialog>
  </Page>
</template>
