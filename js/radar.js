/**
 * RadarManager
 * Manages Chart.js radar (spider) instances by canvas ID.
 * Axes are defined per course via `themen` array.
 */
class RadarManager {
  constructor() { this._instances = {} }

  /**
   * @param {string} canvasId
   * @param {Array}  themen      - Course topics → radar axes
   * @param {Array}  diagnosen   - Diagnosis snapshots
   * @param {object} opts        - { showVerlauf?, compact? }
   */
  render(canvasId, themen, diagnosen, opts = {}) {
    this.destroy(canvasId)
    const canvas = document.getElementById(canvasId)
    if (!canvas || !diagnosen.length) return null

    const { showVerlauf = false, compact = false } = opts
    const labels = themen.map(t => {
      const p = t.name.split(' — ')
      return p.length > 1 ? p[1] : p[0]
    })

    const datasets = [
      ...this._buildDatasets(themen, diagnosen, showVerlauf),
      this._klausurniveauLine(themen.length),
    ]

    this._instances[canvasId] = new Chart(canvas, {
      type: 'radar',
      data: { labels, datasets },
      options: this._options(showVerlauf && diagnosen.length > 1, compact),
    })
    return this._instances[canvasId]
  }

  _buildDatasets(themen, diagnosen, showVerlauf) {
    const val = s => s ?? 0
    if (!showVerlauf || diagnosen.length <= 1) {
      const d = diagnosen.at(-1)
      return [{
        label: 'Lernstand',
        data: themen.map(t => val(d.bewertungen.find(b => b.id === t.id)?.stufe)),
        backgroundColor: 'rgba(74,44,110,0.18)',
        borderColor: '#4A2C6E',
        borderWidth: 2,
        pointBackgroundColor: '#4A2C6E',
        pointRadius: 3,
        fill: true,
      }]
    }

    return diagnosen.slice(-5).map((d, i, arr) => {
      const p = (i + 1) / arr.length
      const isLatest = i === arr.length - 1
      return {
        label: new Date(d.datum).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
        data: themen.map(t => val(d.bewertungen.find(b => b.id === t.id)?.stufe)),
        backgroundColor: `rgba(74,44,110,${0.03 + 0.17 * p})`,
        borderColor: isLatest ? '#4A2C6E' : `rgba(74,44,110,${0.18 + 0.55 * p})`,
        borderWidth: isLatest ? 2 : 1,
        pointBackgroundColor: isLatest ? '#4A2C6E' : `rgba(74,44,110,${0.3 + 0.5 * p})`,
        pointRadius: isLatest ? 3 : 1.5,
        fill: true,
      }
    })
  }

  _klausurniveauLine(axisCount) {
    return {
      label: 'Klausurniveau (4)',
      data: new Array(axisCount).fill(4),
      backgroundColor: 'transparent',
      borderColor: 'rgba(26,92,58,0.45)',
      borderWidth: 1.5,
      borderDash: [5, 4],
      pointRadius: 0,
      fill: false,
      order: 99,
    }
  }

  _options(showLegend, compact) {
    return {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        r: {
          min: 0, max: 5,
          ticks: { stepSize: 1, display: false },
          grid: { color: 'rgba(74,44,110,0.09)' },
          angleLines: { color: 'rgba(74,44,110,0.09)' },
          pointLabels: { font: { size: compact ? 9 : 10, family: 'system-ui' }, color: '#1C1828' },
        },
      },
      plugins: {
        legend: {
          display: showLegend,
          labels: { font: { size: 10 }, boxWidth: 12, padding: 8 },
        },
        tooltip: {
          callbacks: {
            label: ctx => {
              const level = STUFEN[ctx.raw]
              return `${ctx.dataset.label}: ${level ? level.label : ctx.raw}`
            },
          },
        },
      },
    }
  }

  destroy(canvasId) {
    if (this._instances[canvasId]) {
      this._instances[canvasId].destroy()
      delete this._instances[canvasId]
    }
  }

  destroyAll() {
    Object.keys(this._instances).forEach(id => this.destroy(id))
  }
}

// Singleton used by app.js
const radar = new RadarManager()
