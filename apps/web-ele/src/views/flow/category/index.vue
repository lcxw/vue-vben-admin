<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { FlowCategoryDTO, FlowCategoryVO } from '#/api/flow';

import { reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  ElButton,
  ElDrawer,
  ElForm,
  ElFormItem,
  ElInput,
  ElInputNumber,
  type FormInstance,
  type FormRules,
} from 'element-plus';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  createFlowCategory,
  deleteFlowCategory,
  getFlowCategoryGrid,
  updateFlowCategory,
} from '#/api/flow';

import {
  confirmAction,
  usePermission,
  withFeedback,
} from '../../system/shared/helpers';
import { FLOW_PERM } from '../shared/constants';
import { FL } from '../shared/labels';

const { has } = usePermission();
const drawerVisible = ref(false);
const saving = ref(false);
const editing = ref<null | FlowCategoryVO>(null);
const formRef = ref<FormInstance>();
const form = reactive<FlowCategoryDTO>({
  code: '',
  name: '',
  remark: '',
  showOrder: 0,
});

const rules: FormRules = {
  code: [{ required: true, message: '请输入分类编码', trigger: 'blur' }],
  name: [{ required: true, message: '请输入分类名称', trigger: 'blur' }],
};

const searchSchema: VbenFormSchema[] = [
  { component: 'Input', fieldName: 'name', label: FL.category.name },
];

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: { schema: searchSchema, submitOnChange: true },
  gridOptions: {
    columns: [
      { field: 'name', title: FL.category.name, minWidth: 160 },
      { field: 'code', title: FL.category.code, minWidth: 160 },
      { field: 'showOrder', title: FL.category.showOrder, width: 100 },
      { field: 'remark', title: FL.category.remark, minWidth: 200 },
      {
        align: 'center',
        field: 'operation',
        fixed: 'right',
        slots: { default: 'action' },
        title: FL.common.action,
        width: 180,
      },
    ],
    height: 'auto',
    proxyConfig: {
      ajax: {
        query: async () => await getFlowCategoryGrid(),
      },
    },
    rowConfig: { keyField: 'categoryId' },
    toolbarConfig: { custom: true, refresh: true, zoom: true },
  } as VxeTableGridOptions<FlowCategoryVO>,
});

function resetForm(row?: FlowCategoryVO) {
  Object.assign(form, {
    categoryId: row?.categoryId,
    code: row?.code ?? '',
    name: row?.name ?? '',
    remark: row?.remark ?? '',
    showOrder: row?.showOrder ?? 0,
  });
  formRef.value?.clearValidate();
}

function openCreate() {
  editing.value = null;
  resetForm();
  drawerVisible.value = true;
}

function openEdit(row: FlowCategoryVO) {
  editing.value = row;
  resetForm(row);
  drawerVisible.value = true;
}

async function onSubmit() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  saving.value = true;
  try {
    const payload: FlowCategoryDTO = { ...form };
    const ok = await withFeedback(() =>
      editing.value
        ? updateFlowCategory(payload)
        : createFlowCategory(payload),
    );
    if (ok) {
      drawerVisible.value = false;
      gridApi.query();
    }
  } finally {
    saving.value = false;
  }
}

async function onDelete(row: FlowCategoryVO) {
  if (
    !(await confirmAction(`确定删除流程分类「${row.name}」吗？`, '删除分类'))
  ) {
    return;
  }
  const ok = await withFeedback(() => deleteFlowCategory(row.categoryId));
  if (ok) gridApi.query();
}
</script>

<template>
  <Page :title="FL.category.title" description="维护流程分组，供流程定义归类">
    <Grid>
      <template #toolbar-actions>
        <ElButton
          v-if="has(FLOW_PERM.category.add)"
          type="primary"
          @click="openCreate"
        >
          {{ FL.common.create }}
        </ElButton>
      </template>
      <template #action="{ row }">
        <ElButton
          v-if="has(FLOW_PERM.category.update)"
          link
          type="primary"
          @click="openEdit(row)"
        >
          {{ FL.common.edit }}
        </ElButton>
        <ElButton
          v-if="has(FLOW_PERM.category.remove)"
          link
          type="danger"
          @click="onDelete(row)"
        >
          {{ FL.common.delete }}
        </ElButton>
      </template>
    </Grid>

    <ElDrawer
      v-model="drawerVisible"
      :title="editing ? FL.common.edit : FL.common.create"
      destroy-on-close
      size="480px"
    >
      <ElForm
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="100px"
      >
        <ElFormItem :label="FL.category.name" prop="name">
          <ElInput v-model="form.name" placeholder="如：行政审批" />
        </ElFormItem>
        <ElFormItem :label="FL.category.code" prop="code">
          <ElInput v-model="form.code" placeholder="如：approval" />
        </ElFormItem>
        <ElFormItem :label="FL.category.showOrder" prop="showOrder">
          <ElInputNumber v-model="form.showOrder" :min="0" />
        </ElFormItem>
        <ElFormItem :label="FL.category.remark" prop="remark">
          <ElInput v-model="form.remark" type="textarea" :rows="3" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <div class="flex justify-end gap-2">
          <ElButton @click="drawerVisible = false">
            {{ FL.common.cancel }}
          </ElButton>
          <ElButton type="primary" :loading="saving" @click="onSubmit">
            {{ FL.common.confirm }}
          </ElButton>
        </div>
      </template>
    </ElDrawer>
  </Page>
</template>
