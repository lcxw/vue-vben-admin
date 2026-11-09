<script lang="ts" setup>
import type { FlowIdentityVO, FlowVariableVO } from '#/api/flow';

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

import {
  FLOW_GROUP_TYPE,
  getFlowDepts,
  getFlowPosts,
  getFlowRoles,
  getFlowUsers,
} from '#/api/flow';

import { FLOW_TASK_OPERATIONS } from '../shared/constants';
import type { BpmnElement, BpmnInstance } from './bpmn/modeler';

/**
 * 节点属性面板（对齐橙单 PropertiesPanel 的 4 个 tab）。
 *
 * 与橙单的差异：选人数据源改为 /flow/identity/*（system-server OIDC），
 * 用户标识统一 userId；不再使用 window.bpmnInstances 全局单例，
 * modeler 与当前元素由画布组件通过 props 传入。
 */
const props = defineProps<{
  element: BpmnElement;
  modeler: BpmnInstance;
  variables: FlowVariableVO[];
}>();

const emit = defineEmits<{ changed: [] }>();

const activeTab = ref('base');
const loadingOptions = ref(false);
const options = ref<FlowIdentityVO[]>([]);

const form = reactive({
  assigneeIds: [] as string[],
  boundVariableIds: [] as string[],
  copyUserIds: [] as string[],
  documentation: '',
  formKey: '',
  groupType: 'user',
  id: '',
  multiInstance: false,
  name: '',
  operations: [] as string[],
});

let syncing = false;

function businessObject(): BpmnElement {
  return props.element?.businessObject ?? {};
}

function extensionValues(): BpmnElement[] {
  return businessObject().get?.('extensionElements')?.get?.('values') ?? [];
}

function childIds(parentName: string, childName: string): string[] {
  const parent = extensionValues().find(
    (item: BpmnElement) => item.$type === `flowable:${parentName}`,
  );
  if (!parent) return [];
  const list =
    parent.get?.('variableList') ??
    parent.get?.('operationList') ??
    parent.get?.('copyItemList') ??
    [];
  const nested = (list ?? []).map((item: BpmnElement) => item.get?.('id'));
  if (nested.length > 0) return nested.filter(Boolean);
  // 兼容 BPMN 解析后子元素挂在 getChildElements 上的情形
  const children = parent.getChildElements?.()?.[childName] ?? [];
  return children
    .map((item: BpmnElement) => item.get?.('id') ?? item.getElementText?.())
    .filter(Boolean);
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

  const candidateGroups: string[] = bo.get?.('candidateGroups') ?? [];
  const candidateUsers: string[] = bo.get?.('candidateUsers') ?? [];
  const assignee: string = bo.get?.('assignee') ?? '';
  const roleGroup = candidateGroups.find((item: string) =>
    item.toUpperCase().startsWith('ROLE:'),
  );
  const deptGroup = candidateGroups.find((item: string) =>
    item.toUpperCase().startsWith('DEPT:'),
  );
  const postGroup = candidateGroups.find((item: string) =>
    item.toUpperCase().startsWith('POST:'),
  );
  if (roleGroup) {
    form.groupType = 'role';
    form.assigneeIds = candidateGroups
      .filter((item: string) => item.toUpperCase().startsWith('ROLE:'))
      .map((item: string) => item.slice(5));
  } else if (deptGroup) {
    form.groupType = 'dept';
    form.assigneeIds = candidateGroups
      .filter((item: string) => item.toUpperCase().startsWith('DEPT:'))
      .map((item: string) => item.slice(5));
  } else if (postGroup) {
    form.groupType = 'post';
    form.assigneeIds = candidateGroups
      .filter((item: string) => item.toUpperCase().startsWith('POST:'))
      .map((item: string) => item.slice(5));
  } else {
    form.groupType = 'user';
    form.assigneeIds = [...new Set([...candidateUsers, ...(assignee ? [assignee] : [])])];
  }

  form.boundVariableIds = childIds('VariableList', 'FormVariable');
  form.operations = childIds('OperationList', 'FormOperation');
  form.copyUserIds = childIds('CopyItemList', 'CopyItem');
  syncing = false;
}

watch(() => props.element, syncForm, { immediate: true });

async function loadOptions() {
  loadingOptions.value = true;
  try {
    const list = await (form.groupType === 'role'
      ? getFlowRoles()
      : form.groupType === 'dept'
        ? getFlowDepts()
        : form.groupType === 'post'
          ? getFlowPosts()
          : getFlowUsers());
    // 已选但不在结果里的 id 保留占位，避免回显丢值
    const known = new Set(list.map((item) => item.id));
    const missing = form.assigneeIds
      .filter((id) => !known.has(id))
      .map((id) => ({ id, name: id, type: 'user' as const }));
    options.value = [...list, ...missing];
  } catch (error) {
    console.error('[flow] load identity options failed', error);
    options.value = [];
  } finally {
    loadingOptions.value = false;
  }
}

