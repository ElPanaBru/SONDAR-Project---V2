import { Routes, Route, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import "./App.css";
import "./paginas/otroperfil.css";

import Navbar from "./componentes/Navbar";
import Auth from "./paginas/Auth";
import Soporte from "./paginas/Soporte";
import Eventos from "./paginas/Eventos";
import Descubrir from "./paginas/Descubrir";
import Comunidad from "./paginas/Comunidad";
import MiPerfil from "./paginas/Miperfil";
import OtroPerfil from "./paginas/OtroPerfil";
import Configuracion from "./paginas/Configuracion";
import SidebarNav from "./componentes/SidebarNav";

function App() {
  const location = useLocation();
  const [usuario, setUsuario] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUsuario(data.session?.user || null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUsuario(session?.user || null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const hideNavbarRoutes = ["/auth"];
  const shouldHideNavbar = hideNavbarRoutes.includes(location.pathname);
  const isDescubrirRoute = location.pathname === "/descubrir";

  return (
    <div className="app-container">
      {!shouldHideNavbar && <Navbar usuario={usuario} />}
      {!shouldHideNavbar && <SidebarNav usuario={usuario} />}

      <div
        className={`main-content ${!shouldHideNavbar ? "with-navbar with-sidebar" : ""} ${
          isDescubrirRoute ? "descubrir-content" : ""
        }`}
      >
        <Routes>
          <Route path="/" element={<Eventos usuario={usuario} />} />
          <Route path="/soporte" element={<Soporte />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/perfil" element={<MiPerfil usuario={usuario} />} />
          <Route path="/perfil/:usuario" element={<OtroPerfil />} />
          <Route path="/descubrir" element={<Descubrir usuario={usuario} />} />
          <Route path="/comunidad" element={<Comunidad usuario={usuario} />} />
          <Route path="/configuracion" element={<Configuracion usuario={usuario} />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
