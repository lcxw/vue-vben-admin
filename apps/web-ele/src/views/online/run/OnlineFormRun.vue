<script lang="ts" setup>
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
import type { FormRenderVo, FormOperation, FormFieldModel, FormSubTable, FormRefSelect } from '#/api/online';

import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';

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
  ElSwitch,
  ElTabPane,
  ElTabs,
  ElTag,
} from 'element-plus';
import type { FormInstance } from 'element-plus';

import {
  renderFormRuntime,
  runDelete,
  runDetail,
  runQuery,
  runSave,
} from '#/api/online';
import { confirmAction } from '../../system/shared/helpers';

// formId 支持 props 或路由 query（菜单/设计器两用）
const props = withDefaults(defineProps<{ formId?: string; embedded?: boolean }>(), {
  formId: undefined,
  embedded: false,
});
const route = useRoute();
const router = useRouter();

const effectiveFormId = computed(() =>
  props.formId
  || (route.query.formId as string)
  || (route.meta.onlineFormId as string)
  || ''
);
const render = ref<null | FormRenderVo>(null);
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

const filterFields = computed<FormFieldModel[]>(() =>
  (render.value?.design?.widgetList ?? []).filter((f) => f.isQuery && f.widgetType !== 'divider'),
);
const listFields = computed<FormFieldModel[]>(() =>
  render.value?.design?.tableWidget?.tableColumnList?.length
    ? render.value.design.tableWidget.tableColumnList
    : (render.value?.design?.widgetList ?? []).filter((f) => f.isList),
);
const formFields = computed<FormFieldModel[]>(() =>
  (render.value?.design?.widgetList ?? []).filter((f) => f.widgetType !== 'divider'),
);
const topOperations = computed<FormOperation[]>(() =>
  (render.value?.design?.tableWidget?.operationList ?? []).filter((o) => !o.rowOperation && o.enabled !== false),
);
const rowOperations = computed<FormOperation[]>(() =>
  (render.value?.design?.tableWidget?.operationList ?? []).filter((o) => o.rowOperation && o.enabled !== false),
);

function optionsOf(field: FormFieldModel): Array<{ label: string; value: string | number }> {
  if (field.dictCode && render.value?.dicts?.[field.dictCode]) {
    return render.value.dicts[field.dictCode] ?? [];
  }
  return (field.options ?? []) as Array<{ label: string; value: string | number }>;
}

function labelOf(row: Record<string, unknown>, field: FormFieldModel): unknown {
  const labels = row._labels as Record<string, unknown> | undefined;
  if (labels && field.fieldKey && field.fieldKey in labels) return labels[field.fieldKey];
  const raw = field.fieldKey ? row[field.fieldKey] : undefined;
  if (field.dictCode) {
    const opt = optionsOf(field).find((o) => String(o.value) === String(raw));
    if (opt) return opt.label;
  }
  return raw ?? '-';
}

async function load() {
  if (!effectiveFormId.value) return;
  loading.value = true;
  try {
    render.value = await renderFormRuntime(effectiveFormId.value);
    if (isQuery.value) await doQuery();
    else if (isEdit.value) await loadForEdit();
  } catch (e: any) {
    ElMessage.error(e?.message ?? '加载表单失败');
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
    const res = await runQuery({ formId: render.value.formId, filters: clean, pageNum: pageNum.value, pageSize: pageSize.value });
    rows.value = res.rows ?? [];
    total.value = res.total ?? 0;
  } catch (e: any) {
    ElMessage.error(e?.message ?? '查询失败');
  } finally {
    loading.value = false;
  }
}

function onSearch() { pageNum.value = 1; void doQuery(); }
function onReset() { filters.value = {}; onSearch(); }

// ---- 操作分派（橙单 operation.type）----
async function onOperation(op: FormOperation, row?: Record<string, unknown>) {
  switch (op.type) {
    case 0: // 新建 → 打开编辑表单（formId 或当前页面第一个编辑表单）
      await openEdit(null, op.formId);
      break;
    case 1: // 编辑
      await openEdit(row ?? null, op.formId);
      break;
    case 2: // 删除
      await doDelete(row);
      break;
    case 10: // 批量删除（简化为单条提示）
      ElMessage.info('批量删除请逐条操作');
      break;
    default:
      if (op.formId) await openEdit(null, op.formId);
  }
}

