import { useEffect, useRef } from 'react'
import * as Cesium from 'cesium'

// Temperature color ramp: value (°C) → RGBA
// Matches our Three.js globe palette
const COLOR_STOPS = [
  { t: -55, r: 0.02, g: 0.03, b: 0.15 }, // deep arctic navy
  { t: -30, r: 0.05, g: 0.10, b: 0.35 }, // cold blue
  { t: -10, r: 0.20, g: 0.35, b: 0.70 }, // blue
  { t:   0, r: 0.82, g: 0.91, b: 0.97 }, // frost white / ice
  { t:   8, r: 0.55, g: 0.82, b: 0.50 }, // spring green
  { t:  18, r: 0.92, g: 0.82, b: 0.28 }, // warm yellow
  { t:  30, r: 0.88, g: 0.38, b: 0.10 }, // heat orange
  { t:  45, r: 0.60, g: 0.08, b: 0.03 }, // extreme heat red
]

function lerpColor(t, stops) {
  if (t <= stops[0].t) return stops[0]
  if (t >= stops[stops.length - 1].t) return stops[stops.length - 1]
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i].t && t <= stops[i + 1].t) {
      const frac = (t - stops[i].t) / (stops[i + 1].t - stops[i].t)
      return {
        r: stops[i].r + (stops[i + 1].r - stops[i].r) * frac,
        g: stops[i].g + (stops[i + 1].g - stops[i].g) * frac,
        b: stops[i].b + (stops[i + 1].b - stops[i].b) * frac,
      }
    }
  }
  return stops[stops.length - 1]
}

/**
 * Custom Cesium ImageryProvider that fetches a GeoTIFF week file,
 * decodes it client-side, and paints temperature colors onto canvas tiles.
 *
 * Phase 1 approach: SingleTileImageryProvider — loads one PNG per week.
 * We pre-render the GeoTIFF data into a canvas-based PNG on load.
 *
 * Phase 2: Replace with GeoTIFF tile streaming via geotiff.js + COG.
 */

/**
 * Renders a temperature GeoTIFF file into a canvas ImageData.
 * Returns a Promise<HTMLCanvasElement>.
 */
async function renderGeoTiffToCanvas(url) {
  // Dynamically import geotiff.js (must be installed)
  const GeoTIFF = await import('geotiff')
  const tiff = await GeoTIFF.fromUrl(url)
  const image = await tiff.getImage()
  const [data] = await image.readRasters({ interleave: false })

  const width = image.getWidth()
  const height = image.getHeight()

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  const imageData = ctx.createImageData(width, height)
  const pixels = imageData.data

  for (let i = 0; i < data.length; i++) {
    const val = data[i]
    const pi = i * 4

    if (!isFinite(val) || val < -200 || val > 100) {
      // Ocean / nodata — transparent
      pixels[pi] = 0
      pixels[pi + 1] = 0
      pixels[pi + 2] = 0
      pixels[pi + 3] = 0
    } else {
      const c = lerpColor(val, COLOR_STOPS)
      pixels[pi]     = Math.round(c.r * 255)
      pixels[pi + 1] = Math.round(c.g * 255)
      pixels[pi + 2] = Math.round(c.b * 255)
      pixels[pi + 3] = 220  // slight transparency so terrain shows through
    }
  }

  ctx.putImageData(imageData, 0, 0)
  return canvas
}

/**
 * Hook: manages a Cesium imagery layer that swaps week files.
 * @param {Cesium.Viewer} viewer - Cesium viewer instance
 * @param {number} week - current week (1-53)
 */
export function useTemperatureLayer(viewer, week) {
  const layerRef = useRef(null)
  const cacheRef = useRef({}) // canvas cache by week

  useEffect(() => {
    if (!viewer) return

    const weekStr = String(week).padStart(2, '0')
    const url = `/data/era5/week_${weekStr}.tif`

    async function loadWeek() {
      // Use cache if available
      let canvas = cacheRef.current[week]
      if (!canvas) {
        try {
          canvas = await renderGeoTiffToCanvas(url)
          cacheRef.current[week] = canvas
        } catch (err) {
          console.warn(`Failed to load week ${week}:`, err)
          return
        }
      }

      // Convert canvas to blob URL for SingleTileImageryProvider
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
      const blobUrl = URL.createObjectURL(blob)

      // Remove previous layer
      if (layerRef.current) {
        viewer.imageryLayers.remove(layerRef.current, true)
        layerRef.current = null
      }

      // Add new layer
      const provider = new Cesium.SingleTileImageryProvider({
        url: blobUrl,
        rectangle: Cesium.Rectangle.fromDegrees(-180, -90, 180, 90),
      })

      const layer = viewer.imageryLayers.addImageryProvider(provider)
      layer.alpha = 0.85
      layer.brightness = 1.0
      layerRef.current = layer
    }

    loadWeek()
  }, [viewer, week])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (layerRef.current && viewer && !viewer.isDestroyed()) {
        viewer.imageryLayers.remove(layerRef.current, true)
      }
    }
  }, [viewer])
}
