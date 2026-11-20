<script lang="ts" setup>
/**
 * 在线表单数据工作台（运行时引擎前端）。
 *
 * 核心：拿到 FormRuntimeVO（字段模型 + 字典选项）后，自动生成：
 *   - 查询区（isQuery 字段 + filterType）
 *   - 数据列表（isList 字段 + _labels 字典翻译）
 *   - 新增/编辑弹窗（isForm 字段 + 控件类型 + 字典下拉）
 *   - 详情抽屉
 *   - 多 Tab 页面（选择 page 后按 tab 切换多个表单视图）
 * 物理表 / JSON 文档两种存储对前端完全透明。
 */
import type {
  FormFieldModel,
  FormRuntimeVO,
  OnlineFormDictItem,
  OnlinePageVO,
  RunQueryVO,
} from '#/api/online';

import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';

import { Page } from '@vben/common-ui';

import {
  ElButton,
  ElDatePicker,
  ElDrawer,
  ElForm,
  ElFormItem,
  ElInput,
  ElInputNumber,
  ElMessage,
  ElOption,
  ElRadioButton,
  ElRadioGroup,
  ElSelect,
  ElSwitch,
  ElTabPane,
  ElTabs,
  ElTag,
} from 'element-plus';
import type { FormInstance } from 'element-plus';

import {
  getOnlineFormDict,
  getPageList,
  getRunConfig,
  runDelete,
  runDetail,
  runQuery,
  runSave,
} from '#/api/online';
import { confirmAction, withFeedback } from '../../system/shared/helpers';

const formOptions = ref<OnlineFormDictItem[]>([]);
const pageOptions = ref<OnlinePageVO[]>([]);
const selectedFormId = ref<string>('');
const selectedPageId = ref<string>('');
const activeTab = ref<string>('main');
const config = ref<null | FormRuntimeVO>(null);
const loading = ref(false);

// 查询条件（any 便于 v-model 双向绑定到动态控件，值语义由后端校验）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const filters = reactive<Record<string, any>>({});
// 分页
const pageNum = ref(1);
const pageSize = ref(20);
const result = ref<RunQueryVO>({ rows: [], total: 0, pageNum: 1, pageSize: 20 });

// 编辑弹窗
const editVisible = ref(false);
const editSaving = ref(false);
const editTitle = ref('新增');
const editPk = ref<unknown>(null);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const editData = reactive<Record<string, any>>({});
const editRef = ref<FormInstance>();
// 详情抽屉
const detailVisible = ref(false);
const detailData = ref<Record<string, unknown>>({});
// 页面 tabs 视图
const pageView = ref<null | OnlinePageVO>(null);

const queryFields = computed(() =>
  (config.value?.fields ?? []).filter((f) => f.isQuery && f.widgetType !== 'divider'),
);
const listFields = computed(() =>
  (config.value?.fields ?? []).filter((f) => f.isList && f.widgetType !== 'divider'),
);
const formFields = computed(() =>
  (config.value?.fields ?? []).filter((f) => f.isForm !== false && f.widgetType !== 'divider'),
);
const pkColumn = computed(() => config.value?.pkColumn ?? 'id');

function optionsOf(field: FormFieldModel): Array<{ label: string; value: string | number }> {
  if (field.options?.length) return field.options;
  if (field.dictCode && config.value?.dicts?.[field.dictCode]) {
    return config.value.dicts[field.dictCode] as Array<{ label: string; value: string | number }>;
  }
  return [];
}

function labelOf(row: Record<string, unknown>, field: FormFieldModel): unknown {
  const labels = row._labels as Record<string, unknown> | undefined;
  if (labels && field.fieldKey in labels) return labels[field.fieldKey];
  const raw = row[field.fieldKey] ?? row[field.column ?? ''];
  if (field.dictCode) {
    const opt = optionsOf(field).find((o) => String(o.value) === String(raw));
    if (opt) return opt.label;
  }
  if (typeof raw === 'boolean') return raw ? '是' : '否';
  return raw ?? '-';
}

async function loadOptions() {
  try {
    formOptions.value = await getOnlineFormDict();
    pageOptions.value = await getPageList();
  } catch {
    formOptions.value = [];
    pageOptions.value = [];
  }
}

async function selectForm(formId: string) {
  if (!formId) return;
  selectedFormId.value = formId;
  selectedPageId.value = '';
  pageView.value = null;
  activeTab.value = 'main';
  await loadConfig(formId);
}

