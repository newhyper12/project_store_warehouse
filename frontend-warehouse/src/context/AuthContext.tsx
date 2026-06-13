import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, setUnauthorizedHandler } from "../api/client";
import type { Me, Role } from "../types";

interface AuthCtx {
  me: Me | null;
  loading: boolean;
  login: (username: string, password: string, expectedRole?: Role) => Promise<Me>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUnauthorizedHandler(() => setMe(null));
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }
    api.me()
      .then((u: Me) => setMe(u))
      .catch(() => localStorage.removeItem("token"))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (username: string, password: string, expectedRole?: Role) => {
    const token = await api.login(username, password);
    localStorage.setItem("token", token);
    const u: Me = await api.me();
    if (expectedRole && u.role !== expectedRole) {
      localStorage.removeItem("token");
      throw { status: 403, message: `У этого пользователя роль "${u.role}", ожидалась "${expectedRole}"` };
    }
    setMe(u);
    return u;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setMe(null);
  }, []);

  const value = useMemo(() => ({ me, loading, login, logout }), [me, loading, login, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("AuthProvider missing");
  return v;
}
