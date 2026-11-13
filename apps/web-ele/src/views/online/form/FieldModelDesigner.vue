<script lang="ts" setup>
/**
 * 字段建模设计器（在线表单建模核心）。
 *
 * 编辑 form.fieldJson：从数据源反射表列 → 生成字段模型 → 配置每列的
 * 控件类型 / 字典 / 是否查询 / 查询方式 / 是否列表 / 是否表单 / 必填 / 排序。
 * 产出 fieldJson 供运行时引擎（OnlineRuntimeService）生成动态 SQL 与前端渲染。
 */
import type {
  FormFieldModel,
  FormFieldSchema,
  OnlineDblinkVO,
  OnlineDictVO,
  SchemaColumnVO,
  SchemaTableVO,
} from '#/api/online';

import { computed, ref, watch } from 'vue';

import {
  ElButton,
  ElCheckbox,
  ElDrawer,
  ElInput,
  ElInputNumber,
  ElMessage,
  ElOption,
  ElSelect,
} from 'element-plus';

import {
  getOnlineDblinkList,
  getOnlineDictList,
  getSchemaColumns,
  getSchemaTables,
  ONLINE_FILTER_TYPES,
  ONLINE_WIDGET_TYPES,
} from '#/api/online';

const modelValue = defineModel<boolean>({ default: false });
const props = defineProps<{
  formName: string;
  fieldJson?: string;
  masterTable?: string;
  dblinkCode?: string;
}>();
const emit = defineEmits<{ save: [fieldJson: string] }>();

const schema = ref<FormFieldSchema>({ fields: [] });
const dicts = ref<OnlineDictVO[]>([]);
const dblinks = ref<OnlineDblinkVO[]>([]);
const tables = ref<SchemaTableVO[]>([]);
const columns = ref<SchemaColumnVO[]>([]);
const selectedSource = ref('');
const selectedTable = ref('');

const fieldSummary = computed(() => {
  const f = schema.value.fields;
  return `${f.length} 字段 · ${f.filter((x) => x.isQuery).length} 查询 · ${f.filter((x) => x.isList).length} 列表`;
});

watch(() => modelValue.value, async (open) => {
  if (!open) return;
  try {
    schema.value = props.fieldJson
      ? JSON.parse(props.fieldJson) as FormFieldSchema
      : { fields: [] };
    if (!schema.value.fields) schema.value.fields = [];
    schema.value.masterTable = schema.value.masterTable || props.masterTable || '';
    schema.value.dblinkCode = schema.value.dblinkCode || props.dblinkCode || '';
  } catch {
    schema.value = { fields: [] };
  }
  selectedSource.value = schema.value.dblinkCode ?? '';
  selectedTable.value = schema.value.masterTable ?? '';
  try {
    [dicts.value, dblinks.value] = await Promise.all([getOnlineDictList(), getOnlineDblinkList()]);
  } catch {
    dicts.value = []; dblinks.value = [];
  }
  if (selectedSource.value) await loadTables();
  if (selectedSource.value && selectedTable.value) await loadColumns();
}, { immediate: true });

async function loadTables() {
  try {
    tables.value = await getSchemaTables(selectedSource.value);
  } catch { tables.value = []; }
}

async function onSourceChange() {
  schema.value.dblinkCode = selectedSource.value;
  tables.value = [];
  columns.value = [];
  await loadTables();
}

async function loadColumns() {
  if (!selectedTable.value) { columns.value = []; return; }
  try {
    columns.value = await getSchemaColumns(selectedSource.value, selectedTable.value);
  } catch { columns.value = []; }
}

async function onTableChange() {
  schema.value.masterTable = selectedTable.value;
  await loadColumns();
}

