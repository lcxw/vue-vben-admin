/**
 * 工作台内部小工具：调用返回数据的 API，成功提示并返回数据，失败返回 null。
 * （项目既有 withFeedback 只返回 boolean，不适合需要拿到返回值的向导步骤。）
 */
import { ElMessage } from 'element-plus';

export async function callWithFeedback<T>(
  action: () => Promise<T>,
  successText = '操作成功',
): Promise<null | T> {
  try {
    const data = await action();
    if (successText) ElMessage.success(successText);
    return data;
  } catch (error: any) {
    ElMessage.error(error?.message ?? '操作失败');
    return null;
  }
}
