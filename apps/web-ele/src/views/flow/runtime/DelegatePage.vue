<script lang="ts" setup>
/** 流程委托：查看我委托出去/委托给我的代理记录，并可新增全局代理人。 */
import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { FlowDelegateVO, FlowIdentityVO, FlowTaskQuery } from '#/api/flow';

import { reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  ElButton,
  ElDialog,
  ElForm,
  ElFormItem,
  ElInputNumber,
  ElOption,
  ElSelect,
  ElTag,
} from 'element-plus';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  executeFlowAction,
  getFlowDelegatePage,
  getFlowUsers,
} from '#/api/flow';

import { withFeedback } from '../../system/shared/helpers';
import OrderDetailDrawer from './OrderDetailDrawer.vue';

const detailVisible = ref(false);
const currentOrderId = ref('');
const proxyVisible = ref(false);
const users = ref<FlowIdentityVO[]>([]);
const saving = ref(false);
const proxyForm = reactive({
  targetUserId: '',
  timeoutMinutes: undefined as number | undefined,
});

const searchSchema: VbenFormSchema[] = [
  {
    component: 'Select',
    fieldName: 'enabled',
    label: '生效状态',
    componentProps: {
      clearable: true,
      options: [
        { label: '生效中', value: 1 },
        { label: '已失效', value: 0 },
      ],
      placeholder: '全部',
    },
  },
];

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: { schema: searchSchema, submitOnChange: true },
  gridOptions: {
    columns: [
      { field: 'ownerName', title: '委托人', width: 130 },
      { field: 'agentName', title: '代理人', width: 130 },
      { field: 'delegateType', title: '委托类型', width: 120 },
      { field: 'orderTitle', title: '关联工单', minWidth: 180 },
      { field: 'startTime', title: '开始时间', width: 170 },
      { field: 'endTime', title: '结束时间', width: 170 },
      {
        field: 'enabled',
        title: '状态',
        width: 110,
        slots: { default: 'enabled' },
      },
      {
        align: 'center',
        field: 'operation',
        fixed: 'right',
        slots: { default: 'action' },
        title: '操作',
        width: 120,
      },
    ],
    height: 'auto',
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues: Partial<FlowTaskQuery>) =>
          await getFlowDelegatePage({
            enabled: formValues?.enabled,
            pageNum: page.currentPage,
            pageSize: page.pageSize,
          }),
      },
    },
    rowConfig: { keyField: 'id' },
    toolbarConfig: { custom: true, refresh: true, zoom: true },
  } as VxeTableGridOptions<FlowDelegateVO>,
});

async function openProxy() {
  proxyForm.targetUserId = '';
  proxyForm.timeoutMinutes = undefined;
  try {
    users.value = await getFlowUsers();
    proxyVisible.value = true;
  } catch (error) {
    console.error('[flow] load users failed', error);
    users.value = [];
  }
}

async function onSubmitProxy() {
  if (!proxyForm.targetUserId) return;
  saving.value = true;
  try {
    const ok = await withFeedback(
      () =>
        executeFlowAction({
          action: 'PROXY',
          targetUserId: proxyForm.targetUserId,
          timeoutMinutes: proxyForm.timeoutMinutes,
        }),
      '代理人已设置',
    );
    if (ok) {
      proxyVisible.value = false;
      gridApi.query();
    }
  } finally {
    saving.value = false;
  }
}

function openDetail(row: FlowDelegateVO) {
  currentOrderId.value = row.workOrderId ?? '';
  detailVisible.value = true;
}

function refresh() {
  gridApi.query();
}
</script>

<template>
  <Page auto-content-height>
    <Grid>
      <template #enabled="{ row }">
        <ElTag :type="row.enabled === 1 ? 'success' : 'info'" size="small">
          {{ row.enabled === 1 ? '生效中' : '已失效' }}
        </ElTag>
      </template>
      <template #action="{ row }">
        <ElButton v-if="row.workOrderId" link @click="openDetail(row)">
          详情
        </ElButton>
      </template>
    </Grid>

    <template #extra>
      <ElButton type="primary" @click="openProxy">新增代理</ElButton>
    </template>

    <ElDialog v-model="proxyVisible" title="新增代理人" width="480px">
      <ElForm label-width="100px">
        <ElFormItem label="代理人" required>
          <ElSelect
            v-model="proxyForm.targetUserId"
            filterable
            placeholder="选择用户"
            style="width: 100%"
          >
            <ElOption
              v-for="item in users"
              :key="item.id"
              :label="item.name"
              :value="item.id"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="有效时长">
          <ElInputNumber
            v-model="proxyForm.timeoutMinutes"
            :min="1"
            placeholder="留空表示长期有效"
          />
          <span class="hint">分钟，留空为长期有效</span>
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="proxyVisible = false">取消</ElButton>
        <ElButton
          type="primary"
          :loading="saving"
          :disabled="!proxyForm.targetUserId"
          @click="onSubmitProxy"
        >
          确定
        </ElButton>
      </template>
    </ElDialog>

    <OrderDetailDrawer
      v-model="detailVisible"
      :work-order-id="currentOrderId"
      @changed="refresh"
    />
  </Page>
</template>

<style scoped>
.hint {
  margin-left: 10px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
</style>
