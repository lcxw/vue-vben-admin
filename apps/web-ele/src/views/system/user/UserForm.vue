<script lang="ts" setup>
import type { FormInstance, FormRules } from 'element-plus';

import type { DepartmentNode, SystemUser, UserFormData } from '#/api/system';

import { reactive, ref, watch } from 'vue';

import {
  ElForm,
  ElFormItem,
  ElInput,
  ElOption,
  ElSelect,
  ElSwitch,
  ElTreeSelect,
} from 'element-plus';

import {
  DATA_SCOPE_OPTIONS,
  GENDER_OPTIONS,
  USER_TYPE_OPTIONS,
} from '../shared/constants';
import { toTreeOptions } from '../shared/helpers';
import { L } from '../shared/labels';

const props = defineProps<{
  departments: DepartmentNode[];
  record?: null | SystemUser;
}>();

const formRef = ref<FormInstance>();
const departmentOptions = () =>
  toTreeOptions(props.departments, {
    labelKey: 'name',
    valueKey: 'id',
  });

function createModel(): UserFormData {
  return {
    dataScope: 0,
    departmentId: null,
    email: '',
    enabled: true,
    gender: 0,
    nickName: '',
    password: '',
    phoneNumber: '',
    realName: '',
    userType: 2,
    username: '',
  };
}

const model = reactive<UserFormData>(createModel());

const rules: FormRules = {
  username: [
    { required: true, message: '请输入登录账号', trigger: 'blur' },
    { min: 2, max: 64, message: '长度 2-64 个字符', trigger: 'blur' },
  ],
  phoneNumber: [
    { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: 'blur' },
  ],
  email: [{ type: 'email', message: '邮箱格式不正确', trigger: 'blur' }],
};

watch(
  () => props.record,
  (record) => {
    Object.assign(model, createModel());
    if (record) {
      Object.assign(model, {
        dataScope: record.dataScope ?? 0,
        departmentId: record.departmentId ?? null,
        email: record.email ?? '',
        enabled: record.enabled ?? true,
        gender: record.gender ?? 0,
        nickName: record.nickName ?? '',
        phoneNumber: record.phoneNumber ?? '',
        realName: record.realName ?? '',
        userType: record.userType ?? 2,
        username: record.username ?? '',
      });
    }
  },
  { immediate: true },
);

/**
 * 由父组件在点击「确定」时调用：先校验再返回提交体。
 * 校验失败返回 null 而不是抛异常，避免父组件出现未处理的 Promise rejection。
 */
async function submit(): Promise<null | UserFormData> {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) {
    return null;
  }
  const payload: UserFormData = { ...model };
  if (props.record) {
    // 后端 /user/system/user/edit 会强制把 username 置空，密码也不在该接口处理
    payload.userId = props.record.userId;
    delete payload.password;
    delete payload.username;
  }
  return payload;
}

defineExpose({ submit });
</script>

<template>
  <ElForm
    ref="formRef"
    :model="model"
    :rules="rules"
    label-position="right"
    label-width="100px"
  >
    <ElFormItem :label="L.user.username" prop="username">
      <ElInput
        v-model="model.username"
        :disabled="!!record"
        placeholder="登录账号，创建后不可修改"
      />
    </ElFormItem>
    <ElFormItem v-if="!record" :label="L.user.password" prop="password">
      <ElInput
        v-model="model.password"
        type="password"
        show-password
        :placeholder="L.user.passwordTip"
      />
    </ElFormItem>
    <ElFormItem :label="L.user.nickName" prop="nickName">
      <ElInput v-model="model.nickName" />
    </ElFormItem>
    <ElFormItem :label="L.user.realName" prop="realName">
      <ElInput v-model="model.realName" />
    </ElFormItem>
    <ElFormItem :label="L.user.department" prop="departmentId">
      <ElTreeSelect
        v-model="model.departmentId"
        :data="departmentOptions()"
        :props="{ children: 'children', label: 'label' }"
        check-strictly
        clearable
        filterable
        node-key="value"
        class="w-full"
        placeholder="选择所属部门"
      />
    </ElFormItem>
    <ElFormItem :label="L.user.phoneNumber" prop="phoneNumber">
      <ElInput v-model="model.phoneNumber" />
    </ElFormItem>
    <ElFormItem :label="L.user.email" prop="email">
      <ElInput v-model="model.email" />
    </ElFormItem>
    <ElFormItem :label="L.user.gender" prop="gender">
      <ElSelect v-model="model.gender" class="w-full">
        <ElOption
          v-for="item in GENDER_OPTIONS"
          :key="item.value"
          :label="item.label"
          :value="item.value"
        />
      </ElSelect>
    </ElFormItem>
    <ElFormItem :label="L.user.userType" prop="userType">
      <ElSelect v-model="model.userType" class="w-full">
        <ElOption
          v-for="item in USER_TYPE_OPTIONS"
          :key="item.value"
          :label="item.label"
          :value="item.value"
        />
      </ElSelect>
    </ElFormItem>
    <ElFormItem :label="L.user.dataScope" prop="dataScope">
      <ElSelect v-model="model.dataScope" class="w-full">
        <ElOption
          v-for="item in DATA_SCOPE_OPTIONS"
          :key="item.value"
          :label="item.label"
          :value="item.value"
        />
      </ElSelect>
    </ElFormItem>
    <ElFormItem :label="L.common.status" prop="enabled">
      <ElSwitch
        v-model="model.enabled"
        :active-text="L.common.enabled"
        :inactive-text="L.common.disabled"
      />
    </ElFormItem>
  </ElForm>
</template>
