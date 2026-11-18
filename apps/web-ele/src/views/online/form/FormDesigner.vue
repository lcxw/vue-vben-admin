<script lang="ts" setup>
/**
 * 在线表单设计器（widget_json 可视化编辑）。
 *
 * 左：控件列表（新增/删除/上移/下移）；右：选中控件属性编辑；底部：JSON 预览。
 * 产出的 schema 直接保存为 OnlineFormDTO.widgetJson，与运行时渲染器同一契约。
 */
import type { OnlineDictVO, OnlineFormSchema, OnlineWidget } from '#/api/online';

import { computed, ref, watch } from 'vue';

import {
  ElButton,
  ElCheckbox,
  ElDrawer,
  ElFormItem,
  ElInput,
  ElInputNumber,
  ElOption,
  ElSelect,
} from 'element-plus';

import {
  getOnlineDictList,
  ONLINE_WIDGET_TYPES,
  widgetTypeLabel,
} from '#/api/online';

const modelValue = defineModel<boolean>({ default: false });

const props = defineProps<{
  formName: string;
  widgetJson?: string;
}>();

const emit = defineEmits<{
  save: [widgetJson: string];
}>();

const widgets = ref<OnlineWidget[]>([]);
const selectedIndex = ref(-1);
const dicts = ref<OnlineDictVO[]>([]);

const selected = computed<null | OnlineWidget>(() =>
  selectedIndex.value >= 0 ? (widgets.value[selectedIndex.value] ?? null) : null,
);

const jsonPreview = computed(() =>
  JSON.stringify({ widgets: widgets.value } satisfies OnlineFormSchema, null, 2),
);

watch(
  () => modelValue.value,
  async (open) => {
    if (!open) return;
    try {
      dicts.value = await getOnlineDictList();
    } catch {
      dicts.value = [];
    }
    try {
      const parsed = props.widgetJson
        ? (JSON.parse(props.widgetJson) as OnlineFormSchema)
        : { widgets: [] };
      widgets.value = Array.isArray(parsed.widgets) ? [...parsed.widgets] : [];
    } catch {
      widgets.value = [];
    }
    selectedIndex.value = widgets.value.length > 0 ? 0 : -1;
  },
);

function addWidget() {
  const widget: OnlineWidget = {
    fieldKey: `field_${widgets.value.length + 1}`,
    label: '新控件',
    required: false,
    type: 'input',
    placeholder: '',
    width: 24,
    options: [],
  };
  widgets.value.push(widget);
  selectedIndex.value = widgets.value.length - 1;
}

function removeWidget(index: number) {
  widgets.value.splice(index, 1);
  if (selectedIndex.value >= widgets.value.length) {
    selectedIndex.value = widgets.value.length - 1;
  }
}

function move(index: number, delta: number) {
  const target = index + delta;
  if (target < 0 || target >= widgets.value.length) return;
  const list = widgets.value;
  const a = list[index];
  const b = list[target];
  if (a !== undefined && b !== undefined) {
    list[index] = b;
    list[target] = a;
  }
  selectedIndex.value = target;
}

function onTypeChange(type: string) {
  if (!selected.value) return;
  if (['select', 'radio', 'checkbox'].includes(type) && !selected.value.options?.length) {
    selected.value.options = [
      { label: '选项一', value: '1' },
      { label: '选项二', value: '2' },
    ];
  }
}

function addOption() {
  if (!selected.value) return;
  if (!Array.isArray(selected.value.options)) selected.value.options = [];
  selected.value.options.push({ label: '新选项', value: String(selected.value.options.length + 1) });
}

function removeOption(index: number) {
  selected.value?.options?.splice(index, 1);
}

function onSubmit() {
  emit('save', jsonPreview.value);
  modelValue.value = false;
}
</script>

