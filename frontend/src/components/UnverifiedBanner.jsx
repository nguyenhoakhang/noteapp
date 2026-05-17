import { useState, useEffect } from "react";
import api from "../api/axios";
import toast from "react-hot-toast";

export default function UnverifiedBanner() {
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const resend = async () => {
    setSent(false);
    try {
      await api.post("/email/resend");
      setSent(true);
      setCooldown(60);
      toast.success("Verification email sent!");
    } catch {
      toast.error("Failed to resend");
    }
  };

  return (
    <div className={`unverified-banner ${sent ? "unverified-banner--sent" : ""}`}>
      <span>
        {sent
          ? "📬 Verification email sent — check your inbox"
          : "⚠️ Your email is not verified"}
      </span>
      <button
        className="resend-btn"
        onClick={resend}
        disabled={cooldown > 0}
      >
        {cooldown > 0
          ? `Resend in ${cooldown}s`
          : sent
            ? "Resend"
            : "Resend verification"}
      </button>
    </div>
  );
}
