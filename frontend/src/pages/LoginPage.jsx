import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/axios";
import useAuthStore from "../store/authStore";
import toast from "react-hot-toast";
import PasswordInput from "../components/PasswordInput";

export default function LoginPage() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const v = searchParams.get("verified");
    if (v === "success") {
      toast.success("Email verified! You can now login.");
    } else if (v === "already") {
      toast("Email was already verified — you're good to go!");
    } else if (v === "error") {
      toast.error("Verification failed. Link may be expired.");
    }
  }, [searchParams]);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/login", {
        email: form.email.trim().toLowerCase(),
        password: form.password,
        remember,
      });
      setAuth(data.user, data.token);
      toast.success(`Welcome back, ${data.user.name}!`);
      navigate("/");
    } catch (err) {
      toast.error(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">📝 NoteApp</div>
        <h1>Sign in</h1>
        <form onSubmit={submit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={form.email}
              required
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <PasswordInput
            label="Password"
            value={form.password}
            onChange={(v) => setForm({ ...form, password: v })}
            required
          />
          <div className="form-group remember-row">
            <label className="remember-label">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <span>Remember me</span>
            </label>
          </div>
          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <div className="auth-links">
          <Link to="/forgot-password">Forgot password?</Link>
          <span>·</span>
          <Link to="/register">Create account</Link>
        </div>
      </div>
    </div>
  );
}
