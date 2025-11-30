import { useState } from "react";
import {
  Card,
  Form,
  Input,
  Button,
  Typography,
  Select,
  InputNumber,
  DatePicker,
  Switch,
  Space,
  Divider,
  message,
} from "antd";
import dayjs from "dayjs";
import type { CreatePollRequest, Poll } from "../types";

const { Title } = Typography;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

interface PollFormProps {
  initialData?: Poll;
  isEdit?: boolean;
  onSubmit: (data: CreatePollRequest | Partial<CreatePollRequest>) => Promise<void>;
  onCancel: () => void;
}

const PollForm: React.FC<PollFormProps> = ({
  initialData,
  isEdit = false,
  onSubmit,
  onCancel,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  // 监听身份验证类型的变化
  const identityType = Form.useWatch('identity_type', form);

  // 提交表单
  const handleSubmit = async (values: any) => {
    // 验证选票数量
    if (values.min_votes > values.max_votes) {
      message.error("最少选票数不能大于最多选票数");
      return;
    }

    setLoading(true);

    const data: CreatePollRequest | Partial<CreatePollRequest> = {
      title: values.title,
      description: values.description || "",
      frequency_type: values.frequency_type,
      frequency_n: values.frequency_n || 1,
      frequency_max: values.frequency_max || 1,
      min_votes: values.min_votes,
      max_votes: values.max_votes,
      start_time: values.time_range?.[0]?.toISOString(),
      end_time: values.time_range?.[1]?.toISOString(),
      show_results: values.show_results || false,
      allow_modification: values.allow_modification || false,
    };

    // 创建时需要添加identity_type
    if (!isEdit) {
      (data as CreatePollRequest).identity_type = values.identity_type;
    }

    try {
      await onSubmit(data);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          title: initialData?.title || "",
          description: initialData?.description || "",
          identity_type: initialData?.identity_type || "none",
          frequency_type: initialData?.frequency_type || "total",
          frequency_n: initialData?.frequency_n || 1,
          frequency_max: initialData?.frequency_max || 1,
          min_votes: initialData?.min_votes || 1,
          max_votes: initialData?.max_votes || 1,
          time_range:
            initialData?.start_time || initialData?.end_time
              ? [
                  initialData.start_time ? dayjs(initialData.start_time) : null,
                  initialData.end_time ? dayjs(initialData.end_time) : null,
                ]
              : undefined,
          show_results: initialData?.show_results || false,
          allow_modification: initialData?.allow_modification || false,
        }}
      >
        <Title level={3}>{isEdit ? "编辑投票" : "创建投票"}</Title>

        {/* 基本信息 */}
        <Title level={4}>基本信息</Title>

        <Form.Item
          label="投票标题"
          name="title"
          rules={[{ required: true, message: "请输入投票标题" }]}
        >
          <Input placeholder="请输入投票标题" />
        </Form.Item>

        <Form.Item label="投票描述" name="description">
          <TextArea rows={4} placeholder="请输入投票描述（可选）" />
        </Form.Item>

        <Divider />

        {/* 投票设置 */}
        <Title level={4}>投票设置</Title>

        <Form.Item
          label="身份验证"
          name="identity_type"
          rules={[{ required: true, message: "请选择身份验证方式" }]}
        >
          <Select
            disabled={isEdit}
            options={[
              { label: "无限制", value: "none" },
              { label: "钉钉登录", value: "dingtalk" },
              { label: "IP限制", value: "ip" },
            ]}
          />
        </Form.Item>

        {/* 只有当身份验证不是"无限制"时，才显示频率限制相关字段 */}
        {identityType !== "none" && (
          <>
            <Form.Item
              label="投票频率"
              name="frequency_type"
              rules={[{ required: true, message: "请选择投票频率" }]}
            >
              <Select
                options={[
                  { label: "总计限制", value: "total" },
                  { label: "每小时限制", value: "hourly" },
                  { label: "每天限制", value: "daily" },
                ]}
              />
            </Form.Item>

            <Space>
              <Form.Item
                label="频率参数"
                name="frequency_n"
                tooltip="设置时间周期（小时或天数）"
              >
                <InputNumber min={1} placeholder="时间周期" />
              </Form.Item>

              <Form.Item
                label="最大次数"
                name="frequency_max"
                tooltip="在指定时间周期内最多可投票次数"
              >
                <InputNumber min={1} placeholder="最大次数" />
              </Form.Item>
            </Space>
          </>
        )}

        <Space>
          <Form.Item
            label="最少选择"
            name="min_votes"
            rules={[{ required: true, message: "请设置最少选择项数" }]}
          >
            <InputNumber min={1} placeholder="最少选几项" />
          </Form.Item>

          <Form.Item
            label="最多选择"
            name="max_votes"
            rules={[{ required: true, message: "请设置最多选择项数" }]}
          >
            <InputNumber min={1} placeholder="最多选几项" />
          </Form.Item>
        </Space>

        <Form.Item label="投票时间范围" name="time_range">
          <RangePicker
            showTime
            format="YYYY-MM-DD HH:mm"
            placeholder={["开始时间", "结束时间"]}
            style={{ width: "100%" }}
          />
        </Form.Item>

        <Form.Item
          label="公开投票结果"
          name="show_results"
          valuePropName="checked"
        >
          <Switch checkedChildren="公开" unCheckedChildren="隐藏" />
        </Form.Item>

        <Form.Item
          label="允许修改投票"
          name="allow_modification"
          valuePropName="checked"
          tooltip="开启后，投票者可以使用修改令牌修改自己的投票"
        >
          <Switch checkedChildren="允许" unCheckedChildren="不允许" />
        </Form.Item>

        <Divider />

        {/* 提交按钮 */}
        <Form.Item>
          <Space>
            <Button onClick={onCancel}>取消</Button>
            <Button type="primary" htmlType="submit" loading={loading}>
              {isEdit ? "保存修改" : "创建投票"}
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default PollForm;
