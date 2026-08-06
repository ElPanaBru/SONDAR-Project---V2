import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session, User } from '@supabase/supabase-js';
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

import { api } from '@/lib/api';
import { IS_SUPABASE_CONFIGURED } from '@/lib/config';
import { supabase } from '@/lib/supabase';

type AuthContextValue = {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  user: User | null;
  token: string | null;
  needsOnboarding: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, username: string) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const onboardingKey = (userId: string) => `sondar:onboarding-pending:${userId}`;

async function readOnboardingPending(nextSession: Session | null) {
  if (!nextSession?.user?.id) return false;
  return await AsyncStorage.getItem(onboardingKey(nextSession.user.id)) === 'true';
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    if (!IS_SUPABASE_CONFIGURED) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        setSession(null);
        setNeedsOnboarding(false);
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.getUser();
      if (error) {
        await supabase.auth.signOut({ scope: 'local' }).catch(() => null);
        setSession(null);
        setNeedsOnboarding(false);
      } else {
        setSession(data.session);
        setNeedsOnboarding(await readOnboardingPending(data.session));
      }
      setLoading(false);
    }).catch(() => {
      setSession(null);
      setNeedsOnboarding(false);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        setNeedsOnboarding(false);
      } else {
        readOnboardingPending(nextSession).then(setNeedsOnboarding).catch(() => null);
      }
      setLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    configured: IS_SUPABASE_CONFIGURED,
    loading,
    session,
    user: session?.user || null,
    token: session?.access_token || null,
    needsOnboarding,
    signIn: async (email, password) => {
      if (!IS_SUPABASE_CONFIGURED) throw new Error('Falta configurar Supabase en la app móvil.');
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      if (!data.session) throw new Error('No pudimos abrir la sesion.');
      setSession(data.session);
      setNeedsOnboarding(await readOnboardingPending(data.session));
      const verification = await api<{ existe: boolean }>('/api/usuarios/me', { token: data.session.access_token });
      if (!verification.existe) {
        const username = data.user.user_metadata?.username;
        if (!username) throw new Error('La cuenta no tiene un perfil SONDAR asociado.');
        await api('/api/usuarios/registrar', {
          method: 'POST', token: data.session.access_token, body: JSON.stringify({ username }),
        });
      }
    },
    signUp: async (email, password, username) => {
      if (!IS_SUPABASE_CONFIGURED) throw new Error('Falta configurar Supabase en la app movil.');
      const created = await api<{ creadoConAdmin?: boolean }>('/api/usuarios/crear-cuenta', {
        method: 'POST', token: null, body: JSON.stringify({ email: email.trim(), password, username: username.trim().replace(/^@/, '').toLowerCase() }),
      });
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        const lower = String(error.message || '').toLowerCase();
        if (created?.creadoConAdmin === false && (lower.includes('confirm') || lower.includes('email') || lower.includes('credential') || lower.includes('invalid'))) {
          throw new Error('Cuenta creada. Revisa tu correo para confirmar el registro.');
        }
        throw error;
      }
      if (!data.session) throw new Error('Cuenta creada. Revisa tu correo para confirmar el registro.');
      await AsyncStorage.setItem(onboardingKey(data.session.user.id), 'true');
      setSession(data.session);
      setNeedsOnboarding(true);
    },
    completeOnboarding: async () => {
      if (session?.user?.id) await AsyncStorage.removeItem(onboardingKey(session.user.id));
      setNeedsOnboarding(false);
    },
    signOut: async () => {
      if (session?.user?.id) await AsyncStorage.removeItem(onboardingKey(session.user.id)).catch(() => null);
      await supabase.auth.signOut({ scope: 'local' });
      setSession(null);
      setNeedsOnboarding(false);
    },
  }), [loading, needsOnboarding, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return context;
}

