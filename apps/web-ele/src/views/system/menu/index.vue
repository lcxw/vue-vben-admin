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
  getPermissionTree,
  toGridList,
  updatePermission,
} from '#/api/system';

import { MENU_TYPE_LABEL, PERM } from '../shared/constants';
import FormDialog from '../shared/FormDialog.vue';
import { confirmAction, usePermission, withFeedback } from '../shared/helpers';
import { formatLabel, L } from '../shared/labels';
import StatusTag from '../shared/StatusTag.vue';
import MenuForm from './MenuForm.vue';

const { has } = usePermission();
const nodes = ref<PermissionNode[]>([]);
const dialogVisible = ref(false);
const editing = ref<null | PermissionNode>(null);
const defaultParentId = ref<null | string>(null);
const saving = ref(false);
const formRef = ref<null | {
  submit: () => Promise<null | PermissionFormData>;
}>(null);

/** 菜单视图排除按钮（type='3'），但保留原有父子层级 */
function filterMenuTree(list: PermissionNode[]): PermissionNode[] {
  return list
    .filter((node) => node.type !== '3')
    .map((node) => ({
      ...node,
      children: filterMenuTree(node.children ?? []),
    }));
}

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: [
      {
        align: 'left',
        field: 'name',
        minWidth: 220,
        title: L.menu.name,
        treeNode: true,
      },
      { field: 'code', minWidth: 160, title: L.menu.code },
      {
        field: 'type',
        formatter: ({ cellValue }: { cellValue: unknown }) =>
          MENU_TYPE_LABEL[String(cellValue)] ?? String(cellValue ?? '-'),
        title: L.menu.type,
        width: 110,
      },
      { field: 'path', minWidth: 170, title: L.menu.path },
      { field: 'component', minWidth: 200, title: L.menu.component },
      { field: 'icon', minWidth: 150, title: L.menu.icon },
      { field: 'sortable', title: L.menu.sortable, width: 90 },
      {
        field: 'enabled',
        slots: { default: 'status' },
        title: L.common.status,
        width: 100,
      },
      {
        align: 'center',
        field: 'operation',
        fixed: 'right',
        slots: { default: 'action' },
        title: L.common.action,
        width: 220,
      },
    ],
    height: 'auto',
    pagerConfig: { enabled: false },
    proxyConfig: {
      ajax: {
        query: async () => {
          nodes.value = (await getPermissionTree()) ?? [];
          return toGridList(filterMenuTree(nodes.value));
        },
      },
    },
    rowConfig: { keyField: 'id' },
    toolbarConfig: { custom: true, refresh: true, zoom: true },
    treeConfig: { childrenField: 'children', expandAll: true },
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
    formatLabel(L.menu.deleteConfirm, row.name ?? row.id),
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
          ? `${L.common.edit}${L.nav.menu}`
          : `${L.common.create}${L.nav.menu}`
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
        default-type="0"
      />
    </FormDialog>

    <Grid :table-title="L.nav.menu">
      <template #toolbar-tools>
        <ElButton
          v-if="has(PERM.permission.add)"
          type="primary"
          size="small"
          @click="openCreate()"
        >
          {{ L.common.add }}{{ L.menu.rootMenu }}
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
          v-if="has(PERM.permission.add)"
          link
          type="primary"
          size="small"
          @click="openCreate(row.id)"
        >
          {{ L.dept.addChild }}
        </ElButton>
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
