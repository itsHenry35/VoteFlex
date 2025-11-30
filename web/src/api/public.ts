import { publicApi, callApi } from "./config";
import { WebsiteInfo, Poll, VoteStatus, VoteResult, ApiResponse } from "../types";

/**
 * 公共API - 游客可访问
 */
export const publicAPI = {
  /**
   * 获取网站信息
   */
  getWebsiteInfo: async (): Promise<ApiResponse<WebsiteInfo>> => {
    return await callApi(() => publicApi.get("/website_info"));
  },

  /**
   * 通过UUID获取投票
   */
  getPollByUUID: async (uuid: string): Promise<ApiResponse<Poll>> => {
    return await callApi(() => publicApi.get(`/v/${uuid}`));
  },

  /**
   * 通过短链接获取投票
   */
  getPollByShortCode: async (code: string): Promise<ApiResponse<Poll>> => {
    return await callApi(() => publicApi.get(`/s/${code}`));
  },

  /**
   * 检查投票状态
   */
  checkVoteStatus: async (
    uuid: string,
    dingtalkToken?: string,
  ): Promise<ApiResponse<VoteStatus>> => {
    return await callApi(() =>
      publicApi.get(`/v/${uuid}/status`, {
        params: { dingtalk_token: dingtalkToken },
      }),
    );
  },

  /**
   * 获取投票结果
   */
  getPollResults: async (
    uuid: string,
  ): Promise<
    ApiResponse<{ poll: Poll; options: Poll["options"]; total_votes: number }>
  > => {
    return await callApi(() => publicApi.get(`/v/${uuid}/results`));
  },

  /**
   * 投票
   */
  vote: async (
    uuid: string,
    optionIds: number[],
    dingtalkToken?: string,
  ): Promise<ApiResponse<VoteResult>> => {
    return await callApi(() =>
      publicApi.post(`/v/${uuid}/vote`, {
        option_ids: optionIds,
        dingtalk_token: dingtalkToken,
      }),
    );
  },

  /**
   * 修改投票
   */
  modifyVote: async (
    modificationToken: string,
    optionIds: number[],
    dingtalkToken?: string,
  ): Promise<ApiResponse> => {
    return await callApi(() =>
      publicApi.post("/vote/modify", {
        modification_token: modificationToken,
        option_ids: optionIds,
        dingtalk_token: dingtalkToken,
      }),
    );
  },

  /**
   * 获取钉钉投票者令牌
   */
  getDingTalkUserID: async (
    code: string,
  ): Promise<ApiResponse<{ dingtalk_token: string; name: string }>> => {
    return await callApi(() =>
      publicApi.post("/dingtalk/get_user_id", { code }),
    );
  },
};
