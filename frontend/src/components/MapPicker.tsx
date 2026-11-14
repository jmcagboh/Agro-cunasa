import { useEffect, useState } from "react";
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
  const [satellite, setSatellite] = useState(true);
  return (
    <div className="relative">
      <div className="absolute right-2 top-2 z-[1000] flex overflow-hidden rounded-lg border border-stone-300 bg-white text-sm shadow">
        <button type="button" className={`px-3 py-2 ${satellite ? "bg-soil-900 text-white" : ""}`} onClick={() => setSatellite(true)}>Satellite</button>
        <button type="button" className={`px-3 py-2 ${satellite ? "" : "bg-soil-900 text-white"}`} onClick={() => setSatellite(false)}>Plan</button>
      </div>
      <MapContainer center={[lat, lon]} zoom={zoom} scrollWheelZoom className="h-[46vh] min-h-56 w-full rounded-xl sm:h-80">
        {satellite ? (
          <TileLayer
            attribution="Images &copy; Esri, Maxar, Earthstar Geographics"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19}
          />
        ) : (
          <TileLayer
            attribution="&copy; OpenStreetMap"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        )}
        <ClickCatch onPick={onPick} />
        <Recenter lat={lat} lon={lon} zoom={zoom} />
        {marked && <CircleMarker center={[lat, lon]} radius={9} pathOptions={{ color: "#f6f4ef", fillColor: "#d4a017", fillOpacity: 0.95, weight: 2 }} />}
      </MapContainer>
      <p className="mt-1 text-xs text-stone-500">
        {satellite
          ? "Image satellite réelle de ce lieu. La netteté dépend de la zone. Ce n’est pas une photo prise au sol."
          : "Plan des routes. Le bouton Satellite montre l’image réelle du lieu."}
      </p>
    </div>
  );
}
