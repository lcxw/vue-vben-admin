<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { ElButton } from 'element-plus';

import { useAuthStore } from '#/store';

defineOptions({ name: 'OAuth2Callback' });

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const errorMessage = ref('');

onMounted(async () => {
  const {
    code,
    error,
    error_description: errorDescription,
    state,
  } = route.query;

  if (error) {
    errorMessage.value = String(errorDescription || error);
    return;
  }
  if (!code || !state) {
    errorMessage.value = '缺少授权码或 state 参数';
    return;
  }

  try {
    await authStore.authByOAuth2Code(String(code), String(state));
  } catch (error_: any) {
    errorMessage.value =
      error_?.response?.data?.error_description ||
      error_?.message ||
      '授权码换取令牌失败';
  }
});

function backToLogin() {
  router.replace('/auth/login');
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-background p-6">
    <div class="flex flex-col items-center gap-4 text-center">
      <template v-if="!errorMessage">
        <p class="text-lg font-medium">正在完成登录…</p>
        <p class="text-sm text-muted-foreground">正在用授权码换取令牌</p>
      </template>
      <template v-else>
        <p class="text-lg font-medium">登录失败</p>
        <p class="max-w-md text-sm text-muted-foreground">{{ errorMessage }}</p>
        <ElButton type="primary" @click="backToLogin">返回登录</ElButton>
      </template>
    </div>
  </div>
</template>
