<script lang="ts" setup>
/**
 * 发起流程对话框（阶段 6）。
 *
 * 「办理人提示」由手填 JSON 改为结构化配置：从已发布版本的节点快照
 * 加载用户任务节点列表，逐个用选人弹窗挑人，自动生成 assigneeHints。
 * 业务表单 / 流程变量仍用 JSON 输入（它们是业务数据，不是内部 Id）。
 */
import type {
  FlowEntryVO,
  FlowIdentityVO,
  FlowStartReq,
  FlowTaskExtVO,
} from '#/api/flow';

import { computed, reactive, ref, watch } from 'vue';

import {
  ElButton,
  ElDialog,
  ElEmpty,
  ElForm,
  ElFormItem,
  ElInput,
  ElMessage,
  ElOption,
  ElSelect,
  ElSwitch,
  ElTag,
} from 'element-plus';

import {
  getFlowTaskExtList,
  getStartableFlowList,
  startFlow,
} from '#/api/flow';

import FlowIdentityPicker from '../shared/FlowIdentityPicker.vue';

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{
  changed: [];
  'update:modelValue': [value: boolean];
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
});

/**
 * placeholder 里含 JSON 双引号，直接写在模板属性上会让 oxfmt（外层单引号）
 * 与 vue/html-quotes（要求外层双引号）互相改回。用常量绑定，两边都稳定。
 */
const PLACEHOLDER_FORM = '例如 {"amount": 1000}';
const PLACEHOLDER_VARS = '例如 {"days": 3}';

const entries = ref<FlowEntryVO[]>([]);
const nodeOptions = ref<FlowTaskExtVO[]>([]);
const assigneeHints = ref<Record<string, string[]>>({});
const hintNames = ref<Record<string, FlowIdentityVO[]>>({});
const pickerVisible = ref(false);
const currentNodeId = ref('');
const saving = ref(false);

const form = reactive({
  businessKey: '',
  draft: false,
  entryId: '',
  formDataJson: '',
  title: '',
  variablesJson: '',
});

watch(
  () => props.modelValue,
  async (isOpen) => {
    if (!isOpen) return;
    form.businessKey = '';
    form.draft = false;
    form.entryId = '';
    form.formDataJson = '';
    form.title = '';
    form.variablesJson = '';
    assigneeHints.value = {};
    hintNames.value = {};
    nodeOptions.value = [];
    try {
      entries.value = await getStartableFlowList();
    } catch (error) {
      console.error('[flow] load startable entries failed', error);
      entries.value = [];
    }
  },
);

async function loadNodes(entryId: string) {
  assigneeHints.value = {};
  hintNames.value = {};
  nodeOptions.value = [];
  const entry: FlowEntryVO | undefined = entries.value.find(
    (item) => item.entryId === entryId,
  );
  const publishId = entry?.mainEntryPublishId;
  if (!publishId) return;
  try {
    nodeOptions.value = (await getFlowTaskExtList(publishId)) ?? [];
  } catch (error) {
    console.error('[flow] load published task nodes failed', error);
  }
}

watch(
  () => form.entryId,
  (entryId) => {
    if (entryId) void loadNodes(entryId);
  },
);

function openPicker(nodeId: string) {
  currentNodeId.value = nodeId;
  pickerVisible.value = true;
}

function onPickerConfirm(rows: FlowIdentityVO[]) {
  const nodeId = currentNodeId.value;
  if (!nodeId) return;
  assigneeHints.value = {
    ...assigneeHints.value,
    [nodeId]: rows.map((row) => row.id),
  };
  hintNames.value = { ...hintNames.value, [nodeId]: rows };
}

function removeHint(nodeId: string, userId: string) {
  const ids = (assigneeHints.value[nodeId] ?? []).filter((id) => id !== userId);
  const names = (hintNames.value[nodeId] ?? []).filter(
    (user) => user.id !== userId,
  );
  assigneeHints.value = { ...assigneeHints.value, [nodeId]: ids };
  hintNames.value = { ...hintNames.value, [nodeId]: names };
}

function parseObject(
  text: string,
  label: string,
): null | Record<string, unknown> {
  if (!text.trim()) return {};
  try {
    const value: unknown = JSON.parse(text);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      ElMessage.warning(`${label} 必须是 JSON 对象`);
      return null;
    }
    return value as Record<string, unknown>;
  } catch {
    ElMessage.warning(`${label} 不是合法 JSON`);
    return null;
  }
}

