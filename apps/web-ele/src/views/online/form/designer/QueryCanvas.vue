<script lang="ts" setup>
import type { DesignWidget, FormDesignDoc, TableColumnDesign } from './types';

import { computed, ref, watch } from 'vue';

import {
  ElButton,
  ElInput,
  ElMessage,
  ElPagination,
  ElTree,
} from 'element-plus';

import RunWidget from './RunWidget.vue';
import { styleToObject } from './script';

const props = defineProps<{
  dicts?: Record<
    string,
    Array<{ label: string; value: any; parentValue?: string }>
  >;
  doc: FormDesignDoc;
  selectedKey?: string;
  selectedKind?: string;
}>();

const emit = defineEmits<{
  addColumn: [field: string];
  addCondition: [];
  addWidget: [kind: string];
  dropField: [field: string, target: 'column' | 'condition'];
  duplicateCondition: [key: string];
  moveCondition: [key: string, delta: number];
  removeCondition: [key: string];
  select: [kind: string, key?: string];
  toggleAdvanced: [];
}>();

const advancedOpen = ref(false);
const treeKeyword = ref('');
const activeTreeNode = ref<any>(null);
const draggedKey = ref('');

watch(
  () => props.doc.viewId,
  () => {
    advancedOpen.value = false;
    treeKeyword.value = '';
    activeTreeNode.value = null;
  },
);

const mainConditions = computed(() =>
  props.doc.widgetList.filter((item) => !item.advanced),
);
const advancedConditions = computed(() =>
  props.doc.widgetList.filter((item) => item.advanced),
);
const hiddenCount = computed(
  () => props.doc.widgetList.filter((item) => item.visible === false).length,
);
const scriptCount = computed(
  () =>
    props.doc.widgetList.filter((item) =>
      item.events?.some((e) => e.enabled !== false && e.script),
    ).length,
);

const treeData = computed(() => {
  const code = props.doc.leftTree.dictCode;
  const flat = code ? props.dicts?.[code] || [] : [];
  if (flat.length === 0) return [];
  const nodes = new Map<string, any>();
  flat.forEach((opt) => nodes.set(String(opt.value), { ...opt, children: [] }));
  const roots: any[] = [];
  flat.forEach((opt) => {
    const node = nodes.get(String(opt.value));
    const parent = opt.parentValue ? nodes.get(String(opt.parentValue)) : null;
    if (parent) parent.children.push(node);
    else roots.push(node);
  });
  return roots;
});

const filteredTree = computed(() => {
  const keyword = treeKeyword.value.trim();
  if (!keyword) return treeData.value;
  const filterNodes = (nodes: any[]): any[] =>
    nodes
      .map((node) => {
        const children = filterNodes(node.children || []);
        const hit = String(node.label).includes(keyword);
        if (hit || children.length > 0) return { ...node, children };
        return null;
      })
      .filter(Boolean);
  return filterNodes(treeData.value);
});

function optionsOf(widget: DesignWidget) {
  if (widget.options?.length) return widget.options;
  if (widget.dictCode) return props.dicts?.[widget.dictCode] || [];
  return [];
}

const previewRows = computed(() =>
  [1, 2, 3].map((row) => {
    const data: Record<string, any> = { __level: row - 1 };
    props.doc.table.columns.forEach((col) => {
      if (col.dictCode) {
        const opts = props.dicts?.[col.dictCode] || [];
        data[col.field] = opts[row - 1]?.label || `示例${row}`;
      } else if (col.widgetType.includes('date')) {
        data[col.field] = `2026-11-${String(10 + row).padStart(2, '0')}`;
      } else if (col.widgetType === 'number') {
        data[col.field] = row * 1280;
      } else {
        data[col.field] = `${col.label}示例${row}`;
      }
    });
    return data;
  }),
);

function itemWidth(widget: DesignWidget) {
  const base = Number(widget.itemWidth) || props.doc.filter.itemWidth;
  return widget.widgetType === 'dateRange' ? Math.max(base, 360) : base;
}

function labelWidth(widget: DesignWidget) {
  return Number(widget.styleConfig?.labelWidth) || props.doc.filter.labelWidth;
}

function conditionStyle(widget: DesignWidget) {
  return {
    ...styleToObject(widget.styleConfig),
    width: `${itemWidth(widget)}px`,
  };
}

