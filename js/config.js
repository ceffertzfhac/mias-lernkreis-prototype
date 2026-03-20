// ─── Design tokens (mirrored in CSS custom props) ─────────────────────────────
const COLORS = {
  primary: '#4A2C6E', accent: '#7B4FA6',
  bg: '#F6F4FA', light: '#EDE6F5', ink: '#1C1828', muted: '#7A6E8A',
  success: '#1A5C3A', successBg: '#D1FAE5',
  warn: '#7A4A00', warnBg: '#FEF3C7',
  error: '#8B1A1A', errorBg: '#FEE2E2',
  amber: '#A16207', amberBg: '#FEF9C3',
}

// 5-level competence system — Level 4 = Klausurniveau (exam readiness target)
const STUFEN = [
  null,
  { label: 'Lernbedarf',    color: '#8B1A1A', bg: '#FEE2E2' }, // 1 ★☆☆☆☆
  { label: 'Grundlagen',    color: '#7A4A00', bg: '#FEF3C7' }, // 2 ★★☆☆☆
  { label: 'Verstanden',    color: '#A16207', bg: '#FEF9C3' }, // 3 ★★★☆☆
  { label: 'Klausurniveau', color: '#1A5C3A', bg: '#D1FAE5' }, // 4 ★★★★☆ ← Ziel
  { label: 'Exzellent',     color: '#4A2C6E', bg: '#EDE6F5' }, // 5 ★★★★★
]

// Course catalogue — themen define the radar axes per course
const KURSE = {
  physik_fh_aachen: {
    id: 'physik_fh_aachen',
    name: 'Physik — FH Aachen',
    defaultPrüfungstage: 45,
    themen: [
      { id: 1, name: 'Mechanik — Kinematik',                 haeufig: false },
      { id: 2, name: 'Mechanik — Dynamik',                   haeufig: false },
      { id: 3, name: 'Mechanik — Energie & Erhaltungssätze', haeufig: true  },
      { id: 4, name: 'Rotationsmechanik',                    haeufig: false },
      { id: 5, name: 'Schwingungen & Wellen',                haeufig: false },
      { id: 6, name: 'Elektrodynamik I',                     haeufig: true  },
      { id: 7, name: 'Elektrodynamik II',                    haeufig: false },
    ],
  },
}

const ACTIVE_KURS    = KURSE.physik_fh_aachen
const STORAGE_PREFIX = 'mlk_'
const API_ENDPOINT   = 'https://chat.kiconnect.nrw/api/v1/chat/completions'
