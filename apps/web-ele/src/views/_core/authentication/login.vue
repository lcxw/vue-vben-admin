<script lang="ts" setup>
import { ref } from 'vue';
import { useRoute } from 'vue-router';

import { ElButton } from 'element-plus';

import { redirectToOAuth2Authorize } from '#/api/core/oauth';

defineOptions({ name: 'Login' });

const route = useRoute();
const loading = ref(false);

async function handleLogin() {
  loading.value = true;
  const redirect = route.query.redirect
    ? decodeURIComponent(String(route.query.redirect))
    : undefined;
  try {
    // 整页跳转到授权服务器，认证过程完全由 IdP 负责，前端不接触密码
    await redirectToOAuth2Authorize(redirect);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="flex w-full flex-col items-center gap-6 py-6">
    <p class="text-center text-sm text-muted-foreground">
      通过统一身份认证登录系统
    </p>
    <ElButton
      class="w-full"
      :loading="loading"
      size="large"
      type="primary"
      @click="handleLogin"
    >
      统一认证登录
    </ElButton>
  </div>
</template>
