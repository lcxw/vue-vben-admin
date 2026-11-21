<script lang="ts" setup>
import type { FormDesignDoc, TableColumnDesign } from './types';

import { computed } from 'vue';

import {
  ElColorPicker,
  ElForm,
  ElFormItem,
  ElInput,
  ElInputNumber,
} from 'element-plus';

import { STYLE_FIELDS } from './types';

const props = defineProps<{
  doc: FormDesignDoc;
  selection: { key?: string; kind: string };
}>();

const widget = computed(() =>
  props.selection.kind === 'condition'
    ? props.doc.widgetList.find((w) => w.key === props.selection.key)
    : undefined,
);
const column = computed<TableColumnDesign | undefined>(() =>
  props.selection.kind === 'column'
    ? props.doc.table.columns.find((c) => c.key === props.selection.key)
    : undefined,
);
const target = computed<Record<string, any> | undefined>(() => {
  if (widget.value) return widget.value.styleConfig;
  if (column.value) return column.value.styleConfig;
  if (props.selection.kind === 'table') return props.doc.table.styleConfig;
  if (props.selection.kind === 'form' || props.selection.kind === 'leftTree') {
    return props.doc.formStyle;
  }
  return undefined;
});

const title = computed(() => {
  if (widget.value) return widget.value.label;
  if (column.value) return column.value.label;
  if (props.selection.kind === 'table') return '数据表格';
  return '整张表单';
});

function ensureTarget() {
  if (
    props.selection.kind === 'condition' &&
    widget.value &&
    !widget.value.styleConfig
  ) {
    widget.value.styleConfig = {};
  }
  if (
    props.selection.kind === 'column' &&
    column.value &&
    !column.value.styleConfig
  ) {
    column.value.styleConfig = {};
  }
  if (!props.doc.formStyle) props.doc.formStyle = {};
  return target.value;
}

function setStyle(key: string, value: any) {
  const t = ensureTarget();
  if (!t) return;
  if (value === '' || value === null || value === undefined) delete t[key];
  else t[key] = value;
}

function setCustomClass(value: string) {
  setStyle('customClass', value);
  if (column.value) column.value.className = value;
}

function setCustomStyle(value: string) {
  setStyle('customStyle', value);
}
</script>

<template>
  <div class="style-panel">
    <div class="style-head">
      <div class="style-title">样式配置</div>
      <div class="style-sub">
        {{ title }} · 支持标签宽度、宽度、背景、圆角与自定义 CSS
      </div>
    </div>

    <template v-if="target">
      <div class="style-section">
        <div class="section-title">尺寸</div>
        <ElForm label-position="top" size="small" class="style-form">
          <ElFormItem v-if="widget" label="条件项宽度（0 跟随全局）">
            <ElInputNumber
              v-model="widget.itemWidth"
              :min="0"
              :max="800"
              :step="20"
              controls-position="right"
              class="w-full"
            />
          </ElFormItem>
          <template v-if="column">
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
          </template>
        </ElForm>
      </div>

      <div class="style-section">
        <div class="section-title">外观</div>
        <ElForm label-position="top" size="small" class="style-form">
          <ElFormItem
            v-for="field in STYLE_FIELDS"
            :key="field.key"
            :label="field.label"
          >
            <ElColorPicker
              v-if="field.type === 'color'"
              :model-value="target[field.key] || ''"
              show-alpha
              @change="(v) => setStyle(field.key, v)"
            />
            <ElInput
              v-else
              :model-value="target[field.key] ?? ''"
              :placeholder="field.placeholder"
              @update:model-value="(v) => setStyle(field.key, v)"
            />
          </ElFormItem>
          <ElFormItem label="自定义 class">
            <ElInput
              :model-value="
                target.customClass || (column ? column.className : '')
              "
              placeholder="如 amount-cell"
              @update:model-value="setCustomClass"
            />
          </ElFormItem>
          <ElFormItem label="自定义 CSS（内联）">
            <ElInput
              :model-value="target.customStyle || ''"
              type="textarea"
              :rows="3"
              placeholder="如 box-shadow: 0 0 0 1px #409eff;"
              @update:model-value="setCustomStyle"
            />
          </ElFormItem>
        </ElForm>
      </div>

      <div class="style-preview">
        <div class="preview-label">效果预览</div>
        <div
          class="preview-box"
          :style="{
            width:
              target.width ||
              (widget
                ? `${widget.itemWidth || doc.filter.itemWidth}px`
                : '100%'),
            background: target.background || '#fff',
            borderRadius: target.borderRadius || '6px',
            border: target.border || '1px dashed #dcdfe6',
            color: target.color || '#303133',
            fontSize: target.fontSize || '12px',
            padding: target.padding || '10px',
            margin: target.margin || '0',
            textAlign: target.textAlign || 'left',
          }"
        >
          {{ title }}
          <span v-if="widget" class="preview-meta">标签
            {{ widget.styleConfig.labelWidth || doc.filter.labelWidth }}px</span>
        </div>
      </div>
    </template>

    <div v-else class="style-empty">
      选择查询条件、表格列或表格后配置样式；不选中时作用于整张表单。
    </div>
  </div>
</template>

<style scoped>
.style-panel {
  height: 100%;
  padding: 0 12px 24px;
  overflow: auto;
  background: #fff;
}

.style-head {
  padding: 12px 2px 10px;
  border-bottom: 1px solid #ebeef5;
}

.style-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.style-sub {
  margin-top: 3px;
  font-size: 11px;
  color: #909399;
}

.style-section {
  padding-top: 10px;
}

.section-title {
  margin: 4px 0 8px;
  font-size: 12px;
  font-weight: 600;
  color: #303133;
}

.style-form :deep(.el-form-item) {
  margin-bottom: 10px;
}

.style-form :deep(.el-form-item__label) {
  padding-bottom: 2px;
  font-size: 12px;
  line-height: 18px;
  color: #606266;
}

.style-preview {
  margin-top: 8px;
}

.preview-label {
  margin-bottom: 6px;
  font-size: 11px;
  color: #909399;
}

.preview-box {
  box-sizing: border-box;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-meta {
  float: right;
  font-size: 10px;
  color: #909399;
}

.style-empty {
  padding: 20px 12px;
  margin-top: 16px;
  font-size: 11px;
  line-height: 18px;
  color: #909399;
  text-align: center;
  background: #fafafa;
  border: 1px dashed #e4e7ed;
  border-radius: 4px;
}

.w-full {
  width: 100%;
}
</style>
