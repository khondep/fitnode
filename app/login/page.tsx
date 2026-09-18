"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit() {
    setLoading(true);
    setMessage("");

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (error) setMessage(error.message);
      else setMessage("Check your email to confirm your account.");
    } else if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMessage(error.message);
      else router.push("/");
    } else if (mode === "reset") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) setMessage(error.message);
      else setMessage("Check your email for a password reset link.");
    }

    setLoading(false);
  }

  return (
    <main className="min-h-screen flex bg-black">
      {/* Left branding panel */}
      <div className="hidden lg:flex w-1/2 relative overflow-hidden bg-gradient-to-br from-gray-950 via-black to-gray-900 border-r border-gray-800 flex-col justify-center px-20">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_30%_20%,rgba(99,179,237,0.3),transparent_50%)]" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-10">
            <img src="/logo.png" alt="FitNode" className="w-14 h-14 object-contain" />
            <span className="font-bold text-3xl text-white">FitNode</span>
          </div>

          <h1 className="text-4xl font-semibold mb-6 leading-tight max-w-md">
            Your AI copilot for the job hunt
          </h1>

          <p className="text-gray-400 text-base leading-relaxed max-w-md mb-12">
            Upload your resume once. FitNode matches you to relevant roles,
            tailors your resume for each one, and drafts outreach emails to
            recruiters — so you can focus on interviewing, not busywork.
          </p>

          <div className="flex flex-col gap-4 max-w-md">
            <div className="flex items-center gap-3 text-sm text-gray-300">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              Real job postings from Adzuna & USAJobs
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-300">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              AI-tailored resumes for every role
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-300">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
              Drafted cold emails to recruiters
            </div>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-3 mb-10 justify-center">
            <img src="/logo.png" alt="FitNode" className="w-10 h-10 object-contain" />
            <span className="font-bold text-2xl text-white">FitNode</span>
          </div>

          <h2 className="text-3xl font-bold mb-2">
            {mode === "signin" && "Welcome back"}
            {mode === "signup" && "Create your account"}
            {mode === "reset" && "Reset your password"}
          </h2>
          <p className="text-gray-400 text-base mb-10">
            {mode === "signin" && "Sign in to continue to your dashboard"}
            {mode === "signup" && "Start tailoring resumes in minutes"}
            {mode === "reset" && "We'll email you a reset link"}
          </p>

          <div className="flex flex-col gap-4">
            {mode === "signup" && (
              <input
                type="text"
                placeholder="Full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-base focus:outline-none focus:border-gray-500 transition-colors"
              />
            )}

            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-base focus:outline-none focus:border-gray-500 transition-colors"
            />

            {mode !== "reset" && (
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-base focus:outline-none focus:border-gray-500 transition-colors"
              />
            )}

            {message && <p className="text-sm text-amber-400">{message}</p>}

            <button
              onClick={handleSubmit}
              disabled={
                loading ||
                !email ||
                (mode !== "reset" && !password) ||
                (mode === "signup" && !fullName)
              }
              className="bg-white text-black rounded-lg p-4 text-base font-medium disabled:opacity-50 mt-2 hover:bg-gray-100 transition-colors"
            >
              {loading
                ? "Please wait..."
                : mode === "signin"
                ? "Sign In"
                : mode === "signup"
                ? "Create Account"
                : "Send Reset Link"}
            </button>
          </div>

          <div className="text-center text-sm text-gray-400 mt-8 flex flex-col gap-3">
            {mode === "signin" && (
              <>
                <button onClick={() => setMode("reset")} className="underline hover:text-white transition-colors">
                  Forgot password?
                </button>
                <span>
                  Don't have an account?{" "}
                  <button
                    onClick={() => setMode("signup")}
                    className="underline text-white font-medium"
                  >
                    Sign up
                  </button>
                </span>
              </>
            )}
            {mode === "signup" && (
              <span>
                Already have an account?{" "}
                <button
                  onClick={() => setMode("signin")}
                  className="underline text-white font-medium"
                >
                  Sign in
                </button>
              </span>
            )}
            {mode === "reset" && (
              <button onClick={() => setMode("signin")} className="underline hover:text-white transition-colors">
                Back to sign in
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}