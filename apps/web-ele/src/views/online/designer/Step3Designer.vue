<script lang="ts" setup>
/**
 * Step3 设计表单：拖拽式可视化设计器 + 实时预览。
 *
 * 布局：左（控件池）· 中（拖拽画布）· 右（属性面板）；顶部 设计/预览 切换。
 * 产出 form-create 风格 widgetJson：{ formKey, labelWidth, size, pc:{ widgetList:[...] } }。
 * 拖拽用 sortablejs；字段选项自动来自已导入表的字段模型 + 基础控件 + 容器。
 */
import type { PageVo, WizardForm, OnlineDictVO } from '#/api/online';

import { computed, nextTick, onMounted, ref } from 'vue';
// sortablejs 无类型声明（项目已装 @types/sortablejs 但此导入路径未解析到），用忽略抑制
// @ts-expect-error sortablejs 类型声明缺失
import Sortable from 'sortablejs';

import {
  ElButton,
  ElCheckbox,
  ElInput,
  ElInputNumber,
  ElMessage,
  ElOption,
  ElSelect,
} from 'element-plus';

import {
  generateWizardForms,
  getOnlineDictList,
  getRunConfig,
  ONLINE_WIDGET_TYPES,
  saveWizardWidget,
  setWizardStep,
} from '#/api/online';
import { callWithFeedback } from './helpers';

interface Widget {
  type: string;
  field: string;
  title: string;
  key: string;
  span: number;
  props: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  childWidgetList: Widget[];
  required?: boolean;
  dictCode?: string;
}

const props = defineProps<{ page: PageVo }>();
const emit = defineEmits<{ done: [page: PageVo]; back: [] }>();

const mode = ref<'design' | 'preview'>('design');
const forms = ref<WizardForm[]>([]);
const activeFormId = ref('');
const widgets = ref<Widget[]>([]);
const selectedIndex = ref(-1);
const dicts = ref<OnlineDictVO[]>([]);
const generating = ref(false);
const previewConfig = ref<null | Awaited<ReturnType<typeof getRunConfig>>>(null);

const canvasEl = ref<HTMLElement | null>(null);
let sortable: Sortable | null = null;

const selected = computed<null | Widget>(() =>
  selectedIndex.value >= 0 ? (widgets.value[selectedIndex.value] ?? null) : null,
);

/** 控件池：已导入表字段（转成控件） + 基础控件 + 容器。 */
const palette = computed(() => {
  const items: Array<{ type: string; title: string; field: string; fromTable?: string }> = [];
  for (const t of props.page?.tables ?? []) {
    for (const c of t.columns) {
      if (c.isPk === 1) continue;
      items.push({
        type: c.widgetType ?? 'input',
        title: c.columnComment || c.columnName,
        field: c.columnName,
        fromTable: t.tableName,
      });
    }
  }
  return items;
});

onMounted(async () => {
  try { dicts.value = await getOnlineDictList(); } catch { dicts.value = []; }
  forms.value = props.page?.forms ?? [];
  if (!forms.value.length) {
    await onGenerate();
  } else {
    activeFormId.value = forms.value.find((f) => f.pageRole === 'edit')?.formId ?? forms.value[0]?.formId ?? '';
    await loadWidget();
  }
});

/** 基于已选表字段自动生成表单（query/edit/detail），然后进入设计。 */
async function onGenerate() {
  generating.value = true;
  try {
    const page = await callWithFeedback(() => generateWizardForms(props.page.pageId), '表单已生成');
    if (page) {
      forms.value = page.forms ?? [];
      emit('done', page);
      activeFormId.value = forms.value.find((f) => f.pageRole === 'edit')?.formId ?? forms.value[0]?.formId ?? '';
      await loadWidget();
    }
  } finally {
    generating.value = false;
  }
}

/** 加载当前表单的 widgetJson（pc.widgetList）。 */
async function loadWidget() {
  if (!activeFormId.value) return;
  try {
    const { getOnlineForm } = await import('#/api/online');
    const form = await getOnlineForm(activeFormId.value);
    if (form?.widgetJson) {
      const parsed = JSON.parse(form.widgetJson) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
      widgets.value = Array.isArray(parsed.pc?.widgetList) ? parsed.pc.widgetList : [];
    } else {
      widgets.value = [];
    }
  } catch {
    widgets.value = [];
  }
  selectedIndex.value = widgets.value.length > 0 ? 0 : -1;
  await nextTick();
  initSortable();
}

