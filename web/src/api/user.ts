import { api, callApi, callPaginatedApi } from "./config";
import { Poll, VoteRecord, CreatePollRequest, ApiResponse, PaginatedResponse, Option } from "../types";

/**
 * 用户API - 需要登录
 */
export const userAPI = {
  /**
   * 获取我的投票列表
   */
  getMyPolls: async (params?: {
    page?: number;
    page_size?: number;
  }): Promise<PaginatedResponse<Poll[]>> => {
    return await callPaginatedApi(() => api.get("/user/polls", { params }));
  },

  /**
   * 获取单个投票详情
   */
  getMyPoll: async (id: number): Promise<ApiResponse<Poll>> => {
    return await callApi(() => api.get(`/user/polls/${id}`));
  },

  /**
   * 创建投票
   */
  createPoll: async (data: CreatePollRequest): Promise<ApiResponse<Poll>> => {
    return await callApi(() => api.post("/user/polls", data));
  },

  /**
   * 更新投票
   */
  updatePoll: async (
    id: number,
    data: Partial<CreatePollRequest>,
  ): Promise<ApiResponse<Poll>> => {
    return await callApi(() => api.put(`/user/polls/${id}`, data));
  },

  /**
   * 删除投票
   */
  deletePoll: async (id: number): Promise<ApiResponse> => {
    return await callApi(() => api.delete(`/user/polls/${id}`));
  },

  /**
   * 结束投票
   */
  endPoll: async (id: number): Promise<ApiResponse> => {
    return await callApi(() => api.post(`/user/polls/${id}/end`));
  },

  /**
   * 重新开启投票
   */
  reopenPoll: async (id: number): Promise<ApiResponse> => {
    return await callApi(() => api.post(`/user/polls/${id}/reopen`));
  },

  /**
   * 设置投票短链接
   */
  setShortCode: async (id: number, shortCode: string): Promise<ApiResponse<Poll>> => {
    return await callApi(() => api.post(`/user/polls/${id}/shortcode`, { short_code: shortCode }));
  },

  /**
   * 获取投票记录
   */
  getVoteRecords: async (
    pollId: number,
    params?: { page?: number; page_size?: number },
  ): Promise<PaginatedResponse<VoteRecord[]>> => {
    return await callPaginatedApi(() =>
      api.get(`/user/polls/${pollId}/records`, { params }),
    );
  },

  /**
   * 添加选项
   */
  addOption: async (
    pollId: number,
    data: FormData
  ): Promise<ApiResponse<Option>> => {
    return await callApi(() => api.post(`/user/polls/${pollId}/options`, data, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }));
  },

  /**
   * 更新选项
   */
  updateOption: async (
    pollId: number,
    optionId: number,
    data: FormData
  ): Promise<ApiResponse<Option>> => {
    return await callApi(() => api.put(`/user/polls/${pollId}/options/${optionId}`, data, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }));
  },

  /**
   * 删除选项
   */
  deleteOption: async (pollId: number, optionId: number): Promise<ApiResponse> => {
    return await callApi(() => api.delete(`/user/polls/${pollId}/options/${optionId}`));
  },

  /**
   * 更新选项顺序
   */
  updateOptionOrder: async (
    pollId: number,
    optionId: number,
    newOrder: number
  ): Promise<ApiResponse<Option[]>> => {
    return await callApi(() =>
      api.post(`/user/polls/${pollId}/options/order`, {
        option_id: optionId,
        new_order: newOrder,
      })
    );
  },
};