<template>
  <ElDrawer
    v-model="modelValue"
    :title="`设计表单 · ${formName}`"
    size="76%"
    :close-on-click-modal="false"
  >
    <div class="designer-layout">
      <div class="designer-list">
        <div class="designer-toolbar">
          <span class="designer-title">控件列表 ({{ widgets.length }})</span>
          <ElButton type="primary" size="small" @click="addWidget">新增控件</ElButton>
        </div>
        <div
          v-for="(widget, index) in widgets"
          :key="index"
          class="designer-item"
          :class="{ active: index === selectedIndex }"
          @click="selectedIndex = index"
        >
          <span class="item-label">{{ widget.label || widget.fieldKey }}</span>
          <span class="item-type">{{ widgetTypeLabel(widget.type) }}</span>
          <span class="item-actions">
            <ElButton link size="small" :disabled="index === 0" @click.stop="move(index, -1)">↑</ElButton>
            <ElButton
              link
              size="small"
              :disabled="index === widgets.length - 1"
              @click.stop="move(index, 1)"
            >
              ↓
            </ElButton>
            <ElButton link size="small" type="danger" @click.stop="removeWidget(index)">删除</ElButton>
          </span>
        </div>
        <div v-if="widgets.length === 0" class="designer-empty">
          点击「新增控件」开始设计表单
        </div>
      </div>

      <div class="designer-props">
        <template v-if="selected">
          <div class="designer-title">控件属性</div>
          <ElFormItem label="字段标识 (fieldKey)">
            <ElInput v-model="selected.fieldKey" placeholder="英文标识，如 amount" />
          </ElFormItem>
          <ElFormItem label="标题">
            <ElInput v-model="selected.label" placeholder="如：申请金额" />
          </ElFormItem>
          <ElFormItem label="控件类型">
            <ElSelect v-model="selected.type" @change="onTypeChange">
              <ElOption
                v-for="t in ONLINE_WIDGET_TYPES"
                :key="t.value"
                :label="t.label"
                :value="t.value"
              />
            </ElSelect>
          </ElFormItem>
          <ElFormItem label="占位提示">
            <ElInput v-model="selected.placeholder" />
          </ElFormItem>
          <ElFormItem label="栅格宽度 (1-24)">
            <ElInputNumber v-model="selected.width" :min="1" :max="24" />
          </ElFormItem>
          <ElFormItem label="必填">
            <ElCheckbox v-model="selected.required" />
          </ElFormItem>
          <template v-if="['select', 'radio', 'checkbox'].includes(selected.type)">
            <ElFormItem label="在线字典 (可选，优先级低于内联选项)">
              <ElSelect v-model="selected.dictCode" clearable placeholder="不使用字典">
                <ElOption
                  v-for="d in dicts"
                  :key="d.dictId"
                  :label="`${d.dictName} (${d.dictCode})`"
                  :value="d.dictCode"
                />
              </ElSelect>
            </ElFormItem>
            <ElFormItem label="内联选项">
              <div v-for="(opt, i) in selected.options ?? []" :key="i" class="option-row">
                <ElInput v-model="opt.label" placeholder="显示文本" class="option-label" />
                <ElInput v-model="opt.value" placeholder="值" class="option-value" />
                <ElButton link type="danger" size="small" @click="removeOption(i)">删</ElButton>
              </div>
              <ElButton size="small" @click="addOption">添加选项</ElButton>
            </ElFormItem>
          </template>
        </template>
        <div v-else class="designer-empty">选择一个控件以编辑属性</div>
      </div>

      <div class="designer-json">
        <div class="designer-title">JSON 预览（保存后由后端发布校验）</div>
        <pre>{{ jsonPreview }}</pre>
      </div>
    </div>

    <template #footer>
      <ElButton @click="modelValue = false">取消</ElButton>
      <ElButton type="primary" :disabled="widgets.length === 0" @click="onSubmit">
        保存控件配置
      </ElButton>
    </template>
  </ElDrawer>
</template>

<style scoped>
.designer-layout {
  display: grid;
  grid-template-columns: 260px 1fr 320px;
  gap: 16px;
  min-height: 460px;
}
.designer-list,
.designer-props,
.designer-json {
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  padding: 12px;
  overflow: auto;
}
.designer-title {
  font-weight: 600;
  margin-bottom: 10px;
  display: block;
}
.designer-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.designer-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
  margin-bottom: 4px;
}
.designer-item.active {
  background: var(--el-color-primary-light-9);
}
.item-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.item-type {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.item-actions {
  display: flex;
  gap: 0;
}
.designer-empty {
  color: var(--el-text-color-secondary);
  padding: 24px 8px;
  text-align: center;
}
.option-row {
  display: flex;
  gap: 6px;
  margin-bottom: 6px;
}
.option-label {
  flex: 2;
}
.option-value {
  flex: 1;
}
.designer-json pre {
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 560px;
  overflow: auto;
}
</style>
