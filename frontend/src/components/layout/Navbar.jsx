import { useEffect, useState } from "react"; // ✅ Thêm useState
import {
  LayoutGrid,
  List,
  LogOut,
  Settings,
  Moon,
  Sun,
  X,
  Menu,
} from "lucide-react";
import useAuthStore from "../../store/authStore";
import { useNavigate } from "react-router-dom";

export default function Navbar({
  search,
  setSearch,
  searching,
  view,
  setView,
  theme,
  toggleTheme,
  onMenuClick,
  onHomeClick, // Click brand to go to "All Notes"
}) {

  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [avatarVersion, setAvatarVersion] = useState(Date.now());
  useEffect(() => {
    // Update avatar version khi user avatar thay đổi
    setAvatarVersion(Date.now());
  }, [user?.avatar]);

  const avatarSrc = user?.avatar
    ? `/storage/${user.avatar}?t=${avatarVersion}`
    : null;

  return (
    <nav className="navbar">
      {/* ✅ Thêm menu button cho mobile */}
      <button className="menu-btn" onClick={onMenuClick} title="Menu">
        <Menu size={18} />
      </button>

      <div className="navbar-brand" onClick={onHomeClick} title="All Notes">
        📝 NoteApp
      </div>


      {/* Phần Search Indicator đã được cập nhật */}
      <div className="search-wrap">
        <input
          className="search-input"
          type="text"
          placeholder="Search notes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {/* Hiện spinner khi đang tìm kiếm */}
        {searching && <span className="search-spinner" />}

        {/* Hiện nút X để xóa nhanh khi đã nhập text và không trong trạng thái search */}
        {search && !searching && (
          <button
            className="search-clear"
            onClick={() => setSearch("")}
            type="button"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <div className="navbar-actions">
        <button onClick={toggleTheme} title="Toggle theme">
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button
          className="toolbar-btn view-toggle"
          onClick={() => setView((v) => (v === "grid" ? "list" : "grid"))}
          title={view === "grid" ? "Switch to list" : "Switch to grid"}
        >
          {view === "grid" ? <List size={18} /> : <LayoutGrid size={18} />}
        </button>
        <button onClick={() => navigate("/preferences")} title="Preferences">
          <Settings size={18} />
        </button>
        <div
          className="navbar-avatar"
          onClick={() => navigate("/preferences")}
          title="Preferences"
        >
          {avatarSrc ? (
            <img src={avatarSrc} alt={user?.name} className="nav-avatar-img" />
          ) : (
            <div className="nav-avatar-initials">
              {user?.name?.[0]?.toUpperCase()}
            </div>
          )}
        </div>
        <button onClick={logout} title="Logout">
          <LogOut size={18} />
        </button>
      </div>
    </nav>
  );
}
