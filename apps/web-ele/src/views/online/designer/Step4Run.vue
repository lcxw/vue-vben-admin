<script lang="ts" setup>
/** Step4 发布运行：发布页面（校验）→ 用运行时引擎验证查询/编辑/详情。 */
import type { PageVo } from '#/api/online';

import { onMounted, ref } from 'vue';

import {
  ElButton,
  ElMessage,
  ElTag,
} from 'element-plus';

import {
  publishWizardPage,
  runDelete,
  runQuery,
} from '#/api/online';
import { confirmAction } from '../../system/shared/helpers';
import { callWithFeedback } from './helpers';

const props = defineProps<{ page: PageVo }>();
const emit = defineEmits<{ back: [] }>();

const published = ref(props.page?.published === 1);
const publishing = ref(false);
const queryForm = ref<null | import('#/api/online').WizardForm>(null);
const rows = ref<Array<Record<string, unknown>>>([]);
const loading = ref(false);

onMounted(() => {
  queryForm.value = props.page?.forms?.find((f: import('#/api/online').WizardForm) => f.pageRole === 'query')
    ?? props.page?.forms?.[0] ?? null;
  if (published.value) void doQuery();
});

async function onPublish() {
  publishing.value = true;
  try {
    const page = await callWithFeedback(() => publishWizardPage(props.page.pageId), '发布成功');
    if (page) {
      published.value = true;
      queryForm.value = page.forms?.find((f) => f.pageRole === 'query') ?? page.forms?.[0] ?? null;
      await doQuery();
    }
  } finally {
    publishing.value = false;
  }
}

async function doQuery() {
  if (!queryForm.value) return;
  loading.value = true;
  try {
    const res = await runQuery({ formId: queryForm.value.formId, pageNum: 1, pageSize: 20 });
    rows.value = res.rows ?? [];
  } catch (e: any) {
    ElMessage.error(e?.message ?? '运行查询失败');
  } finally {
    loading.value = false;
  }
}

async function onDelete(row: Record<string, unknown>) {
  if (!(await confirmAction('确定删除该记录？'))) return;
  const pk = row.id ?? row._dataId;
  const ok = await callWithFeedback(() => runDelete(queryForm.value!.formId, pk), '已删除');
  if (ok) await doQuery();
}
</script>

<template>
  <div class="step-run">
    <div class="step-intro">
      <h3>第 4 步 · 发布运行</h3>
      <p>发布后即可用物理表运行时引擎验证：查询真实业务数据。发布会校验页面已完成前面所有步骤。</p>
    </div>

    <div class="publish-bar">
      <div>
        <ElTag v-if="published" type="success">已发布</ElTag>
        <ElTag v-else type="warning">未发布</ElTag>
        <span class="pub-hint">{{ published ? '页面已发布，可运行验证' : '发布后才能运行；如提示未到设计表单步骤，请检查第2、3步是否完成' }}</span>
      </div>
      <ElButton v-if="!published" type="primary" :loading="publishing" @click="onPublish">发布页面</ElButton>
      <ElButton v-else @click="doQuery" :loading="loading">刷新数据</ElButton>
    </div>

    <div v-if="published" class="run-result">
      <div class="run-head">
        <span>运行时数据（{{ rows.length }} 条）</span>
        <span class="run-form">{{ queryForm?.formName }}</span>
      </div>
      <table class="run-table">
        <thead>
          <tr>
            <th v-for="(_v, k) in (rows[0] ?? {})" :key="k">{{ k }}</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, idx) in rows" :key="idx">
            <td v-for="(v, k) in row" :key="k">
              <span v-if="k === '_labels'">{{ JSON.stringify(v) }}</span>
              <span v-else>{{ v ?? '-' }}</span>
            </td>
            <td><ElButton link type="danger" size="small" @click="onDelete(row)">删除</ElButton></td>
          </tr>
          <tr v-if="!rows.length"><td colspan="20" class="run-empty">暂无数据（可到数据工作台新增记录）</td></tr>
        </tbody>
      </table>
    </div>
    <div v-else class="run-locked">发布页面后可在此验证真实业务数据</div>

    <div class="step-actions">
      <ElButton @click="emit('back')">上一步</ElButton>
    </div>
  </div>
</template>

<style scoped>
.step-run { max-width: 1000px; }
.step-intro h3 { margin: 0 0 6px; font-size: 17px; }
.step-intro p { margin: 0 0 18px; color: var(--el-text-color-secondary); font-size: 13px; }
.publish-bar { display: flex; align-items: center; justify-content: space-between; border: 1px solid var(--el-border-color); border-radius: 8px; padding: 14px 16px; margin-bottom: 16px; }
.pub-hint { margin-left: 10px; font-size: 12px; color: var(--el-text-color-secondary); }
.run-result { border: 1px solid var(--el-border-color); border-radius: 8px; overflow: hidden; }
.run-head { display: flex; justify-content: space-between; padding: 10px 14px; background: var(--el-fill-color-light); font-size: 13px; font-weight: 600; }
.run-form { color: var(--el-text-color-secondary); font-weight: 400; font-size: 12px; }
.run-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.run-table th, .run-table td { padding: 7px 10px; text-align: left; border-bottom: 1px solid var(--el-border-color-lighter); white-space: nowrap; max-width: 200px; overflow: hidden; text-overflow: ellipsis; }
.run-table th { background: var(--el-fill-color-blank); }
.run-empty { text-align: center; color: var(--el-text-color-secondary); padding: 30px; }
.run-locked { border: 1px dashed var(--el-border-color); border-radius: 8px; padding: 60px 20px; text-align: center; color: var(--el-text-color-secondary); }
.step-actions { display: flex; justify-content: flex-end; margin-top: 20px; }
</style>
