<script lang="ts" setup>
/** 在线数据库连接管理 + SQL 控制台（白名单由后端保证）。 */
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type {
  OnlineDblinkVO,
  OnlineSqlAuditVO,
  OnlineSqlExecReq,
  OnlineSqlResult,
} from '#/api/online';

import { onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  ElButton,
  ElDrawer,
  ElForm,
  ElFormItem,
  ElInput,
  ElInputNumber,
  ElOption,
  ElSelect,
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
  deleteOnlineDblink,
  executeDblinkQuery as execQuery,
  executeDblinkUpdate as execUpdate,
  getOnlineDblinkList,
  getOnlineSqlAudits,
  saveOnlineDblink,
  testOnlineDblink,
} from '#/api/online';

import {
  confirmAction,
  usePermission,
  withFeedback,
} from '../../system/shared/helpers';

const { has } = usePermission();
const rows = ref<OnlineDblinkVO[]>([]);
const drawerVisible = ref(false);
const saving = ref(false);
const editing = ref<null | OnlineDblinkVO>(null);
const form = reactive<OnlineDblinkVO>({
  code: '',
  name: '',
  dbType: 'mysql',
  jdbcUrl: '',
  username: '',
  password: '',
  driverClass: 'com.mysql.cj.jdbc.Driver',
  maxRows: 200,
  queryTimeout: 10,
  enabled: 1,
});

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: [
      { field: 'code', title: '编码', minWidth: 140 },
      { field: 'name', title: '名称', minWidth: 180 },
      { field: 'dbType', title: '类型', width: 100 },
      { field: 'jdbcUrl', title: 'JDBC URL', minWidth: 300 },
      { field: 'enabled', title: '状态', width: 100, slots: { default: 'enabled' } },
      {
        align: 'center',
        field: 'operation',
        fixed: 'right',
        slots: { default: 'action' },
        title: '操作',
        width: 260,
      },
    ],
    data: [],
    height: 'auto',
    rowConfig: { keyField: 'dblinkId' },
    toolbarConfig: { custom: true, refresh: true, zoom: true },
  } as VxeTableGridOptions<OnlineDblinkVO>,
});

// SQL 控制台
const sqlConsoleVisible = ref(false);
const consoleDblink = ref('');
const sqlText = ref('SELECT 1');
const sqlParams = ref('[]');
const sqlRunning = ref(false);
const sqlResult = ref<null | OnlineSqlResult>(null);
const activeTab = ref('result');
const audits = ref<OnlineSqlAuditVO[]>([]);

onMounted(async () => {
  await load();
});

async function load() {
  rows.value = await getOnlineDblinkList();
  gridApi.grid?.loadData(rows.value);
}

function openCreate() {
  editing.value = null;
  Object.assign(form, {
    code: '', name: '', dbType: 'mysql', jdbcUrl: '', username: '', password: '',
    driverClass: 'com.mysql.cj.jdbc.Driver', maxRows: 200, queryTimeout: 10, enabled: 1,
  });
  drawerVisible.value = true;
}

function openEdit(row: OnlineDblinkVO) {
  editing.value = row;
  Object.assign(form, { ...row, password: '' });
  drawerVisible.value = true;
}

async function onSubmit() {
  saving.value = true;
  try {
    const ok = await withFeedback(() => saveOnlineDblink({ ...form }));
    if (ok) {
      drawerVisible.value = false;
      await load();
    }
  } finally {
    saving.value = false;
  }
}

async function onDelete(row: OnlineDblinkVO) {
  if (!(await confirmAction(`确定删除数据源「${row.name}」？`))) return;
  const id = row.dblinkId;
  if (!id) return;
  const ok = await withFeedback(() => deleteOnlineDblink(id), '已删除');
  if (ok) await load();
}

async function onTest(row: OnlineDblinkVO) {
  const id = row.dblinkId;
  if (!id) return;
  const result = await testOnlineDblink(id);
  if (result.success) {
    ElMessage.success('连接成功');
  } else {
    ElMessage.error(`连接失败：${result.errorMsg ?? ''}`);
  }
}

function openConsole(row: OnlineDblinkVO) {
  consoleDblink.value = row.code;
  sqlText.value = 'SELECT 1';
  sqlResult.value = null;
  sqlConsoleVisible.value = true;
  void loadAudits();
}

async function loadAudits() {
  audits.value = await getOnlineSqlAudits(consoleDblink.value);
}

function parseParams(): unknown[] | null {
  try {
    const parsed: unknown = JSON.parse(sqlParams.value || '[]');
    if (!Array.isArray(parsed)) {
      ElMessage.warning('参数必须是 JSON 数组');
      return null;
    }
    return parsed;
  } catch {
    ElMessage.warning('参数不是合法 JSON 数组');
    return null;
  }
}

