<script lang="ts" setup>
/**
 * 办理动作对话框：所有动作统一走 /flow/action/execute，由后端按 action 动态鉴权。
 * 前端只负责收集参数，不在这里判断权限（服务端仍会校验）。
 */
import type { FlowIdentityVO, FlowTaskActionReq, FlowTaskVO } from '#/api/flow';

import { computed, reactive, ref, watch } from 'vue';

import {
  ElButton,
  ElDialog,
  ElForm,
  ElFormItem,
  ElInput,
  ElOption,
  ElSelect,
} from 'element-plus';

import { executeFlowAction, FLOW_TASK_ACTIONS, getFlowUsers } from '#/api/flow';

import { withFeedback } from '../../system/shared/helpers';

const props = defineProps<{
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

const users = ref<FlowIdentityVO[]>([]);
const saving = ref(false);
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

const actionMeta = computed(() =>
  FLOW_TASK_ACTIONS.find((item) => item.value === form.action),
);
const needUser = computed(() => 'needUser' in (actionMeta.value ?? {}));
const needUsers = computed(() => 'needUsers' in (actionMeta.value ?? {}));
const needNode = computed(() => 'needNode' in (actionMeta.value ?? {}));

const actionOptions = FLOW_TASK_ACTIONS.map((item) => ({
  label: item.label,
  value: item.value,
}));

async function loadUsers() {
  try {
    users.value = await getFlowUsers();
  } catch (error) {
    console.error('[flow] load users failed', error);
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    form.action = 'APPROVE';
    form.comment = '';
    form.targetNodeId = '';
    form.targetUserId = '';
    form.targetUserIds = [];
    void loadUsers();
  },
);

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
      <ElFormItem v-if="needUser" label="目标用户" required>
        <ElSelect
          v-model="form.targetUserId"
          filterable
          clearable
          style="width: 100%"
        >
          <ElOption
            v-for="user in users"
            :key="user.id"
            :label="user.name"
            :value="user.id"
          />
        </ElSelect>
      </ElFormItem>
      <ElFormItem v-if="needUsers" label="目标用户" required>
        <ElSelect
          v-model="form.targetUserIds"
          multiple
          filterable
          clearable
          style="width: 100%"
        >
          <ElOption
            v-for="user in users"
            :key="user.id"
            :label="user.name"
            :value="user.id"
          />
        </ElSelect>
      </ElFormItem>
      <ElFormItem v-if="needNode" label="目标节点 ID" required>
        <ElInput v-model="form.targetNodeId" placeholder="BPMN 节点 Id" />
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
</template>
