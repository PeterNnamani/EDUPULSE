import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, CreditCard, AlertTriangle, Plus, Search, Download, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store';

export default function FeesPage() {
  const { user } = useAppStore();
  const schoolId = user?.schoolId;

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [feeRecords, setFeeRecords] = useState<any[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalExpected: 0,
    totalCollected: 0,
    totalOutstanding: 0,
    studentsWithBalance: 0,
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [classes, setClasses] = useState<any[]>([]);

  useEffect(() => {
    if (schoolId) {
      fetchFeeData();
    }
  }, [schoolId]);

  useEffect(() => {
    filterRecords();
  }, [feeRecords, searchTerm, filterStatus, filterClass]);

  const fetchFeeData = async () => {
    if (!schoolId) return;

    try {
      console.log('🔄 Fetching fee data for schoolId:', schoolId);

      // 1. Fetch all students
      let students: any[] = [];
      try {
        const { data: studentsData, error } = await supabase
          .from('students')
          .select('id, first_name, last_name, student_id, class_id, status')
          .eq('school_id', schoolId)
          .eq('status', 'active');
        if (error) throw error;
        students = studentsData || [];
        console.log('✓ Students:', students.length);
      } catch (e) {
        console.warn('⚠️ Students error:', e);
      }

      // 2. Fetch all classes
      let classesData: any[] = [];
      try {
        const { data: cls, error } = await supabase
          .from('classes')
          .select('id, class_name')
          .eq('school_id', schoolId);
        if (error) throw error;
        classesData = cls || [];
        setClasses(classesData);
        console.log('✓ Classes:', classesData.length);
      } catch (e) {
        console.warn('⚠️ Classes error:', e);
      }

      // 3. Fetch all payments
      let payments: any[] = [];
      try {
        const { data: paymentData, error } = await supabase
          .from('payments')
          .select('id, student_id, amount, status, created_at, payment_method')
          .eq('school_id', schoolId)
          .order('created_at', { ascending: false });
        if (error) throw error;
        payments = paymentData || [];
        console.log('✓ Payments:', payments.length);
      } catch (e) {
        console.warn('⚠️ Payments error:', e);
      }

      // 4. Fetch fees by class
      let feesData: any[] = [];
      try {
        const { data: feesByClass, error } = await supabase
          .from('fees')
          .select('id, class_id, amount, due_date, late_fee, description')
          .eq('school_id', schoolId)
          .eq('is_active', true);
        if (error) throw error;
        feesData = feesByClass || [];
        console.log('✓ Fees configured:', feesData.length);
      } catch (e) {
        console.warn('⚠️ Fees error:', e);
      }

      // 5. Create fee records by student
      const records: any[] = [];

      students.forEach(student => {
        const studentPayments = payments.filter(p => p.student_id === student.id);
        const totalPaid = studentPayments
          .filter(p => p.status === 'completed')
          .reduce((sum, p) => sum + (p.amount || 0), 0);

        const studentClass = classesData.find(c => c.id === student.class_id);
        const classFee = feesData.find(f => f.class_id === student.class_id);
        const feeAmount = classFee?.amount || 0; // Use configured fee or 0 if none

        const balance = feeAmount - totalPaid;
        const status = balance === 0 ? 'paid' : balance < feeAmount && balance > 0 ? 'partial' : 'unpaid';

        records.push({
          id: student.id,
          student: `${student.first_name} ${student.last_name}`,
          studentId: student.student_id,
          class: studentClass?.class_name || 'Unknown',
          feeType: 'Tuition',
          amount: feeAmount,
          paid: totalPaid,
          balance: Math.max(0, balance),
          status: status,
        });
      });

      setFeeRecords(records);

      // 6. Calculate stats
      const totalExpected = records.reduce((sum, r) => sum + r.amount, 0);
      const totalCollected = records.reduce((sum, r) => sum + r.paid, 0);
      const totalOutstanding = records.reduce((sum, r) => sum + r.balance, 0);
      const studentsWithBalance = records.filter(r => r.balance > 0).length;

      setStats({
        totalExpected,
        totalCollected,
        totalOutstanding,
        studentsWithBalance,
      });

      console.log('✓ Fee records created:', records.length);
      console.log('========================================');
      console.log('📊 Total Expected:', totalExpected);
      console.log('📊 Total Collected:', totalCollected);
      console.log('📊 Outstanding:', totalOutstanding);
      console.log('📊 Students with balance:', studentsWithBalance);
      console.log('========================================');
    } catch (error) {
      console.error('Fatal error fetching fee data:', error);
    }
  };

  const filterRecords = () => {
    let filtered = [...feeRecords];

    if (searchTerm) {
      filtered = filtered.filter(r =>
        r.student.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.studentId.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterStatus) {
      filtered = filtered.filter(r => r.status === filterStatus);
    }

    if (filterClass) {
      filtered = filtered.filter(r => r.class === filterClass);
    }

    setFilteredRecords(filtered);
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
            <input
              className="input-field pl-10"
              placeholder="Search students..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            className="input-field w-full md:w-40"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">All Status</option>
            <option value="paid">Paid</option>
            <option value="partial">Partial</option>
            <option value="unpaid">Unpaid</option>
          </select>
          <select
            className="input-field w-full md:w-40"
            value={filterClass}
            onChange={(e) => setFilterClass(e.target.value)}
          >
            <option value="">All Classes</option>
            {classes.map(cls => (
              <option key={cls.id} value={cls.class_name}>{cls.class_name}</option>
            ))}
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
              {filteredRecords.map((record) => (
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
                    <span className={`badge ${record.status === 'paid' ? 'badge-success' :
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
