<script lang="ts" setup>
import type { ScriptScope } from '../../form/designer/script';
import type {
  DesignWidget,
  FormDesignDoc,
  TableColumnDesign,
} from '../../form/designer/types';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
/**
 * 运行时查询页（v5 协议）：左树 + 条件区 + 分页表格。
 *
 * - 条件区按设计器 formConfig.filter 布局（固定像素宽、标签宽度、折叠行数）；
 * - 条件显隐/禁用/值改变执行设计器里配置的事件脚本；
 * - 左树绑定字典（parentValue 组树），点击把节点值写入指定查询字段；
 * - 表格按 tableWidget 的列配置渲染，支持字典翻译、排序、分页、行操作。
 */
import type {
  FormFieldModel,
  FormOperation,
  FormRenderVo,
} from '#/api/online/types';

import { computed, nextTick, onMounted, reactive, ref } from 'vue';

import dayjs from 'dayjs';
import {
  ElButton,
  ElForm,
  ElFormItem,
  ElInput,
  ElMessage,
  ElPagination,
  ElTree,
} from 'element-plus';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { runQuery } from '#/api/online/modeling';

import RunWidget from '../../form/designer/RunWidget.vue';
import {
  evalEventFlag,
  fireEvent,
  styleToObject,
} from '../../form/designer/script';
import { normalizeDoc } from '../../form/designer/types';

const props = defineProps<{ render: FormRenderVo }>();
const emit = defineEmits<{
  batchDelete: [rows: Array<Record<string, any>>];
  'open-form': [payload: { id?: any; role: string }];
  operation: [op: FormOperation, row?: Record<string, any>];
}>();

const designDoc = computed<FormDesignDoc>(() =>
  normalizeDoc(
    {
      formId: props.render.formId,
      formCode: props.render.formCode,
      viewType: Number(props.render.viewType ?? props.render.formType ?? 1),
      widgetJson: JSON.stringify({ pc: props.render.design }),
    },
    (props.render.design?.tableWidget?.tableColumnList ??
      []) as FormFieldModel[],
  ),
);

const filters = reactive<Record<string, any>>({});
const rows = ref<Array<Record<string, any>>>([]);
const selectedRows = ref<Array<Record<string, any>>>([]);
const total = ref(0);
const pageNum = ref(1);
const pageSize = ref(20);
const loading = ref(false);
const advancedOpen = ref(false);
const treeKeyword = ref('');
const activeTreeValue = ref<any>('__ALL__');
const orderBy = ref('');
const orderAsc = ref(true);

const dictOptions = computed<
  Record<string, Array<{ label: string; parentValue?: string; value: any }>>
>(() => (props.render.dicts || {}) as any);

const isTree = computed(() => designDoc.value.layout === 'tree');
/** 列表树形：把后端平铺行按 pidColumn 转成 children 树。 */
const treeConfig = computed(() => {
  const table = designDoc.value.table;
  if (!table.tree) return undefined;
  return {
    transform: true,
    rowField: 'id',
    parentField: table.pidColumn || 'parent_id',
    childrenField: 'children',
    mapChildrenField: '__children',
    expandAll: table.treeExpandAll !== false,
    showRootLine: true,
    showIcon: true,
  };
});
const checkboxConfig = computed(() => ({
  checkMethod: ({ row }: { row: Record<string, any> }) =>
    Boolean(row?.id ?? row?._dataId) &&
    (!designDoc.value.table.tree || !row?.children?.length),
}));
const visibleMain = computed(() =>
  designDoc.value.widgetList.filter((c) => !c.advanced && conditionVisible(c)),
);
const visibleAdvanced = computed(() =>
  designDoc.value.widgetList.filter((c) => c.advanced && conditionVisible(c)),
);
const visibleColumns = computed(() =>
  designDoc.value.table.columns.filter(
    (c) =>
      c.show !== false && evalEventFlag(c.events, 'visible', scope(), true),
  ),
);
const topOperations = computed(() =>
  designDoc.value.table.operationList.filter(
    (o) => o.enabled !== false && !o.rowOperation,
  ),
);
const rowOperations = computed(() =>
  designDoc.value.table.operationList.filter(
    (o) => o.enabled !== false && o.rowOperation,
  ),
);
/** 配置了批量删除（operation.type=10）才显示多选列。 */
const hasBatchDelete = computed(() =>
  topOperations.value.some((o) => o.type === 10),
);

