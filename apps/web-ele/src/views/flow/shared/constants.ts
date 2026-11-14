/**
 * 流程配置模块权限码。
 * 后端 @PreAuthorize("hasPermission('flow','xxx')") 拼成 flow:xxx，
 * 与 sql/V2__flow_menu_permission.sql 中的种子一致。
 */
export const FLOW_PERM = {
  category: {
    add: 'flow:category:add',
    list: 'flow:category:list',
    remove: 'flow:category:remove',
    update: 'flow:category:update',
  },
  entry: {
    add: 'flow:entry:add',
    list: 'flow:entry:list',
    publish: 'flow:entry:publish',
    remove: 'flow:entry:remove',
    saveDraft: 'flow:entry:update',
    update: 'flow:entry:update',
    view: 'flow:entry:view',
  },
  identity: { list: 'flow:identity:list' },
  publish: {
    activate: 'flow:publish:activate',
    list: 'flow:publish:list',
    main: 'flow:publish:main',
    suspend: 'flow:publish:suspend',
  },
  variable: {
    add: 'flow:variable:add',
    list: 'flow:variable:list',
    remove: 'flow:variable:remove',
    update: 'flow:variable:update',
  },
} as const;

/**
 * 流程运行时权限码，对应 sql/V4__flow_runtime_permission.sql。
 * /flow/action/execute 是单入口动态鉴权，动作不同校验的 code 也不同，
 * 因此这里按动作分组，前端按钮只做「是否显示」的提示性判断，服务端仍需校验。
 */
export const FLOW_RUNTIME_PERM = {
  action: {
    cc: 'flow:task:cc',
    claim: 'flow:task:claim',
    complete: 'flow:task:complete',
    sign: 'flow:task:sign',
    transfer: 'flow:task:transfer',
  },
  form: { edit: 'flow:form:edit', view: 'flow:form:view' },
  monitor: {
    history: 'flow:monitor:history',
    stat: 'flow:monitor:stat',
    view: 'flow:monitor:view',
  },
  notify: { urge: 'flow:notify:urge' },
  runtime: {
    delete: 'flow:runtime:delete',
    jump: 'flow:runtime:jump',
    list: 'flow:runtime:list',
    start: 'flow:runtime:start',
    suspend: 'flow:runtime:suspend',
    terminate: 'flow:runtime:terminate',
    view: 'flow:runtime:view',
    withdraw: 'flow:runtime:withdraw',
  },
  task: { done: 'flow:task:done', todo: 'flow:task:todo' },
} as const;

/**
 * 审批按钮（写入 BPMN 扩展属性 OperationList）。
 *
 * 阶段 6：value 统一改成后端 FlowActionType 的大写动作码，
 * 与设计期旧草稿的小写值不再混用；后端 FlowTaskOperationResolver
 * 对存量小写值做一次性迁移映射。新建节点默认全选本集合。
 */
export const FLOW_TASK_OPERATIONS = [
  { label: '同意', style: 'primary', value: 'APPROVE' },
  { label: '驳回', style: 'danger', value: 'REJECT' },
  { label: '拒绝', style: 'danger', value: 'REFUSE' },
  { label: '退回上一步', style: 'danger', value: 'RETURN_PREVIOUS' },
  { label: '退回发起人', style: 'danger', value: 'RETURN_INITIATOR' },
  { label: '退回任意节点', style: 'danger', value: 'RETURN_ANY' },
  { label: '拿回', style: 'default', value: 'TAKE_BACK' },
  { label: '转办', style: 'default', value: 'TRANSFER' },
  { label: '前加签', style: 'default', value: 'ADD_SIGN_BEFORE' },
  { label: '后加签', style: 'default', value: 'ADD_SIGN_AFTER' },
  { label: '会签加签', style: 'default', value: 'ADD_SIGN_COUNTERSIGN' },
  { label: '会签减签', style: 'default', value: 'REMOVE_SIGN' },
  { label: '抄送', style: 'default', value: 'CC' },
  { label: '意见', style: 'default', value: 'COMMENT' },
  { label: '撤回', style: 'default', value: 'WITHDRAW' },
  { label: '终止', style: 'danger', value: 'TERMINATE' },
] as const;

/** 新建节点默认勾选的按钮（与后端 DEFAULT_OPERATIONS 保持一致）。 */
export const FLOW_DEFAULT_OPERATIONS: string[] = FLOW_TASK_OPERATIONS.map(
  (item) => item.value,
);
