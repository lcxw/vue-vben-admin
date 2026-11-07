<script lang="ts" setup>
/**
 * 用户管理辅助弹窗：分配角色 / 自定义数据权限部门 / 查看详情。
 * 三种模式共用一个外壳，避免页面里塞三份几乎相同的 Dialog 代码。
 */
import type {
  DepartmentNode,
  SystemRole,
  SystemUser,
  UserDetail,
} from '#/api/system';

import { computed, nextTick, ref, watch } from 'vue';

import {
  ElButton,
  ElCheckbox,
  ElCheckboxGroup,
  ElDescriptions,
  ElDescriptionsItem,
  ElDialog,
  ElTag,
  ElTree,
} from 'element-plus';

import {
  bindUserDataDepts,
  bindUserRoles,
  getAllRoles,
  getUserDataDeptIds,
  getUserDetail,
  getUserPermissionCodes,
  getUserRoleIds,
} from '#/api/system';

import { toTreeOptions, withFeedback } from '../shared/helpers';
import { L } from '../shared/labels';

type Mode = 'dataDept' | 'detail' | 'role';

interface TreeMethods {
  getCheckedKeys: (leafOnly?: boolean) => (number | string)[];
  setCheckedKeys: (keys: (number | string)[], leafOnly?: boolean) => void;
}

const props = defineProps<{
  departments: DepartmentNode[];
  mode: Mode;
  modelValue: boolean;
  user?: null | SystemUser;
}>();

const emit = defineEmits<{
  success: [];
  'update:modelValue': [value: boolean];
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
});

const title = computed(() => {
  const suffix = props.user?.username ?? '';
  switch (props.mode) {
    case 'dataDept': {
      return `${L.user.assignDataDept} - ${suffix}`;
    }
    case 'detail': {
      return `${L.user.detailTitle} - ${suffix}`;
    }
    default: {
      return `${L.user.assignRole} - ${suffix}`;
    }
  }
});

const loading = ref(false);
const saving = ref(false);
const roles = ref<SystemRole[]>([]);
const selectedRoles = ref<string[]>([]);
const treeRef = ref<null | TreeMethods>(null);
const ownedDeptIds = ref<number[]>([]);
const detail = ref<null | UserDetail>(null);
const permissionCodes = ref<string[]>([]);

const departmentTree = computed(() =>
  toTreeOptions(props.departments, {
    labelKey: 'name',
    valueKey: 'id',
  }),
);

async function loadData() {
  const userId = props.user?.userId;
  if (!visible.value || !userId) {
    return;
  }
  loading.value = true;
  try {
    if (props.mode === 'role') {
      const [all, owned] = await Promise.all([
        getAllRoles(),
        getUserRoleIds(userId),
      ]);
      roles.value = all;
      selectedRoles.value = owned ?? [];
    } else if (props.mode === 'dataDept') {
      ownedDeptIds.value = (await getUserDataDeptIds(userId)) ?? [];
      treeRef.value?.setCheckedKeys(ownedDeptIds.value, false);
    } else {
      const [userDetail, codes] = await Promise.all([
        getUserDetail(userId),
        getUserPermissionCodes(userId),
      ]);
      detail.value = userDetail;
      permissionCodes.value = codes ?? [];
    }
  } catch (error) {
    console.error('[system/user] load assign data failed', error);
  } finally {
    loading.value = false;
  }
}

watch(
  () => [visible.value, props.mode, props.user?.userId] as const,
  async () => {
    if (!visible.value) {
      return;
    }
    roles.value = [];
    selectedRoles.value = [];
    ownedDeptIds.value = [];
    detail.value = null;
    permissionCodes.value = [];
    await loadData();
    // ElTree 在 Dialog 首次展开后才挂载，DOM 就绪后再同步一次勾选态
    if (props.mode === 'dataDept') {
      await nextTick();
      treeRef.value?.setCheckedKeys(ownedDeptIds.value, false);
    }
  },
  { immediate: true },
);

async function onSubmit() {
  const userId = props.user?.userId;
  if (!userId) {
    return;
  }
  saving.value = true;
  try {
    const ok =
      props.mode === 'role'
        ? await withFeedback(() => bindUserRoles(userId, selectedRoles.value))
        : await withFeedback(() =>
            bindUserDataDepts(
              userId,
              (treeRef.value?.getCheckedKeys(false) ?? []).map(Number),
            ),
          );
    if (ok) {
      emit('success');
      visible.value = false;
    }
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <ElDialog v-model="visible" :title="title" width="640px" destroy-on-close>
    <div v-loading="loading" class="min-h-[180px]">
      <template v-if="mode === 'role'">
        <ElCheckboxGroup v-model="selectedRoles" class="flex flex-wrap gap-3">
          <ElCheckbox
            v-for="role in roles"
            :key="role.id"
            :value="role.id"
            border
          >
            {{ role.name }}（{{ role.code }}）
          </ElCheckbox>
        </ElCheckboxGroup>
        <p v-if="roles.length === 0" class="text-sm text-gray-500">
          {{ L.common.noData }}
        </p>
      </template>

      <template v-else-if="mode === 'dataDept'">
        <ElTree
          ref="treeRef"
          :data="departmentTree"
          :props="{ children: 'children', label: 'label' }"
          check-strictly
          default-expand-all
          node-key="value"
          show-checkbox
        />
      </template>

      <template v-else>
        <ElDescriptions :column="2" border size="small">
          <ElDescriptionsItem :label="L.user.username">
            {{ detail?.username ?? '-' }}
          </ElDescriptionsItem>
          <ElDescriptionsItem :label="L.user.nickName">
            {{ detail?.nickName ?? '-' }}
          </ElDescriptionsItem>
          <ElDescriptionsItem :label="L.user.realName">
            {{ detail?.realName ?? '-' }}
          </ElDescriptionsItem>
          <ElDescriptionsItem :label="L.user.phoneNumber">
            {{ detail?.phoneNumber ?? '-' }}
          </ElDescriptionsItem>
          <ElDescriptionsItem :label="L.user.email">
            {{ detail?.email ?? '-' }}
          </ElDescriptionsItem>
          <ElDescriptionsItem :label="L.common.status">
            {{ detail?.enabled ? L.common.enabled : L.common.disabled }}
          </ElDescriptionsItem>
          <ElDescriptionsItem :label="L.user.roleIds" :span="2">
            {{ (detail?.roleIds ?? []).join(', ') || '-' }}
          </ElDescriptionsItem>
        </ElDescriptions>
        <div class="mt-4">
          <p class="mb-2 text-sm font-medium">{{ L.user.permissionCodes }}</p>
          <div class="flex flex-wrap gap-1">
            <ElTag
              v-for="code in permissionCodes"
              :key="code"
              size="small"
              type="info"
            >
              {{ code }}
            </ElTag>
            <span
              v-if="permissionCodes.length === 0"
              class="text-sm text-gray-500"
            >
              {{ L.common.noData }}
            </span>
          </div>
        </div>
      </template>
    </div>

    <template #footer>
      <ElButton @click="visible = false">
        {{ mode === 'detail' ? '关闭' : L.common.cancel }}
      </ElButton>
      <ElButton
        v-if="mode !== 'detail'"
        type="primary"
        :loading="saving"
        @click="onSubmit"
      >
        {{ L.common.save }}
      </ElButton>
    </template>
  </ElDialog>
</template>
