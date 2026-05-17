import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios";
import useAuthStore from "../store/authStore";
import toast from "react-hot-toast";
import PasswordInput from "../components/PasswordInput";

export default function RegisterPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    password_confirmation: "",
  });
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();

    if (form.password !== form.password_confirmation) {
      return toast.error("Passwords do not match");
    }

    // Normalize email
    const payload = {
      ...form,
      email: form.email.trim().toLowerCase(),
      name: form.name.trim(),
    };

    setLoading(true);
    try {
      const { data } = await api.post("/register", payload);
      setAuth(data.user, data.token);
      setRegistered(true);
      toast.success("Account created! Check your email to verify.");
      // Brief delay for success animation
      setTimeout(() => navigate("/"), 600);
    } catch (err) {
      const errors = err.response?.data?.errors;
      if (errors)
        Object.values(errors)
          .flat()
          .forEach((m) => toast.error(m));
      else toast.error("Registration failed");
    } finally {
      setLoading(false);
    }
  };

  if (registered) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🎉</div>
          <h1 className="auth-title">Account created!</h1>
          <p className="auth-subtitle">
            Check your email to verify your account.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">📝 NoteApp</div>
        <h1>Create account</h1>
        <form onSubmit={submit}>
          <div className="form-group">
            <label>Display name</label>
            <input
              type="text"
              value={form.name}
              required
              onChange={(e) => set("name", e.target.value)}
            />
          </div>
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
            label="Password"
            value={form.password}
            onChange={(v) => set("password", v)}
            placeholder="Min. 8 characters"
            showStrength
            required
            minLength={8}
          />
          <PasswordInput
            label="Confirm password"
            value={form.password_confirmation}
            onChange={(v) => set("password_confirmation", v)}
            placeholder="Repeat password"
            required
          />
          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? "Creating…" : "Create account"}
          </button>
        </form>
        <div className="auth-links">
          <Link to="/login">Already have an account?</Link>
        </div>
      </div>
    </div>
  );
}
