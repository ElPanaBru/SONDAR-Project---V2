import { useEffect } from "react";
import "leaflet/dist/leaflet.css";

export default function Mapa() {

  useEffect(() => {
    const map = window.L.map("map").setView([-34.6037, -58.3816], 13);

    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors"
    }).addTo(map);

    window.L.marker([-34.6037, -58.3816])
      .addTo(map)
      .bindPopup("Ejemplo de bar")
      .openPopup();

    return () => {
      map.remove();
    };
  }, []);

  return (
    <div id="map" style={{ height: "90vh" }}></div>
  );
}