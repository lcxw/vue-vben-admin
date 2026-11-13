<script lang="ts" setup>
/** 在线表单工单：列表 / 状态变更 / 单号生成（可复制到流程业务主键）。 */
import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { OnlineWorkOrderVO } from '#/api/online';

import { ref } from 'vue';

import { Page } from '@vben/common-ui';

import { ElButton, ElDrawer, ElInput, ElMessage, ElTag } from 'element-plus';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  generateOrderCode,
  getOnlineOrderPage,
  updateOnlineOrderStatus,
} from '#/api/online';

import { usePermission, withFeedback } from '../../system/shared/helpers';

const { has } = usePermission();
const detailVisible = ref(false);
const detail = ref<null | OnlineWorkOrderVO>(null);
const newCode = ref('');

const searchSchema: VbenFormSchema[] = [
  { component: 'Input', fieldName: 'formId', label: '表单 Id' },
];

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: { schema: searchSchema, submitOnChange: true },
  gridOptions: {
    columns: [
      { field: 'orderCode', title: '业务单号', minWidth: 180 },
      { field: 'title', title: '标题', minWidth: 180 },
      { field: 'businessKey', title: '业务主键', minWidth: 200 },
      { field: 'status', title: '状态', width: 110, slots: { default: 'status' } },
      { field: 'createBy', title: '创建人', width: 120 },
      { field: 'createTime', title: '创建时间', width: 170 },
      {
        align: 'center',
        field: 'operation',
        fixed: 'right',
        slots: { default: 'action' },
        title: '操作',
        width: 200,
      },
    ],
    height: 'auto',
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues: Partial<{ formId: string }>) =>
          await getOnlineOrderPage({
            formId: formValues?.formId || undefined,
            pageNum: page?.currentPage ?? 1,
            pageSize: page?.pageSize ?? 50,
          }),
      },
    },
    rowConfig: { keyField: 'orderId' },
    toolbarConfig: { custom: true, refresh: true, zoom: true },
  } as VxeTableGridOptions<OnlineWorkOrderVO>,
});

async function generate() {
  const result = await generateOrderCode();
  newCode.value = result.orderCode;
  try {
    await navigator.clipboard.writeText(result.orderCode);
    ElMessage.success(`已生成并复制：${result.orderCode}`);
  } catch {
    ElMessage.success(`已生成：${result.orderCode}`);
  }
}

function openDetail(row: OnlineWorkOrderVO) {
  detail.value = row;
  detailVisible.value = true;
}

const statusText: Record<number, string> = {
  0: '草稿',
  1: '处理中',
  2: '已完成',
  3: '已驳回',
};

async function changeStatus(row: OnlineWorkOrderVO, status: number) {
  const ok = await withFeedback(
    () => updateOnlineOrderStatus({ orderCode: row.orderCode, status }),
    '状态已更新',
  );
  if (ok) gridApi.query();
}
</script>

<template>
  <Page>
    <Grid>
      <template #status="{ row }">
        <ElTag :type="row.status === 2 ? 'success' : row.status === 3 ? 'danger' : 'warning'">
          {{ statusText[Number(row.status ?? -1)] ?? '未知' }}
        </ElTag>
      </template>
      <template #action="{ row }">
        <ElButton link size="small" @click="openDetail(row)">详情</ElButton>
        <ElButton v-if="has('online:order:status') && row.status !== 2" link type="success" size="small" @click="changeStatus(row, 2)">完成</ElButton>
        <ElButton v-if="has('online:order:status') && row.status !== 3" link type="danger" size="small" @click="changeStatus(row, 3)">驳回</ElButton>
      </template>
      <template #toolbar-tools>
        <ElButton v-if="has('online:order:list')" @click="generate">生成业务单号</ElButton>
      </template>
    </Grid>
    <ElDrawer v-model="detailVisible" title="工单详情" size="480px">
      <template v-if="detail">
        <p>业务单号：{{ detail.orderCode }}</p>
        <p>业务主键：{{ detail.businessKey || '—' }}</p>
        <p>标题：{{ detail.title || '—' }}</p>
        <p>状态：{{ statusText[Number(detail.status ?? -1)] ?? '未知' }}</p>
        <p>创建人：{{ detail.createBy || '—' }}</p>
        <p>创建时间：{{ detail.createTime || '—' }}</p>
        <ElInput v-if="newCode" :model-value="newCode" readonly />
      </template>
    </ElDrawer>
  </Page>
</template>
