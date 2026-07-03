/**
 * Módulo de Análisis Six Sigma y Calidad de Datos (Desarrollado por @Analista)
 * Contiene el motor lógico para evaluar Workflows de la compañía.
 */

// ==========================================
// 1. Data Completeness Engine (ANA-3)
// ==========================================
export const analyzeDataQuality = (dataset, requiredFields) => {
    let warnings = [];
    let errorCount = 0;
    
    if (!dataset || dataset.length === 0) {
        return {
            status: 'error',
            warnings: [{ type: 'critical', title: 'Dataset Vacío', message: 'No hay datos suministrados para el análisis estadístico.' }],
            validData: []
        };
    }
    
    // Regla Six Sigma: Muestra mínima para significancia estadística
    if (dataset.length < 30) {
        warnings.push({
            type: 'warning',
            title: 'Volumen de muestra bajo',
            message: `DMAIC requiere al menos 30 muestras para alta confiabilidad. Tienes ${dataset.length} registros.`
        });
    }

    const missingFieldsMap = {};
    
    // Validación predictiva de campos obligatorios
    requiredFields.forEach(field => {
        const missingCount = dataset.filter(item => item[field] === undefined || item[field] === null || item[field] === '').length;
        if (missingCount > 0) {
            missingFieldsMap[field] = missingCount;
            errorCount += missingCount;
            warnings.push({
                type: 'error',
                title: `Falta campo: '${field}'`,
                message: `Requerido para cálculo matemático. ${missingCount} registros encontrados nulos.`
            });
        }
    });

    let status = 'ok';
    if (errorCount > 0) {
        // Si más del 20% de los datos requeridos están corruptos/faltantes, el status es error bloqueante
        const errorRatio = errorCount / (dataset.length * requiredFields.length);
        status = errorRatio > 0.2 ? 'error' : 'warning'; 
    } else if (warnings.length > 0) {
        status = 'warning';
    }

    // Aislamos los datos que están 100% limpios para procesarlos sin corromper el modelo matemático
    const validData = dataset.filter(item => {
        return requiredFields.every(field => item[field] !== undefined && item[field] !== null && item[field] !== '');
    });

    return {
        status,
        warnings,
        validData
    };
};


// ==========================================
// 2. Six Sigma Math Module (ANA-4)
// ==========================================
export const calculateSixSigmaMetrics = (data) => {
    if (!data || data.length === 0) {
        return { yield: 0, dpmo: 0, sigmaLevel: 0, totalUnits: 0, defectiveUnits: 0 };
    }

    let totalUnits = data.length;
    let totalDefects = 0;
    let totalOpportunities = 0;
    let defectiveUnits = 0;

    data.forEach(item => {
        const defects = Number(item.defectCount) || 0;
        const opps = Number(item.opportunityCount) || 1; // Mínimo 1 oportunidad lógica de fallo del proceso
        
        totalDefects += defects;
        totalOpportunities += opps;
        
        // Si el proceso falló o tiene más de 0 defectos, la unidad cuenta como defectiva (Yield)
        if (defects > 0 || item.status === 'error' || item.status === 'delayed') {
            defectiveUnits++;
        }
    });

    // 1. Yield (First Time Yield - % que sale bien a la primera)
    const yieldValue = totalUnits > 0 ? ((totalUnits - defectiveUnits) / totalUnits) * 100 : 0;
    
    // 2. DPMO (Defects Per Million Opportunities)
    const dpmo = totalOpportunities > 0 ? (totalDefects / totalOpportunities) * 1000000 : 0;

    // 3. Sigma Level (Aproximación basada en tabla estándar Motorola/GE con 1.5 shift)
    let sigmaLevel = 6.0;
    if (dpmo > 0) {
        if (dpmo >= 691462) sigmaLevel = 1.0;
        else if (dpmo >= 308538) sigmaLevel = 2.0;
        else if (dpmo >= 66807) sigmaLevel = 3.0;
        else if (dpmo >= 6210) sigmaLevel = 4.0;
        else if (dpmo >= 233) sigmaLevel = 5.0;
        else if (dpmo > 3.4) sigmaLevel = 5.0 + ((233 - dpmo) / 229); // Interpolación lineal burda entre 5 y 6
        else sigmaLevel = 6.0;
    }

    return {
        yield: yieldValue.toFixed(2),
        dpmo: totalDefects === 0 ? 0 : Math.round(dpmo),
        sigmaLevel: sigmaLevel.toFixed(1),
        totalUnits,
        totalDefects,
        defectiveUnits
    };
};
