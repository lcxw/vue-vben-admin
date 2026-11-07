<script lang="ts" setup>
import type {
  DictItemForm,
  DictItemNode,
  DictTypeForm,
  DictTypeNode,
} from '#/api/system';

import { computed, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  ElButton,
  ElCard,
  ElForm,
  ElFormItem,
  ElInput,
  ElInputNumber,
  ElSwitch,
  ElTable,
  ElTableColumn,
  ElTree,
} from 'element-plus';

import {
  createDictItem,
  createDictType,
  deleteDictItem,
  deleteDictType,
  getDictItemsByType,
  getDictTypeTree,
  updateDictItem,
  updateDictType,
} from '#/api/system';

import FormDialog from '../shared/FormDialog.vue';
import { confirmAction, toTreeOptions, withFeedback } from '../shared/helpers';
import { formatLabel, L } from '../shared/labels';
import StatusTag from '../shared/StatusTag.vue';

const dictTypes = ref<DictTypeNode[]>([]);
const selectedType = ref<DictTypeNode | null>(null);
const dictItems = ref<DictItemNode[]>([]);
const loadingItems = ref(false);

const typeOptions = computed(() =>
  toTreeOptions(dictTypes.value, {
    labelKey: 'name',
    valueKey: 'id',
  }),
);

const dialogMode = ref<'item' | 'type'>('type');
const dialogVisible = ref(false);
const editingType = ref<DictTypeNode | null>(null);
const editingItem = ref<DictItemNode | null>(null);
const saving = ref(false);
const typeModel = ref<DictTypeForm>({
  code: '',
  description: '',
  name: '',
  sort: 0,
  status: 1,
});
const itemModel = ref<DictItemForm>({
  code: '',
  description: '',
  name: '',
  sort: 0,
  status: 1,
  value: '',
});

async function loadTypes() {
  try {
    dictTypes.value = (await getDictTypeTree()) ?? [];
  } catch (error) {
    console.error('[system/dict] load dict types failed', error);
  }
}

async function loadItems(typeId: string) {
  loadingItems.value = true;
  try {
    dictItems.value = (await getDictItemsByType(typeId)) ?? [];
  } catch (error) {
    console.error('[system/dict] load dict items failed', error);
  } finally {
    loadingItems.value = false;
  }
}

function findTypeById(id: string): DictTypeNode | null {
  const find = (nodes: DictTypeNode[]): DictTypeNode | null => {
    for (const node of nodes) {
      if (String(node.id) === id) {
        return node;
      }
      const found = find(node.children ?? []);
      if (found) {
        return found;
      }
    }
    return null;
  };
  return find(dictTypes.value);
}

function onSelectType(data: Record<string, unknown>) {
  const id = String(data.value);
  selectedType.value = findTypeById(id);
  if (selectedType.value) {
    void loadItems(id);
  }
}

/** ElTree 的 slot data 是转换后的 TreeOption，需要按 value 反查原始 VO */
function openTypeDialogById(id: string) {
  openTypeDialog(findTypeById(id));
}

function onDeleteTypeById(id: string) {
  const target = findTypeById(id);
  if (target) {
    void onDeleteType(target);
  }
}

function openTypeDialog(record: DictTypeNode | null = null) {
  dialogMode.value = 'type';
  editingType.value = record;
  typeModel.value = record
    ? { ...record }
    : { code: '', description: '', name: '', sort: 0, status: 1 };
  dialogVisible.value = true;
}

function openItemDialog(record: any = null) {
  if (!selectedType.value) {
    return;
  }
  dialogMode.value = 'item';
  editingItem.value = record;
  itemModel.value = record
    ? { ...record }
    : {
        code: '',
        description: '',
        dictTypeId: selectedType.value.id,
        name: '',
        sort: 0,
        status: 1,
        value: '',
      };
  dialogVisible.value = true;
}

async function onSubmit() {
  if (dialogMode.value === 'type') {
    const payload = { ...typeModel.value };
    if (!payload.name || !payload.code) {
      return;
    }
    saving.value = true;
    try {
      const ok = await withFeedback(() =>
        editingType.value ? updateDictType(payload) : createDictType(payload),
      );
      if (ok) {
        dialogVisible.value = false;
        await loadTypes();
      }
    } finally {
      saving.value = false;
    }
    return;
  }

  const payload = {
    ...itemModel.value,
    dictTypeId: selectedType.value?.id,
  };
  if (!payload.name || !payload.code) {
    return;
  }
  saving.value = true;
  try {
    const ok = await withFeedback(() =>
      editingItem.value ? updateDictItem(payload) : createDictItem(payload),
    );
    if (ok) {
      dialogVisible.value = false;
      if (selectedType.value) {
        await loadItems(selectedType.value.id);
      }
    }
  } finally {
    saving.value = false;
  }
}

async function onDeleteType(row: DictTypeNode) {
  const confirmed = await confirmAction(
    formatLabel(L.common.deleteConfirm, row.name ?? row.id),
    L.common.delete,
  );
  if (!confirmed) {
    return;
  }
  const ok = await withFeedback(
    () => deleteDictType(row.id),
    L.common.deleteSuccess,
  );
  if (ok) {
    if (selectedType.value?.id === row.id) {
      selectedType.value = null;
      dictItems.value = [];
    }
    await loadTypes();
  }
}

