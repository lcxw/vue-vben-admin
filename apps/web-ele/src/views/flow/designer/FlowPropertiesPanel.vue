<script lang="ts" setup>
import type { BpmnElement, BpmnInstance } from './bpmn/modeler';

/**
 * 节点属性面板（阶段 6 场景化改造）。
 *
 * 与阶段 3 的差异：
 * 1. 「任务处理人」改为按 11 种场景动态渲染（FlowSceneForm），选人走通用弹窗，
 *    不再手填用户 Id / 表达式 / 节点 Id；
 * 2. 场景配置统一写进 flowable:Properties/Property，发布期由 FlowBpmnParser
 *    逐键读齐并落进 extraDataJson，运行时再由 toAssigneeConfig() 读回；
 * 3. 按钮值统一改成运行时大写动作码，存量小写草稿在回显时做一次性迁移映射；
 * 4. 新建节点默认勾选完整按钮集（后端对未配置节点也会回退默认集）。
 */
import type { FlowSceneConfig, FlowVariableVO } from '#/api/flow';

import { reactive, ref, watch } from 'vue';

import {
  ElCheckbox,
  ElCheckboxGroup,
  ElEmpty,
  ElForm,
  ElFormItem,
  ElInput,
  ElOption,
  ElSelect,
  ElSwitch,
  ElTabPane,
  ElTabs,
} from 'element-plus';

import { emptySceneConfig } from '#/api/flow';

import {
  FLOW_DEFAULT_OPERATIONS,
  FLOW_TASK_OPERATIONS,
} from '../shared/constants';
import FlowSceneForm from '../shared/FlowSceneForm.vue';

const props = defineProps<{
  element: BpmnElement;
  modeler: BpmnInstance;
  variables: FlowVariableVO[];
}>();

const emit = defineEmits<{ changed: [] }>();

const activeTab = ref('base');
const scene = ref<FlowSceneConfig>(emptySceneConfig());
const nodes = ref<Array<{ id: string; name: string }>>([]);

const form = reactive({
  boundVariableIds: [] as string[],
  documentation: '',
  formKey: '',
  id: '',
  multiInstance: false,
  name: '',
  operations: [] as string[],
});

/** 旧设计器的小写按钮值 → 运行时大写动作码（勿删：存量草稿回显依赖此表）。 */
const LEGACY_OPERATION: Record<string, string> = {
  addSign: 'ADD_SIGN_AFTER',
  agree: 'APPROVE',
  approve: 'APPROVE',
  back: 'RETURN_PREVIOUS',
  cc: 'CC',
  revoke: 'WITHDRAW',
  sign: 'ADD_SIGN_COUNTERSIGN',
  stop: 'TERMINATE',
  transfer: 'TRANSFER',
  reject: 'REJECT',
  refuse: 'REFUSE',
  return: 'RETURN_PREVIOUS',
};

function normalizeOperation(value: string): string {
  return LEGACY_OPERATION[value.toLowerCase()] ?? value.toUpperCase();
}

let syncing = false;

function businessObject(): BpmnElement {
  return props.element?.businessObject ?? {};
}

function extensionValues(): BpmnElement[] {
  return businessObject().get?.('extensionElements')?.get?.('values') ?? [];
}

function childIds(
  parentName: string,
  childName: string,
  attribute = 'id',
): string[] {
  const parent = extensionValues().find(
    (item: BpmnElement) => item.$type === `flowable:${parentName}`,
  );
  if (!parent) return [];
  const list =
    parent.get?.('variableList') ??
    parent.get?.('operationList') ??
    parent.get?.('copyItemList') ??
    [];
  const nested = (list ?? []).map(
    (item: BpmnElement) => item.get?.(attribute) ?? item.get?.('id'),
  );
  if (nested.length > 0) return nested.filter(Boolean);
  const children = parent.getChildElements?.()?.[childName] ?? [];
  return children
    .map(
      (item: BpmnElement) =>
        item.get?.(attribute) ?? item.get?.('id') ?? item.getElementText?.(),
    )
    .filter(Boolean);
}

/** 读取 flowable:Properties 下全部 name → value。 */
function propertiesMap(): Record<string, string> {
  const parent = extensionValues().find(
    (item: BpmnElement) => item.$type === 'flowable:Properties',
  );
  const children = parent?.get?.('values') ?? [];
  const map: Record<string, string> = {};
  for (const child of children) {
    const name = child.get?.('name');
    if (name) map[String(name)] = String(child.get?.('value') ?? '');
  }
  return map;
}

