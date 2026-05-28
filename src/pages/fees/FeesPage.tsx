import { useState } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, CreditCard, AlertTriangle, Plus, Search, Download, Users } from 'lucide-react';

export default function FeesPage() {
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const mockFeeRecords = [
    { id: '1', student: 'John Doe', class: 'SS1A', feeType: 'Tuition', amount: 45000, paid: 45000, balance: 0, status: 'paid' },
    { id: '2', student: 'Jane Smith', class: 'SS2A', feeType: 'Tuition', amount: 45000, paid: 30000, balance: 15000, status: 'partial' },
    { id: '3', student: 'Emeka Brown', class: 'SS1A', feeType: 'Tuition', amount: 45000, paid: 0, balance: 45000, status: 'unpaid' },
    { id: '4', student: 'Chioma Okonkwo', class: 'SS3A', feeType: 'Tuition', amount: 45000, paid: 45000, balance: 0, status: 'paid' },
    { id: '5', student: 'Ahmed Muhammad', class: 'SS2B', feeType: 'Tuition', amount: 45000, paid: 20000, balance: 25000, status: 'partial' },
  ];

  const stats = {
    totalExpected: 1575000,
    totalCollected: 1125000,
    totalOutstanding: 450000,
    studentsWithBalance: 45,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Fee Management</h1>
          <p className="text-secondary-text">Track fees and payment records</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-secondary flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </button>
          <button onClick={() => setShowPaymentModal(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Record Payment
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-900/30">
              <DollarSign className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="stat-value text-lg">NGN {(stats.totalExpected / 1000).toFixed(0)}K</p>
              <p className="text-xs text-secondary-text">Expected</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-green-100 dark:bg-green-900/30">
              <CreditCard className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="stat-value text-lg">NGN {(stats.totalCollected / 1000).toFixed(0)}K</p>
              <p className="text-xs text-secondary-text">Collected</p>
            </div>
          </div>
        </div>
        <div className="card border-yellow-200 dark:border-yellow-900">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-yellow-100 dark:bg-yellow-900/30">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="stat-value text-lg">NGN {(stats.totalOutstanding / 1000).toFixed(0)}K</p>
              <p className="text-xs text-secondary-text">Outstanding</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-100 dark:bg-red-900/30">
              <Users className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="stat-value text-lg">{stats.studentsWithBalance}</p>
              <p className="text-xs text-secondary-text">Debtors</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-text" />
            <input className="input-field pl-10" placeholder="Search students..." />
          </div>
          <select className="input-field w-full md:w-40">
            <option value="">All Status</option>
            <option value="paid">Paid</option>
            <option value="partial">Partial</option>
            <option value="unpaid">Unpaid</option>
          </select>
          <select className="input-field w-full md:w-40">
            <option value="">All Classes</option>
            <option value="SS1A">SS1A</option>
            <option value="SS1B">SS1B</option>
            <option value="SS2A">SS2A</option>
          </select>
        </div>
      </div>

      {/* Fee Records */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card"
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left rounded-l-lg">Student</th>
                <th className="px-4 py-3 text-left">Fee Type</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-right">Paid</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-left rounded-r-lg">Actions</th>
              </tr>
            </thead>
            <tbody>
              {mockFeeRecords.map((record) => (
                <tr key={record.id} className="table-row">
                  <td className="px-4 py-3">
                    <span className="font-medium">{record.student}</span>
                    <span className="text-xs text-secondary-text ml-2">{record.class}</span>
                  </td>
                  <td className="px-4 py-3 text-sm">{record.feeType}</td>
                  <td className="px-4 py-3 text-right font-medium">NGN {record.amount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-green-600">NGN {record.paid.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-red-600 font-medium">NGN {record.balance.toLocaleString()}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`badge ${
                      record.status === 'paid' ? 'badge-success' :
                      record.status === 'partial' ? 'badge-warning' :
                      'badge-danger'
                    }`}>
                      {record.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button className="text-sm text-black dark:text-white hover:underline">
                      {record.status === 'paid' ? 'Receipt' : 'Pay'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-white dark:bg-dark-bg rounded-2xl shadow-xl"
          >
            <div className="p-6 border-b border-border dark:border-gray-800">
              <h2 className="text-xl font-bold">Record Payment</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label mb-1.5 block">Student</label>
                <input className="input-field" placeholder="Search student..." />
              </div>
              <div>
                <label className="label mb-1.5 block">Amount</label>
                <input type="number" className="input-field" placeholder="NGN 0.00" />
              </div>
              <div>
                <label className="label mb-1.5 block">Payment Method</label>
                <select className="input-field">
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="card">Card</option>
                  <option value="paystack">Paystack</option>
                </select>
              </div>
              <div>
                <label className="label mb-1.5 block">Reference</label>
                <input className="input-field" placeholder="Transaction reference" />
              </div>
              <div>
                <label className="label mb-1.5 block">Notes</label>
                <textarea className="input-field min-h-20" placeholder="Optional notes..." />
              </div>
            </div>
            <div className="p-6 border-t border-border dark:border-gray-800 flex justify-end gap-3">
              <button onClick={() => setShowPaymentModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={() => setShowPaymentModal(false)} className="btn-primary">Record Payment</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
