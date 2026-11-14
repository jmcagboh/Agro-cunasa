import { useEffect } from "react";
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";

function ClickCatch({ onPick }: { onPick: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

function Recenter({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lon], Math.max(map.getZoom(), 5));
  }, [lat, lon, map]);
  return null;
}

export default function MapPicker({
  lat, lon, onPick,
}: { lat: number; lon: number; onPick: (lat: number, lon: number) => void }) {
  return (
    <MapContainer center={[lat, lon]} zoom={5} scrollWheelZoom className="h-64 w-full rounded-xl sm:h-80">
      <TileLayer
        attribution='&copy; OpenStreetMap'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickCatch onPick={onPick} />
      <Recenter lat={lat} lon={lon} />
      <CircleMarker center={[lat, lon]} radius={9} pathOptions={{ color: "#2f5536", fillColor: "#d4a017", fillOpacity: 0.9 }} />
    </MapContainer>
  );
}