function parseIds(value?: string): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
}

function boolValue(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  return value !== 'false' && value !== '0';
}

function loadNodes() {
  const registry = props.modeler?.get?.('elementRegistry');
  const all: BpmnElement[] = registry?.getAll?.() ?? [];
  nodes.value = all
    .filter((item) => item?.type === 'bpmn:UserTask')
    .map((item) => ({
      id: String(item.id ?? ''),
      name: String(item.businessObject?.get?.('name') ?? item.id ?? ''),
    }));
}

function syncForm() {
  if (!props.element) return;
  syncing = true;
  const bo = businessObject();
  form.id = props.element.id ?? '';
  form.name = bo.get?.('name') ?? '';
  form.formKey = bo.get?.('formKey') ?? '';
  const docs = bo.get?.('documentation');
  form.documentation = Array.isArray(docs) ? (docs[0]?.text ?? '') : '';
  form.multiInstance = Boolean(bo.get?.('loopCharacteristics'));

  const map = propertiesMap();
  const candidateGroups: string[] = bo.get?.('candidateGroups') ?? [];
  const candidateUsers: string[] = bo.get?.('candidateUsers') ?? [];
  const assignee: string = bo.get?.('assignee') ?? '';

  // 旧草稿没有 Properties.groupType：按标准 BPMN 前缀反推场景类型
  let groupType = map.groupType ?? '';
  if (!groupType) {
    if (
      candidateGroups.some((item) => item.toUpperCase().startsWith('ROLE:'))
    ) {
      groupType = 'role';
    } else if (
      candidateGroups.some((item) => item.toUpperCase().startsWith('DEPT:'))
    ) {
      groupType = 'dept';
    } else if (
      candidateGroups.some((item) => item.toUpperCase().startsWith('POST:'))
    ) {
      groupType = 'post';
    } else {
      groupType = 'user';
    }
  }
  if (groupType === 'users') groupType = 'user';

  const fromGroups = (prefix: string): string[] =>
    candidateGroups
      .filter((item) => item.toUpperCase().startsWith(prefix))
      .map((item) => item.slice(prefix.length));

  const next = emptySceneConfig();
  next.groupType = groupType;
  next.userIds = [
    ...new Set([
      ...parseIds(map.userIds),
      ...candidateUsers,
      ...(assignee && !assignee.includes('${') ? [assignee] : []),
    ]),
  ];
  next.roleIds = [
    ...new Set([...parseIds(map.roleIds), ...fromGroups('ROLE:')]),
  ];
  next.deptIds = [
    ...new Set([...parseIds(map.deptIds), ...fromGroups('DEPT:')]),
  ];
  next.postIds = [
    ...new Set([...parseIds(map.postIds), ...fromGroups('POST:')]),
  ];
  next.copyUserIds = [
    ...new Set([
      ...parseIds(map.copyUserIds),
      ...childIds('CopyItemList', 'CopyItem'),
    ]),
  ];
  next.variableName = map.variableName ?? '';
  next.expression = map.expression ?? '';
  next.apiUrl = map.apiUrl ?? '';
  next.otherTaskId = map.otherTaskId ?? '';
  next.levels = Number.parseInt(map.levels ?? '1', 10) || 1;
  next.autoExec = boolValue(map.autoExec, groupType === 'autoExec');
  next.skipWhenEmpty = boolValue(map.skipWhenEmpty, true);
  next.skipDuplicate = boolValue(map.skipDuplicate, true);
  next.approvalMode = map.approvalMode ?? 'SINGLE';
  next.passRatio = map.passRatio ?? '';
  scene.value = next;

  form.boundVariableIds = childIds('VariableList', 'FormVariable');
  const storedOperations = childIds(
    'OperationList',
    'FormOperation',
    'type',
  ).map((item) => normalizeOperation(item));
  form.operations =
    storedOperations.length > 0
      ? storedOperations
      : [...FLOW_DEFAULT_OPERATIONS];
  loadNodes();
  syncing = false;
}

watch(() => props.element, syncForm, { immediate: true });

function modeling(): BpmnInstance {
  return props.modeler?.get('modeling');
}

function updateProperties(properties: Record<string, unknown>) {
  if (!props.element || !props.modeler) return;
  modeling()?.updateProperties(props.element, properties);
  emit('changed');
}

