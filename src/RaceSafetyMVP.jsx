import React, { useMemo, useState, useEffect } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * Race Safety Health Web — v4.1 (extended scoring)
 * - Bilingual EN/GR
 * - Templates: Road 5/10K, Half/Marathon, Trail/Ultra
 * - Role-based views
 * - Course segments filtering
 * - FMEA hazards (S/O/D + controlsActive) with Residual RPN
 * - STPA controls (readiness + UCA penalties)
 * - STAMP critical constraints
 * - Incident log increases Occurrence
 * - NEW: Readiness sub-criteria per domain (manual scoring)
 * - NEW: Classic fuel-gauge style (thin arc, no rounded caps)
 *
 * Drop into /src as RaceSafetyMVP.jsx and import in App.jsx.
 */

// -----------------------------
// Utilities
// -----------------------------
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const sum = (arr) => arr.reduce((a, b) => a + b, 0);
const avg = (arr) => (arr.length ? sum(arr) / arr.length : 0);
const pct = (x) => Math.round(clamp(x * 100, 0, 100));

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
const LANGS = [{ code: "en", label: "EN" }, { code: "el", label: "GR" }];

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
    domainsHint: "Score sub-criteria to set readiness",
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
    addNote: "Add note",
    subCriteria: "Sub‑criteria",
    mvpFooter: "v4.1 — extended readiness scoring, PDF export, persistence, segments, bilingual UI.",
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
    domainsHint: "Βαθμολόγησε υπο‑κριτήρια",
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
    addNote: "Προσθήκη σημείωσης",
    subCriteria: "Υπο‑κριτήρια",
    mvpFooter: "v4.1 — αναλυτική βαθμολόγηση ετοιμότητας, PDF, αποθήκευση, ζώνες, δίγλωσσο UI.",
  },
};

// -----------------------------
// Labels / Canonical EN keys
// -----------------------------
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

// -----------------------------
// Readiness sub-criteria (manual scoring)
// Each criterion has weight (default 1)
// -----------------------------
const READINESS_CRITERIA = {
  "Financial": [
    { id: "budget", en: "Budget secured", el: "Εξασφαλισμένος προϋπολογισμός" },
    { id: "sponsors", en: "Sponsors/contracts signed", el: "Συμφωνίες χορηγών/συμβάσεων" },
    { id: "cashflow", en: "Cashflow / payments plan", el: "Ρευστότητα / πλάνο πληρωμών" },
  ],
  "Organizational": [
    { id: "plan", en: "Operational plan complete", el: "Ολοκληρωμένο επιχειρησιακό σχέδιο" },
    { id: "comms", en: "Internal comms structure", el: "Δομή εσωτερικής επικοινωνίας" },
    { id: "briefings", en: "Staff/volunteer briefings", el: "Briefings προσωπικού/εθελοντών" },
  ],
  "Health / Sanitary": [
    { id: "medicalPlan", en: "Medical plan approved", el: "Εγκεκριμένο υγειονομικό σχέδιο" },
    { id: "aed", en: "AED coverage ready", el: "Έτοιμη κάλυψη AED" },
    { id: "hydration", en: "Hydration/heat plan", el: "Πλάνο ενυδάτωσης/ζέστης" },
  ],
  "Legal": [
    { id: "permits", en: "All permits issued", el: "Έχουν εκδοθεί οι άδειες" },
    { id: "insurance", en: "Insurance active", el: "Ενεργή ασφάλιση" },
    { id: "waivers", en: "Waivers/rules published", el: "Κανονισμοί/δηλώσεις συμμετοχής" },
  ],
  "Operational": [
    { id: "traffic", en: "Traffic plan & closures", el: "Σχέδιο κυκλοφορίας/κλεισίματα" },
    { id: "vendors", en: "Vendors confirmed", el: "Επιβεβαίωση προμηθευτών" },
    { id: "logistics", en: "Logistics ready", el: "Logistics έτοιμα" },
    { id: "signage", en: "Signage & wayfinding", el: "Σήμανση/καθοδήγηση" },
  ],
  "Sports": [
    { id: "courseCert", en: "Course measured/certified", el: "Μετρημένη/πιστοποιημένη διαδρομή" },
    { id: "timing", en: "Timing/results provider ready", el: "Έτοιμος πάροχος χρονομέτρησης" },
    { id: "stations", en: "Aid stations plan", el: "Πλάνο σταθμών υποστήριξης" },
  ],
  "Public Relations / Publicity": [
    { id: "mediaPlan", en: "Media plan ready", el: "Έτοιμο media plan" },
    { id: "crisis", en: "Crisis comms prepared", el: "Πλάνο επικοινωνίας κρίσης" },
    { id: "athleteInfo", en: "Athlete info sent", el: "Ενημέρωση αθλητών" },
  ],
  "Human Resources": [
    { id: "staffing", en: "Staffing complete", el: "Ολοκληρωμένη στελέχωση" },
    { id: "volunteers", en: "Volunteers recruited", el: "Στρατολόγηση εθελοντών" },
    { id: "training", en: "Training delivered", el: "Δόθηκαν εκπαιδεύσεις" },
  ],
  "Environmental": [
    { id: "waste", en: "Waste plan", el: "Πλάνο απορριμμάτων" },
    { id: "trailProtect", en: "Course protection", el: "Προστασία διαδρομής" },
    { id: "weather", en: "Weather monitoring", el: "Παρακολούθηση καιρού" },
  ],
  "Security – Threats": [
    { id: "riskAssess", en: "Threat assessment", el: "Αξιολόγηση απειλών" },
    { id: "perimeter", en: "Security perimeter", el: "Ζώνες ασφαλείας" },
    { id: "response", en: "Incident response ready", el: "Ετοιμότητα αντίδρασης" },
  ],
};

