<script lang="ts" setup>
/**
 * 页面设计工作台 —— 以 pageId 为主线的一条龙建模流水线。
 *
 * 四步向导（参照橙单 PageStatus）：
 *   Step1 基础信息 → Step2 数据模型(导表+关系) → Step3 设计表单(拖拽+预览) → Step4 发布运行
 *
 * 所有步骤在同一个 pageId 上下文里推进，产物（数据源/表/表单）全部归属该页面。
 */
import type { PageVo } from '#/api/online';

import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';

import {
  ElButton,
  ElMessage,
  ElSteps,
  ElStep,
} from 'element-plus';

import {
  deleteWizardPage,
  getWizardList,
  getWizardPage,
} from '#/api/online';
import { confirmAction, withFeedback } from '../../system/shared/helpers';

import Step1Basic from './Step1Basic.vue';
import Step2Model from './Step2Model.vue';
import Step3Designer from './Step3Designer.vue';
import Step4Run from './Step4Run.vue';

const route = useRoute();
const router = useRouter();

const pages = ref<PageVo[]>([]);
const current = ref<null | PageVo>(null);
/** 当前激活步骤 0..3（第4步=发布运行对应 status 2 的后续，用本地 3 表示）。 */
const activeStep = ref(0);
const loading = ref(false);

/** 是否为列表视图（未选页面）。 */
const listMode = computed(() => !current.value);
/** 向子组件传递的非空页面（向导模式下一定有值；用占位满足 TS）。 */
const currentPage = computed<PageVo>(() => current.value ?? {
  pageId: '', pageCode: '', pageName: '', status: 0, pageType: 1, published: 0,
  tables: [], relations: [], forms: [],
} as PageVo);

async function loadList() {
  loading.value = true;
  try {
    pages.value = await getWizardList();
  } catch {
    pages.value = [];
  } finally {
    loading.value = false;
  }
}

async function openPage(pageId: string) {
  loading.value = true;
  try {
    current.value = await getWizardPage(pageId);
    // status=0/1/2 → 步骤 0/1/2；已发布 → 步骤3
    activeStep.value = current.value.published === 1 ? 3 : (current.value.status ?? 0);
    await router.replace({ query: { ...route.query, pageId } });
  } catch (e: any) {
    ElMessage.error(e?.message ?? '加载页面失败');
  } finally {
    loading.value = false;
  }
}

function newPage() {
  current.value = {
    pageId: '',
    pageCode: '',
    pageName: '',
    status: 0,
    pageType: 1,
    published: 0,
    tables: [],
    relations: [],
    forms: [],
  } as PageVo;
  activeStep.value = 0;
}

function backToList() {
  current.value = null;
  activeStep.value = 0;
  void router.replace({ query: {} });
  void loadList();
}

/** Step1 保存后带着 pageId 进入 Step2。 */
async function onBasicSaved(page: PageVo) {
  current.value = page;
  activeStep.value = 1;
  await router.replace({ query: { ...route.query, pageId: page.pageId } });
  await loadList();
}

/** 数据模型完成 → Step3。 */
function onModelDone(page: PageVo) {
  current.value = page;
  activeStep.value = 2;
}

/** 表单设计完成 → Step4。 */
function onDesignDone(page: PageVo) {
  current.value = page;
  activeStep.value = 3;
}

/** 步骤条直接点击（只允许已到达的步骤，不能跳到比 status 更靠后的设计步骤）。 */
function onStepClick(step: number) {
  if (!current.value?.pageId) return;
  const reached = current.value.published === 1 ? 3 : (current.value.status ?? 0);
  if (step <= Math.max(reached, 3)) activeStep.value = step;
}

async function onDelete(page: PageVo) {
  if (!(await confirmAction(`确定删除页面「${page.pageName}」？`))) return;
  const ok = await withFeedback(() => deleteWizardPage(page.pageId), '已删除');
  if (ok) await loadList();
}

onMounted(async () => {
  await loadList();
  const pageId = route.query.pageId as string;
  if (pageId) await openPage(pageId);
});
</script>

