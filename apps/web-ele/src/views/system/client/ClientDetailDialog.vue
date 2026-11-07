<script lang="ts" setup>
import type { OAuth2Client } from '#/api/system';

import { computed, ref, watch } from 'vue';

import {
  ElButton,
  ElDescriptions,
  ElDescriptionsItem,
  ElDialog,
  ElTag,
} from 'element-plus';

import { getClientDetail } from '#/api/system';

import { L } from '../shared/labels';

const props = defineProps<{
  clientId: null | string;
  modelValue: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
});

const loading = ref(false);
const detail = ref<null | OAuth2Client>(null);

async function load() {
  if (!visible.value || !props.clientId) {
    return;
  }
  loading.value = true;
  try {
    detail.value = await getClientDetail(props.clientId);
  } catch (error) {
    console.error('[system/client] load detail failed', error);
  } finally {
    loading.value = false;
  }
}

watch(
  () => [visible.value, props.clientId] as const,
  () => {
    if (visible.value) {
      void load();
    }
  },
  { immediate: true },
);

function tagList(values?: string[]) {
  return values ?? [];
}
</script>

<template>
  <ElDialog
    v-model="visible"
    :title="L.client.detailTitle"
    width="760px"
    destroy-on-close
  >
    <div v-loading="loading" class="min-h-[200px]">
      <ElDescriptions :column="2" border size="small">
        <ElDescriptionsItem :label="L.client.clientId">
          {{ detail?.clientId ?? '-' }}
        </ElDescriptionsItem>
        <ElDescriptionsItem :label="L.client.clientName">
          {{ detail?.clientName ?? '-' }}
        </ElDescriptionsItem>
        <ElDescriptionsItem :label="L.client.issuedAt">
          {{ detail?.clientIdIssuedAt ?? '-' }}
        </ElDescriptionsItem>
        <ElDescriptionsItem :label="L.client.clientSecret">
          {{ L.client.secretMask }}
        </ElDescriptionsItem>
        <ElDescriptionsItem :label="L.client.authMethods" :span="2">
          <div class="flex flex-wrap gap-1">
            <ElTag
              v-for="item in tagList(detail?.clientAuthenticationMethods)"
              :key="item"
              size="small"
            >
              {{ item }}
            </ElTag>
          </div>
        </ElDescriptionsItem>
        <ElDescriptionsItem :label="L.client.grantTypes" :span="2">
          <div class="flex flex-wrap gap-1">
            <ElTag
              v-for="item in tagList(detail?.authorizationGrantTypes)"
              :key="item"
              size="small"
              type="success"
            >
              {{ item }}
            </ElTag>
          </div>
        </ElDescriptionsItem>
        <ElDescriptionsItem :label="L.client.scopes" :span="2">
          <div class="flex flex-wrap gap-1">
            <ElTag
              v-for="item in tagList(detail?.scopes)"
              :key="item"
              size="small"
              type="warning"
            >
              {{ item }}
            </ElTag>
          </div>
        </ElDescriptionsItem>
        <ElDescriptionsItem :label="L.client.redirectUris" :span="2">
          <div class="flex flex-col gap-1">
            <span v-for="item in tagList(detail?.redirectUris)" :key="item">
              {{ item }}
            </span>
          </div>
        </ElDescriptionsItem>
        <ElDescriptionsItem :label="L.client.postLogoutRedirectUris" :span="2">
          <div class="flex flex-col gap-1">
            <span
              v-for="item in tagList(detail?.postLogoutRedirectUris)"
              :key="item"
            >
              {{ item }}
            </span>
          </div>
        </ElDescriptionsItem>
        <ElDescriptionsItem :label="L.client.tokenSettings" :span="2">
          accessToken TTL：{{ detail?.accessTokenTimeToLive ?? '-' }} 分钟 /
          refreshToken TTL：{{ detail?.refreshTokenTimeToLive ?? '-' }} 分钟 /
          tokenFormat：{{ detail?.tokenFormat ?? '-' }}
        </ElDescriptionsItem>
        <ElDescriptionsItem :label="L.client.clientSettings" :span="2">
          需要 PKCE：{{ detail?.requireProofKey ? '是' : '否' }} /
          需要授权确认：{{
            detail?.requireAuthorizationConsent ? '是' : '否'
          }}
          / 复用 refresh token：{{ detail?.reuseRefreshTokens ? '是' : '否' }}
        </ElDescriptionsItem>
      </ElDescriptions>
    </div>
    <template #footer>
      <ElButton @click="visible = false">关闭</ElButton>
      <ElButton type="primary" @click="load">{{ L.common.refresh }}</ElButton>
    </template>
  </ElDialog>
</template>
