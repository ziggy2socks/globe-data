export default function Inspector({ data, onClose }) {
  return (
    <div style={{
      position: 'absolute',
      top: 24,
      right: 24,
      background: 'rgba(237, 236, 234, 0.95)',
      backdropFilter: 'blur(8px)',
      padding: '14px 18px',
      borderRadius: 4,
      border: '1px solid rgba(0,0,0,0.08)',
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 12,
      color: '#1a1a1a',
      lineHeight: 1.8,
      minWidth: 180,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontFamily: 'Barlow Condensed, sans-serif', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.5 }}>
        <span>INSPECT</span>
        <span style={{ cursor: 'pointer' }} onClick={onClose}>✕</span>
      </div>
      <div>LAT {data.lat}°</div>
      <div>LON {data.lon}°</div>
      <div>ELEV {data.elevation} km</div>
      {data.temp !== null && <div>TEMP {data.temp}°C</div>}
    </div>
  )
}
