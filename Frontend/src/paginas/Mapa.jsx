import { useEffect } from "react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

export default function Mapa() {
  useEffect(() => {
    const map = L.map("map").setView([-34.6037, -58.3816], 13);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    L.marker([-34.6037, -58.3816]).addTo(map).bindPopup("Ejemplo de bar").openPopup();

    return () => {
      map.remove();
    };
  }, []);

  return <div id="map" style={{ height: "90vh" }}></div>;
}
