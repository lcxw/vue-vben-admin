<script lang="ts" setup>
import type {
  DesignWidget,
  FormDesignDoc,
  TableColumnDesign,
  WidgetKind,
} from './types';

import type {
  FormFieldModel,
  FormOperation,
  OnlineDictVO,
} from '#/api/online/types';

import { computed } from 'vue';

import {
  ElCollapse,
  ElCollapseItem,
  ElForm,
  ElFormItem,
  ElInput,
  ElInputNumber,
  ElOption,
  ElRadioButton,
  ElRadioGroup,
  ElSelect,
  ElSwitch,
} from 'element-plus';

import { FILTER_TYPE_OPTIONS, WIDGET_CATALOG } from './types';

const props = defineProps<{
  columns: FormFieldModel[];
  dicts: OnlineDictVO[];
  doc: FormDesignDoc;
  selection: { key?: string; kind: string };
}>();

/** 表格操作按钮：类型与橙单 operation.type 对齐。 */
const OPERATION_TYPES = [
  { label: '新建（顶部）', value: 0, row: false, name: '新建' },
  { label: '编辑（行）', value: 1, row: true, name: '编辑' },
  { label: '删除（行）', value: 2, row: true, name: '删除' },
  { label: '批量删除（顶部）', value: 10, row: false, name: '批量删除' },
  { label: '详情（行）', value: 20, row: true, name: '详情' },
  { label: '导出（顶部）', value: 3, row: false, name: '导出' },
] as const;

const isQuery = computed(() => [1, 2].includes(props.doc.viewType));

const widget = computed<DesignWidget | undefined>(() =>
  props.selection.kind === 'condition'
    ? props.doc.widgetList.find((w) => w.key === props.selection.key)
    : undefined,
);
const column = computed<TableColumnDesign | undefined>(() =>
  props.selection.kind === 'column'
    ? props.doc.table.columns.find((c) => c.key === props.selection.key)
    : undefined,
);

const widgetKinds = computed(() => {
  const seen = new Set<string>();
  return WIDGET_CATALOG.filter((item) => {
    if (seen.has(item.kind)) return false;
    seen.add(item.kind);
    return true;
  });
});

const fieldOptions = computed(() =>
  props.columns.map((c) => ({
    label: `${c.label || c.fieldKey}（${c.fieldKey}）`,
    value: c.fieldKey,
  })),
);

const dictOptions = computed(() =>
  props.dicts.map((d) => ({
    label: `${d.dictName}（${d.dictCode}）`,
    value: d.dictCode,
  })),
);

const columnOptions = computed(() =>
  props.doc.table.columns.map((c) => ({ label: c.label, value: c.field })),
);

function applyField(field: string) {
  if (!widget.value) return;
  const model = props.columns.find(
    (c) => c.fieldKey === field || c.column === field,
  );
  widget.value.field = field;
  widget.value.column = model?.column || field;
  if (model) {
    widget.value.label = model.label || field;
    if (model.dictCode) {
      widget.value.dictCode = model.dictCode;
      if (['dictSelect', 'input', 'select'].includes(widget.value.widgetType)) {
        widget.value.widgetType = 'dictSelect';
      }
    }
  }
}

function applyWidgetType(kind: WidgetKind) {
  if (!widget.value) return;
  widget.value.widgetType = kind;
  if (kind === 'dateRange' || kind === 'numberRange')
    widget.value.filterType = 3;
  else if (kind === 'input' || kind === 'textarea') widget.value.filterType = 2;
  else widget.value.filterType = 1;
  if (kind === 'dateRange' && !widget.value.props.rangeType) {
    widget.value.props.rangeType = 'daterange';
  }
}

function onDictChange(code?: string) {
  if (!widget.value) return;
  const w = widget.value;
  if (code) {
    // 绑定字典后默认切换成下拉，避免出现“有字典却还是文本框”的割裂配置。
    if (
      !w.widgetType ||
      ['dictSelect', 'input', 'select'].includes(w.widgetType)
    ) {
      w.widgetType = w.props?.tree ? 'tree' : 'select';
    }
    if (w.filterType === 2 || w.filterType === 3) {
      w.filterType = w.dictMultiple ? 4 : 1;
    }
  } else if (w.widgetType === 'dictSelect') {
    w.widgetType = 'input';
  }
}

