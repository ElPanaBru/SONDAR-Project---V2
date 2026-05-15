import { Routes, Route, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./paginas/firebaseConfig";
import "./App.css";

import Navbar from "./componentes/Navbar";
import Auth from "./paginas/Auth";
import Soporte from "./paginas/Soporte";
import Eventos from "./paginas/Eventos";
import Descubrir from "./paginas/Descubrir";
import Comunidad from "./paginas/Comunidad";
import MiPerfil from "./paginas/MiPerfil";
import Configuracion from "./paginas/Configuracion";

function App() {
  const location = useLocation();
  const [usuario, setUsuario] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUsuario(user);
    });

    return () => unsubscribe();
  }, []);

  const hideNavbarRoutes = ["/auth", "/login", "/registro"];
  const shouldHideNavbar = hideNavbarRoutes.includes(location.pathname);

  return (
    <div className="app-container">
      {!shouldHideNavbar && <Navbar usuario={usuario} />}

      <div className={`main-content ${!shouldHideNavbar ? "with-navbar" : ""}`}>
        <Routes>
          <Route path="/" element={<Eventos usuario={usuario} />} />
          <Route path="/soporte" element={<Soporte />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/perfil" element={<MiPerfil usuario={usuario} />} />
          <Route path="/descubrir" element={<Descubrir usuario={usuario} />} />
          <Route path="/comunidad" element={<Comunidad usuario={usuario} />} />
          <Route path="/configuracion" element={<Configuracion usuario={usuario} />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
