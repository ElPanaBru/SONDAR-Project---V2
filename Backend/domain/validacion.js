function enteroLimitado(valor, { predeterminado, minimo = 1, maximo }) {
  const numero = Number.parseInt(String(valor ?? ''), 10);
  if (!Number.isFinite(numero)) return predeterminado;
  return Math.min(maximo, Math.max(minimo, numero));
}

function textoLimitado(valor, { minimo = 0, maximo, campo }) {
  const texto = String(valor || '').trim();
  if (texto.length < minimo || texto.length > maximo) {
    return {
      error: `${campo} debe tener entre ${minimo} y ${maximo} caracteres.`,
      texto,
    };
  }
  return { texto };
}

function urlHttpOpcional(valor) {
  const texto = String(valor || '').trim();
  if (!texto) return { url: null };
  if (texto.length > 1000) return { error: 'El enlace es demasiado largo.' };

  try {
    const url = new URL(texto);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Protocolo no permitido');
    return { url: url.toString() };
  } catch {
    return { error: 'El enlace debe ser una URL http o https valida.' };
  }
}

module.exports = { enteroLimitado, textoLimitado, urlHttpOpcional };
