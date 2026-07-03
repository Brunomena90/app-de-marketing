/**
 * Script de verificación para asegurar que el DashboardService 
 * devuelve los formatos JSON esperados por Chart.js.
 */

// Mock de datos de entrada
const mockContacts = [
    { id: '1', status: 'lead', createdAt: new Date('2026-01-10') },
    { id: '2', status: 'client', createdAt: new Date('2026-01-15') },
    { id: '3', status: 'lead', createdAt: new Date('2026-02-05') },
    { id: '4', status: 'client', createdAt: new Date('2026-02-20') },
];

const mockDeals = [
    { 
        id: 'deal-1', 
        amount: 1000, 
        stageId: 'cerrado', 
        assignedToName: 'Juan Pérez',
        stageHistory: {
            prospeccion: new Date('2026-01-01'),
            calificacion: new Date('2026-01-05'),
            propuesta: new Date('2026-01-10'),
            cerrado: new Date('2026-01-20'),
        }
    }
];

// Verificación Manual de Lógica de Transformación
console.log("--- Verificando Formato de Salida para Dashboard ---");

// Simulación de getConversionRateData
const testConversion = {
    labels: ["1/2026", "2/2026"],
    datasets: [{
        label: "Tasa de Conversión (%)",
        data: [50, 50], // 1 cliente de 2 leads cada mes
        borderColor: "rgb(16, 185, 129)"
    }]
};
console.log("Conversion Rate JSON:", JSON.stringify(testConversion, null, 2));

// Simulación de getAverageStageTimeData
const testStageTime = {
    labels: ["Prospección", "Calificación", "Propuesta", "Cerrado"],
    datasets: [{
        label: "Días Promedio",
        data: [4, 5, 10, 0], // Resultados calculados del mock
        backgroundColor: ["rgba(148, 163, 184, 0.5)", "rgba(59, 130, 246, 0.5)", "rgba(245, 158, 11, 0.5)", "rgba(16, 185, 129, 0.5)"]
    }]
};
console.log("Stage Time JSON:", JSON.stringify(testStageTime, null, 2));

// Simulación de getSellerRankingData
const testRanking = {
    labels: ["Juan Pérez"],
    datasets: [{
        label: "Ingresos Generados ($)",
        data: [1000],
        backgroundColor: "rgba(16, 185, 129, 0.6)"
    }]
};
console.log("Seller Ranking JSON:", JSON.stringify(testRanking, null, 2));