/** 写入/替换一个 flowable:* 扩展元素（保持其它扩展不被覆盖）。 */
function setExtension(
  parentName: string,
  childName: string,
  collectionName: string,
  ids: string[],
  decorate?: (child: BpmnElement, id: string, index: number) => void,
) {
  if (!props.modeler || !props.element) return;
  const moddle = props.modeler.get('moddle');
  const bo = businessObject();
  let ext = bo.get('extensionElements');
  if (!ext) {
    ext = moddle.create('bpmn:ExtensionElements', { values: [] });
  }
  const values = (ext.get('values') ?? []).filter(
    (item: BpmnElement) => item.$type !== `flowable:${parentName}`,
  );
  if (ids.length > 0) {
    const parent = moddle.create(`flowable:${parentName}`);
    const children = ids.map((id, index) => {
      const child = moddle.create(`flowable:${childName}`, { id });
      decorate?.(child, id, index);
      return child;
    });
    parent.set(collectionName, children);
    values.push(parent);
  }
  ext.set('values', values);
  updateProperties({ extensionElements: ext });
}

function setProperties(map: Record<string, string>) {
  const keys = Object.keys(map);
  setExtension('Properties', 'Property', 'values', keys, (child, key) => {
    child.set('name', key);
    child.set('value', map[key] ?? '');
  });
}

function applyBase() {
  if (syncing) return;
  const bpmnFactory = props.modeler?.get('bpmnFactory');
  const documentation = form.documentation
    ? [bpmnFactory.create('bpmn:Documentation', { text: form.documentation })]
    : [];
  updateProperties({
    documentation,
    formKey: form.formKey,
    name: form.name,
  });
  loadNodes();
}

function groupPrefix(groupType: string): string {
  if (groupType === 'role') return 'ROLE:';
  if (groupType === 'dept') return 'DEPT:';
  if (groupType === 'post') return 'POST:';
  return '';
}

function groupIdsFor(config: FlowSceneConfig): string[] {
  if (config.groupType === 'role') return config.roleIds;
  if (config.groupType === 'dept') return config.deptIds;
  if (config.groupType === 'post') return config.postIds;
  return [];
}

function applyScene() {
  if (syncing || !props.element) return;
  const current = scene.value;
  // 1) 完整场景配置写进 Properties（后端发布期逐键读取）
  setProperties({
    apiUrl: current.apiUrl,
    approvalMode: current.approvalMode,
    autoExec: String(current.autoExec),
    copyUserIds: JSON.stringify(current.copyUserIds),
    deptIds: JSON.stringify(current.deptIds),
    expression: current.expression,
    groupType: current.groupType,
    levels: String(current.levels),
    otherTaskId: current.otherTaskId,
    passRatio: current.passRatio,
    postIds: JSON.stringify(current.postIds),
    roleIds: JSON.stringify(current.roleIds),
    skipDuplicate: String(current.skipDuplicate),
    skipWhenEmpty: String(current.skipWhenEmpty),
    userIds: JSON.stringify(current.userIds),
    variableName: current.variableName,
  });

  // 2) 标准 BPMN 属性继续写，保证 Flowable 原生视图与橙单导入兼容
  const prefix = groupPrefix(current.groupType);
  const groupIds = groupIdsFor(current);
  const isUser = current.groupType === 'user';
  updateProperties({
    assignee: isUser && current.userIds.length === 1 ? current.userIds[0] : '',
    candidateGroups: prefix ? groupIds.map((id) => `${prefix}${id}`) : [],
    candidateUsers:
      isUser && current.userIds.length > 1 ? [...current.userIds] : [],
  });

  // 3) 抄送人仍然写 CopyItemList（橙单兼容），同时已在 Properties 里留完整配置
  applyCopy();
}

function applyCopy() {
  if (syncing) return;
  const ids = [...scene.value.copyUserIds];
  setExtension('CopyItemList', 'CopyItem', 'copyItemList', ids);
}

function applyVariables() {
  if (syncing) return;
  setExtension(
    'VariableList',
    'FormVariable',
    'variableList',
    form.boundVariableIds,
  );
}

function applyOperations() {
  if (syncing) return;
  setExtension(
    'OperationList',
    'FormOperation',
    'operationList',
    form.operations,
    (child, id, index) => {
      const meta = FLOW_TASK_OPERATIONS.find((item) => item.value === id);
      child.set('type', id);
      child.set('label', meta?.label ?? id);
      child.set('showOrder', String(index + 1));
      child.set('buttonStyle', meta?.style ?? 'default');
    },
  );
}

