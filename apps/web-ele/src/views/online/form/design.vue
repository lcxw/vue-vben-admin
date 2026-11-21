<script lang="ts" setup>
import type {
  DesignerSelection,
  DesignWidget,
  FormDesignDoc,
  TableColumnDesign,
  WidgetKind,
} from './designer/types';

/**
 * v5 查询表单设计器（参照橙单 formDesign / OnlineQueryForm / OnlineFilterBox 的产品形态重做）。
 *
 * 左侧图标栏 → 视图 / 字段 / 组件面板（拖拽）→ 中间查询画布（左树 + 条件区 + 分页表格）
 * → 右侧「属性 / 事件 / 样式」三页签。
 *
 * 协议见 ./designer/types.ts：条件级 filterType / visible / advanced / props / events / styleConfig；
 * 表单级 layout / filter / leftTree / formEventList / formStyle。
 */
import type {
  FormColumn,
  FormDetail,
  FormTable,
  FormView,
} from '#/api/online/formCenter';
import type {
  FormFieldModel,
  FormWidgetEvent,
  OnlineDictVO,
} from '#/api/online/types';

import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import {
  ElButton,
  ElCheckbox,
  ElDialog,
  ElDrawer,
  ElForm,
  ElFormItem,
  ElInput,
  ElMessage,
  ElMessageBox,
  ElOption,
  ElSelect,
  ElTable,
  ElTableColumn,
  ElTag,
} from 'element-plus';

import { getOnlineDictList, getOnlineDictOptions } from '#/api/online/dict';
import {
  addFormTables,
  deleteFormRelation,
  getFormDetail,
  getFormMenuOptions,
  publishForm,
  removeFormTable,
  saveFormFields,
  saveFormRelation,
  saveFormView,
  syncFormViews,
  updateForm,
} from '#/api/online/formCenter';
import { getSchemaTables } from '#/api/online/modeling';

import {
  confirmAction,
  usePermission,
  withFeedback,
} from '../../system/shared/helpers';
import EditCanvas from './designer/EditCanvas.vue';
import EventPanel from './designer/EventPanel.vue';
import PropertyPanel from './designer/PropertyPanel.vue';
import QueryCanvas from './designer/QueryCanvas.vue';
import StylePanel from './designer/StylePanel.vue';
import {
  buildWidgetJson,
  columnFromField,
  defaultFilterForWidget,
  normalizeDoc,
  uid,
  WIDGET_CATALOG,
  widgetFromColumn,
} from './designer/types';

const route = useRoute();
const router = useRouter();
const { has } = usePermission();

const formId = computed(() => String(route.query.formId || ''));
const detail = ref<FormDetail | null>(null);
const loading = ref(false);
const saving = ref(false);
const dirty = ref(false);
const loadingDoc = ref(false);
const activeViewId = ref('');
const selection = ref<DesignerSelection>({ kind: 'form' });
const activeTab = ref<'event' | 'property' | 'style'>('property');
const leftTab = ref<'fields' | 'views' | 'widgets'>('views');
const leftVisible = ref(true);
const rightVisible = ref(true);
const fieldKeyword = ref('');
const doc = ref<FormDesignDoc | null>(null);
const dicts = ref<OnlineDictVO[]>([]);
const dictOptions = ref<
  Record<string, Array<{ label: string; parentValue?: string; value: any }>>
>({});
let dictTimer: null | ReturnType<typeof setTimeout> = null;

const views = computed<FormView[]>(() => detail.value?.views || []);
const activeView = computed<FormView | null>(
  () => views.value.find((v) => v.viewId === activeViewId.value) || null,
);
const isQueryView = computed(() =>
  [1, 2].includes(Number(doc.value?.viewType)),
);
const isChartView = computed(() => Number(doc.value?.viewType) === 6);

const masterTable = computed<FormTable | null>(() => {
  const tables = detail.value?.tables || [];
  return tables.find((t) => t.isMaster === 1) || tables[0] || null;
});

type TagType = 'danger' | 'info' | 'primary' | 'success' | 'warning';

function viewTypeLabel(viewType?: number) {
  return (
    {
      1: '列表页',
      2: '分组列表',
      3: '选择弹窗',
      5: '表单页',
      6: '统计页',
      9: '行编辑',
      10: '详情页',
    }[Number(viewType || 0)] || '视图'
  );
}

function viewTypeTag(viewType?: number): TagType {
  const type = Number(viewType || 0);
  if (type === 1) return 'primary';
  if (type === 2) return 'success';
  if (type === 6) return 'warning';
  return 'info';
}

function parseFieldJson(view: FormView | null): FormFieldModel[] {
  if (!view) return [];
  const master = masterTable.value;
  const masterFields = (master?.columns || [])
    .filter((c) => !c.isVirtual)
    .map((c) => ({
      fieldKey: c.columnName,
      column: c.columnName,
      label: c.columnComment || c.columnName,
      widgetType: c.widgetType || (c.dictCode ? 'select' : 'input'),
      dictCode: c.dictCode,
      filterType: c.filterType,
      isQuery: Boolean(c.isQuery),
      isList: Boolean(c.isList),
      isForm: Boolean(c.isForm),
      required: c.isNullable === 0 && c.isPk !== 1,
      fieldKind: 'normal',
    }));
  try {
    const parsed = JSON.parse(view.fieldJson || '{}');
    if (Array.isArray(parsed.fields) && parsed.fields.length > 0) {
      const fields = parsed.fields.map((f: any) => ({
        ...f,
        fieldKey: f.fieldKey || f.column,
        label: f.label || f.columnComment || f.fieldKey || f.column,
      }));
      // 视图 fieldJson 常只保留列表列，设计器字段面板需要主表全量字段，
      // 否则像“出生日期”这种非列表字段无法在设计器里绑定条件。
      masterFields.forEach((f) => {
        if (!fields.some((x: any) => (x.fieldKey || x.column) === f.fieldKey))
          fields.push(f);
      });
      return fields;
    }
  } catch {
    // 忽略脏 fieldJson，回退主表列
  }
  return masterFields;
}

const fieldColumns = computed<FormFieldModel[]>(() =>
  parseFieldJson(activeView.value),
);

const filteredFields = computed(() => {
  const keyword = fieldKeyword.value.trim().toLowerCase();
  if (!keyword) return fieldColumns.value;
  return fieldColumns.value.filter(
    (f) =>
      String(f.label || '')
        .toLowerCase()
        .includes(keyword) ||
      String(f.fieldKey || '')
        .toLowerCase()
        .includes(keyword),
  );
});

const widgetGroups = computed(() => {
  const groups: Record<string, typeof WIDGET_CATALOG> = {};
  WIDGET_CATALOG.forEach((item) => {
    if (isQueryView.value && item.group === '编辑控件') return;
    if (!isQueryView.value && item.group === '查询条件') return;
    const list = groups[item.group] || (groups[item.group] = []);
    if (!list.some((x) => x.kind === item.kind)) list.push(item);
  });
  return groups;
});

