<script setup lang="ts">
import { aiSkillApi } from '#/api/ai';
import ConfigPage from '../components/ConfigPage.vue';
</script>

<template>
  <ConfigPage
    title="技能配置"
    :api="aiSkillApi"
    :columns="[
      { prop: 'code', label: '编码' },
      { prop: 'name', label: '名称' },
      { prop: 'scope', label: '范围' },
      { prop: 'version', label: '版本' },
    ]"
    :fields="[
      { prop: 'code', label: '编码' },
      { prop: 'name', label: '名称' },
      { prop: 'description', label: '描述' },
      {
        prop: 'scope',
        label: '范围',
        type: 'select',
        options: [
          { label: '全局', value: 'GLOBAL' },
          { label: '专家', value: 'EXPERT' },
        ],
      },
      { prop: 'version', label: '版本' },
      { prop: 'contentMd', label: 'Markdown 正文', type: 'textarea' },
    ]"
  />
</template>