function onDrop(event: DragEvent, target: 'column' | 'condition') {
  event.preventDefault();
  const kind = event.dataTransfer?.getData('text/lunar-widget');
  if (kind && target === 'condition') {
    emit('addWidget', kind);
    return;
  }
  const field =
    event.dataTransfer?.getData('text/lunar-field') ||
    event.dataTransfer?.getData('text/plain');
  if (field) emit('dropField', field, target);
}

function startDrag(key: string, event: DragEvent) {
  draggedKey.value = key;
  event.dataTransfer?.setData('text/plain', key);
}

function dropReorder(key: string) {
  if (draggedKey.value === key) return;
  const from = props.doc.widgetList.findIndex(
    (w) => w.key === draggedKey.value,
  );
  const to = props.doc.widgetList.findIndex((w) => w.key === key);
  if (from === -1 || to === -1) return;
  const item = props.doc.widgetList.splice(from, 1)[0];
  props.doc.widgetList.splice(to, 0, item!);
  draggedKey.value = '';
}

function columnWidth(col: TableColumnDesign) {
  return col.width ? `${col.width}px` : undefined;
}

function selectCondition(widget: DesignWidget) {
  emit('select', 'condition', widget.key);
}

function selectColumn(col: TableColumnDesign) {
  emit('select', 'column', col.key);
}

function toggleAdvanced() {
  advancedOpen.value = !advancedOpen.value;
  emit('toggleAdvanced');
}

function showTip() {
  ElMessage.info('设计态为静态预览，运行期可输入、查询、翻页');
}

function treeNodeClick(node: any) {
  activeTreeNode.value = node;
}
</script>

