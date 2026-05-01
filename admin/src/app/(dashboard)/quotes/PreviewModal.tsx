'use client';
import { useEffect, useState, useRef } from 'react';
import { X, Printer } from 'lucide-react';
import { generateQuoteHtml } from '@/lib/quoteTemplate';

interface Props {
  quote: any;
  onClose: () => void;
}

export default function PreviewModal({ quote, onClose }: Props) {
  const [html, setHtml] = useState<string>('');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    // Generate the HTML from the quote data
    const generatedHtml = generateQuoteHtml({
      job: quote.job,
      defects: quote.defects,
      total_amount: quote.total_amount,
      reportId: quote.id,
    });
    setHtml(generatedHtml);
  }, [quote]);

  const handlePrint = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.print();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(6px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-4xl h-[90vh] flex flex-col animate-scale-in"
        style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.22)' }}>
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div>
            <h3 className="font-extrabold text-lg" style={{ color: 'var(--text)' }}>Quote Preview</h3>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {quote.job?.property?.name ?? '—'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:shadow-lg active:scale-95"
              style={{ background: 'linear-gradient(135deg,#1B2D4F,#243a65)' }}>
              <Printer size={15} strokeWidth={2.5} /> Print / Save PDF
            </button>
            <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-gray-100">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Iframe Body */}
        <div className="flex-1 bg-gray-100 p-4 overflow-hidden rounded-b-2xl">
          <div className="w-full h-full bg-white shadow-sm border overflow-hidden rounded" style={{ borderColor: 'var(--border)' }}>
            {html ? (
              <iframe
                ref={iframeRef}
                srcDoc={html}
                className="w-full h-full border-0"
                title="Quote PDF Preview"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