const selectedWidget = computed(() =>
  selection.value.kind === 'condition'
    ? doc.value?.widgetList.find((w) => w.key === selection.value.key)
    : undefined,
);
const selectedColumn = computed(() =>
  selection.value.kind === 'column'
    ? doc.value?.table.columns.find((c) => c.key === selection.value.key)
    : undefined,
);
const selectedKey = computed(() =>
  ['column', 'condition'].includes(selection.value.kind)
    ? selection.value.key
    : undefined,
);

const eventKind = computed<'column' | 'condition' | 'form' | 'leftTree'>(() => {
  if (selection.value.kind === 'condition') return 'condition';
  if (selection.value.kind === 'column') return 'column';
  if (selection.value.kind === 'leftTree') return 'leftTree';
  return 'form';
});

const eventList = computed<FormWidgetEvent[]>(() => {
  if (!doc.value) return [];
  if (eventKind.value === 'condition')
    return selectedWidget.value?.events || [];
  if (eventKind.value === 'column') return selectedColumn.value?.events || [];
  if (eventKind.value === 'leftTree') return doc.value.leftTree.events || [];
  return doc.value.formEventList || [];
});

const eventCount = computed(
  () => eventList.value.filter((e) => e.enabled !== false && e.script).length,
);
const conditionCount = computed(() => doc.value?.widgetList.length || 0);
const columnCount = computed(
  () => doc.value?.table.columns.filter((c) => c.show !== false).length || 0,
);
const scriptWidgetCount = computed(
  () =>
    doc.value?.widgetList.filter((w) =>
      w.events?.some((e) => e.enabled !== false && e.script),
    ).length || 0,
);

const selectionTitle = computed(() => {
  if (selection.value.kind === 'condition')
    return selectedWidget.value?.label || '查询条件';
  if (selection.value.kind === 'column')
    return selectedColumn.value?.label || '列表列';
  if (selection.value.kind === 'table') return '数据表格';
  if (selection.value.kind === 'leftTree') return '左侧树';
  return '整张表单';
});

function loadMissingDicts() {
  const codes = new Set<string>();
  doc.value?.widgetList.forEach((w) => {
    if (w.dictCode) codes.add(w.dictCode);
  });
  doc.value?.table.columns.forEach((c) => {
    if (c.dictCode) codes.add(c.dictCode);
  });
  if (doc.value?.leftTree?.dictCode) codes.add(doc.value.leftTree.dictCode);
  const missing = [...codes].filter((code) => !(code in dictOptions.value));
  if (missing.length === 0) return;
  Promise.all(
    missing.map(async (code) => {
      try {
        const opts = await getOnlineDictOptions(code);
        dictOptions.value[code] = opts || [];
      } catch {
        dictOptions.value[code] = [];
      }
    }),
  ).catch(() => undefined);
}

watch(
  doc,
  () => {
    if (loadingDoc.value) return;
    dirty.value = true;
    if (dictTimer) clearTimeout(dictTimer);
    dictTimer = setTimeout(loadMissingDicts, 400);
  },
  { deep: true },
);

async function load() {
  if (!formId.value) return;
  loading.value = true;
  try {
    detail.value = await getFormDetail(formId.value);
    dicts.value = await getOnlineDictList().catch(() => []);
    const preferred =
      views.value.find((v) => v.viewId === detail.value?.defaultViewId) ||
      views.value[0];
    if (preferred) await activateView(preferred.viewId, true);
  } catch (error) {
    ElMessage.error(`加载表单失败：${(error as Error).message || error}`);
  } finally {
    loading.value = false;
  }
}

async function persist(silent = false): Promise<boolean> {
  if (!doc.value || saving.value) return false;
  saving.value = true;
  try {
    const json = buildWidgetJson(doc.value);
    await saveFormView({ viewId: doc.value.viewId, widgetJson: json });
    const view = views.value.find((v) => v.viewId === doc.value?.viewId);
    if (view) view.widgetJson = json;
    dirty.value = false;
    if (!silent) ElMessage.success('设计已保存');
    return true;
  } catch (error) {
    ElMessage.error(`保存失败：${(error as Error).message || error}`);
    return false;
  } finally {
    saving.value = false;
  }
}

async function activateView(viewId: string, first = false) {
  if (activeViewId.value === viewId && doc.value) return;
  if (!first && dirty.value) {
    const ok = await persist(true);
    if (!ok) return;
  }
  const view = views.value.find((v) => v.viewId === viewId);
  if (!view) return;
  activeViewId.value = viewId;
  loadingDoc.value = true;
  doc.value = normalizeDoc(view, parseFieldJson(view));
  selection.value = { kind: 'form' };
  activeTab.value = 'property';
  dirty.value = false;
  await nextTick();
  loadingDoc.value = false;
  loadMissingDicts();
}

async function onSave() {
  await persist(false);
}

async function onSync() {
  if (dirty.value) await persist(true);
  const ok = await withFeedback(
    () => syncFormViews({ formId: formId.value }),
    '已按字段模型同步视图',
  );
  if (!ok) return;
  const keep = activeViewId.value;
  await load();
  if (views.value.some((v) => v.viewId === keep))
    await activateView(keep, true);
}

async function onResetView() {
  const view = activeView.value;
  if (!view) return;
  if (!(await confirmAction('重置为上次保存的设计？当前未保存的修改会丢失。')))
    return;
  loadingDoc.value = true;
  doc.value = normalizeDoc(view, parseFieldJson(view));
  selection.value = { kind: 'form' };
  dirty.value = false;
  await nextTick();
  loadingDoc.value = false;
  loadMissingDicts();
  ElMessage.info('已重置到上次保存版本');
}

async function onPreview() {
  if (dirty.value && !(await persist(true))) return;
  // 运行时入口按“视图”加载：页面 id 只用于设计器，必须传当前视图 id。
  const previewViewId =
    activeViewId.value || detail.value?.defaultViewId || views.value[0]?.viewId;
  if (!previewViewId) {
    ElMessage.warning('当前表单还没有可预览的视图');
    return;
  }
  if (activeView.value && Number(activeView.value.viewType) === 6) {
    ElMessage.info('统计视图将按聚合配置渲染，可在运行页查看图表');
  }
  router.push({ name: 'OnlineFormRun', query: { formId: previewViewId } });
}

// ---------------- 画布编辑 ----------------

function fieldsMap(): Map<string, FormFieldModel> {
  return new Map(
    fieldColumns.value.map((f) => [f.fieldKey || f.column || '', f]),
  );
}

function onCanvasSelect(kind: string, key?: string) {
  selection.value = { kind: kind as DesignerSelection['kind'], key };
  activeTab.value = 'property';
  rightVisible.value = true;
}

