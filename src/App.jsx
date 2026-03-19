import { useEffect, useRef } from 'react'
import * as Cesium from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import './cesium-overrides.css'

Cesium.Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ION_TOKEN

export default function App() {
  const containerRef = useRef(null)

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
      skyBox: false,
      contextOptions: { webgl: { alpha: true } },
    })

    // Step 1: remove satellite imagery, set grey globe
    v.imageryLayers.removeAll()
    v.scene.globe.baseColor = Cesium.Color.fromCssColorString('#d8d4cf')

    // Step 2: paper background (skyBox/skyAtmosphere disabled in constructor above)
    v.scene.sun.show = false
    v.scene.moon.show = false

    return () => { if (!v.isDestroyed()) v.destroy() }
  }, [])

  return <div ref={containerRef} style={{ width: '100vw', height: '100vh', background: '#edecea' }} />
}
