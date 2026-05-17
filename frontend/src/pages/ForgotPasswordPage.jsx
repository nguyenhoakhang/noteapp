import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/axios";
import toast from "react-hot-toast";

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1=email, 2=otp, 3=new password
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [resetToken, setResetToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // OTP input boxes
  const handleOtpChange = (i, val) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp];
    next[i] = val;
    setOtp(next);
    if (val && i < 5) {
      document.getElementById(`otp-${i + 1}`)?.focus();
    }
  };
  const handleOtpKey = (i, e) => {
    if (e.key === "Backspace" && !otp[i] && i > 0) {
      document.getElementById(`otp-${i - 1}`)?.focus();
    }
  };
  const handleOtpPaste = (e) => {
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(""));
      document.getElementById("otp-5")?.focus();
    }
    e.preventDefault();
  };

  const sendOtp = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/auth/otp/send", { email });
      toast.success("OTP sent — check your email");
      setStep(2);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const code = otp.join("");
    try {
      const { data } = await api.post("/auth/otp/verify", { email, otp: code });
      setResetToken(data.reset_token);
      setStep(3);
    } catch (err) {
      setError(err?.response?.data?.message || "Invalid or expired OTP");
      setOtp(["", "", "", "", "", ""]);
      document.getElementById("otp-0")?.focus();
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/otp/reset", {
        reset_token: resetToken,
        password,
        password_confirmation: confirm,
      });
      toast.success("Password reset! Please login again.");
      navigate("/login");
    } catch (err) {
      setError(err?.response?.data?.message || "Reset failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Step indicators */}
        <div className="otp-steps">
          {["Email", "Verify OTP", "New password"].map((label, i) => (
            <div
              key={i}
              className={`otp-step ${step > i + 1 ? "done" : step === i + 1 ? "active" : ""}`}
            >
              <div className="otp-step-dot">{step > i + 1 ? "✓" : i + 1}</div>
              <span>{label}</span>
            </div>
          ))}
        </div>

        {/* Step 1 — Email */}
        {step === 1 && (
          <>
            <h1 className="auth-title">Reset password</h1>
            <p className="auth-subtitle">
              Enter your email to receive a 6-digit OTP
            </p>
            <form onSubmit={sendOtp} className="auth-form">
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={email}
                  required
                  autoFocus
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              {error && <p className="form-error">{error}</p>}
              <button
                type="submit"
                className="btn-primary-sm btn-full"
                disabled={loading}
              >
                {loading ? "Sending…" : "Send OTP"}
              </button>
            </form>
          </>
        )}

        {/* Step 2 — OTP input */}
        {step === 2 && (
          <>
            <h1 className="auth-title">Enter OTP</h1>
            <p className="auth-subtitle">
              We sent a 6-digit code to <strong>{email}</strong>
            </p>
            <form onSubmit={verifyOtp} className="auth-form">
              <div className="otp-boxes" onPaste={handleOtpPaste}>
                {otp.map((v, i) => (
                  <input
                    key={i}
                    id={`otp-${i}`}
                    className="otp-box"
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={v}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKey(i, e)}
                    autoFocus={i === 0}
                  />
                ))}
              </div>
              {error && <p className="form-error">{error}</p>}
              <button
                type="submit"
                className="btn-primary-sm btn-full"
                disabled={loading || otp.join("").length < 6}
              >
                {loading ? "Verifying…" : "Verify OTP"}
              </button>
              <button
                type="button"
                className="auth-link-btn"
                onClick={() => {
                  sendOtp({ preventDefault: () => {} });
                  setOtp(["", "", "", "", "", ""]);
                }}
              >
                Resend OTP
              </button>
            </form>
          </>
        )}

        {/* Step 3 — New password */}
        {step === 3 && (
          <>
            <h1 className="auth-title">New password</h1>
            <p className="auth-subtitle">
              Choose a strong password (min. 8 characters)
            </p>
            <form onSubmit={resetPassword} className="auth-form">
              <div className="form-group">
                <label>New password</label>
                <input
                  type="password"
                  value={password}
                  required
                  minLength={8}
                  autoFocus
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                />
              </div>
              <div className="form-group">
                <label>Confirm password</label>
                <input
                  type="password"
                  value={confirm}
                  required
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repeat password"
                />
              </div>
              {error && <p className="form-error">{error}</p>}
              <button
                type="submit"
                className="btn-primary-sm btn-full"
                disabled={loading}
              >
                {loading ? "Resetting…" : "Reset password"}
              </button>
            </form>
          </>
        )}

        <div style={{ textAlign: "center", marginTop: "1rem" }}>
          <Link to="/login" className="auth-link">
            ← Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
