<script lang="ts" setup>
/** 表单分类树管理：树形展示 + 新增/编辑/删除。 */
import { computed, onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  ElButton,
  ElDrawer,
  ElForm,
  ElFormItem,
  ElInput,
  ElInputNumber,
  ElMessage,
  ElTree,
} from 'element-plus';
import type { FormInstance } from 'element-plus';

import {
  deleteCategory,
  getCategoryTree,
  saveCategory,
} from '#/api/online';
import type { OnlineCategoryDTO, OnlineCategoryVO } from '#/api/online';
import { confirmAction, withFeedback } from '../../system/shared/helpers';

const tree = ref<OnlineCategoryVO[]>([]);
const loading = ref(false);
const drawerVisible = ref(false);
const saving = ref(false);
const editing = ref(false);
const formRef = ref<FormInstance>();
const form = reactive<OnlineCategoryDTO>({
  categoryName: '',
  categoryCode: '',
  parentId: 'ROOT',
  sortNo: 0,
  remark: '',
});

const parentOptions = computed(() => {
  const flat: Array<{ label: string; value: string }> = [{ label: '（根目录）', value: 'ROOT' }];
  const walk = (nodes: OnlineCategoryVO[], depth: number) => {
    for (const n of nodes) {
      flat.push({ label: `${'　'.repeat(depth)}${n.categoryName}`, value: n.categoryId });
      if (n.children?.length) walk(n.children, depth + 1);
    }
  };
  walk(tree.value, 0);
  return flat;
});

async function load() {
  loading.value = true;
  try {
    tree.value = await getCategoryTree();
  } catch {
    tree.value = [];
  } finally {
    loading.value = false;
  }
}

function openCreate(parentId = 'ROOT') {
  editing.value = false;
  Object.assign(form, {
    categoryId: undefined,
    categoryName: '',
    categoryCode: '',
    parentId,
    sortNo: 0,
    remark: '',
  });
  drawerVisible.value = true;
  formRef.value?.clearValidate();
}

function openEdit(node: OnlineCategoryVO) {
  editing.value = true;
  Object.assign(form, {
    categoryId: node.categoryId,
    categoryName: node.categoryName,
    categoryCode: node.categoryCode,
    parentId: node.parentId,
    sortNo: node.sortNo,
    remark: node.remark,
  });
  drawerVisible.value = true;
  formRef.value?.clearValidate();
}

async function onSubmit() {
  if (!form.categoryName?.trim()) {
    ElMessage.warning('请输入分类名称');
    return;
  }
  saving.value = true;
  try {
    const ok = await withFeedback(() => saveCategory({ ...form }), '保存成功');
    if (ok) {
      drawerVisible.value = false;
      await load();
    }
  } finally {
    saving.value = false;
  }
}

async function onDelete(node: OnlineCategoryVO) {
  if (!(await confirmAction(`确定删除分类「${node.categoryName}」？`))) return;
  const ok = await withFeedback(() => deleteCategory(node.categoryId), '已删除');
  if (ok) await load();
}

onMounted(load);
</script>

<template>
  <Page>
    <div class="category-page">
      <div class="cat-bar">
        <span class="cat-title">表单分类</span>
        <ElButton type="primary" size="small" @click="openCreate()">新增分类</ElButton>
      </div>
      <div class="cat-tree-wrap">
        <ElTree
          :data="tree"
          :props="{ label: 'categoryName', children: 'children' }"
          default-expand-all
          v-loading="loading"
        >
          <template #default="{ data }">
            <span class="cat-node">
              <span class="cat-node-label">{{ data.categoryName }}</span>
              <span v-if="data.categoryCode" class="cat-node-code">{{ data.categoryCode }}</span>
              <span class="cat-node-actions">
                <ElButton link type="primary" size="small" @click.stop="openCreate(data.categoryId)">新增</ElButton>
                <ElButton link type="primary" size="small" @click.stop="openEdit(data)">编辑</ElButton>
                <ElButton
                  v-if="data.categoryId !== 'ROOT'"
                  link
                  type="danger"
                  size="small"
                  @click.stop="onDelete(data)"
                >
                  删除
                </ElButton>
              </span>
            </span>
          </template>
        </ElTree>
        <div v-if="!tree.length && !loading" class="cat-empty">暂无分类，点击「新增分类」开始</div>
      </div>
    </div>

    <ElDrawer v-model="drawerVisible" :title="editing ? '编辑分类' : '新增分类'" size="420px">
      <ElForm ref="formRef" :model="form" label-position="top">
        <ElFormItem label="分类名称" required>
          <ElInput v-model="form.categoryName" placeholder="如：客户管理" />
        </ElFormItem>
        <ElFormItem label="分类编码">
          <ElInput v-model="form.categoryCode" placeholder="如：CUSTOMER" />
        </ElFormItem>
        <ElFormItem label="父分类">
          <ElSelect v-model="form.parentId">
            <ElOption
              v-for="o in parentOptions"
              :key="o.value"
              :label="o.label"
              :value="o.value"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="排序">
          <ElInputNumber v-model="form.sortNo" :min="0" style="width: 100%" />
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
  </Page>
</template>

<style scoped>
.category-page { padding: 4px 0; }
.cat-bar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.cat-title { font-size: 18px; font-weight: 600; }
.cat-tree-wrap { border: 1px solid var(--el-border-color); border-radius: 8px; padding: 16px; min-height: 300px; }
.cat-node { display: flex; align-items: center; gap: 12px; flex: 1; }
.cat-node-label { font-weight: 500; }
.cat-node-code { font-size: 12px; color: var(--el-text-color-secondary); }
.cat-node-actions { margin-left: auto; }
.cat-empty { color: var(--el-text-color-secondary); text-align: center; padding: 40px; }
</style>