function addWidgetFromField(
  field: string,
  target: 'column' | 'condition' = 'condition',
) {
  const model = fieldColumns.value.find(
    (f) => f.fieldKey === field || f.column === field,
  );
  if (!doc.value || !model) return;
  if (target === 'column') {
    const existing = doc.value.table.columns.find((c) => c.field === field);
    if (existing) {
      selection.value = { kind: 'column', key: existing.key };
      activeTab.value = 'property';
      return;
    }
    const col = columnFromField(model, doc.value.table.columns.length);
    doc.value.table.columns.push(col);
    selection.value = { kind: 'column', key: col.key };
    activeTab.value = 'property';
    return;
  }
  const existing = doc.value.widgetList.find((w) => w.field === field);
  if (existing) {
    selection.value = { kind: 'condition', key: existing.key };
    activeTab.value = 'property';
    return;
  }
  const widget = widgetFromColumn(
    model,
    doc.value.widgetList.length,
    fieldsMap(),
  );
  doc.value.widgetList.push(widget);
  selection.value = { kind: 'condition', key: widget.key };
  activeTab.value = 'property';
}

function addWidgetKind(kind: string) {
  if (!doc.value) return;
  const def = WIDGET_CATALOG.find((item) => item.kind === kind);
  const label = def?.label || '新控件';
  const widget: DesignWidget = {
    key: uid(kind),
    field: '',
    column: '',
    label,
    widgetType: kind as WidgetKind,
    filterType: defaultFilterForWidget(kind as WidgetKind),
    visible: true,
    advanced: false,
    span: 12,
    itemWidth: 0,
    defaultValue: undefined,
    placeholder: kind.includes('date') ? '请选择日期' : '请输入/请选择',
    required: false,
    dictCode: '',
    dictMultiple: false,
    props: {},
    events: [],
    styleConfig: {},
    options: [],
  };
  doc.value.widgetList.push(widget);
  selection.value = { kind: 'condition', key: widget.key };
  activeTab.value = 'property';
}

function addColumnGeneric() {
  if (!doc.value) return;
  const used = new Set(doc.value.table.columns.map((c) => c.field));
  const available = fieldColumns.value.find((f) => !used.has(f.fieldKey));
  if (available) {
    addWidgetFromField(available.fieldKey, 'column');
    return;
  }
  const col: TableColumnDesign = {
    key: uid('col'),
    field: '',
    label: '新列',
    widgetType: 'input',
    width: 140,
    minWidth: 100,
    align: 'left',
    fixed: '',
    sortable: false,
    show: true,
    className: '',
    styleConfig: {},
    events: [],
  };
  doc.value.table.columns.push(col);
  selection.value = { kind: 'column', key: col.key };
  activeTab.value = 'property';
}

function removeCondition(key: string) {
  if (!doc.value) return;
  const index = doc.value.widgetList.findIndex((w) => w.key === key);
  if (index !== -1) doc.value.widgetList.splice(index, 1);
  if (selection.value.key === key) selection.value = { kind: 'form' };
}

function moveCondition(key: string, delta: number) {
  if (!doc.value) return;
  const index = doc.value.widgetList.findIndex((w) => w.key === key);
  const to = index + delta;
  if (index === -1 || to < 0 || to >= doc.value.widgetList.length) return;
  const [item] = doc.value.widgetList.splice(index, 1);
  if (item) doc.value.widgetList.splice(to, 0, item);
}

function duplicateCondition(key: string) {
  if (!doc.value) return;
  const widget = doc.value.widgetList.find((w) => w.key === key);
  if (!widget) return;
  const copy: DesignWidget = JSON.parse(JSON.stringify(widget));
  copy.key = uid('copy');
  copy.label = `${widget.label} 副本`;
  const index = doc.value.widgetList.indexOf(widget);
  doc.value.widgetList.splice(index + 1, 0, copy);
  selection.value = { kind: 'condition', key: copy.key };
}

function onEditDropField(field: string) {
  onDropField(field, 'condition');
}

function onDropField(field: string, target: 'column' | 'condition') {
  addWidgetFromField(field, target);
}

function onAddWidget(kind: string) {
  addWidgetKind(kind);
}

function onFieldDragStart(event: DragEvent, field: string) {
  event.dataTransfer?.setData('text/lunar-field', field);
  event.dataTransfer?.setData('text/plain', field);
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
}

function onPaletteDragStart(event: DragEvent, kind: string) {
  event.dataTransfer?.setData('text/lunar-widget', kind);
  event.dataTransfer?.setData('text/plain', kind);
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
}

// ---------------- 统计图表 ----------------

function addChart() {
  if (!doc.value) return;
  doc.value.charts.push({
    agg: 'COUNT',
    dimension: fieldColumns.value[0]?.fieldKey || '',
    key: `chart_${doc.value.charts.length + 1}`,
    span: 12,
    title: '统计图表',
    type: 'bar',
  });
}

function removeChart(index: number) {
  doc.value?.charts.splice(index, 1);
}

// ---------------- 建模抽屉 ----------------

const modelVisible = ref(false);
const modelTables = ref<FormTable[]>([]);
const modelColumns = ref<Array<FormColumn & { sync?: boolean }>>([]);
const relationVisible = ref(false);
const relationForm = reactive({
  fromTableId: '',
  fromColumn: '',
  toTableId: '',
  toColumn: '',
  cardinality: 'MANY_TO_ONE',
});
const addTableVisible = ref(false);
const addTableOptions = ref<
  Array<{ tableComment?: string; tableName: string }>
>([]);
const addTableSelected = ref<string[]>([]);

async function openModel() {
  if (!detail.value) return;
  modelTables.value = detail.value.tables;
  const rows: Array<FormColumn & { sync?: boolean }> = [];
  detail.value.tables.forEach((t) => {
    t.columns.forEach((c) => rows.push({ ...c, sync: true }));
  });
  modelColumns.value = rows;
  modelVisible.value = true;
}

async function saveModelFields() {
  const ok = await withFeedback(
    () =>
      saveFormFields(
        formId.value,
        modelColumns.value.map((c) => ({
          columnComment: c.columnComment,
          columnModelId: c.columnModelId,
          dictCode: c.dictCode ?? '',
          isForm: c.isForm,
          isList: c.isList,
          isQuery: c.isQuery,
          sync: true,
          widgetType: c.widgetType,
        })),
      ),
    '字段模型已保存，视图已同步',
  );
  if (!ok) return;
  modelVisible.value = false;
  const keep = activeViewId.value;
  await load();
  if (views.value.some((v) => v.viewId === keep))
    await activateView(keep, true);
}

async function openAddTable() {
  if (!detail.value?.dblinkCode) return;
  addTableSelected.value = [];
  addTableOptions.value = await getSchemaTables(detail.value.dblinkCode);
  addTableVisible.value = true;
}

