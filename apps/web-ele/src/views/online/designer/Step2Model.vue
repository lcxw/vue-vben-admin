<script lang="ts" setup>
/** Step2 数据模型：从数据源读取表 metadata → 勾选导入（自动建表+字段） → 配置表关系。 */
import type { PageVo, SchemaTableVO, SchemaColumnVO } from '#/api/online';

import { onMounted, reactive, ref } from 'vue';

import {
  ElButton,
  ElCheckbox,
  ElMessage,
  ElOption,
  ElSelect,
  ElTag,
} from 'element-plus';

import {
  deleteWizardRelation,
  getSchemaColumns,
  getSchemaTables,
  importWizardTables,
  saveWizardRelation,
  setWizardStep,
} from '#/api/online';
import { callWithFeedback } from './helpers';

const props = defineProps<{ page: PageVo }>();
const emit = defineEmits<{ done: [page: PageVo]; back: [] }>();

const sourceTables = ref<SchemaTableVO[]>([]);
const selectedTables = ref<string[]>([]);
const loadingTables = ref(false);
const importing = ref(false);
const previewCols = ref<Record<string, SchemaColumnVO[]>>({});
const relationForm = reactive({
  fromTableId: '',
  fromColumn: '',
  toTableId: '',
  toColumn: '',
  cardinality: 'MANY_TO_ONE',
});

const dblink = ref(props.page?.dblinkCode ?? '');

onMounted(async () => {
  if (dblink.value) await loadSourceTables();
});

async function loadSourceTables() {
  if (!dblink.value) {
    ElMessage.warning('请先在基础信息中选择数据源连接');
    return;
  }
  loadingTables.value = true;
  try {
    sourceTables.value = (await getSchemaTables(dblink.value)).filter(
      (t) => !t.tableName?.startsWith('zz_') && !t.tableName?.startsWith('act_'),
    );
  } catch (e: any) {
    ElMessage.error(e?.message ?? '读取表结构失败');
    sourceTables.value = [];
  } finally {
    loadingTables.value = false;
  }
}

async function onTableCheck(tableName: string, checked?: unknown) {
  const isChecked = typeof checked === 'boolean' ? checked : !selectedTables.value.includes(tableName);
  if (isChecked) {
    if (!selectedTables.value.includes(tableName)) selectedTables.value.push(tableName);
    if (!previewCols.value[tableName]) {
      try {
        previewCols.value[tableName] = await getSchemaColumns(dblink.value, tableName);
      } catch {
        previewCols.value[tableName] = [];
      }
    }
  } else {
    selectedTables.value = selectedTables.value.filter((t) => t !== tableName);
  }
}

async function onImport() {
  if (!selectedTables.value.length) {
    ElMessage.warning('请勾选要加入页面的表');
    return;
  }
  importing.value = true;
  try {
    const page = await callWithFeedback(
      () => importWizardTables(props.page.pageId, dblink.value, selectedTables.value),
      '表与字段已导入',
    );
    if (page) emit('done', page);
  } finally {
    importing.value = false;
  }
}

async function onSaveRelation() {
  if (!relationForm.fromTableId || !relationForm.toTableId
      || !relationForm.fromColumn || !relationForm.toColumn) {
    ElMessage.warning('请选择完整的关联表与关联列');
    return;
  }
  const edge: Record<string, unknown> = {
    fromTableId: relationForm.fromTableId,
    fromColumn: relationForm.fromColumn,
    toTableId: relationForm.toTableId,
    toColumn: relationForm.toColumn,
    cardinality: relationForm.cardinality,
    edgeName: `${tableNameOf(relationForm.fromTableId)}.${relationForm.fromColumn} → ${tableNameOf(relationForm.toTableId)}.${relationForm.toColumn}`,
  };
  const page = await callWithFeedback(() => saveWizardRelation(props.page.pageId, edge), '关系已保存');
  if (page) emit('done', page);
}

