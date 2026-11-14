<script lang="ts" setup>
/**
 * 办理动作对话框（阶段 6）。
 *
 * 动作列表来自后端下发的节点按钮配置（task.operations），未配置时回退
 * FLOW_TASK_ACTIONS 全集；目标用户走通用选人弹窗，目标节点从实例详情
 * 取真实节点下拉，不再手填用户 Id / BPMN 节点 Id。
 */
import type {
  FlowIdentityVO,
  FlowOperationVO,
  FlowTaskActionReq,
  FlowTaskVO,
} from '#/api/flow';

import { computed, reactive, ref, watch } from 'vue';

import {
  ElButton,
  ElDialog,
  ElForm,
  ElFormItem,
  ElInput,
  ElOption,
  ElSelect,
  ElTag,
} from 'element-plus';

import {
  executeFlowAction,
  FLOW_TASK_ACTIONS,
  getFlowUsersByIds,
} from '#/api/flow';

import { withFeedback } from '../../system/shared/helpers';
import FlowIdentityPicker from '../shared/FlowIdentityPicker.vue';

interface ActionOption {
  label: string;
  needNode?: boolean;
  needUser?: boolean;
  needUsers?: boolean;
  style?: string;
  value: string;
}

const props = defineProps<{
  initialAction?: string;
  modelValue: boolean;
  task?: FlowTaskVO;
}>();

const emit = defineEmits<{
  changed: [];
  'update:modelValue': [value: boolean];
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
});

const saving = ref(false);
const pickerVisible = ref(false);
const pickerMultiple = ref(false);
const selectedUserNames = ref<FlowIdentityVO[]>([]);
/** 节点列表由待办接口随 FlowTaskVo 下发，避免前端再调监控详情接口（权限不同）。 */
const nodeOptions = computed<Array<{ id: string; name: string }>>(
  () => props.task?.nodeOptions ?? [],
);

const form = reactive<{
  action: string;
  comment: string;
  targetNodeId: string;
  targetUserId: string;
  targetUserIds: string[];
}>({
  action: 'APPROVE',
  comment: '',
  targetNodeId: '',
  targetUserId: '',
  targetUserIds: [],
});

/** 节点按钮配置 → 动作下拉；存量流程未配置时回退前端全集。 */
const actionOptions = computed<ActionOption[]>(() => {
  const configured: FlowOperationVO[] = props.task?.operations ?? [];
  if (configured.length > 0) {
    return configured.map((item) => ({
      label: item.label || item.code,
      needNode: item.needNode,
      needUser: item.needUser,
      needUsers: item.needUsers,
      style: item.style,
      value: item.code,
    }));
  }
  return FLOW_TASK_ACTIONS.map((item) => ({
    label: item.label,
    needNode: 'needNode' in item,
    needUser: 'needUser' in item,
    needUsers: 'needUsers' in item,
    value: item.value,
  }));
});

const actionMeta = computed(() =>
  actionOptions.value.find((item) => item.value === form.action),
);
const needUser = computed(() => Boolean(actionMeta.value?.needUser));
const needUsers = computed(() => Boolean(actionMeta.value?.needUsers));
const needNode = computed(() => Boolean(actionMeta.value?.needNode));

function openPicker(multiple: boolean) {
  pickerMultiple.value = multiple;
  pickerVisible.value = true;
}

function onPickerConfirm(rows: FlowIdentityVO[]) {
  selectedUserNames.value = rows;
  if (pickerMultiple.value) {
    form.targetUserIds = rows.map((row) => row.id);
  } else {
    form.targetUserId = rows[0]?.id ?? '';
  }
}

watch(
  () => props.modelValue,
  (isOpen) => {
    if (!isOpen) return;
    const first =
      props.initialAction ?? actionOptions.value[0]?.value ?? 'APPROVE';
    form.action = actionOptions.value.some((item) => item.value === first)
      ? first
      : (actionOptions.value[0]?.value ?? 'APPROVE');
    form.comment = '';
    form.targetNodeId = '';
    form.targetUserId = '';
    form.targetUserIds = [];
    selectedUserNames.value = [];
  },
);

watch([needUser, needUsers], async () => {
  const ids = needUsers.value ? form.targetUserIds : [form.targetUserId];
  const valid = ids.filter(Boolean);
  if (valid.length === 0) {
    selectedUserNames.value = [];
    return;
  }
  try {
    selectedUserNames.value = (await getFlowUsersByIds(valid)) ?? [];
  } catch (error) {
    console.error('[flow] resolve target users failed', error);
  }
});

async function onSubmit() {
  if (!props.task) return;
  if (needUser.value && !form.targetUserId) return;
  if (needUsers.value && form.targetUserIds.length === 0) return;
  if (needNode.value && !form.targetNodeId) return;

  const req: FlowTaskActionReq = {
    action: form.action,
    comment: form.comment,
    taskInstanceId: props.task.id,
    workOrderId: props.task.workOrderId,
  };
  if (needUser.value) req.targetUserId = form.targetUserId;
  if (needUsers.value) req.targetUserIds = [...form.targetUserIds];
  if (needNode.value) req.targetNodeId = form.targetNodeId;

  saving.value = true;
  const ok = await withFeedback(() => executeFlowAction(req), '办理成功');
  saving.value = false;
  if (!ok) return;
  visible.value = false;
  emit('changed');
}
</script>

<template>
  <ElDialog
    v-model="visible"
    :title="`办理 · ${task?.orderTitle ?? ''}`"
    width="620px"
    destroy-on-close
  >
    <ElForm label-width="100px">
      <ElFormItem label="任务节点">
        <ElInput :model-value="task?.taskName ?? ''" disabled />
      </ElFormItem>
      <ElFormItem label="办理动作" required>
        <ElSelect v-model="form.action" style="width: 100%">
          <ElOption
            v-for="item in actionOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </ElSelect>
      </ElFormItem>
      <ElFormItem v-if="needUser || needUsers" label="目标用户" required>
        <div class="target-users">
          <ElTag v-for="user in selectedUserNames" :key="user.id" size="small">
            {{ user.name }}
          </ElTag>
          <ElButton size="small" @click="openPicker(needUsers)">
            {{ needUsers ? '选择多个用户' : '选择用户' }}
          </ElButton>
        </div>
      </ElFormItem>
      <ElFormItem v-if="needNode" label="目标节点" required>
        <ElSelect
          v-model="form.targetNodeId"
          clearable
          filterable
          style="width: 100%"
          placeholder="选择要退回的节点"
        >
          <ElOption
            v-for="node in nodeOptions"
            :key="node.id"
            :label="`${node.name} (${node.id})`"
            :value="node.id"
          />
        </ElSelect>
      </ElFormItem>
      <ElFormItem label="办理意见">
        <ElInput
          v-model="form.comment"
          type="textarea"
          :rows="3"
          placeholder="请输入审批意见"
        />
      </ElFormItem>
    </ElForm>

    <template #footer>
      <ElButton @click="visible = false">取消</ElButton>
      <ElButton type="primary" :loading="saving" @click="onSubmit">
        确定
      </ElButton>
    </template>
  </ElDialog>

  <FlowIdentityPicker
    v-model="pickerVisible"
    :multiple="pickerMultiple"
    :selected-ids="pickerMultiple ? form.targetUserIds : [form.targetUserId]"
    title="选择目标用户"
    @confirm="onPickerConfirm"
  />
</template>

<style scoped>
.target-users {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
</style>
