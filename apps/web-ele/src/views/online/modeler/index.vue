<script lang="ts" setup>
/**
 * 在线表单图模型建模（物理表 + JSON 双模式）。
 * 核心：对等关系边（from/to）+ BFS/DFS 寻路，支持 A→B→C 多层级，任意表作入口。
 */
import type {
  ModelColumn,
  ModelDatasource,
  ModelEdge,
  ModelTable,
  OnlineFormVO,
} from '#/api/online';
import {
  deleteModelEdge,
  deleteModelTable,
  getModelColumns,
  getModelDatasources,
  getModelEdges,
  getModelTables,
  ONLINE_WIDGET_TYPES,
  queryModelData,
  saveModelColumn,
  saveModelDatasource,
  saveModelEdge,
  saveModelTable,
  updateFormStorage,
  getOnlineFormList,
} from '#/api/online';

import { onMounted, reactive, ref, watch } from 'vue';

import { Page } from '@vben/common-ui';

import {
  ElButton,
  ElCard,
  ElDescriptions,
  ElDescriptionsItem,
  ElForm,
  ElFormItem,
  ElInput,
  ElInputNumber,
  ElMessage,
  ElOption,
  ElSelect,
  ElSwitch,
  ElTabPane,
  ElTable,
  ElTableColumn,
  ElTabs,
  ElTag,
} from 'element-plus';

import { usePermission, withFeedback } from '../../system/shared/helpers';

const { has } = usePermission();
const activeTab = ref('ds');

const datasources = ref<ModelDatasource[]>([]);
const selectedDsId = ref('');
const tables = ref<ModelTable[]>([]);
const columns = ref<ModelColumn[]>([]);
const edges = ref<ModelEdge[]>([]);
const forms = ref<OnlineFormVO[]>([]);
const selectedFormId = ref('');
const queryResult = ref<Record<string, unknown> | null>(null);

const dsForm = reactive<ModelDatasource>({ code: '', name: '', dblinkCode: '', enabled: 1 });
const tableForm = reactive<ModelTable>({ dsId: '', tableName: '', primaryKey: 'id', idStrategy: 'ASSIGN_UUID', enabled: 1 });
const columnForm = reactive<ModelColumn>({ tableModelId: '', columnName: '', widgetType: 'input', isPk: 0, isNullable: 1, isVirtual: 0, showOrder: 0, enabled: 1 });
const edgeForm = reactive<ModelEdge>({
  fromTableId: '', fromColumn: '', toTableId: '', toColumn: '',
  cardinality: 'MANY_TO_ONE', joinType: 'LEFT', direction: 'UNDIRECTED', enabled: 1,
});
const storageForm = reactive({ formId: '', storageType: 1, anchorTableId: '', datasourceId: '', graphMaxDepth: 6 });

function onDsRowChange(row: ModelDatasource | null) {
  if (row?.dsId) selectedDsId.value = row.dsId;
}

function onTableRowChange(row: ModelTable | null) {
  if (row) void selectTable(row);
}

onMounted(async () => {
  await loadAll();
});

async function loadAll() {
  try {
    datasources.value = await getModelDatasources();
    forms.value = await getOnlineFormList();
    if (datasources.value.length > 0 && !selectedDsId.value) {
      const first = datasources.value[0];
      if (first?.dsId) selectedDsId.value = first.dsId;
    }
    if (forms.value.length > 0 && !selectedFormId.value) {
      const firstForm = forms.value[0];
      if (firstForm?.formId) selectedFormId.value = firstForm.formId;
    }
    await loadDsData();
  } catch (error) {
    console.error('[modeler] load failed', error);
  }
}

watch(selectedDsId, async () => {
  await loadDsData();
});

async function loadDsData() {
  if (!selectedDsId.value) return;
  [tables.value, edges.value] = await Promise.all([
    getModelTables(selectedDsId.value),
    getModelEdges(selectedDsId.value),
  ]);
  if (tables.value.length > 0) {
    const firstTable = tables.value[0];
    if (firstTable) await selectTable(firstTable);
  }
}

async function selectTable(table: ModelTable) {
  tableForm.tableModelId = table.tableModelId;
  if (!table.tableModelId) return;
  columns.value = await getModelColumns(table.tableModelId);
  columnForm.tableModelId = table.tableModelId;
}