<template>
  <Page>
    <div class="designer-workbench">
      <!-- ============ 列表模式 ============ -->
      <template v-if="listMode">
        <div class="wb-head">
          <div>
            <h2 class="wb-title">页面设计</h2>
            <p class="wb-sub">从数据源到表单，一条龙完成业务页面建模</p>
          </div>
          <ElButton type="primary" @click="newPage">新建页面</ElButton>
        </div>
        <div class="wb-flow-hint">
          <span>① 基础信息</span><b>→</b><span>② 数据模型(导表·关系)</span><b>→</b><span>③ 拖拽设计表单</span><b>→</b><span>④ 发布运行</span>
        </div>
        <div class="wb-cards">
          <div v-for="p in pages" :key="p.pageId" class="wb-card" @click="openPage(p.pageId)">
            <div class="wb-card-top">
              <span class="wb-card-name">{{ p.pageName }}</span>
              <ElButton v-if="p.published === 1" size="small" type="success" plain>已发布</ElButton>
              <ElButton v-else size="small" type="info" plain>草稿</ElButton>
            </div>
            <div class="wb-card-code">{{ p.pageCode }}</div>
            <div class="wb-card-meta">
              <span>{{ p.tables?.length ?? 0 }} 张表</span>
              <span>{{ p.forms?.length ?? 0 }} 个表单</span>
              <span>{{ p.dblinkCode ?? '未选数据源' }}</span>
            </div>
            <div class="wb-card-progress">
              <div class="wb-progress-bar">
                <div
                  class="wb-progress-fill"
                  :style="{ width: `${((p.published === 1 ? 3 : (p.status ?? 0)) + 1) * 25}%` }"
                />
              </div>
              <span class="wb-card-step">
                {{ p.published === 1 ? '发布运行' : ['基础信息', '数据模型', '设计表单'][p.status ?? 0] }}
              </span>
            </div>
            <ElButton class="wb-card-del" link type="danger" size="small" @click.stop="onDelete(p)">删除</ElButton>
          </div>
          <div v-if="!pages.length && !loading" class="wb-empty">
            还没有页面，点击「新建页面」开始建模
          </div>
        </div>
      </template>

      <!-- ============ 向导模式 ============ -->
      <template v-else>
        <div class="wb-head">
          <div class="wb-head-left">
            <ElButton link @click="backToList">← 返回列表</ElButton>
            <h2 class="wb-title">{{ currentPage.pageName || '新建页面' }}</h2>
          </div>
          <div class="wb-head-actions">
            <ElButton v-if="currentPage.pageId" size="small" @click="openPage(currentPage.pageId)">刷新</ElButton>
          </div>
        </div>

        <ElSteps :active="activeStep" align-center class="wb-steps" finish-status="success" @change="onStepClick">
          <ElStep title="基础信息" description="页面名称与数据源" />
          <ElStep title="数据模型" description="选表导字段·配关系" />
          <ElStep title="设计表单" description="拖拽布局·实时预览" />
          <ElStep title="发布运行" description="发布并验证业务数据" />
        </ElSteps>

        <div class="wb-step-body" v-loading="loading">
          <Step1Basic
            v-if="activeStep === 0"
            :page="currentPage"
            @saved="onBasicSaved"
          />
          <Step2Model
            v-else-if="activeStep === 1"
            :page="currentPage"
            @done="onModelDone"
            @back="activeStep = 0"
          />
          <Step3Designer
            v-else-if="activeStep === 2"
            :page="currentPage"
            @done="onDesignDone"
            @back="activeStep = 1"
          />
          <Step4Run
            v-else
            :page="currentPage"
            @back="activeStep = 2"
          />
        </div>
      </template>
    </div>
  </Page>
</template>

<style scoped>
.designer-workbench { padding: 4px 0; }
.wb-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.wb-head-left { display: flex; align-items: center; gap: 12px; }
.wb-title { font-size: 20px; font-weight: 600; margin: 0; }
.wb-sub { color: var(--el-text-color-secondary); font-size: 13px; margin: 4px 0 0; }
.wb-flow-hint { display: flex; align-items: center; gap: 10px; background: var(--el-fill-color-light); border-radius: 8px; padding: 12px 18px; margin-bottom: 16px; font-size: 13px; color: var(--el-text-color-regular); }
.wb-flow-hint b { color: var(--el-color-primary); }
.wb-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 14px; }
.wb-card { position: relative; border: 1px solid var(--el-border-color); border-radius: 10px; padding: 16px; cursor: pointer; transition: box-shadow .2s, transform .2s; }
.wb-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,.08); transform: translateY(-2px); }
.wb-card-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.wb-card-name { font-size: 15px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wb-card-code { font-size: 12px; color: var(--el-text-color-secondary); margin-top: 6px; }
.wb-card-meta { display: flex; gap: 12px; font-size: 12px; color: var(--el-text-color-secondary); margin-top: 12px; }
.wb-card-progress { display: flex; align-items: center; gap: 8px; margin-top: 12px; }
.wb-progress-bar { flex: 1; height: 6px; background: var(--el-fill-color); border-radius: 3px; overflow: hidden; }
.wb-progress-fill { height: 100%; background: var(--el-color-primary); border-radius: 3px; transition: width .3s; }
.wb-card-step { font-size: 11px; color: var(--el-text-color-secondary); white-space: nowrap; }
.wb-card-del { position: absolute; right: 10px; bottom: 8px; }
.wb-empty { grid-column: 1/-1; border: 1px dashed var(--el-border-color); border-radius: 10px; padding: 60px 20px; text-align: center; color: var(--el-text-color-secondary); }
.wb-steps { margin-bottom: 24px; }
.wb-step-body { min-height: 420px; }
</style>
