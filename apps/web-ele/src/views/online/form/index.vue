<script lang="ts" setup>
/** 在线表单管理：列表 / 新增编辑 / 可视化设计 / 发布 / 克隆 / 删除。 */
import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { OnlineFormDTO, OnlineFormVO } from '#/api/online';

import { reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  ElButton,
  ElDrawer,
  ElForm,
  ElFormItem,
  ElInput,
} from 'element-plus';

import type { FormInstance, FormRules } from 'element-plus';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  cloneOnlineForm,
  createOnlineForm,
  deleteOnlineForm,
  getOnlineFormPage,
  publishOnlineForm,
  updateOnlineForm,
} from '#/api/online';

import {
  confirmAction,
  usePermission,
  withFeedback,
} from '../../system/shared/helpers';
import FormDesigner from './FormDesigner.vue';
import OnlineFormRenderer from './OnlineFormRenderer.vue';

const { has } = usePermission();
const drawerVisible = ref(false);
const designerVisible = ref(false);
const previewVisible = ref(false);
const saving = ref(false);
const editing = ref<null | OnlineFormVO>(null);
const designing = ref<null | OnlineFormVO>(null);
const previewing = ref<null | OnlineFormVO>(null);
const formRef = ref<FormInstance>();
const form = reactive<OnlineFormDTO>({
  formCode: '',
  formName: '',
  masterTable: '',
  remark: '',
  widgetJson: '{"widgets":[]}',
});

const rules: FormRules = {
  formName: [{ required: true, message: '请输入表单名称', trigger: 'blur' }],
};

const searchSchema: VbenFormSchema[] = [
  { component: 'Input', fieldName: 'keyword', label: '表单名称' },
];

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: { schema: searchSchema, submitOnChange: true },
  gridOptions: {
    columns: [
      { field: 'formName', title: '表单名称', minWidth: 180 },
      { field: 'formCode', title: '表单编码', minWidth: 180 },
      {
        field: 'status',
        title: '状态',
        width: 100,
        slots: { default: 'status' },
      },
      { field: 'version', title: '版本', width: 80 },
      { field: 'updateTime', title: '更新时间', width: 170 },
      {
        align: 'center',
        field: 'operation',
        fixed: 'right',
        slots: { default: 'action' },
        title: '操作',
        width: 300,
      },
    ],
    height: 'auto',
    proxyConfig: {
      ajax: {
        query: async ({ form }) => await getOnlineFormPage({
          keyword: form.keyword ?? '',
          pageNum: 1,
          pageSize: 50,
        }),
      },
    },
    rowConfig: { keyField: 'formId' },
    toolbarConfig: { custom: true, refresh: true, zoom: true },
  } as VxeTableGridOptions<OnlineFormVO>,
});

function resetForm(row?: OnlineFormVO) {
  Object.assign(form, {
    formCode: row?.formCode ?? '',
    formId: row?.formId,
    formName: row?.formName ?? '',
    masterTable: row?.masterTable ?? '',
    remark: row?.remark ?? '',
    widgetJson: row?.widgetJson ?? '{"widgets":[]}',
  });
  formRef.value?.clearValidate();
}

function openCreate() {
  editing.value = null;
  resetForm();
  drawerVisible.value = true;
}

function openEdit(row: OnlineFormVO) {
  editing.value = row;
  resetForm(row);
  drawerVisible.value = true;
}

function openDesigner(row: OnlineFormVO) {
  designing.value = row;
  designerVisible.value = true;
}

function openPreview(row: OnlineFormVO) {
  previewing.value = row;
  previewVisible.value = true;
}

async function onSubmit() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  saving.value = true;
  try {
    const ok = await withFeedback(() =>
      editing.value
        ? updateOnlineForm({ ...form })
        : createOnlineForm({ ...form }),
    );
    if (ok) {
      drawerVisible.value = false;
      await gridApi.query();
    }
  } finally {
    saving.value = false;
  }
}

async function onDesignerSave(widgetJson: string) {
  const current = designing.value;
  if (!current) return;
  const ok = await withFeedback(() =>
    updateOnlineForm({ formId: current.formId, formName: current.formName, widgetJson }),
  );
  if (ok) await gridApi.query();
}

async function onPublish(row: OnlineFormVO) {
  const ok = await withFeedback(() => publishOnlineForm(row.formId), '发布成功');
  if (ok) await gridApi.query();
}

async function onClone(row: OnlineFormVO) {
  const ok = await withFeedback(() => cloneOnlineForm(row.formId), '已克隆为草稿');
  if (ok) await gridApi.query();
}

async function onDelete(row: OnlineFormVO) {
  if (!(await confirmAction(`确定删除表单「${row.formName}」？`))) return;
  const ok = await withFeedback(() => deleteOnlineForm(row.formId), '已删除');
  if (ok) await gridApi.query();
}

function renderPreview(): null | import('#/api/online').OnlineRenderVO {
  return previewing.value
    ? {
        data: {},
        formId: previewing.value.formId,
        formName: previewing.value.formName,
        schema: previewing.value.widgetJson
          ? JSON.parse(previewing.value.widgetJson)
          : { widgets: [] },
      }
    : null;
}
</script>

<template>
  <Page>
    <Grid>
      <template #status="{ row }">
        <span :class="row.status === 1 ? 'text-green-500' : 'text-orange-500'">
          {{ row.status === 1 ? '已发布' : '草稿' }}
        </span>
      </template>
      <template #action="{ row }">
        <ElButton v-if="has('online:form:update')" link type="primary" size="small" @click="openEdit(row)">
          编辑
        </ElButton>
        <ElButton v-if="has('online:form:update')" link type="primary" size="small" @click="openDesigner(row)">
          设计
        </ElButton>
        <ElButton link size="small" @click="openPreview(row)">预览</ElButton>
        <ElButton v-if="has('online:form:publish')" link type="success" size="small" @click="onPublish(row)">
          发布
        </ElButton>
        <ElButton v-if="has('online:form:add')" link size="small" @click="onClone(row)">
          克隆
        </ElButton>
        <ElButton v-if="has('online:form:delete')" link type="danger" size="small" @click="onDelete(row)">
          删除
        </ElButton>
      </template>
      <template #toolbar-tools>
        <ElButton v-if="has('online:form:add')" type="primary" @click="openCreate">新增表单</ElButton>
      </template>
    </Grid>

    <ElDrawer
      v-model="drawerVisible"
      :title="editing ? '编辑表单' : '新增表单'"
      size="480px"
    >
      <ElForm ref="formRef" :model="form" :rules="rules" label-position="top">
        <ElFormItem label="表单名称" prop="formName">
          <ElInput v-model="form.formName" placeholder="如：请假申请" />
        </ElFormItem>
        <ElFormItem label="表单编码">
          <ElInput v-model="form.formCode" placeholder="留空自动生成" />
        </ElFormItem>
        <ElFormItem label="主表标识">
          <ElInput v-model="form.masterTable" placeholder="业务语义标识（可选）" />
        </ElFormItem>
        <ElFormItem label="备注">
          <ElInput v-model="form.remark" type="textarea" :rows="2" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="drawerVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="saving" @click="onSubmit">保存</ElButton>
      </template>
    </ElDrawer>

    <FormDesigner
      v-if="designing"
      v-model="designerVisible"
      :form-name="designing.formName"
      :widget-json="designing.widgetJson"
      @save="onDesignerSave"
    />

    <ElDrawer v-model="previewVisible" title="表单预览" size="640px">
      <OnlineFormRenderer
        v-if="previewing && previewVisible"
        :render="renderPreview()"
      />
    </ElDrawer>
  </Page>
</template>
