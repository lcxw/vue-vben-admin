<script lang="ts" setup>
import type {
  DepartmentFormData,
  DepartmentNode,
  SystemUser,
} from '#/api/system';

import { computed, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  ElButton,
  ElCard,
  ElDescriptions,
  ElDescriptionsItem,
  ElTable,
  ElTableColumn,
  ElTabPane,
  ElTabs,
  ElTree,
} from 'element-plus';

import {
  createDepartment,
  deleteDepartment,
  getDepartmentsByCompanyIds,
  getOrganizationTree,
  getUsersByCompanyIds,
  updateDepartment,
} from '#/api/system';

import DeptForm from '../department/DeptForm.vue';
import { PERM } from '../shared/constants';
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

const { has } = usePermission();

const companyTree = ref<DepartmentNode[]>([]);
const selectedCompany = ref<DepartmentNode | null>(null);
const departments = ref<DepartmentNode[]>([]);
const users = ref<SystemUser[]>([]);
const activeTab = ref('detail');
const loadingDetail = ref(false);

const dialogVisible = ref(false);
const editing = ref<DepartmentNode | null>(null);
const saving = ref(false);
const formRef = ref<null | {
  submit: () => Promise<DepartmentFormData | null>;
}>(null);

const companyOptions = computed(() =>
  toTreeOptions(companyTree.value, {
    labelKey: 'name',
    valueKey: 'id',
  }),
);

async function loadCompanies() {
  try {
    companyTree.value = (await getOrganizationTree()) ?? [];
  } catch (error) {
    console.error('[system/organization] load company tree failed', error);
  }
}

async function loadCompanyDetail(companyId: number) {
  loadingDetail.value = true;
  try {
    const [deptList, userList] = await Promise.all([
      getDepartmentsByCompanyIds([companyId]),
      getUsersByCompanyIds([companyId]),
    ]);
    departments.value = deptList ?? [];
    users.value = userList ?? [];
  } catch (error) {
    console.error('[system/organization] load company detail failed', error);
  } finally {
    loadingDetail.value = false;
  }
}

function onSelectCompany(data: Record<string, unknown>) {
  const id = Number(data.value);
  const found = flattenTree(companyTree.value).find(
    (node) => Number(node.id) === id,
  );
  selectedCompany.value = found ?? null;
  if (selectedCompany.value) {
    void loadCompanyDetail(id);
  }
}

function openCreateCompany() {
  editing.value = null;
  dialogVisible.value = true;
}

function openEditCompany() {
  editing.value = selectedCompany.value;
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
      await loadCompanies();
      if (selectedCompany.value) {
        await loadCompanyDetail(Number(selectedCompany.value.id));
      }
    }
  } finally {
    saving.value = false;
  }
}

async function onDeleteCompany() {
  const company = selectedCompany.value;
  if (!company) {
    return;
  }
  const confirmed = await confirmAction(
    formatLabel(L.common.deleteConfirm, company.name ?? company.id),
    L.common.delete,
  );
  if (!confirmed) {
    return;
  }
  const ok = await withFeedback(
    () => deleteDepartment(Number(company.id)),
    L.common.deleteSuccess,
  );
  if (ok) {
    selectedCompany.value = null;
    departments.value = [];
    users.value = [];
    await loadCompanies();
  }
}

loadCompanies();
</script>

<template>
  <Page auto-content-height>
    <FormDialog
      v-model="dialogVisible"
      :loading="saving"
      :title="editing ? L.org.editCompany : L.org.createCompany"
      @confirm="onSubmit"
    >
      <DeptForm
        v-if="dialogVisible"
        ref="formRef"
        company-only
        :nodes="companyTree"
        :record="editing"
      />
    </FormDialog>

    <div class="flex h-full gap-4">
      <ElCard class="w-[280px] shrink-0" shadow="never">
        <template #header>
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium">{{ L.org.companyTree }}</span>
            <ElButton
              v-if="has(PERM.department.add)"
              link
              type="primary"
              size="small"
              @click="openCreateCompany"
            >
              {{ L.org.createCompany }}
            </ElButton>
          </div>
        </template>
        <div class="max-h-[calc(100%-20px)] overflow-auto">
          <ElTree
            :data="companyOptions"
            :props="{ children: 'children', label: 'label' }"
            default-expand-all
            highlight-current
            node-key="value"
            @node-click="onSelectCompany"
          />
        </div>
      </ElCard>

      <ElCard class="min-w-0 flex-1" shadow="never">
        <div v-if="!selectedCompany" class="p-8 text-center text-gray-500">
          {{ L.org.selectCompany }}
        </div>
        <template v-else>
          <div class="mb-3 flex items-center gap-2">
            <span class="text-base font-medium">
              {{ selectedCompany.name }}
            </span>
            <ElButton
              v-if="has(PERM.department.update)"
              size="small"
              @click="openEditCompany"
            >
              {{ L.common.edit }}
            </ElButton>
            <ElButton
              v-if="has(PERM.department.remove)"
              type="danger"
              size="small"
              plain
              @click="onDeleteCompany"
            >
              {{ L.common.delete }}
            </ElButton>
            <ElButton
              size="small"
              @click="loadCompanyDetail(Number(selectedCompany.id))"
            >
              {{ L.common.refresh }}
            </ElButton>
          </div>

          <ElTabs v-model="activeTab">
            <ElTabPane :label="L.org.companyDetail" name="detail">
              <ElDescriptions :column="2" border size="small">
                <ElDescriptionsItem :label="L.org.code">
                  {{ selectedCompany.code ?? '-' }}
                </ElDescriptionsItem>
                <ElDescriptionsItem :label="L.org.name">
                  {{ selectedCompany.name ?? '-' }}
                </ElDescriptionsItem>
                <ElDescriptionsItem :label="L.common.status">
                  <StatusTag :value="selectedCompany.enabled" />
                </ElDescriptionsItem>
                <ElDescriptionsItem :label="L.dept.sortOrder">
                  {{ selectedCompany.sortOrder ?? 0 }}
                </ElDescriptionsItem>
                <ElDescriptionsItem :label="L.dept.description" :span="2">
                  {{ selectedCompany.description ?? '-' }}
                </ElDescriptionsItem>
              </ElDescriptions>
            </ElTabPane>

            <ElTabPane :label="L.org.departments" name="departments">
              <ElTable
                v-loading="loadingDetail"
                :data="departments"
                border
                stripe
                size="small"
                max-height="480"
              >
                <ElTableColumn prop="name" :label="L.dept.name" />
                <ElTableColumn prop="code" :label="L.dept.code" />
                <ElTableColumn
                  prop="sortOrder"
                  :label="L.dept.sortOrder"
                  width="90"
                />
                <ElTableColumn :label="L.common.status" width="100">
                  <template #default="{ row }">
                    <StatusTag :value="row.enabled" />
                  </template>
                </ElTableColumn>
              </ElTable>
            </ElTabPane>

            <ElTabPane :label="L.org.users" name="users">
              <ElTable
                v-loading="loadingDetail"
                :data="users"
                border
                stripe
                size="small"
                max-height="480"
              >
                <ElTableColumn prop="username" :label="L.user.username" />
                <ElTableColumn prop="realName" :label="L.user.realName" />
                <ElTableColumn prop="phoneNumber" :label="L.user.phoneNumber" />
                <ElTableColumn prop="email" :label="L.user.email" />
              </ElTable>
            </ElTabPane>
          </ElTabs>
        </template>
      </ElCard>
    </div>
  </Page>
</template>
