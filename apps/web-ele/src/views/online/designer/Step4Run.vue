<script lang="ts" setup>
/**
 * Step4 发布绑定菜单（v3 低代码闭环的核心一步）。
 *
 * 页面发布 = 把页面的「入口查询表单」发布成一条在线表单菜单（bind_type=1）。
 * 发布后用户在左侧菜单点击即可像普通 Vue 页面一样使用该业务页面。
 * 同时支持直接在运行时组件里验证查询数据。
 */
import type { PageVo } from '#/api/online';

import { computed, onMounted, ref } from 'vue';

import { ElButton, ElMessage, ElOption, ElSelect, ElTag } from 'element-plus';

import { publishFormMenu, publishWizardPage, runQuery } from '#/api/online';
import { confirmAction } from '../../system/shared/helpers';

const props = defineProps<{ page: PageVo }>();
const emit = defineEmits<{ back: []; published: [page: PageVo] }>();

const entryFormId = ref('');
const menuId = ref('');
const publishing = ref(false);
const rows = ref<Array<Record<string, unknown>>>([]);
const loading = ref(false);

const queryForms = computed(() => (props.page?.forms ?? []).filter((f) => f.pageRole === 'query'));
const editForms = computed(() => (props.page?.forms ?? []).filter((f) => f.pageRole === 'edit'));
const alreadyPublished = computed(() => props.page?.published === 1);

onMounted(() => {
  entryFormId.value = queryForms.value[0]?.formId ?? '';
});

async function onPublish() {
  if (!entryFormId.value) {
    ElMessage.warning('请选择入口查询表单');
    return;
  }
  if (editForms.value.length === 0) {
    const go = await confirmAction('页面还没有编辑表单，发布后只能查看不能新增/编辑。仍要发布吗？');
    if (!go) return;
  }
  publishing.value = true;
  try {
    // 1) 页面状态机发布（校验 status=2）
    await publishWizardPage(props.page.pageId);
    // 2) 绑定在线表单菜单（bind_type=1, online_form_id=入口表单）
    const res = await publishFormMenu(props.page.pageId, entryFormId.value);
    menuId.value = res.menuId;
    ElMessage.success(`已发布并生成菜单：${res.menuId}`);
    emit('published', { ...props.page, published: 1 });
    await doVerify();
  } catch (e: any) {
    ElMessage.error(e?.message ?? '发布失败');
  } finally {
    publishing.value = false;
  }
}

async function doVerify() {
  if (!entryFormId.value) return;
  loading.value = true;
  try {
    const res = await runQuery({ formId: entryFormId.value, pageNum: 1, pageSize: 10 });
    rows.value = res.rows ?? [];
  } catch {
    rows.value = [];
  } finally {
    loading.value = false;
  }
}

function openRuntime() {
  window.open(
    `${window.location.origin}/online/form-run?formId=${entryFormId.value}`,
    '_blank',
  );
}
</script>

<template>
  <div class="step-publish">
    <div class="step-intro">
      <h3>第 4 步 · 发布并生成菜单</h3>
      <p>
        发布 = 把页面的「查询表单」绑定成一条在线表单菜单。发布后，左侧菜单会出现这个业务页面，
        点击即可像普通 Vue 页面一样使用（低代码/零代码）。
      </p>
    </div>

    <div class="pub-block">
      <div class="pb-title">① 选择入口查询表单</div>
      <div class="pub-row">
        <ElSelect v-model="entryFormId" placeholder="选择作为菜单入口的查询表单" style="width: 340px">
          <ElOption v-for="f in queryForms" :key="f.formId" :label="f.formName" :value="f.formId" />
        </ElSelect>
        <ElTag v-if="editForms.length" size="small" type="success">编辑表单已就绪（{{ editForms.length }}）</ElTag>
        <ElTag v-else size="small" type="warning">缺少编辑表单（发布后只能查看）</ElTag>
      </div>
    </div>

    <div class="pub-block">
      <div class="pb-title">② 发布</div>
      <div class="pub-row">
        <ElButton type="primary" :loading="publishing" @click="onPublish">
          {{ alreadyPublished ? '重新发布（更新菜单）' : '发布并生成菜单' }}
        </ElButton>
        <ElButton v-if="menuId || alreadyPublished" @click="openRuntime">打开运行时页面</ElButton>
      </div>
      <div v-if="menuId" class="pub-menu-info">
        菜单已创建：<code>{{ menuId }}</code>
        （bind_type=1，入口表单 {{ entryFormId }}）。刷新浏览器左侧菜单即可看到。
      </div>
    </div>

    <div class="pub-block" v-if="rows.length">
      <div class="pb-title">③ 运行时验证（真实数据）</div>
      <div class="pub-table-wrap">
        <table class="pub-table">
          <thead><tr><th v-for="(_v, k) in (rows[0] ?? {})" :key="k">{{ k }}</th></tr></thead>
          <tbody>
            <tr v-for="(row, i) in rows" :key="i">
              <td v-for="(v, k) in row" :key="k">
                <span v-if="k === '_labels'">{{ JSON.stringify(v) }}</span>
                <span v-else>{{ v ?? '-' }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="step-actions">
      <ElButton @click="emit('back')">上一步</ElButton>
    </div>
  </div>
</template>

<style scoped>
.step-publish { max-width: 1000px; }
.step-intro h3 { margin: 0 0 6px; font-size: 17px; }
.step-intro p { margin: 0 0 18px; color: var(--el-text-color-secondary); font-size: 13px; }
.pub-block { border: 1px solid var(--el-border-color); border-radius: 8px; padding: 14px 16px; margin-bottom: 14px; }
.pb-title { font-weight: 600; font-size: 14px; margin-bottom: 10px; }
.pub-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.pub-menu-info { margin-top: 10px; font-size: 12px; color: var(--el-text-color-secondary); }
.pub-menu-info code { background: var(--el-fill-color-light); padding: 2px 6px; border-radius: 4px; }
.pub-table-wrap { border: 1px solid var(--el-border-color-lighter); border-radius: 6px; overflow: auto; max-height: 260px; }
.pub-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.pub-table th, .pub-table td { padding: 6px 10px; text-align: left; border-bottom: 1px solid var(--el-border-color-lighter); white-space: nowrap; max-width: 180px; overflow: hidden; text-overflow: ellipsis; }
.pub-table th { background: var(--el-fill-color-light); }
.step-actions { display: flex; justify-content: flex-end; margin-top: 20px; }
</style>
