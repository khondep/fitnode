"use client";

import { useEffect, useState } from "react";
import { Sliders, MapPin, Briefcase, Target, Check } from "lucide-react";

const WORK_MODES = ["Remote", "Hybrid", "On-site"];

export default function SettingsPage() {
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [location, setLocation] = useState("");
  const [workModes, setWorkModes] = useState<string[]>([]);
  const [minMatchScore, setMinMatchScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

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
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  }

  if (loading) {
    return (
      <main className="w-full">
        <p className="text-gray-500">Loading settings...</p>
      </main>
    );
  }

  return (
    <main className="w-full max-w-3xl">
      <h1 className="text-2xl font-bold mb-1">Settings</h1>
      <p className="text-gray-400 mb-8">
        Tune how FitNode searches and ranks jobs for you.
      </p>

      <div className="border border-gray-800 rounded-xl p-8">
        <div className="flex items-center gap-2 mb-1">
          <Sliders className="w-4 h-4 text-gray-400" />
          <h2 className="font-semibold text-lg">Job search filters</h2>
        </div>
        <p className="text-sm text-gray-500 mb-8">
          These preferences shape which roles appear in your matches.
        </p>

        <div className="mb-8">
          <label className="text-sm font-medium flex items-center gap-2 mb-3">
            <Briefcase className="w-4 h-4 text-gray-500" />
            Keywords
          </label>
          <input
            type="text"
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onKeyDown={addKeyword}
            placeholder="Add a role or skill, then press Enter"
            className="w-full bg-gray-900 border border-gray-800 rounded-lg p-3.5 text-sm mb-3 focus:outline-none focus:border-gray-600"
          />
          <div className="flex flex-wrap gap-2">
            {keywords.length === 0 && (
              <span className="text-xs text-gray-600">No keywords added yet.</span>
            )}
            {keywords.map((kw) => (
              <span
                key={kw}
                className="bg-gray-900 border border-gray-800 text-sm px-3.5 py-1.5 rounded-full flex items-center gap-2"
              >
                {kw}
                <button
                  onClick={() => removeKeyword(kw)}
                  className="text-gray-500 hover:text-white transition-colors"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        <div className="mb-8">
          <label className="text-sm font-medium flex items-center gap-2 mb-3">
            <MapPin className="w-4 h-4 text-gray-500" />
            Location
          </label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Boston, MA — leave blank for anywhere"
            className="w-full bg-gray-900 border border-gray-800 rounded-lg p-3.5 text-sm focus:outline-none focus:border-gray-600"
          />
        </div>

        <div className="mb-8">
          <label className="text-sm font-medium block mb-3">Work mode</label>
          <div className="flex gap-2">
            {WORK_MODES.map((mode) => (
              <button
                key={mode}
                onClick={() => toggleWorkMode(mode)}
                className={`text-sm px-5 py-2 rounded-full border transition-colors ${
                  workModes.includes(mode)
                    ? "bg-white text-black border-white"
                    : "border-gray-700 text-gray-300 hover:border-gray-500"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-10">
          <label className="text-sm font-medium flex items-center gap-2 justify-between mb-3">
            <span className="flex items-center gap-2">
              <Target className="w-4 h-4 text-gray-500" />
              Minimum match score
            </span>
            <span className="text-white font-semibold">{minMatchScore}%</span>
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={minMatchScore}
            onChange={(e) => setMinMatchScore(Number(e.target.value))}
            className="w-full"
          />
          <p className="text-xs text-gray-600 mt-2">
            Jobs scoring below this threshold are hidden from your matches.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-white text-black px-6 py-3 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-gray-100 transition-colors"
        >
          {justSaved ? (
            <>
              <Check className="w-4 h-4" /> Saved
            </>
          ) : saving ? (
            "Saving..."
          ) : (
            "Save filters"
          )}
        </button>
      </div>
    </main>
  );
}