<script lang="ts" setup>
/** 在线表单管理：列表 / 新增编辑 / 可视化设计 / 发布 / 克隆 / 删除。 */
import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { OnlineFormDTO, OnlineFormVO, OnlineDataPermVO, OnlineCategoryVO, OnlineDblinkVO } from '#/api/online';

import { onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  ElButton,
  ElDrawer,
  ElForm,
  ElFormItem,
  ElInput,
  ElMessage,
  ElOption,
  ElSelect,
} from 'element-plus';

import type { FormInstance, FormRules } from 'element-plus';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  cloneOnlineForm,
  createOnlineForm,
  deleteOnlineForm,
  getCategoryTree,
  getOnlineDataPerm,
  getOnlineDblinkList,
  getOnlineFormPage,
  ONLINE_DATA_SCOPES,
  ONLINE_FORM_KINDS,
  ONLINE_STORAGE_TYPES,
  ONLINE_VIEW_TYPES,
  publishOnlineForm,
  saveOnlineDataPerm,
  updateOnlineForm,
} from '#/api/online';

import {
  confirmAction,
  usePermission,
  withFeedback,
} from '../../system/shared/helpers';
import FieldModelDesigner from './FieldModelDesigner.vue';
import FormDesigner from './FormDesigner.vue';
import OnlineFormRenderer from './OnlineFormRenderer.vue';

