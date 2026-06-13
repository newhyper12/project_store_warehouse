import { useState, type FormEvent, type ReactNode } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { ShoppingBag, Store, Users, Warehouse, Factory, KeyRound, LogIn } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { AppShell } from "./Shell";
import { ErrorBanner } from "../ui/Feedback";
import { IconTile } from "../ui/IconTile";
import { HubCard } from "./HubCard";
import type { Role } from "../types";

const ROLE_META: Record<Role, { label: string; icon: typeof Store; tone: Parameters<typeof IconTile>[0]["tone"] }> = {
  customer:  { label: "Покупатель",     icon: Users,     tone: "violet" },
  store:     { label: "Магазин",        icon: Store,     tone: "blue" },
  warehouse: { label: "Склад",          icon: Warehouse, tone: "emerald" },
  supplier:  { label: "Поставщик",      icon: Factory,   tone: "amber" },
  admin:     { label: "Администратор",  icon: KeyRound,  tone: "slate" },
};

const TEST_USERS: Record<Role, { username: string; password: string } | undefined> = {
  customer:  { username: "customer1",  password: "password123" },
  store:     { username: "store1",     password: "password123" },
  warehouse: { username: "warehouse1", password: "password123" },
  supplier:  { username: "supplier1",  password: "password123" },
  admin: undefined,
};

export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { me, loading } = useAuth();
  if (loading) return <AppShell title="…"><div className="card p-8 muted">Загрузка…</div></AppShell>;
  if (!me) return <Navigate to={`/login?role=${role}`} replace />;
  if (me.role !== role) return <Navigate to={`/${me.role}`} replace />;
  return <>{children}</>;
}

export function LoginPage({ allowedRoles, title }: { allowedRoles: Role[]; title: string }) {
  const [params] = useSearchParams();
  const initial = (params.get("role") as Role) || allowedRoles[0];
  const [role, setRole] = useState<Role>(allowedRoles.includes(initial) ? initial : allowedRoles[0]);
  const [username, setUsername] = useState(TEST_USERS[role]?.username || "");
  const [password, setPassword] = useState(TEST_USERS[role]?.password || "");
  const [err, setErr] = useState<{ message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      const u = await login(username, password, role);
      navigate(`/${u.role}`, { replace: true });
    } catch (e) { setErr(e as { message: string }); }
    finally { setBusy(false); }
  };

  const onRoleChange = (r: Role) => {
    setRole(r);
    const t = TEST_USERS[r];
    if (t) { setUsername(t.username); setPassword(t.password); }
  };

  const meta = ROLE_META[role];
  return (
    <AppShell title={title}>
      <div className="mx-auto max-w-md">
        <div className="card p-6 sm:p-8 animate-scale-in">
          <div className="mb-5 flex flex-col items-center text-center">
            <IconTile icon={meta.icon} tone={meta.tone} size="lg" />
            <h1 className="h2 mt-4">Вход — {meta.label}</h1>
            <p className="muted mt-1 text-sm">Войдите, чтобы продолжить</p>
          </div>

          <div className="mb-4">
            <label className="label">Роль</label>
            <div className="grid grid-cols-2 gap-2">
              {allowedRoles.map((r) => {
                const m = ROLE_META[r];
                const Icon = m.icon;
                const active = role === r;
                return (
                  <button key={r} type="button" onClick={() => onRoleChange(r)}
                    className={`btn ${active ? "btn-primary" : "btn-outline"} justify-start`}>
                    <Icon className="h-4 w-4" />
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="label">Логин</label>
              <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} required autoComplete="username" />
            </div>
            <div>
              <label className="label">Пароль</label>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
            </div>
            <ErrorBanner error={err} onDismiss={() => setErr(null)} />
            <button type="submit" className="btn-primary w-full" disabled={busy}>
              <LogIn className="h-4 w-4" />
              {busy ? "Вход…" : "Войти"}
            </button>
          </form>

          {TEST_USERS[role] && (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-3 text-xs">
              <div className="font-semibold mb-1">Тестовый пользователь</div>
              <div className="muted">логин <b>{TEST_USERS[role]!.username}</b> · пароль <b>{TEST_USERS[role]!.password}</b></div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

export function HubPage({
  title, subtitle, roles, archInfo,
}: {
  title: string;
  subtitle?: string;
  roles: { role: Role; title: string; description: string; points?: string[]; tone?: Parameters<typeof IconTile>[0]["tone"] }[];
  archInfo?: { label: string; value: string }[];
}) {
  const navigate = useNavigate();
  return (
    <AppShell title={title}>
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 text-center animate-fade-up">
          <IconTile icon={ShoppingBag} tone="blue" size="lg" className="mx-auto mb-5" />
          <h1 className="h1">{title}</h1>
          {subtitle && (
            <p className="muted mx-auto mt-3 max-w-2xl text-base sm:text-lg">{subtitle}</p>
          )}
        </div>

        <div className="grid gap-5 sm:gap-6 md:grid-cols-2">
          {roles.map((r) => {
            const m = ROLE_META[r.role];
            return (
              <HubCard key={r.role}
                title={r.title}
                description={r.description}
                icon=  {m.icon}
                tone=  {r.tone ?? m.tone}
                points={r.points || []}
                onClick={() => navigate(`/login?role=${r.role}`)} />
            );
          })}
        </div>

        {archInfo && archInfo.length > 0 && (
          <section className="card mt-8 p-5 sm:p-6">
            <h2 className="h3">Архитектура</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {archInfo.map((a) => (
                <div key={a.label} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-3.5">
                  <div className="text-xs font-bold text-brand-700 dark:text-brand-300 uppercase tracking-wide">{a.label}</div>
                  <div className="mt-1 text-sm">{a.value}</div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
