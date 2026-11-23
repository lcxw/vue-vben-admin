<script setup lang="ts">
import { aiPromptApi } from '#/api/ai';
import ConfigPage from '../components/ConfigPage.vue';

const api = {
  ...aiPromptApi,
  extra: [{ label: '发布', call: (row: any) => aiPromptApi.publish(row.id) }],
};
</script>

<template>
  <ConfigPage
    title="提示词管理"
    :api="api"
    :show-status="false"
    :columns="[
      { prop: 'code', label: '编码' },
      { prop: 'title', label: '标题' },
      { prop: 'version', label: '版本' },
      { prop: 'status', label: '状态' },
    ]"
    :fields="[
      { prop: 'code', label: '编码' },
      { prop: 'title', label: '标题' },
      { prop: 'version', label: '版本' },
      { prop: 'variablesJson', label: '变量 JSON' },
      { prop: 'content', label: '提示词正文', type: 'textarea' },
    ]"
  />
</template>
