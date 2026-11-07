<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type {
  DepartmentNode,
  DeptPostNode,
  PostFormData,
  PostNode,
} from '#/api/system';

import { computed, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  ElButton,
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
  ElTreeSelect,
} from 'element-plus';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  createDeptPost,
  createPost,
  deletePost,
  getDepartmentTree,
  getDeptPostList,
  getPostList,
  toGridList,
  updatePost,
} from '#/api/system';

import { PERM } from '../shared/constants';
import FormDialog from '../shared/FormDialog.vue';
import {
  confirmAction,
  flattenTree,
  toTreeOptions,
  usePermission,
  withFeedback,
} from '../shared/helpers';
import { formatLabel, L } from '../shared/labels';
import StatusTag from '../shared/StatusTag.vue';

const { has } = usePermission();
const activeTab = ref('post');
const dialogVisible = ref(false);
const editing = ref<null | PostNode>(null);
const saving = ref(false);
const formModel = ref<PostFormData>({
  code: '',
  description: '',
  enabled: true,
  name: '',
  sortOrder: 0,
});

const departments = ref<DepartmentNode[]>([]);
const deptPosts = ref<DeptPostNode[]>([]);
const deptPostModel = ref({
  deptId: '',
  postId: '',
  postShowName: '',
});
const postList = ref<PostNode[]>([]);
const postOptions = computed(() =>
  flattenTree<PostNode>(postList.value).map((item) => ({
    label: item.name ?? '',
    value: String(item.id),
  })),
);
const deptTreeOptions = computed(() =>
  toTreeOptions(departments.value, {
    labelKey: 'name',
    valueKey: 'id',
  }),
);

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: [
      { field: 'name', title: L.post.name, minWidth: 160 },
      { field: 'code', title: L.post.code, minWidth: 160 },
      { field: 'sortOrder', title: L.post.sortOrder, width: 100 },
      {
        field: 'enabled',
        slots: { default: 'status' },
        title: L.common.status,
        width: 100,
      },
      { field: 'description', title: L.post.description, minWidth: 200 },
      {
        align: 'center',
        field: 'operation',
        fixed: 'right',
        slots: { default: 'action' },
        title: L.common.action,
        width: 160,
      },
    ],
    height: 'auto',
    pagerConfig: { enabled: false },
    proxyConfig: {
      ajax: {
        query: async () => {
          postList.value = (await getPostList({})) ?? [];
          return toGridList(postList.value);
        },
      },
    },
    rowConfig: { keyField: 'id' },
    toolbarConfig: { custom: true, refresh: true, zoom: true },
  } as VxeTableGridOptions<PostNode>,
});

async function loadExtraData() {
  try {
    const [deptTree, posts] = await Promise.all([
      getDepartmentTree(),
      getDeptPostList(),
    ]);
    departments.value = deptTree ?? [];
    deptPosts.value = posts ?? [];
  } catch (error) {
    console.error('[system/post] load extra data failed', error);
  }
}

function openCreate() {
  editing.value = null;
  formModel.value = {
    code: '',
    description: '',
    enabled: true,
    name: '',
    sortOrder: 0,
  };
  dialogVisible.value = true;
}

function openEdit(row: PostNode) {
  editing.value = row;
  formModel.value = { ...row };
  dialogVisible.value = true;
}

async function onSubmit() {
  const payload = { ...formModel.value };
  if (!payload.name || !payload.code) {
    return;
  }
  saving.value = true;
  try {
    const ok = await withFeedback(() =>
      editing.value ? updatePost(payload) : createPost(payload),
    );
    if (ok) {
      dialogVisible.value = false;
      gridApi.reload();
    }
  } finally {
    saving.value = false;
  }
}

async function onDelete(row: PostNode) {
  const confirmed = await confirmAction(
    formatLabel(L.common.deleteConfirm, row.name ?? row.id),
    L.common.delete,
  );
  if (!confirmed) {
    return;
  }
  const ok = await withFeedback(
    () => deletePost(Number(row.id)),
    L.common.deleteSuccess,
  );
  if (ok) {
    gridApi.reload();
  }
}