function setLayout(layout: 'flat' | 'tree') {
  props.doc.layout = layout;
  props.doc.leftTree.enabled = layout === 'tree';
}

function onLayoutChange(value: any) {
  setLayout(value === 'tree' ? 'tree' : 'flat');
}

function onMultipleChange(value: any) {
  if (!widget.value) return;
  widget.value.dictMultiple = Boolean(value);
  if (value) widget.value.filterType = 4;
}

/** 过滤方式与控件形态保持一致，避免「区间过滤」配了单个日期这种运行时对不上的组合。 */
function onFilterTypeChange(value: number) {
  if (!widget.value) return;
  if (value === 3) {
    if (widget.value.widgetType === 'date')
      widget.value.widgetType = 'dateRange';
    if (widget.value.widgetType === 'number')
      widget.value.widgetType = 'numberRange';
    if (
      widget.value.widgetType === 'dateRange' &&
      !widget.value.props.rangeType
    ) {
      widget.value.props.rangeType = 'daterange';
    }
  } else if (widget.value.widgetType === 'dateRange') {
    widget.value.widgetType = 'date';
  } else if (widget.value.widgetType === 'numberRange') {
    widget.value.widgetType = 'number';
  }
  if (
    value === 4 &&
    (widget.value.widgetType === 'select' ||
      widget.value.widgetType === 'dictSelect')
  ) {
    widget.value.dictMultiple = true;
  }
}

function updateOptions(text: string) {
  if (!widget.value) return;
  try {
    widget.value.options = JSON.parse(text || '[]');
  } catch {
    // 非法 JSON 不写回，等用户继续编辑
  }
}

