<script setup lang="ts">
import type { FormInstance } from 'element-plus';

import type {
  AiExpert,
  ExpertFormOption,
  ExpertFormOptions,
  ExpertValidationResult,
} from '#/api/ai';

import { computed, onMounted, reactive, ref } from 'vue';

import {
  ElAlert,
  ElButton,
  ElDescriptions,
  ElDescriptionsItem,
  ElDivider,
  ElDrawer,
  ElForm,
  ElFormItem,
  ElInput,
  ElInputNumber,
  ElMessage,
  ElMessageBox,
  ElOption,
  ElRadio,
  ElRadioGroup,
  ElSelect,
  ElSwitch,
  ElTable,
  ElTableColumn,
  ElTag,
} from 'element-plus';

import { aiExpertApi } from '#/api/ai';

import { usePermission } from '../../system/shared/helpers';

const { has } = usePermission();
const experts = ref<AiExpert[]>([]);
const formOptions = ref<ExpertFormOptions>({
  models: [],
  prompts: [],
  skills: [],
  mcpServers: [],
  knowledgeBases: [],
});
const keyword = ref('');
const status = ref('');
const loading = ref(false);
const optionsLoading = ref(false);
const saving = ref(false);
const validating = ref(false);
const drawerVisible = ref(false);
const editing = ref(false);
const validation = ref<ExpertValidationResult | null>(null);
const formRef = ref<FormInstance>();
const rules = {
  code: [{ required: true, message: '请输入编码', trigger: 'blur' }],
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
  modelCode: [{ required: true, message: '请选择模型', trigger: 'change' }],
  maxIters: [
    { required: true, message: '请设置最大推理轮次', trigger: 'blur' },
  ],
};
const form = reactive({
  id: '',
  code: '',
  name: '',
  avatar: '',
  description: '',
  modelCode: '',
  promptCode: '',
  promptVersion: '',
  skillCodes: [] as string[],
  mcpCodes: null as null | string[],
  kbCodes: [] as string[],
  sandboxType: 'LOCAL' as 'LOCAL' | 'REMOTE',
  maxIters: 20,
  enabled: 1,
});

const filteredExperts = computed(() => {
  const query = keyword.value.trim().toLowerCase();
  return experts.value.filter((item) => {
    const matchesStatus =
      status.value === '' || item.enabled === Number(status.value);
    const matchesQuery =
      !query ||
      `${item.name} ${item.code} ${item.description ?? ''}`
        .toLowerCase()
        .includes(query);
    return matchesStatus && matchesQuery;
  });
});

const stats = computed(() => ({
  total: experts.value.length,
  enabled: experts.value.filter((item) => item.enabled === 1).length,
  disabled: experts.value.filter((item) => item.enabled === 0).length,
  skills: experts.value.reduce(
    (sum, item) => sum + parseCodes(item.skillCodesJson).length,
    0,
  ),
}));

const modelOptions = computed(() =>
  withMissing(formOptions.value.models, form.modelCode),
);
const promptValue = computed(() =>
  form.promptCode ? `${form.promptCode}@${form.promptVersion || ''}` : '',
);
const promptOptions = computed(() =>
  withMissing(formOptions.value.prompts, promptValue.value),
);
const skillOptions = computed(() =>
  withMissing(formOptions.value.skills, form.skillCodes),
);
const mcpOptions = computed(() =>
  withMissing(formOptions.value.mcpServers, form.mcpCodes),
);
const knowledgeOptions = computed(() =>
  withMissing(formOptions.value.knowledgeBases, form.kbCodes),
);