async function selectPage(pageId: string) {
  if (!pageId) return;
  selectedPageId.value = pageId;
  selectedFormId.value = '';
  pageView.value = pageOptions.value.find((p) => p.pageId === pageId) ?? null;
  // 多 tab：以第一个查询列表 tab 的表单作为配置基准
  const first = pageView.value?.tabs?.find((t) => t.viewType === 1 && t.enabled !== 0)
    ?? pageView.value?.tabs?.[0];
  if (first) {
    await loadConfig(first.formId);
    activeTab.value = first.tabId ?? 'main';
  }
}

async function loadConfig(formId: string) {
  loading.value = true;
  try {
    config.value = await getRunConfig(formId);
    // 初始化查询字段
    for (const key of Object.keys(filters)) delete filters[key];
    for (const f of queryFields.value) filters[f.fieldKey] = undefined;
    await doQuery();
  } catch (e: any) {
    ElMessage.error(e?.message ?? '加载表单配置失败');
    config.value = null;
  } finally {
    loading.value = false;
  }
}

async function doQuery() {
  if (!selectedFormId.value && !config.value) return;
  loading.value = true;
  try {
    const cleanFilters: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(filters)) {
      if (v !== undefined && v !== null && String(v) !== '') cleanFilters[k] = v;
    }
    result.value = await runQuery({
      formId: config.value!.formId,
      filters: cleanFilters,
      pageNum: pageNum.value,
      pageSize: pageSize.value,
    });
  } catch (e: any) {
    ElMessage.error(e?.message ?? '查询失败');
  } finally {
    loading.value = false;
  }
}

function resetFilters() {
  for (const key of Object.keys(filters)) filters[key] = undefined;
  pageNum.value = 1;
  void doQuery();
}

function openCreate() {
  editTitle.value = '新增';
  editPk.value = null;
  for (const key of Object.keys(editData)) delete editData[key];
  for (const f of formFields.value) {
    editData[f.fieldKey] = f.defaultValue ?? (f.widgetType === 'switch' ? 0 : undefined);
  }
  editVisible.value = true;
  nextTick(() => editRef.value?.clearValidate());
}

function cellValue(row: Record<string, unknown>, field: FormFieldModel): unknown {
  return row[field.fieldKey] ?? row[field.column ?? ''];
}

function openEdit(row: Record<string, unknown>) {
  editTitle.value = '编辑';
  editPk.value = row[pkColumn.value] ?? row._dataId;
  for (const key of Object.keys(editData)) delete editData[key];
  for (const f of formFields.value) {
    editData[f.fieldKey] = cellValue(row, f);
  }
  editVisible.value = true;
  nextTick(() => editRef.value?.clearValidate());
}

async function openDetail(row: Record<string, unknown>) {
  const pk = row[pkColumn.value] ?? row._dataId;
  try {
    detailData.value = await runDetail(config.value!.formId, pk);
    detailVisible.value = true;
  } catch (e: any) {
    ElMessage.error(e?.message ?? '加载详情失败');
  }
}

async function onSave() {
  const valid = await editRef.value?.validate().catch(() => false);
  if (valid === false) return;
  editSaving.value = true;
  try {
    await withFeedback(() => runSave({
      formId: config.value!.formId,
      data: { ...editData },
      pkValue: editPk.value,
    }), '保存成功');
    editVisible.value = false;
    await doQuery();
  } finally {
    editSaving.value = false;
  }
}

async function onDelete(row: Record<string, unknown>) {
  const pk = row[pkColumn.value] ?? row._dataId;
  if (!(await confirmAction('确定删除该记录？'))) return;
  const ok = await withFeedback(() => runDelete(config.value!.formId, pk), '已删除');
  if (ok) await doQuery();
}

// 多 tab 页面：切换 tab 时加载对应表单配置并查询
async function onTabChange(tabName: string | number) {
  const tabId = String(tabName);
  activeTab.value = tabId;
  const tab = pageView.value?.tabs?.find((t) => t.tabId === tabId);
  if (tab && tab.formId !== config.value?.formId) {
    await loadConfig(tab.formId);
  }
}

watch(pageNum, () => void doQuery());
watch(pageSize, () => { pageNum.value = 1; void doQuery(); });

onMounted(loadOptions);

// 控件渲染：编辑弹窗里的动态输入
function inputType(widgetType: string): string {
  if (widgetType === 'textarea') return 'textarea';
  return 'text';
}
</script>

