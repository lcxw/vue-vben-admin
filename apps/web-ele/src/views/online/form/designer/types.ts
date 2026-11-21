import type {
  FormDesignTableWidget,
  FormFieldModel,
  FormFilterConfig,
  FormLeftTreeConfig,
  FormOperation,
  FormWidgetEvent,
  FormWidgetStyle,
} from '#/api/online/types';

export type WidgetKind =
  | 'checkbox'
  | 'date'
  | 'dateRange'
  | 'datetime'
  | 'deptSelect'
  | 'dictSelect'
  | 'divider'
  | 'input'
  | 'number'
  | 'numberRange'
  | 'radio'
  | 'select'
  | 'switch'
  | 'text'
  | 'textarea'
  | 'tree'
  | 'userSelect';

export type SelectionKind =
  | 'column'
  | 'condition'
  | 'form'
  | 'leftTree'
  | 'table';

export interface DesignerSelection {
  kind: SelectionKind;
  key?: string;
}

export interface DesignWidget {
  key: string;
  field: string;
  column?: string;
  label: string;
  widgetType: WidgetKind;
  /** 1等于 2模糊 3范围 4IN 5大于 6小于 */
  filterType: number;
  visible: boolean;
  advanced: boolean;
  /** 栅格宽度 1-24（编辑表单） */
  span: number;
  /** 查询项固定宽度；0=跟随全局 */
  itemWidth: number;
  defaultValue?: any;
  placeholder: string;
  required: boolean;
  dictCode?: string;
  dictMultiple: boolean;
  props: Record<string, any>;
  events: FormWidgetEvent[];
  styleConfig: FormWidgetStyle;
  options?: Array<{ label: string; value: any }>;
}

export interface TableColumnDesign {
  key: string;
  field: string;
  label: string;
  widgetType: string;
  dictCode?: string;
  width: number;
  minWidth: number;
  align: 'center' | 'left' | 'right';
  fixed: '' | 'left' | 'right';
  sortable: boolean;
  show: boolean;
  className: string;
  styleConfig: FormWidgetStyle;
  events: FormWidgetEvent[];
}

export interface TableDesign {
  tableId?: string;
  datasourceId?: string;
  paged: boolean;
  pageSize: number;
  pageSizes: number[];
  showIndex: boolean;
  border: boolean;
  stripe: boolean;
  height?: number;
  maxHeight?: number;
  orderColumn?: string;
  orderAsc: boolean;
  likeQueryColumn: string[];
  /** 平铺数据按父级列转树展示 */
  tree: boolean;
  /** 父级字段，如 parent_id/grade_id */
  pidColumn: string;
  /** 树形默认展开全部 */
  treeExpandAll: boolean;
  columns: TableColumnDesign[];
  operationList: FormOperation[];
  styleConfig: FormWidgetStyle;
}

export interface FormDesignDoc {
  viewId: string;
  viewType: number;
  formKey: string;
  layout: 'flat' | 'tree';
  labelWidth: number;
  labelPosition: 'left' | 'right' | 'top';
  size: string;
  filter: FormFilterConfig;
  leftTree: FormLeftTreeConfig;
  table: TableDesign;
  widgetList: DesignWidget[];
  formEventList: FormWidgetEvent[];
  formStyle: FormWidgetStyle;
  operationList: FormOperation[];
  charts: Array<Record<string, any>>;
  /** 手机端配置原样保留，避免保存时丢数据 */
  mobile?: any;
  raw?: Record<string, any>;
}

export const FILTER_TYPE_OPTIONS = [
  { label: '等于', value: 1, desc: '精确匹配，适合编码/状态/字典' },
  { label: '模糊匹配', value: 2, desc: 'LIKE，适合名称/备注/单号' },
  { label: '区间', value: 3, desc: '起止范围，适合日期/金额/数量' },
  { label: '多选 IN', value: 4, desc: '一次匹配多个值' },
  { label: '大于', value: 5, desc: '大于某个值' },
  { label: '小于', value: 6, desc: '小于某个值' },
] as const;

