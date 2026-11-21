<script lang="ts" setup>
/**
 * 表单中心（v4 唯一入口）：左侧分类树 + 右侧分页列表。
 * 新建表单 = 选数据源 → 选主表/关联表 → 服务端一次建完容器、表、关系、视图。
 */
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';

import {
  ElButton,
  ElCheckbox,
  ElDialog,
  ElForm,
  ElFormItem,
  ElInput,
  ElMessage,
  ElMessageBox,
  ElOption,
  ElPagination,
  ElRadio,
  ElSelect,
  ElStep,
  ElSteps,
  ElTable,
  ElTableColumn,
  ElTag,
  ElTree,
} from 'element-plus';

import { getOnlineDblinkList } from '#/api/online/dblink';
import {
  cloneForm,
  createForm,
  deleteForm,
  getFormDetail,
  listForms,
  publishForm,
  unpublishForm,
  updateForm,
} from '#/api/online/formCenter';
import {
  deleteCategory,
  getCategoryTree,
  getSchemaTables,
  saveCategory,
} from '#/api/online/modeling';

import {
  confirmAction,
  usePermission,
  withFeedback,
} from '../../system/shared/helpers';

const { has } = usePermission();
const router = useRouter();

const loading = ref(false);
const rows = ref<any[]>([]);
const total = ref(0);
const pageNum = ref(1);
const pageSize = ref(10);

const query = reactive({
  keyword: '',
  status: undefined as number | undefined,
  categoryId: 'ALL',
});

const categories = ref<any[]>([]);
const categoryInputVisible = ref(false);
const categoryInput = ref('');
const categoryParent = ref<string>('');

function mapCategory(nodes: any[]): any[] {
  return (nodes || []).map((n) => ({
    id: n.categoryId,
    name: n.categoryName,
    count: n.totalFormCount ?? n.formCount ?? 0,
    children: mapCategory(n.children || []),
  }));
}

const treeData = computed(() => {
  const totalCount = categories.value.reduce((s, c) => s + (c.count || 0), 0);
  return [
    {
      id: 'ALL',
      name: '全部表单',
      count: totalCount,
      children: categories.value,
    },
  ];
});

async function loadCategories() {
  try {
    categories.value = mapCategory(await getCategoryTree());
  } catch {
    categories.value = [];
  }
}

