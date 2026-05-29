import { useState } from 'react';
import { getWeeklyVelocity } from '../utils/sprintUtils.js';

export function useExport({ sprintConfig, sprintMetrics, setShareToast, showAlert, setLoading }) {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  const handleExport = async (format = 'pdf', offScreenRef = null) => {
    try {
      setLoading(true);

      await document.fonts.ready;

      const html2canvas = (await import('html2canvas')).default;
      const velocity = getWeeklyVelocity(sprintConfig, sprintMetrics.velocityCompletedPoints, sprintMetrics.velocityPoints);
      const baseName = `${sprintConfig.name.replace(/\s+/g, '_')}_Week${velocity.weeksElapsed}_Report_${new Date().toISOString().split('T')[0]}`;

      if (offScreenRef?.current) {
        const pageEls = Array.from(offScreenRef.current.children);

        if (format === 'pdf') {
          const { jsPDF } = await import('jspdf');
          const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
          for (let i = 0; i < pageEls.length; i++) {
            const canvas = await html2canvas(pageEls[i], {
              scale: 2, logging: false, backgroundColor: '#ffffff', width: 794,
            });
            if (i > 0) pdf.addPage();
            pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 210, (canvas.height * 210) / canvas.width);
          }
          pdf.save(`${baseName}.pdf`);
        } else {
          const canvases = await Promise.all(
            pageEls.map(el => html2canvas(el, { scale: 2, logging: false, backgroundColor: '#ffffff', width: 794 }))
          );
          const merged = document.createElement('canvas');
          merged.width = canvases[0].width;
          merged.height = canvases.reduce((s, c) => s + c.height, 0);
          const ctx = merged.getContext('2d');
          let y = 0;
          canvases.forEach(c => { ctx.drawImage(c, 0, y); y += c.height; });
          const link = document.createElement('a');
          link.download = `${baseName}.png`;
          link.href = merged.toDataURL('image/png');
          link.click();
        }
      }

      setShowExportModal(false);
      setShareToast(`${format === 'pdf' ? 'PDF' : 'Image'} exported successfully`);
      setTimeout(() => setShareToast(''), 3000);
    } catch (error) {
      console.error('Export error:', error);
      showAlert('Export Failed', error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return { handleExport, showExportMenu, setShowExportMenu, showExportModal, setShowExportModal };
}
