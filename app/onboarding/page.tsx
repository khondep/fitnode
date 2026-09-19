"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const WORK_MODES = ["Remote", "Hybrid", "On-site"];
const ROLE_OPTIONS = ["Full Stack Developer", "Software Engineer", "Frontend Developer", "Backend Developer"];
const CITY_OPTIONS = [
  "New York, NY",
  "San Francisco, CA",
  "Boston, MA",
  "Seattle, WA",
  "Austin, TX",
  "Chicago, IL",
  "Washington, DC",
  "Los Angeles, CA",
  "Denver, CO",
  "Atlanta, GA",
  "Remote",
];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [location, setLocation] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [workModes, setWorkModes] = useState<string[]>([]);
  const [minMatchScore, setMinMatchScore] = useState(40);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const filteredCities = CITY_OPTIONS.filter((city) =>
    city.toLowerCase().includes(location.toLowerCase())
  );

  function toggleKeyword(role: string) {
    setKeywords((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  }

  function toggleWorkMode(mode: string) {
    setWorkModes((prev) =>
      prev.includes(mode) ? prev.filter((m) => m !== mode) : [...prev, mode]
    );
  }

  async function handleFinish() {
    setSaving(true);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        keywords: keywords.length > 0 ? keywords : ["Full Stack Developer"],
        location,
        workModes,
        minMatchScore: minMatchScore / 100,
      }),
    });
    await fetch("/api/settings/onboarded", { method: "POST" });
    router.push("/welcome");
  }

  const steps = [
    {
      title: "What roles are you looking for?",
      subtitle: "Select all that apply — you can change this anytime in Settings.",
      content: (
        <div className="flex flex-wrap gap-3">
          {ROLE_OPTIONS.map((role) => (
            <button
              key={role}
              onClick={() => toggleKeyword(role)}
              className={`px-5 py-2.5 rounded-full border text-sm transition-colors ${
                keywords.includes(role)
                  ? "bg-white text-black border-white"
                  : "border-gray-700 text-gray-300 hover:border-gray-500"
              }`}
            >
              {role}
            </button>
          ))}
        </div>
      ),
    },
    {
      title: "Where are you looking?",
      subtitle: "Type a city, or leave blank for anywhere.",
      content: (
        <div className="relative">
          <input
            type="text"
            value={location}
            onChange={(e) => {
              setLocation(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder="e.g. Boston, MA"
            className="w-full bg-gray-900 border border-gray-800 rounded-lg p-4 text-base focus:outline-none focus:border-gray-500"
          />

          {showSuggestions && location.length > 0 && filteredCities.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-gray-900 border border-gray-800 rounded-lg overflow-hidden z-10">
              {filteredCities.map((city) => (
                <button
                  key={city}
                  onClick={() => {
                    setLocation(city);
                    setShowSuggestions(false);
                  }}
                  className="w-full text-left px-4 py-3 text-sm hover:bg-gray-800 transition-colors"
                >
                  {city}
                </button>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      title: "What work arrangement works for you?",
      subtitle: "Select all you're open to.",
      content: (
        <div className="flex gap-3">
          {WORK_MODES.map((mode) => (
            <button
              key={mode}
              onClick={() => toggleWorkMode(mode)}
              className={`px-6 py-3 rounded-full border text-sm transition-colors ${
                workModes.includes(mode)
                  ? "bg-white text-black border-white"
                  : "border-gray-700 text-gray-300 hover:border-gray-500"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      ),
    },
    {
      title: "How selective should matching be?",
      subtitle: "We'll hide jobs below this match score.",
      content: (
        <div>
          <div className="flex justify-between text-sm text-gray-400 mb-2">
            <span>More jobs</span>
            <span className="text-white font-medium">{minMatchScore}%</span>
            <span>Better fits only</span>
          </div>
          <input
            type="range"
            min={0}
            max={80}
            value={minMatchScore}
            onChange={(e) => setMinMatchScore(Number(e.target.value))}
            className="w-full"
          />
        </div>
      ),
    },
  ];

  const isLastStep = step === steps.length - 1;

  return (
    <main className="min-h-screen flex items-center justify-center px-8">
      <div className="w-full max-w-lg">
        <div className="flex gap-2 mb-10">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i <= step ? "bg-white" : "bg-gray-800"
              }`}
            />
          ))}
        </div>

        <div key={step} className="animate-fade-in">
          <h1 className="text-3xl font-bold mb-2">{steps[step].title}</h1>
          <p className="text-gray-400 mb-8">{steps[step].subtitle}</p>
          {steps[step].content}
        </div>

        <div className="flex justify-between mt-12">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="text-sm text-gray-400 disabled:opacity-0"
          >
            ← Back
          </button>

          {isLastStep ? (
            <button
              onClick={handleFinish}
              disabled={saving}
              className="bg-white text-black px-8 py-3 rounded-lg font-medium disabled:opacity-50"
            >
              {saving ? "Setting up..." : "Get started"}
            </button>
          ) : (
            <button
              onClick={() => setStep((s) => s + 1)}
              className="bg-white text-black px-8 py-3 rounded-lg font-medium"
            >
              Continue →
            </button>
          )}
        </div>
      </div>
    </main>
  );
}