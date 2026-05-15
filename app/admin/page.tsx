"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Plus, Trash2, Save, X, Package, Search, LogOut, Printer } from "lucide-react";
import PrintCard from "@/components/PrintCard";
import { Order, OrderStatus, subscribeToOrders, saveOrder, deleteOrder, getAdminSettings, saveAdminSettings } from "@/lib/db";
import { Settings, Phone, Info, ChevronDown, ChevronUp } from "lucide-react";

const statusOptions: { value: OrderStatus; label: string }[] = [
  { value: "received", label: "Received" },
  { value: "testing", label: "In Testing" },
  { value: "review", label: "Under Review" },
  { value: "ready", label: "Ready for Pickup" },
  { value: "delivered", label: "Delivered" },
  { value: "issue", label: "Attention Needed" },
];

// Admin PIN will be fetched from DB

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [newOrder, setNewOrder] = useState<Partial<Order>>({
    status: "received",
    dateReceived: new Date().toISOString().split("T")[0],
    estimatedCompletion: "",
    notes: "",
    result: "",
    phone: "",
  });
  const [printOrder, setPrintOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [adminPin, setAdminPin] = useState("1234");
  const [forwardingNumber, setForwardingNumber] = useState("8457092022");
  const [showSettings, setShowSettings] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [newForwardingNumber, setNewForwardingNumber] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    setLoading(true);
    
    // Fetch settings
    getAdminSettings().then(s => {
      setAdminPin(s.pin);
      setForwardingNumber(s.forwardingNumber);
    });

    const unsub = subscribeToOrders((data) => {
      setOrders(data);
      setLoading(false);
    });
    return () => unsub();
  }, [isAuthenticated]);

  // Handle login
  useEffect(() => {
    getAdminSettings().then(s => {
      setAdminPin(s.pin);
      setForwardingNumber(s.forwardingNumber);
    });
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === adminPin) {
      setIsAuthenticated(true);
      setPinError(false);
    } else {
      setPinError(true);
    }
  };

  const handleUpdateSettings = async () => {
    const updatedPin = newPin.length === 4 ? newPin : adminPin;
    const updatedForwarding = newForwardingNumber || forwardingNumber;
    
    await saveAdminSettings({ 
      pin: updatedPin,
      forwardingNumber: updatedForwarding
    });
    
    setAdminPin(updatedPin);
    setForwardingNumber(updatedForwarding);
    setNewPin("");
    setNewForwardingNumber("");
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const generateNextId = (): string => {
    const existing = orders.map((o) => {
      const match = o.id.match(/^ORD-(\d+)$/i);
      return match ? parseInt(match[1], 10) : 0;
    });
    const max = existing.length > 0 ? Math.max(...existing) : 0;
    return `ORD-${String(max + 1).padStart(3, "0")}`;
  };

  const handleAddOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrder.customerName) return;

    const nextId = generateNextId();

    const order: Order = {
      id: nextId,
      customerName: newOrder.customerName,
      phone: newOrder.phone || "",
      status: (newOrder.status as OrderStatus) || "received",
      dateReceived: newOrder.dateReceived || new Date().toISOString().split("T")[0],
      estimatedCompletion: newOrder.estimatedCompletion || "",
      notes: newOrder.notes || "",
      result: newOrder.result || "",
    };

    await saveOrder(order);
    setShowAddForm(false);
    setNewOrder({
      status: "received",
      dateReceived: new Date().toISOString().split("T")[0],
      estimatedCompletion: "",
      notes: "",
      result: "",
      phone: "",
    });
  };

  const updateStatus = async (orderId: string, status: OrderStatus) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;
    await saveOrder({ ...order, status });
  };

  const updateResult = async (orderId: string, result: string) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;
    await saveOrder({ ...order, result });
  };

  const handleDelete = async (orderId: string) => {
    await deleteOrder(orderId);
  };

  const filteredOrders = orders.filter(
    (o) =>
      o.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.phone && o.phone.includes(searchQuery))
  );

  if (!isAuthenticated) {
    return (
      <div className="min-h-[calc(100vh-300px)] bg-primary-50 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-sm w-full mx-4"
        >
          <div className="card p-8">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-navy-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-navy-600" />
              </div>
              <h1 className="text-2xl font-bold text-navy-900">Admin Access</h1>
              <p className="text-sm text-primary-500 mt-1">Enter your PIN to continue</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value.replace(/\D/g, ""));
                  setPinError(false);
                }}
                placeholder="Enter 4-digit PIN"
                className={`w-full px-4 py-3 rounded-xl border text-center text-lg font-semibold tracking-widest
                         bg-primary-50 focus:outline-none focus:ring-2 focus:border-transparent
                         transition-all duration-200
                         ${pinError ? "border-red-300 focus:ring-red-300" : "border-primary-200 focus:ring-gold-400"}`}
              />
              {pinError && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm text-red-500 text-center"
                >
                  Incorrect PIN. Please try again.
                </motion.p>
              )}
              <button type="submit" className="btn-secondary w-full">
                Unlock
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-300px)] bg-primary-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-navy-900">Order Management</h1>
            <p className="text-primary-600 mt-1">Manage and track all customer orders</p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-navy-600 hover:bg-navy-50 transition-colors"
            >
              <Settings className="w-4 h-4" />
              Phone Settings
            </button>
            <button
              onClick={() => setIsAuthenticated(false)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-primary-600 hover:text-navy-900 hover:bg-primary-100 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>

        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-8"
            >
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Admin PIN Change */}
                <div className="card p-6 bg-white shadow-sm border border-navy-100">
                  <div className="flex items-center gap-2 mb-4">
                    <Lock className="w-5 h-5 text-navy-600" />
                    <h2 className="text-lg font-bold text-navy-900">Change Admin PIN</h2>
                  </div>
                  <p className="text-sm text-primary-600 mb-4">
                    This PIN is used for both website access and phone admin menu.
                  </p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-primary-500 mb-1 uppercase">Admin PIN</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          maxLength={4}
                          value={newPin}
                          onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                          placeholder="New 4-digit PIN"
                          className="flex-1 px-3 py-2 rounded-lg border border-primary-200 focus:ring-2 focus:ring-gold-400 focus:outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-primary-500 mb-1 uppercase">Call Forwarding Number</label>
                      <div className="flex gap-2">
                        <input
                          type="tel"
                          value={newForwardingNumber}
                          onChange={(e) => setNewForwardingNumber(e.target.value)}
                          placeholder="e.g. 8457092022"
                          className="flex-1 px-3 py-2 rounded-lg border border-primary-200 focus:ring-2 focus:ring-gold-400 focus:outline-none"
                        />
                      </div>
                    </div>
                    <button 
                      onClick={handleUpdateSettings}
                      className="btn-primary w-full py-2"
                    >
                      Update Settings
                    </button>
                  </div>
                  {saveSuccess && (
                    <p className="text-sm text-green-600 mt-2 font-medium">Settings updated successfully!</p>
                  )}
                </div>

                {/* Phone System Instructions */}
                <div className="card p-6 bg-navy-900 text-white lg:col-span-2">
                  <div className="flex items-center gap-2 mb-4">
                    <Phone className="w-5 h-5 text-gold-400" />
                    <h2 className="text-lg font-bold">Phone System Instructions</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                    <div>
                      <h3 className="font-bold text-gold-400 mb-2 underline">Main Menu</h3>
                      <ul className="space-y-1 text-navy-50">
                        <li>• <span className="font-bold">Option 1:</span> Check status (customer)</li>
                        <li>• <span className="font-bold">Option 2:</span> Admin access (needs PIN)</li>
                        <li>• <span className="font-bold">Option 3:</span> FORWARD CALL to representative</li>
                        <li>• <span className="font-bold">Direct Entry:</span> Just type Order # + #</li>
                      </ul>
                    </div>
                    <div>
                      <h3 className="font-bold text-gold-400 mb-2 underline">Admin Menu (After PIN)</h3>
                      <ul className="space-y-1 text-navy-50">
                        <li>• <span className="font-bold">1:</span> Hear last 5 recent orders</li>
                        <li>• <span className="font-bold">2:</span> Update order status</li>
                        <li>• <span className="font-bold">3:</span> Lookup orders by phone number</li>
                        <li>• <span className="font-bold">4:</span> ADD NEW ORDER by phone</li>
                        <li>• <span className="font-bold">*:</span> Back to main menu</li>
                      </ul>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-navy-800 flex items-start gap-2 text-xs text-navy-300">
                    <Info className="w-4 h-4 mt-0.5" />
                    <p>Status Codes for Updates: 1=Received, 2=Testing, 3=Review, 4=Ready, 5=Delivered, 6=Issue</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search & Add */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search orders..."
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-primary-200 bg-white
                       focus:outline-none focus:ring-2 focus:ring-gold-400 focus:border-transparent
                       transition-all duration-200 shadow-sm"
            />
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="btn-primary inline-flex items-center gap-2 whitespace-nowrap"
          >
            {showAddForm ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            {showAddForm ? "Cancel" : "Add Order"}
          </button>
        </div>

        {/* Add Form */}
        <AnimatePresence>
          {showAddForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-6"
            >
              <div className="card p-6">
                <h2 className="text-lg font-semibold text-navy-900 mb-4">Add New Order</h2>
                <form onSubmit={handleAddOrder} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-navy-800 mb-1">Customer Name</label>
                    <input
                      type="text"
                      required
                      value={newOrder.customerName || ""}
                      onChange={(e) => setNewOrder({ ...newOrder, customerName: e.target.value })}
                      placeholder="Customer name"
                      className="w-full px-3 py-2 rounded-lg border border-primary-200 bg-primary-50
                               focus:outline-none focus:ring-2 focus:ring-gold-400 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-navy-800 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={newOrder.phone || ""}
                      onChange={(e) => setNewOrder({ ...newOrder, phone: e.target.value })}
                      placeholder="845-709-2022"
                      className="w-full px-3 py-2 rounded-lg border border-primary-200 bg-primary-50
                               focus:outline-none focus:ring-2 focus:ring-gold-400 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-navy-800 mb-1">Status</label>
                    <select
                      value={newOrder.status}
                      onChange={(e) => setNewOrder({ ...newOrder, status: e.target.value as OrderStatus })}
                      className="w-full px-3 py-2 rounded-lg border border-primary-200 bg-primary-50
                               focus:outline-none focus:ring-2 focus:ring-gold-400 focus:border-transparent"
                    >
                      {statusOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-navy-800 mb-1">Date Received</label>
                    <input
                      type="date"
                      value={newOrder.dateReceived}
                      onChange={(e) => setNewOrder({ ...newOrder, dateReceived: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-primary-200 bg-primary-50
                               focus:outline-none focus:ring-2 focus:ring-gold-400 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-navy-800 mb-1">Est. Completion</label>
                    <input
                      type="date"
                      value={newOrder.estimatedCompletion || ""}
                      onChange={(e) => setNewOrder({ ...newOrder, estimatedCompletion: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-primary-200 bg-primary-50
                               focus:outline-none focus:ring-2 focus:ring-gold-400 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-navy-800 mb-1">Test Result</label>
                    <input
                      type="text"
                      value={newOrder.result || ""}
                      onChange={(e) => setNewOrder({ ...newOrder, result: e.target.value })}
                      placeholder="e.g. Clean, Shatnez Found..."
                      className="w-full px-3 py-2 rounded-lg border border-primary-200 bg-primary-50
                               focus:outline-none focus:ring-2 focus:ring-gold-400 focus:border-transparent"
                    />
                  </div>
                  <div className="sm:col-span-2 lg:col-span-2">
                    <label className="block text-sm font-medium text-navy-800 mb-1">Notes</label>
                    <input
                      type="text"
                      value={newOrder.notes || ""}
                      onChange={(e) => setNewOrder({ ...newOrder, notes: e.target.value })}
                      placeholder="Any special notes..."
                      className="w-full px-3 py-2 rounded-lg border border-primary-200 bg-primary-50
                               focus:outline-none focus:ring-2 focus:ring-gold-400 focus:border-transparent"
                    />
                  </div>
                  <div className="sm:col-span-2 lg:col-span-3">
                    <button type="submit" className="btn-primary inline-flex items-center gap-2">
                      <Save className="w-4 h-4" />
                      Save Order
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Orders Table */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-primary-50 border-b border-primary-100">
                  <th className="text-left px-6 py-4 text-sm font-semibold text-navy-800">Order ID</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-navy-800">Customer</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-navy-800 hidden md:table-cell">Phone</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-navy-800">Status</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-navy-800 hidden sm:table-cell">Received</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-navy-800 hidden lg:table-cell">Est. Completion</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-navy-800">Result</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-navy-800">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-primary-500">
                      <Package className="w-12 h-12 mx-auto mb-3 text-primary-300" />
                      <p>No orders found</p>
                      {searchQuery && <p className="text-sm mt-1">Try adjusting your search</p>}
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => (
                    <tr key={order.id} className="border-b border-primary-50 hover:bg-primary-50/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-navy-900">{order.id}</td>
                      <td className="px-6 py-4 text-primary-700">{order.customerName}</td>
                      <td className="px-6 py-4 text-primary-600 hidden md:table-cell">
                        {order.phone ? (
                          <a href={`tel:${order.phone}`} className="hover:text-navy-600 hover:underline">
                            {order.phone}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={order.status}
                          onChange={(e) => updateStatus(order.id, e.target.value as OrderStatus)}
                          className="px-3 py-1.5 rounded-lg border border-primary-200 bg-white text-sm
                                   focus:outline-none focus:ring-2 focus:ring-gold-400 focus:border-transparent
                                   cursor-pointer"
                        >
                          {statusOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4 text-primary-600 hidden sm:table-cell">{order.dateReceived}</td>
                      <td className="px-6 py-4 text-primary-600 hidden lg:table-cell">{order.estimatedCompletion || "—"}</td>
                      <td className="px-6 py-4">
                        <input
                          type="text"
                          value={order.result || ""}
                          onChange={(e) => updateResult(order.id, e.target.value)}
                          placeholder="No result yet"
                          className="w-full px-2 py-1 text-sm rounded border border-primary-200 bg-white
                                   focus:outline-none focus:ring-1 focus:ring-gold-400 focus:border-transparent
                                   transition-all"
                        />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setPrintOrder(order)}
                          className="p-2 rounded-lg text-navy-400 hover:text-navy-600 hover:bg-navy-50 transition-colors mr-1"
                          title="Print card"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(order.id)}
                          className="p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Delete order"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {printOrder && (
          <PrintCard order={printOrder} onClose={() => setPrintOrder(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
