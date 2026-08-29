import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../lib/api";
import { supabase } from "../lib/supabaseClient";

export const PREFERENCIAS_INICIALES = Object.freeze({
  telefono: "",
  codigoPais: "+54",
  idioma: "es",
  actividadCuenta: true,
  notificarInteracciones: true,
  notificarComentarios: true,
  notificarSeguidores: true,
  notificarPublicaciones: true,
  notificarMenciones: true,
  notificarMensajes: true,
  reducirMovimiento: false,
  mostrarEmail: false,
});

const TRADUCCIONES = {
  en: {
    "Eventos": "Events",
    "Descubrir": "Discover",
    "Comunidad": "Community",
    "Foros": "Forums",
    "Ir a...": "Go to...",
    "Siguiendo": "Following",
    "Iniciar sesión": "Log in",
    "Crear cuenta": "Create account",
    "Crear": "Create",
    "Preview": "Preview",
    "Notificaciones": "Notifications",
    "Mi perfil": "My profile",
    "Soporte": "Support",
    "Configuración": "Settings",
    "Cerrar sesión": "Log out",
    "Buscar artistas, eventos y canciones": "Search artists, events and songs",
    "Buscar usuarios, previews o eventos...": "Search users, previews or events...",
    "Evento": "Event",
    "Cuenta": "Account",
    "Ajustes generales de acceso, seguridad, privacidad y comunicaciones de tu cuenta.": "General account, security, privacy and communication settings.",
    "Sin email conectado": "No email connected",
    "Datos": "Details",
    "Seguridad": "Security",
    "Privacidad": "Privacy",
    "Experiencia": "Experience",
    "Zona de cuenta": "Account management",
    "Datos de la cuenta": "Account details",
    "Información privada usada para iniciar sesión y gestionar tu cuenta.": "Private information used to sign in and manage your account.",
    "El correo de acceso no se modifica desde esta pantalla.": "Your sign-in email cannot be changed here.",
    "Teléfono": "Phone",
    "Elegí el país y escribí el número sin el prefijo internacional.": "Choose the country and enter the number without the international prefix.",
    "Idioma": "Language",
    "Español": "Spanish",
    "Inglés": "English",
    "Portugués": "Portuguese",
    "Vista previa activa. Guardá para conservar el idioma.": "Preview active. Save to keep this language.",
    "Opciones para proteger el acceso a tu cuenta.": "Options to protect access to your account.",
    "Contraseña": "Password",
    "Actualizá tu contraseña de acceso con confirmación visible.": "Update your password with a clear confirmation.",
    "Cambiar contraseña": "Change password",
    "Define qué avisos querés recibir de SONDAR.": "Choose which SONDAR alerts you want to receive.",
    "Notificaciones en la app": "In-app notifications",
    "Activa o pausa todos los avisos nuevos.": "Enable or pause all new alerts.",
    "Me gusta y reacciones": "Likes and reactions",
    "Previews, comentarios y publicaciones de comunidad.": "Previews, comments and community posts.",
    "Comentarios y respuestas": "Comments and replies",
    "Conversaciones nuevas en tus previews y publicaciones.": "New conversations on your previews and posts.",
    "Nuevos seguidores": "New followers",
    "Cuando otra persona empieza a seguirte.": "When someone starts following you.",
    "Publicaciones de gente que seguís": "Posts from people you follow",
    "Previews, eventos y publicaciones de comunidad nuevos.": "New previews, events and community posts.",
    "Menciones e invitaciones": "Mentions and invitations",
    "Etiquetas con @ e invitaciones para organizar eventos.": "@ mentions and invitations to organize events.",
    "Mensajes directos": "Direct messages",
    "Cuando recibís un mensaje nuevo de otra persona.": "When you receive a new message from someone.",
    "Las notificaciones están pausadas. No se crearán avisos nuevos.": "Notifications are paused. No new alerts will be created.",
    "Controlá cómo otros usuarios pueden ver tu cuenta.": "Control how other users can see your account.",
    "Solo vos y las cuentas que seguís pueden ver tus previews, eventos y listas.": "Only you and the accounts you follow can see your previews, events and lists.",
    "Mostrar email": "Show email",
    "Permite que otros usuarios vean tu email de contacto.": "Allow other users to see your contact email.",
    "Apariencia y accesibilidad": "Appearance and accessibility",
    "Preferencias que cambian cómo se siente la aplicación en este dispositivo.": "Preferences that change how the app feels on this device.",
    "Reducir movimiento": "Reduce motion",
    "Desactiva animaciones y transiciones que no sean necesarias.": "Disable unnecessary animations and transitions.",
    "Restablecer preferencias": "Reset preferences",
    "Vuelve a activar las notificaciones y la experiencia visual predeterminada.": "Restore default notifications and visual experience.",
    "Restablecer": "Reset",
    "Acciones sensibles que afectan tu acceso y datos.": "Sensitive actions that affect your access and data.",
    "Descargar datos": "Download data",
    "Guarda una copia JSON de tu cuenta y configuración.": "Save a JSON copy of your account and settings.",
    "Descargar": "Download",
    "Preparando...": "Preparing...",
    "Eliminar cuenta": "Delete account",
    "Elimina permanentemente tu perfil, publicaciones, eventos e interacciones.": "Permanently delete your profile, posts, events and interactions.",
    "Eliminar": "Delete",
    "Cargando tu configuración...": "Loading your settings...",
    "Tenés cambios sin guardar": "You have unsaved changes",
    "Todos los cambios están guardados": "All changes are saved",
    "Guardar cambios": "Save changes",
    "Guardando...": "Saving...",
    "Guardado": "Saved",
    "Listo": "Done",
    "Algo salió mal": "Something went wrong",
    "Cerrar aviso": "Close alert",
    "Marcar todas": "Mark all as read",
    "Limpiar leídas": "Clear read",
    "Cargando notificaciones...": "Loading notifications...",
    "No tenés notificaciones por ahora.": "You have no notifications yet.",
    "Notificación no leída": "Unread notification",
    "Ahora": "Now",
    "Eventos cerca tuyo": "Events near you",
    "No hay eventos de este género": "There are no events in this genre",
    "Crear nuevo evento": "Create new event",
    "No encontramos música": "We couldn't find music",
    "No hay nada que descubrir": "There's nothing to discover yet",
    "Crear nueva preview": "Create new preview",
    "Géneros": "Genres",
    "Crear publicación": "Create post",
    "Busca en SONDAR": "Search SONDAR",
    "Buscando...": "Searching...",
    "Buscar": "Search",
    "Resultados para": "Results for",
    "Usuarios": "Users",
    "Previews": "Previews",
    "Likes": "Likes",
    "Guardados": "Saved",
    "Cargando perfil...": "Loading profile...",
    "Editar perfil": "Edit profile",
    "Aún no hay previews.": "There are no previews yet.",
    "Aún no hay eventos.": "There are no events yet.",
    "Aún no hay likes.": "There are no likes yet.",
    "Aún no hay guardados.": "There are no saved items yet.",
    "Ayuda clara para seguir sonando.": "Clear help to keep you playing.",
    "Preguntas frecuentes": "Frequently asked questions",
    "Contanos qué pasó": "Tell us what happened",
    "Tu música empieza acá.": "Your music starts here.",
  },
  pt: {
    "Eventos": "Eventos",
    "Descubrir": "Descobrir",
    "Comunidad": "Comunidade",
    "Foros": "Foruns",
    "Ir a...": "Ir para...",
    "Siguiendo": "Seguindo",
    "Iniciar sesión": "Entrar",
    "Crear cuenta": "Criar conta",
    "Crear": "Criar",
    "Notificaciones": "Notificações",
    "Mi perfil": "Meu perfil",
    "Soporte": "Suporte",
    "Configuración": "Configurações",
    "Cerrar sesión": "Sair",
    "Buscar artistas, eventos y canciones": "Buscar artistas, eventos e músicas",
    "Buscar usuarios, previews o eventos...": "Buscar usuários, previews ou eventos...",
    "Evento": "Evento",
    "Cuenta": "Conta",
    "Ajustes generales de acceso, seguridad, privacidad y comunicaciones de tu cuenta.": "Configurações gerais de acesso, segurança, privacidade e comunicações da sua conta.",
    "Sin email conectado": "Nenhum e-mail conectado",
    "Datos": "Dados",
    "Seguridad": "Segurança",
    "Privacidad": "Privacidade",
    "Experiencia": "Experiência",
    "Zona de cuenta": "Área da conta",
    "Datos de la cuenta": "Dados da conta",
    "Información privada usada para iniciar sesión y gestionar tu cuenta.": "Informações privadas usadas para entrar e gerenciar sua conta.",
    "El correo de acceso no se modifica desde esta pantalla.": "O e-mail de acesso não pode ser alterado aqui.",
    "Teléfono": "Telefone",
    "Elegí el país y escribí el número sin el prefijo internacional.": "Escolha o país e digite o número sem o prefixo internacional.",
    "Idioma": "Idioma",
    "Español": "Espanhol",
    "Inglés": "Inglês",
    "Portugués": "Português",
    "Vista previa activa. Guardá para conservar el idioma.": "Prévia ativa. Salve para manter este idioma.",
    "Opciones para proteger el acceso a tu cuenta.": "Opções para proteger o acesso à sua conta.",
    "Contraseña": "Senha",
    "Actualizá tu contraseña de acceso con confirmación visible.": "Atualize sua senha com uma confirmação clara.",
    "Cambiar contraseña": "Alterar senha",
    "Define qué avisos querés recibir de SONDAR.": "Escolha quais avisos do SONDAR deseja receber.",
    "Notificaciones en la app": "Notificações no aplicativo",
    "Activa o pausa todos los avisos nuevos.": "Ative ou pause todos os novos avisos.",
    "Me gusta y reacciones": "Curtidas e reações",
    "Previews, comentarios y publicaciones de comunidad.": "Previews, comentários e publicações da comunidade.",
    "Comentarios y respuestas": "Comentários e respostas",
    "Conversaciones nuevas en tus previews y publicaciones.": "Novas conversas nas suas previews e publicações.",
    "Nuevos seguidores": "Novos seguidores",
    "Cuando otra persona empieza a seguirte.": "Quando outra pessoa começa a seguir você.",
    "Publicaciones de gente que seguís": "Publicações de pessoas que você segue",
    "Previews, eventos y publicaciones de comunidad nuevos.": "Novas previews, eventos e publicações da comunidade.",
    "Menciones e invitaciones": "Menções e convites",
    "Etiquetas con @ e invitaciones para organizar eventos.": "Marcações com @ e convites para organizar eventos.",
    "Mensajes directos": "Mensagens diretas",
    "Cuando recibís un mensaje nuevo de otra persona.": "Quando você recebe uma nova mensagem de outra pessoa.",
    "Las notificaciones están pausadas. No se crearán avisos nuevos.": "As notificações estão pausadas. Nenhum novo aviso será criado.",
    "Controlá cómo otros usuarios pueden ver tu cuenta.": "Controle como outros usuários podem ver sua conta.",
    "Solo vos y las cuentas que seguís pueden ver tus previews, eventos y listas.": "Somente você e as contas que segue podem ver suas previews, eventos e listas.",
    "Mostrar email": "Mostrar e-mail",
    "Permite que otros usuarios vean tu email de contacto.": "Permita que outros usuários vejam seu e-mail de contato.",
    "Apariencia y accesibilidad": "Aparência e acessibilidade",
    "Preferencias que cambian cómo se siente la aplicación en este dispositivo.": "Preferências que alteram a experiência do aplicativo neste dispositivo.",
    "Reducir movimiento": "Reduzir movimento",
    "Desactiva animaciones y transiciones que no sean necesarias.": "Desative animações e transições desnecessárias.",
    "Restablecer preferencias": "Redefinir preferências",
    "Vuelve a activar las notificaciones y la experiencia visual predeterminada.": "Restaure as notificações e a experiência visual padrão.",
    "Restablecer": "Redefinir",
    "Acciones sensibles que afectan tu acceso y datos.": "Ações sensíveis que afetam seu acesso e dados.",
    "Descargar datos": "Baixar dados",
    "Guarda una copia JSON de tu cuenta y configuración.": "Salve uma cópia JSON da sua conta e configurações.",
    "Descargar": "Baixar",
    "Preparando...": "Preparando...",
    "Eliminar cuenta": "Excluir conta",
    "Elimina permanentemente tu perfil, publicaciones, eventos e interacciones.": "Exclua permanentemente seu perfil, publicações, eventos e interações.",
    "Eliminar": "Excluir",
    "Cargando tu configuración...": "Carregando suas configurações...",
    "Tenés cambios sin guardar": "Você tem alterações não salvas",
    "Todos los cambios están guardados": "Todas as alterações estão salvas",
    "Guardar cambios": "Salvar alterações",
    "Guardando...": "Salvando...",
    "Guardado": "Salvo",
    "Listo": "Pronto",
    "Algo salió mal": "Algo deu errado",
    "Cerrar aviso": "Fechar aviso",
    "Marcar todas": "Marcar todas como lidas",
    "Limpiar leídas": "Limpar lidas",
    "Cargando notificaciones...": "Carregando notificações...",
    "No tenés notificaciones por ahora.": "Você ainda não tem notificações.",
    "Notificación no leída": "Notificação não lida",
    "Ahora": "Agora",
    "Eventos cerca tuyo": "Eventos perto de você",
    "No hay eventos de este género": "Não há eventos deste gênero",
    "Crear nuevo evento": "Criar novo evento",
    "No encontramos música": "Não encontramos músicas",
    "No hay nada que descubrir": "Ainda não há nada para descobrir",
    "Crear nueva preview": "Criar nova preview",
    "Géneros": "Gêneros",
    "Crear publicación": "Criar publicação",
    "Busca en SONDAR": "Busque no SONDAR",
    "Buscando...": "Buscando...",
    "Buscar": "Buscar",
    "Resultados para": "Resultados para",
    "Usuarios": "Usuários",
    "Previews": "Previews",
    "Likes": "Likes",
    "Guardados": "Salvos",
    "Cargando perfil...": "Carregando perfil...",
    "Editar perfil": "Editar perfil",
    "Aún no hay previews.": "Ainda não há previews.",
    "Aún no hay eventos.": "Ainda não há eventos.",
    "Aún no hay likes.": "Ainda não há likes.",
    "Aún no hay guardados.": "Ainda não há itens salvos.",
    "Ayuda clara para seguir sonando.": "Ajuda clara para continuar tocando.",
    "Preguntas frecuentes": "Perguntas frequentes",
    "Contanos qué pasó": "Conte o que aconteceu",
    "Tu música empieza acá.": "Sua música começa aqui.",
  },
};

