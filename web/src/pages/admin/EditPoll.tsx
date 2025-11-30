import { useState, useEffect } from "react";
import { Spin } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import { userAPI } from "../../api/user";
import { adminAPI } from "../../api/admin";
import { handleResp, handleRespWithNotifySuccess } from "../../utils/handleResp";
import type { CreatePollRequest, Poll } from "../../types";
import PollForm from "../../components/PollForm";

const EditPoll: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [fetchLoading, setFetchLoading] = useState(true);
  const [poll, setPoll] = useState<Poll | null>(null);

  // 加载投票数据
  useEffect(() => {
    const fetchPoll = async () => {
      if (!id) return;

      setFetchLoading(true);
      const response = await adminAPI.getPollById(parseInt(id));
      handleResp(
        response,
        (data) => {
          setPoll(data);
          setFetchLoading(false);
        },
        () => {
          setFetchLoading(false);
          navigate("/polls");
        }
      );
    };

    fetchPoll();
  }, [id, navigate]);

  const handleSubmit = async (data: CreatePollRequest | Partial<CreatePollRequest>) => {
    if (!id) return;

    const response = await userAPI.updatePoll(parseInt(id), data);
    handleRespWithNotifySuccess(response, (updatedPoll) => {
      navigate(`/polls/${updatedPoll.id}`);
    });
  };

  const handleCancel = () => {
    navigate(`/polls/${id}`);
  };

  if (fetchLoading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "50vh",
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  if (!poll) {
    return null;
  }

  return (
    <PollForm
      initialData={poll}
      isEdit={true}
      onSubmit={handleSubmit}
      onCancel={handleCancel}
    />
  );
};

export default EditPoll;
