<script lang="ts" setup>
import type { FlowVariableVO } from '#/api/flow';

import {
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
} from 'vue';

import { ElButton, ElMessage } from 'element-plus';

import {
  createModeler,
  emptyBpmnXml,
  ensureDiagramXml,
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
 *
 * 两个必须注意的实现细节（勿改）：
 * 1. modeler 用 shallowRef 持有并原样下发给属性面板。bpmn-js 实例内部是大量循环引用，
 *    放进 reactive/ref 会被 Vue 深度代理（性能问题 + 部分方法 this 错乱）；
 *    早先用普通 let 变量持有则模板拿到的永远是初始化时的 null，属性面板改任何东西都无效。
 * 2. 画布容器在「流程设计」步骤用 v-show 控制显隐，挂载时容器是 display:none（0×0）。
 *    这种状态下导入 XML 会让 diagram-js 在 fit-viewport 里算出 Infinity/NaN 的 scale，
 *    直接抛 `Failed to execute 'scale' on 'SVGMatrix': The provided float value is non-finite`
 *    并中断导入 —— 之后就只剩白板，事后 resize() 也救不回来。
 *    因此本组件**等容器真正有尺寸后才 boot()**（ResizeObserver 兜底），这是「白板」的根治点。
 */
const props = withDefaults(
  defineProps<{
    modelValue?: string;
    processKey?: string;
    processName?: string;
    variables?: FlowVariableVO[];
  }>(),
  {
    modelValue: '',
    processKey: 'flow_new',
    processName: '新流程',
    variables: () => [],
  },
);

const emit = defineEmits<{
  save: [xml: string];
  'update:modelValue': [xml: string];
}>();

const canvasRef = ref<HTMLDivElement>();
// 必须用 shallowRef：bpmn-js 的图形元素是带 read-only 描述符的对象，
// 放进 deep ref 会被 Vue 递归代理，选中节点时 diagram-js 抛
// "property 'labels' is a read-only and non-configurable data property"，
// 属性面板随后的 updateProperties 也全部失效。
const selectedElement = shallowRef<BpmnElement>(null);
const modeler = shallowRef<BpmnInstance>(null);
let emitTimer: ReturnType<typeof setTimeout> | undefined;
/** 容器一直是 0×0 时不能创建 modeler，需要等它可见；booted 用于防重复初始化 */
let booted = false;
let resizeObserver: ResizeObserver | undefined;

async function currentXml(): Promise<string> {
  if (!modeler.value) return props.modelValue ?? '';
  const result = await modeler.value.saveXML({ format: true });
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
  const canvas = modeler.value?.get('canvas');
  if (!canvas) return;
  const current = canvas.zoom() ?? 1;
  canvas.zoom(Math.min(2, Math.max(0.3, current + delta)));
}

function fit() {
  const canvas = modeler.value?.get('canvas');
  const el = canvasRef.value;
  // 0×0 容器下 fit-viewport 会算出非有限 scale 并抛 SVGMatrix 异常（详见文件头注释）
  if (!canvas || !el || el.clientWidth === 0 || el.clientHeight === 0) return;
  canvas.zoom('fit-viewport', 'auto');
}

/**
 * 容器尺寸变化后必须显式通知 diagram-js，否则内部 SVG 仍是旧尺寸，
 * 表现为「切到设计步骤后一片白」或「画布只有左上角一小块」。
 * 若此刻还没 boot（容器刚变可见），先补一次初始化。
 */
function resize() {
  if (!booted) {
    void boot();
    return;
  }
  void nextTick(() => {
    const canvas = modeler.value?.get('canvas');
    if (!canvas) return;
    canvas.resized();
    fit();
  });
}

function onSave() {
  void currentXml().then((xml) => emit('save', xml));
}

async function importDiagram(xml: string): Promise<boolean> {
  if (!modeler.value) return false;
  const normalized = ensureDiagramXml(xml, props.processKey, props.processName);
  try {
    await modeler.value.importXML(normalized);
    return normalized !== xml;
  } catch (error) {
    console.error('[flow] designer importXML failed', error);
    ElMessage.error('流程 XML 解析失败，已加载空白流程图');
    await modeler.value.importXML(
      emptyBpmnXml(props.processKey, props.processName),
    );
    return true;
  }
}

/**
 * 真正初始化：创建 Modeler → 导入 XML → 注册事件 → 回写 v-model。
 * 调用前必须保证容器已有非零尺寸，否则导入会因 fit-viewport 抛错而中断。
 */
async function boot() {
  if (booted || !canvasRef.value) return;
  const el = canvasRef.value;
  if (el.clientWidth === 0 || el.clientHeight === 0) return;
  booted = true;
  resizeObserver?.disconnect();
  resizeObserver = undefined;

  modeler.value = createModeler(el);
  // 老数据/外部导入的 XML 可能只有语义节点没有 DI，这里补一份自动布局，
  // 否则画布是白板（bpmn-js 只按 DI 渲染）。
  const repaired = await importDiagram(
    props.modelValue || emptyBpmnXml(props.processKey, props.processName),
  );

  modeler.value.on('selection.changed', (event: BpmnElement) => {
    selectedElement.value = event?.newSelection?.[0] ?? null;
  });
  modeler.value.on('commandStack.changed', scheduleEmit);

  resize();
  // 首次导入后同步一次 v-model：补过 DI 的 XML 也要回写，避免父组件拿到旧值
  await emitXml();
  if (repaired) scheduleEmit();
}

onMounted(() => {
  if (!canvasRef.value) return;
  const el = canvasRef.value;
  if (el.clientWidth > 0 && el.clientHeight > 0) {
    void boot();
    return;
  }
  // 容器被 v-show 隐藏（display:none）时先不初始化，等它获得尺寸。
  // 父组件切到「流程设计」步骤时也会直接调 resize()，两条路径都收敛到 boot()。
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      if (el.clientWidth > 0 && el.clientHeight > 0) void boot();
    });
    resizeObserver.observe(el);
  }
});

onBeforeUnmount(() => {
  if (emitTimer) clearTimeout(emitTimer);
  resizeObserver?.disconnect();
  resizeObserver = undefined;
  booted = false;
  modeler.value?.destroy();
  modeler.value = null;
});

defineExpose({ getXml, resize });
</script>

<template>
  <div class="flow-designer">
    <div class="flow-designer__toolbar">
      <ElButton size="small" @click="zoom(0.1)">放大</ElButton>
      <ElButton size="small" @click="zoom(-0.1)">缩小</ElButton>
      <ElButton size="small" @click="fit">适应画布</ElButton>
      <ElButton size="small" @click="resize">重绘画布</ElButton>
      <span class="flow-designer__tip">
        从左侧工具栏拖拽节点到画布；选中节点后在右侧配置处理人/按钮/变量
      </span>
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

.flow-designer__tip {
  margin-left: 8px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
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

<style>
/*
 * bpmn-js 默认按浅色绘制，这里只做最小修正：画布保持白底
 * （流程图导出/查看需要），去掉右上角 bpmn.io 水印。
 */
.flow-canvas .bjs-powered-by {
  display: none;
}

.flow-canvas .djs-palette {
  border-radius: 4px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 12%);
}
</style>