function makeWidget(item: { type: string; title: string; field: string }): Widget {
  const dict = dicts.value.find((d) => d.dictCode === fieldToDict(item.field));
  return {
    type: item.type,
    field: item.field,
    title: item.title,
    key: item.field + '_' + Date.now().toString().slice(-5),
    span: 12,
    props: { placeholder: '请输入' + item.title, ...(dict ? { dictInfo: { dictCode: dict.dictCode } } : {}) },
    childWidgetList: [],
    dictCode: dict?.dictCode,
  };
}

/** 从字段模型推断字典（简单规则：列名含 type/status/level/source/industry 等）。 */
function fieldToDict(field: string): string | undefined {
  const f = field.toLowerCase();
  if (f.includes('status')) return 'customer_status';
  if (f.includes('level')) return 'customer_level';
  if (f.includes('source')) return 'customer_source';
  if (f.includes('industry')) return 'industry';
  if (f === 'enabled' || f.startsWith('is_')) return 'yes_no';
  return undefined;
}

function addFromPalette(item: { type: string; title: string; field: string }) {
  widgets.value.push(makeWidget(item));
  selectedIndex.value = widgets.value.length - 1;
  void nextTick();
  initSortable();
}

function addContainer(type: 'grid' | 'divider') {
  if (type === 'divider') {
    widgets.value.push({ type: 'divider', field: '', title: '分组标题', key: 'd_' + Date.now().toString().slice(-5), span: 24, props: {}, childWidgetList: [] });
  } else {
    widgets.value.push({ type: 'grid', field: '', title: '栅格容器', key: 'g_' + Date.now().toString().slice(-5), span: 24, props: {}, childWidgetList: [] });
  }
  selectedIndex.value = widgets.value.length - 1;
}

function removeWidget(index: number) {
  widgets.value.splice(index, 1);
  if (selectedIndex.value >= widgets.value.length) selectedIndex.value = widgets.value.length - 1;
}

function initSortable() {
  if (!canvasEl.value) return;
  sortable?.destroy();
  sortable = Sortable.create(canvasEl.value, {
    animation: 180,
    ghostClass: 'wz-ghost',
    chosenClass: 'wz-chosen',
    handle: '.wz-drag-handle',
    onEnd(evt: { oldIndex?: number | null; newIndex?: number | null }) {
      const { oldIndex, newIndex } = evt;
      if (oldIndex == null || newIndex == null || oldIndex === newIndex) return;
      const [moved] = widgets.value.splice(oldIndex, 1);
      if (moved) widgets.value.splice(newIndex, 0, moved);
      selectedIndex.value = newIndex;
    },
  });
}

async function onSave() {
  if (!activeFormId.value) { ElMessage.warning('请先选择表单'); return; }
  const tree = {
    formKey: 'page_' + props.page.pageId + '_' + activeFormId.value,
    labelWidth: '110px',
    size: 'default',
    pc: { widgetList: widgets.value },
  };
  const ok = await callWithFeedback(
    () => saveWizardWidget(activeFormId.value, JSON.stringify(tree, null, 2)),
    '表单布局已保存',
  );
  if (ok) await callWithFeedback(() => setWizardStep(props.page.pageId, 2), '');
}

async function switchMode(next: 'design' | 'preview') {
  mode.value = next;
  if (next === 'preview') {
    await onSave();
    try {
      previewConfig.value = await getRunConfig(activeFormId.value);
    } catch {
      previewConfig.value = null;
    }
  }
}

function onDictChange(dictCode: string) {
  if (!selected.value) return;
  selected.value.dictCode = dictCode || undefined;
  if (dictCode) selected.value.props.dictInfo = { dictCode };
  else delete selected.value.props.dictInfo;
}

async function onNext() {
  await onSave();
  const page = await callWithFeedback(() => setWizardStep(props.page.pageId, 2), '进入发布');
  if (page) emit('done', page);
}
</script>

