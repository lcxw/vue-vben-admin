<script lang="ts" setup>
/** 字典项二级维护：某个字典的项列表（增/删/排序/值/文本）。 */
import { ref, watch } from 'vue';

import {
  ElButton,
  ElDrawer,
  ElInput,
  ElInputNumber,
  ElMessage,
} from 'element-plus';

import {
  deleteDictItem,
  getDictItems,
  saveDictItem,
} from '#/api/online';
import type { OnlineDictItemVO } from '#/api/online';
import { confirmAction, withFeedback } from '../../system/shared/helpers';

const modelValue = defineModel<boolean>({ default: false });
const props = defineProps<{ dictCode: string; dictName: string }>();

const loading = ref(false);
const items = ref<OnlineDictItemVO[]>([]);

async function load() {
  if (!props.dictCode) return;
  loading.value = true;
  try {
    items.value = await getDictItems(props.dictCode);
  } catch {
    items.value = [];
  } finally {
    loading.value = false;
  }
}

function addItem() {
  items.value.push({
    dictCode: props.dictCode,
    itemId: `new-${Date.now()}-${Math.random()}`,
    itemLabel: '',
    itemValue: '',
    sortNo: items.value.length + 1,
    status: 0,
  } as OnlineDictItemVO);
}

async function saveItem(item: OnlineDictItemVO) {
  if (!item.itemLabel?.trim() || !String(item.itemValue ?? '').trim()) {
    ElMessage.warning('请填写项文本和值');
    return;
  }
  const ok = await withFeedback(() => saveDictItem({
    dictCode: props.dictCode,
    itemId: String(item.itemId).startsWith('new-') ? undefined : item.itemId,
    itemLabel: item.itemLabel,
    itemValue: String(item.itemValue),
    parentValue: item.parentValue,
    sortNo: item.sortNo,
    status: item.status,
  }), '已保存');
  if (ok) await load();
}

async function removeItem(item: OnlineDictItemVO) {
  if (String(item.itemId).startsWith('new-')) {
    items.value = items.value.filter((i) => i !== item);
    return;
  }
  if (!(await confirmAction(`确定删除字典项「${item.itemLabel}」？`))) return;
  const ok = await withFeedback(() => deleteDictItem(item.itemId), '已删除');
  if (ok) await load();
}

watch(() => modelValue.value, (open) => { if (open) void load(); }, { immediate: true });
</script>

<template>
  <ElDrawer v-model="modelValue" :title="`字典项 · ${dictName} (${dictCode})`" size="640px">
    <div class="dict-items">
      <div class="di-toolbar">
        <span class="di-hint">静态字典的选项在此维护；运行时渲染器与数据表字典同源。</span>
        <ElButton type="primary" size="small" @click="addItem">添加项</ElButton>
      </div>
      <div class="di-head">
        <span>排序</span><span>显示文本</span><span>值</span><span>父值(可选)</span><span>操作</span>
      </div>
      <div v-for="item in items" :key="item.itemId" class="di-row">
        <ElInputNumber v-model="item.sortNo" :min="0" controls-position="right" style="width: 70px" />
        <ElInput v-model="item.itemLabel" placeholder="显示文本" />
        <ElInput v-model="item.itemValue" placeholder="值" />
        <ElInput v-model="item.parentValue" placeholder="父值" />
        <span class="di-actions">
          <ElButton link type="primary" size="small" @click="saveItem(item)">保存</ElButton>
          <ElButton link type="danger" size="small" @click="removeItem(item)">删</ElButton>
        </span>
      </div>
      <div v-if="!items.length" class="di-empty">暂无字典项，点击「添加项」开始</div>
    </div>
  </ElDrawer>
</template>

<style scoped>
.dict-items { min-height: 300px; }
.di-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
.di-hint { font-size: 12px; color: var(--el-text-color-secondary); }
.di-head { display: grid; grid-template-columns: 80px 1fr 1fr 1fr 110px; gap: 8px; font-size: 12px; color: var(--el-text-color-secondary); padding: 0 0 8px; border-bottom: 1px solid var(--el-border-color); }
.di-row { display: grid; grid-template-columns: 80px 1fr 1fr 1fr 110px; gap: 8px; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--el-border-color-lighter); }
.di-actions { display: flex; gap: 2px; }
.di-empty { color: var(--el-text-color-secondary); text-align: center; padding: 40px; }
</style>
