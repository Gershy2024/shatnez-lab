"use client";

import { useRef, useState } from "react";
import { Printer, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type OrderStatus = "received" | "testing" | "review" | "ready" | "delivered" | "issue";

interface Order {
  id: string;
  customerName: string;
  phone?: string;
  status: OrderStatus;
  dateReceived: string;
  estimatedCompletion: string;
  notes: string;
  result: string;
}

interface PrintCardProps {
  order: Order;
  onClose: () => void;
}

export default function PrintCard({ order, onClose }: PrintCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const cardHtml = cardRef.current?.outerHTML || "";
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Order Card - ${order.id}</title>
          <style>
            @page { size: 4in 2.5in; margin: 0.2in; }
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
            body { 
              margin: 0; 
              padding: 0; 
              display: flex; 
              align-items: center; 
              justify-content: center;
              min-height: 100vh;
              background: #f5f5f5;
              font-family: Arial, sans-serif;
            }
            * { box-sizing: border-box; }
            .print-card {
              width: 4in !important;
              height: 2.5in !important;
              margin: 0 auto;
              page-break-inside: avoid;
              border-radius: 12px !important;
              box-shadow: 0 4px 6px rgba(0,0,0,0.1) !important;
              overflow: hidden !important;
            }
            .print-card-header {
              background: linear-gradient(135deg, #1e3a5f 0%, #0d1b2a 100%) !important;
              padding: 12px 16px !important;
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2px solid #d4af37 !important;
            }
            .print-card-body {
              padding: 16px !important;
              background: #ffffff !important;
            }
            .print-card-footer {
              background: #f8f9fa !important;
              padding: 8px 16px !important;
              border-top: 1px solid #e9ecef !important;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .status-badge {
              padding: 4px 10px !important;
              border-radius: 6px !important;
              font-weight: bold !important;
              text-transform: uppercase !important;
              font-size: 10px !important;
            }
            .status-received { background: #e3f2fd !important; color: #1565c0 !important; }
            .status-testing { background: #fff3e0 !important; color: #e65100 !important; }
            .status-review { background: #f3e5f5 !important; color: #7b1fa2 !important; }
            .status-ready { background: #e8f5e9 !important; color: #2e7d32 !important; }
            .status-delivered { background: #e8f5e9 !important; color: #1b5e20 !important; }
            .status-issue { background: #ffebee !important; color: #c62828 !important; }
            .result-badge {
              padding: 4px 10px !important;
              border-radius: 6px !important;
              font-weight: bold !important;
              text-transform: uppercase !important;
              font-size: 10px !important;
              background: #e8f5e9 !important;
              color: #2e7d32 !important;
              border: 1px solid #4caf50 !important;
            }
          </style>
        </head>
        <body>
          ${cardHtml}
          <script>
            setTimeout(() => { window.print(); window.close(); }, 300);
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="font-semibold text-navy-900">Print Order Card</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Card Preview */}
        <div className="p-6 bg-gray-50 flex justify-center">
          <div
            ref={cardRef}
            className="print-card bg-white border-2 border-navy-900 rounded-xl overflow-hidden"
            style={{ width: "4in", height: "2.5in" }}
          >
            {/* Header */}
            <div className="print-card-header text-white">
              <span className="text-sm font-bold tracking-wide">THE SHATNEZ LAB</span>
              <span className="text-sm font-mono opacity-90">{order.id}</span>
            </div>

            {/* Body */}
            <div className="print-card-body space-y-2">
              <div className="flex justify-between items-baseline">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Customer</span>
                <span className="text-sm font-bold text-navy-900 truncate max-w-[2.2in]">{order.customerName}</span>
              </div>

              {order.phone && (
                <div className="flex justify-between items-baseline">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Phone</span>
                  <span className="text-sm font-mono text-navy-700">{order.phone}</span>
                </div>
              )}

              <div className="flex justify-between items-baseline">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Received</span>
                <span className="text-sm text-navy-700">{order.dateReceived}</span>
              </div>

              {order.estimatedCompletion && (
                <div className="flex justify-between items-baseline">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Est. Ready</span>
                  <span className="text-sm text-navy-700">{order.estimatedCompletion}</span>
                </div>
              )}

              <div className="flex justify-between items-center pt-1">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Status</span>
                <span className={`status-badge status-${order.status}`}>
                  {order.status}
                </span>
              </div>

              {order.result && (
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Result</span>
                  <span className="result-badge">
                    {order.result}
                  </span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="print-card-footer">
              <span className="text-[9px] text-gray-500 font-medium">📞 845-709-2022</span>
              <span className="text-[9px] text-gray-400">theshatnazlab.netlify.app</span>
            </div>
          </div>
        </div>

        <div className="p-4 flex gap-3">
          <button
            onClick={handlePrint}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            <Printer className="w-4 h-4" />
            Print Card
          </button>
          <button
            onClick={onClose}
            className="px-6 py-3 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
