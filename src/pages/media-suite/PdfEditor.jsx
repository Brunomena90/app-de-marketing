import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, FileText, Download, Type, Trash2, Plus, RotateCw, RotateCcw, MoreHorizontal, Wand2, PenTool, Send, FilePlus, Languages, Copy, MessageSquare, X, Settings, Image as ImageIcon, LayoutTemplate, FileBadge, Link as LinkIcon, Hash, MousePointerSquare, Film, Crop, FileOutput, LayoutGrid, ChevronDown, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { toast } from 'sonner';
import SignaturePad from '../../components/pdf/SignaturePad';

// Configurar el worker de PDF.js para Vite
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function PdfEditor() {
    const navigate = useNavigate();
    
    const [documents, setDocuments] = useState([]);
    const [activeDocId, setActiveDocId] = useState(null);
    const [sidebarView, setSidebarView] = useState('main'); // 'main' or 'edit-panel'
    const [draggedPage, setDraggedPage] = useState(null);
    const [dragOverPage, setDragOverPage] = useState(null);
    
    // Estados temporales para Organizar Páginas
    const [pendingOrganizeBytes, setPendingOrganizeBytes] = useState(null);
    const [pendingOrganizeAnnotations, setPendingOrganizeAnnotations] = useState(null);
    const [pendingOrganizeNumPages, setPendingOrganizeNumPages] = useState(null);
    const [draggingAnn, setDraggingAnn] = useState(null);
    
    // Herramientas
    const [activeTool, setActiveTool] = useState('select'); // select, text, sign, image
    const [scale, setScale] = useState(1.0);
    const [pendingSignature, setPendingSignature] = useState(null);
    const [pendingImage, setPendingImage] = useState(null);
    const [savedRange, setSavedRange] = useState(null);

    const viewerRef = useRef(null);
    const combineInputRef = useRef(null);
    const imageInputRef = useRef(null);
    const mainRef = useRef(null);
    const pageTransitionRef = useRef(false);

    // Helpers para el documento activo
    const activeDoc = documents.find(d => d.id === activeDocId) || null;
    const pdfFile = activeDoc?.file || null;
    const pdfBytes = activeDoc?.bytes || null;
    const numPages = activeDoc?.numPages || null;
    const pageNumber = activeDoc?.pageNumber || 1;
    const annotations = activeDoc?.annotations || [];

    const updateActiveDoc = (updates) => {
        if (!activeDocId) return;
        setDocuments(docs => docs.map(d => d.id === activeDocId ? { ...d, ...updates } : d));
    };

    // Cerrar Pestaña
    const closeTab = (idToClose, e) => {
        e.stopPropagation();
        
        if (activeDocId === idToClose && pendingOrganizeBytes !== null) {
            if (window.confirm("Tienes cambios sin guardar en Organizar Páginas. ¿Deseas aplicarlos antes de cerrar?")) {
                const docName = documents.find(d => d.id === idToClose)?.name || 'documento.pdf';
                updateActiveDoc({
                    bytes: pendingOrganizeBytes,
                    file: new File([pendingOrganizeBytes], docName, { type: 'application/pdf' }),
                    annotations: pendingOrganizeAnnotations,
                    numPages: pendingOrganizeNumPages
                });
            }
            setPendingOrganizeBytes(null);
            setPendingOrganizeAnnotations(null);
            setPendingOrganizeNumPages(null);
        }

        setDocuments(prev => {
            const newDocs = prev.filter(d => d.id !== idToClose);
            if (activeDocId === idToClose) {
                setActiveDocId(newDocs.length > 0 ? newDocs[newDocs.length - 1].id : null);
            }
            return newDocs;
        });
    };

    const applyOrganizeChanges = () => {
        if (!pendingOrganizeBytes) return;
        updateActiveDoc({
            bytes: pendingOrganizeBytes,
            file: new File([pendingOrganizeBytes], pdfFile.name, { type: 'application/pdf' }),
            annotations: pendingOrganizeAnnotations,
            numPages: pendingOrganizeNumPages
        });
        setPendingOrganizeBytes(null);
        setPendingOrganizeAnnotations(null);
        setPendingOrganizeNumPages(null);
        toast.success("Cambios aplicados exitosamente");
    };

    const discardOrganizeChanges = () => {
        setPendingOrganizeBytes(null);
        setPendingOrganizeAnnotations(null);
        setPendingOrganizeNumPages(null);
    };

    const changeTool = (toolId) => {
        if (activeTool === 'organize' && toolId !== 'organize' && pendingOrganizeBytes !== null) {
            if (window.confirm("Tienes cambios sin aplicar en Organizar Páginas. ¿Deseas aplicarlos antes de salir?")) {
                applyOrganizeChanges();
            } else {
                discardOrganizeChanges();
            }
        }
        setActiveTool(toolId);
    };

    // Cargar archivo
    const onFileChange = async (event) => {
        const file = event.target.files[0];
        if (file && file.type === 'application/pdf') {
            const arrayBuffer = await file.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);
            const newDoc = {
                id: Date.now().toString(),
                name: file.name,
                file,
                bytes,
                numPages: null,
                pageNumber: 1,
                annotations: []
            };
            setDocuments(prev => [...prev, newDoc]);
            setActiveDocId(newDoc.id);
            toast.success('Documento cargado correctamente');
        } else {
            toast.error('Por favor selecciona un archivo PDF válido');
        }
        event.target.value = ''; // Reset
    };

    const onDocumentLoadSuccess = ({ numPages }) => {
        updateActiveDoc({ numPages });
    };

    // Funciones de navegación
    const goToPrevPage = () => updateActiveDoc({ pageNumber: Math.max(pageNumber - 1, 1) });
    const goToNextPage = () => updateActiveDoc({ pageNumber: Math.min(pageNumber + 1, numPages || 1) });

    // Agregar anotaciones (Texto, Firma, Imagen)
    const handleViewerClick = (e) => {
        if (!['text', 'sign', 'image'].includes(activeTool) || !viewerRef.current || !activeDoc) return;
        
        const rect = viewerRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left) / scale;
        const y = (e.clientY - rect.top) / scale;

        if (activeTool === 'text') {
            const text = window.prompt("Ingresa el texto a añadir:");
            if (text) {
                updateActiveDoc({
                    annotations: [...annotations, {
                        id: Date.now(),
                        page: pageNumber,
                        type: 'text',
                        x,
                        y,
                        text,
                        color: '#ff0000',
                        size: 16
                    }]
                });
                changeTool('select');
            }
        } else if (activeTool === 'image' && pendingImage) {
            // Se asume un tamaño por defecto para la imagen insertada (por ej. 200x150)
            updateActiveDoc({
                annotations: [...annotations, {
                    id: Date.now(),
                    page: pageNumber,
                    type: 'image',
                    x,
                    y,
                    dataUrl: pendingImage,
                    width: 200,
                    height: 150
                }]
            });
            setPendingImage(null);
            changeTool('select');
        } else if (activeTool === 'sign') {
            setPendingSignature({ x, y, page: pageNumber });
        }
    };

    const removeAnnotation = (id) => {
        updateActiveDoc({ annotations: annotations.filter(a => a.id !== id) });
    };

    // Lógica para arrastrar anotaciones optimizada
    const draggingAnnRef = useRef(null);
    const annotationsRef = useRef(annotations);
    
    useEffect(() => {
        annotationsRef.current = annotations;
    }, [annotations]);

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!draggingAnnRef.current) return;
            const dragData = draggingAnnRef.current;
            const dx = (e.clientX - dragData.startX) / scale;
            const dy = (e.clientY - dragData.startY) / scale;
            
            const newData = {
                ...dragData,
                currentX: dragData.origX + dx,
                currentY: dragData.origY + dy
            };
            draggingAnnRef.current = newData;
            setDraggingAnn(newData); // actualiza solo estado local visual
        };

        const handleMouseUp = () => {
            if (draggingAnnRef.current) {
                const dragData = draggingAnnRef.current;
                updateActiveDoc({
                    annotations: annotationsRef.current.map(a => 
                        a.id === dragData.id ? { ...a, x: dragData.currentX, y: dragData.currentY } : a
                    )
                });
                draggingAnnRef.current = null;
                setDraggingAnn(null);
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [scale, updateActiveDoc]);

    // Operaciones con pdf-lib
    const handleExport = async () => {
        if (!pdfBytes) return toast.error('No hay documento abierto');
        
        try {
            const toastId = toast.loading('Procesando PDF...');
            
            const pdfDoc = await PDFDocument.load(pdfBytes);
            const pages = pdfDoc.getPages();
            const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
            const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
            const helveticaObliqueFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
            const helveticaBoldItalicFont = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);

            const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
            const timesRomanBoldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
            const timesRomanItalicFont = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
            const timesRomanBoldItalicFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBoldItalic);

            const courierFont = await pdfDoc.embedFont(StandardFonts.Courier);
            const courierBoldFont = await pdfDoc.embedFont(StandardFonts.CourierBold);
            const courierObliqueFont = await pdfDoc.embedFont(StandardFonts.CourierOblique);
            const courierBoldObliqueFont = await pdfDoc.embedFont(StandardFonts.CourierBoldOblique);

            for (const ann of annotations) {
                const targetPage = pages[ann.page - 1];
                if (!targetPage) continue;
                
                const { height } = targetPage.getSize();
                const pdfY = height - ann.y;

                if (ann.type === 'text') {
                    targetPage.drawText(ann.text, {
                        x: ann.x,
                        y: pdfY,
                        size: ann.size,
                        font: helveticaFont,
                        color: rgb(1, 0, 0),
                    });
                } else if (ann.type === 'image') {
                    const imageBytes = await fetch(ann.dataUrl).then(res => res.arrayBuffer());
                    let pdfImage;
                    if (ann.dataUrl.startsWith('data:image/jpeg') || ann.dataUrl.startsWith('data:image/jpg')) {
                        pdfImage = await pdfDoc.embedJpg(imageBytes);
                    } else {
                        pdfImage = await pdfDoc.embedPng(imageBytes);
                    }
                    
                    targetPage.drawImage(pdfImage, {
                        x: ann.x,
                        y: pdfY - ann.height,
                        width: ann.width,
                        height: ann.height
                    });
                } else if (ann.type === 'edit-original') {
                    const pageHeight = targetPage.getSize().height;
                    const pdfOrigY = pageHeight - ann.origY;
                    const pdfNewY = pageHeight - ann.newY;
                    
                    // Tapar original con rectángulo blanco en coordenadas originales
                    targetPage.drawRectangle({
                        x: ann.origX - 2,
                        y: pdfOrigY - ann.origH,
                        width: ann.origW + 4,
                        height: ann.origH + 4,
                        color: rgb(1, 1, 1),
                    });
                    
                    // Escribir nuevo texto en coordenadas nuevas con Rich Text
                    const defaultFontSize = ann.fontSize || 12;
                    const startY = pdfNewY - ann.height + (ann.height * 0.2); // baseline aproximado
                    
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = ann.html || ann.text;
                    let currentX = ann.newX;

                    const renderNode = (node, currentStyle) => {
                        if (node.nodeType === Node.TEXT_NODE) {
                            const text = node.textContent;
                            if (!text || text.trim() === '' && text.length === 1) {
                                // Preservar espacios simples pero ignorar retornos de carro vacíos
                                if (text === '\\n') return;
                            }

                            let font = helveticaFont;
                            if (currentStyle.fontFamily === 'Times-Roman') {
                                font = timesRomanFont;
                                if (currentStyle.bold && currentStyle.italic) font = timesRomanBoldItalicFont;
                                else if (currentStyle.bold) font = timesRomanBoldFont;
                                else if (currentStyle.italic) font = timesRomanItalicFont;
                            } else if (currentStyle.fontFamily === 'Courier') {
                                font = courierFont;
                                if (currentStyle.bold && currentStyle.italic) font = courierBoldObliqueFont;
                                else if (currentStyle.bold) font = courierBoldFont;
                                else if (currentStyle.italic) font = courierObliqueFont;
                            } else {
                                if (currentStyle.bold && currentStyle.italic) font = helveticaBoldItalicFont;
                                else if (currentStyle.bold) font = helveticaBoldFont;
                                else if (currentStyle.italic) font = helveticaObliqueFont;
                            }

                            const size = currentStyle.size || defaultFontSize;
                            const color = currentStyle.color || rgb(0, 0, 0);

                            targetPage.drawText(text, {
                                x: currentX,
                                y: startY,
                                font: font,
                                size: size,
                                color: color
                            });

                            const textWidth = font.widthOfTextAtSize(text, size);
                            
                            if (currentStyle.underline) {
                                targetPage.drawLine({
                                    start: { x: currentX, y: startY - size * 0.1 },
                                    end: { x: currentX + textWidth, y: startY - size * 0.1 },
                                    thickness: size * 0.05,
                                    color: color
                                });
                            }
                            currentX += textWidth;
                        } else if (node.nodeType === Node.ELEMENT_NODE) {
                            const tagName = node.tagName.toLowerCase();
                            const newStyle = { ...currentStyle };
                            
                            if (tagName === 'b' || tagName === 'strong') newStyle.bold = true;
                            if (tagName === 'i' || tagName === 'em') newStyle.italic = true;
                            if (tagName === 'u') newStyle.underline = true;
                            if (tagName === 'font') {
                                if (node.color) {
                                    const hex = node.color.replace('#', '');
                                    if (hex.length === 6) {
                                        newStyle.color = rgb(
                                            parseInt(hex.substring(0,2), 16)/255,
                                            parseInt(hex.substring(2,4), 16)/255,
                                            parseInt(hex.substring(4,6), 16)/255
                                        );
                                    }
                                }
                                if (node.face) {
                                    newStyle.fontFamily = node.face;
                                }
                                if (node.size) {
                                    const sizeMap = { '1': 10, '2': 12, '3': 16, '4': 18, '5': 24, '6': 32, '7': 48 };
                                    newStyle.size = sizeMap[node.size] || defaultFontSize;
                                }
                            }
                            if (node.style.color) {
                                const rgbMatch = node.style.color.match(/\\d+/g);
                                if (rgbMatch && rgbMatch.length >= 3) {
                                     newStyle.color = rgb(parseInt(rgbMatch[0])/255, parseInt(rgbMatch[1])/255, parseInt(rgbMatch[2])/255);
                                }
                            }
                            node.childNodes.forEach(child => renderNode(child, newStyle));
                        }
                    };

                    tempDiv.childNodes.forEach(child => renderNode(child, { bold: false, italic: false, underline: false, size: defaultFontSize }));
                }
            }

            const pdfBytesOut = await pdfDoc.save();
            const blob = new Blob([pdfBytesOut], { type: 'application/pdf' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `editado_${pdfFile.name}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            toast.success('Documento exportado', { id: toastId });
        } catch (error) {
            console.error(error);
            toast.error('Error al exportar el documento');
        }
    };

    const handleRotateSpecificPage = async (targetPage, angle = 90) => {
        const currentBytes = pendingOrganizeBytes || pdfBytes;
        if (!currentBytes) return;
        try {
            const pdfDoc = await PDFDocument.load(currentBytes);
            const page = pdfDoc.getPages()[targetPage - 1];
            const currentRotation = page.getRotation().angle;
            page.setRotation({ type: 'degrees', angle: currentRotation + angle });
            
            const savedBytes = await pdfDoc.save();
            setPendingOrganizeBytes(savedBytes);
            setPendingOrganizeAnnotations(pendingOrganizeAnnotations || annotations);
            setPendingOrganizeNumPages(pendingOrganizeNumPages || numPages);
        } catch (e) {
            console.error(e);
            toast.error('Error al rotar');
        }
    };

    const handleRemoveSpecificPage = async (targetPage) => {
        const currentBytes = pendingOrganizeBytes || pdfBytes;
        const currentNumPages = pendingOrganizeNumPages || numPages;
        if (!currentBytes || currentNumPages <= 1) return toast.error('No puedes eliminar la única página');
        try {
            const pdfDoc = await PDFDocument.load(currentBytes);
            pdfDoc.removePage(targetPage - 1);
            const savedBytes = await pdfDoc.save();
            
            const currentAnnotations = pendingOrganizeAnnotations || annotations;
            let newAnnotations = currentAnnotations.filter(a => a.page !== targetPage).map(a => {
                if (a.page > targetPage) return { ...a, page: a.page - 1 };
                return a;
            });
            
            setPendingOrganizeBytes(savedBytes);
            setPendingOrganizeAnnotations(newAnnotations);
            setPendingOrganizeNumPages(currentNumPages - 1);
            toast.success(`Página ${targetPage} eliminada temporalmente`);
        } catch (e) {
            console.error(e);
            toast.error('Error al eliminar página');
        }
    };

    const handleRotatePage = () => {
        const currentBytes = pendingOrganizeBytes || pdfBytes;
        if (!currentBytes) return;
        // Solo para la página actual en modo normal, no usa pending
        (async () => {
            try {
                const pdfDoc = await PDFDocument.load(currentBytes);
                const page = pdfDoc.getPages()[pageNumber - 1];
                const currentRotation = page.getRotation().angle;
                page.setRotation({ type: 'degrees', angle: currentRotation + 90 });
                const savedBytes = await pdfDoc.save();
                updateActiveDoc({
                    bytes: savedBytes,
                    file: new File([savedBytes], pdfFile.name, { type: 'application/pdf' })
                });
            } catch (e) {}
        })();
    };
    
    const handleRemovePage = () => {
        if (!pdfBytes || numPages <= 1) return toast.error('No puedes eliminar la única página');
        // Solo en modo normal, elimina directo
        (async () => {
            try {
                const pdfDoc = await PDFDocument.load(pdfBytes);
                pdfDoc.removePage(pageNumber - 1);
                const savedBytes = await pdfDoc.save();
                let newPageNumber = pageNumber;
                if (pageNumber === numPages) newPageNumber = Math.max(1, pageNumber - 1);
                updateActiveDoc({
                    bytes: savedBytes,
                    file: new File([savedBytes], pdfFile.name, { type: 'application/pdf' }),
                    pageNumber: newPageNumber,
                    numPages: numPages - 1
                });
            } catch (e) {}
        })();
    };

    const handleAddPages = async (event) => {
        const file = event.target.files[0];
        const currentBytes = pendingOrganizeBytes || pdfBytes;
        if (!file || !currentBytes) return;
        
        try {
            const toastId = toast.loading('Importando páginas...');
            
            const currentDoc = await PDFDocument.load(currentBytes);
            const newArrayBuffer = await file.arrayBuffer();
            const newDoc = await PDFDocument.load(newArrayBuffer);
            
            const copiedPages = await currentDoc.copyPages(newDoc, newDoc.getPageIndices());
            copiedPages.forEach((page) => currentDoc.addPage(page));
            
            const newBytes = await currentDoc.save();
            setPendingOrganizeBytes(newBytes);
            setPendingOrganizeAnnotations(pendingOrganizeAnnotations || annotations);
            setPendingOrganizeNumPages((pendingOrganizeNumPages || numPages) + newDoc.getPageCount());
            
            toast.success('Páginas insertadas temporalmente', { id: toastId });
        } catch (error) {
            console.error(error);
            toast.error('Error al insertar las páginas');
        }
        event.target.value = '';
    };

    const handleDropPage = async (targetIndex) => {
        const currentBytes = pendingOrganizeBytes || pdfBytes;
        if (draggedPage === null || draggedPage === targetIndex || !currentBytes) {
            setDraggedPage(null);
            setDragOverPage(null);
            return;
        }

        try {
            const toastId = toast.loading('Reorganizando páginas...');
            
            const currentDoc = await PDFDocument.load(currentBytes);
            const newDoc = await PDFDocument.create();
            
            const currentNumPages = pendingOrganizeNumPages || numPages;
            
            // Generate new order of indices
            const indices = Array.from({length: currentNumPages}, (_, i) => i);
            const [moved] = indices.splice(draggedPage, 1);
            indices.splice(targetIndex, 0, moved);
            
            const copiedPages = await newDoc.copyPages(currentDoc, indices);
            copiedPages.forEach(page => newDoc.addPage(page));
            
            const newBytes = await newDoc.save();
            
            // Re-map annotations to their new pages
            const currentAnnotations = pendingOrganizeAnnotations || annotations;
            const newAnnotations = currentAnnotations.map(ann => {
                const oldIndex = ann.page - 1;
                const newIndex = indices.indexOf(oldIndex);
                return { ...ann, page: newIndex + 1 };
            });
            
            setPendingOrganizeBytes(newBytes);
            setPendingOrganizeAnnotations(newAnnotations);
            setPendingOrganizeNumPages(currentNumPages);
            
            toast.success('Páginas reordenadas temporalmente', { id: toastId });
        } catch (error) {
            console.error(error);
            toast.error('Error al reorganizar las páginas');
        }
        
        setDraggedPage(null);
        setDragOverPage(null);
    };

    const handleCombineFiles = async (event) => {
        const files = Array.from(event.target.files);
        if (files.length === 0) return;
        
        if (files.length === 1 && !pdfBytes) {
            return toast.error('Selecciona al menos 2 archivos PDF para combinar o abre uno primero.');
        }
        
        try {
            const toastId = toast.loading('Combinando archivos...');
            const mergedPdf = await PDFDocument.create();
            
            if (pdfBytes) {
                const currentPdf = await PDFDocument.load(pdfBytes);
                const copiedPages = await mergedPdf.copyPages(currentPdf, currentPdf.getPageIndices());
                copiedPages.forEach((page) => mergedPdf.addPage(page));
            }
            
            for (const file of files) {
                if (file.type !== 'application/pdf') continue;
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await PDFDocument.load(arrayBuffer);
                const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
                copiedPages.forEach((page) => mergedPdf.addPage(page));
            }
            
            const mergedPdfBytes = await mergedPdf.save();
            const newFile = new File([mergedPdfBytes], 'documento_combinado.pdf', { type: 'application/pdf' });
            
            if (pdfBytes) {
                updateActiveDoc({
                    bytes: mergedPdfBytes,
                    file: newFile,
                    pageNumber: 1,
                    annotations: [] // caution: loses annotations, as stated before
                });
            } else {
                const newDoc = {
                    id: Date.now().toString(),
                    name: 'documento_combinado.pdf',
                    file: newFile,
                    bytes: mergedPdfBytes,
                    numPages: null,
                    pageNumber: 1,
                    annotations: []
                };
                setDocuments(prev => [...prev, newDoc]);
                setActiveDocId(newDoc.id);
            }
            
            toast.success('Archivos combinados correctamente', { id: toastId });
        } catch(e) {
             console.error(e);
             toast.error('Error al combinar los archivos');
        }
        event.target.value = ''; // Reset input
    };

    const handleCreatePdf = async () => {
        try {
            const pdfDoc = await PDFDocument.create();
            pdfDoc.addPage([595.28, 841.89]); // Tamaño A4 estándar
            const bytes = await pdfDoc.save();
            const file = new File([bytes], 'documento_nuevo.pdf', { type: 'application/pdf' });
            
            const newDoc = {
                id: Date.now().toString(),
                name: 'documento_nuevo.pdf',
                file,
                bytes,
                numPages: 1,
                pageNumber: 1,
                annotations: []
            };
            
            setDocuments(prev => [...prev, newDoc]);
            setActiveDocId(newDoc.id);
            setActiveTool('edit');
            toast.success('Documento en blanco creado');
        } catch(e) {
            toast.error('Error al crear el documento');
        }
    };

    const handleImageSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (event) => {
                const dataUrl = event.target.result;
                
                if (!activeDocId) {
                    try {
                        const pdfDoc = await PDFDocument.create();
                        pdfDoc.addPage([595.28, 841.89]);
                        const bytes = await pdfDoc.save();
                        const newFile = new File([bytes], 'documento_nuevo.pdf', { type: 'application/pdf' });
                        
                        const newDoc = {
                            id: Date.now().toString(),
                            name: 'documento_nuevo.pdf',
                            file: newFile,
                            bytes,
                            numPages: 1,
                            pageNumber: 1,
                            annotations: []
                        };
                        
                        setDocuments(prev => {
                            const nextDocs = [...prev, newDoc];
                            setActiveDocId(newDoc.id);
                            return nextDocs;
                        });
                        toast.success('Documento creado para la imagen');
                    } catch(err) {
                        return toast.error('Error al crear documento base');
                    }
                }

                setPendingImage(dataUrl);
                setActiveTool('image');
                toast.info('Haz clic en el documento para colocar la imagen');
            };
            reader.readAsDataURL(file);
        }
        e.target.value = '';
    };

    const handlePageRenderSuccess = () => {
        if (!viewerRef.current) return;
        
        const textLayer = viewerRef.current.querySelector('.react-pdf__Page__textContent');
        if (!textLayer) return;

        const spans = textLayer.querySelectorAll('span');
        
        spans.forEach(span => {
            if (!span.hasAttribute('data-original-text')) {
                 span.setAttribute('data-original-text', span.innerText);
                 
                 const rect = span.getBoundingClientRect();
                 const viewerRect = viewerRef.current.getBoundingClientRect();
                 span.setAttribute('data-orig-x', (rect.left - viewerRect.left) / scale);
                 span.setAttribute('data-orig-y', (rect.top - viewerRect.top) / scale);
                 span.setAttribute('data-orig-w', rect.width / scale);
                 span.setAttribute('data-orig-h', rect.height / scale);
                 
                 const blockId = `block_${Math.round(rect.top)}_${Math.round(rect.left)}_${span.innerText.substring(0,5)}`;
                 span.setAttribute('data-ann-id', blockId);
            }
            
            const annId = span.getAttribute('data-ann-id');
            const editedAnn = activeDoc?.annotations.find(a => a.type === 'edit-original' && a.id === annId);
            
            if (editedAnn) {
                span.innerHTML = editedAnn.html;
                if (editedAnn.newX !== undefined) {
                    span.style.left = `${editedAnn.newX * scale}px`;
                    span.style.top = `${editedAnn.newY * scale}px`;
                }
            }

            if (sidebarView === 'edit-panel') {
                span.contentEditable = true;
                span.style.outline = '1px dashed rgba(0, 150, 255, 0.4)';
                span.style.cursor = 'text';
                span.title = 'Para mover, mantén presionada la tecla Alt y arrastra';
                span.style.color = 'black';
                span.style.backgroundColor = 'white';
                span.style.opacity = '1';
                span.classList.add('editable-pdf-text');
                
                span.onblur = (e) => {
                    const target = e.target;
                    const newText = target.innerText;
                    const originalText = target.getAttribute('data-original-text');
                    const isMoved = target.getAttribute('data-moved') === 'true';
                    
                    if (newText !== originalText || isMoved) {
                        const rect = target.getBoundingClientRect();
                        const viewerRect = viewerRef.current.getBoundingClientRect();
                        
                        const origX = parseFloat(target.getAttribute('data-orig-x'));
                        const origY = parseFloat(target.getAttribute('data-orig-y'));
                        const origW = parseFloat(target.getAttribute('data-orig-w'));
                        const origH = parseFloat(target.getAttribute('data-orig-h'));
                        
                        const newX = (rect.left - viewerRect.left) / scale;
                        const newY = (rect.top - viewerRect.top) / scale;
                        const fontSizeStr = window.getComputedStyle(target).fontSize;
                        const fontSize = parseFloat(fontSizeStr) / scale;

                        updateActiveDoc({
                            annotations: [...(activeDoc?.annotations || []).filter(a => a.id !== annId), {
                                id: annId,
                                page: pageNumber,
                                type: 'edit-original',
                                origX, origY, origW, origH,
                                newX, newY,
                                width: rect.width / scale,
                                height: rect.height / scale,
                                text: newText,
                                html: target.innerHTML,
                                fontSize: fontSize || 12
                            }]
                        });
                        toast.success('Cambios registrados');
                        target.setAttribute('data-moved', 'false');
                    }
                };
            } else {
                span.contentEditable = false;
                span.style.outline = 'none';
                span.style.backgroundColor = 'transparent';
                if (editedAnn) {
                    span.style.color = 'black'; // Keep visible if edited
                    span.classList.add('editable-pdf-text');
                } else {
                    span.style.color = 'transparent'; // Hide original text
                    span.classList.remove('editable-pdf-text');
                }
            }
        });
    };

    // Global drag listener para los spans
    useEffect(() => {
        let draggedSpan = null;
        let startX, startY, initialLeft, initialTop;

        const handleMouseDown = (e) => {
            if (sidebarView !== 'edit-panel') return;
            const target = e.target;
            if (target.tagName.toLowerCase() === 'span' && target.classList.contains('editable-pdf-text')) {
                // Solo arrastrar si presiona Alt
                if (!e.altKey) return;
                
                draggedSpan = target;
                startX = e.clientX;
                startY = e.clientY;
                initialLeft = parseFloat(target.style.left) || 0;
                initialTop = parseFloat(target.style.top) || 0;
                target.setAttribute('data-moved', 'false');
            }
        };

        const handleMouseMove = (e) => {
            if (draggedSpan) {
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                    draggedSpan.style.left = `${initialLeft + dx}px`;
                    draggedSpan.style.top = `${initialTop + dy}px`;
                    draggedSpan.setAttribute('data-moved', 'true');
                    if (document.activeElement === draggedSpan) {
                        draggedSpan.blur();
                    }
                }
            }
        };

        const handleMouseUp = (e) => {
            if (draggedSpan) {
                if (draggedSpan.getAttribute('data-moved') === 'true') {
                    draggedSpan.dispatchEvent(new Event('blur'));
                }
                draggedSpan = null;
            }
        };

        window.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [sidebarView]);

    // Efecto visual para tapar textos originales movidos en tiempo real
    useEffect(() => {
        if (!viewerRef.current) return;
        const pageDiv = viewerRef.current.querySelector('.react-pdf__Page');
        if (!pageDiv) return;

        // Limpiar parches anteriores
        pageDiv.querySelectorAll('.white-patch').forEach(el => el.remove());

        // Dibujar parches nuevos siempre que haya una edición, para tapar el texto original
        activeDoc?.annotations.filter(a => a.type === 'edit-original').forEach(ann => {
            const patch = document.createElement('div');
            patch.className = 'white-patch';
            patch.style.position = 'absolute';
            // Ligero margen para asegurar que tape bien
            patch.style.left = `${(ann.origX - 2) * scale}px`;
            patch.style.top = `${(ann.origY - 2) * scale}px`;
            patch.style.width = `${(ann.origW + 4) * scale}px`;
            patch.style.height = `${(ann.origH + 4) * scale}px`;
            patch.style.backgroundColor = 'white';
            patch.style.zIndex = '1'; // Sobre el canvas(0), bajo TextLayer(2)
            pageDiv.appendChild(patch);
        });
    }, [activeDoc?.annotations, scale, pageNumber]);

    useEffect(() => {
        handlePageRenderSuccess();
    }, [sidebarView, scale, pageNumber, activeDoc?.annotations]);

    // Zoom y Navegación con Rueda del ratón
    useEffect(() => {
        const handleWheel = (e) => {
            if (e.ctrlKey) {
                e.preventDefault(); // Evitar el zoom del navegador
                if (e.deltaY < 0) {
                    setScale(prev => Math.min(prev + 0.1, 4.0)); // Acercar
                } else if (e.deltaY > 0) {
                    setScale(prev => Math.max(prev - 0.1, 0.3)); // Alejar
                }
            } else if (activeTool !== 'organize') {
                const el = mainRef.current;
                if (!el || pageTransitionRef.current) return;

                // Si hacemos scroll hacia abajo y estamos en el fondo
                if (e.deltaY > 0 && Math.abs(el.scrollHeight - el.scrollTop - el.clientHeight) < 2) {
                    if (pageNumber < (numPages || 1)) {
                        pageTransitionRef.current = true;
                        goToNextPage();
                        setTimeout(() => {
                            if (mainRef.current) mainRef.current.scrollTop = 0;
                            pageTransitionRef.current = false;
                        }, 400); // Dar tiempo a que la página cambie
                    }
                } 
                // Si hacemos scroll hacia arriba y estamos en el tope
                else if (e.deltaY < 0 && el.scrollTop <= 2) {
                    if (pageNumber > 1) {
                        pageTransitionRef.current = true;
                        goToPrevPage();
                        // No forzamos el scroll al fondo, es mejor dejarlo arriba o natural
                        setTimeout(() => {
                            pageTransitionRef.current = false;
                        }, 400);
                    }
                }
            }
        };

        const el = mainRef.current;
        if (el) {
            el.addEventListener('wheel', handleWheel, { passive: false });
            return () => el.removeEventListener('wheel', handleWheel);
        }
    }, [pageNumber, numPages, activeTool]);

    // Manejo de Selección de Texto para Formateo Enriquecido
    useEffect(() => {
        const handleSelectionChange = () => {
            if (sidebarView !== 'edit-panel') return;
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                let node = range.commonAncestorContainer;
                while (node && node !== document.body) {
                    if (node.classList && node.classList.contains('editable-pdf-text')) {
                        setSavedRange(range);
                        return;
                    }
                    node = node.parentNode;
                }
            }
        };
        document.addEventListener('selectionchange', handleSelectionChange);
        return () => document.removeEventListener('selectionchange', handleSelectionChange);
    }, [sidebarView]);

    const handleFormatChange = (command, value = null) => {
        if (savedRange) {
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(savedRange);
            document.execCommand(command, false, value);
            
            // Forzar guardado disparando blur
            let node = savedRange.commonAncestorContainer;
            while (node && node !== document.body) {
                if (node.classList && node.classList.contains('editable-pdf-text')) {
                    node.dispatchEvent(new Event('blur'));
                    break;
                }
                node = node.parentNode;
            }
        } else {
            document.execCommand(command, false, value);
        }
    };

    return (
        <div className="h-screen w-full flex flex-col bg-[#0a0a0a] text-zinc-300 font-sans">
            {/* Toolbar Superior */}
            <header className="h-16 border-b border-zinc-800 bg-[#111] flex items-center justify-between px-4 shrink-0">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => navigate('/media-suite')}
                        className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                        title="Volver"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="h-6 w-px bg-zinc-800" />
                    <h1 className="text-lg font-bold text-white flex items-center gap-2">
                        <FileText className="w-5 h-5 text-rose-500" />
                        Editor de PDF
                    </h1>
                </div>

                <div className="flex items-center gap-2">
                    {/* Acciones de Archivo */}
                    <label className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer transition-colors">
                        <Upload className="w-4 h-4" />
                        Abrir
                        <input type="file" accept="application/pdf" className="hidden" onChange={onFileChange} />
                    </label>
                    
                    <button 
                        onClick={handleExport}
                        disabled={!pdfFile}
                        className="flex items-center gap-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-rose-900/20"
                    >
                        <Download className="w-4 h-4" />
                        Exportar PDF
                    </button>
                </div>
            </header>

            {/* Barra de Pestañas (Tabs) */}
            {documents.length > 0 && (
                <div className="bg-[#151515] flex items-center px-2 overflow-x-auto border-b border-zinc-800 h-10 shrink-0 custom-scrollbar">
                    {documents.map(doc => (
                        <div 
                            key={doc.id}
                            onClick={() => setActiveDocId(doc.id)}
                            className={`flex items-center gap-2 px-4 h-full border-r border-zinc-800 cursor-pointer min-w-max transition-colors
                                ${activeDocId === doc.id ? 'bg-[#222] text-white border-t-2 border-t-rose-500' : 'bg-[#151515] text-zinc-400 hover:bg-[#1f1f1f] border-t-2 border-t-transparent'}
                            `}
                        >
                            <FileText className="w-3.5 h-3.5" />
                            <span className="text-sm truncate max-w-[150px] select-none">{doc.name}</span>
                            <button 
                                onClick={(e) => closeTab(doc.id, e)}
                                className="ml-2 p-0.5 rounded-full hover:bg-zinc-700 hover:text-white transition-colors"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    ))}
                    <button 
                        onClick={handleCreatePdf}
                        className="ml-2 p-1.5 text-zinc-400 hover:text-white hover:bg-[#252525] rounded transition-colors"
                        title="Nueva pestaña"
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Layout Principal */}
            <div className="flex flex-1 overflow-hidden">
                
                {/* Panel Izquierdo (Todas las herramientas) */}
                {sidebarView === 'edit-panel' ? (
                    <aside className="w-[300px] bg-[#282828] border-r border-[#1a1a1a] flex flex-col shrink-0 overflow-y-auto custom-scrollbar">
                        <div className="flex items-center justify-between px-4 py-4 border-b border-[#3d3d3d] shrink-0">
                            <h2 className="text-white font-bold text-base tracking-wide">Editar</h2>
                            <div className="flex items-center gap-3">
                                <button className="text-zinc-400 hover:text-white transition-colors">
                                    <Settings className="w-4 h-4" />
                                </button>
                                <button onClick={() => setSidebarView('main')} className="text-zinc-400 hover:text-white transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        <div className="p-5 flex flex-col gap-6 overflow-y-auto">
                            {/* MODIFICAR PÁGINA */}
                            <div>
                                <h3 className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-4">MODIFICAR PÁGINA</h3>
                                <div className="flex items-center gap-4 mb-4">
                                    <button onClick={handleRotatePage} className="text-zinc-400 hover:text-white transition-colors" title="Rotar"><RotateCw className="w-5 h-5" /></button>
                                    <button onClick={() => toast.info("Herramienta de Recorte no disponible offline.")} className="text-zinc-400 hover:text-white transition-colors" title="Recortar"><Crop className="w-5 h-5" /></button>
                                    <button onClick={handleRemovePage} className="text-zinc-400 hover:text-white transition-colors" title="Eliminar"><Trash2 className="w-5 h-5" /></button>
                                    <button onClick={() => toast.info("Extracción requiere versión Pro.")} className="text-zinc-400 hover:text-white transition-colors" title="Extraer"><FileOutput className="w-5 h-5" /></button>
                                </div>
                                
                                <button 
                                    onClick={() => { setActiveTool('organize'); setSidebarView('main'); }} 
                                    className="flex items-center gap-3 text-sm text-zinc-300 hover:text-white transition-colors"
                                >
                                    <LayoutGrid className="w-5 h-5" />
                                    Organizar páginas
                                </button>
                            </div>

                            {/* HERRAMIENTAS */}
                            <div>
                                <h3 className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-3">HERRAMIENTAS</h3>
                                <div className="flex flex-col gap-1 -mx-2">
                                    
                                    <button
                                        onClick={() => setActiveTool('select')}
                                        className={`flex items-center gap-3 px-2 py-2 rounded transition-colors text-left w-full
                                            ${activeTool === 'select' ? 'bg-[#3d3d3d] border-l-2 border-transparent' : 'hover:bg-[#3d3d3d] border-l-2 border-transparent'}
                                        `}
                                    >
                                        <MousePointerSquare className={`w-5 h-5 ${activeTool === 'select' ? 'text-white' : 'text-zinc-400'}`} />
                                        <span className={`text-sm ${activeTool === 'select' ? 'text-white font-medium' : 'text-zinc-300'}`}>Seleccionar y Mover</span>
                                    </button>

                                    <button
                                        onClick={() => setActiveTool('text')}
                                        className={`flex items-center gap-3 px-2 py-2 rounded transition-colors text-left w-full
                                            ${activeTool === 'text' ? 'bg-[#3d3d3d] border-l-2 border-transparent' : 'hover:bg-[#3d3d3d] border-l-2 border-transparent'}
                                        `}
                                    >
                                        <Type className={`w-5 h-5 ${activeTool === 'text' ? 'text-white' : 'text-zinc-400'}`} />
                                        <span className={`text-sm ${activeTool === 'text' ? 'text-white font-medium' : 'text-zinc-300'}`}>Texto</span>
                                    </button>
                                    
                                    {/* Opciones de Texto Expandido */}
                                    {activeTool === 'text' && (
                                        <div className="pl-4 pr-3 py-4 bg-transparent border-t border-b border-[#3d3d3d] mb-1">
                                            <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-3">APLICAR FORMATO AL TEXTO</h4>
                                            <div className="flex flex-col gap-4">
                                                <div className="relative">
                                                    <select 
                                                        onChange={(e) => handleFormatChange('fontName', e.target.value)}
                                                        className="w-full bg-[#333] border-none text-sm text-white p-2 rounded appearance-none outline-none cursor-pointer"
                                                    >
                                                        <option value="Helvetica">Helvetica</option>
                                                        <option value="Times-Roman">Times Roman</option>
                                                        <option value="Courier">Courier</option>
                                                    </select>
                                                    <ChevronDown className="w-4 h-4 text-zinc-400 absolute right-2 top-2.5 pointer-events-none" />
                                                </div>
                                                
                                                <div className="flex items-center gap-4">
                                                    <div className="relative w-20">
                                                        <select 
                                                            onChange={(e) => handleFormatChange('fontSize', e.target.value)}
                                                            className="w-full bg-[#333] border-none text-sm text-white p-2 rounded appearance-none outline-none cursor-pointer"
                                                        >
                                                            <option value="1">10</option>
                                                            <option value="2">12</option>
                                                            <option value="3">16</option>
                                                            <option value="4">18</option>
                                                            <option value="5">24</option>
                                                            <option value="6">32</option>
                                                            <option value="7">48</option>
                                                        </select>
                                                        <ChevronDown className="w-3 h-3 text-zinc-400 absolute right-2 top-2.5 pointer-events-none" />
                                                    </div>
                                                    
                                                    <input 
                                                        type="color" 
                                                        onChange={(e) => handleFormatChange('foreColor', e.target.value)}
                                                        className="w-7 h-7 rounded bg-transparent border-0 cursor-pointer" 
                                                        title="Color de texto" 
                                                    />
                                                    
                                                    <div className="flex items-center gap-3 ml-2">
                                                        <button className="text-zinc-400 hover:text-white"><AlignLeft className="w-4 h-4" /></button>
                                                        <button className="text-zinc-400 hover:text-white"><AlignCenter className="w-4 h-4" /></button>
                                                        <button className="text-zinc-400 hover:text-white"><AlignRight className="w-4 h-4" /></button>
                                                    </div>
                                                </div>
                                                
                                                <div className="flex items-center gap-5 pt-1">
                                                    <button onMouseDown={(e) => { e.preventDefault(); handleFormatChange('bold'); }} className="text-white font-bold font-serif text-lg leading-none border-b border-transparent hover:border-white">T</button>
                                                    <button onMouseDown={(e) => { e.preventDefault(); handleFormatChange('italic'); }} className="text-zinc-400 italic font-serif text-lg leading-none border-b border-transparent hover:border-white">T</button>
                                                    <button onMouseDown={(e) => { e.preventDefault(); handleFormatChange('underline'); }} className="text-zinc-400 underline font-serif text-lg leading-none border-b border-transparent hover:border-white">T</button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <button
                                        onClick={() => imageInputRef.current?.click()}
                                        className={`flex items-center justify-between px-2 py-2 rounded transition-colors text-left w-full group
                                            ${activeTool === 'image' ? 'bg-[#3d3d3d]' : 'hover:bg-[#3d3d3d]'}
                                        `}
                                    >
                                        <div className="flex items-center gap-3">
                                            <ImageIcon className={`w-5 h-5 ${activeTool === 'image' ? 'text-white' : 'text-zinc-400'}`} />
                                            <span className={`text-sm ${activeTool === 'image' ? 'text-white font-medium' : 'text-zinc-300 group-hover:text-white'}`}>Imagen</span>
                                        </div>
                                        <ChevronDown className="w-3 h-3 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </button>
                                    
                                    <button
                                        onClick={() => toast.info("Herramienta Encabezado/Pie de página.")}
                                        className="flex items-center justify-between px-2 py-2 hover:bg-[#3d3d3d] rounded transition-colors text-left w-full group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <LayoutTemplate className="w-5 h-5 text-zinc-400" />
                                            <span className="text-sm text-zinc-300 group-hover:text-white">Encabezado y pie de página</span>
                                        </div>
                                        <ChevronDown className="w-3 h-3 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </button>
                                    
                                    <button
                                        onClick={() => toast.info("Herramienta Marca de agua.")}
                                        className="flex items-center justify-between px-2 py-2 hover:bg-[#3d3d3d] rounded transition-colors text-left w-full group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <FileBadge className="w-5 h-5 text-zinc-400" />
                                            <span className="text-sm text-zinc-300 group-hover:text-white">Marca de agua</span>
                                        </div>
                                        <ChevronDown className="w-3 h-3 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </button>
                                    
                                    <button
                                        onClick={() => toast.info("Herramienta Enlace.")}
                                        className="flex items-center justify-between px-2 py-2 hover:bg-[#3d3d3d] rounded transition-colors text-left w-full group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <LinkIcon className="w-5 h-5 text-zinc-400" />
                                            <span className="text-sm text-zinc-300 group-hover:text-white">Enlace</span>
                                        </div>
                                        <ChevronDown className="w-3 h-3 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </button>
                                    
                                    <button
                                        onClick={() => toast.info("Numeración Bates.")}
                                        className="flex items-center justify-between px-2 py-2 hover:bg-[#3d3d3d] rounded transition-colors text-left w-full group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <Hash className="w-5 h-5 text-zinc-400" />
                                            <span className="text-sm text-zinc-300 group-hover:text-white">Numeración Bates</span>
                                        </div>
                                        <ChevronDown className="w-3 h-3 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </button>
                                    
                                    <button
                                        onClick={() => toast.info("Añadir Botón.")}
                                        className="flex items-center gap-3 px-2 py-2 hover:bg-[#3d3d3d] rounded transition-colors text-left w-full group"
                                    >
                                        <MousePointerSquare className="w-5 h-5 text-zinc-400" />
                                        <span className="text-sm text-zinc-300 group-hover:text-white">Botón</span>
                                    </button>
                                    
                                    <button
                                        onClick={() => toast.info("Añadir Video.")}
                                        className="flex items-center gap-3 px-2 py-2 hover:bg-[#3d3d3d] rounded transition-colors text-left w-full group"
                                    >
                                        <Film className="w-5 h-5 text-zinc-400" />
                                        <span className="text-sm text-zinc-300 group-hover:text-white">Video</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </aside>
                ) : (
                    <aside className="w-72 bg-[#2c2c2c] border-r border-[#1a1a1a] flex flex-col shrink-0 overflow-y-auto custom-scrollbar">
                        <div className="flex items-center justify-between px-4 py-4 border-b border-[#3d3d3d]">
                            <h2 className="text-white font-bold text-sm tracking-wide">Todas las herramientas</h2>
                            <button className="text-zinc-400 hover:text-white transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        
                        <div className="flex flex-col py-2">
                            {[
                                { id: 'edit', label: 'Editar un PDF', icon: Type },
                                { id: 'sign', label: 'Rellenar y firmar', icon: PenTool },
                                { id: 'create', label: 'Crear un PDF', icon: FilePlus },
                                { id: 'organize', label: 'Organizar páginas', icon: RotateCw },
                            ].map((tool) => (
                                <button
                                    key={tool.id}
                                    onClick={() => {
                                        if (tool.id === 'create') {
                                            handleCreatePdf();
                                        } else if (tool.id === 'edit') {
                                            setSidebarView('edit-panel');
                                            changeTool('text');
                                        } else {
                                            changeTool(tool.id);
                                            toast.success(`Herramienta ${tool.label} seleccionada`);
                                        }
                                    }}
                                    className={`flex items-center gap-3 px-5 py-3 hover:bg-[#3d3d3d] transition-colors text-left w-full
                                        ${activeTool === tool.id ? 'bg-[#3d3d3d] border-l-2 border-blue-500' : 'border-l-2 border-transparent'}
                                    `}
                                >
                                    <tool.icon className={`w-5 h-5 ${activeTool === tool.id ? 'text-white' : 'text-zinc-400'}`} />
                                    <span className={`text-sm ${activeTool === tool.id ? 'text-white font-medium' : 'text-zinc-300'}`}>
                                        {tool.label}
                                    </span>
                                </button>
                            ))}
                        </div>

                        {/* Acciones de página actuales */}
                        {pdfFile && !['organize'].includes(activeTool) && (
                            <div className="mt-auto border-t border-[#3d3d3d] p-4 bg-[#252525]">
                                <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-1">
                                    PÁGINAS (
                                    <input 
                                        type="text" 
                                        defaultValue={pageNumber}
                                        key={`page-input-${pageNumber}`}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                const val = parseInt(e.target.value);
                                                if (!isNaN(val) && val >= 1 && val <= numPages) {
                                                    updateActiveDoc({ pageNumber: val });
                                                } else {
                                                    e.target.value = pageNumber;
                                                }
                                                e.target.blur();
                                            }
                                        }}
                                        onBlur={(e) => {
                                            const val = parseInt(e.target.value);
                                            if (!isNaN(val) && val >= 1 && val <= numPages) {
                                                if (val !== pageNumber) {
                                                    updateActiveDoc({ pageNumber: val });
                                                }
                                            } else {
                                                e.target.value = pageNumber;
                                            }
                                        }}
                                        className="bg-[#1a1a1a] text-zinc-200 border border-[#3d3d3d] focus:border-[#0078d4] focus:outline-none w-10 text-center rounded py-0.5 mx-1"
                                    />
                                    / {numPages})
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={goToPrevPage} disabled={pageNumber <= 1} className="flex-1 py-1.5 bg-[#3d3d3d] hover:bg-[#4d4d4d] rounded text-white disabled:opacity-50 flex justify-center"><ArrowLeft className="w-4 h-4" /></button>
                                    <button onClick={goToNextPage} disabled={pageNumber >= numPages} className="flex-1 py-1.5 bg-[#3d3d3d] hover:bg-[#4d4d4d] rounded text-white disabled:opacity-50 flex justify-center rotate-180"><ArrowLeft className="w-4 h-4" /></button>
                                </div>
                            </div>
                        )}

                        <input type="file" multiple accept="application/pdf" className="hidden" ref={combineInputRef} onChange={handleCombineFiles} />
                        <input type="file" accept="image/*" className="hidden" ref={imageInputRef} onChange={handleImageSelect} />
                    </aside>
                )}

                {/* Área de Visualización */}
                <main ref={mainRef} className="flex-1 bg-[#050505] overflow-auto relative flex items-start justify-center p-8">
                    {pdfFile ? (
                        activeTool === 'organize' ? (
                            <div className="w-full h-full max-w-7xl mx-auto pb-20">
                                <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
                                    <div>
                                        <h2 className="text-2xl font-bold text-white mb-2">Organizar Páginas</h2>
                                        <p className="text-zinc-400">Visualiza, rota, elimina o añade páginas a tu documento.</p>
                                    </div>
                                    {pendingOrganizeBytes && (
                                        <div className="flex items-center gap-3">
                                            <button onClick={discardOrganizeChanges} className="px-4 py-2 bg-[#333] hover:bg-[#444] text-white rounded font-medium transition-colors border border-[#444]">
                                                Descartar
                                            </button>
                                            <button onClick={applyOrganizeChanges} className="px-4 py-2 bg-[#0078d4] hover:bg-[#106ebe] text-white rounded font-medium transition-colors flex items-center gap-2 shadow-lg shadow-[#0078d4]/20">
                                                <span>Aplicar Cambios Realizados</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                                
                                <Document 
                                    file={pendingOrganizeBytes ? new File([pendingOrganizeBytes], pdfFile.name, { type: 'application/pdf' }) : pdfFile} 
                                    loading={<div className="text-zinc-500">Cargando páginas...</div>}
                                    className="flex flex-wrap items-start justify-start gap-12"
                                >
                                    {Array.from({ length: pendingOrganizeNumPages || numPages || 0 }).map((_, i) => (
                                        <div 
                                            key={i} 
                                            className={`group flex flex-col items-center cursor-grab active:cursor-grabbing transition-transform ${draggedPage === i ? 'opacity-50' : 'opacity-100'}`}
                                            draggable
                                            onDragStart={(e) => {
                                                setDraggedPage(i);
                                                e.dataTransfer.effectAllowed = 'move';
                                            }}
                                            onDragOver={(e) => {
                                                e.preventDefault();
                                                e.dataTransfer.dropEffect = 'move';
                                                setDragOverPage(i);
                                            }}
                                            onDragLeave={() => setDragOverPage(null)}
                                            onDrop={(e) => {
                                                e.preventDefault();
                                                handleDropPage(i);
                                            }}
                                        >
                                            <div className={`relative p-2 rounded-sm border-2 transition-colors ${dragOverPage === i ? 'border-blue-500 bg-[#cde6f7] scale-105' : 'border-transparent group-hover:bg-[#cde6f7] group-hover:border-[#0078d4]'}`}>
                                                <div className="bg-white shadow-[0_2px_8px_rgba(0,0,0,0.4)] flex items-center justify-center overflow-hidden pointer-events-none border border-zinc-200/50">
                                                    <Page pageNumber={i + 1} width={160} renderTextLayer={false} renderAnnotationLayer={false} />
                                                </div>
                                                <span className={`block text-center text-sm font-medium mt-2 ${dragOverPage === i ? 'text-[#0078d4]' : 'text-zinc-500 group-hover:text-[#0078d4]'}`}>
                                                    {i + 1}
                                                </span>
                                                
                                                {/* Toolbar Flotante */}
                                                <div className="absolute top-8 -right-12 flex flex-col bg-[#333] border border-[#444] rounded shadow-2xl overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity z-10 before:absolute before:-left-16 before:w-16 before:-top-32 before:-bottom-32 before:content-['']">
                                                    <button onClick={() => handleRotateSpecificPage(i+1, -90)} className="p-2.5 text-white hover:bg-[#444]" title="Rotar a la izquierda"><RotateCcw className="w-4 h-4" /></button>
                                                    <button onClick={() => handleRotateSpecificPage(i+1, 90)} className="p-2.5 text-white hover:bg-[#444] border-t border-[#444]" title="Rotar a la derecha"><RotateCw className="w-4 h-4" /></button>
                                                    <button onClick={() => { if(window.confirm('¿Eliminar página?')) handleRemoveSpecificPage(i+1) }} className="p-2.5 text-white hover:bg-[#444] border-t border-[#444]" title="Eliminar (Más opciones)"><MoreHorizontal className="w-4 h-4" /></button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    
                                    {/* Tile para agregar páginas */}
                                    <div className="flex flex-col items-center justify-start pt-2">
                                        <label className="w-40 h-56 border-2 border-dashed border-zinc-600 hover:border-zinc-400 hover:bg-zinc-800/50 rounded-sm flex flex-col items-center justify-center cursor-pointer transition-colors group">
                                            <div className="w-12 h-12 rounded-full bg-zinc-800 group-hover:bg-zinc-700 flex items-center justify-center mb-3 transition-colors shadow-lg">
                                                <Plus className="w-6 h-6 text-zinc-400 group-hover:text-white" />
                                            </div>
                                            <span className="text-xs text-zinc-500 group-hover:text-zinc-300 font-medium text-center px-2">Insertar PDF</span>
                                            <input type="file" accept="application/pdf" className="hidden" onChange={handleAddPages} />
                                        </label>
                                    </div>
                                </Document>
                            </div>
                        ) : (
                            <div 
                                className="relative shadow-2xl transition-transform"
                                style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}
                            >
                                <div 
                                    ref={viewerRef}
                                    className={`relative ${activeTool === 'text' ? 'cursor-text' : 'cursor-default'}`}
                                    onClick={handleViewerClick}
                                >
                                    <Document
                                        file={pdfFile}
                                        onLoadSuccess={onDocumentLoadSuccess}
                                        loading={
                                            <div className="w-[600px] h-[800px] bg-zinc-900 animate-pulse flex items-center justify-center text-zinc-500">
                                                Cargando documento...
                                            </div>
                                        }
                                    >
                                        <Page 
                                            pageNumber={pageNumber} 
                                            renderTextLayer={true}
                                            renderAnnotationLayer={false}
                                            className="shadow-2xl"
                                            onRenderSuccess={handlePageRenderSuccess}
                                        />
                                    </Document>

                                    {/* Capa de Anotaciones Superpuestas */}
                                    {annotations.filter(a => a.page === pageNumber).map(ann => {
                                        const isDragging = draggingAnn && draggingAnn.id === ann.id;
                                        const currentX = isDragging ? draggingAnn.currentX : ann.x;
                                        const currentY = isDragging ? draggingAnn.currentY : ann.y;
                                        
                                        return (
                                        <div
                                            key={ann.id}
                                            className={`absolute cursor-move group select-none z-50 ${isDragging ? 'opacity-80' : ''}`}
                                            style={{ left: currentX, top: currentY, color: ann.color, fontSize: `${ann.size}px` }}
                                            onMouseDown={(e) => {
                                                e.stopPropagation();
                                                if (activeTool !== 'organize') {
                                                    const dragData = {
                                                        id: ann.id,
                                                        startX: e.clientX,
                                                        startY: e.clientY,
                                                        origX: ann.x,
                                                        origY: ann.y,
                                                        currentX: ann.x,
                                                        currentY: ann.y
                                                    };
                                                    setDraggingAnn(dragData);
                                                    draggingAnnRef.current = dragData;
                                                }
                                            }}
                                        >
                                            {/* Botón de eliminar */}
                                            {(activeTool !== 'organize') && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        removeAnnotation(ann.id);
                                                    }}
                                                    className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-10 hover:bg-red-600"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            )}

                                            {ann.type === 'text' ? (
                                                <span className="group-hover:outline group-hover:outline-1 group-hover:outline-blue-500 group-hover:bg-blue-500/10 rounded px-0.5">
                                                    {ann.text}
                                                </span>
                                            ) : (
                                                <img src={ann.dataUrl} alt="Firma" className="group-hover:outline group-hover:outline-1 group-hover:outline-blue-500" style={{ width: ann.width, height: ann.height }} draggable="false" />
                                            )}
                                        </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-zinc-500">
                            <FileText className="w-16 h-16 mb-4 opacity-20" />
                            <p className="text-lg font-medium text-zinc-400">Ningún documento abierto</p>
                            <p className="text-sm mt-2">Haz clic en "Abrir", "Crear un PDF" o usa "Combinar archivos"</p>
                        </div>
                    )}
                </main>
            </div>

            {pendingSignature && (
                <SignaturePad 
                    onSave={(dataUrl) => {
                        updateActiveDoc({
                            annotations: [...annotations, {
                                id: Date.now(),
                                page: pendingSignature.page,
                                type: 'image',
                                x: pendingSignature.x,
                                y: pendingSignature.y,
                                dataUrl,
                                width: 150,
                                height: 75
                            }]
                        });
                        setPendingSignature(null);
                        setActiveTool('select');
                    }}
                    onClose={() => setPendingSignature(null)}
                />
            )}
        </div>
    );
}