async function saveDs() {
  const ok = await withFeedback(() => saveModelDatasource({ ...dsForm }));
  if (ok) { await loadAll(); dsForm.code = ''; dsForm.name = ''; }
}

async function saveTable() {
  const ok = await withFeedback(() => saveModelTable({ ...tableForm, dsId: selectedDsId.value }));
  if (ok) await loadDsData();
}

async function removeTable(id: string) {
  if (!id) return;
  const ok = await withFeedback(() => deleteModelTable(id), '已删除表模型');
  if (ok) await loadDsData();
}

async function saveColumn() {
  const ok = await withFeedback(() => saveModelColumn({ ...columnForm }));
  if (ok && columnForm.tableModelId) columns.value = await getModelColumns(columnForm.tableModelId);
}

async function saveEdge() {
  const ok = await withFeedback(() => saveModelEdge({ ...edgeForm }));
  if (ok) { await loadDsData(); edgeForm.fromColumn = ''; edgeForm.toColumn = ''; }
}

async function removeEdge(id: string) {
  if (!id) return;
  const ok = await withFeedback(() => deleteModelEdge(id), '已删除关系');
  if (ok) await loadDsData();
}

const tableLabel = (id: string) => tables.value.find((t) => t.tableModelId === id)?.tableName ?? id.slice(0, 8);

async function applyStorage() {
  const ok = await withFeedback(() => updateFormStorage({
    datasourceId: storageForm.datasourceId,
    formId: storageForm.formId,
    graphMaxDepth: storageForm.graphMaxDepth,
    storageType: storageForm.storageType,
    anchorTableId: storageForm.anchorTableId || undefined,
  }), '表单模式已切换');
  if (ok) await loadAll();
}

async function runQuery() {
  if (!selectedFormId.value) { ElMessage.warning('请先选择表单'); return; }
  queryResult.value = await queryModelData({
    filters: {},
    formId: selectedFormId.value,
    pageNum: 1,
    pageSize: 20,
  });
}
</script>

