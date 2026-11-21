<script lang="ts" setup>
import { computed } from 'vue';

import {
  ElCheckbox,
  ElCheckboxGroup,
  ElDatePicker,
  ElInput,
  ElInputNumber,
  ElOption,
  ElRadio,
  ElRadioGroup,
  ElSelect,
  ElSwitch,
} from 'element-plus';

const props = withDefaults(
  defineProps<{
    disabled?: boolean;
    modelValue?: any;
    options?: Array<{ label: string; value: any }>;
    preview?: boolean;
    widget: any;
  }>(),
  {
    disabled: false,
    modelValue: undefined,
    options: () => [],
    preview: false,
  },
);

const emit = defineEmits<{
  change: [value: any];
  'update:modelValue': [value: any];
}>();

const type = computed(() => props.widget?.widgetType || 'input');
const propsCfg = computed(() => props.widget?.props || {});
const isDisabled = computed(() => props.disabled || props.preview);
const isSelect = computed(
  () =>
    type.value === 'select' ||
    type.value === 'dictSelect' ||
    type.value === 'tree',
);
const noSelectOptions = computed(
  () => isSelect.value && (props.options || []).length === 0,
);
const placeholder = computed(() => {
  const text = props.widget?.placeholder || propsCfg.value.placeholder || '';
  if (isSelect.value || type.value === 'date' || type.value === 'dateRange') {
    return text && !text.startsWith('请输入') ? text : '请选择';
  }
  return text;
});

const value = computed<any>({
  get: () => props.modelValue,
  set: (v) => {
    emit('update:modelValue', v);
    emit('change', v);
  },
});

const rangeValue = computed<any>({
  get: () => {
    const v = props.modelValue;
    return Array.isArray(v) ? [v[0], v[1]] : [undefined, undefined];
  },
  set: (v: any) => {
    value.value = v;
  },
});

const numberStart = computed<any>({
  get: () =>
    Array.isArray(props.modelValue) ? props.modelValue[0] : undefined,
  set: (v) => {
    const current = Array.isArray(props.modelValue) ? props.modelValue : [];
    value.value = [v, current[1]];
  },
});
const numberEnd = computed<any>({
  get: () =>
    Array.isArray(props.modelValue) ? props.modelValue[1] : undefined,
  set: (v) => {
    const current = Array.isArray(props.modelValue) ? props.modelValue : [];
    value.value = [current[0], v];
  },
});

const dateType = computed(() => propsCfg.value.dateType || 'date');
const valueFormat = computed(() => {
  if (propsCfg.value.valueFormat) return propsCfg.value.valueFormat;
  return dateType.value.includes('datetime')
    ? 'YYYY-MM-DD HH:mm:ss'
    : 'YYYY-MM-DD';
});
</script>

<template>
  <div class="lunar-run-widget" :class="{ 'is-preview': preview }">
    <ElInput
      v-if="
        type === 'input' ||
        type === 'userSelect' ||
        type === 'deptSelect' ||
        noSelectOptions
      "
      v-model="value"
      :disabled="isDisabled"
      :placeholder="placeholder"
      clearable
    />

    <ElInput
      v-else-if="type === 'textarea' || type === 'text'"
      v-model="value"
      :autosize="{ minRows: 2, maxRows: 4 }"
      :disabled="isDisabled"
      :placeholder="placeholder"
      type="textarea"
    />

    <ElInputNumber
      v-else-if="type === 'number'"
      v-model="value"
      :controls="false"
      :disabled="isDisabled"
      :placeholder="placeholder"
      class="w-full"
    />

    <div v-else-if="type === 'numberRange'" class="lunar-range">
      <ElInputNumber
        v-model="numberStart"
        :controls="false"
        :disabled="isDisabled"
        placeholder="最小值"
        class="range-input"
      />
      <span class="range-sep">~</span>
      <ElInputNumber
        v-model="numberEnd"
        :controls="false"
        :disabled="isDisabled"
        placeholder="最大值"
        class="range-input"
      />
    </div>

    <ElDatePicker
      v-else-if="type === 'date' || type === 'datetime'"
      v-model="value"
      :disabled="isDisabled"
      :placeholder="placeholder || '请选择日期'"
      :type="dateType === 'datetime' ? 'datetime' : 'date'"
      :value-format="valueFormat"
      class="w-full"
    />

    <ElDatePicker
      v-else-if="type === 'dateRange'"
      v-model="rangeValue"
      :disabled="isDisabled"
      :end-placeholder="propsCfg.endPlaceholder || '结束日期'"
      :start-placeholder="propsCfg.startPlaceholder || '开始日期'"
      :type="propsCfg.rangeType || 'daterange'"
      :value-format="valueFormat"
      class="w-full"
      range-separator="~"
    />

    <ElSelect
      v-else-if="type === 'select' || type === 'dictSelect' || type === 'tree'"
      v-model="value"
      :disabled="isDisabled"
      :multiple="props.widget?.dictMultiple || propsCfg.multiple"
      :placeholder="placeholder || '请选择'"
      class="w-full"
      clearable
      filterable
    >
      <ElOption
        v-for="opt in options"
        :key="String(opt.value)"
        :label="opt.label"
        :value="opt.value"
      />
    </ElSelect>

    <ElRadioGroup
      v-else-if="type === 'radio'"
      v-model="value"
      :disabled="isDisabled"
    >
      <ElRadio
        v-for="opt in options"
        :key="String(opt.value)"
        :value="opt.value"
      >
        {{ opt.label }}
      </ElRadio>
    </ElRadioGroup>

    <ElCheckboxGroup
      v-else-if="type === 'checkbox'"
      v-model="value"
      :disabled="isDisabled"
    >
      <ElCheckbox
        v-for="opt in options"
        :key="String(opt.value)"
        :value="opt.value"
      >
        {{ opt.label }}
      </ElCheckbox>
    </ElCheckboxGroup>

    <ElSwitch
      v-else-if="type === 'switch'"
      v-model="value"
      :disabled="isDisabled"
    />

    <div v-else-if="type === 'divider'" class="lunar-divider">
      {{ props.widget?.label || '分组标题' }}
    </div>

    <ElInput
      v-else
      v-model="value"
      :disabled="isDisabled"
      :placeholder="placeholder"
    />
  </div>
</template>

<style scoped>
.lunar-run-widget {
  width: 100%;
}

.w-full {
  width: 100%;
}

.lunar-range {
  display: flex;
  gap: 8px;
  align-items: center;
  width: 100%;
}

.range-input {
  flex: 1;
  min-width: 0;
}

.range-sep {
  flex: none;
  color: var(--el-text-color-secondary);
}

.lunar-divider {
  padding-bottom: 4px;
  font-weight: 600;
  color: var(--el-text-color-regular);
  border-bottom: 1px dashed var(--el-border-color);
}
</style>
