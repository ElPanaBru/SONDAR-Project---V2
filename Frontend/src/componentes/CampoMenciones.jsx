import { useEffect, useRef, useState } from "react";
import { apiRequest } from "../lib/api";
import "./menciones.css";

function detectarMencion(texto, cursor) {
  const previo = texto.slice(0, cursor);
  const coincidencia = previo.match(/(?:^|\s)@([\w.-]{1,40})$/u);
  if (!coincidencia) return null;
  return {
    query: coincidencia[1],
    inicio: cursor - coincidencia[1].length - 1,
    fin: cursor,
  };
}

export default function CampoMenciones({
  value,
  onChange,
  onMentionSelect,
  multiline = true,
  className = "",
  ...props
}) {
  const inputRef = useRef(null);
  const [mencion, setMencion] = useState(null);
  const [resultados, setResultados] = useState([]);
  const [activo, setActivo] = useState(0);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    if (!mencion?.query) return undefined;

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        const response = await apiRequest(`/api/usuarios?query=${encodeURIComponent(mencion.query)}`, {
          signal: controller.signal,
        });
        if (!response.ok) return;
        const data = await response.json();
        setResultados(Array.isArray(data) ? data.slice(0, 6) : []);
        setActivo(0);
      } catch (error) {
        if (error.name !== "AbortError") setResultados([]);
      } finally {
        if (!controller.signal.aborted) setBuscando(false);
      }
    }, 180);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [mencion?.query]);

  const actualizar = (event) => {
    const texto = event.target.value;
    const cursor = event.target.selectionStart ?? texto.length;
    const siguienteMencion = detectarMencion(texto, cursor);
    onChange(texto);
    setMencion(siguienteMencion);
    setBuscando(Boolean(siguienteMencion?.query));
    if (!siguienteMencion) setResultados([]);
  };

  const seleccionar = (usuario) => {
    if (!mencion) return;
    const username = String(usuario.username || usuario.usuario || "").replace(/^@/, "");
    const siguiente = `${value.slice(0, mencion.inicio)}@${username} ${value.slice(mencion.fin)}`;
    const cursor = mencion.inicio + username.length + 2;
    onChange(siguiente);
    onMentionSelect?.(usuario);
    setMencion(null);
    setResultados([]);
    setBuscando(false);
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(cursor, cursor);
    });
  };

  const manejarTecla = (event) => {
    if (resultados.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActivo((actual) => (actual + 1) % resultados.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActivo((actual) => (actual - 1 + resultados.length) % resultados.length);
    } else if (event.key === "Enter" && mencion) {
      event.preventDefault();
      seleccionar(resultados[activo]);
    } else if (event.key === "Escape") {
      setMencion(null);
      setResultados([]);
      setBuscando(false);
    }
  };

  const Input = multiline ? "textarea" : "input";

  return (
    <div className={`campo-menciones ${className}`}>
      <Input
        {...props}
        ref={inputRef}
        value={value}
        onChange={actualizar}
        onKeyDown={manejarTecla}
        onClick={(event) => {
          const siguienteMencion = detectarMencion(
            value,
            event.currentTarget.selectionStart ?? value.length
          );
          const cambioConsulta = siguienteMencion?.query !== mencion?.query;
          setMencion(siguienteMencion);
          if (cambioConsulta) setBuscando(Boolean(siguienteMencion?.query));
          if (!siguienteMencion) setResultados([]);
        }}
      />
      {mencion?.query ? (
        <div className="menciones-sugerencias" role="listbox" aria-label="Sugerencias de usuarios">
          {buscando ? (
            <div className="menciones-estado" role="status">Buscando personas...</div>
          ) : resultados.length === 0 ? (
            <div className="menciones-estado" role="status">No encontramos usuarios.</div>
          ) : resultados.map((usuario, index) => (
            <button
              type="button"
              role="option"
              aria-selected={index === activo}
              className={index === activo ? "activo" : ""}
              key={usuario.id}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => seleccionar(usuario)}
            >
              <span className="mencion-avatar">
                {usuario.avatar ? <img src={usuario.avatar} alt="" /> : (usuario.nombre || "S").charAt(0).toUpperCase()}
              </span>
              <span>
                <strong>{usuario.nombre}</strong>
                <small>{usuario.usuario}</small>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
