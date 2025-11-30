import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Typography,
  Button,
  Result,
  Spin,
  Image,
  Space,
} from "antd";
import {
  LeftOutlined,
  SoundOutlined,
} from "@ant-design/icons";
import { publicAPI } from "../../api/public";
import { handleResp } from "../../utils/handleResp";
import Footer from "../../components/Footer";
import type { Poll, Option } from "../../types";

const { Title, Paragraph, Text } = Typography;

const VoteResults: React.FC = () => {
  const { uuid } = useParams<{ uuid: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [poll, setPoll] = useState<Poll | null>(null);
  const [options, setOptions] = useState<Option[]>([]);
  const [totalVotes, setTotalVotes] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uuid) {
      setError("无效的投票链接");
      setLoading(false);
      return;
    }

    const fetchResults = async () => {
      setLoading(true);
      const response = await publicAPI.getPollResults(uuid);
      handleResp(
        response,
        (data) => {
          setPoll(data.poll);
          setOptions(data.options ?? []);
          setTotalVotes(data.total_votes);
          setLoading(false);
        },
        (message) => {
          setError(message);
          setLoading(false);
        },
      );
    };

    fetchResults();
  }, [uuid]);

  // 获取排名颜色
  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return {
          text: "#6366f1",
          bar: "linear-gradient(90deg, #6366f1 0%, #8b5cf6 100%)",
          bg: "#f5f3ff",
        };
      case 2:
        return {
          text: "#0ea5e9",
          bar: "linear-gradient(90deg, #0ea5e9 0%, #06b6d4 100%)",
          bg: "#f0f9ff",
        };
      case 3:
        return {
          text: "#f59e0b",
          bar: "linear-gradient(90deg, #f59e0b 0%, #f97316 100%)",
          bg: "#fffbeb",
        };
      default:
        return {
          text: "#64748b",
          bar: "#cbd5e1",
          bg: "#f8fafc",
        };
    }
  };

  // 渲染选项结果
  const renderOptionResult = (option: Option, rank: number) => {
    const percentage = totalVotes > 0 ? (option.vote_count / totalVotes) * 100 : 0;
    const colors = getRankColor(rank);
    const isTopThree = rank <= 3;

    return (
      <div
        key={option.id}
        style={{
          marginBottom: 16,
          padding: 18,
          background: isTopThree ? colors.bg : "#fff",
          borderRadius: 12,
          border: `1px solid ${isTopThree ? colors.text + "20" : "#f0f0f0"}`,
          transition: "all 0.2s ease",
        }}
      >
        {/* 标题行 */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: isTopThree ? colors.text : "#e2e8f0",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                fontWeight: 700,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {rank}
            </div>
            {option.text && (
              <Text
                style={{
                  fontSize: 18,
                  color: "#1e293b",
                  fontWeight: 600,
                }}
              >
                {option.text}
              </Text>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <Text
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: colors.text,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {option.vote_count}
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: "#94a3b8",
                fontWeight: 500,
              }}
            >
              {percentage.toFixed(1)}%
            </Text>
          </div>
        </div>

        {/* 媒体内容 */}
        {option.image_url && (
          <div style={{ marginBottom: 12 }}>
            <Image
              src={option.image_url}
              alt={option.text || "选项图片"}
              style={{
                maxWidth: "100%",
                maxHeight: 320,
                borderRadius: 8,
              }}
            />
          </div>
        )}
        {option.audio_url && (
          <div
            style={{
              marginBottom: 12,
              padding: "12px 16px",
              background: "#f8fafc",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
            }}
          >
            <Space style={{ width: "100%", display: "flex", alignItems: "center" }}>
              <SoundOutlined style={{ fontSize: 16, color: "#64748b", flexShrink: 0 }} />
              <audio
                controls
                src={option.audio_url}
                style={{ flex: 1, maxWidth: "100%", height: "32px" }}
              >
                您的浏览器不支持音频播放
              </audio>
            </Space>
          </div>
        )}
        {option.video_url && (
          <div style={{ marginBottom: 12 }}>
            <video
              controls
              src={option.video_url}
              style={{
                width: "100%",
                maxHeight: 400,
                borderRadius: 8,
              }}
            />
          </div>
        )}

        {/* 进度条 */}
        <div
          style={{
            height: 8,
            background: "#e2e8f0",
            borderRadius: 4,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${percentage}%`,
              background: colors.bar,
              transition: "width 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
              borderRadius: 4,
            }}
          />
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          background: "#fff",
        }}
      >
        <Spin size="large" />
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
          padding: 24,
          background: "#fff",
        }}
      >
        <Result
          status="error"
          title="加载失败"
          subTitle={error}
          extra={[
            <Button key="back" onClick={() => navigate(-1)}>
              返回
            </Button>,
          ]}
        />
        <Footer />
      </div>
    );
  }

  if (!poll || !poll.show_results) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          padding: 24,
          background: "#fff",
        }}
      >
        <Result
          status="403"
          title="结果未公开"
          subTitle="此投票的结果未开放查看"
          extra={[
            <Button key="back" onClick={() => navigate(-1)}>
              返回
            </Button>,
          ]}
        />
        <Footer />
      </div>
    );
  }

  // 按票数排序
  const sortedOptions = [...options].sort((a, b) => b.vote_count - a.vote_count);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(to bottom, #fafafa 0%, #ffffff 300px)",
        touchAction: "pan-y",
      }}
    >
      {/* 顶部导航 */}
      <div
        style={{
          borderBottom: "1px solid #e5e7eb",
          background: "rgba(255, 255, 255, 0.8)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div
          style={{
            maxWidth: 680,
            margin: "0 auto",
            padding: "16px 24px",
          }}
        >
          <Button
            type="text"
            icon={<LeftOutlined />}
            onClick={() => navigate(`/v/${uuid}`)}
            style={{
              color: "#64748b",
              padding: "6px 12px",
              fontWeight: 500,
            }}
          >
            返回
          </Button>
        </div>
      </div>

      {/* 主内容 */}
      <div
        style={{
          maxWidth: 680,
          margin: "0 auto",
          padding: "48px 24px 64px",
        }}
      >
        {/* 标题区域 */}
        <div style={{ marginBottom: poll.description ? 36 : 32 }}>
          <Title
            level={1}
            style={{
              fontSize: 36,
              fontWeight: 700,
              lineHeight: 1.2,
              margin: poll.description ? "0 0 10px 0" : 0,
              color: "#0f172a",
              letterSpacing: "-0.02em",
            }}
          >
            {poll.title}
          </Title>
          {poll.description && (
            <Paragraph
              style={{
                fontSize: 17,
                color: "#64748b",
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              {poll.description}
            </Paragraph>
          )}
        </div>

        {/* 结果列表 */}
        <div>
          {sortedOptions.length > 0 ? (
            sortedOptions.map((option, index) =>
              renderOptionResult(option, index + 1),
            )
          ) : (
            <div
              style={{
                textAlign: "center",
                padding: "80px 0",
                color: "#999",
              }}
            >
              暂无投票数据
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ marginTop: 56 }}>
          <Footer />
        </div>
      </div>
    </div>
  );
};

export default VoteResults;
