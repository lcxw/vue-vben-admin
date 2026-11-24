<script setup lang="ts">
import type {
  AiKnowledgeBase,
  AiKnowledgeDoc,
  AiKnowledgeHit,
  AiModelConfig,
} from '#/api/ai';

import { onMounted, ref } from 'vue';

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

import { aiKnowledgeApi, aiModelApi } from '#/api/ai';

const bases = ref<AiKnowledgeBase[]>([]);
const docs = ref<AiKnowledgeDoc[]>([]);
const hits = ref<AiKnowledgeHit[]>([]);
const selected = ref<AiKnowledgeBase | null>(null);
const query = ref('');
const uploading = ref(false);
const loading = ref(false);
const dialogVisible = ref(false);
const editing = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
const embeddingOptions = ref<AiModelConfig[]>([]);
const form = ref<Partial<AiKnowledgeBase>>({});

async function loadBases() {
  loading.value = true;
  try {
    bases.value = await aiKnowledgeApi.list();
    const first = bases.value[0];
    if (!selected.value && first) {
      await selectBase(first);
    } else if (selected.value) {
      const fresh = bases.value.find(
        (item) => item.code === selected.value?.code,
      );
      selected.value = fresh ?? null;
      if (fresh) {
        await loadDocs();
      }
    }
  } finally {
    loading.value = false;
  }
}

async function selectBase(row: AiKnowledgeBase) {
  selected.value = row;
  hits.value = [];
  await loadDocs();
}

async function loadDocs() {
  if (!selected.value) {
    docs.value = [];
    return;
  }
  docs.value = await aiKnowledgeApi.docs(selected.value.code);
}

function openAdd() {
  editing.value = false;
  form.value = {
    code: '',
    name: '',
    description: '',
    embeddingModelCode: embeddingOptions.value[0]?.code ?? '',
    chunkSize: 800,
    chunkOverlap: 120,
    topK: 5,
    scoreThreshold: 0.25,
  };
  dialogVisible.value = true;
}

function openEdit(row: any) {
  editing.value = true;
  form.value = { ...row };
  dialogVisible.value = true;
}

async function save() {
  try {
    const payload = form.value as AiKnowledgeBase;
    if (editing.value) {
      await aiKnowledgeApi.update(payload);
    } else {
      await aiKnowledgeApi.add(payload);
    }
    ElMessage.success('保存成功');
    dialogVisible.value = false;
    await loadBases();
  } catch (error: any) {
    ElMessage.error(error?.message || '保存失败');
  }
}

async function toggle(row: any) {
  await aiKnowledgeApi.toggle(row.code, row.enabled === 0 ? 1 : 0);
  await loadBases();
}

async function remove(row: any) {
  await ElMessageBox.confirm(
    `确认删除知识库「${row.name}」及其向量索引？`,
    '提示',
    {
      type: 'warning',
    },
  );
  await aiKnowledgeApi.remove(row.code);
  selected.value = null;
  await loadBases();
}

async function reindex(row: any) {
  const count = await aiKnowledgeApi.reindex(row.code);
  ElMessage.success(`已重建 ${count} 个分块`);
  await loadDocs();
}

async function pickFile() {
  fileInput.value?.click();
}

async function uploadFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file || !selected.value) {
    return;
  }
  uploading.value = true;
  try {
    const doc = await aiKnowledgeApi.upload(selected.value.code, file);
    if (doc.status === 'INDEXED') {
      ElMessage.success(`已索引 ${doc.chunkCount} 个分块`);
    } else {
      ElMessage.warning(`索引失败：${doc.errorMsg ?? '未知原因'}`);
    }
    await loadDocs();
  } catch (error: any) {
    ElMessage.error(error?.message || '上传失败');
  } finally {
    uploading.value = false;
    input.value = '';
  }
}

async function removeDoc(row: any) {
  await ElMessageBox.confirm(`确认删除文档「${row.fileName}」？`, '提示', {
    type: 'warning',
  });
  await aiKnowledgeApi.removeDoc(row.id!);
  await loadDocs();
}

async function search() {
  if (!selected.value || !query.value.trim()) {
    return;
  }
  hits.value = await aiKnowledgeApi.search(selected.value.code, query.value);
}

onMounted(async () => {
  const models = await aiModelApi.list();
  embeddingOptions.value = models.filter(
    (item) =>
      item.provider === 'OPENAI_EMBEDDING' || item.provider === 'LOCAL_HASH',
  );
  await loadBases();
});
</script>

<template>
  <div class="kb-page">
    <div class="kb-header">
      <span class="title">知识库管理</span>
      <ElButton type="primary" size="small" @click="openAdd">
