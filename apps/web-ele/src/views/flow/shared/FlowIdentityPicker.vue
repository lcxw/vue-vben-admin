<script lang="ts" setup>
/**
 * 通用选人弹窗（流程设计器 / 办理动作 / 委托共用）。
 *
 * 数据全部来自 /flow/identity/*：workflow-server 通过 OpenFeign 调用
 * oidc-server 的用户/部门/角色接口，前端不直连 system-server。
 * 左侧部门树 + 关键字 + 角色过滤，右侧分页用户表格，支持跨页保留勾选。
 */
import type { FlowIdentityNodeVO, FlowIdentityVO } from '#/api/flow';

import { computed, nextTick, ref, watch } from 'vue';

import {
  ElButton,
  ElDialog,
  ElEmpty,
  ElInput,
  ElOption,
  ElPagination,
  ElSelect,
  ElTable,
  ElTableColumn,
  ElTag,
  ElTree,
} from 'element-plus';

import {
  getFlowDeptTree,
  getFlowRoles,
  getFlowUserPage,
  getFlowUsersByIds,
} from '#/api/flow';

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    multiple?: boolean;
    selectedIds?: string[];
    title?: string;
  }>(),
  { multiple: true, selectedIds: () => [], title: '选择用户' },
);

const emit = defineEmits<{
  confirm: [rows: FlowIdentityVO[]];
  'update:modelValue': [value: boolean];
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
});

const keyword = ref('');
const roleId = ref<string>('');
const deptIds = ref<number[]>([]);
const pageNum = ref(1);
const pageSize = ref(10);
const total = ref(0);
const loading = ref(false);
const rows = ref<FlowIdentityVO[]>([]);
const deptTree = ref<FlowIdentityNodeVO[]>([]);
const roleOptions = ref<FlowIdentityVO[]>([]);
const checked = ref<FlowIdentityVO[]>([]);
const tableRef = ref();

const treeProps = { children: 'children', label: 'name' };

function rowKey(row: FlowIdentityVO): string {
  return row.id;
}

async function loadUsers() {
  loading.value = true;
  try {
    const page = await getFlowUserPage({
      deptIds: deptIds.value,
      keyword: keyword.value || undefined,
      pageNum: pageNum.value,
      pageSize: pageSize.value,
      roleIds: roleId.value ? [roleId.value] : undefined,
    });
    rows.value = page?.records ?? [];
    total.value = page?.total ?? 0;
    await nextTick();
    for (const row of rows.value) {
      if (props.selectedIds.includes(row.id)) {
        tableRef.value?.toggleRowSelection?.(row, true);
      }
    }
  } catch (error) {
    console.error('[flow] load user page failed', error);
    rows.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

async function loadMeta() {
  try {
    const [tree, roles] = await Promise.all([
      getFlowDeptTree(),
      getFlowRoles(),
    ]);
    deptTree.value = tree ?? [];
    roleOptions.value = roles ?? [];
  } catch (error) {
    console.error('[flow] load identity meta failed', error);
  }
}

function onNodeClick(node: FlowIdentityNodeVO) {
  const id = Number(node.id);
  deptIds.value = Number.isNaN(id) ? [] : [id];
  pageNum.value = 1;
  void loadUsers();
}

function onSelectionChange(selection: FlowIdentityVO[]) {
  if (!props.multiple && selection.length > 1) {
    const last = selection.at(-1);
    for (const row of selection) {
      if (row.id !== last?.id) {
        tableRef.value?.toggleRowSelection?.(row, false);
      }
    }
    checked.value = last ? [last] : [];
    return;
  }
  checked.value = [...selection];
}

async function open() {
  pageNum.value = 1;
  keyword.value = '';
  roleId.value = '';
  deptIds.value = [];
  checked.value = [];
  if (props.selectedIds.length > 0) {
    try {
      checked.value = (await getFlowUsersByIds(props.selectedIds)) ?? [];
    } catch (error) {
      console.error('[flow] resolve selected users failed', error);
    }
  }
  await Promise.all([loadMeta(), loadUsers()]);
}

watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) void open();
  },
);

