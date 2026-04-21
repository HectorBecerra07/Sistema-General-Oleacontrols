import prisma from '../_lib/prisma.js'
import { authMiddleware } from '../_lib/auth.js'

export default async function handler(req, res) {
  const { method } = req;
  const user = authMiddleware(req, res);
  if (!user) return;

  if (method === 'GET') {
    try {
      const events = await prisma.calendarEvent.findMany({
        where: { userId: user.id },
        orderBy: { startDate: 'asc' }
      });
      return res.status(200).json(events);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  if (method === 'POST') {
    try {
      const { title, description, type, startDate, endDate, allDay, color } = req.body;
      const event = await prisma.calendarEvent.create({
        data: {
          title,
          description,
          type,
          startDate: new Date(startDate),
          endDate: endDate ? new Date(endDate) : null,
          allDay: allDay || false,
          color: color || '#3b82f6',
          userId: user.id
        }
      });
      return res.status(201).json(event);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  if (method === 'PUT') {
    try {
      const { id, ...data } = req.body;
      if (data.startDate) data.startDate = new Date(data.startDate);
      if (data.endDate) data.endDate = new Date(data.endDate);
      
      const updated = await prisma.calendarEvent.update({
        where: { id },
        data
      });
      return res.status(200).json(updated);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  if (method === 'DELETE') {
    try {
      const { id } = req.query;
      await prisma.calendarEvent.delete({ where: { id } });
      return res.status(200).json({ ok: true });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
