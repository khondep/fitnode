"use client";

import { useEffect, useState } from "react";
import { MapPin, Building2, ExternalLink, FileText, Mail, RefreshCw } from "lucide-react";

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
    await fetch("/api/pipeline/run", { method: "POST" });
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

  function scoreColor(score: number) {
    const pct = score * 100;
    if (pct >= 70) return "text-green-400 bg-green-400/10";
    if (pct >= 50) return "text-cyan-400 bg-cyan-400/10";
    return "text-gray-400 bg-gray-400/10";
  }

  if (loading) {
    return (
      <main className="w-full">
        <p className="text-gray-500">Loading matches...</p>
      </main>
    );
  }

  return (
    <main className="w-full">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-1">Your Job Matches</h1>
          <p className="text-gray-400">
            {matches.length} role{matches.length !== 1 ? "s" : ""} ranked by how well they fit your resume.
          </p>
        </div>

        <button
          onClick={handleRefresh}
          disabled={pipelineRunning}
          className="flex items-center gap-2 text-sm bg-white text-black px-5 py-2.5 rounded-lg font-medium disabled:opacity-50 hover:bg-gray-100 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${pipelineRunning ? "animate-spin" : ""}`} />
          {pipelineRunning ? "Finding matches..." : "Refresh Matches"}
        </button>
      </div>

      {matches.length === 0 ? (
        <div className="border border-gray-800 rounded-xl p-16 text-center">
          <p className="text-gray-400 mb-2">No matches yet.</p>
          <p className="text-sm text-gray-600">
            Upload a resume on the Dashboard, then click Refresh Matches.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-5">
          {matches.map((match) => {
            const isExpanded = expandedId === match.id;
            const resumeLoading = actionLoading === match.id + "-resume";
            const emailLoading = actionLoading === match.id + "-email";

            return (
              <div key={match.id} className="border border-gray-800 rounded-xl p-6">
                <div className="flex justify-between items-start mb-3">
                  <h2 className="font-semibold text-lg leading-snug pr-4">
                    {match.job.title}
                  </h2>
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${scoreColor(
                      match.score
                    )}`}
                  >
                    {Math.round(match.score * 100)}% match
                  </span>
                </div>

                <div className="flex flex-col gap-1.5 text-sm text-gray-400 mb-4">
                  <span className="flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5" />
                    {match.job.company}
                  </span>
                  <span className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5" />
                    {match.job.location}
                  </span>
                </div>

                <a
                  href={match.job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors mb-4"
                >
                  Apply <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <div className="flex gap-2">
                  {match.tailored_resume ? (
                    <button
                      onClick={() => toggleExpand(match.id, "resume")}
                      className="flex items-center gap-1.5 text-sm border border-gray-700 rounded-lg px-3 py-1.5 hover:bg-gray-900 transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      {isExpanded && expandedType === "resume" ? "Hide" : "View"} Resume
                    </button>
                  ) : (
                    <button
                      onClick={() => handleTailor(match.id)}
                      disabled={resumeLoading}
                      className="flex items-center gap-1.5 text-sm bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5 disabled:opacity-50 hover:bg-gray-800 transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      {resumeLoading ? "Tailoring..." : "Tailor Resume"}
                    </button>
                  )}

                  {match.cold_email ? (
                    <button
                      onClick={() => toggleExpand(match.id, "email")}
                      className="flex items-center gap-1.5 text-sm border border-gray-700 rounded-lg px-3 py-1.5 hover:bg-gray-900 transition-colors"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      {isExpanded && expandedType === "email" ? "Hide" : "View"} Email
                    </button>
                  ) : (
                    <button
                      onClick={() => handleColdEmail(match.id)}
                      disabled={emailLoading}
                      className="flex items-center gap-1.5 text-sm bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5 disabled:opacity-50 hover:bg-gray-800 transition-colors"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      {emailLoading ? "Drafting..." : "Draft Email"}
                    </button>
                  )}
                </div>

                {isExpanded && expandedType === "resume" && match.tailored_resume && (
                  <pre className="mt-4 bg-gray-950 text-gray-200 p-4 rounded-lg text-xs whitespace-pre-wrap max-h-80 overflow-auto border border-gray-800">
                    {match.tailored_resume}
                  </pre>
                )}

                {isExpanded && expandedType === "email" && match.cold_email && (
                  <pre className="mt-4 bg-gray-950 text-gray-200 p-4 rounded-lg text-xs whitespace-pre-wrap max-h-80 overflow-auto border border-gray-800">
                    {match.cold_email}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}