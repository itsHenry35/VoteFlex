import { useNavigate } from "react-router-dom";
import { userAPI } from "../../api/user";
import { handleRespWithNotifySuccess } from "../../utils/handleResp";
import type { CreatePollRequest } from "../../types";
import PollForm from "../../components/PollForm";

const CreatePoll: React.FC = () => {
  const navigate = useNavigate();

  const handleSubmit = async (data: CreatePollRequest | Partial<CreatePollRequest>) => {
    const response = await userAPI.createPoll(data as CreatePollRequest);
    handleRespWithNotifySuccess(response, (poll) => {
      // 创建成功后跳转到选项管理页面
      navigate(`/polls/${poll.id}/options`);
    });
  };

  const handleCancel = () => {
    navigate("/polls");
  };

  return <PollForm onSubmit={handleSubmit} onCancel={handleCancel} />;
};

export default CreatePoll;
