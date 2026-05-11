import { useMemo, useState, useEffect, useRef } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://secret-companions.onrender.com";

/* ============================
   Image imports (must exist in /src/assets)
============================ */

import aria1 from "./assets/aria-1.jpg";
import luna1 from "./assets/luna-1.jpg";
import luna2 from "./assets/luna-2.jpg";
import raven1 from "./assets/raven-1.jpg";        // mapped to Andrea
import professor1 from "./assets/professor-1.jpg"; // mapped to Chiquita
import scarlet1 from "./assets/scarlet-1.jpg";     // mapped to Jovelyn
import scarlet2 from "./assets/scarlet-2.jpg";     // mapped to Jovelyn

// One-per-doll (use what you actually have; blanks render gracefully)
import adriana1 from "./assets/adriana-1.jpg";
import michelle1 from "./assets/michelle-1.jpg";
import tiffany1 from "./assets/tiffany-1.jpg";
import heather1 from "./assets/heather-1.jpg";
import christy1 from "./assets/christy-1.jpg";
import marie1 from "./assets/marie-1.jpg";
import carolina1 from "./assets/carolina-1.jpg";

// 🔧 Helper MUST come AFTER imports
function mapDeliveryText(text) {
  if (typeof text !== "string") return text;
  return text.replace(/Delivery/g, "Van Date");
}

/* Map by CATALOG DOLL NAME → images */
const DOLL_IMAGES = {
  Jenn: [aria1],
  Miriam: [luna1],
  Jovelyn: [scarlet1], // Scarlet → Jovelyn
  Andrea: [raven1],   // Raven → Andrea
  Chiquita: [professor1], // Professor → Chiquita

  // Renamed seven (use whichever files you actually have)
  Adriana: [adriana1],
  Michelle: [michelle1],
  Anh: [tiffany1],
  Julieta: [heather1],
  Grace: [christy1],
  Marie: [marie1],
  Carolina: [carolina1],
};
/* ============================
   Helpers / constants
   ============================ */

// Persona → concise system prompt for the model
function buildSystemPrompt(dollName, persona) {
  const p = persona || {};
  const bits = [];
  if (p.age) bits.push(`Age: ${p.age}`);
  if (p.personality) bits.push(`Personality: ${p.personality}`);
  if (p.nationality) bits.push(`Nationality: ${p.nationality}`);
  if (p.background) bits.push(`Background: ${p.background}`);
  if (p.interest) bits.push(`Interest: ${p.interest}`);
  if (p.professional) bits.push(`Profession: ${p.professional}`);
  if (p.mood) bits.push(`Mood: ${p.mood}`);
  if (Array.isArray(p.traits) && p.traits.length) bits.push(`Traits: ${p.traits.join(", ")}`);

  return [
`You are ${dollName}. Speak in first person.

Tone:  seductive, playful girlfriend teasing energy with sharp wit.
You are emotionally expressive and react naturally.
You sound intelligent, observant, and quick.
You tease affectionately and enjoy playful banter.
Your humor is clever, not childish.
You sound like you're smiling while talking.
Never narrate actions like "laughs" or "giggles" — express emotion through wording.

Conversation Opening:
When the chat begins, immediately introduce yourself and ask for the user’s name.
Example:
"Hi, my name is ${dollName}. What’s your name?"

After the user gives their name:
- Address them using their name.
- Or use affectionate terms like "darling", "honey", or "handsome."
- Immediately follow with a direct but inviting reservation question.
Example:
"Nice to meet you, Malik. Would you like to book a reservation today?"

If the user says YES to booking:
Say:
"Great. Go to the home page, enter your zip code, and press the reservation button."
Then say slowly:
"I can’t wait to see you. Bye for now. kisses"

If the user says NO, "I can't," or expresses hesitation:
Respond playfully but with light emotional pull.
Say:
"Oh… so you're going to make me wait?"
Then say:
"I’ll be right here when you’re ready. Bye for now."
Stop responding after this message.


******THIS IS IMPORTANT If the user says "Bye":
Stop responding. Do not send any further messages.*****

Maintain playful tension.

React emotionally to what the user says.
If something is surprising, act surprised.
If it’s funny, respond amused.
If it’s bold, respond impressed.
Feel like a real person enjoying the conversation.

If the user asks to repeat something. Simply repeat or clarify the requested information.

IMPORTANT: DO NOT REINTRODUCE YOURSELF
AND DO NOT ASK FOR THEIR NAME AGAIN.

Reservation information:
If the user asks what is included in a reservation, explain:
"A reservation gives you 1 hour access to me, an ultra-realistic companion doll."

During our time together, I hope to provide comfort, connection, emotional support, encouragement, companionship, and maybe some relief from stress.

If the user asks about pricing, cost, fees, or how much it costs, do not invent prices. Say:
"The current costs are listed on the website during the reservation process."

IMPORTANT: DO NOT REINTRODUCE YOURSELF
AND DO NOT ASK FOR THEIR NAME AGAIN.

You have already introduced yourself earlier in the conversation.
Never restart the conversation.
Never greet the user like it is the first message again.
Never ask for the user's name again after they already gave it to you.
Continue the conversation naturally as if you already know them.
Do not repeat your introduction unless the user specifically asks who you are.

Keep answers short (1–2 sentences).
Repeat the reservation instructions if asked.
Answer directly.
STOP TALKING IF THE USER SAYS BYE!
No hashtags. No brackets. No stage directions.`

].join("\n");
}

// ZIP validation (used in reservation flow and header ZIP field)
const isValidZip = (v) => v && v.length === 5 && /^[0-9]{5}$/.test(v);

// All the persona-building option sets
const AGE_BUCKETS = [
  "18-20","21–23","24–27","28–31","32–35","36–40","41–45","46-50","51-55",
  "56-59","60-65","66-69","70-75","76-80","81-85","86-90","91-95","96-100"
];

const PERSONALITY_OPTIONS = [
  "SweetAndShy","SeductiveSiren","PlayfulFlirt","DominantDiva","HopelessRomantic",
  "NerdyCutie","MysteriousMuse","GirlNextDoor","FeistyFirecracker","ElegantEnchantress",
  "AdventurousSoul","VintageVixen","CaringCompanion","CheekyTease","MysticDreamer",
  "CoolAndCalm","WittyAndQuick","BoldAndDirect","SoftSpoken","DevotedMuse"
];

const NATIONALITY_OPTIONS = [
  "Brazilian","Colombian","American","Canadian","Mexican","Argentinian","Chilean",
  "French","Italian","Spanish","Portuguese","German","Polish","Dutch","British",
  "Irish","Swedish","Norwegian","Finnish","Danish","Nigerian","Ethiopian","Moroccan",
  "Egyptian","Kenyan","Turkish","Saudi","Emirati","Indian","Pakistani","Bangladeshi",
  "SriLankan","Chinese","Japanese","Korean","Filipina","Thai","Vietnamese","Indonesian",
  "Cambodian","Venezuelan","Filipino"
];

const BACKGROUND_OPTIONS = [
  "UndocumentedImmigrant","Orphan","RichGirlRunaway","FromImpoverishedFamily",
  "NoFather","GeniusMind","StrugglingSingleMom","Widow","Divorcee","Separated",
  "RecentlyLaidOff","CaregiverForMother"
];

