const temas = {
  "pop": {
    "color": "#ffb21a",
    "fondo": "#302010",
    "simbolos": [
      "destello",
      "microfono",
      "disco"
    ],
    "ritmo": 0.45,
    "angulo": "25deg"
  },
  "rock": {
    "color": "#ffb21a",
    "fondo": "#302010",
    "simbolos": [
      "rayo",
      "guitarra",
      "amplificador"
    ],
    "ritmo": 0.78,
    "angulo": "-35deg"
  },
  "metal": {
    "color": "#ffb21a",
    "fondo": "#292019",
    "simbolos": [
      "rayo",
      "guitarraV",
      "amplificador"
    ],
    "ritmo": 1.2,
    "angulo": "-55deg"
  },
  "urbano": {
    "color": "#ffb21a",
    "fondo": "#302010",
    "simbolos": [
      "auriculares",
      "microfono",
      "parlante"
    ],
    "ritmo": 0.9,
    "angulo": "90deg"
  },
  "jazz": {
    "color": "#ffb21a",
    "fondo": "#302010",
    "simbolos": [
      "teclas",
      "saxo",
      "nota"
    ],
    "ritmo": 0.3,
    "angulo": "35deg"
  },
  "blues": {
    "color": "#ffb21a",
    "fondo": "#1c2429",
    "simbolos": [
      "nota",
      "guitarra",
      "armonica"
    ],
    "ritmo": 0.23,
    "angulo": "0deg"
  },
  "funk": {
    "color": "#ffb21a",
    "fondo": "#302010",
    "simbolos": [
      "disco",
      "bajo",
      "parlante"
    ],
    "ritmo": 0.62,
    "angulo": "-20deg"
  },
  "folklore": {
    "color": "#ffb21a",
    "fondo": "#302010",
    "simbolos": [
      "sol",
      "acustica",
      "bombo"
    ],
    "ritmo": 0.37,
    "angulo": "45deg"
  }
};

const trazos = {
  "destello": "M32 7 38 25 56 32 38 39 32 57 26 39 8 32 26 25Z M49 9v10 M44 14h10",
  "rayo": "M37 5 12 35h18l-4 24 27-34H35Z",
  "microfono": "M23 15a9 9 0 0 1 18 0v18a9 9 0 0 1-18 0Z M17 29v4a15 15 0 0 0 30 0v-4 M32 48v10 M23 58h18 M28 18h8 M28 24h8",
  "guitarra": "M39 24 52 7l5 4-13 18 M37 25c-6-8-17-5-17 2 0 5-9 4-11 12-4 16 14 24 24 12 5-6 0-9 5-12 5-4 4-9-1-14Z M23 40 48 15 M19 44l6 5",
  "guitarraV": "M37 27 51 6l6 4-15 22 10 23-20-9-21 9 14-29 7 10Z M27 44 51 12 M28 42l9 5",
  "acustica": "M29 28V8h7v20c13-4 16 9 10 13 13 18-18 24-26 10-5-8 3-10 0-15-3-6 3-11 9-8Z M28 39a5 5 0 1 0 10 0 5 5 0 1 0-10 0 M26 50h14 M32 9v41",
  "bajo": "M35 28 47 5l6 3-12 25c9 7 5 21-6 24-17 5-25-12-17-19 5-5 6-9 4-16l8 8Z M28 45 48 11 M25 47l9 4",
  "saxo": "M25 8h10v25c0 11 7 14 12 7l-7-9 16-9v20c0 22-31 20-31-1V15h-8 M30 22h9 M30 29h9 M30 36h9 M43 29l11 9",
  "teclas": "M8 15h48v36H8Z M20 16v35 M32 16v35 M44 16v35 M16 16v19h8V16 M28 16v19h8V16 M40 16v19h8V16",
  "nota": "M27 43V16l25-7v29 M27 23l25-7 M27 43c0 10-18 13-18 4 0-8 18-11 18-4Z M52 38c0 10-18 13-18 4 0-8 18-11 18-4Z",
  "disco": "M32 7a25 25 0 1 0 0 50 25 25 0 1 0 0-50 M32 26a6 6 0 1 0 0 12 6 6 0 1 0 0-12 M15 29a18 18 0 0 1 14-14 M49 35a18 18 0 0 1-14 14",
  "amplificador": "M9 14h46v43H9Z M23 14V8h18v6 M9 25h46 M16 20h2 M24 20h2 M39 20h8 M17 33l30 16 M17 41l21 11 M27 31l20 11",
  "parlante": "M15 7h34v50H15Z M32 28a10 10 0 1 0 0 20 10 10 0 1 0 0-20 M32 13a4 4 0 1 0 0 8 4 4 0 1 0 0-8 M29 38h6",
  "auriculares": "M11 36v-7a21 21 0 0 1 42 0v7 M11 30h8v22h-8c-8 0-8-22 0-22Z M53 30h-8v22h8c8 0 8-22 0-22Z M45 52c0 6-5 8-13 8",
  "armonica": "M7 22h50v22H7Z M7 28h50 M14 29v9 M22 29v9 M30 29v9 M38 29v9 M46 29v9 M53 29v9",
  "sol": "M32 19a13 13 0 1 0 0 26 13 13 0 1 0 0-26 M32 4v8 M32 52v8 M4 32h8 M52 32h8 M12 12l6 6 M46 46l6 6 M12 52l6-6 M46 18l6-6",
  "bombo": "M10 21c0-11 44-11 44 0s-44 11-44 0Z M10 21v27c0 11 44 11 44 0V21 M12 26l12 25 8-23 9 23 11-25 M16 8l28 13 M49 7 23 20"
};

function SimboloSondar({ nombre }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" focusable="false">
      <path d={trazos[nombre]} />
    </svg>
  );
}


export default function PortadaComunidad({ genero }) {
  if (genero === "rock") {
    return (
      <div className="comunidad-cover comunidad-cover-foto" aria-hidden="true">
        <img src="/comunidad-rock-banner.png" alt="" width="3000" height="664" />
      </div>
    );
  }
  const tema = temas[genero] || temas.pop;
  return (
    <div className="comunidad-cover" aria-hidden="true" style={{
      '--portada-acento': tema.color,
      '--portada-fondo': tema.fondo,
      '--portada-angulo': tema.angulo,
    }}>
      <span className="comunidad-cover-marca">SONDAR / COMUNIDAD</span>
      <div className="comunidad-cover-ondas">
        {Array.from({ length: 48 }, (_, indice) => {
          const simbolo = [12, 27, 41].indexOf(indice);
          return simbolo >= 0 ? (
            <span key={indice} className="comunidad-cover-nota" style={{ '--nota-giro': (simbolo - 1) * 12 + 'deg' }}>
              <SimboloSondar nombre={tema.simbolos[simbolo]} />
            </span>
          ) : (
            <i key={indice} style={{ height: (18 + Math.round(Math.abs(Math.sin(indice * tema.ritmo)) * 44 + Math.abs(Math.cos(indice * tema.ritmo * 0.43)) * 30)) + '%' }} />
          );
        })}
      </div>
    </div>
  );
}
