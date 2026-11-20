<script lang="ts" setup>
/** 页面编排（多 Tab）：页面 CRUD + Tab 列表（绑定表单模板 + 视图类型）。 */
import { onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  ElButton,
  ElDrawer,
  ElForm,
  ElFormItem,
  ElInput,
  ElMessage,
  ElOption,
  ElSelect,
} from 'element-plus';

import {
  deletePage,
  getOnlineFormList,
  getPageList,
  savePage,
  savePageTabs,
} from '#/api/online';
import type { OnlineFormVO, OnlinePageTabVO, OnlinePageVO } from '#/api/online';
import { confirmAction, withFeedback } from '../../system/shared/helpers';

const pages = ref<OnlinePageVO[]>([]);
const forms = ref<OnlineFormVO[]>([]);
const loading = ref(false);
const drawerVisible = ref(false);
const tabsVisible = ref(false);
const saving = ref(false);
const editing = ref(false);
const currentPage = ref<null | OnlinePageVO>(null);
const form = reactive({ pageId: '', pageCode: '', pageName: '', categoryId: '', remark: '' });
const tabs = ref<Array<Partial<OnlinePageTabVO>>>([]);

async function load() {
  loading.value = true;
  try {
    [pages.value, forms.value] = await Promise.all([getPageList(), getOnlineFormList()]);
  } catch {
    pages.value = [];
    forms.value = [];
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editing.value = false;
  Object.assign(form, { pageId: '', pageCode: '', pageName: '', categoryId: '', remark: '' });
  drawerVisible.value = true;
}

function openEdit(row: OnlinePageVO) {
  editing.value = true;
  Object.assign(form, {
    pageId: row.pageId,
    pageCode: row.pageCode,
    pageName: row.pageName,
    categoryId: row.categoryId ?? '',
    remark: row.remark ?? '',
  });
  drawerVisible.value = true;
}

async function onSubmit() {
  if (!form.pageName?.trim()) {
    ElMessage.warning('请输入页面名称');
    return;
  }
  saving.value = true;
  try {
    const ok = await withFeedback(() => savePage({ ...form }), '保存成功');
    if (ok) {
      drawerVisible.value = false;
      await load();
    }
  } finally {
    saving.value = false;
  }
}

function openTabs(row: OnlinePageVO) {
  currentPage.value = row;
  tabs.value = (row.tabs ?? []).map((t) => ({ ...t }));
  tabsVisible.value = true;
}

function addTab() {
  tabs.value.push({ tabName: '', formId: '', viewType: 1, sortNo: tabs.value.length + 1, enabled: 1 });
}

async function saveTabs() {
  if (!currentPage.value) return;
  if (tabs.value.some((t) => !t.formId)) {
    ElMessage.warning('每个 Tab 都要绑定表单模板');
    return;
  }
  saving.value = true;
  try {
    const ok = await withFeedback(() => savePageTabs(currentPage.value!.pageId, tabs.value), 'Tab 保存成功');
    if (ok) {
      tabsVisible.value = false;
      await load();
    }
  } finally {
    saving.value = false;
  }
}

async function onDelete(row: OnlinePageVO) {
  if (!(await confirmAction(`确定删除页面「${row.pageName}」？`))) return;
  const ok = await withFeedback(() => deletePage(row.pageId), '已删除');
  if (ok) await load();
}

function formName(formId: string): string {
  return forms.value.find((f) => f.formId === formId)?.formName ?? formId;
}

onMounted(load);
</script>

<template>
  <Page>
    <div class="page-mgr">
      <div class="pm-bar">
        <span class="pm-title">页面编排（多 Tab）</span>
        <ElButton type="primary" size="small" @click="openCreate">新增页面</ElButton>
      </div>
      <div class="pm-grid">
        <div v-for="p in pages" :key="p.pageId" class="pm-card">
          <div class="pm-card-head">
            <span class="pm-card-name">{{ p.pageName }}</span>
            <span class="pm-card-code">{{ p.pageCode }}</span>
          </div>
          <div class="pm-card-tabs">
            <span v-for="t in p.tabs" :key="t.tabId" class="pm-tab-chip">
              {{ t.tabName }} · {{ formName(t.formId) }}
            </span>
            <span v-if="!p.tabs?.length" class="pm-no-tab">暂无 Tab</span>
          </div>
          <div class="pm-card-actions">
            <ElButton link type="primary" size="small" @click="openTabs(p)">编排 Tab</ElButton>
            <ElButton link type="primary" size="small" @click="openEdit(p)">编辑</ElButton>
            <ElButton link type="danger" size="small" @click="onDelete(p)">删除</ElButton>
          </div>
        </div>
        <div v-if="!pages.length && !loading" class="pm-empty">暂无页面，点击「新增页面」开始</div>
      </div>
    </div>

    <ElDrawer v-model="drawerVisible" :title="editing ? '编辑页面' : '新增页面'" size="440px">
      <ElForm :model="form" label-position="top">
        <ElFormItem label="页面名称" required>
          <ElInput v-model="form.pageName" placeholder="如：客户工作台" />
        </ElFormItem>
        <ElFormItem label="页面编码">
          <ElInput v-model="form.pageCode" placeholder="留空自动生成" :disabled="editing" />
        </ElFormItem>
        <ElFormItem label="备注">
          <ElInput v-model="form.remark" type="textarea" :rows="2" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="drawerVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="saving" @click="onSubmit">保存</ElButton>
      </template>
    </ElDrawer>

    <ElDrawer v-model="tabsVisible" :title="`编排 Tab · ${currentPage?.pageName ?? ''}`" size="720px">
      <div class="tabs-editor">
        <div v-for="(tab, idx) in tabs" :key="idx" class="tab-editor-row">
          <ElInput v-model="tab.tabName" placeholder="Tab 标题" style="width: 130px" />
          <ElSelect v-model="tab.formId" placeholder="选择表单模板" filterable style="width: 240px">
            <ElOption
              v-for="f in forms"
              :key="f.formId"
              :label="`${f.formName} (${f.formCode})`"
              :value="f.formId"
            />
          </ElSelect>
          <ElSelect v-model="tab.viewType" style="width: 120px">
            <ElOption :value="1" label="查询列表" />
            <ElOption :value="2" label="编辑" />
            <ElOption :value="3" label="详情" />
          </ElSelect>
          <ElButton link type="danger" size="small" @click="tabs.splice(idx, 1)">删除</ElButton>
        </div>
        <ElButton size="small" @click="addTab">添加 Tab</ElButton>
      </div>
      <template #footer>
        <ElButton @click="tabsVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="saving" @click="saveTabs">保存 Tab 配置</ElButton>
      </template>
    </ElDrawer>
  </Page>
</template>

<style scoped>
.page-mgr { padding: 4px 0; }
.pm-bar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.pm-title { font-size: 18px; font-weight: 600; }
.pm-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 14px; }
.pm-card { border: 1px solid var(--el-border-color); border-radius: 8px; padding: 16px; }
.pm-card-head { display: flex; align-items: baseline; gap: 10px; margin-bottom: 12px; }
.pm-card-name { font-size: 15px; font-weight: 600; }
.pm-card-code { font-size: 12px; color: var(--el-text-color-secondary); }
.pm-card-tabs { display: flex; flex-wrap: wrap; gap: 6px; min-height: 28px; margin-bottom: 12px; }
.pm-tab-chip { background: var(--el-fill-color-light); border-radius: 4px; padding: 3px 8px; font-size: 12px; }
.pm-no-tab { color: var(--el-text-color-placeholder); font-size: 12px; }
.pm-card-actions { border-top: 1px solid var(--el-border-color-lighter); padding-top: 10px; }
.pm-empty { grid-column: 1 / -1; color: var(--el-text-color-secondary); text-align: center; padding: 40px; border: 1px dashed var(--el-border-color); border-radius: 8px; }
.tabs-editor { display: flex; flex-direction: column; gap: 10px; }
.tab-editor-row { display: flex; gap: 8px; align-items: center; }
</style>
