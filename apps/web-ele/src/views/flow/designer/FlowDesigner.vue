<script lang="ts" setup>
import type { FlowVariableVO } from '#/api/flow';

import { onBeforeUnmount, onMounted, ref } from 'vue';

import { ElButton, ElMessage } from 'element-plus';

import {
  createModeler,
  emptyBpmnXml,
  type BpmnElement,
  type BpmnInstance,
} from './bpmn/modeler';
import FlowPropertiesPanel from './FlowPropertiesPanel.vue';

/**
 * 流程设计器画布（bpmn-js 18 Modeler）。
 *
 * 契约：v-model 绑定 BPMN 2.0 XML 字符串；父组件点击「保存草稿」时
 * 调用暴露的 getXml() 拿最新 XML，再交给 /flow/entry/saveDraft。
 * 画布本身不直接调后端，发布与保存严格分离。
 */
const props = withDefaults(
  defineProps<{
    modelValue?: string;
    processKey?: string;
    processName?: string;
    variables?: FlowVariableVO[];
  }>(),
  { modelValue: '', processKey: 'flow_new', processName: '新流程', variables: () => [] },
);

const emit = defineEmits<{
  save: [xml: string];
  'update:modelValue': [xml: string];
}>();

const canvasRef = ref<HTMLDivElement>();
const selectedElement = ref<BpmnElement>(null);
let modeler: BpmnInstance | null = null;
let emitTimer: ReturnType<typeof setTimeout> | undefined;

async function currentXml(): Promise<string> {
  if (!modeler) return props.modelValue ?? '';
  const result = await modeler.saveXML({ format: true });
  return result?.xml ?? '';
}

async function emitXml() {
  const xml = await currentXml();
  emit('update:modelValue', xml);
}

function scheduleEmit() {
  if (emitTimer) clearTimeout(emitTimer);
  emitTimer = setTimeout(() => void emitXml(), 300);
}

async function getXml(): Promise<string> {
  return await currentXml();
}

function zoom(delta: number) {
  const canvas = modeler?.get('canvas');
  if (!canvas) return;
  const current = canvas.zoom() ?? 1;
  canvas.zoom(Math.min(2, Math.max(0.3, current + delta)));
}

function fit() {
  modeler?.get('canvas')?.zoom('fit-viewport', 'auto');
}

function onSave() {
  void currentXml().then((xml) => emit('save', xml));
}

onMounted(async () => {
  if (!canvasRef.value) return;
  modeler = createModeler(canvasRef.value);
  try {
    await modeler.importXML(
      props.modelValue ||
        emptyBpmnXml(props.processKey, props.processName),
    );
    fit();
  } catch (error) {
    console.error('[flow] designer importXML failed', error);
    ElMessage.error('流程 XML 解析失败，已加载空白流程图');
    await modeler.importXML(emptyBpmnXml(props.processKey, props.processName));
  }

  modeler.on('selection.changed', (event: BpmnElement) => {
    selectedElement.value = event?.newSelection?.[0] ?? null;
  });
  modeler.on('commandStack.changed', scheduleEmit);
  // 首次导入后立即同步一次 v-model，避免父组件拿到旧值
  await emitXml();
});

onBeforeUnmount(() => {
  if (emitTimer) clearTimeout(emitTimer);
  modeler?.destroy();
  modeler = null;
});

defineExpose({ getXml });
</script>

<template>
  <div class="flow-designer">
    <div class="flow-designer__toolbar">
      <ElButton size="small" @click="zoom(0.1)">放大</ElButton>
      <ElButton size="small" @click="zoom(-0.1)">缩小</ElButton>
      <ElButton size="small" @click="fit">适应画布</ElButton>
      <div class="flow-designer__spacer"></div>
      <ElButton size="small" type="primary" @click="onSave">保存草稿</ElButton>
    </div>

    <div class="flow-designer__body">
      <div ref="canvasRef" class="flow-canvas"></div>
      <aside class="flow-designer__panel">
        <FlowPropertiesPanel
          :element="selectedElement"
          :modeler="modeler"
          :variables="variables"
          @changed="scheduleEmit"
        />
      </aside>
    </div>
  </div>
</template>

<style scoped>
.flow-designer {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 620px;
}

.flow-designer__toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid var(--el-border-color-light);
}

.flow-designer__spacer {
  flex: 1;
}

.flow-designer__body {
  display: flex;
  flex: 1;
  min-height: 0;
}

.flow-canvas {
  flex: 1;
  min-width: 0;
  height: 100%;
  background: #fff;
}

.flow-designer__panel {
  width: 380px;
  flex-shrink: 0;
  overflow: auto;
  border-left: 1px solid var(--el-border-color-light);
}
</style>
