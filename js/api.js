// ─── Prompts ──────────────────────────────────────────────────────────────────
const PROMPTS = {
  aufgabe: (thema, typ, schwierigkeit) =>
    `Du bist Lernassistent für Physik (FH Aachen). Generiere eine ${typ}-Aufgabe für "${thema}". Schwierigkeitsgrad ${schwierigkeit} von 3. Nur die Aufgabenstellung, kein Präambel.`,

  tipp: (aufgabe, nr) =>
    `Aufgabe: "${aufgabe}"\nGib Tipp ${nr} von 3. Tipp 1=abstrakte Denkrichtung, 2=konkreter Hinweis, 3=fast vollständig. Max 2 Sätze, kein Präambel.`,

  bewertung: (aufgabe, antwort, thema) =>
    `Thema: "${thema}" — Physik FH Aachen.\nAufgabe: "${aufgabe}"\nAntwort: "${antwort}"\nKurzes Feedback (max 3 Sätze): was gut war, was fehlt. Direkt beginnen, kein Präambel.`,

  verifizierung: (thema, stufe) => {
    const niveaus = ['', 'einfache', 'grundlegende', 'mittlere', 'anspruchsvolle klausurtypische', 'vertiefte']
    return `Du bist Physik-Lernassistent (FH Aachen). Stelle genau EINE ${niveaus[stufe]} Verständnisfrage zu "${thema}" (Schwierigkeitsgrad ${stufe} von 5). Nur die Frage, max 2 Sätze, kein Präambel.`
  },
}

// ─── Mock Responses ───────────────────────────────────────────────────────────
const MOCK_DATA = {
  erklären: [
    'Erkläre in eigenen Worten den Unterschied zwischen dem Impulserhaltungssatz und dem Energieerhaltungssatz. Nenne für jeden Satz ein konkretes physikalisches Beispiel.',
    'Was versteht man unter dem Trägheitsmoment? Erkläre, wovon es abhängt und wie es Rotationsbewegungen beeinflusst.',
    'Beschreibe das Superpositionsprinzip bei Wellen und erkläre den Unterschied zwischen konstruktiver und destruktiver Interferenz.',
    'Was ist der Unterschied zwischen Wechselstrom und Gleichstrom? Erkläre, warum Wechselstrom für die Fernübertragung bevorzugt wird.',
  ],
  fehler: [
    'Finde den Fehler: "Beim elastischen Stoß bleibt der Impuls erhalten, aber die kinetische Energie wird größer."',
    'Finde den Fehler: "Das Trägheitsmoment hängt ausschließlich von der Gesamtmasse ab, nicht von der Massenverteilung."',
    'Finde den Fehler: "Eine Sinuswelle mit doppelter Frequenz hat doppelte Wellenlänge, da v = f·λ konstant ist."',
  ],
  tipps: [
    ['Überlege, was bei einem abgeschlossenen System jeweils erhalten bleibt.',
     'Impulserhaltung gilt ohne äußere Kraft. Energieerhaltung gilt nur ohne Wärmeverlust.',
     'Impuls p=mv ist stets erhalten. Kinetische Energie E=½mv² nur beim elastischen Stoß.'],
    ['Denke an die fundamentale Definition und welche Größen beteiligt sind.',
     'Betrachte die Formel — was ändert sich, wenn man den Abstand zur Achse ändert?',
     'J = Σ(mᵢ·rᵢ²) — die Massenverteilung relativ zur Drehachse ist entscheidend.'],
  ],
  bewertung: [
    'Sehr gut! Du hast den Kern korrekt benannt. Noch besser wäre ein konkretes Zahlenbeispiel.',
    'Guter Ansatz! Der Kerngedanke stimmt. Ein Beispiel aus der Mechanik würde die Erklärung abrunden.',
    'Solide Erklärung! Die Verbindung zwischen Formel und Anwendung könnte noch klarer werden.',
  ],
  verifizierung: {
    1: ['Nenne den zentralen Begriff dieses Themengebiets und erkläre ihn in einem Satz.'],
    2: ['Erkläre das Kernprinzip dieses Themas in einem Satz. Welche Formel ist zentral?'],
    3: ['Wie würdest du dieses Thema einem Kommilitonen ohne Fachbegriffe erklären?'],
    4: ['Erkläre, wie sich das System verhält, wenn eine Schlüsselgröße verdoppelt wird. Welche Prüfungsaufgabe ergibt sich daraus?'],
    5: ['Erkläre den Zusammenhang dieses Konzepts mit einem anderen Physikbereich und nenne die Grenzen des Modells.'],
  },
}

