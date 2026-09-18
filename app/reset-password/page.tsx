"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  async function handleReset() {
    if (password.length < 6) {
      setMessage("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setMessage("Passwords don't match.");
      return;
    }

    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setMessage(error.message);
    } else {
      setSuccess(true);
      setTimeout(() => router.push("/"), 2000);
    }

    setLoading(false);
  }

  return (
    <main className="max-w-sm mx-auto mt-24">
      <h1 className="text-2xl font-bold mb-1 text-center">Reset your password</h1>
      <p className="text-gray-400 text-sm mb-8 text-center">
        Enter a new password for your account.
      </p>

      {success ? (
        <p className="text-green-400 text-sm text-center">
          Password updated! Redirecting you now...
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <input
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-gray-900 border border-gray-800 rounded-lg p-3 text-sm"
          />
          <input
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="bg-gray-900 border border-gray-800 rounded-lg p-3 text-sm"
          />

          {message && <p className="text-sm text-amber-400">{message}</p>}

          <button
            onClick={handleReset}
            disabled={loading || !password || !confirmPassword}
            className="bg-white text-black rounded-lg p-3 text-sm font-medium disabled:opacity-50"
          >
            {loading ? "Updating..." : "Update Password"}
          </button>
        </div>
      )}
    </main>
  );
}