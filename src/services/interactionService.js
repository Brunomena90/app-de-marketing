import { db } from "../firebase";
import { collection, addDoc, getDocs, query, where, orderBy, limit, serverTimestamp } from "firebase/firestore";

const COLLECTION_NAME = "interactions";

/**
 * Registra una nueva interacción o actividad auditada.
 * @param {Object} interactionData - Datos de la interacción (debe incluir accountId, type, performedBy, summary).
 * @returns {Promise<string>} - ID del registro inmutable creado.
 */
export const logInteraction = async (interactionData) => {
  if (!interactionData.accountId) throw new Error("accountId es obligatorio para registrar una interacción.");
  if (!interactionData.type) throw new Error("type es obligatorio para registrar una interacción.");
  if (!interactionData.performedBy) throw new Error("performedBy es obligatorio para auditoría.");

  try {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...interactionData,
      date: interactionData.date || serverTimestamp(), // Oportunidad para pasar fecha en retrospectiva, o actual
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error("Error en logInteraction:", error);
    throw error;
  }
};

/**
 * Recupera el historial de interacciones generales para toda una cuenta.
 * Para usar ordenamiento compuesto, asegúrate de configurar un índice en Firestore para `accountId` y `date`.
 * @param {string} accountId - ID de la empresa/cuenta.
 * @param {number} maxResults - Límite de resultados (default 50).
 * @returns {Promise<Array>} Lista de interacciones ordenada por fecha.
 */
export const getInteractionsByAccount = async (accountId, maxResults = 50) => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where("accountId", "==", accountId),
      orderBy("date", "desc"),
      limit(maxResults)
    );
    const querySnapshot = await getDocs(q);
    
    const interactions = [];
    querySnapshot.forEach((doc) => {
      interactions.push({ id: doc.id, ...doc.data() });
    });
    return interactions;
  } catch (error) {
    console.error("Error en getInteractionsByAccount:", error);
    throw error;
  }
};

/**
 * Recupera el historial de interacciones específico con un contacto de una cuenta.
 * Requiere un índice compuesto en Firestore (`contactId` + `date`).
 * @param {string} contactId - ID del contacto.
 * @param {number} maxResults - Límite de resultados (default 50).
 * @returns {Promise<Array>} Lista de interacciones asociada al contacto.
 */
export const getInteractionsByContact = async (contactId, maxResults = 50) => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where("contactId", "==", contactId),
      orderBy("date", "desc"),
      limit(maxResults)
    );
    const querySnapshot = await getDocs(q);
    
    const interactions = [];
    querySnapshot.forEach((doc) => {
      interactions.push({ id: doc.id, ...doc.data() });
    });
    return interactions;
  } catch (error) {
    console.error("Error en getInteractionsByContact:", error);
    throw error;
  }
};
