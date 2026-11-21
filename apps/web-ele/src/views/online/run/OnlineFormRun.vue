<script lang="ts" setup>
import type { FormInstance } from 'element-plus';

/**
 * 在线表单运行时（唯一渲染组件，对应橙单 OnlinePageRender）。
 *
 * 两种使用方式：
 *   1) 菜单驱动：菜单 bind_type=1 → 路由 OnlineFormRun?formId=xxx → formId 来自 query
 *   2) 设计器预览：作为组件传入 formId prop
 *
 * 按 formType 分派：
 *   QUERY(1) → 过滤区 + 数据表格 + 新建/编辑/删除操作（操作 formId 跳到编辑页）
 *   FORM(5)  → 主表字段编辑 + 从表 tabs + 保存
 */
import type {
  AggregateChart,
  FormFieldModel,
  FormOperation,
  FormRefSelect,
  FormRenderVo,
  FormSubTable,
} from '#/api/online';

import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';

import dayjs from 'dayjs';
import {
  ElButton,
  ElDatePicker,
  ElDialog,
  ElForm,
  ElFormItem,
  ElInput,
  ElInputNumber,
  ElMessage,
  ElOption,
  ElSelect,
  ElTabPane,
  ElTabs,
  ElTag,
} from 'element-plus';

import {
  aggregateOnlineForm,
  renderFormRuntime,
  runDelete,
  runDetail,
  runQuery,
  runSave,
} from '#/api/online';

import { confirmAction } from '../../system/shared/helpers';
import RunWidget from '../form/designer/RunWidget.vue';
import {
  evalEventFlag,
  fireEvent,
  styleToObject,
} from '../form/designer/script';
import QueryPage from './components/QueryPage.vue';
import OnlineChart from './OnlineChart.vue';

// formId 支持 props 或路由 query（菜单/设计器两用）
const props = withDefaults(
  defineProps<{ formId?: string; embedded?: boolean }>(),
  {
    formId: undefined,
    embedded: false,
  },
);
const route = useRoute();
const router = useRouter();

const effectiveFormId = computed(
  () =>
    props.formId ||
    (route.query.formId as string) ||
    (route.meta.onlineFormId as string) ||
    '',
);
const render = ref<FormRenderVo | null>(null);
const queryPageRef = ref<null | {
  reload: (resetPage?: boolean) => Promise<void>;
}>(null);
const loading = ref(false);

// 查询页状态
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const filters = ref<Record<string, any>>({});
const rows = ref<Array<Record<string, unknown>>>([]);
const total = ref(0);
const pageNum = ref(1);
const pageSize = ref(20);

// 编辑页状态
const editPk = ref<unknown>(null);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const editData = ref<Record<string, any>>({});
const detailLoading = ref(false);
const editFormRef = ref<FormInstance>();

const isQuery = computed(() => render.value?.formType === 1);
const isEdit = computed(() => render.value?.formType === 5);
/** 详情页（只读展示 + 从表只读 Tabs），v4 viewType=10；兼容旧 3 */
const isDetail = computed(() =>
  [3, 10].includes(Number(render.value?.formType)),
);
/** 统计页（维度+指标聚合图表），viewType=6 */
const isChart = computed(() => render.value?.formType === 6);
/** 左分组右列表查询（简化左树右表），viewType=2 */
const isGroupQuery = computed(() => render.value?.formType === 2);
/** 左分组右列表：当前选中的分组值 */
const activeGroup = ref<unknown>(null);
/** 左分组候选值（来自第一个关联维度的 pick 表单全量数据） */
const groupValues = ref<Array<Record<string, unknown>>>([]);

async function loadGroupValues() {
  const first = refSelects.value[0];
  if (!first?.pickFormId) return;
  try {
    const res = await runQuery({
      formId: first.pickFormId,
      filters: {},
      pageNum: 1,
      pageSize: 100,
    });
    groupValues.value = res.rows ?? [];
  } catch {
    groupValues.value = [];
  }
}

function groupLabel(row: Record<string, unknown>): string {
  const first = refSelects.value[0];
  const cols = first ? pickDisplayColumns(first) : [];
  if (cols.length > 0 && cols[0]?.fieldKey) {
    const v = row[cols[0].fieldKey];
    return v == null ? '(空)' : String(v);
  }
  return String(row.id ?? '');
}

const filterFields = computed<FormFieldModel[]>(() =>
  (render.value?.design?.widgetList ?? []).filter(
    (f) => f.isQuery && f.widgetType !== 'divider',
  ),
);
const listFields = computed<FormFieldModel[]>(() =>
  render.value?.design?.tableWidget?.tableColumnList?.length
    ? render.value.design.tableWidget.tableColumnList
    : (render.value?.design?.widgetList ?? []).filter((f) => f.isList),
);
const formFields = computed<FormFieldModel[]>(() =>
  (render.value?.design?.widgetList ?? []).filter(
    (f) => f.widgetType !== 'divider',
  ),
);
const rowOperations = computed<FormOperation[]>(() =>
  (render.value?.design?.tableWidget?.operationList ?? []).filter(
    (o) => o.rowOperation && o.enabled !== false,
  ),
);

