export default function WeekScrubber({ week, onChange, loading = false }) {
  // ISO week approximate date label (2024 reference)
  const weekLabel = (() => {
    const d = new Date(2024, 0, 1 + (week - 1) * 7)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  })()

  return (
    <div style={{
      position: 'absolute',
      bottom: 32,
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      background: 'rgba(237, 236, 234, 0.92)',
      backdropFilter: 'blur(8px)',
      padding: '10px 20px',
      borderRadius: 4,
      border: '1px solid rgba(0,0,0,0.08)',
      fontFamily: 'Barlow Condensed, sans-serif',
      fontSize: 13,
      color: '#1a1a1a',
      letterSpacing: '0.04em',
      userSelect: 'none',
      whiteSpace: 'nowrap',
    }}>
      <span style={{ opacity: 0.4, textTransform: 'uppercase', fontSize: 11 }}>2024</span>
      <input
        type="range"
        min={1}
        max={53}
        value={week}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: 200, accentColor: '#1a1a1a', cursor: 'pointer' }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 80 }}>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, opacity: 0.5 }}>
          W{String(week).padStart(2, '0')}
        </span>
        <span style={{ fontSize: 12 }}>{weekLabel}</span>
        {loading && (
          <span style={{ opacity: 0.4, fontSize: 11 }}>…</span>
        )}
      </div>
    </div>
  )
}
