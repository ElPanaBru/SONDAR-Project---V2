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
import Buscar from "./paginas/Buscar";
import Comunidad from "./paginas/Comunidad";
import MiPerfil from "./paginas/Miperfil";
import OtroPerfil from "./paginas/OtroPerfil";
import Configuracion from "./paginas/Configuracion";
import Mensajes from "./paginas/Mensajes";
import SidebarNav from "./componentes/SidebarNav";
import OnboardingPerfilModal from "./componentes/OnboardingPerfilModal";
import CrearReelModal from "./componentes/CrearReelModal";
import { PreferenciasProvider } from "./contextos/PreferenciasContext";

function App() {
  const location = useLocation();
  const [usuario, setUsuario] = useState(null);
  const [onboardingToken, setOnboardingToken] = useState(null);
  const [mostrarCrearReel, setMostrarCrearReel] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUsuario(data.session?.user || null);
      if (data.session && window.localStorage.getItem("sondar:onboarding-pending") === "true") {
        setOnboardingToken(data.session.access_token);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUsuario(session?.user || null);
      if (!session) setOnboardingToken(null);
      if (session && window.localStorage.getItem("sondar:onboarding-pending") === "true") {
        setOnboardingToken(session.access_token);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (location.pathname === "/auth") return;
    if (window.localStorage.getItem("sondar:onboarding-pending") !== "true") return;

    let activo = true;
    supabase.auth.getSession().then(({ data }) => {
      if (activo && data.session) setOnboardingToken(data.session.access_token);
    });
    return () => { activo = false; };
  }, [location.pathname]);

  const hideNavbarRoutes = ["/auth"];
  const shouldHideNavbar = hideNavbarRoutes.includes(location.pathname);
  const isDescubrirRoute = location.pathname === "/descubrir";
  const isBuscarRoute = location.pathname === "/buscar";
  const isAuthRoute = location.pathname === "/auth";

  return (
    <PreferenciasProvider usuario={usuario}>
    <div className="app-container">
      {!shouldHideNavbar && <Navbar usuario={usuario} onCrearReel={() => setMostrarCrearReel(true)} />}
      {!shouldHideNavbar && <SidebarNav usuario={usuario} />}

      <div
        className={`main-content ${!shouldHideNavbar ? "with-navbar with-sidebar" : ""} ${
          isDescubrirRoute ? "descubrir-content" : ""
        } ${
          isBuscarRoute ? "buscar-content" : ""
        } ${
          isAuthRoute ? "auth-content" : ""
        }`}
      >
        <Routes>
          <Route path="/" element={<Eventos usuario={usuario} />} />
          <Route path="/soporte" element={<Soporte usuario={usuario} />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/perfil" element={<MiPerfil usuario={usuario} />} />
          <Route path="/perfil/:usuario" element={<OtroPerfil usuarioActual={usuario} />} />
          <Route path="/buscar" element={<Buscar usuario={usuario} />} />
          <Route path="/descubrir" element={<Descubrir usuario={usuario} />} />
          <Route path="/comunidad" element={<Comunidad usuario={usuario} />} />
          <Route path="/configuracion" element={<Configuracion usuario={usuario} />} />
          <Route path="/mensajes" element={<Mensajes usuario={usuario} />} />
        </Routes>
      </div>

      {usuario && onboardingToken && location.pathname !== "/auth" ? (
        <OnboardingPerfilModal
          token={onboardingToken}
          username={usuario.user_metadata?.username || usuario.email?.split("@")[0]}
          onComplete={() => {
            window.localStorage.removeItem("sondar:onboarding-pending");
            setOnboardingToken(null);
          }}
        />
      ) : null}
      {usuario && location.pathname !== "/auth" ? (
        <CrearReelModal
          abierto={mostrarCrearReel}
          usuario={usuario}
          onClose={() => setMostrarCrearReel(false)}
        />
      ) : null}
    </div>
    </PreferenciasProvider>
  );
}

export default App;