function optionsOf(
  field: FormFieldModel,
): Array<{ label: string; value: number | string }> {
  const dictCode =
    field.dictCode ||
    ((field.props as any)?.dictInfo?.dictCode as string | undefined);
  if (dictCode && render.value?.dicts?.[dictCode]) {
    return render.value.dicts[dictCode] ?? [];
  }
  return (field.options ?? []) as Array<{
    label: string;
    value: number | string;
  }>;
}

function formatDateValue(raw: unknown, field: FormFieldModel) {
  const type = String((field as any).widgetType || (field as any).type || '');
  const isDate =
    type.includes('date') || /date|time/i.test(field.fieldKey || '');
  if (!isDate || raw === null || raw === undefined || raw === '') return null;
  const date = dayjs(raw as any);
  if (!date.isValid()) return null;
  return type === 'datetime' || type.includes('datetime')
    ? date.format('YYYY-MM-DD HH:mm:ss')
    : date.format('YYYY-MM-DD');
}

/** 编辑态把后端返回的 UTC 时间串转成本地日历值，避免日期选择器少一天。 */
function normalizePickerDates(
  data: Record<string, any>,
  fields: Array<{ fieldKey?: null | string; widgetType?: null | string }>,
) {
  for (const f of fields) {
    if (!f.fieldKey) continue;
    const type = String(f.widgetType || '');
    if (
      !type.includes('date') ||
      data[f.fieldKey] === null ||
      data[f.fieldKey] === undefined
    )
      continue;
    const date = dayjs(data[f.fieldKey]);
    if (!date.isValid()) continue;
    data[f.fieldKey] = type.includes('datetime')
      ? date.format('YYYY-MM-DD HH:mm:ss')
      : date.format('YYYY-MM-DD');
  }
}

function labelOf(row: Record<string, unknown>, field: FormFieldModel): unknown {
  const labels = row._labels as Record<string, unknown> | undefined;
  if (labels && field.fieldKey && field.fieldKey in labels)
    return labels[field.fieldKey];
  const raw = field.fieldKey ? row[field.fieldKey] : undefined;
  const dictCode =
    field.dictCode ||
    ((field.props as any)?.dictInfo?.dictCode as string | undefined);
  if (dictCode) {
    const opt = optionsOf({ ...field, dictCode } as FormFieldModel).find(
      (o) => String(o.value) === String(raw),
    );
    if (opt) return opt.label;
  }
  const formatted = formatDateValue(raw, field);
  return formatted ?? raw ?? '-';
}

function editScope(extra: Record<string, any> = {}) {
  return {
    form: editData.value,
    value: undefined,
    row: undefined,
    params: {},
    setValue: (field: string, value: any) => {
      editData.value[field] = value;
    },
    reload: () => void loadForEdit(),
    message: (text: string, type: any = 'info') =>
      ElMessage({ message: text, type }),
    openForm: () => undefined,
    console,
    ...extra,
  };
}

function editFieldVisible(field: FormFieldModel) {
  if (field.visible === false) return false;
  return evalEventFlag(
    field.events,
    'visible',
    editScope({ value: editData.value[field.fieldKey || ''] }),
    true,
  );
}

function editFieldDisabled(field: FormFieldModel) {
  if (isDetail.value) return true;
  return evalEventFlag(
    field.events,
    'disabled',
    editScope({ value: editData.value[field.fieldKey || ''] }),
    false,
  );
}

function onEditFieldChange(field: FormFieldModel, value: any) {
  fireEvent(
    field.events,
    'change',
    editScope({
      value,
      [field.fieldKey || '']: value,
    }),
  );
}

const visibleFormFields = computed(() =>
  formFields.value.filter((f) => editFieldVisible(f)),
);

async function load() {
  if (!effectiveFormId.value) return;
  loading.value = true;
  try {
    render.value = await renderFormRuntime(effectiveFormId.value);
    if (isGroupQuery.value) {
      await doQuery();
      await loadGroupValues();
    } else if (isEdit.value || isDetail.value) await loadForEdit();
    else if (isChart.value) await loadCharts();
  } catch (error: any) {
    ElMessage.error(error?.message ?? '加载表单失败');
    render.value = null;
  } finally {
    loading.value = false;
  }
}

async function doQuery() {
  if (!render.value) return;
  loading.value = true;
  try {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(filters.value)) {
      if (v !== undefined && v !== null && String(v) !== '') clean[k] = v;
    }
    const res = await runQuery({
      formId: render.value.formId,
      filters: clean,
      pageNum: pageNum.value,
      pageSize: pageSize.value,
    });
    rows.value = res.rows ?? [];
    total.value = res.total ?? 0;
  } catch (error: any) {
    ElMessage.error(error?.message ?? '查询失败');
  } finally {
    loading.value = false;
  }
}

function onSearch() {
  pageNum.value = 1;
  void doQuery();
}
function onReset() {
  filters.value = {};
  onSearch();
}

// ---- 统计图表（viewType=6）：每个图表卡片一个 OnlineChart 实例 ----
const charts = ref<AggregateChart[]>([]);

