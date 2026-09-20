"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useUser } from "@/lib/useUser";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/matches", label: "Job Matches" },
  { href: "/chat", label: "Tailor Chat" },
  { href: "/settings", label: "Settings" },
];

const AUTH_EXEMPT_PATHS = ["/login", "/reset-password", "/auth/confirm"];
const ONBOARDING_EXEMPT_PATHS = ["/onboarding", "/welcome", "/login", "/reset-password", "/auth/confirm"];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, supabase } = useUser();

  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [onboarded, setOnboarded] = useState(true);
  const [hasCheckedOnboarding, setHasCheckedOnboarding] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user && !AUTH_EXEMPT_PATHS.includes(pathname)) {
      router.push("/login");
      return;
    }

    if (!loading && user && !hasCheckedOnboarding) {
      fetch("/api/settings")
        .then((res) => res.json())
        .then((data) => {
          const isOnboarded = data.settings?.onboarded ?? false;
          setOnboarded(isOnboarded);
          setCheckingOnboarding(false);
          setHasCheckedOnboarding(true);

          if (!isOnboarded && !ONBOARDING_EXEMPT_PATHS.includes(pathname)) {
            router.push("/onboarding");
          }
        });
    } else if (!loading && user && hasCheckedOnboarding) {
      setCheckingOnboarding(false);
    }
  }, [loading, user, pathname, router, hasCheckedOnboarding]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (AUTH_EXEMPT_PATHS.includes(pathname)) return null;

  if (loading || !user || checkingOnboarding) {
    return (
      <aside className="w-64 min-h-screen border-r border-gray-800 p-4 bg-black hidden md:block">
        <p className="text-gray-500 text-sm">Loading...</p>
      </aside>
    );
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const navContent = (
    <>
      <div className="flex items-center gap-3 mb-10 px-2">
        <img src="/logo.png" alt="FitNode" className="w-11 h-11 md:w-14 md:h-14 object-contain" />
        <span className="font-bold text-2xl md:text-3xl text-white">FitNode</span>
      </div>

      <nav className="flex flex-col gap-1 flex-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-4 py-2.5 rounded-lg text-base transition-colors ${
                isActive
                  ? "bg-white text-black font-medium"
                  : "text-gray-300 hover:bg-gray-800"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-gray-800 pt-3">
        <p className="text-xs text-gray-500 mb-2 px-2 truncate">{user.email}</p>
        <button
          onClick={handleLogout}
          className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-gray-800"
        >
          Log out
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar with hamburger */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-gray-800 bg-black sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="FitNode" className="w-8 h-8 object-contain" />
          <span className="font-bold text-lg text-white">FitNode</span>
        </div>
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 text-gray-300 hover:text-white"
          aria-label="Open menu"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`md:hidden fixed top-0 left-0 h-full w-72 bg-black border-r border-gray-800 p-6 flex flex-col z-50 transition-transform duration-300 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="self-end mb-4 p-1 text-gray-400 hover:text-white"
          aria-label="Close menu"
        >
          <X className="w-6 h-6" />
        </button>
        {navContent}
      </aside>

      {/* Desktop / tablet sidebar */}
      <aside className="hidden md:flex w-64 lg:w-72 min-h-screen border-r border-gray-800 p-4 lg:p-6 flex-col bg-black">
        {navContent}
      </aside>
    </>
  );
}