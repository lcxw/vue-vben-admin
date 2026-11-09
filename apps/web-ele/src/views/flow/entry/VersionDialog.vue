<script lang="ts" setup>
import type { FlowPublishVO } from '#/api/flow';

import { computed, ref, watch } from 'vue';

import {
  ElButton,
  ElDialog,
  ElMessage,
  ElTable,
  ElTableColumn,
  ElTag,
} from 'element-plus';

import {
  activateFlowPublish,
  getFlowPublishBpmn,
  getFlowPublishList,
  publishFlowEntry,
  setFlowMainVersion,
  suspendFlowPublish,
} from '#/api/flow';

import {
  confirmAction,
  usePermission,
  withFeedback,
} from '../../system/shared/helpers';
import FlowViewer from '../designer/FlowViewer.vue';
import { FLOW_PERM } from '../shared/constants';
import { FL } from '../shared/labels';

const props = defineProps<{
  entryId: string;
  entryName?: string;
  modelValue: boolean;
}>();

const emit = defineEmits<{
  changed: [];
  'update:modelValue': [value: boolean];
}>();

/** ElTable 插槽行类型 */
type TableRow = Record<string, any>;

const { has } = usePermission();
const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
});

const loading = ref(false);
const publishing = ref(false);
const rows = ref<FlowPublishVO[]>([]);
const viewerVisible = ref(false);
const viewerXml = ref('');
const viewerTitle = ref('');

async function load() {
  if (!props.entryId) return;
  loading.value = true;
  try {
    rows.value = await getFlowPublishList(props.entryId);
  } finally {
    loading.value = false;
  }
}

watch(
  () => [props.modelValue, props.entryId] as const,
  ([open]) => {
    if (open) load();
  },
  { immediate: true },
);

async function onPublish() {
  if (
    !(await confirmAction(
      '发布将基于当前设计草稿生成一个新的流程版本，确定继续吗？',
      '发布流程',
    ))
  ) {
    return;
  }
  publishing.value = true;
  try {
    const result = await publishFlowEntry(props.entryId);
    ElMessage.success(`已发布 ${result.versionName ?? '新版本'}`);
    await load();
    emit('changed');
  } catch (error) {
    console.error('[flow] publish failed', error);
  } finally {
    publishing.value = false;
  }
}

async function onSetMain(row: TableRow) {
  const ok = await withFeedback(() =>
    setFlowMainVersion(props.entryId, row.entryPublishId),
  );
  if (ok) {
    await load();
    emit('changed');
  }
}

async function onToggleActive(row: TableRow) {
  const suspend = row.activeStatus === 1;
  const ok = await withFeedback(() =>
    suspend
      ? suspendFlowPublish(row.entryPublishId)
      : activateFlowPublish(row.entryPublishId),
  );
  if (ok) await load();
}

async function onView(row: TableRow) {
  viewerXml.value = await getFlowPublishBpmn(row.entryPublishId);
  viewerTitle.value = `${props.entryName ?? '流程'} ${row.versionName ?? ''}`;
  viewerVisible.value = true;
}
</script>

<template>
  <ElDialog
    v-model="visible"
    :title="`${FL.publish.title} - ${entryName ?? ''}`"
    width="900px"
    destroy-on-close
  >
    <div class="mb-3 flex justify-between">
      <span class="text-sm text-gray-500">
        每次发布生成一个新版本；首次发布自动成为主版本。
      </span>
      <ElButton
        v-if="has(FLOW_PERM.entry.publish)"
        type="primary"
        :loading="publishing"
        @click="onPublish"
      >
        {{ FL.entry.publish }}
      </ElButton>
    </div>

    <ElTable v-loading="loading" :data="rows" border size="small">
      <ElTableColumn :label="FL.publish.version" width="100">
        <template #default="{ row }">
          <b>{{ row.versionName }}</b>
        </template>
      </ElTableColumn>
      <ElTableColumn :label="FL.common.status" width="110">
        <template #default="{ row }">
          <ElTag :type="row.activeStatus === 1 ? 'success' : 'info'">
            {{ row.activeStatusName }}
          </ElTag>
        </template>
      </ElTableColumn>
      <ElTableColumn :label="FL.publish.mainVersion" width="110">
        <template #default="{ row }">
          <ElTag v-if="row.mainVersion === 1" type="warning" effect="dark">
            主版本
          </ElTag>
          <span v-else>-</span>
        </template>
      </ElTableColumn>
      <ElTableColumn :label="FL.publish.publishTime" prop="publishTime" min-width="180" />
      <ElTableColumn label="引擎定义 Id" prop="processDefinitionId" min-width="200" show-overflow-tooltip />
      <ElTableColumn :label="FL.common.action" width="240" fixed="right">
        <template #default="{ row }">
          <ElButton link type="primary" @click="onView(row)">
            {{ FL.publish.viewBpmn }}
          </ElButton>
          <ElButton
            v-if="row.mainVersion !== 1 && has(FLOW_PERM.publish.main)"
            link
            type="primary"
            @click="onSetMain(row)"
          >
            {{ FL.publish.setMain }}
          </ElButton>
          <ElButton
            v-if="has(FLOW_PERM.publish.suspend)"
            link
            :type="row.activeStatus === 1 ? 'warning' : 'success'"
            @click="onToggleActive(row)"
          >
            {{ row.activeStatus === 1 ? FL.publish.suspend : FL.publish.activate }}
          </ElButton>
        </template>
      </ElTableColumn>
    </ElTable>

    <FlowViewer
      v-model="viewerVisible"
      :title="viewerTitle"
      :xml="viewerXml"
    />
  </ElDialog>
</template>