async function loadCharts() {
  loading.value = true;
  try {
    charts.value = await aggregateOnlineForm(render.value!.formId);
  } catch (error: any) {
    ElMessage.error(error?.message ?? '统计加载失败');
  } finally {
    loading.value = false;
  }
}

/** 左分组右列表：选中分组 → 过滤右表 */
async function onGroupSelect(value: unknown) {
  const first = refSelects.value[0];
  if (!first) return;
  activeGroup.value = activeGroup.value === value ? null : value;
  filters.value =
    activeGroup.value == null ? {} : { [first.fkColumn]: activeGroup.value };
  pageNum.value = 1;
  await doQuery();
}

// ---- 操作分派（橙单 operation.type）----
async function onOperation(op: FormOperation, row?: Record<string, unknown>) {
  switch (op.type) {
    case 0: {
      // 新建 → 打开编辑表单（formId 或当前页面第一个编辑表单）
      await openEdit(null, op.formId);
      break;
    }
    case 1: {
      // 编辑
      await openEdit(row ?? null, op.formId);
      break;
    }
    case 2: {
      // 删除
      await doDelete(row);
      break;
    }
    case 20: {
      // 表单操作（详情等）：跳目标表单带行主键
      if (op.formId) {
        await router.push({
          name: 'OnlineFormRun',
          query: {
            formId: op.formId,
            pk: row ? String(row.id ?? row._dataId ?? '') : '',
          },
        });
      }
      break;
    }
    case 10: {
      // 批量删除（简化为单条提示）
      ElMessage.info('批量删除请逐条操作');
      break;
    }
    default: {
      if (op.formId) await openEdit(null, op.formId);
    }
  }
}

/** 找编辑表单：优先 operation.formId，其次同页面 edit 角色表单（render.forms），最后缓存 */
async function resolveEditFormId(opFormId?: string): Promise<string> {
  if (opFormId) return opFormId;
  const pageForms = (render.value?.forms ?? []) as Array<{
    formId: string;
    pageRole?: string;
  }>;
  const editForm = pageForms.find((f) => f.pageRole === 'edit');
  if (editForm) return editForm.formId;
  const cached = render.value?.formId
    ? sessionStorage.getItem(`editForm_${render.value.formId}`)
    : null;
  return cached ?? '';
}

async function openEdit(
  row: null | Record<string, unknown>,
  opFormId?: string,
) {
  const formId = await resolveEditFormId(opFormId);
  if (!formId) {
    ElMessage.warning(
      '未配置编辑表单，请在设计器中为「新建/编辑」操作指定目标表单',
    );
    return;
  }
  // 编辑表单作为独立路由页面打开（像橙单跳页操作）
  await router.push({
    name: 'OnlineFormRun',
    query: { formId, pk: row ? String(row.id ?? row._dataId ?? '') : '' },
  });
}

async function doDelete(row?: Record<string, unknown>) {
  if (!row || !render.value) return;
  if (!(await confirmAction('确定删除该记录？'))) return;
  const pk = row.id ?? row._dataId;
  const ok = await runDelete(render.value.formId, pk)
    .then(() => true)
    .catch(() => false);
  if (ok) {
    ElMessage.success('已删除');
    if (isQuery.value) await queryPageRef.value?.reload();
    else await doQuery();
  }
}

/** 查询页批量删除：一次确认、逐条走统一删除接口，最后刷新当前条件与分页。 */
async function onBatchDelete(selected: Array<Record<string, unknown>>) {
  if (selected.length === 0 || !render.value) return;
  if (!(await confirmAction(`确定删除选中的 ${selected.length} 条记录？`)))
    return;
  let done = 0;
  let failed = 0;
  for (const row of selected) {
    const pk = row.id ?? row._dataId;
    if (pk === undefined || pk === null) {
      failed += 1;
      continue;
    }
    try {
      await runDelete(render.value.formId, pk);
      done += 1;
    } catch {
      failed += 1;
    }
  }
  if (done)
    ElMessage.success(`已删除 ${done} 条${failed ? `，${failed} 条失败` : ''}`);
  else ElMessage.error('删除失败，请检查数据权限或主键配置');
  await queryPageRef.value?.reload();
}

// ---- 一对一/多对一关联选择（render 自动推导，借鉴橙单"一对一选择页面"） ----
const refSelects = computed(() => render.value?.design?.refSelects ?? []);
function refSelectFor(fieldKey?: string): FormRefSelect | undefined {
  if (!fieldKey) return undefined;
  return refSelects.value.find((r) => r.fkColumn === fieldKey);
}
/** 外键→显示文本缓存（编辑载入后按 pick 表单回查展示列） */
const refLabelMap = ref<Record<string, string>>({});

async function loadRefLabels() {
  for (const rs of refSelects.value) {
    const fkValue = editData.value[rs.fkColumn];
    if (fkValue && rs.pickFormId && rs.displayColumns.length > 0) {
      try {
        const detail = await runDetail(rs.pickFormId, fkValue as string);
        const firstCol = rs.displayColumns.find(
          (c) => c.fieldKey && c.fieldKey !== rs.refPkColumn,
        );
        if (detail && firstCol?.fieldKey) {
          refLabelMap.value[rs.fkColumn] = String(
            detail[firstCol.fieldKey] ?? fkValue,
          );
        }
      } catch {
        refLabelMap.value[rs.fkColumn] = String(fkValue);
      }
    }
  }
}

