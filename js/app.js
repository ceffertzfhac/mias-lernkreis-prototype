/**
 * Mias Lernkreis — Solo App
 * Alpine.js state & methods
 * Depends on: config.js, api.js, radar.js
 */

// ─── Storage helpers ──────────────────────────────────────────────────────────
const store = {
  get:      key  => JSON.parse(localStorage.getItem(STORAGE_PREFIX + key) ?? 'null'),
  set:      (k, v) => localStorage.setItem(STORAGE_PREFIX + k, JSON.stringify(v)),
  clearAll: () => Object.keys(localStorage).filter(k => k.startsWith(STORAGE_PREFIX)).forEach(k => localStorage.removeItem(k)),
}

// ─── Date helpers ─────────────────────────────────────────────────────────────
const dateFromNow  = days => { const d = new Date(); d.setDate(d.getDate() + days); return d }
const toDateInput  = date => (date instanceof Date ? date : new Date(date)).toISOString().split('T')[0]
const todayInput   = () => toDateInput(new Date())

// ─── Alpine App ───────────────────────────────────────────────────────────────
function app() {
  return {

    // ── Screen ──────────────────────────────────────────────────────────────
    screen: 'setup',

    // ── Setup ───────────────────────────────────────────────────────────────
    name: '',
    apiKey: '',
    apiModel: 'gpt-4o',
    examDateInput: toDateInput(dateFromNow(45)),
    apiTest: { status: null, message: '' }, // null | loading | ok | error

    // ── Kurs (course = radar axis definition) ────────────────────────────────
    kurs: ACTIVE_KURS,

    // ── Diagnose ────────────────────────────────────────────────────────────
    diagnosen: [],          // [{ datum: ISO, bewertungen: [{id, stufe}] }]
    aktBewertungen: [],     // [{id, stufe: 1-5 | null}]
    verifikation: { aktiv: false, themaId: null, stufe: null, frage: '', loading: false },

    // ── Radar ────────────────────────────────────────────────────────────────
    showVerlauf: false,

    // ── Übung ────────────────────────────────────────────────────────────────
    ue: {
      themaId: 1, typ: 'erklären', schwierigkeit: 1,
      aufgabe: '', antwort: '', tippTexte: [], genutzeTipps: 0,
      ergebnis: null, loading: false,
    },
    session: { aufgaben: [] },

    // ── Fortschritt ──────────────────────────────────────────────────────────
    editExamDate: false,

    // ════════════════════════════════════════════════════════════════════════
    // LIFECYCLE
    // ════════════════════════════════════════════════════════════════════════
    init() {
      const cfg = store.get('api_config') ?? {}
      this.apiKey   = cfg.apiKey ?? ''
      this.apiModel = cfg.model  ?? 'gpt-4o'
      this.name     = store.get('name') ?? ''
      const raw = store.get('diagnosen') ?? []
      this.diagnosen = raw.filter(d => d.bewertungen?.[0]?.stufe !== undefined)

      const storedExam = store.get('exam_date')
      this.examDateInput = storedExam ? toDateInput(new Date(storedExam)) : toDateInput(dateFromNow(this.kurs.defaultPrüfungstage))

      this._resetAktDiagnose()
      if (this.name) {
        this.screen = 'home'
        this.$nextTick(() => this._renderRadar('radarHome', { compact: true }))
      }
    },

    _persist() {
      store.set('name', this.name)
      store.set('api_config', { apiKey: this.apiKey, model: this.apiModel })
      store.set('exam_date', new Date(this.examDateInput).toISOString())
    },

    // ════════════════════════════════════════════════════════════════════════
    // NAVIGATION
    // ════════════════════════════════════════════════════════════════════════
    goTo(screen) {
      radar.destroyAll()
      if (screen === 'diagnose') this._resetAktDiagnose()
      this.screen = screen
      this.$nextTick(() => {
        const radarScreens = {
          home:        { id: 'radarHome',         opts: { compact: true } },
          radar:       { id: 'radarCanvas',        opts: { showVerlauf: this.showVerlauf } },
          fortschritt: { id: 'radarFortschritt',   opts: { showVerlauf: this.diagnosen.length > 1 } },
        }
        const cfg = radarScreens[screen]
        if (cfg) this._renderRadar(cfg.id, cfg.opts)
      })
    },

    _renderRadar(canvasId, opts = {}) {
      if (this.diagnosen.length > 0) {
        radar.render(canvasId, this.kurs.themen, this.diagnosen, opts)
      }
    },

    // ════════════════════════════════════════════════════════════════════════
    // SETUP
    // ════════════════════════════════════════════════════════════════════════
    async testApiConnection() {
      if (!this.apiKey) return
      this.apiTest = { status: 'loading', message: '' }
      const result = await testConnection(this.apiKey, this.apiModel)
      this.apiTest = { status: result.ok ? 'ok' : 'error', message: result.message }
    },

    startSolo() {
      if (!this.name.trim()) return
      this._persist()
      this.goTo('home')
    },

    // ════════════════════════════════════════════════════════════════════════
    // DIAGNOSE
    // ════════════════════════════════════════════════════════════════════════
    _resetAktDiagnose() {
      this.aktBewertungen = this.kurs.themen.map(t => ({ id: t.id, stufe: null }))
      this.verifikation = { aktiv: false, themaId: null, stufe: null, frage: '', loading: false }
    },

    aktBew(id) {
      return this.aktBewertungen.find(b => b.id === id)?.stufe ?? null
    },

    async setBewertung(id, stufe) {
      const entry = this.aktBewertungen.find(b => b.id === id)
      if (!entry) return
      this.verifikation.aktiv = false
      if (entry.stufe === stufe) { entry.stufe = null; return }
      entry.stufe = stufe
      if (stufe >= 2) await this._startVerifikation(id, stufe)
    },

    async _startVerifikation(id, stufe) {
      const thema = this.kurs.themen.find(t => t.id === id)
      this.verifikation = { aktiv: true, themaId: id, stufe, frage: '', loading: true }
      this.verifikation.frage = await callAI(
        PROMPTS.verifizierung(thema.name, stufe),
        'Frage generieren.',
        { apiKey: this.apiKey, model: this.apiModel }
      )
      this.verifikation.loading = false
    },

    confirmVerifikation() { this.verifikation.aktiv = false },
    lowerVerifikation() {
      const e = this.aktBewertungen.find(b => b.id === this.verifikation.themaId)
      if (e?.stufe > 1) e.stufe--
      this.verifikation.aktiv = false
    },

    completeDiagnose() {
      if (!this.diagnoseKomplett || this.verifikation.aktiv) return
      const snap = { datum: new Date().toISOString(), bewertungen: this.aktBewertungen.map(b => ({ ...b })) }
      this.diagnosen.push(snap)
      if (this.diagnosen.length > 5) this.diagnosen.shift()
      store.set('diagnosen', this.diagnosen)
      this.goTo('radar')
    },

    // ════════════════════════════════════════════════════════════════════════
    // RADAR
    // ════════════════════════════════════════════════════════════════════════
    toggleVerlauf() {
      this.showVerlauf = !this.showVerlauf
      this.$nextTick(() => radar.render('radarCanvas', this.kurs.themen, this.diagnosen, { showVerlauf: this.showVerlauf }))
    },

    // ════════════════════════════════════════════════════════════════════════
    // ÜBUNG
    // ════════════════════════════════════════════════════════════════════════
    async generateTask() {
      Object.assign(this.ue, { aufgabe: '', antwort: '', tippTexte: [], genutzeTipps: 0, ergebnis: null, loading: true })
      const thema = this.kurs.themen.find(t => t.id == this.ue.themaId)
      this.ue.aufgabe = await callAI(PROMPTS.aufgabe(thema.name, this.ue.typ, this.ue.schwierigkeit), 'Aufgabe.', { apiKey: this.apiKey, model: this.apiModel })
      this.ue.loading = false
      this.screen = 'ueben-aufgabe'
    },

    async requestHint() {
      if (this.ue.genutzeTipps >= 3 || this.ue.loading) return
      this.ue.loading = true
      const hint = await callAI(PROMPTS.tipp(this.ue.aufgabe, this.ue.genutzeTipps + 1), 'Tipp.', { apiKey: this.apiKey, model: this.apiModel })
      this.ue.tippTexte.push(hint)
      this.ue.genutzeTipps++
      this.ue.loading = false
    },

    async submitAnswer() {
      if (!this.ue.antwort.trim() || this.ue.loading) return
      this.ue.loading = true
      const thema = this.kurs.themen.find(t => t.id == this.ue.themaId)
      this.ue.ergebnis = await callAI(PROMPTS.bewertung(this.ue.aufgabe, this.ue.antwort, thema.name), 'Bewerten.', { apiKey: this.apiKey, model: this.apiModel })
      this.ue.loading = false
      const korrekt = this._estimateCorrectness(this.ue.ergebnis)
      const { genutzeTipps } = this.ue
      if (korrekt && genutzeTipps === 0)      this.ue.schwierigkeit = Math.min(3, this.ue.schwierigkeit + 1)
      else if (!korrekt || genutzeTipps >= 2)  this.ue.schwierigkeit = Math.max(1, this.ue.schwierigkeit - 1)
      this.session.aufgaben.push({ korrekt, tipps: genutzeTipps })
      this.screen = 'ueben-ergebnis'
    },

    _estimateCorrectness(fb) {
      const l = fb.toLowerCase()
      return !l.includes('fehlt') && !l.includes('falsch') && !l.includes('nicht korrekt') && !l.includes('unvollständig')
    },

    nextTask() {
      Object.assign(this.ue, { aufgabe: '', antwort: '', tippTexte: [], genutzeTipps: 0, ergebnis: null })
      this.screen = 'ueben-auswahl'
    },

    // ════════════════════════════════════════════════════════════════════════
    // FORTSCHRITT
    // ════════════════════════════════════════════════════════════════════════
    updateExamDate() {
      store.set('exam_date', new Date(this.examDateInput).toISOString())
      this.editExamDate = false
    },

    resetAll() {
      if (confirm('Alle Lernkreis-Daten löschen? Nicht rückgängig machbar.')) {
        store.clearAll(); location.reload()
      }
    },

    // ════════════════════════════════════════════════════════════════════════
    // COMPUTED
    // ════════════════════════════════════════════════════════════════════════
    get letzeDiagnose()    { return this.diagnosen.at(-1) ?? null },
    get diagnoseKomplett() { return this.aktBewertungen.every(b => b.stufe !== null) },
    get bewerteteThemen()  { return this.aktBewertungen.filter(b => b.stufe !== null).length },
    get verbleibeneTage()  { return Math.max(0, Math.ceil((new Date(this.examDateInput) - new Date()) / 86400000)) },
    get zeitProzent()      { return Math.min(100, Math.round((1 - this.verbleibeneTage / 90) * 100)) },

    themenBereit() { return this.letzeDiagnose?.bewertungen.filter(b => b.stufe >= 4).length ?? 0 },

    schwächsteThemen() {
      if (!this.letzeDiagnose) return []
      return this.kurs.themen
        .map(t => ({ ...t, stufe: this.letzeDiagnose.bewertungen.find(b => b.id === t.id)?.stufe ?? null }))
        .filter(t => (t.stufe ?? 0) <= 3)
        .sort((a, b) => (a.stufe ?? 0) - (b.stufe ?? 0))
        .slice(0, 3)
    },

    verbesserungen() {
      if (this.diagnosen.length < 2) return []
      const [prev, curr] = this.diagnosen.slice(-2)
      return this.kurs.themen.filter(t => {
        const ps = prev.bewertungen.find(b => b.id === t.id)?.stufe ?? 0
        const cs = curr.bewertungen.find(b => b.id === t.id)?.stufe ?? 0
        return cs > ps
      })
    },

    themenMitStatus() {
      return this.kurs.themen
        .map(t => ({ ...t, stufe: this.letzeDiagnose?.bewertungen.find(b => b.id === t.id)?.stufe ?? null }))
        .sort((a, b) => (a.stufe ?? 0) - (b.stufe ?? 0))
    },

    diagnosePunkte() {
      return this.diagnosen.map((d, i) => ({ idx: i, datum: this.fmt(d.datum) }))
    },

    sessionSummaryNeeded() { return this.session.aufgaben.length > 0 && this.session.aufgaben.length % 5 === 0 },

    // ════════════════════════════════════════════════════════════════════════
    // FORMATTERS
    // ════════════════════════════════════════════════════════════════════════
    stufenCfg: s  => STUFEN[s] ?? { label: '—', color: '#7A6E8A', bg: '#F3F4F6' },
    starStr:   s  => s ? '★'.repeat(s) + '☆'.repeat(5 - s) : '☆☆☆☆☆',
    fmt:       iso => new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }),
    examFmt:   () => new Date(this.examDateInput).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' }),
    todayMin:  () => todayInput(),
    themenName: id => ACTIVE_KURS.themen.find(t => t.id == id)?.name ?? '',
    diffStr:   lvl => '●'.repeat(lvl) + '○'.repeat(3 - lvl),
    kompScore: () => 100 - this.ue.genutzeTipps * 20,
  }
}
