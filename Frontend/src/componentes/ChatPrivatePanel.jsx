import { useMemo, useState } from "react";

function ChatPrivatePanel({ usuario, onClose }) {
  const nombre = usuario?.user_metadata?.name || usuario?.email?.split("@")[0] || "Usuario";
  const friends = useMemo(
    () => [
      { id: "sondar", username: "Equipo SONDAR" },
      { id: "comunidad", username: "Comunidad" },
    ],
    []
  );
  const [selected, setSelected] = useState(friends[0]);
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender_id: "sondar",
      message: `Hola ${nombre}, tu bandeja esta lista.`,
      created_at: new Date().toISOString(),
    },
  ]);
  const [draft, setDraft] = useState("");

  const send = () => {
    const text = draft.trim();
    if (!text || !selected) return;

    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        sender_id: usuario?.id || "me",
        message: text,
        created_at: new Date().toISOString(),
      },
    ]);
    setDraft("");
  };

  return (
    <div className="panel-overlay" role="presentation" onMouseDown={onClose}>
      <div
        className="panel chat-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Bandeja de entrada"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="panel-header">
          <h3>Bandeja de entrada</h3>
          <button className="panel-close" onClick={onClose} aria-label="Cerrar" type="button">
            x
          </button>
        </div>

        <div className="chat-layout">
          <aside className="chat-sidebar">
            {friends.map((friend) => (
              <button
                key={friend.id}
                className={`friend-item ${selected?.id === friend.id ? "active" : ""}`}
                onClick={() => setSelected(friend)}
                type="button"
              >
                {friend.username}
              </button>
            ))}
          </aside>

          <main className="chat-main">
            <div className="chat-messages">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`chat-msg ${message.sender_id === (usuario?.id || "me") ? "me" : "them"}`}
                >
                  <div className="chat-bubble">{message.message}</div>
                  <div className="chat-time">
                    {new Date(message.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="chat-compose">
              <input
                className="chat-input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={`Mensaje para ${selected?.username || "contacto"}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter") send();
                }}
              />
              <button className="chat-send" onClick={send} type="button">
                Enviar
              </button>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default ChatPrivatePanel;