<template>
  <div class="query-canvas" @click="emit('select', 'form')">
    <div class="canvas-page">
      <!-- 左树右表 -->
      <aside
        v-if="doc.layout === 'tree'"
        class="canvas-tree"
        :style="{ width: `${doc.leftTree.width}px` }"
      >
        <div class="tree-head" @click.stop="emit('select', 'leftTree')">
          <span class="tree-title">{{ doc.leftTree.title || '分类' }}</span>
          <span class="tree-gear">⚙</span>
        </div>
        <ElInput
          v-if="doc.leftTree.showSearch"
          v-model="treeKeyword"
          :placeholder="doc.leftTree.searchPlaceholder"
          clearable
          size="small"
          class="tree-search"
          @click.stop
        />
        <div v-if="!doc.leftTree.dictCode" class="tree-empty-hint">
          未绑定字典，运行期不显示树节点
        </div>
        <div v-else-if="!treeData.length" class="tree-empty-hint">
          字典加载中，或字典没有可展示的节点
        </div>
        <ElTree
          :data="filteredTree"
          :default-expand-all="doc.leftTree.defaultExpandAll"
          :expand-on-click-node="false"
          node-key="value"
          :props="{ label: 'label', children: 'children' }"
          highlight-current
          class="tree-body"
          @node-click="treeNodeClick"
          @click.stop
        />
      </aside>

      <section class="canvas-main">
        <!-- 条件区 -->
        <div
          class="filter-section"
          @click.stop="emit('select', 'form')"
          @dragover.prevent
          @drop.prevent="onDrop($event, 'condition')"
        >
          <div class="filter-hint">
            <span>查询条件区</span>
            <span class="filter-meta">
              {{ doc.widgetList.length }} 个条件 · 每项
              {{ doc.filter.itemWidth }}px · 标签 {{ doc.filter.labelWidth }}px
              <span v-if="hiddenCount">· {{ hiddenCount }} 个默认隐藏</span>
              <span v-if="scriptCount">· {{ scriptCount }} 个带脚本</span>
            </span>
          </div>

          <div
            v-if="!doc.filter.hideLabel"
            class="filter-grid"
            :class="{ 'is-top-label': doc.filter.labelPosition === 'top' }"
            :style="{ gap: `${doc.filter.gutter}px` }"
          >
            <div
              v-for="widget in mainConditions"
              :key="widget.key"
              class="filter-card"
              :class="{
                'is-advanced': widget.advanced,
                'is-hidden': widget.visible === false,
                'is-selected':
                  selectedKind === 'condition' && selectedKey === widget.key,
              }"
              :style="conditionStyle(widget)"
              draggable="true"
              @click.stop="selectCondition(widget)"
              @dragstart="startDrag(widget.key, $event)"
              @dragover.prevent
              @drop.stop="dropReorder(widget.key)"
            >
              <label
                v-if="doc.filter.labelPosition !== 'top'"
                class="filter-label"
                :style="{ width: `${labelWidth(widget)}px` }"
              >
                {{ widget.label }}
                <i v-if="widget.required" class="required">*</i>
              </label>
              <div class="filter-control">
                <RunWidget
                  :model-value="widget.defaultValue"
                  :options="optionsOf(widget)"
                  :widget="widget"
                  preview
                />
                <label
                  v-if="doc.filter.labelPosition === 'top'"
                  class="top-label"
                >
                  {{ widget.label }}
                </label>
              </div>
              <div class="card-badges">
                <span v-if="widget.advanced" class="badge badge-advanced">高级</span>
                <span v-if="widget.visible === false" class="badge badge-hidden">隐藏</span>
                <span
                  v-if="
                    widget.events?.some(
                      (e) => e.eventType === 'visible' && e.script,
                    )
                  "
                  class="badge badge-script"
                  >显隐脚本</span>
                <span
                  v-if="widget.dictCode"
                  class="badge badge-dict"
                  :title="widget.dictCode"
                  >字典</span>
              </div>
              <div class="card-actions">
                <button
                  title="上移"
                  @click.stop="emit('moveCondition', widget.key, -1)"
                >
                  ↑
                </button>
                <button
                  title="下移"
                  @click.stop="emit('moveCondition', widget.key, 1)"
                >
                  ↓
                </button>
                <button
                  title="复制"
                  @click.stop="emit('duplicateCondition', widget.key)"
                >
                  ⧉
                </button>
                <button
                  title="删除"
                  class="danger"
                  @click.stop="emit('removeCondition', widget.key)"
                >
                  ×
                </button>
              </div>
            </div>

            <div
              class="filter-card add-card"
              @click.stop="emit('addCondition')"
            >
              <span class="add-plus">＋</span>
              <span>拖入字段 / 添加查询条件</span>
            </div>
          </div>

          <div
            v-else
            class="filter-grid compact"
            :style="{ gap: `${doc.filter.gutter}px` }"
          >
            <div
              v-for="widget in mainConditions"
              :key="widget.key"
              class="filter-card compact-card"
              :style="{ width: `${itemWidth(widget)}px` }"
              @click.stop="selectCondition(widget)"
            >
              <RunWidget
                :model-value="widget.defaultValue"
                :options="optionsOf(widget)"
                :widget="widget"
                preview
              />
            </div>
            <div
              class="filter-card add-card"
              @click.stop="emit('addCondition')"
            >
              ＋
            </div>
          </div>

          <div v-if="advancedConditions.length" class="advanced-bar">
            <button class="link-btn" @click.stop="toggleAdvanced">
              {{
                advancedOpen
                  ? '收起高级条件'
                  : `展开更多条件（${advancedConditions.length}）`
              }}
              <span>{{ advancedOpen ? '▴' : '▾' }}</span>
            </button>
          </div>

          <div
            v-if="advancedOpen"
            class="filter-grid advanced-grid"
            :style="{ gap: `${doc.filter.gutter}px` }"
          >
            <div
              v-for="widget in advancedConditions"
              :key="widget.key"
              class="filter-card"
              :class="{
                'is-hidden': widget.visible === false,
                'is-selected':
                  selectedKind === 'condition' && selectedKey === widget.key,
              }"
              :style="conditionStyle(widget)"
              @click.stop="selectCondition(widget)"
            >
              <label
                v-if="doc.filter.labelPosition !== 'top'"
                class="filter-label"
                :style="{ width: `${labelWidth(widget)}px` }"
                >{{ widget.label }}</label>
              <div class="filter-control">
                <RunWidget
                  :model-value="widget.defaultValue"
                  :options="optionsOf(widget)"
                  :widget="widget"
                  preview
                />
              </div>
              <div class="card-actions">
                <button @click.stop="emit('moveCondition', widget.key, -1)">
                  ↑
                </button>
                <button @click.stop="emit('moveCondition', widget.key, 1)">
                  ↓
                </button>
                <button
                  class="danger"
                  @click.stop="emit('removeCondition', widget.key)"
                >
                  ×
                </button>
              </div>
            </div>
          </div>

          <div
            v-if="doc.filter.showSearch || doc.filter.showReset"
            class="filter-actions"
          >
            <ElButton type="primary" size="small" @click.stop="showTip">
              {{ doc.filter.searchText }}
            </ElButton>
            <ElButton size="small" @click.stop="showTip">
{{
              doc.filter.resetText
            }}
