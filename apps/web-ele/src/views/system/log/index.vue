<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { OperationLogItem } from '#/api/system';

import { ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  ElButton,
  ElDescriptions,
  ElDescriptionsItem,
  ElDialog,
} from 'element-plus';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { getOperationLogPage } from '#/api/system';

import { formatLabel, L } from '../shared/labels';
import StatusTag from '../shared/StatusTag.vue';

interface LogSearchValues {
  description?: string;
  operatorName?: string;
  success?: string;
}

const detailVisible = ref(false);
const current = ref<null | OperationLogItem>(null);

const searchSchema: VbenFormSchema[] = [
  {
    component: 'Input',
    fieldName: 'operatorName',
    label: L.monitor.operatorName,
  },
  {
    component: 'Input',
    fieldName: 'description',
    label: L.monitor.description,
  },
  {
    component: 'Select',
    fieldName: 'success',
    label: L.monitor.success,
    componentProps: {
      clearable: true,
      options: [
        { label: '成功', value: 'true' },
        { label: '失败', value: 'false' },
      ],
    },
  },
];

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: { schema: searchSchema, submitOnChange: true },
  gridOptions: {
    columns: [
      { field: 'description', title: L.monitor.description, minWidth: 200 },
      { field: 'operatorName', title: L.monitor.operatorName, width: 140 },
      { field: 'requestMethod', title: '方法', width: 90 },
      { field: 'requestUrl', title: L.monitor.requestUrl, minWidth: 220 },
      { field: 'requestIp', title: L.monitor.requestIp, width: 140 },
      { field: 'elapse', title: L.monitor.elapse, width: 110 },
      {
        field: 'success',
        slots: { default: 'success' },
        title: L.monitor.success,
        width: 100,
      },
      { field: 'operationTime', title: L.monitor.operationTime, width: 190 },
      {
        align: 'center',
        field: 'operation',
        fixed: 'right',
        slots: { default: 'action' },
        title: L.common.action,
        width: 100,
      },
    ],
    height: 'auto',
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues: LogSearchValues) =>
          await getOperationLogPage({
            description: formValues?.description,
            operatorName: formValues?.operatorName,
            pageNum: page.currentPage,
            pageSize: page.pageSize,
            success:
              formValues?.success === undefined
                ? undefined
                : formValues.success === 'true',
          }),
      },
    },
    rowConfig: { keyField: 'logId' },
    toolbarConfig: { custom: true, refresh: true, search: true, zoom: true },
  } as VxeTableGridOptions<OperationLogItem>,
});

function openDetail(row: OperationLogItem) {
  current.value = row;
  detailVisible.value = true;
}
</script>

<template>
  <Page auto-content-height>
    <ElDialog
      v-model="detailVisible"
      :title="formatLabel('{0} - 日志详情', current?.description ?? '')"
      width="820px"
      destroy-on-close
    >
      <ElDescriptions :column="2" border size="small">
        <ElDescriptionsItem :label="L.monitor.operatorName">
          {{ current?.operatorName ?? '-' }}
        </ElDescriptionsItem>
        <ElDescriptionsItem :label="L.monitor.operationTime">
          {{ current?.operationTime ?? '-' }}
        </ElDescriptionsItem>
        <ElDescriptionsItem :label="L.monitor.requestUrl" :span="2">
          {{ current?.requestMethod }} {{ current?.requestUrl }}
        </ElDescriptionsItem>
        <ElDescriptionsItem :label="L.monitor.requestIp">
          {{ current?.requestIp ?? '-' }}
        </ElDescriptionsItem>
        <ElDescriptionsItem :label="L.monitor.elapse">
          {{ current?.elapse ?? '-' }}
        </ElDescriptionsItem>
        <ElDescriptionsItem :label="L.monitor.errorMsg" :span="2">
          {{ current?.errorMsg ?? '-' }}
        </ElDescriptionsItem>
        <ElDescriptionsItem :label="L.monitor.requestArguments" :span="2">
          <pre class="max-h-40 overflow-auto whitespace-pre-wrap text-xs">{{
            current?.requestArguments ?? '-'
          }}</pre>
        </ElDescriptionsItem>
        <ElDescriptionsItem :label="L.monitor.responseResult" :span="2">
          <pre class="max-h-40 overflow-auto whitespace-pre-wrap text-xs">{{
            current?.responseResult ?? '-'
          }}</pre>
        </ElDescriptionsItem>
      </ElDescriptions>
    </ElDialog>

    <Grid :table-title="L.nav.log">
      <template #toolbar-tools>
        <ElButton size="small" @click="gridApi.query()">
          {{ L.common.refresh }}
        </ElButton>
      </template>
      <template #success="{ row }">
        <StatusTag :value="row.success" />
      </template>
      <template #action="{ row }">
        <ElButton link type="primary" size="small" @click="openDetail(row)">
          {{ L.common.detail }}
        </ElButton>
      </template>
    </Grid>
  </Page>
</template>