const _mockCounters = {}
function _nextMock(key, arr) {
  _mockCounters[key] = ((_mockCounters[key] ?? -1) + 1) % arr.length
  return arr[_mockCounters[key]]
}

function getMockResponse(type, extra) {
  switch (type) {
    case 'aufgabe':
      return _nextMock('aufgabe', extra === 'fehler' ? MOCK_DATA.fehler : MOCK_DATA.erklären)
    case 'tipp': {
      const set = MOCK_DATA.tipps[(_mockCounters.tippSet ?? 0) % MOCK_DATA.tipps.length]
      return set[Math.min((extra ?? 1) - 1, 2)]
    }
    case 'bewertung':
      return _nextMock('bewertung', MOCK_DATA.bewertung)
    case 'verifizierung': {
      const level = Math.min(Math.max(extra ?? 2, 1), 5)
      return _nextMock(`verif_${level}`, MOCK_DATA.verifizierung[level])
    }
    default: return 'Keine Mock-Antwort verfügbar.'
  }
}

// ─── Environment detection ────────────────────────────────────────────────────
// file:// protocol → browser blocks all fetch() to external APIs (hard CORS rule).
// 127.0.0.1 / localhost → API server rejects (no CORS headers for local origins).
// Public origin (github.io, netlify.app, …) → should work fine.
function _isFileProtocol() {
  return location.protocol === 'file:'
}
function _isLocalhost() {
  return ['localhost', '127.0.0.1', '::1'].includes(location.hostname)
}

const FILE_CORS_HINT =
  'Direktes Öffnen als Datei (file://) blockiert alle API-Anfragen. ' +
  'Lösung: In VS Code unten rechts "Go Live" klicken → Seite über http://127.0.0.1:5500 öffnen.'

const LOCALHOST_CORS_HINT =
  'Die API blockiert Anfragen von localhost. Für lokale Tests: Demo-Modus nutzen (kein Key nötig). ' +
  'Für echte KI: Seite über GitHub Pages oder Netlify aufrufen.'

// ─── API Calls ────────────────────────────────────────────────────────────────
async function callAI(systemPrompt, userMessage, { apiKey, model } = {}) {
  function fallback() {
    if (systemPrompt.includes('Generiere eine'))   return getMockResponse('aufgabe', systemPrompt.includes('fehler') ? 'fehler' : 'erklären')
    if (systemPrompt.includes('Gib Tipp'))          return getMockResponse('tipp', parseInt(systemPrompt.match(/Tipp (\d)/)?.[1] ?? '1'))
    if (systemPrompt.includes('Feedback'))          return getMockResponse('bewertung')
    if (systemPrompt.includes('Verständnisfrage'))  return getMockResponse('verifizierung', parseInt(systemPrompt.match(/(\d+) von 5/)?.[1] ?? '2'))
    return 'Keine Antwort verfügbar.'
  }

  if (!apiKey) return fallback()

  try {
    const res = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: model ?? 'gpt-5.2',
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }],
        max_tokens: 800, temperature: 0.7,
      }),
    })
    const data = await res.json()
    if (!data.choices?.[0]?.message?.content) throw new Error(data.error?.message ?? 'No content')
    return data.choices[0].message.content
  } catch {
    return fallback()
  }
}

async function testConnection(apiKey, model) {
  try {
    const res = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: model ?? 'gpt-5.2',
        messages: [{ role: 'user', content: 'Antworte nur mit: OK' }],
        max_tokens: 10,
      }),
    })
    const data = await res.json()
    if (data.choices?.[0]?.message?.content) {
      return { ok: true, message: `✅ Verbunden · Modell: ${model ?? 'gpt-5.2'}` }
    }
    // HTTP error with JSON body (e.g. 401 Unauthorized)
    const errMsg = data.error?.message ?? `HTTP ${res.status}`
    return { ok: false, message: `API-Fehler: ${errMsg}` }
  } catch (e) {
    if (_isFileProtocol()) return { ok: false, message: FILE_CORS_HINT }
    if (_isLocalhost())    return { ok: false, message: LOCALHOST_CORS_HINT }
    return { ok: false, message: `Netzwerkfehler: ${e.message}` }
  }
}
