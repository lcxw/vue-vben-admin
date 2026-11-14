<script lang="ts" setup>
/**
 * 审批人场景配置表单：按 11 种 groupType 只渲染该场景需要的控件，
 * 不再让用户手填用户 Id / 表达式 / 节点 Id。所有选人都走 oidc-server 的
 * OpenFeign 链路（/flow/identity/*），并支持「预览办理人」在设计期验证配置。
 */
import type {
  FlowIdentityVO,
  FlowSceneConfig,
  FlowVariableVO,
} from '#/api/flow';

import { computed, ref, watch } from 'vue';

import {
  ElAlert,
  ElButton,
  ElForm,
  ElFormItem,
  ElInput,
  ElInputNumber,
  ElOption,
  ElSelect,
  ElSwitch,
  ElTag,
} from 'element-plus';

import {
  FLOW_GROUP_TYPE,
  getFlowDepts,
  getFlowPosts,
  getFlowRoles,
  getFlowUsersByIds,
  previewFlowAssignees,
} from '#/api/flow';

import FlowIdentityPicker from './FlowIdentityPicker.vue';

const props = defineProps<{
  modelValue: FlowSceneConfig;
  nodes: Array<{ id: string; name: string }>;
  variables: FlowVariableVO[];
}>();

const emit = defineEmits<{
  change: [];
  'update:modelValue': [value: FlowSceneConfig];
}>();

const roleOptions = ref<FlowIdentityVO[]>([]);
const deptOptions = ref<FlowIdentityVO[]>([]);
const postOptions = ref<FlowIdentityVO[]>([]);
const userNames = ref<FlowIdentityVO[]>([]);
const copyNames = ref<FlowIdentityVO[]>([]);
const previewRows = ref<FlowIdentityVO[]>([]);
const previewLoading = ref(false);
const pickerVisible = ref(false);
const pickerTarget = ref<'copy' | 'user'>('user');

const sceneMeta = computed(() =>
  FLOW_GROUP_TYPE.find((item) => item.value === props.modelValue.groupType),
);
const sceneKind = computed(() => sceneMeta.value?.kind ?? 'user');
const previewLabel = computed(() => `解析出 ${previewRows.value.length} 人：`);

const approvalModes = [
  { label: '单人办理', value: 'SINGLE' },
  { label: '顺序会签', value: 'SEQUENTIAL' },
  { label: '并行会签（全部通过）', value: 'PARALLEL' },
  { label: '任意一人通过', value: 'ANY' },
  { label: '投票', value: 'VOTE' },
  { label: '按比例通过', value: 'RATIO' },
  { label: '全部通过', value: 'ALL' },
  { label: '协办', value: 'ASSIST' },
  { label: '抢单', value: 'GRAB' },
] as const;

function patch(partial: Partial<FlowSceneConfig>) {
  emit('update:modelValue', { ...props.modelValue, ...partial });
  emit('change');
}

function setField<K extends keyof FlowSceneConfig>(
  key: K,
  value: FlowSceneConfig[K],
) {
  patch({ [key]: value } as Partial<FlowSceneConfig>);
}

function onSceneChange(value: string) {
  setField('groupType', value);
  previewRows.value = [];
}

function onRoleIdsChange(value: string[]) {
  setField('roleIds', value);
}
function onDeptIdsChange(value: string[]) {
  setField('deptIds', value);
}
function onPostIdsChange(value: string[]) {
  setField('postIds', value);
}
function onVariableNameChange(value: string) {
  setField('variableName', value ?? '');
}
function onExpressionChange(value: string) {
  setField('expression', value ?? '');
}
function onLevelsChange(value?: number) {
  setField('levels', value ?? 1);
}
function onOtherTaskIdChange(value: string) {
  setField('otherTaskId', value ?? '');
}
function onApiUrlChange(value: string) {
  setField('apiUrl', value ?? '');
}
function onApprovalModeChange(value: string) {
  setField('approvalMode', value ?? 'SINGLE');
}
function onPassRatioChange(value: string) {
  setField('passRatio', value ?? '');
}
function switchValue(value: boolean | number | string): boolean {
  return value === true || value === 1 || value === '1';
}
function onSkipEmptyChange(value: boolean | number | string) {
  setField('skipWhenEmpty', switchValue(value));
}
function onSkipDuplicateChange(value: boolean | number | string) {
  setField('skipDuplicate', switchValue(value));
}

function openPicker(target: 'copy' | 'user') {
  pickerTarget.value = target;
  pickerVisible.value = true;
}

function onPickerConfirm(rows: FlowIdentityVO[]) {
  if (pickerTarget.value === 'user') {
    setField(
      'userIds',
      rows.map((row) => row.id),
    );
    userNames.value = rows;
  } else {
    setField(
      'copyUserIds',
      rows.map((row) => row.id),
    );
    copyNames.value = rows;
  }
  previewRows.value = [];
}

