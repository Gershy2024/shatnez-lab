"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Package, CheckCircle, Clock, AlertCircle, Truck, XCircle, Phone, MessageSquare, ChevronRight } from "lucide-react";
import { Order, OrderStatus, getAllOrders } from "@/lib/db";
import { useLanguage } from "@/lib/LanguageContext";

export default function TrackPage() {
  const { t, isRtl } = useLanguage();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  const statusConfig: Record<OrderStatus, { label: string; icon: any; color: string; bg: string; desc: string }> = {
    received: { label: t("status_received"), icon: Package, color: "text-navy-600", bg: "bg-navy-100", desc: t("status_desc_received") },
    testing: { label: t("status_testing"), icon: Clock, color: "text-gold-600", bg: "bg-gold-100", desc: t("status_desc_testing") },
    review: { label: t("status_review"), icon: AlertCircle, color: "text-navy-600", bg: "bg-navy-100", desc: t("status_desc_review") },
    ready: { label: t("status_ready"), icon: CheckCircle, color: "text-green-600", bg: "bg-green-100", desc: t("status_desc_ready") },
    delivered: { label: t("status_delivered"), icon: Truck, color: "text-green-600", bg: "bg-green-100", desc: t("status_desc_delivered") },
    issue: { label: t("status_issue"), icon: XCircle, color: "text-red-600", bg: "bg-red-100", desc: t("status_desc_issue") },
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const orders = await getAllOrders();
    const q = query.trim().toUpperCase();
    if (!q) {
      setResults([]);
      setSelectedOrder(null);
      setSearched(true);
      setLoading(false);
      return;
    }
    const found = orders.filter(
      (o) =>
        o.id.toUpperCase() === q ||
        (o.phone && o.phone.toUpperCase().includes(q))
    );
    setResults(found);
    setSelectedOrder(found.length === 1 ? found[0] : null);
    setSearched(true);
    setLoading(false);
  };

  const handleSelectOrder = (o: Order) => {
    setSelectedOrder(o);
  };

  const statusSteps: OrderStatus[] = ["received", "testing", "review", "ready", "delivered"];

  return (
    <div className="min-h-[calc(100vh-300px)] bg-primary-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className={`text-center mb-10 ${isRtl ? "text-right" : ""}`}
        >
          <h1 className="text-3xl sm:text-4xl font-bold text-navy-900 mb-3">{t("track_title")}</h1>
          <p className="text-primary-600">
            {t("track_subtitle")}
          </p>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          onSubmit={handleSearch}
          className="mb-10"
        >
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className={`absolute ${isRtl ? "right-4" : "left-4"} top-1/2 -translate-y-1/2 w-5 h-5 text-primary-400`} />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("search_placeholder")}
                className={`w-full ${isRtl ? "pr-12 pl-4 text-right" : "pl-12 pr-4 text-left"} py-4 rounded-xl border border-primary-200 bg-white
                         text-navy-900 placeholder:text-primary-400
                         focus:outline-none focus:ring-2 focus:ring-gold-400 focus:border-transparent
                         transition-all duration-200 shadow-sm`}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary px-8 py-4 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? t("searching") : t("search_btn")}
            </button>
          </div>
        </motion.form>

        <AnimatePresence mode="wait">
          {searched && results.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="card p-8 text-center"
            >
              <AlertCircle className="w-12 h-12 text-primary-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-navy-900 mb-2">{t("order_not_found")}</h3>
              <p className="text-primary-600">
                {t("not_found_desc")}
              </p>
            </motion.div>
          )}

          {searched && results.length > 1 && !selectedOrder && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <h3 className={`text-lg font-semibold text-navy-900 ${isRtl ? "text-right" : ""}`}>
                {t("found_orders").replace("{n}", results.length.toString())}
              </h3>
              {results.map((o) => (
                <button
                  key={o.id}
                  onClick={() => handleSelectOrder(o)}
                  className={`w-full card p-5 ${isRtl ? "text-right" : "text-left"} hover:shadow-md transition-shadow flex items-center justify-between group`}
                >
                  <div className={isRtl ? "order-last" : ""}>
                    <p className="text-sm text-primary-500 mb-1">Order #{o.id}</p>
                    <p className="font-semibold text-navy-900">{o.customerName}</p>
                    <p className="text-sm text-primary-600 mt-1">
                      {statusConfig[o.status].label} • {o.dateReceived}
                    </p>
                  </div>
                  <ChevronRight className={`w-5 h-5 text-primary-400 group-hover:text-navy-600 transition-colors ${isRtl ? "rotate-180" : ""}`} />
                </button>
              ))}
            </motion.div>
          )}

          {selectedOrder && (
            <motion.div
              key={selectedOrder.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="space-y-6"
            >
              {results.length > 1 && (
                <button
                  onClick={() => setSelectedOrder(null)}
                  className={`text-sm text-primary-600 hover:text-navy-900 font-medium ${isRtl ? "text-right block w-full" : ""}`}
                >
                  {t("back_to_results")}
                </button>
              )}

              {/* Status Card */}
              <div className={`card p-8 ${isRtl ? "text-right" : ""}`}>
                <div className={`flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6 ${isRtl ? "sm:flex-row-reverse" : ""}`}>
                  <div className={`w-14 h-14 ${statusConfig[selectedOrder.status].bg} rounded-xl flex items-center justify-center`}>
                    {(() => {
                      const Icon = statusConfig[selectedOrder.status].icon;
                      return <Icon className={`w-7 h-7 ${statusConfig[selectedOrder.status].color}`} />;
                    })()}
                  </div>
                  <div className={isRtl ? "text-right" : ""}>
                    <p className="text-sm text-primary-500 mb-1">Order #{selectedOrder.id}</p>
                    <h2 className={`text-2xl font-bold ${statusConfig[selectedOrder.status].color}`}>
                      {statusConfig[selectedOrder.status].label}
                    </h2>
                  </div>
                </div>
                <p className="text-primary-700 leading-relaxed">{statusConfig[selectedOrder.status].desc}</p>
              </div>

              {/* Progress Steps */}
              <div className="card p-8">
                <h3 className={`text-lg font-semibold text-navy-900 mb-6 ${isRtl ? "text-right" : ""}`}>{t("progress")}</h3>
                <div className={`flex items-center justify-between ${isRtl ? "flex-row-reverse" : ""}`}>
                  {statusSteps.map((step, index) => {
                    const currentStepIndex = statusSteps.indexOf(selectedOrder.status);
                    const isCompleted = index <= currentStepIndex;
                    const isCurrent = index === currentStepIndex;
                    const Icon = statusConfig[step].icon;

                    return (
                      <div key={step} className="flex-1 flex flex-col items-center relative">
                        {index < statusSteps.length - 1 && (
                          <div
                            className={`absolute top-5 ${isRtl ? "right-1/2" : "left-1/2"} w-full h-0.5 transition-colors duration-500 ${
                              index < currentStepIndex ? "bg-gold-400" : "bg-primary-200"
                            }`}
                          />
                        )}
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center z-10 transition-all duration-500 ${
                            isCompleted
                              ? isCurrent
                                ? "bg-gold-400 text-white shadow-lg shadow-gold-400/30"
                                : "bg-gold-400 text-white"
                              : "bg-primary-200 text-primary-400"
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                        <span
                          className={`text-xs mt-2 font-medium text-center ${
                            isCompleted ? "text-navy-900" : "text-primary-400"
                          }`}
                        >
                          {statusConfig[step].label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Details */}
              <div className={`card p-8 ${isRtl ? "text-right" : ""}`}>
                <h3 className="text-lg font-semibold text-navy-900 mb-4">{t("order_details")}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-primary-500 mb-1">{t("customer")}</p>
                    <p className="font-medium text-navy-900">{selectedOrder.customerName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-primary-500 mb-1">{t("date_received")}</p>
                    <p className="font-medium text-navy-900">{selectedOrder.dateReceived}</p>
                  </div>
                  <div>
                    <p className="text-sm text-primary-500 mb-1">{t("est_completion")}</p>
                    <p className="font-medium text-navy-900">{selectedOrder.estimatedCompletion || "—"}</p>
                  </div>
                  {selectedOrder.phone && (
                    <div>
                      <p className="text-sm text-primary-500 mb-1">{t("phone")}</p>
                      <div className={`flex items-center gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
                        <p className="font-medium text-navy-900">{selectedOrder.phone}</p>
                        <a
                          href={`tel:${selectedOrder.phone}`}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-navy-100 text-navy-700 text-xs hover:bg-navy-200 transition-colors"
                        >
                          <Phone className="w-3 h-3" />
                          {t("call")}
                        </a>
                        <a
                          href={`sms:${selectedOrder.phone}`}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gold-100 text-gold-700 text-xs hover:bg-gold-200 transition-colors"
                        >
                          <MessageSquare className="w-3 h-3" />
                          {t("sms")}
                        </a>
                      </div>
                    </div>
                  )}
                </div>
                 {selectedOrder.result && (
                  <div className="mt-4 pt-4 border-t border-primary-100">
                    <p className="text-sm text-primary-500 mb-1">{t("test_result")}</p>
                    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold text-sm ${
                      selectedOrder.result.toLowerCase().includes("clean") 
                        ? "bg-green-100 text-green-800 border border-green-200" 
                        : selectedOrder.result.toLowerCase().includes("shatnez") 
                          ? "bg-red-100 text-red-800 border border-red-200" 
                          : selectedOrder.result === "Call to Discuss"
                            ? "bg-amber-100 text-amber-800 border border-amber-200"
                            : "bg-navy-50 text-navy-800 border border-navy-100"
                    }`}>
                      {selectedOrder.result === "Clean / No Shatnez" 
                        ? (isRtl ? "נקי משעטנז" : "Clean / No Shatnez")
                        : selectedOrder.result === "Shatnez Found"
                          ? (isRtl ? "נמצא שעטנז!" : "Shatnez Found!")
                          : selectedOrder.result === "Call to Discuss"
                            ? (isRtl ? "נא להתקשר לפרטים" : "Call to Discuss")
                            : selectedOrder.result}
                    </div>
                  </div>
                )}
                {selectedOrder.notes && (
                  <div className="mt-4 pt-4 border-t border-primary-100">
                    <p className="text-sm text-primary-500 mb-1">{t("notes")}</p>
                    <p className="text-primary-700">{selectedOrder.notes}</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
