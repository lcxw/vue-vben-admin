<script lang="ts" setup>
/** 在线脚本管理：列表 / 编辑器 / 执行 / 执行日志。 */
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { OnlineScriptLogVO, OnlineScriptVO, OnlineSqlResult } from '#/api/online';

import { onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  ElButton,
  ElDrawer,
  ElForm,
  ElFormItem,
  ElInput,
  ElSwitch,
  ElTable,
  ElTableColumn,
  ElTabPane,
  ElTabs,
  ElTag,
  ElMessage,
} from 'element-plus';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteOnlineScript,
  getOnlineScriptList,
  getOnlineScriptLogs,
  runOnlineScript,
  saveOnlineScript,
} from '#/api/online';

import {
  confirmAction,
  usePermission,
  withFeedback,
} from '../../system/shared/helpers';

const { has } = usePermission();
const rows = ref<OnlineScriptVO[]>([]);
const editorVisible = ref(false);
const saving = ref(false);
const editing = ref<null | OnlineScriptVO>(null);
const form = reactive<OnlineScriptVO>({
  code: '',
  name: '',
  groupCode: '',
  content: 'var sum = 0;\nfor (var i = 0; i < ctx.count; i++) { sum += i; }\nsum;',
  paramsJson: '{"count":5}',
  enabled: 1,
});

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: [
      { field: 'code', title: '编码', minWidth: 140 },
      { field: 'name', title: '名称', minWidth: 180 },
      { field: 'groupCode', title: '分组', width: 140 },
      { field: 'enabled', title: '状态', width: 100, slots: { default: 'enabled' } },
      { field: 'updateTime', title: '更新时间', width: 170 },
      {
        align: 'center',
        field: 'operation',
        fixed: 'right',
        slots: { default: 'action' },
        title: '操作',
        width: 220,
      },
    ],
    data: [],
    height: 'auto',
    rowConfig: { keyField: 'scriptId' },
    toolbarConfig: { custom: true, refresh: true, zoom: true },
  } as VxeTableGridOptions<OnlineScriptVO>,
});

// 执行区
const runVisible = ref(false);
const runScript = ref<null | OnlineScriptVO>(null);
const runParams = ref('{"count":5}');
const running = ref(false);
const runResult = ref<null | OnlineSqlResult>(null);
const activeTab = ref('result');
const logs = ref<OnlineScriptLogVO[]>([]);

onMounted(async () => {
  await load();
});

async function load() {
  rows.value = await getOnlineScriptList();
  gridApi.grid?.loadData(rows.value);
}

function openCreate() {
  editing.value = null;
  Object.assign(form, {
    code: '', name: '', groupCode: '',
    content: 'var sum = 0;\nfor (var i = 0; i < ctx.count; i++) { sum += i; }\nsum;',
    paramsJson: '{"count":5}', enabled: 1,
  });
  editorVisible.value = true;
}

function openEdit(row: OnlineScriptVO) {
  editing.value = row;
  Object.assign(form, { ...row });
  editorVisible.value = true;
}

async function onSubmit() {
  saving.value = true;
  try {
    const ok = await withFeedback(() => saveOnlineScript({ ...form }));
    if (ok) {
      editorVisible.value = false;
      await load();
    }
  } finally {
    saving.value = false;
  }
}

async function onDelete(row: OnlineScriptVO) {
  if (!(await confirmAction(`确定删除脚本「${row.name}」？`))) return;
  const id = row.scriptId;
  if (!id) return;
  const ok = await withFeedback(() => deleteOnlineScript(id), '已删除');
  if (ok) await load();
}

async function openRun(row: OnlineScriptVO) {
  runScript.value = row;
  runParams.value = row.paramsJson ?? '{}';
  runResult.value = null;
  runVisible.value = true;
  await loadLogs();
}

async function loadLogs() {
  if (!runScript.value?.code) return;
  logs.value = await getOnlineScriptLogs(runScript.value.code);
}

