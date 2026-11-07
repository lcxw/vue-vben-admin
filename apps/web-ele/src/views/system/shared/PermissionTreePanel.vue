<script lang="ts" setup>
/**
 * 角色授权用的权限树。
 *
 * 关键点：提交时要带上「半选」的父节点。后端 role_permission 是全量替换，
 * 如果只提交叶子节点，父级菜单不会被绑定，动态路由生成时整棵子树会缺失。
 */
import type { PermissionNode } from '#/api/system';

import { computed, nextTick, ref, watch } from 'vue';

import { ElButton, ElCheckbox, ElInput, ElTree } from 'element-plus';

import { flattenTree, toTreeOptions } from './helpers';
import { L } from './labels';

interface TreeMethods {
  filter: (value: string) => void;
  getCheckedKeys: (leafOnly?: boolean) => (number | string)[];
  getHalfCheckedKeys: () => (number | string)[];
  setCheckedKeys: (keys: (number | string)[], leafOnly?: boolean) => void;
}

const props = withDefaults(
  defineProps<{
    includeHalf?: boolean;
    modelValue?: string[];
    nodes?: PermissionNode[];
  }>(),
  {
    includeHalf: true,
    modelValue: () => [],
    nodes: () => [],
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: string[]];
}>();

const keyword = ref('');
const treeRef = ref<null | TreeMethods>(null);
const treeData = computed(() =>
  toTreeOptions(props.nodes, {
    labelKey: 'name',
    valueKey: 'id',
  }),
);

function collect(): string[] {
  const tree = treeRef.value;
  if (!tree) {
    return props.modelValue ?? [];
  }
  const checked = tree.getCheckedKeys(false).map(String);
  const halfChecked = props.includeHalf
    ? tree.getHalfCheckedKeys().map(String)
    : [];
  return [...new Set([...checked, ...halfChecked])];
}

function onCheck() {
  emit('update:modelValue', collect());
}

function onFilter(value: string, data: Record<string, unknown>): boolean {
  if (!value) {
    return true;
  }
  const haystack = `${data.label ?? ''}${data.code ?? ''}`.toLowerCase();
  return haystack.includes(value.toLowerCase());
}

function selectAll() {
  // 用现成的 flattenTree 代替递归具名函数：既避免 no-array-callback-reference，
  // 也不会触发 TS2684（函数表达式作为迭代器回调时 this 为 void）。
  const all = flattenTree(treeData.value).map((node) => String(node.value));
  treeRef.value?.setCheckedKeys(all, false);
  emit('update:modelValue', [...new Set(all)]);
}

function clearAll() {
  treeRef.value?.setCheckedKeys([], false);
  emit('update:modelValue', []);
}

watch(keyword, (value) => treeRef.value?.filter(value));

watch(
  () => props.modelValue,
  async (value) => {
    await nextTick();
    treeRef.value?.setCheckedKeys(value ?? [], false);
  },
  { flush: 'post', immediate: true },
);

defineExpose({ collect, clearAll, selectAll });
</script>

<template>
  <div class="flex w-full flex-col gap-3">
    <div class="flex items-center gap-2">
      <ElInput
        v-model="keyword"
        :placeholder="L.common.keywordPlaceholder"
        clearable
      />
      <ElButton size="small" @click="selectAll">
        {{ L.role.selectAll }}
      </ElButton>
      <ElButton size="small" @click="clearAll">
        {{ L.role.clearAll }}
      </ElButton>
    </div>
    <ElCheckbox :model-value="includeHalf" disabled>
      {{ L.role.includeHalfChecked }}
    </ElCheckbox>
    <div
      class="max-h-[420px] w-full overflow-auto rounded border border-gray-200 p-2 dark:border-gray-700"
    >
      <ElTree
        ref="treeRef"
        :data="treeData"
        :filter-node-method="onFilter"
        :props="{ children: 'children', label: 'label' }"
        default-expand-all
        node-key="value"
        show-checkbox
        @check="onCheck"
      />
    </div>
    <div class="text-xs text-gray-500">
      {{
        L.role.permissionCount.replace('{0}', String(modelValue?.length ?? 0))
      }}
    </div>
  </div>
</template>
