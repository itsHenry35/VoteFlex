import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  Typography,
  Button,
  Checkbox,
  Space,
  Image,
  Modal,
  Result,
  Spin,
  Alert,
  Tag,
  message,
} from "antd";
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  LockOutlined,
  SoundOutlined,
  BarChartOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { publicAPI } from "../../api/public";
import { handleResp, handleRespWithNotifySuccess } from "../../utils/handleResp";
import { useWebsite } from "../../contexts/WebsiteContext";
import Footer from "../../components/Footer";
import type { Poll, Option, VoteStatus } from "../../types";
import * as dd from "dingtalk-jsapi";

const { Title, Paragraph, Text } = Typography;

const VotePage: React.FC = () => {
  const { uuid, code } = useParams<{ uuid?: string; code?: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { dingtalk_corp_id, dingtalk_client_id } = useWebsite();

  const [loading, setLoading] = useState(true);
  const [poll, setPoll] = useState<Poll | null>(null);
  const [voteStatus, setVoteStatus] = useState<VoteStatus | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<number[]>([]);
  const [voting, setVoting] = useState(false);
  const [voter_dingtalkToken, setvoter_dingtalkToken] = useState<string | null>(() => {
    // 从 localStorage 初始化 voter_dingtalk_token
    return localStorage.getItem("voter_dingtalk_token");
  });
  const [dingtalkModalVisible, setDingtalkModalVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modificationToken, setModificationToken] = useState<string | null>(null);
  const [isModifying, setIsModifying] = useState(false);
  const voter_dingtalkTokenRef = useRef<string | null>(voter_dingtalkToken);

  useEffect(() => {
    voter_dingtalkTokenRef.current = voter_dingtalkToken;
  }, [voter_dingtalkToken]);

  // 保存 voter_dingtalk_token 到 localStorage
  useEffect(() => {
    if (voter_dingtalkToken) {
      localStorage.setItem("voter_dingtalk_token", voter_dingtalkToken);
    } else {
      localStorage.removeItem("voter_dingtalk_token");
    }
  }, [voter_dingtalkToken]);

  // 检查是否在钉钉客户端中
  const isInDingTalk = dd.env.platform !== "notInDingTalk";

  // 处理SSO回调的URL参数
  useEffect(() => {
    const voter_dingtalkTokenParam = searchParams.get("dingtalk_token");
    const dingtalkNameParam = searchParams.get("dingtalk_name");
    const dingtalkError = searchParams.get("dingtalk_error");

    if (voter_dingtalkTokenParam) {
      setvoter_dingtalkToken(voter_dingtalkTokenParam);
      // 关闭钉钉登录弹窗
      setDingtalkModalVisible(false);
      // 如果有name参数，显示欢迎信息
      if (dingtalkNameParam) {
        message.success(`欢迎，${dingtalkNameParam}！`);
      }
      // 清除URL参数
      searchParams.delete("dingtalk_token");
      searchParams.delete("dingtalk_name");
      setSearchParams(searchParams, { replace: true });
    }

    if (dingtalkError) {
      Modal.error({
        title: "钉钉登录失败",
        content: dingtalkError,
      });
      // 清除URL参数
      searchParams.delete("dingtalk_error");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // 获取投票状态
  const fetchVoteStatus = useCallback(async (pollUuid: string) => {
    const response = await publicAPI.checkVoteStatus(pollUuid, voter_dingtalkToken || undefined);

    // 检查是否是 token 过期错误（401 Unauthorized）
    if (response.code === 401 && voter_dingtalkToken) {
      // 清除过期的 token
      setvoter_dingtalkToken(null);
      // 如果需要钉钉登录，显示登录弹窗
      if (poll?.identity_type === "dingtalk") {
        setDingtalkModalVisible(true);
      }
      setLoading(false);
      return;
    }

    handleResp(
      response,
      (data) => {
        setVoteStatus(data);
        // 如果返回了 modify_token，保存到 state 和 localStorage
        if (data.modify_token) {
          setModificationToken(data.modify_token);
          localStorage.setItem(`vote_token_${pollUuid}`, data.modify_token);
        }
        const shouldShowLoginModal = data.requires_dingtalk && !voter_dingtalkTokenRef.current;
        setDingtalkModalVisible(shouldShowLoginModal);
        setLoading(false);
      },
      () => {
        setLoading(false);
      },
    );
  }, [voter_dingtalkToken, poll]);

  // 获取投票信息
  const fetchPoll = useCallback(async () => {
    setLoading(true);
    setError(null);

    let response;
    if (uuid) {
      response = await publicAPI.getPollByUUID(uuid);
    } else if (code) {
      response = await publicAPI.getPollByShortCode(code);
    } else {
      setError("无效的投票链接");
      setLoading(false);
      return;
    }

    handleResp(
      response,
      async (data) => {
        setPoll(data);

        // 尝试从localStorage加载修改令牌
        const savedToken = localStorage.getItem(`vote_token_${data.uuid}`);
        if (savedToken) {
          setModificationToken(savedToken);
        }

        // 直接调用 API 获取投票状态，而不依赖 fetchVoteStatus
        const statusResponse = await publicAPI.checkVoteStatus(data.uuid, voter_dingtalkToken || undefined);

        // 检查是否是 token 过期错误（401 Unauthorized）
        if (statusResponse.code === 401 && voter_dingtalkToken) {
          setvoter_dingtalkToken(null);
          if (data.identity_type === "dingtalk") {
            setDingtalkModalVisible(true);
          }
          setLoading(false);
          return;
        }

        handleResp(
          statusResponse,
          (statusData) => {
            setVoteStatus(statusData);
            if (statusData.modify_token) {
              setModificationToken(statusData.modify_token);
              localStorage.setItem(`vote_token_${data.uuid}`, statusData.modify_token);
            }
            const shouldShowLoginModal = statusData.requires_dingtalk && !voter_dingtalkTokenRef.current;
            setDingtalkModalVisible(shouldShowLoginModal);
            setLoading(false);
          },
          () => {
            setLoading(false);
          },
        );
      },
      (message) => {
        setError(message);
        setLoading(false);
      },
    );
  }, [uuid, code, voter_dingtalkToken]);

  useEffect(() => {
    fetchPoll();
  }, [fetchPoll]);

  // 钉钉登录
  const handleDingtalkLogin = () => {
    // 检查是否在钉钉客户端中
    if (isInDingTalk) {
      // 在钉钉客户端中使用免登
      if (!dingtalk_corp_id) {
        Modal.error({
          title: "钉钉登录未配置",
          content: "请联系管理员配置钉钉登录",
        });
        return;
      }

      dd.ready(() => {
        dd.runtime.permission
          .requestAuthCode({
            corpId: dingtalk_corp_id,
          })
          .then(async (res) => {
            if (res.code) {
              const response = await publicAPI.getDingTalkUserID(res.code);
              handleResp(response, (data) => {
                setvoter_dingtalkToken(data.dingtalk_token);
                setDingtalkModalVisible(false);
                if (data.name) {
                  message.success(`欢迎，${data.name}！`);
                }
              });
            }
          })
          .catch(() => {
            Modal.error({
              title: "获取钉钉授权失败",
              content: "请重试",
            });
          });
      });
    } else {
      // 不在钉钉客户端中，使用SSO redirect方式
      if (!dingtalk_client_id) {
        Modal.error({
          title: "钉钉SSO登录未配置",
          content: "请联系管理员配置钉钉SSO登录",
        });
        return;
      }

      // 获取当前页面路径作为回调地址
      const currentPath = window.location.pathname;
      const ssoUrl = `/api/public/dingtalk/sso_redirect?method=get_vote_token&redirect=${encodeURIComponent(currentPath)}`;
      window.location.href = ssoUrl;
    }
  };

  // 选择选项
  const handleOptionChange = (optionId: number, checked: boolean) => {
    if (checked) {
      if (poll && selectedOptions.length >= poll.max_votes) {
        return; // 已达到最大选择数
      }
      setSelectedOptions([...selectedOptions, optionId]);
    } else {
      setSelectedOptions(selectedOptions.filter((id) => id !== optionId));
    }
  };

  // 提交投票
  const handleVote = async () => {
    if (!poll) return;

    if (selectedOptions.length < poll.min_votes) {
      Modal.warning({
        title: "选择数量不足",
        content: `请至少选择 ${poll.min_votes} 个选项`,
      });
      return;
    }

    setVoting(true);
    const response = await publicAPI.vote(poll.uuid, selectedOptions, voter_dingtalkToken || undefined);
    handleRespWithNotifySuccess(
      response,
      (data) => {
        setVoting(false);
        // 如果返回了修改令牌，保存到localStorage
        if (data?.modification_token) {
          localStorage.setItem(`vote_token_${poll.uuid}`, data.modification_token);
          setModificationToken(data.modification_token);
          Modal.success({
            title: "投票成功",
            content: poll.allow_modification
              ? "您可以修改您的投票。"
              : "投票已提交",
          });
        }
        // 刷新投票状态
        fetchVoteStatus(poll.uuid);
        setSelectedOptions([]);
        setIsModifying(false);
      },
      () => {
        setVoting(false);
      },
    );
  };

  // 修改投票
  const handleModifyVote = async () => {
    if (!poll || !modificationToken) return;

    if (selectedOptions.length < poll.min_votes) {
      Modal.warning({
        title: "选择数量不足",
        content: `请至少选择 ${poll.min_votes} 个选项`,
      });
      return;
    }

    setVoting(true);
    const response = await publicAPI.modifyVote(
      modificationToken,
      selectedOptions,
      voter_dingtalkToken || undefined
    );
    handleRespWithNotifySuccess(
      response,
      () => {
        setVoting(false);
        setSelectedOptions([]);
        setIsModifying(false);
        // 刷新投票状态
        if (poll) {
          fetchVoteStatus(poll.uuid);
        }
      },
      () => {
        setVoting(false);
      },
    );
  };

  // 渲染选项
  const renderOption = (option: Option) => {
    // 如果在修改模式，使用 selectedOptions，否则显示已投票的选项
    const isVoted = voteStatus?.voted_option_ids?.includes(option.id) || false;
    const isSelected = isModifying ? selectedOptions.includes(option.id) : isVoted;
    const canSelect = (Boolean(!voteStatus || voteStatus.can_vote) || isModifying);
    const hasReachedMax = poll && selectedOptions.length >= poll.max_votes && !isSelected;

    return (
      <div
        key={option.id}
        style={{
          marginBottom: 12,
          padding: 18,
          background: isSelected ? "#f5f3ff" : "#fff",
          border: isSelected ? "2px solid #6366f1" : "1px solid #e5e7eb",
          borderRadius: 12,
          cursor: canSelect && !hasReachedMax ? "pointer" : "default",
          opacity: hasReachedMax ? 0.5 : 1,
          transition: "all 0.2s ease",
        }}
        onClick={() => {
          if (canSelect && !hasReachedMax) {
            handleOptionChange(option.id, !isSelected);
          } else if (isSelected) {
            handleOptionChange(option.id, false);
          }
        }}
      >
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Checkbox
              checked={isSelected}
              disabled={Boolean(!canSelect || (hasReachedMax && !isSelected))}
              onChange={(e) => handleOptionChange(option.id, e.target.checked)}
              style={{
                transform: "scale(1.2)",
              }}
            />
            {option.text && (
              <Text
                strong
                style={{
                  fontSize: 17,
                  color: "#1e293b",
                }}
              >
                {option.text}
              </Text>
            )}
          </div>

          {/* 媒体内容 */}
          {option.image_url && (
            <Image
              src={option.image_url}
              alt={option.text || "选项图片"}
              style={{
                maxWidth: "100%",
                maxHeight: 280,
                borderRadius: 8,
              }}
            />
          )}
          {option.audio_url && (
            <div
              style={{
                padding: "12px 16px",
                background: "#f8fafc",
                borderRadius: 8,
                border: "1px solid #e2e8f0",
              }}
            >
              <Space style={{ width: "100%", display: "flex", alignItems: "center" }}>
                <SoundOutlined style={{ fontSize: 16, color: "#64748b", flexShrink: 0 }} />
                <audio
                  controls
                  src={option.audio_url}
                  style={{ flex: 1, maxWidth: "100%", height: "32px" }}
                >
                  您的浏览器不支持音频播放
                </audio>
              </Space>
            </div>
          )}
          {option.video_url && (
            <video
              controls
              src={option.video_url}
              style={{
                width: "100%",
                maxHeight: 360,
                borderRadius: 8,
              }}
            />
          )}

          {/* 显示投票结果（如果开启） */}
          {poll?.show_results && poll.status === "ended" && (
            <div>
              <div
                style={{
                  height: 8,
                  background: "#e2e8f0",
                  borderRadius: 4,
                  overflow: "hidden",
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${
                      poll.options && poll.options.reduce((sum, o) => sum + o.vote_count, 0) > 0
                        ? (option.vote_count /
                            poll.options.reduce((sum, o) => sum + o.vote_count, 0)) *
                          100
                        : 0
                    }%`,
                    background: "linear-gradient(90deg, #6366f1 0%, #8b5cf6 100%)",
                    borderRadius: 4,
                  }}
                />
              </div>
              <Text style={{ fontSize: 14, color: "#64748b" }}>
                {option.vote_count} 票
              </Text>
            </div>
          )}
        </Space>
      </div>
    );
  };

  // 渲染投票状态
  const renderVoteStatus = () => {
    if (!voteStatus) return null;

    // 如果身份验证是无限制，就不显示任何频率限制相关的提示
    if (poll?.identity_type === "none") {
      return null;
    }

    // 如果不能投票，但可以修改，则不显示警告
    if (!voteStatus.can_vote && !voteStatus.can_modify) {
      return (
        <Alert
          message="暂时无法投票"
          description={
            <Space direction="vertical">
              <Text>{voteStatus.message}</Text>
              {voteStatus.next_vote_time && (
                <Text type="secondary">
                  <ClockCircleOutlined /> 下次可投票时间:{" "}
                  {dayjs(voteStatus.next_vote_time).format("YYYY-MM-DD HH:mm:ss")}
                </Text>
              )}
            </Space>
          }
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      );
    }

    return null;
  };

  // 渲染投票信息
  const renderPollInfo = () => {
    if (!poll) return null;

    return (
      <div style={{ marginBottom: 20 }}>
        {/* 第一行：状态、身份验证、选择范围 */}
        <div style={{ marginBottom: 10 }}>
          <Space size={8} wrap>
            {poll.status === "active" && (
              <Tag
                color="success"
                icon={<CheckCircleOutlined />}
                style={{
                  borderRadius: 6,
                  padding: "4px 12px",
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                进行中
              </Tag>
            )}
            {poll.status === "pending" && (
              <Tag
                color="warning"
                icon={<ClockCircleOutlined />}
                style={{
                  borderRadius: 6,
                  padding: "4px 12px",
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                未开始
              </Tag>
            )}
            {poll.status === "ended" && (
              <Tag
                icon={<LockOutlined />}
                style={{
                  borderRadius: 6,
                  padding: "4px 12px",
                  fontSize: 13,
                  fontWeight: 500,
                  background: "#f1f5f9",
                  color: "#64748b",
                  border: "1px solid #e2e8f0",
                }}
              >
                已结束
              </Tag>
            )}
            {poll.identity_type === "dingtalk" && (
              <Tag
                color="processing"
                style={{
                  borderRadius: 6,
                  padding: "4px 12px",
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                需钉钉登录
              </Tag>
            )}
            {poll.identity_type === "ip" && (
              <Tag
                color="purple"
                style={{
                  borderRadius: 6,
                  padding: "4px 12px",
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                IP限制
              </Tag>
            )}
            <Tag
              style={{
                borderRadius: 6,
                padding: "4px 12px",
                fontSize: 13,
                fontWeight: 500,
                background: "#f8fafc",
                color: "#475569",
                border: "1px solid #e2e8f0",
              }}
            >
              选择 {poll.min_votes}-{poll.max_votes} 项
            </Tag>
          </Space>
        </div>

        {/* 第二行：时间信息 */}
        <div>
          <Space size={8} wrap>
            <Text style={{ fontSize: 14, color: "#64748b" }}>
              <ClockCircleOutlined style={{ marginRight: 6 }} />
              开始: {poll.start_time ? dayjs(poll.start_time).format("MM-DD HH:mm") : "无限制"}
            </Text>
            <Text style={{ fontSize: 14, color: "#64748b" }}>
              •
            </Text>
            <Text style={{ fontSize: 14, color: "#64748b" }}>
              结束: {poll.end_time ? dayjs(poll.end_time).format("MM-DD HH:mm") : "无限制"}
            </Text>
          </Space>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          padding: 24,
        }}
      >
        <Result
          status="error"
          title="加载失败"
          subTitle={error}
          extra={[
            <Button key="home" onClick={() => navigate("/")}>
              返回首页
            </Button>,
          ]}
        />
        <Footer />
      </div>
    );
  }

  if (!poll) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <Result
          status="404"
          title="投票不存在"
          subTitle="请检查链接是否正确"
          extra={[
            <Button key="home" onClick={() => navigate("/")}>
              返回首页
            </Button>,
          ]}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(to bottom, #fafafa 0%, #ffffff 300px)",
        touchAction: "pan-y",
      }}
    >
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "40px 24px 64px" }}>
        {/* 标题区域 */}
        <div style={{ marginBottom: poll.description ? 28 : 24 }}>
          <Title
            level={1}
            style={{
              fontSize: 32,
              fontWeight: 700,
              lineHeight: 1.2,
              margin: poll.description ? "0 0 10px 0" : 0,
              color: "#0f172a",
              letterSpacing: "-0.02em",
            }}
          >
            {poll.title}
          </Title>
          {poll.description && (
            <Paragraph
              style={{
                fontSize: 16,
                color: "#64748b",
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              {poll.description}
            </Paragraph>
          )}
        </div>

        {renderPollInfo()}

        {/* 查看结果按钮 */}
        {poll.show_results && (
          <div style={{ marginBottom: 20 }}>
            <Button
              icon={<BarChartOutlined />}
              onClick={() => navigate(`/v/${poll.uuid}/results`)}
              style={{
                borderRadius: 8,
                height: 40,
                fontWeight: 500,
                borderColor: "#6366f1",
                color: "#6366f1",
              }}
            >
              查看投票结果
            </Button>
          </div>
        )}

        {renderVoteStatus()}

        {/* 选项列表 */}
        <div style={{ marginBottom: 20 }}>
          {poll.options
            ?.sort((a, b) => a.sort_order - b.sort_order)
            .map(renderOption)}
        </div>

        {/* 投票按钮 */}
        {voteStatus?.can_vote && poll.status === "active" && !modificationToken && (
          <Button
            type="primary"
            size="large"
            block
            loading={voting}
            onClick={handleVote}
            disabled={
              selectedOptions.length < poll.min_votes ||
              selectedOptions.length > poll.max_votes
            }
            style={{
              height: 48,
              fontSize: 16,
              fontWeight: 600,
              borderRadius: 12,
              background:
                selectedOptions.length >= poll.min_votes &&
                selectedOptions.length <= poll.max_votes
                  ? "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)"
                  : undefined,
              border: "none",
            }}
          >
            提交投票
            {selectedOptions.length > 0 &&
              ` (已选 ${selectedOptions.length}/${poll.max_votes})`}
          </Button>
        )}

        {/* 修改投票按钮 */}
        {voteStatus?.can_modify && modificationToken && poll.status === "active" && (
          <div style={{ marginBottom: 24 }}>
            {!isModifying ? (
              <div>
                <Alert
                  message="您已投票"
                  description="您可以修改您的投票"
                  type="info"
                  showIcon
                  style={{
                    marginBottom: 16,
                    borderRadius: 8,
                  }}
                />
                <Button
                  type="primary"
                  size="large"
                  block
                  onClick={() => {
                    setIsModifying(true);
                    // 自动勾选用户已投票的选项
                    if (voteStatus?.voted_option_ids) {
                      setSelectedOptions(voteStatus.voted_option_ids);
                    }
                  }}
                  style={{
                    height: 48,
                    fontSize: 16,
                    fontWeight: 600,
                    borderRadius: 12,
                    background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                    border: "none",
                  }}
                >
                  修改我的投票
                </Button>
              </div>
            ) : (
              <div>
                <Alert
                  message="修改模式"
                  description="请重新选择您的投票选项"
                  type="warning"
                  showIcon
                  style={{
                    marginBottom: 16,
                    borderRadius: 8,
                  }}
                />
                <Space style={{ width: "100%", gap: 12 }}>
                  <Button
                    size="large"
                    onClick={() => {
                      setIsModifying(false);
                      setSelectedOptions([]);
                    }}
                    style={{
                      flex: 1,
                      height: 48,
                      fontSize: 16,
                      fontWeight: 500,
                      borderRadius: 12,
                      borderColor: "#e5e7eb",
                      color: "#64748b",
                    }}
                  >
                    取消修改
                  </Button>
                  <Button
                    type="primary"
                    size="large"
                    loading={voting}
                    onClick={handleModifyVote}
                    disabled={
                      selectedOptions.length < poll.min_votes ||
                      selectedOptions.length > poll.max_votes
                    }
                    style={{
                      flex: 2,
                      height: 48,
                      fontSize: 16,
                      fontWeight: 600,
                      borderRadius: 12,
                      background:
                        selectedOptions.length >= poll.min_votes &&
                        selectedOptions.length <= poll.max_votes
                          ? "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)"
                          : undefined,
                      border: "none",
                    }}
                  >
                    确认修改
                    {selectedOptions.length > 0 &&
                      ` (已选 ${selectedOptions.length}/${poll.max_votes})`}
                  </Button>
                </Space>
              </div>
            )}
          </div>
        )}

        <Footer />
      </div>

      {/* 钉钉登录弹窗 */}
      <Modal
        title="需要钉钉登录"
        open={dingtalkModalVisible}
        closable={false}
        maskClosable={false}
        styles={{
          mask: {
            backdropFilter: "blur(8px)",
            backgroundColor: "rgba(0, 0, 0, 0.45)",
          },
        }}
        footer={[
          poll?.show_results && (
            <Button
              key="results"
              icon={<BarChartOutlined />}
              onClick={() => {
                setDingtalkModalVisible(false);
                navigate(`/v/${poll.uuid}/results`);
              }}
            >
              查看结果
            </Button>
          ),
          <Button key="login" type="primary" onClick={handleDingtalkLogin}>
            钉钉登录
          </Button>,
        ]}
      >
        <p>此投票需要钉钉身份验证才能参与投票。</p>
        {isInDingTalk ? (
          <p>请点击下方按钮进行钉钉登录。</p>
        ) : (
          <p>点击下方按钮将打开钉钉登录页面，请使用钉钉扫码或账号登录。</p>
        )}
        {poll?.show_results && (
          <p style={{ marginTop: 12, color: "#666" }}>
            如果您只想查看投票结果，可以点击"查看结果"按钮。
          </p>
        )}
      </Modal>
    </div>
  );
};

export default VotePage;

