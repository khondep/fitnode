import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "./components/Sidebar";
import AppShell from "./components/AppShell";

export const metadata: Metadata = {
  title: "FitNode",
  description: "Your AI copilot for the job hunt",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-black text-white min-h-screen">
        <div className="flex">
          <Sidebar />
          <div className="flex-1">
            <AppShell>{children}</AppShell>
          </div>
        </div>
      </body>
    </html>
  );
}