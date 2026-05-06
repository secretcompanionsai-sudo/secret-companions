import { useState, useRef, useEffect } from "react";
import DollGalleryPage from "./DollGalleryPage.jsx";

// Helper: parse age from string
function getAgeFromDOB(dob) {
  const tryParse = (s) => {
    const isoLike = /^\d{4}-\d{2}-\d{2}$/;         // 1990-04-05
    const slashLike = /^\d{1,2}\/\d{1,2}\/\d{4}$/; // 04/05/1990
    if (isoLike.test(s)) return new Date(s + "T00:00:00");
    if (slashLike.test(s)) return new Date(s);
    return new Date(NaN);
  };

  const d = tryParse((dob || "").trim());
  if (isNaN(d.getTime())) return NaN;

  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) {
    age--;
  }
  return age;
}

export default function AgeGate() {
  // form state
  const [dob, setDob] = useState("");
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState("");

  // once true we stop showing the gate and show the gallery instead
  const [isVerified, setIsVerified] = useState(false);

  const inputRef = useRef(null);

  // autofocus DOB field to be nice
  useEffect(() => {
    if (!isVerified) {
      inputRef.current?.focus();
    }
  }, [isVerified]);

  function handleEnter(e) {
    e?.preventDefault?.();
    setError("");

    const age = getAgeFromDOB(dob);

    if (isNaN(age)) {
      setError("Enter a valid birth date (YYYY-MM-DD or MM/DD/YYYY).");
      return;
    }

    if (age < 18) {
      setError("You must be at least 18 years old to continue.");
      return;
    }

    if (!agree) {
      setError("Please confirm you are of legal age and agree to continue.");
      return;
    }

    // 🎉 success
    setIsVerified(true);
  }

  function handleExit() {
    // send them away
    window.location.href = "https://www.google.com";
  }

  // after verification, show the full gallery app
  if (isVerified) {
    return <DollGalleryPage />;
  }

  // age gate UI
  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-100 flex items-center justify-center p-4">
      <div className="w-full max-w-xl rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-xl">
        {/* Brand row */}
        <div className="text-xs text-neutral-400 mb-4 font-mono tracking-tight">
          sc
        </div>

        {/* Title */}
        <h1 className="text-3xl font-semibold text-neutral-100 tracking-tight mb-4">
          Age Verification
        </h1>

        {/* Intro */}
        <p className="text-neutral-300 text-base leading-relaxed mb-6">
          This site contains content intended for adults. Please verify your
          age to enter.
        </p>

        {/* Date of birth */}
        <form
          className="space-y-4"
          onSubmit={handleEnter}
        >
          <div>
            <label
              htmlFor="dob"
              className="block text-sm text-neutral-200 font-medium mb-2"
            >
              Date of birth
            </label>
            <input
              id="dob"
              ref={inputRef}
              type="text"
              className="w-full bg-neutral-800/70 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 placeholder-neutral-500 outline-none focus:ring-2 focus:ring-white/30 focus:border-white/30"
              placeholder="YYYY-MM-DD or MM/DD/YYYY"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
            />
          </div>

          {/* Checkbox */}
          <label className="flex items-start gap-3 text-neutral-300 text-sm leading-relaxed">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-neutral-600 bg-neutral-800 checked:bg-emerald-500 checked:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
            />
            <span>
              I confirm I am at least 18 and agree to view adult content.
            </span>
          </label>

          {/* Error message */}
          {error && (
            <div
              className="text-sm text-red-400 bg-red-500/10 border border-red-500/40 rounded-lg px-3 py-2"
              role="alert"
            >
              {error}
            </div>
          )}

          {/* Buttons */}
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button
              type="submit"
              className="bg-emerald-500 text-black font-medium text-sm px-4 py-2 rounded-lg hover:bg-emerald-400 active:scale-[.98] transition"
            >
              Enter
            </button>

            <button
              type="button"
              onClick={handleExit}
              className="bg-neutral-800 text-neutral-200 font-medium text-sm px-4 py-2 rounded-lg border border-neutral-600/60 hover:bg-neutral-700 active:scale-[.98] transition"
            >
              Exit
            </button>
          </div>

          {/* Footer / legal */}
          <p className="text-neutral-500 text-xs leading-relaxed pt-4">
            By continuing you agree to our{" "}
            <span className="text-neutral-300 hover:text-neutral-100 underline underline-offset-2 cursor-pointer">
              Terms
            </span>{" "}
            and{" "}
            <span className="text-neutral-300 hover:text-neutral-100 underline underline-offset-2 cursor-pointer">
              Privacy
            </span>
            .
          </p>
        </form>
      </div>
    </div>
  );
}