// 关联选择弹窗
const pickVisible = ref(false);
const pickRef = ref<FormRefSelect | null>(null);
const pickRows = ref<Array<Record<string, unknown>>>([]);
const pickLoading = ref(false);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pickFilters = ref<Record<string, any>>({});
const pickPageNum = ref(1);
const pickTotal = ref(0);

function pickDisplayColumns(rs: FormRefSelect): FormFieldModel[] {
  const list = (rs.displayColumns ?? []).filter(
    (c) => c.isList && c.fieldKey && c.fieldKey !== rs.refPkColumn,
  );
  return list.length > 0
    ? list.slice(0, 5)
    : (rs.displayColumns ?? []).slice(0, 5);
}

async function openPickDialog(rs: FormRefSelect) {
  pickRef.value = rs;
  pickFilters.value = {};
  pickPageNum.value = 1;
  pickVisible.value = true;
  await doPickQuery();
}

async function doPickQuery() {
  const rs = pickRef.value;
  if (!rs?.pickFormId) return;
  pickLoading.value = true;
  try {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(pickFilters.value)) {
      if (v !== undefined && v !== null && String(v) !== '') clean[k] = v;
    }
    const res = await runQuery({
      formId: rs.pickFormId,
      filters: clean,
      pageNum: pickPageNum.value,
      pageSize: 10,
    });
    pickRows.value = res.rows ?? [];
    pickTotal.value = res.total ?? 0;
  } catch (error: any) {
    ElMessage.error(error?.message ?? '加载关联数据失败');
  } finally {
    pickLoading.value = false;
  }
}

function confirmPick(row: Record<string, unknown>) {
  const rs = pickRef.value;
  if (!rs) return;
  editData.value[rs.fkColumn] = row.id ?? row._dataId ?? null;
  const firstCol = pickDisplayColumns(rs)[0];
  if (firstCol?.fieldKey)
    refLabelMap.value[rs.fkColumn] = String(row[firstCol.fieldKey] ?? row.id);
  pickVisible.value = false;
}

function clearRef(rs: FormRefSelect) {
  editData.value[rs.fkColumn] = null;
  delete refLabelMap.value[rs.fkColumn];
}

// ---- 编辑表单（主子表：主表区 + 从表 Tabs，借鉴橙单编辑页产品形态） ----
async function loadForEdit() {
  const pk = route.query.pk as string;
  if (pk) {
    detailLoading.value = true;
    try {
      editData.value = await runDetail(render.value!.formId, pk);
      normalizePickerDates(
        editData.value,
        render.value?.design?.widgetList ?? [],
      );
      editPk.value = pk;
      await loadRefLabels();
      await loadAllSubRows();
    } catch (error: any) {
      ElMessage.error(error?.message ?? '加载详情失败');
    } finally {
      detailLoading.value = false;
    }
  } else {
    editPk.value = null;
    editData.value = {};
    if (isDetail.value) ElMessage.warning('请从列表页点击「详情」进入');
  }
}

/** 从表 Tabs（render 从 ONE_TO_MANY 关系边自动推导） */
const subTables = computed(() => render.value?.design?.subTables ?? []);
/** 从表行数据：edgeId → rows */
const subRowsMap = ref<Record<string, Array<Record<string, unknown>>>>({});

async function loadSubRows(sub: FormSubTable) {
  if (!sub.dialogFormId || !editPk.value) return;
  try {
    const res = await runQuery({
      formId: sub.dialogFormId,
      filters: { [sub.fkColumn]: editPk.value },
      pageNum: 1,
      pageSize: 100,
    });
    subRowsMap.value[sub.edgeId] = res.rows ?? [];
  } catch {
    subRowsMap.value[sub.edgeId] = [];
  }
}

async function loadAllSubRows() {
  for (const sub of subTables.value) await loadSubRows(sub);
}

// 从表行编辑弹窗
const dlgVisible = ref(false);
const dlgSub = ref<FormSubTable | null>(null);
const dlgPk = ref<unknown>(null);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dlgData = ref<Record<string, any>>({});
const dlgSaving = ref(false);

function subFormFields(sub: FormSubTable): FormFieldModel[] {
  return (sub.columns ?? []).filter((f) => f.widgetType !== 'divider');
}
function subListFields(sub: FormSubTable): FormFieldModel[] {
  const list = subFormFields(sub).filter((f) => f.isList);
  return list.length > 0 ? list : subFormFields(sub);
}

function openSubDialog(sub: FormSubTable, row?: Record<string, unknown>) {
  if (!editPk.value) {
    ElMessage.warning('请先保存主表记录，再维护从表数据');
    return;
  }
  dlgSub.value = sub;
  dlgPk.value = row ? (row.id ?? row._dataId ?? null) : null;
  dlgData.value = row ? { ...row } : { [sub.fkColumn]: editPk.value };
  normalizePickerDates(dlgData.value, sub.columns ?? []);
  dlgVisible.value = true;
}