export const WIDGET_CATALOG: Array<{
  desc: string;
  filterDefault?: number;
  group: string;
  icon: string;
  kind: WidgetKind;
  label: string;
  queryOnly?: boolean;
}> = [
  {
    kind: 'input',
    label: '单行文本',
    icon: 'A',
    group: '查询条件',
    filterDefault: 2,
    desc: '名称、编号、备注的模糊查询',
  },
  {
    kind: 'select',
    label: '下拉选择',
    icon: '⌄',
    group: '查询条件',
    filterDefault: 1,
    desc: '状态、类型等枚举值',
  },
  {
    kind: 'dictSelect',
    label: '字典选择',
    icon: '▦',
    group: '查询条件',
    filterDefault: 1,
    desc: '绑定在线字典，自动加载选项',
  },
  {
    kind: 'date',
    label: '日期',
    icon: '◷',
    group: '查询条件',
    filterDefault: 1,
    desc: '单个日期，等于/区间均可',
  },
  {
    kind: 'dateRange',
    label: '日期区间',
    icon: '◫',
    group: '查询条件',
    filterDefault: 3,
    desc: '开始日期 ~ 结束日期',
  },
  {
    kind: 'number',
    label: '数字',
    icon: '#',
    group: '查询条件',
    filterDefault: 1,
    desc: '金额、数量等数值',
  },
  {
    kind: 'numberRange',
    label: '数字区间',
    icon: '⇔',
    group: '查询条件',
    filterDefault: 3,
    desc: '最小 ~ 最大',
  },
  {
    kind: 'userSelect',
    label: '人员选择',
    icon: '☺',
    group: '查询条件',
    filterDefault: 1,
    desc: '人员/负责人字段',
  },
  {
    kind: 'deptSelect',
    label: '部门选择',
    icon: '⌂',
    group: '查询条件',
    filterDefault: 1,
    desc: '部门/组织字段',
  },
  {
    kind: 'switch',
    label: '开关',
    icon: '⏻',
    group: '查询条件',
    filterDefault: 1,
    desc: '是/否、启用/停用',
  },
  {
    kind: 'textarea',
    label: '多行文本',
    icon: '¶',
    group: '编辑控件',
    filterDefault: 2,
    desc: '长文本，编辑表单使用',
  },
  {
    kind: 'number',
    label: '数字输入',
    icon: '#',
    group: '编辑控件',
    desc: '编辑表单数值输入',
  },
  {
    kind: 'radio',
    label: '单选组',
    icon: '◉',
    group: '编辑控件',
    desc: '横向单选项',
  },
  {
    kind: 'checkbox',
    label: '多选组',
    icon: '☑',
    group: '编辑控件',
    desc: '横向多选项',
  },
  {
    kind: 'datetime',
    label: '日期时间',
    icon: '◷',
    group: '编辑控件',
    desc: '精确到时分秒',
  },
  {
    kind: 'switch',
    label: '开关',
    icon: '⏻',
    group: '编辑控件',
    desc: '布尔值',
  },
  {
    kind: 'divider',
    label: '分组标题',
    icon: '—',
    group: '布局',
    desc: '表单分组分割线',
  },
  {
    kind: 'text',
    label: '说明文字',
    icon: 'ⓘ',
    group: '布局',
    desc: '表单提示文字',
  },
];

export const EVENT_CATALOG: Record<
  string,
  Array<{ code: string; desc: string; example: string; label: string }>
