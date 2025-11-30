import { useState, useEffect } from "react";
import {
  Card,
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Typography,
  Popconfirm,
  Row,
  Col,
  Tag,
  Select,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { adminAPI, CreateUserRequest, UpdateUserRequest } from "../../api/admin";
import { User } from "../../types";
import { handleResp, handleRespWithNotifySuccess } from "../../utils/handleResp";
import { useIsMobile } from "../../utils/mobile";

const { Title } = Typography;
const { Search } = Input;

const UserManagement: React.FC = () => {
  const [form] = Form.useForm();
  const isMobile = useIsMobile();

  // 状态管理
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchText, setSearchText] = useState("");

  // 获取用户列表
  const fetchUsers = async (page = currentPage, size = pageSize) => {
    setLoading(true);
    const response = await adminAPI.getUsers({ page, page_size: size });
    handleResp(
      response,
      (data, pagination) => {
        // 如果有搜索文本，在前端过滤
        let filteredData = data || [];
        if (searchText) {
          filteredData = filteredData.filter(
            (user: User) =>
              user.username.toLowerCase().includes(searchText.toLowerCase()) ||
              user.full_name.toLowerCase().includes(searchText.toLowerCase()),
          );
        }
        setUsers(filteredData);
        setTotal(pagination?.total || 0);
        setLoading(false);
      },
      () => {
        setLoading(false);
      },
    );
  };

  useEffect(() => {
    fetchUsers();
  }, [currentPage, pageSize, searchText]);

  // 打开创建/编辑模态框
  const openModal = (user?: User) => {
    setEditingUser(user || null);
    setModalVisible(true);

    if (user) {
      form.setFieldsValue({
        ...user,
        password: undefined,
      });
    } else {
      form.resetFields();
    }
  };

  // 关闭模态框
  const closeModal = () => {
    setModalVisible(false);
    setEditingUser(null);
    form.resetFields();
  };

  // 提交表单
  const handleSubmit = async (values: any) => {
    if (editingUser) {
      // 更新用户
      const updateData: UpdateUserRequest = {
        full_name: values.full_name,
        role: values.role,
        ding_talk_id: values.ding_talk_id || "",
      };

      if (values.password) {
        updateData.password = values.password;
      }

      const response = await adminAPI.updateUser(editingUser.id, updateData);
      handleRespWithNotifySuccess(response, () => {
        closeModal();
        fetchUsers();
      });
    } else {
      // 创建用户
      const createData: CreateUserRequest = {
        username: values.username,
        password: values.password,
        full_name: values.full_name,
        role: values.role,
        ding_talk_id: values.ding_talk_id || "",
      };

      const response = await adminAPI.createUser(createData);
      handleRespWithNotifySuccess(response, () => {
        closeModal();
        fetchUsers();
      });
    }
  };

  // 删除用户
  const handleDelete = async (user: User) => {
    const response = await adminAPI.deleteUser(user.id);
    handleRespWithNotifySuccess(response, () => {
      fetchUsers();
    });
  };

  // 表格列定义
  const columns = [
    {
      title: "用户名",
      dataIndex: "username",
      key: "username",
    },
    {
      title: "姓名",
      dataIndex: "full_name",
      key: "full_name",
    },
    {
      title: "角色",
      dataIndex: "role",
      key: "role",
      render: (role: string) => (
        <Tag color={role === "admin" ? "gold" : "blue"}>
          {role === "admin" ? "管理员" : "普通用户"}
        </Tag>
      ),
    },
    {
      title: "钉钉ID",
      dataIndex: "ding_talk_id",
      key: "ding_talk_id",
      render: (id: string) => (id && id !== "0" ? id : "-"),
    },
    {
      title: "操作",
      key: "action",
      render: (_: unknown, record: User) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => openModal(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除此用户吗？"
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
        <Title level={2}>用户管理</Title>
        {isMobile ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              marginTop: 16,
            }}
          >
            <Search
              placeholder="搜索用户名或姓名"
              allowClear
              onSearch={(value) => {
                setSearchText(value);
                setCurrentPage(1);
              }}
              size="large"
              style={{ width: "100%" }}
            />
            <Button
              icon={<ReloadOutlined />}
              onClick={() => fetchUsers()}
              loading={loading}
              size="large"
              style={{ width: "100%" }}
            >
              刷新
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => openModal()}
              size="large"
              style={{ width: "100%" }}
            >
              新增用户
            </Button>
          </div>
        ) : (
          <div style={{ marginTop: 16 }}>
            <Space wrap>
              <Search
                placeholder="搜索用户名或姓名"
                allowClear
                onSearch={(value) => {
                  setSearchText(value);
                  setCurrentPage(1);
                }}
                style={{ width: 250 }}
              />
              <Button
                icon={<ReloadOutlined />}
                onClick={() => fetchUsers()}
                loading={loading}
              >
                刷新
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => openModal()}
              >
                新增用户
              </Button>
            </Space>
          </div>
        )}
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={users}
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

      {/* 创建/编辑用户模态框 */}
      <Modal
        title={editingUser ? "编辑用户" : "新增用户"}
        open={modalVisible}
        onCancel={closeModal}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          autoComplete="off"
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="用户名"
                name="username"
                rules={[
                  { required: true, message: "请输入用户名" },
                  { min: 3, message: "用户名至少3个字符" },
                  {
                    pattern: /^[a-zA-Z0-9_]+$/,
                    message: "用户名只能包含字母、数字和下划线",
                  },
                ]}
              >
                <Input disabled={!!editingUser} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="姓名"
                name="full_name"
                rules={[
                  { required: true, message: "请输入姓名" },
                  { min: 2, message: "姓名至少2个字符" },
                ]}
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="密码"
                name="password"
                rules={
                  editingUser
                    ? [{ min: 6, message: "密码至少6个字符" }]
                    : [
                        { required: true, message: "请输入密码" },
                        { min: 6, message: "密码至少6个字符" },
                      ]
                }
              >
                <Input.Password
                  placeholder={editingUser ? "留空表示不修改" : ""}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="角色"
                name="role"
                rules={[{ required: true, message: "请选择角色" }]}
                initialValue="user"
              >
                <Select>
                  <Select.Option value="user">普通用户</Select.Option>
                  <Select.Option value="admin">管理员</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="钉钉ID" name="ding_talk_id">
            <Input placeholder="可选" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: "right" }}>
            <Space>
              <Button onClick={closeModal}>取消</Button>
              <Button type="primary" htmlType="submit">
                {editingUser ? "更新" : "创建"}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default UserManagement;
