import React, { useState, Suspense } from "react";
import {
  Layout as AntLayout,
  Menu,
  Button,
  Dropdown,
  Avatar,
  Typography,
  Space,
  Drawer,
} from "antd";
import { Routes, Route, useNavigate, useLocation, Navigate } from "react-router-dom";
import {
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PlusOutlined,
  UnorderedListOutlined,
  TeamOutlined,
  SettingOutlined,
  BarChartOutlined,
} from "@ant-design/icons";
import { useAuth } from "../contexts/AuthContext";
import { useWebsite } from "../contexts/WebsiteContext";
import { useIsMobile } from "../utils";
import Footer from "../components/Footer";
import LoadingSpinner from "../components/Spinner";

// 懒加载组件
const MyPolls = React.lazy(() => import("../pages/admin/MyPolls"));
const CreatePoll = React.lazy(() => import("../pages/admin/CreatePoll"));
const EditPoll = React.lazy(() => import("../pages/admin/EditPoll"));
const EditOptions = React.lazy(() => import("../pages/admin/EditOptions"));
const PollDetail = React.lazy(() => import("../pages/admin/PollDetail"));
const AdminPolls = React.lazy(() => import("../pages/admin/AdminPolls"));
const UserManagement = React.lazy(() => import("../pages/admin/UserManagement"));
const Settings = React.lazy(() => import("../pages/admin/Settings"));

const { Header, Sider, Content } = AntLayout;
const { Title, Text } = Typography;

const Layout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAdmin } = useAuth();
  const { name: websiteName } = useWebsite();
  const [collapsed, setCollapsed] = useState(false);
  const [openKeys, setOpenKeys] = useState<string[]>([]);
  const isMobile = useIsMobile();
  const [drawerVisible, setDrawerVisible] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // 构建菜单项
  const getMenuItems = () => {
    const items = [
      {
        key: "/polls",
        icon: <UnorderedListOutlined />,
        label: "我的投票",
      },
      {
        key: "/polls/create",
        icon: <PlusOutlined />,
        label: "创建投票",
      },
    ];

    // 管理员菜单
    if (isAdmin) {
      items.push(
        {
          key: "/admin/polls",
          icon: <BarChartOutlined />,
          label: "所有投票",
        },
        {
          key: "/admin/users",
          icon: <TeamOutlined />,
          label: "用户管理",
        },
        {
          key: "/admin/settings",
          icon: <SettingOutlined />,
          label: "系统设置",
        },
      );
    }

    return items;
  };

  const menuItems = getMenuItems();

  const userMenu = {
    items: [
      {
        key: "logout",
        icon: <LogoutOutlined />,
        label: "退出登录",
        onClick: handleLogout,
      },
    ],
  };

  const getSelectedKeys = () => {
    // 特殊处理投票详情页面和编辑页面
    if (location.pathname.match(/^\/polls\/\d+(\/edit)?$/)) {
      return ["/polls"];
    }
    return [location.pathname];
  };

  // 初始化时设置默认展开的菜单
  React.useEffect(() => {
    // 移动端路由变化时关闭抽屉
    if (isMobile) {
      setDrawerVisible(false);
    }
  }, [location.pathname, isMobile]);

  const handleOpenChange = (keys: string[]) => {
    setOpenKeys(keys);
  };

  const handleMenuToggle = () => {
    if (isMobile) {
      setDrawerVisible(!drawerVisible);
    } else {
      setCollapsed(!collapsed);
    }
  };

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
    if (isMobile) {
      setDrawerVisible(false);
    }
  };

  const roleText = isAdmin ? "管理员" : "普通用户";

  return (
    <AntLayout style={{ minHeight: "100vh" }}>
      <Header
        style={{
          position: "fixed",
          top: 0,
          width: "100%",
          zIndex: 1000,
          padding: "0 24px",
          background: "#fff",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", flex: 1 }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={handleMenuToggle}
            style={{ marginRight: 16 }}
          />
          <Title
            level={4}
            style={{
              margin: 0,
              whiteSpace: "nowrap",
              fontSize: isMobile ? "16px" : "20px",
              textAlign: "left",
              flex: 1,
            }}
          >
            {websiteName}
          </Title>
        </div>

        <Dropdown menu={userMenu} placement="bottomRight">
          <Space style={{ cursor: "pointer" }}>
            {isMobile ? null : <Avatar icon={<UserOutlined />} />}
            <div>
              <div style={{ lineHeight: "20px" }}>
                <Text strong style={{ fontSize: "14px", whiteSpace: "nowrap" }}>
                  {user?.full_name}
                </Text>
              </div>
              <div style={{ lineHeight: "16px" }}>
                <Text
                  type="secondary"
                  style={{ fontSize: "12px", whiteSpace: "nowrap" }}
                >
                  {roleText}
                </Text>
              </div>
            </div>
          </Space>
        </Dropdown>
      </Header>

      <AntLayout style={{ marginTop: 64 }}>
        {/* 移动端抽屉菜单 */}
        {isMobile ? (
          <Drawer
            title={websiteName}
            placement="left"
            onClose={() => setDrawerVisible(false)}
            open={drawerVisible}
            width={280}
            styles={{ body: { padding: 0 } }}
          >
            <Menu
              mode="inline"
              selectedKeys={getSelectedKeys()}
              openKeys={openKeys}
              onOpenChange={handleOpenChange}
              items={menuItems}
              onClick={handleMenuClick}
              style={{ border: 0 }}
            />
          </Drawer>
        ) : (
          <Sider
            collapsible
            collapsed={collapsed}
            trigger={null}
            width={256}
            theme="light"
            style={{
              boxShadow: "2px 0 8px rgba(0,0,0,0.1)",
              height: "calc(100vh - 64px)",
              overflow: "auto",
              position: "fixed",
              left: 0,
              top: 64,
            }}
          >
            <Menu
              mode="inline"
              selectedKeys={getSelectedKeys()}
              openKeys={openKeys}
              onOpenChange={handleOpenChange}
              items={menuItems}
              onClick={({ key }) => navigate(key)}
              style={{ borderRight: 0 }}
            />
          </Sider>
        )}

        <AntLayout
          style={{
            marginLeft: isMobile ? 0 : collapsed ? 80 : 256,
            transition: "margin-left 0.2s",
          }}
        >
          <Content
            style={{
              padding: isMobile ? "16px" : "24px",
              background: "#f5f5f5",
              minHeight: "calc(100vh - 64px - 70px)",
            }}
          >
            <Suspense fallback={<LoadingSpinner />}>
              <Routes>
                <Route path="/polls" element={<MyPolls />} />
                <Route path="/polls/create" element={<CreatePoll />} />
                <Route path="/polls/:id/edit" element={<EditPoll />} />
                <Route path="/polls/:id/options" element={<EditOptions />} />
                <Route path="/polls/:id" element={<PollDetail />} />
                {isAdmin && (
                  <>
                    <Route path="/admin/polls" element={<AdminPolls />} />
                    <Route path="/admin/users" element={<UserManagement />} />
                    <Route path="/admin/settings" element={<Settings />} />
                  </>
                )}
                <Route path="*" element={<Navigate to="/polls" replace />} />
              </Routes>
            </Suspense>
          </Content>

          <Footer />
        </AntLayout>
      </AntLayout>
    </AntLayout>
  );
};

export default Layout;
