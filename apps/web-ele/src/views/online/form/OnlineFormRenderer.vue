<script lang="ts" setup>
/**
 * 在线表单运行时渲染器。
 *
 * 契约：schema 来自后端 `/online/form/render` 或 `/flow/runtime/renderForm` 的 OnlineRenderVO。
 * 支持 10 类控件（input/textarea/number/select/radio/checkbox/date/datetime/switch/divider）。
 * 选项来源：控件内联 options 优先，其次 dicts[dictCode]（后端一次装配好）。
 */
import type { OnlineRenderVO, OnlineWidget } from '#/api/online';

import { computed, watch } from 'vue';

import {
  ElCheckbox,
  ElCheckboxGroup,
  ElCol,
  ElDatePicker,
  ElDivider,
  ElForm,
  ElFormItem,
  ElInput,
  ElInputNumber,
  ElOption,
  ElRadio,
  ElRadioGroup,
  ElRow,
  ElSelect,
  ElSwitch,
} from 'element-plus';

const props = withDefaults(
  defineProps<{
    render?: null | OnlineRenderVO;
    disabled?: boolean;
  }>(),
  { render: undefined, disabled: false },
);

/**
 * 表单值：本地可变副本，v-model 双向绑定供父组件提交。
 * 字段值类型由控件决定（string/number/array/boolean），故用 any 记录。
 */
const model = defineModel<Record<string, any>>({ default: () => ({}) });

const widgets = computed<OnlineWidget[]>(() => props.render?.schema?.widgets ?? []);

/** 保持外部注入数据同步（渲染模型异步加载完成后回填）。 */
watch(
  () => props.render?.data,
  (data) => {
    if (!data) return;
    for (const [key, value] of Object.entries(data)) {
      if (!(key in model.value)) {
        model.value[key] = value;
      }
    }
  },
  { deep: true, immediate: true },
);

function optionsOf(widget: OnlineWidget): Array<{ label: string; value: string | number }> {
  if (Array.isArray(widget.options) && widget.options.length > 0) {
    return widget.options;
  }
  if (widget.dictCode && props.render?.dicts?.[widget.dictCode]) {
    return props.render.dicts[widget.dictCode] ?? [];
  }
  return [];
}

function isReadOnly(widget: OnlineWidget): boolean {
  return Boolean(props.disabled || props.render?.readOnly || widget.readonly);
}

function spanOf(widget: OnlineWidget): number {
  const width = Number(widget.width ?? 24);
  return Number.isFinite(width) && width > 0 ? Math.min(24, width) : 24;
}
</script>

<template>
  <div v-if="widgets.length === 0" class="online-form-empty">
    该表单暂未配置控件，请先在「表单管理」中设计并发布。
  </div>
  <ElForm v-else label-position="top" class="online-form-render">
    <ElRow :gutter="16">
      <ElCol
        v-for="widget in widgets"
        :key="widget.fieldKey || widget.label"
        :span="spanOf(widget)"
      >
        <ElDivider v-if="widget.type === 'divider'">
          {{ widget.label || '分组' }}
        </ElDivider>
        <ElFormItem v-else :label="widget.label" :required="widget.required">
          <ElInput
            v-if="widget.type === 'input'"
            v-model="model[widget.fieldKey]"
            :placeholder="widget.placeholder || `请输入${widget.label}`"
            :disabled="isReadOnly(widget)"
            clearable
          />
          <ElInput
            v-else-if="widget.type === 'textarea'"
            v-model="model[widget.fieldKey]"
            type="textarea"
            :rows="3"
            :placeholder="widget.placeholder || `请输入${widget.label}`"
            :disabled="isReadOnly(widget)"
          />
          <ElInputNumber
            v-else-if="widget.type === 'number'"
            v-model="model[widget.fieldKey]"
            :placeholder="widget.placeholder || `请输入${widget.label}`"
            :disabled="isReadOnly(widget)"
            controls-position="right"
            class="!w-full"
          />
          <ElSelect
            v-else-if="widget.type === 'select'"
            v-model="model[widget.fieldKey]"
            :placeholder="widget.placeholder || `请选择${widget.label}`"
            :disabled="isReadOnly(widget)"
            clearable
            class="!w-full"
          >
            <ElOption
              v-for="opt in optionsOf(widget)"
              :key="String(opt.value)"
              :label="opt.label"
              :value="opt.value"
            />
          </ElSelect>
          <ElRadioGroup
            v-else-if="widget.type === 'radio'"
            v-model="model[widget.fieldKey]"
            :disabled="isReadOnly(widget)"
          >
            <ElRadio
              v-for="opt in optionsOf(widget)"
              :key="String(opt.value)"
              :value="opt.value"
            >
              {{ opt.label }}
            </ElRadio>
          </ElRadioGroup>
          <ElCheckboxGroup
            v-else-if="widget.type === 'checkbox'"
            v-model="model[widget.fieldKey]"
            :disabled="isReadOnly(widget)"
          >
            <ElCheckbox
              v-for="opt in optionsOf(widget)"
              :key="String(opt.value)"
              :value="opt.value"
            >
              {{ opt.label }}
            </ElCheckbox>
          </ElCheckboxGroup>
          <ElDatePicker
            v-else-if="widget.type === 'date'"
            v-model="model[widget.fieldKey]"
            type="date"
            value-format="YYYY-MM-DD"
            :placeholder="widget.placeholder || '请选择日期'"
            :disabled="isReadOnly(widget)"
            class="!w-full"
          />
          <ElDatePicker
            v-else-if="widget.type === 'datetime'"
            v-model="model[widget.fieldKey]"
            type="datetime"
            value-format="YYYY-MM-DD HH:mm:ss"
            :placeholder="widget.placeholder || '请选择日期时间'"
            :disabled="isReadOnly(widget)"
            class="!w-full"
          />
          <ElSwitch
            v-else-if="widget.type === 'switch'"
            v-model="model[widget.fieldKey]"
            :disabled="isReadOnly(widget)"
          />
          <span v-else class="online-form-unknown">
            未知控件：{{ widget.type }}
          </span>
        </ElFormItem>
      </ElCol>
    </ElRow>
  </ElForm>
</template>

<style scoped>
.online-form-empty {
  padding: 24px;
  color: var(--el-text-color-secondary);
  text-align: center;
}
.online-form-unknown {
  color: var(--el-color-danger);
}
.online-form-render :deep(.el-form-item) {
  margin-bottom: 12px;
}
</style>