async function resolveNames(ids: string[]): Promise<FlowIdentityVO[]> {
  if (ids.length === 0) return [];
  try {
    return (await getFlowUsersByIds(ids)) ?? [];
  } catch (error) {
    console.error('[flow] resolve user names failed', error);
    return ids.map((id) => ({ code: '', id, name: id, type: 'user' }));
  }
}

watch(
  () => props.modelValue.userIds,
  async (ids) => {
    userNames.value = await resolveNames(ids);
  },
  { deep: true, immediate: true },
);

watch(
  () => props.modelValue.copyUserIds,
  async (ids) => {
    copyNames.value = await resolveNames(ids);
  },
  { deep: true, immediate: true },
);

async function loadOptions() {
  try {
    const [roles, depts, posts] = await Promise.all([
      getFlowRoles(),
      getFlowDepts(),
      getFlowPosts(),
    ]);
    roleOptions.value = roles ?? [];
    deptOptions.value = depts ?? [];
    postOptions.value = posts ?? [];
  } catch (error) {
    console.error('[flow] load scene options failed', error);
  }
}
void loadOptions();

async function onPreview() {
  previewLoading.value = true;
  const deptIds: number[] = [];
  for (const id of props.modelValue.deptIds) {
    const parsed = Number(id);
    if (!Number.isNaN(parsed)) deptIds.push(parsed);
  }
  try {
    previewRows.value =
      (await previewFlowAssignees({
        apiUrl: props.modelValue.apiUrl,
        autoExec: props.modelValue.autoExec,
        deptIds,
        expression: props.modelValue.expression,
        groupType: props.modelValue.groupType,
        levels: props.modelValue.levels,
        otherTaskId: props.modelValue.otherTaskId,
        postIds: props.modelValue.postIds,
        roleIds: props.modelValue.roleIds,
        skipDuplicate: false,
        skipWhenEmpty: true,
        userIds: props.modelValue.userIds,
        variableName: props.modelValue.variableName,
        variables: {},
      })) ?? [];
  } catch (error) {
    console.error('[flow] preview assignees failed', error);
    previewRows.value = [];
  } finally {
    previewLoading.value = false;
  }
}
</script>

