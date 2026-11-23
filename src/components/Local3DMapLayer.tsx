import React, { useMemo } from 'react';
import { LatLng } from '../types';

export type MapVisualStyle = 'realistic' | 'tech';

interface Local3DMapLayerProps {
  center: LatLng;
  zoom: number;
  rotationDeg: number; // 0 in North-Up, -userHeading in Heading-Up
  styleMode: MapVisualStyle;
  theme: 'dark' | 'light';
  is3D: boolean;
}

const TILE_SIZE = 256;

// Exact Web Mercator projection: LatLng -> continuous world tile coordinates at zoom z
function latLngToTileCoords(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const clampedLat = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const latRad = (clampedLat * Math.PI) / 180;
  const n = Math.pow(2, zoom);
  const x = ((lng + 180) / 360) * n;
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return { x, y };
}

function getTileUrls(
  x: number,
  y: number,
  z: number,
  styleMode: MapVisualStyle,
  theme: 'dark' | 'light'
): { baseUrl: string; labelUrl?: string } {
  const maxTile = Math.pow(2, z);
  const wrappedX = ((x % maxTile) + maxTile) % maxTile;
  const clampedY = Math.max(0, Math.min(maxTile - 1, y));
  const sub = ['a', 'b', 'c', 'd'][Math.abs(wrappedX + clampedY) % 4];

  if (styleMode === 'realistic') {
    // High-resolution satellite imagery + crisp street/neighborhood/park labels
    return {
      baseUrl: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${clampedY}/${wrappedX}`,
      labelUrl: `https://${sub}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/${z}/${wrappedX}/${clampedY}@2x.png`,
    };
  }

  // Technological Google Maps style: Dark Neon Matter or Light Tactical Voyager street/building map
  if (theme === 'light') {
    return {
      baseUrl: `https://${sub}.basemaps.cartocdn.com/rastertiles/voyager/${z}/${wrappedX}/${clampedY}@2x.png`,
    };
  }

  return {
    baseUrl: `https://${sub}.basemaps.cartocdn.com/dark_all/${z}/${wrappedX}/${clampedY}@2x.png`,
  };
}

export const Local3DMapLayer: React.FC<Local3DMapLayerProps> = ({
  center,
  zoom,
  rotationDeg,
  styleMode,
  theme,
  is3D,
}) => {
  // Clamp tile fetch zoom to 19 (max native imagery zoom) and scale smoothly if zoom === 20
  const tileZoom = Math.max(13, Math.min(19, Math.round(zoom)));
  const overZoomScale = Math.pow(2, zoom - tileZoom);

  // Use a 7x7 tile grid around user center so rotated 3D perspective never exposes empty corners
  const gridRadius = is3D ? 3 : 2;

  const tileData = useMemo(() => {
    const exact = latLngToTileCoords(center.lat, center.lng, tileZoom);
    const centerTileX = Math.floor(exact.x);
    const centerTileY = Math.floor(exact.y);
    const offsetPxX = (exact.x - centerTileX) * TILE_SIZE;
    const offsetPxY = (exact.y - centerTileY) * TILE_SIZE;

    const tiles: {
      key: string;
      left: number;
      top: number;
      baseUrl: string;
      labelUrl?: string;
    }[] = [];

    for (let dx = -gridRadius; dx <= gridRadius; dx++) {
      for (let dy = -gridRadius; dy <= gridRadius; dy++) {
        const tx = centerTileX + dx;
        const ty = centerTileY + dy;
        const urls = getTileUrls(tx, ty, tileZoom, styleMode, theme);
        tiles.push({
          key: `${tileZoom}_${tx}_${ty}_${styleMode}_${theme}`,
          left: dx * TILE_SIZE - offsetPxX,
          top: dy * TILE_SIZE - offsetPxY,
          baseUrl: urls.baseUrl,
          labelUrl: urls.labelUrl,
        });
      }
    }

    return tiles;
  }, [center.lat, center.lng, tileZoom, gridRadius, styleMode, theme]);

  // Subtle visual grading to make the Technological mode glow like a futuristic dark/light vector map
  const filterClass =
    styleMode === 'tech'
      ? theme === 'dark'
        ? 'brightness-110 contrast-125 saturate-150 hue-rotate-[165deg]'
        : 'contrast-105 saturate-110'
      : 'contrast-105 saturate-110';

  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none select-none"
      aria-hidden="true"
    >
      {/* Rotated & scaled exact-Web-Mercator tile plane centered on userPosition */}
      <div
        className={`absolute left-1/2 top-1/2 w-0 h-0 will-change-transform ${filterClass}`}
        style={{
          transform: `rotate(${rotationDeg}deg) scale(${overZoomScale})`,
        }}
      >
        {tileData.map((tile) => (
          <React.Fragment key={tile.key}>
            <img
              src={tile.baseUrl}
              alt=""
              draggable={false}
              loading="eager"
              decoding="async"
              className="absolute max-w-none block select-none pointer-events-none"
              style={{
                width: `${TILE_SIZE}px`,
                height: `${TILE_SIZE}px`,
                left: `${tile.left}px`,
                top: `${tile.top}px`,
              }}
            />
            {tile.labelUrl && (
              <img
                src={tile.labelUrl}
                alt=""
                draggable={false}
                loading="eager"
                decoding="async"
                className="absolute max-w-none block select-none pointer-events-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"
                style={{
                  width: `${TILE_SIZE}px`,
                  height: `${TILE_SIZE}px`,
                  left: `${tile.left}px`,
                  top: `${tile.top}px`,
                }}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Subtle tactical cyber-tint overlay on Tech Dark mode */}
      {styleMode === 'tech' && theme === 'dark' && (
        <div className="absolute inset-0 bg-cyan-950/25 mix-blend-color pointer-events-none" />
      )}
    </div>
  );
};
