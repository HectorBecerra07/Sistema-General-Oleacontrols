import prisma from '../_lib/prisma.js'

export default async function handler(req, res) {
  const method = req.method.toUpperCase();
  const urlParts = req.url.split('?')[0].split('/');
  const lastPart = urlParts[urlParts.length - 1];
  const resource = (req.query?.resource || lastPart || '').toLowerCase();

  console.log(`[CRM API] ${method} request for resource: "${resource}" from URL: ${req.url}`);

  try {
    // ─── GET ────────────────────────────────────────────────────────────
    if (method === 'GET') {
      if (resource === 'leads') {
        const leads = await prisma.lead.findMany({ include: { assignedTo: true }, orderBy: { createdAt: 'desc' } });
        return res.status(200).json(leads || []);
      }

      if (resource === 'clients') {
        const clients = await prisma.client.findMany({ orderBy: { companyName: 'asc' } });
        return res.status(200).json(clients || []);
      }

      if (resource === 'deals') {
        const deals = await prisma.deal.findMany({
          include: {
            client: { select: { id: true, companyName: true } },
            assignedTo: { select: { id: true, name: true, avatar: true } },
            _count: { select: { activities: true } }
          },
          orderBy: { updatedAt: 'desc' }
        });
        return res.status(200).json(deals || []);
      }

      if (resource === 'deal-activities') {
        const dealId = req.query.dealId;
        if (!dealId) return res.status(400).json({ error: 'dealId requerido' });
        const activities = await prisma.dealActivity.findMany({
          where: { dealId },
          orderBy: { createdAt: 'desc' }
        });
        return res.status(200).json(activities || []);
      }
    }

    // ─── POST ───────────────────────────────────────────────────────────
    if (method === 'POST') {
      if (resource === 'leads') {
        const { name, company, email, phone, estimatedValue, source } = req.body;
        const lead = await prisma.lead.create({
          data: {
            name, company, email, phone,
            estimatedValue: parseFloat(estimatedValue) || 0,
            source: source || 'Web',
            stage: 'PROSPECT'
          }
        });
        return res.status(201).json(lead);
      }

      if (resource === 'clients') {
        const { companyName, contactName, email, phone, rfc, address, latitude, longitude } = req.body;
        if (!companyName || !email) return res.status(400).json({ error: 'Faltan campos obligatorios (Empresa/Email)' });
        const client = await prisma.client.create({
          data: {
            companyName,
            contactName: contactName || 'Sin contacto',
            email, phone: phone || '', rfc: rfc || '', address: address || '',
            latitude: parseFloat(latitude) || null,
            longitude: parseFloat(longitude) || null
          }
        });
        return res.status(201).json(client);
      }

      if (resource === 'deals') {
        const {
          title, value, company, contactName, contactEmail, contactPhone,
          clientId, assignedToId, stage, probability, expectedClose,
          source, description, notes
        } = req.body;
        if (!title) return res.status(400).json({ error: 'El título es obligatorio' });

        const STAGE_PROBABILITY = {
          QUALIFICATION: 10, NEEDS_ANALYSIS: 20, VALUE_PROPOSITION: 30,
          IDENTIFY_DECISION_MAKERS: 40, PROPOSAL_PRICE_QUOTE: 50,
          PROPOSAL_SENT: 65, NEGOTIATION_1: 75, RECOTIZACION: 80,
          NEGOTIATION_2: 90, CLOSED_WON_PENDING: 95, CLOSED_WON: 100, CLOSED_LOST: 0
        };
        const dealStage = stage || 'QUALIFICATION';
        const dealProbability = probability !== undefined ? parseInt(probability) : (STAGE_PROBABILITY[dealStage] ?? 10);

        const deal = await prisma.deal.create({
          data: {
            title,
            value: parseFloat(value) || 0,
            company: company || null,
            contactName: contactName || null,
            contactEmail: contactEmail || null,
            contactPhone: contactPhone || null,
            clientId: clientId || null,
            assignedToId: assignedToId || null,
            stage: dealStage,
            probability: dealProbability,
            expectedClose: expectedClose ? new Date(expectedClose) : null,
            source: source || 'Web',
            description: description || null,
            notes: notes || null
          },
          include: {
            client: { select: { id: true, companyName: true } },
            assignedTo: { select: { id: true, name: true, avatar: true } }
          }
        });
        return res.status(201).json(deal);
      }

      if (resource === 'deal-activities') {
        const { dealId, type, content, authorName } = req.body;
        if (!dealId || !content) return res.status(400).json({ error: 'dealId y content son obligatorios' });
        const activity = await prisma.dealActivity.create({
          data: { dealId, type: type || 'NOTE', content, authorName: authorName || null }
        });
        return res.status(201).json(activity);
      }
    }

    // ─── PUT ────────────────────────────────────────────────────────────
    if (method === 'PUT') {
      const { id, ...data } = req.body;

      if (resource === 'leads') {
        const updated = await prisma.lead.update({ where: { id }, data: { stage: data.stage } });
        return res.status(200).json(updated);
      }

      if (resource === 'clients') {
        const updated = await prisma.client.update({
          where: { id },
          data: {
            companyName: data.companyName, contactName: data.contactName,
            email: data.email, phone: data.phone, rfc: data.rfc,
            address: data.address,
            latitude: parseFloat(data.latitude) || null,
            longitude: parseFloat(data.longitude) || null,
            status: data.status
          }
        });
        return res.status(200).json(updated);
      }

      if (resource === 'deals') {
        const STAGE_PROBABILITY = {
          QUALIFICATION: 10, NEEDS_ANALYSIS: 20, VALUE_PROPOSITION: 30,
          IDENTIFY_DECISION_MAKERS: 40, PROPOSAL_PRICE_QUOTE: 50,
          PROPOSAL_SENT: 65, NEGOTIATION_1: 75, RECOTIZACION: 80,
          NEGOTIATION_2: 90, CLOSED_WON_PENDING: 95, CLOSED_WON: 100, CLOSED_LOST: 0
        };

        const updateData = {};
        if (data.title !== undefined) updateData.title = data.title;
        if (data.value !== undefined) updateData.value = parseFloat(data.value) || 0;
        if (data.company !== undefined) updateData.company = data.company || null;
        if (data.contactName !== undefined) updateData.contactName = data.contactName || null;
        if (data.contactEmail !== undefined) updateData.contactEmail = data.contactEmail || null;
        if (data.contactPhone !== undefined) updateData.contactPhone = data.contactPhone || null;
        if (data.clientId !== undefined) updateData.clientId = data.clientId || null;
        if (data.assignedToId !== undefined) updateData.assignedToId = data.assignedToId || null;
        if (data.source !== undefined) updateData.source = data.source || null;
        if (data.description !== undefined) updateData.description = data.description || null;
        if (data.notes !== undefined) updateData.notes = data.notes || null;
        if (data.expectedClose !== undefined) updateData.expectedClose = data.expectedClose ? new Date(data.expectedClose) : null;
        if (data.stage !== undefined) {
          updateData.stage = data.stage;
          // auto-update probability when stage changes unless explicitly set
          if (data.probability === undefined) {
            updateData.probability = STAGE_PROBABILITY[data.stage] ?? 10;
          }
        }
        if (data.probability !== undefined) updateData.probability = parseInt(data.probability);

        const updated = await prisma.deal.update({
          where: { id },
          data: updateData,
          include: {
            client: { select: { id: true, companyName: true } },
            assignedTo: { select: { id: true, name: true, avatar: true } },
            _count: { select: { activities: true } }
          }
        });
        return res.status(200).json(updated);
      }
    }

    // ─── DELETE ─────────────────────────────────────────────────────────
    if (method === 'DELETE') {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'ID requerido' });

      if (resource === 'leads') {
        await prisma.lead.delete({ where: { id } });
        return res.status(200).json({ success: true });
      }

      if (resource === 'clients') {
        try {
          const countQuotes = await prisma.quote.count({ where: { clientId: id } });
          const countDeals = await prisma.deal.count({ where: { clientId: id } });
          if (countQuotes > 0 || countDeals > 0) {
            return res.status(409).json({
              error: 'No se puede eliminar el cliente porque tiene cotizaciones o tratos vinculados.',
              details: { quotes: countQuotes, deals: countDeals }
            });
          }
          await prisma.client.delete({ where: { id } });
          return res.status(200).json({ success: true });
        } catch (err) {
          if (err.code === 'P2003') return res.status(409).json({ error: 'Existen registros vinculados a este cliente.' });
          throw err;
        }
      }

      if (resource === 'deals') {
        await prisma.deal.delete({ where: { id } });
        return res.status(200).json({ success: true });
      }

      if (resource === 'deal-activities') {
        await prisma.dealActivity.delete({ where: { id } });
        return res.status(200).json({ success: true });
      }
    }

    return res.status(405).json({ error: 'Recurso o Método no soportado', details: `Resource: ${resource}, Method: ${method}` });

  } catch (error) {
    console.error("CRM API ERROR:", error);
    return res.status(500).json({ error: error.message });
  }
}
