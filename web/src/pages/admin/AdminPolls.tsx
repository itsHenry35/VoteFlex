import { useState, useEffect } from "react";
import {
  Card,
  Table,
  Button,
  Space,
  Typography,
  Tag,
  Popconfirm,
} from "antd";
import {
  ReloadOutlined,
  DeleteOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import { adminAPI } from "../../api/admin";
import { handleResp, handleRespWithNotifySuccess } from "../../utils/handleResp";
import { useIsMobile } from "../../utils/mobile";
import type { Poll } from "../../types";

const { Title } = Typography;

const AdminPolls: React.FC = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [loading, setLoading] = useState(false);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // 获取投票列表
  const fetchPolls = async (page = currentPage, size = pageSize) => {
    setLoading(true);
    const response = await adminAPI.getPolls({ page, page_size: size });
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
    const response = await adminAPI.deletePoll(poll.id);
    handleRespWithNotifySuccess(response, () => {
      fetchPolls();
    });
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

  const columns = [
    {
      title: "ID",
      dataIndex: "id",
      key: "id",
      width: 80,
    },
    {
      title: "标题",
      dataIndex: "title",
      key: "title",
      ellipsis: true,
    },
    {
      title: "创建者",
      dataIndex: ["creator", "full_name"],
      key: "creator",
      width: 100,
      render: (name: string, record: Poll) => name || record.creator?.username || "-",
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (status: string) => getStatusTag(status),
    },
    {
      title: "选项数",
      key: "options",
      width: 80,
      render: (_: unknown, record: Poll) => record.options?.length || 0,
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
      width: 150,
      render: (_: unknown, record: Poll) => (
        <Space size="small">
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => window.open(`/v/${record.uuid}`, "_blank")}
          >
            查看
          </Button>
          <Popconfirm
            title="确定删除此投票吗？"
            description="删除后不可恢复"
            onConfirm={() => handleDelete(record)}
            okText="确定"
            cancelText="取消"
          >
            <Button size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>所有投票</Title>
        <div style={{ marginTop: 16 }}>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => fetchPolls()}
            loading={loading}
          >
            刷新
          </Button>
        </div>
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
    </div>
  );
};

export default AdminPolls;
