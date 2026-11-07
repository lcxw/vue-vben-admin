import { computed } from 'vue';

import { useAccessStore } from '@vben/stores';

import { ElMessage, ElMessageBox } from 'element-plus';

import { L, safeString } from './labels';

/** 危险操作二次确认，返回是否继续 */
export async function confirmAction(
  message: string,
  title = '操作确认',
): Promise<boolean> {
  try {
    await ElMessageBox.confirm(message, title, {
      cancelButtonText: L.common.cancel,
      confirmButtonText: L.common.confirm,
      type: 'warning',
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * 统一执行写操作。
 *
 * 失败时不重复弹错误提示：request.ts 的 errorMessageResponseInterceptor
 * 已经把后端 msg 弹出来了，这里只保留控制台记录，避免出现两次 toast。
 */
export async function withFeedback(
  action: () => Promise<unknown>,
  successText: string = L.common.operationSuccess,
): Promise<boolean> {
  try {
    await action();
    ElMessage.success(successText);
    return true;
  } catch (error) {
    console.error('[system] write operation failed', error);
    return false;
  }
}

/**
 * 按钮级权限判断。
 *
 * 权限码来自登录后 GET /permission/userCodes。后端 dml.sql 目前并未为所有
 * 模块初始化权限码（例如 department:*、permission:add 等），因此当后端没有
 * 下发任何权限码时降级为「不限制按钮」，避免整个模块不可用；
 * 一旦有权限码就严格按 模块:操作 规则判断。
 */
export function usePermission() {
  const accessStore = useAccessStore();
  const codes = computed<string[]>(() => accessStore.accessCodes ?? []);

  function has(...required: string[]): boolean {
    if (codes.value.length === 0) {
      return true;
    }
    return required.some((code) => codes.value.includes(code));
  }

  return { codes, has };
}

/**
 * 树拍平成一维数组（下拉/表格平铺视图用）。
 * 约束用 object 而非带索引签名的类型：后端 VO 在前端是 interface，
 * TS 不允许 interface 隐式满足 index signature。
 */
export function flattenTree<T extends object>(
  nodes: null | T[] | undefined,
  childrenKey = 'children',
): T[] {
  const result: T[] = [];
  const stack: T[] = [...(nodes ?? [])];
  while (stack.length > 0) {
    const node = stack.shift() as T;
    result.push(node);
    const children = (node as unknown as Record<string, unknown>)[
      childrenKey
    ] as T[] | undefined;
    if (Array.isArray(children) && children.length > 0) {
      stack.unshift(...children);
    }
  }
  return result;
}

/** 通用树 → Element Plus Tree / TreeSelect 需要的 {value,label,children} 结构 */
export interface TreeOption {
  children?: TreeOption[];
  label: string;
  value: number | string;
  [key: string]: unknown;
}

export function toTreeOptions(
  nodes: null | object[] | undefined,
  options: {
    childrenKey?: string;
    labelKey?: string;
    valueKey?: string;
  } = {},
): TreeOption[] {
  const {
    childrenKey = 'children',
    labelKey = 'name',
    valueKey = 'id',
  } = options;
  const convert = (list: null | object[] | undefined): TreeOption[] =>
    (list ?? []).map((node) => {
      const record = node as unknown as Record<string, unknown>;
      const rawValue = record[valueKey];
      const rawLabel = record[labelKey];
      const children = record[childrenKey] as object[] | undefined;
      return {
        ...node,
        children: Array.isArray(children) ? convert(children) : undefined,
        label: safeString(rawLabel),
        value: (rawValue ?? '') as number | string,
      } satisfies TreeOption;
    });
  return convert(nodes);
}

/** Set<String> 集合编辑器的值归一：去空、trim、去重 */
export function normalizeStringList(values?: null | string[]): string[] {
  if (!Array.isArray(values)) {
    return [];
  }
  return [
    ...new Set(
      values
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((item) => item.length > 0),
    ),
  ];
}

/** 后端可能返回 null，统一转成数组 */
export function safeArray<T>(value?: null | T[]): T[] {
  return Array.isArray(value) ? value : [];
}

/** 布尔/0/1 混合状态 → 中文 */
export function statusText(value?: boolean | null | number | string): string {
  if (value === false || value === 0 || value === '0' || value === 'false') {
    return L.common.disabled;
  }
  return L.common.enabled;
}

/** 截断长文本，表格里展示用 */
export function ellipsis(value?: null | string, max = 60): string {
  if (!value) {
    return '';
  }
  return value.length > max ? `${value.slice(0, max)}...` : value;
}
