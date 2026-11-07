<script lang="ts" setup>
/**
 * 角色授权弹窗：分配权限点 / 分配用户。
 *
 * 权限树用 PermissionTreePanel，它会把半选父节点一并提交，
 * 保证 role_permission 全量替换后菜单树完整。
 */
import type { PermissionNode, SystemRole, SystemUser } from '#/api/system';

import { computed, ref, watch } from 'vue';

import {
  ElButton,
  ElCheckbox,
  ElCheckboxGroup,
  ElDialog,
  ElInput,
} from 'element-plus';

import {
  bindRolePermissions,
  bindRoleUsers,
  getAllUsers,
  getPermissionTree,
  getRolePermissionIds,
  getRoleUserIds,
} from '#/api/system';

import { withFeedback } from '../shared/helpers';
import { L } from '../shared/labels';
import PermissionTreePanel from '../shared/PermissionTreePanel.vue';

type Mode = 'permission' | 'user';

const props = defineProps<{
  mode: Mode;
  modelValue: boolean;
  role?: null | SystemRole;
}>();

const emit = defineEmits<{
  success: [];
  'update:modelValue': [value: boolean];
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
});

const title = computed(() =>
  props.mode === 'permission'
    ? `${L.role.assignPermission} - ${props.role?.name ?? ''}`
    : `${L.role.assignUser} - ${props.role?.name ?? ''}`,
);

const loading = ref(false);
const saving = ref(false);
const permissionNodes = ref<PermissionNode[]>([]);
const selectedPermissionIds = ref<string[]>([]);
const users = ref<SystemUser[]>([]);
const selectedUserIds = ref<string[]>([]);
const userKeyword = ref('');
const filteredUsers = computed(() => {
  if (!userKeyword.value) {
    return users.value;
  }
  const keyword = userKeyword.value.toLowerCase();
  return users.value.filter((user) =>
    `${user.username ?? ''}${user.realName ?? ''}${user.nickName ?? ''}`
      .toLowerCase()
      .includes(keyword),
  );
});

async function loadData() {
  const roleId = props.role?.id;
  if (!visible.value || !roleId) {
    return;
  }
  loading.value = true;
  try {
    if (props.mode === 'permission') {
      const [tree, ids] = await Promise.all([
        getPermissionTree(),
        getRolePermissionIds(roleId),
      ]);
      permissionNodes.value = tree ?? [];
      selectedPermissionIds.value = (ids ?? []).map(String);
    } else {
      const [all, ids] = await Promise.all([
        getAllUsers(),
        getRoleUserIds(roleId),
      ]);
      users.value = all ?? [];
      selectedUserIds.value = (ids ?? []).map(String);
    }
  } catch (error) {
    console.error('[system/role] load assign data failed', error);
  } finally {
    loading.value = false;
  }
}

watch(
  () => [visible.value, props.mode, props.role?.id] as const,
  () => {
    if (!visible.value) {
      return;
    }
    permissionNodes.value = [];
    selectedPermissionIds.value = [];
    users.value = [];
    selectedUserIds.value = [];
    void loadData();
  },
  { immediate: true },
);

async function onSubmit() {
  const roleId = props.role?.id;
  if (!roleId) {
    return;
  }
  saving.value = true;
  try {
    const ok =
      props.mode === 'permission'
        ? await withFeedback(() =>
            bindRolePermissions(roleId, selectedPermissionIds.value),
          )
        : await withFeedback(() =>
            bindRoleUsers(roleId, selectedUserIds.value),
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
    <div v-loading="loading" class="min-h-[220px]">
      <PermissionTreePanel
        v-if="mode === 'permission'"
        v-model="selectedPermissionIds"
        :nodes="permissionNodes"
      />
      <template v-else>
        <ElInput
          v-model="userKeyword"
          :placeholder="L.common.keywordPlaceholder"
          clearable
          class="mb-3"
        />
        <div class="max-h-[380px] overflow-auto">
          <ElCheckboxGroup
            v-model="selectedUserIds"
            class="flex flex-wrap gap-3"
          >
            <ElCheckbox
              v-for="user in filteredUsers"
              :key="user.userId"
              :value="user.userId"
              border
            >
              {{ user.username }}（{{ user.realName || user.nickName || '-' }}）
            </ElCheckbox>
          </ElCheckboxGroup>
          <p v-if="filteredUsers.length === 0" class="text-sm text-gray-500">
            {{ L.common.noData }}
          </p>
        </div>
      </template>
    </div>
    <template #footer>
      <ElButton @click="visible = false">{{ L.common.cancel }}</ElButton>
      <ElButton type="primary" :loading="saving" @click="onSubmit">
        {{ L.common.save }}
      </ElButton>
    </template>
  </ElDialog>
</template>
