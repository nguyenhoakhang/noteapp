import { useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useSearchParams,
  Outlet,
} from "react-router-dom";
import { Toaster, toast } from "react-hot-toast";
import useAuthStore from "./store/authStore";

import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import PreferencesPage from "./pages/PreferencesPage";
import NotesPage from "./pages/NotesPage";
import SharedWithMePage from "./pages/SharedWithMePage"; // ✅ Import SharedWithMePage
import UnverifiedBanner from "./components/UnverifiedBanner";

// ✅ Import unified sync engine
import useSyncEngine from "./hooks/useSyncEngine";

// ✅ Layout component cho các route cần xác thực
function AppLayout() {
  const { user } = useAuthStore();
  return (
    <>
      {user && !user.email_verified_at && <UnverifiedBanner />}
      <Outlet />
    </>
  );
}

// ✅ Component đồng bộ theme và font size từ user preferences
function ThemeAndFontSync() {
  const { user } = useAuthStore();

  useEffect(() => {
    if (!user) return;
    const root = document.documentElement;

    // Font size mapping
    const sizeMap = { small: "14px", medium: "16px", large: "18px" };
    root.style.setProperty(
      "--app-font-size",
      sizeMap[user.font_size] || "16px",
    );

    // Theme
    if (user.theme) {
      root.setAttribute("data-theme", user.theme);
    }
  }, [user?.font_size, user?.theme]);

  return null;
}

function RequireAuth({ children }) {
  const { user, token, loading } = useAuthStore();
  if (loading) return <div className="loading-screen" />;
  if (!token || !user) return <Navigate to="/login" replace />;
  return children;
}

function GuestOnly({ children }) {
  const { token } = useAuthStore();
  if (token) return <Navigate to="/notes" replace />;
  return children;
}

// ✅ Component xử lý thông báo xác thực email từ URL
function VerifiedToast() {
  const [params, setParams] = useSearchParams();

  useEffect(() => {
    if (params.get("verified") === "1") {
      toast.success("Email verified! Your account is now active.");
      useAuthStore.getState().fetchMe();
      setParams({});
    }
    if (params.get("verified") === "error") {
      toast.error("Verification link invalid or expired.");
      setParams({});
    }
  }, [params, setParams]);

  return null;
}

export default function App() {
  const { fetchMe, token } = useAuthStore();

  // ✅ Initialize sync engine when app loads
  useSyncEngine();

  useEffect(() => {
    if (token) fetchMe();
    else useAuthStore.setState({ loading: false });
  }, [fetchMe, token]);

  return (
    <BrowserRouter>
      <VerifiedToast />
      <ThemeAndFontSync />
      <Toaster position="top-right" />
      <Routes>
        <Route
          path="/login"
          element={
            <GuestOnly>
              <LoginPage />
            </GuestOnly>
          }
        />
        <Route
          path="/register"
          element={
            <GuestOnly>
              <RegisterPage />
            </GuestOnly>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <GuestOnly>
              <ForgotPasswordPage />
            </GuestOnly>
          }
        />
        <Route
          path="/reset-password/:token"
          element={
            <GuestOnly>
              <ResetPasswordPage />
            </GuestOnly>
          }
        />

        {/* ✅ Các route cần xác thực được bọc trong AppLayout */}
        <Route
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route path="/notes" element={<NotesPage />} />
          <Route path="/preferences" element={<PreferencesPage />} />
          {/* ✅ Shared route */}
          <Route path="/shared" element={<SharedWithMePage />} />
          <Route path="/" element={<Navigate to="/notes" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