const treeData = computed(() => {
  const code = designDoc.value.leftTree.dictCode;
  const flat = (code ? dictOptions.value[code] : []) || [];
  const build = (list: typeof flat, parent?: string): any[] =>
    list
      .filter((o) =>
        parent ? String(o.parentValue ?? '') === parent : !o.parentValue,
      )
      .map((o) => ({
        label: o.label,
        value: o.value,
        children: build(list, String(o.value)),
      }));
  let nodes = flat.length > 0 ? build(flat) : [];
  if (designDoc.value.leftTree.showAllNode && flat.length > 0) {
    nodes = [
      {
        label: designDoc.value.leftTree.allLabel || '全部',
        value: '__ALL__',
        children: nodes,
      },
    ];
  }
  return nodes;
});

const filteredTree = computed(() => {
  const keyword = treeKeyword.value.trim();
  if (!keyword) return treeData.value;
  const walk = (nodes: any[]): any[] =>
    nodes
      .map((n) => {
        const children = walk(n.children || []);
        if (String(n.label).includes(keyword) || children.length > 0) {
          return { ...n, children };
        }
        return null;
      })
      .filter(Boolean);
  return walk(treeData.value) as any[];
});

function scope(extra: Record<string, any> = {}): ScriptScope {
  return {
    form: filters,
    value: undefined,
    row: undefined,
    params: {},
    setValue: (field: string, value: any) => {
      filters[field] = value;
    },
    reload: () => void doQuery(true),
    message: (text: string, type: any = 'info') =>
      ElMessage({ message: text, type }),
    openForm: (role: string, id?: any) => emit('open-form', { role, id }),
    console,
    ...extra,
  };
}

function conditionVisible(widget: DesignWidget): boolean {
  if (widget.visible === false) return false;
  return evalEventFlag(
    widget.events,
    'visible',
    scope({ value: filters[widget.field] }),
    true,
  );
}

function conditionDisabled(widget: DesignWidget): boolean {
  return evalEventFlag(
    widget.events,
    'disabled',
    scope({ value: filters[widget.field] }),
    false,
  );
}

function optionsFor(widget: DesignWidget) {
  const dictCode =
    widget.dictCode ||
    ((widget.props as any)?.dictInfo?.dictCode as string | undefined);
  if (dictCode) return dictOptions.value[dictCode] || [];
  return widget.options || [];
}

function defaultFor(widget: DesignWidget) {
  if (widget.filterType === 3 || widget.filterType === 4 || widget.dictMultiple)
    return [];
  if (widget.widgetType === 'switch') return false;
  return undefined;
}

function initFilters() {
  designDoc.value.widgetList.forEach((widget) => {
    if (!widget.field) return;
    filters[widget.field] =
      widget.defaultValue === undefined || widget.defaultValue === null
        ? defaultFor(widget)
        : widget.defaultValue;
  });
  pageSize.value = designDoc.value.table.pageSize || 20;
}

function hasValue(value: any): boolean {
  if (value === undefined || value === null || value === '') return false;
  if (Array.isArray(value))
    return value.some((v) => v !== undefined && v !== null && v !== '');
  return true;
}

