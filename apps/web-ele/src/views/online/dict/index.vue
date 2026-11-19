<script lang="ts" setup>
/** 在线字典管理：选项 JSON 编辑。 */
import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { OnlineDictDTO, OnlineDictVO, OnlineDictOption } from '#/api/online';

import { reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  ElButton,
  ElDrawer,
  ElForm,
  ElFormItem,
  ElInput,
} from 'element-plus';

import type { FormInstance, FormRules } from 'element-plus';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  createOnlineDict,
  deleteOnlineDict,
  getOnlineDictList,
  updateOnlineDict,
} from '#/api/online';

import {
  confirmAction,
  usePermission,
  withFeedback,
} from '../../system/shared/helpers';

const { has } = usePermission();
const drawerVisible = ref(false);
const saving = ref(false);
const editing = ref<null | OnlineDictVO>(null);
const formRef = ref<FormInstance>();
const form = reactive<OnlineDictDTO>({
  dictCode: '',
  dictName: '',
  dataJson: '[\n  { "label": "选项一", "value": "1" }\n]',
  remark: '',
});
const errorText = ref('');

const rules: FormRules = {
  dictCode: [{ required: true, message: '请输入字典编码', trigger: 'blur' }],
  dictName: [{ required: true, message: '请输入字典名称', trigger: 'blur' }],
};

const searchSchema: VbenFormSchema[] = [
  { component: 'Input', fieldName: 'keyword', label: '字典编码/名称' },
];

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: { schema: searchSchema, submitOnChange: true },
  gridOptions: {
    columns: [
      { field: 'dictCode', title: '字典编码', minWidth: 180 },
      { field: 'dictName', title: '字典名称', minWidth: 180 },
      { field: 'optionCount', title: '选项数', width: 100, slots: { default: 'optionCount' } },
      { field: 'updateTime', title: '更新时间', width: 170 },
      {
        align: 'center',
        field: 'operation',
        fixed: 'right',
        slots: { default: 'action' },
        title: '操作',
        width: 180,
      },
    ],
    height: 'auto',
    proxyConfig: {
      ajax: {
        query: async ({ form }) => {
          const all = await getOnlineDictList();
          const keyword = (form.keyword ?? '').trim().toLowerCase();
          return {
            items: all.filter(
              (row) =>
                !keyword ||
                row.dictCode.toLowerCase().includes(keyword) ||
                row.dictName.toLowerCase().includes(keyword),
            ),
            total: all.length,
          };
        },
      },
    },
    rowConfig: { keyField: 'dictId' },
    toolbarConfig: { custom: true, refresh: true, zoom: true },
  } as VxeTableGridOptions<OnlineDictVO>,
});

function resetForm(row?: OnlineDictVO) {
  errorText.value = '';
  Object.assign(form, {
    dictCode: row?.dictCode ?? '',
    dictId: row?.dictId,
    dictName: row?.dictName ?? '',
    dataJson: row?.dataJson ?? '[]',
    remark: row?.remark ?? '',
  });
  formRef.value?.clearValidate();
}

function openCreate() {
  editing.value = null;
  resetForm();
  drawerVisible.value = true;
}

function openEdit(row: OnlineDictVO) {
  editing.value = row;
  resetForm(row);
  drawerVisible.value = true;
}

function optionCount(row: OnlineDictVO): number {
  try {
    const options = JSON.parse(row.dataJson ?? '[]') as OnlineDictOption[];
    return Array.isArray(options) ? options.length : 0;
  } catch {
    return 0;
  }
}

async function onSubmit() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  let parsed: OnlineDictOption[];
  try {
    parsed = JSON.parse(form.dataJson ?? '[]') as OnlineDictOption[];
    if (!Array.isArray(parsed)) throw new Error('不是数组');
  } catch {
    errorText.value = '选项必须是 JSON 数组，如 [{"label":"是","value":"Y"}]';
    return;
  }
  saving.value = true;
  try {
    const payload: OnlineDictDTO = {
      dictCode: form.dictCode,
      dictId: form.dictId,
      dictName: form.dictName,
      dataJson: JSON.stringify(parsed),
      remark: form.remark,
    };
    const ok = await withFeedback(() =>
      editing.value ? updateOnlineDict(payload) : createOnlineDict(payload),
    );
    if (ok) {
      drawerVisible.value = false;
      await gridApi.query();
    }
  } finally {
    saving.value = false;
  }
}

async function onDelete(row: OnlineDictVO) {
  if (!(await confirmAction(`确定删除字典「${row.dictName}」？`))) return;
  const ok = await withFeedback(() => deleteOnlineDict(row.dictId), '已删除');
  if (ok) await gridApi.query();
}
</script>

<template>
  <Page>
    <Grid>
      <template #optionCount="{ row }">
        {{ optionCount(row) }}
      </template>
      <template #action="{ row }">
        <ElButton v-if="has('online:dict:update')" link type="primary" size="small" @click="openEdit(row)">
          编辑
        </ElButton>
        <ElButton v-if="has('online:dict:delete')" link type="danger" size="small" @click="onDelete(row)">
          删除
        </ElButton>
      </template>
      <template #toolbar-tools>
        <ElButton v-if="has('online:dict:add')" type="primary" @click="openCreate">新增字典</ElButton>
      </template>
    </Grid>

    <ElDrawer
      v-model="drawerVisible"
      :title="editing ? '编辑字典' : '新增字典'"
      size="600px"
    >
      <ElForm ref="formRef" :model="form" :rules="rules" label-position="top">
        <ElFormItem label="字典编码" prop="dictCode">
          <ElInput v-model="form.dictCode" placeholder="如：leaveType" />
        </ElFormItem>
        <ElFormItem label="字典名称" prop="dictName">
          <ElInput v-model="form.dictName" placeholder="如：请假类型" />
        </ElFormItem>
        <ElFormItem label="选项 JSON">
          <ElInput v-model="form.dataJson" type="textarea" :rows="10" />
          <div v-if="errorText" class="text-red-500 text-xs">{{ errorText }}</div>
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