<template>
  <Page>
    <div class="runtime-workspace">
      <div class="ws-toolbar">
        <span class="ws-title">数据工作台</span>
        <ElSelect
          v-model="selectedFormId"
          placeholder="选择表单模板（查询/编辑/详情）"
          clearable
          filterable
          style="width: 300px"
          @change="selectForm"
        >
          <ElOption
            v-for="f in formOptions"
            :key="f.id"
            :label="f.name"
            :value="f.id"
          />
        </ElSelect>
        <span class="ws-or">或</span>
        <ElSelect
          v-model="selectedPageId"
          placeholder="选择页面（多Tab）"
          clearable
          filterable
          style="width: 240px"
          @change="selectPage"
        >
          <ElOption
            v-for="p in pageOptions"
            :key="p.pageId"
            :label="p.pageName"
            :value="p.pageId"
          />
        </ElSelect>
      </div>

      <template v-if="config">
        <!-- 多 Tab 容器 -->
        <ElTabs v-if="pageView && pageView.tabs?.length" v-model="activeTab" @tab-change="onTabChange">
          <ElTabPane
            v-for="tab in pageView.tabs.filter(t => t.enabled !== 0)"
            :key="tab.tabId"
            :label="tab.tabName"
            :name="tab.tabId"
          />
        </ElTabs>

        <div class="ws-card">
          <div class="ws-section-title">
            {{ config.formName }}
            <ElTag size="small" type="info" class="ml-2">
              {{ config.storageType === 1 ? '物理表' : 'JSON文档' }}
            </ElTag>
          </div>

          <!-- 查询区 -->
          <ElForm v-if="queryFields.length" :model="filters" inline class="ws-query">
            <ElFormItem v-for="f in queryFields" :key="f.fieldKey" :label="f.label">
              <ElSelect
                v-if="['select', 'radio'].includes(f.widgetType) && optionsOf(f).length"
                v-model="filters[f.fieldKey]"
                clearable
                :placeholder="`请选择${f.label}`"
                style="width: 180px"
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
                v-model="filters[f.fieldKey] as number"
                :placeholder="`请输入${f.label}`"
                style="width: 180px"
              />
              <ElDatePicker
                v-else-if="['date', 'datetime'].includes(f.widgetType)"
                v-model="filters[f.fieldKey] as string"
                :type="f.widgetType === 'datetime' ? 'datetime' : 'date'"
                :value-format="f.widgetType === 'datetime' ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD'"
                placeholder="选择日期"
                style="width: 200px"
              />
              <ElSwitch
                v-else-if="f.widgetType === 'switch'"
                v-model="filters[f.fieldKey] as boolean"
              />
              <ElInput
                v-else
                v-model="filters[f.fieldKey] as string"
                :placeholder="`请输入${f.label}${f.filterType === 2 ? '（模糊）' : ''}`"
                clearable
                style="width: 180px"
              />
            </ElFormItem>
            <ElFormItem>
              <ElButton type="primary" @click="doQuery">查询</ElButton>
              <ElButton @click="resetFilters">重置</ElButton>
            </ElFormItem>
          </ElForm>

          <!-- 列表区 -->
          <div class="ws-list-bar">
            <ElButton v-if="config.storageType === 1 || true" type="success" size="small" @click="openCreate">
              新增
            </ElButton>
            <span class="ws-total">共 {{ result.total }} 条</span>
          </div>
          <div class="ws-table-wrap">
            <table class="ws-table">
              <thead>
                <tr>
                  <th v-for="f in listFields" :key="f.fieldKey">{{ f.label }}</th>
                  <th class="ws-actions-th">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, idx) in result.rows" :key="idx">
                  <td v-for="f in listFields" :key="f.fieldKey">
                    <ElTag v-if="f.widgetType === 'switch'" size="small" :type="labelOf(row, f) ? 'success' : 'info'">
                      {{ labelOf(row, f) ? '是' : '否' }}
                    </ElTag>
                    <span v-else>{{ labelOf(row, f) }}</span>
                  </td>
                  <td class="ws-actions">
                    <ElButton link type="primary" size="small" @click="openDetail(row)">详情</ElButton>
                    <ElButton link type="primary" size="small" @click="openEdit(row)">编辑</ElButton>
                    <ElButton link type="danger" size="small" @click="onDelete(row)">删除</ElButton>
                  </td>
                </tr>
                <tr v-if="!result.rows.length">
                  <td :colspan="listFields.length + 1" class="ws-empty">暂无数据</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="ws-pager">
            <ElButton size="small" :disabled="pageNum <= 1" @click="pageNum--">上一页</ElButton>
            <span>第 {{ pageNum }} / {{ Math.max(1, Math.ceil(result.total / pageSize)) }} 页</span>
            <ElButton
              size="small"
              :disabled="pageNum >= Math.ceil(result.total / pageSize)"
              @click="pageNum++"
            >
              下一页
            </ElButton>
            <ElSelect v-model="pageSize" size="small" style="width: 100px">
              <ElOption :value="10" label="10条/页" />
              <ElOption :value="20" label="20条/页" />
              <ElOption :value="50" label="50条/页" />
            </ElSelect>
          </div>
        </div>
      </template>

      <div v-else class="ws-placeholder">
        <p>请从上方选择一个表单模板或页面开始</p>
        <p class="ws-hint">
          选择后系统会自动加载字段模型，生成查询区、列表、编辑弹窗与详情面板。
          物理表与 JSON 文档两种存储模式共用同一界面。
        </p>
      </div>
    </div>

    <!-- 编辑弹窗 -->
    <ElDrawer v-model="editVisible" :title="editTitle" size="560px">
      <ElForm ref="editRef" :model="editData" label-position="top">
        <ElFormItem
          v-for="f in formFields"
          :key="f.fieldKey"
          :label="f.label"
          :rules="f.required ? [{ required: true, message: `请输入${f.label}` }] : undefined"
        >
          <ElSelect
            v-if="['select', 'radio'].includes(f.widgetType) && optionsOf(f).length"
            v-model="editData[f.fieldKey]"
            clearable
            :placeholder="`请选择${f.label}`"
          >
            <ElOption
              v-for="o in optionsOf(f)"
              :key="String(o.value)"
              :label="o.label"
              :value="o.value"
            />
          </ElSelect>
          <ElRadioGroup v-else-if="f.widgetType === 'radio' && optionsOf(f).length" v-model="editData[f.fieldKey]">
            <ElRadioButton v-for="o in optionsOf(f)" :key="String(o.value)" :value="o.value">
              {{ o.label }}
            </ElRadioButton>
          </ElRadioGroup>
          <ElInputNumber
            v-else-if="f.widgetType === 'number'"
            v-model="editData[f.fieldKey] as number"
            style="width: 100%"
          />
          <ElDatePicker
            v-else-if="['date', 'datetime'].includes(f.widgetType)"
            v-model="editData[f.fieldKey] as string"
            :type="f.widgetType === 'datetime' ? 'datetime' : 'date'"
            :value-format="f.widgetType === 'datetime' ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD'"
            style="width: 100%"
          />
          <ElSwitch v-else-if="f.widgetType === 'switch'" v-model="editData[f.fieldKey] as boolean" />
          <ElInput
            v-else
            v-model="editData[f.fieldKey] as string"
            :type="inputType(f.widgetType)"
            :placeholder="f.placeholder || `请输入${f.label}`"
          />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="editVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="editSaving" @click="onSave">保存</ElButton>
      </template>
    </ElDrawer>

    <!-- 详情抽屉 -->
    <ElDrawer v-model="detailVisible" title="详情" size="560px">
      <div v-for="f in formFields" :key="f.fieldKey" class="detail-row">
        <span class="detail-label">{{ f.label }}</span>
        <span class="detail-value">{{ detailData[f.fieldKey] ?? detailData[f.column ?? ''] ?? '-' }}</span>
      </div>
    </ElDrawer>
  </Page>
