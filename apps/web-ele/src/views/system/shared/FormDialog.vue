<script lang="ts" setup>
/**
 * 权限管理模块统一的表单抽屉外壳。
 *
 * 用 Element Plus 原生 ElDrawer 而不是 @vben/common-ui 的 useVbenDrawer：
 * 表单内容各模块差异较大（树、标签编辑器、动态字段），直接写 slot 比
 * schema 驱动更直观，也避免依赖 adapter/component 的组件注册范围。
 */
import { computed } from 'vue';

import { ElButton, ElDrawer } from 'element-plus';

import { L } from './labels';

const props = withDefaults(
  defineProps<{
    confirmText?: string;
    loading?: boolean;
    modelValue: boolean;
    size?: string;
    title: string;
  }>(),
  {
    confirmText: L.common.confirm,
    loading: false,
    size: '560px',
  },
);

const emit = defineEmits<{
  confirm: [];
  'update:modelValue': [value: boolean];
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
});
</script>

<template>
  <ElDrawer
    v-model="visible"
    :size="size"
    :title="title"
    destroy-on-close
    append-to-body
  >
    <slot></slot>
    <template #footer>
      <div class="flex justify-end gap-2">
        <ElButton @click="visible = false">{{ L.common.cancel }}</ElButton>
        <ElButton type="primary" :loading="loading" @click="emit('confirm')">
          {{ confirmText }}
        </ElButton>
      </div>
    </template>
  </ElDrawer>
</template>