async function onSubmit() {
  if (!form.entryId) {
    ElMessage.warning('请选择流程定义');
    return;
  }
  const formData = parseObject(form.formDataJson, '业务表单');
  const variables = parseObject(form.variablesJson, '流程变量');
  if (!formData || !variables) return;

  const req: FlowStartReq = {
    businessKey: form.businessKey || undefined,
    draft: form.draft,
    entryId: form.entryId,
    formData,
    title: form.title || undefined,
    variables,
  };
  const hints: Record<string, unknown> = {};
  for (const [nodeId, ids] of Object.entries(assigneeHints.value)) {
    if (ids.length === 1) hints[nodeId] = ids[0];
    else if (ids.length > 1) hints[nodeId] = ids;
  }
  if (Object.keys(hints).length > 0) {
    req.assigneeHints = hints;
  }

  saving.value = true;
  try {
    await startFlow(req);
    ElMessage.success(form.draft ? '已暂存待审' : '流程已发起');
    visible.value = false;
    emit('changed');
  } catch (error) {
    console.error('[flow] start failed', error);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <ElDialog v-model="visible" title="发起流程" width="680px" destroy-on-close>
    <ElForm label-width="110px">
      <ElFormItem label="流程定义" required>
        <ElSelect
          v-model="form.entryId"
          filterable
          placeholder="选择已发布的流程"
          style="width: 100%"
        >
          <ElOption
            v-for="item in entries"
            :key="item.entryId"
            :label="`${item.processDefinitionName} (${item.mainVersionName ?? ''})`"
            :value="item.entryId"
          />
        </ElSelect>
      </ElFormItem>
      <ElFormItem label="流程标题">
        <ElInput
          v-model="form.title"
          placeholder="留空按流程标题规则自动生成"
        />
      </ElFormItem>
      <ElFormItem label="业务主键">
        <ElInput v-model="form.businessKey" placeholder="可选" />
      </ElFormItem>
      <ElFormItem label="暂存待审">
        <ElSwitch v-model="form.draft" />
        <span class="hint">开启后只落工单草稿，不启动流程实例</span>
      </ElFormItem>
      <ElFormItem label="业务表单 JSON">
        <ElInput
          v-model="form.formDataJson"
          type="textarea"
          :rows="3"
          :placeholder="PLACEHOLDER_FORM"
        />
      </ElFormItem>
      <ElFormItem label="流程变量 JSON">
        <ElInput
          v-model="form.variablesJson"
          type="textarea"
          :rows="2"
          :placeholder="PLACEHOLDER_VARS"
        />
      </ElFormItem>
      <ElFormItem label="指定办理人">
        <div class="hint-nodes">
          <ElEmpty
            v-if="nodeOptions.length === 0"
            description="选择流程定义后显示可指定办理人的节点"
            :image-size="44"
          />
          <div v-for="node in nodeOptions" :key="node.taskId" class="hint-node">
            <span class="hint-node__name">
              {{ node.taskName || node.taskId }}
            </span>
            <ElTag
              v-for="user in hintNames[node.taskId ?? ''] ?? []"
              :key="user.id"
              closable
              size="small"
              @close="removeHint(node.taskId ?? '', user.id)"
            >
              {{ user.name }}
            </ElTag>
            <ElButton size="small" @click="openPicker(node.taskId ?? '')">
              选择办理人
            </ElButton>
          </div>
          <p class="hint">
            可选：为某些节点临时指定办理人，优先级高于流程设计里的静态配置。
          </p>
        </div>
      </ElFormItem>
    </ElForm>

    <template #footer>
      <ElButton @click="visible = false">取消</ElButton>
      <ElButton type="primary" :loading="saving" @click="onSubmit">
        确定
      </ElButton>
    </template>
  </ElDialog>

  <FlowIdentityPicker
    v-model="pickerVisible"
    :selected-ids="assigneeHints[currentNodeId] ?? []"
    title="指定节点办理人"
    @confirm="onPickerConfirm"
  />
</template>

<style scoped>
.hint {
  margin-left: 10px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.hint-nodes {
  width: 100%;
}

.hint-node {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.hint-node__name {
  min-width: 120px;
  font-size: 13px;
}

.hint-nodes .hint {
  margin: 8px 0 0;
}
</style>