</ElButton>
            <span class="filter-tip">运行期按 Enter 也可查询</span>
          </div>
        </div>

        <!-- 表格区 -->
        <div
          class="table-section"
          :class="{ 'is-selected': selectedKind === 'table' }"
          @click.stop="emit('select', 'table')"
          @dragover.prevent
          @drop.prevent="onDrop($event, 'column')"
        >
          <div class="table-toolbar">
            <div class="table-title">
              <span class="table-icon">▤</span>
              <span>数据列表</span>
              <span class="table-meta">
                {{
                  doc.table.columns.filter((c) => c.show !== false).length
                }}
                列 ·
                {{
                  doc.table.paged ? `每页 ${doc.table.pageSize} 条` : '不分页'
                }}
                <span v-if="doc.table.tree" class="tree-badge">
                  树形 · pid={{ doc.table.pidColumn || '未配置' }}
                </span>
              </span>
            </div>
            <div class="table-ops" @click.stop>
              <ElButton
                v-if="doc.table.operationList.some((o) => o.type === 0)"
                size="small"
                type="primary"
              >
                新建
              </ElButton>
              <ElButton
                v-if="doc.table.operationList.some((o) => o.type === 3)"
                size="small"
                >
导出
</ElButton>
              <ElButton
                v-if="doc.table.operationList.some((o) => o.type === 10)"
                size="small"
                >
批量删除
</ElButton>
              <span v-if="!doc.table.operationList.length" class="ops-empty">操作按钮待配置</span>
              <button
                class="column-add"
                title="从左侧字段拖入列"
                @click.stop="emit('addColumn', '')"
              >
                ＋ 列
              </button>
            </div>
          </div>

          <div class="design-table-wrap">
            <table class="design-table">
              <thead>
                <tr>
                  <th v-if="doc.table.showIndex" class="index-col">#</th>
                  <th
                    v-for="col in doc.table.columns.filter(
                      (c) => c.show !== false,
                    )"
                    :key="col.key"
                    :class="[
                      col.className,
                      {
                        'col-selected':
                          selectedKind === 'column' && selectedKey === col.key,
                        'col-script': col.styleConfig?.color,
                      },
                    ]"
                    :style="{
                      ...styleToObject(col.styleConfig),
                      width: columnWidth(col),
                      textAlign: col.align,
                    }"
                    @click.stop="selectColumn(col)"
                  >
                    <span>{{ col.label }}</span>
                    <span v-if="col.sortable" class="sort-mark">⇅</span>
                    <span v-if="col.dictCode" class="dict-mark">▦</span>
                  </th>
                  <th class="action-col">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, index) in previewRows" :key="index">
                  <td v-if="doc.table.showIndex" class="index-col">
                    {{ index + 1 }}
                  </td>
                  <td
                    v-for="(col, colIndex) in doc.table.columns.filter(
                      (c) => c.show !== false,
                    )"
                    :key="col.key"
                    :style="{ textAlign: col.align, width: columnWidth(col) }"
                  >
                    <span
                      v-if="doc.table.tree && colIndex === 0"
                      class="tree-preview-node"
                      :style="{ paddingLeft: `${(row.__level || 0) * 14}px` }"
                    >
                      <i v-if="row.__level < 2" class="tree-preview-caret">▾</i>
                      <span class="cell-preview">{{ row[col.field] }}</span>
                    </span>
                    <span v-else class="cell-preview">{{
                      row[col.field]
                    }}</span>
                  </td>
                  <td class="action-col">
                    <span
                      v-for="op in doc.table.operationList.filter(
                        (o) => o.rowOperation,
                      )"
                      :key="op.type"
                      class="row-op"
                    >
                      {{ op.name || '操作' }}
                    </span>
                    <span
                      v-if="
                        !doc.table.operationList.some((o) => o.rowOperation)
                      "
                      class="row-op muted"
                      >详情</span>
                  </td>
                </tr>
              </tbody>
            </table>
            <div v-if="!doc.table.columns.length" class="table-empty">
              <p>还没有列表列</p>
              <ElButton size="small" @click.stop="emit('addColumn', '')">
