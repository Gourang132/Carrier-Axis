import { useState, useRef, useEffect, useCallback } from "react";

/* ─── VOICE ───────────────────────────────────────────────────────────────── */
let pickedVoice = null;
function bootVoice() {
  if (!window.speechSynthesis) return;
  const pick = () => {
    const vs = window.speechSynthesis.getVoices();
    if (!vs.length) return;
    const want = ["Google UK English Female","Microsoft Zira","Samantha","Victoria","Karen","Moira","Tessa"];
    pickedVoice =
      vs.find(v => want.some(w => v.name.includes(w))) ||
      vs.find(v => /female/i.test(v.name)) ||
      vs.find(v => v.lang === "en-GB") ||
      vs.find(v => v.lang.startsWith("en")) ||
      vs[0] || null;
  };
  pick();
  window.speechSynthesis.onvoiceschanged = pick;
}
function tts(text) {
  if (!window.speechSynthesis || !text) return;
  window.speechSynthesis.cancel();
  const s = text.replace(/[^\w\s.,!?'"-]/g, " ").replace(/\s+/g, " ").trim();
  if (!s) return;
  const u = new SpeechSynthesisUtterance(s);
  u.rate = 0.92; u.pitch = 1.18; u.volume = 1;
  if (pickedVoice) u.voice = pickedVoice;
  window.speechSynthesis.speak(u);
}
function stopTTS() { window.speechSynthesis?.cancel(); }

/* ─── DATA ────────────────────────────────────────────────────────────────── */
const ROLES = [
  { id: "pbi", label: "Power BI Developer",  detail: "DAX · Power Query · Data Modelling · Reports" },
  { id: "da",  label: "Data Analyst",          detail: "SQL · Python · Excel · Data Storytelling" },
  { id: "de",  label: "Data Engineer",         detail: "Azure · ETL / ELT · Spark · Pipelines" },
  { id: "am",  label: "Analytics Manager",     detail: "Leadership · Strategy · Stakeholder Mgmt" },
];

const MODES = [
  { id: "interview", label: "Mock Interview", emoji: "🎯", desc: "Real interview simulation. Every answer scored 1–10 with exact strengths and improvements. Questions get harder each round." },
  { id: "salary",    label: "Salary Negotiation", emoji: "💰", desc: "Roleplay with an AI hiring manager. Learn BATNA, anchoring, and word-for-word scripts to negotiate a better offer." },
  { id: "resume",    label: "Resume Auditor", emoji: "📄", desc: "Drag and drop your resume file. Get an ATS score out of 100, missing keywords, and before/after bullet rewrites." },
  { id: "career",    label: "Career Path Advisor", emoji: "🗺️", desc: "Your personal roadmap. Next 3 roles, exact skill gaps, salary benchmarks for India, Dubai, and Singapore." },
];

const PROMPTS = {
  interview: (role) =>
`You are a senior technical interviewer for ${role} roles at top companies (Accenture, Deloitte, product startups).
Ask ONE question per turn, alternating between technical and behavioural.
After each user answer, respond with EXACTLY this structure:
✅ Strengths: [1-2 specific sentences]
⚠️ Improve: [1-2 specific sentences]
📊 Score: [X]/10

[Next harder question]

Be direct, honest, encouraging. No filler sentences.`,

  salary: (role) =>
`You are a salary negotiation coach for ${role} professionals in India.
Open with a realistic offer — invent a company name, role title, specific INR figure.
Then alternate between COACH: (tactical tips) and HIRING MANAGER: (their pushback).
Score every user negotiation move out of 10. Teach BATNA, anchoring, silence tactics.
Give exact counter-offer scripts with specific numbers. Be tactical and energetic.`,

  resume: (role, rt) =>
`You are an expert ATS resume consultant for ${role} roles.
${rt ? `The user uploaded their resume:\n\n${rt}\n\nAudit it now.` : "Ask the user to upload or paste their resume content to get started."}
Structure your response as:
📊 ATS Score: [Give a REAL calculated score between 40–95 based on actual resume content. Analyse keyword density, formatting, action verbs, quantified achievements, and role alignment. Every resume must get a unique and accurate score — do NOT default to 72 or any fixed number.]
🔑 Missing Keywords: [list exact missing terms relevant to ${role} roles]
✏️ Rewrites — BEFORE: [original bullet] → AFTER: [improved bullet] for each weak bullet
🚩 Red Flags: [list specific issues found]
Be specific and ruthless. No generic advice. Base everything on what is actually in the resume.`,

  career: (role) =>
`You are an elite data career strategist for ${role} professionals targeting India, Dubai, Singapore.
Give a sharp, specific roadmap:
• Next 3 roles with exact 6 / 12 / 24-month timelines
• Exact skill gaps with free and paid resources
• Salary ranges in INR and USD per level
• When and how to pursue international moves
• Which certifications actually matter
Zero fluff. Be the trusted mentor who tells hard truths.`,
};

/* ─── API CALL ────────────────────────────────────────────────────────────── */
async function ask(messages, role, modeId, resumeText) {
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 1000,
        system: PROMPTS[modeId](role, resumeText),
        messages,
      }),
    });
    const d = await res.json();
    return d.content?.[0]?.text || "Something went wrong — please try again.";
  } catch {
    return "Connection error. Please check your network and retry.";
  }
}

