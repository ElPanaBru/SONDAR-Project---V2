import { useState } from "react";
import { CATEGORIAS_GUARDADOS, filtrarGuardados } from "../lib/guardados";
import { usePreferencias } from "../contextos/PreferenciasContext";
import "./perfilGuardados.css";

export default function PerfilGuardados({ items, renderItem }) {
  const [categoria, setCategoria] = useState("reel");
  const { t } = usePreferencias();
  const visibles = filtrarGuardados(items, categoria);
  const seleccionada = CATEGORIAS_GUARDADOS.find((opcion) => opcion.id === categoria);
  return (
    <section className="perfil-guardados" aria-label={t("Tus guardados")}>
      <div className="perfil-guardados-filtros" role="group" aria-label={t("Filtrar guardados por tipo")}>
        {CATEGORIAS_GUARDADOS.map((opcion) => (
          <button key={opcion.id} type="button" aria-pressed={categoria === opcion.id} aria-controls="perfil-guardados-resultados" onClick={() => setCategoria(opcion.id)}>
            <span className="material-symbols-rounded" aria-hidden="true">{opcion.icono}</span>
            <span>{t(opcion.nombre)}</span>
            <span className="perfil-guardados-cantidad">{filtrarGuardados(items, opcion.id).length}</span>
          </button>
        ))}
      </div>
      <div id="perfil-guardados-resultados">
        {visibles.length ? (
          <div className={categoria === "evento" ? "perfil-eventos-lista" : "perfil-publicaciones-grid"}>{visibles.map(renderItem)}</div>
        ) : (
          <div className="perfil-empty-state perfil-guardados-vacio">
            <span className="material-symbols-rounded" aria-hidden="true">{seleccionada.icono}</span>
            <h3>{t(seleccionada.vacio)}</h3>
            <p>{t("Usá el botón de guardar en el contenido para encontrarlo acá.")}</p>
          </div>
        )}
      </div>
    </section>
  );
}