新增知识库
</ElButton>
      <ElButton size="small" @click="loadBases">刷新</ElButton>
    </div>

    <ElTable
      :data="bases"
      v-loading="loading"
      border
      size="small"
      max-height="260"
      highlight-current-row
      @current-change="(row: any) => row && selectBase(row)"
    >
      <ElTableColumn prop="code" label="编码" />
      <ElTableColumn prop="name" label="名称" />
      <ElTableColumn prop="embeddingModelCode" label="Embedding 模型" />
      <ElTableColumn prop="vectorDim" label="维度" width="80" />
      <ElTableColumn label="状态" width="90">
        <template #default="{ row }">
          <ElTag :type="row.enabled === 0 ? 'info' : 'success'" size="small">
            {{ row.enabled === 0 ? '停用' : '启用' }}
          </ElTag>
        </template>
      </ElTableColumn>
      <ElTableColumn label="操作" width="240" fixed="right">
        <template #default="{ row }">
          <ElButton link type="primary" size="small" @click.stop="openEdit(row)">
编辑
</ElButton>
          <ElButton link size="small" @click.stop="toggle(row)">
            {{ row.enabled === 0 ? '启用' : '停用' }}
          </ElButton>
          <ElButton link type="warning" size="small" @click.stop="reindex(row)">
重建索引
</ElButton>
          <ElButton link type="danger" size="small" @click.stop="remove(row)">
删除
</ElButton>
        </template>
      </ElTableColumn>
    </ElTable>

    <div class="kb-section" v-if="selected">
      <div class="kb-subheader">
        <span>文档 · {{ selected.name }}</span>
        <ElButton
          type="primary"
          size="small"
          :loading="uploading"
          @click="pickFile"
        >
          上传文档
        </ElButton>
        <input
          ref="fileInput"
          type="file"
          accept=".txt,.md,.csv,.json,.xml,.docx"
          hidden
          @change="uploadFile"
        />
      </div>
      <ElTable :data="docs" border size="small" max-height="240">
        <ElTableColumn prop="fileName" label="文件名" />
        <ElTableColumn prop="fileType" label="类型" width="90" />
        <ElTableColumn prop="chunkCount" label="分块" width="80" />
        <ElTableColumn prop="status" label="状态" width="100" />
        <ElTableColumn prop="errorMsg" label="错误" show-overflow-tooltip />
        <ElTableColumn label="操作" width="90" fixed="right">
          <template #default="{ row }">
            <ElButton link type="danger" size="small" @click="removeDoc(row)">
删除
</ElButton>
          </template>
        </ElTableColumn>
      </ElTable>

      <div class="kb-search">
        <ElInput
          v-model="query"
          placeholder="输入问题，验证检索效果"
          @keyup.enter="search"
        />
        <ElButton type="primary" size="small" @click="search">
检索测试
</ElButton>
      </div>
      <div v-for="hit in hits" :key="hit.docId + hit.content" class="kb-hit">
        <div class="kb-hit-title">
          {{ hit.fileName }} · 距离 {{ hit.score.toFixed(4) }}
        </div>
        <div class="kb-hit-content">{{ hit.content }}</div>
      </div>
    </div>

    <ElDialog
      v-model="dialogVisible"
      :title="`${editing ? '编辑' : '新增'}知识库`"
      width="600px"
    >
      <ElForm :model="form" label-width="130px">
        <ElFormItem label="编码"><ElInput v-model="form.code" /></ElFormItem>
        <ElFormItem label="名称"><ElInput v-model="form.name" /></ElFormItem>
        <ElFormItem label="说明">
<ElInput v-model="form.description" />
</ElFormItem>
        <ElFormItem label="Embedding 模型">
          <ElSelect v-model="form.embeddingModelCode" style="width: 100%">
            <ElOption
              v-for="model in embeddingOptions"
              :key="model.code"
              :label="`${model.name} (${model.code})`"
              :value="model.code"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="分块大小">
<ElInput v-model.number="form.chunkSize" />
</ElFormItem>
        <ElFormItem label="重叠字符">
<ElInput v-model.number="form.chunkOverlap" />
</ElFormItem>
        <ElFormItem label="检索条数">
<ElInput v-model.number="form.topK" />
</ElFormItem>
        <ElFormItem label="距离阈值">
<ElInput v-model.number="form.scoreThreshold" />
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
.kb-page {
  padding: 12px;
}

.kb-header,
.kb-subheader {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
}

.title {
  margin-right: auto;
  font-size: 16px;
  font-weight: 600;
}

.kb-section {
  margin-top: 20px;
}

.kb-subheader span {
  margin-right: auto;
  font-weight: 600;
}

.kb-search {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.kb-hit {
  padding: 8px 12px;
  margin-top: 8px;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
}

.kb-hit-title {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.kb-hit-content {
  margin-top: 4px;
  font-size: 13px;
  white-space: pre-wrap;
}
</style>
