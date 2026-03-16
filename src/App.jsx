import { useEffect, useRef, useState } from 'react'
import * as Cesium from 'cesium'
import { Viewer, Globe } from 'resium'
import WeekScrubber from './components/WeekScrubber.jsx'
import Inspector from './components/Inspector.jsx'
import { useTemperatureLayer } from './hooks/useTemperatureLayer.js'
import './cesium-overrides.css'

Cesium.Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ION_TOKEN

export default function App() {
  const viewerRef = useRef(null)
  const [viewerReady, setViewerReady] = useState(false)
  const [week, setWeek] = useState(14)  // start at ~April (spring thaw)
  const [inspecting, setInspecting] = useState(null)
  const [loading, setLoading] = useState(true)

  // Wire temperature layer
  const viewer = viewerRef.current?.cesiumElement ?? null
  useTemperatureLayer(viewerReady ? viewer : null, week)

  useEffect(() => {
    if (!viewerRef.current?.cesiumElement) return
    const v = viewerRef.current.cesiumElement

    // Strip sky / atmosphere
    v.scene.skyBox.show = false
    v.scene.sun.show = false
    v.scene.moon.show = false
    v.scene.skyAtmosphere.show = false
    v.scene.backgroundColor = Cesium.Color.fromCssColorString('#edecea')

    // Starting camera: slight tilt over North America
    v.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(-80, 30, 18000000),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-45),
        roll: 0,
      },
    })

    // Click-to-inspect
    const handler = new Cesium.ScreenSpaceEventHandler(v.scene.canvas)
    handler.setInputAction((click) => {
      const cartesian = v.camera.pickEllipsoid(click.position, v.scene.globe.ellipsoid)
      if (!cartesian) return
      const carto = Cesium.Cartographic.fromCartesian(cartesian)
      setInspecting({
        lat: Cesium.Math.toDegrees(carto.latitude).toFixed(3),
        lon: Cesium.Math.toDegrees(carto.longitude).toFixed(3),
        elevation: (carto.height / 1000).toFixed(1),
      })
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

    // Mark viewer ready after first render
    v.scene.globe.tileLoadProgressEvent.addEventListener((queueLength) => {
      if (queueLength === 0) setLoading(false)
    })

    setViewerReady(true)
    return () => handler.destroy()
  }, [])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Viewer
        ref={viewerRef}
        full
        animation={false}
        baseLayerPicker={false}
        fullscreenButton={false}
        geocoder={false}
        homeButton={false}
        infoBox={false}
        sceneModePicker={false}
        selectionIndicator={false}
        timeline={false}
        navigationHelpButton={false}
        creditContainer={document.createElement('div')}
      >
        <Globe
          enableLighting={false}
          baseColor={Cesium.Color.fromCssColorString('#d8d4cf')}
        />
      </Viewer>

      {/* Loading indicator */}
      {loading && (
        <div style={{
          position: 'absolute',
          top: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          fontFamily: 'Barlow Condensed, sans-serif',
          fontSize: 11,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: '#1a1a1a',
          opacity: 0.4,
        }}>
          Loading terrain…
        </div>
      )}

      <WeekScrubber week={week} onChange={setWeek} />
      {inspecting && <Inspector data={inspecting} onClose={() => setInspecting(null)} />}

      {/* Legend */}
      <TemperatureLegend />
    </div>
  )
}

function TemperatureLegend() {
  const stops = [
    { t: -30, label: '−30°', color: '#0D1A59' },
    { t: -10, label: '−10°', color: '#3359B3' },
    { t:   0, label:   '0°', color: '#D1E8F8' },
    { t:  10, label:  '10°', color: '#8DD17F' },
    { t:  20, label:  '20°', color: '#EBD047' },
    { t:  30, label:  '30°', color: '#E06019' },
  ]

  return (
    <div style={{
      position: 'absolute',
      bottom: 88,
      left: 24,
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      background: 'rgba(237,236,234,0.88)',
      backdropFilter: 'blur(6px)',
      padding: '10px 14px',
      borderRadius: 4,
      border: '1px solid rgba(0,0,0,0.07)',
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 11,
      color: '#1a1a1a',
    }}>
      <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.45, marginBottom: 4 }}>
        SOIL TEMP °C
      </div>
      {stops.map(({ t, label, color }) => (
        <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 12, height: 12, borderRadius: 2, background: color, flexShrink: 0 }} />
          <span style={{ opacity: 0.7 }}>{label}</span>
        </div>
      ))}
    </div>
  )
}
