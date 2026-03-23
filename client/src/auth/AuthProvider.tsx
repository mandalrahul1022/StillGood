import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, HouseholdInfo, UserProfile } from "../api/client";

interface AuthContextValue {
  user: UserProfile | null;
  household: HouseholdInfo | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setProfile: (payload: Partial<Pick<UserProfile, "name" | "householdName" | "prefsEmail" | "prefsInApp">>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [household, setHousehold] = useState<HouseholdInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const response = await api.me();
      setUser(response.user);
      setHousehold(response.household);
    } catch (_error) {
      setUser(null);
      setHousehold(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();

    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) void refresh();
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  const login = async (email: string, password: string) => {
    await api.login({ email, password });
    await refresh();
  };

  const register = async (name: string, email: string, password: string) => {
    await api.register({ name, email, password });
    await refresh();
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
    setHousehold(null);
  };

  const setProfile = async (
    payload: Partial<Pick<UserProfile, "name" | "householdName" | "prefsEmail" | "prefsInApp">>
  ) => {
    await api.updateMe(payload);
    await refresh();
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      household,
      loading,
      login,
      register,
      logout,
      refresh,
      setProfile
    }),
    [user, household, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