/** 找编辑表单：优先 operation.formId，其次同页面 edit 角色表单（render.forms），最后缓存 */
async function resolveEditFormId(opFormId?: string): Promise<string> {
  if (opFormId) return opFormId;
  const pageForms = (render.value?.forms ?? []) as Array<{ formId: string; pageRole?: string }>;
  const editForm = pageForms.find((f) => f.pageRole === 'edit');
  if (editForm) return editForm.formId;
  const cached = render.value?.formId
    ? sessionStorage.getItem(`editForm_${render.value.formId}`)
    : null;
  return cached ?? '';
}

async function openEdit(row: null | Record<string, unknown>, opFormId?: string) {
  const formId = await resolveEditFormId(opFormId);
  if (!formId) {
    ElMessage.warning('未配置编辑表单，请在设计器中为「新建/编辑」操作指定目标表单');
    return;
  }
  // 编辑表单作为独立路由页面打开（像橙单跳页操作）
  await router.push({ name: 'OnlineFormRun', query: { formId, pk: row ? String(row.id ?? row._dataId ?? '') : '' } });
}

async function doDelete(row?: Record<string, unknown>) {
  if (!row || !render.value) return;
  if (!(await confirmAction('确定删除该记录？'))) return;
  const pk = row.id ?? row._dataId;
  const ok = await runDelete(render.value.formId, pk).then(() => true).catch(() => false);
  if (ok) { ElMessage.success('已删除'); await doQuery(); }
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
    if (fkValue && rs.pickFormId && rs.displayColumns.length) {
      try {
        const detail = await runDetail(rs.pickFormId, fkValue as string);
        const firstCol = rs.displayColumns.find((c) => c.fieldKey && c.fieldKey !== rs.refPkColumn);
        if (detail && firstCol?.fieldKey) {
          refLabelMap.value[rs.fkColumn] = String(detail[firstCol.fieldKey] ?? fkValue);
        }
      } catch {
        refLabelMap.value[rs.fkColumn] = String(fkValue);
      }
    }
  }
}

// 关联选择弹窗
const pickVisible = ref(false);
const pickRef = ref<null | FormRefSelect>(null);
const pickRows = ref<Array<Record<string, unknown>>>([]);
const pickLoading = ref(false);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pickFilters = ref<Record<string, any>>({});
const pickPageNum = ref(1);
const pickTotal = ref(0);

function pickDisplayColumns(rs: FormRefSelect): FormFieldModel[] {
  const list = (rs.displayColumns ?? []).filter((c) => c.isList && c.fieldKey && c.fieldKey !== rs.refPkColumn);
  return list.length ? list.slice(0, 5) : (rs.displayColumns ?? []).slice(0, 5);
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
    const res = await runQuery({ formId: rs.pickFormId, filters: clean, pageNum: pickPageNum.value, pageSize: 10 });
    pickRows.value = res.rows ?? [];
    pickTotal.value = res.total ?? 0;
  } catch (e: any) {
    ElMessage.error(e?.message ?? '加载关联数据失败');
  } finally {
    pickLoading.value = false;
  }
}

