import { message } from "antd";
import { ApiResponse, PaginatedResponse } from "../types";

// 全局的导航和登出函数，需要在应用启动时设置
let globalLogout: () => void = () => {};
let globalNavigate: (path: string) => void = () => {};

export const setGlobalHandlers = (
  logout: () => void,
  navigate: (path: string) => void,
) => {
  globalLogout = logout;
  globalNavigate = navigate;
};

/**
 * 统一处理API响应的核心函数
 */
const handleRespCore = <T>(
  resp: ApiResponse<T> | PaginatedResponse<T>,
  success?: (
    data: T,
    pagination?: { page: number; total: number; size: number },
  ) => void,
  fail?: (message: string, code: number) => void,
  options: {
    auth?: boolean;
    notifyError?: boolean;
    notifySuccess?: boolean;
  } = {},
) => {
  const { auth = true, notifyError = true, notifySuccess = false } = options;

  if (resp.code === 200) {
    if (notifySuccess && resp.message) {
      message.success(resp.message);
    }

    if (resp.data !== undefined) {
      // 检查是否是分页响应
      if ("total" in resp && "page" in resp && "size" in resp) {
        const paginatedResp = resp as PaginatedResponse<T>;
        success?.(resp.data, {
          page: paginatedResp.page,
          total: paginatedResp.total,
          size: paginatedResp.size,
        });
      } else {
        success?.(resp.data, {
          page: 0,
          total: resp.data instanceof Array ? resp.data.length : 1,
          size: 0,
        });
      }
    } else {
      // 没有data时也调用success回调，传入undefined作为data
      success?.(undefined as T, {
        page: 0,
        total: 0,
        size: 0,
      });
    }
  } else {
    if (notifyError && resp.message) {
      message.error(resp.message);
    }

    if (auth && resp.code === 401) {
      globalLogout();
      globalNavigate("/login");
      return;
    }

    fail?.(resp.message, resp.code);
  }
};

/**
 * 标准响应处理
 */
export const handleResp = <T>(
  resp: ApiResponse<T> | PaginatedResponse<T>,
  success?: (
    data: T,
    pagination?: { page: number; total: number; size: number },
  ) => void,
  fail?: (message: string, code: number) => void,
) => {
  return handleRespCore(resp, success, fail, {
    auth: true,
    notifyError: true,
    notifySuccess: false,
  });
};

/**
 * 不显示通知的响应处理（用于看板等静默获取数据的场景）
 */
export const handleRespWithoutNotify = <T>(
  resp: ApiResponse<T> | PaginatedResponse<T>,
  success?: (
    data: T,
    pagination?: { page: number; total: number; size: number },
  ) => void,
  fail?: (message: string, code: number) => void,
) => {
  return handleRespCore(resp, success, fail, {
    auth: true,
    notifyError: false,
    notifySuccess: false,
  });
};

/**
 * 不处理权限认证且不显示通知的响应处理
 */
export const handleRespWithoutAuthAndNotify = <T>(
  resp: ApiResponse<T> | PaginatedResponse<T>,
  success?: (
    data: T,
    pagination?: { page: number; total: number; size: number },
  ) => void,
  fail?: (message: string, code: number) => void,
) => {
  return handleRespCore(resp, success, fail, {
    auth: false,
    notifyError: false,
    notifySuccess: false,
  });
};

/**
 * 显示成功通知的响应处理（用于创建、更新、删除等操作）
 */
export const handleRespWithNotifySuccess = <T>(
  resp: ApiResponse<T> | PaginatedResponse<T>,
  success?: (
    data: T,
    pagination?: { page: number; total: number; size: number },
  ) => void,
  fail?: (message: string, code: number) => void,
) => {
  return handleRespCore(resp, success, fail, {
    auth: true,
    notifyError: true,
    notifySuccess: true,
  });
};

/**
 * 不处理权限认证但显示成功通知的响应处理
 */
export const handleRespWithoutAuthButNotifySuccess = <T>(
  resp: ApiResponse<T> | PaginatedResponse<T>,
  success?: (
    data: T,
    pagination?: { page: number; total: number; size: number },
  ) => void,
  fail?: (message: string, code: number) => void,
) => {
  return handleRespCore(resp, success, fail, {
    auth: false,
    notifyError: true,
    notifySuccess: true,
  });
};