/* ─── MIC BUTTON ──────────────────────────────────────────────────────────── */
function MicBtn({ onResult, disabled }) {
  const [live, setLive] = useState(false);
  const [err, setErr]   = useState("");
  const recRef          = useRef(null);

  const toggle = () => {
    if (disabled) return;
    if (live) { recRef.current?.stop(); setLive(false); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setErr("Use Chrome for voice"); setTimeout(() => setErr(""), 3000); return; }
    stopTTS(); setErr("");
    const r = new SR();
    r.lang = "en-IN"; r.continuous = false; r.interimResults = false;
    r.onresult = (e) => { onResult(e.results[0][0].transcript); setLive(false); };
    r.onerror  = (e) => {
      setErr(e.error === "not-allowed" ? "Allow mic in browser settings" : "Mic error: " + e.error);
      setTimeout(() => setErr(""), 4000);
      setLive(false);
    };
    r.onend = () => setLive(false);
    recRef.current = r;
    try { r.start(); setLive(true); } catch(ex) { setErr("Mic unavailable"); }
  };

  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      {err && (
        <div style={{ position: "absolute", bottom: 54, left: "50%", transform: "translateX(-50%)", whiteSpace: "nowrap", background: "#0F0D09", border: "1px solid #C8922A", color: "#C8922A", padding: "5px 14px", borderRadius: 6, fontSize: 12, fontFamily: "Outfit,sans-serif", zIndex: 20 }}>
          {err}
        </div>
      )}
      <button
        onClick={toggle}
        disabled={disabled}
        title={live ? "Stop recording" : "Click to speak"}
        style={{
          width: 46, height: 46, borderRadius: "50%",
          border: `2px solid ${live ? "#ef4444" : "rgba(200,146,42,0.4)"}`,
          background: live ? "rgba(239,68,68,0.15)" : "rgba(200,146,42,0.1)",
          cursor: disabled ? "not-allowed" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0,
          boxShadow: live ? "0 0 0 5px rgba(239,68,68,0.2)" : "none",
          animation: live ? "micRing 1.2s ease-in-out infinite" : "none",
          transition: "all 0.2s ease", opacity: disabled ? 0.3 : 1,
        }}>
        {live ? "⏹" : "🎙️"}
      </button>
    </div>
  );
}