<template>
  <ElForm label-width="92px" size="small" label-position="left">
    <ElFormItem label="审批人场景">
      <ElSelect
        :model-value="modelValue.groupType"
        style="width: 100%"
        @change="onSceneChange"
      >
        <ElOption
          v-for="item in FLOW_GROUP_TYPE"
          :key="item.value"
          :label="item.label"
          :value="item.value"
        />
      </ElSelect>
    </ElFormItem>
    <ElAlert
      v-if="sceneMeta"
      :title="sceneMeta.hint"
      :closable="false"
      type="info"
      show-icon
      style="margin-bottom: 12px"
    />

    <!-- 指定用户 -->
    <ElFormItem v-if="sceneKind === 'user'" label="办理人">
      <div class="scene-tags">
        <ElTag v-for="item in userNames" :key="item.id" size="small">
          {{ item.name }}
        </ElTag>
        <ElButton size="small" @click="openPicker('user')">选择用户</ElButton>
      </div>
    </ElFormItem>

    <!-- 角色 / 部门 / 岗位 -->
    <ElFormItem v-if="modelValue.groupType === 'role'" label="角色">
      <ElSelect
        :model-value="modelValue.roleIds"
        multiple
        filterable
        collapse-tags
        style="width: 100%"
        placeholder="选择角色"
        @change="onRoleIdsChange"
      >
        <ElOption
          v-for="item in roleOptions"
          :key="item.id"
          :label="item.name"
          :value="item.id"
        />
      </ElSelect>
    </ElFormItem>
    <ElFormItem v-if="modelValue.groupType === 'dept'" label="部门">
      <ElSelect
        :model-value="modelValue.deptIds"
        multiple
        filterable
        collapse-tags
        style="width: 100%"
        placeholder="选择部门（含子部门用户）"
        @change="onDeptIdsChange"
      >
        <ElOption
          v-for="item in deptOptions"
          :key="item.id"
          :label="item.name"
          :value="item.id"
        />
      </ElSelect>
    </ElFormItem>
    <ElFormItem v-if="modelValue.groupType === 'post'" label="岗位">
      <ElSelect
        :model-value="modelValue.postIds"
        multiple
        filterable
        collapse-tags
        style="width: 100%"
        placeholder="选择岗位"
        @change="onPostIdsChange"
      >
        <ElOption
          v-for="item in postOptions"
          :key="item.id"
          :label="item.name"
          :value="item.id"
        />
      </ElSelect>
    </ElFormItem>

    <!-- 流程变量 -->
    <ElFormItem v-if="sceneKind === 'variable'" label="流程变量">
      <ElSelect
        :model-value="modelValue.variableName"
        clearable
        style="width: 100%"
        placeholder="选择变量名"
        @change="onVariableNameChange"
      >
        <ElOption
          v-for="item in variables"
          :key="item.variableId"
          :label="`${item.showName} (${item.variableName})`"
          :value="item.variableName ?? ''"
        />
      </ElSelect>
    </ElFormItem>

    <!-- 变量表达式 -->
    <ElFormItem v-if="sceneKind === 'expression'" label="表达式">
      <ElInput
        :model-value="modelValue.expression"
        placeholder="例如 ${deptLeader} 或 var:approver 或 1001,1002"
        @change="onExpressionChange"
      />
    </ElFormItem>

    <!-- 连续多级主管 -->
    <ElFormItem v-if="sceneKind === 'levels'" label="上溯级数">
      <ElInputNumber
        :model-value="modelValue.levels"
        :min="1"
        :max="10"
        @change="onLevelsChange"
      />
    </ElFormItem>

    <!-- 其它节点办理人 -->
    <ElFormItem v-if="sceneKind === 'node'" label="来源节点">
      <ElSelect
        :model-value="modelValue.otherTaskId"
        clearable
        style="width: 100%"
        placeholder="选择 BPMN 用户任务节点"
        @change="onOtherTaskIdChange"
      >
        <ElOption
          v-for="node in nodes"
          :key="node.id"
          :label="`${node.name} (${node.id})`"
          :value="node.id"
        />
      </ElSelect>
    </ElFormItem>

    <!-- 外部 API -->
    <ElFormItem v-if="sceneKind === 'api'" label="接口地址">
      <ElInput
        :model-value="modelValue.apiUrl"
        placeholder="返回用户 Id 列表的内部接口（预留）"
        @change="onApiUrlChange"
      />
    </ElFormItem>

    <ElFormItem label="抄送用户">
      <div class="scene-tags">
        <ElTag
          v-for="item in copyNames"
          :key="item.id"
          size="small"
          type="info"
        >
          {{ item.name }}
        </ElTag>
        <ElButton size="small" @click="openPicker('copy')">选择抄送人</ElButton>
      </div>
    </ElFormItem>

    <ElFormItem label="审批模式">
      <ElSelect
        :model-value="modelValue.approvalMode"
        style="width: 100%"
        @change="onApprovalModeChange"
      >
        <ElOption
          v-for="item in approvalModes"
          :key="item.value"
          :label="item.label"
          :value="item.value"
        />
      </ElSelect>
    </ElFormItem>
    <ElFormItem
      v-if="
        modelValue.approvalMode === 'VOTE' ||
        modelValue.approvalMode === 'RATIO'
      "
      label="通过比例"
    >
      <ElInput
        :model-value="modelValue.passRatio"
        placeholder="0 ~ 1，例如 0.6"
        @change="onPassRatioChange"
      />
    </ElFormItem>

    <ElFormItem label="空值跳过">
      <ElSwitch
        :model-value="modelValue.skipWhenEmpty"
        @change="onSkipEmptyChange"
      />
    </ElFormItem>
    <ElFormItem label="重复人跳过">
      <ElSwitch
        :model-value="modelValue.skipDuplicate"
        @change="onSkipDuplicateChange"
      />
    </ElFormItem>

    <ElFormItem label="场景预览">
      <ElButton size="small" :loading="previewLoading" @click="onPreview">
        预览办理人
      </ElButton>
    </ElFormItem>
    <div v-if="previewRows.length > 0" class="scene-preview">
      <span class="scene-preview__label">{{ previewLabel }}</span>
      <ElTag
        v-for="item in previewRows"
        :key="item.id"
        size="small"
        type="success"
      >
        {{ item.name }}
      </ElTag>
    </div>
    <p v-else-if="!previewLoading" class="scene-preview__hint">
      预览使用与运行时完全相同的解析器，可在发布前确认场景配置是否正确。
    </p>
  </ElForm>

  <FlowIdentityPicker
    v-model="pickerVisible"
    :selected-ids="
      pickerTarget === 'user' ? modelValue.userIds : modelValue.copyUserIds
    "
    :title="pickerTarget === 'user' ? '选择办理人' : '选择抄送人'"
    @confirm="onPickerConfirm"
  />
</template>

<style scoped>
.scene-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.scene-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  padding: 8px 0;
}

.scene-preview__label {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.scene-preview__hint {
  margin: 0;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.6;
}
</style>
