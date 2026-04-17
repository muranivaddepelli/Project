const { checklistRepository } = require('../repositories');
const { AppError } = require('../middlewares/errorHandler');
const { Parser } = require('json2csv');
const PDFDocument = require('pdfkit');
const { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, WidthType, AlignmentType, BorderStyle, HeadingLevel } = require('docx');
const hospitalService = require('./hospital.service');

class ChecklistService {
  async getChecklistByDate(date, areaId = null, hospitalId = null) {
    const checklistDate = new Date(date);
    if (isNaN(checklistDate.getTime())) {
      throw new AppError('Invalid date format', 400);
    }

    return await checklistRepository.findByDate(checklistDate, areaId, hospitalId);
  }

  async updateChecklistEntry(taskId, date, updateData, userId, hospitalId = null) {
    const checklistDate = new Date(date);
    if (isNaN(checklistDate.getTime())) {
      throw new AppError('Invalid date format', 400);
    }

    const entryData = {
      ...updateData,
      completedBy: userId
    };

    if (updateData.status === true) {
      entryData.completedAt = new Date();
    } else if (updateData.status === false) {
      entryData.completedAt = null;
    }

    return await checklistRepository.upsert(taskId, checklistDate, entryData, hospitalId);
  }

  async saveChecklist(entries, date, userId, hospitalId = null) {
    const checklistDate = new Date(date);
    if (isNaN(checklistDate.getTime())) {
      throw new AppError('Invalid date format', 400);
    }

    const entriesToSave = entries.map(entry => ({
      taskId: entry.taskId,
      date: checklistDate,
      status: entry.status,
      staffName: entry.staffName,
      completedBy: userId
    }));

    await checklistRepository.bulkUpsert(entriesToSave, hospitalId);
    return { message: 'Checklist saved successfully' };
  }

  async exportToCSV(date, areaId = null, hospitalId = null) {
    const checklistDate = new Date(date);
    if (isNaN(checklistDate.getTime())) {
      throw new AppError('Invalid date format', 400);
    }

    const data = await checklistRepository.getEntriesForExport(checklistDate, areaId, hospitalId);
    
    if (data.length === 0) {
      throw new AppError('No data available for export', 404);
    }

    // Get hospital branding for filename
    const branding = await hospitalService.getBranding(hospitalId);

    const fields = [
      { label: 'Hospital', value: 'hospital' },
      { label: 'Task ID', value: 'taskId' },
      { label: 'Area', value: 'area' },
      { label: 'Task Name', value: 'taskName' },
      { label: 'Description', value: 'description' },
      { label: 'Status', value: 'status' },
      { label: 'Staff Name', value: 'staffName' },
      { label: 'Timestamp', value: 'timestamp' }
    ];

    const parser = new Parser({ fields });
    const csv = parser.parse(data);

    const safeHospitalCode = branding.code.replace(/[^a-zA-Z0-9]/g, '_');
    
    return {
      data: csv,
      filename: `checklist_${safeHospitalCode}_${checklistDate.toISOString().split('T')[0]}.csv`,
      contentType: 'text/csv'
    };
  }