async function submitAddTable() {
  if (addTableSelected.value.length === 0) return;
  const ok = await withFeedback(
    () => addFormTables(formId.value, addTableSelected.value),
    '数据表已加入表单',
  );
  if (!ok) return;
  addTableVisible.value = false;
  await load();
}

async function onRemoveTable(table: FormTable) {
  if (table.isMaster === 1) {
    ElMessage.warning('主表不能移除');
    return;
  }
  if (!(await confirmAction(`从表单移除数据表「${table.tableName}」？`)))
    return;
  const ok = await withFeedback(
    () => removeFormTable(formId.value, table.tableModelId),
    '已移除',
  );
  if (!ok) return;
  await load();
  await openModel();
}

function openRelation() {
  const t = modelTables.value[0];
  relationForm.fromTableId = t?.tableModelId || '';
  relationForm.fromColumn = t?.primaryKey || 'id';
  relationForm.toTableId = modelTables.value[1]?.tableModelId || '';
  relationForm.toColumn = '';
  relationVisible.value = true;
}

async function submitRelation() {
  const ok = await withFeedback(
    () =>
      saveFormRelation(formId.value, {
        fromColumn: relationForm.fromColumn,
        fromTableId: relationForm.fromTableId,
        toColumn: relationForm.toColumn,
        toTableId: relationForm.toTableId,
        cardinality: relationForm.cardinality,
      }),
    '关系已保存',
  );
  if (!ok) return;
  relationVisible.value = false;
  await load();
  await openModel();
}

async function removeRelation(edgeId?: string) {
  if (!edgeId) return;
  const ok = await withFeedback(
    () => deleteFormRelation(formId.value, edgeId),
    '关系已删除',
  );
  if (!ok) return;
  await load();
  await openModel();
}

function columnsOfTable(tableId: string) {
  return (
    modelTables.value.find((t) => t.tableModelId === tableId)?.columns || []
  );
}

// ---------------- 发布 / 改名 ----------------

const publishVisible = ref(false);
const menuOptions = ref<Array<{ id: string; name: string }>>([]);
const publishFormModel = reactive({
  entryViewId: '',
  menuName: '',
  menuParentId: 'ui-menu-online',
});

async function openPublish() {
  if (dirty.value && !(await persist(true))) return;
  publishFormModel.menuName = detail.value?.formName || '';
  publishFormModel.entryViewId =
    detail.value?.defaultViewId ||
    views.value.find((v) => v.viewType === 1)?.viewId ||
    views.value[0]?.viewId ||
    '';
  try {
    menuOptions.value = await getFormMenuOptions();
  } catch {
    menuOptions.value = [];
  }
  publishVisible.value = true;
}

async function submitPublish() {
  const ok = await withFeedback(
    () =>
      publishForm({
        entryViewId: publishFormModel.entryViewId,
        formId: formId.value,
        menuName: publishFormModel.menuName,
        menuParentId: publishFormModel.menuParentId,
      }),
    '已发布，菜单已生成',
  );
  if (!ok) return;
  publishVisible.value = false;
  await load();
}

async function renameForm() {
  const res = await ElMessageBox.prompt('表单名称', '重命名', {
    inputValue: detail.value?.formName || '',
    showCancelButton: true,
  }).catch(() => null);
  if (!res) return;
  const ok = await withFeedback(
    () => updateForm({ formId: formId.value, formName: res.value.trim() }),
    '已重命名',
  );
  if (ok) await load();
}

function fieldBadge(field: FormFieldModel, flag: 'form' | 'list' | 'query') {
  if (flag === 'query') return field.isQuery;
  if (flag === 'list') return field.isList;
  return field.isForm;
}

let panelsFitted = false;

/** 首次进入时按视口自适应：窄屏自动收起左右面板，把空间让给画布。 */
function fitPanels() {
  if (panelsFitted) return;
  panelsFitted = true;
  if (window.innerWidth < 1400) {
    leftVisible.value = false;
    rightVisible.value = false;
  }
}

onMounted(() => {
  fitPanels();
  load();
});
</script>

<template>
  <div v-loading="loading" class="designer-shell">
    <!-- 顶部 -->
    <header class="designer-header">
      <div class="header-left">
        <button class="back-link" @click="router.push('/online/form')">
          ← 表单中心
        </button>
        <div class="header-title">
          <span class="form-name">{{ detail?.formName || '表单设计' }}</span>
          <span class="form-code">{{ detail?.formCode }}</span>
          <ElTag
            :type="detail?.published === 1 ? 'success' : 'info'"
            effect="plain"
            size="small"
          >
            {{ detail?.published === 1 ? '已发布' : '草稿' }}
          </ElTag>
          <button class="rename-btn" @click="renameForm">改名</button>
        </div>
      </div>
      <div class="header-actions">
        <span class="save-state" :class="{ dirty }">
          {{ dirty ? '● 有未保存修改' : '✓ 已保存' }}
        </span>
        <ElButton size="small" @click="openModel">数据建模</ElButton>
        <ElButton size="small" @click="onSync">按字段同步</ElButton>
        <ElButton size="small" :loading="saving" @click="onSave">