async function saveSubDialog() {
  const sub = dlgSub.value;
  if (!sub?.dialogFormId) return;
  // 必填校验（前端轻校验）
  for (const f of subFormFields(sub)) {
    if (
      f.required &&
      (dlgData.value[f.fieldKey ?? ''] === undefined ||
        dlgData.value[f.fieldKey ?? ''] === '')
    ) {
      ElMessage.warning(`请填写「${f.label}」`);
      return;
    }
  }
  dlgSaving.value = true;
  try {
    await runSave({
      formId: sub.dialogFormId,
      data: { ...dlgData.value },
      pkValue: dlgPk.value,
    });
    ElMessage.success(dlgPk.value ? '已更新' : '已添加');
    dlgVisible.value = false;
    await loadSubRows(sub);
  } catch (error: any) {
    ElMessage.error(error?.message ?? '保存失败');
  } finally {
    dlgSaving.value = false;
  }
}

async function deleteSubRow(sub: FormSubTable, row: Record<string, unknown>) {
  if (!sub.dialogFormId) return;
  if (!(await confirmAction('确定删除该从表记录？'))) return;
  const pk = row.id ?? row._dataId;
  const ok = await runDelete(sub.dialogFormId, pk)
    .then(() => true)
    .catch(() => false);
  if (ok) {
    ElMessage.success('已删除');
    await loadSubRows(sub);
  }
}

async function onSaveEdit() {
  if (!render.value) return;
  const valid = await editFormRef.value?.validate().catch(() => false);
  if (valid === false) return;
  try {
    const returnedPk = await runSave({
      formId: render.value.formId,
      data: { ...editData.value },
      pkValue: editPk.value,
    });
    // 新增主表后：留在本页进入"编辑模式"，从表 Tabs 变为可维护（先主后从）
    if (!editPk.value && returnedPk) {
      editPk.value = returnedPk;
      await router.replace({
        query: { ...route.query, pk: String(returnedPk) },
      });
      await loadAllSubRows();
      ElMessage.success('主表已保存，可继续维护从表数据');
      return;
    }
    ElMessage.success('保存成功');
    await loadForEdit();
  } catch (error: any) {
    ElMessage.error(error?.message ?? '保存失败');
  }
}

function onCancel() {
  const back = render.value
    ? sessionStorage.getItem(`backForm_${render.value.formId}`)
    : null;
  if (back)
    void router.push({ name: 'OnlineFormRun', query: { formId: back } });
}

watch(
  () => effectiveFormId.value,
  () => void load(),
);
onMounted(load);
</script>

<template>
  <Page v-if="!embedded">
    <div v-loading="loading" class="form-run">
      <template v-if="render">
        <div class="fr-head">
          <h2>{{ render.formName }}</h2>
          <ElTag size="small" type="info">
{{
            render.formType === 1
              ? '查询页面'
              : render.formType === 5
                ? '编辑页面'
                : '表单'
          }}
</ElTag>
        </div>

        <!-- 查询页面（v5 查询协议：左树 + 条件区 + 分页表格 + 条件事件） -->
        <QueryPage
          v-if="isQuery"
          ref="queryPageRef"
          :render="render"
          @batch-delete="onBatchDelete"
          @operation="onOperation"
        />

        <!-- 编辑页面（主子表：主表区 + 从表 Tabs） -->
        <template v-else-if="isEdit">
          <ElForm
            ref="editFormRef"
            :label-position="(render.design.labelPosition as any) || 'right'"
            :label-width="render.design.labelWidth || '110px'"
            :model="editData"
            :style="styleToObject(render.design.formStyle)"
            v-loading="detailLoading"
          >
            <ElFormItem
              v-for="f in visibleFormFields"
              :key="f.fieldKey ?? ''"
              :label="f.label"
              :label-width="
                f.styleConfig?.labelWidth
                  ? `${f.styleConfig.labelWidth}px`
                  : undefined
              "
              :required="f.required"
              :style="styleToObject(f.styleConfig)"
            >
              <!-- 关联选择组件（一对一/多对一，render 自动推导） -->
              <div v-if="refSelectFor(f.fieldKey)" class="fr-ref-select">
                <ElInput
                  :model-value="
                    refLabelMap[f.fieldKey ?? ''] ??
                    String(editData[f.fieldKey ?? ''] ?? '')
                  "
                  :placeholder="`点击选择${refSelectFor(f.fieldKey)!.refTitle ?? ''}`"
                  readonly
                />
                <ElButton
                  size="small"
                  type="primary"
                  plain
                  @click="openPickDialog(refSelectFor(f.fieldKey)!)"
                  >
选择
</ElButton>
                <ElButton
                  v-if="editData[f.fieldKey ?? '']"
                  size="small"
                  @click="clearRef(refSelectFor(f.fieldKey)!)"
                  >