function buildFilters(): {
  filterTypes: Record<string, number>;
  filters: Record<string, any>;
} {
  const clean: Record<string, any> = {};
  const filterTypes: Record<string, number> = {};
  const allVisible = [...visibleMain.value, ...visibleAdvanced.value];
  allVisible.forEach((widget) => {
    const value = filters[widget.field];
    if (!widget.field || !hasValue(value)) return;
    clean[widget.field] = Array.isArray(value) ? value : value;
    if (widget.filterType > 0) filterTypes[widget.field] = widget.filterType;
  });
  return { filterTypes, filters: clean };
}

async function doQuery(resetPage = true) {
  if (resetPage) pageNum.value = 1;
  fireEvent(designDoc.value.formEventList, 'beforeQuery', scope());
  const payload = buildFilters();
  loading.value = true;
  try {
    const res = await runQuery({
      formId: props.render.formId,
      filters: payload.filters,
      filterTypes: payload.filterTypes,
      pageNum: pageNum.value,
      pageSize: pageSize.value,
      orderBy: orderBy.value || designDoc.value.table.orderColumn,
      orderDir: orderAsc.value ? 'asc' : 'desc',
    });
    rows.value = (res.rows ?? []) as Array<Record<string, any>>;
    total.value = res.total ?? 0;
    selectedRows.value = [];
    await nextTick();
    gridApi.grid?.clearCheckboxRow?.();
    fireEvent(
      designDoc.value.formEventList,
      'afterQuery',
      scope({ rows: rows.value, total: total.value }),
    );
  } catch (error) {
    ElMessage.error(`查询失败：${(error as Error).message || error}`);
  } finally {
    loading.value = false;
  }
}

function onConditionChange(widget: DesignWidget, value: any) {
  fireEvent(widget.events, 'change', scope({ value, [widget.field]: value }));
}

function onSearch() {
  void doQuery(true);
}

function onReset() {
  designDoc.value.widgetList.forEach((widget) => {
    if (widget.field) filters[widget.field] = defaultFor(widget);
  });
  activeTreeValue.value = '__ALL__';
  void doQuery(true);
}

function onTreeNodeClick(node: any) {
  const field = designDoc.value.leftTree.field;
  const value = node?.value;
  activeTreeValue.value = value;
  // 分组节点只负责展开/收起，不下发过滤值；否则点「一年级」会拿分组值去匹配班级字段。
  const isGroup =
    Array.isArray(node?.children) &&
    node.children.length > 0 &&
    value !== '__ALL__';
  if (isGroup) {
    fireEvent(
      designDoc.value.leftTree.events,
      'leftTreeChange',
      scope({ value }),
    );
    return;
  }
  if (field) {
    if (value === '__ALL__' || value === '' || value === undefined)
      delete filters[field];
    else filters[field] = value;
  }
  fireEvent(
    designDoc.value.leftTree.events,
    'leftTreeChange',
    scope({ value }),
  );
  void doQuery(true);
}

function onSortChange({
  prop,
  field,
  order,
}: {
  field?: null | string;
  order: null | string;
  prop?: null | string;
}) {
  const sortField = prop || field || '';
  orderBy.value = order && sortField ? sortField : '';
  orderAsc.value = order !== 'desc';
}

function onPageChange(page: number) {
  pageNum.value = page;
  void doQuery(false);
}

function onSizeChange(size: number) {
  pageSize.value = size;
  void doQuery(true);
}

function displayValue(row: Record<string, any>, col: TableColumnDesign) {
  const labels = row._labels as Record<string, any> | undefined;
  if (labels && col.field in labels) return labels[col.field];
  const raw = row[col.field];
  if (col.dictCode) {
    const opt = (dictOptions.value[col.dictCode] || []).find(
      (o) => String(o.value) === String(raw),
    );
    if (opt) return opt.label;
  }
  const type = String(col.widgetType || '');
  if (
    raw !== null &&
    raw !== undefined &&
    raw !== '' &&
    (type.includes('date') || /date|time/i.test(col.field))
  ) {
    const date = dayjs(raw as any);
    if (date.isValid()) {
      return type.includes('datetime')
        ? date.format('YYYY-MM-DD HH:mm:ss')
        : date.format('YYYY-MM-DD');
    }
  }
  return raw ?? '-';
}

