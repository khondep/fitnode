"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Briefcase, TrendingUp, Sparkles, Upload } from "lucide-react";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [stats, setStats] = useState({ matchCount: 0, avgScore: 0 });
  const [analytics, setAnalytics] = useState<{
    matchDistribution: { name: string; value: number }[];
    sourceBreakdown: { name: string; value: number }[];
  }>({ matchDistribution: [], sourceBreakdown: [] });
  const [tailoredCount, setTailoredCount] = useState(0);

  useEffect(() => {
    fetch("/api/matches/list")
      .then((res) => res.json())
      .then((data) => {
        const matches = data.matches ?? [];
        const avg =
          matches.length > 0
            ? matches.reduce((sum: number, m: any) => sum + m.score, 0) /
              matches.length
            : 0;
        setStats({ matchCount: matches.length, avgScore: Math.round(avg * 100) });
        setTailoredCount(matches.filter((m: any) => m.tailored_resume).length);
      });

    fetch("/api/analytics/summary")
      .then((res) => res.json())
      .then((data) => setAnalytics(data));
  }, [uploaded]);

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/resume/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (data.success) {
        setUploaded(true);
        fetch("/api/pipeline/run", { method: "POST" });
      } else {
        setUploadError(data.error || "Upload failed. Please try again.");
      }
    } catch (err) {
      setUploadError("Upload failed. Please check your connection and try again.");
    }

    setUploading(false);
  }

  return (
    <main className="w-full">
      <h1 className="text-2xl font-bold mb-1">Dashboard</h1>
      <p className="text-gray-400 mb-8">
        Upload your resume to unlock personalized job matches and drafts.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 mb-8">
        <div className="border border-gray-800 rounded-xl p-8 relative">
          <div className="absolute top-6 right-6 w-9 h-9 rounded-lg bg-gray-900 flex items-center justify-center">
            <Briefcase className="w-4 h-4 text-gray-400" />
          </div>
          <p className="text-gray-400 text-base mb-2">Job matches</p>
          <p className="text-5xl font-bold">{stats.matchCount}</p>
        </div>

        <div className="border border-gray-800 rounded-xl p-8 relative">
          <div className="absolute top-6 right-6 w-9 h-9 rounded-lg bg-gray-900 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-gray-400" />
          </div>
          <p className="text-gray-400 text-base mb-2">Avg. match score</p>
          <p className="text-5xl font-bold">{stats.avgScore}%</p>
        </div>

        <div className="border border-gray-800 rounded-xl p-8 relative">
          <div className="absolute top-6 right-6 w-9 h-9 rounded-lg bg-gray-900 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-gray-400" />
          </div>
          <p className="text-gray-400 text-base mb-2">Tailored drafts</p>
          <p className="text-5xl font-bold">{tailoredCount}</p>
        </div>
      </div>

      {(analytics.matchDistribution.length > 0 || analytics.sourceBreakdown.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 mb-8">
          <div className="border border-gray-800 rounded-xl p-8">
            <h3 className="text-gray-400 text-base mb-4">Match Quality Distribution</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={analytics.matchDistribution}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  animationDuration={800}
                >
                  {analytics.matchDistribution.map((_, i) => (
                    <Cell
                      key={i}
                      fill={["#4ade80", "#22d3ee", "#818cf8", "#c084fc"][i % 4]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "#111", border: "1px solid #333", borderRadius: 8 }}
                />
                <Legend wrapperStyle={{ fontSize: 13 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="border border-gray-800 rounded-xl p-8">
            <h3 className="text-gray-400 text-base mb-4">Job Sources</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={analytics.sourceBreakdown}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  animationDuration={800}
                >
                  {analytics.sourceBreakdown.map((_, i) => (
                    <Cell key={i} fill={["#38bdf8", "#f472b6"][i % 2]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "#111", border: "1px solid #333", borderRadius: 8 }}
                />
                <Legend wrapperStyle={{ fontSize: 13 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="border border-gray-800 rounded-xl p-8">
        <h2 className="font-semibold text-xl mb-6">Your resume</h2>

        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const dropped = e.dataTransfer.files?.[0];
            if (dropped) setFile(dropped);
          }}
          className="border-2 border-dashed border-gray-800 rounded-xl py-16 flex flex-col items-center justify-center text-center"
        >
          <div className="w-14 h-14 rounded-full bg-gray-900 flex items-center justify-center mb-4">
            <Upload className="w-6 h-6 text-gray-400" />
          </div>
          <p className="text-lg font-medium mb-1">
            {uploading
              ? "Uploading and processing your resume..."
              : uploaded
              ? "✓ Resume uploaded successfully"
              : file
              ? file.name
              : "Drag & drop your resume"}
          </p>
          <p className="text-sm text-gray-500 mb-6">PDF or DOCX, up to 5 MB</p>

          <label className="bg-white text-black px-5 py-2.5 rounded-lg text-sm font-medium cursor-pointer hover:bg-gray-100 transition-colors">
            Browse files
            <input
              type="file"
              accept=".pdf,.docx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
          </label>

          {file && !uploaded && (
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="mt-4 bg-cyan-500 text-black px-6 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {uploading ? "Uploading..." : "Upload Resume"}
            </button>
          )}
        </div>

        {uploadError && (
          <p className="text-red-400 text-sm mt-4 text-center">{uploadError}</p>
        )}

        {uploaded && (
          <div className="mt-4 pt-4 border-t border-gray-800">
            <p className="text-green-400 text-sm mb-1">✓ Resume uploaded</p>
            <p className="text-gray-500 text-xs mb-2">
              Finding your best-fit jobs in the background — this takes about 30 seconds.
            </p>
            <Link href="/matches" className="text-sm underline text-gray-300">
              View your job matches →
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}