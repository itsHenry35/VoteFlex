import { useState, useEffect } from "react";
import {
  Card,
  Table,
  Button,
  Space,
  Typography,
  Tag,
  Popconfirm,
  message,
  Tooltip,
  Modal,
  Descriptions,
  QRCode,
} from "antd";
import {
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  StopOutlined,
  EyeOutlined,
  LinkOutlined,
  CopyOutlined,
  QrcodeOutlined,
  PlayCircleOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import { userAPI } from "../../api/user";
import { handleResp, handleRespWithNotifySuccess } from "../../utils/handleResp";
import { useIsMobile } from "../../utils/mobile";
import type { Poll } from "../../types";

const { Title, Text, Paragraph } = Typography;

const MyPolls: React.FC = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [loading, setLoading] = useState(false);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [selectedPoll, setSelectedPoll] = useState<Poll | null>(null);

  // 获取投票列表
  const fetchPolls = async (page = currentPage, size = pageSize) => {
    setLoading(true);
    const response = await userAPI.getMyPolls({ page, page_size: size });
    handleResp(
      response,
      (data, pagination) => {
        setPolls(data || []);
        setTotal(pagination?.total || 0);
        setLoading(false);
      },
      () => {
        setLoading(false);
      },
    );
  };

  useEffect(() => {
    fetchPolls();
  }, [currentPage, pageSize]);

  // 删除投票
  const handleDelete = async (poll: Poll) => {
    const response = await userAPI.deletePoll(poll.id);
    handleRespWithNotifySuccess(response, () => {
      fetchPolls();
    });
  };

  // 结束投票
  const handleEnd = async (poll: Poll) => {
    const response = await userAPI.endPoll(poll.id);
    handleRespWithNotifySuccess(response, () => {
      fetchPolls();
    });
  };

  // 重新开启投票
  const handleReopen = async (poll: Poll) => {
    const response = await userAPI.reopenPoll(poll.id);
    handleRespWithNotifySuccess(response, () => {
      fetchPolls();
    });
  };

  // 复制链接
  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    message.success("链接已复制到剪贴板");
  };

  // 打开分享弹窗
  const openShareModal = (poll: Poll) => {
    setSelectedPoll(poll);
    setShareModalVisible(true);
  };

  // 获取投票链接
  const getPollUrl = (poll: Poll, type: "uuid" | "short") => {
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

  // 获取身份验证类型标签
  const getIdentityTag = (type: string) => {
    switch (type) {
      case "dingtalk":
        return <Tag color="blue">钉钉</Tag>;
      case "ip":
        return <Tag color="purple">IP</Tag>;
      default:
        return <Tag color="default">无限制</Tag>;
    }
  };

  const columns = [
    {
      title: "标题",
      dataIndex: "title",
      key: "title",
      ellipsis: true,
      render: (text: string, record: Poll) => (
        <Button type="link" onClick={() => navigate(`/polls/${record.id}`)}>
          {text}
        </Button>
      ),
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (status: string) => getStatusTag(status),
    },
    {
      title: "限制",
      dataIndex: "identity_type",
      key: "identity_type",
      width: 80,
      render: (type: string) => getIdentityTag(type),
    },
    {
      title: "投票人数",
      key: "voter_count",
      width: 90,
      render: (_: unknown, record: Poll) => record.voter_count || 0,
    },
    {
      title: "创建时间",
      dataIndex: "created_at",
      key: "created_at",
      width: 150,
      render: (date: string) => dayjs(date).format("YYYY-MM-DD HH:mm"),
    },
    {
      title: "操作",
      key: "action",
      width: 280,
      render: (_: unknown, record: Poll) => (
        <Space size="small" wrap>
          <Tooltip title="查看详情">
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/polls/${record.id}`)}
            />
          </Tooltip>
          <Tooltip title="分享链接">
            <Button
              size="small"
              icon={<LinkOutlined />}
              onClick={() => openShareModal(record)}
            />
          </Tooltip>
          {record.status === "active" && (
            <Popconfirm
              title="确定要结束此投票吗？"
              description="结束后用户将无法继续投票"
              onConfirm={() => handleEnd(record)}
              okText="确定"
              cancelText="取消"
            >
              <Tooltip title="结束投票">
                <Button size="small" icon={<StopOutlined />} danger />
              </Tooltip>
            </Popconfirm>
          )}
          {record.status === "ended" && (
            <Popconfirm
              title="确定要重新开启此投票吗？"
              description="重新开启后将清除结束时间限制，投票将无限期进行"
              onConfirm={() => handleReopen(record)}
              okText="确定"
              cancelText="取消"
            >
              <Tooltip title="重新开启">
                <Button size="small" type="primary" icon={<PlayCircleOutlined />} />
              </Tooltip>
            </Popconfirm>
          )}
          <Popconfirm
            title="确定删除此投票吗？"
            description="删除后不可恢复"
            onConfirm={() => handleDelete(record)}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>我的投票</Title>
        {isMobile ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              marginTop: 16,
            }}
          >
            <Button
              icon={<ReloadOutlined />}
              onClick={() => fetchPolls()}
              loading={loading}
              size="large"
              style={{ width: "100%" }}
            >
              刷新
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate("/polls/create")}
              size="large"
              style={{ width: "100%" }}
            >
              创建投票
            </Button>
          </div>
        ) : (
          <div style={{ marginTop: 16 }}>
            <Space>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => fetchPolls()}
                loading={loading}
              >
                刷新
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => navigate("/polls/create")}
              >
                创建投票
              </Button>
            </Space>
          </div>
        )}
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={polls}
          rowKey="id"
          loading={loading}
          tableLayout="auto"
          scroll={{ x: "max-content" }}
          pagination={
            isMobile
              ? {
                  current: currentPage,
                  pageSize,
                  total,
                  simple: true,
                  size: "small",
                  onChange: (page, size) => {
                    setCurrentPage(page);
                    setPageSize(size || 10);
                  },
                }
              : {
                  current: currentPage,
                  pageSize,
                  total,
                  showSizeChanger: true,
                  showQuickJumper: true,
                  showTotal: (total) => `共 ${total} 条记录`,
                  onChange: (page, size) => {
                    setCurrentPage(page);
                    setPageSize(size || 10);
                  },
                }
          }
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
        width={500}
      >
        {selectedPoll && (
          <div>
            <Title level={5}>{selectedPoll.title}</Title>
            <Descriptions column={1} size="small" style={{ marginTop: 16 }}>
              <Descriptions.Item label="完整链接">
                <Space>
                  <Text copyable={{ text: getPollUrl(selectedPoll, "uuid") }}>
                    {getPollUrl(selectedPoll, "uuid")}
                  </Text>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="短链接">
                <Space>
                  <Text copyable={{ text: getPollUrl(selectedPoll, "short") }}>
                    {getPollUrl(selectedPoll, "short")}
                  </Text>
                </Space>
              </Descriptions.Item>
            </Descriptions>

            <div style={{ marginTop: 24, textAlign: "center" }}>
              <Title level={5}>
                <QrcodeOutlined /> 二维码
              </Title>
              <QRCode
                value={getPollUrl(selectedPoll, "uuid")}
                size={200}
                style={{ margin: "0 auto" }}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default MyPolls;
