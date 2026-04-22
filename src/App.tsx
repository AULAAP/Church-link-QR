import React, { useState, useEffect, ReactNode } from 'react';
import { 
  auth, 
  googleProvider, 
  subscribeToChurches, 
  markAsDelivered, 
  seedChurches, 
  clearAllChurches,
  testConnection,
  storage,
  updateChurchQrUrl
} from './lib/firebase';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import QRCode from 'qrcode';
import { 
  signInWithPopup, 
  onAuthStateChanged, 
  signOut, 
  User 
} from 'firebase/auth';
import { Church } from './types';
import { generateSeedData } from './lib/seedData';
import { 
  LayoutDashboard, 
  QrCode, 
  Printer, 
  LogOut, 
  Search, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Loader2,
  Camera,
  X,
  Upload,
  FileText,
  Download,
  Table,
  MessageSquare,
  Mail,
  Send
} from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import { Html5Qrcode } from 'html5-qrcode';
import { format } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Tab = 'dashboard' | 'scanner' | 'print';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [churches, setChurches] = useState<Church[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [isImporting, setIsImporting] = useState(false);
  const [search, setSearch] = useState('');
  const [scannerResult, setScannerResult] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingReport, setIsExportingReport] = useState(false);
  const [isSendingEmails, setIsSendingEmails] = useState(false);
  const [processingRowId, setProcessingRowId] = useState<string | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{success: number, failed: number, errors: string[]} | null>(null);
  const scannerInputRef = React.useRef<HTMLInputElement>(null);

  // Auto-focus scanner input when modal opens
  useEffect(() => {
    if (activeTab === 'scanner') {
      const timer = setTimeout(() => {
        scannerInputRef.current?.focus();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [activeTab]);
  useEffect(() => {
    testConnection();
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });

    const unsubscribeData = subscribeToChurches(setChurches);

    return () => {
      unsubscribeAuth();
      unsubscribeData();
    };
  }, []);

  const login = () => signInWithPopup(auth, googleProvider);
  const logout = () => signOut(auth);

  const handleSeed = async () => {
    setIsImporting(true);
    try {
      await seedChurches(generateSeedData());
      alert('¡Sincronización completada!');
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setIsImporting(false);
    }
  };

  const [isConfirmingReset, setIsConfirmingReset] = useState(false);
  const [pendingImport, setPendingImport] = useState<{data: Church[], columns: string, shouldClear: boolean} | null>(null);

  const downloadReport = async () => {
    if (churches.length === 0) return;
    setIsExportingReport(true);
    
    const doc = new jsPDF();
    const margin = 14;
    const dateStr = new Date().toLocaleDateString('es-ES');

    doc.setFontSize(22);
    doc.setTextColor(30, 41, 59);
    doc.text('REPORTE DE ENTREGAS', margin, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generado: ${dateStr}`, margin, 28);

    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text('RESUMEN GENERAL', margin, 40);
    
    autoTable(doc, {
      startY: 45,
      head: [['Métrica', 'Cantidad']],
      body: [
        ['Total Iglesias', stats.total.toString()],
        ['Total Libros', stats.totalBooks.toString()],
        ['Entregados', stats.delivered.toString()],
        ['Pendientes', stats.pending.toString()],
      ],
      theme: 'grid',
      headStyles: { fillColor: [51, 65, 85] }
    });

    doc.text('DETALLE DE ENTREGAS', margin, (doc as any).lastAutoTable.finalY + 15);

    const tableData = churches.map(church => [
      church.id,
      church.name,
      church.responsible,
      church.bookQuantity,
      ...extraColumns.map(col => church.extraData?.[col] || '-'),
      church.status,
      church.deliveryDate || '-',
      church.deliveryTime || '-'
    ]);

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 20,
      head: [['ID', 'Iglesia', 'Responsable', 'Libros', ...extraColumns, 'Estado', 'Fecha', 'Hora']],
      body: tableData,
      headStyles: { fillColor: [37, 99, 235] },
      bodyStyles: { fontSize: 7 }, // Reduced font size to fit more columns
      alternateRowStyles: { fillColor: [248, 250, 252] },
      didParseCell: (data) => {
        // Adjust column index for Status because of dynamic columns
        const statusIndex = 4 + extraColumns.length;
        if (data.section === 'body' && data.column.index === statusIndex) {
          if (data.cell.raw === 'Entregado') {
            data.cell.styles.textColor = [22, 163, 74];
            data.cell.styles.fontStyle = 'bold';
          } else {
            data.cell.styles.textColor = [234, 88, 12];
          }
        }
      }
    });

    setIsExportingReport(false);
    doc.save(`Reporte_Entregas_${dateStr.replace(/\//g, '-')}.pdf`);
  };

  const handleReset = async () => {
    setIsImporting(true);
    try {
      await clearAllChurches();
      setChurches([]);
      setSearch('');
      setIsConfirmingReset(false);
      alert('¡Base de datos vaciada con éxito!');
    } catch (e: any) {
      alert('Error técnico al borrar: ' + e.message);
    } finally {
      setIsImporting(false);
    }
  };

  const executeImport = async () => {
    if (!pendingImport) return;
    
    setIsImporting(true);
    const { data, shouldClear } = pendingImport;
    
    try {
      if (shouldClear) {
        await clearAllChurches();
      }

      // Procesar en lotes de 500 para evitar límites de Firestore
      const chunks = [];
      for (let i = 0; i < data.length; i += 500) {
        chunks.push(data.slice(i, i + 500));
      }
      
      for (const chunk of chunks) {
        await seedChurches(chunk);
      }
      
      setPendingImport(null);
      alert('¡Importación completada exitosamente!');
    } catch (e: any) {
      alert('Error al importar: ' + e.message);
    } finally {
      setIsImporting(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileExtension = file.name.split('.').pop()?.toLowerCase();

    const processData = (data: any[]) => {
      try {
        if (!data || data.length === 0) {
          alert('No se encontraron datos en el archivo. Verifique el formato.');
          return;
        }

        // Generador de ID único
        const generateSystemId = (index: number) => {
          const timestamp = Date.now().toString(36).slice(-3).toUpperCase();
          const random = Math.random().toString(36).substring(2, 5).toUpperCase();
          return `${timestamp}${random}${index.toString().padStart(3, '0')}`;
        };

        const validChurches: Church[] = data
          .filter(row => {
            // Filtrar filas que estén realmente vacías (donde todos los valores sean nulos/vacíos)
            return Object.values(row).some(v => v !== null && v !== undefined && String(v).trim() !== '');
          })
          .map((row, index) => {
            const systemId = generateSystemId(index);
            
            // Buscamos las columnas sin importar mayúsculas/minúsculas
            const getMatchedKey = (keys: string[]) => {
              return Object.keys(row).find(k => {
                const normalized = k.toLowerCase().trim();
                return keys.includes(normalized);
              });
            };

            const nameKey = getMatchedKey(['nombre', 'name', 'iglesia', 'church', 'nombre iglesia', 'iglesias', 'nombre de la iglesia']);
            const responsibleKey = getMatchedKey(['responsable', 'responsible', 'nombre de responsable', 'nombre de el responsable', 'encargado']);
            const communityKey = getMatchedKey(['comunidad', 'community', 'nombre de la comunidad', 'comuna', 'sector']);
            const quantityKey = getMatchedKey(['cantidad', 'quantity', 'cantidad de libros', 'libros', 'volumen']);
            const phoneKey = getMatchedKey(['telefono', 'phone', 'tel', 'contacto telefono', 'teléfono']);
            const emailKey = getMatchedKey(['email', 'correo', 'mail', 'correo electronico', 'e-mail']);

            const extraData: Record<string, any> = {};
            const standardKeys = [nameKey, responsibleKey, communityKey, quantityKey, phoneKey, emailKey];
            Object.keys(row).forEach(key => {
              if (key && !standardKeys.filter(Boolean).includes(key)) {
                extraData[key] = row[key];
              }
            });

            return {
              id: systemId,
              name: nameKey ? String(row[nameKey]).trim() : `Iglesia ${index + 1}`,
              responsible: responsibleKey ? String(row[responsibleKey]).trim() : '-',
              community: communityKey ? String(row[communityKey]).trim() : '-',
              bookQuantity: quantityKey ? Number(row[quantityKey]) || 0 : 0,
              phoneNumber: phoneKey ? String(row[phoneKey]).trim() : '-',
              email: emailKey ? String(row[emailKey]).trim() : undefined,
              status: 'Pendiente',
              extraData
            };
          });

        const columns = Object.keys(data[0]).join(', ');
        setPendingImport({
          data: validChurches,
          columns: columns,
          shouldClear: churches.length > 0
        });
      } catch (e: any) {
        console.error('Error procesando datos:', e);
        alert('Error al leer los datos de las iglesias: ' + e.message);
      } finally {
        if (event.target) event.target.value = '';
      }
    };

    if (fileExtension === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          processData(results.data);
        },
        error: (err) => {
          alert('Error al leer el archivo CSV: ' + err.message);
        }
      });
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          processData(jsonData);
        } catch (err: any) {
          alert('Error al leer el archivo Excel: ' + err.message);
        }
      };
      reader.onerror = () => {
        alert('Error al leer el archivo.');
      };
      reader.readAsArrayBuffer(file);
    } else {
      alert('Formato de archivo no soportado. Por favor suba un archivo CSV o Excel (.xlsx)');
    }
  };

  const downloadSampleCSV = () => {
    const csvContent = "nombre de la iglesia,nombre de responsable,nombre de la comunidad,cantidad de libros,telefono\nIglesia Centro,Juan Perez,Centro Historico,25,555-0101\nIglesia del Norte,Maria Gomez,Valle Verde,40,555-0202";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "ejemplo_iglesias.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredChurches = churches.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.responsible.toLowerCase().includes(search.toLowerCase()) || 
    c.community.toLowerCase().includes(search.toLowerCase()) || 
    c.id.includes(search)
  );

  const ensureQrCode = async (church: Church): Promise<string> => {
    if (church.qrCodeUrl) return church.qrCodeUrl;
    
    // Generate and upload
    const dataUrl = await QRCode.toDataURL(church.id, { 
      width: 512,
      margin: 2,
      color: {
        dark: '#1D4ED8',
        light: '#FFFFFF',
      }
    });

    const storageRef = ref(storage, `qrs/${church.id}.png`);
    await uploadString(storageRef, dataUrl, 'data_url');
    const url = await getDownloadURL(storageRef);
    
    // Update DB
    await updateChurchQrUrl(church.id, url);
    
    // Update local state
    setChurches(prev => prev.map(c => 
      c.id === church.id ? { ...c, qrCodeUrl: url } : c
    ));
    
    return url;
  };

  const sendWhatsApp = async (church: Church) => {
    if (processingRowId) return;
    setProcessingRowId(church.id);
    
    try {
      const qrUrl = await ensureQrCode(church);

      const message = encodeURIComponent(
        `*ENTREGA DE MATERIALES*\n\n` +
        `Hola *${church.responsible}*,\n\n` +
        `Sinceramente esperamos que se encuentre bien. Su código para la entrega de libros de *${church.name}* es el siguiente:\n\n` +
        `🆔 *ID:* ${church.id}\n` +
        `📍 *Comunidad:* ${church.community}\n` +
        `📚 *Cantidad:* ${church.bookQuantity}\n\n` +
        `📥 *Link del Código QR:* ${qrUrl}\n\n` +
        `Por favor, presente este ID o código QR al momento de la entrega.\n\n` +
        `_Sistema de Seguimiento ChurchLink_`
      );
      
      const cleanPhone = church.phoneNumber.replace(/\D/g, '');
      const url = `https://wa.me/${cleanPhone}?text=${message}`;
      window.open(url, '_blank');
      
      setChurches(prev => prev.map(c => 
        c.id === church.id ? { ...c, whatsappSent: true } : c
      ));
    } catch (err) {
      console.error("Error sending WhatsApp:", err);
      alert("Error al procesar el código QR.");
    } finally {
      setProcessingRowId(null);
    }
  };

  const sendSingleEmail = async (church: Church) => {
    if (processingRowId) return;
    if (!church.email) return;
    
    if (!confirm(`¿Enviar QR por email a ${church.email}?`)) return;
    
    setProcessingRowId(church.id);
    try {
      // Ensure QR is uploaded first (the backend generates it too, but we want the link in DB)
      await ensureQrCode(church);
      
      const response = await fetch('/api/send-bulk-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ churches: [church] })
      });
      
      const data = await response.json();
      if (data.success) {
        alert('Correo enviado con éxito');
      } else {
        alert('Error enviando correo: ' + (data.errors?.[0] || 'Desconocido'));
      }
    } catch (err) {
      console.error("Error sending email:", err);
      alert("Error al enviar el correo.");
    } finally {
      setProcessingRowId(null);
    }
  };

  const sendBulkEmails = async () => {
    if (churches.length === 0) return;
    
    const churchesWithEmail = churches.filter(c => c.email && c.email.includes('@'));
    if (churchesWithEmail.length === 0) {
      alert('Error: Ninguna iglesia tiene un correo electrónico válido registrado.');
      return;
    }

    if (!confirm(`¿Está seguro de enviar correos masivos a ${churchesWithEmail.length} iglesias?`)) return;

    setIsSendingEmails(true);
    setEmailStatus(null);
    setShowEmailModal(true);
    
    try {
      const response = await fetch('/api/send-bulk-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ churches: churchesWithEmail })
      });

      const data = await response.json();
      if (response.ok) {
        setEmailStatus(data);
      } else {
        throw new Error(data.error || 'Fallo al enviar correos');
      }
    } catch (error: any) {
      alert('Error al enviar correos: ' + error.message);
      setShowEmailModal(false);
    } finally {
      setIsSendingEmails(false);
    }
  };

  const printRef = React.useRef<HTMLDivElement>(null);

  const downloadPDF = async () => {
    if (churches.length === 0) return;
    
    setIsExportingPDF(true);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      
      // We'll process in chunks to handle pagination properly
      // A4 is roughly 210x297mm.
      // Reducing to 9 items per page (3 columns x 3 rows) to guarantee no vertical cuts
      const itemsPerPage = 9; 
      const totalPages = Math.ceil(churches.length / itemsPerPage);
      
      const qrCards = document.querySelectorAll('.qr-card-print');
      
      for (let i = 0; i < totalPages; i++) {
        if (i > 0) pdf.addPage();
        
        // Create a temporary container for this page's chunk
        const container = document.createElement('div');
        container.id = `pdf-page-container-${i}`;
        // Hide from view but keep in DOM for calculation
        container.style.position = 'fixed';
        container.style.left = '-9999px';
        container.style.top = '0';
        container.style.width = '1000px'; 
        container.style.padding = '40px';
        container.style.background = 'white';
        container.style.display = 'grid';
        container.style.gridTemplateColumns = 'repeat(3, 1fr)';
        container.style.gap = '25px';
        
        // Add header to the page in the PDF showing counts
        pdf.setFontSize(11);
        pdf.setTextColor(50, 50, 50);
        pdf.text(`TOTAL IGLESIAS: ${churches.length} | PÁGINA ${i + 1} DE ${totalPages}`, margin, 12);
        pdf.setDrawColor(200, 200, 200);
        pdf.line(margin, 15, pageWidth - margin, 15);

        const startIdx = i * itemsPerPage;
        const endIdx = Math.min(startIdx + itemsPerPage, churches.length);
        
        // Clone elements for this page
        for (let j = startIdx; j < endIdx; j++) {
          if (qrCards[j]) {
            const clone = qrCards[j].cloneNode(true) as HTMLElement;
            clone.style.width = '100%';
            clone.style.height = 'auto';
            clone.style.minHeight = '320px'; // Ensure uniform height
            clone.style.display = 'flex';
            clone.style.flexDirection = 'column';
            clone.style.alignItems = 'center';
            clone.style.justifyContent = 'center';
            clone.style.boxShadow = 'none';
            clone.style.border = '2px solid #e2e8f0';
            clone.style.borderRadius = '16px';
            clone.style.margin = '0';
            clone.style.padding = '24px';
            clone.style.breakInside = 'avoid';
            container.appendChild(clone);
          }
        }
        
        document.body.appendChild(container);
        
        const canvas = await html2canvas(container, {
          scale: 1.5, // Reduced from 2 to save memory
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          onclone: (clonedDoc) => {
            const pageCont = clonedDoc.getElementById(`pdf-page-container-${i}`);
            if (pageCont) pageCont.style.left = '0';
          }
        });
        
        // Use JPEG with 0.8 quality instead of PNG to avoid "Invalid string length" error
        const imgData = canvas.toDataURL('image/jpeg', 0.8);
        const imgWidthAvailable = pageWidth - (margin * 2);
        const imgHeightAvailable = pageHeight - 30;
        
        const imgWidth = imgWidthAvailable;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        // Final sanity check: if height still exceeds, scale it down to fit
        let finalHeight = imgHeight;
        let finalWidth = imgWidth;
        
        if (finalHeight > imgHeightAvailable) {
          finalHeight = imgHeightAvailable;
          finalWidth = (canvas.width * finalHeight) / canvas.height;
        }
        
        // Center horizontally
        const xOffset = margin + (imgWidthAvailable - finalWidth) / 2;
        
        pdf.addImage(imgData, 'JPEG', xOffset, 20, finalWidth, finalHeight);
        
        document.body.removeChild(container);
      }
      
      pdf.save(`etiquetas_qr_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error técnico al generar el PDF multi-página.');
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const stats = {
    total: churches.length,
    delivered: churches.filter(c => c.status === 'Entregado').length,
    pending: churches.filter(c => c.status === 'Pendiente').length,
    totalBooks: churches.reduce((acc, c) => acc + (c.bookQuantity || 0), 0)
  };

  const extraColumns = React.useMemo(() => {
    const keys = new Set<string>();
    churches.forEach(c => {
      if (c.extraData) {
        Object.keys(c.extraData).forEach(k => keys.add(k));
      }
    });
    return Array.from(keys);
  }, [churches]);

  const processScan = async (decodedText: string) => {
    const id = decodedText.trim();
    if (!id) return;

    try {
      await markAsDelivered(id);
      const church = churches.find(c => c.id === id);
      setScannerResult({ type: 'success', message: `Entrega registrada exitosamente para ${church?.name || id}` });
    } catch (error: any) {
      if (error.message === 'Ya ha sido entregado' || error.message.includes('permission-denied')) {
        const church = churches.find(c => c.id === id);
        if (church?.status === 'Entregado') {
          setScannerResult({ type: 'error', message: `${church?.name} (ID: ${id}) ya había sido entregado.` });
        } else {
          setScannerResult({ type: 'error', message: `Error al procesar ${id}: No encontrado o sin permisos.` });
        }
      } else {
        setScannerResult({ type: 'error', message: `Error al procesar ${id}: ${error.message}` });
      }
    }

    // Auto-clear success message after 5 seconds
    setTimeout(() => {
      setScannerResult(null);
    }, 5000);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md space-y-8 rounded-2xl bg-white p-8 shadow-xl text-center"
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-blue-600">
            <QrCode className="h-10 w-10" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 font-sans">ChurchLink</h1>
            <p className="mt-2 text-gray-500">Sistema de Seguimiento de Entregas</p>
          </div>
          <button
            onClick={login}
            className="flex w-full items-center justify-center gap-3 rounded-lg bg-gray-900 px-4 py-3 text-white transition-all hover:bg-gray-800 active:scale-95"
          >
            Iniciar sesión con Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-20 md:pb-0">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-white px-4 py-3 shadow-sm md:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-600 p-1.5 text-white">
              <QrCode className="h-6 w-6" />
            </div>
            <h1 className="hidden text-xl font-bold tracking-tight text-gray-900 sm:block">ChurchLink</h1>
          </div>

          <div className="flex items-center gap-4">
            <label className="hidden md:flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors shadow-sm">
              <Upload size={16} />
              Importar Lista
              <input type="file" accept=".csv, .xlsx, .xls" className="hidden" onChange={handleFileUpload} />
            </label>
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-gray-900">{user.displayName}</p>
              <p className="text-xs text-gray-500">{user.email}</p>
            </div>
            <button
              onClick={logout}
              className="rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-red-600 transition-colors"
              title="Cerrar sesión"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-4 md:p-8">
        {/* Navigation - Desktop */}
        <nav className="mb-8 hidden md:flex items-center gap-1 rounded-xl bg-white p-1.5 shadow-sm border w-fit">
          <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard size={18}/>} label="Panel" />
          <NavButton active={activeTab === 'print'} onClick={() => setActiveTab('print')} icon={<Printer size={18}/>} label="Etiquetas" />
          <NavButton active={activeTab === 'scanner'} onClick={() => setActiveTab('scanner')} icon={<Camera size={18}/>} label="Escanear" />
        </nav>

        {isImporting && (
          <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
            <Loader2 className="h-10 w-10 animate-spin text-blue-600 mb-4" />
            <p className="text-lg font-bold">Procesando datos...</p>
            <p className="text-sm text-gray-500">Esto puede tardar unos segundos</p>
          </div>
        )}

        {pendingImport && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-8 rounded-2xl border-2 border-blue-200 bg-blue-50 p-6 shadow-lg"
          >
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="rounded-full bg-blue-100 p-3 text-blue-600">
                  <FileText size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-blue-900">Confirmar Importación</h3>
                  <p className="text-blue-700">Se han detectado <b>{pendingImport.data.length} iglesias</b> en el archivo.</p>
                  <p className="text-xs text-blue-500 mt-1 uppercase tracking-wider">Columnas encontradas: {pendingImport.columns}</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                <div className="flex flex-col gap-2 w-full sm:w-auto">
                  <label className="flex items-center gap-2 text-sm font-medium text-blue-800 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={pendingImport.shouldClear} 
                      onChange={(e) => setPendingImport({...pendingImport, shouldClear: e.target.checked})}
                      className="h-4 w-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                    />
                    Borrar datos anteriores antes de subir
                  </label>
                  <div className="flex gap-2">
                    <button 
                      onClick={executeImport}
                      className="flex-1 rounded-xl bg-blue-600 px-6 py-2.5 font-bold text-white shadow-md hover:bg-blue-700 transition-all hover:scale-105 active:scale-95"
                    >
                      Confirmar y Subir
                    </button>
                    <button 
                      onClick={() => setPendingImport(null)}
                      className="rounded-xl border border-blue-300 bg-white px-6 py-2.5 font-medium text-blue-600 hover:bg-blue-100 transition-all"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-4 rounded-lg bg-white/50 p-3 text-xs text-blue-600 italic">
              <b>Tip:</b> Si los nombres no se ven bien, asegúrese de que el Excel tenga una columna llamada "Nombre" o "Iglesia".
            </div>
          </motion.div>
        )}

        {/* Content */}
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {churches.length === 0 && (
                <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white p-12 text-center">
                  <Upload className="h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900">Subir listado de iglesias</h3>
                  <p className="max-w-xs text-gray-500 mb-6">Suba su archivo Excel o CSV. El sistema asignará automáticamente un <b>código único irrepetible</b> a cada iglesia para los QRs.</p>
                  
                  {isImporting ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                      <p className="text-sm font-medium">Procesando iglesias...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row gap-3">
                      <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 transition-colors">
                        <FileText size={18} />
                        Seleccionar Archivo
                        <input type="file" accept=".csv, .xlsx, .xls" className="hidden" onChange={handleFileUpload} />
                      </label>
                      <button onClick={downloadSampleCSV} className="flex items-center gap-2 rounded-lg border border-gray-300 px-6 py-2 text-gray-700 hover:bg-gray-50 transition-colors">
                        <Download size={18} />
                        Ejemplo CSV
                      </button>
                    </div>
                  )}
                  
                  <button onClick={handleSeed} className="mt-8 text-xs text-blue-600 hover:underline">O generar 300 iglesias de prueba</button>
                </div>
              )}

              {churches.length > 0 && (
                <>
                  {/* Stats Cards */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard label="Total Iglesias" value={stats.total} icon={<QrCode className="text-gray-500" />} />
                    <StatCard label="Total Libros" value={stats.totalBooks} icon={<FileText className="text-blue-500" />} color="text-blue-600" />
                    <StatCard label="Entregados" value={stats.delivered} icon={<CheckCircle2 className="text-green-500" />} color="text-green-600" />
                    <StatCard label="Pendientes" value={stats.pending} icon={<Clock className="text-orange-500" />} color="text-orange-600" />
                  </div>

                  {/* Search and Table */}
                  <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
                    <div className="border-b p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex flex-wrap items-center gap-4">
                        <h2 className="text-lg font-bold">Registro de Entregas</h2>
                        <div className="flex gap-2">
                          <button 
                            onClick={downloadReport}
                            disabled={isExportingReport}
                            className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 hover:bg-blue-100 transition-colors flex items-center gap-1"
                          >
                            {isExportingReport ? <Loader2 size={14} className="animate-spin" /> : <Table size={14} />}
                            REPORTE PDF
                          </button>

                          <button 
                            onClick={sendBulkEmails}
                            disabled={isSendingEmails}
                            className="rounded-lg border border-purple-100 bg-purple-50 px-3 py-1 text-xs font-bold text-purple-700 hover:bg-purple-100 transition-colors flex items-center gap-1"
                          >
                            {isSendingEmails ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                            CORREO MASIVO
                          </button>

                          <label className="cursor-pointer rounded-lg border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-1">
                            <Upload size={14} />
                            Subir Excel/CSV
                            <input type="file" accept=".csv, .xlsx, .xls" className="hidden" onChange={handleFileUpload} />
                          </label>
                          
                          {!isConfirmingReset ? (
                            <button 
                              onClick={() => setIsConfirmingReset(true)}
                              className="rounded-lg border border-red-100 bg-white px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors flex items-center gap-1"
                            >
                              <X size={14} />
                              Borrar Todo
                            </button>
                          ) : (
                            <div className="flex gap-1 animate-pulse">
                              <button 
                                onClick={handleReset}
                                className="rounded-lg bg-red-600 px-3 py-1 text-xs font-bold text-white hover:bg-red-700 transition-colors"
                              >
                                ¿ESTÁS SEGURO? CONFIRMAR BORRADO
                              </button>
                              <button 
                                onClick={() => setIsConfirmingReset(false)}
                                className="rounded-lg border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                              >
                                Cancelar
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="relative w-full md:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                        <input
                          type="text"
                          placeholder="Buscar nombre o ID..."
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          className="w-full rounded-lg border bg-gray-50 py-2 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        />
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wider text-gray-500">
                          <tr>
                            <th className="px-6 py-4">ID</th>
                            <th className="px-6 py-4">Iglesia / Comunidad</th>
                            <th className="px-6 py-4">Responsable</th>
                            <th className="px-6 py-4">Correo</th>
                            <th className="px-6 py-4">Libros</th>
                            {extraColumns.map(col => (
                              <th key={col} className="px-6 py-4">{col}</th>
                            ))}
                            <th className="px-6 py-4">Estado</th>
                            <th className="px-6 py-4 text-center">Acción</th>
                            <th className="px-6 py-4">Entregado el</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y text-sm">
                          {filteredChurches.map(church => (
                            <tr key={church.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4 font-mono font-medium text-gray-900">{church.id}</td>
                              <td className="px-6 py-4">
                                <div className="font-bold text-gray-900">{church.name}</div>
                                <div className="text-xs text-blue-600 font-medium">{church.community}</div>
                              </td>
                              <td className="px-6 py-4 text-gray-600">{church.responsible}</td>
                              <td className="px-6 py-4 text-xs text-gray-500 font-medium">{church.email || '-'}</td>
                              <td className="px-6 py-4 font-bold text-blue-600 tabular-nums">{church.bookQuantity}</td>
                              {extraColumns.map(col => (
                                <td key={col} className="px-6 py-4 text-gray-500 tabular-nums italic">
                                  {church.extraData?.[col] || '-'}
                                </td>
                              ))}
                              <td className="px-6 py-4">
                                <span className={cn(
                                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                                  church.status === 'Entregado' ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                                )}>
                                  {church.status === 'Entregado' ? <CheckCircle2 size={12}/> : <Clock size={12}/>}
                                  {church.status}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center justify-center gap-2">
                                  {processingRowId === church.id ? (
                                    <div className="p-2">
                                      <Loader2 size={16} className="animate-spin text-blue-600" />
                                    </div>
                                  ) : (
                                    <>
                                      <button 
                                        onClick={() => sendWhatsApp(church)}
                                        title="Enviar QR por WhatsApp"
                                        className="p-2 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                                      >
                                        <MessageSquare size={16} />
                                      </button>
                                      {church.email && (
                                        <button 
                                          title="Enviar QR por Email"
                                          className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                                          onClick={() => sendSingleEmail(church)}
                                        >
                                          <Mail size={16} />
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 text-gray-500 tabular-nums">
                                {church.deliveryDate ? (
                                  <>
                                    <div>{church.deliveryDate}</div>
                                    <div className="text-xs">{church.deliveryTime}</div>
                                  </>
                                ) : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {filteredChurches.length === 0 && (
                        <div className="p-12 text-center text-gray-500">No hay coincidencias para "{search}"</div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          )}

          {/* Scanner Modal Overlay */}
          <AnimatePresence>
            {activeTab === 'scanner' && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-md"
                onClick={(e) => {
                  if (e.target === e.currentTarget) setActiveTab('dashboard');
                }}
              >
                <motion.div 
                  key="scanner-modal"
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl relative"
                  onClick={e => e.stopPropagation()}
                >
                  {/* Modal Header */}
                  <div className="flex items-center justify-between border-b p-5 bg-gray-50">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-blue-600 p-2 text-white">
                        <Camera size={20} />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold">Escaneo de Entrega</h2>
                        <p className="text-xs text-gray-500 font-medium">Compatible con Escáner Kercan (USB/BT)</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setActiveTab('dashboard')}
                      className="rounded-full p-2 hover:bg-gray-200 transition-colors"
                    >
                      <X size={24} />
                    </button>
                  </div>

                  <div className="p-6 space-y-6">
                    {/* Real-time Stats */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-2xl bg-green-50 border border-green-100 p-4 text-center">
                        <span className="text-[10px] font-black tracking-widest text-green-600 uppercase block mb-1">ENTREGADOS</span>
                        <span className="text-3xl font-black text-green-700">{stats.delivered}</span>
                      </div>
                      <div className="rounded-2xl bg-orange-50 border border-orange-100 p-4 text-center">
                        <span className="text-[10px] font-black tracking-widest text-orange-600 uppercase block mb-1">PENDIENTES</span>
                        <span className="text-3xl font-black text-orange-700">{stats.pending}</span>
                      </div>
                    </div>

                    <div className="relative group">
                      <QRScanner onScan={processScan} />
                    </div>

                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                        <QrCode className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        ref={scannerInputRef}
                        type="text"
                        id="manual-id"
                        placeholder="ESCANEE O ESCRIBA ID..."
                        className="w-full rounded-2xl border-2 border-gray-100 bg-gray-50 py-4 pl-12 pr-4 text-center text-lg font-black tracking-widest outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all uppercase placeholder:font-bold placeholder:tracking-normal"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            processScan((e.currentTarget as HTMLInputElement).value);
                            (e.currentTarget as HTMLInputElement).value = '';
                          }
                        }}
                      />
                      <div className="mt-2 text-center text-[10px] text-gray-400 font-medium italic">
                        El láser enviará el código y presionará "Enter" automáticamente
                      </div>
                    </div>

                    <AnimatePresence>
                      {scannerResult && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className={cn(
                            "flex items-start gap-3 rounded-2xl border p-4 shadow-sm",
                            scannerResult.type === 'success' ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"
                          )}
                        >
                          {scannerResult.type === 'success' ? <CheckCircle2 className="mt-0.5" /> : <AlertCircle className="mt-0.5" />}
                          <div className="flex-1">
                            <p className="font-bold">{scannerResult.type === 'success' ? 'EXITOSO' : 'ERROR'}</p>
                            <p className="text-sm opacity-90">{scannerResult.message}</p>
                          </div>
                          <button onClick={() => setScannerResult(null)}>
                            <X size={16} />
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {activeTab === 'print' && (
            <motion.div 
              key="print"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
                <div>
                  <h2 className="text-2xl font-bold">Etiquetas QR</h2>
                  <p className="text-gray-500">Imprima estas etiquetas para pegar en las cajas de distribución</p>
                </div>
                <div className="flex flex-col gap-2">
                  <button 
                    onClick={downloadPDF}
                    disabled={isExportingPDF}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-4 font-bold text-white shadow-lg hover:bg-blue-700 hover:scale-105 active:scale-95 transition-all"
                  >
                    {isExportingPDF ? (
                      <>
                        <Loader2 className="animate-spin" size={20} />
                        GENERANDO PDF...
                      </>
                    ) : (
                      <>
                        <Download size={20} />
                        DESCARGAR ETIQUETAS (PDF)
                      </>
                    )}
                  </button>
                  <button 
                    onClick={handlePrint}
                    className="text-xs text-gray-500 hover:text-gray-800 transition-colors py-1"
                  >
                    O usar impresora del sistema
                  </button>
                </div>
              </div>

              <div ref={printRef} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 print-grid p-4 bg-white rounded-xl shadow-inner overflow-hidden">
                {churches.map(church => (
                  <div key={church.id} className="flex flex-col items-center justify-center rounded-xl border bg-white p-6 text-center shadow-sm qr-card-print">
                    <div className="mb-2">
                      <QRCodeSVG value={church.id} size={130} level="H" includeMargin />
                    </div>
                    <div className="text-sm font-bold text-gray-900 mb-0.5 leading-tight">{church.name}</div>
                    <div className="text-[10px] text-blue-600 font-bold uppercase mb-1">{church.community}</div>
                    <div className="font-mono text-lg font-black text-black tracking-widest border-y border-gray-100 w-full py-0.5 mb-1">{church.id}</div>
                    <div className="mt-2 w-full">
                      <div className="py-1 mx-auto w-full text-center">
                        <div className="text-[9px] text-gray-500 font-extrabold uppercase tracking-widest leading-none mb-0.5 w-full">LIBROS</div>
                        <div className="text-3xl font-black text-blue-700 leading-none w-full">{church.bookQuantity}</div>
                      </div>
                      <div className="mt-1 text-[10px] text-gray-400 italic px-2 leading-tight text-center">
                        Resp: {church.responsible}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-12 flex justify-center no-print">
                <button 
                  onClick={downloadPDF}
                  disabled={isExportingPDF}
                  className="flex items-center gap-3 rounded-2xl bg-gray-900 px-8 py-5 font-bold text-white shadow-xl hover:bg-black transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                >
                  {isExportingPDF ? (
                    <Loader2 className="animate-spin" size={24} />
                  ) : (
                    <Download size={24} />
                  )}
                  {isExportingPDF ? 'GENERANDO ARCHIVO...' : 'DESCARGAR TODAS EN PDF'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bulk Email Status Modal */}
        <AnimatePresence>
          {showEmailModal && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            >
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"
              >
                <div className="border-b p-6 bg-purple-50">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-purple-600 p-2 text-white">
                      <Mail size={20} />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-purple-900">Envío Masivo de Correos</h2>
                      <p className="text-xs text-purple-600 font-medium">Estado del proceso en tiempo real</p>
                    </div>
                  </div>
                </div>

                <div className="p-8 text-center">
                  {isSendingEmails ? (
                    <div className="space-y-4">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-purple-100">
                        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">Enviando correos...</p>
                        <p className="text-sm text-gray-500">Por favor, no cierre esta ventana</p>
                      </div>
                    </div>
                  ) : emailStatus ? (
                    <div className="space-y-6">
                      <div className="flex justify-around">
                        <div className="text-center">
                          <div className="text-2xl font-black text-green-600">{emailStatus.success}</div>
                          <div className="text-[10px] font-bold uppercase text-gray-400">ÉXITOS</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-black text-red-600">{emailStatus.failed}</div>
                          <div className="text-[10px] font-bold uppercase text-gray-400">FALLOS</div>
                        </div>
                      </div>

                      {emailStatus.errors.length > 0 && (
                        <div className="max-h-40 overflow-y-auto rounded-xl bg-red-50 p-4 text-left text-xs text-red-700 space-y-1">
                          <p className="font-bold underline mb-2 uppercase">Detalle de errores:</p>
                          {emailStatus.errors.map((err, idx) => (
                            <p key={idx}>• {err}</p>
                          ))}
                        </div>
                      )}

                      <button 
                        onClick={() => setShowEmailModal(false)}
                        className="w-full rounded-2xl bg-gray-900 py-4 font-bold text-white shadow-lg hover:bg-black transition-all"
                      >
                        CERRAR VENTANA
                      </button>
                    </div>
                  ) : (
                    <p className="text-gray-500">Iniciando proceso...</p>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Navigation - Mobile Bottom */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t bg-white p-2 md:hidden">
        <MobileNavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard />} label="Estado" />
        <MobileNavButton active={activeTab === 'print'} onClick={() => setActiveTab('print')} icon={<Printer />} label="Etiquetas" />
        <MobileNavButton active={activeTab === 'scanner'} onClick={() => setActiveTab('scanner')} icon={<Camera />} label="Escanear" />
      </nav>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: ReactNode, label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all",
        active ? "bg-gray-900 text-white shadow-md shadow-gray-200" : "text-gray-600 hover:bg-gray-100"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function MobileNavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: ReactNode, label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 rounded-xl px-4 py-1.5 transition-all",
        active ? "text-blue-600 bg-blue-50" : "text-gray-400"
      )}
    >
      {icon}
      <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      {active && <motion.div layoutId="mobile-active" className="h-1 w-1 rounded-full bg-blue-600" />}
    </button>
  );
}

function StatCard({ label, value, icon, color = "text-gray-900" }: { label: string, value: number, icon: ReactNode, color?: string }) {
  return (
    <div className="flex flex-col justify-between rounded-2xl border bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-500">{label}</span>
        <div className="p-2 bg-gray-50 rounded-lg">{icon}</div>
      </div>
      <span className={cn("text-3xl font-bold font-mono tracking-tighter", color)}>{value}</span>
    </div>
  );
}

function QRScanner({ onScan }: { onScan: (text: string) => void }) {
  const [showScanner, setShowScanner] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!showScanner) return;

    let html5QrCode: Html5Qrcode | null = null;
    
    // Pequeno delay para asegurar que el DOM este listo
    const timer = setTimeout(() => {
      try {
        html5QrCode = new Html5Qrcode("qr-reader");
        html5QrCode.start(
          { facingMode: "environment" }, 
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText) => {
            onScan(decodedText);
          },
          (errorMessage) => {
            // Ignorar errores de escaneo ruidosos
          }
        ).catch((err) => {
          console.error("Error al iniciar camara:", err);
          setError("No se pudo acceder a la cámara. Verifique los permisos.");
        });
      } catch (e) {
        console.error("Fallo inicializacion scanner:", e);
        setError("Error de inicialización del escáner.");
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch(err => console.warn('Error al detener scanner', err));
      }
    };
  }, [onScan, showScanner]);

  return (
    <div className="relative mx-auto w-full max-w-[300px] overflow-hidden rounded-2xl bg-gray-900 shadow-inner">
      {!showScanner ? (
        <div className="flex aspect-square flex-col items-center justify-center gap-4 bg-gray-900 p-8 text-center">
          <div className="rounded-full bg-blue-500/20 p-4 text-blue-400">
            <Camera size={48} className="animate-pulse" />
          </div>
          <div>
            <h3 className="font-bold text-white">Cámara Desconectada</h3>
            <p className="text-sm text-gray-400">Haga clic para iniciar el visor</p>
          </div>
          <button 
            onClick={() => {
              setError(null);
              setShowScanner(true);
            }}
            className="w-full rounded-xl bg-blue-600 py-3 font-bold text-white shadow-lg hover:bg-blue-700 active:scale-95 transition-all"
          >
            ACTIVAR CÁMARA
          </button>
        </div>
      ) : (
        <div className="aspect-square relative flex items-center justify-center overflow-hidden">
          <div id="qr-reader" className="w-full h-full"></div>
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 p-6 text-center">
              <AlertCircle className="mb-2 h-10 w-10 text-red-500" />
              <p className="text-sm font-bold text-white">{error}</p>
              <button 
                onClick={() => setShowScanner(false)}
                className="mt-4 text-xs text-blue-400 underline"
              >
                Reintentar
              </button>
            </div>
          )}
        </div>
      )}
      
      {showScanner && !error && (
        <button 
          onClick={() => setShowScanner(false)}
          className="absolute top-2 right-2 z-50 rounded-full bg-black/50 p-2 text-white hover:bg-black/80"
        >
          <X size={20} />
        </button>
      )}
    </div>
  );
}
