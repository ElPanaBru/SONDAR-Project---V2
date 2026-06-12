import { useEffect, useState } from "react";

const demoNotificaciones = [
  {
    id: "bienvenida",
    title: "Bienvenido a SONDAR",
    body: "Aca vas a ver avisos de seguidores, respuestas y actividad de tus publicaciones.",
    created_at: new Date().toISOString(),
    read_at: null,
  },
];

function NotificationPanel({ usuario, onClose }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    setItems(usuario ? demoNotificaciones : []);
  }, [usuario]);

  const marcarLeida = (notificacion) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === notificacion.id
          ? { ...item, read_at: item.read_at || new Date().toISOString() }
          : item
      )
    );
  };

  return (
    <div className="panel-overlay" role="presentation" onMouseDown={onClose}>
      <div
        className="panel notifications-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Notificaciones"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="panel-header">
          <h3>Notificaciones</h3>
          <button className="panel-close" onClick={onClose} aria-label="Cerrar" type="button">
            x
          </button>
        </div>

        <div className="panel-body">
          {items.length === 0 ? (
            <div className="panel-empty">No hay notificaciones</div>
          ) : (
            items.map((notificacion) => (
              <button
                type="button"
                key={notificacion.id}
                className={`notif-item ${notificacion.read_at ? "read" : "unread"}`}
                onClick={() => marcarLeida(notificacion)}
              >
                <div className="notif-title">{notificacion.title}</div>
                {notificacion.body ? <div className="notif-body">{notificacion.body}</div> : null}
                <div className="notif-time">
                  {new Date(notificacion.created_at).toLocaleString()}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default NotificationPanel;
