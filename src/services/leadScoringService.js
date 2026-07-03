import { db } from "../firebase";
import { doc, updateDoc, getDoc, serverTimestamp } from "firebase/firestore";

/**
 * Puntos asignados a cada evento de Lead Scoring.
 */
export const SCORING_VALUES = {
  EMAIL_OPEN: 10,
  PRICING_CLICK: 20,
  INACTIVITY_PENALTY: -50,
};

/**
 * Umbral para marcar a un contacto como MQL.
 */
export const MQL_THRESHOLD = 50;

/**
 * URL del Webhook para notificaciones al equipo de ventas.
 * TODO: Reemplazar con la URL real de Zapier, Slack, etc.
 */
const WEBHOOK_URL = "https://hooks.example.com/services/sales-notifications";

/**
 * Procesa un evento de interacción y actualiza el score del lead.
 * @param {string} contactId - ID del contacto.
 * @param {string} eventType - Tipo de evento ('EMAIL_OPEN' | 'PRICING_CLICK').
 */
export const processLeadEvent = async (contactId, eventType) => {
  const points = SCORING_VALUES[eventType] || 0;
  if (points === 0) return;

  try {
    const contactRef = doc(db, "contacts", contactId);
    const contactSnap = await getDoc(contactRef);

    if (!contactSnap.exists()) {
      throw new Error("El contacto no existe.");
    }

    const contactData = contactSnap.data();
    const currentScore = contactData.leadScore || 0;
    const newScore = Math.max(0, currentScore + points); // Evitar scores negativos si se desea, o permitir según política.

    const updates = {
      leadScore: newScore,
      lastActivityAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // Verificar si alcanza el umbral de MQL
    if (newScore >= MQL_THRESHOLD && contactData.status !== "MQL") {
      updates.status = "MQL";
      updates.qualifiedAt = serverTimestamp();
      
      // Notificar automáticamente
      await notifySalesTeam({ id: contactId, ...contactData, leadScore: newScore });
    }

    await updateDoc(contactRef, updates);
    console.log(`Lead Scoring: +${points} pts para ${contactId}. Nuevo Score: ${newScore}`);
  } catch (error) {
    console.error("Error en processLeadEvent:", error);
    throw error;
  }
};

/**
 * Verifica la inactividad de un contacto y aplica la penalización si han pasado 30 días.
 * @param {string} contactId - ID del contacto.
 */
export const checkInactivity = async (contactId) => {
  try {
    const contactRef = doc(db, "contacts", contactId);
    const contactSnap = await getDoc(contactRef);

    if (!contactSnap.exists()) return;

    const { lastActivityAt, leadScore = 0, status } = contactSnap.data();
    
    if (!lastActivityAt) return;

    const lastActivityDate = lastActivityAt.toDate ? lastActivityAt.toDate() : new Date(lastActivityAt);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    if (lastActivityDate < thirtyDaysAgo) {
      const newScore = Math.max(0, leadScore + SCORING_VALUES.INACTIVITY_PENALTY);
      
      const updates = {
        leadScore: newScore,
        lastActivityAt: serverTimestamp(), // Reseteamos el reloj de inactividad
        updatedAt: serverTimestamp(),
      };

      // Si baja de MQL, opcionalmente podrías degradar el status
      if (newScore < MQL_THRESHOLD && status === "MQL") {
        updates.status = "lead";
      }

      await updateDoc(contactRef, updates);
      console.log(`Lead Scoring: Penalización por inactividad (-50 pts) para ${contactId}.`);
    }
  } catch (error) {
    console.error("Error en checkInactivity:", error);
  }
};

/**
 * Notifica al equipo de ventas vía Webhook.
 * @param {Object} contact - Datos del contacto calificado.
 */
const notifySalesTeam = async (contact) => {
  try {
    const payload = {
      event: "new_mql_qualified",
      timestamp: new Date().toISOString(),
      contact: {
        id: contact.id,
        name: contact.name || "Contacto Sin Nombre",
        email: contact.email || "N/A",
        score: contact.leadScore,
        accountId: contact.accountId,
      },
      message: `¡Nuevo MQL calificado! El contacto "${contact.name}" ha alcanzado ${contact.leadScore} puntos.`,
    };

    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Error en el Webhook: ${response.statusText}`);
    }

    console.log("Notificación enviada exitosamente al equipo de ventas.");
  } catch (error) {
    console.error("Fallo al enviar notificación vía Webhook:", error);
  }
};
