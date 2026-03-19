import { useEffect, useRef, useState } from 'react'
import * as Cesium from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import WeekScrubber from './components/WeekScrubber.jsx'
import Inspector from './components/Inspector.jsx'
import { useTemperatureLayer } from './hooks/useTemperatureLayer.js'
import './cesium-overrides.css'

Cesium.Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ION_TOKEN

export default function App() {
  const containerRef = useRef(null)
  const [viewer, setViewer] = useState(null)
  const [week, setWeek] = useState(14)
  const [inspecting, setInspecting] = useState(null)

  useTemperatureLayer(viewer, week)

  useEffect(() => {
    const v = new Cesium.Viewer(containerRef.current, {
      animation: false,
      baseLayerPicker: false,
      fullscreenButton: false,
      geocoder: false,
      homeButton: false,
      infoBox: false,
      sceneModePicker: false,
      selectionIndicator: false,
      timeline: false,
      navigationHelpButton: false,
      creditContainer: document.createElement('div'),
    })

    // Aesthetic
    v.scene.skyBox.show = false
    v.scene.sun.show = false
    v.scene.moon.show = false
    v.scene.skyAtmosphere.show = false
    v.scene.backgroundColor = Cesium.Color.fromCssColorString('#edecea')
    v.scene.globe.enableLighting = false

    // Remove default imagery, set our grey base
    v.imageryLayers.removeAll()
    v.imageryLayers.addImageryProvider(
      new Cesium.SingleTileImageryProvider({
        url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        rectangle: Cesium.Rectangle.fromDegrees(-180, -90, 180, 90),
      })
    )
    v.scene.globe.baseColor = Cesium.Color.fromCssColorString('#d8d4cf')

    // Camera
    v.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(-80, 30, 18000000),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-45),
        roll: 0,
      },
    })

    // Click inspector
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

    setViewer(v)
    return () => {
      handler.destroy()
      if (!v.isDestroyed()) v.destroy()
    }
  }, [])

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#edecea' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      <WeekScrubber week={week} onChange={setWeek} />
      {inspecting && <Inspector data={inspecting} onClose={() => setInspecting(null)} />}
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
      position: 'absolute', bottom: 88, left: 24,
      display: 'flex', flexDirection: 'column', gap: 4,
      background: 'rgba(237,236,234,0.88)', backdropFilter: 'blur(6px)',
      padding: '10px 14px', borderRadius: 4,
      border: '1px solid rgba(0,0,0,0.07)',
      fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#1a1a1a',
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