> = {
  condition: [
    {
      code: 'visible',
      label: '是否可见',
      desc: '返回 false 时该查询条件隐藏，可做条件联动。',
      example: `// 例：类型选择「合同」时才显示金额条件\nreturn form.type === 'contract';`,
    },
    {
      code: 'disabled',
      label: '是否禁用',
      desc: '返回 true 时控件置灰不可编辑。',
      example: `// 例：锁定状态下不允许修改日期\nreturn form.status === 'locked';`,
    },
    {
      code: 'change',
      label: '值改变',
      desc: '值变化后执行，可联动其它条件或立即查询。',
      example: `// 例：选择部门后自动刷新\nif (value) reload();`,
    },
  ],
  column: [
    {
      code: 'cellClick',
      label: '单元格点击',
      desc: '点击该列单元格时执行，row 为当前行数据。',
      example: `// 例：点击单号列打开详情\nif (row.id) openForm('detail', row.id);`,
    },
    {
      code: 'visible',
      label: '是否显示列',
      desc: '返回 false 时该列在运行期隐藏。',
      example: `// 例：没有权限时隐藏金额列\nreturn form.showAmount !== false;`,
    },
  ],
  form: [
    {
      code: 'afterCreate',
      label: '表单创建后',
      desc: '查询页初始化完成后执行一次。',
      example: `// 例：默认只查本月\nform.createTime = [startOfMonth(), now()];`,
    },
    {
      code: 'beforeQuery',
      label: '查询前',
      desc: '点击查询、翻页前执行，可改写 form 中的条件。',
      example: `// 例：自动去掉首尾空格\nform.keyword = (form.keyword || '').trim();`,
    },
    {
      code: 'afterQuery',
      label: '查询后',
      desc: '拿到 rows/total 后执行。',
      example: `// 例：空结果提示\nif (!total) message('没有匹配的数据');`,
    },
  ],
  leftTree: [
    {
      code: 'leftTreeChange',
      label: '树节点切换',
      desc: '点击左侧树节点后执行，value 为节点值。',
      example: `// 例：选中分类后清空关键字\nform.keyword = '';`,
    },
  ],
  widget: [
    {
      code: 'visible',
      label: '是否可见',
      desc: '返回 false 时该字段隐藏。',
      example: `return form.type !== 'simple';`,
    },
    {
      code: 'disabled',
      label: '是否禁用',
      desc: '返回 true 时只读。',
      example: `return form.status === 'locked';`,
    },
    {
      code: 'change',
      label: '值改变',
      desc: '字段值变化后执行。',
      example: `if (value === 'other') setValue('remark', '');`,
    },
  ],
};

export const STYLE_FIELDS: Array<{
  key: keyof FormWidgetStyle;
  label: string;
  placeholder: string;
  type: 'color' | 'text';
}> = [
  {
    key: 'width',
    label: '控件宽度',
    placeholder: '如 100% / 320px',
    type: 'text',
  },
  { key: 'labelWidth', label: '标签宽度', placeholder: '如 90', type: 'text' },
  { key: 'margin', label: '外边距', placeholder: '如 0 0 8px 0', type: 'text' },
  { key: 'padding', label: '内边距', placeholder: '如 6px 10px', type: 'text' },
  { key: 'background', label: '背景色', placeholder: '#ffffff', type: 'color' },
  { key: 'borderRadius', label: '圆角', placeholder: '如 6px', type: 'text' },
  {
    key: 'border',
    label: '边框',
    placeholder: '如 1px solid #dcdfe6',
    type: 'text',
  },
  { key: 'color', label: '文字颜色', placeholder: '#303133', type: 'color' },
  { key: 'fontSize', label: '字号', placeholder: '如 13', type: 'text' },
  {
    key: 'textAlign',
    label: '对齐',
    placeholder: 'left / center / right',
    type: 'text',
  },
];