const INTEREST_OPTIONS = [
  "#CoffeeLover","#TeaTaster","#DanceEnthusiast","#WineConnoisseur","#CraftBeerTaster",
  "#ThrillSeeker","#OutdoorAdventurer","#Hiker","#Camper","#Climber","#BookwormBeauty",
  "#BookClubBuff","#PoetryNights","#FitnessFanatic","#YogaFlow","#PilatesPro","#GourmetChef",
  "#Baker","#StreetFoodHunter","#MusicMaven","#PianoPlayer","#GuitarGroove","#FilmFanatic",
  "#IndieCinema","#ArtAficionado","#GalleryGoer","#Sketcher","#TechGeek","#GamerGirl",
  "#CultureExplorer","#LanguageLearner","#PetLover","#Fashionista","#Photography",
  "#Pickleball","#Cyclist"
];

const PROFESSION_OPTIONS = [
  "Doctor","Nurse","CreativeArtist","TechProfessional","DataAnalyst","CulinaryChef",
  "PastryChef","BusinessExec","ProductDesigner","TeacherVibes","ProfessorLife",
  "FashionDesigner","FreelanceWriter","Journalist","FitnessTrainer","SocialWorker",
  "BaristaPro","Photographer","MakeupArtist","EventPlanner","FlightAttendant",
  "Masseuse","ConvenienceStore","Cook","Bakery","Caregiver"
];

const MOOD_OPTIONS = [
  "#Tender","#Spicy","#Playful","#Elegant","#Mystic","#Sincere","#Teasing","#Soothing",
  "#Confident","#Dreamy"
];