async function onCreateDeptPost() {
  const { deptId, postId, postShowName } = deptPostModel.value;
  if (!deptId || !postId) {
    return;
  }
  const ok = await withFeedback(() =>
    createDeptPost({ deptId, postId, postShowName }),
  );
  if (ok) {
    deptPostModel.value = { deptId: '', postId: '', postShowName: '' };
    await loadExtraData();
  }
}

loadExtraData();
</script>

<template>
  <Page auto-content-height>
    <FormDialog
      v-model="dialogVisible"
      :loading="saving"
      :title="
        editing
          ? `${L.common.edit}${L.nav.post}`
          : `${L.common.create}${L.nav.post}`
      "
      @confirm="onSubmit"
    >
      <ElForm :model="formModel" label-width="100px">
        <ElFormItem :label="L.post.name">
          <ElInput v-model="formModel.name" />
        </ElFormItem>
        <ElFormItem :label="L.post.code">
          <ElInput v-model="formModel.code" :disabled="!!editing" />
        </ElFormItem>
        <ElFormItem :label="L.post.sortOrder">
          <ElInputNumber
            v-model="formModel.sortOrder"
            :min="0"
            class="w-full"
            controls-position="right"
          />
        </ElFormItem>
        <ElFormItem :label="L.post.description">
          <ElInput v-model="formModel.description" :rows="3" type="textarea" />
        </ElFormItem>
        <ElFormItem :label="L.common.status">
          <ElSwitch v-model="formModel.enabled" />
        </ElFormItem>
      </ElForm>
    </FormDialog>

    <ElTabs v-model="activeTab" class="h-full">
      <ElTabPane :label="L.nav.post" name="post">
        <Grid :table-title="L.nav.post">
          <template #toolbar-tools>
            <ElButton
              v-if="has(PERM.post.add)"
              type="primary"
              size="small"
              @click="openCreate"
            >
              {{ L.common.add }}
            </ElButton>
            <ElButton size="small" @click="gridApi.reload()">
              {{ L.common.refresh }}
            </ElButton>
          </template>
          <template #status="{ row }">
            <StatusTag :value="row.enabled" />
          </template>
          <template #action="{ row }">
            <ElButton
              v-if="has(PERM.post.update)"
              link
              type="primary"
              size="small"
              @click="openEdit(row)"
            >
              {{ L.common.edit }}
            </ElButton>
            <ElButton
              v-if="has(PERM.post.remove)"
              link
              type="danger"
              size="small"
              @click="onDelete(row)"
            >
              {{ L.common.delete }}
            </ElButton>
          </template>
        </Grid>
      </ElTabPane>

      <ElTabPane :label="L.post.deptPost" name="deptPost">
        <div class="mb-3 flex flex-wrap items-end gap-2">
          <ElTreeSelect
            v-model="deptPostModel.deptId"
            :data="deptTreeOptions"
            :props="{ children: 'children', label: 'label' }"
            check-strictly
            clearable
            node-key="value"
            class="w-[220px]"
            placeholder="选择部门"
          />
          <ElSelect
            v-model="deptPostModel.postId"
            class="w-[180px]"
            clearable
            placeholder="选择岗位"
          >
            <ElOption
              v-for="item in postOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </ElSelect>
          <ElInput
            v-model="deptPostModel.postShowName"
            class="w-[180px]"
            :placeholder="L.post.showName"
          />
          <ElButton type="primary" @click="onCreateDeptPost">
            {{ L.common.add }}
          </ElButton>
          <ElButton @click="loadExtraData">{{ L.common.refresh }}</ElButton>
        </div>
        <ElTable :data="deptPosts" border stripe size="small" max-height="480">
          <ElTableColumn prop="deptPostId" label="ID" width="200" />
          <ElTableColumn prop="deptId" :label="L.nav.department" />
          <ElTableColumn prop="postId" :label="L.nav.post" />
          <ElTableColumn prop="postShowName" :label="L.post.showName" />
        </ElTable>
      </ElTabPane>
    </ElTabs>
  </Page>
</template>
