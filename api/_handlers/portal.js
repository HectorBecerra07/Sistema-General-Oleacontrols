import prisma from '../_lib/prisma.js'
import { uploadToR2 } from '../_lib/r2.js'

export default async function handler(req, res) {
  const { method } = req;
  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ error: 'Token de acceso requerido' });
  }

  // 1. Validar Token y Obtener Cliente
  const client = await prisma.oTClient.findUnique({
    where: { portalToken: token },
    include: {
      calendarEvents: {
        orderBy: { startDate: 'asc' }
      }
    }
  });

  if (!client) {
    return res.status(404).json({ error: 'Portal no encontrado o enlace inválido' });
  }

  // GET: Obtener datos del cliente y sus eventos
  if (method === 'GET') {
    try {
      // También traer OTs relacionadas por nombre de cliente si aplica
      const workOrders = await prisma.workOrder.findMany({
        where: { clientName: client.name },
        select: {
          id: true,
          otNumber: true,
          title: true,
          status: true,
          scheduledDate: true,
          arrivalTime: true,
          description: true
        },
        orderBy: { createdAt: 'desc' }
      });

      return res.status(200).json({
        client: {
          name: client.name,
          storeName: client.storeName,
          address: client.address
        },
        events: client.calendarEvents,
        workOrders
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // POST: Subir evidencia a un evento específico
  if (method === 'POST') {
    try {
      const { eventId, evidence } = req.body; // evidence: { name, type, base64 }

      if (!eventId || !evidence) {
        return res.status(400).json({ error: 'Evento y evidencia requeridos' });
      }

      const event = await prisma.calendarEvent.findUnique({
        where: { id: eventId }
      });

      if (!event || event.otClientId !== client.id) {
        return res.status(403).json({ error: 'No tienes permiso para editar este evento' });
      }

      // Subir a R2
      const fileName = `portal/evidences/${client.id}/${Date.now()}_${evidence.name}`;
      const url = await uploadToR2(fileName, evidence.base64, evidence.type);

      // Actualizar evento con la nueva evidencia
      const currentEvidences = Array.isArray(event.evidences) ? event.evidences : [];
      const updatedEvidences = [...currentEvidences, {
        url,
        name: evidence.name,
        type: evidence.type,
        date: new Date().toISOString()
      }];

      const updated = await prisma.calendarEvent.update({
        where: { id: eventId },
        data: { evidences: updatedEvidences }
      });

      return res.status(200).json(updated);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
