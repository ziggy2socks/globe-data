#!/usr/bin/env python3
"""
ERA5 soil temperature → weekly GeoTIFF pipeline for Cesium
Converts monthly ERA5 NetCDF data to 53 weekly GeoTIFF files
Output: public/data/era5/week_XX.tif (float32, EPSG:4326, Celsius)

Usage:
  python3 scripts/era5_to_geotiff.py --year 2024
  python3 scripts/era5_to_geotiff.py --year 2024 --out public/data/era5
"""

import argparse
import os
import sys
import numpy as np
from pathlib import Path

# ERA5 data is at monthly resolution; we interpolate to weekly
# Data source: projects/datamap/data/era5-raw/era5_{year}_extracted/data_stream-moda.nc

ERA5_BASE = Path('/home/zig19/.openclaw/workspace/projects/datamap/data/era5-raw')
SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent


def check_deps():
    """Check that required packages are available."""
    missing = []
    try:
        import netCDF4
    except ImportError:
        missing.append('netCDF4')
    try:
        import rasterio
        from rasterio.transform import from_bounds
    except ImportError:
        missing.append('rasterio')
    try:
        import numpy
    except ImportError:
        missing.append('numpy')
    
    if missing:
        print(f"Missing packages: {', '.join(missing)}")
        print(f"Install with: pip install {' '.join(missing)}")
        sys.exit(1)


def get_nc_path(year):
    """Get the NetCDF file path for a given year."""
    path = ERA5_BASE / f'era5_{year}_extracted' / 'data_stream-moda.nc'
    if not path.exists():
        print(f"ERROR: NetCDF not found: {path}")
        print(f"Available years:")
        for p in ERA5_BASE.glob('era5_*_extracted'):
            print(f"  {p.name}")
        sys.exit(1)
    return path


def month_to_week_weights(month_idx, total_weeks=53):
    """
    Map month index (0-11) to fractional week position.
    Month midpoints: Jan=2, Feb=6, Mar=10, ..., Dec=50
    Returns (week_start, week_end) range this month covers.
    """
    # Distribute 53 weeks across 12 months
    # Each month spans ~4.4 weeks; assign month i to weeks around its midpoint
    weeks_per_month = total_weeks / 12.0
    mid = (month_idx + 0.5) * weeks_per_month
    return mid


def interpolate_monthly_to_weekly(monthly_data, n_weeks=53):
    """
    Interpolate monthly data (12, lat, lon) → weekly (n_weeks, lat, lon)
    Uses linear interpolation between monthly midpoints.
    """
    n_months = monthly_data.shape[0]
    lat_size = monthly_data.shape[1]
    lon_size = monthly_data.shape[2]

    # Month midpoints in week-space (0-based week fractions)
    weeks_per_month = n_weeks / 12.0
    month_midpoints = [(i + 0.5) * weeks_per_month for i in range(n_months)]

    # Week center positions (1-based: week 1..53, centers at 0.5..52.5)
    week_centers = [i + 0.5 for i in range(n_weeks)]

    print(f"  Interpolating {n_months} months → {n_weeks} weeks...")
    print(f"  Month midpoints (week-space): {[f'{m:.1f}' for m in month_midpoints]}")

    # Interpolate each pixel column (month axis) → week axis
    # np.interp doesn't broadcast over fp; use scipy or manual linear interp
    flat = monthly_data.reshape(n_months, -1).astype(np.float64)  # (12, lat*lon)
    week_centers_arr = np.array(week_centers)
    month_mid_arr = np.array(month_midpoints)

    # Manual vectorized linear interpolation:
    # For each week position, find bracketing months and blend
    weekly_flat = np.zeros((n_weeks, flat.shape[1]), dtype=np.float32)
    for i, wc in enumerate(week_centers):
        # Find left bracket
        idx = np.searchsorted(month_mid_arr, wc) - 1
        idx = np.clip(idx, 0, n_months - 2)
        idx_r = idx + 1
        t = (wc - month_mid_arr[idx]) / (month_mid_arr[idx_r] - month_mid_arr[idx])
        t = np.clip(t, 0.0, 1.0)
        weekly_flat[i] = (flat[idx] * (1 - t) + flat[idx_r] * t).astype(np.float32)

    return weekly_flat.reshape(n_weeks, lat_size, lon_size)


