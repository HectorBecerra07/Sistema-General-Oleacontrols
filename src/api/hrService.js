import { apiFetch } from '../lib/api';

export const hrService = {
  async getEmployees() {
    const response = await apiFetch('/api/employees');
    if (!response.ok) throw new Error('Error al obtener empleados');
    return response.json();
  },

  async getEmployeeDetail(id) {
    const employees = await this.getEmployees();
    return employees.find(e => e.id === id) || null;
  },

  async saveEmployee(employeeData) {
    const response = await apiFetch('/api/employees', {
      method: 'POST',
      body: JSON.stringify(employeeData)
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || err.error || 'Error al guardar empleado');
    }
    return response.json();
  },

  async updateEmployee(id, updatedData) {
    const response = await apiFetch('/api/employees', {
      method: 'PUT',
      body: JSON.stringify({ id, ...updatedData })
    });
    if (!response.ok) {
        const err = await response.json();
        // Propagamos el mensaje real del servidor (ej: "Email ya existe" o "Fecha inválida")
        throw new Error(err.message || err.error || 'Error al actualizar empleado');
    }
    return response.json();
  },

  async deleteEmployee(id) {
    const response = await apiFetch(`/api/employees?id=${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Error al eliminar empleado');
    }
    return response.json();
  },

  async getCategories() {
    const response = await apiFetch('/api/categories');
    if (!response.ok) throw new Error('Error al obtener categorías');
    return response.json();
  },

  async saveCategory(categoryName) {
    const response = await apiFetch('/api/categories', {
      method: 'POST',
      body: JSON.stringify({ name: categoryName })
    });
    if (!response.ok) throw new Error('Error al guardar categoría');
    return response.json();
  },

  // --- VACACIONES ---
  async getVacationStatus(employeeId) {
    const response = await apiFetch(`/api/vacations?employeeId=${employeeId}`);
    if (!response.ok) throw new Error('Error al obtener balance de vacaciones');
    return response.json();
  },

  async requestVacation(requestData) {
    const response = await apiFetch('/api/vacations', {
      method: 'POST',
      body: JSON.stringify(requestData)
    });
    if (!response.ok) throw new Error('Error al solicitar vacaciones');
    return response.json();
  },

  async updateVacationRequest(requestId, status) {
    const response = await apiFetch('/api/vacations', {
      method: 'PUT',
      body: JSON.stringify({ requestId, status })
    });
    if (!response.ok) throw new Error('Error al actualizar solicitud');
    return response.json();
  },

  async updateVacationBalanceManual(employeeId, days) {
    const response = await apiFetch('/api/vacations', {
      method: 'POST',
      body: JSON.stringify({ employeeId, days, manualAdjustment: true })
    });
    if (!response.ok) throw new Error('Error al actualizar balance manualmente');
    return response.json();
  }
};