const PreferenciasContext = createContext(null);
const STORAGE_KEY = "sondar:preferencias";

function leerPreferenciasLocales() {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

export function PreferenciasProvider({ usuario, children }) {
  const [preferencias, setPreferencias] = useState(() => ({
    ...PREFERENCIAS_INICIALES,
    ...leerPreferenciasLocales(),
  }));

  const actualizarPreferencias = useCallback((cambios) => {
    setPreferencias((actuales) => {
      const siguientes = { ...actuales, ...cambios };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(siguientes));
      return siguientes;
    });
  }, []);

  useEffect(() => {
    const guardadas = usuario?.user_metadata?.configuracion;
    if (guardadas && typeof guardadas === "object") actualizarPreferencias(guardadas);
    if (!usuario) return undefined;

    let activo = true;
    const cargar = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) return;
        const response = await apiRequest("/api/usuarios/me/configuracion", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return;
        const datos = await response.json();
        if (activo) actualizarPreferencias(datos);
      } catch {
        // La metadata y el almacenamiento local mantienen la interfaz utilizable.
      }
    };
    cargar();
    return () => { activo = false; };
  }, [actualizarPreferencias, usuario]);

  useEffect(() => {
    document.documentElement.lang = preferencias.idioma;
    document.body.classList.toggle("sondar-reducir-movimiento", preferencias.reducirMovimiento);
  }, [preferencias.idioma, preferencias.reducirMovimiento]);

  const t = useCallback((texto) => TRADUCCIONES[preferencias.idioma]?.[texto] || texto, [preferencias.idioma]);
  const locale = preferencias.idioma === "en" ? "en-US" : preferencias.idioma === "pt" ? "pt-BR" : "es-AR";

  const valor = useMemo(() => ({
    preferencias,
    actualizarPreferencias,
    t,
    locale,
  }), [actualizarPreferencias, locale, preferencias, t]);

  return <PreferenciasContext.Provider value={valor}>{children}</PreferenciasContext.Provider>;
}

export function usePreferencias() {
  const contexto = useContext(PreferenciasContext);
  if (!contexto) throw new Error("usePreferencias debe usarse dentro de PreferenciasProvider");
  return contexto;
}
