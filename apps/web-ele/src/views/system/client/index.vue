<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { OAuth2Client, OAuth2ClientForm } from '#/api/system';

import { ref } from 'vue';

import { Page } from '@vben/common-ui';

import { ElButton } from 'element-plus';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  createClient,
  deleteClient,
  getClientDetail,
  getClientPage,
  updateClient,
} from '#/api/system';

import { PERM } from '../shared/constants';
import FormDialog from '../shared/FormDialog.vue';
import { confirmAction, usePermission, withFeedback } from '../shared/helpers';
import { formatLabel, L } from '../shared/labels';
import ClientDetailDialog from './ClientDetailDialog.vue';
import ClientForm from './ClientForm.vue';

const { has } = usePermission();
const dialogVisible = ref(false);
const editing = ref<null | OAuth2Client>(null);
const saving = ref(false);
const formRef = ref<null | {
  submit: () => Promise<null | OAuth2ClientForm>;
}>(null);

const detailVisible = ref(false);
const detailId = ref<null | string>(null);

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: [
      { field: 'clientId', title: L.client.clientId, minWidth: 180 },
      { field: 'clientName', title: L.client.clientName, minWidth: 160 },
      {
        field: 'authorizationGrantTypes',
        title: L.client.grantTypes,
        minWidth: 220,
        slots: { default: 'grantTypes' },
      },
      {
        field: 'redirectUris',
        title: L.client.redirectUris,
        minWidth: 240,
        formatter: ({ cellValue }: { cellValue: unknown }) =>
          Array.isArray(cellValue) ? cellValue.join(', ') : '-',
      },
      {
        field: 'scopes',
        title: L.client.scopes,
        minWidth: 180,
        formatter: ({ cellValue }: { cellValue: unknown }) =>
          Array.isArray(cellValue) ? cellValue.join(', ') : '-',
      },
      { field: 'clientIdIssuedAt', title: L.client.issuedAt, width: 180 },
      {
        align: 'center',
        field: 'operation',
        fixed: 'right',
        slots: { default: 'action' },
        title: L.common.action,
        width: 200,
      },
    ],
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      // 后端 page 从 0 开始，getClientPage 内部已做 -1 转换
      ajax: {
        query: async ({ page }) =>
          await getClientPage(page.currentPage, page.pageSize),
      },
    },
    rowConfig: { keyField: 'id' },
    toolbarConfig: { custom: true, refresh: true, zoom: true },
  } as VxeTableGridOptions<OAuth2Client>,
});

function openCreate() {
  editing.value = null;
  dialogVisible.value = true;
}

/** 编辑前拉一次详情：分页列表只保证主表字段，聚合列以 /details/{id} 为准 */
async function openEdit(row: OAuth2Client) {
  try {
    editing.value = await getClientDetail(row.id);
  } catch (error) {
    console.error('[system/client] load detail before edit failed', error);
    editing.value = row;
  }
  dialogVisible.value = true;
}

function openDetail(row: OAuth2Client) {
  detailId.value = row.id;
  detailVisible.value = true;
}

async function onSubmit() {
  const payload = await formRef.value?.submit();
  if (!payload) {
    return;
  }
  saving.value = true;
  try {
    const ok = await withFeedback(() =>
      editing.value ? updateClient(payload) : createClient(payload),
    );
    if (ok) {
      dialogVisible.value = false;
      gridApi.query();
    }
  } finally {
    saving.value = false;
  }
}

async function onDelete(row: OAuth2Client) {
  const confirmed = await confirmAction(
    formatLabel(L.client.deleteConfirm, row.clientId),
    L.common.delete,
  );
  if (!confirmed) {
    return;
  }
  const ok = await withFeedback(
    () => deleteClient(row.id),
    L.common.deleteSuccess,
  );
  if (ok) {
    gridApi.query();
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
          ? `${L.common.edit}${L.nav.client}`
          : `${L.common.create}${L.nav.client}`
      "
      size="680px"
      @confirm="onSubmit"
    >
      <ClientForm v-if="dialogVisible" ref="formRef" :record="editing" />
    </FormDialog>

    <ClientDetailDialog v-model="detailVisible" :client-id="detailId" />

    <Grid :table-title="L.nav.client">
      <template #toolbar-tools>
        <ElButton
          v-if="has(PERM.client.add)"
          type="primary"
          size="small"
          @click="openCreate"
        >
          {{ L.common.add }}
        </ElButton>
        <ElButton size="small" @click="gridApi.query()">
          {{ L.common.refresh }}
        </ElButton>
      </template>

      <template #grantTypes="{ row }">
        <span class="text-xs">
          {{ (row.authorizationGrantTypes ?? []).join('、') || '-' }}
        </span>
      </template>

      <template #action="{ row }">
        <ElButton link type="primary" size="small" @click="openDetail(row)">
          {{ L.common.detail }}
        </ElButton>
        <ElButton
          v-if="has(PERM.client.update)"
          link
          type="primary"
          size="small"
          @click="openEdit(row)"
        >
          {{ L.common.edit }}
        </ElButton>
        <ElButton
          v-if="has(PERM.client.remove)"
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
