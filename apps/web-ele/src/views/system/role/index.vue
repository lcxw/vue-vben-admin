<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { RoleFormData, SystemRole } from '#/api/system';

import { ref } from 'vue';

import { Page } from '@vben/common-ui';

import { ElButton } from 'element-plus';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { createRole, deleteRole, getRolePage, updateRole } from '#/api/system';

import { ENABLE_BOOL_QUERY_OPTIONS, PERM } from '../shared/constants';
import FormDialog from '../shared/FormDialog.vue';
import { confirmAction, usePermission, withFeedback } from '../shared/helpers';
import { formatLabel, L } from '../shared/labels';
import StatusTag from '../shared/StatusTag.vue';
import RoleAssignDialog from './RoleAssignDialog.vue';
import RoleForm from './RoleForm.vue';

interface RoleSearchValues {
  code?: string;
  enable?: string;
  name?: string;
}

const { has } = usePermission();
const dialogVisible = ref(false);
const editing = ref<null | SystemRole>(null);
const saving = ref(false);
const formRef = ref<null | {
  submit: () => Promise<null | RoleFormData>;
}>(null);
const assignVisible = ref(false);
const assignMode = ref<'permission' | 'user'>('permission');
const assignRole = ref<null | SystemRole>(null);

const searchSchema: VbenFormSchema[] = [
  { component: 'Input', fieldName: 'name', label: L.role.name },
  { component: 'Input', fieldName: 'code', label: L.role.code },
  {
    component: 'Select',
    fieldName: 'enable',
    label: L.common.status,
    componentProps: {
      clearable: true,
      options: ENABLE_BOOL_QUERY_OPTIONS,
      placeholder: '全部',
    },
  },
];

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: { schema: searchSchema, submitOnChange: true },
  gridOptions: {
    columns: [
      { field: 'code', title: L.role.code, minWidth: 150 },
      { field: 'name', title: L.role.name, minWidth: 140 },
      { field: 'description', title: L.role.description, minWidth: 200 },
      {
        field: 'enabled',
        title: L.common.status,
        width: 100,
        slots: { default: 'status' },
      },
      { field: 'createTime', title: '创建时间', width: 180 },
      {
        align: 'center',
        field: 'operation',
        fixed: 'right',
        slots: { default: 'action' },
        title: L.common.action,
        width: 280,
      },
    ],
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues: RoleSearchValues) =>
          await getRolePage({
            code: formValues?.code,
            enable:
              formValues?.enable === undefined
                ? undefined
                : String(formValues.enable),
            name: formValues?.name,
            pageNum: page.currentPage,
            pageSize: page.pageSize,
          }),
      },
    },
    rowConfig: { keyField: 'id' },
    toolbarConfig: { custom: true, refresh: true, search: true, zoom: true },
  } as VxeTableGridOptions<SystemRole>,
});

function openCreate() {
  editing.value = null;
  dialogVisible.value = true;
}

function openEdit(row: SystemRole) {
  editing.value = row;
  dialogVisible.value = true;
}

function openAssign(mode: 'permission' | 'user', row: SystemRole) {
  assignMode.value = mode;
  assignRole.value = row;
  assignVisible.value = true;
}

async function onSubmit() {
  const payload = await formRef.value?.submit();
  if (!payload) {
    return;
  }
  saving.value = true;
  try {
    const ok = await withFeedback(() =>
      editing.value ? updateRole(payload) : createRole(payload),
    );
    if (ok) {
      dialogVisible.value = false;
      gridApi.query();
    }
  } finally {
    saving.value = false;
  }
}

async function onDelete(row: SystemRole) {
  const confirmed = await confirmAction(
    formatLabel(L.common.deleteConfirm, row.name ?? row.id),
    L.common.delete,
  );
  if (!confirmed) {
    return;
  }
  const ok = await withFeedback(
    () => deleteRole(row.id),
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
          ? `${L.common.edit}${L.nav.role}`
          : `${L.common.create}${L.nav.role}`
      "
      @confirm="onSubmit"
    >
      <RoleForm v-if="dialogVisible" ref="formRef" :record="editing" />
    </FormDialog>

    <RoleAssignDialog
      v-model="assignVisible"
      :mode="assignMode"
      :role="assignRole"
      @success="gridApi.query()"
    />

    <Grid :table-title="L.nav.role">
      <template #toolbar-tools>
        <ElButton
          v-if="has(PERM.role.add)"
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

      <template #status="{ row }">
        <StatusTag :value="row.enabled" />
      </template>

      <template #action="{ row }">
        <ElButton
          v-if="has(PERM.role.update)"
          link
          type="primary"
          size="small"
          @click="openEdit(row)"
        >
          {{ L.common.edit }}
        </ElButton>
        <ElButton
          v-if="has(PERM.role.permission)"
          link
          type="primary"
          size="small"
          @click="openAssign('permission', row)"
        >
          {{ L.role.assignPermission }}
        </ElButton>
        <ElButton
          link
          type="primary"
          size="small"
          @click="openAssign('user', row)"
        >
          {{ L.role.assignUser }}
        </ElButton>
        <ElButton
          v-if="has(PERM.role.remove)"
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