保存设计
</ElButton>
        <ElButton
          v-if="has('online:form:publish')"
          size="small"
          type="success"
          @click="openPublish"
        >
          发布
        </ElButton>
      </div>
    </header>

    <div class="designer-body">
      <!-- 最左图标栏 -->
      <nav class="rail">
        <button
          class="rail-btn"
          :class="{ active: leftTab === 'views' }"
          title="视图"
          @click="
            leftTab = 'views';
            leftVisible = true;
          "
        >
          <span class="rail-icon">▤</span>
          <span>视图</span>
        </button>
        <button
          class="rail-btn"
          :class="{ active: leftTab === 'fields' }"
          title="字段"
          @click="
            leftTab = 'fields';
            leftVisible = true;
          "
        >
          <span class="rail-icon">⌘</span>
          <span>字段</span>
        </button>
        <button
          class="rail-btn"
          :class="{ active: leftTab === 'widgets' }"
          title="组件"
          @click="
            leftTab = 'widgets';
            leftVisible = true;
          "
        >
          <span class="rail-icon">＋</span>
          <span>组件</span>
        </button>
        <span class="rail-spacer"></span>
        <div class="rail-version">v5</div>
      </nav>

      <!-- 左侧面板 -->
      <aside v-show="leftVisible" class="left-panel">
        <template v-if="leftTab === 'views'">
          <div class="panel-head">
            <span>视图列表</span>
            <span class="count-pill">{{ views.length }}</span>
          </div>
          <div class="view-list">
            <button
              v-for="(view, index) in views"
              :key="view.viewId"
              class="view-card"
              :class="{ active: view.viewId === activeViewId }"
              @click="activateView(view.viewId)"
            >
              <span class="view-index">{{ index + 1 }}</span>
              <span class="view-info">
                <span class="view-name">{{ view.viewName }}</span>
                <span class="view-meta">
                  {{ viewTypeLabel(view.viewType) }}
                  <span v-if="view.viewId === detail?.defaultViewId">
                    · 默认入口</span>
                </span>
              </span>
              <ElTag
                :type="viewTypeTag(view.viewType)"
                effect="plain"
                size="small"
              >
                {{ viewTypeLabel(view.viewType) }}
              </ElTag>
            </button>
          </div>
          <div class="panel-tip">
            一个业务表单可拥有列表、表单、详情、统计等多个视图。设计器按视图独立保存。
          </div>
        </template>

        <template v-else-if="leftTab === 'fields'">
          <div class="panel-head">
            <span>字段模型</span>
            <span class="count-pill">{{ filteredFields.length }}</span>
          </div>
          <ElInput
            v-model="fieldKeyword"
            size="small"
            clearable
            placeholder="搜索字段名 / 注释"
            class="panel-search"
          />
          <div class="field-hint">
            拖到条件区 = 查询条件；拖到表格 = 列表列；点击直接添加。
          </div>
          <div class="field-list">
            <div
              v-for="field in filteredFields"
              :key="field.fieldKey"
              class="field-card"
              draggable="true"
              @click="addWidgetFromField(field.fieldKey)"
              @dragstart="onFieldDragStart($event, field.fieldKey)"
            >
              <div class="field-main">
                <span class="field-label">{{ field.label }}</span>
                <span class="field-name">{{ field.fieldKey }}</span>
              </div>
              <div class="field-badges">
                <span v-if="fieldBadge(field, 'query')" class="f-badge q">查</span>
                <span v-if="fieldBadge(field, 'list')" class="f-badge l">列</span>
                <span v-if="fieldBadge(field, 'form')" class="f-badge f">表</span>
                <span v-if="field.dictCode" class="f-badge d">典</span>
              </div>
              <span class="field-drag">⠿</span>
            </div>
            <div v-if="!filteredFields.length" class="panel-empty">
              暂无字段，先在「数据建模」里同步表字段。
            </div>
          </div>
        </template>

        <template v-else>
          <div class="panel-head">
            <span>组件面板</span>
          </div>
          <div class="field-hint">拖入或点击组件，按当前视图类型加入画布。</div>
          <div
            v-for="(items, group) in widgetGroups"
            :key="group"
            class="widget-group"
          >
            <div class="group-title">{{ group }}</div>
            <div class="widget-grid">
              <button
                v-for="item in items"
                :key="`${group}_${item.kind}`"
                class="widget-card"
                draggable="true"
                :title="item.desc"
                @click="addWidgetKind(item.kind)"
                @dragstart="onPaletteDragStart($event, item.kind)"
              >
                <span class="widget-icon">{{ item.icon }}</span>
                <span class="widget-name">{{ item.label }}</span>
              </button>
            </div>
          </div>
        </template>
      </aside>

      <!-- 中间画布 -->
      <main class="canvas-area">
        <div class="canvas-toolbar">
          <div class="canvas-title">
            <span class="canvas-view-name">{{
              activeView?.viewName || '未选择视图'
            }}</span>
            <ElTag
              :type="viewTypeTag(activeView?.viewType)"
              effect="plain"
              size="small"
            >
              {{ viewTypeLabel(activeView?.viewType) }}
            </ElTag>
            <span class="canvas-summary">
              条件 {{ conditionCount }} · 列 {{ columnCount }} · 脚本
              {{ scriptWidgetCount }}
            </span>
          </div>
          <div class="canvas-tools">
            <ElButton size="small" text @click="leftVisible = !leftVisible">
              {{ leftVisible ? '‹ 收起左栏' : '› 视图字段' }}
            </ElButton>
            <ElButton size="small" text @click="rightVisible = !rightVisible">
              {{ rightVisible ? '属性 ›' : '⚙ 属性' }}
            </ElButton>
            <span class="tool-divider"></span>
            <span class="device-chip active" title="当前编辑 PC 端">PC</span>
            <span class="device-chip disabled" title="移动端配置预留">手机</span>
            <ElButton size="small" text @click="onResetView">重置</ElButton>
            <ElButton size="small" @click="onPreview">预览</ElButton>
          </div>
        </div>

        <div class="canvas-scroll">
          <QueryCanvas
            v-if="doc && isQueryView"
            :dicts="dictOptions"
            :doc="doc"
            :selected-key="selectedKey"
            :selected-kind="selection.kind"
            @add-column="addColumnGeneric"
            @add-condition="addWidgetKind('input')"
            @add-widget="onAddWidget"
            @drop-field="onDropField"
            @duplicate-condition="duplicateCondition"
            @move-condition="moveCondition"
            @remove-condition="removeCondition"
            @select="onCanvasSelect"
          />

          <EditCanvas
            v-else-if="doc && !isChartView"
            :doc="doc"
            :selected-key="selectedKey"
            :selected-kind="selection.kind"
            @add-widget="addWidgetKind"
            @drop-field="onEditDropField"
            @select="onCanvasSelect"
          />

          <div v-else-if="doc && isChartView" class="chart-canvas">
            <div class="chart-head">
              <div>
                <div class="chart-title">统计图表</div>
                <div class="chart-sub">
                  维度 + 指标聚合；运行期按视图 formType=6 渲染
                </div>
              </div>
              <ElButton size="small" @click="addChart">＋ 图表</ElButton>
            </div>
            <div class="chart-grid">
              <div
                v-for="(chart, index) in doc.charts"
                :key="index"
                class="chart-card"
              >
                <div class="chart-card-head">
                  <ElInput
                    v-model="chart.title"
                    size="small"
                    placeholder="图表标题"
                  />
                  <button class="chart-remove" @click="removeChart(index)">
                    ×
                  </button>
                </div>
                <ElSelect
                  v-model="chart.type"
                  size="small"
                  class="chart-field"
                >
                  <ElOption label="柱状图" value="bar" />
                  <ElOption label="折线图" value="line" />
                  <ElOption label="饼图" value="pie" />
                </ElSelect>
                <ElSelect
                  v-model="chart.dimension"
                  size="small"
                  filterable
                  class="chart-field"
                  placeholder="维度字段"
                >
                  <ElOption
                    v-for="f in fieldColumns"
                    :key="f.fieldKey"
                    :label="f.label"
                    :value="f.fieldKey"
                  />
                </ElSelect>
                <ElSelect v-model="chart.agg" size="small" class="chart-field">
                  <ElOption label="计数 COUNT" value="COUNT" />
                  <ElOption label="求和 SUM" value="SUM" />
                  <ElOption label="平均 AVG" value="AVG" />
                </ElSelect>
                <div class="chart-preview">
                  <span
                    v-for="i in 5"
                    :key="i"
                    :style="{ height: `${20 + i * 12}px` }"
                  ></span>
                </div>
              </div>
              <div
                v-if="!doc.charts.length"
                class="chart-empty"
                @click="addChart"
              >
                ＋ 添加第一张统计图表
              </div>
            </div>
          </div>
        </div>

        <footer class="statusbar">
          <span>{{ selectionTitle }}</span>
          <span class="dot">·</span>
          <span>{{
            isQueryView ? '查询页' : isChartView ? '统计页' : '表单页'
          }}</span>
          <span class="dot">·</span>
          <span>视图
            {{
              activeViewId
                ? views.findIndex((v) => v.viewId === activeViewId) + 1
                : 0
            }}/{{ views.length }}</span>
          <span class="status-spacer"></span>
          <span>{{ dirty ? '未保存' : '已同步' }}</span>
        </footer>
      </main>

      <!-- 右侧属性 -->
      <aside v-show="rightVisible" class="right-panel">
        <div class="right-head">
          <div class="right-title">{{ selectionTitle }}</div>
          <div class="right-sub">
            {{ selection.kind === 'form' ? '表单级配置' : '字段级配置' }}
          </div>
        </div>
        <div class="right-tabs">
          <button
            :class="{ active: activeTab === 'property' }"
            @click="activeTab = 'property'"
          >
            属性
          </button>
          <button
            :class="{ active: activeTab === 'event' }"
            @click="activeTab = 'event'"
          >
            事件
            <span v-if="eventCount" class="tab-badge">{{ eventCount }}</span>
          </button>
          <button
            :class="{ active: activeTab === 'style' }"
            @click="activeTab = 'style'"
          >
            样式
          </button>
        </div>
        <div class="right-body">
          <PropertyPanel
            v-if="doc && activeTab === 'property'"
            :columns="fieldColumns"
            :dicts="dicts"
            :doc="doc"
            :selection="selection"
          />
          <EventPanel
            v-else-if="doc && activeTab === 'event'"
            :events="eventList"
            :kind="eventKind"
          />
          <StylePanel
            v-else-if="doc && activeTab === 'style'"
            :doc="doc"
            :selection="selection"
          />
        </div>
      </aside>
    </div>

    <!-- 建模抽屉 -->
    <ElDrawer v-model="modelVisible" title="数据建模" size="72%">
      <div class="model-toolbar">
        <ElButton size="small" @click="openAddTable">＋ 添加数据表</ElButton>
        <ElButton size="small" @click="openRelation">＋ 建立关系</ElButton>
        <span class="model-hint">字段策略决定同步生成的查询条件 / 列表列 / 表单控件。</span>
      </div>
      <div
        v-for="table in modelTables"
        :key="table.tableModelId"
        class="model-table"
      >
        <div class="model-table-head">
          <span class="model-table-name">{{ table.tableName }}</span>
          <ElTag v-if="table.isMaster === 1" size="small" type="warning">
