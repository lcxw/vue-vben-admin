<script lang="ts" setup>
import type {
  FlowEntryDTO,
  FlowEntryVO,
  FlowVariableVO,
} from '#/api/flow';

import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import {
  ElButton,
  ElCard,
  ElForm,
  ElFormItem,
  ElInput,
  ElMessage,
  ElOption,
  ElSelect,
  ElStep,
  ElSteps,
  ElTable,
  ElTableColumn,
  ElTag,
} from 'element-plus';

import {
  deleteFlowVariable,
  FLOW_BIND_FORM_TYPE,
  FLOW_ENTRY_STATUS,
  getFlowCategoryDict,
  getFlowEntry,
  getFlowVariableList,
  publishFlowEntry,
  saveFlowDraft,
  updateFlowEntry,
  dictLabel,
} from '#/api/flow';

import {
  confirmAction,
  usePermission,
} from '../../system/shared/helpers';
import FlowDesigner from '../designer/FlowDesigner.vue';
import { FLOW_PERM } from '../shared/constants';
import { FL } from '../shared/labels';
import VariableForm from '../variable/VariableForm.vue';

interface CategoryOption {
  id: string;
  name: string;
}

/** ElTable 插槽行类型（Element Plus 暴露的是 DefaultRow = Record<string, any>） */
type TableRow = Record<string, any>;

const route = useRoute();
const router = useRouter();
const { has } = usePermission();
const entryId = computed(() => String(route.params.id ?? ''));

const activeStep = ref(0);
const loading = ref(false);
const saving = ref(false);
const publishing = ref(false);
const entry = ref<FlowEntryVO | null>(null);
const variables = ref<FlowVariableVO[]>([]);
const categories = ref<CategoryOption[]>([]);
const bpmnXml = ref('');
const extensionData = ref('');
const designerRef = ref<{ getXml: () => Promise<string> }>();

const variableFormVisible = ref(false);
const editingVariable = ref<null | FlowVariableVO>(null);

const basicForm = ref<FlowEntryDTO>({});

async function load() {
  if (!entryId.value) return;
  loading.value = true;
  try {
    const [detail, vars, cats] = await Promise.all([
      getFlowEntry(entryId.value),
      getFlowVariableList(entryId.value),
      getFlowCategoryDict(),
    ]);
    entry.value = detail;
    variables.value = vars;
    categories.value = cats;
    bpmnXml.value = detail.bpmnXml ?? '';
    extensionData.value = detail.extensionData ?? '';
    basicForm.value = {
      bindFormType: detail.bindFormType,
      categoryId: detail.categoryId,
      defaultFormId: detail.defaultFormId,
      defaultRouterName: detail.defaultRouterName,
      entryId: detail.entryId,
      pageId: detail.pageId,
      processDefinitionKey: detail.processDefinitionKey,
      processDefinitionName: detail.processDefinitionName,
      remark: detail.remark,
    };
  } catch (error) {
    console.error('[flow] load designer data failed', error);
  } finally {
    loading.value = false;
  }
}

onMounted(load);

async function onSave() {
  if (!entry.value) return;
  saving.value = true;
  try {
    const xml = (await designerRef.value?.getXml()) ?? bpmnXml.value;
    await saveFlowDraft({
      bpmnXml: xml,
      entryId: entryId.value,
      extensionData: extensionData.value,
    });
    await updateFlowEntry({ ...basicForm.value, entryId: entryId.value });
    bpmnXml.value = xml;
    ElMessage.success('草稿与基础信息已保存');
  } catch (error) {
    console.error('[flow] save draft failed', error);
  } finally {
    saving.value = false;
  }
}

async function onPublish() {
  if (!entry.value) return;
  if (
    !(await confirmAction(
      '发布前会先保存当前草稿，然后生成新的流程版本，确定继续吗？',
      FL.entry.publish,
    ))
  ) {
    return;
  }
  publishing.value = true;
  try {
    const xml = (await designerRef.value?.getXml()) ?? bpmnXml.value;
    await saveFlowDraft({
      bpmnXml: xml,
      entryId: entryId.value,
      extensionData: extensionData.value,
    });
    const result = await publishFlowEntry(entryId.value);
    ElMessage.success(`已发布 ${result.versionName ?? '新版本'}`);
    await load();
  } catch (error) {
    console.error('[flow] publish failed', error);
  } finally {
    publishing.value = false;
  }
}

function openVariableForm(row?: TableRow) {
  editingVariable.value = (row as FlowVariableVO | undefined) ?? null;
  variableFormVisible.value = true;
}

async function onVariableSaved() {
  variables.value = await getFlowVariableList(entryId.value);
}

async function onDeleteVariable(row: TableRow) {
  if (!(await confirmAction(`确定删除变量「${row.showName}」吗？`))) return;
  try {
    await deleteFlowVariable(row.variableId);
    await onVariableSaved();
  } catch (error) {
    console.error('[flow] delete variable failed', error);
  }
}

function goBack() {
  router.push({ name: 'FlowEntry' });
}
</script>