从字段面板添加列
</ElButton>
            </div>
          </div>

          <div class="pagination-bar" @click.stop>
            <template v-if="doc.table.paged">
              <ElPagination
                :page-size="doc.table.pageSize"
                :page-sizes="doc.table.pageSizes"
                :total="128"
                layout="total, sizes, prev, pager, next"
                small
              />
            </template>
            <span v-else class="no-page">不分页 · 由表格高度滚动</span>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.query-canvas {
  min-height: 100%;
  padding: 16px;
  background: #f3f5f9;
}

.canvas-page {
  display: flex;
  min-height: 620px;
  overflow: hidden;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgb(0 0 0 / 4%);
}

.canvas-tree {
  flex: none;
  padding: 0 10px 12px;
  background: #fafbfc;
  border-right: 1px solid #ebeef5;
}

.tree-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 6px 10px;
  cursor: pointer;
}

.tree-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.tree-gear {
  color: #909399;
}

.tree-search {
  margin-bottom: 8px;
}

.tree-empty-hint {
  padding: 4px 6px 8px;
  font-size: 11px;
  color: #c0c4cc;
}

.tree-body {
  background: transparent;
}

.canvas-main {
  flex: 1;
  min-width: 0;
}

.filter-section {
  position: relative;
  padding: 14px 18px 10px;
  border-bottom: 1px solid #ebeef5;
}

.filter-hint {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  font-size: 13px;
  font-weight: 600;
  color: #303133;
}

.filter-meta {
  font-size: 11px;
  font-weight: 400;
  color: #909399;
}

.filter-grid {
  display: flex;
  flex-wrap: wrap;
}

.filter-card {
  position: relative;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  max-width: 100%;
  min-height: 32px;
  padding: 4px 8px 4px 10px;
  cursor: pointer;
  border: 1px solid transparent;
  border-radius: 4px;
  transition:
    border-color 0.15s,
    background 0.15s;
}

.filter-card:hover {
  background: #f5f7fa;
  border-color: #dcdfe6;
}

.filter-card.is-selected {
  background: #ecf5ff;
  border-color: #409eff;
  box-shadow: 0 0 0 2px rgb(64 158 255 / 12%);
}

.filter-card.is-hidden {
  opacity: 0.55;
}

.filter-label {
  flex: none;
  padding-right: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  color: #606266;
  text-align: right;
  white-space: nowrap;
}

.filter-label .required {
  font-style: normal;
  color: #f56c6c;
}

.filter-control {
  flex: 1;
  min-width: 0;
}

/* 设计态条件控件不接收鼠标，点击输入框也会选中整张条件卡。 */
.filter-card .lunar-run-widget {
  pointer-events: none;
}

.top-label {
  display: block;
  margin-top: 2px;
  font-size: 11px;
  color: #909399;
}

.card-badges {
  position: absolute;
  top: -8px;
  left: 4px;
  display: flex;
  gap: 2px;
  pointer-events: none;
}

.badge {
  padding: 0 3px;
  font-size: 9px;
  line-height: 13px;
  border-radius: 2px;
}

.badge-advanced {
  color: #b88230;
  background: #fdf6ec;
  border: 1px solid #f5dab1;
}

.badge-hidden {
  color: #909399;
  background: #f4f4f5;
  border: 1px solid #e9e9eb;
}

.badge-script {
  color: #6f42c1;
  background: #f5f0ff;
  border: 1px solid #d9c8ff;
}

.badge-dict {
  color: #409eff;
  background: #ecf5ff;
  border: 1px solid #b3d8ff;
}

.card-actions {
  position: absolute;
  top: -10px;
  right: 2px;
  display: none;
  gap: 1px;
  padding: 1px 2px;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 3px;
  box-shadow: 0 2px 6px rgb(0 0 0 / 8%);
}

.filter-card:hover .card-actions {
  display: flex;
}

.card-actions button {
  width: 18px;
  height: 18px;
  padding: 0;
  font-size: 11px;
  line-height: 16px;
  color: #606266;
  cursor: pointer;
  background: none;
  border: none;
  border-radius: 2px;
}

