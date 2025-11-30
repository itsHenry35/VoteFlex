import { BrowserRouter } from "react-router-dom";
import { ConfigProvider, theme } from "antd";
import zhCN from "antd/locale/zh_CN";
import { AuthProvider } from "./contexts/AuthContext";
import { WebsiteProvider } from "./contexts/WebsiteContext";
import AppRouter from "./router/AppRouter";
import "./App.css";

// 打印项目信息
console.log(
  "%c🗳️ VoteFlex %c  投票系统  %c",
  "color: #fff; background: #1677ff",
  "color: #fff; background: #3F3F3F",
  "",
);

const App: React.FC = () => {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.defaultAlgorithm,
      }}
    >
      <BrowserRouter>
        <WebsiteProvider>
          <AuthProvider>
            <AppRouter />
          </AuthProvider>
        </WebsiteProvider>
      </BrowserRouter>
    </ConfigProvider>
  );
};

export default App;
