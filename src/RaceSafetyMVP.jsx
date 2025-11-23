import React, { useMemo, useState, useEffect } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * Race Safety Health Web MVP v4 (full working component)
 * EMBOK × FMEA × STPA/STAMP
 * Features:
 * - Bilingual EN/GR toggle (simple i18n)
 * - Templates (roadShort / roadMarathon / trailUltra)
 * - Roles view (domains + controls visibility)
 * - Hazards with FMEA residual RPN
 * - Controls health with UCA penalties
 * - Critical constraints gate (STAMP)
 * - Readiness sliders per domain (EMBOK)
 * - Course segments (zones) filter
 * - Incident quick log that increases Occurrence (O)
 * - LocalStorage persistence
 * - PDF export
 *
 * Tailwind assumed.
 * npm i jspdf jspdf-autotable
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
// Domains / Roles / Visibility
// -----------------------------
const DOMAINS = DOMAINS_EN;
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
// Templates
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
function calcHazardResidualRPN(h) {
  // base RPN = S*O*D, reduced by controlsActive (0..1)
  const base = h.S * h.O * h.D;
  const reduction = clamp(h.controlsActive ?? 0.7, 0, 1);
  const residual = base * (1 - reduction);
  return residual;
}

function calcRiskLoad(hazards) {
  // Weighted normalized risk (0..100)
  if (!hazards.length) return 0;
  const weightedResiduals = hazards.map((h) => calcHazardResidualRPN(h) * (h.weight ?? 1));
  // Rough max per hazard (10*10*10=1000) then after controls ~1000
  const maxPerHazard = 1000;
  const maxTotal = maxPerHazard * hazards.length;
  const ratio = sum(weightedResiduals) / maxTotal;
  // translate to "health": high risk -> low health
  return clamp((1 - ratio) * 100, 0, 100);
}

function calcControlsHealth(controls) {
  if (!controls.length) return 0;
  const penalties = controls.map((c) => clamp(c.readiness - 0.1 * (c.ucaCount ?? 0), 0, 1));
  return clamp(avg(penalties) * 100, 0, 100);
}

function calcReadinessScore(readinessByDomain, visibleDomains) {
  const vals = visibleDomains.map((d) => readinessByDomain[d] ?? 0.75);
  return clamp(avg(vals) * 100, 0, 100);
}

function calcHolisticHealth({ riskLoad, controlsHealth, readinessScore }) {
  // simple balanced average
  return clamp(avg([riskLoad, controlsHealth, readinessScore]), 0, 100);
}

function anyCriticalConstraintFail(constraints) {
  return constraints.some((c) => c.critical && c.status === "fail");
}

