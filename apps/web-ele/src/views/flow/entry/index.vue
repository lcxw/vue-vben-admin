<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type {
  FlowEntryDTO,
  FlowEntryQuery,
  FlowEntryVO,
} from '#/api/flow';

import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';

import {
  ElButton,
  ElDialog,
  ElDrawer,
  ElForm,
  ElFormItem,
  ElInput,
  ElMessage,
  ElSelect,
  ElOption,
  ElTag,
  type FormInstance,
  type FormRules,
} from 'element-plus';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  createFlowEntry,
  deleteFlowEntry,
  FLOW_BIND_FORM_TYPE,
  FLOW_DIAGRAM_TYPE,
  FLOW_ENTRY_STATUS,
  getFlowCategoryDict,
  getFlowEntryPage,
  publishFlowEntry,
  updateFlowEntry,
  uploadFlowBpmn,
  downloadFlowBpmn,
  dictLabel,
} from '#/api/flow';

import {
  confirmAction,
  usePermission,
  withFeedback,
} from '../../system/shared/helpers';
import { FLOW_PERM } from '../shared/constants';
import { FL } from '../shared/labels';
import VersionDialog from './VersionDialog.vue';

interface CategoryOption {
  code?: string;
  id: string;
  name: string;
}

const router = useRouter();
const { has } = usePermission();
const drawerVisible = ref(false);
const saving = ref(false);
const editing = ref<null | FlowEntryVO>(null);
const formRef = ref<FormInstance>();
const categories = ref<CategoryOption[]>([]);
const form = reactive<FlowEntryDTO>({});

const versionVisible = ref(false);
const versionEntry = ref<FlowEntryVO | null>(null);

const importVisible = ref(false);
const importEntryId = ref('');
const importXml = ref('');
const importLoading = ref(false);

const rules: FormRules = {
  processDefinitionName: [
    { required: true, message: '请输入流程名称', trigger: 'blur' },
  ],
};

const searchSchema: VbenFormSchema[] = [
  { component: 'Input', fieldName: 'keyword', label: FL.entry.name },
  {
    component: 'Select',
    fieldName: 'status',
    label: FL.entry.status,
    componentProps: {
      clearable: true,
      options: FLOW_ENTRY_STATUS.map((item) => ({
        label: item.label,
        value: item.value,
      })),
      placeholder: '全部',
    },
  },
];

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: { schema: searchSchema, submitOnChange: true },
  gridOptions: {
    columns: [
      { field: 'processDefinitionName', title: FL.entry.name, minWidth: 180 },
      { field: 'processDefinitionKey', title: FL.entry.key, minWidth: 180 },
      {
        field: 'status',
        title: FL.entry.status,
        width: 110,
        slots: { default: 'status' },
      },
      { field: 'latestVersionName', title: FL.entry.latestVersion, width: 110 },
      { field: 'mainVersionName', title: FL.entry.mainVersion, width: 110 },
      { field: 'publishCount', title: FL.entry.publishCount, width: 90 },
      { field: 'createTime', title: '创建时间', minWidth: 180 },
      {
        align: 'center',
        field: 'operation',
        fixed: 'right',
        slots: { default: 'action' },
        title: FL.common.action,
        width: 360,
      },
    ],
    height: 'auto',
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues: Partial<FlowEntryQuery>) =>
          await getFlowEntryPage({
            keyword: formValues?.keyword,
            pageNum: page.currentPage,
            pageSize: page.pageSize,
            status: formValues?.status,
          }),
      },
    },
    rowConfig: { keyField: 'entryId' },
    toolbarConfig: { custom: true, refresh: true, zoom: true },
  } as VxeTableGridOptions<FlowEntryVO>,
});

async function loadCategories() {
  try {
    categories.value = await getFlowCategoryDict();
  } catch (error) {
    console.error('[flow] load categories failed', error);
  }
}
loadCategories();

function resetForm(row?: FlowEntryVO) {
  Object.assign(form, {
    bindFormType: row?.bindFormType ?? 0,
    categoryId: row?.categoryId ?? undefined,
    diagramType: row?.diagramType ?? 0,
    entryId: row?.entryId,
    processDefinitionKey: row?.processDefinitionKey ?? '',
    processDefinitionName: row?.processDefinitionName ?? '',
    remark: row?.remark ?? '',
  });
  formRef.value?.clearValidate();
}

function openCreate() {
  editing.value = null;
  resetForm();
  drawerVisible.value = true;
}

function openEdit(row: FlowEntryVO) {
  editing.value = row;
  resetForm(row);
  drawerVisible.value = true;
}

function openDesign(row: FlowEntryVO) {
  router.push({ name: 'FlowEntryDesign', params: { id: row.entryId } });
}

function openVersions(row: FlowEntryVO) {
  versionEntry.value = row;
  versionVisible.value = true;
}

async function onSubmit() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  saving.value = true;
  try {
    const payload: FlowEntryDTO = { ...form };
    const result = await (editing.value
      ? updateFlowEntry(payload)
      : createFlowEntry(payload));
    const ok = Boolean(result);
    if (ok) {
      ElMessage.success(FL.common.operationSuccess);
      drawerVisible.value = false;
      gridApi.query();
      // 新建后直接进入设计器，减少一次点击
      if (!editing.value && result?.entryId) openDesign(result);
    }
  } catch (error) {
    console.error('[flow] save entry failed', error);
  } finally {
    saving.value = false;
  }
}