function parseCodes(value?: string): string[] {
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

function codesJson(codes: null | string[]): null | string {
  return codes === null ? null : JSON.stringify(codes);
}

function withMissing(
  options: ExpertFormOption[],
  current: null | string | string[],
): ExpertFormOption[] {
  const values = Array.isArray(current) ? current : current ? [current] : [];
  const missing = values.filter(
    (value) => !options.some((item) => item.value === value),
  );
  return [
    ...missing.map((value) => ({
      value,
      label: `${value}（历史绑定）`,
      disabled: false,
    })),
    ...options,
  ];
}

function formatDate(value?: string) {
  return value ? value.replace('T', ' ').slice(0, 19) : '-';
}

async function load() {
  loading.value = true;
  try {
    experts.value = await aiExpertApi.list();
  } finally {
    loading.value = false;
  }
}

async function loadFormOptions() {
  optionsLoading.value = true;
  try {
    formOptions.value = await aiExpertApi.formOptions();
  } finally {
    optionsLoading.value = false;
  }
}

function resetForm() {
  Object.assign(form, {
    id: '',
    code: '',
    name: '',
    avatar: '',
    description: '',
    modelCode: '',
    promptCode: '',
    promptVersion: '',
    skillCodes: [],
    mcpCodes: null,
    kbCodes: [],
    sandboxType: 'LOCAL',
    maxIters: 20,
    enabled: 1,
  });
  validation.value = null;
  formRef.value?.clearValidate();
}

function openAdd() {
  resetForm();
  editing.value = false;
  drawerVisible.value = true;
}

function openEdit(row: AiExpert) {
  resetForm();
  Object.assign(form, {
    id: row.id,
    code: row.code,
    name: row.name,
    avatar: row.avatar ?? '',
    description: row.description ?? '',
    modelCode: row.modelCode,
    promptCode: row.promptCode ?? '',
    promptVersion: row.promptVersion ?? '',
    skillCodes: parseCodes(row.skillCodesJson),
    mcpCodes: row.mcpCodesJson ? parseCodes(row.mcpCodesJson) : null,
    kbCodes: parseCodes(row.kbCodesJson),
    sandboxType: row.sandboxType === 'REMOTE' ? 'REMOTE' : 'LOCAL',
    maxIters: row.maxIters ?? 20,
    enabled: row.enabled ?? 1,
  });
  editing.value = true;
  drawerVisible.value = true;
}

function selectPrompt(value: string) {
  const separator = value.lastIndexOf('@');
  form.promptCode = separator === -1 ? value : value.slice(0, separator);
  form.promptVersion = separator === -1 ? '' : value.slice(separator + 1);
  validation.value = null;
}

async function runValidation(): Promise<ExpertValidationResult> {
  validating.value = true;
  try {
    validation.value = await aiExpertApi.validate(payload());
    return validation.value;
  } finally {
    validating.value = false;
  }
}

function payload(): AiExpert {
  return {
    id: form.id,
    code: form.code,
    name: form.name,
    avatar: form.avatar,
    description: form.description,
    modelCode: form.modelCode,
    promptCode: form.promptCode,
    promptVersion: form.promptVersion,
    skillCodesJson: codesJson(form.skillCodes) ?? undefined,
    mcpCodesJson: codesJson(form.mcpCodes) ?? undefined,
    kbCodesJson: codesJson(form.kbCodes) ?? undefined,
    sandboxType: form.sandboxType,
    maxIters: form.maxIters,
    enabled: form.enabled,
  };
}

async function save() {
  await formRef.value?.validate();
  const result = await runValidation();
  if (!result.valid) {
    ElMessage.warning('请先处理配置体检发现的问题');
    return;
  }
  saving.value = true;
  try {
    if (editing.value) {
      await aiExpertApi.update(payload());
    } else {
      await aiExpertApi.add(payload());
    }
    ElMessage.success('专家配置已保存并生效');
    drawerVisible.value = false;
    await load();
  } finally {
    saving.value = false;
  }
}

async function toggle(row: AiExpert) {
  try {
    await aiExpertApi.toggle(row.id!, row.enabled === 0 ? 1 : 0);
    ElMessage.success(row.enabled === 0 ? '专家已启用' : '专家已停用');
    await load();
  } catch (error: any) {
    ElMessage.error(error?.message || '状态更新失败');
  }
}

async function copy(row: AiExpert) {
  await ElMessageBox.confirm(
    `复制「${row.name}」为停用状态的专家？`,
    '复制专家',
    {
      type: 'info',
    },
  );
  await aiExpertApi.copy(row.id!);
  ElMessage.success('已创建停用副本');
  await load();
}

async function remove(row: AiExpert) {
  await ElMessageBox.confirm(
    `确认删除「${row.name}」？已有会话记录的专家不能删除。`,
    '删除专家',
    { type: 'warning' },
  );
  await aiExpertApi.remove(row.id!);
  ElMessage.success('专家已删除');
  await load();
}

onMounted(async () => {
  await Promise.all([load(), loadFormOptions()]);
});
</script>

<template>
  <div class="expert-page">
    <div class="page-heading">
      <div>
        <h2>Agent 管理</h2>
        <p>统一配置模型、提示词、技能、MCP 与知识库，保存后热更新运行时。</p>
      </div>
      <div class="heading-actions">
        <ElButton :loading="loading" @click="load">刷新</ElButton>
        <ElButton v-if="has('ai:expert:add')" type="primary" @click="openAdd">
          新建 Agent
        </ElButton>
      </div>
    </div>

    <div class="stats-grid">
      <button class="stat-card" @click="status = ''">
        <span>全部 Agent</span>
        <strong>{{ stats.total }}</strong>
        <small>当前可用配置</small>
      </button>
      <button class="stat-card" @click="status = '1'">
        <span>已启用</span>
        <strong class="success">{{ stats.enabled }}</strong>
        <small>可在聊天中选择</small>
      </button>
      <button class="stat-card" @click="status = '0'">
        <span>已停用</span>
        <strong>{{ stats.disabled }}</strong>
        <small>保留配置，不参与运行</small>
      </button>
      <div class="stat-card">
        <span>技能绑定</span>
        <strong>{{ stats.skills }}</strong>
        <small>全部 Agent 的技能引用数</small>
      </div>
    </div>

    <div class="filter-bar">
      <ElInput
        v-model="keyword"
        clearable
        placeholder="搜索名称、编码或描述"
        style="width: 280px"
        @keyup.enter="keyword = keyword.trim()"
      />
      <ElSelect v-model="status" style="width: 140px" aria-label="状态筛选">
        <ElOption label="全部状态" value="" />
        <ElOption label="已启用" value="1" />
        <ElOption label="已停用" value="0" />
      </ElSelect>
      <span class="filter-result">共 {{ filteredExperts.length }} 个 Agent</span>
    </div>

    <ElTable v-loading="loading" :data="filteredExperts" border stripe>
      <ElTableColumn label="Agent" min-width="210">
        <template #default="{ row }">
          <div class="agent-cell">
            <ElTag effect="plain" size="large" class="agent-avatar">
              {{ row.name?.slice(0, 1) || 'A' }}
            </ElTag>
            <div>
              <div class="agent-name">{{ row.name }}</div>
              <div class="agent-code">{{ row.code }}</div>
            </div>
          </div>
        </template>
      </ElTableColumn>
      <ElTableColumn
        prop="description"
        label="说明"
        min-width="180"
        show-overflow-tooltip
      />
      <ElTableColumn
        prop="modelCode"
        label="模型"
        min-width="150"
        show-overflow-tooltip
      />
      <ElTableColumn
        prop="promptCode"
        label="提示词"
        min-width="140"
        show-overflow-tooltip
      >
        <template #default="{ row }">
          {{ row.promptCode || '平台默认' }}
        </template>
      </ElTableColumn>
      <ElTableColumn label="能力" width="220">
        <template #default="{ row }">
          <ElTag size="small">
            技能 {{ parseCodes(row.skillCodesJson).length }}
          </ElTag>
          <ElTag size="small" type="warning">
            MCP
            {{
              row.mcpCodesJson ? parseCodes(row.mcpCodesJson).length : '全部'
            }}
          </ElTag>
          <ElTag size="small" type="info">
            知识库 {{ parseCodes(row.kbCodesJson).length }}
          </ElTag>
          <ElTag
            size="small"
            :type="row.sandboxType === 'REMOTE' ? 'warning' : 'success'"
          >
            {{ row.sandboxType === 'REMOTE' ? '远程沙箱' : '本地沙箱' }}
          </ElTag>
        </template>
      </ElTableColumn>
      <ElTableColumn
        prop="maxIters"
        label="最大轮次"
        width="90"
        align="center"
      />
      <ElTableColumn label="状态" width="90">
        <template #default="{ row }">
          <ElTag :type="row.enabled === 0 ? 'info' : 'success'">
            {{ row.enabled === 0 ? '停用' : '启用' }}
          </ElTag>
        </template>
      </ElTableColumn>
      <ElTableColumn label="更新时间" width="165">
        <template #default="{ row }">{{ formatDate(row.updateTime) }}</template>
      </ElTableColumn>
      <ElTableColumn label="操作" width="230" fixed="right">
        <template #default="{ row }">
          <ElButton link type="primary" @click="openEdit(row as AiExpert)">
            配置
          </ElButton>
          <ElButton
            v-if="has('ai:expert:add')"
            link
            @click="copy(row as AiExpert)"
          >
            复制
          </ElButton>
          <ElButton
            v-if="has('ai:expert:update')"
            link
            :type="row.enabled === 0 ? 'success' : 'warning'"
            @click="toggle(row as AiExpert)"
          >
            {{ row.enabled === 0 ? '启用' : '停用' }}
          </ElButton>
          <ElButton
            v-if="has('ai:expert:delete')"
            link
            type="danger"
            @click="remove(row as AiExpert)"
          >
            删除
          </ElButton>
        </template>
      </ElTableColumn>
    </ElTable>

    <ElDrawer
      v-model="drawerVisible"
      :title="editing ? `配置 Agent · ${form.name}` : '新建 Agent'"
      size="760px"
      destroy-on-close
    >
      <ElForm
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="120px"
        :disabled="saving"
      >
        <section class="form-section">
          <h3>基础信息</h3>
          <ElFormItem label="名称" prop="name" required>
            <ElInput
              v-model="form.name"
              maxlength="128"
              placeholder="例如：通用运维助手"
            />
          </ElFormItem>
          <ElFormItem label="编码" prop="code" required>
            <ElInput
              v-model="form.code"
              :disabled="editing"
              maxlength="64"
              placeholder="唯一编码，同时作为 AG-UI agentId"
            />
            <span class="field-tip">编码创建后不可修改</span>
          </ElFormItem>
          <ElFormItem label="头像 URL">
            <ElInput v-model="form.avatar" placeholder="可选" />
          </ElFormItem>
          <ElFormItem label="说明">
            <ElInput
              v-model="form.description"
              type="textarea"
              :rows="2"
              maxlength="512"
              placeholder="说明这个 Agent 适合处理什么任务"
            />
          </ElFormItem>
          <ElFormItem label="沙箱类型">
            <ElRadioGroup v-model="form.sandboxType">
              <ElRadio value="LOCAL">本地沙箱</ElRadio>
              <ElRadio value="REMOTE">远程沙箱</ElRadio>
            </ElRadioGroup>
            <span class="field-tip">新会话按此类型创建工作区；默认本地，旧会话沿用原有工作区类型</span>
          </ElFormItem>
          <ElFormItem label="启用状态">
            <ElSwitch
              v-model="form.enabled"
              :active-value="1"
              :inactive-value="0"
            />
            <span class="field-tip">启用后立即进入聊天 Agent 选择器</span>
          </ElFormItem>
        </section>

        <ElDivider />

        <section class="form-section">
          <h3>模型与提示词</h3>
          <ElFormItem label="模型" prop="modelCode" required>
            <ElSelect v-model="form.modelCode" filterable style="width: 100%">
              <ElOption
                v-for="option in modelOptions"
                :key="option.value"
                :label="option.label"
                :value="option.value"
                :disabled="option.disabled"
              />
            </ElSelect>
          </ElFormItem>
          <ElFormItem label="提示词">
            <ElSelect
              :model-value="promptValue"
              filterable
              clearable
              style="width: 100%"
              @update:model-value="selectPrompt($event || '')"
            >
              <ElOption
                v-for="option in promptOptions"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </ElSelect>
            <span class="field-tip">仅展示已发布版本，留空使用平台默认提示词</span>
          </ElFormItem>
        </section>

        <ElDivider />

        <section class="form-section">
          <h3>能力绑定</h3>
          <ElFormItem label="技能">
            <ElSelect
              v-model="form.skillCodes"
              multiple
              filterable
              clearable
              style="width: 100%"
              placeholder="选择要注入的技能"
            >
              <ElOption
                v-for="option in skillOptions"
                :key="option.value"
                :label="option.label"
                :value="option.value"
                :disabled="option.disabled"
              />
            </ElSelect>
          </ElFormItem>
          <ElFormItem label="MCP 服务">
            <ElSelect
              v-model="form.mcpCodes"
              multiple
              filterable
              clearable
              style="width: 100%"
              placeholder="留空表示启用全部 MCP"
              @clear="form.mcpCodes = null"
            >
              <ElOption
                v-for="option in mcpOptions"
                :key="option.value"
                :label="option.label"
                :value="option.value"
                :disabled="option.disabled"
              />
            </ElSelect>
            <span class="field-tip">留空启用全部；选择一个或多个则仅启用所选服务</span>
          </ElFormItem>
          <ElFormItem label="知识库">
            <ElSelect
              v-model="form.kbCodes"
              multiple
              filterable
              clearable
              style="width: 100%"
              placeholder="选择要挂载检索工具的知识库"
            >
              <ElOption
                v-for="option in knowledgeOptions"
                :key="option.value"
                :label="option.label"
                :value="option.value"
                :disabled="option.disabled"
              />
            </ElSelect>
          </ElFormItem>
        </section>

        <ElDivider />

        <section class="form-section">
          <h3>运行限制</h3>
          <ElFormItem label="最大推理轮次" prop="maxIters" required>
            <ElInputNumber v-model="form.maxIters" :min="1" :max="100" />
            <span class="field-tip">限制单次任务最大推理轮次，建议 10–30</span>
          </ElFormItem>
        </section>
      </ElForm>

      <ElAlert
        v-if="validation"
        :type="validation.valid ? 'success' : 'error'"
        :title="validation.valid ? '配置体检通过' : '配置体检未通过'"
        :closable="false"
        show-icon
      >
        <div v-if="validation.errors.length">
          <div v-for="error in validation.errors" :key="error">{{ error }}</div>
        </div>
        <div v-if="validation.warnings.length" class="validation-warnings">
          <div v-for="warning in validation.warnings" :key="warning">
            {{ warning }}
          </div>
        </div>
        <ElDescriptions v-if="validation.valid" :column="2" size="small">
          <ElDescriptionsItem label="模型">
            {{ validation.modelName || '-' }}
          </ElDescriptionsItem>
          <ElDescriptionsItem label="技能">
            {{ validation.skillCount }}
          </ElDescriptionsItem>
          <ElDescriptionsItem label="MCP">
            {{ validation.mcpCount < 0 ? '全部' : validation.mcpCount }}
          </ElDescriptionsItem>
          <ElDescriptionsItem label="知识库">
            {{ validation.knowledgeBaseCount }}
          </ElDescriptionsItem>
        </ElDescriptions>
      </ElAlert>

      <template #footer>
        <ElButton :disabled="saving" @click="drawerVisible = false">
          取消
        </ElButton>
        <ElButton
          :loading="validating"
          :disabled="saving"
          @click="runValidation"
        >
          配置体检
        </ElButton>
        <ElButton
          v-if="editing ? has('ai:expert:update') : has('ai:expert:add')"
          type="primary"
          :loading="saving"
          @click="save"
        >
          保存并生效
        </ElButton>
      </template>
    </ElDrawer>
  </div>
</template>

<style scoped>
.expert-page {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 100%;
  padding: 16px;
}

.page-heading,
.heading-actions,
.filter-bar,
.agent-cell,
.form-section h3 {
  display: flex;
  align-items: center;
}

.page-heading {
  gap: 16px;
  justify-content: space-between;
}

.page-heading h2,
.form-section h3 {
  margin: 0;
}

.page-heading p {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.heading-actions,
.filter-bar {
  gap: 10px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.stat-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 108px;
  padding: 16px;
  color: inherit;
  text-align: left;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}

.stat-card span,
.stat-card small {
  color: var(--el-text-color-secondary);
}

.stat-card strong {
  font-size: 26px;
  line-height: 1.2;
}

.stat-card .success {
  color: var(--el-color-success);
}

.filter-result {
  margin-left: auto;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.agent-cell {
  gap: 10px;
}

.agent-avatar {
  flex: none;
  font-weight: 700;
}

.agent-name {
  font-weight: 600;
}

.agent-code {
  margin-top: 3px;
  font-family: monospace;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field-tip {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
}

.validation-warnings {
  margin-top: 6px;
  color: var(--el-color-warning);
}

@media (max-width: 1100px) {
  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 700px) {
  .page-heading {
    flex-direction: column;
    align-items: flex-start;
  }

  .filter-bar {
    flex-direction: column;
    align-items: stretch;
  }

  .filter-result {
    margin-left: 0;
  }
}
</style>