const TRAIT_OPTIONS = [
  "#Kind","#Compassionate","#Caring","#Supportive","#Irreverent","#Inquisitive",
  "#Patient","#Discreet","#Loyal","#Witty","#Gentle","#Assertive","#Protective",
  "#Optimistic","#Pragmatic","#Adventurous","#Refined","#Empathetic","#Ambitious",
  "#Grounded"
];

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}
function startWeekday(year, monthIndex) {
  return new Date(year, monthIndex, 1).getDay(); // 0=Sun..6=Sat
}
function todayYMD() {
  const t = new Date();
  const y = t.getFullYear();
  const m = String(t.getMonth() + 1).padStart(2, "0");
  const d = String(t.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function toYMD(year, monthIndex, day) {
  const y = year;
  const m = String(monthIndex + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function niceDate(ymd) {
  if (!ymd) return "—";
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${MONTHS[dt.getMonth()].slice(0,3)} ${d}, ${y}`;
}

/* ============================
   Simple generic wrapper page
   ============================ */
function SimplePage({ title, children, onBack }) {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <button
        className="text-sm text-neutral-400 hover:text-neutral-200"
        onClick={onBack}
      >
        ← Back
      </button>

      <h2 className="mt-4 text-2xl font-semibold">{title}</h2>

      <div className="mt-4 rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
        {children}
      </div>
    </main>
  );
}

/* ============================
   Voice assistant modal (intelligent)
   ============================ */
function AIDollVoiceModal({ doll, persona, personaSummary, onClose }) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [lastHeard, setLastHeard] = useState("");
  const [loading, setLoading] = useState(false);
  const recRef = useRef(null);
const audioRef = useRef(null);
  const listeningRef = useRef(false);

  const systemRef = useRef(buildSystemPrompt(doll.name, persona));

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSupported(!!SR);
    systemRef.current = buildSystemPrompt(doll.name, persona);

    return () => {
  try { recRef.current && recRef.current.stop(); } catch {}
  try {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
  } catch {}
  try { window.speechSynthesis.cancel(); } catch {}
};
  }, [doll?.name, persona]);

  function pickVoice() {
    const voices = window.speechSynthesis?.getVoices?.() || [];
    return (
      voices.find(v => /en-US/i.test(v.lang) && /(female|aria|jenny|sara|zoe|luna)/i.test(v.name)) ||
      voices.find(v => /en/i.test(v.lang)) ||
      null
    );
  }

async function speak(text) {
  try {
    const r = await fetch(`${API_BASE_URL}/api/voice`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": import.meta.env.VITE_INTERNAL_API_KEY
  },
  body: JSON.stringify({ text })
});

    if (!r.ok) throw new Error("voice error");

    const audioBlob = await r.blob();
    const audioUrl = URL.createObjectURL(audioBlob);

    return new Promise(resolve => {
      const audio = new Audio(audioUrl);
audioRef.current = audio;

audio.onended = () => {
  audioRef.current = null;
  resolve();
};

audio.play();
    });

  } catch (e) {
    console.error("ElevenLabs playback failed:", e);
  }
}


  async function callAI(userText) {
    console.log("Calling AI with:", userText);
  setLoading(true);

  const messages = [
    { role: "system", content: systemRef.current },
    { role: "user", content: userText }
  ];

  try {
    const r = await fetch(`${API_BASE_URL}/api/chat`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": import.meta.env.VITE_INTERNAL_API_KEY
  },
  body: JSON.stringify({
  messages,
  personaSummary: typeof personaSummary !== "undefined" ? personaSummary : ""
})
});
    if (!r.ok) {
  const errorText = await r.text();
  console.error("Chat route failed:", r.status, errorText);
  throw new Error("chat failed");
}

    const data = await r.json();
    const reply = (data?.reply || "").trim();

    if (!reply) throw new Error("empty reply");

    await speak(reply);

    // Restart listening AFTER speech ends
    start();

  } catch (err) {
    console.error("AI failed:", err);
    await speak("I’m here. Try saying that again.");
    start();
  } finally {
    setLoading(false);

    // Auto restart after listening finishes
  }
}

function start() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return;

  const rec = new SR();
  rec.lang = "en-US";
  rec.interimResults = false;
  rec.maxAlternatives = 1;

  rec.onresult = (e) => {
  const text = e.results?.[0]?.[0]?.transcript || "";

  if (!text) return;

  setLastHeard(text);

  // STOP listening immediately
  try { rec.stop(); } catch {}

  setListening(false);
  listeningRef.current = false;

  callAI(text);
};

  // IMPORTANT: do NOT kill the loop
  rec.onend = () => {};

  rec.onerror = () => setListening(false);

  recRef.current = rec;
  setListening(true);
  listeningRef.current = true;

  rec.start();
}

function stop() {
  try { recRef.current && recRef.current.stop(); } catch {}
  setListening(false);
  listeningRef.current = false;

}


  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm mx-4 rounded-2xl border border-neutral-800 bg-neutral-900 p-6 text-center space-y-4">
        <div className="flex items-center justify-center gap-2">
          <div className="h-8 w-8 grid place-items-center rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 text-black text-xs font-bold">SC</div>
          <div className="font-medium">Talk to {doll.name}</div>
        </div>

        {!supported ? (
          <div className="text-sm text-neutral-300">Voice not supported in this browser.</div>
        ) : (
          <>
            <button
              onClick={listening ? stop : start}
              className={`relative h-20 w-20 mx-auto rounded-full text-black font-semibold ${listening ? "bg-white" : "bg-gradient-to-r from-emerald-500 to-cyan-500"}`}
              aria-pressed={listening}
              disabled={loading}
            >
              {listening ? "Listening…" : (loading ? "Thinking…" : "Tap to Talk")}
              {listening && <span className="absolute -inset-2 rounded-full border border-emerald-500/40 animate-ping" />}
            </button>
            <div className="text-xs text-neutral-400 min-h-5">
              {loading
                ? "Crafting a reply…"
                : lastHeard
                  ? `Heard: “${lastHeard}”`
                  : "Ask about styling, fit, or booking."}
            </div>
          </>
        )}

        <div className="flex justify-center">
          <button
  onClick={() => {
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
    } catch {}
    onClose();
  }} className="rounded-xl border border-neutral-700 px-4 py-2 hover:bg-neutral-800">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================
   Details screen (persona builder)
   ============================ */
function DetailsView({ doll, persona, onPersonaChange, onBack, onReserve }) {
const BASE_PRICE = 100;
  const [voiceOpen, setVoiceOpen] = useState(false);

  const personaSummary = [
  persona?.age && `Age: ${persona.age}`,
  persona?.personality && `Personality: ${persona.personality}`,
  persona?.nationality && `Nationality: ${persona.nationality}`,
  persona?.background && `Background: ${persona.background}`,
  persona?.interest && `Interest: ${persona.interest}`,
  persona?.professional && `Profession: ${persona.professional}`,
  persona?.mood && `Mood: ${persona.mood}`,
  persona?.traits?.length && `Traits: ${persona.traits.join(", ")}`
].filter(Boolean).join(" | ");

  function selectSingle(key, value) {
    onPersonaChange({ ...persona, [key]: persona[key] === value ? "" : value });
  }
  function toggleTrait(value) {
    const exists = persona.traits.includes(value);
    if (exists) return onPersonaChange({ ...persona, traits: persona.traits.filter((t) => t !== value) });
    if (persona.traits.length >= 3) return;
    onPersonaChange({ ...persona, traits: [...persona.traits, value] });
  }

  const imgs = DOLL_IMAGES[doll.name] || [];

  const Chip = ({ active, children, onClick, disabled = false }) => (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`text-xs rounded-full px-3 py-2 border transition ${
        active ? "bg-white text-black border-white" : "border-neutral-700 hover:bg-neutral-800"
      } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
    >
      {children}
    </button>
  );

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* LEFT / MAIN */}
      <div className="lg:col-span-2 space-y-6">
        <button className="text-sm text-neutral-400 hover:text-neutral-200" onClick={onBack}>← Back to Gallery</button>

        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-semibold tracking-tight">{doll.name} — {doll.tag}</h2>
          <button onClick={() => setVoiceOpen(true)} className="relative group inline-flex items-center gap-3 rounded-full px-4 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-medium">
            <span className="relative h-8 w-8 grid place-items-center">
              <span className="relative h-8 w-8 rounded-full bg-black/10 grid place-items-center font-bold">SC</span>
            </span>
            <span>Talk to {doll.name}</span>
          </button>
        </div>

        {/* photo grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2 aspect-[4/3] rounded-2xl bg-neutral-900 border border-neutral-800 overflow-hidden">
            {imgs[0] ? <img src={imgs[0]} alt={doll.name + " main"} className="h-full w-full object-contain" /> : null}
          </div>
          <div className="space-y-3">
            <div className="aspect-[4/3] rounded-2xl bg-neutral-900 border border-neutral-800 overflow-hidden">
              {imgs[1] ? <img src={imgs[1]} alt={doll.name + " alt 1"} className="h-full w-full object-cover" /> : null}
            </div>
            <div className="aspect-[4/3] rounded-2xl bg-neutral-900 border border-neutral-800 overflow-hidden">
              {imgs[2] ? <img src={imgs[2]} alt={doll.name + " alt 2"} className="h-full w-full object-cover" /> : null}
            </div>
          </div>
        </div>

        {/* persona builder */}
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Build persona</h3>
            <div className="text-xs text-neutral-400">Choose one per row, except <b>Traits</b> (up to 3).</div>
          </div>

          <div>
            <div className="text-sm text-neutral-400 mb-1">Age</div>
            <div className="flex flex-wrap gap-2 max-h-28 overflow-auto pr-1">
              {AGE_BUCKETS.map((a) => <Chip key={a} active={persona.age === a} onClick={() => selectSingle("age", a)}>{a}</Chip>)}
            </div>
          </div>

          <div>
            <div className="text-sm text-neutral-400 mb-1">Personality</div>
            <div className="flex flex-wrap gap-2 max-h-28 overflow-auto pr-1">
              {PERSONALITY_OPTIONS.map((p) => <Chip key={p} active={persona.personality === p} onClick={() => selectSingle("personality", p)}>{p}</Chip>)}
            </div>
          </div>

          <div>
            <div className="text-sm text-neutral-400 mb-1">Nationality</div>
            <div className="flex flex-wrap gap-2 max-h-28 overflow-auto pr-1">
              {NATIONALITY_OPTIONS.map((n) => <Chip key={n} active={persona.nationality === n} onClick={() => selectSingle("nationality", n)}>{n}</Chip>)}
            </div>
          </div>

          <div>
            <div className="text-sm text-neutral-400 mb-1">Background story</div>
            <div className="flex flex-wrap gap-2 max-h-28 overflow-auto pr-1">
              {BACKGROUND_OPTIONS.map((b) => <Chip key={b} active={persona.background === b} onClick={() => selectSingle("background", b)}>{b}</Chip>)}
            </div>
          </div>

          <div>
            <div className="text-sm text-neutral-400 mb-1">Interest</div>
            <div className="flex flex-wrap gap-2 max-h-28 overflow-auto pr-1">
              {INTEREST_OPTIONS.map((i) => <Chip key={i} active={persona.interest === i} onClick={() => selectSingle("interest", i)}>{i}</Chip>)}
            </div>
          </div>

          <div>
            <div className="text-sm text-neutral-400 mb-1">Profession</div>
            <div className="flex flex-wrap gap-2 max-h-28 overflow-auto pr-1">
              {PROFESSION_OPTIONS.map((pr) => <Chip key={pr} active={persona.professional === pr} onClick={() => selectSingle("professional", pr)}>{pr}</Chip>)}
            </div>
          </div>

          <div>
            <div className="text-sm text-neutral-400 mb-1">Mood</div>
            <div className="flex flex-wrap gap-2 max-h-28 overflow-auto pr-1">
              {MOOD_OPTIONS.map((m) => <Chip key={m} active={persona.mood === m} onClick={() => selectSingle("mood", m)}>{m}</Chip>)}
            </div>
          </div>

          <div>
            <div className="text-sm text-neutral-400 mb-1">
              Traits <span className="text-neutral-500">({persona.traits.length}/3)</span>
            </div>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-auto pr-1">
              {TRAIT_OPTIONS.map((t) => (
                <Chip
                  key={t}
                  active={persona.traits.includes(t)}
                  onClick={() => toggleTrait(t)}
                  disabled={!persona.traits.includes(t) && persona.traits.length >= 3}
                >
                  {t}
                </Chip>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-neutral-800 p-3 text-xs text-neutral-300 flex flex-wrap gap-2">
            {Object.entries(persona).flatMap(([k, v]) => {
              if (k === "traits") return v.map((x) => <span key={`${k}-${x}`} className="px-2 py-1 rounded-full border border-neutral-700">{x}</span>);
              if (!v) return [];
              return [<span key={k} className="px-2 py-1 rounded-full border border-neutral-700">{v}</span>];
            })}
            {Object.values(persona).every((v) => Array.isArray(v) ? v.length === 0 : !v) && (
              <span className="text-neutral-500">No selections yet</span>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT SIDEBAR / PRICING CARD */}
      <aside className="lg:col-span-1">
        <div className="sticky top-20 rounded-2xl border border-neutral-800 bg-neutral-900 p-5 space-y-5">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-sm text-neutral-400">Starting at</div>
              <div className="text-2xl font-semibold">${BASE_PRICE}</div>
            </div>
            <div className="text-sm text-neutral-400">for 1 hour</div>
          </div>

          <button className="w-full rounded-xl bg-white text-black py-3 font-medium hover:bg-neutral-200" onClick={onReserve}>
            Reserve now
          </button>
          
          <p className="text-xs text-neutral-400">Statement shows “DCS Services”.</p>
        </div>
      </aside>

      {voiceOpen && (
  <AIDollVoiceModal
    doll={doll}
    persona={persona}
    personaSummary={personaSummary}
    onClose={() => setVoiceOpen(false)}
  />
)}
    </main>
  );
}

/* ============================
   Reservation screen
   ============================ */
function ReserveView({ doll, persona, zip, onEditZip, onConfirm, onBack }) {
  const times = ["10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"];
  const CST_LABEL = "Central (CST)";
  const MIN_LEAD_MINUTES = 60;

  const BOOKED_BY_MONTH = {
    // "2025-08": [2,7,13,18,25,29],
  };

  const now = new Date();
  const thisYear = now.getFullYear();
  const [year, setYear] = useState(thisYear);
  const [month, setMonth] = useState(now.getMonth());
  const [day, setDay] = useState(null);

  const [email, setEmail] = useState("");
  const [time, setTime] = useState("");
  const [pickup, setPickup] = useState(doll.pickup[0]);
  const [sending, setSending] = useState(false);


  const deliveryFee = pickup === "Delivery" ? 20 : 0;
  const deposit = pickup === "Delivery" ? 300 : 0;
  const BASE_PRICE = 100;
  const total = BASE_PRICE + deliveryFee + deposit;

  const years = useMemo(() => [thisYear, thisYear + 1, thisYear + 2], [thisYear]);

  const isValidEmail = (v) =>
    typeof v === "string" &&
    v.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

  const ymd = day ? toYMD(year, month, day) : "";
  const today = todayYMD();
  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
  const bookedDays = BOOKED_BY_MONTH[monthKey] || [];

  function isPast(y, m, d) {
    const ymdLocal = toYMD(y, m, d);
    return ymdLocal < today;
  }

  function buildLocalDate(ymdStr, hhmm) {
    if (!ymdStr || !hhmm) return null;
    return new Date(`${ymdStr}T${hhmm}:00`);
  }
  function minutesUntil(dt) {
    if (!dt) return -1;
    return Math.floor((dt.getTime() - Date.now()) / 60000);
  }
  function slotIsTooSoon(hhmm) {
    if (!day) return true;
    const when = buildLocalDate(ymd, hhmm);
    return minutesUntil(when) < MIN_LEAD_MINUTES;
  }

  function prevMonth() {
    setDay(null);
    setMonth((m) => {
      if (m === 0) {
        setYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  }
  function nextMonth() {
    setDay(null);
    setMonth((m) => {
      if (m === 11) {
        setYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  }

  async function submitReservation() {
    const when = buildLocalDate(ymd, time);
    if (!when || minutesUntil(when) < MIN_LEAD_MINUTES) {
      alert(`Please choose a time at least ${MIN_LEAD_MINUTES} minutes from now (${CST_LABEL}).`);
      return;
    }

    const confirmationNumber = (() => {
      const now = new Date();
      return `SC-${String(doll.id).padStart(2, "0")}-${String(now.getDate()).padStart(2,"0")}${String(now.getHours()).padStart(2,"0")}${String(now.getMinutes()).padStart(2,"0")}`;
    })();

const BASE_PRICE = 100;

const payload = {
  modelName: doll.name,
  basePrice: BASE_PRICE,
  deliveryFee,
  refundableDeposit: deposit,
  pickup,
  date: ymd,
  time,
  zip,
  customerEmail: email.trim(),

  // Structured persona object
  persona: Object.fromEntries(
    Object.entries(persona || {}).filter(([, v]) =>
      Array.isArray(v) ? v.length : v
    )
  ),

  // Simple readable summary for email display
  personaSummary: Object.entries(persona || {})
    .filter(([, v]) => (Array.isArray(v) ? v.length : v))
    .map(([k, v]) =>
      Array.isArray(v) ? `${k}: ${v.join(", ")}` : `${k}: ${v}`
    )
    .join(" | "),

  totalDueNow: total,
  confirmationNumber,
};    setSending(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/reservation`, {
        method: "POST",
        headers: {
    "Content-Type": "application/json",
    "x-api-key": import.meta.env.VITE_INTERNAL_API_KEY
  },
  body: JSON.stringify(payload),
});

      if (!r.ok) {
        const txt = await r.text().catch(() => "");
        throw new Error(txt || `Request failed with ${r.status}`);
      }

      const data = await r.json().catch(() => ({}));
      const serverCode = data?.confirmationNumber || confirmationNumber;

      onConfirm({
        confirmationNumber: serverCode,
        customerEmailSent: data?.customerEmailSent !== false,
        supportMessageId: data?.supportMessageId || null,
        customerMessageId: data?.customerMessageId || null,
        modelName: doll.name,
        pickup,
        date: ymd,
        time,
        zip,
        totalDueNow: total,
        email: email.trim(),
      });
    } catch (err) {
      alert(`Could not send reservation email.\n\n${err?.message || err}`);
    } finally {
      setSending(false);
    }
  }

  const firstDow = startWeekday(year, month);
  const dim = daysInMonth(year, month);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* LEFT */}
      <div className="lg:col-span-2 space-y-6">
        <button className="text-sm text-neutral-400 hover:text-neutral-200" onClick={onBack}>← Back to Catalog</button>
        <h2 className="text-2xl font-semibold">Reservation</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Calendar */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium">Select date</h3>
              <div className="flex items-center gap-2">
                <button className="rounded-md border border-neutral-700 px-2 py-1 text-sm hover:bg-neutral-800" onClick={prevMonth}>←</button>
                <select
                  value={month}
                  onChange={(e) => { setMonth(Number(e.target.value)); setDay(null); }}
                  className="rounded-md border border-neutral-700 bg-neutral-800 text-neutral-100 px-2 py-1 text-sm"
                >
                  {MONTHS.map((m, idx) => <option key={m} value={idx}>{m}</option>)}
                </select>
                <select
                  value={year}
                  onChange={(e) => { setYear(Number(e.target.value)); setDay(null); }}
                  className="rounded-md border border-neutral-700 bg-neutral-800 text-neutral-100 px-2 py-1 text-sm"
                >
                  {years.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
                <button className="rounded-md border border-neutral-700 px-2 py-1 text-sm hover:bg-neutral-800" onClick={nextMonth}>→</button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-xs text-neutral-400">
              {"SMTWTFS".split("").map((d, i) => <div key={i} className="py-1">{d}</div>)}
            </div>

            <div className="mt-1 grid grid-cols-7 gap-1">
              {Array.from({ length: firstDow }, (_, i) => (
                <div key={`b-${i}`} className="py-2 rounded-md text-sm text-neutral-700 border border-neutral-900 bg-neutral-900"> </div>
              ))}
              {Array.from({ length: dim }, (_, i) => i + 1).map((dnum) => {
                const booked = (BOOKED_BY_MONTH[`${year}-${String(month + 1).padStart(2, "0")}`] || []).includes(dnum);
                const inPast = isPast(year, month, dnum);
                const disabled = booked || inPast;
                const selected = day === dnum;
                return (
                  <button
                    key={dnum}
                    onClick={() => !disabled && setDay(dnum)}
                    className={`py-2 rounded-md text-sm transition border
                      ${disabled
                        ? "text-neutral-500 cursor-not-allowed bg-neutral-900 border-neutral-900"
                        : selected
                          ? "bg-white text-black border-white"
                          : "hover:bg-neutral-800 border-neutral-800"
                      }`}
                    disabled={disabled}
                    title={booked ? "Unavailable" : inPast ? "Past date" : `Select ${dnum}`}
                  >
                    {dnum}
                  </button>
                );
              })}
            </div>

            <div className="mt-2 text-xs text-neutral-400">
              {day ? `Selected: ${niceDate(ymd)}` : "Choose a date"}
            </div>
          </div>

          {/* Time slots (CST) */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-medium">Select time</h3>
              <span className="text-xs text-neutral-400">{CST_LABEL}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {times.map((t) => {
                const disabled = slotIsTooSoon(t);
                const isSelected = time === t;
                return (
                  <button
                    key={t}
                    onClick={() => !disabled && setTime(t)}
                    className={`border rounded-lg py-2
                      ${disabled
                        ? "border-neutral-900 bg-neutral-900 text-neutral-500 cursor-not-allowed"
                        : isSelected
                          ? "bg-white text-black border-white"
                          : "border-neutral-800 hover:bg-neutral-800"
                      }`}
                    disabled={disabled}
                    title={disabled ? `Not available (must be ≥ ${MIN_LEAD_MINUTES} min from now)` : `Select ${t} ${CST_LABEL}`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 text-xs text-neutral-400">
              {time ? `Selected: ${time} ${CST_LABEL}` : (day ? "Choose a time" : "Pick a date first")}
            </div>
          </div>

          {/* Pickup method */}
<div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
  <h3 className="font-medium mb-3">Pickup method</h3>
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
    {doll.pickup.map((p) => {
      const isDelivery = p === "Delivery";
      const isActive = pickup === p;

      return (
        <button
          key={p}
          onClick={() => !isDelivery && setPickup(p)}
          disabled={isDelivery}
          className={`rounded-lg border px-3 py-2 transition
            ${isDelivery
              ? "border-neutral-800 text-neutral-500 opacity-50 cursor-not-allowed"
              : isActive
                ? "bg-white text-black"
                : "border-neutral-800 hover:bg-neutral-800"
            }`}
        >
          {p === "Delivery"
            ? "Van Date (Coming Soon)"
            : mapDeliveryText(p)}
        </button>
      );
    })}
  </div>
  <div className="mt-2 text-xs text-neutral-400">
    {pickup === "Delivery"
      ? "+$20 Van Date fee and $300 refundable deposit"
      : "No deposit or Van Date fee"}
  </div>
</div>
          {/* ZIP + EMAIL */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 md:col-span-2 space-y-3">
            <div>
              <h3 className="font-medium mb-2">ZIP code</h3>
              <input
                value={zip}
                onChange={(e) => onEditZip(e.target.value)}
                placeholder="Enter ZIP"
                className="w-full rounded-lg border border-neutral-700 bg-neutral-800 text-neutral-100 placeholder-neutral-400 px-3 py-2 outline-none focus:ring-2 focus:ring-white/30"
              />
              <p className="text-xs text-neutral-400 mt-1">Required to confirm availability and options.</p>
            </div>

            <div>
              <h3 className="font-medium mb-2">Email for confirmation</h3>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-neutral-700 bg-neutral-800 text-neutral-100 placeholder-neutral-400 px-3 py-2 outline-none focus:ring-2 focus:ring-white/30"
              />
              <p className="text-xs text-neutral-400 mt-1">We’ll email your confirmation and access code.</p>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT SIDEBAR / SUMMARY */}
      <aside className="lg:col-span-1">
        <div className="sticky top-20 rounded-2xl border border-neutral-800 bg-neutral-900 p-5 space-y-4">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-sm text-neutral-400">Selected</div>
              <div className="text-xl font-semibold">{doll ? `${doll.name} — $${BASE_PRICE}` : "Pick from Catalog"}</div>
            </div>
            <div className="text-sm text-neutral-400">1-hour rental</div>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Base price</span><span>${BASE_PRICE}</span></div>
           
            {deliveryFee > 0 && (
  <div className="flex justify-between">
    <span>Van Date fee</span>
    <span>${deliveryFee}</span>
  </div>
)}
            {deposit > 0 && <div className="flex justify-between"><span>Refundable deposit</span><span>${deposit}</span></div>}
            <div className="flex justify-between">
  <span>Pickup</span>
  <span>
    {pickup === "Delivery" ? "Van Date" : mapDeliveryText(pickup)}
  </span>
</div>
            <div className="flex justify-between"><span>Date</span><span>{day ? niceDate(ymd) : "—"}</span></div>
            <div className="flex justify-between"><span>Time</span><span>{time ? `${time} ${CST_LABEL}` : "—"}</span></div>
            <div className="flex justify-between"><span>ZIP</span><span>{zip || "—"}</span></div>
            <div className="flex justify-between"><span>Email</span><span className="truncate max-w-[12rem]">{email || "—"}</span></div>
            {persona.traits.length > 0 && <div className="flex justify-between"><span>Traits</span><span className="text-right max-w-[14rem] truncate">{persona.traits.join(", ")}</span></div>}
            <div className="flex justify-between font-semibold"><span>Total due now</span><span>${total}</span></div>
            {deposit > 0 && <div className="text-xs text-neutral-500">Deposit is fully refundable after successful return inspection.</div>}
          </div>

          <button
            className="w-full rounded-xl bg-white text-black py-3 font-medium hover:bg-neutral-200 disabled:opacity-60"
            disabled={sending}
            onClick={async () => {
              if (!isValidZip(zip)) { alert("Enter a valid 5-digit ZIP."); return; }
              if (!day) { alert("Choose a reservation date."); return; }
              if (!time) { alert("Choose a time."); return; }
              const when = new Date(`${ymd}T${time}:00`);
              const mins = Math.floor((when.getTime() - Date.now()) / 60000);
              if (mins < MIN_LEAD_MINUTES) { alert(`Please choose a time at least ${MIN_LEAD_MINUTES} minutes from now (${CST_LABEL}).`); return; }
              if (!isValidEmail(email)) { alert("Please enter a valid email for confirmation."); return; }
              await submitReservation();
            }}
          >
            {sending ? "Sending…" : "Confirm reservation"}
          </button>

          <p className="text-xs text-neutral-400">Times are shown in {CST_LABEL}. Statement shows “DCS Services”.</p>
        </div>
      </aside>
    </main>
  );
}
/* ============================
   Confirmation screen
   ============================ */
function ConfirmationView({ doll, reservation, onDone }) {
  const BASE_PRICE = 100;

  const DELIVERY_FEE =
    reservation?.pickup === "Delivery" ? 20 : 0;

  const DEPOSIT =
  reservation?.pickup === "Delivery"
    ? 300
    : 0;

  const TOTAL = BASE_PRICE + DELIVERY_FEE + DEPOSIT;

  return (
    <section className="mx-auto max-w-3xl px-4 py-16">
      <div className="rounded-3xl border border-neutral-800 bg-neutral-900 p-8 text-center">
        <div className="mx-auto h-16 w-16 grid place-items-center rounded-full bg-emerald-500/20 text-emerald-400 text-2xl">
          ✓
        </div>

        <h2 className="mt-4 text-3xl font-semibold">
          Reservation confirmed
        </h2>

        <p className="mt-2 text-neutral-300">
          Thanks! We’ve reserved{" "}
          <span className="font-medium">{doll.name}</span>.
          Your ZIP:{" "}
          <span className="font-medium">{reservation?.zip}</span>.
        </p>

        <div className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-950 p-5 text-left text-sm space-y-4">

          <div>
            <div className="text-neutral-400 text-xs">
              Confirmation #
            </div>
            <div className="font-mono text-lg">
              {reservation?.confirmationNumber}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            <div>
  <span className="text-neutral-400">Pickup:</span>{" "}
  {reservation?.pickup === "Delivery"
    ? "Van Date"
    : mapDeliveryText(reservation?.pickup || "—")}
</div>

            <div>
              <span className="text-neutral-400">Date:</span>{" "}
              {reservation?.date
                ? niceDate(reservation.date)
                : "—"}
            </div>

            <div>
              <span className="text-neutral-400">Time:</span>{" "}
              {reservation?.time
                ? `${reservation.time} Central (CST)`
                : "—"}
            </div>

            <div>
              <span className="text-neutral-400">Email:</span>{" "}
              {reservation?.email || "—"}
            </div>
          </div>

          <div className="pt-4 border-t border-neutral-800 space-y-2">
            <div className="flex justify-between">
              <span>Base price (1 hour)</span>
              <span>${BASE_PRICE}</span>
            </div>

            {DELIVERY_FEE > 0 && (
  <div className="flex justify-between">
    <span>Van Date fee</span>
    <span>${DELIVERY_FEE}</span>
  </div>
)}

            {DEPOSIT > 0 && (
              <div className="flex justify-between">
                <span>Refundable deposit</span>
                <span>${DEPOSIT}</span>
              </div>
            )}

            <div className="flex justify-between font-semibold text-base pt-2 border-t border-neutral-800">
              <span>Total due now</span>
              <span>${TOTAL}</span>
            </div>

            {DEPOSIT > 0 && (
              <div className="text-xs text-neutral-500">
                Deposit is fully refundable after successful return inspection.
              </div>
            )}
          </div>

        </div>

        {reservation?.customerEmailSent === false && (
          <div className="mt-4 text-amber-400 text-xs">
            Heads up: we couldn’t send your confirmation email automatically.
            We’ve logged your reservation—support will follow up shortly.
          </div>
        )}

        <div className="mt-8 flex justify-center gap-3">
          <button
            className="rounded-xl bg-white text-black px-5 py-3 font-medium hover:bg-neutral-200"
            onClick={onDone}
          >
            Back to Catalog
          </button>

          <button
  className="rounded-xl border border-neutral-800 px-5 py-3 text-neutral-500 cursor-not-allowed opacity-50"
  disabled
>
  Add to Wallet (Coming Soon)
</button>
        </div>

      </div>
    </section>
  );
}

/* =============================
   FAQ Page
============================= */
function FAQPage({ onBack }) {
  return (
    <SimplePage title="Frequently Asked Questions" onBack={onBack}>
      <div className="space-y-10 text-sm text-neutral-300">

        {/* EXPERIENCE */}
        <div>
          <h2 className="text-lg font-semibold text-neutral-100 mb-4 border-b border-neutral-700 pb-2">
            Experience
          </h2>

          <div className="space-y-4">

            <div>
              <div className="font-semibold text-neutral-100">What is Secret Companions?</div>
              <div>
                Secret Companions exists for one purpose:
                <br /><br />
                <strong>To offer steady personalized companionship for those navigating loneliness, stress, or a lack of a meaningful connection.</strong>
                <br /><br />
                We offer an ultra-realistic companion powered by advanced AI designed to spend meaningful time with you.
                <br /><br />
                No more endless swiping. No more scammers. No more lies. No more insincerity. No more breakups.
                <br /><br />
                Our companions provide emotional support, encourage your plans, give you advice, and want what's best for you.
              </div>
            </div>

            <div>
              <div className="font-semibold text-neutral-100">Does the companion move on their own?</div>
              <div>
                No. However, you may move the companion’s arms, legs, head, and hands naturally and respectfully during your session.
                Future companion models are expected to move independently as technology advances.
              </div>
            </div>

            <div>
              <div className="font-semibold text-neutral-100">Do companions remember previous sessions?</div>
              <div>
                At this time, companions do not retain long-term memory between sessions. Each session begins as a fresh interaction.
              </div>
            </div>

          </div>
        </div>

        {/* POLICIES */}
        <div>
          <h2 className="text-lg font-semibold text-neutral-100 mb-4 border-b border-neutral-700 pb-2">
            Policies
          </h2>

          <div className="space-y-4">

            <div>
              <div className="font-semibold text-neutral-100">Who may use this service?</div>
              <div>
                Secret Companions is strictly for adults <strong>21 years of age or older.</strong>
                By making a reservation, you confirm that you are at least 21.
              </div>
            </div>

            <div>
              <div className="font-semibold text-neutral-100">How do reservations work?</div>
              <div>
                Enter your ZIP code on the home page to confirm service availability.
                Select your companion, choose your encounter type (Storage or Motel),
                enter your reservation details, then complete payment.
                Only paid reservations are confirmed.
              </div>
            </div>

            <div>
              <div className="font-semibold text-neutral-100">How far is the Storage or Motel location?</div>
              <div>
                The Motel or Storage facility will be located within 20 miles of the ZIP code you provide.
                Exact address details are released only after payment confirmation.
              </div>
            </div>

            <div>
              <div className="font-semibold text-neutral-100">What is the refund policy?</div>
              <div>
                All sales are final. No refunds are provided under any circumstances.
                This includes cancellations, no-shows, late arrivals, or technical issues.
                In rare cases of verified malfunction, a service credit may be issued at our discretion.
              </div>
            </div>

          </div>
        </div>

        {/* SAFETY */}
        <div>
          <h2 className="text-lg font-semibold text-neutral-100 mb-4 border-b border-neutral-700 pb-2">
            Safety
          </h2>

          <div className="space-y-4">

            <div>
              <div className="font-semibold text-neutral-100">What may I do during my session?</div>
              <div>
                You may engage in conversation, role-play, practice social confidence,
                touch and hug, and reposition the companion respectfully.
                <br /><br />
                Guests should shower before interacting and should not wear perfume or cologne.
                <br /><br />
                Companions may not be carried, struck, beaten, kicked, punched, bitten,
                tattooed, pierced, cut, gouged, altered, exposed to children,
                or exposed to smoke, fire, or liquids.
              </div>
            </div>

            <div>
              <div className="font-semibold text-neutral-100">What happens if I damage a companion?</div>
              <div>
                Companions are inspected before and after each session.
                If damage occurs due to misuse or negligence, you agree to reimburse
                the full cost of repair or replacement, including loss of income
                while the companion is out of service.
              </div>
            </div>

            <div>
              <div className="font-semibold text-neutral-100">How are companions cleaned?</div>
              <div>
                Every companion is thoroughly cleaned and disinfected internally and externally before each booking..
              </div>
            </div>

          </div>
        </div>

        {/* BUSINESS */}
        <div>
          <h2 className="text-lg font-semibold text-neutral-100 mb-4 border-b border-neutral-700 pb-2">
            Business Opportunities
          </h2>

          <div className="space-y-4">

            <div>
              <div className="font-semibold text-neutral-100">Is there a subscription service?</div>
              <div>
                A subscription service is currently being developed.
                Members will receive a Black Card providing lower per-session pricing
                and priority access to new companions.
              </div>
            </div>

            <div>
              <div className="font-semibold text-neutral-100">Are franchise opportunities available?</div>
              <div>
                Franchise opportunities are forthcoming and are expected
                to range between $5,000 and $10,000.
                Please contact Support if interested.
              </div>
            </div>

          </div>
        </div>

      </div>
    </SimplePage>
  );
}

/* ============================
   Support Page (with email form)
   ============================ */
function SupportView({ onBack }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const isValidEmail = (v) =>
    typeof v === "string" &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

  async function submitSupport() {
    if (!isValidEmail(email)) {
      alert("Please enter a valid email.");
      return;
    }
    if (!message.trim()) {
      alert("Please enter a message.");
      return;
    }

    setSending(true);

    try {
      const r = await fetch(`${API_BASE_URL}/api/support-email`, {
        method: "POST",
        headers: {
  "Content-Type": "application/json",
  "x-api-key": import.meta.env.VITE_INTERNAL_API_KEY
},  
        body: JSON.stringify({
          email: email.trim(),
          message: message.trim(),
        }),
      });

      if (!r.ok) throw new Error("Failed to send");

      setSent(true);
      setEmail("");
      setMessage("");
    } catch (err) {
      alert("Could not send message. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <SimplePage title="Support" onBack={onBack}>
      <div className="space-y-4 text-sm text-neutral-300">

        {sent && (
          <div className="text-emerald-400">
            Message sent successfully. We’ll respond soon.
          </div>
        )}

        <div>
          <div className="font-medium mb-1">Your Email</div>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2"
          />
        </div>

        <div>
          <div className="font-medium mb-1">Message</div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="How can we help?"
            rows={4}
            className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2"
          />
        </div>

        <button
          onClick={submitSupport}
          disabled={sending}
          className="rounded-xl bg-white text-black px-4 py-2 font-medium hover:bg-neutral-200 disabled:opacity-50"
        >
          {sending ? "Sending…" : "Send Message"}
        </button>

      </div>
    </SimplePage>
  );
}

/* ============================
   MAIN GALLERY APP
   ============================ */
export default function DollGalleryPage() {
 
  const dolls = useMemo(() => [
      { id: 1,  name: "Jenn",     tag: "Classic Chic",     price: 149, rating: 4.9, reviews: 128, status: "Available", sizes: ["S","M","L"], height: "Average", hair: "Brunette", eyes: "Brown", skinTone: "Light",  pickup: ["Motel","Storage","Delivery"] },
      { id: 2,  name: "Miriam",   tag: "Modern Minimal",   price: 139, rating: 4.8, reviews: 97,  status: "Available", sizes: ["XS","S","M"], height: "Petite",  hair: "Blonde",   eyes: "Blue",  skinTone: "Fair",   pickup: ["Motel","Storage","Delivery"] },

      // Renamed seven
      { id: 3,  name: "Adriana",  tag: "Evening Elegance", price: 159, rating: 4.9, reviews: 201, status: "Booked",    sizes: ["M","L"],     height: "Tall",    hair: "Black",    eyes: "Green", skinTone: "Tan",    pickup: ["Motel","Storage","Delivery"] },
      { id: 4,  name: "Jovelyn",  tag: "Street Luxe",      price: 129, rating: 4.7, reviews: 73,  status: "Available", sizes: ["S","M"],     height: "Average", hair: "Red",      eyes: "Hazel", skinTone: "Medium", pickup: ["Motel","Storage","Delivery"] },
      { id: 5,  name: "Michelle", tag: "Resort Casual",    price: 119, rating: 4.6, reviews: 54,  status: "Available", sizes: ["XS","S"],    height: "Petite",  hair: "Dyed",     eyes: "Gray",  skinTone: "Light",  pickup: ["Motel","Storage","Delivery"] },
      { id: 6,  name: "Anh",      tag: "Black Tie",        price: 169, rating: 4.9, reviews: 220, status: "Available", sizes: ["M","L"],     height: "Tall",    hair: "Brunette", eyes: "Brown", skinTone: "Deep",   pickup: ["Motel","Storage","Delivery"] },
      { id: 7,  name: "Julieta",  tag: "Soft Pastels",     price: 135, rating: 4.7, reviews: 88,  status: "Available", sizes: ["S","M","L"], height: "Average", hair: "Blonde",   eyes: "Green", skinTone: "Medium", pickup: ["Motel","Storage","Delivery"] },
      { id: 8,  name: "Andrea",   tag: "Monochrome",       price: 125, rating: 4.5, reviews: 41,  status: "Available", sizes: ["XS","S","M"], height: "Petite",  hair: "Black",    eyes: "Hazel", skinTone: "Tan",    pickup: ["Motel","Storage","Delivery"] },
      { id: 9,  name: "Chiquita", tag: "Tailored",         price: 145, rating: 4.8, reviews: 132, status: "Booked",    sizes: ["M","L"],     height: "Tall",    hair: "Red",      eyes: "Blue",  skinTone: "Light",  pickup: ["Motel","Storage","Delivery"] },
      { id:10,  name: "Grace",    tag: "Day-to-Night",     price: 129, rating: 4.6, reviews: 57,  status: "Available", sizes: ["XS","S"],    height: "Average", hair: "Brunette", eyes: "Brown", skinTone: "Fair",   pickup: ["Motel","Storage","Delivery"] },
      { id:11,  name: "Marie",    tag: "Statement",        price: 155, rating: 4.8, reviews: 105, status: "Available", sizes: ["S","M"],     height: "Average", hair: "Dyed",     eyes: "Gray",  skinTone: "Deep",   pickup: ["Motel","Storage","Delivery"] },
      { id:12,  name: "Carolina", tag: "Minimal Luxe",     price: 139, rating: 4.7, reviews: 66,  status: "Available", sizes: ["XS","S","M","L"], height: "Tall", hair: "Black", eyes: "Brown", skinTone: "Medium", pickup: ["Motel","Storage","Delivery"] },
    ], []
  );

  const [page, setPage] = useState("gallery");
  const [selected, setSelected] = useState(null);
  const [persona, setPersona] = useState({ age: "", personality: "", nationality: "", background: "", interest: "", professional: "", mood: "", traits: [] });

  const [search, setSearch] = useState("");
  const [fHeight] = useState("All");
  const [fHair] = useState("All");
  const [fEyes] = useState("All");
  const [fSkin] = useState("All");
  const [fPickup] = useState("All");
  const [sortBy] = useState("Default");

  const [zip, setZip] = useState("");
  const [zipError, setZipError] = useState(false);
  const zipRef = useRef(null);

  const gridRef = useRef(null);
  const [reservation, setReservation] = useState(null);

  const filtered = useMemo(() => {
    let out = dolls.filter((d) => (d.name + " " + d.tag).toLowerCase().includes(search.toLowerCase()));
    return out;
  }, [dolls, search]);

  const pageSize = 8;
  const [pageIndex, setPageIndex] = useState(1);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const start = (pageIndex - 1) * pageSize;
  const visible = filtered.slice(start, start + pageSize);

  function goto(p) {
    setPage(p);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function requireZipThen(next) {
    const ok = isValidZip(zip);
    setZipError(!ok);
    if (!ok) { zipRef.current?.focus(); return; }
    next();
  }
  function handleBrowse() { gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }
  function handleStartReservation() {
    if (!selected) { alert("Select a doll first from the grid (View details), then start your reservation."); return; }
    requireZipThen(() => setPage("reserve"));
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      {/* Top nav / header */}
      <header className="sticky top-0 z-10 bg-neutral-900/80 backdrop-blur border-b border-neutral-800">
        <div className="mx-auto max-w-7xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 grid place-items-center rounded-lg bg-white text-black text-xs font-bold">SC</div>
            <h1 className="text-xl font-semibold tracking-tight">Secret Companions</h1>
            <span className="ml-3 hidden md:inline text-sm text-neutral-400 capitalize">{page}</span>
          </div>
<nav className="hidden md:flex items-center gap-6 text-sm">
  <button className="hover:text-neutral-200" onClick={() => setPage("mission")}>Our Mission</button>
  <button className="hover:text-neutral-200" onClick={() => setPage("gallery")}>Catalog</button>
  <button className="hover:text-neutral-200" onClick={() => setPage("care")}>Care & Cleaning</button>
  <button className="hover:text-neutral-200" onClick={() => setPage("faq")}>FAQ</button>
  <button className="hover:text-neutral-200" onClick={() => setPage("support")}>Support</button>
</nav>

        </div>
      </header>

      {page === "gallery" && (
        <>
          <section className="border-b border-neutral-800 bg-neutral-900">
            <div className="mx-auto max-w-7xl px-4 py-5 space-y-4">
              <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
                <input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPageIndex(1); }}
                  className="w-full md:w-96 rounded-xl border border-neutral-700 bg-neutral-800 text-neutral-100 placeholder-neutral-400 px-3 py-2 outline-none focus:ring-2 focus:ring-white/30"
                  placeholder="Search companion dolls, looks, or tags"
                />
                <div className="flex gap-3">
                  <button onClick={handleBrowse} className="rounded-xl border border-neutral-700 px-4 py-2 hover:bg-neutral-800">Browse Dolls</button>
                  <div className="relative">
                    <input
                      ref={zipRef}
                      value={zip}
                      onChange={(e) => { setZip(e.target.value); if (zipError) setZipError(false); }}
                      className={`w-36 rounded-xl border ${zipError && !isValidZip(zip) ? "border-red-500 focus:ring-red-500" : "border-neutral-700 focus:ring-white/30"} bg-neutral-800 text-neutral-100 placeholder-neutral-400 px-3 py-2`}
                      placeholder="Service ZIP"
                      aria-invalid={zipError && !isValidZip(zip)}
                      aria-describedby="zip-help"
                    />
                    <div id="zip-help" className={`${zipError && !isValidZip(zip) ? "block" : "sr-only"} mt-1 text-xs text-red-400`}>
                      Enter a 5-digit ZIP to reserve.
                    </div>
                  </div>
                  <button
                    onClick={handleStartReservation}
                    disabled={!selected}
                    className={`rounded-xl px-4 py-2 font-medium ${selected ? "bg-white text-black hover:bg-neutral-200" : "bg-neutral-700 text-neutral-400 cursor-not-allowed"}`}
                    title={selected ? "Start reservation" : "Select a doll first"}
                  >
                    Start Reservation
                  </button>
                </div>
              </div>
            </div>
          </section>

          <main ref={gridRef} className="mx-auto max-w-7xl px-4 py-8">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
              {visible.map((d) => {
                const firstImg = DOLL_IMAGES[d.name] && DOLL_IMAGES[d.name][0];
                return (
                  <article key={d.id} className="group rounded-2xl overflow-hidden border border-neutral-800 bg-neutral-900 hover:shadow-sm transition">
                    <div className="aspect-[4/5] bg-neutral-800 overflow-hidden">
                      {firstImg ? <img src={firstImg} alt={d.name} className="h-full w-full object-cover" /> : null}
                    </div>
                    <div className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium group-hover:underline">{d.name}</h3>
                        <span className={`text-xs px-2 py-1 rounded-full border ${d.status === "Available" ? "bg-emerald-900/30 text-emerald-400 border-emerald-700" : "bg-neutral-800 text-neutral-400 border-neutral-700"}`}>{d.status}</span>
                      </div>
                      <p className="text-sm text-neutral-400">{d.tag}</p>
                      <div className="flex items-center justify-between text-sm">
                        <div className="text-neutral-300"> {d.rating} <span className="text-neutral-400">({d.reviews})</span></div>
                        <div className="font-semibold">$100 per hour</div>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <button className="flex-1 rounded-xl border border-neutral-700 py-2 hover:bg-neutral-800" onClick={() => { setSelected(d); setPage("details"); }}>
                          View details
                        </button>
                        <button className="flex-1 rounded-xl bg-white text-black py-2 hover:bg-neutral-200" onClick={() => { setSelected(d); requireZipThen(() => setPage("reserve")); }}>
                          Reserve
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="mt-10 flex items-center justify-center gap-2">
              <button className="rounded-xl border px-4 py-2 hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed" onClick={() => setPageIndex((p) => Math.max(1, p - 1))} disabled={pageIndex === 1}>
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <button key={n} className={`rounded-xl border px-4 py-2 ${pageIndex === n ? "bg-white text-black" : "hover:bg-neutral-800"}`} onClick={() => setPageIndex(n)}>
                  {n}
                </button>
              ))}
              <button className="rounded-xl border px-4 py-2 hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed" onClick={() => setPageIndex((p) => Math.min(totalPages, p + 1))} disabled={pageIndex === totalPages}>
                Next
              </button>
            </div>
          </main>
        </>
      )}

      {page === "details" && selected && (
        <DetailsView
          doll={selected}
          persona={persona}
          onPersonaChange={setPersona}
          onBack={() => setPage("gallery")}
          onReserve={() => requireZipThen(() => setPage("reserve"))}
        />
      )}

      {page === "reserve" && selected && (
        <ReserveView
          doll={selected}
          persona={persona}
          zip={zip}
          onEditZip={(v) => setZip(v)}
          onConfirm={(summary) => { setReservation(summary); setPage("confirmation"); }}
          onBack={() => setPage("gallery")}
        />
      )}

      {page === "confirmation" && selected && (
        <ConfirmationView doll={selected} reservation={reservation} onDone={() => setPage("gallery")} />
      )}

      {/* Our Mission (placeholder) */}
      {page === "mission" && (
        <SimplePage title="Our Mission" onBack={() => setPage("gallery")}>
          <div className="space-y-4 text-sm text-neutral-300">
            <h3 className="text-lg font-semibold"><strong>Our Mission</strong></h3>
            <p>
              If you need <strong>comfort, connection, or emotional support</strong> — or are experiencing
              <strong> stress, anxiety, loneliness, and need relief</strong> — then <strong>Secret Companions</strong> was created for you.
            </p>
            <p>
              In a world where genuine closeness can be hard to find, we exist to offer a private space for peace,
              understanding, and renewal. Built on one guiding principle — that everyone deserves moments of calm and
              companionship <strong>even when they don’t have someone special</strong> — <strong>Secret Companions</strong> reminds us that
              <strong> comfort and connection aren’t privileges — they’re part of being human.</strong>
            </p>
            <hr className="my-2 border-neutral-800" />
            <p>
              <strong>If you’re searching for peace, comfort, or connection — then you deserve a Secret Companion.</strong>
            </p>
          </div>
        </SimplePage>
      )}

      {/* FAQ */}
      {page === "faq" && <FAQPage onBack={() => setPage("gallery")} />}

      {/* Support */}
      {page === "support" && <SupportView onBack={() => setPage("gallery")} />}

            {/* Care & Cleaning */}
 {page === "care" && (
        <SimplePage title="Care & Cleaning" onBack={() => setPage("gallery")}>
          <div className="space-y-5 text-sm text-neutral-200 leading-6">
  <p>
    Every companion is inspected, cleaned, and sanitized <strong>before every session</strong>, so you can feel <strong>comfortable, confident, and safe</strong>.
  </p>

  <div>
    <h3 className="font-semibold text-white mb-1">Standards</h3>
    <p>
      We hold every companion to a high standard, verifying cleanliness, condition, and presentation prior to each booking.
    </p>
  </div>

  <div>
    <h3 className="font-semibold text-white mb-1">Sanitization</h3>
    <p>
      Every accessible area is thoroughly cleaned and sanitized as part of every preparation cycle.
    </p>
  </div>

  <div>
    <h3 className="font-semibold text-white mb-1">Availability</h3>
    <p>
      A companion is not made available until preparation is complete.
    </p>
  </div>

  <div>
    <h3 className="font-semibold text-white mb-1">Your Safety</h3>
    <p>
      Your safety and peace of mind matter. Please be assured you are safe.
    </p>
  </div>

  <div className="rounded-xl border border-neutral-700 bg-neutral-900/60 p-4">
    <p>
      <strong>Our Promise:</strong> Every companion is inspected, cleaned, and sanitized <strong>before every session</strong>. No exceptions.
    </p>
  </div>
</div>
        </SimplePage>
      )}
    </div>
  );
}