function onCellClick(row: Record<string, any>, col: TableColumnDesign) {
  fireEvent(col.events, 'cellClick', scope({ row, value: row[col.field] }));
}

function onOperation(op: FormOperation, row?: Record<string, any>) {
  if (op.type === 3) {
    void exportData();
    return;
  }
  if (op.type === 10) {
    const checked = gridApi.grid?.getCheckboxRecords?.() ?? selectedRows.value;
    if (checked.length === 0) {
      ElMessage.warning('请先勾选要删除的数据');
      return;
    }
    emit('batchDelete', checked);
    return;
  }
  emit('operation', op, row);
}

/** 导出当前查询条件的全部匹配数据（后端分页上限 500），生成带 BOM 的 CSV。 */
async function exportData() {
  const payload = buildFilters();
  loading.value = true;
  try {
    const res = await runQuery({
      formId: props.render.formId,
      filters: payload.filters,
      filterTypes: payload.filterTypes,
      pageNum: 1,
      pageSize: 500,
      orderBy: orderBy.value || designDoc.value.table.orderColumn,
      orderDir: orderAsc.value ? 'asc' : 'desc',
    });
    const columns = visibleColumns.value;
    const csvCell = (value: any) =>
      `"${String(value ?? '').replaceAll('"', '""')}"`;
    const lines = [
      columns.map((c) => csvCell(c.label)).join(','),
      ...(res.rows ?? []).map((row: Record<string, any>) =>
        columns.map((c) => csvCell(displayValue(row, c))).join(','),
      ),
    ];
    const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(props.render.formName || '在线表单').replaceAll(/[\\/:*?"<>|]/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    ElMessage.success(`已导出 ${res.rows?.length ?? 0} 条`);
  } catch (error) {
    ElMessage.error(`导出失败：${(error as Error).message || error}`);
  } finally {
    loading.value = false;
  }
}

function syncGridSelection() {
  selectedRows.value = gridApi.grid?.getCheckboxRecords?.() ?? [];
}

/** 供父组件在删除/保存后刷新当前查询页（保留条件与页码）。 */
function reload(resetPage = false) {
  return doQuery(resetPage);
}

defineExpose({ reload });

function designColumn(column: any): TableColumnDesign | undefined {
  return visibleColumns.value.find((c) => c.field === column?.field);
}

function gridCellText(row: Record<string, any>, column: any) {
  const col = designColumn(column);
  return col ? displayValue(row, col) : (row?.[column?.field] ?? '-');
}

function gridCellStyle(column: any) {
  return styleToObject(designColumn(column)?.styleConfig);
}

function gridCellClick(row: Record<string, any>, column: any) {
  const col = designColumn(column);
  if (col) onCellClick(row, col);
}

const gridOptions = computed<VxeTableGridOptions>(() => {
  const table = designDoc.value.table;
  const columns: any[] = [];
  if (hasBatchDelete.value) columns.push({ type: 'checkbox', width: 44 });
  if (table.showIndex) {
    columns.push({ type: 'seq', title: '#', width: 52, align: 'center' });
  }
  visibleColumns.value.forEach((col, index) => {
    columns.push({
      field: col.field,
      title: col.label,
      width: col.width || undefined,
      minWidth: col.minWidth || undefined,
      align: col.align,
      fixed: col.fixed || undefined,
      sortable: col.sortable,
      treeNode: table.tree && index === 0,
      className: col.className || undefined,
      slots: { default: 'queryCell' },
    });
  });
  if (rowOperations.value.length > 0) {
    columns.push({
      title: '操作',
      width: 150,
      fixed: 'right',
      align: 'center',
      slots: { default: 'queryActions' },
    });
  }
  return {
    border: table.border,
    checkboxConfig: checkboxConfig.value,
    columns,
    data: rows.value,
    height: table.height || 'auto',
    maxHeight: table.maxHeight || undefined,
    pagerConfig: { enabled: false },
    rowConfig: { keyField: 'id' },
    showOverflow: false,
    size: 'small',
    sortConfig: { remote: false, trigger: 'cell' },
    stripe: table.stripe,
    toolbarConfig: { enabled: false },
    treeConfig: treeConfig.value,
  } as VxeTableGridOptions;
});

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {} as VxeTableGridOptions,
});