async function onDeleteItem(row: any) {
  const confirmed = await confirmAction(
    formatLabel(L.common.deleteConfirm, row.name ?? row.id),
    L.common.delete,
  );
  if (!confirmed) {
    return;
  }
  const ok = await withFeedback(
    () => deleteDictItem(row.id),
    L.common.deleteSuccess,
  );
  if (ok && selectedType.value) {
    await loadItems(selectedType.value.id);
  }
}

loadTypes();
</script>

<template>
  <Page auto-content-height>
    <FormDialog
      v-model="dialogVisible"
      :loading="saving"
      :title="
        dialogMode === 'type'
          ? `${L.common.edit}${L.dict.type}`
          : `${L.common.edit}${L.dict.item}`
      "
      @confirm="onSubmit"
    >
      <ElForm
        v-if="dialogMode === 'type'"
        :model="typeModel"
        label-width="100px"
      >
        <ElFormItem :label="L.dict.code">
          <ElInput v-model="typeModel.code" />
        </ElFormItem>
        <ElFormItem :label="L.dict.name">
          <ElInput v-model="typeModel.name" />
        </ElFormItem>
        <ElFormItem :label="L.dict.sort">
          <ElInputNumber v-model="typeModel.sort" :min="0" class="w-full" />
        </ElFormItem>
        <ElFormItem :label="L.dict.description">
          <ElInput v-model="typeModel.description" :rows="3" type="textarea" />
        </ElFormItem>
        <ElFormItem :label="L.common.status">
          <ElSwitch
            :model-value="typeModel.status === 1"
            @update:model-value="typeModel.status = $event ? 1 : 0"
          />
        </ElFormItem>
      </ElForm>

      <ElForm v-else :model="itemModel" label-width="100px">
        <ElFormItem :label="L.dict.code">
          <ElInput v-model="itemModel.code" />
        </ElFormItem>
        <ElFormItem :label="L.dict.name">
          <ElInput v-model="itemModel.name" />
        </ElFormItem>
        <ElFormItem :label="L.dict.value">
          <ElInput v-model="itemModel.value" />
        </ElFormItem>
        <ElFormItem :label="L.dict.sort">
          <ElInputNumber v-model="itemModel.sort" :min="0" class="w-full" />
        </ElFormItem>
        <ElFormItem :label="L.dict.description">
          <ElInput v-model="itemModel.description" :rows="2" type="textarea" />
        </ElFormItem>
        <ElFormItem :label="L.common.status">
          <ElSwitch
            :model-value="itemModel.status === 1"
            @update:model-value="itemModel.status = $event ? 1 : 0"
          />
        </ElFormItem>
      </ElForm>
    </FormDialog>

    <div class="flex h-full gap-4">
      <ElCard class="w-[300px] shrink-0" shadow="never">
        <template #header>
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium">{{ L.dict.type }}</span>
            <ElButton
              link
              type="primary"
              size="small"
              @click="openTypeDialog()"
            >
              {{ L.common.add }}
            </ElButton>
          </div>
        </template>
        <ElTree
          :data="typeOptions"
          :props="{ children: 'children', label: 'label' }"
          default-expand-all
          highlight-current
          node-key="value"
          @node-click="onSelectType"
        >
          <template #default="{ data }">
            <div class="flex w-full items-center justify-between pr-2">
              <span>{{ data.label }}</span>
              <span class="flex gap-1">
                <ElButton
                  link
                  type="primary"
                  size="small"
                  @click.stop="openTypeDialogById(String(data.value))"
                >
                  {{ L.common.edit }}
                </ElButton>
                <ElButton
                  link
                  type="danger"
                  size="small"
                  @click.stop="onDeleteTypeById(String(data.value))"
                >
                  {{ L.common.delete }}
                </ElButton>
              </span>
            </div>
          </template>
        </ElTree>
      </ElCard>

      <ElCard class="min-w-0 flex-1" shadow="never">
        <template #header>
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium">
              {{ L.dict.item }} - {{ selectedType?.name ?? L.dict.selectType }}
            </span>
            <ElButton
              type="primary"
              size="small"
              :disabled="!selectedType"
              @click="openItemDialog()"
            >
              {{ L.common.add }}
            </ElButton>
          </div>
        </template>
        <ElTable
          v-loading="loadingItems"
          :data="dictItems"
          border
          stripe
          size="small"
          max-height="520"
        >
          <ElTableColumn prop="code" :label="L.dict.code" />
          <ElTableColumn prop="name" :label="L.dict.name" />
          <ElTableColumn prop="value" :label="L.dict.value" />
          <ElTableColumn prop="sort" :label="L.dict.sort" width="90" />
          <ElTableColumn :label="L.common.status" width="100">
            <template #default="{ row }">
              <StatusTag :value="row.status" />
            </template>
          </ElTableColumn>
          <ElTableColumn :label="L.common.action" width="140">
            <template #default="{ row }">
              <ElButton
                link
                type="primary"
                size="small"
                @click="openItemDialog(row)"
              >
                {{ L.common.edit }}
              </ElButton>
              <ElButton
                link
                type="danger"
                size="small"
                @click="onDeleteItem(row)"
              >
                {{ L.common.delete }}
              </ElButton>
            </template>
          </ElTableColumn>
        </ElTable>
      </ElCard>
    </div>
  </Page>
</template>
