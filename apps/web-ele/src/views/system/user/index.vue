<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { DepartmentNode, SystemUser, UserFormData } from '#/api/system';

import { computed, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  ElButton,
  ElCard,
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu,
  ElInput,
  ElTree,
} from 'element-plus';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  createUser,
  deleteUser,
  deleteUsersBatch,
  getDepartmentTree,
  getUserPage,
  resetUserPassword,
  updateUser,
} from '#/api/system';

import { ENABLE_QUERY_OPTIONS, PERM } from '../shared/constants';
import FormDialog from '../shared/FormDialog.vue';
import {
  confirmAction,
  flattenTree,
  toTreeOptions,
  usePermission,
  withFeedback,
} from '../shared/helpers';
import { formatLabel, L } from '../shared/labels';
import StatusTag from '../shared/StatusTag.vue';
import UserAssignDialog from './UserAssignDialog.vue';
import UserForm from './UserForm.vue';

interface TreeMethods {
  filter: (value: string) => void;
  setCurrentKey: (key?: null | number | string) => void;
}

interface UserSearchValues {
  enable?: string;
  username?: string;
}

const { has } = usePermission();

const departments = ref<DepartmentNode[]>([]);
const deptKeyword = ref('');
const deptTreeRef = ref<null | TreeMethods>(null);
const selectedDeptId = ref<null | number>(null);
const deptNameMap = computed(() => {
  const map = new Map<number, string>();
  flattenTree(departments.value).forEach((dept) => {
    map.set(Number(dept.id), dept.name ?? String(dept.id));
  });
  return map;
});
const deptTreeOptions = computed(() =>
  toTreeOptions(departments.value, {
    labelKey: 'name',
    valueKey: 'id',
  }),
);

const dialogVisible = ref(false);
const editing = ref<null | SystemUser>(null);
const saving = ref(false);
const formRef = ref<null | {
  submit: () => Promise<null | UserFormData>;
}>(null);

const assignVisible = ref(false);
const assignMode = ref<'dataDept' | 'detail' | 'role'>('role');
const assignUser = ref<null | SystemUser>(null);

const searchSchema: VbenFormSchema[] = [
  {
    component: 'Input',
    fieldName: 'username',
    label: L.user.username,
    componentProps: { placeholder: '按账号模糊查询', clearable: true },
  },
  {
    component: 'Select',
    fieldName: 'enable',
    label: L.common.status,
    componentProps: {
      clearable: true,
      options: ENABLE_QUERY_OPTIONS,
      placeholder: '全部',
    },
  },
];

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: searchSchema,
    submitOnChange: true,
  },
  gridOptions: {
    checkboxConfig: { highlight: true, reserve: true },
    columns: [
      { title: '选择', type: 'checkbox', width: 60 },
      { field: 'username', title: L.user.username, minWidth: 130 },
      { field: 'nickName', title: L.user.nickName, minWidth: 120 },
      { field: 'realName', title: L.user.realName, minWidth: 120 },
      {
        field: 'departmentId',
        title: L.user.department,
        minWidth: 140,
        formatter: ({ cellValue }: { cellValue: unknown }) =>
          cellValue === null || cellValue === undefined
            ? '-'
            : (deptNameMap.value.get(Number(cellValue)) ?? String(cellValue)),
      },
      { field: 'phoneNumber', title: L.user.phoneNumber, minWidth: 140 },
      { field: 'email', title: L.user.email, minWidth: 180 },
      {
        field: 'enabled',
        title: L.common.status,
        width: 100,
        slots: { default: 'status' },
      },
      {
        align: 'center',
        field: 'operation',
        fixed: 'right',
        slots: { default: 'action' },
        title: L.common.action,
        width: 260,
      },
    ],
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues: UserSearchValues) =>
          await getUserPage({
            // 后端 UserInfoService.page() 已支持 deptId，直接走服务端分页；
            // enable 同时兼容 '1'/'0' 与 'true'/'false'。
            deptId: selectedDeptId.value,
            enable:
              formValues?.enable === undefined
                ? undefined
                : String(formValues.enable),
            pageNum: page.currentPage,
            pageSize: page.pageSize,
            username: formValues?.username,
          }),
      },
    },
    rowConfig: { keyField: 'userId' },
    toolbarConfig: { custom: true, refresh: true, search: true, zoom: true },
  } as VxeTableGridOptions<SystemUser>,
});

async function loadDepartments() {
  try {
    departments.value = (await getDepartmentTree()) ?? [];
  } catch (error) {
    console.error('[system/user] load department tree failed', error);
  }
}

function onDeptFilter(value: string, data: Record<string, unknown>): boolean {
  if (!value) {
    return true;
  }
  return String(data.label ?? '')
    .toLowerCase()
    .includes(value.toLowerCase());
}

function onDeptClick(data: Record<string, unknown>) {
  selectedDeptId.value = Number(data.value);
  gridApi.reload();
}

function showAllDepts() {
  selectedDeptId.value = null;
  deptTreeRef.value?.setCurrentKey(null);
  gridApi.reload();
}

function openCreate() {
  editing.value = null;
  dialogVisible.value = true;
}

function openEdit(row: SystemUser) {
  editing.value = row;
  dialogVisible.value = true;
}

