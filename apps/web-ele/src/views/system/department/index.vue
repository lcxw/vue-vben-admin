<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { DepartmentFormData, DepartmentNode } from '#/api/system';

import { ref } from 'vue';

import { Page } from '@vben/common-ui';

import { ElButton } from 'element-plus';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  createDepartment,
  deleteDepartment,
  getDepartmentTree,
  toGridList,
  updateDepartment,
} from '#/api/system';

import { PERM } from '../shared/constants';
import FormDialog from '../shared/FormDialog.vue';
import { confirmAction, usePermission, withFeedback } from '../shared/helpers';
import { formatLabel, L } from '../shared/labels';
import StatusTag from '../shared/StatusTag.vue';
import DeptForm from './DeptForm.vue';

const { has } = usePermission();
const nodes = ref<DepartmentNode[]>([]);
const dialogVisible = ref(false);
const editing = ref<DepartmentNode | null>(null);
const defaultParentId = ref<null | number>(null);
const saving = ref(false);
const formRef = ref<null | {
  submit: () => Promise<DepartmentFormData | null>;
}>(null);

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: [
      {
        field: 'name',
        title: L.dept.name,
        treeNode: true,
        minWidth: 220,
        align: 'left',
      },
      { field: 'code', title: L.dept.code, minWidth: 140 },
      {
        field: 'isCompany',
        title: L.dept.isCompany,
        width: 110,
        formatter: ({ cellValue }: { cellValue: unknown }) =>
          cellValue ? '是' : '否',
      },
      { field: 'sortOrder', title: L.dept.sortOrder, width: 90 },
      {
        field: 'enabled',
        title: L.common.status,
        width: 100,
        slots: { default: 'status' },
      },
      { field: 'description', title: L.dept.description, minWidth: 180 },
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
          nodes.value = (await getDepartmentTree()) ?? [];
          return toGridList(nodes.value);
        },
      },
    },
    rowConfig: { keyField: 'id' },
    toolbarConfig: { custom: true, refresh: true, zoom: true },
    treeConfig: { childrenField: 'children', expandAll: true },
  } as VxeTableGridOptions<DepartmentNode>,
});

function openCreate(parentId: null | number = null) {
  editing.value = null;
  defaultParentId.value = parentId;
  dialogVisible.value = true;
}

function openEdit(row: DepartmentNode) {
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
      editing.value ? updateDepartment(payload) : createDepartment(payload),
    );
    if (ok) {
      dialogVisible.value = false;
      gridApi.reload();
    }
  } finally {
    saving.value = false;
  }
}

async function onDelete(row: DepartmentNode) {
  const confirmed = await confirmAction(
    formatLabel(L.dept.deleteConfirm, row.name ?? row.id),
    L.common.delete,
  );
  if (!confirmed) {
    return;
  }
  const ok = await withFeedback(
    () => deleteDepartment(Number(row.id)),
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
          ? `${L.common.edit}${L.dept.name}`
          : `${L.common.create}${L.dept.name}`
      "
      @confirm="onSubmit"
    >
      <DeptForm
        v-if="dialogVisible"
        ref="formRef"
        :default-parent-id="defaultParentId"
        :nodes="nodes"
        :record="editing"
      />
    </FormDialog>

    <Grid :table-title="L.dept.tree">
      <template #toolbar-tools>
        <ElButton
          v-if="has(PERM.department.add)"
          type="primary"
          size="small"
          @click="openCreate()"
        >
          {{ L.common.add }}根节点
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
          v-if="has(PERM.department.add)"
          link
          type="primary"
          size="small"
          @click="openCreate(Number(row.id))"
        >
          {{ L.dept.addChild }}
        </ElButton>
        <ElButton
          v-if="has(PERM.department.update)"
          link
          type="primary"
          size="small"
          @click="openEdit(row)"
        >
          {{ L.common.edit }}
        </ElButton>
        <ElButton
          v-if="has(PERM.department.remove)"
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