// -----------------------------
// Roles visibility
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

// STPA controls
const INITIAL_CONTROLS = [
  { id: "C1", name: "Heat / Cold Protocol", readiness: 0.7, ucaCount: 1 },
  { id: "C2", name: "Traffic / Course Separation", readiness: 0.8, ucaCount: 0 },
  { id: "C3", name: "Medical Response & AED coverage", readiness: 0.75, ucaCount: 1 },
  { id: "C4", name: "Crowd Flow at Start/Finish", readiness: 0.85, ucaCount: 0 },
  { id: "C5", name: "Security Screening Perimeter", readiness: 0.6, ucaCount: 2 },
  { id: "C6", name: "Trail Sweep / Search & Rescue", readiness: 0.65, ucaCount: 1 },
];

// -----------------------------
// Persistence
// -----------------------------
const LS_KEY = "raceSafetyMVP.v41";
const loadLS = () => {
  try { const raw = localStorage.getItem(LS_KEY); return raw ? JSON.parse(raw) : null; }
  catch { return null; }
};
const saveLS = (state) => {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch {}
};

// -----------------------------
// Fuel Gauge Component
// -----------------------------
function SafetyGauge({ t, value = 0, lockedRed = false, label, prevValue = null }) {
  const v = clamp(value, 0, 100);
  const displayValue = lockedRed ? 0 : v;

  const startAngle = 180;
  const endAngle = 0;
  const angleRange = startAngle - endAngle;
  const needleAngle = startAngle - (displayValue / 100) * angleRange;

  const segs = [
    { from: 0, to: 49, className: "stroke-red-500" },
    { from: 50, to: 74, className: "stroke-amber-400" },
    { from: 75, to: 100, className: "stroke-emerald-500" },
  ];

  const statusKey = lockedRed || v < 50 ? "notHealthy" : v < 75 ? "watch" : "healthy";
  const status = t(statusKey);

  const trend = prevValue == null ? 0 : v - prevValue;
  const trendLabel = trend > 1 ? t("improving") : trend < -1 ? t("degrading") : t("stable");

  const ticks = Array.from({ length: 11 }, (_, i) => i * 10);

  return (
    <div className="w-full max-w-3xl mx-auto p-4">
      <div className="text-center mb-2">
        <h2 className="text-xl font-semibold tracking-tight">{label}</h2>
        <div className="text-xs text-slate-500">
          {t("trend")}: {trendLabel}
          {trend !== 0 && !lockedRed ? ` (${trend > 0 ? "+" : ""}${Math.round(trend)}%)` : ""}
        </div>
      </div>

      <svg viewBox="0 0 300 190" className="w-full h-auto">
        {/* background arc */}
        <path d={describeArc(150, 165, 120, 180, 0)} className="stroke-slate-200" strokeWidth="14" fill="none" />

        {/* colored segments */}
        {segs.map((s, i) => {
          const a0 = startAngle - (s.from / 100) * angleRange;
          const a1 = startAngle - (s.to / 100) * angleRange;
          return (
            <path
              key={i}
              d={describeArc(150, 165, 120, a0, a1)}
              className={s.className}
              strokeWidth="14"
              fill="none"
            />
          );
        })}

        {/* ticks */}
        {ticks.map((tt) => {
          const ang = startAngle - (tt / 100) * angleRange;
          const p1 = polarToCartesian(150, 165, 106, ang);
          const p2 = polarToCartesian(150, 165, 120, ang);
          const labelPos = polarToCartesian(150, 165, 88, ang);
          return (
            <g key={tt}>
              <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} className="stroke-slate-400" strokeWidth={tt % 20 === 0 ? 2 : 1} />
              {tt % 20 === 0 && (
                <text x={labelPos.x} y={labelPos.y} textAnchor="middle" className="fill-slate-500 text-[10px] font-semibold">
                  {tt}
                </text>
              )}
            </g>
          );
        })}

        {/* needle */}
        <g>
          <line
            x1="150" y1="165"
            x2={polarToCartesian(150, 165, 92, needleAngle).x}
            y2={polarToCartesian(150, 165, 92, needleAngle).y}
            className={lockedRed ? "stroke-red-700" : "stroke-slate-900"}
            strokeWidth="4"
          />
          <circle cx="150" cy="165" r="8" className={lockedRed ? "fill-red-700" : "fill-slate-900"} />
        </g>

        <text x="150" y="118" textAnchor="middle" className="fill-slate-900 text-4xl font-bold">
          {Math.round(v)}%
        </text>

        <text x="150" y="145" textAnchor="middle"
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
// Scoring Engine
// -----------------------------
function residualRpn(h) {
  const base = h.S * h.O * h.D;
  return base * (1 - clamp(h.controlsActive, 0, 1)) * (h.weight ?? 1);
}
function domainRiskScore(hazards, domain) {
  const hs = hazards.filter((h) => h.domain === domain);
  if (!hs.length) return 0;
  const rpnVals = hs.map(residualRpn);
  return avg(rpnVals);
}
function normalizeRiskToPct(risk) {
  // typical RPN max is 10*10*10=1000; scale to 0-100
  return clamp(risk / 10, 0, 100);
}
function controlHealthPct(controls) {
  if (!controls.length) return 100;
  const adjusted = controls.map((c) => clamp(c.readiness - c.ucaCount * 0.06, 0, 1));
  return pct(avg(adjusted));
}
function readinessFromCriteria(criteriaMap, criteriaValues) {
  // returns readiness per domain (0..1) as weighted average of sub-criteria
  const out = {};
  DOMAINS.forEach((d) => {
    const crits = criteriaMap[d] || [];
    if (!crits.length) { out[d] = 0.75; return; }
    const vals = crits.map((c) => {
      const v = criteriaValues?.[d]?.[c.id];
      return typeof v === "number" ? v : 0.75;
    });
    out[d] = avg(vals);
  });
  return out;
}

// -----------------------------
// PDF Export
// -----------------------------
function exportPdf({ t, lang, templateLabel, roleLabel, hazards, controls, constraints, readiness, incidents }) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(`${t("appTitle")} — ${templateLabel}`, 14, 16);
  doc.setFontSize(11);
  doc.text(`${t("roleView")}: ${roleLabel}`, 14, 24);

  // Readiness table
  autoTable(doc, {
    startY: 30,
    head: [[t("domain"), t("readinessShort") + " %"]],
    body: DOMAINS.map((d, i) => [
      lang === "el" ? DOMAINS_EL[i] : d,
      pct(readiness[d]),
    ]),
  });

  // Hazards table
  const hazY = (doc.lastAutoTable?.finalY ?? 30) + 8;
  autoTable(doc, {
    startY: hazY,
    head: [[t("hazard"), t("domain"), t("segment"), t("s"), t("o"), t("d"), t("controlsActive"), t("residualRpn")]],
    body: hazards.map((h) => [
      h.name,
      h.domain,
      h.segmentId,
      h.S,
      h.O,
      h.D,
      Math.round(h.controlsActive * 100) + "%",
      Math.round(residualRpn(h)),
    ]),
  });

  // Controls table
  const ctrlY = (doc.lastAutoTable?.finalY ?? hazY) + 8;
  autoTable(doc, {
    startY: ctrlY,
    head: [[t("controlsTitle"), t("readinessShort") + " %", t("ucaCount")]],
    body: controls.map((c) => [
      lang === "el" ? (CONTROLS_EN_TO_EL[c.name] || c.name) : c.name,
      pct(c.readiness),
      c.ucaCount,
    ]),
  });

  // Constraints
  const consY = (doc.lastAutoTable?.finalY ?? ctrlY) + 8;
  autoTable(doc, {
    startY: consY,
    head: [[t("constraintsTitle"), "Critical", "Status"]],
    body: constraints.map((s) => [s.statement, s.critical ? "yes" : "no", s.status]),
  });

  // Incidents
  const incY = (doc.lastAutoTable?.finalY ?? consY) + 8;
  autoTable(doc, {
    startY: incY,
    head: [[t("incidentLogTitle"), "Linked hazard", "Time"]],
    body: incidents.map((x) => [x.type, x.hazardId, new Date(x.ts).toLocaleString()]),
  });

  doc.save(`race-safety-health-${templateLabel}.pdf`);
}