<template>
  <div class="step-designer">
    <div class="step-intro">
      <h3>第 3 步 · 设计表单</h3>
      <p>把左侧字段拖到中间画布，右侧调整属性，顶部切换实时预览。系统已按数据模型自动生成三套表单，可继续精修。</p>
    </div>

    <div class="designer-toolbar">
      <div class="form-tabs">
        <ElSelect v-model="activeFormId" size="small" style="width: 220px" @change="loadWidget">
          <ElOption v-for="f in forms" :key="f.formId" :label="f.formName" :value="f.formId" />
        </ElSelect>
        <ElButton size="small" :loading="generating" @click="onGenerate">重新生成表单</ElButton>
      </div>
      <div class="mode-switch">
        <ElButton size="small" :type="mode === 'design' ? 'primary' : 'default'" @click="switchMode('design')">设计</ElButton>
        <ElButton size="small" :type="mode === 'preview' ? 'primary' : 'default'" @click="switchMode('preview')">实时预览</ElButton>
      </div>
    </div>

    <div class="designer-body">
      <!-- 左：控件池 -->
      <div v-show="mode === 'design'" class="ds-palette">
        <div class="panel-title">字段 / 控件池</div>
        <div class="panel-sub">来自已导入表（{{ palette.length }}）</div>
        <div class="palette-list">
          <div v-for="(item, i) in palette" :key="i" class="palette-item" @click="addFromPalette(item)">
            <span class="pi-icon">＋</span>
            <span class="pi-label">{{ item.title }}</span>
            <span class="pi-field">{{ item.field }}</span>
          </div>
        </div>
        <div class="panel-title" style="margin-top: 14px">基础 / 容器</div>
        <div class="palette-list">
          <div class="palette-item" @click="addContainer('grid')"><span class="pi-icon">▦</span><span class="pi-label">栅格容器</span></div>
          <div class="palette-item" @click="addContainer('divider')"><span class="pi-icon">—</span><span class="pi-label">分组标题</span></div>
          <div class="palette-item" @click="addFromPalette({ type: 'input', title: '单行文本', field: 'custom_text' })"><span class="pi-icon">＋</span><span class="pi-label">单行文本</span></div>
          <div class="palette-item" @click="addFromPalette({ type: 'number', title: '数字', field: 'custom_number' })"><span class="pi-icon">＋</span><span class="pi-label">数字</span></div>
        </div>
      </div>

      <!-- 中：画布 / 预览 -->
      <div class="ds-canvas-wrap">
        <template v-if="mode === 'design'">
          <div class="canvas-head">画布（拖拽左侧字段排序）<span>{{ widgets.length }} 个控件</span></div>
          <div ref="canvasEl" class="ds-canvas">
            <div
              v-for="(w, idx) in widgets"
              :key="w.key"
              class="canvas-item"
              :class="{ active: idx === selectedIndex }"
              @click="selectedIndex = idx"
            >
              <span class="wz-drag-handle" title="拖拽排序">⋮⋮</span>
              <div class="ci-body">
                <div class="ci-label">{{ w.title || w.type }} <span v-if="w.dictCode" class="ci-dict">字典:{{ w.dictCode }}</span></div>
                <div class="ci-mock">
                  <input v-if="['input', 'number'].includes(w.type)" :placeholder="w.props.placeholder" disabled />
                  <select v-else-if="['select', 'radio', 'checkbox'].includes(w.type)" disabled><option>{{ w.props.placeholder }}</option></select>
                  <span v-else-if="w.type === 'divider'" class="ci-divider">— {{ w.title }} —</span>
                  <input v-else :placeholder="w.type" disabled />
                </div>
              </div>
              <ElButton link type="danger" size="small" @click.stop="removeWidget(idx)">删</ElButton>
            </div>
            <div v-if="!widgets.length" class="canvas-empty">从左侧点击或拖拽字段到此处</div>
          </div>
        </template>
        <template v-else>
          <div class="canvas-head">实时预览<span>基于运行时渲染器</span></div>
          <div class="preview-area">
            <div v-if="previewConfig?.fields?.length" class="preview-form">
              <div v-for="f in previewConfig.fields" :key="f.fieldKey" class="preview-field">
                <label>{{ f.label }}<span v-if="f.required" class="req">*</span></label>
                <input v-if="['input', 'textarea'].includes(f.widgetType ?? '')" :placeholder="`请输入${f.label}`" />
                <select v-else-if="['select', 'radio', 'checkbox'].includes(f.widgetType ?? '')"><option>请选择{{ f.label }}</option></select>
                <input v-else type="number" :placeholder="f.label" />
              </div>
            </div>
            <div v-else class="canvas-empty">预览基于字段模型渲染；保存后可见</div>
          </div>
        </template>
      </div>

      <!-- 右：属性面板 -->
      <div v-show="mode === 'design'" class="ds-props">
        <div class="panel-title">控件属性</div>
        <template v-if="selected">
          <div class="prop-row"><label>标题</label><ElInput v-model="selected.title" size="small" /></div>
          <div class="prop-row"><label>字段标识</label><ElInput v-model="selected.field" size="small" /></div>
          <div class="prop-row"><label>控件类型</label>
            <ElSelect v-model="selected.type" size="small">
              <ElOption v-for="t in ONLINE_WIDGET_TYPES" :key="t.value" :label="t.label" :value="t.value" />
            </ElSelect>
          </div>
          <div class="prop-row"><label>占位提示</label><ElInput v-model="selected.props.placeholder" size="small" /></div>
          <div class="prop-row"><label>栅格宽度(1-24)</label><ElInputNumber v-model="selected.span" :min="1" :max="24" size="small" /></div>
          <div class="prop-row"><label>在线字典</label>
            <ElSelect :model-value="selected.dictCode ?? ''" size="small" clearable placeholder="不使用字典" @update:model-value="onDictChange">
              <ElOption v-for="d in dicts" :key="d.dictId" :label="`${d.dictName}(${d.dictCode})`" :value="d.dictCode" />
            </ElSelect>
          </div>
          <div class="prop-row"><label>必填</label><ElCheckbox v-model="selected.required" /></div>
        </template>
        <div v-else class="props-empty">选中一个控件以编辑属性</div>
      </div>
    </div>

    <div class="step-actions">
      <ElButton @click="emit('back')">上一步</ElButton>
      <ElButton @click="onSave">保存布局</ElButton>
      <ElButton type="primary" @click="onNext">下一步：发布运行</ElButton>
    </div>
  </div>
