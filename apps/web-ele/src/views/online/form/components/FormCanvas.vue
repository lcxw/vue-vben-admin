<script lang="ts" setup>
/**
 * 表单画布：设计 / 预览 / 运行时共用渲染。
 * 12 栅格 + 真实控件；design 模式支持选中、拖拽排序、复制、删除。
 */
import { computed } from 'vue';

import {
  ElButton,
  ElCheckbox,
  ElDatePicker,
  ElDivider,
  ElInput,
  ElInputNumber,
  ElOption,
  ElRadio,
  ElRadioGroup,
  ElSelect,
  ElSwitch,
} from 'element-plus';

export interface CanvasWidget {
  childWidgetList?: CanvasWidget[];
  field?: string;
  key: string;
  props?: Record<string, any>;
  span?: number;
  title?: string;
  type: string;
}

const props = withDefaults(
  defineProps<{
    mode?: 'design' | 'preview' | 'runtime';
    modelValue?: Record<string, any>;
    selectedKey?: string;
    widgets: CanvasWidget[];
  }>(),
  { mode: 'design', modelValue: () => ({}), selectedKey: '' },
);

const emit = defineEmits<{
  duplicate: [key: string];
  move: [payload: { from: number; to: number }];
  remove: [key: string];
  select: [key: string];
}>();

const model = computed(() => props.modelValue || {});

const design = computed(() => props.mode === 'design');

function spanOf(w: CanvasWidget) {
  const s = Number(w.span || 12);
  return Math.min(12, Math.max(1, Number.isFinite(s) ? s : 12));
}

function optionsOf(w: CanvasWidget) {
  const opts = w.props?.options;
  if (Array.isArray(opts) && opts.length > 0) return opts;
  return [
    { label: '选项一', value: '1' },
    { label: '选项二', value: '2' },
  ];
}

function onDragStart(e: DragEvent, index: number) {
  if (!design.value) return;
  e.dataTransfer?.setData('text/canvas-index', String(index));
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
}

function onDrop(e: DragEvent, index: number) {
  if (!design.value) return;
  const from = Number(e.dataTransfer?.getData('text/canvas-index'));
  if (Number.isNaN(from) || from === index) return;
  emit('move', { from, to: index });
}

function select(w: CanvasWidget) {
  if (!design.value) return;
  emit('select', w.key);
}
</script>

<template>
  <div class="grid grid-cols-12 gap-x-3 gap-y-1">
    <div
      v-for="(w, index) in widgets"
      :key="w.key"
      class="relative rounded px-1 py-1 transition" :class="[
        design ? 'cursor-pointer hover:ring-1 hover:ring-primary/40' : '',
        design && selectedKey === w.key
          ? 'ring-2 ring-primary bg-primary/5'
          : '',
      ]"
      :style="{ gridColumn: `span ${spanOf(w)} / span ${spanOf(w)}` }"
      :draggable="design"
      :data-wkey="w.key"
      @click.stop="select(w)"
      @dragstart="onDragStart($event, index)"
      @dragover.prevent
      @drop.prevent="onDrop($event, index)"
    >
      <div
        v-if="design"
        class="absolute -top-2 right-1 hidden gap-1 group-hover:flex"
      >
        <ElButton size="small" circle @click.stop="emit('duplicate', w.key)">
⧉
</ElButton>
        <ElButton
          size="small"
          circle
          type="danger"
          @click.stop="emit('remove', w.key)"
          >
×
</ElButton>
      </div>

      <ElDivider v-if="w.type === 'divider'" />
      <div v-else-if="w.type === 'title'" class="py-1 text-sm font-semibold">
        {{ w.title }}
      </div>

      <div v-else class="flex flex-col gap-1">
        <span v-if="design" class="text-xs text-gray-500">{{
          w.title || w.field || w.type
        }}</span>
        <ElInput
          v-if="w.type === 'input'"
          :model-value="model[w.field || '']"
          :placeholder="w.props?.placeholder"
          disabled
        />
        <ElInput
          v-else-if="w.type === 'textarea'"
          :model-value="model[w.field || '']"
          :rows="2"
          :placeholder="w.props?.placeholder"
          disabled
          type="textarea"
        />
        <ElInputNumber
          v-else-if="w.type === 'number'"
          :model-value="model[w.field || '']"
          class="!w-full"
          disabled
        />
        <ElSelect
          v-else-if="w.type === 'select'"
          :model-value="model[w.field || '']"
          class="w-full"
          disabled
          :placeholder="w.props?.placeholder || '请选择'"
        >
          <ElOption
            v-for="o in optionsOf(w)"
            :key="o.value"
            :label="o.label"
            :value="o.value"
          />
        </ElSelect>
        <ElDatePicker
          v-else-if="w.type === 'date'"
          :model-value="model[w.field || '']"
          class="!w-full"
          disabled
          type="date"
        />
        <ElDatePicker
          v-else-if="w.type === 'datetime'"
          :model-value="model[w.field || '']"
          class="!w-full"
          disabled
          type="datetime"
        />
        <ElSwitch
          v-else-if="w.type === 'switch'"
          :model-value="model[w.field || '']"
          disabled
        />
        <ElRadioGroup
          v-else-if="w.type === 'radio'"
          :model-value="model[w.field || '']"
          disabled
        >
          <ElRadio v-for="o in optionsOf(w)" :key="o.value" :value="o.value">
{{
            o.label
          }}
</ElRadio>
        </ElRadioGroup>
        <ElCheckbox
          v-else-if="w.type === 'checkbox'"
          :model-value="false"
          disabled
        >
          {{ w.title || '勾选项' }}
        </ElCheckbox>
        <div
          v-else-if="w.type === 'subtable'"
          class="rounded border border-dashed p-2 text-xs text-gray-400"
        >
          子表：{{ w.title || w.field }}
        </div>
        <ElInput
          v-else
          model-value=""
          disabled
          :placeholder="`控件：${w.type}`"
        />
      </div>
    </div>
  </div>
</template>