function syncTablePageSizes(text: string) {
  props.doc.table.pageSizes = text
    .split(/[,，\s]+/)
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function pageSizesText() {
  return props.doc.table.pageSizes.join(', ');
}

function updatePageSizes(value: string) {
  syncTablePageSizes(value);
}

let opSeed = 0;
function addTableOp() {
  opSeed += 1;
  const existing = new Set(props.doc.table.operationList.map((o) => o.type));
  const def =
    OPERATION_TYPES.find((t) => !existing.has(t.value)) || OPERATION_TYPES[0];
  const op: FormOperation = {
    type: def.value,
    name: def.name,
    rowOperation: def.row,
    enabled: true,
    btnType: def.value === 2 ? 'danger' : 'primary',
    showOrder: props.doc.table.operationList.length + opSeed,
  };
  props.doc.table.operationList.push(op);
}

function changeOpType(op: FormOperation, type: number) {
  const def = OPERATION_TYPES.find((t) => t.value === type);
  if (!def) return;
  op.type = type;
  op.rowOperation = def.row;
  op.name = def.name;
  op.btnType = type === 2 ? 'danger' : 'primary';
}

function moveTableOp(index: number, delta: number) {
  const list = props.doc.table.operationList;
  const to = index + delta;
  if (to < 0 || to >= list.length) return;
  const [item] = list.splice(index, 1);
  if (item) list.splice(to, 0, item);
}

function removeTableOp(index: number) {
  props.doc.table.operationList.splice(index, 1);
}
</script>

<template>
  <div class="property-panel">
    <!-- 查询条件 -->
    <template v-if="widget">
      <div class="panel-head">
        <span class="panel-type">查询条件</span>
        <span class="panel-title">{{ widget.label || widget.field }}</span>
      </div>

      <ElCollapse :model-value="['basic', 'query', 'data']">
        <ElCollapseItem name="basic" title="基础属性">
          <ElForm label-position="top" size="small" class="prop-form">
            <ElFormItem label="显示名称">
              <ElInput v-model="widget.label" />
            </ElFormItem>
            <ElFormItem label="绑定字段">
              <ElSelect
                :model-value="widget.field"
                filterable
                placeholder="选择数据列"
                @change="applyField"
              >
                <ElOption
                  v-for="opt in fieldOptions"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </ElSelect>
            </ElFormItem>
            <ElFormItem label="控件类型">
              <ElSelect
                :model-value="widget.widgetType"
                @change="applyWidgetType"
              >
                <ElOption
                  v-for="item in widgetKinds"
                  :key="item.kind"
                  :label="item.label"
                  :value="item.kind"
                />
              </ElSelect>
            </ElFormItem>
            <ElFormItem label="占位提示">
              <ElInput
                v-model="widget.placeholder"
                placeholder="请输入/请选择"
              />
            </ElFormItem>
            <div class="switch-row">
              <span>必填标记</span>
              <ElSwitch v-model="widget.required" size="small" />
            </div>
            <div class="switch-row">
              <span>默认展示</span>
              <ElSwitch v-model="widget.visible" size="small" />
            </div>
            <div class="switch-row">
              <span>折叠到「更多条件」</span>
              <ElSwitch v-model="widget.advanced" size="small" />
            </div>
          </ElForm>
        </ElCollapseItem>

        <ElCollapseItem v-if="isQuery" name="query" title="查询行为">
          <ElForm label-position="top" size="small" class="prop-form">
            <ElFormItem label="过滤方式">
              <ElSelect
                v-model="widget.filterType"
                @change="onFilterTypeChange"
              >
                <ElOption
                  v-for="opt in FILTER_TYPE_OPTIONS"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                >
                  <div class="filter-option">
                    <span>{{ opt.label }}</span>
                    <small>{{ opt.desc }}</small>
                  </div>
                </ElOption>
              </ElSelect>
              <div class="field-tip">
                {{
                  FILTER_TYPE_OPTIONS.find(
                    (o) => o.value === widget?.filterType,
                  )?.desc
                }}
              </div>
            </ElFormItem>
            <ElFormItem label="条件项宽度（0 跟随全局）">
              <ElInputNumber
                v-model="widget.itemWidth"
                :min="0"
                :max="800"
                :step="20"
                controls-position="right"
                class="w-full"
              />
            </ElFormItem>
            <ElFormItem label="默认值">
              <ElInput
                v-model="widget.defaultValue"
                placeholder="运行期初始值"
              />
            </ElFormItem>
            <ElFormItem
              v-if="widget.widgetType.includes('date')"
              label="日期类型"
            >
              <ElSelect v-model="widget.props.dateType">
                <ElOption label="日期" value="date" />
                <ElOption label="日期时间" value="datetime" />
                <ElOption label="月份" value="month" />
              </ElSelect>
            </ElFormItem>
          </ElForm>
        </ElCollapseItem>

        <ElCollapseItem name="data" title="数据与字典">
          <ElForm label-position="top" size="small" class="prop-form">
            <ElFormItem label="绑定字典">
              <ElSelect
                v-model="widget.dictCode"
                clearable
                filterable
                placeholder="不绑定则使用字段选项"
                @change="onDictChange"
              >
                <ElOption
                  v-for="opt in dictOptions"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </ElSelect>
            </ElFormItem>
            <div class="switch-row">
              <span>多选（IN 查询）</span>
              <ElSwitch
                v-model="widget.dictMultiple"
                size="small"
                @change="onMultipleChange"
              />
            </div>
            <div class="switch-row">
              <span>字典树形数据</span>
              <ElSwitch
                v-model="widget.props.tree"
                size="small"
                :disabled="widget.widgetType !== 'tree'"
              />
            </div>
            <ElFormItem label="内联选项（JSON 数组）">
              <ElInput
                :model-value="JSON.stringify(widget.options || [])"
                type="textarea"
                :rows="3"
                placeholder="[{&quot;label&quot;:&quot;启用&quot;,&quot;value&quot;:1}]"
                @update:model-value="updateOptions"
              />
            </ElFormItem>
          </ElForm>
        </ElCollapseItem>
      </ElCollapse>
    </template>

    <!-- 表格列 -->
    <template v-else-if="column">
      <div class="panel-head">
        <span class="panel-type">列表列</span>
        <span class="panel-title">{{ column.label }}</span>
      </div>
      <ElForm label-position="top" size="small" class="prop-form">
        <ElFormItem label="列标题">
          <ElInput v-model="column.label" />
        </ElFormItem>
        <ElFormItem label="字段">
          <ElInput v-model="column.field" disabled />
        </ElFormItem>
        <ElFormItem label="列宽（px）">
          <ElInputNumber
            v-model="column.width"
            :min="40"
            :max="600"
            controls-position="right"
            class="w-full"
          />
        </ElFormItem>
        <ElFormItem label="最小宽度">
          <ElInputNumber
            v-model="column.minWidth"
            :min="40"
            :max="600"
            controls-position="right"
            class="w-full"
          />
        </ElFormItem>
        <ElFormItem label="对齐">
          <ElRadioGroup v-model="column.align">
            <ElRadioButton value="left">左</ElRadioButton>
            <ElRadioButton value="center">中</ElRadioButton>
            <ElRadioButton value="right">右</ElRadioButton>
          </ElRadioGroup>
        </ElFormItem>
        <ElFormItem label="固定列">
          <ElSelect v-model="column.fixed">
            <ElOption label="不固定" value="" />
            <ElOption label="固定左侧" value="left" />
            <ElOption label="固定右侧" value="right" />
          </ElSelect>
        </ElFormItem>
        <div class="switch-row">
          <span>允许排序</span>
          <ElSwitch v-model="column.sortable" size="small" />
        </div>
        <div class="switch-row">
          <span>显示该列</span>
          <ElSwitch v-model="column.show" size="small" />
        </div>
        <ElFormItem label="绑定字典">
          <ElSelect v-model="column.dictCode" clearable filterable>
            <ElOption
              v-for="opt in dictOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="列 class">
          <ElInput v-model="column.className" placeholder="如 amount-col" />
        </ElFormItem>
      </ElForm>
    </template>

    <!-- 表格 -->
    <template
      v-else-if="selection.kind === 'table' || selection.kind === 'column'"
    >
      <div class="panel-head">
        <span class="panel-type">数据表格</span>
        <span class="panel-title">分页与操作</span>
      </div>
      <ElForm label-position="top" size="small" class="prop-form">
        <div class="switch-row">
          <span>启用分页</span>
          <ElSwitch v-model="doc.table.paged" size="small" />
        </div>
        <div class="switch-row">
          <span>树形表格</span>
          <ElSwitch v-model="doc.table.tree" size="small" />
        </div>
        <ElFormItem v-if="doc.table.tree" label="树形父级列（pid）">
          <ElSelect
            v-model="doc.table.pidColumn"
            clearable
            filterable
            placeholder="选择 parent_id 等父级字段"
          >
            <ElOption
              v-for="opt in fieldOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </ElSelect>
        </ElFormItem>
        <div v-if="doc.table.tree" class="switch-row">
          <span>默认展开全部节点</span>
          <ElSwitch v-model="doc.table.treeExpandAll" size="small" />
        </div>
        <div v-if="doc.table.tree" class="field-tip">
          后端返回平铺行，按行 id + 父级列在前端转树；父级为空的行作为根节点。
        </div>
        <ElFormItem v-if="doc.table.paged" label="默认每页条数">
          <ElInputNumber
            v-model="doc.table.pageSize"
            :min="1"
            :max="1000"
            controls-position="right"
            class="w-full"
          />
        </ElFormItem>
        <ElFormItem v-if="doc.table.paged" label="每页条数选项（逗号分隔）">
          <ElInput
            :model-value="pageSizesText()"
            @update:model-value="updatePageSizes"
          />
        </ElFormItem>
        <div class="switch-row">
          <span>显示序号列</span>
          <ElSwitch v-model="doc.table.showIndex" size="small" />
        </div>
        <div class="switch-row">
          <span>显示边框</span>
          <ElSwitch v-model="doc.table.border" size="small" />
        </div>
        <div class="switch-row">
          <span>斑马纹</span>
          <ElSwitch v-model="doc.table.stripe" size="small" />
        </div>
        <ElFormItem label="表格高度（px，0 自适应）">
          <ElInputNumber
            v-model="doc.table.height"
            :min="0"
            :max="1200"
            controls-position="right"
            class="w-full"
          />
        </ElFormItem>
        <ElFormItem label="顶部模糊搜索字段">
          <ElSelect
            v-model="doc.table.likeQueryColumn"
            multiple
            filterable
            collapse-tags
          >
            <ElOption
              v-for="opt in columnOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="默认排序列">
          <ElSelect v-model="doc.table.orderColumn" clearable filterable>
            <ElOption
              v-for="opt in columnOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </ElSelect>
        </ElFormItem>
      </ElForm>

      <div class="op-head">
        <span>操作按钮</span>
        <button class="mini-btn" @click="addTableOp">＋ 添加</button>
      </div>
      <div class="op-list">
        <div
          v-for="(op, index) in doc.table.operationList"
          :key="`${op.type}_${index}`"
          class="op-row"
        >
          <ElSelect
            :model-value="op.type"
            size="small"
            class="op-type"
            @change="(v: number) => changeOpType(op, v)"
          >
            <ElOption
              v-for="item in OPERATION_TYPES"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </ElSelect>
          <ElInput
            v-model="op.name"
            size="small"
            class="op-name"
            placeholder="按钮文字"
          />
          <ElSwitch v-model="op.enabled" size="small" />
          <button class="op-icon" title="上移" @click="moveTableOp(index, -1)">
            ↑
          </button>
          <button class="op-icon" title="下移" @click="moveTableOp(index, 1)">
            ↓
          </button>
          <button
            class="op-icon danger"
            title="删除按钮"
            @click="removeTableOp(index)"
          >
            ×
          </button>
        </div>
        <div v-if="!doc.table.operationList.length" class="op-empty">
          还没有操作按钮，点「添加」配置新建/编辑/删除/批量删除。
        </div>
      </div>
    </template>

    <!-- 左树 -->
    <template v-else-if="selection.kind === 'leftTree'">
      <div class="panel-head">
        <span class="panel-type">左侧树</span>
        <span class="panel-title">{{ doc.leftTree.title }}</span>
      </div>
      <ElForm label-position="top" size="small" class="prop-form">
        <div class="switch-row">
          <span>启用左树右表</span>
          <ElSwitch
            :model-value="doc.layout === 'tree'"
            size="small"
            @change="onLayoutChange"
          />
        </div>
        <ElFormItem label="树标题">
          <ElInput v-model="doc.leftTree.title" />
        </ElFormItem>
        <ElFormItem label="左栏宽度（px）">
          <ElInputNumber
            v-model="doc.leftTree.width"
            :min="160"
            :max="420"
            controls-position="right"
            class="w-full"
          />
        </ElFormItem>
        <ElFormItem label="树数据字典">
          <ElSelect
            v-model="doc.leftTree.dictCode"
            clearable
            filterable
            placeholder="选择字典（parentValue 组树）"
          >
            <ElOption
              v-for="opt in dictOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="节点值写入字段">
          <ElSelect v-model="doc.leftTree.field" clearable filterable>
            <ElOption
              v-for="opt in fieldOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </ElSelect>
        </ElFormItem>
        <div class="switch-row">
          <span>树内搜索框</span>
          <ElSwitch v-model="doc.leftTree.showSearch" size="small" />
        </div>
        <ElFormItem v-if="doc.leftTree.showSearch" label="搜索框占位">
          <ElInput v-model="doc.leftTree.searchPlaceholder" />
        </ElFormItem>
        <div class="switch-row">
          <span>默认展开全部</span>
          <ElSwitch v-model="doc.leftTree.defaultExpandAll" size="small" />
        </div>
        <div class="switch-row">
          <span>显示「全部」节点</span>
          <ElSwitch v-model="doc.leftTree.showAllNode" size="small" />
        </div>
      </ElForm>
    </template>

    <!-- 表单级 -->
    <template v-else>
      <div class="panel-head">
        <span class="panel-type">表单设置</span>
        <span class="panel-title">{{ isQuery ? '查询页' : '编辑页' }}</span>
      </div>

      <ElCollapse :model-value="['layout', 'filter', 'tree']">
        <ElCollapseItem name="layout" title="布局">
          <ElForm label-position="top" size="small" class="prop-form">
            <ElFormItem v-if="isQuery" label="页面形态">
              <ElRadioGroup
                :model-value="doc.layout"
                @change="(v: any) => setLayout(v)"
              >
                <ElRadioButton value="flat">条件 + 表格</ElRadioButton>
                <ElRadioButton value="tree">左树 + 右表</ElRadioButton>
              </ElRadioGroup>
            </ElFormItem>
            <ElFormItem label="标签宽度（px）">
              <ElInputNumber
                v-model="doc.labelWidth"
                :min="40"
                :max="260"
                controls-position="right"
                class="w-full"
              />
            </ElFormItem>
            <ElFormItem label="标签位置">
              <ElRadioGroup v-model="doc.labelPosition">
                <ElRadioButton value="right">右对齐</ElRadioButton>
                <ElRadioButton value="left">左对齐</ElRadioButton>
                <ElRadioButton value="top">顶部</ElRadioButton>
              </ElRadioGroup>
            </ElFormItem>
            <ElFormItem label="控件尺寸">
              <ElRadioGroup v-model="doc.size">
                <ElRadioButton value="small">小</ElRadioButton>
                <ElRadioButton value="default">中</ElRadioButton>
                <ElRadioButton value="large">大</ElRadioButton>
              </ElRadioGroup>
            </ElFormItem>
          </ElForm>
        </ElCollapseItem>

        <ElCollapseItem v-if="isQuery" name="filter" title="查询条件区">
          <ElForm label-position="top" size="small" class="prop-form">
            <ElFormItem label="每项宽度（px）">
              <ElInputNumber
                v-model="doc.filter.itemWidth"
                :min="180"
                :max="600"
                :step="10"
                controls-position="right"
                class="w-full"
              />
            </ElFormItem>
            <ElFormItem label="标签宽度（px）">
              <ElInputNumber
                v-model="doc.filter.labelWidth"
                :min="40"
                :max="220"
                controls-position="right"
                class="w-full"
              />
            </ElFormItem>
            <ElFormItem label="标签位置">
              <ElRadioGroup v-model="doc.filter.labelPosition">
                <ElRadioButton value="right">右</ElRadioButton>
                <ElRadioButton value="left">左</ElRadioButton>
                <ElRadioButton value="top">顶部</ElRadioButton>
              </ElRadioGroup>
            </ElFormItem>
            <ElFormItem label="条件间距（px）">
              <ElInputNumber
                v-model="doc.filter.gutter"
                :min="0"
                :max="48"
                controls-position="right"
                class="w-full"
              />
            </ElFormItem>
            <div class="switch-row">
              <span>超过行数自动折叠</span>
              <ElSwitch v-model="doc.filter.collapsible" size="small" />
            </div>
            <ElFormItem v-if="doc.filter.collapsible" label="默认展示行数">
              <ElInputNumber
                v-model="doc.filter.defaultRows"
                :min="1"
                :max="6"
                controls-position="right"
                class="w-full"
              />
            </ElFormItem>
            <div class="switch-row">
              <span>隐藏所有标签</span>
              <ElSwitch v-model="doc.filter.hideLabel" size="small" />
            </div>
            <div class="switch-row">
              <span>显示查询按钮</span>
              <ElSwitch v-model="doc.filter.showSearch" size="small" />
            </div>
            <div class="switch-row">
              <span>显示重置按钮</span>
              <ElSwitch v-model="doc.filter.showReset" size="small" />
            </div>
            <ElFormItem label="查询按钮文案">
              <ElInput v-model="doc.filter.searchText" />
            </ElFormItem>
            <ElFormItem label="重置按钮文案">
              <ElInput v-model="doc.filter.resetText" />
            </ElFormItem>
          </ElForm>
        </ElCollapseItem>

        <ElCollapseItem
          v-if="isQuery && doc.layout === 'tree'"
          name="tree"
          title="左侧树"
        >
          <ElForm label-position="top" size="small" class="prop-form">
            <ElFormItem label="树标题">
              <ElInput v-model="doc.leftTree.title" />
            </ElFormItem>
            <ElFormItem label="左栏宽度（px）">
              <ElInputNumber
                v-model="doc.leftTree.width"
                :min="160"
                :max="420"
                controls-position="right"
                class="w-full"
              />
            </ElFormItem>
            <ElFormItem label="树数据字典">
              <ElSelect v-model="doc.leftTree.dictCode" clearable filterable>
                <ElOption
                  v-for="opt in dictOptions"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </ElSelect>
            </ElFormItem>
            <ElFormItem label="节点值写入字段">
              <ElSelect v-model="doc.leftTree.field" clearable filterable>
                <ElOption
                  v-for="opt in fieldOptions"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </ElSelect>
            </ElFormItem>
            <div class="switch-row">
              <span>树内搜索框</span>
              <ElSwitch v-model="doc.leftTree.showSearch" size="small" />
            </div>
            <div class="switch-row">
              <span>默认展开全部</span>
              <ElSwitch v-model="doc.leftTree.defaultExpandAll" size="small" />
            </div>
          </ElForm>
        </ElCollapseItem>
      </ElCollapse>

      <div class="panel-tip">
        <p>
          提示：在左侧字段面板拖字段到画布即可添加条件；选中任意条件后可配置类型、过滤方式、字典、事件与样式。
        </p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.property-panel {
  height: 100%;
  padding: 0 12px 24px;
  overflow: auto;
  background: #fff;
}

.panel-head {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 12px 2px 10px;
  border-bottom: 1px solid #ebeef5;
}

.panel-type {
  font-size: 11px;
  color: #909399;
  letter-spacing: 0.04em;
}

.panel-title {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  white-space: nowrap;
}

.prop-form {
  padding-top: 8px;
}

.prop-form :deep(.el-form-item) {
  margin-bottom: 12px;
}

.prop-form :deep(.el-form-item__label) {
  padding-bottom: 2px;
  font-size: 12px;
  line-height: 18px;
  color: #606266;
}

.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0;
  font-size: 12px;
  color: #606266;
}

