<script lang="ts" setup>
/**
 * 流程图查看弹窗。画布逻辑收敛到 FlowDiagram（自带 0×0 容器等待与 DI 补全），
 * 这里只负责弹窗生命周期；既有的 modelValue / title / xml 契约保持不变。
 */
import type { FlowHighlightVO } from '#/api/flow';

import { computed } from 'vue';

import { ElDialog } from 'element-plus';

import FlowDiagram from './FlowDiagram.vue';

const props = withDefaults(
  defineProps<{
    highlight?: FlowHighlightVO;
    modelValue: boolean;
    title?: string;
    xml?: string;
  }>(),
  { highlight: undefined, title: '流程图', xml: '' },
);

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
});
</script>

<template>
  <ElDialog v-model="visible" :title="title" width="1000px" destroy-on-close>
    <FlowDiagram
      :height="520"
      :highlight="highlight"
      :title="title"
      :xml="xml"
    />
  </ElDialog>
</template>
