<script lang="ts" setup>
import type { FormInstance, FormRules } from 'element-plus';

import type { DepartmentFormData, DepartmentNode } from '#/api/system';

import { computed, reactive, ref, watch } from 'vue';

import {
  ElForm,
  ElFormItem,
  ElInput,
  ElInputNumber,
  ElOption,
  ElSelect,
  ElSwitch,
  ElTreeSelect,
} from 'element-plus';

import { flattenTree, toTreeOptions } from '../shared/helpers';
import { L } from '../shared/labels';

const props = withDefaults(
  defineProps<{
    companyOnly?: boolean;
    defaultParentId?: null | number;
    nodes: DepartmentNode[];
    record?: DepartmentNode | null;
  }>(),
  { companyOnly: false, defaultParentId: null, record: null },
);

const formRef = ref<FormInstance>();

const parentOptions = computed(() => {
  // 编辑时排除自身及所有子孙，避免出现环；保留原有层级供 TreeSelect 展开
  const excluded = new Set<number>();
  if (props.record) {
    const collect = (node: DepartmentNode) => {
      excluded.add(Number(node.id));
      (node.children ?? []).forEach((child) => collect(child));
    };
    collect(props.record);
  }
  const filterTree = (nodes: DepartmentNode[]): DepartmentNode[] =>
    nodes
      .filter((node) => !excluded.has(Number(node.id)))
      .map((node) => ({
        ...node,
        children: filterTree(node.children ?? []),
      }));
  return toTreeOptions(filterTree(props.nodes), {
    labelKey: 'name',
    valueKey: 'id',
  });
});

/** 平铺的父选项（ElTreeSelect 需要保留层级，这里同时提供公司下拉） */
const companyOptions = computed(() =>
  flattenTree(props.nodes)
    .filter((node) => node.isCompany)
    .map((node) => ({ label: node.name ?? '', value: Number(node.id) })),
);

function createModel(): DepartmentFormData {
  return {
    code: '',
    companyId: null,
    description: '',
    enabled: true,
    isCompany: props.companyOnly,
    name: '',
    parentId: props.defaultParentId,
    sortOrder: 0,
  };
}

const model = reactive<DepartmentFormData>(createModel());

const rules: FormRules = {
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
  code: [{ required: true, message: '请输入编码', trigger: 'blur' }],
};

watch(
  () => [props.record, props.companyOnly, props.defaultParentId] as const,
  () => {
    Object.assign(model, createModel());
    if (props.record) {
      Object.assign(model, {
        code: props.record.code ?? '',
        companyId: props.record.companyId ?? null,
        description: props.record.description ?? '',
        enabled: props.record.enabled ?? true,
        id: props.record.id,
        isCompany: Boolean(props.record.isCompany),
        name: props.record.name ?? '',
        parentId: props.record.parentId ?? null,
        sortOrder: props.record.sortOrder ?? 0,
      });
    }
  },
  { immediate: true },
);

async function submit(): Promise<DepartmentFormData | null> {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) {
    return null;
  }
  return { ...model, isCompany: props.companyOnly || Boolean(model.isCompany) };
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
    <ElFormItem :label="L.dept.name" prop="name">
      <ElInput v-model="model.name" />
    </ElFormItem>
    <ElFormItem :label="L.dept.code" prop="code">
      <ElInput v-model="model.code" />
    </ElFormItem>
    <ElFormItem v-if="!companyOnly" :label="L.dept.parent" prop="parentId">
      <ElTreeSelect
        v-model="model.parentId"
        :data="parentOptions"
        :props="{ children: 'children', label: 'label' }"
        check-strictly
        clearable
        filterable
        node-key="value"
        class="w-full"
        placeholder="不选则为根节点"
      />
    </ElFormItem>
    <ElFormItem v-if="!companyOnly" :label="L.dept.company" prop="companyId">
      <ElSelect
        v-model="model.companyId"
        class="w-full"
        clearable
        filterable
        placeholder="选择所属公司"
      >
        <ElOption
          v-for="item in companyOptions"
          :key="item.value"
          :label="item.label"
          :value="item.value"
        />
      </ElSelect>
    </ElFormItem>
    <ElFormItem v-if="!companyOnly" :label="L.dept.isCompany" prop="isCompany">
      <ElSwitch v-model="model.isCompany" />
    </ElFormItem>
    <ElFormItem :label="L.dept.sortOrder" prop="sortOrder">
      <ElInputNumber
        v-model="model.sortOrder"
        :min="0"
        class="w-full"
        controls-position="right"
      />
    </ElFormItem>
    <ElFormItem :label="L.dept.description" prop="description">
      <ElInput v-model="model.description" :rows="3" type="textarea" />
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
