import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogOut, ShoppingBag } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { ThemeToggle } from "./Theme";

export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const { me, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="page-shell flex flex-col">
      <header className="glass-header">
        <div className="container-app grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 h-16">
          <Link to="/" className="flex min-w-0 items-center gap-2.5 font-bold">
            <span className="icon-tile h-9 w-9 bg-gradient-to-br from-brand-500 to-brand-700 text-white shrink-0">
              <ShoppingBag className="h-5 w-5" strokeWidth={2.4} />
            </span>
            <span className="truncate bg-gradient-to-r from-brand-600 to-violet-600 bg-clip-text text-transparent">
              {title}
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {me && (
              <>
                <span className="muted hidden md:inline text-xs">
                  {me.username} · <b>{me.role}</b>
                </span>
                <button className="btn-outline btn-sm" onClick={() => { logout(); navigate("/"); }}>
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Выйти</span>
                </button>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="container-app flex-1 py-6 sm:py-8 animate-fade-up">{children}</main>
      <footer className="container-app py-6 text-center text-xs muted">© Store System v3</footer>
    </div>
  );
}

// Re-exports for compatibility
export { StatusBadge } from "../ui/Status";
export { ErrorBanner, SuccessBanner, EmptyState as Empty, LoadingSkeleton as Loader } from "../ui/Feedback";
