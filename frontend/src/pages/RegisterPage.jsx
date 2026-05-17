import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios";
import useAuthStore from "../store/authStore";
import toast from "react-hot-toast";

export default function RegisterPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    password_confirmation: "",
  });
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    
    
    e.preventDefault();

    if (form.password !== form.password_confirmation) {
      return toast.error("Passwords do not match");
    }
    setLoading(true);
    try {
      const { data } = await api.post("/register", form);
      setAuth(data.user, data.token);
      toast.success("Account created! Check your email to verify.");
      navigate("/");
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

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">📝 NoteApp</div>
        <h1>Create account</h1>
        <form onSubmit={submit}>
          {[
            { label: "Display name", key: "name", type: "text" },
            { label: "Email", key: "email", type: "email" },
            { label: "Password", key: "password", type: "password" },
            {
              label: "Confirm password",
              key: "password_confirmation",
              type: "password",
            },
          ].map(({ label, key, type }) => (
            <div className="form-group" key={key}>
              <label>{label}</label>
              <input
                type={type}
                value={form[key]}
                required
                onChange={(e) => set(key, e.target.value)}
              />
            </div>
          ))}
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