function openAssign(mode: 'dataDept' | 'detail' | 'role', row: SystemUser) {
  assignMode.value = mode;
  assignUser.value = row;
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
      editing.value ? updateUser(payload) : createUser(payload),
    );
    if (ok) {
      dialogVisible.value = false;
      gridApi.query();
    }
  } finally {
    saving.value = false;
  }
}

async function onDelete(row: SystemUser) {
  const confirmed = await confirmAction(
    formatLabel(L.common.deleteConfirm, row.username ?? row.userId),
    L.common.delete,
  );
  if (!confirmed) {
    return;
  }
  const ok = await withFeedback(
    () => deleteUser(row.userId),
    L.common.deleteSuccess,
  );
  if (ok) {
    gridApi.query();
  }
}

async function onResetPassword(row: SystemUser) {
  const confirmed = await confirmAction(
    formatLabel(L.user.resetConfirm, row.username ?? row.userId),
    L.user.resetPassword,
  );
  if (!confirmed) {
    return;
  }
  await withFeedback(() => resetUserPassword(row.userId));
}

async function onBatchDelete() {
  const rows = gridApi.grid.getCheckboxRecords?.() ?? [];
  if (rows.length === 0) {
    return;
  }
  const confirmed = await confirmAction(
    formatLabel(L.user.batchDeleteConfirm, rows.length),
    L.user.batchDelete,
  );
  if (!confirmed) {
    return;
  }
  const ok = await withFeedback(
    () => deleteUsersBatch(rows.map((row) => Number(row.userId))),
    L.common.deleteSuccess,
  );
  if (ok) {
    gridApi.query();
  }
}

function onRefresh() {
  gridApi.query();
  loadDepartments();
}

loadDepartments();
</script>

<template>
  <Page auto-content-height>
    <FormDialog
      v-model="dialogVisible"
      :loading="saving"
      :title="
        editing
          ? `${L.common.edit}${L.nav.user}`
          : `${L.common.create}${L.nav.user}`
      "
      size="600px"
      @confirm="onSubmit"
    >
      <UserForm
        v-if="dialogVisible"
        ref="formRef"
        :departments="departments"
        :record="editing"
      />
    </FormDialog>

    <UserAssignDialog
      v-model="assignVisible"
      :departments="departments"
      :mode="assignMode"
      :user="assignUser"
      @success="onRefresh"
    />

    <div class="flex h-full gap-4">
      <ElCard class="w-[250px] shrink-0" shadow="never">
        <template #header>
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium">{{ L.user.deptFilter }}</span>
            <ElButton link type="primary" size="small" @click="showAllDepts">
              {{ L.user.allDept }}
            </ElButton>
          </div>
        </template>
        <ElInput
          v-model="deptKeyword"
          :placeholder="L.common.keywordPlaceholder"
          clearable
          size="small"
          @input="deptTreeRef?.filter(deptKeyword)"
        />
        <p class="mt-1 text-xs text-gray-500">点击部门筛选该部门下的用户</p>
        <div class="mt-2 max-h-[calc(100%-40px)] overflow-auto">
          <ElTree
            ref="deptTreeRef"
            :data="deptTreeOptions"
            :filter-node-method="onDeptFilter"
            :props="{ children: 'children', label: 'label' }"
            default-expand-all
            highlight-current
            node-key="value"
            @node-click="onDeptClick"
          />
        </div>
      </ElCard>

      <div class="min-w-0 flex-1">
        <Grid :table-title="L.nav.user">
          <template #toolbar-tools>
            <ElButton
              v-if="has(PERM.user.add)"
              type="primary"
              size="small"
              @click="openCreate"
            >
              {{ L.common.add }}
            </ElButton>
            <ElButton
              v-if="has(PERM.user.remove)"
              type="danger"
              size="small"
              plain
              @click="onBatchDelete"
            >
              {{ L.user.batchDelete }}
            </ElButton>
            <ElButton size="small" @click="onRefresh">
              {{ L.common.refresh }}
            </ElButton>
          </template>

          <template #status="{ row }">
            <StatusTag :value="row.enabled" />
          </template>

          <template #action="{ row }">
            <ElButton
              v-if="has(PERM.user.update)"
              link
              type="primary"
              size="small"
              @click="openEdit(row)"
            >
              {{ L.common.edit }}
            </ElButton>
            <ElButton
              link
              type="primary"
              size="small"
              @click="openAssign('detail', row)"
            >
              {{ L.common.detail }}
            </ElButton>
            <ElDropdown trigger="click">
              <ElButton link type="primary" size="small"> 更多 </ElButton>
              <template #dropdown>
                <ElDropdownMenu>
                  <ElDropdownItem
                    v-if="has(PERM.user.role)"
                    @click="openAssign('role', row)"
                  >
                    {{ L.user.assignRole }}
                  </ElDropdownItem>
                  <ElDropdownItem @click="openAssign('dataDept', row)">
                    {{ L.user.assignDataDept }}
                  </ElDropdownItem>
                  <ElDropdownItem @click="onResetPassword(row)">
                    {{ L.user.resetPassword }}
                  </ElDropdownItem>
                  <ElDropdownItem
                    v-if="has(PERM.user.remove)"
                    divided
                    @click="onDelete(row)"
                  >
                    {{ L.common.delete }}
                  </ElDropdownItem>
                </ElDropdownMenu>
              </template>
            </ElDropdown>
          </template>
        </Grid>
      </div>
    </div>
  </Page>
</template>
