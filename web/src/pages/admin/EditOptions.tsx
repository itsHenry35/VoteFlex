import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Card,
  Button,
  Input,
  Space,
  Image,
  message,
  Modal,
  Spin,
  Typography,
  Empty,
  Upload,
} from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  UpOutlined,
  DownOutlined,
  EditOutlined,
  SaveOutlined,
  CloseOutlined,
  ArrowLeftOutlined,
  PictureOutlined,
  SoundOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import { userAPI } from "../../api/user";
import { handleResp, handleRespWithNotifySuccess } from "../../utils/handleResp";
import type { Poll, Option } from "../../types";

const { Title, Text } = Typography;

interface ExtendedOption extends Option {
  // 编辑状态
  isEditing?: boolean;
  // 临时文件
  tempImageFile?: File;
  tempAudioFile?: File;
  tempVideoFile?: File;
  // 删除标记
  deleteImage?: boolean;
  deleteAudio?: boolean;
  deleteVideo?: boolean;
}

const EditOptions: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [poll, setPoll] = useState<Poll | null>(null);
  const [options, setOptions] = useState<ExtendedOption[]>([]);
  const [savingOptions, setSavingOptions] = useState<Record<number, boolean>>({});
  const [nextTempId, setNextTempId] = useState(-1); // 使用负数作为临时ID

  // 获取投票和选项信息
  const fetchPollAndOptions = async () => {
    if (!id) return;

    setLoading(true);
    try {
      const response = await userAPI.getMyPoll(parseInt(id));
      handleResp(
        response,
        (data) => {
          setPoll(data);
          setOptions((data.options || []).map(opt => ({ ...opt, isEditing: false })));
          setLoading(false);
        },
        () => {
          setLoading(false);
        }
      );
    } catch (error) {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPollAndOptions();
  }, [id]);

  // 添加新选项（默认进入编辑状态）
  const addOption = () => {
    if (!poll) return;

    const tempOption: ExtendedOption = {
      id: nextTempId,
      poll_id: poll.id,
      text: "",
      image_url: "",
      audio_url: "",
      video_url: "",
      vote_count: 0,
      sort_order: options.length,
      created_at: new Date().toISOString(),
      isEditing: true, // 新选项默认进入编辑状态
    };

    setOptions([...options, tempOption]);
    setNextTempId(nextTempId - 1);
  };

  // 开始编辑选项
  const startEdit = (optionId: number) => {
    setOptions(prev =>
      prev.map(opt => (opt.id === optionId ? { ...opt, isEditing: true } : opt))
    );
  };

  // 取消编辑
  const cancelEdit = (optionId: number) => {
    // 如果是新选项，直接删除
    if (optionId < 0) {
      setOptions(prev => prev.filter(opt => opt.id !== optionId));
      return;
    }

    // 否则重新获取数据恢复原状
    fetchPollAndOptions();
  };

  // 保存选项
  const saveOption = async (option: ExtendedOption) => {
    if (!poll) return;

    // 验证选项至少有一个字段有值
    const hasText = option.text.trim() !== "";
    const hasImage = option.image_url !== "" || option.tempImageFile;
    const hasAudio = option.audio_url !== "" || option.tempAudioFile;
    const hasVideo = option.video_url !== "" || option.tempVideoFile;

    if (!hasText && !hasImage && !hasAudio && !hasVideo) {
      message.error("选项至少需要包含文字、图片、音频或视频中的一项");
      return;
    }

    setSavingOptions(prev => ({ ...prev, [option.id]: true }));

    // 构建 FormData
    const formData = new FormData();
    formData.append("text", option.text);

    // 添加文件
    if (option.tempImageFile) {
      formData.append("image_file", option.tempImageFile);
    }
    if (option.tempAudioFile) {
      formData.append("audio_file", option.tempAudioFile);
    }
    if (option.tempVideoFile) {
      formData.append("video_file", option.tempVideoFile);
    }

    // 添加删除标记
    if (option.deleteImage) {
      formData.append("delete_image", "true");
    }
    if (option.deleteAudio) {
      formData.append("delete_audio", "true");
    }
    if (option.deleteVideo) {
      formData.append("delete_video", "true");
    }

    try {
      // 如果是新选项（临时ID为负数），则创建
      if (option.id < 0) {
        const response = await userAPI.addOption(poll.id, formData);
        handleRespWithNotifySuccess(
          response,
          () => {
            setSavingOptions(prev => ({ ...prev, [option.id]: false }));
            // 重新获取所有选项
            fetchPollAndOptions();
          },
          () => {
            setSavingOptions(prev => ({ ...prev, [option.id]: false }));
          }
        );
      } else {
        // 更新已存在的选项
        const response = await userAPI.updateOption(poll.id, option.id, formData);
        handleResp(
          response,
          () => {
            message.success("保存成功");
            setSavingOptions(prev => ({ ...prev, [option.id]: false }));
            // 重新获取所有选项
            fetchPollAndOptions();
          },
          () => {
            setSavingOptions(prev => ({ ...prev, [option.id]: false }));
          }
        );
      }
    } catch (error) {
      setSavingOptions(prev => ({ ...prev, [option.id]: false }));
    }
  };

  // 删除选项
  const deleteOption = async (optionId: number) => {
    if (!poll) return;

    // 如果是临时选项，直接从列表中移除
    if (optionId < 0) {
      setOptions(prev => prev.filter(opt => opt.id !== optionId));
      return;
    }

    Modal.confirm({
      title: "确认删除",
      content: "删除选项后无法恢复，确定要删除吗？",
      onOk: async () => {
        const response = await userAPI.deleteOption(poll.id, optionId);
        handleRespWithNotifySuccess(response, () => {
          setOptions(prev => prev.filter(opt => opt.id !== optionId));
        });
      },
    });
  };

  // 移动选项顺序
  const moveOption = async (optionId: number, direction: "up" | "down") => {
    if (!poll) return;

    const currentIndex = options.findIndex(opt => opt.id === optionId);
    if (currentIndex === -1) return;

    const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= options.length) return;

    // 乐观更新UI
    const newOptions = [...options];
    [newOptions[currentIndex], newOptions[newIndex]] = [newOptions[newIndex], newOptions[currentIndex]];
    setOptions(newOptions);

    // 调用API更新顺序
    const response = await userAPI.updateOptionOrder(poll.id, optionId, newIndex);
    handleResp(
      response,
      (updatedOptions) => {
        setOptions(updatedOptions.map(opt => ({ ...opt, isEditing: false })));
      },
      () => {
        // 如果失败，恢复原来的顺序
        fetchPollAndOptions();
      }
    );
  };

  // 更新本地选项字段
  const updateLocalOption = (optionId: number, updates: Partial<ExtendedOption>) => {
    setOptions(prev =>
      prev.map(opt => (opt.id === optionId ? { ...opt, ...updates } : opt))
    );
  };

  // 处理文件选择
  const handleFileSelect = (optionId: number, file: File, type: "image" | "audio" | "video") => {
    updateLocalOption(optionId, {
      [`temp${type.charAt(0).toUpperCase() + type.slice(1)}File`]: file,
      [`delete${type.charAt(0).toUpperCase() + type.slice(1)}`]: false,
    });
    return false; // 阻止自动上传
  };

  // 删除媒体文件
  const deleteMedia = (optionId: number, type: "image" | "audio" | "video") => {
    const capitalizedType = type.charAt(0).toUpperCase() + type.slice(1);
    updateLocalOption(optionId, {
      [`${type}_url`]: "",
      [`temp${capitalizedType}File`]: undefined,
      [`delete${capitalizedType}`]: true,
    });
  };

  // 检查是否有选项正在编辑
  const hasEditingOption = options.some(opt => opt.isEditing);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center"}}>
        <Spin size="large" />
      </div>
    );
  }

  if (!poll) {
    return (
      <div>
        <Empty description="投票不存在" />
      </div>
    );
  }

  return (
    <div >
      <Card>
        <Space direction="vertical" style={{ width: "100%", marginBottom: 24 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/polls")}>
            返回投票列表
          </Button>

          <Title level={3}>编辑投票选项 - {poll.title}</Title>
          <Text type="secondary">
            点击选项进行编辑，编辑完成后点击"完成编辑"保存。编辑时其他操作将被禁用。
          </Text>
        </Space>

        {options.length === 0 ? (
          <Empty description="暂无选项，点击下方按钮添加" style={{ margin: "40px 0" }} />
        ) : (
          <Space direction="vertical" style={{ width: "100%" }} size="middle">
            {options.map((option, index) => (
              <Card
                key={option.id}
                size="small"
                title={
                  <Space>
                    <Text strong>选项 {index + 1}</Text>
                    {option.vote_count > 0 && <Text type="secondary">({option.vote_count} 票)</Text>}
                  </Space>
                }
                extra={
                  <Space>
                    {!option.isEditing && (
                      <>
                        <Button
                          size="small"
                          icon={<EditOutlined />}
                          disabled={hasEditingOption}
                          onClick={() => startEdit(option.id)}
                        >
                          编辑
                        </Button>
                        <Button
                          size="small"
                          icon={<UpOutlined />}
                          disabled={index === 0 || option.id < 0 || hasEditingOption}
                          onClick={() => moveOption(option.id, "up")}
                        />
                        <Button
                          size="small"
                          icon={<DownOutlined />}
                          disabled={index === options.length - 1 || option.id < 0 || hasEditingOption}
                          onClick={() => moveOption(option.id, "down")}
                        />
                      </>
                    )}
                    {option.isEditing && (
                      <>
                        <Button
                          size="small"
                          type="primary"
                          icon={<SaveOutlined />}
                          loading={savingOptions[option.id]}
                          onClick={() => saveOption(option)}
                        >
                          完成编辑
                        </Button>
                        <Button
                          size="small"
                          icon={<CloseOutlined />}
                          onClick={() => cancelEdit(option.id)}
                        >
                          取消
                        </Button>
                      </>
                    )}
                    <Button
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      disabled={options.length <= 2 || (hasEditingOption && !option.isEditing)}
                      onClick={() => deleteOption(option.id)}
                    />
                  </Space>
                }
              >
                <Space direction="vertical" style={{ width: "100%" }}>
                  {/* 文本输入 */}
                  <Input
                    placeholder="选项内容"
                    value={option.text}
                    readOnly={!option.isEditing}
                    onChange={(e) => updateLocalOption(option.id, { text: e.target.value })}
                    onClick={() => !option.isEditing && !hasEditingOption && startEdit(option.id)}
                  />

                  {/* 编辑模式：显示文件上传 */}
                  {option.isEditing && (
                    <>
                      {/* 图片上传 */}
                      <Space wrap>
                        <Upload
                          accept="image/*"
                          showUploadList={false}
                          beforeUpload={(file) => handleFileSelect(option.id, file, "image")}
                        >
                          <Button icon={<PictureOutlined />}>
                            {option.tempImageFile ? "重新选择图片" : "上传图片"}
                          </Button>
                        </Upload>
                        {(option.image_url || option.tempImageFile) && !option.deleteImage && (
                          <Space>
                            {option.tempImageFile ? (
                              <Text type="secondary">{option.tempImageFile.name}</Text>
                            ) : (
                              <Image src={option.image_url} alt="预览" width={50} height={50} style={{ objectFit: "cover" }} />
                            )}
                            <Button danger size="small" onClick={() => deleteMedia(option.id, "image")}>
                              删除
                            </Button>
                          </Space>
                        )}
                      </Space>

                      {/* 音频上传 */}
                      <Space wrap>
                        <Upload
                          accept="audio/*"
                          showUploadList={false}
                          beforeUpload={(file) => handleFileSelect(option.id, file, "audio")}
                        >
                          <Button icon={<SoundOutlined />}>
                            {option.tempAudioFile ? "重新选择音频" : "上传音频"}
                          </Button>
                        </Upload>
                        {(option.audio_url || option.tempAudioFile) && !option.deleteAudio && (
                          <Space>
                            {option.tempAudioFile ? (
                              <Text type="secondary">{option.tempAudioFile.name}</Text>
                            ) : (
                              <audio controls src={option.audio_url} style={{ height: 32 }} />
                            )}
                            <Button danger size="small" onClick={() => deleteMedia(option.id, "audio")}>
                              删除
                            </Button>
                          </Space>
                        )}
                      </Space>

                      {/* 视频上传 */}
                      <Space wrap>
                        <Upload
                          accept="video/*"
                          showUploadList={false}
                          beforeUpload={(file) => handleFileSelect(option.id, file, "video")}
                        >
                          <Button icon={<VideoCameraOutlined />}>
                            {option.tempVideoFile ? "重新选择视频" : "上传视频"}
                          </Button>
                        </Upload>
                        {(option.video_url || option.tempVideoFile) && !option.deleteVideo && (
                          <Space>
                            {option.tempVideoFile ? (
                              <Text type="secondary">{option.tempVideoFile.name}</Text>
                            ) : (
                              <video controls src={option.video_url} style={{ width: 100, height: 60 }} />
                            )}
                            <Button danger size="small" onClick={() => deleteMedia(option.id, "video")}>
                              删除
                            </Button>
                          </Space>
                        )}
                      </Space>
                    </>
                  )}

                  {/* 预览模式：显示媒体预览 */}
                  {!option.isEditing && (
                    <>
                      {option.image_url && (
                        <div>
                          <Text type="secondary">图片：</Text>
                          <Image src={option.image_url} alt="预览" width={100} style={{ marginLeft: 8 }} />
                        </div>
                      )}
                      {option.audio_url && (
                        <div>
                          <Text type="secondary">音频：</Text>
                          <audio controls src={option.audio_url} style={{ marginLeft: 8, height: 32 }} />
                        </div>
                      )}
                      {option.video_url && (
                        <div>
                          <Text type="secondary">视频：</Text>
                          <video controls src={option.video_url} style={{ marginLeft: 8, width: 200 }} />
                        </div>
                      )}
                    </>
                  )}
                </Space>
              </Card>
            ))}
          </Space>
        )}

        <Button
          type="dashed"
          block
          icon={<PlusOutlined />}
          onClick={addOption}
          disabled={hasEditingOption}
          style={{ marginTop: 16 }}
        >
          添加选项
        </Button>
      </Card>
    </div>
  );
};

export default EditOptions;