function confirmPick(row: Record<string, unknown>) {
  const rs = pickRef.value;
  if (!rs) return;
  editData.value[rs.fkColumn] = row.id ?? row._dataId ?? null;
  const firstCol = pickDisplayColumns(rs)[0];
  if (firstCol?.fieldKey) refLabelMap.value[rs.fkColumn] = String(row[firstCol.fieldKey] ?? row.id);
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
      editPk.value = pk;
      await loadRefLabels();
      await loadAllSubRows();
    } catch (e: any) {
      ElMessage.error(e?.message ?? '加载详情失败');
    } finally {
      detailLoading.value = false;
    }
  } else {
    editPk.value = null;
    editData.value = {};
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
const dlgSub = ref<null | FormSubTable>(null);
const dlgPk = ref<unknown>(null);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dlgData = ref<Record<string, any>>({});
const dlgSaving = ref(false);

function subFormFields(sub: FormSubTable): FormFieldModel[] {
  return (sub.columns ?? []).filter((f) => f.widgetType !== 'divider');
}
function subListFields(sub: FormSubTable): FormFieldModel[] {
  const list = subFormFields(sub).filter((f) => f.isList);
  return list.length ? list : subFormFields(sub);
}

function openSubDialog(sub: FormSubTable, row?: Record<string, unknown>) {
  if (!editPk.value) {
    ElMessage.warning('请先保存主表记录，再维护从表数据');
    return;
  }
  dlgSub.value = sub;
  dlgPk.value = row ? (row.id ?? row._dataId ?? null) : null;
  dlgData.value = row ? { ...row } : { [sub.fkColumn]: editPk.value };
  dlgVisible.value = true;
}

async function saveSubDialog() {
  const sub = dlgSub.value;
  if (!sub?.dialogFormId) return;
  // 必填校验（前端轻校验）
  for (const f of subFormFields(sub)) {
    if (f.required && (dlgData.value[f.fieldKey ?? ''] === undefined || dlgData.value[f.fieldKey ?? ''] === '')) {
      ElMessage.warning(`请填写「${f.label}」`);
      return;
    }
  }
  dlgSaving.value = true;
  try {
    await runSave({ formId: sub.dialogFormId, data: { ...dlgData.value }, pkValue: dlgPk.value });
    ElMessage.success(dlgPk.value ? '已更新' : '已添加');
    dlgVisible.value = false;
    await loadSubRows(sub);
  } catch (e: any) {
    ElMessage.error(e?.message ?? '保存失败');
  } finally {
    dlgSaving.value = false;
  }
}

async function deleteSubRow(sub: FormSubTable, row: Record<string, unknown>) {
  if (!sub.dialogFormId) return;
  if (!(await confirmAction('确定删除该从表记录？'))) return;
  const pk = row.id ?? row._dataId;
  const ok = await runDelete(sub.dialogFormId, pk).then(() => true).catch(() => false);
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
      await router.replace({ query: { ...route.query, pk: String(returnedPk) } });
      await loadAllSubRows();
      ElMessage.success('主表已保存，可继续维护从表数据');
      return;
    }
    ElMessage.success('保存成功');
    await loadForEdit();
  } catch (e: any) {
    ElMessage.error(e?.message ?? '保存失败');
  }
}

function onCancel() {
  const back = render.value ? sessionStorage.getItem(`backForm_${render.value.formId}`) : null;
  if (back) void router.push({ name: 'OnlineFormRun', query: { formId: back } });
}

watch(() => effectiveFormId.value, () => void load());
onMounted(load);
</script>

