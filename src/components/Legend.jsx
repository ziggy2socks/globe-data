/**
 * Temperature color legend — bottom right
 * Matches the TEMP_RAMP color stops from App.jsx
 */
export default function Legend({ ramp }) {
  const labels = ramp.filter((_, i) => i % 2 === 0) // every other stop

  // Build CSS gradient string
  const gradientStops = ramp.map(([temp, r, g, b]) => {
    const pct = Math.max(0, Math.min(100, ((temp + 40) / 90) * 100))
    return `rgb(${r},${g},${b}) ${pct.toFixed(1)}%`
  }).join(', ')

  return (
    <div style={{
      position: 'absolute',
      bottom: 90,
      right: 24,
      width: 140,
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 11,
      color: '#1a1a1a',
      userSelect: 'none',
    }}>
      {/* Title */}
      <div style={{
        fontFamily: 'Barlow Condensed, sans-serif',
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        opacity: 0.5,
        marginBottom: 6,
      }}>
        SOIL TEMP °C
      </div>

      {/* Gradient bar */}
      <div style={{
        height: 8,
        borderRadius: 2,
        background: `linear-gradient(to right, ${gradientStops})`,
        marginBottom: 4,
      }} />

      {/* Labels */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        opacity: 0.6,
      }}>
        <span>−30</span>
        <span>0</span>
        <span>+35</span>
      </div>
    </div>
  )
}