</template>

<style scoped>
.runtime-workspace { padding: 4px 0; }
.ws-toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
.ws-title { font-size: 18px; font-weight: 600; }
.ws-or { color: var(--el-text-color-secondary); }
.ws-card { border: 1px solid var(--el-border-color); border-radius: 8px; padding: 16px; margin-top: 12px; }
.ws-section-title { font-size: 16px; font-weight: 600; margin-bottom: 16px; }
.ws-query { border-bottom: 1px solid var(--el-border-color-lighter); padding-bottom: 12px; }
.ws-list-bar { display: flex; align-items: center; gap: 12px; margin: 12px 0; }
.ws-total { color: var(--el-text-color-secondary); font-size: 13px; }
.ws-table-wrap { overflow-x: auto; }
.ws-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.ws-table th, .ws-table td { padding: 8px 10px; text-align: left; border-bottom: 1px solid var(--el-border-color-lighter); white-space: nowrap; }
.ws-table th { background: var(--el-fill-color-light); font-weight: 600; }
.ws-actions-th, .ws-actions { text-align: center; }
.ws-empty { text-align: center; color: var(--el-text-color-secondary); padding: 32px; }
.ws-pager { display: flex; align-items: center; gap: 10px; margin-top: 14px; justify-content: flex-end; }
.ws-placeholder { border: 1px dashed var(--el-border-color); border-radius: 8px; padding: 60px 20px; text-align: center; color: var(--el-text-color-secondary); }
.ws-hint { font-size: 13px; margin-top: 8px; }
.detail-row { display: flex; padding: 10px 0; border-bottom: 1px solid var(--el-border-color-lighter); }
.detail-label { width: 140px; color: var(--el-text-color-secondary); flex-shrink: 0; }
.detail-value { flex: 1; }
.ml-2 { margin-left: 8px; }
</style>