清空
</ElButton>
              </div>
              <RunWidget
                v-else
                v-model="editData[f.fieldKey ?? '']"
                :disabled="editFieldDisabled(f)"
                :options="optionsOf(f)"
                :widget="f"
                @change="(value: any) => onEditFieldChange(f, value)"
              />
            </ElFormItem>
          </ElForm>
          <div class="fr-edit-actions">
            <ElButton type="primary" @click="onSaveEdit">保存</ElButton>
            <ElButton @click="onCancel">取消</ElButton>
          </div>

          <!-- 从表 Tabs（主子表编辑，零配置由关系推导） -->
          <div v-if="subTables.length" class="fr-subtables">
            <div v-if="!editPk" class="fr-sub-locked">
              保存主表记录后，可在此维护从表数据
            </div>
            <ElTabs v-else>
              <ElTabPane
                v-for="sub in subTables"
                :key="sub.edgeId"
                :label="sub.title"
              >
                <div class="fr-sub-toolbar">
                  <ElButton
                    size="small"
                    type="primary"
                    @click="openSubDialog(sub)"
                    >
新增
</ElButton>
                </div>
                <table class="fr-table">
                  <thead>
                    <tr>
                      <th
                        v-for="f in subListFields(sub)"
                        :key="f.fieldKey ?? ''"
                      >
                        {{ f.label }}
                      </th>
                      <th class="fr-op-col">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="(srow, si) in subRowsMap[sub.edgeId] ?? []"
                      :key="si"
                    >
                      <td
                        v-for="f in subListFields(sub)"
                        :key="f.fieldKey ?? ''"
                      >
                        {{ labelOf(srow, f) }}
                      </td>
                      <td class="fr-op-col">
                        <ElButton
                          link
                          size="small"
                          type="primary"
                          @click="openSubDialog(sub, srow)"
                          >
编辑
</ElButton>
                        <ElButton
                          link
                          size="small"
                          type="danger"
                          @click="deleteSubRow(sub, srow)"
                          >
删除
</ElButton>
                      </td>
                    </tr>
                    <tr v-if="!(subRowsMap[sub.edgeId] ?? []).length">
                      <td
                        :colspan="subListFields(sub).length + 1"
                        class="fr-empty"
                      >
                        暂无数据
                      </td>
                    </tr>
                  </tbody>
                </table>
              </ElTabPane>
            </ElTabs>
          </div>
        </template>

        <!-- 详情页面（只读展示 + 从表只读 Tabs） -->
        <template v-else-if="isDetail">
          <div v-loading="detailLoading" class="fr-detail">
            <div class="fr-detail-grid">
              <div
                v-for="f in formFields.filter((x) => editFieldVisible(x))"
                :key="f.fieldKey ?? ''"
                class="fr-detail-item"
                :style="styleToObject(f.styleConfig)"
              >
                <span class="fr-di-label">{{ f.label }}</span>
                <span class="fr-di-value">{{ labelOf(editData, f) }}</span>
              </div>
              <div v-if="!formFields.length" class="fr-empty">
                详情表单未配置字段
              </div>
            </div>
            <div v-if="subTables.length" class="fr-subtables">
              <ElTabs>
                <ElTabPane
                  v-for="sub in subTables"
                  :key="sub.edgeId"
                  :label="sub.title"
                >
                  <table class="fr-table">
                    <thead>
                      <tr>
                        <th
                          v-for="f in subListFields(sub)"
                          :key="f.fieldKey ?? ''"
                        >
                          {{ f.label }}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="(srow, si) in subRowsMap[sub.edgeId] ?? []"
                        :key="si"
                      >
                        <td
                          v-for="f in subListFields(sub)"
                          :key="f.fieldKey ?? ''"
                        >
                          {{ labelOf(srow, f) }}
                        </td>
                      </tr>
                      <tr v-if="!(subRowsMap[sub.edgeId] ?? []).length">
                        <td
                          :colspan="subListFields(sub).length"
                          class="fr-empty"
                        >
                          暂无数据
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </ElTabPane>
              </ElTabs>
            </div>
          </div>
        </template>

        <!-- 统计页（维度+指标聚合图表） -->
        <template v-else-if="isChart">
          <div v-if="charts.length" class="fr-chart-grid">
            <OnlineChart v-for="(c, i) in charts" :key="i" :chart="c" />
          </div>
          <div v-else class="fr-empty">该统计表单没有可用图表配置</div>
        </template>

        <!-- 左分组右列表（简化左树右表：左栏关联维度分组，点击过滤右侧表格） -->
        <template v-else-if="isGroupQuery">
          <div class="fr-group-layout">
            <div class="fr-group-side">
              <div class="fr-group-title">
                {{ refSelects[0]?.refTitle ?? '全部分组' }}
              </div>
              <div
                class="fr-group-item"
                :class="{ active: activeGroup == null }"
                @click="onGroupSelect(null)"
              >
                全部
              </div>
              <div
                v-for="(row, i) in groupValues"
                :key="i"
                class="fr-group-item"
                :class="{
                  active:
                    activeGroup != null &&
                    String(activeGroup) === String(row.id ?? ''),
                }"
                @click="onGroupSelect(row.id)"
              >
                {{ groupLabel(row) }}
              </div>
            </div>
            <div class="fr-group-main">
              <div class="fr-filter" style="padding: 12px">
                <ElInput
                  v-for="f in filterFields.filter((f) =>
                    ['input'].includes(f.widgetType ?? ''),
                  )"
                  :key="f.fieldKey ?? ''"
                  v-model="filters[f.fieldKey ?? '']"
                  :placeholder="f.label"
                  clearable
                  style="width: 180px"
                  @keyup.enter="onSearch"
                />
                <ElButton type="primary" size="small" @click="onSearch">
