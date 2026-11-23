<script setup lang="ts">
import { aiExpertApi, aiModelApi, aiPromptApi } from '#/api/ai';
import { onMounted, ref } from 'vue';
import ConfigPage from '../components/ConfigPage.vue';

const models = ref<{ label: string; value: string }[]>([]);
const prompts = ref<{ label: string; value: string }[]>([]);

onMounted(async () => {
  const [modelList, promptList] = await Promise.all([
    aiModelApi.options(),
    aiPromptApi.list(),
  ]);
  models.value = modelList.map((item) => ({ label: item.name, value: item.code }));
  prompts.value = promptList
    .filter((item) => item.status === 'PUBLISHED')
    .map((item) => ({ label: `${item.title}@${item.version}`, value: item.code }));
});
</script>

<template>
  <ConfigPage
    title="专家配置"
    :api="aiExpertApi"
    :columns="[
      { prop: 'code', label: '编码' },
      { prop: 'name', label: '名称' },
      { prop: 'modelCode', label: '模型' },
      { prop: 'promptCode', label: '提示词' },
    ]"
    :fields="[
      { prop: 'code', label: '编码' },
      { prop: 'name', label: '名称' },
      { prop: 'description', label: '描述' },
      { prop: 'avatar', label: '头像 URL' },
      { prop: 'modelCode', label: '模型', type: 'select', options: models },
      { prop: 'promptCode', label: '提示词', type: 'select', options: prompts },
      { prop: 'promptVersion', label: '提示词版本（空=最新）' },
      { prop: 'skillCodesJson', label: '技能编码 JSON', type: 'textarea' },
      { prop: 'mcpCodesJson', label: 'MCP 编码 JSON', type: 'textarea' },
    ]"
  />
</template>