<template>
  <Page>
    <ElTabs v-model="activeTab">
      <!-- 1. 数据源 -->
      <ElTabPane label="数据源" name="ds">
        <ElCard>
          <ElForm :inline="true" label-width="90px">
            <ElFormItem label="编码"><ElInput v-model="dsForm.code" placeholder="ds_order" /></ElFormItem>
            <ElFormItem label="名称"><ElInput v-model="dsForm.name" placeholder="订单库" /></ElFormItem>
            <ElFormItem label="连接编码"><ElInput v-model="dsForm.dblinkCode" placeholder="复用 zz_online_dblink.code（可空）" /></ElFormItem>
            <ElFormItem><ElButton v-if="has('online:modeler:save')" type="primary" @click="saveDs">保存</ElButton></ElFormItem>
          </ElForm>
          <ElTable :data="datasources" border size="small" max-height="300" highlight-current-row @current-change="onDsRowChange">
            <ElTableColumn prop="code" label="编码" min-width="140" />
            <ElTableColumn prop="name" label="名称" min-width="160" />
            <ElTableColumn prop="dblinkCode" label="连接编码" min-width="140" />
            <ElTableColumn prop="enabled" label="状态" width="90">
              <template #default="{ row }"><ElTag :type="row.enabled === 1 ? 'success' : 'info'">{{ row.enabled === 1 ? '启用' : '禁用' }}</ElTag></template>
            </ElTableColumn>
          </ElTable>
        </ElCard>
      </ElTabPane>

      <!-- 2. 表模型 + 字段 -->
      <ElTabPane label="表模型" name="table">
        <ElCard>
          <p class="hint">已选数据源：{{ selectedDsId || '请先在上一步选择数据源' }}</p>
          <ElForm :inline="true" label-width="80px">
            <ElFormItem label="表名"><ElInput v-model="tableForm.tableName" placeholder="物理表名，如 orders" /></ElFormItem>
            <ElFormItem label="主键"><ElInput v-model="tableForm.primaryKey" placeholder="id" /></ElFormItem>
            <ElFormItem label="逻辑删除列"><ElInput v-model="tableForm.logicDeleteCol" placeholder="deleted_flag（可空）" /></ElFormItem>
            <ElFormItem><ElButton v-if="has('online:modeler:save')" type="primary" @click="saveTable">保存表</ElButton></ElFormItem>
          </ElForm>
          <ElTable :data="tables" border size="small" max-height="240" highlight-current-row @current-change="onTableRowChange">
            <ElTableColumn prop="tableName" label="表名" min-width="160" />
            <ElTableColumn prop="primaryKey" label="主键" width="120" />
            <ElTableColumn prop="logicDeleteCol" label="逻辑删除列" min-width="140" />
            <ElTableColumn label="操作" width="90">
              <template #default="{ row }"><ElButton v-if="has('online:modeler:save')" link type="danger" size="small" @click="removeTable(row.tableModelId)">删除</ElButton></template>
            </ElTableColumn>
          </ElTable>
          <h4 class="section-title">字段模型 · {{ tableLabel(columnForm.tableModelId) }}</h4>
          <ElForm :inline="true" label-width="70px">
            <ElFormItem label="列名"><ElInput v-model="columnForm.columnName" placeholder="order_no" /></ElFormItem>
            <ElFormItem label="标题"><ElInput v-model="columnForm.columnComment" placeholder="订单号" /></ElFormItem>
            <ElFormItem label="控件">
              <ElSelect v-model="columnForm.widgetType" style="width: 130px">
                <ElOption v-for="w in ONLINE_WIDGET_TYPES" :key="w.value" :label="w.label" :value="w.value" />
              </ElSelect>
            </ElFormItem>
            <ElFormItem label="字典"><ElInput v-model="columnForm.dictCode" placeholder="可空" /></ElFormItem>
            <ElFormItem label="主键"><ElSwitch v-model="columnForm.isPk" :active-value="1" :inactive-value="0" /></ElFormItem>
            <ElFormItem><ElButton v-if="has('online:modeler:save')" type="primary" @click="saveColumn">保存字段</ElButton></ElFormItem>
          </ElForm>
          <ElTable :data="columns" border size="small" max-height="260">
            <ElTableColumn prop="columnName" label="列名" min-width="150" />
            <ElTableColumn prop="columnComment" label="标题" min-width="150" />
            <ElTableColumn prop="dataType" label="类型" width="110" />
            <ElTableColumn prop="widgetType" label="控件" width="110" />
            <ElTableColumn prop="isPk" label="主键" width="80" />
            <ElTableColumn prop="showOrder" label="排序" width="80" />
          </ElTable>
        </ElCard>
      </ElTabPane>

      <!-- 3. 关系图（对等边） -->
      <ElTabPane label="关系图" name="edge">
        <ElCard>
          <p class="hint">对等边：任意表 A → 任意表 B，不区分主从。A→B、B→C 两条边即构成 A→B→C 多层级关联；默认无向，可反向查询。</p>
          <ElForm :inline="true" label-width="70px">
            <ElFormItem label="起点表">
              <ElSelect v-model="edgeForm.fromTableId" style="width: 150px">
                <ElOption v-for="t in tables" :key="t.tableModelId!" :label="t.tableName" :value="t.tableModelId!" />
              </ElSelect>
            </ElFormItem>
            <ElFormItem label="起点列"><ElInput v-model="edgeForm.fromColumn" placeholder="如 customer_id" /></ElFormItem>
            <ElFormItem label="终点表">
              <ElSelect v-model="edgeForm.toTableId" style="width: 150px">
                <ElOption v-for="t in tables" :key="t.tableModelId!" :label="t.tableName" :value="t.tableModelId!" />
              </ElSelect>
            </ElFormItem>
            <ElFormItem label="终点列"><ElInput v-model="edgeForm.toColumn" placeholder="如 id" /></ElFormItem>
            <ElFormItem label="基数">
              <ElSelect v-model="edgeForm.cardinality" style="width: 140px">
                <ElOption label="多对一" value="MANY_TO_ONE" /><ElOption label="一对多" value="ONE_TO_MANY" />
                <ElOption label="一对一" value="ONE_TO_ONE" /><ElOption label="多对多" value="MANY_TO_MANY" />
              </ElSelect>
            </ElFormItem>
            <ElFormItem label="方向">
              <ElSelect v-model="edgeForm.direction" style="width: 120px">
                <ElOption label="无向（双向可查）" value="UNDIRECTED" /><ElOption label="有向" value="DIRECTED" />
              </ElSelect>
            </ElFormItem>
            <ElFormItem><ElButton v-if="has('online:modeler:save')" type="primary" @click="saveEdge">添加关系</ElButton></ElFormItem>
          </ElForm>
          <ElTable :data="edges" border size="small" max-height="360">
            <ElTableColumn label="起点">
              <template #default="{ row }">{{ tableLabel(row.fromTableId) }}.{{ row.fromColumn }}</template>
            </ElTableColumn>
            <ElTableColumn label="终点">
              <template #default="{ row }">{{ tableLabel(row.toTableId) }}.{{ row.toColumn }}</template>
            </ElTableColumn>
            <ElTableColumn prop="cardinality" label="基数" width="120" />
            <ElTableColumn prop="direction" label="方向" width="130" />
            <ElTableColumn prop="alias" label="别名" width="100" />
            <ElTableColumn label="操作" width="90">
              <template #default="{ row }"><ElButton v-if="has('online:modeler:save')" link type="danger" size="small" @click="removeEdge(row.edgeId)">删除</ElButton></template>
            </ElTableColumn>
          </ElTable>
          <ElDescriptions :column="3" border class="mt-4" size="small">
            <ElDescriptionsItem label="A→B→C 示例">customer→order (customer.id = order.customer_id)</ElDescriptionsItem>
            <ElDescriptionsItem label="第二条边">order→item (order.id = item.order_id)</ElDescriptionsItem>
            <ElDescriptionsItem label="任意入口">选 customer/order/item 任一表均可查询</ElDescriptionsItem>
          </ElDescriptions>
        </ElCard>
      </ElTabPane>

      <!-- 4. 表单双模式 + 查询 -->
      <ElTabPane label="表单模式" name="mode">
        <ElCard>
          <ElForm :inline="true" label-width="90px">
            <ElFormItem label="表单">
              <ElSelect v-model="storageForm.formId" style="width: 220px">
                <ElOption v-for="f in forms" :key="f.formId" :label="f.formName" :value="f.formId" />
              </ElSelect>
            </ElFormItem>
            <ElFormItem label="存储模式">
              <ElSelect v-model="storageForm.storageType" style="width: 160px">
                <ElOption label="JSON 文档" :value="0" /><ElOption label="物理表图模型" :value="1" />
              </ElSelect>
            </ElFormItem>
            <ElFormItem label="入口表">
              <ElSelect v-model="storageForm.anchorTableId" clearable style="width: 170px">
                <ElOption v-for="t in tables" :key="t.tableModelId!" :label="t.tableName" :value="t.tableModelId!" />
              </ElSelect>
            </ElFormItem>
            <ElFormItem label="数据源">
              <ElSelect v-model="storageForm.datasourceId" clearable style="width: 150px">
                <ElOption v-for="d in datasources" :key="d.dsId!" :label="d.name" :value="d.dsId!" />
              </ElSelect>
            </ElFormItem>
            <ElFormItem label="最大深度"><ElInputNumber v-model="storageForm.graphMaxDepth" :min="1" :max="20" /></ElFormItem>
            <ElFormItem><ElButton v-if="has('online:modeler:save')" type="primary" @click="applyStorage">应用模式</ElButton></ElFormItem>
          </ElForm>
          <ElButton v-if="has('online:modeler:query')" type="primary" @click="runQuery">查询数据</ElButton>
          <pre v-if="queryResult" class="query-result">{{ JSON.stringify(queryResult, null, 2) }}</pre>
        </ElCard>
      </ElTabPane>
    </ElTabs>
  </Page>
</template>

<style scoped>
.hint {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  margin: 0 0 12px;
}
.section-title {
  margin: 16px 0 8px;
  font-size: 14px;
  font-weight: 500;
}
.mt-4 { margin-top: 16px; }
.query-result {
  margin-top: 12px;
  max-height: 420px;
  overflow: auto;
  padding: 12px;
  background: var(--el-fill-color-light);
  border-radius: 4px;
  font-size: 12px;
  white-space: pre-wrap;
}
</style>