.card-actions button:hover {
  color: #409eff;
  background: #ecf5ff;
}

.card-actions .danger:hover {
  color: #f56c6c;
  background: #fef0f0;
}

.add-card {
  justify-content: center;
  width: 180px;
  font-size: 12px;
  color: #909399;
  background: #fafafa;
  border: 1px dashed #dcdfe6;
}

.add-card:hover {
  color: #409eff;
  background: #f0f7ff;
  border-color: #a0cfff;
}

.add-plus {
  margin-right: 4px;
  font-size: 14px;
}

.compact-card {
  padding: 0;
  border: none;
}

.advanced-bar {
  margin-top: 6px;
  text-align: center;
}

.link-btn {
  font-size: 12px;
  color: #409eff;
  cursor: pointer;
  background: none;
  border: none;
}

.advanced-grid {
  padding-top: 8px;
  margin-top: 8px;
  border-top: 1px dashed #ebeef5;
}

.filter-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: flex-end;
  padding-top: 10px;
  margin-top: 10px;
  border-top: 1px dashed #ebeef5;
}

.filter-tip {
  font-size: 11px;
  color: #c0c4cc;
}

.table-section {
  padding: 12px 18px 8px;
}

.table-section.is-selected {
  background: #f7fbff;
}

.table-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.table-title {
  display: flex;
  gap: 6px;
  align-items: center;
  font-size: 13px;
  font-weight: 600;
  color: #303133;
}

.table-icon {
  color: #409eff;
}

.table-meta {
  font-size: 11px;
  font-weight: 400;
  color: #909399;
}

.tree-badge {
  display: inline-block;
  padding: 1px 6px;
  margin-left: 6px;
  font-size: 10px;
  color: #337ecc;
  background: #ecf5ff;
  border-radius: 8px;
}

.table-ops {
  display: flex;
  gap: 6px;
  align-items: center;
}

.ops-empty {
  font-size: 11px;
  color: #c0c4cc;
}

.column-add {
  padding: 2px 8px;
  font-size: 11px;
  color: #409eff;
  cursor: pointer;
  background: none;
  border: 1px dashed #b3d8ff;
  border-radius: 3px;
}

.column-add:hover {
  background: #ecf5ff;
}

.design-table-wrap {
  width: 100%;
  overflow: auto;
  border: 1px solid #ebeef5;
  border-radius: 4px;
}

.design-table {
  width: max-content;
  min-width: 100%;
  table-layout: auto;
  border-collapse: collapse;
}

.design-table th {
  min-width: 76px;
  padding: 9px 10px;
  font-size: 12px;
  font-weight: 600;
  color: #303133 !important;
  text-align: left;
  white-space: nowrap;
  cursor: pointer;
  background: #fafafa !important;
  border-right: 1px solid #f2f3f5;
  border-bottom: 1px solid #ebeef5;
}

.design-table th:hover {
  background: #f0f7ff;
}

.design-table th.col-selected {
  outline: 1px solid #409eff;
  outline-offset: -1px;
  background: #ecf5ff;
}

.design-table td {
  min-width: 76px;
  padding: 8px 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  color: #606266;
  white-space: nowrap;
  border-right: 1px solid #f2f3f5;
  border-bottom: 1px solid #f2f3f5;
}

.index-col {
  width: 32px;
  min-width: 32px;
  color: #909399;
  text-align: center;
}

.action-col {
  width: 92px;
  min-width: 92px;
  white-space: nowrap;
}

.sort-mark,
.dict-mark {
  margin-left: 3px;
  font-size: 10px;
  color: #a8abb2;
}

.cell-preview {
  color: #909399;
}

.tree-preview-node {
  display: inline-flex;
  gap: 4px;
  align-items: center;
}

.tree-preview-caret {
  font-size: 10px;
  font-style: normal;
  color: #909399;
}

.row-op {
  margin-right: 8px;
  font-size: 11px;
  color: #409eff;
}

.row-op.muted {
  color: #c0c4cc;
}

.table-empty {
  padding: 36px 0;
  color: #909399;
  text-align: center;
}

.pagination-bar {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
}

.no-page {
  font-size: 11px;
  color: #909399;
}
</style>
