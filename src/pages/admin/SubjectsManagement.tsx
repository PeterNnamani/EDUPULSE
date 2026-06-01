import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Edit2, Trash2, Check, X, AlertCircle, Loader } from 'lucide-react';
import { useAppStore } from '@/store';
import { supabase } from '@/lib/supabase';

interface Subject {
    id: string;
    name: string;
    code: string | null;
    description: string | null;
    is_active: boolean;
}

export default function SubjectsManagement() {
    const user = useAppStore((s) => s.user);
    const [searchQuery, setSearchQuery] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [loading, setLoading] = useState(false);
    const [subjectsList, setSubjectsList] = useState<Subject[]>([]);
    const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
    const [error, setError] = useState<string>('');
    const [successMessage, setSuccessMessage] = useState<string>('');

    const [formData, setFormData] = useState({
        name: '',
        code: '',
        description: '',
    });

    const [editFormData, setEditFormData] = useState({
        name: '',
        code: '',
        description: '',
    });

    // Fetch subjects list
    useEffect(() => {
        if (user?.schoolId) {
            fetchSubjects();
        }
    }, [user?.schoolId]);

    const fetchSubjects = async () => {
        if (!user?.schoolId) return;

        try {
            const { data, error: err } = await supabase
                .from('subjects')
                .select('*')
                .eq('school_id', user.schoolId)
                .eq('is_active', true)
                .order('name');

            if (err) throw err;
            setSubjectsList(data || []);
            setError('');
        } catch (err) {
            console.error('Error fetching subjects:', err);
            setError('Failed to fetch subjects');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.schoolId || !formData.name.trim()) {
            setError('Subject name is required');
            return;
        }

        setLoading(true);
        try {
            const { error: err } = await supabase
                .from('subjects')
                .insert({
                    school_id: user.schoolId,
                    name: formData.name.trim(),
                    code: formData.code?.trim() || null,
                    description: formData.description?.trim() || null,
                    is_active: true,
                });

            if (err) throw err;

            setSuccessMessage('Subject created successfully');
            setFormData({ name: '', code: '', description: '' });
            setShowAddModal(false);
            await fetchSubjects();

            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (err: any) {
            console.error('Error creating subject:', err);
            setError(err.message || 'Failed to create subject');
        } finally {
            setLoading(false);
        }
    };

    const handleEditClick = (subject: Subject) => {
        setEditingSubject(subject);
        setEditFormData({
            name: subject.name,
            code: subject.code || '',
            description: subject.description || '',
        });
        setShowEditModal(true);
    };

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingSubject || !editFormData.name.trim()) {
            setError('Subject name is required');
            return;
        }

        setLoading(true);
        try {
            const { error: err } = await supabase
                .from('subjects')
                .update({
                    name: editFormData.name.trim(),
                    code: editFormData.code?.trim() || null,
                    description: editFormData.description?.trim() || null,
                })
                .eq('id', editingSubject.id);

            if (err) throw err;

            setSuccessMessage('Subject updated successfully');
            setShowEditModal(false);
            setEditingSubject(null);
            await fetchSubjects();

            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (err: any) {
            console.error('Error updating subject:', err);
            setError(err.message || 'Failed to update subject');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this subject?')) return;

        setLoading(true);
        try {
            const { error: err } = await supabase
                .from('subjects')
                .update({ is_active: false })
                .eq('id', id);

            if (err) throw err;

            setSuccessMessage('Subject deleted successfully');
            await fetchSubjects();

            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (err: any) {
            console.error('Error deleting subject:', err);
            setError(err.message || 'Failed to delete subject');
        } finally {
            setLoading(false);
        }
    };

    const filteredSubjects = subjectsList.filter((subject) =>
        `${subject.name} ${subject.code || ''}`.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Subjects Management</h1>
                    <p className="text-secondary-text">Manage school subjects and curriculum</p>
                </div>
                <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Add Subject
                </button>
            </div>

            {/* Messages */}
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

            {successMessage && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="card bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900"
                >
                    <div className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <p className="text-green-800 dark:text-green-200">{successMessage}</p>
                    </div>
                </motion.div>
            )}

            <div className="card">
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-text" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="input-field pl-10"
                            placeholder="Search by name or code..."
                        />
                    </div>
                </div>

                {filteredSubjects.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-secondary-text">No subjects found. Create one to get started.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-border dark:border-gray-800">
                                    <th className="px-4 py-3 text-left text-sm font-semibold">Name</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold">Code</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold">Description</th>
                                    <th className="px-4 py-3 text-right text-sm font-semibold">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredSubjects.map((subject, index) => (
                                    <motion.tr
                                        key={subject.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        className="border-b border-border dark:border-gray-800 hover:bg-secondary-bg dark:hover:bg-dark-card transition-colors"
                                    >
                                        <td className="px-4 py-3 font-semibold">{subject.name}</td>
                                        <td className="px-4 py-3 text-secondary-text font-mono">{subject.code || '-'}</td>
                                        <td className="px-4 py-3 text-secondary-text text-sm max-w-xs truncate">{subject.description || '-'}</td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => handleEditClick(subject)}
                                                    className="p-2 rounded-lg hover:bg-secondary-bg dark:hover:bg-dark-card transition-colors"
                                                    title="Edit"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(subject.id)}
                                                    disabled={loading}
                                                    className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 transition-colors disabled:opacity-50"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </motion.tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Add Subject Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full max-w-md bg-white dark:bg-dark-bg rounded-2xl shadow-xl"
                    >
                        <div className="p-6 border-b border-border dark:border-gray-800">
                            <h2 className="text-xl font-bold">Add New Subject</h2>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="label mb-1.5 block">Subject Name *</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="input-field"
                                    placeholder="e.g., Mathematics"
                                    required
                                />
                            </div>
                            <div>
                                <label className="label mb-1.5 block">Code</label>
                                <input
                                    type="text"
                                    value={formData.code}
                                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                    className="input-field"
                                    placeholder="e.g., MATH101"
                                />
                            </div>
                            <div>
                                <label className="label mb-1.5 block">Description</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="input-field min-h-20 resize-none"
                                    placeholder="Subject description..."
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-4 border-t border-border dark:border-gray-800">
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="btn-secondary"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="btn-primary flex items-center gap-2"
                                >
                                    {loading ? (
                                        <Loader className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Plus className="w-4 h-4" />
                                    )}
                                    {loading ? 'Creating...' : 'Add Subject'}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}

            {/* Edit Subject Modal */}
            {showEditModal && editingSubject && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full max-w-md bg-white dark:bg-dark-bg rounded-2xl shadow-xl"
                    >
                        <div className="p-6 border-b border-border dark:border-gray-800">
                            <h2 className="text-xl font-bold">Edit Subject: {editingSubject.name}</h2>
                        </div>
                        <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="label mb-1.5 block">Subject Name *</label>
                                <input
                                    type="text"
                                    value={editFormData.name}
                                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                                    className="input-field"
                                    placeholder="e.g., Mathematics"
                                    required
                                />
                            </div>
                            <div>
                                <label className="label mb-1.5 block">Code</label>
                                <input
                                    type="text"
                                    value={editFormData.code}
                                    onChange={(e) => setEditFormData({ ...editFormData, code: e.target.value })}
                                    className="input-field"
                                    placeholder="e.g., MATH101"
                                />
                            </div>
                            <div>
                                <label className="label mb-1.5 block">Description</label>
                                <textarea
                                    value={editFormData.description}
                                    onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                                    className="input-field min-h-20 resize-none"
                                    placeholder="Subject description..."
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-4 border-t border-border dark:border-gray-800">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowEditModal(false);
                                        setEditingSubject(null);
                                    }}
                                    className="btn-secondary"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="btn-primary"
                                >
                                    {loading ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