function resetFilter() {
  keyword.value = '';
  roleId.value = '';
  deptIds.value = [];
  pageNum.value = 1;
  void loadUsers();
}

function removeChecked(id: string) {
  checked.value = checked.value.filter((row) => row.id !== id);
  const row = rows.value.find((item) => item.id === id);
  if (row) tableRef.value?.toggleRowSelection?.(row, false);
}

function onConfirm() {
  emit('confirm', [...checked.value]);
  visible.value = false;
}
</script>

<template>
  <ElDialog v-model="visible" :title="title" width="860px" destroy-on-close>
    <div class="picker">
      <div class="picker__left">
        <div class="picker__title">组织架构</div>
        <ElInput
          v-model="keyword"
          clearable
          placeholder="姓名 / 账号"
          @keyup.enter="loadUsers"
        />
        <ElSelect
          v-model="roleId"
          clearable
          placeholder="按角色筛选"
          style="margin-top: 8px"
          @change="loadUsers"
        >
          <ElOption
            v-for="item in roleOptions"
            :key="item.id"
            :label="item.name"
            :value="item.id"
          />
        </ElSelect>
        <ElTree
          :data="deptTree"
          :props="treeProps"
          node-key="id"
          :expand-on-click-node="false"
          default-expand-all
          class="picker__tree"
          @node-click="onNodeClick"
        />
      </div>
      <div class="picker__right">
        <div class="picker__toolbar">
          <ElButton size="small" @click="loadUsers">查询</ElButton>
          <ElButton size="small" @click="resetFilter">重置</ElButton>
          <ElButton
            size="small"
            @click="
              deptIds = [];
              pageNum = 1;
              loadUsers();
            "
          >
            全部部门
          </ElButton>
          <span v-if="loading" class="picker__loading">加载中…</span>
        </div>
        <ElTable
          :data="rows"
          :row-key="rowKey"
          height="310"
          @selection-change="onSelectionChange"
        >
          <ElTableColumn type="selection" reserve-selection width="46" />
          <ElTableColumn prop="name" label="姓名" min-width="110" />
          <ElTableColumn prop="code" label="账号" min-width="120" />
          <ElTableColumn prop="extra" label="手机号" min-width="130" />
        </ElTable>
        <ElPagination
          v-model:current-page="pageNum"
          v-model:page-size="pageSize"
          :total="total"
          layout="total, prev, pager, next"
          :page-sizes="[10, 20, 50]"
          style="margin-top: 8px"
          @current-change="loadUsers"
          @size-change="loadUsers"
        />
        <div class="picker__selected">
          <span class="picker__title">已选 {{ checked.length }} 人</span>
          <ElEmpty
            v-if="checked.length === 0"
            description="尚未选择"
            :image-size="40"
          />
          <div v-else class="picker__tags">
            <ElTag
              v-for="item in checked"
              :key="item.id"
              closable
              size="small"
              @close="removeChecked(item.id)"
            >
              {{ item.name }}
            </ElTag>
          </div>
        </div>
      </div>
    </div>
    <template #footer>
      <ElButton @click="visible = false">取消</ElButton>
      <ElButton type="primary" @click="onConfirm">确定</ElButton>
    </template>
  </ElDialog>
</template>

<style scoped>
.picker {
  display: flex;
  gap: 12px;
  min-height: 420px;
}

.picker__left {
  width: 230px;
  padding-right: 12px;
  border-right: 1px solid var(--el-border-color-lighter);
}

.picker__right {
  flex: 1;
  min-width: 0;
}

.picker__title {
  margin-bottom: 8px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.picker__tree {
  margin-top: 10px;
  max-height: 280px;
  overflow: auto;
}

.picker__toolbar {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-bottom: 8px;
}

.picker__loading {
  margin-left: auto;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.picker__selected {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.picker__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-height: 84px;
  overflow: auto;
}
</style>
