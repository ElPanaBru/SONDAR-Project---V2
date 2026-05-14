import { Routes, Route, useLocation } from "react-router-dom";
import Navbar from "./componentes/Navbar";
import Auth from "./paginas/Auth";
import Login from "./paginas/Login";
import Registro from "./paginas/Registro";
import Mapa from "./paginas/Mapa";
import Soporte from "./paginas/Soporte";
import Usuarios from "./paginas/Usuarios";
import Inicio from "./paginas/Inicio";
import Descubrir from "./paginas/Descubrir";
import Comunidad from "./paginas/Comunidad";

function App() {
  const location = useLocation();

  // rutas donde NO se muestra el navbar
  const hideNavbarRoutes = ["/", "/login", "/registro"];

  const shouldHideNavbar = hideNavbarRoutes.includes(location.pathname);

  return (
    <>
      {!shouldHideNavbar && <Navbar />}

      <Routes>
        <Route path="/inicio" element={<Inicio />} />
        <Route path="/soporte" element={<Soporte />} />
        <Route path="/" element={<Auth />} />
        <Route path="/login" element={<Login />} />
        <Route path="/registro" element={<Registro />} />
        <Route path="/mapa" element={<Mapa />} />
        <Route path="/usuarios" element={<Usuarios />} />
        <Route path="/descubrir" element={<Descubrir />} />
        <Route path="/comunidad" element={<Comunidad />} />
      </Routes>
    </>
  );
}

export default App;