const { has } = usePermission();
const drawerVisible = ref(false);
const designerVisible = ref(false);
const fieldDesignerVisible = ref(false);
const previewVisible = ref(false);
const saving = ref(false);
const editing = ref<null | OnlineFormVO>(null);
const designing = ref<null | OnlineFormVO>(null);
const fieldDesigning = ref<null | OnlineFormVO>(null);
const previewing = ref<null | OnlineFormVO>(null);
const categories = ref<OnlineCategoryVO[]>([]);
const dblinks = ref<OnlineDblinkVO[]>([]);
const permVisible = ref(false);
const permForm = reactive({ formId: '', scopeType: 0, customUserIds: '', customDeptIds: '', enabled: 1 });
const formRef = ref<FormInstance>();
const form = reactive<OnlineFormDTO>({
  formCode: '',
  formName: '',
  categoryId: undefined,
  viewType: 2,
  formKind: 1,
  storageType: 1,
  masterTable: '',
  pkColumn: 'id',
  dblinkCode: '',
  remark: '',
  widgetJson: '{"widgets":[]}',
  fieldJson: '{"fields":[]}',
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
      { field: 'formCode', title: '表单编码', minWidth: 160 },
      { field: 'categoryId', title: '分类', width: 110, slots: { default: 'category' } },
      { field: 'viewType', title: '视图类型', width: 100, slots: { default: 'viewType' } },
      {
        field: 'storageType',
        title: '存储',
        width: 90,
        slots: { default: 'storageType' },
      },
      {
        field: 'status',
        title: '状态',
        width: 90,
        slots: { default: 'status' },
      },
      { field: 'version', title: '版本', width: 70 },
      { field: 'updateTime', title: '更新时间', width: 160 },
      {
        align: 'center',
        field: 'operation',
        fixed: 'right',
        slots: { default: 'action' },
        title: '操作',
        width: 380,
      },
    ],
    height: 'auto',
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues: Partial<{ keyword: string }>) =>
          await getOnlineFormPage({
            keyword: formValues?.keyword ?? '',
            pageNum: page?.currentPage ?? 1,
            pageSize: page?.pageSize ?? 50,
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
    categoryId: row?.categoryId ?? undefined,
    viewType: row?.viewType ?? 2,
    formKind: row?.formKind ?? 1,
    storageType: row?.storageType ?? 1,
    masterTable: row?.masterTable ?? '',
    pkColumn: row?.pkColumn ?? 'id',
    dblinkCode: row?.dblinkCode ?? '',
    remark: row?.remark ?? '',
    widgetJson: row?.widgetJson ?? '{"widgets":[]}',
    fieldJson: row?.fieldJson ?? '{"fields":[]}',
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

function openFieldDesigner(row: OnlineFormVO) {
  fieldDesigning.value = row;
  fieldDesignerVisible.value = true;
}

async function onFieldDesignerSave(fieldJson: string) {
  const current = fieldDesigning.value;
  if (!current) return;
  const ok = await withFeedback(() =>
    updateOnlineForm({ formId: current.formId, formName: current.formName, fieldJson }),
  );
  if (ok) await gridApi.query();
}

function viewTypeLabel(v?: number): string {
  return ONLINE_VIEW_TYPES.find((t) => t.value === v)?.label ?? '编辑表单';
}

function categoryName(id?: string): string {
  const walk = (nodes: OnlineCategoryVO[]): string => {
    for (const n of nodes) {
      if (n.categoryId === id) return n.categoryName;
      const sub = n.children ? walk(n.children) : '';
      if (sub) return sub;
    }
    return '';
  };
  return id ? walk(categories.value) || id : '-';
}

onMounted(async () => {
  try {
    [categories.value, dblinks.value] = await Promise.all([getCategoryTree(), getOnlineDblinkList()]);
  } catch {
    categories.value = []; dblinks.value = [];
  }
});

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

async function openPerm(row: OnlineFormVO) {
  const current: null | OnlineDataPermVO = await getOnlineDataPerm(row.formId);
  Object.assign(permForm, {
    formId: row.formId,
    scopeType: current?.scopeType ?? 0,
    customUserIds: current?.customUserIds ?? '[]',
    customDeptIds: current?.customDeptIds ?? '[]',
    enabled: current?.enabled ?? 1,
  });
  permVisible.value = true;
}

async function onPermSave() {
  let users: string[];
  let depts: string[];
  try {
    users = JSON.parse(permForm.customUserIds || '[]') as string[];
    depts = JSON.parse(permForm.customDeptIds || '[]') as string[];
  } catch {
    ElMessage.warning('自定义用户/部门必须是 JSON 数组字符串');
    return;
  }
  const ok = await withFeedback(() => saveOnlineDataPerm({
    customDeptIds: depts,
    customUserIds: users,
    enabled: permForm.enabled,
    formId: permForm.formId,
    scopeType: permForm.scopeType,
  }));
  if (ok) permVisible.value = false;
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
      <template #category="{ row }">
        {{ categoryName(row.categoryId) }}
      </template>
      <template #viewType="{ row }">
        {{ viewTypeLabel(row.viewType) }}
      </template>
      <template #storageType="{ row }">
        <ElTag size="small" :type="row.storageType === 1 ? 'success' : 'info'">
          {{ row.storageType === 1 ? '物理表' : 'JSON' }}
        </ElTag>
      </template>
      <template #status="{ row }">
        <span :class="row.status === 1 ? 'text-green-500' : 'text-orange-500'">
          {{ row.status === 1 ? '已发布' : '草稿' }}
        </span>
      </template>
      <template #action="{ row }">
        <ElButton v-if="has('online:form:update')" link type="warning" size="small" @click="openFieldDesigner(row)">
          建模
        </ElButton>
        <ElButton v-if="has('online:form:update')" link type="primary" size="small" @click="openEdit(row)">
          编辑
        </ElButton>
        <ElButton v-if="has('online:form:update')" link type="primary" size="small" @click="openDesigner(row)">
          设计
        </ElButton>
        <ElButton link size="small" @click="openPreview(row)">预览</ElButton>
        <ElButton v-if="has('online:perm:save')" link type="warning" size="small" @click="openPerm(row)">数据权限</ElButton>
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
          <ElInput v-model="form.formName" placeholder="如：客户查询" />
        </ElFormItem>
        <ElFormItem label="表单编码">
          <ElInput v-model="form.formCode" placeholder="留空自动生成" />
        </ElFormItem>
        <ElFormItem label="所属分类">
          <ElSelect v-model="form.categoryId" clearable placeholder="选择分类">
            <ElOption v-for="c in categories" :key="c.categoryId" :label="c.categoryName" :value="c.categoryId" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="存储类型">
          <ElSelect v-model="form.storageType">
            <ElOption v-for="t in ONLINE_STORAGE_TYPES" :key="t.value" :label="t.label" :value="t.value" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="视图类型">
          <ElSelect v-model="form.viewType">
            <ElOption v-for="t in ONLINE_VIEW_TYPES" :key="t.value" :label="t.label" :value="t.value" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="形态">
          <ElSelect v-model="form.formKind">
            <ElOption v-for="t in ONLINE_FORM_KINDS" :key="t.value" :label="t.label" :value="t.value" />
          </ElSelect>
        </ElFormItem>
        <template v-if="form.storageType === 1">
          <ElFormItem label="数据源">
            <ElSelect v-model="form.dblinkCode" clearable placeholder="默认数据源(workflow)">
              <ElOption v-for="d in dblinks" :key="d.code" :label="d.name" :value="d.code" />
            </ElSelect>
          </ElFormItem>
          <ElFormItem label="物理表名">
            <ElInput v-model="form.masterTable" placeholder="如：biz_customer" />
          </ElFormItem>
          <ElFormItem label="主键列">
            <ElInput v-model="form.pkColumn" placeholder="id" />
          </ElFormItem>
        </template>
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

    <FieldModelDesigner
      v-if="fieldDesigning"
      v-model="fieldDesignerVisible"
      :form-name="fieldDesigning.formName"
      :field-json="fieldDesigning.fieldJson"
      :master-table="fieldDesigning.masterTable"
      :dblink-code="fieldDesigning.dblinkCode"
      @save="onFieldDesignerSave"
    />

    <ElDrawer v-model="previewVisible" title="表单预览" size="640px">
      <OnlineFormRenderer
        v-if="previewing && previewVisible"
        :render="renderPreview()"
      />
    </ElDrawer>
  </Page>
    <ElDrawer v-model="permVisible" title="数据权限配置" size="480px">
      <ElForm label-position="top">
        <ElFormItem label="可见范围">
          <ElSelect v-model="permForm.scopeType">
            <ElOption
              v-for="scope in ONLINE_DATA_SCOPES"
              :key="scope.value"
              :label="scope.label"
              :value="scope.value"
            />
          </ElSelect>
        </ElFormItem>
        <template v-if="permForm.scopeType === 4">
          <ElFormItem label="自定义用户 Id（JSON 数组）">
            <ElInput v-model="permForm.customUserIds" type="textarea" :rows="2" />
          </ElFormItem>
          <ElFormItem label="自定义部门 Id（JSON 数组）">
            <ElInput v-model="permForm.customDeptIds" type="textarea" :rows="2" />
          </ElFormItem>
        </template>
      </ElForm>
      <template #footer>
        <ElButton @click="permVisible = false">取消</ElButton>
        <ElButton type="primary" @click="onPermSave">保存权限</ElButton>
      </template>
    </ElDrawer>

</template>