<template>
  <Page v-if="!embedded">
    <div v-loading="loading" class="form-run">
      <template v-if="render">
        <div class="fr-head">
          <h2>{{ render.formName }}</h2>
          <ElTag size="small" type="info">{{ render.formType === 1 ? '查询页面' : render.formType === 5 ? '编辑页面' : '表单' }}</ElTag>
        </div>

        <!-- 查询页面 -->
        <template v-if="isQuery">
          <ElForm ref="queryFormRef" :model="filters" inline class="fr-filter">
            <ElFormItem v-for="f in filterFields" :key="f.fieldKey ?? ''" :label="f.label">
              <ElSelect v-if="['select','radio'].includes(f.widgetType ?? '') && optionsOf(f).length"
                        v-model="filters[f.fieldKey ?? '']" clearable style="width:170px">
                <ElOption v-for="o in optionsOf(f)" :key="String(o.value)" :label="o.label" :value="o.value" />
              </ElSelect>
              <ElInputNumber v-else-if="f.widgetType === 'number'" v-model="filters[f.fieldKey ?? '']" style="width:170px" />
              <ElDatePicker v-else-if="['date','datetime'].includes(f.widgetType ?? '')"
                            v-model="filters[f.fieldKey ?? '']" :type="f.widgetType === 'datetime' ? 'datetime' : 'date'"
                            :value-format="f.widgetType === 'datetime' ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD'" style="width:190px" />
              <ElInput v-else v-model="filters[f.fieldKey ?? '']" clearable style="width:170px" />
            </ElFormItem>
            <ElFormItem>
              <ElButton type="primary" @click="onSearch">查询</ElButton>
              <ElButton @click="onReset">重置</ElButton>
            </ElFormItem>
          </ElForm>

          <div class="fr-toolbar">
            <ElButton v-for="op in topOperations" :key="op.name" :type="op.btnType as any" size="small" @click="onOperation(op)">
              {{ op.name }}
            </ElButton>
            <span class="fr-total">共 {{ total }} 条</span>
          </div>
          <div class="fr-table-wrap">
            <table class="fr-table">
              <thead><tr>
                <th v-for="f in listFields" :key="f.fieldKey ?? ''">{{ f.label }}</th>
                <th class="fr-op-col">操作</th>
              </tr></thead>
              <tbody>
                <tr v-for="(row, idx) in rows" :key="idx">
                  <td v-for="f in listFields" :key="f.fieldKey ?? ''">{{ labelOf(row, f) }}</td>
                  <td class="fr-op-col">
                    <ElButton v-for="op in rowOperations" :key="op.name" link size="small"
                              :type="op.type === 2 ? 'danger' : 'primary'" @click="onOperation(op, row)">
                      {{ op.name }}
                    </ElButton>
                  </td>
                </tr>
                <tr v-if="!rows.length"><td :colspan="listFields.length + 1" class="fr-empty">暂无数据</td></tr>
              </tbody>
            </table>
          </div>
          <div class="fr-pager">
            <ElButton size="small" :disabled="pageNum <= 1" @click="pageNum--; doQuery()">上一页</ElButton>
            <span>第 {{ pageNum }} / {{ Math.max(1, Math.ceil(total / pageSize)) }} 页</span>
            <ElButton size="small" :disabled="pageNum >= Math.ceil(total / pageSize)" @click="pageNum++; doQuery()">下一页</ElButton>
          </div>
        </template>

        <!-- 编辑页面（主子表：主表区 + 从表 Tabs） -->
        <template v-else-if="isEdit">
          <ElForm ref="editFormRef" :model="editData" :label-width="(render.design.labelWidth || '110px')" v-loading="detailLoading">
            <ElFormItem v-for="f in formFields" :key="f.fieldKey ?? ''" :label="f.label" :required="f.required">
              <!-- 关联选择组件（一对一/多对一，render 自动推导） -->
              <div v-if="refSelectFor(f.fieldKey)" class="fr-ref-select">
                <ElInput :model-value="refLabelMap[f.fieldKey ?? ''] ?? String(editData[f.fieldKey ?? ''] ?? '')"
                         :placeholder="`点击选择${refSelectFor(f.fieldKey)!.refTitle ?? ''}`" readonly />
                <ElButton size="small" type="primary" plain @click="openPickDialog(refSelectFor(f.fieldKey)!)">选择</ElButton>
                <ElButton v-if="editData[f.fieldKey ?? '']" size="small" @click="clearRef(refSelectFor(f.fieldKey)!)">清空</ElButton>
              </div>
              <ElSelect v-else-if="['select','radio'].includes(f.widgetType ?? '') && optionsOf(f).length"
                        v-model="editData[f.fieldKey ?? '']" clearable>
                <ElOption v-for="o in optionsOf(f)" :key="String(o.value)" :label="o.label" :value="o.value" />
              </ElSelect>
              <ElInputNumber v-else-if="f.widgetType === 'number'" v-model="editData[f.fieldKey ?? '']" />
              <ElDatePicker v-else-if="['date','datetime'].includes(f.widgetType ?? '')"
                            v-model="editData[f.fieldKey ?? '']" :type="f.widgetType === 'datetime' ? 'datetime' : 'date'"
                            :value-format="f.widgetType === 'datetime' ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD'" />
              <ElSwitch v-else-if="f.widgetType === 'switch'" v-model="editData[f.fieldKey ?? '']" />
              <ElInput v-else v-model="editData[f.fieldKey ?? '']" />
            </ElFormItem>
          </ElForm>
          <div class="fr-edit-actions">
            <ElButton type="primary" @click="onSaveEdit">保存</ElButton>
            <ElButton @click="onCancel">取消</ElButton>
          </div>

          <!-- 从表 Tabs（主子表编辑，零配置由关系推导） -->
          <div v-if="subTables.length" class="fr-subtables">
            <div v-if="!editPk" class="fr-sub-locked">保存主表记录后，可在此维护从表数据</div>
            <ElTabs v-else>
              <ElTabPane v-for="sub in subTables" :key="sub.edgeId" :label="sub.title">
                <div class="fr-sub-toolbar">
                  <ElButton size="small" type="primary" @click="openSubDialog(sub)">新增</ElButton>
                </div>
                <table class="fr-table">
                  <thead><tr>
                    <th v-for="f in subListFields(sub)" :key="f.fieldKey ?? ''">{{ f.label }}</th>
                    <th class="fr-op-col">操作</th>
                  </tr></thead>
                  <tbody>
                    <tr v-for="(srow, si) in (subRowsMap[sub.edgeId] ?? [])" :key="si">
                      <td v-for="f in subListFields(sub)" :key="f.fieldKey ?? ''">{{ labelOf(srow, f) }}</td>
                      <td class="fr-op-col">
                        <ElButton link size="small" type="primary" @click="openSubDialog(sub, srow)">编辑</ElButton>
                        <ElButton link size="small" type="danger" @click="deleteSubRow(sub, srow)">删除</ElButton>
                      </td>
                    </tr>
                    <tr v-if="!(subRowsMap[sub.edgeId] ?? []).length">
                      <td :colspan="subListFields(sub).length + 1" class="fr-empty">暂无数据</td>
                    </tr>
                  </tbody>
                </table>
              </ElTabPane>
            </ElTabs>
          </div>
        </template>

        <div v-else class="fr-empty">暂不支持的表单类型：{{ render.formType }}</div>
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
          <span v-if="f.fieldKey === dlgSub?.fkColumn" class="fr-fk-static">{{ dlgData[f.fieldKey] }}</span>
          <ElSelect
            v-else-if="['select','radio'].includes(f.widgetType ?? '') && optionsOf(f).length"
            v-model="dlgData[f.fieldKey ?? '']" clearable
          >
            <ElOption v-for="o in optionsOf(f)" :key="String(o.value)" :label="o.label" :value="o.value" />
          </ElSelect>
          <ElInputNumber v-else-if="f.widgetType === 'number'" v-model="dlgData[f.fieldKey ?? '']" />
          <ElDatePicker
            v-else-if="['date','datetime'].includes(f.widgetType ?? '')"
            v-model="dlgData[f.fieldKey ?? '']"
            :type="f.widgetType === 'datetime' ? 'datetime' : 'date'"
            :value-format="f.widgetType === 'datetime' ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD'"
          />
          <ElInput v-else v-model="dlgData[f.fieldKey ?? '']" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="dlgVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="dlgSaving" @click="saveSubDialog">保存</ElButton>
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
          v-for="c in (pickRef?.displayColumns ?? []).filter(c => ['input','textarea'].includes(c.widgetType ?? '') && c.isList).slice(0, 2)"
          :key="c.fieldKey ?? ''"
          v-model="pickFilters[c.fieldKey ?? '']"
          :placeholder="`按${c.label}过滤`"
          clearable
          style="width: 200px"
          @keyup.enter="pickPageNum = 1; doPickQuery()"
        />
        <ElButton type="primary" size="small" @click="pickPageNum = 1; doPickQuery()">查询</ElButton>
      </div>
      <div v-loading="pickLoading" class="fr-pick-table">
        <table class="fr-table">
          <thead><tr><th class="fr-pick-radio">选</th>
            <th v-for="c in pickDisplayColumns(pickRef!)" :key="c.fieldKey ?? ''">{{ c.label }}</th>
          </tr></thead>
          <tbody>
            <tr v-for="(row, i) in pickRows" :key="i" class="fr-pick-row" @click="confirmPick(row)">
              <td class="fr-pick-radio"><ElTag size="small" type="info">单选</ElTag></td>
              <td v-for="c in pickDisplayColumns(pickRef!)" :key="c.fieldKey ?? ''">{{ labelOf(row, c) }}</td>
            </tr>
            <tr v-if="!pickRows.length"><td :colspan="(pickRef ? pickDisplayColumns(pickRef).length : 0) + 1" class="fr-empty">暂无数据</td></tr>
          </tbody>
        </table>
      </div>
      <div class="fr-pager">
        <ElButton size="small" :disabled="pickPageNum <= 1" @click="pickPageNum--; doPickQuery()">上一页</ElButton>
        <span>第 {{ pickPageNum }} / {{ Math.max(1, Math.ceil(pickTotal / 10)) }} 页</span>
        <ElButton size="small" :disabled="pickPageNum >= Math.ceil(pickTotal / 10)" @click="pickPageNum++; doPickQuery()">下一页</ElButton>
      </div>
    </ElDialog>
  </Page>

  <!-- 内嵌预览模式（设计器用） -->
  <div v-else v-loading="loading" class="form-run embedded">
    <template v-if="render && isQuery">
      <div class="fr-filter-preview">
        <span v-for="f in filterFields" :key="f.fieldKey ?? ''" class="fr-chip">{{ f.label }}</span>
      </div>
      <div class="fr-table-preview">
        <div class="fr-row" v-for="f in listFields" :key="f.fieldKey ?? ''">{{ f.label }}</div>
      </div>
    </template>
    <ElForm v-else-if="render && isEdit" :model="editData" label-width="110px">
      <ElFormItem v-for="f in formFields" :key="f.fieldKey ?? ''" :label="f.label">
        <ElInput :placeholder="f.label" />
      </ElFormItem>
    </ElForm>
    <div v-else class="fr-empty">设计预览</div>
  </div>