function itemLabelWidth(widget: DesignWidget) {
  const own = Number(widget.styleConfig?.labelWidth);
  return `${own || designDoc.value.filter.labelWidth}px`;
}

function itemWidth(widget: DesignWidget) {
  const base = Number(widget.itemWidth) || designDoc.value.filter.itemWidth;
  // 日期区间需要同时容纳两个日期输入，沿用普通条件宽度会把日期截断。
  const width = widget.widgetType === 'dateRange' ? Math.max(base, 360) : base;
  return `${width}px`;
}

onMounted(async () => {
  initFilters();
  await nextTick();
  fireEvent(designDoc.value.formEventList, 'afterCreate', scope());
  await doQuery(true);
});
</script>

<template>
  <div class="query-page" :class="{ 'with-tree': isTree }">
    <aside
      v-if="isTree"
      class="query-tree"
      :style="{ width: `${designDoc.leftTree.width}px` }"
    >
      <div class="tree-head">
        <span>{{ designDoc.leftTree.title || '分类' }}</span>
        <span class="tree-count">{{ total }}</span>
      </div>
      <ElInput
        v-if="designDoc.leftTree.showSearch"
        v-model="treeKeyword"
        :placeholder="designDoc.leftTree.searchPlaceholder"
        clearable
        size="small"
        class="tree-search"
      />
      <ElTree
        v-if="filteredTree.length"
        :data="filteredTree"
        :default-expand-all="designDoc.leftTree.defaultExpandAll"
        :expand-on-click-node="false"
        node-key="value"
        :props="{ label: 'label', children: 'children' }"
        highlight-current
        :current-node-key="activeTreeValue"
        class="tree-body"
        @node-click="onTreeNodeClick"
      />
      <div v-else class="tree-empty">未配置树字典</div>
      <div v-if="!designDoc.leftTree.field" class="tree-warn">
        未配置「节点值写入字段」，点击树节点不会过滤数据
      </div>
    </aside>

    <section class="query-main">
      <ElForm
        class="filter-form"
        :label-position="designDoc.filter.labelPosition"
        :label-width="`${designDoc.filter.labelWidth}px`"
        :size="(designDoc.size as any) || 'default'"
        @submit.prevent
        @keyup.enter="onSearch"
      >
        <div
          class="filter-grid"
          :style="{ gap: `${designDoc.filter.gutter}px` }"
        >
          <ElFormItem
            v-for="widget in visibleMain"
            :key="widget.key"
            :label="designDoc.filter.hideLabel ? '' : widget.label"
            :label-width="
              designDoc.filter.hideLabel ? '0px' : itemLabelWidth(widget)
            "
            :style="{
              ...styleToObject(widget.styleConfig),
              width: itemWidth(widget),
            }"
            class="filter-item"
          >
            <RunWidget
              v-model="filters[widget.field]"
              :disabled="conditionDisabled(widget)"
              :options="optionsFor(widget)"
              :widget="widget"
              @change="(value: any) => onConditionChange(widget, value)"
            />
          </ElFormItem>
        </div>

        <div
          v-if="advancedOpen && visibleAdvanced.length"
          class="filter-grid advanced-grid"
          :style="{ gap: `${designDoc.filter.gutter}px` }"
        >
          <ElFormItem
            v-for="widget in visibleAdvanced"
            :key="widget.key"
            :label="designDoc.filter.hideLabel ? '' : widget.label"
            :label-width="
              designDoc.filter.hideLabel ? '0px' : itemLabelWidth(widget)
            "
            :style="{
              ...styleToObject(widget.styleConfig),
              width: itemWidth(widget),
            }"
            class="filter-item"
          >
            <RunWidget
              v-model="filters[widget.field]"
              :disabled="conditionDisabled(widget)"
              :options="optionsFor(widget)"
              :widget="widget"
              @change="(value: any) => onConditionChange(widget, value)"
            />
          </ElFormItem>
        </div>

        <div class="filter-actions">
          <ElButton
            v-if="designDoc.filter.showSearch"
            type="primary"
            @click="onSearch"
          >
            {{ designDoc.filter.searchText }}
          </ElButton>
          <ElButton v-if="designDoc.filter.showReset" @click="onReset">
            {{ designDoc.filter.resetText }}
          </ElButton>
          <ElButton
            v-if="visibleAdvanced.length"
            text
            type="primary"
            @click="advancedOpen = !advancedOpen"
          >
            {{ advancedOpen ? '收起' : `更多条件(${visibleAdvanced.length})` }}
          </ElButton>
        </div>
      </ElForm>

      <div class="table-area">
        <div class="table-toolbar">
          <div class="toolbar-left">
            <ElButton
              v-for="op in topOperations"
              :key="`${op.type}_${op.name}`"
              :type="(op.btnType as any) || 'primary'"
              size="small"
              @click="onOperation(op)"
            >
              {{ op.name }}
            </ElButton>
            <span class="total-text">共 {{ total }} 条</span>
          </div>
          <div class="toolbar-right">
            <span v-if="loading" class="loading-text">查询中…</span>
          </div>
        </div>

        <div
          class="table-wrap"
          :style="styleToObject(designDoc.table.styleConfig)"
        >
          <Grid
            v-loading="loading"
            class="query-grid"
            :grid-options="gridOptions"
            @sort-change="onSortChange"
            @checkbox-change="syncGridSelection"
            @checkbox-all="syncGridSelection"
          >
            <template #queryCell="{ row, column }">
              <span
                class="cell-value"
                :style="gridCellStyle(column)"
                @click="gridCellClick(row, column)"
              >
                {{ gridCellText(row, column) }}
              </span>
            </template>
            <template #queryActions="{ row }">
              <ElButton
                v-for="op in rowOperations"
                :key="`${op.type}_${op.name}`"
                link
                size="small"
                :type="op.type === 2 ? 'danger' : 'primary'"
                @click="onOperation(op, row)"
              >
                {{ op.name }}
              </ElButton>
            </template>
            <template #empty>
              <div class="table-empty">暂无数据</div>
            </template>
          </Grid>
        </div>

        <div v-if="designDoc.table.paged" class="pagination-bar">
          <ElPagination
            :current-page="pageNum"
            :page-size="pageSize"
            :page-sizes="designDoc.table.pageSizes"
            :total="total"
            background
            layout="total, sizes, prev, pager, next, jumper"
            @current-change="onPageChange"
            @size-change="onSizeChange"
          />
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.query-page {
  --el-bg-color: #fff;
  --el-bg-color-overlay: #fff;
  --el-bg-color-page: #fff;
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
  --el-disabled-bg-color: #f5f7fa;
  --el-disabled-text-color: #a8abb2;

  display: flex;
  min-height: 520px;
  overflow: hidden;
  color: #303133;
  color-scheme: light;
  background: #fff;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}

.query-tree {
  flex: none;
  padding: 0 10px 12px;
  background: #fafbfc;
  border-right: 1px solid var(--el-border-color-lighter);
}

.tree-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 6px 10px;
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.tree-count {
  font-size: 10px;
  font-weight: 400;
  color: var(--el-text-color-secondary);
}

.tree-search {
  margin-bottom: 8px;
}

.tree-body {
  background: transparent;
}

.tree-empty {
  padding: 36px 8px;
  font-size: 12px;
  color: #909399;
  text-align: center;
}

.tree-warn {
  padding: 6px;
  margin-top: 8px;
  font-size: 10px;
  line-height: 15px;
  color: #e6a23c;
  background: #fdf6ec;
  border-radius: 4px;
}

.query-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  padding: 14px 18px 10px;
}