watch(
  () => form.groupType,
  () => {
    if (!syncing) loadOptions();
  },
  { immediate: true },
);

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
  decorate?: (child: BpmnElement, id: string) => void,
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
    const children = ids.map((id) => {
      const child = moddle.create(`flowable:${childName}`, { id });
      decorate?.(child, id);
      return child;
    });
    parent.set(collectionName, children);
    values.push(parent);
  }
  ext.set('values', values);
  updateProperties({ extensionElements: ext });
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
}

function applyAssignee() {
  if (syncing) return;
  const prefix =
    form.groupType === 'role'
      ? 'ROLE:'
      : form.groupType === 'dept'
        ? 'DEPT:'
        : form.groupType === 'post'
          ? 'POST:'
          : '';
  const isUser = form.groupType === 'user';
  updateProperties({
    assignee: isUser && form.assigneeIds.length === 1 ? form.assigneeIds[0] : '',
    candidateGroups: prefix
      ? form.assigneeIds.map((id) => `${prefix}${id}`)
      : [],
    candidateUsers: isUser && form.assigneeIds.length > 1 ? form.assigneeIds : [],
  });
  // 把参与人类型写进扩展属性，供后端 task_ext.groupType 解析
  setExtension('Properties', 'Property', 'values', [form.groupType], (child, id) => {
    child.set('name', 'groupType');
    child.set('value', id);
  });
}

function applyVariables() {
  if (syncing) return;
  setExtension('VariableList', 'FormVariable', 'variableList', form.boundVariableIds);
}

function applyOperations() {
  if (syncing) return;
  setExtension(
    'OperationList',
    'FormOperation',
    'operationList',
    form.operations,
    (child, id) => {
      child.set('type', id);
      child.set(
        'label',
        FLOW_TASK_OPERATIONS.find((item) => item.value === id)?.label ?? id,
      );
    },
  );
}

function applyCopy() {
  if (syncing) return;
  setExtension('CopyItemList', 'CopyItem', 'copyItemList', form.copyUserIds, (child) => {
    child.set('type', 'user');
  });
}

function applyMultiInstance() {
  if (syncing || !props.modeler) return;
  const moddle = props.modeler.get('moddle');
  const bo = businessObject();
  const loop = form.multiInstance
    ? moddle.create('bpmn:MultiInstanceLoopCharacteristics', {
        isSequential: false,
      })
    : undefined;
  bo.set('loopCharacteristics', loop);
  emit('changed');
}

const isUserTask = () => props.element?.type === 'bpmn:UserTask';
</script>

<template>
  <div class="flow-properties">
    <ElEmpty v-if="!element" description="请选择画布上的节点" :image-size="70" />
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
            <ElInput v-model="form.documentation" type="textarea" :rows="2" @change="applyBase" />
          </ElFormItem>
          <ElFormItem label="表单 Key">
            <ElInput v-model="form.formKey" placeholder="在线表单/路由标识" @change="applyBase" />
          </ElFormItem>
          <ElFormItem v-if="isUserTask()" label="会签">
            <ElSwitch v-model="form.multiInstance" @change="applyMultiInstance" />
          </ElFormItem>
        </ElForm>
      </ElTabPane>

      <ElTabPane label="按钮设置" name="button">
        <ElForm label-width="90px" size="small" label-position="left">
          <ElFormItem label="审批按钮">
            <ElCheckboxGroup v-model="form.operations" @change="applyOperations">
              <ElCheckbox
                v-for="item in FLOW_TASK_OPERATIONS"
                :key="item.value"
                :value="item.value"
              >
                {{ item.label }}
              </ElCheckbox>
            </ElCheckboxGroup>
          </ElFormItem>
        </ElForm>
      </ElTabPane>

      <ElTabPane label="任务处理人" name="assignee">
        <ElForm label-width="90px" size="small" label-position="left">
          <ElFormItem label="参与人类型">
            <ElSelect v-model="form.groupType" style="width: 100%" @change="applyAssignee">
              <ElOption
                v-for="item in FLOW_GROUP_TYPE"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </ElSelect>
          </ElFormItem>
          <ElFormItem label="参与人">
            <ElSelect
              v-model="form.assigneeIds"
              multiple
              filterable
              clearable
              collapse-tags
              :loading="loadingOptions"
              style="width: 100%"
              placeholder="选择用户/角色/部门/岗位"
              @change="applyAssignee"
            >
              <ElOption
                v-for="item in options"
                :key="item.id"
                :label="item.name"
                :value="item.id"
              />
            </ElSelect>
          </ElFormItem>
          <ElFormItem label="抄送用户">
            <ElSelect
              v-model="form.copyUserIds"
              multiple
              filterable
              clearable
              collapse-tags
              style="width: 100%"
              placeholder="按用户 Id 填写/选择"
              allow-create
              @change="applyCopy"
            />
          </ElFormItem>
        </ElForm>
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
            变量、按钮与参与人配置会写入 BPMN 的 flowable 扩展属性，
            发布时由后端解析为节点配置快照。
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
</style>
