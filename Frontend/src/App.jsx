import { Routes, Route, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./paginas/firebaseConfig";
import { api } from "./api";
import "./App.css";

import Navbar from "./componentes/Navbar";
import Auth from "./paginas/Auth";
import Login from "./paginas/Login";
import Registro from "./paginas/Registro";
import Soporte from "./paginas/Soporte";
import Eventos from "./paginas/Eventos";
import Descubrir from "./paginas/Descubrir";
import OtroPerfil from "./paginas/OtroPerfil";
import Comunidad from "./paginas/Comunidad";
import MiPerfil from "./paginas/Miperfil";
import Configuracion from "./paginas/Configuracion";
import SidebarNav from "./componentes/SidebarNav";


function App() {
  const location = useLocation();
  const [usuario, setUsuario] = useState(null);

  // 🔥 Escucha sesión de Firebase
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUsuario(user);

      if (!user) return;

      try {
        const data = await api.verificarUsuario(user.uid);

        if (!data.existe) {

          await api.registrarUsuario({
            uid: user.uid,
            email: user.email,
            username: user.displayName || user.email?.split("@")[0] || user.uid.slice(0, 8),
          });
        }
      } catch (error) {
        console.error("No se pudo sincronizar el usuario con la base:", error);
      }
    });

    return () => unsubscribe();
  }, [location.pathname]);

  const hideNavbarRoutes = ["/auth", "/login", "/registro"];
  const shouldHideNavbar = hideNavbarRoutes.includes(location.pathname);

  return (
    <div className="app-container">
      {!shouldHideNavbar && <Navbar usuario={usuario} />}

      {!shouldHideNavbar && <SidebarNav usuario={usuario} />}

      <div className={`main-content ${!shouldHideNavbar ? "with-navbar" : ""} ${!shouldHideNavbar ? "with-sidebar" : ""}`}>
        <Routes>
          <Route path="/" element={<Eventos usuario={usuario} />} />
          <Route path="/soporte" element={<Soporte />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/perfil" element={<MiPerfil usuario={usuario} />} />
          <Route path="/login" element={<Login />} />
          <Route path="/registro" element={<Registro />} />
          <Route path="/descubrir" element={<Descubrir usuario={usuario} />} />
          <Route path="/otro-perfil" element={<OtroPerfil />} />
          <Route path="/comunidad" element={<Comunidad usuario={usuario} />} />
          <Route path="/configuracion" element={<Configuracion usuario={usuario} />} />

        </Routes>
      </div>
    </div>
  );
}

export default App;
