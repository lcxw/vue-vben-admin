<script lang="ts" setup>
import { computed } from 'vue';

import { ElTag } from 'element-plus';

import { L } from './labels';

const props = defineProps<{
  value?: boolean | null | number | string;
}>();

const enabled = computed(
  () =>
    !(
      props.value === false ||
      props.value === 0 ||
      props.value === '0' ||
      props.value === 'false'
    ),
);
</script>

<template>
  <ElTag :type="enabled ? 'success' : 'info'" size="small" effect="light">
    {{ enabled ? L.common.enabled : L.common.disabled }}
  </ElTag>
</template>