async function loadForms() {
  loading.value = true;
  try {
    const page = await listForms({
      categoryId: query.categoryId,
      keyword: query.keyword || undefined,
      pageNum: pageNum.value,
      pageSize: pageSize.value,
      status: query.status,
    });
    rows.value = page.records || [];
    total.value = Number(page.total || 0);
  } catch {
    rows.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

function onTreeClick(node: any) {
  query.categoryId = node.id;
  pageNum.value = 1;
  loadForms();
}

function onSearch() {
  pageNum.value = 1;
  loadForms();
}

function openCategoryInput(parentId?: string) {
  categoryParent.value = parentId || '';
  categoryInput.value = '';
  categoryInputVisible.value = true;
}

async function submitCategory() {
  const name = categoryInput.value.trim();
  if (!name) return;
  const ok = await withFeedback(
    () =>
      saveCategory({
        categoryName: name,
        parentId: categoryParent.value,
      } as any),
    '分类已创建',
  );
  if (ok) {
    categoryInputVisible.value = false;
    await loadCategories();
    await loadForms();
  }
}

async function renameCategory(node: any) {
  const res = await ElMessageBox.prompt('分类名称', '重命名分类', {
    inputValue: node.name,
    showCancelButton: true,
  }).catch(() => null);
  if (!res) return;
  const ok = await withFeedback(
    () =>
      saveCategory({
        categoryId: node.id,
        categoryName: res.value.trim(),
        parentId: parentFor(node.id),
      } as any),
    '已重命名',
  );
  if (ok) await loadCategories();
}

function parentFor(
  id: string,
  nodes: any[] = categories.value,
  parent = '',
): string {
  for (const n of nodes) {
    if (n.id === id) return parent;
    const hit = parentFor(id, n.children || [], n.id);
    if (hit) return hit;
  }
  return '';
}

async function removeCategory(node: any) {
  if (
    !(await confirmAction(`删除分类「${node.name}」？其下表单会回到未分类。`))
  )
    return;
  const ok = await withFeedback(() => deleteCategory(node.id), '已删除');
  if (ok) {
    await loadCategories();
    if (query.categoryId === node.id) query.categoryId = 'ALL';
    await loadForms();
  }
}

// ---------------- 新建表单 ----------------
const createVisible = ref(false);
const createStep = ref(0);
const submitting = ref(false);
const dblinks = ref<any[]>([]);
const schemaTables = ref<Array<{ tableComment?: string; tableName: string }>>(
  [],
);
const tableLoading = ref(false);
const tableKeyword = ref('');
const masterTable = ref('');
const relatedTables = ref<string[]>([]);

const createFormModel = reactive({
  formName: '',
  formCode: '',
  categoryId: '',
  formKind: 1,
  dblinkCode: '',
  remark: '',
});

const filteredTables = computed(() => {
  const kw = tableKeyword.value.trim().toLowerCase();
  if (!kw) return schemaTables.value;
  return schemaTables.value.filter(
    (t) =>
      t.tableName.toLowerCase().includes(kw) ||
      (t.tableComment || '').toLowerCase().includes(kw),
  );
});

async function openCreate() {
  createStep.value = 0;
  masterTable.value = '';
  relatedTables.value = [];
  tableKeyword.value = '';
  schemaTables.value = [];
  Object.assign(createFormModel, {
    formName: '',
    formCode: '',
    categoryId: query.categoryId === 'ALL' ? '' : query.categoryId,
    formKind: 1,
    dblinkCode: dblinks.value[0]?.code || '',
    remark: '',
  });
  createVisible.value = true;
}

async function loadSchemaTables() {
  if (!createFormModel.dblinkCode) {
    ElMessage.warning('请先选择数据源');
    return false;
  }
  tableLoading.value = true;
  try {
    schemaTables.value = await getSchemaTables(createFormModel.dblinkCode);
  } catch {
    schemaTables.value = [];
  } finally {
    tableLoading.value = false;
  }
  return true;
}

async function nextStep() {
  if (!createFormModel.formName.trim()) {
    ElMessage.warning('请输入表单名称');
    return;
  }
  if (!createFormModel.dblinkCode) {
    ElMessage.warning('请选择数据源');
    return;
  }
  if (await loadSchemaTables()) createStep.value = 1;
}

function toggleRelated(row: any) {
  if (row.tableName === masterTable.value) return;
  const idx = relatedTables.value.indexOf(row.tableName);
  if (idx !== -1) relatedTables.value.splice(idx, 1);
  else relatedTables.value.push(row.tableName);
}

async function submitCreate() {
  if (!masterTable.value) {
    ElMessage.warning('请选择一张主表');
    return;
  }
  submitting.value = true;
  try {
    const detail = await createForm({
      categoryId: createFormModel.categoryId || undefined,
      dblinkCode: createFormModel.dblinkCode,
      formCode: createFormModel.formCode.trim() || undefined,
      formKind: createFormModel.formKind,
      formName: createFormModel.formName.trim(),
      masterTable: masterTable.value,
      relatedTables: relatedTables.value,
      remark: createFormModel.remark || undefined,
    });
    createVisible.value = false;
    ElMessage.success('表单已创建，进入设计器');
    await loadForms();
    await loadCategories();
    router.push({
      path: '/online/form/design',
      query: { formId: detail.formId },
    });
  } finally {
    submitting.value = false;
  }
}

// ---------------- 行操作 ----------------
function openDesign(row: any, mode?: string) {
  router.push({
    path: '/online/form/design',
    query: { formId: row.formId, ...(mode ? { mode } : {}) },
  });
}

const editVisible = ref(false);
const editing = ref<any>(null);
const editModel = reactive({
  formName: '',
  formCode: '',
  categoryId: '',
  remark: '',
});

async function openEdit(row: any) {
  editing.value = row;
  Object.assign(editModel, {
    formName: row.formName,
    formCode: row.formCode,
    categoryId: row.categoryId || '',
    remark: row.remark || '',
  });
  editVisible.value = true;
}

async function submitEdit() {
  if (!editing.value) return;
  const ok = await withFeedback(
    () =>
      updateForm({
        categoryId: editModel.categoryId || '',
        formCode: editModel.formCode.trim() || undefined,
        formId: editing.value.formId,
        formName: editModel.formName.trim(),
        remark: editModel.remark,
      }),
    '已保存',
  );
  if (ok) {
    editVisible.value = false;
    await loadForms();
    await loadCategories();
  }
}

async function onPublish(row: any) {
  const detail = await getFormDetail(row.formId).catch(() => null);
  const entryViewId =
    detail?.defaultViewId ||
    detail?.views?.find((v) => v.viewType === 6)?.viewId ||
    detail?.views?.find((v) => v.viewType === 1)?.viewId;
  const ok = await withFeedback(
    () => publishForm({ entryViewId, formId: row.formId }),
    '已发布并绑定菜单',
  );
  if (ok) await loadForms();
}

async function onUnpublish(row: any) {
  const ok = await withFeedback(() => unpublishForm(row.formId), '已取消发布');
  if (ok) await loadForms();
}

async function onClone(row: any) {
  const ok = await withFeedback(() => cloneForm(row.formId), '已复制为副本');
  if (ok) {
    await loadForms();
    await loadCategories();
  }
}

async function onDelete(row: any) {
  if (
    !(await confirmAction(
      `删除表单「${row.formName}」及其全部视图？此操作不可恢复。`,
    ))
  )
    return;
  const ok = await withFeedback(() => deleteForm(row.formId), '已删除');
  if (ok) {
    await loadForms();
    await loadCategories();
  }
}

function kindLabel(kind?: number) {
  return { 1: '基础', 5: '统计', 10: '流程', 11: '工单' }[kind || 1] || '基础';
}

function viewTypeLabel(type: number) {
  return (
    {
      1: '列表',
      2: '分组',
      3: '选择',
      5: '表单',
      6: '统计',
      9: '行编辑',
      10: '详情',
    }[type] || `${type}`
  );
}

onMounted(async () => {
  await Promise.all([loadCategories(), loadForms()]);
  try {
    dblinks.value = await getOnlineDblinkList();
  } catch {
    dblinks.value = [];
  }
});
</script>

<template>
  <Page>
    <div class="flex h-full min-h-[520px] gap-4">
      <aside
        class="flex w-64 shrink-0 flex-col rounded-lg border border-border p-3"
      >
        <div class="mb-2 flex items-center justify-between">
          <span class="text-sm font-medium">表单分类</span>
          <ElButton
            v-if="has('online:form:add')"
            link
            type="primary"
            @click="openCategoryInput()"
          >
            + 新建
          </ElButton>
        </div>
        <div v-if="categoryInputVisible" class="mb-2 flex gap-1">
          <ElInput
            v-model="categoryInput"
            size="small"
            placeholder="分类名称"
            @keyup.enter="submitCategory"
          />
          <ElButton size="small" type="primary" @click="submitCategory">
存
</ElButton>
        </div>
        <div class="flex-1 overflow-auto">
          <ElTree
            :data="treeData"
            node-key="id"
            default-expand-all
            :expand-on-click-node="false"
            highlight-current
            @node-click="onTreeClick"
          >
            <template #default="{ data }">
              <div class="group flex w-full items-center justify-between pr-1">
                <span class="truncate">{{ data.name }}</span>
                <span class="flex items-center gap-1">
                  <span class="text-xs text-gray-400">{{ data.count }}</span>
                  <ElButton
                    v-if="data.id !== 'ALL' && has('online:form:update')"
                    class="hidden group-hover:inline-flex"
                    link
                    size="small"
                    @click.stop="renameCategory(data)"
                  >
                    改
                  </ElButton>
                  <ElButton
                    v-if="data.id !== 'ALL' && has('online:form:delete')"
                    class="hidden group-hover:inline-flex"
                    link
                    size="small"
                    type="danger"
                    @click.stop="removeCategory(data)"
                  >
                    删
                  </ElButton>
                </span>
              </div>
            </template>
          </ElTree>
        </div>
      </aside>

      <section class="flex min-w-0 flex-1 flex-col">
        <div class="mb-3 flex flex-wrap items-center gap-2">
          <ElInput
            v-model="query.keyword"
            class="!w-56"
            clearable
            placeholder="表单名称 / 编码 / 主表"
            @keyup.enter="onSearch"
            @clear="onSearch"
          />
          <ElSelect
            v-model="query.status"
            class="!w-32"
            clearable
            placeholder="全部状态"
            @change="onSearch"
          >
            <ElOption label="草稿" :value="0" />
            <ElOption label="已发布" :value="1" />
          </ElSelect>
          <ElButton @click="onSearch">查询</ElButton>
          <div class="flex-1"></div>
          <ElButton
            v-if="has('online:form:add')"
            type="primary"
            @click="openCreate"
            >
新建表单
</ElButton>
        </div>

        <ElTable
          v-loading="loading"
          :data="rows"
          border
          height="100%"
          class="flex-1"
          row-key="formId"
        >
          <ElTableColumn label="表单" min-width="220">
            <template #default="{ row }">
              <div class="flex flex-col">
                <span class="font-medium">{{ row.formName }}</span>
                <span class="text-xs text-gray-400">{{ row.formCode }} · {{ kindLabel(row.formKind) }}</span>
              </div>
            </template>
          </ElTableColumn>
          <ElTableColumn label="分类" width="110">
            <template #default="{ row }">
{{
              row.categoryName || '-'
            }}
</template>
          </ElTableColumn>
          <ElTableColumn label="主表" min-width="160">
            <template #default="{ row }">
              <span class="text-sm">{{ row.masterTable || '-' }}</span>
              <div class="text-xs text-gray-400">
                {{ row.masterTableComment }}
              </div>
            </template>
          </ElTableColumn>
          <ElTableColumn label="视图" width="160">
            <template #default="{ row }">
              <div class="flex flex-wrap gap-1">
                <ElTag
                  v-for="t in row.viewTypes"
                  :key="t"
                  size="small"
                  type="info"
                >
                  {{ viewTypeLabel(t) }}
                </ElTag>
                <span class="text-xs text-gray-400">共 {{ row.viewCount }} 个</span>
              </div>
            </template>
          </ElTableColumn>
          <ElTableColumn label="状态" width="90">
            <template #default="{ row }">
              <ElTag :type="row.status === 1 ? 'success' : 'info'" size="small">
                {{ row.status === 1 ? '已发布' : '草稿' }}
              </ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn label="更新时间" width="150">
            <template #default="{ row }">
{{
              (row.updateTime || '').replace('T', ' ').slice(0, 16)
            }}
</template>
          </ElTableColumn>
          <ElTableColumn label="操作" fixed="right" width="260">
            <template #default="{ row }">
              <ElButton
                link
                type="primary"
                size="small"
                @click="openDesign(row)"
                >
设计
</ElButton>
              <ElButton link size="small" @click="openDesign(row, 'preview')">
预览
</ElButton>
              <ElButton
                v-if="has('online:form:update')"
                link
                size="small"
                @click="openEdit(row)"
                >
编辑
</ElButton>
              <ElButton
                v-if="has('online:form:publish') && row.status !== 1"
                link
                type="success"
                size="small"
                @click="onPublish(row)"
              >
                发布
              </ElButton>
              <ElButton
                v-if="has('online:form:publish') && row.status === 1"
                link
                type="warning"
                size="small"
                @click="onUnpublish(row)"
              >
                取消发布
              </ElButton>
              <ElButton
                v-if="has('online:form:add')"
                link
                size="small"
                @click="onClone(row)"
                >
复制
</ElButton>
              <ElButton
                v-if="has('online:form:delete')"
                link
                type="danger"
                size="small"
                @click="onDelete(row)"
              >
                删除
              </ElButton>
            </template>
          </ElTableColumn>
        </ElTable>

        <div class="mt-3 flex justify-end">
          <ElPagination
            v-model:current-page="pageNum"
            v-model:page-size="pageSize"
            :page-sizes="[10, 20, 50]"
            :total="total"
            background
            layout="total, sizes, prev, pager, next"
            @current-change="loadForms"
            @size-change="loadForms"
          />
        </div>
      </section>
    </div>

    <!-- 新建表单：选数据源 → 选表 -->
    <ElDialog
      v-model="createVisible"
      title="新建表单"
      width="860px"
      destroy-on-close
    >
      <ElSteps :active="createStep" class="mb-4">
        <ElStep title="基础信息" description="名称、分类、数据源" />
        <ElStep title="选择数据表" description="主表 + 关联表" />
      </ElSteps>

      <div v-if="createStep === 0">
        <ElForm label-width="92px">
          <ElFormItem label="表单名称" required>
            <ElInput
              v-model="createFormModel.formName"
              placeholder="如：客户管理"
            />
          </ElFormItem>
          <ElFormItem label="表单编码">
            <ElInput
              v-model="createFormModel.formCode"
              placeholder="留空自动生成，如 biz_customer_mgr"
            />
          </ElFormItem>
          <ElFormItem label="所属分类">
            <ElSelect
              v-model="createFormModel.categoryId"
              clearable
              placeholder="未分类"
              class="w-full"
            >
              <ElOption label="未分类" value="" />
              <ElOption
                v-for="c in categories"
                :key="c.id"
                :label="c.name"
                :value="c.id"
              />
            </ElSelect>
          </ElFormItem>
          <ElFormItem label="表单形态">
            <ElSelect v-model="createFormModel.formKind" class="w-full">
              <ElOption label="基础表单" :value="1" />
              <ElOption label="统计报表" :value="5" />
              <ElOption label="流程表单" :value="10" />
              <ElOption label="工单表单" :value="11" />
            </ElSelect>
          </ElFormItem>
          <ElFormItem label="数据源" required>
            <ElSelect
              v-model="createFormModel.dblinkCode"
              class="w-full"
              placeholder="选择数据源"
            >
              <ElOption
                v-for="d in dblinks"
                :key="d.code"
                :label="d.name"
                :value="d.code"
              />
            </ElSelect>
          </ElFormItem>
          <ElFormItem label="备注">
            <ElInput
              v-model="createFormModel.remark"
              :rows="2"
              type="textarea"
            />
          </ElFormItem>
        </ElForm>
      </div>

      <div v-else>
        <div class="mb-2 flex items-center gap-2">
          <ElInput
            v-model="tableKeyword"
            class="!w-64"
            clearable
            placeholder="搜索表名 / 表注释"
          />
          <span class="text-xs text-gray-500">主表决定表单字段，关联表用于子表/选择弹窗</span>
        </div>
        <ElTable
          v-loading="tableLoading"
          :data="filteredTables"
          border
          height="380px"
          size="small"
        >
          <ElTableColumn width="70" label="主表">
            <template #default="{ row }">
              <ElRadio
                v-model="masterTable"
                :value="row.tableName"
                @change="
                  relatedTables = relatedTables.filter(
                    (t) => t !== row.tableName,
                  )
                "
              />
            </template>
          </ElTableColumn>
          <ElTableColumn width="70" label="关联">
            <template #default="{ row }">
              <ElCheckbox
                :disabled="row.tableName === masterTable"
                :model-value="relatedTables.includes(row.tableName)"
                @change="toggleRelated(row)"
              />
            </template>
          </ElTableColumn>
          <ElTableColumn prop="tableName" label="物理表" min-width="200" />
          <ElTableColumn prop="tableComment" label="表注释" min-width="200" />
        </ElTable>
        <div class="mt-2 text-xs text-gray-500">
          已选主表：{{ masterTable || '未选择' }}；关联表
          {{ relatedTables.length }} 张
        </div>
      </div>

      <template #footer>
        <ElButton @click="createVisible = false">取消</ElButton>
        <ElButton v-if="createStep === 1" @click="createStep = 0">
上一步
</ElButton>
        <ElButton v-if="createStep === 0" type="primary" @click="nextStep">
下一步
</ElButton>
        <ElButton
          v-else
          type="primary"
          :loading="submitting"
          @click="submitCreate"
          >
创建并设计
</ElButton>
      </template>
    </ElDialog>

    <!-- 编辑基础信息 -->
    <ElDialog v-model="editVisible" title="编辑表单" width="520px">
      <ElForm label-width="92px">
        <ElFormItem label="表单名称">
          <ElInput v-model="editModel.formName" />
        </ElFormItem>
        <ElFormItem label="表单编码">
          <ElInput v-model="editModel.formCode" />
        </ElFormItem>
        <ElFormItem label="所属分类">
          <ElSelect v-model="editModel.categoryId" clearable class="w-full">
            <ElOption label="未分类" value="" />
            <ElOption
              v-for="c in categories"
              :key="c.id"
              :label="c.name"
              :value="c.id"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="备注">
          <ElInput v-model="editModel.remark" :rows="2" type="textarea" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="editVisible = false">取消</ElButton>
        <ElButton type="primary" @click="submitEdit">保存</ElButton>
      </template>
    </ElDialog>
  </Page>
</template>