主表
</ElTag>
          <span class="model-table-comment">{{ table.tableComment }}</span>
          <ElButton
            v-if="table.isMaster !== 1"
            link
            type="danger"
            size="small"
            @click="onRemoveTable(table)"
          >
            移除
          </ElButton>
        </div>
        <ElTable
          :data="
            modelColumns.filter((c) => c.tableModelId === table.tableModelId)
          "
          border
          size="small"
        >
          <ElTableColumn label="字段" width="160">
            <template #default="{ row }">
<span class="mono">{{ row.columnName }}</span>
</template>
          </ElTableColumn>
          <ElTableColumn label="标题" min-width="160">
            <template #default="{ row }">
<ElInput v-model="row.columnComment" size="small" />
</template>
          </ElTableColumn>
          <ElTableColumn label="控件" width="120">
            <template #default="{ row }">
              <ElSelect v-model="row.widgetType" size="small">
                <ElOption label="输入框" value="input" />
                <ElOption label="文本域" value="textarea" />
                <ElOption label="数字" value="number" />
                <ElOption label="日期" value="date" />
                <ElOption label="日期时间" value="datetime" />
                <ElOption label="开关" value="switch" />
                <ElOption label="下拉" value="select" />
              </ElSelect>
            </template>
          </ElTableColumn>
          <ElTableColumn label="字典" width="140">
            <template #default="{ row }">
              <ElInput
                v-model="row.dictCode"
                size="small"
                placeholder="dictCode"
              />
            </template>
          </ElTableColumn>
          <ElTableColumn label="查询" width="62">
            <template #default="{ row }">
              <ElCheckbox
                v-model="row.isQuery"
                :true-value="1"
                :false-value="0"
              />
            </template>
          </ElTableColumn>
          <ElTableColumn label="列表" width="62">
            <template #default="{ row }">
              <ElCheckbox
                v-model="row.isList"
                :true-value="1"
                :false-value="0"
              />
            </template>
          </ElTableColumn>
          <ElTableColumn label="表单" width="62">
            <template #default="{ row }">
              <ElCheckbox
                v-model="row.isForm"
                :true-value="1"
                :false-value="0"
              />
            </template>
          </ElTableColumn>
        </ElTable>
      </div>

      <div class="model-relations">
        <div class="model-table-name">表关系</div>
        <div v-if="(detail?.relations || []).length === 0" class="model-hint">
          暂无关系，可按 xxx_id 自动推断或手动建立。
        </div>
        <div
          v-for="r in detail?.relations || []"
          :key="r.edgeId"
          class="relation-row"
        >
          <span>{{
            r.edgeName ||
            `${r.fromTableId}.${r.fromColumn} → ${r.toTableId}.${r.toColumn}`
          }}</span>
          <ElTag size="small" type="info">{{ r.cardinality }}</ElTag>
          <ElButton
            link
            type="danger"
            size="small"
            @click="removeRelation(r.edgeId)"
            >
删除
</ElButton>
        </div>
      </div>

      <template #footer>
        <ElButton @click="modelVisible = false">关闭</ElButton>
        <ElButton type="primary" @click="saveModelFields">
