<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';

import { ElDialog, ElMessage } from 'element-plus';

import { createViewer, type BpmnInstance } from './bpmn/modeler';

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    title?: string;
    xml?: string;
  }>(),
  { title: '流程图', xml: '' },
);

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
});

const canvasRef = ref<HTMLDivElement>();
let viewer: BpmnInstance | null = null;

async function render() {
  if (!canvasRef.value) return;
  viewer?.destroy();
  viewer = createViewer(canvasRef.value);
  if (!props.xml) return;
  try {
    await viewer.importXML(props.xml);
    viewer.get('canvas').zoom('fit-viewport', 'auto');
  } catch (error) {
    console.error('[flow] viewer importXML failed', error);
    ElMessage.error('流程图解析失败');
  }
}

watch(
  () => [props.modelValue, props.xml] as const,
  async ([open]) => {
    if (!open) return;
    await nextTick();
    await render();
  },
);

onBeforeUnmount(() => {
  viewer?.destroy();
  viewer = null;
});
</script>

<template>
  <ElDialog v-model="visible" :title="title" width="1000px" destroy-on-close>
    <div ref="canvasRef" class="flow-canvas flow-canvas--viewer"></div>
  </ElDialog>
</template>

<style scoped>
.flow-canvas {
  width: 100%;
  height: 520px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 4px;
  background: #fff;
}
</style>