async function onDeleteRelation(edgeId: string) {
  const page = await callWithFeedback(() => deleteWizardRelation(props.page.pageId, edgeId), '关系已删除');
  if (page) emit('done', page);
}

function tableNameOf(id: string): string {
  return props.page?.tables?.find((t) => t.tableModelId === id)?.tableName ?? id.slice(0, 6);
}

async function onNext() {
  if (!props.page?.tables?.length) {
    ElMessage.warning('请先在上方导入至少一张表');
    return;
  }
  const page = await callWithFeedback(
    () => setWizardStep(props.page.pageId, 1),
    '数据模型完成，进入表单设计',
  );
  if (page) emit('done', page);
}
</script>

<template>
  <div class="step-model">
    <div class="step-intro">
      <h3>第 2 步 · 数据模型</h3>
      <p>从数据源连接读取真实表结构，勾选要加入本页面的表，系统自动导入表与字段；再配置表之间的关系。</p>
    </div>

    <!-- 选表 -->
    <div class="model-block">
      <div class="block-head">
        <span class="block-title">① 选择数据源表</span>
        <span class="block-desc">{{ dblink || '未选数据源' }}</span>
        <ElButton size="small" :loading="loadingTables" @click="loadSourceTables">读取表结构</ElButton>
      </div>
      <div v-if="sourceTables.length" class="table-check-list">
        <div v-for="t in sourceTables" :key="t.tableName" class="table-check-row">
          <ElCheckbox
            :model-value="selectedTables.includes(t.tableName)"
            @update:model-value="onTableCheck(t.tableName)"
          >
            <b>{{ t.tableName }}</b>
            <span class="tbl-comment">{{ t.tableComment }}</span>
          </ElCheckbox>
          <span v-if="previewCols[t.tableName]" class="tbl-cols">
            {{ previewCols[t.tableName]?.length ?? 0 }} 列
          </span>
        </div>
      </div>
      <div v-else class="block-empty">点击「读取表结构」加载数据源中的表</div>
      <div class="block-actions">
        <ElButton type="primary" :loading="importing" :disabled="!selectedTables.length" @click="onImport">
          导入选中的表（自动建字段模型）
        </ElButton>
      </div>
    </div>

    <!-- 已导入的表 -->
    <div class="model-block">
      <div class="block-head">
        <span class="block-title">② 已导入的表与字段</span>
        <span class="block-desc">{{ page?.tables?.length ?? 0 }} 张表</span>
      </div>
      <div v-if="page?.tables?.length" class="imported-tables">
        <div v-for="t in page.tables" :key="t.tableModelId" class="imported-table">
          <div class="it-head">
            <b>{{ t.tableName }}</b>
            <ElTag v-if="t.isMaster === 1" size="small" type="primary">主表</ElTag>
            <span class="it-comment">{{ t.tableComment }}</span>
            <span class="it-pk">主键：{{ t.primaryKey }}</span>
          </div>
          <div class="it-cols">
            <ElTag v-for="c in t.columns" :key="c.columnModelId" size="small" plain>
              {{ c.columnName }}<span v-if="c.dictCode" class="col-dict">·字典 {{ c.dictCode }}</span>
            </ElTag>
          </div>
        </div>
      </div>
      <div v-else class="block-empty">尚未导入表</div>
    </div>

    <!-- 关系 -->
    <div class="model-block">
      <div class="block-head"><span class="block-title">③ 配置表关系</span></div>
      <div class="relation-form">
        <ElSelect v-model="relationForm.fromTableId" placeholder="主表" style="width: 180px">
          <ElOption v-for="t in page?.tables ?? []" :key="t.tableModelId" :label="t.tableName" :value="t.tableModelId" />
        </ElSelect>
        <ElSelect v-model="relationForm.fromColumn" placeholder="主表关联列" style="width: 150px">
          <ElOption
            v-for="c in (page?.tables?.find(t => t.tableModelId === relationForm.fromTableId)?.columns ?? [])"
            :key="c.columnModelId" :label="c.columnName" :value="c.columnName"
          />
        </ElSelect>
        <span class="rel-arrow">→</span>
        <ElSelect v-model="relationForm.toTableId" placeholder="从表" style="width: 180px">
          <ElOption v-for="t in page?.tables ?? []" :key="t.tableModelId" :label="t.tableName" :value="t.tableModelId" />
        </ElSelect>
        <ElSelect v-model="relationForm.toColumn" placeholder="从表关联列" style="width: 150px">
          <ElOption
            v-for="c in (page?.tables?.find(t => t.tableModelId === relationForm.toTableId)?.columns ?? [])"
            :key="c.columnModelId" :label="c.columnName" :value="c.columnName"
          />
        </ElSelect>
        <ElSelect v-model="relationForm.cardinality" style="width: 130px">
          <ElOption label="多对一" value="MANY_TO_ONE" />
          <ElOption label="一对多" value="ONE_TO_MANY" />
          <ElOption label="一对一" value="ONE_TO_ONE" />
        </ElSelect>
        <ElButton size="small" @click="onSaveRelation">添加关系</ElButton>
      </div>
      <div v-if="page?.relations?.length" class="relation-list">
        <div v-for="r in page.relations" :key="r.edgeId" class="relation-row">
          <span>{{ tableNameOf(r.fromTableId) }}.{{ r.fromColumn }} → {{ tableNameOf(r.toTableId) }}.{{ r.toColumn }}</span>
          <ElTag size="small" plain>{{ r.cardinality }}</ElTag>
          <ElButton link type="danger" size="small" @click="onDeleteRelation(r.edgeId)">删除</ElButton>
        </div>
      </div>
    </div>

    <div class="step-actions">
      <ElButton @click="emit('back')">上一步</ElButton>
      <ElButton type="primary" :disabled="!page?.tables?.length" @click="onNext">
        下一步：设计表单
      </ElButton>
    </div>
  </div>
