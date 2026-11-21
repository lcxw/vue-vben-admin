<script lang="ts" setup>
import type { FormDesignDoc } from './types';

import { ElButton, ElForm, ElFormItem } from 'element-plus';

import RunWidget from './RunWidget.vue';
import { styleToObject } from './script';

const props = defineProps<{
  doc: FormDesignDoc;
  selectedKey?: string;
  selectedKind?: string;
}>();

const emit = defineEmits<{
  addWidget: [kind: string];
  dropField: [field: string];
  select: [kind: string, key?: string];
}>();

function optionsOf(widget: any) {
  if (widget.options?.length) return widget.options;
  return [];
}

function spanOf(widget: any) {
  return Math.min(24, Math.max(1, Number(widget.span) || 12));
}

function onDrop(event: DragEvent) {
  event.preventDefault();
  const field =
    event.dataTransfer?.getData('text/lunar-field') ||
    event.dataTransfer?.getData('text/plain');
  if (field) emit('dropField', field);
}
</script>

<template>
  <div class="edit-canvas" @click="emit('select', 'form')">
    <div class="canvas-page">
      <div class="edit-head">
        <div>
          <span class="form-title">{{ doc.formKey || '编辑表单' }}</span>
          <span class="form-meta">栅格 24 · 标签宽度 {{ doc.labelWidth }}px</span>
        </div>
        <div class="edit-actions">
          <ElButton size="small" type="primary">保存</ElButton>
          <ElButton size="small">取消</ElButton>
        </div>
      </div>

      <div
        class="edit-body"
        @dragover.prevent
        @drop.prevent="onDrop"
        @click.stop="emit('select', 'form')"
      >
        <ElForm
          :label-position="doc.labelPosition"
          :label-width="`${doc.labelWidth}px`"
          :style="styleToObject(doc.formStyle)"
        >
          <div class="edit-grid">
            <div
              v-for="widget in doc.widgetList"
              :key="widget.key"
              class="edit-cell"
              :class="{
                'is-selected':
                  selectedKind === 'condition' && selectedKey === widget.key,
                'is-hidden': widget.visible === false,
                'is-divider': widget.widgetType === 'divider',
              }"
              :style="{
                ...styleToObject(widget.styleConfig),
                gridColumn: `span ${spanOf(widget)}`,
              }"
              @click.stop="emit('select', 'condition', widget.key)"
            >
              <template v-if="widget.widgetType === 'divider'">
                <div class="divider-line">{{ widget.label }}</div>
              </template>
              <ElFormItem
                v-else
                :label="widget.label"
                :required="widget.required"
                :label-width="
                  widget.styleConfig?.labelWidth
                    ? `${widget.styleConfig.labelWidth}px`
                    : undefined
                "
              >
                <RunWidget
                  :model-value="widget.defaultValue"
                  :options="optionsOf(widget)"
                  :widget="widget"
                  preview
                />
              </ElFormItem>
              <div class="cell-actions">
                <span class="cell-span">{{ spanOf(widget) }}/24</span>
                <span
                  v-if="
                    widget.events?.some(
                      (e) => e.eventType === 'visible' && e.script,
                    )
                  "
                  class="cell-badge"
                  >显隐脚本</span>
                <button
                  title="删除"
                  @click.stop="
                    doc.widgetList.splice(doc.widgetList.indexOf(widget), 1)
                  "
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        </ElForm>
        <div class="edit-empty" @click.stop="emit('addWidget', 'input')">
          拖入字段或点击添加表单控件
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.edit-canvas {
  min-height: 100%;
  padding: 16px;
  background: #f3f5f9;
}

.canvas-page {
  min-height: 620px;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgb(0 0 0 / 4%);
}

.edit-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 24px;
  border-bottom: 1px solid #ebeef5;
}

.form-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.form-meta {
  margin-left: 8px;
  font-size: 11px;
  color: #909399;
}

.edit-body {
  padding: 20px 24px 30px;
}

.edit-grid {
  display: grid;
  grid-template-columns: repeat(24, minmax(0, 1fr));
  gap: 12px;
}

.edit-cell {
  position: relative;
  grid-column: span 12;
  padding: 4px;
  cursor: pointer;
  border: 1px solid transparent;
  border-radius: 4px;
}

.edit-cell:hover {
  background: #f8fafc;
  border-color: #dcdfe6;
}

.edit-cell.is-selected {
  background: #ecf5ff;
  border-color: #409eff;
}

.edit-cell.is-hidden {
  opacity: 0.5;
}

.edit-cell.is-divider {
  padding-top: 10px;
}

.divider-line {
  padding-bottom: 4px;
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  border-bottom: 1px dashed #dcdfe6;
}

.cell-actions {
  position: absolute;
  top: -9px;
  right: 2px;
  display: none;
  gap: 4px;
  align-items: center;
  padding: 1px 4px;
  font-size: 10px;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 3px;
}

.edit-cell:hover .cell-actions {
  display: flex;
}

.cell-span {
  color: #909399;
}

.cell-badge {
  color: #6f42c1;
}

.cell-actions button {
  padding: 0 4px;
  color: #909399;
  cursor: pointer;
  background: none;
  border: none;
}

.cell-actions button:hover {
  color: #f56c6c;
}

.edit-empty {
  padding: 24px;
  margin-top: 20px;
  font-size: 12px;
  color: #909399;
  text-align: center;
  cursor: pointer;
  border: 1px dashed #dcdfe6;
  border-radius: 4px;
}

.edit-empty:hover {
  color: #409eff;
  border-color: #a0cfff;
}
</style>
