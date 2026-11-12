<script lang="ts" setup>
/**
 * 流程实例详情抽屉：一次 /flow/monitor/detail 拿齐工单、任务、审批意见、
 * 变量、高亮数据与版本 BPMN 快照，避免多请求拼装造成状态不一致。
 */
import type {
  FlowMonitorVO,
  FlowTaskCommentVO,
  FlowTaskInstanceVO,
} from '#/api/flow';

import { computed, ref, watch } from 'vue';

import {
  ElButton,
  ElDescriptions,
  ElDescriptionsItem,
  ElDrawer,
  ElMessageBox,
  ElTable,
  ElTableColumn,
  ElTabPane,
  ElTabs,
  ElTag,
} from 'element-plus';

import {
  activateFlow,
  dictLabel,
  FLOW_ORDER_STATUS,
  getFlowMonitorDetail,
  suspendFlow,
  terminateFlow,
  urgeFlowTask,
  withdrawFlow,
} from '#/api/flow';

import { confirmAction, withFeedback } from '../../system/shared/helpers';
import { safeString } from '../../system/shared/labels';
import FlowDiagram from '../designer/FlowDiagram.vue';

const props = defineProps<{
  modelValue: boolean;
  workOrderId?: string;
}>();

const emit = defineEmits<{
  changed: [];
  'update:modelValue': [value: boolean];
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
});

const loading = ref(false);
const detail = ref<FlowMonitorVO>({});
const activeTab = ref('diagram');

const order = computed<Record<string, unknown>>(() => detail.value.order ?? {});
const comments = computed<FlowTaskCommentVO[]>(
  () => detail.value.comments ?? [],
);
const tasks = computed<FlowTaskInstanceVO[]>(() => detail.value.tasks ?? []);
const variablesText = computed(() =>
  JSON.stringify(detail.value.variables ?? {}, null, 2),
);

function text(key: string): string {
  return safeString(order.value[key]);
}

const orderStatus = computed(() => Number(order.value.status ?? -1));
const isRunning = computed(() => orderStatus.value === 0);
const isSuspended = computed(() => orderStatus.value === 1);

type TagType = 'danger' | 'info' | 'primary' | 'success' | 'warning';

function tagType(status: number): TagType {
  if (status === 0) return 'primary';
  if (status === 1) return 'warning';
  if (status === 2) return 'success';
  if (status === 6) return 'info';
  return 'danger';
}

async function load() {
  if (!props.workOrderId) return;
  loading.value = true;
  try {
    detail.value = await getFlowMonitorDetail(props.workOrderId);
    activeTab.value = 'diagram';
  } catch (error) {
    console.error('[flow] load monitor detail failed', error);
    detail.value = {};
  } finally {
    loading.value = false;
  }
}

watch(
  () => [props.modelValue, props.workOrderId] as const,
  async ([open]) => {
    if (open) await load();
  },
);

async function onWithdraw() {
  if (!(await confirmAction('确定撤回该流程吗？撤回后不可继续办理。'))) return;
  const ok = await withFeedback(
    () => withdrawFlow(props.workOrderId ?? ''),
    '已撤回',
  );
  if (!ok) return;
  emit('changed');
  visible.value = false;
}

async function onTerminate() {
  let reason = '';
  try {
    const result = await ElMessageBox.prompt('请输入终止原因', '终止流程', {
      cancelButtonText: '取消',
      confirmButtonText: '确定',
      inputPlaceholder: '终止原因',
    });
    reason = result.value ?? '';
  } catch {
    return;
  }
  const ok = await withFeedback(
    () => terminateFlow(props.workOrderId ?? '', reason),
    '已终止',
  );
  if (!ok) return;
  emit('changed');
  await load();
}

async function onSuspendToggle() {
  const suspended = isSuspended.value;
  const ok = await withFeedback(
    () =>
      suspended
        ? activateFlow(props.workOrderId ?? '')
        : suspendFlow(props.workOrderId ?? ''),
    suspended ? '已唤醒' : '已挂起',
  );
  if (!ok) return;
  emit('changed');
  await load();
}

async function onUrge() {
  const ok = await withFeedback(
    () =>
      urgeFlowTask({
        action: 'URGE',
        workOrderId: props.workOrderId,
      }),
    '已催办',
  );
  if (ok) await load();
}
</script>

