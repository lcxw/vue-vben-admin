<script lang="ts" setup>
import type { BpmnInstance } from './bpmn/modeler';

/**
 * 纯画布流程图（只读），可被弹窗、抽屉、详情页直接嵌入。
 *
 * 两个已踩过的坑（勿改）：
 * 1. bpmn-js 只按 BPMNDiagram/DI 渲染，历史快照可能没有 DI → 必须先 ensureDiagramXml；
 * 2. 容器处于 v-show / 抽屉过渡里时是 0×0，此时 fit-viewport 会算出非有限 scale，
 *    抛 `Failed to execute 'scale' on 'SVGMatrix'`，导入直接中断且事后救不回来。
 *    这里用 ResizeObserver 等容器有非零尺寸才创建 viewer，并在尺寸变化时只 re-fit。
 */
import type { FlowHighlightVO } from '#/api/flow';

import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { ElMessage } from 'element-plus';

import { createViewer, ensureDiagramXml } from './bpmn/modeler';

const props = withDefaults(
  defineProps<{
    height?: number;
    highlight?: FlowHighlightVO;
    title?: string;
    xml?: string;
  }>(),
  { height: 420, highlight: undefined, title: '流程图', xml: '' },
);

const canvasRef = ref<HTMLDivElement>();
let viewer: BpmnInstance | null = null;
let observer: null | ResizeObserver = null;
let rendered = false;

function applyHighlight() {
  if (!viewer || !props.highlight) return;
  const canvas = viewer.get('canvas');
  const registry = viewer.get('elementRegistry');
  const mark = (ids: string[] | undefined, className: string) => {
    for (const id of ids ?? []) {
      // 版本快照与当前节点 Id 可能不完全对应，跳过不存在的元素而不是抛错
      if (registry.get(id)) canvas.addMarker(id, className);
    }
  };
  mark(props.highlight.completedNodeIds, 'flow-node-completed');
  mark(props.highlight.activeNodeIds, 'flow-node-active');
  mark(props.highlight.rejectedNodeIds, 'flow-node-rejected');
  mark(props.highlight.completedFlowIds, 'flow-flow-completed');
}

function fitViewport() {
  const el = canvasRef.value;
  if (!viewer || !el || el.clientWidth === 0) return;
  try {
    viewer.get('canvas').zoom('fit-viewport', 'auto');
  } catch (error) {
    console.error('[flow] viewer zoom failed', error);
  }
}

async function render() {
  const el = canvasRef.value;
  if (!el || el.clientWidth === 0 || el.clientHeight === 0) return;
  viewer?.destroy();
  viewer = createViewer(el);
  rendered = true;
  try {
    const source = props.highlight?.bpmnXml || props.xml;
    await viewer.importXML(ensureDiagramXml(source, props.title, props.title));
    fitViewport();
    applyHighlight();
  } catch (error) {
    console.error('[flow] viewer importXML failed', error);
    ElMessage.error('流程图解析失败');
  }
}

watch(
  () => [props.xml, props.highlight] as const,
  () => {
    if (rendered) void render();
  },
);

onMounted(() => {
  if (!canvasRef.value) return;
  observer = new ResizeObserver(() => {
    if (rendered) {
      fitViewport();
    } else {
      void render();
    }
  });
  observer.observe(canvasRef.value);
  // 首次挂载时容器可能已有尺寸，ResizeObserver 的首次回调会覆盖这种情况；
  // 这里额外触发一次，避免某些浏览器在相同尺寸下不派发首次回调。
  void render();
});

onBeforeUnmount(() => {
  observer?.disconnect();
  observer = null;
  viewer?.destroy();
  viewer = null;
  rendered = false;
});
</script>

<template>
  <div
    ref="canvasRef"
    class="flow-canvas"
    :style="{ height: `${height}px` }"
  ></div>
</template>

<style scoped>
.flow-canvas {
  width: 100%;
  border: 1px solid var(--el-border-color-light);
  border-radius: 4px;
  background: #fff;
}

/* bpmn-js 动态插入的 SVG 不带 scoped 属性，必须用 :deep 才能命中 */
:deep(.djs-shape.flow-node-completed .djs-visual > rect),
:deep(.djs-shape.flow-node-completed .djs-visual > circle),
:deep(.djs-shape.flow-node-completed .djs-visual > polygon),
:deep(.djs-shape.flow-node-completed .djs-visual > path) {
  fill: #f0f9eb !important;
  stroke: #67c23a !important;
}

:deep(.djs-shape.flow-node-active .djs-visual > rect),
:deep(.djs-shape.flow-node-active .djs-visual > circle),
:deep(.djs-shape.flow-node-active .djs-visual > polygon),
:deep(.djs-shape.flow-node-active .djs-visual > path) {
  fill: #ecf5ff !important;
  stroke: #409eff !important;
  stroke-width: 3px !important;
}

:deep(.djs-shape.flow-node-rejected .djs-visual > rect),
:deep(.djs-shape.flow-node-rejected .djs-visual > circle),
:deep(.djs-shape.flow-node-rejected .djs-visual > polygon),
:deep(.djs-shape.flow-node-rejected .djs-visual > path) {
  fill: #fef0f0 !important;
  stroke: #f56c6c !important;
  stroke-width: 3px !important;
}

:deep(.djs-connection.flow-flow-completed .djs-visual > path) {
  stroke: #67c23a !important;
  stroke-width: 2.5px !important;
}
</style>