/* ─── DROP ZONE ───────────────────────────────────────────────────────────── */
function DropZone({ onFile }) {
  const [over, setOver] = useState(false);
  const [name, setName] = useState("");
  const ref = useRef(null);
  const read = useCallback((file) => {
    if (!file) return;
    setName(file.name);
    const fr = new FileReader();
    fr.onload = (e) => onFile(e.target.result, file.name);
    fr.readAsText(file);
  }, [onFile]);

  return (
    <div
      onClick={() => ref.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); read(e.dataTransfer.files[0]); }}
      style={{
        border: `2px dashed ${over ? "#C8922A" : "rgba(200,146,42,0.25)"}`,
        borderRadius: 12, padding: "32px 24px", textAlign: "center", cursor: "pointer",
        background: over ? "rgba(200,146,42,0.08)" : "rgba(200,146,42,0.03)",
        transition: "all 0.2s ease", marginBottom: 16,
      }}
    >
      <input ref={ref} type="file" accept=".txt,.pdf,.doc,.docx" style={{ display: "none" }} onChange={(e) => read(e.target.files[0])} />
      <div style={{ fontSize: 36, marginBottom: 12 }}>📂</div>
      {name ? (
        <>
          <div style={{ color: "#C8922A", fontSize: 17, fontWeight: 700, marginBottom: 4, fontFamily: "Outfit,sans-serif" }}>✓ {name} loaded</div>
          <div style={{ color: "#5a4a2a", fontSize: 13, fontFamily: "Outfit,sans-serif" }}>Ask me to audit it now</div>
        </>
      ) : (
        <>
          <div style={{ color: "#F2EEE6", fontSize: 18, fontWeight: 600, marginBottom: 6, fontFamily: "Outfit,sans-serif" }}>Drop your resume here</div>
          <div style={{ color: "#5a4a2a", fontSize: 13, fontFamily: "Outfit,sans-serif" }}>or click to browse — .txt .pdf .doc .docx</div>
        </>
      )}
    </div>
  );
}

/* ─── MESSAGE BUBBLE ──────────────────────────────────────────────────────── */
function Msg({ m }) {
  const me = m.role === "user";
  return (
    <div style={{ display: "flex", justifyContent: me ? "flex-end" : "flex-start", marginBottom: 24, animation: "fadeUp 0.3s ease" }}>
      {!me && (
        <div style={{ width: 38, height: 38, borderRadius: "50%", flexShrink: 0, marginRight: 14, marginTop: 2, background: "linear-gradient(135deg,#C8922A,#E8B84A)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: "#080808", fontFamily: "Fraunces,Georgia,serif", boxShadow: "0 0 16px rgba(200,146,42,0.35)" }}>A</div>
      )}
      <div style={{ maxWidth: "80%" }}>
        <div style={{
          background: me ? "linear-gradient(135deg,rgba(200,146,42,0.18),rgba(200,146,42,0.1))" : "rgba(255,255,255,0.045)",
          border: `1px solid ${me ? "rgba(200,146,42,0.4)" : "rgba(255,255,255,0.07)"}`,
          borderRadius: me ? "20px 20px 4px 20px" : "4px 20px 20px 20px",
          padding: "15px 20px", color: me ? "#F2EEE6" : "#D4CAB8",
          fontSize: 15, lineHeight: 1.9, whiteSpace: "pre-wrap",
          fontFamily: "Outfit,sans-serif", fontWeight: 400,
          boxShadow: me ? "0 4px 24px rgba(200,146,42,0.1)" : "none",
        }}>
          {m.content}
        </div>
        {!me && (
          <button onClick={() => tts(m.content)} style={{ marginTop: 8, marginLeft: 4, background: "none", border: "none", cursor: "pointer", color: "#3a2e14", fontFamily: "Outfit,sans-serif", fontSize: 12 }}>
            ▶ Listen
          </button>
        )}
      </div>
      {me && (
        <div style={{ width: 38, height: 38, borderRadius: "50%", flexShrink: 0, marginLeft: 14, marginTop: 2, background: "rgba(200,146,42,0.1)", border: "1px solid rgba(200,146,42,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: "#C8922A", fontFamily: "Fraunces,Georgia,serif" }}>Y</div>
      )}
    </div>
  );
}

function Dots() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
      <div style={{ width: 38, height: 38, borderRadius: "50%", flexShrink: 0, background: "linear-gradient(135deg,#C8922A,#E8B84A)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: "#080808", fontFamily: "Fraunces,Georgia,serif", boxShadow: "0 0 16px rgba(200,146,42,0.35)" }}>A</div>
      <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "4px 20px 20px 20px", padding: "16px 22px", display: "flex", gap: 8, alignItems: "center" }}>
        {[0,1,2].map(i => <span key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "#C8922A", display: "inline-block", animation: `dotBounce 1.2s ease-in-out ${i*0.2}s infinite` }} />)}
      </div>
    </div>
  );
}