async function runSql(write: boolean) {
  const params = parseParams();
  if (!params) return;
  const req: OnlineSqlExecReq = {
    dblinkCode: consoleDblink.value,
    params,
    sql: sqlText.value,
  };
  sqlRunning.value = true;
  try {
    sqlResult.value = write ? await execUpdate(req) : await execQuery(req);
    await loadAudits();
  } finally {
    sqlRunning.value = false;
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
        <ElButton v-if="has('online:dblink:save')" link type="primary" size="small" @click="openEdit(row)">编辑</ElButton>
        <ElButton v-if="has('online:dblink:query')" link size="small" @click="openConsole(row)">SQL 控制台</ElButton>
        <ElButton v-if="has('online:dblink:query')" link size="small" @click="onTest(row)">测试连接</ElButton>
        <ElButton v-if="has('online:dblink:save')" link type="danger" size="small" @click="onDelete(row)">删除</ElButton>
      </template>
      <template #toolbar-tools>
        <ElButton v-if="has('online:dblink:save')" type="primary" @click="openCreate">新增数据源</ElButton>
      </template>
    </Grid>

    <ElDrawer v-model="drawerVisible" :title="editing ? '编辑数据源' : '新增数据源'" size="620px">
      <ElForm label-position="top">
        <ElFormItem label="连接编码">
          <ElInput v-model="form.code" placeholder="如：local_workflow" />
        </ElFormItem>
        <ElFormItem label="连接名称">
          <ElInput v-model="form.name" />
        </ElFormItem>
        <ElFormItem label="数据库类型">
          <ElSelect v-model="form.dbType">
            <ElOption label="mysql" value="mysql" />
            <ElOption label="postgresql" value="postgresql" />
            <ElOption label="dameng" value="dameng" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="JDBC URL">
          <ElInput v-model="form.jdbcUrl" placeholder="jdbc:mysql://host:3306/db" />
        </ElFormItem>
        <ElFormItem label="用户名">
          <ElInput v-model="form.username" />
        </ElFormItem>
        <ElFormItem label="密码">
          <ElInput v-model="form.password" type="password" show-password placeholder="编辑时留空表示不修改" />
        </ElFormItem>
        <ElFormItem label="驱动类">
          <ElInput v-model="form.driverClass" />
        </ElFormItem>
        <ElFormItem label="最大返回行数">
          <ElInputNumber v-model="form.maxRows" :min="1" :max="2000" />
        </ElFormItem>
        <ElFormItem label="查询超时（秒）">
          <ElInputNumber v-model="form.queryTimeout" :min="1" :max="30" />
        </ElFormItem>
        <ElFormItem label="启用">
          <ElSwitch v-model="form.enabled" :active-value="1" :inactive-value="0" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="drawerVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="saving" @click="onSubmit">保存</ElButton>
      </template>
    </ElDrawer>

    <ElDrawer v-model="sqlConsoleVisible" :title="`SQL 控制台 · ${consoleDblink}`" size="72%">
      <ElForm label-position="top">
        <ElFormItem label="SQL">
          <ElInput v-model="sqlText" type="textarea" :rows="5" />
        </ElFormItem>
        <ElFormItem label="参数 JSON 数组">
          <ElInput v-model="sqlParams" placeholder='如：["1001"]' />
        </ElFormItem>
      </ElForm>
      <div class="console-actions">
        <ElButton type="primary" :loading="sqlRunning" @click="runSql(false)">只读查询</ElButton>
        <ElButton type="warning" :loading="sqlRunning" @click="runSql(true)">写入执行</ElButton>
      </div>
      <ElTabs v-model="activeTab">
        <ElTabPane label="执行结果" name="result">
          <div v-if="sqlResult" class="console-result">
            <p>成功：{{ sqlResult.success }}　耗时：{{ sqlResult.durationMs }}ms　行数：{{ sqlResult.rowCount }}</p>
            <p v-if="sqlResult.errorMsg" class="text-red-500">{{ sqlResult.errorMsg }}</p>
            <pre>{{ JSON.stringify(sqlResult.rows, null, 2) }}</pre>
          </div>
        </ElTabPane>
        <ElTabPane label="执行审计" name="audit">
          <ElTable :data="audits" border size="small" max-height="420">
            <ElTableColumn prop="createTime" label="时间" width="170" />
            <ElTableColumn prop="dblinkCode" label="数据源" width="140" />
            <ElTableColumn prop="sql" label="SQL" min-width="260" />
            <ElTableColumn prop="rowCount" label="行数" width="80" />
            <ElTableColumn prop="durationMs" label="耗时(ms)" width="100" />
            <ElTableColumn prop="success" label="成功" width="80" />
          </ElTable>
        </ElTabPane>
      </ElTabs>
    </ElDrawer>
  </Page>
</template>

<style scoped>
.console-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}
.console-result pre {
  max-height: 360px;
  overflow: auto;
  padding: 12px;
  background: var(--el-fill-color-light);
  border-radius: 4px;
  font-size: 12px;
  white-space: pre-wrap;
}
</style>
