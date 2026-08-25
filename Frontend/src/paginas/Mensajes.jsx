import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiRequest } from "../lib/api";
import { supabase } from "../lib/supabaseClient";
import "./mensajes.css";

const PAGE_SIZE = 40;

function Avatar({ usuario, size = "normal" }) {
  const inicial = (usuario?.nombre || usuario?.username || "S").charAt(0).toUpperCase();
  return (
    <span className={`mensajes-avatar mensajes-avatar-${size}`} aria-hidden="true">
      {usuario?.avatar ? <img src={usuario.avatar} alt="" /> : inicial}
    </span>
  );
}

function formatTime(value, withDate = false) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return new Intl.DateTimeFormat("es-AR", {
    ...(withDate && !sameDay ? { day: "2-digit", month: "2-digit" } : {}),
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function mergeMessages(current, incoming) {
  const byId = new Map(current.map((message) => [String(message.id), message]));
  incoming.forEach((message) => byId.set(String(message.id), message));
  return [...byId.values()].sort((a, b) => Number(a.id) - Number(b.id));
}

export default function Mensajes({ usuario }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedConversation = searchParams.get("conversacion") || "";
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(requestedConversation);
  const [messages, setMessages] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const [notice, setNotice] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [userQuery, setUserQuery] = useState("");
  const [userResults, setUserResults] = useState([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [typingUser, setTypingUser] = useState(false);
  const [otherOnline, setOtherOnline] = useState(false);
  const channelRef = useRef(null);
  const typingTimerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const activeIdRef = useRef(activeId);
  const cursorRef = useRef(cursor);
  const lastReadMessageRef = useRef(null);
  const scrollOnNextUpdateRef = useRef(true);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeId) || null,
    [activeId, conversations]
  );

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  const loadConversations = useCallback(async ({ silent = false } = {}) => {
    if (!usuario) return;
    if (!silent) setLoadingConversations(true);
    try {
      const response = await apiRequest("/api/mensajes/conversaciones");
      const body = await response.json().catch(() => ([]));
      if (!response.ok) throw new Error(body.error || "No se pudieron cargar las conversaciones.");
      const next = Array.isArray(body) ? body : [];
      setConversations(next);
      setActiveId((current) => {
        const requested = requestedConversation && next.some((item) => item.id === requestedConversation)
          ? requestedConversation
          : "";
        if (requested) return requested;
        if (current && next.some((item) => item.id === current)) return current;
        return next[0]?.id || "";
      });
    } catch (error) {
      setNotice(error.message || "No se pudieron cargar las conversaciones.");
    } finally {
      if (!silent) setLoadingConversations(false);
    }
  }, [requestedConversation, usuario]);

  const loadMessages = useCallback(async (conversationId, { older = false, silent = false } = {}) => {
    if (!conversationId || !usuario) return;
    if (older) setLoadingOlder(true);
    else if (!silent) setLoadingMessages(true);
    if (!older) scrollOnNextUpdateRef.current = true;
    try {
      const parameters = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (older && cursorRef.current) parameters.set("before", cursorRef.current);
      const response = await apiRequest(
        `/api/mensajes/conversaciones/${conversationId}/mensajes?${parameters.toString()}`
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "No se pudieron cargar los mensajes.");
      if (activeIdRef.current !== conversationId) return;
      setMessages((current) => older
        ? mergeMessages(body.items || [], current)
        : silent ? mergeMessages(current, body.items || []) : body.items || []);
      cursorRef.current = body.nextCursor || null;
      setCursor(cursorRef.current);
      const latestIncoming = [...(body.items || [])].reverse().find((message) => !message.propio);
      if (!older && latestIncoming && String(lastReadMessageRef.current) !== String(latestIncoming.id)) {
        lastReadMessageRef.current = latestIncoming.id;
        apiRequest(`/api/mensajes/conversaciones/${conversationId}/leer`, { method: "PATCH" })
          .then(() => {
            window.dispatchEvent(new CustomEvent("sondar:mensajes-actualizados"));
            return loadConversations({ silent: true });
          })
          .catch(() => null);
      }
    } catch (error) {
      if (!silent) setNotice(error.message || "No se pudieron cargar los mensajes.");
    } finally {
      setLoadingMessages(false);
      setLoadingOlder(false);
    }
  }, [loadConversations, usuario]);

  useEffect(() => {
    if (!usuario) {
      setLoadingConversations(false);
      return;
    }
    loadConversations();
    const interval = window.setInterval(() => loadConversations({ silent: true }), 12000);
    return () => window.clearInterval(interval);
  }, [loadConversations, usuario]);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      cursorRef.current = null;
      lastReadMessageRef.current = null;
      setCursor(null);
      return;
    }
    setMessages([]);
    cursorRef.current = null;
    lastReadMessageRef.current = null;
    setCursor(null);
    setTypingUser(false);
    setOtherOnline(false);
    loadMessages(activeId);
  }, [activeId, loadMessages]);

  useEffect(() => {
    if (!activeId || !usuario) return undefined;
    let disposed = false;
    let typingExpiry = null;
    const connect = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session || disposed) return;
      supabase.realtime.setAuth(data.session.access_token);
      const channel = supabase.channel(`conversation:${activeId}`, {
        config: {
          private: true,
          broadcast: { ack: true, self: false },
          presence: { key: usuario.id },
        },
      });
      channelRef.current = channel;
      const refresh = () => {
        loadMessages(activeId, { silent: true });
        loadConversations({ silent: true });
      };
      channel
        .on("broadcast", { event: "INSERT" }, refresh)
        .on("broadcast", { event: "UPDATE" }, refresh)
        .on("broadcast", { event: "DELETE" }, refresh)
        .on("broadcast", { event: "read" }, ({ payload }) => {
          if (payload?.user_id === usuario.id) return;
          setMessages((current) => current.map((message) =>
            message.propio ? { ...message, leido: true } : message
          ));
        })
        .on("broadcast", { event: "typing" }, ({ payload }) => {
          if (payload?.userId === usuario.id) return;
          window.clearTimeout(typingExpiry);
          setTypingUser(Boolean(payload?.typing));
          if (payload?.typing) {
            typingExpiry = window.setTimeout(() => setTypingUser(false), 2200);
          }
        })
        .on("presence", { event: "sync" }, () => {
          const state = channel.presenceState();
          setOtherOnline(Object.keys(state).some((key) => key !== usuario.id));
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await channel.track({ userId: usuario.id, onlineAt: new Date().toISOString() });
          }
        });
    };
    connect();
    const fallback = window.setInterval(() => loadMessages(activeId, { silent: true }), 8000);
    return () => {
      disposed = true;
      window.clearInterval(fallback);
      window.clearTimeout(typingExpiry);
      window.clearTimeout(typingTimerRef.current);
      const channel = channelRef.current;
      if (channel) {
        channel.send({ type: "broadcast", event: "typing", payload: { userId: usuario.id, typing: false } }).catch(() => null);
        supabase.removeChannel(channel);
      }
      if (channelRef.current === channel) channelRef.current = null;
    };
  }, [activeId, loadConversations, loadMessages, usuario]);

  useEffect(() => {
    if (!loadingMessages && scrollOnNextUpdateRef.current) {
      messagesEndRef.current?.scrollIntoView({ block: "end" });
      scrollOnNextUpdateRef.current = false;
    }
  }, [loadingMessages, messages.length]);

  useEffect(() => {
    const query = userQuery.trim();
    if (!showNew || query.length < 2) {
      setUserResults([]);
      setSearchingUsers(false);
      return undefined;
    }
    let active = true;
    setSearchingUsers(true);
    const timer = window.setTimeout(async () => {
      try {
        const response = await apiRequest(`/api/usuarios?query=${encodeURIComponent(query)}`, { auth: false });
        const body = await response.json().catch(() => ([]));
        if (active) setUserResults((Array.isArray(body) ? body : []).filter((item) => item.id !== usuario?.id));
      } catch {
        if (active) setUserResults([]);
      } finally {
        if (active) setSearchingUsers(false);
      }
    }, 280);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [showNew, userQuery, usuario?.id]);

  const selectConversation = (conversationId) => {
    setActiveId(conversationId);
    setSearchParams({ conversacion: conversationId }, { replace: true });
  };

  const startConversation = async (target) => {
    try {
      const response = await apiRequest("/api/mensajes/conversaciones", {
        method: "POST",
        body: { userId: target.id },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "No se pudo iniciar la conversacion.");
      setConversations((current) => [body, ...current.filter((item) => item.id !== body.id)]);
      setShowNew(false);
      setUserQuery("");
      selectConversation(body.id);
    } catch (error) {
      setNotice(error.message || "No se pudo iniciar la conversacion.");
    }
  };

  const notifyTyping = (value) => {
    const channel = channelRef.current;
    if (!channel || !usuario) return;
    channel.send({
      type: "broadcast",
      event: "typing",
      payload: { userId: usuario.id, typing: value },
    }).catch(() => null);
  };

  const onTextChange = (event) => {
    setText(event.target.value);
    notifyTyping(true);
    window.clearTimeout(typingTimerRef.current);
    typingTimerRef.current = window.setTimeout(() => notifyTyping(false), 1200);
  };

  const sendMessage = async (event) => {
    event.preventDefault();
    const clean = text.trim();
    if (!clean || !activeId || sending || activeConversation?.bloqueada) return;
    setSending(true);
    notifyTyping(false);
    try {
      const response = await apiRequest(`/api/mensajes/conversaciones/${activeId}/mensajes`, {
        method: "POST",
        body: { texto: clean, respuestaA: replyingTo?.id || null },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "No se pudo enviar el mensaje.");
      setMessages((current) => mergeMessages(current, [body]));
      scrollOnNextUpdateRef.current = true;
      setText("");
      setReplyingTo(null);
      loadConversations({ silent: true });
      window.dispatchEvent(new CustomEvent("sondar:mensajes-actualizados"));
    } catch (error) {
      setNotice(error.message || "No se pudo enviar el mensaje.");
    } finally {
      setSending(false);
    }
  };

  const editMessage = async (message) => {
    const next = window.prompt("Editar mensaje", message.texto);
    if (next == null || !next.trim() || next.trim() === message.texto) return;
    try {
      const response = await apiRequest(`/api/mensajes/mensajes/${message.id}`, {
        method: "PATCH",
        body: { texto: next.trim() },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "No se pudo editar el mensaje.");
      setMessages((current) => mergeMessages(current, [body]));
    } catch (error) {
      setNotice(error.message || "No se pudo editar el mensaje.");
    }
  };

  const deleteMessage = async (message) => {
    if (!window.confirm("¿Eliminar este mensaje para todos?")) return;
    try {
      const response = await apiRequest(`/api/mensajes/mensajes/${message.id}`, { method: "DELETE" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "No se pudo eliminar el mensaje.");
      setMessages((current) => current.map((item) =>
        item.id === message.id ? { ...item, texto: "Mensaje eliminado", eliminado: true } : item
      ));
    } catch (error) {
      setNotice(error.message || "No se pudo eliminar el mensaje.");
    }
  };

  if (!usuario) {
    return (
      <main className="mensajes-login">
        <span aria-hidden="true">✉</span>
        <h1>Tus mensajes</h1>
        <p>Inicia sesion para conversar con otros usuarios de SONDAR.</p>
        <Link to="/auth?modo=login">Iniciar sesion</Link>
      </main>
    );
  }

  return (
    <main className={`mensajes-page ${activeId ? "con-chat-activo" : ""}`}>
      <aside className="mensajes-inbox" aria-label="Conversaciones">
        <header>
          <div><span>MENSAJES</span><h1>Conversaciones</h1></div>
          <button type="button" onClick={() => setShowNew(true)} aria-label="Nuevo mensaje">＋</button>
        </header>
        {loadingConversations ? <p className="mensajes-estado">Cargando conversaciones...</p> : null}
        {!loadingConversations && conversations.length === 0 ? (
          <div className="mensajes-vacio"><strong>Todavia no hay mensajes</strong><p>Busca un usuario para iniciar una conversacion.</p></div>
        ) : null}
        <div className="mensajes-conversaciones">
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              className={conversation.id === activeId ? "activa" : ""}
              onClick={() => selectConversation(conversation.id)}
            >
              <Avatar usuario={conversation.usuario} />
              <span className="mensajes-conversacion-texto">
                <strong>{conversation.usuario.nombre}</strong>
                <small>{conversation.ultimoMensaje
                  ? `${conversation.ultimoMensaje.propio ? "Tu: " : ""}${conversation.ultimoMensaje.texto}`
                  : "Nueva conversacion"}</small>
              </span>
              <span className="mensajes-conversacion-meta">
                <time>{formatTime(conversation.ultimaActividad, true)}</time>
                {conversation.noLeidos > 0 ? <b>{conversation.noLeidos > 99 ? "99+" : conversation.noLeidos}</b> : null}
              </span>
            </button>
          ))}
        </div>
      </aside>

      <section className="mensajes-chat" aria-label="Chat activo">
        {!activeConversation ? (
          <div className="mensajes-chat-sin-seleccion"><span>✉</span><h2>Selecciona una conversacion</h2><p>O crea una nueva para empezar a hablar.</p></div>
        ) : (
          <>
            <header className="mensajes-chat-header">
              <button type="button" className="mensajes-volver" onClick={() => setActiveId("")} aria-label="Volver">‹</button>
              <Link to={`/perfil/${activeConversation.usuario.id}`}><Avatar usuario={activeConversation.usuario} size="small" /></Link>
              <div>
                <Link to={`/perfil/${activeConversation.usuario.id}`}>{activeConversation.usuario.nombre}</Link>
                <span>{typingUser ? "escribiendo..." : otherOnline ? "En linea" : `@${activeConversation.usuario.username}`}</span>
              </div>
            </header>

            <div className="mensajes-historial" aria-live="polite">
              {cursor ? <button type="button" className="mensajes-cargar-anteriores" disabled={loadingOlder} onClick={() => loadMessages(activeId, { older: true })}>{loadingOlder ? "Cargando..." : "Cargar mensajes anteriores"}</button> : null}
              {loadingMessages ? <p className="mensajes-estado">Cargando mensajes...</p> : null}
              {!loadingMessages && messages.length === 0 ? (
                <div className="mensajes-inicio"><Avatar usuario={activeConversation.usuario} /><strong>{activeConversation.usuario.nombre}</strong><p>Envia un mensaje para iniciar la conversacion.</p></div>
              ) : null}
              {messages.map((message) => (
                <article key={message.id} className={`mensaje-burbuja ${message.propio ? "propio" : "recibido"} ${message.eliminado ? "eliminado" : ""}`}>
                  {message.respuestaA ? <button type="button" className="mensaje-respuesta-previa" onClick={() => document.getElementById(`mensaje-${message.respuestaA.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}>{message.respuestaA.texto}</button> : null}
                  <div id={`mensaje-${message.id}`}><p>{message.texto}</p><span>{message.editadoEn ? "editado · " : ""}{formatTime(message.creadoEn)}{message.propio && !message.eliminado ? ` · ${message.leido ? "Visto" : "Enviado"}` : ""}</span></div>
                  {!message.eliminado ? (
                    <nav aria-label="Acciones del mensaje">
                      <button type="button" onClick={() => setReplyingTo(message)}>Responder</button>
                      {message.propio ? <button type="button" onClick={() => editMessage(message)}>Editar</button> : null}
                      {message.propio ? <button type="button" onClick={() => deleteMessage(message)}>Eliminar</button> : null}
                    </nav>
                  ) : null}
                </article>
              ))}
              {typingUser ? <div className="mensaje-escribiendo" aria-label="Escribiendo"><i /><i /><i /></div> : null}
              <div ref={messagesEndRef} />
            </div>

            {activeConversation.bloqueada ? (
              <div className="mensajes-bloqueada">No se pueden enviar mensajes debido a un bloqueo.</div>
            ) : (
              <form className="mensajes-composer" onSubmit={sendMessage}>
                {replyingTo ? <div className="mensajes-respondiendo"><span>Respondiendo a {replyingTo.propio ? "tu mensaje" : activeConversation.usuario.nombre}: {replyingTo.texto}</span><button type="button" onClick={() => setReplyingTo(null)}>×</button></div> : null}
                <div>
                  <textarea value={text} onChange={onTextChange} onBlur={() => notifyTyping(false)} maxLength="2000" rows="1" placeholder="Escribe un mensaje..." onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} />
                  <button type="submit" disabled={sending || !text.trim()}>{sending ? "Enviando" : "Enviar"}</button>
                </div>
              </form>
            )}
          </>
        )}
      </section>

      {showNew ? (
        <div className="mensajes-modal-overlay" role="presentation" onMouseDown={() => setShowNew(false)}>
          <section className="mensajes-nuevo" role="dialog" aria-modal="true" aria-labelledby="nuevo-mensaje-titulo" onMouseDown={(event) => event.stopPropagation()}>
            <header><h2 id="nuevo-mensaje-titulo">Nuevo mensaje</h2><button type="button" onClick={() => setShowNew(false)}>×</button></header>
            <input autoFocus type="search" value={userQuery} onChange={(event) => setUserQuery(event.target.value)} placeholder="Buscar por nombre o @usuario" />
            <div className="mensajes-resultados">
              {searchingUsers ? <p>Buscando...</p> : null}
              {!searchingUsers && userQuery.trim().length >= 2 && userResults.length === 0 ? <p>No se encontraron usuarios.</p> : null}
              {userResults.map((result) => <button type="button" key={result.id} onClick={() => startConversation(result)}><Avatar usuario={result} size="small" /><span><strong>{result.nombre}</strong><small>{result.usuario}</small></span></button>)}
            </div>
          </section>
        </div>
      ) : null}

      {notice ? <button type="button" className="mensajes-aviso" onClick={() => setNotice("")}>{notice}</button> : null}
    </main>
  );
}
