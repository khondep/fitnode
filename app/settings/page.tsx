"use client";

import { useEffect, useState } from "react";

const WORK_MODES = ["Remote", "Hybrid", "On-site"];

export default function SettingsPage() {
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [location, setLocation] = useState("");
  const [workModes, setWorkModes] = useState<string[]>([]);
  const [minMatchScore, setMinMatchScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        const s = data.settings;
        if (s) {
          setKeywords(s.keywords ?? []);
          setLocation(s.location ?? "");
          setWorkModes(s.work_modes ?? []);
          setMinMatchScore(Math.round((s.min_match_score ?? 0) * 100));
        }
        setLoading(false);
      });
  }, []);

  function addKeyword(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && keywordInput.trim()) {
      e.preventDefault();
      setKeywords((prev) => [...prev, keywordInput.trim()]);
      setKeywordInput("");
    }
  }

  function removeKeyword(kw: string) {
    setKeywords((prev) => prev.filter((k) => k !== kw));
  }

  function toggleWorkMode(mode: string) {
    setWorkModes((prev) =>
      prev.includes(mode) ? prev.filter((m) => m !== mode) : [...prev, mode]
    );
  }

  async function handleSave() {
    setSaving(true);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        keywords,
        location,
        workModes,
        minMatchScore: minMatchScore / 100,
      }),
    });
    setSaving(false);
  }

  if (loading) {
    return <main className="max-w-2xl mx-auto">Loading settings...</main>;
  }

  return (
    <main className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Settings</h1>
      <p className="text-gray-400 mb-8 text-sm">
        Tune how FitNode searches and ranks jobs for you.
      </p>

      <div className="border border-gray-800 rounded-lg p-6">
        <h2 className="font-semibold mb-1">Job search filters</h2>
        <p className="text-sm text-gray-400 mb-6">
          These preferences shape which roles appear in your matches.
        </p>

        <label className="text-sm font-medium block mb-2">Keywords</label>
        <input
          type="text"
          value={keywordInput}
          onChange={(e) => setKeywordInput(e.target.value)}
          onKeyDown={addKeyword}
          placeholder="Add a role or skill, then press Enter"
          className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2 text-sm mb-3"
        />
        <div className="flex flex-wrap gap-2 mb-6">
          {keywords.map((kw) => (
            <span
              key={kw}
              className="bg-gray-800 text-sm px-3 py-1 rounded-full flex items-center gap-2"
            >
              {kw}
              <button onClick={() => removeKeyword(kw)} className="text-gray-400 hover:text-white">
                ×
              </button>
            </span>
          ))}
        </div>

        <label className="text-sm font-medium block mb-2">Location</label>
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="e.g. Boston, MA"
          className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2 text-sm mb-6"
        />

        <label className="text-sm font-medium block mb-2">Work mode</label>
        <div className="flex gap-2 mb-6">
          {WORK_MODES.map((mode) => (
            <button
              key={mode}
              onClick={() => toggleWorkMode(mode)}
              className={`text-sm px-4 py-1.5 rounded-full border ${
                workModes.includes(mode)
                  ? "bg-white text-black border-white"
                  : "border-gray-700 text-gray-300"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        <label className="text-sm font-medium flex justify-between mb-2">
          <span>Minimum match score</span>
          <span>{minMatchScore}%</span>
        </label>
        <input
          type="range"
          min={0}
          max={100}
          value={minMatchScore}
          onChange={(e) => setMinMatchScore(Number(e.target.value))}
          className="w-full mb-6"
        />

        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-white text-black px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save filters"}
        </button>
      </div>
    </main>
  );
}