</template>

<style scoped>
.step-designer { }
.step-intro h3 { margin: 0 0 6px; font-size: 17px; }
.step-intro p { margin: 0 0 16px; color: var(--el-text-color-secondary); font-size: 13px; }
.designer-toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.form-tabs, .mode-switch { display: flex; align-items: center; gap: 8px; }
.designer-body { display: grid; grid-template-columns: 220px 1fr 240px; gap: 10px; min-height: 480px; }
.ds-palette, .ds-props { border: 1px solid var(--el-border-color); border-radius: 8px; padding: 12px; overflow: auto; max-height: 560px; }
.ds-canvas-wrap { border: 1px solid var(--el-border-color); border-radius: 8px; overflow: hidden; display: flex; flex-direction: column; }
.panel-title { font-weight: 600; font-size: 13px; margin-bottom: 8px; }
.panel-sub { font-size: 11px; color: var(--el-text-color-secondary); margin-bottom: 8px; }
.palette-list { display: flex; flex-direction: column; gap: 4px; }
.palette-item { display: flex; align-items: center; gap: 6px; padding: 6px 8px; border: 1px solid var(--el-border-color-lighter); border-radius: 5px; cursor: pointer; font-size: 12px; }
.palette-item:hover { background: var(--el-color-primary-light-9); border-color: var(--el-color-primary); }
.pi-icon { color: var(--el-color-primary); font-weight: 700; }
.pi-label { flex: 1; }
.pi-field { color: var(--el-text-color-secondary); font-size: 10px; }
.canvas-head { display: flex; justify-content: space-between; padding: 10px 12px; border-bottom: 1px solid var(--el-border-color-lighter); font-size: 13px; font-weight: 600; }
.canvas-head span { color: var(--el-text-color-secondary); font-weight: 400; font-size: 11px; }
.ds-canvas { flex: 1; padding: 12px; overflow: auto; min-height: 420px; }
.canvas-item { display: flex; align-items: center; gap: 8px; border: 1px solid var(--el-border-color-lighter); border-radius: 6px; padding: 8px; margin-bottom: 8px; cursor: pointer; }
.canvas-item.active { border-color: var(--el-color-primary); background: var(--el-color-primary-light-9); }
.wz-drag-handle { cursor: grab; color: var(--el-text-color-secondary); user-select: none; }
.ci-body { flex: 1; }
.ci-label { font-size: 12px; font-weight: 600; margin-bottom: 4px; }
.ci-dict { color: var(--el-color-success); font-size: 10px; font-weight: 400; }
.ci-mock input, .ci-mock select { width: 100%; max-width: 300px; padding: 4px 8px; border: 1px solid var(--el-border-color); border-radius: 4px; background: var(--el-fill-color-lighter); font-size: 12px; color: var(--el-text-color-placeholder); }
.ci-divider { color: var(--el-text-color-secondary); font-size: 12px; }
.canvas-empty { text-align: center; color: var(--el-text-color-placeholder); padding: 80px 20px; }
.wz-ghost { opacity: .5; background: var(--el-color-primary-light-9); }
.wz-chosen { border-color: var(--el-color-primary) !important; }
.prop-row { margin-bottom: 12px; }
.prop-row label { display: block; font-size: 12px; color: var(--el-text-color-secondary); margin-bottom: 4px; }
.props-empty { color: var(--el-text-color-placeholder); font-size: 13px; padding: 40px 0; text-align: center; }
.preview-area { padding: 16px; overflow: auto; flex: 1; }
.preview-form { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.preview-field { display: flex; flex-direction: column; gap: 5px; }
.preview-field label { font-size: 12px; font-weight: 600; }
.preview-field .req { color: var(--el-color-danger); }
.preview-field input, .preview-field select { padding: 6px 8px; border: 1px solid var(--el-border-color); border-radius: 4px; }
.step-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
</style>
