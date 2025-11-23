import React, { useMemo, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * Race Safety Health Web MVP v4
 * Adds bilingual language switcher (EN/GR) without external i18n library.
 * Keeps v3 features (A/B/C/D): roles, PDF export, persistence, segments.
 *
 * Drop into a Vite/Next React project. Tailwind assumed.
 * npm: jspdf jspdf-autotable
 */

// -----------------------------
// Utilities
// -----------------------------
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const sum = (arr) => arr.reduce((a, b) => a + b, 0);
const avg = (arr) => (arr.length ? sum(arr) / arr.length : 0);

function polarToCartesian(cx, cy, r, angleDeg) {
  const a = (angleDeg - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function describeArc(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return ["M", start.x, start.y, "A", r, r, 0, largeArcFlag, 0, end.x, end.y].join(" ");
}

// -----------------------------
// Simple i18n
// -----------------------------
const LANGS = [
  { code: "en", label: "EN" },
  { code: "el", label: "GR" },
];

const I18N = {
  en: {
    appTitle: "Race Safety Health",
    subtitle: "EMBOK × FMEA × STPA/STAMP",
    exportPdf: "Export PDF",
    clearFilters: "Clear filters",
    roleView: "Role view",
    template: "Template",
    whyStatus: "Why this status?",
    segmentsTitle: "Course Segments (Zones)",
    segmentsHint: "Tap to filter hazards by location",
    domainsTitle: "Domains (EMBOK)",
    hazardsTitle: "Hazards (FMEA)",
    hazardsHint: "Residual RPN after controls",
    controlsTitle: "Control Loops (STPA)",
    controlsHint: "Readiness minus UCA penalties",
    constraintsTitle: "Critical Constraints (STAMP)",
    constraintsHint: "Hard safety gates",
    readinessTitle: "Domain Readiness (EMBOK)",
    readinessHint: "Permits, staffing, vendors, comms, logistics",
    incidentLogTitle: "Incident Quick Log",
    incidentLogHint: "Logs increase Occurrence (O) for linked hazards",
    recentIncidents: "Recent Incidents",
    recentIncidentsHint: "Latest first",
    noIncidents: "No incidents yet.",
    logIncident: "Log incident",
    tapInspect: "Tap to inspect hazards",
    riskLoad: "Risk Load (FMEA)",
    controlHealth: "Control Health (STPA)",
    readiness: "Readiness (EMBOK)",
    gaugeLabel: "Race Safety Health",
    healthy: "Healthy",
    watch: "Watch",
    notHealthy: "Not Healthy",
    constraintFail: "Constraint Fail",
    trend: "Trend",
    improving: "Improving",
    degrading: "Degrading",
    stable: "Stable",
    holisticHint: "Holistic system health based on risk, controls, and readiness.",
    constraintHint: "A critical safety constraint is violated. Fix now.",
    pass: "pass",
    warn: "warn",
    fail: "fail",
    hazard: "Hazard",
    domain: "Domain",
    segment: "Segment",
    controlsActive: "Controls Active",
    residualRpn: "Residual RPN",
    rpn: "RPN",
    s: "S",
    o: "O",
    d: "D",
    readinessShort: "Readiness",
    ucaCount: "UCA count",
    severityLabel: (n) => `Severity ${n}`,
    notesPlaceholder: "Notes (optional)",
    mvpFooter: "MVP v4 — roles, PDF export, persistence, course segments, bilingual UI.",
  },
  el: {
    appTitle: "Ασφάλεια Αγώνα Δρόμου",
    subtitle: "EMBOK × FMEA × STPA/STAMP",
    exportPdf: "Εξαγωγή PDF",
    clearFilters: "Καθαρισμός φίλτρων",
    roleView: "Προβολή ρόλου",
    template: "Πρότυπο",
    whyStatus: "Γιατί αυτή η κατάσταση;",
    segmentsTitle: "Τμήματα Διαδρομής (Ζώνες)",
    segmentsHint: "Πατήστε για φιλτράρισμα κινδύνων ανά τοποθεσία",
    domainsTitle: "Τομείς (EMBOK)",
    hazardsTitle: "Κίνδυνοι (FMEA)",
    hazardsHint: "Υπολειπόμενο RPN μετά τους ελέγχους",
    controlsTitle: "Βρόχοι Ελέγχου (STPA)",
    controlsHint: "Ετοιμότητα με μείωση λόγω UCA",
    constraintsTitle: "Κρίσιμοι Περιορισμοί (STAMP)",
    constraintsHint: "Σημεία αυστηρής ασφάλειας",
    readinessTitle: "Ετοιμότητα Τομέα (EMBOK)",
    readinessHint: "Άδειες, στελέχωση, προμηθευτές, επικοινωνίες, logistics",
    incidentLogTitle: "Γρήγορη Καταγραφή Συμβάντος",
    incidentLogHint: "Τα συμβάντα αυξάνουν τη Συχνότητα (O) σε σχετικούς κινδύνους",
    recentIncidents: "Πρόσφατα Συμβάντα",
    recentIncidentsHint: "Πιο πρόσφατα πρώτα",
    noIncidents: "Δεν υπάρχουν συμβάντα ακόμη.",
    logIncident: "Καταγραφή συμβάντος",
    tapInspect: "Πατήστε για προβολή κινδύνων",
    riskLoad: "Φορτίο Κινδύνου (FMEA)",
    controlHealth: "Υγεία Ελέγχων (STPA)",
    readiness: "Ετοιμότητα (EMBOK)",
    gaugeLabel: "Ασφάλεια Αγώνα",
    healthy: "Ασφαλές",
    watch: "Προσοχή",
    notHealthy: "Μη Ασφαλές",
    constraintFail: "Αποτυχία Κρίσιμου Περιορισμού",
    trend: "Τάση",
    improving: "Βελτίωση",
    degrading: "Υποβάθμιση",
    stable: "Σταθερό",
    holisticHint: "Ολιστική εικόνα ασφάλειας βάσει κινδύνου, ελέγχων και ετοιμότητας.",
    constraintHint: "Παραβιάστηκε κρίσιμος περιορισμός ασφάλειας. Διορθώστε άμεσα.",
    pass: "εντάξει",
    warn: "προειδοποίηση",
    fail: "αποτυχία",
    hazard: "Κίνδυνος",
    domain: "Τομέας",
    segment: "Τμήμα",
    controlsActive: "Ενεργοί Έλεγχοι",
    residualRpn: "Υπολειπόμενο RPN",
    rpn: "RPN",
    s: "S",
    o: "O",
    d: "D",
    readinessShort: "Ετοιμότητα",
    ucaCount: "Πλήθος UCA",
    severityLabel: (n) => `Σοβαρότητα ${n}`,
    notesPlaceholder: "Σημειώσεις (προαιρετικό)",
    mvpFooter: "MVP v4 — ρόλοι, εξαγωγή PDF, αποθήκευση, ζώνες διαδρομής, δίγλωσσο UI.",
  },
};

// Labels for domains, roles, controls, templates, incidents
const DOMAINS_EN = [
  "Financial",
  "Organizational",
  "Health / Sanitary",
  "Legal",
  "Operational",
  "Sports",
  "Public Relations / Publicity",
  "Human Resources",
  "Environmental",
  "Security – Threats",
];

const DOMAINS_EL = [
  "Οικονομικά",
  "Οργανωτικά",
  "Υγεία / Υγειονομικά",
  "Νομικά",
  "Λειτουργικά",
  "Αθλητικά",
  "Δημόσιες Σχέσεις / Προβολή",
  "Ανθρώπινο Δυναμικό",
  "Περιβαλλοντικά",
  "Ασφάλεια – Απειλές",
];

const ROLES_EN = [
  "Race Director",
  "Operations Lead",
  "Medical Lead",
  "Security Lead",
  "PR / Media Lead",
  "Finance Lead",
  "HR / Volunteers Lead",
  "Environmental Lead",
  "Legal / Compliance Lead",
  "Sports / Course Lead",
];

const ROLES_EL = [
  "Διευθυντής Αγώνα",
  "Υπεύθυνος Λειτουργιών",
  "Υπεύθυνος Υγειονομικού",
  "Υπεύθυνος Ασφαλείας",
  "Υπεύθυνος Δημοσίων Σχέσεων",
  "Υπεύθυνος Οικονομικών",
  "Υπεύθυνος Εθελοντών / ΑΔ",
  "Υπεύθυνος Περιβάλλοντος",
  "Υπεύθυνος Νομικής Συμμόρφωσης",
  "Υπεύθυνος Διαδρομής / Αθλητικού",
];

const CONTROLS_EN_TO_EL = {
  "Heat / Cold Protocol": "Πρωτόκολλο Θερμότητας / Ψύχους",
  "Traffic / Course Separation": "Διαχωρισμός Διαδρομής από Οχήματα",
  "Medical Response & AED coverage": "Υγειονομική Υποστήριξη & Κάλυψη AED",
  "Crowd Flow at Start/Finish": "Ροή Πλήθους στην Εκκίνηση/Τερματισμό",
  "Security Screening Perimeter": "Ζώνη Ελέγχου Ασφαλείας",
  "Trail Sweep / Search & Rescue": "Ορεινό Σκούπισμα / Έρευνα & Διάσωση",
};

const INCIDENTS_EN_TO_EL = {
  "Heat illness": "Θερμική Κατάρρευση",
  "Runner collision": "Σύγκρουση Δρομέων",
  "Course confusion": "Λάθος πορεία",
  "Traffic incursion": "Εισβολή Οχήματος",
  "Security concern": "Ζήτημα Ασφάλειας",
  "Lightning / storm": "Κεραυνός / Κακοκαιρία",
  "Trail fall": "Πτώση στο Μονοπάτι",
};

const TEMPLATES_LABELS = {
  roadShort: { en: "Road 5K / 10K", el: "Δρόμος 5K / 10K" },
  roadMarathon: { en: "Road Half / Marathon", el: "Ημιμαραθώνιος / Μαραθώνιος" },
  trailUltra: { en: "Trail / Ultra", el: "Ορεινό / Υπέρ-Αγώνας" },
};

// localStorage helpers
const LS_KEY = "raceSafetyMVP.v4";
const loadLS = () => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
const saveLS = (state) => {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch {}
};

// -----------------------------
// Gauge Component
// -----------------------------
function SafetyGauge({ t, value = 0, lockedRed = false, label, prevValue = null }) {
  const v = clamp(value, 0, 100);
  const displayValue = lockedRed ? 0 : v;

  const startAngle = 180;
  const endAngle = 0;
  const angleRange = startAngle - endAngle;
  const needleAngle = startAngle - (displayValue / 100) * angleRange;

  const segs = [
    { from: 0, to: 59, className: "stroke-red-500" },
    { from: 60, to: 79, className: "stroke-amber-400" },
    { from: 80, to: 100, className: "stroke-emerald-500" },
  ];

  const statusKey = lockedRed || v < 60 ? "notHealthy" : v < 80 ? "watch" : "healthy";
  const status = t(statusKey);

  const trend = prevValue == null ? 0 : v - prevValue;
  const trendLabel = trend > 1 ? t("improving") : trend < -1 ? t("degrading") : t("stable");

  const ticks = Array.from({ length: 11 }, (_, i) => i * 10);

  return (
    <div className="w-full max-w-2xl mx-auto p-4">
      <div className="text-center mb-2">
        <h2 className="text-xl font-semibold tracking-tight">{label}</h2>
        <div className="text-xs text-slate-500">
          {t("trend")}: {trendLabel}
          {trend !== 0 && !lockedRed ? ` (${trend > 0 ? "+" : ""}${Math.round(trend)}%)` : ""}
        </div>
      </div>

      <svg viewBox="0 0 300 190" className="w-full h-auto">
        <path d={describeArc(150, 165, 120, 180, 0)} className="stroke-slate-200" strokeWidth="22" fill="none" />

        {segs.map((s, i) => {
          const a0 = startAngle - (s.from / 100) * angleRange;
          const a1 = startAngle - (s.to / 100) * angleRange;
          return (
            <path
              key={i}
              d={describeArc(150, 165, 120, a0, a1)}
              className={s.className}
              strokeWidth="22"
              fill="none"
              strokeLinecap="round"
            />
          );
        })}

        {ticks.map((tt) => {
          const ang = startAngle - (tt / 100) * angleRange;
          const p1 = polarToCartesian(150, 165, 104, ang);
          const p2 = polarToCartesian(150, 165, 118, ang);
          const labelPos = polarToCartesian(150, 165, 86, ang);
          return (
            <g key={tt}>
              <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} className="stroke-slate-400" strokeWidth={tt % 20 === 0 ? 2 : 1} />
              {tt % 20 === 0 && (
                <text x={labelPos.x} y={labelPos.y} textAnchor="middle" className="fill-slate-500 text-[10px] font-semibold">{tt}</text>
              )}
            </g>
          );
        })}

        <g>
          <line
            x1="150" y1="165"
            x2={polarToCartesian(150, 165, 90, needleAngle).x}
            y2={polarToCartesian(150, 165, 90, needleAngle).y}
            className={lockedRed ? "stroke-red-700" : "stroke-slate-900"}
            strokeWidth="4"
          />
          <circle cx="150" cy="165" r="8" className={lockedRed ? "fill-red-700" : "fill-slate-900"} />
        </g>

        <text x="150" y="118" textAnchor="middle" className="fill-slate-900 text-4xl font-bold">
          {Math.round(v)}%
        </text>

        <text
          x="150" y="145" textAnchor="middle"
          className={`text-base font-semibold ${
            statusKey === "healthy" ? "fill-emerald-600" : statusKey === "watch" ? "fill-amber-600" : "fill-red-600"
          }`}
        >
          {lockedRed ? t("constraintFail") : status}
        </text>
      </svg>

      <div className="text-center text-sm text-slate-600 -mt-2">
        {lockedRed ? t("constraintHint") : t("holisticHint")}
      </div>
    </div>
  );
}

// -----------------------------
// Domains (canonical EN keys)
// -----------------------------
const DOMAINS = DOMAINS_EN;

// -----------------------------
// Roles and visibility (canonical EN keys)
// -----------------------------
const ROLES = ROLES_EN;

const ROLE_DOMAINS = {
  "Race Director": DOMAINS,
  "Operations Lead": ["Organizational", "Operational", "Sports"],
  "Medical Lead": ["Health / Sanitary", "Sports"],
  "Security Lead": ["Security – Threats", "Operational"],
  "PR / Media Lead": ["Public Relations / Publicity"],
  "Finance Lead": ["Financial"],
  "HR / Volunteers Lead": ["Human Resources", "Organizational"],
  "Environmental Lead": ["Environmental"],
  "Legal / Compliance Lead": ["Legal"],
  "Sports / Course Lead": ["Sports", "Operational", "Environmental"],
};

const ROLE_CONTROLS = {
  "Race Director": null,
  "Operations Lead": ["Traffic / Course Separation", "Crowd Flow at Start/Finish"],
  "Medical Lead": ["Heat / Cold Protocol", "Medical Response & AED coverage"],
  "Security Lead": ["Security Screening Perimeter", "Traffic / Course Separation"],
  "PR / Media Lead": [],
  "Finance Lead": [],
  "HR / Volunteers Lead": [],
  "Environmental Lead": ["Heat / Cold Protocol"],
  "Legal / Compliance Lead": [],
  "Sports / Course Lead": ["Trail Sweep / Search & Rescue", "Crowd Flow at Start/Finish"],
};

// -----------------------------
// Race templates (canonical EN hazard/control/constraint keys)
// -----------------------------
const TEMPLATES = {
  roadShort: {
    label: TEMPLATES_LABELS.roadShort.en,
    hazards: [
      { id: "H1", domain: "Health / Sanitary", name: "Heat illness / dehydration", S: 8, O: 4, D: 4, controlsActive: 0.8, weight: 1.3, segmentId: "SEG-START" },
      { id: "H2", domain: "Operational", name: "Course misdirection at junctions", S: 5, O: 4, D: 5, controlsActive: 0.7, weight: 1.0, segmentId: "SEG-2" },
      { id: "H3", domain: "Security – Threats", name: "Unauthorized vehicle access", S: 9, O: 2, D: 6, controlsActive: 0.7, weight: 1.4, segmentId: "SEG-ALL" },
      { id: "H4", domain: "Sports", name: "Runner crowding at start", S: 6, O: 5, D: 3, controlsActive: 0.9, weight: 1.0, segmentId: "SEG-START" },
      { id: "H5", domain: "Environmental", name: "Sudden rain / slippery road", S: 6, O: 3, D: 5, controlsActive: 0.7, weight: 1.0, segmentId: "SEG-3" },
      { id: "H6", domain: "Human Resources", name: "Volunteer no-shows", S: 5, O: 4, D: 4, controlsActive: 0.6, weight: 0.9, segmentId: "SEG-START" },
    ],
    constraints: [
      { id: "S1", statement: "Heat index <= 32°C OR Heat Protocol Level 2 active", critical: true, status: "pass" },
      { id: "S2", statement: "No open vehicle access on any course segment", critical: true, status: "pass" },
      { id: "S3", statement: "AED coverage at start/finish + roving medics", critical: true, status: "pass" },
    ],
    segments: [
      { id: "SEG-START", name: "Start/Finish Zone" },
      { id: "SEG-1", name: "KM 0–1" },
      { id: "SEG-2", name: "KM 1–3" },
      { id: "SEG-3", name: "KM 3–5" },
      { id: "SEG-ALL", name: "Whole course" },
    ],
  },
  roadMarathon: {
    label: TEMPLATES_LABELS.roadMarathon.en,
    hazards: [
      { id: "H1", domain: "Health / Sanitary", name: "Heat illness / dehydration", S: 9, O: 5, D: 4, controlsActive: 0.75, weight: 1.5, segmentId: "SEG-ALL" },
      { id: "H2", domain: "Sports", name: "Cardiac emergency", S: 10, O: 2, D: 7, controlsActive: 0.7, weight: 1.6, segmentId: "SEG-ALL" },
      { id: "H3", domain: "Operational", name: "Water station depletion", S: 8, O: 3, D: 6, controlsActive: 0.7, weight: 1.3, segmentId: "SEG-10" },
      { id: "H4", domain: "Operational", name: "Course misdirection at junctions", S: 6, O: 4, D: 6, controlsActive: 0.7, weight: 1.1, segmentId: "SEG-5" },
      { id: "H5", domain: "Security – Threats", name: "Unauthorized vehicle access", S: 10, O: 2, D: 6, controlsActive: 0.65, weight: 1.5, segmentId: "SEG-ALL" },
      { id: "H6", domain: "Environmental", name: "Lightning / severe storm", S: 10, O: 2, D: 7, controlsActive: 0.7, weight: 1.3, segmentId: "SEG-ALL" },
      { id: "H7", domain: "Human Resources", name: "Volunteer fatigue / shift gaps", S: 6, O: 5, D: 4, controlsActive: 0.6, weight: 1.0, segmentId: "SEG-START" },
    ],
    constraints: [
      { id: "S1", statement: "Heat index <= 30°C OR Start-time adjusted / heat protocol active", critical: true, status: "pass" },
      { id: "S2", statement: "AED spacing <= 1.5km and ALS on course", critical: true, status: "pass" },
      { id: "S3", statement: "No open vehicle access on any course segment", critical: true, status: "pass" },
      { id: "S4", statement: "Water points every <= 3km", critical: true, status: "pass" },
      { id: "S5", statement: "Lightning >10km away", critical: true, status: "pass" },
    ],
    segments: [
      { id: "SEG-START", name: "Start/Finish Zone" },
      { id: "SEG-5", name: "KM 3–7 Junction Cluster" },
      { id: "SEG-10", name: "KM 9–12 Long straight" },
      { id: "SEG-20", name: "KM 18–22 Exposed area" },
      { id: "SEG-ALL", name: "Whole course" },
    ],
  },
  trailUltra: {
    label: TEMPLATES_LABELS.trailUltra.en,
    hazards: [
      { id: "H1", domain: "Sports", name: "Falls on technical terrain", S: 8, O: 5, D: 6, controlsActive: 0.6, weight: 1.4, segmentId: "SEG-TECH" },
      { id: "H2", domain: "Environmental", name: "Rapid weather change (cold/rain)", S: 9, O: 4, D: 7, controlsActive: 0.6, weight: 1.5, segmentId: "SEG-RIDGE" },
      { id: "H3", domain: "Operational", name: "Runner lost off-course", S: 9, O: 3, D: 7, controlsActive: 0.65, weight: 1.4, segmentId: "SEG-ALL" },
      { id: "H4", domain: "Health / Sanitary", name: "Hypothermia / dehydration", S: 9, O: 4, D: 6, controlsActive: 0.6, weight: 1.5, segmentId: "SEG-ALL" },
      { id: "H5", domain: "Security – Threats", name: "Delayed rescue access", S: 9, O: 3, D: 8, controlsActive: 0.55, weight: 1.6, segmentId: "SEG-REMOTE" },
      { id: "H6", domain: "Human Resources", name: "Aid station understaffing", S: 7, O: 4, D: 5, controlsActive: 0.6, weight: 1.2, segmentId: "SEG-AID" },
    ],
    constraints: [
      { id: "S1", statement: "Sweep team contact interval <= 30 min", critical: true, status: "pass" },
      { id: "S2", statement: "Mandatory gear check active", critical: true, status: "pass" },
      { id: "S3", statement: "Comms coverage on all segments", critical: true, status: "pass" },
      { id: "S4", statement: "Lightning / storm thresholds respected", critical: true, status: "pass" },
    ],
    segments: [
      { id: "SEG-START", name: "Start/Finish Zone" },
      { id: "SEG-TECH", name: "Technical descent" },
      { id: "SEG-RIDGE", name: "Exposed ridge" },
      { id: "SEG-REMOTE", name: "Remote valley" },
      { id: "SEG-AID", name: "Aid Stations" },
      { id: "SEG-ALL", name: "Whole course" },
    ],
  },
};

const INITIAL_CONTROLS = [
  { id: "C1", name: "Heat / Cold Protocol", readiness: 0.7, ucaCount: 1 },
  { id: "C2", name: "Traffic / Course Separation", readiness: 0.8, ucaCount: 0 },
  { id: "C3", name: "Medical Response & AED coverage", readiness: 0.75, ucaCount: 1 },
  { id: "C4", name: "Crowd Flow at Start/Finish", readiness: 0.85, ucaCount: 0 },
  { id: "C5", name: "Security Screening Perimeter", readiness: 0.6, ucaCount: 2 },
  { id: "C6", name: "Trail Sweep / Search & Rescue", readiness: 0.65, ucaCount: 1 },
];

const INITIAL_READINESS = DOMAINS.reduce((acc, d) => {
  acc[d] = 0.75;
  return acc;
}, {});

// -----------------------------
// Scoring Engine
// -----------------------------
// (rest identical to above; already included)
// -----------------------------

// -----------------------------
// Main App
// -----------------------------
// (rest identical to above; already included)
// -----------------------------
export default RaceSafetyMVP;
