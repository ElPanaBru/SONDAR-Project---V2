import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import { apiRequest } from "./lib/api";
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

import "./componentes/navigationExperiment.css";

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState(null);
  const [sessionToken, setSessionToken] = useState(null);
  const [onboardingToken, setOnboardingToken] = useState(null);
  const [mostrarCrearReel, setMostrarCrearReel] = useState(false);

  const abrirCrearPreview = useCallback(() => {
    window.dispatchEvent(new CustomEvent("sondar:cerrar-crear-evento"));
    navigate("/descubrir");
    setMostrarCrearReel(true);
  }, [navigate]);

  useEffect(() => {
    let activo = true;
    const actualizarSesion = (session) => {
      if (!activo) return;
      setUsuario(session?.user || null);
      setSessionToken(session?.access_token || null);
      if (!session) setOnboardingToken(null);
    };
    supabase.auth.getSession().then(({ data }) => actualizarSesion(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      actualizarSesion(session);
    });
    return () => {
      activo = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!sessionToken || location.pathname === "/auth") return;
    const controller = new AbortController();
    const comprobarPerfil = async () => {
      try {
        const response = await apiRequest("/api/usuarios/me", {
          headers: { Authorization: "Bearer " + sessionToken },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("No se pudo consultar la configuracion del perfil.");
        const perfil = await response.json();
        if (!controller.signal.aborted) {
          setOnboardingToken(perfil.existe && !perfil.user.onboarding_completed ? sessionToken : null);
        }
      } catch (error) {
        if (!controller.signal.aborted) console.error("Error consultando onboarding:", error);
      }
    };
    comprobarPerfil();
    window.addEventListener("focus", comprobarPerfil);
    window.addEventListener("online", comprobarPerfil);
    return () => {
      controller.abort();
      window.removeEventListener("focus", comprobarPerfil);
      window.removeEventListener("online", comprobarPerfil);
    };
  }, [sessionToken, location.pathname]);

  useEffect(() => {
    const cerrarCrearPreview = () => setMostrarCrearReel(false);
    window.addEventListener("sondar:cerrar-crear-preview", cerrarCrearPreview);
    window.addEventListener("sondar:crear-evento", cerrarCrearPreview);
    return () => {
      window.removeEventListener("sondar:cerrar-crear-preview", cerrarCrearPreview);
      window.removeEventListener("sondar:crear-evento", cerrarCrearPreview);
    };
  }, []);

  const hideNavbarRoutes = ["/auth"];
  const shouldHideNavbar = hideNavbarRoutes.includes(location.pathname);
  const isDescubrirRoute = location.pathname === "/descubrir";
  const isBuscarRoute = location.pathname === "/buscar";
  const isAuthRoute = location.pathname === "/auth";

  return (
    <PreferenciasProvider usuario={usuario}>
    <div className={`app-container ${location.pathname === "/" ? "app-map" : "app-page"}`}>
      {!shouldHideNavbar && <Navbar usuario={usuario} onCrearReel={abrirCrearPreview} />}
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
          key={usuario.id}
          token={onboardingToken}
          username={usuario.user_metadata?.username || usuario.email?.split("@")[0]}
          onComplete={(data) => {
            window.dispatchEvent(new CustomEvent("sondar-perfil-actualizado", { detail: data.perfil }));
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
