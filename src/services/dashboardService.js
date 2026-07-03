import { db } from "../firebase";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";

/**
 * Agrupa datos por mes para gráficas de series temporales.
 * @param {Array} data - Lista de objetos con campo de fecha.
 * @param {string} dateField - Nombre del campo que contiene la fecha.
 * @returns {Object} Datos agrupados por Mes-Año.
 */
const groupByMonth = (data, dateField = "createdAt") => {
  return data.reduce((acc, item) => {
    const date = item[dateField]?.toDate ? item[dateField].toDate() : new Date(item[dateField]);
    const monthYear = `${date.getMonth() + 1}/${date.getFullYear()}`;
    if (!acc[monthYear]) acc[monthYear] = [];
    acc[monthYear].push(item);
    return acc;
  }, {});
};

/**
 * 1. Tasa de conversión de leads a clientes por mes.
 * @returns {Promise<Object>} JSON listo para Chart.js.
 */
export const getConversionRateData = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, "contacts"));
    const contacts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const monthlyGroups = groupByMonth(contacts);
    const sortedMonths = Object.keys(monthlyGroups).sort((a, b) => {
      const [m1, y1] = a.split("/").map(Number);
      const [m2, y2] = b.split("/").map(Number);
      return y1 !== y2 ? y1 - y2 : m1 - m2;
    });

    const conversionRates = sortedMonths.map(month => {
      const group = monthlyGroups[month];
      const totalLeads = group.length;
      const totalClients = group.filter(c => c.status === "client" || c.leadScore >= 100).length; // Ejemplo de lógica
      return totalLeads > 0 ? (totalClients / totalLeads) * 100 : 0;
    });

    return {
      labels: sortedMonths,
      datasets: [
        {
          label: "Tasa de Conversión (%)",
          data: conversionRates,
          borderColor: "rgb(16, 185, 129)",
          backgroundColor: "rgba(16, 185, 129, 0.1)",
          fill: true,
          tension: 0.4,
        },
      ],
    };
  } catch (error) {
    console.error("Error en getConversionRateData:", error);
    throw error;
  }
};

/**
 * 2. Tiempo promedio que un trato permanece en cada etapa del pipeline.
 * @returns {Promise<Object>} JSON listo para Chart.js.
 */
export const getAverageStageTimeData = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, "deals"));
    const deals = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const stages = ["prospeccion", "calificacion", "propuesta", "cerrado"];
    const stageDurations = { prospeccion: [], calificacion: [], propuesta: [], cerrado: [] };

    deals.forEach(deal => {
      if (!deal.stageHistory) return;

      stages.forEach((stage, index) => {
        const entry = deal.stageHistory[stage];
        const nextStage = stages[index + 1];
        const exit = nextStage ? deal.stageHistory[nextStage] : (deal.closedAt || new Date());

        if (entry && exit) {
            const entryDate = entry.toDate ? entry.toDate() : new Date(entry);
            const exitDate = exit.toDate ? exit.toDate() : new Date(exit);
            const durationDays = (exitDate - entryDate) / (1000 * 60 * 60 * 24);
            stageDurations[stage].push(Math.max(0, durationDays));
        }
      });
    });

    const averageTimes = stages.map(stage => {
      const durations = stageDurations[stage];
      return durations.length > 0 
        ? durations.reduce((a, b) => a + b, 0) / durations.length 
        : 0;
    });

    return {
      labels: ["Prospección", "Calificación", "Propuesta", "Cerrado"],
      datasets: [
        {
          label: "Días Promedio",
          data: averageTimes,
          backgroundColor: [
            "rgba(148, 163, 184, 0.5)",
            "rgba(59, 130, 246, 0.5)",
            "rgba(245, 158, 11, 0.5)",
            "rgba(16, 185, 129, 0.5)",
          ],
          borderColor: [
            "rgb(148, 163, 184)",
            "rgb(59, 130, 246)",
            "rgb(245, 158, 11)",
            "rgb(16, 185, 129)",
          ],
          borderWidth: 1,
        },
      ],
    };
  } catch (error) {
    console.error("Error en getAverageStageTimeData:", error);
    throw error;
  }
};

/**
 * 3. Ranking de vendedores por ingresos generados.
 * @returns {Promise<Object>} JSON listo para Chart.js.
 */
export const getSellerRankingData = async () => {
  try {
    // Obtenemos solo los tratos que se han cerrado con éxito
    const q = query(collection(db, "deals"), where("stageId", "==", "cerrado"));
    const querySnapshot = await getDocs(q);
    const deals = querySnapshot.docs.map(doc => doc.data());

    const revenueBySeller = deals.reduce((acc, deal) => {
      const seller = deal.assignedToName || "Sin Asignar";
      acc[seller] = (acc[seller] || 0) + (deal.amount || 0);
      return acc;
    }, {});

    const sortedSellers = Object.entries(revenueBySeller)
      .sort((a, b) => b[1] - a[1]) // De mayor a menor ingreso
      .slice(0, 10); // Top 10

    return {
      labels: sortedSellers.map(s => s[0]),
      datasets: [
        {
          label: "Ingresos Generados ($)",
          data: sortedSellers.map(s => s[1]),
          backgroundColor: "rgba(16, 185, 129, 0.6)",
          borderRadius: 8,
        },
      ],
    };
  } catch (error) {
    console.error("Error en getSellerRankingData:", error);
    throw error;
  }
};
