"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import mapboxgl from "mapbox-gl";
import { useEffect, useRef } from "react";

type Place = {
  id: string;
  name: string;
  url?: string;
  phone?: string;
  rating?: number;
  reviewCount?: number;
  distanceMeters?: number;
  location?: { display_address?: string[] };
  coordinates?: { latitude: number; longitude: number };
  categories?: string[];
};

export default function DonationsMap({
  center,
  places,
}: {
  center: { lat: number; lng: number };
  places: Place[];
}) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapObjRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  useEffect(() => {
    if (!mapRef.current) return;

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

    if (!mapboxgl.accessToken) {
      console.warn("Missing NEXT_PUBLIC_MAPBOX_TOKEN");
      return;
    }

    // init map once
    if (!mapObjRef.current) {
      mapObjRef.current = new mapboxgl.Map({
        container: mapRef.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [center.lng, center.lat],
        zoom: 12,
      });

      mapObjRef.current.addControl(new mapboxgl.NavigationControl(), "top-right");
    } else {
      mapObjRef.current.setCenter([center.lng, center.lat]);
    }

    const map = mapObjRef.current;

    // clear old markers
    for (const m of markersRef.current) m.remove();
    markersRef.current = [];

    // center marker
    const centerMarker = new mapboxgl.Marker({ color: "#111" })
      .setLngLat([center.lng, center.lat])
      .setPopup(new mapboxgl.Popup().setHTML(`<b>Your location</b>`))
      .addTo(map);
    markersRef.current.push(centerMarker);

    // place markers
    for (const p of places) {
      if (!p.coordinates) continue;

      const addr = p.location?.display_address?.join("<br/>") ?? "";
      const cats = (p.categories ?? []).slice(0, 3).join(", ");
      const rating = p.rating ? `⭐ ${p.rating} (${p.reviewCount ?? 0})` : "";

      const html = `
        <div style="min-width:220px">
          <div style="font-weight:700">${p.name}</div>
          <div style="font-size:12px;opacity:.8;margin-top:4px">${cats}</div>
          <div style="font-size:12px;margin-top:4px">${rating}</div>
          <div style="font-size:12px;margin-top:6px">${addr}</div>
          ${p.url ? `<div style="margin-top:8px"><a href="${p.url}" target="_blank" rel="noreferrer">View on Yelp</a></div>` : ""}
        </div>
      `;

      const marker = new mapboxgl.Marker()
        .setLngLat([p.coordinates.longitude, p.coordinates.latitude])
        .setPopup(new mapboxgl.Popup({ maxWidth: "280px" }).setHTML(html))
        .addTo(map);

      markersRef.current.push(marker);
    }
  }, [center.lat, center.lng, places]);

  return (
    <div
      ref={mapRef}
      style={{
        width: "100%",
        height: 420,
        borderRadius: 12,
        border: "1px solid #ddd",
        overflow: "hidden",
      }}
    />
  );
}