.field-tip {
  margin-top: 2px;
  font-size: 11px;
  color: #909399;
}

.filter-option {
  display: flex;
  flex-direction: column;
  line-height: 16px;
}

.filter-option small {
  color: #909399;
}

.panel-tip {
  padding: 10px;
  margin-top: 12px;
  font-size: 11px;
  line-height: 18px;
  color: #909399;
  background: #fafafa;
  border: 1px dashed #e4e7ed;
  border-radius: 4px;
}

.w-full {
  width: 100%;
}

.op-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 16px 2px 8px;
  font-size: 12px;
  font-weight: 600;
  color: #303133;
}

.mini-btn {
  padding: 1px 8px;
  font-size: 11px;
  color: #2563eb;
  cursor: pointer;
  background: #fff;
  border: 1px dashed #a8c7fa;
  border-radius: 4px;
}

.mini-btn:hover {
  background: #f0f7ff;
}

.op-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.op-row {
  display: flex;
  gap: 4px;
  align-items: center;
  padding: 5px 6px;
  background: #fafbfc;
  border: 1px solid #ebeef5;
  border-radius: 5px;
}

.op-type {
  flex: none;
  width: 108px;
}

.op-name {
  flex: 1;
  min-width: 0;
}

.op-icon {
  flex: none;
  width: 18px;
  height: 18px;
  padding: 0;
  font-size: 11px;
  line-height: 16px;
  color: #909399;
  cursor: pointer;
  background: none;
  border: none;
  border-radius: 3px;
}

.op-icon:hover {
  color: #2563eb;
  background: #ecf5ff;
}

.op-icon.danger:hover {
  color: #f56c6c;
  background: #fef0f0;
}

.op-empty {
  padding: 12px;
  font-size: 11px;
  line-height: 18px;
  color: #909399;
  text-align: center;
  background: #fafafa;
  border: 1px dashed #e4e7ed;
  border-radius: 4px;
}
</style>
