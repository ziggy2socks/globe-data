import { useEffect, useRef } from 'react'
import * as Cesium from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'

Cesium.Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ION_TOKEN

export default function App() {
  const containerRef = useRef(null)

  useEffect(() => {
    const viewer = new Cesium.Viewer(containerRef.current)
    return () => { if (!viewer.isDestroyed()) viewer.destroy() }
  }, [])

  return <div ref={containerRef} style={{ width: '100vw', height: '100vh' }} />
}
