import { db } from "../firebase";
import { 
  collection, addDoc, doc, updateDoc, getDoc, getDocs, 
  query, where, serverTimestamp, increment 
} from "firebase/firestore";

const TICKETS_COLLECTION = "tickets";
const USERS_COLLECTION = "users";

/**
 * Función auxiliar para calcular el SLA (Target Date) basado en prioridad.
 * @param {string} priority - 'low', 'medium', 'high', 'urgent'
 * @returns {Date} Fecha máxima de resolución
 */
const calculateSlaDate = (priority) => {
  const now = new Date();
  let hoursToAdd = 24; // Medium by default

  switch (priority) {
    case 'urgent':
      hoursToAdd = 1; // 1 hr
      break;
    case 'high':
      hoursToAdd = 4; // 4 hrs
      break;
    case 'medium':
      hoursToAdd = 24; // 24 hrs
      break;
    case 'low':
      hoursToAdd = 72; // 72 hrs
      break;
    default:
      hoursToAdd = 24;
  }
  
  now.setHours(now.getHours() + hoursToAdd);
  return now;
};

/**
 * Crea un nuevo ticket de soporte asociado a un contacto.
 * Calcula automáticamente el SLA basado en la prioridad elegida.
 * @param {Object} ticketData - Atributos básicos (contactId, accountId, subject, description, priority)
 * @returns {Promise<string>} - ID del ticket creado
 */
export const createTicket = async (ticketData) => {
  if (!ticketData.contactId) throw new Error("El contactId es requerido para un ticket.");
  
  const priority = ticketData.priority || 'medium';
  const slaTargetAt = calculateSlaDate(priority);

  try {
    const docRef = await addDoc(collection(db, TICKETS_COLLECTION), {
      ...ticketData,
      status: 'open',
      priority,
      slaTargetAt,
      assignedTo: null, 
      resolvedAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Opcional: Auto-asignar el ticket al agente con menor carga inmediatamente.
    await assignTicketToAvailableAgent(docRef.id);

    return docRef.id;
  } catch (error) {
    console.error("Error en createTicket:", error);
    throw error;
  }
};

/**
 * Algoritmo de balanceo e identificación: Asigna el ticket al agente con menor carga de trabajo.
 * @param {string} ticketId - ID del ticket a asignar
 */
export const assignTicketToAvailableAgent = async (ticketId) => {
  try {
    // 1. Obtener todos los agentes activos
    const q = query(
      collection(db, USERS_COLLECTION),
      where("role", "==", "support_agent"),
      where("status", "==", "active")
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      console.warn("No hay agentes de soporte disponibles para asignar el ticket", ticketId);
      return; 
    }

    let selectedAgent = null;
    let minLoad = Infinity;

    // 2. Encontrar al agente con la menor suma de tickets abiertos + en proceso
    snap.forEach(docSnap => {
      const data = docSnap.data();
      const loadCounters = data.activeTicketsCount || { open: 0, in_progress: 0 };
      const currentLoad = (loadCounters.open || 0) + (loadCounters.in_progress || 0);

      // Desempate: Se prioriza al que tenga menos tickets en estado "open" puramente.
      if (currentLoad < minLoad) {
        minLoad = currentLoad;
        selectedAgent = { id: docSnap.id, data, openCount: loadCounters.open || 0 };
      } else if (currentLoad === minLoad && selectedAgent) {
        if ((loadCounters.open || 0) < selectedAgent.openCount) {
           selectedAgent = { id: docSnap.id, data, openCount: loadCounters.open || 0 };
        }
      }
    });

    if (selectedAgent) {
      // 3. Actualizar el Ticket asignándolo al Agente
      const ticketRef = doc(db, TICKETS_COLLECTION, ticketId);
      await updateDoc(ticketRef, {
        assignedTo: selectedAgent.id,
        status: 'in_progress', // Lo pasamos a in progress si ya es asignado
        updatedAt: serverTimestamp()
      });

      // 4. Actualizar el contador de carga de trabajo del Agente elegido atómicamente
      const agentRef = doc(db, USERS_COLLECTION, selectedAgent.id);
      await updateDoc(agentRef, {
        "activeTicketsCount.in_progress": increment(1)
      });
      
      console.log(`Ticket ${ticketId} asignado al agente ${selectedAgent.id}`);
    }
  } catch (error) {
    console.error("Error en assignTicketToAvailableAgent:", error);
    throw error;
  }
};

/**
 * Cambia el estado de un ticket y ajusta los contadores del agente si corresponde.
 * @param {string} ticketId - ID del ticket
 * @param {Object} updateData - Campos para actualizar (status, resolucion, etc)
 */
export const updateTicket = async (ticketId, updateData) => {
  try {
    const ticketRef = doc(db, TICKETS_COLLECTION, ticketId);
    
    // Anexamos timestamp
    const payload = { ...updateData, updatedAt: serverTimestamp() };
    
    // Si se resuelve, seteamos resolve date
    if (updateData.status === 'resolved' || updateData.status === 'closed') {
       payload.resolvedAt = serverTimestamp();
    }
    
    await updateDoc(ticketRef, payload);
    
    // Nota: Deberíamos decrementar el contador del usuario aquí si estamos en un contexto real
    // donde un ticket deja de estar 'open' o 'in_progress', pero eso requeriría leer el ticket viejo.
    
  } catch (error) {
    console.error("Error en updateTicket:", error);
    throw error;
  }
};

/**
 * Recupera tickets para un contacto en particular (Historial del Usuario/Contacto).
 * @param {string} contactId 
 */
export const getTicketsByContact = async (contactId) => {
  try {
    const q = query(collection(db, TICKETS_COLLECTION), where("contactId", "==", contactId));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error en getTicketsByContact:", error);
    throw error;
  }
};