/** 从数据源表列一键生成字段模型（保留已有字段的配置）。 */
function importColumns() {
  if (!columns.value.length) { ElMessage.warning('请先选择数据源和表并读取列'); return; }
  const existing = new Map(schema.value.fields.map((f) => [f.column ?? f.fieldKey, f]));
  const imported: FormFieldModel[] = columns.value
    .filter((c) => c.columnName !== (schema.value.logicDeleteCol ?? 'deleted_flag'))
    .map((c, i) => {
      const prev = existing.get(c.columnName);
      if (prev) return prev;
      const dt = (c.dataType ?? '').toLowerCase();
      const widgetType = dt.includes('int') || dt.includes('decimal') || dt.includes('numeric')
        ? 'number' : dt.includes('date') || dt.includes('time') ? 'datetime'
        : dt.includes('text') ? 'textarea' : 'input';
      return {
        fieldKey: c.columnName,
        column: c.columnName,
        label: c.columnComment || c.columnName,
        widgetType,
        isQuery: false,
        filterType: 1,
        isList: true,
        isForm: true,
        showOrder: (i + 1) * 10,
      };
    });
  schema.value.fields = imported;
  if (!schema.value.pkColumn) {
    schema.value.pkColumn = columns.value.find((c) => c.primaryKey)?.columnName ?? 'id';
  }
  ElMessage.success(`已导入 ${imported.length} 个字段`);
}

function addField() {
  schema.value.fields.push({
    fieldKey: `field_${schema.value.fields.length + 1}`,
    column: '',
    label: '新字段',
    widgetType: 'input',
    isQuery: false,
    filterType: 1,
    isList: true,
    isForm: true,
    showOrder: (schema.value.fields.length + 1) * 10,
  });
}

function removeField(index: number) {
  schema.value.fields.splice(index, 1);
}

function onSubmit() {
  if (!schema.value.fields.length) { ElMessage.warning('请至少配置一个字段'); return; }
  // 排序
  schema.value.fields.sort((a, b) => (a.showOrder ?? 0) - (b.showOrder ?? 0));
  emit('save', JSON.stringify(schema.value, null, 2));
  modelValue.value = false;
}
</script>

