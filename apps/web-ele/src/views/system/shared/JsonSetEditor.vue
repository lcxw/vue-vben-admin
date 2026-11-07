<script lang="ts" setup>
/**
 * OAuth2 客户端 JSON 数组列编辑器。
 *
 * 后端字段是 Set<String>，前端用 string[]；
 * 回车添加、标签删除，支持预设值一键添加（grant_types / scopes 等）。
 */
import { computed, ref } from 'vue';

import { ElButton, ElInput, ElTag } from 'element-plus';

import { normalizeStringList } from './helpers';

const props = withDefaults(
  defineProps<{
    disabled?: boolean;
    modelValue?: null | string[];
    placeholder?: string;
    suggestions?: string[];
  }>(),
  {
    disabled: false,
    modelValue: () => [],
    placeholder: '输入后按回车添加',
    suggestions: () => [],
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: string[]];
}>();

const input = ref('');
const items = computed(() => normalizeStringList(props.modelValue));
const availableSuggestions = computed(() =>
  props.suggestions.filter((item) => !items.value.includes(item)),
);

function add(value: string) {
  const trimmed = value.trim();
  if (!trimmed || props.disabled) {
    return;
  }
  emit('update:modelValue', normalizeStringList([...items.value, trimmed]));
  input.value = '';
}

function remove(value: string) {
  if (props.disabled) {
    return;
  }
  emit(
    'update:modelValue',
    items.value.filter((item) => item !== value),
  );
}
</script>

<template>
  <div class="flex w-full flex-col gap-2">
    <div v-if="items.length > 0" class="flex flex-wrap gap-1">
      <ElTag
        v-for="item in items"
        :key="item"
        :closable="!disabled"
        size="small"
        type="info"
        @close="remove(item)"
      >
        {{ item }}
      </ElTag>
    </div>
    <ElInput
      v-model="input"
      :disabled="disabled"
      :placeholder="placeholder"
      clearable
      @keyup.enter="add(input)"
    />
    <div v-if="availableSuggestions.length > 0" class="flex flex-wrap gap-1">
      <ElButton
        v-for="item in availableSuggestions"
        :key="item"
        :disabled="disabled"
        link
        size="small"
        type="primary"
        @click="add(item)"
      >
        + {{ item }}
      </ElButton>
    </div>
  </div>
</template>