// -----------------------------
// Main App Component
// -----------------------------
function RaceSafetyMVP() {
  const saved = typeof window !== "undefined" ? loadLS() : null;

  const [lang, setLang] = useState(saved?.lang || "en");
  const t = (k, ...args) => {
    const v = I18N[lang][k];
    return typeof v === "function" ? v(...args) : v ?? k;
  };

  const [templateKey, setTemplateKey] = useState(saved?.templateKey || "roadShort");
  const template = TEMPLATES[templateKey];

  const [role, setRole] = useState(saved?.role || "Race Director");
  const [selectedSegment, setSelectedSegment] = useState(saved?.selectedSegment || null);
  const [selectedDomain, setSelectedDomain] = useState(saved?.selectedDomain || null);

  const [hazards, setHazards] = useState(saved?.hazards || template.hazards);
  const [controls, setControls] = useState(saved?.controls || INITIAL_CONTROLS);
  const [constraints, setConstraints] = useState(saved?.constraints || template.constraints);

  // criteria values per domain {domain: {criterionId: 0..1}}
  const [criteriaValues, setCriteriaValues] = useState(saved?.criteriaValues || {});
  const readiness = useMemo(
    () => readinessFromCriteria(READINESS_CRITERIA, criteriaValues),
    [criteriaValues]
  );

  const [incidents, setIncidents] = useState(saved?.incidents || []);
  const [incidentType, setIncidentType] = useState("Heat illness");
  const [incidentHazardId, setIncidentHazardId] = useState(template.hazards[0]?.id || "");

  // when template changes, reset to template defaults
  useEffect(() => {
    setHazards(template.hazards);
    setConstraints(template.constraints);
    setSelectedSegment(null);
    setSelectedDomain(null);
  }, [templateKey]); // eslint-disable-line

  // persist
  useEffect(() => {
    saveLS({
      lang, templateKey, role, selectedSegment, selectedDomain,
      hazards, controls, constraints, criteriaValues, incidents,
    });
  }, [lang, templateKey, role, selectedSegment, selectedDomain, hazards, controls, constraints, criteriaValues, incidents]);

  // role filtering
  const visibleDomains = ROLE_DOMAINS[role] || DOMAINS;
  const visibleControls = ROLE_CONTROLS[role];
  const filteredControls = visibleControls == null ? controls : controls.filter((c) => visibleControls.includes(c.name));

  // segment + domain filtering hazards
  const filteredHazards = hazards.filter((h) => {
    if (selectedSegment && h.segmentId !== selectedSegment) return false;
    if (selectedDomain && h.domain !== selectedDomain) return false;
    if (!visibleDomains.includes(h.domain)) return false;
    return true;
  });

  // scoring
  const riskByDomain = DOMAINS.reduce((acc, d) => {
    acc[d] = normalizeRiskToPct(domainRiskScore(hazards, d));
    return acc;
  }, {});
  const riskLoadPct = clamp(avg(Object.values(riskByDomain)), 0, 100);
  const controlPct = controlHealthPct(filteredControls);
  const readinessPct = pct(avg(Object.values(readiness)));

  const anyCriticalFail = constraints.some((c) => c.critical && c.status === "fail");

  const holisticPct = clamp(
    // weight: readiness 40%, controls 30%, risk inverted 30%
    (readinessPct * 0.4) + (controlPct * 0.3) + ((100 - riskLoadPct) * 0.3),
    0, 100
  );

  // incident → increase occurrence
  const logIncident = () => {
    if (!incidentHazardId) return;
    setIncidents((prev) => [{ type: incidentType, hazardId: incidentHazardId, ts: Date.now() }, ...prev].slice(0, 20));
    setHazards((prev) =>
      prev.map((h) =>
        h.id === incidentHazardId ? { ...h, O: clamp(h.O + 1, 1, 10) } : h
      )
    );
  };

  const clearFilters = () => { setSelectedSegment(null); setSelectedDomain(null); };

  // small helpers for UI
  const domainLabel = (d) => (lang === "el" ? DOMAINS_EL[DOMAINS_EN.indexOf(d)] || d : d);
  const roleLabel = (r) => (lang === "el" ? ROLES_EL[ROLES_EN.indexOf(r)] || r : r);
  const controlLabel = (c) => (lang === "el" ? (CONTROLS_EN_TO_EL[c] || c) : c);

  const setCriterionValue = (domain, critId, val01) => {
    setCriteriaValues((prev) => ({
      ...prev,
      [domain]: { ...(prev[domain] || {}), [critId]: val01 },
    }));
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 bg-white/90 backdrop-blur border-b border-slate-200 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("appTitle")}</h1>
            <div className="text-sm text-slate-500">{t("subtitle")}</div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Language */}
            <div className="flex rounded-full border border-slate-200 overflow-hidden">
              {LANGS.map((L) => (
                <button
                  key={L.code}
                  onClick={() => setLang(L.code)}
                  className={`px-3 py-1 text-sm font-semibold ${lang === L.code ? "bg-slate-900 text-white" : "bg-white text-slate-700"}`}
                >
                  {L.label}
                </button>
              ))}
            </div>

            {/* Template */}
            <select
              value={templateKey}
              onChange={(e) => setTemplateKey(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm"
              title={t("template")}
            >
              {Object.entries(TEMPLATES_LABELS).map(([k, lab]) => (
                <option key={k} value={k}>{lab[lang]}</option>
              ))}
            </select>

            {/* Role */}
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm"
              title={t("roleView")}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{roleLabel(r)}</option>
              ))}
            </select>

            <button onClick={clearFilters} className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm">
              {t("clearFilters")}
            </button>

            <button
              onClick={() =>
                exportPdf({
                  t, lang,
                  templateLabel: TEMPLATES_LABELS[templateKey][lang],
                  roleLabel: roleLabel(role),
                  hazards, controls: filteredControls, constraints, readiness, incidents,
                })
              }
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold"
            >
              {t("exportPdf")}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-8">
        {/* Gauge + top cards */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
          <SafetyGauge
            t={t}
            value={holisticPct}
            prevValue={saved?.holisticPct ?? null}
            lockedRed={anyCriticalFail}
            label={t("gaugeLabel")}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="text-sm font-semibold">{t("riskLoad")}</div>
              <div className="text-2xl font-bold mt-1">{Math.round(riskLoadPct)}%</div>
              <div className="text-xs text-slate-500">{t("hazardsHint")}</div>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="text-sm font-semibold">{t("controlHealth")}</div>
              <div className="text-2xl font-bold mt-1">{Math.round(controlPct)}%</div>
              <div className="text-xs text-slate-500">{t("controlsHint")}</div>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="text-sm font-semibold">{t("readiness")}</div>
              <div className="text-2xl font-bold mt-1">{Math.round(readinessPct)}%</div>
              <div className="text-xs text-slate-500">{t("readinessHint")}</div>
            </div>
          </div>
        </section>

        {/* Segments */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-baseline justify-between">
            <h3 className="text-lg font-semibold">{t("segmentsTitle")}</h3>
            <div className="text-xs text-slate-500">{t("segmentsHint")}</div>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {template.segments.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedSegment((prev) => (prev === s.id ? null : s.id))}
                className={`px-3 py-1.5 rounded-full text-sm border ${
                  selectedSegment === s.id ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-200 text-slate-700"
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        </section>

        {/* Domains + readiness sub-criteria */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-baseline justify-between">
            <h3 className="text-lg font-semibold">{t("domainsTitle")}</h3>
            <div className="text-xs text-slate-500">{t("domainsHint")}</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            {visibleDomains.map((d) => {
              const crits = READINESS_CRITERIA[d] || [];
              const r01 = readiness[d] ?? 0.75;
              return (
                <div key={d} className="border border-slate-200 rounded-xl p-3">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setSelectedDomain((prev) => (prev === d ? null : d))}
                      className={`text-left font-semibold ${selectedDomain === d ? "text-emerald-700" : ""}`}
                    >
                      {domainLabel(d)}
                    </button>
                    <div className="text-sm font-bold">{pct(r01)}%</div>
                  </div>

                  {/* sub-criteria */}
                  {crits.length > 0 && (
                    <div className="mt-2 space-y-2">
                      <div className="text-xs font-semibold text-slate-500">{t("subCriteria")}</div>
                      {crits.map((c) => {
                        const val = criteriaValues?.[d]?.[c.id];
                        const val01 = typeof val === "number" ? val : 0.75;
                        return (
                          <div key={c.id} className="flex items-center gap-2">
                            <div className="flex-1 text-sm">{lang === "el" ? c.el : c.en}</div>
                            <input
                              type="range"
                              min={0}
                              max={100}
                              step={5}
                              value={pct(val01)}
                              onChange={(e) => setCriterionValue(d, c.id, e.target.value / 100)}
                              className="w-40"
                            />
                            <div className="w-10 text-right text-sm tabular-nums">{pct(val01)}%</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Hazards FMEA */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-baseline justify-between">
            <h3 className="text-lg font-semibold">{t("hazardsTitle")}</h3>
            <div className="text-xs text-slate-500">{t("hazardsHint")}</div>
          </div>

          <div className="mt-3 space-y-3">
            {filteredHazards.map((h) => {
              const rpn = residualRpn(h);
              return (
                <div key={h.id} className="border border-slate-200 rounded-xl p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-semibold">{h.name}</div>
                    <div className="text-xs text-slate-500">
                      {domainLabel(h.domain)} • {h.segmentId}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-2">
                    {["S", "O", "D"].map((k) => (
                      <label key={k} className="text-sm">
                        <div className="flex justify-between">
                          <span>{t(k.toLowerCase())}</span>
                          <span className="font-semibold">{h[k]}</span>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={10}
                          step={1}
                          value={h[k]}
                          onChange={(e) =>
                            setHazards((prev) =>
                              prev.map((x) => (x.id === h.id ? { ...x, [k]: Number(e.target.value) } : x))
                            )
                          }
                          className="w-full"
                        />
                      </label>
                    ))}

                    <label className="text-sm">
                      <div className="flex justify-between">
                        <span>{t("controlsActive")}</span>
                        <span className="font-semibold">{pct(h.controlsActive)}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={pct(h.controlsActive)}
                        onChange={(e) =>
                          setHazards((prev) =>
                            prev.map((x) => (x.id === h.id ? { ...x, controlsActive: e.target.value / 100 } : x))
                          )
                        }
                        className="w-full"
                      />
                    </label>
                  </div>

                  <div className="mt-2 flex items-center justify-between">
                    <div className="text-sm text-slate-600">{t("residualRpn")}</div>
                    <div className="text-lg font-bold tabular-nums">{Math.round(rpn)}</div>
                  </div>
                </div>
              );
            })}

            {!filteredHazards.length && (
              <div className="text-sm text-slate-500">{t("tapInspect")}</div>
            )}
          </div>
        </section>

        {/* Controls STPA */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-baseline justify-between">
            <h3 className="text-lg font-semibold">{t("controlsTitle")}</h3>
            <div className="text-xs text-slate-500">{t("controlsHint")}</div>
          </div>

          <div className="mt-3 space-y-3">
            {filteredControls.map((c) => (
              <div key={c.id} className="border border-slate-200 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">{controlLabel(c.name)}</div>
                  <div className="text-sm font-bold">{pct(c.readiness)}%</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                  <label className="text-sm">
                    <div className="flex justify-between">
                      <span>{t("readinessShort")}</span>
                      <span className="font-semibold">{pct(c.readiness)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={pct(c.readiness)}
                      onChange={(e) =>
                        setControls((prev) =>
                          prev.map((x) => (x.id === c.id ? { ...x, readiness: e.target.value / 100 } : x))
                        )
                      }
                      className="w-full"
                    />
                  </label>

                  <label className="text-sm">
                    <div className="flex justify-between">
                      <span>{t("ucaCount")}</span>
                      <span className="font-semibold">{c.ucaCount}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={5}
                      step={1}
                      value={c.ucaCount}
                      onChange={(e) =>
                        setControls((prev) =>
                          prev.map((x) => (x.id === c.id ? { ...x, ucaCount: Number(e.target.value) } : x))
                        )
                      }
                      className="w-full"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Constraints STAMP */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-baseline justify-between">
            <h3 className="text-lg font-semibold">{t("constraintsTitle")}</h3>
            <div className="text-xs text-slate-500">{t("constraintsHint")}</div>
          </div>

          <div className="mt-3 space-y-2">
            {constraints.map((s) => (
              <div key={s.id} className="border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-2">
                <div>
                  <div className="font-medium">{s.statement}</div>
                  {s.critical && <div className="text-xs text-red-600 font-semibold">CRITICAL</div>}
                </div>
                <select
                  value={s.status}
                  onChange={(e) =>
                    setConstraints((prev) =>
                      prev.map((x) => (x.id === s.id ? { ...x, status: e.target.value } : x))
                    )
                  }
                  className={`px-2 py-1 rounded-lg border text-sm ${
                    s.status === "pass" ? "border-emerald-300 bg-emerald-50" :
                    s.status === "warn" ? "border-amber-300 bg-amber-50" :
                    "border-red-300 bg-red-50"
                  }`}
                >
                  <option value="pass">{t("pass")}</option>
                  <option value="warn">{t("warn")}</option>
                  <option value="fail">{t("fail")}</option>
                </select>
              </div>
            ))}
          </div>
        </section>

        {/* Incident Log */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-baseline justify-between">
            <h3 className="text-lg font-semibold">{t("incidentLogTitle")}</h3>
            <div className="text-xs text-slate-500">{t("incidentLogHint")}</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3">
            <select
              value={incidentType}
              onChange={(e) => setIncidentType(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm"
            >
              {Object.keys(INCIDENTS_EN_TO_EL).map((k) => (
                <option key={k} value={k}>{lang === "el" ? INCIDENTS_EN_TO_EL[k] : k}</option>
              ))}
            </select>

            <select
              value={incidentHazardId}
              onChange={(e) => setIncidentHazardId(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm"
            >
              {hazards.map((h) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>

            <button
              onClick={logIncident}
              className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold"
            >
              {t("logIncident")}
            </button>
          </div>

          <div className="mt-4">
            <div className="text-sm font-semibold">{t("recentIncidents")}</div>
            <div className="text-xs text-slate-500">{t("recentIncidentsHint")}</div>

            <div className="mt-2 space-y-2">
              {incidents.length === 0 && <div className="text-sm text-slate-500">{t("noIncidents")}</div>}
              {incidents.map((x, i) => (
                <div key={i} className="border border-slate-200 rounded-xl p-2 text-sm flex items-center justify-between">
                  <div>
                    {lang === "el" ? (INCIDENTS_EN_TO_EL[x.type] || x.type) : x.type}
                    <span className="text-slate-400"> — {hazards.find((h) => h.id === x.hazardId)?.name || x.hazardId}</span>
                  </div>
                  <div className="text-xs text-slate-500">{new Date(x.ts).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <footer className="text-center text-xs text-slate-500 py-4">
          {t("mvpFooter")}
        </footer>
      </main>
    </div>
  );
}

export default RaceSafetyMVP;
