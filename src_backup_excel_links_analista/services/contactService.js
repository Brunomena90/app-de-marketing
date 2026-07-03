import { db } from "../firebase";
import { collection, addDoc, doc, updateDoc, getDoc, getDocs, query, where, serverTimestamp } from "firebase/firestore";

const COLLECTION_NAME = "contacts";

/**
 * Registra un nuevo contacto vinculado a una empresa.
 * @param {string} accountId - ID de la empresa vinculada.
 * @param {Object} contactData - Datos del contacto a registrar.
 * @returns {Promise<string>} - ID del contacto creado.
 */
export const createContact = async (accountId, contactData) => {
  if (!accountId) throw new Error("El accountId es obligatorio para crear un contacto.");
  
  try {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...contactData,
      accountId,
      leadScore: 0,
      lastActivityAt: serverTimestamp(),
      status: "lead",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error("Error en createContact:", error);
    throw error;
  }
};

/**
 * Actualiza los datos de un contacto.
 * @param {string} contactId - ID del contacto.
 * @param {Object} contactData - Campos a actualizar.
 */
export const updateContact = async (contactId, contactData) => {
  try {
    const docRef = doc(db, COLLECTION_NAME, contactId);
    await updateDoc(docRef, {
      ...contactData,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error en updateContact:", error);
    throw error;
  }
};

/**
 * Recupera un contacto por su ID.
 * @param {string} contactId - ID del contacto.
 * @returns {Promise<Object>} Datos del contacto.
 */
export const getContactById = async (contactId) => {
  try {
    const docRef = doc(db, COLLECTION_NAME, contactId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    } else {
      throw new Error("El contacto no existe");
    }
  } catch (error) {
    console.error("Error en getContactById:", error);
    throw error;
  }
};

/**
 * Recupera todos los contactos ligados a una empresa.
 * @param {string} accountId - ID de la empresa.
 * @returns {Promise<Array>} Lista de contactos de esa empresa.
 */
export const getContactsByAccount = async (accountId) => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where("accountId", "==", accountId)
    );
    const querySnapshot = await getDocs(q);
    
    const contacts = [];
    querySnapshot.forEach((doc) => {
      contacts.push({ id: doc.id, ...doc.data() });
    });
    return contacts;
  } catch (error) {
    console.error("Error en getContactsByAccount:", error);
    throw error;
  }
};
