import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generateProcessPDF = (processData) => {
    // A4 document
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    const formatTime = (seconds) => {
        if (!seconds) return '0 s';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        let res = [];
        if (h > 0) res.push(`${h}h`);
        if (m > 0) res.push(`${m}m`);
        if (s > 0 || (h === 0 && m === 0)) res.push(`${s}s`);
        return res.join(' ');
    };

    let yPos = 20;

    // --- Header ---
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text(`Documento de Proceso: ${processData.name || 'Sin Titulo'}`, 14, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Version: ${processData.version || '1.0'}`, 14, yPos);
    
    if (processData.empresa) {
        doc.text(`Empresa: ${processData.empresa}`, 80, yPos);
    }
    
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 160, yPos);
    yPos += 15;

    // Line separator
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.line(14, yPos, 196, yPos);
    yPos += 10;

    // --- 1. Datos Generales ---
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('1. Datos Generales', 14, yPos);
    yPos += 6;

    autoTable(doc, {
        startY: yPos,
        theme: 'plain',
        head: [],
        body: [
            [{ content: 'Proposito:', styles: { fontStyle: 'bold', cellWidth: 40 } }, processData.description || 'N/A'],
            [{ content: 'Dueno del Proceso:', styles: { fontStyle: 'bold' } }, processData.processOwner || 'N/A'],
            [{ content: 'Alcance:', styles: { fontStyle: 'bold' } }, processData.scope || 'N/A'],
            [{ content: 'Estado:', styles: { fontStyle: 'bold' } }, processData.status || 'N/A'],
        ],
        styles: { textColor: [0, 0, 0], fontSize: 10, cellPadding: 3 },
        columnStyles: { 0: { cellWidth: 45 } }
    });
    
    yPos = doc.lastAutoTable.finalY + 15;

    // --- 2. Ficha SIPOC ---
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('2. Ficha SIPOC', 14, yPos);
    yPos += 6;

    autoTable(doc, {
        startY: yPos,
        theme: 'grid',
        headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.1, fontSize: 9 },
        head: [['Supplier', 'Input', 'Process', 'Output', 'Customer']],
        body: [[
            processData.supplier || 'N/A',
            processData.input || 'N/A',
            processData.trigger || 'N/A',
            processData.output || 'N/A',
            processData.customer || 'N/A'
        ]]
    });

    yPos = doc.lastAutoTable.finalY + 15;

    if (yPos > 250) { doc.addPage(); yPos = 20; }

    // --- 3. Estado AS-IS ---
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('3. Estado AS-IS (Actual)', 14, yPos);
    yPos += 6;

    const asIsTasksData = (processData.asIsTasks || []).map(task => [
        task.task || task.name || '', 
        task.role || '', 
        task.time ? formatTime(task.time) : 'N/A',
        task.isPain ? 'Si' : 'No',
        task.type || task.valueAdded || 'N/A'
    ]);

    if (asIsTasksData.length > 0) {
        autoTable(doc, {
            startY: yPos,
            theme: 'grid',
            headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
            styles: { textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.1, fontSize: 9 },
            head: [['Tarea / Paso', 'Rol', 'Tiempo', 'Es Dolor?', 'Valor Anadido']],
            body: asIsTasksData
        });
        yPos = doc.lastAutoTable.finalY + 10;
    } else {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'italic');
        doc.text('No hay tareas documentadas en AS-IS.', 14, yPos);
        yPos += 10;
    }

    if (yPos > 250) { doc.addPage(); yPos = 20; }

    // --- 4. Estado TO-BE ---
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('4. Estado TO-BE (Futuro)', 14, yPos);
    yPos += 6;

    const toBeTasksData = (processData.toBeTasks || []).map(task => [
        task.task || task.name || '', 
        task.role || '', 
        task.time ? formatTime(task.time) : 'N/A',
        task.tech || 'N/A',
        task.type || task.valueAdded || 'N/A'
    ]);

    if (toBeTasksData.length > 0) {
        autoTable(doc, {
            startY: yPos,
            theme: 'grid',
            headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
            styles: { textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.1, fontSize: 9 },
            head: [['Tarea / Paso', 'Rol', 'Tiempo', 'Tecnologia', 'Valor Anadido']],
            body: toBeTasksData
        });
        yPos = doc.lastAutoTable.finalY + 10;
    } else {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'italic');
        doc.text('No hay tareas documentadas en TO-BE.', 14, yPos);
        yPos += 10;
    }

    if (yPos > 250) { doc.addPage(); yPos = 20; }

    // --- 5. Comparacion ---
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('5. Resumen Comparativo', 14, yPos);
    yPos += 6;

    const totalAsIs = (processData.asIsTasks || []).reduce((acc, curr) => acc + (Number(curr.time) || 0), 0);
    const totalToBe = (processData.toBeTasks || []).reduce((acc, curr) => acc + (Number(curr.time) || 0), 0);
    const dolores = processData.asIsPains?.length || 0;
    const kpis = processData.toBeKpis?.length || 0;

    autoTable(doc, {
        startY: yPos,
        theme: 'grid',
        headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.1, fontSize: 10 },
        head: [['Metrica', 'AS-IS (Actual)', 'TO-BE (Futuro)']],
        body: [
            ['Nº de Pasos', `${processData.asIsTasks?.length || 0} pasos`, `${processData.toBeTasks?.length || 0} pasos`],
            ['Tiempo Total', formatTime(totalAsIs), formatTime(totalToBe)],
            ['Puntos de Dolor', `${dolores} dolores`, 'Mitigados'],
            ['KPIs Definidos', 'N/A', `${kpis} KPIs`]
        ]
    });

    // --- Footer ---
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(150, 150, 150); // Light gray
        
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        
        // Footer text centered
        doc.text('Documento creado con Artories Management Suit.', pageWidth / 2, pageHeight - 10, { align: 'center' });
        // Page number right-aligned
        doc.text(`Pagina ${i} de ${pageCount}`, pageWidth - 14, pageHeight - 10, { align: 'right' });
    }

    const filename = `Proceso_${processData.name || 'doc'}_v${processData.version || '1'}.pdf`.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    doc.save(filename);
};
