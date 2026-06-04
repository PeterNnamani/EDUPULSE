import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Edit2, Trash2, DollarSign, AlertCircle, Loader } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store';

interface FeeRecord {
    id: string;
    class_id: string;
    class_name: string;
    amount: number;
    due_date: string;
    late_fee: number;
    is_active: boolean;
    description?: string;
}

interface FeeForm {
    classId: string;
    amount: string;
    dueDate: string;
    lateFee: string;
    description: string;
}

export default function FeeSettingsPage() {
    const { user } = useAppStore();
    const schoolId = user?.schoolId;

    const [fees, setFees] = useState<FeeRecord[]>([]);
    const [classes, setClasses] = useState<any[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [formData, setFormData] = useState<FeeForm>({
        classId: '',
        amount: '',
        dueDate: '',
        lateFee: '0',
        description: '',
    });

    useEffect(() => {
        if (schoolId) {
            fetchData();
        }
    }, [schoolId]);

    const fetchData = async () => {
        if (!schoolId) return;

        try {
            console.log('🔄 Fetching fee settings for schoolId:', schoolId);
            setLoading(true);
            setError('');

            // Fetch classes
            let classesData: any[] = [];
            try {
                const { data: cls, error: clsError } = await supabase
                    .from('classes')
                    .select('id, name')
                    .eq('school_id', schoolId)
                    .order('name');
                if (clsError) throw clsError;
                classesData = cls || [];
                setClasses(classesData);
                console.log('✓ Classes:', classesData.length);
            } catch (e) {
                console.warn('⚠️ Classes error:', e);
            }

            // Fetch fees
            let feesData: any[] = [];
            try {
                const { data: feesRaw, error: feesError } = await supabase
                    .from('fees')
                    .select('id, class_id, amount, due_date, late_fee, is_active, description')
                    .eq('school_id', schoolId)
                    .eq('is_active', true)
                    .order('class_id');
                if (feesError) throw feesError;

                // Merge with class names
                feesData = (feesRaw || []).map(f => ({
                    ...f,
                    class_name: classesData.find(c => c.id === f.class_id)?.name || 'Unknown',
                }));
                setFees(feesData);
                console.log('✓ Fees:', feesData.length);
            } catch (e) {
                console.warn('⚠️ Fees error:', e);
            }

            console.log('========================================');
            console.log('📊 Fee settings loaded');
            console.log('========================================');
        } catch (err) {
            console.error('Error fetching data:', err);
            setError('Failed to load fee settings');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (fee?: FeeRecord) => {
        if (fee) {
            setEditingId(fee.id);
            setFormData({
                classId: fee.class_id,
                amount: fee.amount.toString(),
                dueDate: fee.due_date || '',
                lateFee: fee.late_fee.toString(),
                description: fee.description || '',
            });
        } else {
            setEditingId(null);
            setFormData({
                classId: '',
                amount: '',
                dueDate: '',
                lateFee: '0',
                description: '',
            });
        }
        setError('');
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingId(null);
    };

    const handleSave = async () => {
        setError('');

        // Validation
        if (!formData.classId || !formData.amount) {
            setError('Please fill in all required fields');
            return;
        }

        if (isNaN(Number(formData.amount)) || Number(formData.amount) <= 0) {
            setError('Amount must be a positive number');
            return;
        }

        setSaving(true);

        try {
            if (editingId) {
                // Update existing fee
                const { error: updateError } = await supabase
                    .from('fees')
                    .update({
                        amount: Number(formData.amount),
                        due_date: formData.dueDate || null,
                        late_fee: Number(formData.lateFee) || 0,
                        description: formData.description,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', editingId);

                if (updateError) throw updateError;
                setSuccess('Fee updated successfully');
                console.log('✓ Fee updated:', editingId);
            } else {
                // Create new fee
                const { error: insertError } = await supabase
                    .from('fees')
                    .insert({
                        school_id: schoolId,
                        class_id: formData.classId,
                        amount: Number(formData.amount),
                        due_date: formData.dueDate || null,
                        late_fee: Number(formData.lateFee) || 0,
                        description: formData.description,
                        is_active: true,
                        currency: 'NGN',
                    });

                if (insertError) throw insertError;
                setSuccess('Fee created successfully');
                console.log('✓ Fee created for class:', formData.classId);
            }

            // Refresh data
            await fetchData();
            handleCloseModal();

            // Clear success message after 3 seconds
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            console.error('Error saving fee:', err);
            setError('Failed to save fee. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (feeId: string) => {
        if (!confirm('Are you sure you want to delete this fee?')) return;

        try {
            const { error: deleteError } = await supabase
                .from('fees')
                .update({ is_active: false })
                .eq('id', feeId);

            if (deleteError) throw deleteError;
            setSuccess('Fee deleted successfully');
            console.log('✓ Fee deleted:', feeId);

            // Refresh data
            await fetchData();

            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            console.error('Error deleting fee:', err);
            setError('Failed to delete fee');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center space-y-4">
                    <Loader className="w-8 h-8 animate-spin mx-auto" />
                    <p className="text-secondary-text">Loading fee settings...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Fee Settings</h1>
                    <p className="text-secondary-text">Configure fees for each class</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="btn-primary flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    Add Fee
                </button>
            </div>

            {error && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="card bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900"
                >
                    <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <p className="text-red-800 dark:text-red-200">{error}</p>
                    </div>
                </motion.div>
            )}

            {success && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="card bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900"
                >
                    <div className="flex items-start gap-3">
                        <DollarSign className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <p className="text-green-800 dark:text-green-200">{success}</p>
                    </div>
                </motion.div>
            )}

            {/* Fees Table */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="card"
            >
                {fees.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="table-header">
                                    <th className="px-4 py-3 text-left rounded-l-lg">Class</th>
                                    <th className="px-4 py-3 text-right">Amount</th>
                                    <th className="px-4 py-3 text-left">Due Date</th>
                                    <th className="px-4 py-3 text-right">Late Fee</th>
                                    <th className="px-4 py-3 text-left">Description</th>
                                    <th className="px-4 py-3 text-left rounded-r-lg">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {fees.map(fee => (
                                    <tr key={fee.id} className="table-row">
                                        <td className="px-4 py-3 font-medium">{fee.class_name}</td>
                                        <td className="px-4 py-3 text-right font-semibold">NGN {fee.amount.toLocaleString()}</td>
                                        <td className="px-4 py-3 text-sm">{fee.due_date || '-'}</td>
                                        <td className="px-4 py-3 text-right">NGN {fee.late_fee.toLocaleString()}</td>
                                        <td className="px-4 py-3 text-sm text-secondary-text">{fee.description || '-'}</td>
                                        <td className="px-4 py-3 flex gap-2">
                                            <button
                                                onClick={() => handleOpenModal(fee)}
                                                className="p-2 hover:bg-secondary-bg rounded-lg transition-colors"
                                                title="Edit"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(fee.id)}
                                                className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors text-red-600"
                                                title="Delete"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center py-12">
                        <DollarSign className="w-12 h-12 text-secondary-text mx-auto mb-3 opacity-50" />
                        <p className="text-secondary-text">No fees configured yet</p>
                        <p className="text-sm text-secondary-text mt-1">Click "Add Fee" to get started</p>
                    </div>
                )}
            </motion.div>

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full max-w-md bg-white dark:bg-dark-bg rounded-2xl shadow-xl"
                    >
                        <div className="p-6 border-b border-border dark:border-gray-800">
                            <h2 className="text-xl font-bold">
                                {editingId ? 'Edit Fee' : 'Add New Fee'}
                            </h2>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="label mb-1.5 block">Class *</label>
                                <select
                                    value={formData.classId}
                                    onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                                    className="input-field"
                                    disabled={editingId !== null}
                                >
                                    <option value="">Select a class</option>
                                    {classes.map(cls => (
                                        <option key={cls.id} value={cls.id}>{cls.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="label mb-1.5 block">Amount (NGN) *</label>
                                <input
                                    type="number"
                                    value={formData.amount}
                                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                    className="input-field"
                                    placeholder="0.00"
                                    min="0"
                                    step="100"
                                />
                            </div>

                            <div>
                                <label className="label mb-1.5 block">Due Date</label>
                                <input
                                    type="date"
                                    value={formData.dueDate}
                                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                                    className="input-field"
                                />
                            </div>

                            <div>
                                <label className="label mb-1.5 block">Late Fee (NGN)</label>
                                <input
                                    type="number"
                                    value={formData.lateFee}
                                    onChange={(e) => setFormData({ ...formData, lateFee: e.target.value })}
                                    className="input-field"
                                    placeholder="0.00"
                                    min="0"
                                    step="100"
                                />
                            </div>

                            <div>
                                <label className="label mb-1.5 block">Description</label>
                                <input
                                    type="text"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="input-field"
                                    placeholder="e.g., Tuition fee for 2024/2025"
                                />
                            </div>
                        </div>

                        <div className="p-6 border-t border-border dark:border-gray-800 flex justify-end gap-3">
                            <button
                                onClick={handleCloseModal}
                                disabled={saving}
                                className="btn-secondary disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="btn-primary disabled:opacity-50 flex items-center gap-2"
                            >
                                {saving ? (
                                    <>
                                        <Loader className="w-4 h-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    'Save Fee'
                                )}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
