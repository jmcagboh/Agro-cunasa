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

function Recenter({ lat, lon, zoom }: { lat: number; lon: number; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lon], zoom);
  }, [lat, lon, zoom, map]);
  return null;
}

export default function MapPicker({
  lat, lon, zoom, marked, onPick,
}: { lat: number; lon: number; zoom: number; marked: boolean; onPick: (lat: number, lon: number) => void }) {
  return (
    <MapContainer center={[lat, lon]} zoom={zoom} scrollWheelZoom className="h-[46vh] min-h-56 w-full rounded-xl sm:h-80">
      <TileLayer
        attribution='&copy; OpenStreetMap'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickCatch onPick={onPick} />
      <Recenter lat={lat} lon={lon} zoom={zoom} />
      {marked && <CircleMarker center={[lat, lon]} radius={9} pathOptions={{ color: "#2f5536", fillColor: "#d4a017", fillOpacity: 0.9 }} />}
    </MapContainer>
  );
}
