const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

function limpiarTexto(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
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
        return res.status(400).json({
          error: 'Faltan los datos del contenido denunciado.',
        });
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
        return res.status(400).json({
          error: 'El asunto y el mensaje son obligatorios.',
        });
      }
    }

    try {
      if (!process.env.RESEND_API_KEY) {
        throw new Error('Falta RESEND_API_KEY en las variables de entorno.');
      }

      if (!process.env.SUPPORT_EMAIL) {
        throw new Error('Falta SUPPORT_EMAIL en las variables de entorno.');
      }

      const { error } = await resend.emails.send({
        from: 'SONDAR <no-reply@sond-ar.com>',
        to: [process.env.SUPPORT_EMAIL],
        replyTo: email || undefined,
        subject,
        text: message,
      });

      if (error) {
        throw new Error(error.message || 'Resend rechazo el mensaje.');
      }

      return res.json({ ok: true });
    } catch (error) {
      console.error(
        'No se pudo enviar el mensaje a soporte:',
        error.message
      );

      return res.status(502).json({
        error: 'No se pudo notificar al equipo de soporte.',
      });
    }
  },
};

module.exports = soporteController;