</template>

<style scoped>
.step-model { max-width: 1100px; }
.step-intro h3 { margin: 0 0 6px; font-size: 17px; }
.step-intro p { margin: 0 0 18px; color: var(--el-text-color-secondary); font-size: 13px; }
.model-block { border: 1px solid var(--el-border-color-lighter); border-radius: 8px; padding: 16px; margin-bottom: 14px; }
.block-head { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.block-title { font-weight: 600; font-size: 14px; }
.block-desc { color: var(--el-text-color-secondary); font-size: 12px; flex: 1; }
.block-actions { margin-top: 12px; display: flex; justify-content: flex-end; }
.block-empty { color: var(--el-text-color-placeholder); font-size: 13px; padding: 16px; text-align: center; }
.table-check-list { max-height: 220px; overflow: auto; border: 1px solid var(--el-border-color-lighter); border-radius: 6px; padding: 8px; }
.table-check-row { display: flex; align-items: center; gap: 10px; padding: 6px 4px; }
.tbl-comment { color: var(--el-text-color-secondary); font-size: 12px; margin-left: 6px; }
.tbl-cols { margin-left: auto; font-size: 12px; color: var(--el-color-primary); }
.imported-tables { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 10px; }
.imported-table { border: 1px solid var(--el-border-color-lighter); border-radius: 6px; padding: 10px; }
.it-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
.it-comment, .it-pk { font-size: 12px; color: var(--el-text-color-secondary); }
.it-cols { display: flex; flex-wrap: wrap; gap: 4px; }
.col-dict { color: var(--el-color-success); font-size: 11px; }
.relation-form { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.rel-arrow { color: var(--el-color-primary); font-weight: 700; }
.relation-list { margin-top: 12px; border-top: 1px solid var(--el-border-color-lighter); padding-top: 8px; }
.relation-row { display: flex; align-items: center; gap: 10px; padding: 6px 4px; font-size: 13px; }
.relation-row > span:first-child { flex: 1; }
.step-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
</style>
