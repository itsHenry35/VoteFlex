import React, { Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import LoadingSpinner from "../components/Spinner";

// 懒加载组件
const Login = React.lazy(() => import("../pages/auth/Login"));
const DingtalkAuth = React.lazy(() => import("../pages/auth/DingtalkAuth"));
const VotePage = React.lazy(() => import("../pages/public/VotePage"));
const VoteResults = React.lazy(() => import("../pages/public/VoteResults"));
const Layout = React.lazy(() => import("./Layout"));

// 路由守卫组件
interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  requireAdmin?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAuth = false,
  requireAdmin = false,
}) => {
  const { isAuthenticated, isAdmin } = useAuth();

  // 需要认证但未登录
  if (requireAuth && !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // 需要管理员权限但不是管理员
  if (requireAdmin && !isAdmin) {
    return <Navigate to="/polls" replace />;
  }

  return <>{children}</>;
};

const AppRouter: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        {/* 公共投票路由 - 通过UUID或短链接访问 */}
        <Route path="/v/:uuid" element={<VotePage />} />
        <Route path="/s/:code" element={<VotePage />} />
        <Route path="/v/:uuid/results" element={<VoteResults />} />

        {/* 登录页面 */}
        <Route
          path="/login"
          element={
            isAuthenticated ? <Navigate to="/polls" replace /> : <Login />
          }
        />

        {/* 钉钉登录页面 */}
        <Route path="/auth/dingtalk" element={<DingtalkAuth />} />

        {/* 用户路由 */}
        <Route
          path="/*"
          element={
            <ProtectedRoute requireAuth>
              <Layout />
            </ProtectedRoute>
          }
        />

        {/* 根路径重定向 */}
        <Route path="/" element={<Navigate to="/polls" replace />} />
      </Routes>
    </Suspense>
  );
};

export default AppRouter;
