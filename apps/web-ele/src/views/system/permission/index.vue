<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { PermissionFormData, PermissionNode } from '#/api/system';

import { ref } from 'vue';

import { Page } from '@vben/common-ui';

import { ElButton } from 'element-plus';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  createPermission,
  deletePermission,
  getPermissionList,
  getPermissionTree,
  toGridList,
  updatePermission,
} from '#/api/system';

import MenuForm from '../menu/MenuForm.vue';
import { PERM } from '../shared/constants';
import FormDialog from '../shared/FormDialog.vue';
import {
  confirmAction,
  flattenTree,
  usePermission,
  withFeedback,
} from '../shared/helpers';
import { formatLabel, L } from '../shared/labels';
import StatusTag from '../shared/StatusTag.vue';

const { has } = usePermission();
const nodes = ref<PermissionNode[]>([]);
const menuNameMap = ref<Map<string, string>>(new Map());
const dialogVisible = ref(false);
const editing = ref<null | PermissionNode>(null);
const defaultParentId = ref<null | string>(null);
const saving = ref(false);
const formRef = ref<null | {
  submit: () => Promise<null | PermissionFormData>;
}>(null);

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: [
      { align: 'left', field: 'name', minWidth: 180, title: L.permission.name },
      { field: 'code', minWidth: 180, title: L.permission.code },
      {
        field: 'parentId',
        formatter: ({ cellValue }: { cellValue: unknown }) =>
          cellValue
            ? (menuNameMap.value.get(String(cellValue)) ?? String(cellValue))
            : '-',
        minWidth: 160,
        title: L.permission.parent,
      },
      { field: 'sortable', title: L.permission.sortable, width: 90 },
      {
        field: 'enabled',
        slots: { default: 'status' },
        title: L.common.status,
        width: 100,
      },
      { field: 'description', minWidth: 180, title: L.permission.description },
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
          const [list, tree] = await Promise.all([
            getPermissionList(),
            getPermissionTree(),
          ]);
          const all = list ?? [];
          nodes.value = tree ?? [];
          const map = new Map<string, string>();
          flattenTree(all).forEach((node) =>
            map.set(String(node.id), node.name ?? String(node.id)),
          );
          menuNameMap.value = map;
          return toGridList(all.filter((node) => node.type === '3'));
        },
      },
    },
    rowConfig: { keyField: 'id' },
    toolbarConfig: { custom: true, refresh: true, zoom: true },
  } as VxeTableGridOptions<PermissionNode>,
});

function openCreate(parentId: null | string = null) {
  editing.value = null;
  defaultParentId.value = parentId;
  dialogVisible.value = true;
}

function openEdit(row: PermissionNode) {
  editing.value = row;
  defaultParentId.value = null;
  dialogVisible.value = true;
}

async function onSubmit() {
  const payload = await formRef.value?.submit();
  if (!payload) {
    return;
  }
  saving.value = true;
  try {
    const ok = await withFeedback(() =>
      editing.value ? updatePermission(payload) : createPermission(payload),
    );
    if (ok) {
      dialogVisible.value = false;
      gridApi.reload();
    }
  } finally {
    saving.value = false;
  }
}

async function onDelete(row: PermissionNode) {
  const confirmed = await confirmAction(
    formatLabel(L.common.deleteConfirm, row.name ?? row.id),
    L.common.delete,
  );
  if (!confirmed) {
    return;
  }
  const ok = await withFeedback(
    () => deletePermission(row.id),
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
          ? `${L.common.edit}${L.nav.permission}`
          : `${L.common.create}${L.nav.permission}`
      "
      size="640px"
      @confirm="onSubmit"
    >
      <MenuForm
        v-if="dialogVisible"
        ref="formRef"
        :default-parent-id="defaultParentId"
        :nodes="nodes"
        :record="editing"
        default-type="3"
        fixed-type="3"
      />
    </FormDialog>

    <Grid :table-title="L.nav.permission">
      <template #toolbar-tools>
        <ElButton
          v-if="has(PERM.permission.add)"
          type="primary"
          size="small"
          @click="openCreate()"
        >
          {{ L.common.add }}
        </ElButton>
        <ElButton size="small" @click="gridApi.reload()">
          {{ L.common.refresh }}
        </ElButton>
      </template>

      <template #status="{ row }">
        <StatusTag :value="row.enabled" />
      </template>

      <template #action="{ row }">
        <ElButton
          v-if="has(PERM.permission.update)"
          link
          type="primary"
          size="small"
          @click="openEdit(row)"
        >
          {{ L.common.edit }}
        </ElButton>
        <ElButton
          v-if="has(PERM.permission.remove)"
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
