<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { OAuth2Scope } from '#/api/system';

import { ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  ElButton,
  ElForm,
  ElFormItem,
  ElInput,
  ElOption,
  ElSelect,
} from 'element-plus';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteScope,
  getClientPage,
  getScopeList,
  saveScope,
  toGridList,
} from '#/api/system';

import { PERM, SCOPE_OPTIONS } from '../shared/constants';
import FormDialog from '../shared/FormDialog.vue';
import { confirmAction, usePermission, withFeedback } from '../shared/helpers';
import { formatLabel, L } from '../shared/labels';

const { has } = usePermission();
const clientFilter = ref('');
const clientOptions = ref<string[]>([]);
const dialogVisible = ref(false);
const saving = ref(false);
const formModel = ref({ clientId: '', scope: '' });

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: [
      { field: 'clientId', title: L.scope.clientId, minWidth: 220 },
      { field: 'scope', title: L.scope.scopeName, minWidth: 200 },
      { field: 'description', title: L.scope.description, minWidth: 200 },
      {
        align: 'center',
        field: 'operation',
        fixed: 'right',
        slots: { default: 'action' },
        title: L.common.action,
        width: 120,
      },
    ],
    height: 'auto',
    pagerConfig: { enabled: false },
    proxyConfig: {
      ajax: {
        query: async () => {
          const list = (await getScopeList()) ?? [];
          const ids = new Set(list.map((item) => item.clientId));
          clientOptions.value = [...ids];
          return toGridList(
            clientFilter.value
              ? list.filter((item) => item.clientId === clientFilter.value)
              : list,
          );
        },
      },
    },
    rowConfig: { keyField: 'scope' },
    toolbarConfig: { custom: true, refresh: true, zoom: true },
  } as VxeTableGridOptions<OAuth2Scope>,
});

async function loadClients() {
  try {
    const page = await getClientPage(1, 1000);
    clientOptions.value = page.items.map((item) => item.clientId);
  } catch (error) {
    console.error('[system/scope] load clients failed', error);
  }
}

function openCreate() {
  formModel.value = { clientId: clientFilter.value, scope: '' };
  dialogVisible.value = true;
  void loadClients();
}

async function onSubmit() {
  const { clientId, scope } = formModel.value;
  if (!clientId || !scope.trim()) {
    return;
  }
  saving.value = true;
  try {
    const ok = await withFeedback(() =>
      saveScope({ clientId, scope: scope.trim() }),
    );
    if (ok) {
      dialogVisible.value = false;
      gridApi.reload();
    }
  } finally {
    saving.value = false;
  }
}

async function onDelete(row: OAuth2Scope) {
  const confirmed = await confirmAction(
    formatLabel(L.scope.deleteConfirm, row.scope),
    L.common.delete,
  );
  if (!confirmed) {
    return;
  }
  const ok = await withFeedback(
    () => deleteScope(row.clientId, row.scope),
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
      :title="`${L.common.add}${L.nav.scope}`"
      @confirm="onSubmit"
    >
      <ElForm :model="formModel" label-position="top">
        <ElFormItem :label="L.scope.clientId">
          <ElSelect
            v-model="formModel.clientId"
            class="w-full"
            filterable
            allow-create
            placeholder="选择或输入客户端 ID"
          >
            <ElOption
              v-for="item in clientOptions"
              :key="item"
              :label="item"
              :value="item"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem :label="L.scope.scopeName">
          <ElInput v-model="formModel.scope" placeholder="例如 profile" />
        </ElFormItem>
        <div class="flex flex-wrap gap-1">
          <ElButton
            v-for="item in SCOPE_OPTIONS"
            :key="item"
            link
            size="small"
            type="primary"
            @click="formModel.scope = item"
          >
            + {{ item }}
          </ElButton>
        </div>
      </ElForm>
    </FormDialog>

    <Grid :table-title="L.nav.scope">
      <template #toolbar-tools>
        <ElSelect
          v-model="clientFilter"
          class="mr-2 w-[220px]"
          clearable
          filterable
          :placeholder="L.scope.clientFilter"
          @change="gridApi.reload()"
        >
          <ElOption
            v-for="item in clientOptions"
            :key="item"
            :label="item"
            :value="item"
          />
        </ElSelect>
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

      <template #action="{ row }">
        <ElButton
          v-if="has(PERM.scope.remove)"
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
