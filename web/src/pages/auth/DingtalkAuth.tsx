import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button, Result, Spin } from "antd";
import { LoadingOutlined } from "@ant-design/icons";
import { authAPI } from "../../api/auth";
import { handleRespWithoutAuthAndNotify } from "../../utils/handleResp";
import { useAuth } from "../../contexts/AuthContext";
import { useWebsite } from "../../contexts/WebsiteContext";
import Footer from "../../components/Footer";
import { message } from "antd";
import * as dd from "dingtalk-jsapi";

const DingtalkAuth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, isAuthenticated } = useAuth();
  const { dingtalk_corp_id, dingtalk_client_id } = useWebsite();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 检查是否在钉钉客户端中
  const isInDingTalk = dd.env.platform !== "notInDingTalk";

  // 处理登录请求
  const handleLogin = useCallback(async (code: string) => {
    setLoading(true);
    const response = await authAPI.dingTalkLogin({ code });

    handleRespWithoutAuthAndNotify(
      response,
      (data) => {
        if (data.token && data.user) {
          login(data.user, data.token);
          message.success("登录成功");
          navigate("/polls");
        } else {
          throw new Error("登录返回数据格式错误");
        }
      },
      (msg) => {
        const errorMessage = msg || "钉钉登录失败";
        setError("登录失败：" + errorMessage);
        setLoading(false);
        message.error(errorMessage);
        throw new Error(errorMessage);
      },
    );
  }, [login, navigate]);

  // 处理SSO回调的URL参数
  useEffect(() => {
    const dingtalkToken = searchParams.get("dingtalk_token");
    const dingtalkUserStr = searchParams.get("dingtalk_user");
    const dingtalkError = searchParams.get("dingtalk_error");

    if (dingtalkToken && dingtalkUserStr) {
      try {
        // 解析用户信息
        const dingtalkUser = JSON.parse(decodeURIComponent(dingtalkUserStr));

        // 使用token和用户信息登录，更新AuthContext
        login(dingtalkUser, dingtalkToken);
        message.success("登录成功");

        // 导航到投票列表
        navigate("/polls");
      } catch (err) {
        setError("登录失败：用户信息解析错误");
        setLoading(false);
      }
      return;
    }

    if (dingtalkError) {
      setError("登录失败：" + dingtalkError);
      setLoading(false);
      return;
    }
  }, [searchParams, navigate, login]);

  useEffect(() => {
    // 如果已登录，重定向到投票列表
    if (isAuthenticated) {
      navigate("/polls");
      return;
    }

    // 如果有URL参数，已在上面处理
    if (searchParams.get("dingtalk_token") || searchParams.get("dingtalk_error")) {
      return;
    }

    // 如果在钉钉客户端中
    if (isInDingTalk) {
      // 检查是否配置了钉钉企业ID
      if (!dingtalk_corp_id) {
        setError("未配置钉钉登录");
        setLoading(false);
        return;
      }

      // 获取钉钉免登授权码
      const getAuthCode = async () => {
        try {
          // 钉钉免登
          dd.ready(() => {
            dd.runtime.permission
              .requestAuthCode({
                corpId: dingtalk_corp_id,
              })
              .then((res) => {
                if (res.code) {
                  // 使用授权码进行登录
                  handleLogin(res.code).catch(() => {
                    setLoading(false);
                  });
                } else {
                  setError("获取钉钉授权码失败");
                  setLoading(false);
                }
              })
              .catch(() => {
                setError("获取钉钉授权码失败");
                setLoading(false);
              });
          });

          dd.error(() => {
            setError("钉钉初始化失败，请重试");
            setLoading(false);
          });
        } catch (err) {
          setError(
            "认证失败，请重试：" +
              (err instanceof Error ? err.message : "未知错误"),
          );
          setLoading(false);
        }
      };

      getAuthCode();
    } else {
      // 不在钉钉客户端中，使用SSO redirect方式
      if (!dingtalk_client_id) {
        setError("未配置钉钉SSO登录");
        setLoading(false);
        return;
      }

      // 直接重定向到SSO登录
      const ssoUrl = `/api/public/dingtalk/sso_redirect?method=sso_get_token&redirect=/login`;
      window.location.href = ssoUrl;
    }
  }, [dingtalk_corp_id, dingtalk_client_id, isAuthenticated, isInDingTalk, handleLogin, navigate, searchParams]);

  // 返回登录页
  const handleBackToLogin = () => {
    navigate("/login");
  };

  // 重试SSO登录
  const handleRetrySSO = () => {
    if (!dingtalk_client_id) {
      setError("未配置钉钉SSO登录");
      return;
    }
    const ssoUrl = `/api/public/dingtalk/sso_redirect?method=sso_get_token&redirect=/login`;
    window.location.href = ssoUrl;
  };

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
          <p>钉钉授权登录中...</p>
          {!isInDingTalk && (
            <p style={{ color: "#999", fontSize: 12 }}>
              正在跳转到钉钉登录页面...
            </p>
          )}
        </div>
        <div
          style={{ position: "fixed", bottom: 0, left: 0, right: 0 }}
        >
          <Footer />
        </div>
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
        }}
      >
        <Result
          status="error"
          title="登录失败"
          subTitle={error}
          extra={[
            <Button type="primary" key="login" onClick={handleBackToLogin}>
              返回登录页
            </Button>,
            !isInDingTalk && dingtalk_client_id && (
              <Button key="retry" onClick={handleRetrySSO}>
                重试钉钉登录
              </Button>
            ),
          ].filter(Boolean)}
        />
        <div
          style={{ position: "fixed", bottom: 0, left: 0, right: 0 }}
        >
          <Footer />
        </div>
      </div>
    );
  }

  return null;
};

export default DingtalkAuth;