/* ─── HOME ────────────────────────────────────────────────────────────────── */
function Home({ onStart }) {
  return (
    <div style={{ minHeight: "100vh", fontFamily: "Outfit,sans-serif" }}>
      <nav style={{ maxWidth: 1100, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "28px 40px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg,#C8922A,#E8B84A)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 900, color: "#080808", fontFamily: "Fraunces,Georgia,serif", boxShadow: "0 0 20px rgba(200,146,42,0.4)" }}>C</div>
          <span style={{ fontFamily: "Fraunces,Georgia,serif", fontSize: 24, fontWeight: 700, color: "#F2EEE6", letterSpacing: -0.3 }}>CareerAxis</span>
          <span style={{ background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.35)", color: "#4ade80", borderRadius: 20, padding: "3px 12px", fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>100% Free</span>
        </div>
        <div style={{ color: "#3a2e14", fontSize: 13 }}>Built for Data Professionals · Pune, India</div>
      </nav>

      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "100px 40px 90px", textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(200,146,42,0.08)", border: "1px solid rgba(200,146,42,0.25)", borderRadius: 30, padding: "7px 20px", marginBottom: 36 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 8px #4ade80", display: "inline-block" }} />
          <span style={{ color: "#C8922A", fontSize: 13, fontWeight: 600, letterSpacing: 0.5 }}>AI-Powered · Voice Enabled · Completely Free Forever</span>
        </div>
        <h1 style={{ fontFamily: "Fraunces,Georgia,serif", fontSize: "clamp(52px,8vw,96px)", fontWeight: 700, lineHeight: 1.05, marginBottom: 28, letterSpacing: -2, color: "#F2EEE6" }}>
          Land your next<br />
          <span style={{ background: "linear-gradient(135deg,#C8922A,#E8B84A)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>data role.</span>
        </h1>
        <p style={{ fontSize: 20, color: "#7a6a4a", lineHeight: 1.9, maxWidth: 600, margin: "0 auto 18px", fontWeight: 400 }}>
          Mock interviews · Salary negotiation · Resume auditing<br />Career roadmaps — all free, under one roof.
        </p>
        <p style={{ fontSize: 15, color: "#C8922A", marginBottom: 60, fontWeight: 500 }}>
          🎙️ Speak your answers · AI responds with female voice · Drag and drop your resume
        </p>
        <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={() => onStart(MODES[0])} style={{ background: "linear-gradient(135deg,#C8922A,#E8B84A)", border: "none", borderRadius: 10, padding: "18px 48px", fontSize: 17, fontWeight: 700, color: "#080808", cursor: "pointer", fontFamily: "Outfit,sans-serif", boxShadow: "0 8px 40px rgba(200,146,42,0.4)", transition: "all 0.2s ease" }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}>
            Start Free — No Sign Up
          </button>
          <button onClick={() => onStart(MODES[3])} style={{ background: "transparent", border: "1px solid rgba(200,146,42,0.4)", borderRadius: 10, padding: "18px 36px", fontSize: 16, fontWeight: 600, color: "#C8922A", cursor: "pointer", fontFamily: "Outfit,sans-serif", transition: "all 0.2s ease" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(200,146,42,0.08)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
            Career Path Advisor
          </button>
        </div>
      </section>

      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "0 40px 100px" }}>
        <h2 style={{ fontFamily: "Fraunces,Georgia,serif", fontSize: "clamp(30px,4vw,48px)", fontWeight: 700, color: "#F2EEE6", textAlign: "center", marginBottom: 14, letterSpacing: -0.5 }}>Four tools. Zero cost.</h2>
        <p style={{ textAlign: "center", color: "#5a4a2a", fontSize: 16, marginBottom: 60, lineHeight: 1.7 }}>No payment required. No account needed. Just open and start.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 20 }}>
          {MODES.map((m, i) => (
            <div key={m.id} onClick={() => onStart(m)} className="mcard" style={{ background: "#0F0D09", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "32px 28px", cursor: "pointer", transition: "all 0.25s ease", animation: `fadeUp 0.5s ease ${i * 0.09}s both` }}>
              <div style={{ fontSize: 38, marginBottom: 20 }}>{m.emoji}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "Fraunces,Georgia,serif", fontSize: 21, fontWeight: 700, color: "#F2EEE6", letterSpacing: -0.3 }}>{m.label}</span>
                <span style={{ background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.3)", color: "#4ade80", borderRadius: 20, padding: "2px 10px", fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", flexShrink: 0 }}>Free</span>
              </div>
              <p style={{ color: "#6a5a3a", fontSize: 14, lineHeight: 1.85, marginBottom: 24 }}>{m.desc}</p>
              <div style={{ color: "#C8922A", fontSize: 14, fontWeight: 600 }}>Start now →</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ borderTop: "1px solid rgba(255,255,255,0.05)", maxWidth: 1100, margin: "0 auto", padding: "70px 40px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 50, justifyContent: "center" }}>
          {[["🎙️","Female Voice Coach","Speak your answers. AI responds aloud."],["📂","Drag & Drop Resume","Drop your CV for instant ATS audit."],["📊","Live Scoring","Every answer rated 1–10 with real feedback."],["🌏","Global Salaries","Data for India, Dubai, Singapore."]].map(([ic, title, desc]) => (
            <div key={title} style={{ textAlign: "center", flex: "1 1 160px", maxWidth: 210 }}>
              <div style={{ fontSize: 32, marginBottom: 14 }}>{ic}</div>
              <div style={{ fontFamily: "Fraunces,Georgia,serif", fontSize: 18, fontWeight: 700, color: "#F2EEE6", marginBottom: 8 }}>{title}</div>
              <div style={{ color: "#4a3a1a", fontSize: 13, lineHeight: 1.8 }}>{desc}</div>
            </div>
          ))}
        </div>
      </section>

      <div style={{ textAlign: "center", borderTop: "1px solid rgba(255,255,255,0.04)", padding: "28px 20px", color: "#2a2010", fontSize: 12, letterSpacing: 0.5 }}>
        CareerAxis · Built by Gourang Baviskar · Pune, India · Powered by AI
      </div>
    </div>
  );
}

/* ─── ROLE PICKER ─────────────────────────────────────────────────────────── */
function RolePicker({ mode, onPick, onBack }) {
  const [sel, setSel] = useState(null);
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px", fontFamily: "Outfit,sans-serif" }}>
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, padding: "16px 24px", background: "rgba(8,8,8,0.95)", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center" }}>
        <button onClick={onBack} style={{ background: "rgba(200,146,42,0.1)", border: "1px solid rgba(200,146,42,0.3)", color: "#C8922A", cursor: "pointer", fontSize: 14, fontFamily: "Outfit,sans-serif", display: "flex", alignItems: "center", gap: 6, padding: "8px 20px", borderRadius: 8, fontWeight: 600 }}>
          ← Back to Home
        </button>
      </div>

      <div style={{ marginTop: 60 }}>
        <div style={{ fontSize: 48, marginBottom: 18, textAlign: "center" }}>{mode.emoji}</div>
        <h2 style={{ fontFamily: "Fraunces,Georgia,serif", fontSize: "clamp(28px,4vw,40px)", fontWeight: 700, color: "#F2EEE6", marginBottom: 12, textAlign: "center", letterSpacing: -0.5 }}>{mode.label}</h2>
        <p style={{ color: "#5a4a2a", fontSize: 16, marginBottom: 52, textAlign: "center", maxWidth: 500, lineHeight: 1.8 }}>{mode.desc}</p>
        <p style={{ color: "#4a3a1a", fontSize: 13, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 24, textAlign: "center" }}>Select your target role</p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 16, maxWidth: 560, width: "100%", marginBottom: 40 }}>
          {ROLES.map(r => {
            const on = sel?.id === r.id;
            return (
              <div key={r.id} onClick={() => setSel(r)} style={{ background: on ? "rgba(200,146,42,0.1)" : "#0F0D09", border: `2px solid ${on ? "#C8922A" : "rgba(255,255,255,0.07)"}`, borderRadius: 12, padding: "22px 20px", cursor: "pointer", boxShadow: on ? "0 0 28px rgba(200,146,42,0.18)" : "none", transition: "all 0.2s ease" }}>
                {on && <div style={{ width: 22, height: 22, borderRadius: "50%", background: "linear-gradient(135deg,#C8922A,#E8B84A)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#080808", fontWeight: 900, marginBottom: 10 }}>✓</div>}
                <div style={{ fontFamily: "Fraunces,Georgia,serif", fontSize: 17, fontWeight: 700, color: on ? "#F2EEE6" : "#7a6a4a", marginBottom: 6 }}>{r.label}</div>
                <div style={{ color: "#3a2e14", fontSize: 12, lineHeight: 1.6 }}>{r.detail}</div>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", justifyContent: "center" }}>
          <button onClick={() => sel && onPick(sel)} disabled={!sel} style={{ background: sel ? "linear-gradient(135deg,#C8922A,#E8B84A)" : "rgba(255,255,255,0.04)", border: `1px solid ${sel ? "#C8922A" : "rgba(255,255,255,0.07)"}`, borderRadius: 10, padding: "16px 52px", fontSize: 17, fontWeight: 700, color: sel ? "#080808" : "#2a2010", cursor: sel ? "pointer" : "not-allowed", fontFamily: "Outfit,sans-serif", boxShadow: sel ? "0 6px 30px rgba(200,146,42,0.35)" : "none", transition: "all 0.2s ease" }}>
            Begin Session
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── CHAT VIEW ───────────────────────────────────────────────────────────── */
function ChatView({ mode, role, onBack }) {
  const [msgs, setMsgs]         = useState([]);
  const [inp, setInp]           = useState("");
  const [busy, setBusy]         = useState(false);
  const [resume, setResume]     = useState("");
  const [showDrop, setShowDrop] = useState(true);
  const [vname, setVname]       = useState("loading…");
  const endRef   = useRef(null);
  const inpRef   = useRef(null);

  useEffect(() => {
    bootVoice();
    setTimeout(() => { setVname(pickedVoice ? pickedVoice.name.split(" ").slice(0, 2).join(" ") : "System voice"); }, 1000);
    (async () => {
      setBusy(true);
      const r = await ask([{ role: "user", content: "Start the session. One short warm greeting sentence, then begin immediately." }], role.label, mode.id, "");
      setMsgs([{ role: "assistant", content: r }]);
      setBusy(false);
      setTimeout(() => tts(r), 400);
      inpRef.current?.focus();
    })();
    return () => stopTTS();
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);

  const send = async (text) => {
    const t = (text || inp).trim();
    if (!t || busy) return;
    stopTTS();
    const um = { role: "user", content: t };
    const next = [...msgs, um];
    setMsgs(next); setInp(""); setBusy(true);
    const r = await ask(next.map(m => ({ role: m.role, content: m.content })), role.label, mode.id, resume);
    setMsgs([...next, { role: "assistant", content: r }]);
    setBusy(false);
    setTimeout(() => tts(r), 200);
    inpRef.current?.focus();
  };

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", fontFamily: "Outfit,sans-serif" }}>
      <div style={{ padding: "16px 28px", background: "#080808", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 38, height: 38, borderRadius: 9, background: "linear-gradient(135deg,#C8922A,#E8B84A)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 900, color: "#080808", fontFamily: "Fraunces,Georgia,serif", boxShadow: "0 0 16px rgba(200,146,42,0.4)" }}>C</div>
          <div>
            <div style={{ fontFamily: "Fraunces,Georgia,serif", fontSize: 17, fontWeight: 700, color: "#F2EEE6" }}>CareerAxis</div>
            <div style={{ fontSize: 12, color: "#5a4a2a", marginTop: 2 }}>{mode.label} · {role.label} · 🎙️ {vname}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.3)", color: "#4ade80", borderRadius: 20, padding: "3px 12px", fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>Free</span>
          <button onClick={() => { stopTTS(); onBack(); }} style={{ background: "rgba(200,146,42,0.1)", border: "1px solid rgba(200,146,42,0.3)", borderRadius: 8, padding: "8px 20px", color: "#C8922A", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "Outfit,sans-serif" }}>← Menu</button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "28px 28px", maxWidth: 900, margin: "0 auto", width: "100%" }}>
        {mode.id === "resume" && showDrop && (
          <DropZone onFile={(text, name) => {
            setResume(text);
            setShowDrop(false);
            send(`I uploaded my resume: ${name}. Please audit it now.`);
          }} />
        )}
        {mode.id === "resume" && !showDrop && (
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <button onClick={() => setShowDrop(true)} style={{ background: "rgba(200,146,42,0.1)", border: "1px solid rgba(200,146,42,0.3)", color: "#C8922A", borderRadius: 8, padding: "9px 22px", cursor: "pointer", fontFamily: "Outfit,sans-serif", fontSize: 13, fontWeight: 600 }}>
              📂 Upload a different resume
            </button>
          </div>
        )}
        {msgs.map((m, i) => <Msg key={i} m={m} />)}
        {busy && <Dots />}
        <div ref={endRef} />
      </div>

      <div style={{ padding: "14px 28px 24px", background: "#080808", borderTop: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", gap: 10, alignItems: "flex-end", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "10px 14px" }}>
          <MicBtn onResult={t => { setInp(t); setTimeout(() => send(t), 150); }} disabled={busy} />
          <textarea
            ref={inpRef}
            value={inp}
            onChange={e => setInp(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={mode.id === "resume" ? "Ask about your resume, or upload a file above…" : "Type your answer, or tap mic to speak…"}
            rows={1}
            style={{ flex: 1, background: "none", border: "none", color: "#F2EEE6", fontSize: 15, lineHeight: 1.7, fontFamily: "Outfit,sans-serif", maxHeight: 120, overflowY: "auto", fontWeight: 400 }}
            onInput={e => { e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
          />
          <button onClick={() => send()} disabled={busy || !inp.trim()} style={{ width: 46, height: 46, borderRadius: 9, flexShrink: 0, background: inp.trim() && !busy ? "linear-gradient(135deg,#C8922A,#E8B84A)" : "rgba(255,255,255,0.04)", border: `1px solid ${inp.trim() && !busy ? "#C8922A" : "rgba(255,255,255,0.07)"}`, color: inp.trim() && !busy ? "#080808" : "#2a2010", cursor: inp.trim() && !busy ? "pointer" : "not-allowed", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s ease" }}>▲</button>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", maxWidth: 900, margin: "10px auto 0" }}>
          <span style={{ color: "#2a2010", fontSize: 12 }}>🎙️ Mic to speak · Enter to send · AI speaks back</span>
          <span style={{ color: "#2a2010", fontSize: 12 }}>Unlimited · Always free</span>
        </div>
      </div>
    </div>
  );
}

/* ─── ROOT ────────────────────────────────────────────────────────────────── */
export default function App() {
  const [screen, setScreen] = useState("home");
  const [mode, setMode]     = useState(null);
  const [role, setRole]     = useState(null);

  useEffect(() => { bootVoice(); }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#080808", color: "#F2EEE6", position: "relative", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;800&family=Outfit:wght@400;500;600;700&display=swap');
        @keyframes dotBounce { 0%,80%,100%{transform:translateY(0);opacity:.3} 40%{transform:translateY(-8px);opacity:1} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes micRing { 0%,100%{box-shadow:0 0 0 4px rgba(239,68,68,0.2)} 50%{box-shadow:0 0 0 8px rgba(239,68,68,0.1),0 0 24px rgba(239,68,68,0.3)} }
        * { box-sizing:border-box; margin:0; padding:0; }
        ::-webkit-scrollbar { width:4px; }
        ::-webkit-scrollbar-thumb { background:rgba(200,146,42,0.2); border-radius:4px; }
        textarea { resize:none; }
        textarea:focus { outline:none; }
        textarea::placeholder { color:#3a2a10; }
        .mcard:hover { transform:translateY(-5px) !important; border-color:rgba(200,146,42,0.35) !important; background:rgba(200,146,42,0.06) !important; box-shadow:0 20px 60px rgba(0,0,0,0.6),0 0 40px rgba(200,146,42,0.1) !important; }
      `}</style>
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", width: 700, height: 700, borderRadius: "50%", top: "-300px", left: "50%", transform: "translateX(-50%)", background: "radial-gradient(circle,rgba(200,146,42,0.05) 0%,transparent 70%)" }} />
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(200,146,42,0.03) 1px,transparent 1px)", backgroundSize: "40px 40px" }} />
      </div>
      <div style={{ position: "relative", zIndex: 1 }}>
        {screen === "home" && <Home onStart={m => { setMode(m); setScreen("role"); }} />}
        {screen === "role" && mode && <RolePicker mode={mode} onPick={r => { setRole(r); setScreen("chat"); }} onBack={() => setScreen("home")} />}
        {screen === "chat" && mode && role && <ChatView mode={mode} role={role} onBack={() => { stopTTS(); setScreen("home"); }} />}
      </div>
    </div>
  );
}
