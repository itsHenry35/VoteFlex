// 用户类型
export interface User {
  id: number;
  username: string;
  full_name: string;
  role: "admin" | "user";
  ding_talk_id?: string;
}

// 投票选项
export interface Option {
  id: number;
  poll_id: number;
  text: string;
  image_url: string;
  audio_url: string;
  video_url: string;
  vote_count: number;
  sort_order: number;
  created_at: string;
}

// 投票
export interface Poll {
  id: number;
  uuid: string;
  short_code: string;
  title: string;
  description: string;
  identity_type: IdentityType;
  frequency_type: FrequencyType;
  frequency_n: number;
  frequency_max: number;
  min_votes: number;
  max_votes: number;
  start_time: string | null;
  end_time: string | null;
  show_results: boolean;
  allow_modification: boolean;
  status: PollStatus;
  creator_id: number;
  created_at: string;
  updated_at: string;
  options?: Option[];
  creator?: User;
  voter_count: number; // 投票人数
}

// 投票记录
export interface VoteRecord {
  id: number;
  poll_id: number;
  option_id: number;
  identifier: string; // 用户标识：钉钉用户为 {name}_{ding_talk_id}，IP用户为IP地址
  created_at: string;
  option?: Option;
}

// 投票状态
export interface VoteStatus {
  can_vote: boolean;
  message: string;
  next_vote_time: string | null;
  voted_count: number;
  remaining_votes: number;
  requires_dingtalk: boolean;
  can_modify: boolean;
  modify_token?: string;
  voted_option_ids?: number[];
}

// 网站信息
export interface WebsiteInfo {
  name: string;
  icp_beian: string;
  public_sec_beian: string;
  domain: string;
  dingtalk_corp_id: string;
  dingtalk_client_id: string;
}

// 枚举类型
export type PollStatus = "pending" | "active" | "ended" | "canceled";
export type IdentityType = "none" | "dingtalk" | "ip";
export type FrequencyType = "total" | "hourly" | "daily";

// API响应类型
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data?: T;
}

export interface PaginatedResponse<T = unknown> extends ApiResponse<T> {
  total: number;
  page: number;
  size: number;
}

// 创建投票请求
export interface OptionInput {
  text?: string;
  image_url?: string;
  audio_url?: string;
  video_url?: string;
}

export interface CreatePollRequest {
  title: string;
  description: string;
  identity_type: IdentityType;
  frequency_type: FrequencyType;
  frequency_n: number;
  frequency_max: number;
  min_votes: number;
  max_votes: number;
  start_time?: string;
  end_time?: string;
  show_results: boolean;
  allow_modification: boolean;
  options: OptionInput[];
}

// 投票结果
export interface VoteResult {
  success: boolean;
  modification_token?: string;
}
