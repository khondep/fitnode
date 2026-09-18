"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Match = {
  id: string;
  score: number;
  tailored_resume?: string | null;
  cold_email?: string | null;
  job: {
    id: string;
    title: string;
    company: string;
    location: string;
    url: string;
    posted_at: string;
  };
};

export default function MatchesPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedType, setExpandedType] = useState<"resume" | "email" | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [pipelineRunning, setPipelineRunning] = useState(false);

  useEffect(() => {
    loadMatches();
  }, []);

  function loadMatches() {
    fetch("/api/matches/list")
      .then((res) => res.json())
      .then((data) => {
        setMatches(data.matches ?? []);
        setLoading(false);
      });
  }

  async function handleRefresh() {
    setPipelineRunning(true);
    const res = await fetch("/api/pipeline/run", { method: "POST" });
    const data = await res.json();
    console.log("Pipeline result:", data);
    loadMatches();
    setPipelineRunning(false);
  }

  async function handleTailor(matchId: string) {
    setActionLoading(matchId + "-resume");
    const res = await fetch(`/api/matches/${matchId}/tailor`, { method: "POST" });
    const data = await res.json();

    setMatches((prev) =>
      prev.map((m) =>
        m.id === matchId ? { ...m, tailored_resume: data.tailoredResume } : m
      )
    );
    setExpandedId(matchId);
    setExpandedType("resume");
    setActionLoading(null);
  }

  async function handleColdEmail(matchId: string) {
    setActionLoading(matchId + "-email");
    const res = await fetch(`/api/matches/${matchId}/cold-email`, { method: "POST" });
    const data = await res.json();

    setMatches((prev) =>
      prev.map((m) =>
        m.id === matchId ? { ...m, cold_email: data.coldEmail } : m
      )
    );
    setExpandedId(matchId);
    setExpandedType("email");
    setActionLoading(null);
  }

  function toggleExpand(matchId: string, type: "resume" | "email") {
    if (expandedId === matchId && expandedType === type) {
      setExpandedId(null);
      setExpandedType(null);
    } else {
      setExpandedId(matchId);
      setExpandedType(type);
    }
  }

  if (loading) {
    return <main className="p-8">Loading matches...</main>;
  }

  return (
    <main className="max-w-3xl mx-auto">
      <Link href="/" className="text-sm text-gray-500 underline mb-4 inline-block">
        ← Back to upload
      </Link>

      <h1 className="text-2xl font-bold mb-4">Your Job Matches</h1>

      <button
        onClick={handleRefresh}
        disabled={pipelineRunning}
        className="text-sm bg-white text-black px-4 py-2 rounded-lg font-medium disabled:opacity-50 mb-6"
      >
        {pipelineRunning ? "Finding matches... (this can take ~30s)" : "Refresh Matches"}
      </button>

      <div className="flex flex-col gap-4">
        {matches.map((match) => {
          const isExpanded = expandedId === match.id;
          const resumeLoading = actionLoading === match.id + "-resume";
          const emailLoading = actionLoading === match.id + "-email";

          return (
            <div key={match.id} className="border rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="font-semibold text-lg">{match.job.title}</h2>
                  <p className="text-gray-600">
                    {match.job.company} — {match.job.location}
                  </p>
                  <a
                   href={match.job.url}
                   target="_blank"
                   rel="noopener noreferrer"
                   className="inline-block bg-green-600 text-white text-sm font-medium px-4 py-1.5 rounded-lg hover:bg-green-500 transition-colors"
                   >
                   Apply →
                  </a>
                </div>
                <span className="text-sm font-medium bg-gray-100 text-gray-900 px-2 py-1 rounded">
                  {Math.round(match.score * 100)}% match
                </span>
              </div>

              <div className="flex gap-2 mt-4">
                {match.tailored_resume ? (
                  <button
                    onClick={() => toggleExpand(match.id, "resume")}
                    className="text-sm border rounded px-3 py-1"
                  >
                    {isExpanded && expandedType === "resume" ? "Hide" : "View"} Tailored Resume
                  </button>
                ) : (
                  <button
                    onClick={() => handleTailor(match.id)}
                    disabled={resumeLoading}
                    className="text-sm bg-black text-white rounded px-3 py-1 disabled:opacity-50"
                  >
                    {resumeLoading ? "Tailoring..." : "Tailor Resume"}
                  </button>
                )}

                {match.cold_email ? (
                  <button
                    onClick={() => toggleExpand(match.id, "email")}
                    className="text-sm border rounded px-3 py-1"
                  >
                    {isExpanded && expandedType === "email" ? "Hide" : "View"} Cold Email
                  </button>
                ) : (
                  <button
                    onClick={() => handleColdEmail(match.id)}
                    disabled={emailLoading}
                    className="text-sm bg-black text-white rounded px-3 py-1 disabled:opacity-50"
                  >
                    {emailLoading ? "Drafting..." : "Draft Email"}
                  </button>
                )}
              </div>

              {isExpanded && expandedType === "resume" && match.tailored_resume && (
                <pre className="mt-4 bg-gray-50 text-gray-900 p-4 rounded text-xs whitespace-pre-wrap max-h-96 overflow-auto">
                  {match.tailored_resume}
                </pre>
              )}

              {isExpanded && expandedType === "email" && match.cold_email && (
                <pre className="mt-4 bg-gray-50 text-gray-900 p-4 rounded text-xs whitespace-pre-wrap max-h-96 overflow-auto">
                  {match.cold_email}
                </pre>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}