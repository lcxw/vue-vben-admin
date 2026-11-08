/**
 * 权限管理模块的字典与权限码常量。
 *
 * 后端 @PreAuthorize 使用 hasPermission('模块','操作')，
 * 对应权限码字符串为 `模块:操作`，例如 user:add。
 * 这里集中定义，页面按钮鉴权与后端保持一致。
 */
export const PERM = {
  client: {
    add: 'client:add',
    list: 'client:list',
    remove: 'client:remove',
    update: 'client:update',
  },
  department: {
    add: 'department:add',
    list: 'department:list',
    remove: 'department:remove',
    update: 'department:update',
  },
  menu: { list: 'menu:list' },
  permission: {
    add: 'permission:add',
    list: 'permission:list',
    permission: 'permission:permission',
    remove: 'permission:remove',
    update: 'permission:update',
  },
  post: {
    add: 'post:add',
    list: 'post:list',
    remove: 'post:remove',
    update: 'post:update',
  },
  role: {
    add: 'role:add',
    list: 'role:list',
    permission: 'role:permission',
    remove: 'role:remove',
    update: 'role:update',
  },
  scope: {
    list: 'scope:list',
    remove: 'scope:remove',
    save: 'scope:save',
  },
  user: {
    add: 'user:add',
    list: 'user:list',
    remove: 'user:remove',
    role: 'user:role',
    update: 'user:update',
  },
} as const;

/** 通用状态（后端 Boolean enabled / Integer status 混用，前端统一用布尔或 0/1） */
export const ENABLE_OPTIONS = [
  { label: '启用', value: true },
  { label: '停用', value: false },
];

/**
 * 用户分页查询的状态选项。
 *
 * 后端 UserInfoService.page() 用的是 `"1".equals(enable)`，
 * 只认 '1'/'0'，传 'true'/'false' 会一律查成停用用户。
 */
export const ENABLE_QUERY_OPTIONS = [
  { label: '启用', value: '1' },
  { label: '停用', value: '0' },
];

/** 角色分页 RoleService.pageQuery() 用 Boolean.parseBoolean，需要 'true'/'false' */
export const ENABLE_BOOL_QUERY_OPTIONS = [
  { label: '启用', value: 'true' },
  { label: '停用', value: 'false' },
];

/** permission.type：0 菜单 / 1 iframe / 2 外链 / 3 按钮 */
export const MENU_TYPE_OPTIONS = [
  { label: '菜单', value: '0' },
  { label: '内嵌页', value: '1' },
  { label: '外链', value: '2' },
  { label: '按钮/权限点', value: '3' },
];

export const MENU_TYPE_LABEL: Record<string, string> = {
  '0': '菜单',
  '1': '内嵌页',
  '2': '外链',
  '3': '按钮',
};

export const GENDER_OPTIONS = [
  { label: '未知', value: 0 },
  { label: '男', value: 1 },
  { label: '女', value: 2 },
];

/** UserInfo.userType */
export const USER_TYPE_OPTIONS = [
  { label: '管理员', value: 0 },
  { label: '系统管理用户', value: 1 },
  { label: '系统业务用户', value: 2 },
];

/** UserInfo.dataScope */
export const DATA_SCOPE_OPTIONS = [
  { label: '全部数据', value: 0 },
  { label: '仅本人', value: 1 },
  { label: '本部门', value: 2 },
  { label: '本部门及子部门', value: 3 },
  { label: '自定义部门', value: 5 },
];

/** OAuth2 客户端：认证方式 */
export const AUTH_METHOD_OPTIONS = [
  'client_secret_basic',
  'client_secret_post',
  'client_secret_jwt',
  'private_key_jwt',
  'none',
];

/** OAuth2 客户端：授权类型 */
export const GRANT_TYPE_OPTIONS = [
  'authorization_code',
  'refresh_token',
  'client_credentials',
  'password',
  'urn:ietf:params:oauth:grant-type:jwt-bearer',
  'urn:ietf:params:oauth:grant-type:device_code',
];

/** 客户端详情里常见的 token 格式 */
export const TOKEN_FORMAT_OPTIONS = ['self-contained', 'reference', 'jwt'];
