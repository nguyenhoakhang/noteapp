import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import api from "../api/axios";
import toast from "react-hot-toast";
import PasswordInput from "../components/PasswordInput";

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: params.get("email") || "",
    password: "",
    password_confirmation: "",
    token: params.get("token") || "",
  });
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/reset-password", {
        ...form,
        email: form.email.trim().toLowerCase(),
      });
      toast.success(
        "Password reset successful! Please login with your new password.",
      );
      navigate("/login");
    } catch (err) {
      toast.error(err.response?.data?.message || "Reset failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">📝 NoteApp</div>
        <h1>New password</h1>
        <form onSubmit={submit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={form.email}
              required
              onChange={(e) => set("email", e.target.value)}
            />
          </div>
          <PasswordInput
            label="New password"
            value={form.password}
            onChange={(v) => set("password", v)}
            showStrength
            required
            minLength={8}
          />
          <PasswordInput
            label="Confirm password"
            value={form.password_confirmation}
            onChange={(v) => set("password_confirmation", v)}
            required
          />
          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? "Saving…" : "Set new password"}
          </button>
        </form>
      </div>
    </div>
  );
}
