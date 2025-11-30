import { api, callApi, callPaginatedApi } from "./config";
import { Poll, User, WebsiteInfo, ApiResponse, PaginatedResponse } from "../types";

export interface CreateUserRequest {
  username: string;
  password: string;
  full_name: string;
  role: string;
  ding_talk_id?: string;
}

export interface UpdateUserRequest {
  full_name?: string;
  password?: string;
  role?: string;
  ding_talk_id?: string;
}

export interface SettingsResponse {
  website: WebsiteInfo;
  dingtalk: {
    app_key: string;
    app_secret: string;
    agent_id: string;
    corp_id: string;
    self_register: boolean;
  };
}

export interface UpdateSettingsRequest {
  website?: Partial<WebsiteInfo>;
  dingtalk?: {
    app_key?: string;
    app_secret?: string;
    agent_id?: string;
    corp_id?: string;
  };
}

/**
 * 管理员API
 */
export const adminAPI = {
  // 投票管理
  /**
   * 获取所有投票列表
   */
  getPolls: async (params?: {
    page?: number;
    page_size?: number;
  }): Promise<PaginatedResponse<Poll[]>> => {
    return await callPaginatedApi(() => api.get("/admin/polls", { params }));
  },

  /**
   * 通过ID获取投票详情
   */
  getPollById: async (id: number): Promise<ApiResponse<Poll>> => {
    return await callApi(() => api.get(`/admin/polls/${id}`));
  },

  /**
   * 删除投票
   */
  deletePoll: async (id: number): Promise<ApiResponse> => {
    return await callApi(() => api.delete(`/admin/polls/${id}`));
  },

  // 用户管理
  /**
   * 获取用户列表
   */
  getUsers: async (params?: {
    page?: number;
    page_size?: number;
  }): Promise<PaginatedResponse<User[]>> => {
    return await callPaginatedApi(() => api.get("/admin/users", { params }));
  },

  /**
   * 创建用户
   */
  createUser: async (data: CreateUserRequest): Promise<ApiResponse<User>> => {
    return await callApi(() => api.post("/admin/users", data));
  },

  /**
   * 更新用户
   */
  updateUser: async (
    id: number,
    data: UpdateUserRequest,
  ): Promise<ApiResponse<User>> => {
    return await callApi(() => api.put(`/admin/users/${id}`, data));
  },

  /**
   * 删除用户
   */
  deleteUser: async (id: number): Promise<ApiResponse> => {
    return await callApi(() => api.delete(`/admin/users/${id}`));
  },

  /**
   * 更新用户密码
   */
  updateUserPassword: async (
    id: number,
    password: string,
  ): Promise<ApiResponse> => {
    return await callApi(() => api.post(`/admin/users/${id}/password`, { password }));
  },

  // 系统设置
  /**
   * 获取系统设置
   */
  getSettings: async (): Promise<ApiResponse<SettingsResponse>> => {
    return await callApi(() => api.get("/admin/settings"));
  },

  /**
   * 更新系统设置
   */
  updateSettings: async (data: UpdateSettingsRequest): Promise<ApiResponse> => {
    return await callApi(() => api.put("/admin/settings", data));
  },
};
