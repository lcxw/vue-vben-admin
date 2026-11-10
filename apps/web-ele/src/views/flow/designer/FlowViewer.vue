<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';

import { ElDialog, ElMessage } from 'element-plus';

import {
  createViewer,
  ensureDiagramXml,
  type BpmnInstance,
} from './bpmn/modeler';

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
    // 历史版本快照可能只有语义节点没有 DI，这里补一份自动布局再渲染
    await viewer.importXML(ensureDiagramXml(props.xml, props.title, props.title));
    const canvas = viewer.get('canvas');
    // 容器为 0×0 时 fit-viewport 会算出非有限 scale 并抛 SVGMatrix 异常
    if (canvasRef.value && canvasRef.value.clientWidth > 0) {
      canvas.zoom('fit-viewport', 'auto');
    }
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

/**
 * ElDialog 的 body 是懒渲染的：首次打开时 nextTick 后 canvasRef 可能还是 null，
 * 上面的 watch 里 render() 会直接 return，表现为「弹窗打开但一片空白」。
 * 这里在弹窗过渡结束（DOM 一定就绪）再渲染一次兜底。
 */
function onOpened() {
  void render();
}

function onClosed() {
  viewer?.destroy();
  viewer = null;
}

onBeforeUnmount(() => {
  viewer?.destroy();
  viewer = null;
});
</script>

<template>
  <ElDialog
    v-model="visible"
    :title="title"
    width="1000px"
    destroy-on-close
    @closed="onClosed"
    @opened="onOpened"
  >
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