// -----------------------------
// Main Component
// -----------------------------
function RaceSafetyMVP() {
  const persisted = loadLS();

  const [lang, setLang] = useState(persisted?.lang || "en");
  const t = (key) => I18N[lang][key] ?? key;

  const [templateKey, setTemplateKey] = useState(persisted?.templateKey || "roadShort");
  const template = TEMPLATES[templateKey];

  const [role, setRole] = useState(persisted?.role || "Race Director");

  const [hazards, setHazards] = useState(persisted?.hazards || template.hazards);
  const [controls, setControls] = useState(persisted?.controls || INITIAL_CONTROLS);
  const [constraints, setConstraints] = useState(persisted?.constraints || template.constraints);
  const [segments, setSegments] = useState(persisted?.segments || template.segments);
  const [readinessByDomain, setReadinessByDomain] = useState(persisted?.readinessByDomain || INITIAL_READINESS);

  const [segmentFilter, setSegmentFilter] = useState(persisted?.segmentFilter || null);
  const [domainFilter, setDomainFilter] = useState(persisted?.domainFilter || null);

  const [notesByHazard, setNotesByHazard] = useState(persisted?.notesByHazard || {});
  const [incidents, setIncidents] = useState(persisted?.incidents || []);

  // when template changes, reset data to template defaults
  useEffect(() => {
    const tpl = TEMPLATES[templateKey];
    setHazards(tpl.hazards);
    setConstraints(tpl.constraints);
    setSegments(tpl.segments);
    setSegmentFilter(null);
    setDomainFilter(null);
  }, [templateKey]);

  // persist
  useEffect(() => {
    saveLS({
      lang,
      templateKey,
      role,
      hazards,
      controls,
      constraints,
      segments,
      segmentFilter,
      domainFilter,
      readinessByDomain,
      notesByHazard,
      incidents,
    });
  }, [
    lang,
    templateKey,
    role,
    hazards,
    controls,
    constraints,
    segments,
    segmentFilter,
    domainFilter,
    readinessByDomain,
    notesByHazard,
    incidents,
  ]);

  // role visibility
  const visibleDomains = ROLE_DOMAINS[role] || DOMAINS;
  const visibleControls = ROLE_CONTROLS[role]; // null = all, [] = none

  const hazardsFiltered = useMemo(() => {
    return hazards.filter((h) => {
      if (domainFilter && h.domain !== domainFilter) return false;
      if (segmentFilter && h.segmentId !== segmentFilter && h.segmentId !== "SEG-ALL") return false;
      if (!visibleDomains.includes(h.domain)) return false;
      return true;
    });
  }, [hazards, domainFilter, segmentFilter, visibleDomains]);

  const controlsFiltered = useMemo(() => {
    if (visibleControls == null) return controls;
    return controls.filter((c) => visibleControls.includes(c.name));
  }, [controls, visibleControls]);

  // scores
  const riskLoad = useMemo(() => calcRiskLoad(hazardsFiltered), [hazardsFiltered]);
  const controlsHealth = useMemo(() => calcControlsHealth(controlsFiltered), [controlsFiltered]);
  const readinessScore = useMemo(
    () => calcReadinessScore(readinessByDomain, visibleDomains),
    [readinessByDomain, visibleDomains]
  );

  const holistic = useMemo(
    () => calcHolisticHealth({ riskLoad, controlsHealth, readinessScore }),
    [riskLoad, controlsHealth, readinessScore]
  );

  const lockedRed = anyCriticalConstraintFail(constraints);

  const prevHolistic = persisted?.prevHolistic ?? null;
  useEffect(() => {
    // store last holistic for trend
    saveLS({ ...(loadLS() || {}), prevHolistic: holistic });
  }, [holistic]);

  // helpers
  const domainLabel = (d) => (lang === "el" ? DOMAINS_EL[DOMAINS_EN.indexOf(d)] || d : d);
  const roleLabel = (r) => (lang === "el" ? ROLES_EL[ROLES_EN.indexOf(r)] || r : r);
  const controlLabel = (cname) => (lang === "el" ? CONTROLS_EN_TO_EL[cname] || cname : cname);

  const segmentLabel = (sid) => segments.find((s) => s.id === sid)?.name || sid;

  // update hazard fields
  const updateHazard = (id, patch) => {
    setHazards((hs) => hs.map((h) => (h.id === id ? { ...h, ...patch } : h)));
  };

  // incident logging
  const incidentTypesEn = Object.keys(INCIDENTS_EN_TO_EL);
  const [incidentType, setIncidentType] = useState(incidentTypesEn[0]);
  const [incidentHazardId, setIncidentHazardId] = useState(hazards[0]?.id || "");
  const [incidentNotes, setIncidentNotes] = useState("");

  const logIncident = () => {
    if (!incidentHazardId) return;
    const ts = new Date().toISOString();
    const incident = {
      id: `I-${ts}`,
      type: incidentType,
      hazardId: incidentHazardId,
      notes: incidentNotes.trim(),
      ts,
    };
    setIncidents((xs) => [incident, ...xs].slice(0, 50));

    // increase occurrence (O) for linked hazard by 1 up to 10
    setHazards((hs) =>
      hs.map((h) =>
        h.id === incidentHazardId ? { ...h, O: clamp((h.O || 1) + 1, 1, 10) } : h
      )
    );

    setIncidentNotes("");
  };

  // PDF export
  const exportPdf = () => {
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text(`${I18N[lang].appTitle} — ${template.label}`, 14, 16);
    doc.setFontSize(10);
    doc.text(`${I18N[lang].subtitle}`, 14, 22);
    doc.text(`Role: ${roleLabel(role)}`, 14, 28);
    doc.text(`Holistic Health: ${Math.round(holistic)}%`, 14, 34);

    // Constraints
    doc.setFontSize(12);
    doc.text(I18N[lang].constraintsTitle, 14, 44);

    autoTable(doc, {
      startY: 48,
      head: [[
        "ID",
        lang === "el" ? "Περιορισμός" : "Constraint",
        lang === "el" ? "Κρίσιμο" : "Critical",
        lang === "el" ? "Κατάσταση" : "Status"
      ]],
      body: constraints.map((c) => [
        c.id,
        c.statement,
        c.critical ? "YES" : "NO",
        lang === "el" ? I18N.el[c.status] : c.status,
      ]),
      styles: { fontSize: 8 },
    });

    // Hazards
    const yAfterConstraints = doc.lastAutoTable.finalY + 8;
    doc.setFontSize(12);
    doc.text(I18N[lang].hazardsTitle, 14, yAfterConstraints);

    autoTable(doc, {
      startY: yAfterConstraints + 4,
      head: [[
        "ID",
        I18N[lang].domain,
        I18N[lang].hazard,
        I18N[lang].segment,
        "S",
        "O",
        "D",
        I18N[lang].controlsActive,
        I18N[lang].residualRpn
      ]],
      body: hazardsFiltered.map((h) => [
        h.id,
        domainLabel(h.domain),
        h.name,
        segmentLabel(h.segmentId),
        h.S,
        h.O,
        h.D,
        Math.round((h.controlsActive ?? 0) * 100) + "%",
        Math.round(calcHazardResidualRPN(h)),
      ]),
      styles: { fontSize: 7 },
    });

    doc.save("race-safety-mvp.pdf");
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">
              {t("appTitle")}
            </h1>
            <p className="text-xs md:text-sm text-slate-500">{t("subtitle")}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Language */}
            <div className="flex rounded-xl border border-slate-200 overflow-hidden">
              {LANGS.map((l) => (
                <button
                  key={l.code}
                  onClick={() => setLang(l.code)}
                  className={`px-3 py-1 text-sm font-semibold ${
                    lang === l.code ? "bg-slate-900 text-white" : "bg-white text-slate-700"
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>

            {/* Template */}
            <select
              value={templateKey}
              onChange={(e) => setTemplateKey(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
              title={t("template")}
            >
              {Object.entries(TEMPLATES).map(([k, v]) => (
                <option key={k} value={k}>
                  {lang === "el" ? TEMPLATES_LABELS[k].el : v.label}
                </option>
              ))}
            </select>

            {/* Role */}
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
              title={t("roleView")}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </select>

            {/* Clear filters */}
            <button
              onClick={() => {
                setDomainFilter(null);
                setSegmentFilter(null);
              }}
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white hover:bg-slate-100"
            >
              {t("clearFilters")}
            </button>

            {/* Export */}
            <button
              onClick={exportPdf}
              className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700"
            >
              {t("exportPdf")}
            </button>
          </div>
        </div>
      </header>

      {/* Gauge */}
      <section className="max-w-6xl mx-auto px-4 py-4">
        <SafetyGauge
          t={t}
          value={holistic}
          lockedRed={lockedRed}
          label={t("gaugeLabel")}
          prevValue={prevHolistic}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
          <KpiCard title={t("riskLoad")} value={`${Math.round(riskLoad)}%`} hint={t("hazardsHint")} />
          <KpiCard title={t("controlHealth")} value={`${Math.round(controlsHealth)}%`} hint={t("controlsHint")} />
          <KpiCard title={t("readiness")} value={`${Math.round(readinessScore)}%`} hint={t("readinessHint")} />
        </div>
      </section>

      {/* Segments */}
      <section className="max-w-6xl mx-auto px-4 py-4">
        <SectionHeader title={t("segmentsTitle")} hint={t("segmentsHint")} />
        <div className="flex flex-wrap gap-2">
          {segments.map((s) => (
            <button
              key={s.id}
              onClick={() => setSegmentFilter((cur) => (cur === s.id ? null : s.id))}
              className={`px-3 py-1.5 rounded-full text-sm border ${
                segmentFilter === s.id
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white border-slate-200 text-slate-700"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      </section>

      {/* Domains + Readiness */}
      <section className="max-w-6xl mx-auto px-4 py-4">
        <SectionHeader title={t("readinessTitle")} hint={t("readinessHint")} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {visibleDomains.map((d) => (
            <div key={d} className="bg-white rounded-2xl border border-slate-200 p-3">
              <div className="flex items-center justify-between mb-2">
                <button
                  onClick={() => setDomainFilter((cur) => (cur === d ? null : d))}
                  className={`text-sm font-semibold px-2 py-1 rounded-lg ${
                    domainFilter === d ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-800"
                  }`}
                  title={t("tapInspect")}
                >
                  {domainLabel(d)}
                </button>
                <div className="text-xs text-slate-500">
                  {t("readinessShort")}: {Math.round((readinessByDomain[d] ?? 0) * 100)}%
                </div>
              </div>

              <input
                type="range"
                min={0}
                max={100}
                value={Math.round((readinessByDomain[d] ?? 0.75) * 100)}
                onChange={(e) =>
                  setReadinessByDomain((rb) => ({
                    ...rb,
                    [d]: clamp(Number(e.target.value) / 100, 0, 1),
                  }))
                }
                className="w-full"
              />
            </div>
          ))}
        </div>
      </section>

      {/* Hazards */}
      <section className="max-w-6xl mx-auto px-4 py-4">
        <SectionHeader title={t("hazardsTitle")} hint={t("hazardsHint")} />

        <div className="grid grid-cols-1 gap-3">
          {hazardsFiltered.map((h) => {
            const residual = Math.round(calcHazardResidualRPN(h));
            const base = h.S * h.O * h.D;
            const residualPct = clamp((residual / base) * 100, 0, 100);

            return (
              <div key={h.id} className="bg-white rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <div>
                    <div className="text-xs text-slate-500">
                      {t("domain")}: {domainLabel(h.domain)} • {t("segment")}: {segmentLabel(h.segmentId)}
                    </div>
                    <div className="text-base font-semibold">
                      {h.id} — {h.name}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <Badge label={`RPN ${residual}`} tone={residual < 120 ? "green" : residual < 220 ? "amber" : "red"} />
                    <Badge label={`${t("controlsActive")}: ${Math.round((h.controlsActive ?? 0) * 100)}%`} tone="slate" />
                  </div>
                </div>

                {/* sliders */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3">
                  <ScaleSlider
                    label={t("s")}
                    value={h.S}
                    onChange={(v) => updateHazard(h.id, { S: v })}
                  />
                  <ScaleSlider
                    label={t("o")}
                    value={h.O}
                    onChange={(v) => updateHazard(h.id, { O: v })}
                  />
                  <ScaleSlider
                    label={t("d")}
                    value={h.D}
                    onChange={(v) => updateHazard(h.id, { D: v })}
                  />
                  <PercentSlider
                    label={t("controlsActive")}
                    value={Math.round((h.controlsActive ?? 0.7) * 100)}
                    onChange={(v) => updateHazard(h.id, { controlsActive: v / 100 })}
                  />
                </div>

                {/* residual bar */}
                <div className="mt-3">
                  <div className="text-xs text-slate-500 mb-1">
                    {t("residualRpn")}: {residual} ({Math.round(residualPct)}% of base)
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-2 ${
                        residualPct < 35 ? "bg-emerald-500" : residualPct < 60 ? "bg-amber-400" : "bg-red-500"
                      }`}
                      style={{ width: `${residualPct}%` }}
                    />
                  </div>
                </div>

                {/* notes */}
                <div className="mt-3">
                  <textarea
                    value={notesByHazard[h.id] || ""}
                    onChange={(e) =>
                      setNotesByHazard((nbh) => ({ ...nbh, [h.id]: e.target.value }))
                    }
                    rows={2}
                    placeholder={t("notesPlaceholder")}
                    className="w-full text-sm p-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Controls */}
      <section className="max-w-6xl mx-auto px-4 py-4">
        <SectionHeader title={t("controlsTitle")} hint={t("controlsHint")} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {controlsFiltered.map((c) => {
            const health = clamp(c.readiness - 0.1 * (c.ucaCount ?? 0), 0, 1);
            return (
              <div key={c.id} className="bg-white rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">{controlLabel(c.name)}</div>
                  <Badge
                    label={`${Math.round(health * 100)}%`}
                    tone={health >= 0.8 ? "green" : health >= 0.6 ? "amber" : "red"}
                  />
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <PercentSlider
                    label={t("readinessShort")}
                    value={Math.round((c.readiness ?? 0.7) * 100)}
                    onChange={(v) =>
                      setControls((cs) =>
                        cs.map((x) => (x.id === c.id ? { ...x, readiness: v / 100 } : x))
                      )
                    }
                  />

                  <ScaleSlider
                    label={t("ucaCount")}
                    value={c.ucaCount ?? 0}
                    min={0}
                    max={5}
                    onChange={(v) =>
                      setControls((cs) =>
                        cs.map((x) => (x.id === c.id ? { ...x, ucaCount: v } : x))
                      )
                    }
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Constraints */}
      <section className="max-w-6xl mx-auto px-4 py-4">
        <SectionHeader title={t("constraintsTitle")} hint={t("constraintsHint")} />

        <div className="grid grid-cols-1 gap-3">
          {constraints.map((c) => (
            <div key={c.id} className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">
                  {c.id} — {c.statement}
                </div>
                {c.critical && (
                  <div className="text-xs text-red-600 font-semibold mt-1">
                    CRITICAL
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {["pass", "warn", "fail"].map((st) => (
                  <button
                    key={st}
                    onClick={() =>
                      setConstraints((cs) =>
                        cs.map((x) => (x.id === c.id ? { ...x, status: st } : x))
                      )
                    }
                    className={`px-3 py-1 rounded-full text-sm font-semibold border ${
                      c.status === st
                        ? st === "pass"
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : st === "warn"
                          ? "bg-amber-400 text-black border-amber-400"
                          : "bg-red-600 text-white border-red-600"
                        : "bg-white border-slate-200 text-slate-700"
                    }`}
                  >
                    {lang === "el" ? I18N.el[st] : st}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Incidents */}
      <section className="max-w-6xl mx-auto px-4 py-4">
        <SectionHeader title={t("incidentLogTitle")} hint={t("incidentLogHint")} />

        <div className="bg-white rounded-2xl border border-slate-200 p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <select
            value={incidentType}
            onChange={(e) => setIncidentType(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
          >
            {incidentTypesEn.map((it) => (
              <option key={it} value={it}>
                {lang === "el" ? INCIDENTS_EN_TO_EL[it] : it}
              </option>
            ))}
          </select>

          <select
            value={incidentHazardId}
            onChange={(e) => setIncidentHazardId(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
          >
            {hazards.map((h) => (
              <option key={h.id} value={h.id}>
                {h.id} — {h.name}
              </option>
            ))}
          </select>

          <input
            value={incidentNotes}
            onChange={(e) => setIncidentNotes(e.target.value)}
            placeholder={t("notesPlaceholder")}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white md:col-span-1"
          />

          <button
            onClick={logIncident}
            className="px-3 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800"
          >
            {t("logIncident")}
          </button>
        </div>

        <div className="mt-3 bg-white rounded-2xl border border-slate-200 p-4">
          <div className="text-sm font-semibold mb-2">{t("recentIncidents")}</div>
          {incidents.length === 0 ? (
            <div className="text-sm text-slate-500">{t("noIncidents")}</div>
          ) : (
            <ul className="space-y-2">
              {incidents.map((i) => (
                <li key={i.id} className="text-sm flex flex-col md:flex-row md:items-center md:justify-between gap-1 border-b last:border-b-0 pb-2">
                  <div>
                    <span className="font-semibold">
                      {lang === "el" ? INCIDENTS_EN_TO_EL[i.type] : i.type}
                    </span>{" "}
                    → {i.hazardId} ({hazards.find((h) => h.id === i.hazardId)?.name})
                    {i.notes ? <div className="text-xs text-slate-600 mt-0.5">📝 {i.notes}</div> : null}
                  </div>
                  <div className="text-xs text-slate-500">
                    {new Date(i.ts).toLocaleString()}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-4 py-8 text-xs text-slate-500">
        {t("mvpFooter")}
      </footer>
    </div>
  );
}

// -----------------------------
// Small UI helpers
// -----------------------------
function SectionHeader({ title, hint }) {
  return (
    <div className="mb-2">
      <h3 className="text-lg font-semibold">{title}</h3>
      {hint && <div className="text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

function KpiCard({ title, value, hint }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <div className="text-sm font-semibold">{title}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {hint && <div className="text-xs text-slate-500 mt-1">{hint}</div>}
    </div>
  );
}

function Badge({ label, tone = "slate" }) {
  const tones = {
    green: "bg-emerald-100 text-emerald-800 border-emerald-200",
    amber: "bg-amber-100 text-amber-900 border-amber-200",
    red: "bg-red-100 text-red-800 border-red-200",
    slate: "bg-slate-100 text-slate-800 border-slate-200",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${tones[tone] || tones.slate}`}>
      {label}
    </span>
  );
}

function ScaleSlider({ label, value, onChange, min = 1, max = 10 }) {
  return (
    <div className="bg-slate-50 rounded-xl p-2 border border-slate-200">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold">{label}</span>
        <span className="text-slate-600">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full mt-1"
      />
    </div>
  );
}

function PercentSlider({ label, value, onChange }) {
  return (
    <div className="bg-slate-50 rounded-xl p-2 border border-slate-200">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold">{label}</span>
        <span className="text-slate-600">{value}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full mt-1"
      />
    </div>
  );
}

export default RaceSafetyMVP;
