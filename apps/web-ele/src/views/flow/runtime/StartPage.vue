<script lang="ts" setup>
/** 发起流程入口页：复用 StartDialog，发起成功后跳到「我发起的」。 */
import { ref } from 'vue';
import { useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';

import { ElButton } from 'element-plus';

import StartDialog from './StartDialog.vue';

const router = useRouter();
const visible = ref(false);

function onChanged() {
  router.push('/flow/runtime/mine');
}
</script>

<template>
  <Page auto-content-height>
    <div class="start-panel">
      <h2>发起流程</h2>
      <p>选择已发布且有激活主版本的流程定义，填写标题与业务数据后发起。</p>
      <p>也可以暂存为草稿，稍后在「我发起的」中再提交。</p>
      <ElButton type="primary" @click="visible = true">新建流程实例</ElButton>
    </div>
    <StartDialog v-model="visible" @changed="onChanged" />
  </Page>
</template>

<style scoped>
.start-panel {
  padding: 24px;
  color: var(--el-text-color-primary);
}

.start-panel h2 {
  margin: 0 0 12px;
  font-size: 18px;
  font-weight: 600;
}

.start-panel p {
  margin: 0 0 8px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}

.start-panel .el-button {
  margin-top: 16px;
}
</style>
