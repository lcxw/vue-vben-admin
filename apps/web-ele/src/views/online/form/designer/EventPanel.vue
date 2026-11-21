<script lang="ts" setup>
import type { FormWidgetEvent } from '#/api/online/types';

import { computed, ref } from 'vue';

import { ElInput, ElMessage, ElSwitch } from 'element-plus';

import { runScript } from './script';
import { EVENT_CATALOG, uid } from './types';

const props = defineProps<{
  events: FormWidgetEvent[];
  kind: 'column' | 'condition' | 'form' | 'leftTree';
}>();

const catalog = computed(() => EVENT_CATALOG[props.kind] || []);
const testResult = ref('');

const contextLabel = computed(() => {
  switch (props.kind) {
    case 'column': {
      return '当前列：row（行数据）、value（单元格值）';
    }
    case 'condition': {
      return '当前条件：form（全部条件值）、value（本条件值）';
    }
    case 'form': {
      return '整张表单：rows / total（查询后）、form';
    }
    case 'leftTree': {
      return '左侧树：value（节点值）、form';
    }
    default: {
      return '';
    }
  }
});

function has(code: string) {
  return props.events.some((e) => e.eventType === code);
}

function find(code: string) {
  return props.events.find((e) => e.eventType === code);
}

function toggle(def: (typeof catalog.value)[number]) {
  const exists = find(def.code);
  if (exists) {
    props.events.splice(props.events.indexOf(exists), 1);
    return;
  }
  props.events.push({
    id: uid('evt'),
    eventType: def.code,
    name: def.label,
    enabled: true,
    script: def.example,
  });
}

function insertExample(code: string) {
  const def = catalog.value.find((item) => item.code === code);
  const event = find(code);
  if (event && def) event.script = def.example;
}

function test(code: string) {
  const event = find(code);
  if (!event?.script) {
    ElMessage.warning('请先填写脚本');
    return;
  }
  const logs: string[] = [];
  const scope: any = {
    form: { type: 'contract', status: 'locked', keyword: '测试' },
    value: props.kind === 'leftTree' ? 'east' : '测试值',
    row: { id: 1, name: '示例行' },
    rows: [{ id: 1 }],
    total: 1,
    params: {},
    setValue: (k: string, v: any) =>
      logs.push(`setValue(${k}, ${JSON.stringify(v)})`),
    reload: () => logs.push('reload()'),
    message: (text: string) => logs.push(`message(${text})`),
    openForm: (role: string, id: any) => logs.push(`openForm(${role}, ${id})`),
    console: {
      log: (...args: any[]) => logs.push(args.join(' ')),
      info: (...args: any[]) => logs.push(args.join(' ')),
      warn: (...args: any[]) => logs.push(args.join(' ')),
      error: (...args: any[]) => logs.push(args.join(' ')),
    },
  };
  const result = runScript(event.script, scope);
  testResult.value = `返回：${JSON.stringify(result)}${
    logs.length > 0 ? `\n调用：${logs.join('；')}` : ''
  }`;
  ElMessage.success('脚本执行完成，结果见下方');
}
</script>

<template>
  <div class="event-panel">
    <div class="event-head">
      <div class="event-title">事件脚本</div>
      <div class="event-sub">{{ contextLabel }}</div>
    </div>

    <div class="event-chips">
      <button
        v-for="def in catalog"
        :key="def.code"
        class="event-chip"
        :class="{ active: has(def.code) }"
        @click="toggle(def)"
      >
        <span class="chip-dot"></span>
        {{ def.label }}
      </button>
    </div>

    <div v-if="!events.length" class="event-empty">
      <p>该对象还没有配置事件。</p>
      <p>
        点击上方事件类型添加，脚本在前端受限作用域执行，可控制显隐、禁用、联动与刷新。
      </p>
    </div>

    <div
      v-for="def in catalog.filter((d) => has(d.code))"
      :key="def.code"
      class="event-card"
    >
      <div class="event-card-head">
        <div>
          <div class="event-name">{{ def.label }}</div>
          <div class="event-desc">{{ def.desc }}</div>
        </div>
        <div class="event-card-tools">
          <ElSwitch
            v-model="find(def.code)!.enabled"
            size="small"
            active-text="启用"
          />
          <button class="text-btn" @click="insertExample(def.code)">
            插入示例
          </button>
          <button class="text-btn danger" @click="toggle(def)">移除</button>
        </div>
      </div>
      <ElInput
        v-model="find(def.code)!.script"
        type="textarea"
        :rows="6"
        class="code-input"
        placeholder="支持 form / value / row / setValue / reload / message / console"
      />
      <div class="event-card-foot">
        <span>变量：form、value、row、params；方法：setValue、reload、message、openForm</span>
        <button class="test-btn" @click="test(def.code)">试运行</button>
      </div>
    </div>

    <pre v-if="testResult" class="test-result">{{ testResult }}</pre>
  </div>
</template>

<style scoped>
.event-panel {
  height: 100%;
  padding: 0 12px 24px;
  overflow: auto;
  background: #fff;
}

.event-head {
  padding: 12px 2px 10px;
  border-bottom: 1px solid #ebeef5;
}

.event-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.event-sub {
  margin-top: 3px;
  font-size: 11px;
  line-height: 16px;
  color: #909399;
}

.event-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 12px 0;
}

.event-chip {
  display: flex;
  gap: 5px;
  align-items: center;
  padding: 4px 10px;
  font-size: 12px;
  color: #606266;
  cursor: pointer;
  background: #fafafa;
  border: 1px solid #e4e7ed;
  border-radius: 14px;
}

.event-chip:hover {
  color: #409eff;
  border-color: #a0cfff;
}

.event-chip.active {
  color: #409eff;
  background: #ecf5ff;
  border-color: #409eff;
}

.chip-dot {
  width: 6px;
  height: 6px;
  background: #c0c4cc;
  border-radius: 50%;
}

.event-chip.active .chip-dot {
  background: #409eff;
}

.event-empty {
  padding: 20px 12px;
  font-size: 11px;
  line-height: 18px;
  color: #909399;
  text-align: center;
  background: #fafafa;
  border: 1px dashed #e4e7ed;
  border-radius: 4px;
}

.event-card {
  padding: 10px;
  margin-top: 10px;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 6px;
}

.event-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 8px;
}

.event-name {
  font-size: 12px;
  font-weight: 600;
  color: #303133;
}

.event-desc {
  margin-top: 2px;
  font-size: 11px;
  line-height: 16px;
  color: #909399;
}

.event-card-tools {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  justify-content: flex-end;
}

.text-btn {
  padding: 0;
  font-size: 11px;
  color: #409eff;
  cursor: pointer;
  background: none;
  border: none;
}

.text-btn.danger {
  color: #f56c6c;
}

.code-input :deep(textarea) {
  font-family: Consolas, Monaco, 'Courier New', monospace;
  font-size: 12px;
  line-height: 18px;
}

.event-card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 6px;
  font-size: 10px;
  color: #a8abb2;
}

.test-btn {
  padding: 2px 8px;
  font-size: 11px;
  color: #409eff;
  cursor: pointer;
  background: #ecf5ff;
  border: 1px solid #b3d8ff;
  border-radius: 3px;
}

.test-result {
  padding: 10px;
  margin-top: 10px;
  overflow: auto;
  font-family: Consolas, monospace;
  font-size: 11px;
  line-height: 17px;
  color: #67c23a;
  white-space: pre-wrap;
  background: #1e1e1e;
  border-radius: 4px;
}
</style>
