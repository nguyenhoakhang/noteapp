import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import api from "../api/axios";
import useAuthStore from "../store/authStore";
import toast from "react-hot-toast";
import PasswordInput from "../components/PasswordInput";

const FONT_SIZES = ["small", "medium", "large"];
const NOTE_COLORS = [
  "#ffffff", // default
  "#fef3c7", // warm yellow
  "#fee2e2", // soft red
  "#dcfce7", // soft green
  "#dbeafe", // soft blue
  "#ede9fe", // soft purple
  "#fce7f3", // soft pink
];

export default function PreferencesPage() {
  const { user, updateUser, logout } = useAuthStore();
  const navigate = useNavigate();

  const [prefs, setPrefs] = useState({
    font_size: user?.font_size || "medium",
    note_color: user?.note_color || "#ffffff",
    theme: user?.theme || "light",
  });
  const [profile, setProfile] = useState({
    name: user?.name || "",
    email: user?.email || "",
  });
  const [passwords, setPasswords] = useState({
    current_password: "",
    password: "",
    password_confirmation: "",
  });
  const [allChanges, setAllChanges] = useState({});
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const hasChanges = Object.keys(allChanges).length > 0;

  const fileRef = useRef();
  const [avatarPreview, setAvatarPreview] = useState(
    user?.avatar ? `/storage/${user.avatar}` : null,
  );
  const [avatarFile, setAvatarFile] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const track = (section, key, value) => {
    setAllChanges((prev) => ({
      ...prev,
      [`${section}.${key}`]: { section, key, value },
    }));
  };

  const handlePrefChange = (key, value) => {
    setPrefs((p) => ({ ...p, [key]: value }));
    track("pref", key, value);
  };

  const handleProfileChange = (key, value) => {
    setProfile((p) => ({ ...p, [key]: value }));
    track("profile", key, value);
  };

  const setP = (k, v) => handlePrefChange(k, v);
  const setPro = (k, v) => handleProfileChange(k, v);
  const setPwd = (k, v) => setPasswords((p) => ({ ...p, [k]: v }));

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const saveAvatar = async () => {
    if (!avatarFile) return;
    setUploadingAvatar(true);
    try {
      const fd = new FormData();
      fd.append("avatar", avatarFile);
      const { data } = await api.post("/user/avatar", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      // Reload full user data from server
      await useAuthStore.getState().fetchMe();

      // Update preview with cache-busting
      setAvatarPreview(`/storage/${data.avatar}?t=${Date.now()}`);

      setAvatarFile(null);
      toast.success("Avatar updated!");
    } catch (error) {
      console.error("Upload failed:", error);
      toast.error(error.response?.data?.message || "Upload failed");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      const prefKeys = ["font_size", "note_color", "theme"];
      const profKeys = ["name", "email"];

      const prefChanges = Object.values(allChanges)
        .filter((c) => prefKeys.includes(c.key))
        .reduce((acc, c) => ({ ...acc, [c.key]: c.value }), {});

      const profChanges = Object.values(allChanges)
        .filter((c) => profKeys.includes(c.key))
        .reduce((acc, c) => ({ ...acc, [c.key]: c.value }), {});

      if (Object.keys(prefChanges).length) {
        const { data } = await api.patch("/user/preferences", prefChanges);
        updateUser(data);
        if (prefChanges.theme) {
          document.documentElement.setAttribute(
            "data-theme",
            prefChanges.theme,
          );
        }
      }

      if (Object.keys(profChanges).length) {
        const { data } = await api.patch("/user/profile", profChanges);
        updateUser(data);
      }

      setAllChanges({});
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2500);
      toast.success("All changes saved");
    } catch {
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (passwords.password !== passwords.password_confirmation)
      return toast.error("Passwords do not match");
    setSaving(true);
    try {
      await api.post("/user/change-password", passwords);
      toast.success("Password changed. Please log in again.");
      await logout();
      navigate("/login");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="prefs-page">
      <div className="prefs-container">
        <div className="prefs-header">
          <button className="btn-icon" onClick={() => navigate("/")}>
            <ArrowLeft size={16} /> Back
          </button>
          <h1>Preferences</h1>
        </div>

        {/* Appearance */}
        <section className="prefs-section">
          <h2>Appearance</h2>

          <div className="prefs-field">
            <label>Theme</label>
            <div className="btn-group">
              {["light", "dark"].map((t) => (
                <button
                  key={t}
                  className={`btn-option ${prefs.theme === t ? "active" : ""}`}
                  onClick={() => setP("theme", t)}
                >
                  {t === "light" ? "☀️ Light" : "🌙 Dark"}
                </button>
              ))}
            </div>
          </div>

          <div className="prefs-field">
            <label>Font size</label>
            <div className="btn-group">
              {FONT_SIZES.map((s) => (
                <button
                  key={s}
                  className={`btn-option ${prefs.font_size === s ? "active" : ""}`}
                  onClick={() => setP("font_size", s)}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="prefs-field">
            <label>Default note color</label>
            <div className="color-picker-row">
              {NOTE_COLORS.map((c) => (
                <button
                  key={c}
                  className={`color-dot ${prefs.note_color === c ? "active" : ""}`}
                  style={{ background: c }}
                  onClick={() => setP("note_color", c)}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Profile */}
        <section className="prefs-section">
          <h2>Profile</h2>

          {/* Avatar */}
          <div className="avatar-section">
            <div
              className="avatar-preview"
              onClick={() => fileRef.current.click()}
            >
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar" />
              ) : (
                <div className="avatar-placeholder">
                  {user?.name?.[0]?.toUpperCase()}
                </div>
              )}
              <div className="avatar-overlay">📷</div>
            </div>
            <div className="avatar-info">
              <p className="text-muted" style={{ fontSize: "0.8rem" }}>
                Click avatar to change. JPG/PNG, max 2MB.
              </p>
              {avatarFile && (
                <button
                  className="btn-primary-sm"
                  onClick={saveAvatar}
                  disabled={uploadingAvatar}
                >
                  {uploadingAvatar ? "Uploading…" : "Save avatar"}
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={handleAvatarChange}
            />
          </div>

          {/* Name & Email */}
          <div style={{ marginTop: "1rem" }}>
            <div className="form-group">
              <label>Display name</label>
              <input
                type="text"
                value={profile.name}
                required
                onChange={(e) => setPro("name", e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={profile.email}
                required
                onChange={(e) => setPro("email", e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* Change password */}
        <section className="prefs-section">
          <h2>Change password</h2>
          <form onSubmit={changePassword}>
            <PasswordInput
              label="Current password"
              value={passwords.current_password}
              onChange={(v) => setPwd("current_password", v)}
              required
            />
            <PasswordInput
              label="New password"
              value={passwords.password}
              onChange={(v) => setPwd("password", v)}
              showStrength
              required
              minLength={8}
            />
            <PasswordInput
              label="Confirm new password"
              value={passwords.password_confirmation}
              onChange={(v) => setPwd("password_confirmation", v)}
              required
            />
            <button className="btn-primary-sm" type="submit" disabled={saving}>
              {saving ? "Saving…" : "Change password"}
            </button>
          </form>
        </section>

        {/* Danger zone */}
        <section className="prefs-section danger-zone">
          <h2>Account</h2>
          <button className="btn-danger" onClick={logout}>
            Sign out
          </button>
        </section>

        {/* Sticky Save Bar */}
        {hasChanges && (
          <div className="prefs-save-bar">
            <span className="prefs-unsaved-hint">You have unsaved changes</span>
            <button
              className="btn-primary-sm"
              onClick={saveAll}
              disabled={saving}
            >
              {saving ? "Saving…" : savedMsg ? "✓ Saved" : "Save all changes"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