def write_geotiff(data_2d, lat_arr, lon_arr, out_path, week_num, year):
    """
    Write a single 2D float32 array as a GeoTIFF.
    data_2d: (lat, lon) array in Celsius
    lat_arr: 1D latitude array (descending, e.g. 90..-90)
    lon_arr: 1D longitude array (ascending, e.g. -180..180 or 0..360)
    """
    import rasterio
    from rasterio.transform import from_bounds
    from rasterio.crs import CRS

    lat_min = float(lat_arr.min())
    lat_max = float(lat_arr.max())
    
    # ERA5 longitude may be 0..360; convert to -180..180
    lon_arr = lon_arr.copy()
    if lon_arr.max() > 180:
        lon_arr = np.where(lon_arr > 180, lon_arr - 360, lon_arr)
        # Reorder data to match recentered lon
        # Split at 180° and swap halves
        split_idx = np.searchsorted(lon_arr, 0)
        data_2d = np.roll(data_2d, -split_idx, axis=1)
        lon_arr = np.roll(lon_arr, -split_idx)
    
    lon_min = float(lon_arr.min())
    lon_max = float(lon_arr.max())

    height, width = data_2d.shape

    # ERA5 latitude is typically descending (90 → -90)
    # rasterio expects data from top (max lat) to bottom (min lat)
    if lat_arr[0] < lat_arr[-1]:
        # ascending — flip
        data_2d = np.flipud(data_2d)

    transform = from_bounds(lon_min, lat_min, lon_max, lat_max, width, height)

    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    with rasterio.open(
        out_path,
        'w',
        driver='GTiff',
        height=height,
        width=width,
        count=1,
        dtype='float32',
        crs=CRS.from_epsg(4326),
        transform=transform,
        compress='lzw',  # lossless, ~3x smaller
        tiled=True,
        blockxsize=256,
        blockysize=256,
    ) as dst:
        dst.write(data_2d.astype(np.float32), 1)
        dst.update_tags(
            year=str(year),
            week=str(week_num),
            variable='soil_temperature_level_1',
            units='celsius',
            source='ERA5 monthly reanalysis (interpolated to weekly)',
        )

    size_kb = os.path.getsize(out_path) / 1024
    print(f"  → {out_path.name} ({size_kb:.0f} KB)")


def main():
    parser = argparse.ArgumentParser(description='ERA5 → GeoTIFF weekly pipeline')
    parser.add_argument('--year', type=int, default=2024, help='Year to process (default: 2024)')
    parser.add_argument('--out', type=str, default=None, help='Output directory (default: public/data/era5)')
    parser.add_argument('--weeks', type=int, default=53, help='Number of weeks (default: 53)')
    parser.add_argument('--downsample', type=int, default=4,
                        help='Downsample factor (default: 4 = 0.1° → 0.4°, manageable file size)')
    args = parser.parse_args()

    check_deps()
    import netCDF4 as nc

    out_dir = Path(args.out) if args.out else PROJECT_DIR / 'public' / 'data' / 'era5'
    out_dir.mkdir(parents=True, exist_ok=True)

    nc_path = get_nc_path(args.year)
    print(f"\nProcessing: {nc_path}")
    print(f"Output:     {out_dir}")
    print(f"Year:       {args.year}, Weeks: {args.weeks}, Downsample: {args.downsample}x\n")

    # Load NetCDF
    ds = nc.Dataset(nc_path)
    stl1 = ds.variables['stl1'][:]         # (12, lat, lon) in Kelvin
    lats = ds.variables['latitude'][:]      # (1801,)
    lons = ds.variables['longitude'][:]     # (3600,)
    times = ds.variables['valid_time'][:]   # (12,) unix timestamps
    ds.close()

    print(f"Data shape: {stl1.shape}, lat: {lats[0]:.1f}..{lats[-1]:.1f}, lon: {lons[0]:.1f}..{lons[-1]:.1f}")

    # Kelvin → Celsius
    celsius = stl1.data.astype(np.float32) - 273.15
    celsius = np.where(stl1.mask if hasattr(stl1, 'mask') else False, np.nan, celsius)

    # Downsample (1801x3600 is huge for static files; downsample for Phase 1)
    if args.downsample > 1:
        d = args.downsample
        celsius = celsius[:, ::d, ::d]
        lats = lats[::d]
        lons = lons[::d]
        print(f"Downsampled to: {celsius.shape[1]}x{celsius.shape[2]}")

    # Interpolate monthly → weekly
    weekly = interpolate_monthly_to_weekly(celsius, n_weeks=args.weeks)
    print(f"Weekly shape: {weekly.shape}  ({weekly.min():.1f}°C .. {weekly.max():.1f}°C)")

    # Write each week as a GeoTIFF
    print(f"\nWriting {args.weeks} GeoTIFF files...")
    for week_idx in range(args.weeks):
        week_num = week_idx + 1  # 1-based
        out_path = out_dir / f'week_{week_num:02d}.tif'
        write_geotiff(weekly[week_idx], lats, lons, out_path, week_num, args.year)

    print(f"\n✓ Done. {args.weeks} GeoTIFFs written to {out_dir}")
    
    # Print total size
    total_bytes = sum(f.stat().st_size for f in out_dir.glob('week_*.tif'))
    print(f"  Total size: {total_bytes / 1024 / 1024:.1f} MB")
    print(f"\nNext: Load in Cesium via SingleTileImageryProvider or UrlTemplateImageryProvider")


if __name__ == '__main__':
    main()
