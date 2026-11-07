<script lang="ts" setup>
import type { FormInstance, FormRules } from 'element-plus';

import type { RoleFormData, SystemRole } from '#/api/system';

import { reactive, ref, watch } from 'vue';

import { ElForm, ElFormItem, ElInput, ElSwitch } from 'element-plus';

import { L } from '../shared/labels';

const props = defineProps<{
  record?: null | SystemRole;
}>();

const formRef = ref<FormInstance>();

function createModel(): RoleFormData {
  return { code: '', description: '', enabled: true, name: '' };
}

const model = reactive<RoleFormData>(createModel());

const rules: FormRules = {
  code: [
    { required: true, message: '请输入角色编码', trigger: 'blur' },
    {
      pattern: /^[a-z][a-z0-9_-]{1,63}$/,
      message: '小写字母开头，仅含小写字母/数字/下划线/短横线',
      trigger: 'blur',
    },
  ],
  name: [{ required: true, message: '请输入角色名称', trigger: 'blur' }],
};

watch(
  () => props.record,
  (record) => {
    Object.assign(model, createModel());
    if (record) {
      Object.assign(model, {
        code: record.code ?? '',
        description: record.description ?? '',
        enabled: record.enabled ?? true,
        id: record.id,
        name: record.name ?? '',
      });
    }
  },
  { immediate: true },
);

async function submit(): Promise<null | RoleFormData> {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) {
    return null;
  }
  return { ...model };
}

defineExpose({ submit });
</script>

<template>
  <ElForm
    ref="formRef"
    :model="model"
    :rules="rules"
    label-position="right"
    label-width="100px"
  >
    <ElFormItem :label="L.role.code" prop="code">
      <ElInput
        v-model="model.code"
        :disabled="!!record"
        placeholder="例如 admin"
      />
    </ElFormItem>
    <ElFormItem :label="L.role.name" prop="name">
      <ElInput v-model="model.name" />
    </ElFormItem>
    <ElFormItem :label="L.role.description" prop="description">
      <ElInput
        v-model="model.description"
        :rows="3"
        type="textarea"
        placeholder="角色用途说明"
      />
    </ElFormItem>
    <ElFormItem :label="L.common.status" prop="enabled">
      <ElSwitch
        v-model="model.enabled"
        :active-text="L.common.enabled"
        :inactive-text="L.common.disabled"
      />
    </ElFormItem>
  </ElForm>
</template>