查询
</ElButton>
                <ElButton size="small" @click="onReset">重置</ElButton>
              </div>
              <div class="fr-table-wrap">
                <table class="fr-table">
                  <thead>
                    <tr>
                      <th v-for="f in listFields" :key="f.fieldKey ?? ''">
                        {{ f.label }}
                      </th>
                      <th class="fr-op-col">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(row, idx) in rows" :key="idx">
                      <td v-for="f in listFields" :key="f.fieldKey ?? ''">
                        {{ labelOf(row, f) }}
                      </td>
                      <td class="fr-op-col">
                        <ElButton
                          v-for="op in rowOperations"
                          :key="op.name"
                          link
                          size="small"
                          :type="op.type === 2 ? 'danger' : 'primary'"
                          @click="onOperation(op, row)"
                        >
                          {{ op.name }}
                        </ElButton>
                      </td>
                    </tr>
                    <tr v-if="!rows.length">
                      <td :colspan="listFields.length + 1" class="fr-empty">
                        暂无数据
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div class="fr-pager">
                <ElButton
                  size="small"
                  :disabled="pageNum <= 1"
                  @click="
                    pageNum--;
                    doQuery();
                  "
                  >
上一页
</ElButton>
                <span>第 {{ pageNum }} /
                  {{ Math.max(1, Math.ceil(total / pageSize)) }} 页</span>
                <ElButton
                  size="small"
                  :disabled="pageNum >= Math.ceil(total / pageSize)"
                  @click="
                    pageNum++;
                    doQuery();
                  "
                  >
下一页
</ElButton>
              </div>
            </div>
          </div>
        </template>

        <div v-else class="fr-empty">
          暂不支持的表单类型：{{ render.formType }}
        </div>
      </template>
      <div v-else class="fr-empty">请从菜单进入，或在设计器中预览表单</div>
    </div>

    <!-- 从表行编辑弹窗 -->
    <ElDialog
      v-model="dlgVisible"
      :title="`${dlgPk ? '编辑' : '新增'}${dlgSub?.title ?? ''}`"
      width="560px"
      destroy-on-close
    >
      <ElForm v-if="dlgSub" :model="dlgData" label-width="110px">
        <ElFormItem
          v-for="f in subFormFields(dlgSub)"
          :key="f.fieldKey ?? ''"
          :label="f.label"
          :required="f.required"
        >
          <!-- 外键列只读展示（由主表带入） -->
          <span v-if="f.fieldKey === dlgSub?.fkColumn" class="fr-fk-static">{{
            dlgData[f.fieldKey]
          }}</span>
          <ElSelect
            v-else-if="
              ['select', 'radio'].includes(f.widgetType ?? '') &&
              optionsOf(f).length
            "
            v-model="dlgData[f.fieldKey ?? '']"
            clearable
          >
            <ElOption
              v-for="o in optionsOf(f)"
              :key="String(o.value)"
              :label="o.label"
              :value="o.value"
            />
          </ElSelect>
          <ElInputNumber
            v-else-if="f.widgetType === 'number'"
            v-model="dlgData[f.fieldKey ?? '']"
          />
          <ElDatePicker
            v-else-if="['date', 'datetime'].includes(f.widgetType ?? '')"
            v-model="dlgData[f.fieldKey ?? '']"
            :type="f.widgetType === 'datetime' ? 'datetime' : 'date'"
            :value-format="
              f.widgetType === 'datetime' ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD'
            "
          />
          <ElInput v-else v-model="dlgData[f.fieldKey ?? '']" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="dlgVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="dlgSaving" @click="saveSubDialog">
保存
</ElButton>
      </template>
    </ElDialog>

    <!-- 关联选择弹窗（一对一/多对一，过滤+表格单选回填） -->
    <ElDialog
      v-model="pickVisible"
      :title="`选择${pickRef?.refTitle ?? '关联数据'}`"
      width="720px"
      destroy-on-close
    >
      <div class="fr-pick-filter">
        <ElInput
          v-for="c in (pickRef?.displayColumns ?? [])
            .filter(
              (c) =>
                ['input', 'textarea'].includes(c.widgetType ?? '') && c.isList,
            )
            .slice(0, 2)"
          :key="c.fieldKey ?? ''"
          v-model="pickFilters[c.fieldKey ?? '']"
          :placeholder="`按${c.label}过滤`"
          clearable
          style="width: 200px"
          @keyup.enter="
            pickPageNum = 1;
            doPickQuery();
          "
        />
        <ElButton
          type="primary"
          size="small"
          @click="
            pickPageNum = 1;
            doPickQuery();
          "
          >
