import { Link } from "react-router-dom";

const PATRON_MENCION = /(@[\w.-]+)/gu;

export default function TextoConMenciones({ texto = "", className = "" }) {
  const partes = String(texto).split(PATRON_MENCION);

  return (
    <span className={className}>
      {partes.map((parte, index) => parte.startsWith("@") ? (
        <Link
          className="mencion-enlace"
          to={`/perfil/${encodeURIComponent(parte.slice(1))}`}
          onClick={(event) => event.stopPropagation()}
          key={`${parte}-${index}`}
        >
          {parte}
        </Link>
      ) : <span key={`texto-${index}`}>{parte}</span>)}
    </span>
  );
}
