<script lang="ts" setup>
/** Step1 基础信息：页面名称/编码/类型/数据源连接。保存后得到 pageId。 */
import type { PageVo, OnlineCategoryVO, OnlineDblinkVO } from '#/api/online';

import { onMounted, reactive, ref } from 'vue';

import {
  ElButton,
  ElForm,
  ElFormItem,
  ElInput,
  ElMessage,
  ElOption,
  ElSelect,
} from 'element-plus';
import type { FormInstance, FormRules } from 'element-plus';

import {
  getCategoryTree,
  getOnlineDblinkList,
  saveWizardBasic,
  WIZARD_PAGE_TYPES,
} from '#/api/online';

const props = defineProps<{ page: PageVo }>();
const emit = defineEmits<{ saved: [page: PageVo] }>();

const saving = ref(false);
const formRef = ref<FormInstance>();
const categories = ref<OnlineCategoryVO[]>([]);
const dblinks = ref<OnlineDblinkVO[]>([]);
const form = reactive({
  pageId: '',
  pageCode: '',
  pageName: '',
  pageType: 1,
  categoryId: '' as string | undefined,
  dblinkCode: '' as string | undefined,
  remark: '',
});

const rules: FormRules = {
  pageName: [{ required: true, message: '请输入页面名称', trigger: 'blur' }],
};

onMounted(async () => {
  Object.assign(form, {
    pageId: props.page?.pageId ?? '',
    pageCode: props.page?.pageCode ?? '',
    pageName: props.page?.pageName ?? '',
    pageType: props.page?.pageType ?? 1,
    categoryId: props.page?.categoryId ?? undefined,
    dblinkCode: props.page?.dblinkCode ?? undefined,
    remark: props.page?.remark ?? '',
  });
  try {
    [categories.value, dblinks.value] = await Promise.all([getCategoryTree(), getOnlineDblinkList()]);
  } catch {
    categories.value = [];
    dblinks.value = [];
  }
});

async function onSubmit() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  saving.value = true;
  try {
    const page = await saveWizardBasic({ ...form });
    ElMessage.success('基础信息已保存');
    emit('saved', page);
  } catch (e: any) {
    ElMessage.error(e?.message ?? '保存失败');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="step-basic">
    <div class="step-intro">
      <h3>第 1 步 · 基础信息</h3>
      <p>给页面起个名字，选择它要基于哪个数据源连接建模。保存后进入数据模型配置。</p>
    </div>
    <ElForm ref="formRef" :model="form" :rules="rules" label-position="top" class="basic-form">
      <ElFormItem label="页面名称" prop="pageName">
        <ElInput v-model="form.pageName" placeholder="如：客户合同管理" />
      </ElFormItem>
      <ElFormItem label="页面编码">
        <ElInput v-model="form.pageCode" placeholder="留空自动生成" :disabled="!!form.pageId" />
      </ElFormItem>
      <ElFormItem label="页面类型">
        <ElSelect v-model="form.pageType">
          <ElOption v-for="t in WIZARD_PAGE_TYPES" :key="t.value" :label="t.label" :value="t.value" />
        </ElSelect>
      </ElFormItem>
      <ElFormItem label="所属分类">
        <ElSelect v-model="form.categoryId" clearable placeholder="不分类">
          <ElOption v-for="c in categories" :key="c.categoryId" :label="c.categoryName" :value="c.categoryId" />
        </ElSelect>
      </ElFormItem>
      <ElFormItem label="数据源连接">
        <ElSelect v-model="form.dblinkCode" clearable placeholder="选择数据源连接（下一步读取表结构）">
          <ElOption v-for="d in dblinks" :key="d.code" :label="`${d.name} (${d.code})`" :value="d.code" />
        </ElSelect>
        <div class="field-hint">数据源连接在「数据源管理」中维护；选择后下一步即可读取真实表结构。</div>
      </ElFormItem>
      <ElFormItem label="备注">
        <ElInput v-model="form.remark" type="textarea" :rows="2" placeholder="可选" />
      </ElFormItem>
    </ElForm>
    <div class="step-actions">
      <ElButton type="primary" :loading="saving" @click="onSubmit">
        {{ form.pageId ? '保存并下一步' : '创建页面并下一步' }}
      </ElButton>
    </div>
  </div>
</template>

<style scoped>
.step-basic { max-width: 720px; }
.step-intro h3 { margin: 0 0 6px; font-size: 17px; }
.step-intro p { margin: 0 0 20px; color: var(--el-text-color-secondary); font-size: 13px; }
.basic-form { background: var(--el-fill-color-blank); border: 1px solid var(--el-border-color-lighter); border-radius: 8px; padding: 20px; }
.field-hint { font-size: 12px; color: var(--el-text-color-secondary); margin-top: 4px; }
.step-actions { margin-top: 20px; display: flex; justify-content: flex-end; }
</style>
