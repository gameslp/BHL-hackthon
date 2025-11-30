import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Building {
  id?: string;
  polygon?: number[][];
  centroid?: { lng?: number; lat?: number };
  isAsbestos?: boolean;
  isPotentiallyAsbestos?: boolean | null;
  createdAt?: string;
  updatedAt?: string;
  address?: string | null;
  city?: string | null;
  voivodeship?: string | null;
}

interface BBoxStats {
  total?: number;
  asbestos?: number;
  potentiallyAsbestos?: number;
  clean?: number;
  unknown?: number;
}

async function loadFont(doc: jsPDF) {
  try {
    const loadFile = async (url: string, filename: string, fontName: string, style: string) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to load font ' + filename);
      const blob = await response.blob();
      return new Promise<void>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = (reader.result as string).split(',')[1];
          doc.addFileToVFS(filename, base64data);
          doc.addFont(filename, fontName, style);
          resolve();
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    };

    await Promise.all([
      loadFile('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf', 'Roboto-Regular.ttf', 'Roboto', 'normal'),
      loadFile('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Medium.ttf', 'Roboto-Medium.ttf', 'Roboto', 'bold')
    ]);
    
    doc.setFont('Roboto');
  } catch (error) {
    console.warn('Could not load custom font, falling back to default', error);
  }
}

export async function exportTerrainReport(
  buildings: Building[],
  stats: BBoxStats,
  bbox?: { ne: { lat: number; lng: number }; sw: { lat: number; lng: number } }
) {
  const doc = new jsPDF();
  await loadFont(doc);
  const pageWidth = doc.internal.pageSize.getWidth();

  // Title
  doc.setFontSize(20);
  const fontName = doc.getFontList()['Roboto'] ? 'Roboto' : 'helvetica';
  doc.setFont(fontName, 'bold');
  doc.text('Asbestos Detection Report', pageWidth / 2, 20, { align: 'center' });

  // Date
  doc.setFontSize(10);
  doc.setFont(fontName, 'normal');
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, 28, { align: 'center' });

  // Area Info
  if (bbox) {
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(
      `Area: ${bbox.sw.lat.toFixed(4)}, ${bbox.sw.lng.toFixed(4)} to ${bbox.ne.lat.toFixed(4)}, ${bbox.ne.lng.toFixed(4)}`,
      pageWidth / 2,
      34,
      { align: 'center' }
    );
    doc.setTextColor(0);
  }

  // Summary Section
  doc.setFontSize(14);
  doc.setFont(fontName, 'bold');
  doc.text('Summary Statistics', 14, 45);

  doc.setFontSize(10);
  doc.setFont(fontName, 'normal');

  const summaryData = [
    ['Total Buildings', stats.total?.toString() || '0'],
    ['Asbestos Confirmed', stats.asbestos?.toString() || '0'],
    ['Potentially Asbestos', stats.potentiallyAsbestos?.toString() || '0'],
    ['Unknown Status', stats.unknown?.toString() || '0'],
  ];

  autoTable(doc, {
    startY: 50,
    head: [['Category', 'Count']],
    body: summaryData,
    theme: 'grid',
    headStyles: { fillColor: [66, 139, 202], font: fontName, fontStyle: 'bold' },
    bodyStyles: { font: fontName, fontStyle: 'normal' },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { cellWidth: 40, halign: 'center' },
   },
  });

  // Risk Assessment
  const asbestosCount = stats.asbestos || 0;
  const potentialCount = stats.potentiallyAsbestos || 0;
  const totalCount = stats.total || 1;
  const riskPercentage = ((asbestosCount + potentialCount) / totalCount * 100).toFixed(1);

  let riskLevel = 'Low';
  let riskColor: [number, number, number] = [76, 175, 80]; // Green

  if (parseFloat(riskPercentage) > 50) {
    riskLevel = 'High';
    riskColor = [244, 67, 54]; // Red
  } else if (parseFloat(riskPercentage) > 20) {
    riskLevel = 'Medium';
    riskColor = [255, 152, 0]; // Orange
  }

  const finalY = (doc as any).lastAutoTable.finalY || 50;

  doc.setFontSize(12);
  doc.setFont(fontName, 'bold');
  doc.text('Risk Assessment', 14, finalY + 15);

  doc.setFontSize(10);
  doc.setFont(fontName, 'normal');
  doc.text(`Risk Level: `, 14, finalY + 23);
  doc.setTextColor(...riskColor);
  doc.setFont(fontName, 'bold');
  doc.text(riskLevel, 42, finalY + 23);
  doc.setTextColor(0);
  doc.setFont(fontName, 'normal');
  doc.text(`(${riskPercentage}% of buildings have asbestos concerns)`, 60, finalY + 23);

  // Problematic Buildings Section
  const problematicBuildings = buildings.filter(
    b => b.isAsbestos === true || b.isPotentiallyAsbestos === true
  );

  if (problematicBuildings.length > 0) {
    doc.setFontSize(14);
    doc.setFont(fontName, 'bold');
    doc.text('Problematic Buildings Details', 14, finalY + 35);

    const buildingsData = problematicBuildings.slice(0, 50).map((building, index) => {
      const address = building.address ? 
        (building.address + ", " + (building.city ?? "?") + ", " + (building.voivodeship?.split(" ")[0] ?? "?")) : 
        (building.centroid
        ? `${building.centroid.lat?.toFixed(5)}, ${building.centroid.lng?.toFixed(5)}`
        : 'N/A');

      return [
        (index + 1).toString(),
        address,
        building.isAsbestos ? 'No' : 'Yes',
        building.updatedAt ? new Date(building.updatedAt).toLocaleDateString() : 'N/A',
      ];
    });

    autoTable(doc, {
      startY: finalY + 40,
      head: [['#', 'Address', 'Predicted', 'Last Updated']],
      body: buildingsData,
      theme: 'striped',
      headStyles: { fillColor: [244, 67, 54], font: fontName, fontStyle: 'bold' },
      bodyStyles: { font: fontName, fontStyle: 'normal' },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 115 },
        2: { cellWidth: 25 },
        3: { cellWidth: 35 },
      },
    });

    if (problematicBuildings.length > 50) {
      const tableY = (doc as any).lastAutoTable.finalY || 0;
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text(
        `Note: Showing first 50 of ${problematicBuildings.length} problematic buildings`,
        14,
        tableY + 7
      );
      doc.setTextColor(0);
    }
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Page ${i} of ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
    doc.text(
      'Generated by Asbestos Detection System',
      pageWidth - 14,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'right' }
    );
    doc.setTextColor(0);
  }

  // Save the PDF
  const timestamp = new Date().toISOString().split('T')[0];
  doc.save(`asbestos-report-${timestamp}.pdf`);
}
