<script setup lang="ts">
import { aiMcpApi } from '#/api/ai';
import ConfigPage from '../components/ConfigPage.vue';

const api = {
  ...aiMcpApi,
  extra: [
    { label: '工具', call: (row: any) => aiMcpApi.tools(row.code) },
    { label: '重载', call: () => aiMcpApi.reload() },
  ],
};
</script>

<template>
  <ConfigPage
    title="MCP 配置"
    :api="api"
    :columns="[
      { prop: 'code', label: '编码' },
      { prop: 'name', label: '名称' },
      { prop: 'transport', label: '传输' },
      { prop: 'url', label: 'URL / 命令' },
    ]"
    :fields="[
      { prop: 'code', label: '编码' },
      { prop: 'name', label: '名称' },
      {
        prop: 'transport',
        label: '传输',
        type: 'select',
        options: [
          { label: 'Streamable HTTP', value: 'STREAMABLE_HTTP' },
          { label: 'SSE', value: 'SSE' },
          { label: 'STDIO（白名单）', value: 'STDIO' },
        ],
      },
      { prop: 'url', label: 'URL' },
      { prop: 'commandLine', label: 'STDIO 命令' },
      { prop: 'argsJson', label: 'STDIO 参数 JSON' },
      { prop: 'headersJson', label: '请求头 JSON（留空不修改）', type: 'textarea' },
    ]"
  />
</template>
