<script lang="ts" setup>
/**
 * 菜单与权限点共用同一张 permission 表，因此共用同一份表单。
 * type='3' 是按钮（权限点），其余为可生成路由的菜单节点。
 */
import type { FormInstance, FormRules } from 'element-plus';

import type { PermissionFormData, PermissionNode } from '#/api/system';

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

import { MENU_TYPE_LABEL, MENU_TYPE_OPTIONS } from '../shared/constants';
import { flattenTree, toTreeOptions } from '../shared/helpers';
import { L } from '../shared/labels';

const props = withDefaults(
  defineProps<{
    defaultParentId?: null | string;
    defaultType?: string;
    fixedType?: string;
    nodes: PermissionNode[];
    record?: null | PermissionNode;
  }>(),
  {
    defaultParentId: null,
    defaultType: '0',
    fixedType: '',
    record: null,
  },
);

const formRef = ref<FormInstance>();

const parentOptions = computed(() => {
  const excluded = new Set<string>();
  if (props.record) {
    const collect = (node: PermissionNode) => {
      excluded.add(String(node.id));
      (node.children ?? []).forEach((child) => collect(child));
    };
    collect(props.record);
  }
  // 按钮权限点不作为父级；平铺后保留菜单层级关系会失真，这里用平铺列表
  const candidates = flattenTree(props.nodes).filter(
    (node) => node.type !== '3' && !excluded.has(String(node.id)),
  );
  return toTreeOptions(candidates, {
    labelKey: 'name',
    valueKey: 'id',
  });
});

function createModel(): PermissionFormData {
  return {
    code: '',
    component: '',
    description: '',
    enabled: true,
    icon: '',
    name: '',
    openType: '',
    parentId: props.defaultParentId ?? undefined,
    path: '',
    sortable: 0,
    type: props.fixedType || props.defaultType,
    view: '',
  };
}

const model = reactive<PermissionFormData>(createModel());

const rules: FormRules = {
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
  code: [{ required: true, message: '请输入权限标识', trigger: 'blur' }],
  type: [{ required: true, message: '请选择类型', trigger: 'change' }],
  path: [
    {
      validator: (_rule, value, callback) => {
        if (model.type !== '3' && !value) {
          callback(new Error('菜单类型必须填写路由地址'));
        } else {
          callback();
        }
      },
      trigger: 'blur',
    },
  ],
};

const isButton = computed(() => model.type === '3');

watch(
  () =>
    [
      props.record,
      props.defaultParentId,
      props.defaultType,
      props.fixedType,
    ] as const,
  () => {
    Object.assign(model, createModel());
    if (props.record) {
      Object.assign(model, {
        code: props.record.code ?? '',
        component: props.record.component ?? '',
        description: props.record.description ?? '',
        enabled: props.record.enabled ?? true,
        icon: props.record.icon ?? '',
        id: props.record.id,
        name: props.record.name ?? '',
        openType: props.record.openType ?? '',
        parentId: props.record.parentId ?? null,
        path: props.record.path ?? '',
        sortable: props.record.sortable ?? 0,
        type: props.record.type ?? props.defaultType,
        view: props.record.view ?? '',
      });
    }
  },
  { immediate: true },
);

async function submit(): Promise<null | PermissionFormData> {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) {
    return null;
  }
  return { ...model, type: props.fixedType || model.type };
}

defineExpose({ submit });
</script>

<template>
  <ElForm
    ref="formRef"
    :model="model"
    :rules="rules"
    label-position="right"
    label-width="110px"
  >
    <ElFormItem :label="L.menu.parent" prop="parentId">
      <ElTreeSelect
        v-model="model.parentId"
        :data="parentOptions"
        :props="{ children: 'children', label: 'label' }"
        check-strictly
        clearable
        filterable
        node-key="value"
        class="w-full"
        :placeholder="L.menu.rootMenu"
      />
    </ElFormItem>
    <ElFormItem :label="L.menu.type" prop="type">
      <ElSelect v-model="model.type" :disabled="!!fixedType" class="w-full">
        <ElOption
          v-for="item in MENU_TYPE_OPTIONS"
          :key="item.value"
          :label="item.label"
          :value="item.value"
        />
      </ElSelect>
    </ElFormItem>
    <ElFormItem :label="L.menu.name" prop="name">
      <ElInput v-model="model.name" />
    </ElFormItem>
    <ElFormItem :label="L.menu.code" prop="code">
      <ElInput v-model="model.code" :placeholder="L.permission.codeTip" />
    </ElFormItem>
    <template v-if="!isButton">
      <ElFormItem :label="L.menu.path" prop="path">
        <ElInput v-model="model.path" placeholder="/system/user" />
      </ElFormItem>
      <ElFormItem :label="L.menu.component" prop="component">
        <ElInput v-model="model.component" :placeholder="L.menu.componentTip" />
      </ElFormItem>
      <ElFormItem :label="L.menu.icon" prop="icon">
        <ElInput v-model="model.icon" placeholder="lucide:users" />
      </ElFormItem>
      <ElFormItem v-if="model.type === '1'" :label="L.menu.view" prop="view">
        <ElInput v-model="model.view" />
      </ElFormItem>
      <ElFormItem
        v-if="model.type === '2'"
        :label="L.menu.openType"
        prop="openType"
      >
        <ElInput v-model="model.openType" placeholder="https://" />
      </ElFormItem>
    </template>
    <ElFormItem :label="L.menu.sortable" prop="sortable">
      <ElInputNumber
        v-model="model.sortable"
        :min="0"
        class="w-full"
        controls-position="right"
      />
    </ElFormItem>
    <ElFormItem :label="L.menu.description" prop="description">
      <ElInput v-model="model.description" :rows="2" type="textarea" />
    </ElFormItem>
    <ElFormItem :label="L.menu.enabled" prop="enabled">
      <ElSwitch
        v-model="model.enabled"
        :active-text="L.common.enabled"
        :inactive-text="L.common.disabled"
      />
    </ElFormItem>
    <p class="text-xs text-gray-500">
      当前类型：{{ MENU_TYPE_LABEL[model.type ?? '0'] ?? model.type }}。{{
        L.menu.typeTip
      }}
    </p>
  </ElForm>
</template>