.filter-form {
  padding-bottom: 6px;
  border-bottom: 1px dashed var(--el-border-color-lighter);
}

.filter-grid {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
}

.filter-item {
  margin-bottom: 10px;
}

.filter-item :deep(.el-form-item__label) {
  font-size: 12px;
  color: var(--el-text-color-regular);
}

.filter-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  padding-bottom: 10px;
}

.advanced-grid {
  margin-top: 8px;
}

.table-area {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  padding-top: 10px;
}

.table-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.toolbar-left {
  display: flex;
  gap: 8px;
  align-items: center;
}

.total-text {
  margin-left: 4px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.loading-text {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.table-wrap {
  flex: 1;
  min-height: 0;
}

/* 表单运行页固定浅色；vxe-table 会跟随全局 dark 主题，这里局部拉回浅色变量。 */
.query-grid {
  --vxe-ui-font-color: #303133;
  --vxe-ui-font-primary-color: #409eff;
  --vxe-ui-font-lighten-color: #606266;
  --vxe-ui-layout-background-color: #fff;
  --vxe-ui-table-header-background-color: #f8f8f9;
  --vxe-ui-table-row-hover-background-color: #f5f7fa;
  --vxe-ui-table-row-striped-background-color: #fafafa;
  --vxe-ui-table-border-color: #e8eaec;
  --vxe-ui-table-header-font-color: #303133;
  --vxe-ui-table-body-font-color: #303133;
  --vxe-ui-table-footer-background-color: #fff;
  --vxe-ui-input-background-color: #fff;
  --vxe-ui-input-border-color: #dcdfe6;

  background: #fff !important;
}

.query-grid :deep(.vxe-table) {
  color: #303133;
  background: #fff;
}

.query-grid :deep(.vxe-table--body-wrapper),
.query-grid :deep(.vxe-table--main-wrapper),
.query-grid :deep(.vxe-table--fixed-right-wrapper) {
  background: #fff !important;
}

.query-grid :deep(.vxe-table--header-wrapper) {
  background: #f8f8f9 !important;
}

.query-grid :deep(.vxe-table--header),
.query-grid :deep(.vxe-table--body) {
  color: #303133 !important;
}

.query-grid :deep(.vxe-body--row) {
  background: #fff;
}

.query-grid :deep(.vxe-body--row.row--stripe) {
  background: #fafafa;
}

.query-grid :deep(.vxe-table--border-line) {
  border-color: #e8eaec;
}

.query-grid :deep(.vxe-table--body-wrapper) {
  scrollbar-color: #c0c4cc #f5f7fa;
  scrollbar-width: thin;
}

.query-grid :deep(.vxe-table--body-wrapper)::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.query-grid :deep(.vxe-table--body-wrapper)::-webkit-scrollbar-thumb {
  background: #c0c4cc;
  border-radius: 4px;
}

.query-grid :deep(.vxe-table--body-wrapper)::-webkit-scrollbar-track {
  background: #f5f7fa;
}

.cell-value {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.table-empty {
  padding: 40px 0;
  color: var(--el-text-color-secondary);
}

.pagination-bar {
  display: flex;
  justify-content: flex-end;
  padding-top: 10px;
}

@media (max-width: 1200px) {
  .query-page.with-tree {
    flex-direction: column;
  }

  .query-tree {
    width: 100% !important;
    border-right: none;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }
}
</style>
