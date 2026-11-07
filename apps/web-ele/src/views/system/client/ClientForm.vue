<script lang="ts" setup>
/**
 * OAuth2 客户端表单。
 *
 * 校验规则与后端 OAuth2ClientValidator 保持一致：
 * - clientId 只允许 [A-Za-z0-9._~-]
 * - 新增时授权类型不能为空；含 authorization_code 时必须有回调地址
 * - 回调地址必须是绝对 URI，不允许通配符 * 与 fragment
 * - openid 由后端无条件注入，不需要（也不应该）写进 scopes
 */
import type { FormInstance, FormRules } from 'element-plus';

import type { OAuth2Client, OAuth2ClientForm } from '#/api/system';

import { reactive, ref, watch } from 'vue';

import { ElForm, ElFormItem, ElInput, ElMessage } from 'element-plus';

import {
  AUTH_METHOD_OPTIONS,
  GRANT_TYPE_OPTIONS,
  SCOPE_OPTIONS,
} from '../shared/constants';
import { normalizeStringList } from '../shared/helpers';
import JsonSetEditor from '../shared/JsonSetEditor.vue';
import { L } from '../shared/labels';

const props = defineProps<{
  record?: null | OAuth2Client;
}>();

const formRef = ref<FormInstance>();

function createModel(): OAuth2ClientForm {
  return {
    authorizationGrantTypes: ['authorization_code', 'refresh_token'],
    clientAuthenticationMethods: ['none'],
    clientId: '',
    clientName: '',
    clientSecret: '',
    postLogoutRedirectUris: [],
    redirectUris: [],
    scopes: ['profile', 'email'],
  };
}

const model = reactive<OAuth2ClientForm>(createModel());

const rules: FormRules = {
  clientId: [
    { required: true, message: '请输入客户端 ID', trigger: 'blur' },
    {
      pattern: /^[A-Za-z0-9._~-]{1,255}$/,
      message: '只允许字母、数字、. _ ~ -，长度 1~255',
      trigger: 'blur',
    },
  ],
};

watch(
  () => props.record,
  (record) => {
    Object.assign(model, createModel());
    if (record) {
      Object.assign(model, {
        authorizationGrantTypes: [...(record.authorizationGrantTypes ?? [])],
        clientAuthenticationMethods: [
          ...(record.clientAuthenticationMethods ?? []),
        ],
        clientId: record.clientId ?? '',
        clientName: record.clientName ?? '',
        clientSecret: '',
        id: record.id,
        postLogoutRedirectUris: [...(record.postLogoutRedirectUris ?? [])],
        redirectUris: [...(record.redirectUris ?? [])],
        scopes: [...(record.scopes ?? [])],
      });
    }
  },
  { immediate: true },
);

function isValidUri(value: string): boolean {
  if (value.includes('*') || value.includes('#')) {
    return false;
  }
  try {
    const parsed = new URL(value);
    return Boolean(parsed.protocol);
  } catch {
    return false;
  }
}

/** 校验失败时返回 null 并提示，不抛异常，避免父组件出现未处理的 Promise rejection */
async function submit(): Promise<null | OAuth2ClientForm> {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) {
    return null;
  }

  const payload: OAuth2ClientForm = {
    authorizationGrantTypes: normalizeStringList(model.authorizationGrantTypes),
    clientAuthenticationMethods: normalizeStringList(
      model.clientAuthenticationMethods,
    ),
    clientId: model.clientId.trim(),
    clientName: model.clientName?.trim() ?? '',
    postLogoutRedirectUris: normalizeStringList(model.postLogoutRedirectUris),
    redirectUris: normalizeStringList(model.redirectUris),
    scopes: normalizeStringList(model.scopes).filter(
      (item) => item !== 'openid',
    ),
  };

  if (props.record) {
    payload.id = props.record.id;
  } else if (model.clientSecret) {
    payload.clientSecret = model.clientSecret;
  }

  if (payload.authorizationGrantTypes.length === 0) {
    ElMessage.error('至少配置一种授权类型');
    return null;
  }
  if (
    payload.authorizationGrantTypes.includes('authorization_code') &&
    payload.redirectUris.length === 0
  ) {
    ElMessage.error('使用 authorization_code 时至少配置 1 个回调地址');
    return null;
  }
  const uris = [...payload.redirectUris, ...payload.postLogoutRedirectUris];
  const invalidUri = uris.find((uri) => !isValidUri(uri));
  if (invalidUri) {
    ElMessage.error(`回调地址必须是绝对 URI 且不能包含 * 或 #：${invalidUri}`);
    return null;
  }

  return payload;
}

defineExpose({ submit });
</script>

<template>
  <ElForm ref="formRef" :model="model" :rules="rules" label-position="top">
    <ElFormItem :label="L.client.clientId" prop="clientId">
      <ElInput
        v-model="model.clientId"
        :disabled="!!record"
        placeholder="例如 web-spa"
      />
    </ElFormItem>
    <ElFormItem :label="L.client.clientName" prop="clientName">
      <ElInput v-model="model.clientName" />
    </ElFormItem>
    <ElFormItem
      v-if="!record"
      :label="L.client.clientSecret"
      prop="clientSecret"
    >
      <ElInput
        v-model="model.clientSecret"
        type="password"
        show-password
        :placeholder="L.client.clientSecretTip"
      />
    </ElFormItem>

    <div class="mb-2 text-sm font-medium">{{ L.client.jsonColumns }}</div>
    <p class="mb-3 text-xs text-gray-500">{{ L.client.jsonColumnTip }}</p>

    <ElFormItem :label="L.client.authMethods">
      <JsonSetEditor
        v-model="model.clientAuthenticationMethods"
        :suggestions="AUTH_METHOD_OPTIONS"
        placeholder="例如 client_secret_basic"
      />
    </ElFormItem>
    <ElFormItem :label="L.client.grantTypes">
      <JsonSetEditor
        v-model="model.authorizationGrantTypes"
        :suggestions="GRANT_TYPE_OPTIONS"
        placeholder="例如 authorization_code"
      />
    </ElFormItem>
    <ElFormItem :label="L.client.redirectUris">
      <JsonSetEditor
        v-model="model.redirectUris"
        placeholder="例如 http://127.0.0.1:5777/oauth2/callback"
      />
    </ElFormItem>
    <ElFormItem :label="L.client.postLogoutRedirectUris">
      <JsonSetEditor
        v-model="model.postLogoutRedirectUris"
        placeholder="例如 http://127.0.0.1:5777/"
      />
    </ElFormItem>
    <ElFormItem :label="L.client.scopes">
      <JsonSetEditor
        v-model="model.scopes"
        :suggestions="SCOPE_OPTIONS"
        placeholder="例如 profile"
      />
    </ElFormItem>
  </ElForm>
</template>