async function onPublish(row: FlowEntryVO) {
  if (
    !(await confirmAction(
      `确定基于「${row.processDefinitionName}」的当前草稿发布新版本吗？`,
      FL.entry.publish,
    ))
  ) {
    return;
  }
  const result = await publishFlowEntry(row.entryId).catch((error) => {
    console.error('[flow] publish failed', error);
    return null;
  });
  if (result) {
    ElMessage.success(`已发布 ${result.versionName ?? '新版本'}`);
    gridApi.query();
  }
}

async function onDelete(row: FlowEntryVO) {
  if (
    !(await confirmAction(`确定删除流程「${row.processDefinitionName}」吗？`))
  ) {
    return;
  }
  const ok = await withFeedback(() => deleteFlowEntry(row.entryId));
  if (ok) gridApi.query();
}

function onImport(row: FlowEntryVO) {
  importEntryId.value = row.entryId;
  importXml.value = '';
  importVisible.value = true;
}

async function onImportSubmit() {
  if (!importXml.value.trim()) {
    ElMessage.warning('请粘贴 BPMN XML');
    return;
  }
  importLoading.value = true;
  try {
    const ok = await withFeedback(() =>
      uploadFlowBpmn(importEntryId.value, importXml.value),
    );
    if (ok) {
      importVisible.value = false;
      gridApi.query();
    }
  } finally {
    importLoading.value = false;
  }
}

async function onExport(row: FlowEntryVO) {
  try {
    const xml = await downloadFlowBpmn(row.entryId);
    const blob = new Blob([xml ?? ''], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${row.processDefinitionKey}.bpmn20.xml`;
    anchor.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('[flow] export failed', error);
  }
}
</script>

<template>
  <Page :title="FL.entry.title" description="新建流程、设计流程图、发布与管理版本">
    <Grid>
      <template #toolbar-actions>
        <ElButton
          v-if="has(FLOW_PERM.entry.add)"
          type="primary"
          @click="openCreate"
        >
          {{ FL.common.create }}
        </ElButton>
      </template>
      <template #status="{ row }">
        <ElTag :type="row.status === 1 ? 'success' : 'info'">
          {{ dictLabel(FLOW_ENTRY_STATUS, row.status) }}
        </ElTag>
      </template>
      <template #action="{ row }">
        <ElButton link type="primary" @click="openDesign(row)">设计</ElButton>
        <ElButton
          v-if="has(FLOW_PERM.entry.update)"
          link
          type="primary"
          @click="openEdit(row)"
        >
          {{ FL.common.edit }}
        </ElButton>
        <ElButton
          v-if="has(FLOW_PERM.entry.publish)"
          link
          type="primary"
          @click="onPublish(row)"
        >
          {{ FL.entry.publish }}
        </ElButton>
        <ElButton link type="primary" @click="openVersions(row)">
          {{ FL.entry.versionManage }}
        </ElButton>
        <ElButton link @click="onImport(row)">导入</ElButton>
        <ElButton link @click="onExport(row)">导出</ElButton>
        <ElButton
          v-if="has(FLOW_PERM.entry.remove)"
          link
          type="danger"
          @click="onDelete(row)"
        >
          {{ FL.common.delete }}
        </ElButton>
      </template>
    </Grid>

    <!-- 新增/编辑基础信息 -->
    <ElDrawer
      v-model="drawerVisible"
      :title="editing ? '编辑流程' : '新建流程'"
      destroy-on-close
      size="520px"
    >
      <ElForm ref="formRef" :model="form" :rules="rules" label-width="100px">
        <ElFormItem :label="FL.entry.name" prop="processDefinitionName">
          <ElInput v-model="form.processDefinitionName" placeholder="如：请假申请" />
        </ElFormItem>
        <ElFormItem :label="FL.entry.key" prop="processDefinitionKey">
          <ElInput
            v-model="form.processDefinitionKey"
            :disabled="Boolean(editing)"
            placeholder="留空自动生成，如 flow_leave"
          />
        </ElFormItem>
        <ElFormItem :label="FL.entry.category" prop="categoryId">
          <ElSelect v-model="form.categoryId" clearable style="width: 100%">
            <ElOption
              v-for="item in categories"
              :key="item.id"
              :label="item.name"
              :value="item.id"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem :label="FL.entry.diagramType" prop="diagramType">
          <ElSelect v-model="form.diagramType" style="width: 100%">
            <ElOption
              v-for="item in FLOW_DIAGRAM_TYPE"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem :label="FL.entry.bindFormType" prop="bindFormType">
          <ElSelect v-model="form.bindFormType" style="width: 100%">
            <ElOption
              v-for="item in FLOW_BIND_FORM_TYPE"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="备注" prop="remark">
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

    <!-- 版本管理 -->
    <VersionDialog
      v-if="versionEntry"
      v-model="versionVisible"
      :entry-id="versionEntry.entryId"
      :entry-name="versionEntry.processDefinitionName"
      @changed="gridApi.query()"
    />

    <!-- 导入 BPMN XML -->
    <ElDialog v-model="importVisible" title="导入 BPMN XML" width="640px">
      <ElInput
        v-model="importXml"
        type="textarea"
        :rows="14"
        placeholder="粘贴标准 BPMN 2.0 XML；导入后仅覆盖草稿，不产生版本"
      />
      <template #footer>
        <ElButton @click="importVisible = false">
          {{ FL.common.cancel }}
        </ElButton>
        <ElButton type="primary" :loading="importLoading" @click="onImportSubmit">
          {{ FL.common.confirm }}
        </ElButton>
      </template>
    </ElDialog>
  </Page>
</template>
