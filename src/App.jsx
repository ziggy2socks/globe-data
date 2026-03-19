import { useCallback, useEffect, useRef, useState } from 'react'
import * as Cesium from 'cesium'
import { Viewer, Globe } from 'resium'
import WeekScrubber from './components/WeekScrubber.jsx'
import Inspector from './components/Inspector.jsx'
import { useTemperatureLayer } from './hooks/useTemperatureLayer.js'
import './cesium-overrides.css'

Cesium.Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ION_TOKEN

export default function App() {
  // Use a state-based viewer ref so changes trigger re-render
  const [viewer, setViewer] = useState(null)
  const viewerRef = useRef(null)
  const [week, setWeek] = useState(14)
  const [inspecting, setInspecting] = useState(null)
  const [loading, setLoading] = useState(true)

  // Temperature layer — only activates once viewer is in state
  useTemperatureLayer(viewer, week)

  // Callback ref: fires when Resium mounts the viewer component
  const setViewerRef = useCallback((node) => {
    viewerRef.current = node
    if (node?.cesiumElement) {
      setViewer(node.cesiumElement)
    }
  }, [])

  useEffect(() => {
    if (!viewer) return

    // Strip sky / atmosphere for paper look
    try {
      viewer.scene.skyBox.show = false
      viewer.scene.sun.show = false
      viewer.scene.moon.show = false
      viewer.scene.skyAtmosphere.show = false
      viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#edecea')
    } catch (e) {
      // scene may not be ready on first call; Cesium handles this gracefully
    }

    // Starting camera: tilted view centered on North America
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(-80, 30, 18000000),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-45),
        roll: 0,
      },
    })

    // Click-to-inspect
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
    handler.setInputAction((click) => {
      const cartesian = viewer.camera.pickEllipsoid(click.position, viewer.scene.globe.ellipsoid)
      if (!cartesian) return
      const carto = Cesium.Cartographic.fromCartesian(cartesian)
      setInspecting({
        lat: Cesium.Math.toDegrees(carto.latitude).toFixed(3),
        lon: Cesium.Math.toDegrees(carto.longitude).toFixed(3),
        elevation: (carto.height / 1000).toFixed(1),
      })
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

    // Track tile loading
    const tileListener = viewer.scene.globe.tileLoadProgressEvent.addEventListener((q) => {
      if (q === 0) setLoading(false)
    })

    return () => {
      handler.destroy()
      tileListener()
    }
  }, [viewer])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Viewer
        ref={setViewerRef}
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
        imageryProvider={false}
      >
        <Globe
          enableLighting={false}
          baseColor={Cesium.Color.fromCssColorString('#d8d4cf')}
        />
      </Viewer>

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
          pointerEvents: 'none',
        }}>
          Loading terrain…
        </div>
      )}

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