  async exportToPDF(date, areaId = null, hospitalId = null) {
    const checklistDate = new Date(date);
    if (isNaN(checklistDate.getTime())) {
      throw new AppError('Invalid date format', 400);
    }

    const data = await checklistRepository.getEntriesForExport(checklistDate, areaId, hospitalId);
    
    if (data.length === 0) {
      throw new AppError('No data available for export', 404);
    }

    // Get hospital branding
    const branding = await hospitalService.getBranding(hospitalId);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        const safeHospitalCode = branding.code.replace(/[^a-zA-Z0-9]/g, '_');
        resolve({
          data: pdfBuffer,
          filename: `checklist_${safeHospitalCode}_${checklistDate.toISOString().split('T')[0]}.pdf`,
          contentType: 'application/pdf'
        });
      });
      doc.on('error', reject);

      // Header with hospital branding
      doc.fontSize(20).font('Helvetica-Bold')
        .text(branding.name, { align: 'center' });
      doc.fontSize(16).font('Helvetica')
        .text('Daily Checklist Report', { align: 'center' });
      doc.fontSize(12)
        .text(`Date: ${checklistDate.toLocaleDateString('en-US', { 
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
        })}`, { align: 'center' });
      
      // Add hospital contact info if available
      if (branding.address || branding.phone || branding.email) {
        doc.fontSize(9).fillColor('#666666');
        const contactParts = [];
        if (branding.address) contactParts.push(branding.address);
        if (branding.phone) contactParts.push(`Tel: ${branding.phone}`);
        if (branding.email) contactParts.push(branding.email);
        doc.text(contactParts.join(' | '), { align: 'center' });
        doc.fillColor('#000000');
      }
      
      doc.moveDown(2);

      // Table header
      const tableTop = doc.y;
      const colWidths = [110, 55, 80, 90, 150, 45, 90, 100];
      const headers = ['Hospital', 'Task ID', 'Area', 'Task Name', 'Description', 'Status', 'Staff Name', 'Timestamp'];
      
      doc.font('Helvetica-Bold').fontSize(9);
      let xPos = 30;
      headers.forEach((header, i) => {
        doc.text(header, xPos, tableTop, { width: colWidths[i], align: 'left' });
        xPos += colWidths[i];
      });

      // Draw header line
      doc.moveTo(30, tableTop + 15).lineTo(760, tableTop + 15).stroke();

      // Table rows
      doc.font('Helvetica').fontSize(8);
      let yPos = tableTop + 25;
      
      data.forEach((row, index) => {
        if (yPos > 520) {
          doc.addPage();
          yPos = 30;
        }

        xPos = 30;
        const values = [
          row.hospital?.substring(0, 20),
          row.taskId,
          row.area.substring(0, 12),
          row.taskName.substring(0, 14),
          row.description.substring(0, 28),
          row.status,
          row.staffName.substring(0, 14),
          row.timestamp
        ];

        values.forEach((value, i) => {
          doc.text(value || '', xPos, yPos, { width: colWidths[i], align: 'left' });
          xPos += colWidths[i];
        });

        yPos += 18;
      });

      // Footer with hospital name
      doc.fontSize(8).text(
        `${branding.name} | Generated on ${new Date().toLocaleString()}`,
        30, 550,
        { align: 'center', width: 720 }
      );

      doc.end();
    });
  }

  async getStatistics(date, hospitalId = null) {
    const checklistDate = new Date(date);
    if (isNaN(checklistDate.getTime())) {
      throw new AppError('Invalid date format', 400);
    }

    const data = await checklistRepository.findByDate(checklistDate, null, hospitalId);
    
    const total = data.length;
    const completed = data.filter(item => item.entry?.status === true).length;
    const pending = total - completed;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      total,
      completed,
      pending,
      completionRate
    };
  }

  // Get reports data filtered by createdAt date range
  async getReportsByDateRange(startDate, endDate, areaId = null, hospitalId = null) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new AppError('Invalid date format', 400);
    }

    const data = await checklistRepository.getEntriesForDateRange(start, end, areaId, hospitalId);
    
    // Calculate statistics
    const total = data.length;
    const completed = data.filter(item => item.status === 'Yes').length;
    const pending = total - completed;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Group by area
    const byArea = data.reduce((acc, item) => {
      const areaName = item.area || 'Unknown';
      if (!acc[areaName]) {
        acc[areaName] = { total: 0, completed: 0 };
      }
      acc[areaName].total++;
      if (item.status === 'Yes') {
        acc[areaName].completed++;
      }
      return acc;
    }, {});

    return {
      entries: data,
      statistics: {
        total,
        completed,
        pending,
        completionRate,
        byArea
      }
    };
  }

  async exportToDOCX(date, areaId = null, hospitalId = null) {
    const checklistDate = new Date(date);
    if (isNaN(checklistDate.getTime())) {
      throw new AppError('Invalid date format', 400);
    }

    const data = await checklistRepository.getEntriesForExport(checklistDate, areaId, hospitalId);
    
    if (data.length === 0) {
      throw new AppError('No data available for export', 404);
    }

    // Get hospital branding
    const branding = await hospitalService.getBranding(hospitalId);

    // Create table rows
    const tableRows = [
      // Header row
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: 'Hospital', bold: true })] })],
            width: { size: 2200, type: WidthType.DXA },
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: 'Task ID', bold: true })] })],
            width: { size: 1000, type: WidthType.DXA },
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: 'Area', bold: true })] })],
            width: { size: 1500, type: WidthType.DXA },
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: 'Task Name', bold: true })] })],
            width: { size: 2000, type: WidthType.DXA },
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: 'Description', bold: true })] })],
            width: { size: 3000, type: WidthType.DXA },
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: 'Status', bold: true })] })],
            width: { size: 800, type: WidthType.DXA },
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: 'Staff Name', bold: true })] })],
            width: { size: 1500, type: WidthType.DXA },
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: 'Timestamp', bold: true })] })],
            width: { size: 2000, type: WidthType.DXA },
          }),
        ],
      }),
      // Data rows
      ...data.map(row => new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(row.hospital || '')] }),
          new TableCell({ children: [new Paragraph(row.taskId || '')] }),
          new TableCell({ children: [new Paragraph(row.area || '')] }),
          new TableCell({ children: [new Paragraph(row.taskName || '')] }),
          new TableCell({ children: [new Paragraph(row.description || '')] }),
          new TableCell({ children: [new Paragraph(row.status || 'No')] }),
          new TableCell({ children: [new Paragraph(row.staffName || '')] }),
          new TableCell({ children: [new Paragraph(row.timestamp || '')] }),
        ],
      }))
    ];

    // Create the document
    const doc = new Document({
      sections: [{
        properties: {
          page: {
            size: {
              orientation: 'landscape',
            },
          },
        },
        children: [
          // Hospital Name Header
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: branding.name,
                bold: true,
                size: 36,
              }),
            ],
          }),
          // Subtitle
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: 'Daily Checklist Report',
                size: 28,
              }),
            ],
          }),
          // Date
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: `Date: ${checklistDate.toLocaleDateString('en-US', { 
                  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
                })}`,
                size: 22,
              }),
            ],
          }),
          // Contact info if available
          ...(branding.address || branding.phone || branding.email ? [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: [branding.address, branding.phone ? `Tel: ${branding.phone}` : '', branding.email].filter(Boolean).join(' | '),
                  size: 18,
                  color: '666666',
                }),
              ],
            }),
          ] : []),
          // Spacer
          new Paragraph({ text: '' }),
          // Table
          new Table({
            rows: tableRows,
            width: {
              size: 100,
              type: WidthType.PERCENTAGE,
            },
          }),
          // Spacer
          new Paragraph({ text: '' }),
          // Footer
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: `${branding.name} | Generated on ${new Date().toLocaleString()}`,
                size: 16,
                color: '888888',
              }),
            ],
          }),
        ],
      }],
    });

    // Generate the document buffer
    const buffer = await Packer.toBuffer(doc);
    const safeHospitalCode = branding.code.replace(/[^a-zA-Z0-9]/g, '_');

    return {
      data: buffer,
      filename: `checklist_${safeHospitalCode}_${checklistDate.toISOString().split('T')[0]}.docx`,
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    };
  }

  // Date range exports - exports checklist entries created within the date range
  async exportRangeToCSV(startDate, endDate, areaId = null, hospitalId = null) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999); // Include the entire end date
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new AppError('Invalid date format', 400);
    }

    const data = await checklistRepository.getEntriesForDateRange(start, end, areaId, hospitalId);
    
    if (data.length === 0) {
      throw new AppError('No data available for export in this date range', 404);
    }

    const branding = await hospitalService.getBranding(hospitalId);

    const fields = [
      { label: 'Hospital', value: 'hospital' },
      { label: 'Date', value: 'date' },
      { label: 'Task ID', value: 'taskId' },
      { label: 'Area', value: 'area' },
      { label: 'Task Name', value: 'taskName' },
      { label: 'Description', value: 'description' },
      { label: 'Status', value: 'status' },
      { label: 'Staff Name', value: 'staffName' },
      { label: 'Created At', value: 'createdAt' },
      { label: 'Completed At', value: 'completedAt' }
    ];

    const parser = new Parser({ fields });
    const csv = parser.parse(data);

    const safeHospitalCode = branding.code.replace(/[^a-zA-Z0-9]/g, '_');
    
    return {
      data: csv,
      filename: `checklist_${safeHospitalCode}_${start.toISOString().split('T')[0]}_to_${end.toISOString().split('T')[0]}.csv`,
      contentType: 'text/csv'
    };
  }

  async exportRangeToPDF(startDate, endDate, areaId = null, hospitalId = null) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new AppError('Invalid date format', 400);
    }

    const data = await checklistRepository.getEntriesForDateRange(start, end, areaId, hospitalId);
    
    if (data.length === 0) {
      throw new AppError('No data available for export in this date range', 404);
    }

    const branding = await hospitalService.getBranding(hospitalId);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        const safeHospitalCode = branding.code.replace(/[^a-zA-Z0-9]/g, '_');
        resolve({
          data: pdfBuffer,
          filename: `checklist_${safeHospitalCode}_${start.toISOString().split('T')[0]}_to_${end.toISOString().split('T')[0]}.pdf`,
          contentType: 'application/pdf'
        });
      });
      doc.on('error', reject);

      // Header with hospital branding
      doc.fontSize(20).font('Helvetica-Bold')
        .text(branding.name, { align: 'center' });
      doc.fontSize(16).font('Helvetica')
        .text('Daily Checklist Report', { align: 'center' });
      doc.fontSize(12)
        .text(`Date Range: ${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`, { align: 'center' });
      
      if (branding.address || branding.phone || branding.email) {
        doc.fontSize(9).fillColor('#666666');
        const contactParts = [];
        if (branding.address) contactParts.push(branding.address);
        if (branding.phone) contactParts.push(`Tel: ${branding.phone}`);
        if (branding.email) contactParts.push(branding.email);
        doc.text(contactParts.join(' | '), { align: 'center' });
        doc.fillColor('#000000');
      }
      
      doc.moveDown(2);

      // Table header
      const tableTop = doc.y;
      const colWidths = [55, 90, 55, 65, 75, 125, 40, 65, 150];
      const headers = ['Date', 'Hospital', 'Task ID', 'Area', 'Task Name', 'Description', 'Status', 'Staff', 'Completed At'];
      
      doc.font('Helvetica-Bold').fontSize(8);
      let xPos = 30;
      headers.forEach((header, i) => {
        doc.text(header, xPos, tableTop, { width: colWidths[i], align: 'left' });
        xPos += colWidths[i];
      });

      doc.moveTo(30, tableTop + 15).lineTo(760, tableTop + 15).stroke();

      // Table rows
      doc.font('Helvetica').fontSize(7);
      let yPos = tableTop + 25;
      
      data.forEach((row) => {
        if (yPos > 520) {
          doc.addPage();
          yPos = 30;
        }

        xPos = 30;
        const values = [
          row.date.substring(0, 10),
          row.hospital?.substring(0, 16),
          row.taskId,
          row.area.substring(0, 10),
          row.taskName.substring(0, 12),
          row.description.substring(0, 25),
          row.status,
          row.staffName.substring(0, 10),
          row.completedAt || ''
        ];

        values.forEach((value, i) => {
          doc.text(value || '', xPos, yPos, { width: colWidths[i], align: 'left' });
          xPos += colWidths[i];
        });

        yPos += 16;
      });

      doc.fontSize(8).text(
        `${branding.name} | Generated on ${new Date().toLocaleString()} | Total entries: ${data.length}`,
        30, 550,
        { align: 'center', width: 720 }
      );

      doc.end();
    });
  }

  async exportRangeToDOCX(startDate, endDate, areaId = null, hospitalId = null) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new AppError('Invalid date format', 400);
    }

    const data = await checklistRepository.getEntriesForDateRange(start, end, areaId, hospitalId);
    
    if (data.length === 0) {
      throw new AppError('No data available for export in this date range', 404);
    }

    const branding = await hospitalService.getBranding(hospitalId);

    // Create table rows
    const tableRows = [
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Date', bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Hospital', bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Task ID', bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Area', bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Task Name', bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Description', bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Status', bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Staff Name', bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Completed At', bold: true })] })] }),
        ],
      }),
      ...data.map(row => new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(row.date.substring(0, 10))] }),
          new TableCell({ children: [new Paragraph(row.hospital || '')] }),
          new TableCell({ children: [new Paragraph(row.taskId || '')] }),
          new TableCell({ children: [new Paragraph(row.area || '')] }),
          new TableCell({ children: [new Paragraph(row.taskName || '')] }),
          new TableCell({ children: [new Paragraph(row.description || '')] }),
          new TableCell({ children: [new Paragraph(row.status || 'No')] }),
          new TableCell({ children: [new Paragraph(row.staffName || '')] }),
          new TableCell({ children: [new Paragraph(row.completedAt || '')] }),
        ],
      }))
    ];

    const doc = new Document({
      sections: [{
        properties: {
          page: { size: { orientation: 'landscape' } },
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: branding.name, bold: true, size: 36 })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: 'Daily Checklist Report', size: 28 })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: `Date Range: ${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
                size: 22,
              }),
            ],
          }),
          ...(branding.address || branding.phone || branding.email ? [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: [branding.address, branding.phone ? `Tel: ${branding.phone}` : '', branding.email].filter(Boolean).join(' | '),
                  size: 18,
                  color: '666666',
                }),
              ],
            }),
          ] : []),
          new Paragraph({ text: '' }),
          new Table({
            rows: tableRows,
            width: { size: 100, type: WidthType.PERCENTAGE },
          }),
          new Paragraph({ text: '' }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: `${branding.name} | Generated on ${new Date().toLocaleString()} | Total entries: ${data.length}`,
                size: 16,
                color: '888888',
              }),
            ],
          }),
        ],
      }],
    });

    const buffer = await Packer.toBuffer(doc);
    const safeHospitalCode = branding.code.replace(/[^a-zA-Z0-9]/g, '_');

    return {
      data: buffer,
      filename: `checklist_${safeHospitalCode}_${start.toISOString().split('T')[0]}_to_${end.toISOString().split('T')[0]}.docx`,
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    };
  }
}

module.exports = new ChecklistService();

