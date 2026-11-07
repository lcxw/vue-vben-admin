import { requestClient } from '#/api/request';

/** 后端 PostVO */
export interface PostNode {
  code?: string;
  description?: string;
  enabled?: boolean;
  id: number;
  name?: string;
  sortOrder?: number;
}

/** 部门-岗位关联（后端 DeptPostVO 字段全是字符串） */
export interface DeptPostNode {
  deptId?: string;
  deptPostId?: string;
  postId?: string;
  postShowName?: string;
}

export type PostFormData = Partial<PostNode>;
export type DeptPostFormData = Partial<DeptPostNode>;

/** 岗位列表：POST /post/list（后端接收 Map，name 支持模糊） */
export function getPostList(
  params: Record<string, unknown> = {},
): Promise<PostNode[]> {
  return requestClient.post<PostNode[]>('/post/list', params);
}

/** 新增岗位：POST /post/create */
export function createPost(data: PostFormData): Promise<PostNode> {
  return requestClient.post<PostNode>('/post/create', data);
}

/** 编辑岗位：POST /post/update */
export function updatePost(data: PostFormData): Promise<PostNode> {
  return requestClient.post<PostNode>('/post/update', data);
}

/** 删除岗位：POST /post/delete（@RequestBody Long id，纯数字） */
export function deletePost(id: number) {
  return requestClient.post('/post/delete', id);
}

/** 岗位详情：POST /post/getPostById（纯数字） */
export function getPostById(id: number): Promise<PostNode> {
  return requestClient.post<PostNode>('/post/getPostById', id);
}

/** 全部部门-岗位关联：POST /deptPost/getDeptPostList */
export function getDeptPostList(): Promise<DeptPostNode[]> {
  return requestClient.post<DeptPostNode[]>('/deptPost/getDeptPostList', {});
}

/** 按部门查部门-岗位树：POST /deptPost/tree */
export function getDeptPostTree(
  deptId: number | string,
): Promise<DeptPostNode[]> {
  return requestClient.post<DeptPostNode[]>('/deptPost/tree', {
    deptId: String(deptId),
  });
}

/** 新增部门-岗位关联：POST /deptPost/add */
export function createDeptPost(data: DeptPostFormData): Promise<DeptPostNode> {
  return requestClient.post<DeptPostNode>('/deptPost/add', data);
}
