<script lang="ts" setup>
/**
 * OAuth2 Scope 定义管理。
 *
 * 这里只维护「scope 是什么」（名称 + 授权确认页说明）；
 * 某个客户端允许哪些 scope 在客户端编辑表单里配置，
 * 两边通过 oauth2_client.scopes JSON 列关联。
 */
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { OAuth2ScopeDefinition } from '#/api/system';

import { ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  ElButton,
  ElForm,
  ElFormItem,
  ElInput,
  ElTag,
} from 'element-plus';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteScopeDefinition,
  getScopeDefinitions,
  saveScopeDefinition,
  toGridList,
} from '#/api/system';

import { PERM } from '../shared/constants';
import FormDialog from '../shared/FormDialog.vue';
import { confirmAction, usePermission, withFeedback } from '../shared/helpers';
import { formatLabel, L } from '../shared/labels';

const { has } = usePermission();
const dialogVisible = ref(false);
const editing = ref<null | OAuth2ScopeDefinition>(null);
const saving = ref(false);
const formModel = ref({ description: '', scope: '' });

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: [
      { field: 'scope', title: L.scope.scopeName, minWidth: 200 },
      { field: 'description', title: L.scope.description, minWidth: 360 },
      {
        field: 'clientCount',
        slots: { default: 'clientCount' },
        title: L.scope.clientCount,
        width: 130,
      },
      {
        field: 'builtIn',
        slots: { default: 'builtIn' },
        title: L.scope.scopeType,
        width: 100,
      },
      {
        align: 'center',
        field: 'operation',
        fixed: 'right',
        slots: { default: 'action' },
        title: L.common.action,
        width: 160,
      },
    ],
    height: 'auto',
    pagerConfig: { enabled: false },
    proxyConfig: {
      ajax: {
        query: async () => {
          const list = (await getScopeDefinitions()) ?? [];
          return toGridList(list);
        },
      },
    },
    rowConfig: { keyField: 'scope' },
    toolbarConfig: { custom: true, refresh: true, zoom: true },
  } as VxeTableGridOptions<OAuth2ScopeDefinition>,
});

function openCreate() {
  editing.value = null;
  formModel.value = { description: '', scope: '' };
  dialogVisible.value = true;
}

function openEdit(row: OAuth2ScopeDefinition) {
  editing.value = row;
  formModel.value = { description: row.description ?? '', scope: row.scope };
  dialogVisible.value = true;
}

async function onSubmit() {
  const scope = formModel.value.scope.trim();
  if (!scope) {
    return;
  }
  saving.value = true;
  try {
    const ok = await withFeedback(() =>
      saveScopeDefinition({
        description: formModel.value.description.trim() || undefined,
        scope,
      }),
    );
    if (ok) {
      dialogVisible.value = false;
      gridApi.reload();
    }
  } finally {
    saving.value = false;
  }
}

async function onDelete(row: OAuth2ScopeDefinition) {
  const message = row.clientCount
    ? `${formatLabel(L.scope.deleteConfirm, row.scope)} ${formatLabel(
        L.scope.inUseTip,
        row.clientCount,
      )}`
    : formatLabel(L.scope.deleteConfirm, row.scope);
  const confirmed = await confirmAction(message, L.common.delete);
  if (!confirmed) {
    return;
  }
  const ok = await withFeedback(
    () => deleteScopeDefinition(row.scope),
    L.common.deleteSuccess,
  );
  if (ok) {
    gridApi.reload();
  }
}
</script>

<template>
  <Page auto-content-height>
    <FormDialog
      v-model="dialogVisible"
      :loading="saving"
      :title="
        editing
          ? `${L.common.edit}${L.nav.scope}`
          : `${L.common.create}${L.nav.scope}`
      "
      @confirm="onSubmit"
    >
      <ElForm :model="formModel" label-position="top">
        <ElFormItem :label="L.scope.scopeName">
          <ElInput
            v-model="formModel.scope"
            :disabled="!!editing"
            :placeholder="L.scope.scopeNameTip"
          />
        </ElFormItem>
        <ElFormItem :label="L.scope.description">
          <ElInput
            v-model="formModel.description"
            :placeholder="L.scope.descriptionTip"
            :rows="3"
            type="textarea"
          />
        </ElFormItem>
      </ElForm>
    </FormDialog>

    <Grid :table-title="L.nav.scope">
      <template #toolbar-tools>
        <ElButton
          v-if="has(PERM.scope.save)"
          type="primary"
          size="small"
          @click="openCreate"
        >
          {{ L.common.add }}
        </ElButton>
        <ElButton size="small" @click="gridApi.reload()">
          {{ L.common.refresh }}
        </ElButton>
      </template>

      <template #clientCount="{ row }">
        {{ row.clientCount ?? 0 }}
      </template>

      <template #builtIn="{ row }">
        <ElTag v-if="row.builtIn" size="small" type="info">
          {{ L.scope.builtInTag }}
        </ElTag>
        <span v-else class="text-gray-400">-</span>
      </template>

      <template #action="{ row }">
        <ElButton
          v-if="has(PERM.scope.save)"
          link
          type="primary"
          size="small"
          @click="openEdit(row)"
        >
          {{ L.common.edit }}
        </ElButton>
        <ElButton
          v-if="has(PERM.scope.remove) && !row.builtIn"
          link
          type="danger"
          size="small"
          @click="onDelete(row)"
        >
          {{ L.common.delete }}
        </ElButton>
      </template>
    </Grid>
  </Page>
</template>
