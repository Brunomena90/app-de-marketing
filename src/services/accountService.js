import { db } from "../firebase";
import { collection, addDoc, doc, updateDoc, getDoc, getDocs, query, where, serverTimestamp } from "firebase/firestore";

const COLLECTION_NAME = "accounts";

/**
 * Crea una nueva empresa (cuenta).
 * @param {Object} accountData - Datos parciales de la empresa.
 * @returns {Promise<string>} - ID del documento creado.
 */
export const createAccount = async (accountData) => {
  try {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...accountData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error("Error en createAccount:", error);
    throw error;
  }
};

/**
 * Actualiza la información de una empresa existente.
 * @param {string} accountId - ID de la empresa.
 * @param {Object} accountData - Campos a actualizar.
 */
export const updateAccount = async (accountId, accountData) => {
  try {
    const docRef = doc(db, COLLECTION_NAME, accountId);
    await updateDoc(docRef, {
      ...accountData,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error en updateAccount:", error);
    throw error;
  }
};

/**
 * Obtiene el detalle de una empresa por su ID.
 * @param {string} accountId - ID de la empresa.
 * @returns {Promise<Object>} - Datos de la empresa incluyendo el id.
 */
export const getAccountById = async (accountId) => {
  try {
    const docRef = doc(db, COLLECTION_NAME, accountId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    } else {
      throw new Error("La empresa no existe");
    }
  } catch (error) {
    console.error("Error en getAccountById:", error);
    throw error;
  }
};

/**
 * Obtiene todas las empresas, con opción de filtro básico.
 * @param {Object} filters - Filtros. (Ej: { tags: ["VIP"] })
 * @returns {Promise<Array>} - Lista de empresas.
 */
export const getAccounts = async (filters = {}) => {
  try {
    let q = collection(db, COLLECTION_NAME);
    
    // Si se pasa tags, usar array-contains-any (hasta 10 elementos permitidos en Firestore)
    if (filters.tags && filters.tags.length > 0) {
      q = query(q, where("segmentationTags", "array-contains-any", filters.tags));
    }
    
    // Nota: agregar más where clause requiere configurar índices en Firestore.
    // Ejemplo de industry (debe coincidir exactamente):
    if (filters.industry) {
      q = query(q, where("industry", "==", filters.industry));
    }

    const querySnapshot = await getDocs(q);
    const accounts = [];
    querySnapshot.forEach((doc) => {
      accounts.push({ id: doc.id, ...doc.data() });
    });
    return accounts;
  } catch (error) {
    console.error("Error en getAccounts:", error);
    throw error;
  }
};
