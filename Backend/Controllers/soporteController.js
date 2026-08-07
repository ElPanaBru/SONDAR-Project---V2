const EMAILJS_ENDPOINT = 'https://api.emailjs.com/api/v1.0/email/send';

function limpiarTexto(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

async function enviarEmail(templateParams) {
  const serviceId = process.env.EMAILJS_SERVICE_ID;
  const templateId = process.env.EMAILJS_TEMPLATE_ID;
  const publicKey = process.env.EMAILJS_PUBLIC_KEY;
  if (!serviceId || !templateId || !publicKey) {
    const error = new Error('EmailJS no esta configurado en el servidor.');
    error.status = 503;
    throw error;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  let response;
  try {
    response = await fetch(EMAILJS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        template_params: templateParams,
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    const error = new Error(detail || 'EmailJS rechazo el mensaje.');
    error.status = response.status;
    throw error;
  }
}

const soporteController = {
  async enviarMensaje(req, res) {
    const tipo = req.body?.tipo === 'denuncia' ? 'denuncia' : 'contacto';
    const email = limpiarTexto(req.user?.email, 254);
    const nombre = limpiarTexto(
      req.user?.user_metadata?.username
        || req.user?.user_metadata?.name
        || email.split('@')[0]
        || 'Usuario SONDAR',
      100,
    );

    let subject;
    let message;

    if (tipo === 'denuncia') {
      const contenidoTipo = limpiarTexto(req.body?.contenidoTipo, 40);
      const contenidoId = limpiarTexto(req.body?.contenidoId, 100);
      if (!contenidoTipo || !contenidoId) {
        return res.status(400).json({ error: 'Faltan los datos del contenido denunciado.' });
      }

      subject = `Nueva denuncia de ${contenidoTipo} #${contenidoId}`;
      message = [
        `Tipo: ${contenidoTipo}`,
        `ID: ${contenidoId}`,
        `Titulo/perfil: ${limpiarTexto(req.body?.titulo, 200) || 'Sin titulo'}`,
        `Autor denunciado: ${limpiarTexto(req.body?.autor, 120) || 'Sin identificar'}`,
        `Motivo: ${limpiarTexto(req.body?.motivo, 120) || 'Sin especificar'}`,
        `Detalle: ${limpiarTexto(req.body?.detalle, 2000) || 'Sin detalle adicional'}`,
        `Reportado por: ${nombre} (${email})`,
        `URL: ${limpiarTexto(req.body?.url, 500) || 'Sin URL'}`,
      ].join('\n');
    } else {
      subject = limpiarTexto(req.body?.subject, 160);
      message = limpiarTexto(req.body?.message, 4000);
      if (!subject || !message) {
        return res.status(400).json({ error: 'El asunto y el mensaje son obligatorios.' });
      }
    }

    try {
      await enviarEmail({
        subject,
        title: subject,
        name: nombre,
        message,
        email,
        user_email: email,
        from_email: email,
        reply_to: email,
        from_name: nombre,
      });
      return res.json({ ok: true });
    } catch (error) {
      console.error('No se pudo enviar el mensaje a soporte:', error.message);
      return res.status(error.status || 502).json({ error: 'No se pudo notificar al equipo de soporte.' });
    }
  },
};

module.exports = soporteController;
