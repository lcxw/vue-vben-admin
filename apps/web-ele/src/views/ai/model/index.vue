<script setup lang="ts">
import { aiModelApi } from '#/api/ai';

import ConfigPage from '../components/ConfigPage.vue';

const api = {
  ...aiModelApi,
  extra: [
    { label: '复制', call: (row: any) => aiModelApi.copy(row.id) },
    { label: '测试', call: (row: any) => aiModelApi.test(row.id) },
  ],
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
      { prop: 'endpointPath', label: '端点' },
    ]"
    :fields="[
      { prop: 'code', label: '编码' },
      { prop: 'name', label: '名称' },
      {
        prop: 'provider',
        label: '类型',
        type: 'select',
        options: [
          { label: 'OpenAI 兼容对话', value: 'OPENAI_COMPATIBLE' },
          { label: 'OpenAI 兼容 Embedding', value: 'OPENAI_EMBEDDING' },
          { label: '本地哈希向量（联调）', value: 'LOCAL_HASH' },
        ],
      },
      { prop: 'modelName', label: '模型名' },
      { prop: 'baseUrl', label: 'BaseUrl' },
      {
        prop: 'endpointPath',
        label: 'API 路径',
        type: 'select',
        options: [
          { label: '/v1/chat/completions', value: '/v1/chat/completions' },
          { label: '/v1/embeddings', value: '/v1/embeddings' },
          { label: '/v1/responses（实验）', value: '/v1/responses' },
        ],
      },
      { prop: 'timeoutMs', label: '超时(ms)' },
      { prop: 'vectorDimensions', label: '向量维度' },
      { prop: 'apiKeyCipher', label: 'API Key（留空不修改）' },
      { prop: 'paramsJson', label: '参数 JSON', type: 'textarea' },
    ]"
  />
</template>
