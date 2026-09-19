"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ConfirmPage() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => router.push("/login"), 2500);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-black text-white">
      <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-6">
        <span className="text-3xl">✓</span>
      </div>
      <h1 className="text-2xl font-bold mb-2">Email confirmed!</h1>
      <p className="text-gray-400">Redirecting you to sign in...</p>
    </main>
  );
}