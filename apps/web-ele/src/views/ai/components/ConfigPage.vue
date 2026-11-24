<script setup lang="ts">
import { onMounted, ref } from 'vue';

// 本应用没有全局 app.use(ElementPlus)，模板中使用的组件必须在 <script setup> 里显式导入，
// 否则会被当成普通 DOM 元素渲染，scoped 插槽会被无参调用（Cannot destructure 'row' of undefined）。
import {
  ElButton,
  ElDialog,
  ElForm,
  ElFormItem,
  ElInput,
  ElMessage,
  ElMessageBox,
  ElOption,
  ElSelect,
  ElTable,
  ElTableColumn,
  ElTag,
} from 'element-plus';

interface Column {
  prop: string;
  label: string;
}

interface Field {
  prop: string;
  label: string;
  type?: 'select' | 'text' | 'textarea';
  options?: { label: string; value: string }[];
}

interface ConfigApi {
  list: () => Promise<any[]>;
  add: (entity: any) => Promise<any>;
  update: (entity: any) => Promise<any>;
  remove: (id: string) => Promise<void>;
  toggle?: (id: string, enabled: number) => Promise<void>;
  extra?: { label: string; call: (row: any) => Promise<any> }[];
}

const props = defineProps<{
  title: string;
  api: ConfigApi;
  columns: Column[];
  fields: Field[];
  showStatus?: boolean;
}>();

const showStatus = props.showStatus !== false;

const rows = ref<any[]>([]);
const loading = ref(false);
const dialogVisible = ref(false);
const resultDialogVisible = ref(false);
const resultText = ref('');
const editing = ref(false);
// 用 ref 整体替换对象而不是 delete 动态 key：模板里 form 会自动解包，
// 行为与 reactive 一致，但避免了 no-dynamic-delete 与 V8 字典模式退化。
const form = ref<Record<string, any>>({});

async function load() {
  loading.value = true;
  try {
    rows.value = await props.api.list();
  } finally {
    loading.value = false;
  }
}

function openAdd() {
  editing.value = false;
  form.value = Object.fromEntries(
    props.fields.map((field) => [
      field.prop,
      field.type === 'select' ? (field.options?.[0]?.value ?? '') : '',
    ]),
  );
  dialogVisible.value = true;
}

function openEdit(row: any) {
  editing.value = true;
  form.value = { ...row };
  dialogVisible.value = true;
}

async function save() {
  try {
    await (editing.value
      ? props.api.update(form.value)
      : props.api.add(form.value));
    ElMessage.success('保存成功');
    dialogVisible.value = false;
    await load();
  } catch (error: any) {
    ElMessage.error(error?.message || '保存失败');
  }
}

async function removeRow(row: any) {
  await ElMessageBox.confirm(
    `确认删除「${row.name || row.title || row.code}」？`,
    '提示',
    {
      type: 'warning',
    },
  );
  await props.api.remove(row.id);
  ElMessage.success('已删除');
  await load();
}

async function toggleRow(row: any) {
  if (!props.api.toggle) {
    return;
  }
  await props.api.toggle(row.id, row.enabled ? 0 : 1);
  await load();
}

async function extraAction(
  action: { label: string; call: (row: any) => Promise<any> },
  row: any,
) {
  try {
    const result = await action.call(row);
    if (Array.isArray(result)) {
      resultText.value = result
        .map((item) =>
          typeof item === 'string' ? item : JSON.stringify(item, null, 2),
        )
        .join('\n\n');
      resultDialogVisible.value = true;
    } else {
      ElMessage.success(typeof result === 'string' ? result : '操作成功');
    }
    await load();
  } catch (error: any) {
    ElMessage.error(error?.message || '操作失败');
  }
}

onMounted(load);
</script>

<template>
  <div class="ai-config-page">
    <div class="toolbar">
      <span class="title">{{ title }}</span>
      <ElButton type="primary" size="small" @click="openAdd">新增</ElButton>
      <ElButton size="small" @click="load">刷新</ElButton>
    </div>

    <ElTable
      :data="rows"
      v-loading="loading"
      border
      size="small"
      max-height="620"
    >
      <ElTableColumn
        v-for="column in columns"
        :key="column.prop"
        :prop="column.prop"
        :label="column.label"
        show-overflow-tooltip
      />
      <ElTableColumn v-if="showStatus" label="状态" width="90">
        <template #default="{ row }">
          <ElTag :type="row.enabled === 0 ? 'info' : 'success'" size="small">
            {{ row.enabled === 0 ? '停用' : '启用' }}
          </ElTag>
        </template>
      </ElTableColumn>
      <ElTableColumn label="操作" width="310" fixed="right">
        <template #default="{ row }">
          <ElButton link type="primary" size="small" @click="openEdit(row)">
            编辑
          </ElButton>
          <ElButton v-if="api.toggle" link size="small" @click="toggleRow(row)">
            {{ row.enabled === 0 ? '启用' : '停用' }}
          </ElButton>
          <ElButton
            v-for="action in api.extra || []"
            :key="action.label"
            link
            type="warning"
            size="small"
            @click="extraAction(action, row)"
          >
            {{ action.label }}
          </ElButton>
          <ElButton link type="danger" size="small" @click="removeRow(row)">
            删除
          </ElButton>
        </template>
      </ElTableColumn>
    </ElTable>

    <ElDialog v-model="resultDialogVisible" title="执行结果" width="760px">
      <pre class="result-content">{{ resultText || '无工具' }}</pre>
      <template #footer>
        <ElButton @click="resultDialogVisible = false">关闭</ElButton>
      </template>
    </ElDialog>

    <ElDialog
      v-model="dialogVisible"
      :title="`${editing ? '编辑' : '新增'}${title}`"
      width="620px"
    >
      <ElForm :model="form" label-width="110px">
        <ElFormItem
          v-for="field in fields"
          :key="field.prop"
          :label="field.label"
        >
          <ElInput
            v-if="field.type === 'textarea'"
            v-model="form[field.prop]"
            type="textarea"
            :rows="6"
          />
          <ElSelect
            v-else-if="field.type === 'select'"
            v-model="form[field.prop]"
            style="width: 100%"
          >
            <ElOption
              v-for="option in field.options || []"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </ElSelect>
          <ElInput v-else v-model="form[field.prop]" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="dialogVisible = false">取消</ElButton>
        <ElButton type="primary" @click="save">确定</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<style scoped>
.ai-config-page {
  padding: 12px;
}

.toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
}

.result-content {
  max-height: 480px;
  margin: 0;
  overflow: auto;
  font-size: 12px;
  word-break: break-word;
  white-space: pre-wrap;
}

.title {
  margin-right: auto;
  font-size: 16px;
  font-weight: 600;
}
</style>
