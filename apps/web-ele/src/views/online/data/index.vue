<script lang="ts" setup>
/** 在线表单数据：按表单筛选已填报的数据，查看详情 / 删除。 */
import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { OnlineFormDataVO, OnlineFormVO } from '#/api/online';

import { onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  ElButton,
  ElDrawer,
} from 'element-plus';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteOnlineData,
  getOnlineFormList,
  getOnlineDataPage,
} from '#/api/online';

import {
  confirmAction,
  usePermission,
  withFeedback,
} from '../../system/shared/helpers';
import OnlineFormRenderer from '../form/OnlineFormRenderer.vue';

const { has } = usePermission();
const forms = ref<OnlineFormVO[]>([]);
const detailVisible = ref(false);
const detail = ref<null | OnlineFormDataVO>(null);

const searchSchema: VbenFormSchema[] = [
  {
    component: 'Select',
    componentProps: {
      options: [],
    },
    fieldName: 'formId',
    label: '表单',
  },
];

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: { schema: searchSchema, submitOnChange: true },
  gridOptions: {
    columns: [
      { field: 'formId', title: '表单 Id', minWidth: 180 },
      { field: 'businessKey', title: '业务主键', minWidth: 200 },
      { field: 'formVersion', title: '表单版本', width: 100 },
      { field: 'createBy', title: '填报人', width: 120 },
      { field: 'createTime', title: '填报时间', width: 170 },
      {
        align: 'center',
        field: 'operation',
        fixed: 'right',
        slots: { default: 'action' },
        title: '操作',
        width: 160,
      },
    ],
    height: 'auto',
    proxyConfig: {
      ajax: {
        query: async ({ form }) =>
          await getOnlineDataPage({
            formId: form.formId || undefined,
            pageNum: 1,
            pageSize: 50,
          }),
      },
    },
    rowConfig: { keyField: 'dataId' },
    toolbarConfig: { custom: true, refresh: true, zoom: true },
  } as VxeTableGridOptions<OnlineFormDataVO>,
});

onMounted(async () => {
  try {
    forms.value = await getOnlineFormList();
    await gridApi.query();
  } catch {
    // 列表接口失败时保持空，由 request 拦截器统一提示
  }
});

function openDetail(row: OnlineFormDataVO) {
  detail.value = row;
  detailVisible.value = true;
}

async function onDelete(row: OnlineFormDataVO) {
  if (!(await confirmAction('确定删除该表单数据？'))) return;
  const ok = await withFeedback(() => deleteOnlineData(row.dataId), '已删除');
  if (ok) await gridApi.query();
}

function detailRender() {
  if (!detail.value) return null;
  const form = forms.value.find((f) => f.formId === detail.value?.formId);
  let data: Record<string, unknown> = {};
  try {
    data = detail.value.dataJson ? JSON.parse(detail.value.dataJson) : {};
  } catch {
    data = {};
  }
  return {
    data,
    formId: detail.value.formId,
    formName: form?.formName ?? '',
    readOnly: true,
    schema: form?.widgetJson ? JSON.parse(form.widgetJson) : { widgets: [] },
  };
}
</script>

<template>
  <Page>
    <Grid>
      <template #action="{ row }">
        <ElButton link type="primary" size="small" @click="openDetail(row)">详情</ElButton>
        <ElButton
          v-if="has('online:data:delete')"
          link
          type="danger"
          size="small"
          @click="onDelete(row)"
        >
          删除
        </ElButton>
      </template>
    </Grid>
    <ElDrawer v-model="detailVisible" title="表单数据详情" size="640px">
      <template v-if="detail">
        <p class="detail-meta">
          业务主键：{{ detail.businessKey || '—' }}　版本：{{ detail.formVersion ?? '—' }}
        </p>
        <OnlineFormRenderer v-if="detailVisible" :render="detailRender()" />
        <pre class="detail-json">{{ detail.dataJson }}</pre>
      </template>
    </ElDrawer>
  </Page>
</template>

<style scoped>
.detail-meta {
  margin: 0 0 12px;
  color: var(--el-text-color-secondary);
}
.detail-json {
  margin-top: 16px;
  padding: 12px;
  background: var(--el-fill-color-light);
  border-radius: 4px;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
