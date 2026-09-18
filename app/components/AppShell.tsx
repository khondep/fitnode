"use client";

import { usePathname } from "next/navigation";

const FULL_BLEED_PATHS = ["/login", "/onboarding", "/welcome", "/reset-password"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isFullBleed = FULL_BLEED_PATHS.includes(pathname);

  if (isFullBleed) {
    return <>{children}</>;
  }

  return (
    <>
      <header className="border-b border-gray-800 px-8 py-4">
        <p className="text-sm text-gray-400">Your AI copilot for the job hunt</p>
      </header>
      <div className="p-10 max-w-7xl mx-auto w-full">{children}</div>
    </>
  );
}