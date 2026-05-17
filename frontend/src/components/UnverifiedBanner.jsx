import { useState } from "react";
import api from "../api/axios";
import toast from "react-hot-toast";

export default function UnverifiedBanner() {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const resend = async () => {
    setSending(true);
    try {
      // Đổi thành endpoint chuẩn của Laravel Sanctum/Fortify
      await api.post("/email/verification-notification");

      setSent(true);
      toast.success("Verification email sent — check your inbox");

      // Sau 60 giây cho phép gửi lại lần nữa nếu cần
      setTimeout(() => setSent(false), 60000);
    } catch (e) {
      // Log lỗi ra console để đại ca dễ debug nếu vẫn 500
      console.error("Resend Error:", e.response);
      toast.error(e?.response?.data?.message || "Failed to send");
    } finally {
      setSending(false);
    }
  };

  if (sent)
    return (
      <div className="unverified-banner unverified-banner--sent">
        <span role="img" aria-label="email">
          📧
        </span>{" "}
        Verification email sent! Check your inbox (or spam).
      </div>
    );

  return (
    <div className="unverified-banner">
      <span role="img" aria-label="warning">
        ⚠️
      </span>{" "}
      Your email is not verified.
      <button onClick={resend} disabled={sending} className="resend-btn">
        {sending ? "Sending…" : "Resend verification email"}
      </button>
    </div>
  );
}
