import { Routes, Route, useLocation } from "react-router-dom";
import { lazy, Suspense, useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import "./App.css";

import Navbar from "./componentes/Navbar";
import SidebarNav from "./componentes/SidebarNav";
import { PreferenciasProvider } from "./contextos/PreferenciasContext";

const Auth = lazy(() => import("./paginas/Auth"));
const Soporte = lazy(() => import("./paginas/Soporte"));
const Eventos = lazy(() => import("./paginas/Eventos"));
const Descubrir = lazy(() => import("./paginas/Descubrir"));
const Buscar = lazy(() => import("./paginas/Buscar"));
const Comunidad = lazy(() => import("./paginas/Comunidad"));
const MiPerfil = lazy(() => import("./paginas/Miperfil"));
const OtroPerfil = lazy(() => import("./paginas/OtroPerfil"));
const Configuracion = lazy(() => import("./paginas/Configuracion"));
const OnboardingPerfilModal = lazy(() => import("./componentes/OnboardingPerfilModal"));

function RutaNoEncontrada() {
  return (
    <section className="ruta-no-encontrada">
      <span>404</span>
      <h1>Esta pagina no existe</h1>
      <a href="/">Volver a Eventos</a>
    </section>
  );
}

function App() {
  const location = useLocation();
  const [usuario, setUsuario] = useState(null);
  const [onboardingToken, setOnboardingToken] = useState(null);

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

  const hideNavbarRoutes = ["/auth"];
  const shouldHideNavbar = hideNavbarRoutes.includes(location.pathname);
  const isDescubrirRoute = location.pathname === "/descubrir";
  const isBuscarRoute = location.pathname === "/buscar";
  const isAuthRoute = location.pathname === "/auth";

  return (
    <PreferenciasProvider usuario={usuario}>
    <div className="app-container">
      {!shouldHideNavbar && <Navbar usuario={usuario} />}
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
        <Suspense fallback={<div className="ruta-cargando" role="status">Cargando...</div>}>
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
            <Route path="*" element={<RutaNoEncontrada />} />
          </Routes>
        </Suspense>
      </div>

      <Suspense fallback={null}>
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
      </Suspense>
    </div>
    </PreferenciasProvider>
  );
}

export default App;