保存字段并同步视图
</ElButton>
      </template>
    </ElDrawer>

    <ElDialog v-model="addTableVisible" title="添加数据表" width="560px">
      <ElSelect
        v-model="addTableSelected"
        class="w-full"
        multiple
        filterable
        placeholder="选择要加入表单的物理表"
      >
        <ElOption
          v-for="t in addTableOptions"
          :key="t.tableName"
          :label="
            t.tableComment ? `${t.tableName}（${t.tableComment}）` : t.tableName
          "
          :value="t.tableName"
        />
      </ElSelect>
      <template #footer>
        <ElButton @click="addTableVisible = false">取消</ElButton>
        <ElButton type="primary" @click="submitAddTable">加入</ElButton>
      </template>
    </ElDialog>

    <ElDialog v-model="relationVisible" title="建立表关系" width="560px">
      <ElForm label-width="80px">
        <ElFormItem label="起点表">
          <ElSelect v-model="relationForm.fromTableId" class="w-full">
            <ElOption
              v-for="t in modelTables"
              :key="t.tableModelId"
              :label="t.tableName"
              :value="t.tableModelId"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="起点列">
          <ElSelect v-model="relationForm.fromColumn" class="w-full" filterable>
            <ElOption
              v-for="c in columnsOfTable(relationForm.fromTableId)"
              :key="c.columnName"
              :label="c.columnName"
              :value="c.columnName"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="终点表">
          <ElSelect v-model="relationForm.toTableId" class="w-full">
            <ElOption
              v-for="t in modelTables"
              :key="t.tableModelId"
              :label="t.tableName"
              :value="t.tableModelId"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="终点列">
          <ElSelect v-model="relationForm.toColumn" class="w-full" filterable>
            <ElOption
              v-for="c in columnsOfTable(relationForm.toTableId)"
              :key="c.columnName"
              :label="c.columnName"
              :value="c.columnName"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="基数">
          <ElSelect v-model="relationForm.cardinality">
            <ElOption label="一对多" value="ONE_TO_MANY" />
            <ElOption label="多对一" value="MANY_TO_ONE" />
            <ElOption label="一对一" value="ONE_TO_ONE" />
          </ElSelect>
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="relationVisible = false">取消</ElButton>
        <ElButton type="primary" @click="submitRelation">保存</ElButton>
      </template>
    </ElDialog>

    <ElDialog v-model="publishVisible" title="发布并绑定菜单" width="520px">
      <ElForm label-width="90px">
        <ElFormItem label="菜单名称">
<ElInput v-model="publishFormModel.menuName" />
</ElFormItem>
        <ElFormItem label="上级目录">
          <ElSelect v-model="publishFormModel.menuParentId" class="w-full">
            <ElOption
              v-for="m in menuOptions"
              :key="m.id"
              :label="m.name"
              :value="m.id"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="入口视图">
          <ElSelect v-model="publishFormModel.entryViewId" class="w-full">
            <ElOption
              v-for="v in views"
              :key="v.viewId"
              :label="`${viewTypeLabel(v.viewType)} · ${v.viewName}`"
              :value="v.viewId"
            />
          </ElSelect>
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="publishVisible = false">取消</ElButton>
        <ElButton type="primary" @click="submitPublish">发布</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<style scoped>
.designer-shell {
  /* 设计工作室固定浅色皮肤：避免应用暗色主题把画布/属性面板里的控件染成黑底。 */
  --el-bg-color: #fff;
  --el-bg-color-overlay: #fff;
  --el-bg-color-page: #f3f5f9;
  --el-fill-color: #f5f7fa;
  --el-fill-color-light: #f5f7fa;
  --el-fill-color-lighter: #fafafa;
  --el-fill-color-blank: #fff;
  --el-border-color: #dcdfe6;
  --el-border-color-light: #e4e7ed;
  --el-border-color-lighter: #ebeef5;
  --el-text-color-primary: #303133;
  --el-text-color-regular: #606266;
  --el-text-color-secondary: #909399;
  --el-text-color-placeholder: #a8abb2;
  --el-text-color-disabled: #a8abb2;
  --el-disabled-bg-color: #f5f7fa;
  --el-disabled-text-color: #a8abb2;
  --el-disabled-border-color: #e4e7ed;

  display: flex;
  flex-direction: column;
  height: calc(100vh - 110px);
  min-height: 700px;
  overflow: hidden;
  color: #303133;
  color-scheme: light;
  background: #f3f5f9;
  border-radius: 6px;
}

.designer-header {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: space-between;
  height: 52px;
  padding: 0 16px;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
}

.header-left {
  display: flex;
  gap: 14px;
  align-items: center;
  min-width: 0;
}

.back-link {
  padding: 0;
  font-size: 12px;
  color: #606266;
  cursor: pointer;
  background: none;
  border: none;
}

.back-link:hover {
  color: #2563eb;
}

.header-title {
  display: flex;
  gap: 8px;
  align-items: center;
  min-width: 0;
}

.form-name {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 15px;
  font-weight: 600;
  color: #1f2937;
  white-space: nowrap;
}

.form-code {
  font-family: Consolas, monospace;
  font-size: 11px;
  color: #909399;
}

.rename-btn {
  padding: 0;
  font-size: 11px;
  color: #2563eb;
  cursor: pointer;
  background: none;
  border: none;
}

.header-actions {
  display: flex;
  flex: none;
  gap: 6px;
  align-items: center;
}

.save-state {
  margin-right: 4px;
  font-size: 11px;
  color: #67c23a;
}

.save-state.dirty {
  color: #e6a23c;
}

.designer-body {
  display: flex;
  flex: 1;
  min-height: 0;
}

.rail {
  display: flex;
  flex: none;
  flex-direction: column;
  align-items: center;
  width: 58px;
  padding: 8px 0;
  background: #fff;
  border-right: 1px solid #e4e7ed;
}

.rail-btn {
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: center;
  width: 46px;
  padding: 8px 0;
  margin-bottom: 4px;
  font-size: 11px;
  color: #7b8794;
  cursor: pointer;
  background: none;
  border: none;
  border-radius: 6px;
}

.rail-btn:hover {
  color: #2563eb;
  background: #f2f7ff;
}

.rail-btn.active {
  color: #2563eb;
  background: #eaf2ff;
}

.rail-icon {
  font-size: 17px;
  line-height: 20px;
}

.rail-spacer {
  flex: 1;
}

.rail-version {
  font-size: 10px;
  color: #c0c4cc;
}

.left-panel {
  display: flex;
  flex: none;
  flex-direction: column;
  width: 248px;
  min-height: 0;
  overflow: auto;
  background: #fbfcfe;
  border-right: 1px solid #e4e7ed;
}

.panel-head {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: space-between;
  padding: 12px 12px 8px;
  font-size: 12px;
  font-weight: 600;
  color: #303133;
}

.count-pill {
  padding: 0 6px;
  font-size: 10px;
  font-weight: 400;
  line-height: 16px;
  color: #909399;
  background: #f0f2f5;
  border-radius: 8px;
}

.view-list {
  padding: 0 8px;
}

.view-card {
  display: flex;
  gap: 8px;
  align-items: center;
  width: 100%;
  padding: 8px;
  margin-bottom: 6px;
  text-align: left;
  cursor: pointer;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 6px;
}

.view-card:hover {
  border-color: #b3d8ff;
  box-shadow: 0 2px 8px rgb(37 99 235 / 8%);
}

.view-card.active {
  background: #f2f7ff;
  border-color: #2563eb;
}

.view-index {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  font-size: 10px;
  color: #909399;
  background: #f0f2f5;
  border-radius: 50%;
}

.view-card.active .view-index {
  color: #fff;
  background: #2563eb;
}