async function execute() {
  if (!runScript.value) return;
  let params: Record<string, unknown> = {};
  try {
    params = JSON.parse(runParams.value || '{}') as Record<string, unknown>;
  } catch {
    ElMessage.warning('参数不是合法 JSON 对象');
    return;
  }
  running.value = true;
  try {
    runResult.value = await runOnlineScript({
      params,
      scriptCode: runScript.value.code,
    });
    await loadLogs();
  } catch (error) {
    console.error('[online] script run failed', error);
  } finally {
    running.value = false;
  }
}
</script>

<template>
  <Page>
    <Grid>
      <template #enabled="{ row }">
        <ElTag :type="row.enabled === 1 ? 'success' : 'info'">
          {{ row.enabled === 1 ? '启用' : '禁用' }}
        </ElTag>
      </template>
      <template #action="{ row }">
        <ElButton v-if="has('online:script:save')" link type="primary" size="small" @click="openEdit(row)">编辑</ElButton>
        <ElButton v-if="has('online:script:run')" link type="success" size="small" @click="openRun(row)">运行</ElButton>
        <ElButton v-if="has('online:script:save')" link type="danger" size="small" @click="onDelete(row)">删除</ElButton>
      </template>
      <template #toolbar-tools>
        <ElButton v-if="has('online:script:save')" type="primary" @click="openCreate">新增脚本</ElButton>
      </template>
    </Grid>

    <ElDrawer v-model="editorVisible" :title="editing ? '编辑脚本' : '新增脚本'" size="60%">
      <ElForm label-position="top">
        <ElFormItem label="脚本编码">
          <ElInput v-model="form.code" placeholder="如：calcBonus" />
        </ElFormItem>
        <ElFormItem label="脚本名称">
          <ElInput v-model="form.name" />
        </ElFormItem>
        <ElFormItem label="分组">
          <ElInput v-model="form.groupCode" placeholder="可选" />
        </ElFormItem>
        <ElFormItem label="默认参数 JSON">
          <ElInput v-model="form.paramsJson" placeholder='如：{"count":5}' />
        </ElFormItem>
        <ElFormItem label="JS 脚本内容">
          <ElInput v-model="form.content" type="textarea" :rows="16" class="script-editor" />
          <div class="hint">
            可用对象：ctx（参数）、log、json、db.query/update、form.get/save、order.get/status。
            禁止访问 Packages / Java 类 / 文件 / 网络；指令数与执行时长双限制。
          </div>
        </ElFormItem>
        <ElFormItem label="启用">
          <ElSwitch v-model="form.enabled" :active-value="1" :inactive-value="0" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="editorVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="saving" @click="onSubmit">保存</ElButton>
      </template>
    </ElDrawer>

    <ElDrawer v-model="runVisible" :title="`运行脚本 · ${runScript?.name ?? ''}`" size="60%">
      <ElForm label-position="top">
        <ElFormItem label="执行参数 JSON">
          <ElInput v-model="runParams" type="textarea" :rows="3" />
        </ElFormItem>
      </ElForm>
      <ElButton type="primary" :loading="running" @click="execute">执行</ElButton>
      <ElTabs v-model="activeTab" class="mt-3">
        <ElTabPane label="执行结果" name="result">
          <pre v-if="runResult" class="result-pre">{{ JSON.stringify(runResult, null, 2) }}</pre>
        </ElTabPane>
        <ElTabPane label="执行日志" name="logs">
          <ElTable :data="logs" border size="small" max-height="420">
            <ElTableColumn prop="createTime" label="时间" width="170" />
            <ElTableColumn prop="success" label="成功" width="80" />
            <ElTableColumn prop="durationMs" label="耗时(ms)" width="100" />
            <ElTableColumn prop="resultJson" label="结果" min-width="240" />
            <ElTableColumn prop="errorMsg" label="错误" min-width="180" />
          </ElTable>
        </ElTabPane>
      </ElTabs>
    </ElDrawer>
  </Page>
</template>

<style scoped>
.script-editor :deep(textarea) {
  font-family: var(--font-mono);
  font-size: 13px;
}
.hint {
  margin-top: 6px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.result-pre {
  max-height: 400px;
  overflow: auto;
  padding: 12px;
  background: var(--el-fill-color-light);
  border-radius: 4px;
  font-size: 12px;
  white-space: pre-wrap;
}
</style>
