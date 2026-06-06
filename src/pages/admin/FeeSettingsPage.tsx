import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Edit2, Trash2, DollarSign, AlertCircle, Loader, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store';
import { feeAssignmentService } from '@/services/feeAssignmentService';

interface FeeStructureRow {
    id: string;
    class_id: string;
    class_name: string;
    fee_type_id: string | null;
    fee_type_name: string;
    amount: number;
    due_month: number | null;
    due_date: number | null;
    description?: string;
    is_active: boolean;
}

interface FeeForm {
    classIds: string[];
    feeTypeId: string;
    amount: string;
    dueMonth: string;
    dueDate: string;
    description: string;
}

export default function FeeSettingsPage() {
    const { user } = useAppStore();
    const schoolId = user?.schoolId;

    const [structures, setStructures] = useState<FeeStructureRow[]>([]);
    const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);
    const [feeTypes, setFeeTypes] = useState<Array<{ id: string; name: string }>>([]);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [assigning, setAssigning] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [formData, setFormData] = useState<FeeForm>({
        classIds: [],
        feeTypeId: '',
        amount: '',
        dueMonth: '',
        dueDate: '',
        description: '',
    });

    useEffect(() => {
        if (schoolId) fetchData();
        else setLoading(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [schoolId]);

    const fetchData = async () => {
        if (!schoolId) return;
        try {
            setLoading(true);
            setError('');

            const session = await feeAssignmentService.getCurrentSession(schoolId);
            setSessionId(session?.id ?? null);

            const [{ data: cls }, { data: ft }] = await Promise.all([
                supabase.from('classes').select('id, name').eq('school_id', schoolId).order('name'),
                supabase.from('fee_types').select('id, name').eq('school_id', schoolId).order('name'),
            ]);
            const classesData = cls ?? [];
            const feeTypesData = ft ?? [];
            setClasses(classesData);
            setFeeTypes(feeTypesData);

            const { data: structRaw } = await supabase
                .from('fee_structures')
                .select('id, class_id, fee_type_id, amount, due_month, due_date, description, is_active')
                .eq('school_id', schoolId)
                .eq('is_active', true)
                .order('class_id');

            const classMap = new Map(classesData.map((c) => [c.id, c.name]));
            const ftMap = new Map(feeTypesData.map((t) => [t.id, t.name]));

            setStructures(
                (structRaw ?? []).map((s) => ({
                    id: s.id,
                    class_id: s.class_id,
                    class_name: classMap.get(s.class_id) ?? 'Unknown',
                    fee_type_id: s.fee_type_id,
                    fee_type_name: s.fee_type_id ? ftMap.get(s.fee_type_id) ?? 'Fee' : 'General',
                    amount: Number(s.amount) || 0,
                    due_month: s.due_month,
                    due_date: s.due_date,
                    description: s.description,
                    is_active: s.is_active,
                }))
            );
        } catch (err) {
            console.error('Error fetching fee structures:', err);
            setError('Failed to load fee settings');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (row?: FeeStructureRow) => {
        if (row) {
            setEditingId(row.id);
            setFormData({
                classIds: [row.class_id],
                feeTypeId: row.fee_type_id ?? '',
                amount: row.amount.toString(),
                dueMonth: row.due_month?.toString() ?? '',
                dueDate: row.due_date?.toString() ?? '',
                description: row.description ?? '',
            });
        } else {
            setEditingId(null);
            setFormData({ classIds: [], feeTypeId: '', amount: '', dueMonth: '', dueDate: '', description: '' });
        }
        setError('');
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingId(null);
    };

    const toggleClassSelection = (classId: string) => {
        setFormData((prev) => {
            const selected = prev.classIds.includes(classId)
                ? prev.classIds.filter((id) => id !== classId)
                : [...prev.classIds, classId];
            return { ...prev, classIds: selected };
        });
    };

    const handleSave = async () => {
        setError('');
        if (!formData.classIds.length || !formData.amount) {
            setError('Please select at least one class and enter an amount');
            return;
        }
        if (isNaN(Number(formData.amount)) || Number(formData.amount) <= 0) {
            setError('Amount must be a positive number');
            return;
        }

        setSaving(true);
        try {
            const basePayload = {
                school_id: schoolId,
                session_id: sessionId,
                fee_type_id: formData.feeTypeId || null,
                amount: Number(formData.amount),
                due_month: formData.dueMonth ? Number(formData.dueMonth) : null,
                due_date: formData.dueDate ? Number(formData.dueDate) : null,
                description: formData.description || null,
                is_active: true,
                updated_at: new Date().toISOString(),
            };

            if (editingId) {
                const { error: updErr } = await supabase
                    .from('fee_structures')
                    .update({ ...basePayload, class_id: formData.classIds[0] })
                    .eq('id', editingId);
                if (updErr) throw updErr;
                setSuccess('Fee structure updated');
            } else {
                const rows = formData.classIds.map((classId) => ({
                    ...basePayload,
                    class_id: classId,
                }));
                const { error: insErr } = await supabase.from('fee_structures').insert(rows);
                if (insErr) throw insErr;
                setSuccess(
                    rows.length === 1
                        ? 'Fee structure created'
                        : `Fee applied to ${rows.length} classes`
                );
            }

            if (schoolId) {
                const { auditService } = await import('@/services/auditService');
                void auditService.logAudit({
                    schoolId,
                    userId: user?.id ?? null,
                    userType: 'staff',
                    action: 'fee_structure_changed',
                    entityType: 'fee_structure',
                    entityId: editingId ?? formData.classIds.join(','),
                    newValues: { ...basePayload, classIds: formData.classIds },
                });
            }

            await fetchData();
            handleCloseModal();
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            console.error('Error saving fee structure:', err);
            setError('Failed to save fee structure');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this fee structure?')) return;
        try {
            const { error: delErr } = await supabase
                .from('fee_structures')
                .update({ is_active: false })
                .eq('id', id);
            if (delErr) throw delErr;
            setSuccess('Fee structure removed');
            await fetchData();
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            console.error('Error deleting fee structure:', err);
            setError('Failed to delete fee structure');
        }
    };

    // Assign all active fee structures to all active students in their classes.
    const handleAssignToStudents = async () => {
        if (!schoolId) return;
        if (!confirm('Generate invoices for all active students based on their class fees?')) return;
        setAssigning(true);
        setError('');
        try {
            const { data: students } = await supabase
                .from('students')
                .select('id, class_id')
                .eq('school_id', schoolId)
                .eq('status', 'active');

            let total = 0;
            for (const s of students ?? []) {
                if (!s.class_id) continue;
                const res = await feeAssignmentService.assignFeesForStudent(
                    schoolId,
                    s.id,
                    s.class_id,
                    'manual'
                );
                total += res.created;
            }
            setSuccess(`Generated ${total} fee obligation(s) across students`);
            setTimeout(() => setSuccess(''), 4000);
        } catch (err) {
            console.error('Error assigning fees:', err);
            setError('Failed to assign fees to students');
        } finally {
            setAssigning(false);
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
                    <h1 className="text-2xl font-bold">Fee Structures</h1>
                    <p className="text-secondary-text">Configure multiple fees per class (Tuition, PTA, Transport...)</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleAssignToStudents}
                        disabled={assigning}
                        className="btn-secondary flex items-center gap-2 disabled:opacity-50"
                    >
                        {assigning ? <Loader className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                        Generate Invoices
                    </button>
                    <button onClick={() => handleOpenModal()} className="btn-primary flex items-center gap-2">
                        <Plus className="w-4 h-4" />
                        Add Fee
                    </button>
                </div>
            </div>

            {error && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="card bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <p className="text-red-800 dark:text-red-200">{error}</p>
                    </div>
                </motion.div>
            )}

            {success && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="card bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900">
                    <div className="flex items-start gap-3">
                        <DollarSign className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <p className="text-green-800 dark:text-green-200">{success}</p>
                    </div>
                </motion.div>
            )}

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card">
                {structures.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="table-header">
                                    <th className="px-4 py-3 text-left rounded-l-lg">Class</th>
                                    <th className="px-4 py-3 text-left">Fee Type</th>
                                    <th className="px-4 py-3 text-right">Amount</th>
                                    <th className="px-4 py-3 text-left">Description</th>
                                    <th className="px-4 py-3 text-left rounded-r-lg">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {structures.map((row) => (
                                    <tr key={row.id} className="table-row">
                                        <td className="px-4 py-3 font-medium">{row.class_name}</td>
                                        <td className="px-4 py-3">{row.fee_type_name}</td>
                                        <td className="px-4 py-3 text-right font-semibold">NGN {row.amount.toLocaleString()}</td>
                                        <td className="px-4 py-3 text-sm text-secondary-text">{row.description || '-'}</td>
                                        <td className="px-4 py-3 flex gap-2">
                                            <button onClick={() => handleOpenModal(row)} className="p-2 hover:bg-secondary-bg rounded-lg transition-colors" title="Edit">
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleDelete(row.id)} className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors text-red-600" title="Delete">
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
                        <p className="text-secondary-text">No fee structures configured yet</p>
                        <p className="text-sm text-secondary-text mt-1">Click "Add Fee" to get started</p>
                    </div>
                )}
            </motion.div>

            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md bg-white dark:bg-dark-bg rounded-2xl shadow-xl">
                        <div className="p-6 border-b border-border dark:border-gray-800">
                            <h2 className="text-xl font-bold">{editingId ? 'Edit Fee Structure' : 'Add Fee Structure'}</h2>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="label mb-1.5 block">
                                    {editingId ? 'Class' : 'Classes *'}
                                </label>
                                {editingId ? (
                                    <select
                                        value={formData.classIds[0] ?? ''}
                                        className="input-field"
                                        disabled
                                    >
                                        {classes.map((cls) => (
                                            <option key={cls.id} value={cls.id}>{cls.name}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <div className="max-h-40 overflow-y-auto border border-border dark:border-gray-700 rounded-lg p-2 space-y-1">
                                        {classes.length === 0 ? (
                                            <p className="text-sm text-secondary-text p-2">No classes found</p>
                                        ) : (
                                            classes.map((cls) => (
                                                <label
                                                    key={cls.id}
                                                    className="flex items-center gap-2 p-2 rounded hover:bg-secondary-bg dark:hover:bg-dark-card cursor-pointer"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.classIds.includes(cls.id)}
                                                        onChange={() => toggleClassSelection(cls.id)}
                                                        className="w-4 h-4 rounded border-border"
                                                    />
                                                    <span className="text-sm">{cls.name}</span>
                                                </label>
                                            ))
                                        )}
                                    </div>
                                )}
                                {!editingId && formData.classIds.length > 0 && (
                                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                                        {formData.classIds.length} class(es) selected
                                    </p>
                                )}
                            </div>
                            <div>
                                <label className="label mb-1.5 block">Fee Type</label>
                                <select
                                    value={formData.feeTypeId}
                                    onChange={(e) => setFormData({ ...formData, feeTypeId: e.target.value })}
                                    className="input-field"
                                >
                                    <option value="">General</option>
                                    {feeTypes.map((t) => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
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
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="label mb-1.5 block">Due Month (1-12)</label>
                                    <input
                                        type="number"
                                        value={formData.dueMonth}
                                        onChange={(e) => setFormData({ ...formData, dueMonth: e.target.value })}
                                        className="input-field"
                                        min="1"
                                        max="12"
                                    />
                                </div>
                                <div>
                                    <label className="label mb-1.5 block">Due Day (1-31)</label>
                                    <input
                                        type="number"
                                        value={formData.dueDate}
                                        onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                                        className="input-field"
                                        min="1"
                                        max="31"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="label mb-1.5 block">Description</label>
                                <input
                                    type="text"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="input-field"
                                    placeholder="e.g., First term tuition"
                                />
                            </div>
                        </div>
                        <div className="p-6 border-t border-border dark:border-gray-800 flex justify-end gap-3">
                            <button onClick={handleCloseModal} disabled={saving} className="btn-secondary disabled:opacity-50">Cancel</button>
                            <button onClick={handleSave} disabled={saving} className="btn-primary disabled:opacity-50 flex items-center gap-2">
                                {saving ? (<><Loader className="w-4 h-4 animate-spin" />Saving...</>) : 'Save Fee'}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
