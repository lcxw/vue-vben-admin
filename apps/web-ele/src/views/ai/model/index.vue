<script setup lang="ts">
import { aiModelApi } from '#/api/ai';
import ConfigPage from '../components/ConfigPage.vue';

const api = {
  ...aiModelApi,
  extra: [{ label: '测试', call: (row: any) => aiModelApi.test(row.id) }],
};
</script>

<template>
  <ConfigPage
    title="模型配置"
    :api="api"
    :columns="[
      { prop: 'code', label: '编码' },
      { prop: 'name', label: '名称' },
      { prop: 'modelName', label: '模型' },
      { prop: 'baseUrl', label: 'BaseUrl' },
    ]"
    :fields="[
      { prop: 'code', label: '编码' },
      { prop: 'name', label: '名称' },
      { prop: 'modelName', label: '模型名' },
      { prop: 'baseUrl', label: 'BaseUrl' },
      { prop: 'apiKeyCipher', label: 'API Key（留空不修改）' },
      { prop: 'paramsJson', label: '参数 JSON', type: 'textarea' },
    ]"
  />
</template>
