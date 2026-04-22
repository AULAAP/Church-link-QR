@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;700&display=swap');
@import "tailwindcss";

@theme {
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;
  
  /* Full Hex Palette to prevent html2canvas oklch errors */
  --color-white: #ffffff;
  --color-black: #000000;
  
  --color-blue-50: #eff6ff;
  --color-blue-100: #dbeafe;
  --color-blue-200: #bfdbfe;
  --color-blue-300: #93c5fd;
  --color-blue-400: #60a5fa;
  --color-blue-500: #3b82f6;
  --color-blue-600: #2563eb;
  --color-blue-700: #1d4ed8;
  --color-blue-800: #1e40af;
  --color-blue-900: #1e3a8a;
  --color-blue-950: #172554;

  --color-gray-50: #f9fafb;
  --color-gray-100: #f3f4f6;
  --color-gray-200: #e5e7eb;
  --color-gray-300: #d1d5db;
  --color-gray-400: #9ca3af;
  --color-gray-500: #6b7280;
  --color-gray-600: #4b5563;
  --color-gray-700: #374151;
  --color-gray-800: #1f2937;
  --color-gray-900: #111827;
  --color-gray-950: #030712;

  --color-orange-50: #fff7ed;
  --color-orange-100: #ffedd5;
  --color-orange-200: #fed7aa;
  --color-orange-600: #ea580c;
  --color-orange-700: #c2410c;
  
  --color-red-50: #fef2f2;
  --color-red-600: #dc2626;
  
  --color-green-50: #f0fdf4;
  --color-green-600: #16a34a;
  --color-green-700: #15803d;
}

@layer base {
  body {
    @apply antialiased text-gray-900;
  }
}

/* Custom QR Scanner Styles */
#qr-reader {
  border: none !important;
}

#qr-reader__dashboard {
  display: none !important;
}

#qr-reader img {
  display: none !important;
}

#qr-reader video {
  @apply rounded-xl;
}

#qr-reader button {
  @apply inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-gray-800 active:scale-95;
  important: true; /* This is not a thing, let's just use raw CSS or ! prefix */
}

/* Correct way to do important in TW4 @apply is ! prefix on each utility, 
   but it's easier to just write standard CSS for these specific overrides */
#qr-reader button {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  border-radius: 0.5rem !important;
  background-color: #111827 !important; /* gray-900 */
  padding: 0.5rem 1rem !important;
  font-size: 0.875rem !important;
  font-weight: 500 !important;
  color: white !important;
}

#qr-reader button:hover {
  background-color: #1f2937 !important; /* gray-800 */
}

@media print {
  body {
    background-color: white !important;
  }
  
  /* Ocultar elementos de navegación y cabeceras al imprimir */
  header, nav, .no-print, button, .print-hide {
    display: none !important;
  }

  /* Asegurar que el contenedor de impresión ocupe todo el ancho */
  main {
    padding: 0 !important;
    margin: 0 !important;
  }

  /* Forzar colores de fondo de impresión */
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  /* Ajustar la rejilla de QRs para impresión */
  .print-grid {
    display: grid !important;
    grid-template-columns: repeat(3, 1fr) !important;
    gap: 1rem !important;
  }

  /* Estilo específico para la tarjeta de QR al imprimir */
  .qr-card-print {
    break-inside: avoid !important;
    border: 1px solid #e5e7eb !important;
    box-shadow: none !important;
    transform: none !important;
    transition: none !important;
    animation: none !important;
    background-color: #ffffff !important;
  }

  /* Force standard colors for PDF generator to avoid oklch error */
  .qr-card-print div, 
  .qr-card-print span,
  .qr-card-print p {
    color: #111827 !important; /* gray-900 */
  }

  .qr-card-print .text-blue-600 {
    color: #2563eb !important; /* blue-600 */
  }

  /* Ensure QR codes are visible */
  .qr-card-print svg {
    display: block !important;
    max-width: 100% !important;
  }

  @page {
    margin: 1cm !important;
  }
}


