import { useState, useEffect } from "react";
import {
  Card,
  Form,
  Input,
  Button,
  Typography,
  Row,
  Col,
  Spin,
  Alert,
  Divider,
  Switch,
} from "antd";
import { SaveOutlined, ReloadOutlined } from "@ant-design/icons";
import { adminAPI } from "../../api/admin";
import { handleResp, handleRespWithNotifySuccess } from "../../utils/handleResp";
import { useWebsite } from "../../contexts/WebsiteContext";
import { useIsMobile } from "../../utils/mobile";

const { Title, Text } = Typography;

const Settings: React.FC = () => {
  const [form] = Form.useForm();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { refresh: refreshWebsiteInfo } = useWebsite();

  const fetchSettings = async () => {
    setLoading(true);
    const response = await adminAPI.getSettings();
    handleResp(
      response,
      (data) => {
        form.setFieldsValue({
          "dingtalk.app_key": data?.dingtalk.app_key,
          "dingtalk.app_secret": data?.dingtalk.app_secret,
          "dingtalk.agent_id": data?.dingtalk.agent_id,
          "dingtalk.corp_id": data?.dingtalk.corp_id,
          "dingtalk.self_register": data?.dingtalk.self_register,
          "website.name": data?.website.name,
          "website.icp_beian": data?.website.icp_beian,
          "website.public_sec_beian": data?.website.public_sec_beian,
          "website.domain": data?.website.domain,
        });
        setLoading(false);
      },
      () => {
        setLoading(false);
      },
    );
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (values: any) => {
    setSaving(true);

    const updateData = {
      dingtalk: {
        app_key: values["dingtalk.app_key"] || "",
        app_secret: values["dingtalk.app_secret"] || "",
        agent_id: values["dingtalk.agent_id"] || "",
        corp_id: values["dingtalk.corp_id"] || "",
        self_register: values["dingtalk.self_register"] || false,
      },
      website: {
        name: values["website.name"] || "",
        icp_beian: values["website.icp_beian"] || "",
        public_sec_beian: values["website.public_sec_beian"] || "",
        domain: values["website.domain"] || "",
      },
    };

    const response = await adminAPI.updateSettings(updateData);
    handleRespWithNotifySuccess(
      response,
      async () => {
        fetchSettings();
        await refreshWebsiteInfo();
        setSaving(false);
      },
      () => {
        setSaving(false);
      },
    );
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>系统设置</Title>
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
              onClick={fetchSettings}
              loading={loading}
              size="large"
              style={{ width: "100%" }}
            >
              刷新
            </Button>
          </div>
        ) : (
          <div style={{ marginTop: 16 }}>
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchSettings}
              loading={loading}
            >
              刷新
            </Button>
          </div>
        )}
      </div>

      <Spin spinning={loading}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          autoComplete="off"
        >
          {/* 网站设置 */}
          <Card title="网站设置" style={{ marginBottom: 24 }}>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  label="网站名称"
                  name="website.name"
                  rules={[{ required: true, message: "请输入网站名称" }]}
                >
                  <Input />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="域名" name="website.domain">
                  <Input placeholder="如：example.com" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item label="ICP备案号" name="website.icp_beian">
                  <Input placeholder="如：京ICP备12345678号" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="公安备案号" name="website.public_sec_beian">
                  <Input placeholder="如：京公网安备11010802012345号" />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          {/* 钉钉设置 */}
          <Card title="钉钉设置" style={{ marginBottom: 24 }}>
            <Alert
              message="钉钉设置说明"
              description={
                <>
                  配置钉钉登录需要在
                  <a
                    href="https://open-dev.dingtalk.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    钉钉开发者后台
                  </a>
                  创建应用并获取相关参数
                </>
              }
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />

            <Divider orientation="left">
              <Text type="secondary">企业内部应用（钉钉客户端免登）</Text>
            </Divider>

            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item label="App Key" name="dingtalk.app_key">
                  <Input.Password placeholder="钉钉应用的AppKey" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="App Secret" name="dingtalk.app_secret">
                  <Input.Password placeholder="钉钉应用的AppSecret" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item label="Agent ID" name="dingtalk.agent_id">
                  <Input placeholder="钉钉应用的AgentId" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="Corp ID" name="dingtalk.corp_id">
                  <Input placeholder="钉钉企业的CorpId" />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              label="允许钉钉自助注册"
              name="dingtalk.self_register"
              valuePropName="checked"
              tooltip="启用后，通过钉钉登录的用户如果未注册会自动创建账户"
            >
              <Switch checkedChildren="允许" unCheckedChildren="禁止" />
            </Form.Item>
          </Card>

          <Form.Item style={{ textAlign: "right", marginTop: 24 }}>
            <Button
              type="primary"
              size="large"
              htmlType="submit"
              loading={saving}
              icon={<SaveOutlined />}
            >
              保存设置
            </Button>
          </Form.Item>
        </Form>
      </Spin>
    </div>
  );
};

export default Settings;
