import React, { useState, useEffect, useCallback } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import Login from "./components/Login";
import { apiMe, setOnUnauthorized, type MeResponse } from "./services/api";

const Root: React.FC = () => {
  const [user, setUser] = useState<MeResponse | null | "loading">("loading");

  const checkAuth = useCallback(async () => {
    try {
      const me = await apiMe();
      setUser(me ?? null);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // 任意接口返回 401 时自动退出到登录页
  useEffect(() => {
    setOnUnauthorized(() => setUser(null));
  }, []);

  if (user === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f0a0a]">
        <div className="text-white/50 font-orbitron uppercase tracking-widest">加载中…</div>
      </div>
    );
  }

  if (!user) {
    return <Login onSuccess={checkAuth} />;
  }

  return <App currentUser={user} onLogout={checkAuth} />;
};

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
