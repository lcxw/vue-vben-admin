<script lang="ts" setup>
import type { FlowVariableDTO, FlowVariableVO } from '#/api/flow';

import { computed, reactive, ref, watch } from 'vue';

import {
  ElButton,
  ElDrawer,
  ElForm,
  ElFormItem,
  ElInput,
  ElInputNumber,
  ElSelect,
  ElOption,
  type FormInstance,
  type FormRules,
} from 'element-plus';

import {
  createFlowVariable,
  FLOW_VARIABLE_TYPE,
  updateFlowVariable,
} from '#/api/flow';

import { withFeedback } from '../../system/shared/helpers';
import { FL } from '../shared/labels';

const props = defineProps<{
  entryId: string;
  modelValue: boolean;
  variable?: null | FlowVariableVO;
}>();

const emit = defineEmits<{
  saved: [];
  'update:modelValue': [value: boolean];
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
});

const formRef = ref<FormInstance>();
const saving = ref(false);
const form = reactive<FlowVariableDTO>({});

const rules: FormRules = {
  showName: [{ required: true, message: '请输入变量名称', trigger: 'blur' }],
  variableName: [
    { required: true, message: '请输入变量标识', trigger: 'blur' },
    {
      pattern: /^[a-z][a-zA-Z0-9]+$/,
      message: '变量标识必须为小驼峰，如 startUserName',
      trigger: 'blur',
    },
  ],
};

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    Object.assign(form, {
      bindColumnId: props.variable?.bindColumnId ?? '',
      bindDatasourceId: props.variable?.bindDatasourceId ?? '',
      bindRelationId: props.variable?.bindRelationId ?? '',
      entryId: props.entryId,
      showName: props.variable?.showName ?? '',
      showOrder: props.variable?.showOrder ?? 0,
      variableId: props.variable?.variableId,
      variableName: props.variable?.variableName ?? '',
      variableType: props.variable?.variableType ?? 1,
    });
    formRef.value?.clearValidate();
  },
);

async function onSubmit() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  saving.value = true;
  try {
    const payload: FlowVariableDTO = { ...form, entryId: props.entryId };
    const ok = await withFeedback(() =>
      props.variable
        ? updateFlowVariable(payload)
        : createFlowVariable(payload),
    );
    if (ok) {
      visible.value = false;
      emit('saved');
    }
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <ElDrawer
    v-model="visible"
    :title="variable ? '编辑变量' : '新增变量'"
    destroy-on-close
    size="480px"
  >
    <ElForm ref="formRef" :model="form" :rules="rules" label-width="100px">
      <ElFormItem :label="FL.variable.showName" prop="showName">
        <ElInput v-model="form.showName" placeholder="如：审批金额" />
      </ElFormItem>
      <ElFormItem :label="FL.variable.variableName" prop="variableName">
        <ElInput
          v-model="form.variableName"
          :disabled="Boolean(variable?.builtin)"
          placeholder="如：approvalAmount"
        />
      </ElFormItem>
      <ElFormItem :label="FL.variable.type" prop="variableType">
        <ElSelect v-model="form.variableType" style="width: 100%">
          <ElOption
            v-for="item in FLOW_VARIABLE_TYPE"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </ElSelect>
      </ElFormItem>
      <ElFormItem label="排序" prop="showOrder">
        <ElInputNumber v-model="form.showOrder" :min="0" />
      </ElFormItem>
      <ElFormItem label="绑定数据源" prop="bindDatasourceId">
        <ElInput v-model="form.bindDatasourceId" placeholder="在线表单数据源 Id（可选）" />
      </ElFormItem>
      <ElFormItem label="绑定字段" prop="bindColumnId">
        <ElInput v-model="form.bindColumnId" placeholder="在线表单字段 Id（可选）" />
      </ElFormItem>
    </ElForm>
    <template #footer>
      <div class="flex justify-end gap-2">
        <ElButton @click="visible = false">{{ FL.common.cancel }}</ElButton>
        <ElButton type="primary" :loading="saving" @click="onSubmit">
          {{ FL.common.confirm }}
        </ElButton>
      </div>
    </template>
  </ElDrawer>
</template>