export function uid(prefix = 'w'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function numberOr(value: any, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** 把后端 widgetJson 归一为设计器文档；同时兼容 v4 旧控件结构。 */
export function normalizeDoc(
  view: {
    formId?: string;
    formCode?: string;
    viewId?: string;
    viewType: number;
    widgetJson?: null | string;
  },
  fieldColumns: FormFieldModel[] = [],
): FormDesignDoc {
  let root: any = {};
  try {
    root = view.widgetJson ? JSON.parse(view.widgetJson) : {};
  } catch {
    root = {};
  }
  const pc = root.pc ?? root;
  const isQuery = [1, 2].includes(view.viewType);
  const filterRaw = pc.filter ?? {};
  const leftRaw = pc.leftTree ?? {};
  const tableRaw: FormDesignTableWidget = pc.tableWidget ?? {
    tableColumnList: [],
    operationList: [],
  };
  const widgetsRaw: FormFieldModel[] = Array.isArray(pc.widgetList)
    ? pc.widgetList
    : [];
  const columnsRaw: FormFieldModel[] = Array.isArray(tableRaw.tableColumnList)
    ? tableRaw.tableColumnList
    : [];
  const fieldByKey = new Map<string, FormFieldModel>();
  fieldColumns.forEach((f) => {
    const key = f.fieldKey || f.column;
    if (key) fieldByKey.set(key, f);
  });

  const doc: FormDesignDoc = {
    viewId: view.formId || view.viewId || '',
    viewType: view.viewType,
    formKey: pc.formKey || root.formKey || view.formCode || '',
    layout: pc.layout === 'tree' ? 'tree' : 'flat',
    labelWidth: parsePx(pc.labelWidth, 110),
    labelPosition: ['left', 'right', 'top'].includes(pc.labelPosition)
      ? pc.labelPosition
      : 'right',
    size: pc.size || 'default',
    filter: {
      itemWidth: numberOr(filterRaw.itemWidth, 260),
      gutter: numberOr(filterRaw.gutter, 16),
      columns: numberOr(filterRaw.columns, 3),
      labelWidth: numberOr(filterRaw.labelWidth, 90),
      labelPosition: ['left', 'right', 'top'].includes(filterRaw.labelPosition)
        ? filterRaw.labelPosition
        : 'right',
      collapsible: filterRaw.collapsible ?? true,
      defaultRows: numberOr(filterRaw.defaultRows, 1),
      showSearch: filterRaw.showSearch ?? true,
      showReset: filterRaw.showReset ?? true,
      searchText: filterRaw.searchText || '查询',
      resetText: filterRaw.resetText || '重置',
      hideLabel: filterRaw.hideLabel ?? false,
    },
    leftTree: {
      enabled: leftRaw.enabled ?? false,
      title: leftRaw.title || '分类',
      width: numberOr(leftRaw.width, 240),
      dictCode: leftRaw.dictCode || '',
      field: leftRaw.field || '',
      showSearch: leftRaw.showSearch ?? true,
      searchPlaceholder: leftRaw.searchPlaceholder || '输入关键字过滤',
      defaultExpandAll: leftRaw.defaultExpandAll ?? true,
      showAllNode: leftRaw.showAllNode ?? true,
      allLabel: leftRaw.allLabel || '全部',
      events: Array.isArray(leftRaw.events) ? leftRaw.events : [],
    },
    table: {
      tableId: tableRaw.tableId,
      datasourceId: tableRaw.datasourceId,
      paged: tableRaw.paged ?? true,
      pageSize: numberOr(tableRaw.pageSize, 20),
      pageSizes: tableRaw.pageSizes?.length
        ? tableRaw.pageSizes
        : [10, 20, 50, 100],
      showIndex: tableRaw.showIndex ?? true,
      border: tableRaw.border ?? true,
      stripe: tableRaw.stripe ?? false,
      height: tableRaw.height,
      maxHeight: tableRaw.maxHeight,
      orderColumn: tableRaw.orderColumn,
      orderAsc: tableRaw.orderAsc ?? true,
      likeQueryColumn: tableRaw.likeQueryColumn ?? [],
      tree: tableRaw.tree ?? false,
      pidColumn: tableRaw.pidColumn || '',
      treeExpandAll: tableRaw.treeExpandAll ?? true,
      columns: columnsRaw.map((c, i) => normalizeColumn(c, i)),
      operationList: tableRaw.operationList ?? pc.operationList ?? [],
      styleConfig: tableRaw.styleConfig ?? {},
    },
    widgetList: widgetsRaw.map((w, i) => normalizeWidget(w, i, fieldByKey)),
    formEventList: Array.isArray(pc.formEventList) ? pc.formEventList : [],
    formStyle: pc.formStyle ?? {},
    operationList: pc.operationList ?? [],
    charts: Array.isArray(pc.charts) ? pc.charts : [],
    mobile: root.mobile,
    raw: root,
  };
  // 查询视图如果条件为空，按字段模型的 isQuery 兜底生成，避免设计器空白
  if (isQuery && doc.widgetList.length === 0) {
    doc.widgetList = fieldColumns
      .filter((f) => f.isQuery)
      .map((f, i) => widgetFromColumn(f, i, fieldByKey));
  }
  if (isQuery && doc.table.columns.length === 0) {
    doc.table.columns = fieldColumns
      .filter((f) => f.isList)
      .map((f, i) => columnFromField(f, i));
  }
  return doc;
}

function normalizeWidget(
  w: FormFieldModel,
  index: number,
  fieldByKey: Map<string, FormFieldModel>,
): DesignWidget {
  const field = w.fieldKey || (w as any).field || w.column || '';
  const model = fieldByKey.get(field);
  const dictCode = w.dictCode || w.props?.dictInfo?.dictCode || model?.dictCode;
  const rawType = w.widgetType || 'input';
  // 绑了字典却仍是 input 的旧配置，自动按字典下拉渲染，避免“有字典却要手输编码”。
  const legacyType =
    dictCode && ['input', 'select'].includes(rawType) ? 'dictSelect' : rawType;
  return {
    key: w.key || `${field}_${index}`,
    field,
    column: w.column || model?.column || field,
    label: w.label || model?.label || field,
    widgetType: (legacyType as WidgetKind) || 'input',
    filterType: numberOr(w.filterType ?? model?.filterType ?? 2, 2),
    visible: w.visible ?? true,
    advanced: w.advanced ?? false,
    span: numberOr((w as any).span ?? w.width, 12),
    itemWidth: numberOr(w.itemWidth, 0),
    defaultValue: w.defaultValue,
    placeholder:
      w.placeholder || w.props?.placeholder || model?.placeholder || '',
    required: w.required ?? model?.required ?? false,
    dictCode,
    dictMultiple: w.props?.multiple ?? false,
    props: { ...w.props },
    events: Array.isArray(w.events) ? w.events : [],
    styleConfig: w.styleConfig ?? {},
    options: w.options,
  };
}

function normalizeColumn(c: FormFieldModel, index: number): TableColumnDesign {
  // 兼容手工/导入的旧配置：只写了 key、没写 fieldKey/column 时，key 往往就是字段名。
  const field = c.fieldKey || c.column || c.key || '';
  return {
    key: c.key || `${field}_col_${index}`,
    field,
    label: c.label || field,
    widgetType: c.widgetType || 'input',
    dictCode: c.dictCode,
    width: numberOr(c.width, 0),
    minWidth: numberOr(c.minWidth, 90),
    align: (c.align as any) || 'left',
    fixed: (c.fixed as any) || '',
    sortable: c.sortable ?? false,
    show: c.show ?? true,
    className: c.className || '',
    styleConfig: c.styleConfig ?? {},
    events: Array.isArray(c.events) ? c.events : [],
  };
}

export function widgetFromColumn(
  f: FormFieldModel,
  index: number,
  fieldByKey?: Map<string, FormFieldModel>,
): DesignWidget {
  return normalizeWidget(
    {
      ...f,
      key: `${f.fieldKey || f.column}_${index}`,
      widgetType: mapWidget(f),
      filterType: f.filterType ?? defaultFilterForWidget(mapWidget(f)),
    },
    index,
    fieldByKey ?? new Map(),
  );
}

export function columnFromField(
  f: FormFieldModel,
  index: number,
): TableColumnDesign {
  return {
    key: `${f.fieldKey || f.column}_col_${index}`,
    field: f.fieldKey || f.column || '',
    label: f.label || f.column || '',
    widgetType: f.widgetType || 'input',
    dictCode: f.dictCode,
    width: numberOr(f.width, 0),
    minWidth: numberOr(f.minWidth, 90),
    align: 'left',
    fixed: '',
    sortable: false,
    show: true,
    className: '',
    styleConfig: {},
    events: [],
  };
}

export function mapWidget(f: FormFieldModel): WidgetKind {
  const type = f.widgetType || 'input';
  if (f.dictCode && (type === 'input' || type === 'select'))
    return 'dictSelect';
  if (type === 'datetime') return 'datetime';
  if (type === 'date') return 'date';
  if (type === 'daterange' || type === 'dateRange') return 'dateRange';
  if (type === 'number' || type === 'inputNumber') return 'number';
  if (type === 'textarea') return 'textarea';
  if (type === 'switch') return 'switch';
  if (type.includes('user')) return 'userSelect';
  if (type.includes('dept')) return 'deptSelect';
  if (type === 'select') return 'select';
  if (type === 'radio') return 'radio';
  if (type === 'checkbox') return 'checkbox';
  return (type as WidgetKind) || 'input';
}

export function defaultFilterForWidget(type: WidgetKind): number {
  if (type === 'dateRange' || type === 'numberRange') return 3;
  if (type === 'input' || type === 'textarea') return 2;
  return 1;
}

export function parsePx(value: any, fallback: number): number {
  if (typeof value === 'number') return value;
  const n = Number(String(value ?? '').replace('px', ''));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** 把设计器文档写回 widgetJson（pc 段；mobile 原样保留）。 */
export function buildWidgetJson(doc: FormDesignDoc): string {
  const { columns, ...tableRest } = doc.table;
  const pc = {
    formKey: doc.formKey,
    labelWidth: `${doc.labelWidth}px`,
    labelPosition: doc.labelPosition,
    size: doc.size,
    layout: doc.layout,
    filter: doc.filter,
    leftTree: doc.leftTree,
    formEventList: doc.formEventList,
    formStyle: doc.formStyle,
    charts: doc.charts,
    operationList: doc.operationList,
    widgetList: doc.widgetList.map(widgetJson),
    tableWidget: {
      ...tableRest,
      tableColumnList: columns.map(columnJson),
    },
  };
  const root: Record<string, any> = {};
  // 顶层只保留移动端配置与未知扩展字段，避免把 pc 的旧同名结构再抄一遍。
  if (doc.mobile !== undefined) root.mobile = doc.mobile;
  const knownPcKeys = new Set([
    'charts',
    'filter',
    'formEventList',
    'formKey',
    'formStyle',
    'labelPosition',
    'labelWidth',
    'layout',
    'leftTree',
    'operationList',
    'size',
    'tableWidget',
    'widgetList',
  ]);
  Object.entries(doc.raw ?? {}).forEach(([key, value]) => {
    if (key !== 'mobile' && key !== 'pc' && !knownPcKeys.has(key))
      root[key] = value;
  });
  root.pc = pc;
  return JSON.stringify(root);
}

function widgetJson(w: DesignWidget) {
  return {
    key: w.key,
    field: w.field,
    fieldKey: w.field,
    column: w.column,
    label: w.label,
    title: w.label,
    widgetType: w.widgetType,
    type: w.widgetType,
    filterType: w.filterType,
    visible: w.visible,
    advanced: w.advanced,
    span: w.span,
    width: w.span,
    itemWidth: w.itemWidth || undefined,
    placeholder: w.placeholder,
    required: w.required,
    defaultValue: w.defaultValue,
    dictCode: w.dictCode || undefined,
    props: {
      ...w.props,
      placeholder: w.placeholder,
      multiple: w.dictMultiple,
    },
    events: w.events,
    styleConfig: w.styleConfig,
    isQuery: w.filterType > 0,
    isForm: true,
    showOrder: 0,
    options: w.options,
  };
}

function columnJson(c: TableColumnDesign) {
  return {
    key: c.key,
    fieldKey: c.field,
    column: c.field,
    label: c.label,
    title: c.label,
    widgetType: c.widgetType,
    dictCode: c.dictCode || undefined,
    width: c.width,
    minWidth: c.minWidth,
    align: c.align,
    fixed: c.fixed,
    sortable: c.sortable,
    show: c.show,
    className: c.className,
    styleConfig: c.styleConfig,
    events: c.events,
    isList: true,
    showOrder: 0,
  };
}