</template>

<style scoped>
.form-run { padding: 4px 0; }
.fr-head { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
.fr-head h2 { font-size: 18px; margin: 0; }
.fr-filter { background: var(--el-fill-color-blank); border: 1px solid var(--el-border-color-lighter); border-radius: 8px; padding: 14px; margin-bottom: 14px; }
.fr-toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.fr-total { color: var(--el-text-color-secondary); font-size: 13px; margin-left: auto; }
.fr-table-wrap { border: 1px solid var(--el-border-color); border-radius: 8px; overflow: auto; }
.fr-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.fr-table th, .fr-table td { padding: 8px 10px; text-align: left; border-bottom: 1px solid var(--el-border-color-lighter); white-space: nowrap; }
.fr-table th { background: var(--el-fill-color-light); font-weight: 600; }
.fr-op-col { text-align: center; }
.fr-empty { color: var(--el-text-color-secondary); text-align: center; padding: 40px; }
.fr-pager { display: flex; align-items: center; justify-content: flex-end; gap: 10px; margin-top: 14px; }
.fr-edit-actions { display: flex; gap: 10px; margin-top: 20px; }
.fr-subtables { margin-top: 24px; }
.fr-sub-locked { background: var(--el-fill-color-light); border: 1px dashed var(--el-border-color); border-radius: 6px; color: var(--el-text-color-secondary); font-size: 13px; padding: 14px; text-align: center; }
.fr-sub-toolbar { display: flex; justify-content: flex-end; gap: 8px; margin: 4px 0 8px; }
.fr-fk-static { color: var(--el-text-color-secondary); font-size: 13px; }
.fr-ref-select { display: flex; gap: 8px; width: 100%; }
.fr-ref-select .el-input { flex: 1; }
.fr-pick-filter { display: flex; gap: 8px; margin-bottom: 10px; }
.fr-pick-table { max-height: 320px; overflow: auto; border: 1px solid var(--el-border-color-lighter); border-radius: 6px; }
.fr-pick-row { cursor: pointer; }
.fr-pick-row:hover { background: var(--el-color-primary-light-9); }
.fr-pick-radio { width: 46px; text-align: center; }
.fr-chip { display: inline-block; background: var(--el-fill-color-light); border-radius: 4px; padding: 4px 10px; margin: 0 6px 6px 0; font-size: 12px; }
.fr-row { padding: 8px; border-bottom: 1px solid var(--el-border-color-lighter); font-size: 13px; }
</style>