查询
</ElButton>
      </div>
      <div v-loading="pickLoading" class="fr-pick-table">
        <table class="fr-table">
          <thead>
            <tr>
              <th class="fr-pick-radio">选</th>
              <th
                v-for="c in pickDisplayColumns(pickRef!)"
                :key="c.fieldKey ?? ''"
              >
                {{ c.label }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, i) in pickRows"
              :key="i"
              class="fr-pick-row"
              @click="confirmPick(row)"
            >
              <td class="fr-pick-radio">
                <ElTag size="small" type="info">单选</ElTag>
              </td>
              <td
                v-for="c in pickDisplayColumns(pickRef!)"
                :key="c.fieldKey ?? ''"
              >
                {{ labelOf(row, c) }}
              </td>
            </tr>
            <tr v-if="!pickRows.length">
              <td
                :colspan="
                  (pickRef ? pickDisplayColumns(pickRef).length : 0) + 1
                "
                class="fr-empty"
              >
                暂无数据
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="fr-pager">
        <ElButton
          size="small"
          :disabled="pickPageNum <= 1"
          @click="
            pickPageNum--;
            doPickQuery();
          "
          >
上一页
</ElButton>
        <span>第 {{ pickPageNum }} /
          {{ Math.max(1, Math.ceil(pickTotal / 10)) }} 页</span>
        <ElButton
          size="small"
          :disabled="pickPageNum >= Math.ceil(pickTotal / 10)"
          @click="
            pickPageNum++;
            doPickQuery();
          "
          >
下一页
</ElButton>
      </div>
    </ElDialog>
  </Page>

  <!-- 内嵌预览模式（设计器用） -->
  <div v-else v-loading="loading" class="form-run embedded">
    <template v-if="render && isQuery">
      <div class="fr-filter-preview">
        <span
          v-for="f in filterFields"
          :key="f.fieldKey ?? ''"
          class="fr-chip"
          >{{ f.label }}</span>
      </div>
      <div class="fr-table-preview">
        <div class="fr-row" v-for="f in listFields" :key="f.fieldKey ?? ''">
          {{ f.label }}
        </div>
      </div>
    </template>
    <ElForm v-else-if="render && isEdit" :model="editData" label-width="110px">
      <ElFormItem
        v-for="f in formFields"
        :key="f.fieldKey ?? ''"
        :label="f.label"
      >
        <ElInput :placeholder="f.label" />
      </ElFormItem>
    </ElForm>
    <div v-else class="fr-empty">设计预览</div>
  </div>
</template>

<style scoped>
.form-run {
  --el-bg-color: #fff;
  --el-bg-color-overlay: #fff;
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

  padding: 16px;
  color: #303133;
  color-scheme: light;
  background: #fff;
  border-radius: 8px;
}

.fr-head {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 16px;
}

.fr-head h2 {
  margin: 0;
  font-size: 18px;
}

.fr-filter {
  padding: 14px;
  margin-bottom: 14px;
  background: var(--el-fill-color-blank);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}

.fr-toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 10px;
}

.fr-total {
  margin-left: auto;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.fr-table-wrap {
  overflow: auto;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
}

.fr-table {
  width: 100%;
  font-size: 13px;
  border-collapse: collapse;
}

.fr-table th,
.fr-table td {
  padding: 8px 10px;
  text-align: left;
  white-space: nowrap;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.fr-table th {
  font-weight: 600;
  background: var(--el-fill-color-light);
}

.fr-op-col {
  text-align: center;
}

.fr-empty {
  padding: 40px;
  color: var(--el-text-color-secondary);
  text-align: center;
}

.fr-pager {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: flex-end;
  margin-top: 14px;
}

.fr-edit-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.fr-subtables {
  margin-top: 24px;
}

.fr-sub-locked {
  padding: 14px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  text-align: center;
  background: var(--el-fill-color-light);
  border: 1px dashed var(--el-border-color);
  border-radius: 6px;
}

.fr-sub-toolbar {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin: 4px 0 8px;
}

.fr-fk-static {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.fr-ref-select {
  display: flex;
  gap: 8px;
  width: 100%;
}

.fr-ref-select .el-input {
  flex: 1;
}

.fr-pick-filter {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}

.fr-pick-table {
  max-height: 320px;
  overflow: auto;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.fr-pick-row {
  cursor: pointer;
}

.fr-pick-row:hover {
  background: var(--el-color-primary-light-9);
}

.fr-pick-radio {
  width: 46px;
  text-align: center;
}

.fr-chart-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  gap: 14px;
}

.fr-group-layout {
  display: flex;
  gap: 14px;
  align-items: flex-start;
}

.fr-group-side {
  flex-shrink: 0;
  width: 200px;
  overflow: hidden;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}

.fr-group-title {
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 600;
  background: var(--el-fill-color-light);
}

.fr-group-item {
  padding: 9px 14px;
  font-size: 13px;
  cursor: pointer;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.fr-group-item:hover {
  background: var(--el-fill-color-light);
}

.fr-group-item.active {
  font-weight: 600;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.fr-group-main {
  flex: 1;
  min-width: 0;
}

.fr-detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}

.fr-detail-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.fr-di-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.fr-di-value {
  font-size: 14px;
  word-break: break-all;
}

.fr-chip {
  display: inline-block;
  padding: 4px 10px;
  margin: 0 6px 6px 0;
  font-size: 12px;
  background: var(--el-fill-color-light);
  border-radius: 4px;
}

.fr-row {
  padding: 8px;
  font-size: 13px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
</style>