<template>
  <ElDrawer v-model="modelValue" :title="`字段建模 · ${formName}`" size="92%" :close-on-click-modal="false">
    <div class="fm-layout">
      <!-- 左：数据源/表 + 主表设置 -->
      <div class="fm-side">
        <div class="fm-title">数据源与物理表</div>
        <ElSelect v-model="selectedSource" placeholder="选择数据源" clearable @change="onSourceChange">
          <ElOption v-for="d in dblinks" :key="d.code" :label="d.name" :value="d.code" />
        </ElSelect>
        <ElSelect
          v-model="selectedTable"
          placeholder="选择物理表"
          clearable
          filterable
          style="margin-top: 8px"
          @change="onTableChange"
        >
          <ElOption v-for="t in tables" :key="t.tableName" :label="`${t.tableName} ${t.tableComment ?? ''}`" :value="t.tableName" />
        </ElSelect>
        <ElButton size="small" style="margin-top: 8px; width: 100%" :disabled="!columns.length" @click="importColumns">
          从表列导入字段
        </ElButton>

        <div class="fm-title" style="margin-top: 20px">主表设置</div>
        <div class="fm-kv"><span>主表</span><b>{{ schema.masterTable || '未设置' }}</b></div>
        <div class="fm-kv"><span>主键列</span><ElInput v-model="schema.pkColumn" size="small" placeholder="id" /></div>
        <div class="fm-kv"><span>逻辑删除列</span><ElInput v-model="schema.logicDeleteCol" size="small" placeholder="deleted_flag" /></div>
        <div class="fm-kv"><span>排序列</span><ElInput v-model="schema.sortCol" size="small" placeholder="create_time" /></div>

        <div class="fm-title" style="margin-top: 20px">统计</div>
        <div class="fm-hint">{{ fieldSummary }}</div>
      </div>

      <!-- 右：字段配置表 -->
      <div class="fm-main">
        <div class="fm-main-bar">
          <span class="fm-title">字段模型（{{ schema.fields.length }}）</span>
          <ElButton type="primary" size="small" @click="addField">新增字段</ElButton>
        </div>
        <div class="fm-table-wrap">
          <table class="fm-table">
            <thead>
              <tr>
                <th>序</th><th>字段标识</th><th>列名</th><th>标题</th><th>控件</th>
                <th>字典</th><th>查询</th><th>方式</th><th>列表</th><th>表单</th><th>必填</th><th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(f, idx) in schema.fields" :key="idx">
                <td><ElInputNumber v-model="f.showOrder" :min="0" controls-position="right" style="width: 62px" /></td>
                <td><ElInput v-model="f.fieldKey" size="small" style="width: 110px" /></td>
                <td><ElInput v-model="f.column" size="small" placeholder="同标识" style="width: 110px" /></td>
                <td><ElInput v-model="f.label" size="small" style="width: 110px" /></td>
                <td>
                  <ElSelect v-model="f.widgetType" size="small" style="width: 96px">
                    <ElOption v-for="w in ONLINE_WIDGET_TYPES" :key="w.value" :label="w.label" :value="w.value" />
                  </ElSelect>
                </td>
                <td>
                  <ElSelect v-model="f.dictCode" size="small" clearable placeholder="无" style="width: 120px">
                    <ElOption v-for="d in dicts" :key="d.dictId" :label="`${d.dictName} (${d.dictCode})`" :value="d.dictCode" />
                  </ElSelect>
                </td>
                <td><ElCheckbox v-model="f.isQuery" /></td>
                <td>
                  <ElSelect v-model="f.filterType" size="small" :disabled="!f.isQuery" style="width: 84px">
                    <ElOption v-for="ft in ONLINE_FILTER_TYPES" :key="ft.value" :label="ft.label" :value="ft.value" />
                  </ElSelect>
                </td>
                <td><ElCheckbox v-model="f.isList" /></td>
                <td><ElCheckbox v-model="f.isForm" /></td>
                <td><ElCheckbox v-model="f.required" /></td>
                <td><ElButton link type="danger" size="small" @click="removeField(idx)">删</ElButton></td>
              </tr>
            </tbody>
          </table>
          <div v-if="!schema.fields.length" class="fm-empty">选择数据源表后「导入字段」，或手动「新增字段」</div>
        </div>
        <pre class="fm-json">{{ JSON.stringify(schema, null, 2) }}</pre>
      </div>
    </div>

    <template #footer>
      <ElButton @click="modelValue = false">取消</ElButton>
      <ElButton type="primary" @click="onSubmit">保存字段模型</ElButton>
    </template>
  </ElDrawer>
</template>

<style scoped>
.fm-layout { display: grid; grid-template-columns: 280px 1fr; gap: 16px; min-height: 560px; }
.fm-side, .fm-main { border: 1px solid var(--el-border-color); border-radius: 6px; padding: 14px; }
.fm-main { display: flex; flex-direction: column; min-width: 0; }
.fm-title { font-weight: 600; margin-bottom: 10px; display: block; }
.fm-main-bar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.fm-main-bar .fm-title { margin-bottom: 0; }
.fm-kv { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-size: 13px; }
.fm-kv > span { color: var(--el-text-color-secondary); width: 76px; flex-shrink: 0; }
.fm-kv > b { font-weight: 500; overflow: hidden; text-overflow: ellipsis; }
.fm-hint { font-size: 13px; color: var(--el-text-color-secondary); }
.fm-table-wrap { overflow: auto; max-height: 420px; }
.fm-table { border-collapse: collapse; font-size: 12px; white-space: nowrap; }
.fm-table th, .fm-table td { padding: 5px 6px; border-bottom: 1px solid var(--el-border-color-lighter); text-align: center; }
.fm-table th { background: var(--el-fill-color-light); position: sticky; top: 0; }
.fm-empty { color: var(--el-text-color-secondary); text-align: center; padding: 40px; }
.fm-json { font-size: 11px; max-height: 180px; overflow: auto; background: var(--el-fill-color-lighter); border-radius: 4px; padding: 10px; margin-top: 10px; }
</style>
