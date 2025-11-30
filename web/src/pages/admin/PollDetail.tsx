import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Card,
  Typography,
  Button,
  Space,
  Descriptions,
  Tag,
  Table,
  Spin,
  Result,
  Modal,
  Popconfirm,
  Progress,
  QRCode,
  Image,
  message,
  Input,
} from "antd";
import {
  LeftOutlined,
  StopOutlined,
  DeleteOutlined,
  LinkOutlined,
  QrcodeOutlined,
  SoundOutlined,
  VideoCameraOutlined,
  EditOutlined,
  PlayCircleOutlined,
  SettingOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { userAPI } from "../../api/user";
import { handleResp, handleRespWithNotifySuccess } from "../../utils/handleResp";
import type { Poll, VoteRecord } from "../../types";

const { Title, Text } = Typography;

const PollDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [poll, setPoll] = useState<Poll | null>(null);
  const [records, setRecords] = useState<VoteRecord[]>([]);
  const [recordsTotal, setRecordsTotal] = useState(0);
  const [recordsPage, setRecordsPage] = useState(1);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shortCodeInput, setShortCodeInput] = useState("");
  const [shortCodeSaving, setShortCodeSaving] = useState(false);
  const [shortCodeModalVisible, setShortCodeModalVisible] = useState(false);

  // 获取投票详情
  const fetchPoll = async () => {
    if (!id) return;
    setLoading(true);
    const response = await userAPI.getMyPoll(parseInt(id));
    handleResp(
      response,
      (data) => {
        setPoll(data);
        fetchRecords(data.id);
        setLoading(false);
      },
      (message) => {
        setError(message);
        setLoading(false);
      },
    );
  };

  // 获取投票记录
  const fetchRecords = async (pollId: number, page = 1) => {
    setRecordsLoading(true);
    const response = await userAPI.getVoteRecords(pollId, {
      page,
      page_size: 10,
    });
    handleResp(
      response,
      (data, pagination) => {
        setRecords(data || []);
        setRecordsTotal(pagination?.total || 0);
        setRecordsLoading(false);
      },
      () => {
        setRecordsLoading(false);
      },
    );
  };

  useEffect(() => {
    fetchPoll();
  }, [id]);

  // 删除投票
  const handleDelete = async () => {
    if (!poll) return;
    const response = await userAPI.deletePoll(poll.id);
    handleRespWithNotifySuccess(response, () => {
      navigate("/polls");
    });
  };

  // 结束投票
  const handleEnd = async () => {
    if (!poll) return;
    const response = await userAPI.endPoll(poll.id);
    handleRespWithNotifySuccess(response, () => {
      fetchPoll();
    });
  };

  // 重新开启投票
  const handleReopen = async () => {
    if (!poll) return;
    const response = await userAPI.reopenPoll(poll.id);
    handleRespWithNotifySuccess(response, () => {
      fetchPoll();
    });
  };

  // 设置短链接
  const handleSetShortCode = async () => {
    if (!poll || !shortCodeInput.trim()) {
      message.warning("请输入短链接");
      return;
    }

    // 验证短链接格式
    if (!/^[a-zA-Z0-9_-]{3,20}$/.test(shortCodeInput)) {
      message.error("短链接只能包含字母、数字、下划线和连字符，长度3-20位");
      return;
    }

    setShortCodeSaving(true);
    const response = await userAPI.setShortCode(poll.id, shortCodeInput);
    handleRespWithNotifySuccess(
      response,
      (updatedPoll) => {
        setPoll(updatedPoll);
        setShortCodeInput("");
        setShortCodeSaving(false);
        setShortCodeModalVisible(false);
      },
      () => {
        setShortCodeSaving(false);
      }
    );
  };

  // 获取投票链接
  const getPollUrl = (type: "uuid" | "short") => {
    if (!poll) return "";
    const baseUrl = window.location.origin;
    return type === "uuid"
      ? `${baseUrl}/v/${poll.uuid}`
      : `${baseUrl}/s/${poll.short_code}`;
  };

  // 获取状态标签
  const getStatusTag = (status: string) => {
    switch (status) {
      case "active":
        return <Tag color="green">进行中</Tag>;
      case "pending":
        return <Tag color="orange">未开始</Tag>;
      case "ended":
        return <Tag color="default">已结束</Tag>;
      case "canceled":
        return <Tag color="red">已取消</Tag>;
      default:
        return <Tag>{status}</Tag>;
    }
  };

  // 获取身份验证类型文本
  const getIdentityText = (type: string) => {
    switch (type) {
      case "dingtalk":
        return "钉钉登录";
      case "ip":
        return "IP限制";
      default:
        return "无限制";
    }
  };

  // 获取频率类型文本
  const getFrequencyText = (poll: Poll) => {
    switch (poll.frequency_type) {
      case "total":
        return `共计 ${poll.frequency_max} 次`;
      case "hourly":
        return `每 ${poll.frequency_n} 小时 ${poll.frequency_max} 次`;
      case "daily":
        return `每 ${poll.frequency_n} 天 ${poll.frequency_max} 次`;
      default:
        return "无限制";
    }
  };

  // 投票记录表格列
  const recordColumns = [
    {
      title: "选项",
      dataIndex: "option_id",
      key: "option_id",
      render: (optionId: number) => {
        const option = poll?.options && poll.options.find((o) => o.id === optionId);
        if (!option) return optionId;
        return option.text || `选项 #${poll?.options && poll.options.indexOf(option)! + 1}`;
      },
    },
    {
      title: "用户标识",
      dataIndex: "identifier",
      key: "identifier",
      render: (identifier: string) => identifier || "-",
    },
    {
      title: "投票时间",
      dataIndex: "created_at",
      key: "created_at",
      render: (date: string) => dayjs(date).format("YYYY-MM-DD HH:mm:ss"),
    },
  ];

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "50vh",
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  if (error || !poll) {
    return (
      <Result
        status="error"
        title="加载失败"
        subTitle={error || "投票不存在"}
        extra={[
          <Button key="back" onClick={() => navigate("/polls")}>
            返回列表
          </Button>,
        ]}
      />
    );
  }

  // 计算总票数
  const totalVotes = poll.options?.reduce((sum, o) => sum + o.vote_count, 0) || 0;

  return (
    <div>
      {/* 返回按钮 */}
      <Button
        icon={<LeftOutlined />}
        onClick={() => navigate("/polls")}
        style={{ marginBottom: 16 }}
      >
        返回列表
      </Button>

      {/* 基本信息 */}
      <Card style={{ marginBottom: 24 }}>
        <Space
          style={{
            width: "100%",
            justifyContent: "space-between",
            flexWrap: "wrap",
          }}
        >
          <Title level={3} style={{ margin: 0 }}>
            {poll.title}
          </Title>
          <Space wrap>
            <Button
              icon={<EditOutlined />}
              onClick={() => navigate(`/polls/${poll.id}/edit`)}
            >
              编辑投票
            </Button>
            <Button
              type="primary"
              icon={<UnorderedListOutlined />}
              onClick={() => navigate(`/polls/${poll.id}/options`)}
            >
              编辑选项
            </Button>
            <Button
              icon={<LinkOutlined />}
              onClick={() => setShareModalVisible(true)}
            >
              分享链接
            </Button>
            {poll.status === "active" && (
              <Popconfirm
                title="确定要结束此投票吗？"
                description="结束后用户将无法继续投票"
                onConfirm={handleEnd}
                okText="确定"
                cancelText="取消"
              >
                <Button icon={<StopOutlined />} danger>
                  结束投票
                </Button>
              </Popconfirm>
            )}
            {poll.status === "ended" && (
              <Popconfirm
                title="确定要重新开启此投票吗？"
                description="重新开启后将清除结束时间限制，投票将无限期进行"
                onConfirm={handleReopen}
                okText="确定"
                cancelText="取消"
              >
                <Button icon={<PlayCircleOutlined />} type="primary">
                  重新开启
                </Button>
              </Popconfirm>
            )}
            <Popconfirm
              title="确定删除此投票吗？"
              description="删除后不可恢复"
              onConfirm={handleDelete}
              okText="确定"
              cancelText="取消"
            >
              <Button danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          </Space>
        </Space>

        {poll.description && (
          <Text type="secondary" style={{ display: "block", marginTop: 8 }}>
            {poll.description}
          </Text>
        )}

        <Descriptions column={{ xs: 1, sm: 2, md: 3 }} style={{ marginTop: 24 }}>
          <Descriptions.Item label="状态">
            {getStatusTag(poll.status)}
          </Descriptions.Item>
          <Descriptions.Item label="身份验证">
            {getIdentityText(poll.identity_type)}
          </Descriptions.Item>
          <Descriptions.Item label="投票频率">
            {getFrequencyText(poll)}
          </Descriptions.Item>
          <Descriptions.Item label="选择范围">
            {poll.min_votes} - {poll.max_votes} 项
          </Descriptions.Item>
          <Descriptions.Item label="公开结果">
            {poll.show_results ? "是" : "否"}
          </Descriptions.Item>
          <Descriptions.Item label="总票数">{totalVotes}</Descriptions.Item>
          <Descriptions.Item label="开始时间">
            {poll.start_time
              ? dayjs(poll.start_time).format("YYYY-MM-DD HH:mm")
              : "无限制"}
          </Descriptions.Item>
          <Descriptions.Item label="结束时间">
            {poll.end_time
              ? dayjs(poll.end_time).format("YYYY-MM-DD HH:mm")
              : "无限制"}
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {dayjs(poll.created_at).format("YYYY-MM-DD HH:mm")}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 选项列表 */}
      <Card title="投票选项" style={{ marginBottom: 24 }}>
        {poll.options
          ?.sort((a, b) => a.sort_order - b.sort_order)
          .map((option, index) => (
            <Card key={option.id} size="small" style={{ marginBottom: 16 }}>
              <Space direction="vertical" style={{ width: "100%" }}>
                <Space>
                  <Tag>#{index + 1}</Tag>
                  {option.text && <Text strong>{option.text}</Text>}
                </Space>

                {/* 媒体内容 */}
                {option.image_url && (
                  <Image
                    src={option.image_url}
                    alt={option.text}
                    style={{ maxHeight: 150 }}
                  />
                )}
                {option.audio_url && (
                  <Space>
                    <SoundOutlined />
                    <audio controls src={option.audio_url} />
                  </Space>
                )}
                {option.video_url && (
                  <Space direction="vertical">
                    <Space>
                      <VideoCameraOutlined />
                      <Text type="secondary">视频</Text>
                    </Space>
                    <video
                      controls
                      src={option.video_url}
                      style={{ maxWidth: "100%", maxHeight: 200 }}
                    />
                  </Space>
                )}

                <Progress
                  percent={
                    totalVotes > 0
                      ? Math.round((option.vote_count / totalVotes) * 100)
                      : 0
                  }
                  format={() => `${option.vote_count} 票`}
                />
              </Space>
            </Card>
          ))}
      </Card>

      {/* 投票记录 */}
      <Card title="投票记录">
        <Table
          columns={recordColumns}
          dataSource={records}
          rowKey="id"
          loading={recordsLoading}
          pagination={{
            current: recordsPage,
            total: recordsTotal,
            pageSize: 10,
            onChange: (page) => {
              setRecordsPage(page);
              fetchRecords(poll.id, page);
            },
          }}
        />
      </Card>

      {/* 分享弹窗 */}
      <Modal
        title="分享投票"
        open={shareModalVisible}
        onCancel={() => setShareModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setShareModalVisible(false)}>
            关闭
          </Button>,
        ]}
        width={600}
      >
        <Descriptions column={1} size="small" style={{ marginTop: 16 }}>
          <Descriptions.Item label="完整链接">
            <Text copyable={{ text: getPollUrl("uuid") }}>
              {getPollUrl("uuid")}
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="短链接">
            {poll?.short_code ? (
              <Space>
                <Text copyable={{ text: getPollUrl("short") }}>
                  {getPollUrl("short")}
                </Text>
                <Button
                  size="small"
                  icon={<SettingOutlined />}
                  onClick={() => setShortCodeModalVisible(true)}
                >
                  修改
                </Button>
              </Space>
            ) : (
              <Button
                type="primary"
                icon={<SettingOutlined />}
                onClick={() => setShortCodeModalVisible(true)}
              >
                设置短链接
              </Button>
            )}
          </Descriptions.Item>
        </Descriptions>

        <div style={{ marginTop: 24, textAlign: "center" }}>
          <Title level={5}>
            <QrcodeOutlined /> 二维码
          </Title>
          <QRCode
            value={getPollUrl("uuid")}
            size={200}
            style={{ margin: "0 auto" }}
          />
        </div>
      </Modal>

      {/* 短链接设置/修改弹窗 */}
      <Modal
        title={poll?.short_code ? "修改短链接" : "设置短链接"}
        open={shortCodeModalVisible}
        onCancel={() => {
          setShortCodeModalVisible(false);
          setShortCodeInput("");
        }}
        footer={[
          <Button
            key="cancel"
            onClick={() => {
              setShortCodeModalVisible(false);
              setShortCodeInput("");
            }}
          >
            取消
          </Button>,
          <Button
            key="submit"
            type="primary"
            onClick={handleSetShortCode}
            loading={shortCodeSaving}
          >
            {poll?.short_code ? "修改" : "设置"}
          </Button>,
        ]}
      >
        <div style={{ marginTop: 16 }}>
          {poll?.short_code && (
            <div style={{ marginBottom: 16 }}>
              <Text type="secondary">
                当前短链接：<Text strong>{poll.short_code}</Text>
              </Text>
            </div>
          )}
          <Space.Compact style={{ width: "100%" }}>
            <Input
              placeholder="输入自定义短链接"
              value={shortCodeInput}
              onChange={(e) => setShortCodeInput(e.target.value)}
              maxLength={20}
              onPressEnter={handleSetShortCode}
              autoFocus
            />
          </Space.Compact>
        </div>
      </Modal>
    </div>
  );
};

export default PollDetail;