<template>
  <div class="flow-designer-page">
    <ElCard shadow="never">
      <template #header>
        <div class="flow-designer-page__header">
          <div>
            <ElButton link @click="goBack">← 返回流程列表</ElButton>
            <b class="ml-2">
              {{ entry?.processDefinitionName ?? '流程设计' }}
            </b>
            <ElTag v-if="entry" class="ml-2" size="small">
              {{ dictLabel(FLOW_ENTRY_STATUS, entry.status) }}
            </ElTag>
            <span class="ml-2 text-xs text-gray-400">
              {{ entry?.processDefinitionKey }}
            </span>
          </div>
          <div class="flex gap-2">
            <ElButton :loading="saving" @click="onSave">保存草稿</ElButton>
            <ElButton
              v-if="has(FLOW_PERM.entry.publish)"
              type="primary"
              :loading="publishing"
              @click="onPublish"
            >
              {{ FL.entry.publish }}
            </ElButton>
          </div>
        </div>
      </template>

      <ElSteps :active="activeStep" align-center class="mb-4">
        <ElStep title="基础信息" @click="activeStep = 0" />
        <ElStep title="流程变量" @click="activeStep = 1" />
        <ElStep title="审批状态" @click="activeStep = 2" />
        <ElStep title="流程设计" @click="activeStep = 3" />
      </ElSteps>

      <div v-loading="loading" class="flow-designer-page__content">
        <!-- 1 基础信息 -->
        <ElForm
          v-show="activeStep === 0"
          :model="basicForm"
          label-width="110px"
          style="max-width: 720px"
        >
          <ElFormItem :label="FL.entry.name">
            <ElInput v-model="basicForm.processDefinitionName" />
          </ElFormItem>
          <ElFormItem :label="FL.entry.key">
            <ElInput v-model="basicForm.processDefinitionKey" disabled />
          </ElFormItem>
          <ElFormItem :label="FL.entry.category">
            <ElSelect v-model="basicForm.categoryId" clearable style="width: 100%">
              <ElOption
                v-for="item in categories"
                :key="item.id"
                :label="item.name"
                :value="item.id"
              />
            </ElSelect>
          </ElFormItem>
          <ElFormItem :label="FL.entry.bindFormType">
            <ElSelect v-model="basicForm.bindFormType" style="width: 100%">
              <ElOption
                v-for="item in FLOW_BIND_FORM_TYPE"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </ElSelect>
          </ElFormItem>
          <ElFormItem label="在线页面 Id">
            <ElInput v-model="basicForm.pageId" />
          </ElFormItem>
          <ElFormItem label="默认表单 Id">
            <ElInput v-model="basicForm.defaultFormId" />
          </ElFormItem>
          <ElFormItem label="前端路由名">
            <ElInput v-model="basicForm.defaultRouterName" />
          </ElFormItem>
          <ElFormItem label="备注">
            <ElInput v-model="basicForm.remark" type="textarea" :rows="3" />
          </ElFormItem>
        </ElForm>

        <!-- 2 流程变量 -->
        <div v-show="activeStep === 1">
          <div class="mb-3">
            <ElButton
              v-if="has(FLOW_PERM.variable.add)"
              type="primary"
              size="small"
              @click="openVariableForm()"
            >
              新增变量
            </ElButton>
            <span class="ml-3 text-xs text-gray-400">
              内置变量由系统创建，发布时会随版本做快照。
            </span>
          </div>
          <ElTable :data="variables" border size="small" style="max-width: 900px">
            <ElTableColumn :label="FL.variable.showName" prop="showName" min-width="150" />
            <ElTableColumn :label="FL.variable.variableName" prop="variableName" min-width="160" />
            <ElTableColumn :label="FL.variable.type" prop="variableTypeName" width="140" />
            <ElTableColumn :label="FL.variable.builtin" width="90">
              <template #default="{ row }">
                <ElTag v-if="row.builtin === 1" type="info" size="small">内置</ElTag>
              </template>
            </ElTableColumn>
            <ElTableColumn label="操作" width="140">
              <template #default="{ row }">
                <ElButton link type="primary" @click="openVariableForm(row)">
                  {{ FL.common.edit }}
                </ElButton>
                <ElButton
                  v-if="row.builtin !== 1 && has(FLOW_PERM.variable.remove)"
                  link
                  type="danger"
                  @click="onDeleteVariable(row)"
                >
                  {{ FL.common.delete }}
                </ElButton>
              </template>
            </ElTableColumn>
          </ElTable>
        </div>

        <!-- 3 审批状态 / 扩展配置 -->
        <div v-show="activeStep === 2" style="max-width: 720px">
          <p class="mb-2 text-sm text-gray-500">
            审批状态字典、通知方式等扩展配置，以 JSON 保存并与草稿一起写入流程定义。
          </p>
          <ElInput v-model="extensionData" type="textarea" :rows="14" />
        </div>

        <!-- 4 流程设计 -->
        <div v-show="activeStep === 3" class="flow-designer-page__canvas">
          <FlowDesigner
            v-if="entry"
            ref="designerRef"
            v-model="bpmnXml"
            :process-key="entry.processDefinitionKey"
            :process-name="entry.processDefinitionName"
            :variables="variables"
            @save="onSave"
          />
        </div>
      </div>
    </ElCard>

    <VariableForm
      v-model="variableFormVisible"
      :entry-id="entryId"
      :variable="editingVariable"
      @saved="onVariableSaved"
    />
  </div>
</template>

<style scoped>
.flow-designer-page {
  padding: 12px;
}

.flow-designer-page__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.flow-designer-page__content {
  min-height: 480px;
}

.flow-designer-page__canvas {
  height: 700px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 4px;
  overflow: hidden;
}
</style>