<template>
  <ElDrawer v-model="visible" title="流程实例详情" size="72%" destroy-on-close>
    <template #header>
      <div class="detail-header">
        <span>流程实例详情</span>
        <ElTag :type="tagType(orderStatus)" size="small">
          {{ dictLabel(FLOW_ORDER_STATUS, orderStatus) }}
        </ElTag>
      </div>
    </template>

    <div v-loading="loading">
      <ElDescriptions :column="2" border size="small">
        <ElDescriptionsItem label="标题">
          {{ text('title') }}
        </ElDescriptionsItem>
        <ElDescriptionsItem label="流程定义">
          {{ text('entryId') }}
        </ElDescriptionsItem>
        <ElDescriptionsItem label="发起人">
          {{ text('initiatorName') || text('initiator') }}
        </ElDescriptionsItem>
        <ElDescriptionsItem label="业务主键">
          {{ text('businessKey') }}
        </ElDescriptionsItem>
        <ElDescriptionsItem label="开始时间">
          {{ text('startTime') }}
        </ElDescriptionsItem>
        <ElDescriptionsItem label="结束时间">
          {{ text('endTime') }}
        </ElDescriptionsItem>
        <ElDescriptionsItem label="流程实例 Id">
          {{ text('processInstanceId') }}
        </ElDescriptionsItem>
        <ElDescriptionsItem label="当前节点">
          {{ text('currentNodeIds') }}
        </ElDescriptionsItem>
      </ElDescriptions>

      <div class="detail-actions">
        <ElButton
          v-if="isRunning"
          type="warning"
          plain
          size="small"
          @click="onWithdraw"
        >
          撤回
        </ElButton>
        <ElButton
          v-if="isRunning || isSuspended"
          type="danger"
          plain
          size="small"
          @click="onTerminate"
        >
          终止
        </ElButton>
        <ElButton
          v-if="isRunning || isSuspended"
          plain
          size="small"
          @click="onSuspendToggle"
        >
          {{ isSuspended ? '唤醒' : '挂起' }}
        </ElButton>
        <ElButton plain size="small" @click="onUrge">催办</ElButton>
        <ElButton size="small" @click="load">刷新</ElButton>
      </div>

      <ElTabs v-model="activeTab">
        <ElTabPane label="流程图（高亮）" name="diagram">
          <div class="legend">
            <span class="legend-item legend-done">已完成</span>
            <span class="legend-item legend-active">当前节点</span>
            <span class="legend-item legend-reject">驳回/退回</span>
          </div>
          <FlowDiagram
            :highlight="detail.highlight"
            :xml="detail.highlight?.bpmnXml"
            :height="420"
            title="实例流程图"
          />
        </ElTabPane>

        <ElTabPane :label="`审批历史 (${comments.length})`" name="history">
          <ElTable :data="comments" border size="small" max-height="420">
            <ElTableColumn prop="createTime" label="时间" width="170" />
            <ElTableColumn prop="taskName" label="节点" min-width="120" />
            <ElTableColumn prop="operatorName" label="操作人" width="120" />
            <ElTableColumn prop="actionName" label="动作" width="120" />
            <ElTableColumn prop="comment" label="意见" min-width="200" />
          </ElTable>
        </ElTabPane>

        <ElTabPane :label="`任务明细 (${tasks.length})`" name="tasks">
          <ElTable :data="tasks" border size="small" max-height="420">
            <ElTableColumn prop="taskName" label="节点" min-width="140" />
            <ElTableColumn prop="taskDefKey" label="节点 KEY" min-width="140" />
            <ElTableColumn prop="assignee" label="办理人" width="120" />
            <ElTableColumn prop="status" label="状态" width="90" />
            <ElTableColumn prop="approvalMode" label="审批模式" width="120" />
            <ElTableColumn prop="createTime" label="创建时间" width="170" />
            <ElTableColumn prop="endTime" label="完成时间" width="170" />
          </ElTable>
        </ElTabPane>

        <ElTabPane label="流程变量" name="variables">
          <pre class="variables-pre">{{ variablesText }}</pre>
        </ElTabPane>
      </ElTabs>
    </div>
  </ElDrawer>
</template>

<style scoped>
.detail-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.detail-actions {
  display: flex;
  gap: 8px;
  margin: 12px 0;
}

.legend {
  display: flex;
  gap: 16px;
  margin-bottom: 8px;
  font-size: 12px;
}

.legend-item::before {
  display: inline-block;
  width: 10px;
  height: 10px;
  margin-right: 5px;
  border-radius: 2px;
  content: '';
}

.legend-done::before {
  background: #67c23a;
}

.legend-active::before {
  background: #409eff;
}

.legend-reject::before {
  background: #f56c6c;
}

.variables-pre {
  max-height: 420px;
  padding: 12px;
  overflow: auto;
  background: var(--el-fill-color-light);
  border-radius: 4px;
}
</style>