.view-info {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.view-name {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  font-weight: 500;
  color: #303133;
  white-space: nowrap;
}

.view-meta {
  font-size: 10px;
  color: #909399;
}

.panel-tip {
  padding: 8px;
  margin: 8px 12px 14px;
  font-size: 10px;
  line-height: 16px;
  color: #909399;
  background: #f7f8fa;
  border: 1px dashed #e4e7ed;
  border-radius: 4px;
}

.panel-search {
  width: calc(100% - 24px);
  margin: 0 12px 8px;
}

.field-hint {
  padding: 6px 8px;
  margin: 0 12px 8px;
  font-size: 10px;
  line-height: 15px;
  color: #909399;
  background: #f5f7fa;
  border-radius: 4px;
}

.field-list {
  padding: 0 8px 16px;
}

.field-card {
  position: relative;
  display: flex;
  align-items: center;
  padding: 6px 8px;
  margin-bottom: 4px;
  cursor: grab;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 4px;
}

.field-card:hover {
  background: #f7fbff;
  border-color: #b3d8ff;
}

.field-card:active {
  cursor: grabbing;
}

.field-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.field-label {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  color: #303133;
  white-space: nowrap;
}

.field-name {
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: Consolas, monospace;
  font-size: 10px;
  color: #a8abb2;
  white-space: nowrap;
}

.field-badges {
  display: flex;
  flex: none;
  gap: 2px;
}

.f-badge {
  padding: 0 3px;
  font-size: 9px;
  line-height: 13px;
  border-radius: 2px;
}

.f-badge.q {
  color: #2563eb;
  background: #eaf2ff;
}

.f-badge.l {
  color: #0f9d58;
  background: #e9f7ef;
}

.f-badge.f {
  color: #b88230;
  background: #fdf6ec;
}

.f-badge.d {
  color: #6f42c1;
  background: #f3eeff;
}

.field-drag {
  margin-left: 4px;
  font-size: 10px;
  color: #dcdfe6;
}

.panel-empty {
  padding: 20px 8px;
  font-size: 11px;
  color: #909399;
  text-align: center;
}

.widget-group {
  padding: 0 10px 10px;
}

.group-title {
  margin: 6px 2px;
  font-size: 11px;
  font-weight: 600;
  color: #606266;
}

.widget-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.widget-card {
  display: flex;
  flex-direction: column;
  gap: 3px;
  align-items: center;
  padding: 8px 4px;
  font-size: 11px;
  color: #606266;
  cursor: grab;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 5px;
}

.widget-card:hover {
  color: #2563eb;
  background: #f2f7ff;
  border-color: #a0cfff;
}

.widget-icon {
  font-size: 16px;
  line-height: 18px;
}

.widget-name {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.canvas-area {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.canvas-toolbar {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: space-between;
  height: 44px;
  padding: 0 16px;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
}

.canvas-title {
  display: flex;
  gap: 8px;
  align-items: center;
  min-width: 0;
}

.canvas-view-name {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
}

.canvas-summary {
  font-size: 11px;
  color: #909399;
}

.canvas-tools {
  display: flex;
  flex: none;
  flex-wrap: nowrap;
  gap: 6px;
  align-items: center;
  white-space: nowrap;
}

.canvas-tools .el-button {
  padding: 0 4px;
  margin-left: 0;
  font-size: 11px;
}

.tool-divider {
  width: 1px;
  height: 18px;
  margin: 0 2px;
  background: #e4e7ed;
}

.device-chip {
  padding: 2px 8px;
  font-size: 11px;
  border-radius: 10px;
}

.device-chip.active {
  color: #2563eb;
  background: #eaf2ff;
  border: 1px solid #b3d8ff;
}

.device-chip.disabled {
  color: #c0c4cc;
  background: #f7f8fa;
  border: 1px solid #ebeef5;
}

.canvas-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.statusbar {
  display: flex;
  flex: none;
  gap: 6px;
  align-items: center;
  height: 28px;
  padding: 0 16px;
  font-size: 10px;
  color: #909399;
  background: #fff;
  border-top: 1px solid #e4e7ed;
}

.dot {
  color: #dcdfe6;
}

.status-spacer {
  flex: 1;
}

.right-panel {
  display: flex;
  flex: none;
  flex-direction: column;
  width: 300px;
  min-height: 0;
  background: #fff;
  border-left: 1px solid #e4e7ed;
}

.right-head {
  flex: none;
  padding: 10px 14px 8px;
  border-bottom: 1px solid #f2f3f5;
}

.right-title {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  white-space: nowrap;
}

.right-sub {
  margin-top: 2px;
  font-size: 10px;
  color: #909399;
}

.right-tabs {
  display: flex;
  flex: none;
  gap: 0;
  padding: 0 10px;
  border-bottom: 1px solid #ebeef5;
}

.right-tabs button {
  position: relative;
  flex: 1;
  padding: 8px 0;
  font-size: 12px;
  color: #606266;
  cursor: pointer;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
}

.right-tabs button.active {
  font-weight: 600;
  color: #2563eb;
  border-bottom-color: #2563eb;
}

.tab-badge {
  display: inline-block;
  min-width: 14px;
  padding: 0 3px;
  margin-left: 3px;
  font-size: 9px;
  line-height: 14px;
  color: #fff;
  text-align: center;
  background: #e6a23c;
  border-radius: 7px;
}

.right-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.chart-canvas {
  min-height: 100%;
  padding: 16px;
  background: #f3f5f9;
}

.chart-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
}

.chart-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.chart-sub {
  margin-top: 2px;
  font-size: 11px;
  color: #909399;
}

.chart-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 12px;
}

.chart-card {
  padding: 12px;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
}

.chart-card-head {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}

.chart-remove {
  flex: none;
  padding: 0 6px;
  font-size: 14px;
  color: #909399;
  cursor: pointer;
  background: none;
  border: none;
}

.chart-field {
  width: 100%;
  margin-bottom: 6px;
}

.chart-preview {
  display: flex;
  gap: 6px;
  align-items: flex-end;
  height: 80px;
  padding: 10px;
  margin-top: 6px;
  background: #f8fafc;
  border-radius: 4px;
}

.chart-preview span {
  flex: 1;
  background: linear-gradient(180deg, #60a5fa, #2563eb);
  border-radius: 2px 2px 0 0;
}

.chart-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 160px;
  font-size: 12px;
  color: #909399;
  cursor: pointer;
  background: #fff;
  border: 1px dashed #dcdfe6;
  border-radius: 8px;
}

.chart-empty:hover {
  color: #2563eb;
  border-color: #a0cfff;
}

.model-toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
}

.model-hint {
  font-size: 11px;
  color: #909399;
}

.model-table {
  margin-bottom: 18px;
}

.model-table-head {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 6px;
}

.model-table-name {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
}

.model-table-comment {
  font-size: 11px;
  color: #909399;
}

.model-relations {
  padding-top: 8px;
  border-top: 1px solid #ebeef5;
}

.relation-row {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 4px 0;
  font-size: 12px;
}

.mono {
  font-family: Consolas, monospace;
  font-size: 11px;
}

.w-full {
  width: 100%;
}
</style>