function applyMultiInstance() {
  if (syncing || !props.modeler || !props.element) return;
  const moddle = props.modeler.get('moddle');
  const loop = form.multiInstance
    ? moddle.create('bpmn:MultiInstanceLoopCharacteristics', {
        isSequential: false,
      })
    : undefined;
  modeling()?.updateProperties(props.element, { loopCharacteristics: loop });
  emit('changed');
}

const isUserTask = () => props.element?.type === 'bpmn:UserTask';
</script>

<template>
  <div class="flow-properties">
    <ElEmpty
      v-if="!element"
      description="请选择画布上的节点"
      :image-size="70"
    />
    <ElTabs v-else v-model="activeTab">
      <ElTabPane label="基础设置" name="base">
        <ElForm label-width="90px" size="small" label-position="left">
          <ElFormItem label="节点 Id">
            <ElInput :model-value="form.id" disabled />
          </ElFormItem>
          <ElFormItem label="节点名称">
            <ElInput v-model="form.name" @change="applyBase" />
          </ElFormItem>
          <ElFormItem label="说明">
            <ElInput
              v-model="form.documentation"
              type="textarea"
              :rows="2"
              @change="applyBase"
            />
          </ElFormItem>
          <ElFormItem label="表单 Key">
            <ElInput
              v-model="form.formKey"
              placeholder="在线表单/路由标识"
              @change="applyBase"
            />
          </ElFormItem>
          <ElFormItem v-if="isUserTask()" label="会签">
            <ElSwitch
              v-model="form.multiInstance"
              @change="applyMultiInstance"
            />
          </ElFormItem>
        </ElForm>
      </ElTabPane>

      <ElTabPane label="按钮设置" name="button">
        <ElForm label-width="90px" size="small" label-position="left">
          <ElFormItem label="审批按钮">
            <ElCheckboxGroup
              v-model="form.operations"
              @change="applyOperations"
            >
              <ElCheckbox
                v-for="item in FLOW_TASK_OPERATIONS"
                :key="item.value"
                :value="item.value"
              >
                {{ item.label }}
              </ElCheckbox>
            </ElCheckboxGroup>
          </ElFormItem>
          <p class="flow-properties__hint">
            新建节点默认勾选全部常用按钮；取消勾选后该按钮不会出现在办理页。
            按钮配置随流程发布生效，未配置的存量节点由后端回退默认按钮集。
          </p>
        </ElForm>
      </ElTabPane>

      <ElTabPane label="任务处理人" name="assignee">
        <FlowSceneForm
          v-if="isUserTask()"
          v-model="scene"
          :nodes="nodes"
          :variables="variables"
          @change="applyScene"
        />
        <p v-else class="flow-properties__hint">
          只有用户任务节点需要配置审批人。
        </p>
      </ElTabPane>

      <ElTabPane label="其他设置" name="other">
        <ElForm label-width="90px" size="small" label-position="left">
          <ElFormItem label="表单变量">
            <ElSelect
              v-model="form.boundVariableIds"
              multiple
              collapse-tags
              style="width: 100%"
              placeholder="绑定流程变量到该节点"
              @change="applyVariables"
            >
              <ElOption
                v-for="item in variables"
                :key="item.variableId"
                :label="`${item.showName} (${item.variableName})`"
                :value="item.variableName ?? ''"
              />
            </ElSelect>
          </ElFormItem>
          <p class="flow-properties__hint">
            审批人场景、按钮与变量绑定会写入 BPMN 的 flowable 扩展属性，
            发布时由后端解析为节点配置快照；发布新版本后配置才会对运行实例生效。
          </p>
        </ElForm>
      </ElTabPane>
    </ElTabs>
  </div>
</template>

<style scoped>
.flow-properties {
  height: 100%;
  padding: 8px 12px;
  overflow: auto;
  background: var(--el-bg-color);
}

.flow-properties__hint {
  margin: 0;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.6;
}

/*
 * 面板固定 380px 宽，Element Plus 默认 tab 间距会把第 4 个「其他设置」挤到视野外
 * （表现为只看到「其」）。这里压缩内边距与字号，保证 4 个 tab 完整可见。
 */
.flow-properties :deep(.el-tabs__item) {
  padding: 0 10px;
  font-size: 13px;
}
</style>
