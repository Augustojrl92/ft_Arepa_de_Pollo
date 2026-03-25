"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { getProfile, postLogout, postTokenRefresh } from "@/lib/authApi";
import { User } from "@/types";

type AuthStatus = "idle" | "loading" | "authenticated" | "unauthenticated";

interface AuthState {
  user: User | null;
  status: AuthStatus;
  error: string | null;
  hasHydrated: boolean;

  setSession: (payload: { user: User }) => void;
  clearSession: () => void;
  logout: () => Promise<void>;
  setError: (msg: string | null) => void;
  setHasHydrated: (value: boolean) => void;
  initializeAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      status: "idle",
      error: null,
      hasHydrated: false,
			
      setSession: ({ user }) =>
        set({
          user,
          status: "authenticated",
          error: null,
        }),

      clearSession: () =>
        set({
          user: null,
          status: "unauthenticated",
          error: null,
        }),

      logout: async () => {
        try {
          await postLogout()
        } catch {
          // Keep local cleanup even if backend logout fails.
        }

        get().clearSession()
      },

      setError: (msg) => set({ error: msg }),
      setHasHydrated: (value) => set({ hasHydrated: value }),

      initializeAuth: async () => {
        if (get().status === "loading") {
          return
        }

        set({ status: "loading" });

        try {
          const profile = await getProfile()
          set({
            user: {
              id: profile.user_id,
              username: profile.display_name,
              email: profile.email ?? "",
              avatar: profile.avatar_url,
              login: profile.login,
              coalition: profile.coalition || "tiamant",
              intraLevel: profile.intra_level,
              coalitionPoints: 0,
              coalitionRank: 1,
              walletAmount: profile.intra_wallet,
              evalPoints: profile.eval_points || 100,
            },
            status: "authenticated",
            error: null,
          })
          return
        } catch {
          // Try refresh cookie if access cookie expired.
        }

        try {
          await postTokenRefresh()
          const profile = await getProfile()
          set({
            user: {
              id: profile.user_id,
              username: profile.display_name,
              email: profile.email ?? "",
              avatar: profile.avatar_url,
              login: profile.login,
              coalition: profile.coalition || "tiamant",
              intraLevel: profile.intra_level,
              coalitionPoints: 0,
              coalitionRank: 1,
              walletAmount: profile.intra_wallet,
              evalPoints: profile.eval_points || 100,
            },
            status: "authenticated",
            error: null,
          })
          return
        } catch {
          set({
            user: null,
            status: "unauthenticated",
          })
        }
      },
    }),
    {
      name: "auth-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);