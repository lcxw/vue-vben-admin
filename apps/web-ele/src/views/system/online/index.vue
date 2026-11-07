<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { LoginUserItem } from '#/api/system';

import { Page } from '@vben/common-ui';

import { ElButton } from 'element-plus';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { forceLogout, getLoginUserPage } from '#/api/system';

import { confirmAction, withFeedback } from '../shared/helpers';
import { formatLabel, L } from '../shared/labels';

interface OnlineSearchValues {
  loginName?: string;
  sessionId?: string;
}

const searchSchema: VbenFormSchema[] = [
  {
    component: 'Input',
    fieldName: 'loginName',
    label: L.monitor.loginName,
  },
  {
    component: 'Input',
    fieldName: 'sessionId',
    label: L.monitor.sessionId,
  },
];

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: { schema: searchSchema, submitOnChange: true },
  gridOptions: {
    columns: [
      { field: 'loginName', title: L.monitor.loginName, minWidth: 180 },
      { field: 'sessionId', title: L.monitor.sessionId, minWidth: 260 },
      { field: 'loginTime', title: L.monitor.loginTime, width: 190 },
      { field: 'expiresAt', title: L.monitor.expiresAt, width: 190 },
      {
        align: 'center',
        field: 'operation',
        fixed: 'right',
        slots: { default: 'action' },
        title: L.common.action,
        width: 130,
      },
    ],
    height: 'auto',
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues: OnlineSearchValues) =>
          await getLoginUserPage({
            loginName: formValues?.loginName,
            pageNum: page.currentPage,
            pageSize: page.pageSize,
            sessionId: formValues?.sessionId,
          }),
      },
    },
    rowConfig: { keyField: 'sessionId' },
    toolbarConfig: { custom: true, refresh: true, search: true, zoom: true },
  } as VxeTableGridOptions<LoginUserItem>,
});

async function onForceLogout(row: LoginUserItem) {
  if (!row.sessionId) {
    return;
  }
  const confirmed = await confirmAction(
    formatLabel(L.monitor.forceLogoutConfirm, row.loginName ?? row.sessionId),
    L.monitor.forceLogout,
  );
  if (!confirmed) {
    return;
  }
  const ok = await withFeedback(() => forceLogout(row.sessionId as string));
  if (ok) {
    gridApi.query();
  }
}
</script>

<template>
  <Page auto-content-height>
    <Grid :table-title="L.nav.online">
      <template #toolbar-tools>
        <ElButton size="small" @click="gridApi.query()">
          {{ L.common.refresh }}
        </ElButton>
      </template>
      <template #action="{ row }">
        <ElButton link type="danger" size="small" @click="onForceLogout(row)">
          {{ L.monitor.forceLogout }}
        </ElButton>
      </template>
    </Grid>
  </Page>
</template>
