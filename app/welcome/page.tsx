"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function WelcomePage() {
  const [stage, setStage] = useState<"in" | "hold" | "out">("in");
  const router = useRouter();

  useEffect(() => {
    const t1 = setTimeout(() => setStage("hold"), 400);
    const t2 = setTimeout(() => setStage("out"), 1800);
    const t3 = setTimeout(() => router.push("/"), 2300);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [router]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-black">
      <img
        src="/logo.png"
        alt="FitNode"
        className={`w-24 h-24 object-contain transition-all duration-500 ${
          stage === "in"
            ? "opacity-0 scale-75"
            : stage === "hold"
            ? "opacity-100 scale-100"
            : "opacity-0 scale-110"
        }`}
      />
      <p
        className={`mt-6 text-xl font-semibold text-white transition-opacity duration-500 ${
          stage === "hold" ? "opacity-100" : "opacity-0"
        }`}
      >
        Welcome to FitNode
      </p>
      <p
        className={`mt-2 text-sm text-gray-400 transition-opacity duration-500 delay-100 ${
          stage === "hold" ? "opacity-100" : "opacity-0"
        }`}
      >
        Setting up your dashboard...
      </p>
    </main>
  );
}