"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import mapboxgl from "mapbox-gl";
import { useEffect, useRef } from "react";
import "./sustainability.css";

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

  // 1) Init map ONCE
  useEffect(() => {
    if (!mapRef.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      console.warn("Missing NEXT_PUBLIC_MAPBOX_TOKEN");
      return;
    }
    mapboxgl.accessToken = token;

    // Prevent double-init (important for React strict mode)
    if (mapObjRef.current) return;

    const map = new mapboxgl.Map({
      container: mapRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [center.lng, center.lat],
      zoom: 12,
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    // fixes “blank map” when container mounts small
    map.on("load", () => map.resize());

    mapObjRef.current = map;

    // Cleanup on unmount
    return () => {
      for (const m of markersRef.current) m.remove();
      markersRef.current = [];
      map.remove();
      mapObjRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) Update center when it changes
  useEffect(() => {
    const map = mapObjRef.current;
    if (!map) return;
    map.setCenter([center.lng, center.lat]);
  }, [center.lat, center.lng]);

  // 3) Update markers when places/center change
  useEffect(() => {
    const map = mapObjRef.current;
    if (!map) return;

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
        <div class="sus-popup" style="min-width:220px">
          <div style="font-weight:800">${p.name}</div>
          ${cats ? `<div style="font-size:12px;opacity:.85;margin-top:4px">${cats}</div>` : ""}
          ${rating ? `<div style="font-size:12px;opacity:.9;margin-top:4px">${rating}</div>` : ""}
          ${addr ? `<div style="font-size:12px;opacity:.9;margin-top:6px">${addr}</div>` : ""}
          ${
            p.url
              ? `<div style="margin-top:8px"><a href="${p.url}" target="_blank" rel="noreferrer">Website</a></div>`
              : ""
          }
        </div>
      `;

      const marker = new mapboxgl.Marker()
        .setLngLat([p.coordinates.longitude, p.coordinates.latitude])
        .setPopup(new mapboxgl.Popup({ maxWidth: "280px" }).setHTML(html))
        .addTo(map);

      markersRef.current.push(marker);
    }
  }, [center.lat, center.lng, places]);

  // IMPORTANT: this div must ONLY be the map container
  return <div ref={mapRef} className="sus-map" />;
}
