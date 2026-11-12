<script lang="ts" setup>
/**
 * 发起流程对话框：选流程定义（已发布且有激活主版本）→ 填标题/表单/变量 → 启动。
 * draft=true 只落暂存待审工单，不启动 Flowable 实例，由「我发起」页再提交。
 */
import type { FlowEntryVO, FlowStartReq } from '#/api/flow';

import { computed, reactive, ref, watch } from 'vue';

import {
  ElButton,
  ElDialog,
  ElForm,
  ElFormItem,
  ElInput,
  ElMessage,
  ElOption,
  ElSelect,
  ElSwitch,
} from 'element-plus';

import { getStartableFlowList, startFlow } from '#/api/flow';

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
const PLACEHOLDER_HINTS = '按 BPMN 节点 Id 指定办理人，例如 {"task1": "1001"}';

const entries = ref<FlowEntryVO[]>([]);
const saving = ref(false);
const form = reactive({
  assigneeHintsJson: '',
  businessKey: '',
  draft: false,
  entryId: '',
  formDataJson: '',
  title: '',
  variablesJson: '',
});

watch(
  () => props.modelValue,
  async (open) => {
    if (!open) return;
    form.assigneeHintsJson = '';
    form.businessKey = '';
    form.draft = false;
    form.entryId = '';
    form.formDataJson = '';
    form.title = '';
    form.variablesJson = '';
    try {
      entries.value = await getStartableFlowList();
    } catch (error) {
      console.error('[flow] load startable entries failed', error);
      entries.value = [];
    }
  },
);

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
  const assigneeHints = parseObject(form.assigneeHintsJson, '办理人提示');
  if (!formData || !variables || !assigneeHints) return;

  const req: FlowStartReq = {
    businessKey: form.businessKey || undefined,
    draft: form.draft,
    entryId: form.entryId,
    formData,
    title: form.title || undefined,
    variables,
  };
  if (Object.keys(assigneeHints).length > 0) {
    req.assigneeHints = assigneeHints;
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
  <ElDialog v-model="visible" title="发起流程" width="640px" destroy-on-close>
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
      <ElFormItem label="办理人提示">
        <ElInput
          v-model="form.assigneeHintsJson"
          type="textarea"
          :rows="2"
          :placeholder="PLACEHOLDER_HINTS"
        />
      </ElFormItem>
    </ElForm>

    <template #footer>
      <ElButton @click="visible = false">取消</ElButton>
      <ElButton type="primary" :loading="saving" @click="onSubmit">
        确定
      </ElButton>
    </template>
  </ElDialog>
</template>

<style scoped>
.hint {
  margin-left: 10px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
</style>
