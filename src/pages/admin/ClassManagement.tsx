import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Users, Edit2, Trash2, DollarSign } from 'lucide-react';
import { useAppStore } from '@/store';
import { supabase } from '@/lib/supabase';
import { createClass, getClasses, updateClass, deleteClass } from '@/services/classService';

interface ClassForm {
  name: string;
  gradeLevel: string;
  section: string;
  capacity: string;
  fee: string;
}

interface EditingClass {
  id: string;
  name: string;
  gradeLevel: string;
  section: string;
  capacity: number;
  fee: number;
}

export default function ClassManagement() {
  const { user } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingClass, setEditingClass] = useState<EditingClass | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [formData, setFormData] = useState<ClassForm>({
    name: '',
    gradeLevel: '',
    section: '',
    capacity: '40',
    fee: '0',
  });

  const gradeLevels = ['Creche', 'Playgroup', 'Nursery 1', 'Nursery 2', 'Nursery 3', 'Kindergarten', 'Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6', 'JSS1', 'JSS2', 'JSS3', 'SS1', 'SS2', 'SS3'];

  const earlyYearsLevels = ['Creche', 'Playgroup', 'Nursery 1', 'Nursery 2', 'Nursery 3', 'Kindergarten'];
  const isEarlyYearsLevel = (level: string) =>
    earlyYearsLevels.some((l) => level.toLowerCase().includes(l.toLowerCase())) ||
    /creche|playgroup|nursery|kindergarten|\bkg\b|^pre/i.test(level);
  const sections = ['A', 'B', 'C', 'D', 'E'];

  // Load classes on mount
  useEffect(() => {
    if (user?.schoolId) {
      loadClasses();
    }
  }, [user?.schoolId]);

  const loadClasses = async () => {
    if (!user?.schoolId) return;

    setLoading(true);
    try {
      const classesData = await getClasses(user.schoolId);

      // Fetch fees for each class
      const classesWithFees = await Promise.all(
        classesData.map(async (cls: any) => {
          const { data: feeData } = await supabase
            .from('fees')
            .select('amount')
            .eq('class_id', cls.id)
            .eq('is_active', true)
            .maybeSingle();

          return {
            ...cls,
            fee: Number(feeData?.amount ?? 0),
          };
        })
      );

      setClasses(classesWithFees);
    } catch (error) {
      console.error('Error loading classes:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      gradeLevel: '',
      section: '',
      capacity: '40',
      fee: '0',
    });
  };

  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.schoolId) return;

    setLoading(true);
    try {
      // Generate class name from grade level and section
      const className = `${formData.gradeLevel.split(' ')[formData.gradeLevel.split(' ').length - 1]}${formData.section}`;

      const result = await createClass({
        schoolId: user.schoolId,
        name: className,
        gradeLevel: formData.gradeLevel,
        section: formData.section,
        capacity: parseInt(formData.capacity) || 40,
      });

      if (result.success) {
        const classId = result.classId ?? result.data?.id;
        const feeAmount = parseFloat(formData.fee) || 0;

        // Flag early-years classes for rating-based assessment.
        if (classId && isEarlyYearsLevel(formData.gradeLevel)) {
          await supabase
            .from('classes')
            .update({ is_early_years: true })
            .eq('id', classId);
        }

        // Create fee record for this class
        if (feeAmount > 0 && classId) {
          const { error: feeError } = await supabase
            .from('fees')
            .insert({
              school_id: user.schoolId,
              class_id: classId,
              amount: feeAmount,
              currency: 'NGN',
              is_active: true,
            });

          if (feeError) {
            console.warn('Warning: Class created but fee could not be saved:', feeError);
            alert(`Class created, but the fee could not be saved: ${feeError.message}`);
          }
        }

        setSuccessMessage(
          feeAmount > 0
            ? `Class ${className} created with fee NGN ${feeAmount.toLocaleString()}!`
            : `Class ${className} created successfully!`
        );
        setShowSuccessModal(true);
        setShowAddModal(false);
        resetForm();
        await loadClasses();
      } else {
        alert(result.error || 'Failed to create class');
      }
    } catch (error) {
      console.error('Error creating class:', error);
      alert('Error creating class. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClass) return;

    setLoading(true);
    try {
      const result = await updateClass(editingClass.id, {
        name: editingClass.name,
        gradeLevel: editingClass.gradeLevel,
        section: editingClass.section,
        capacity: editingClass.capacity,
      });

      if (result.success) {
        // Keep early-years flag in sync with the grade level.
        await supabase
          .from('classes')
          .update({ is_early_years: isEarlyYearsLevel(editingClass.gradeLevel) })
          .eq('id', editingClass.id);

        // Update or create fee record for this class
        if (editingClass.fee > 0) {
          // Check if fee exists
          const { data: existingFee } = await supabase
            .from('fees')
            .select('id')
            .eq('class_id', editingClass.id)
            .eq('is_active', true)
            .single();

          if (existingFee) {
            // Update existing fee
            const { error: feeError } = await supabase
              .from('fees')
              .update({ amount: editingClass.fee, updated_at: new Date().toISOString() })
              .eq('id', existingFee.id);

            if (feeError) {
              console.warn('Warning: Fee not updated:', feeError);
            } else {
              console.log('✓ Fee updated for class');
            }
          } else {
            // Create new fee
            const { error: feeError } = await supabase
              .from('fees')
              .insert({
                school_id: user?.schoolId,
                class_id: editingClass.id,
                amount: editingClass.fee,
                currency: 'NGN',
                is_active: true,
              });

            if (feeError) {
              console.warn('Warning: Fee could not be saved:', feeError);
            } else {
              console.log('✓ Fee created for class');
            }
          }
        }

        setSuccessMessage('Class updated successfully!');
        setShowSuccessModal(true);
        setShowEditModal(false);
        setEditingClass(null);
        await loadClasses();
      } else {
        alert(result.error || 'Failed to update class');
      }
    } catch (error) {
      console.error('Error updating class:', error);
      alert('Error updating class. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClass = async (classId: string) => {
    if (!confirm('Are you sure you want to delete this class? This action cannot be undone.')) {
      return;
    }

    setLoading(true);
    try {
      const result = await deleteClass(classId);

      if (result.success) {
        setSuccessMessage('Class deleted successfully!');
        setShowSuccessModal(true);
        await loadClasses();
      } else {
        alert(result.error || 'Failed to delete class');
      }
    } catch (error) {
      console.error('Error deleting class:', error);
      alert('Error deleting class. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = async (cls: any) => {
    // Fetch fee for this class
    let classFee = 0;
    try {
      const { data: feeData } = await supabase
        .from('fees')
        .select('amount')
        .eq('class_id', cls.id)
        .eq('is_active', true)
        .maybeSingle();

      if (feeData) {
        classFee = Number(feeData.amount);
      }
    } catch (e) {
      console.warn('Could not fetch fee for class:', e);
    }

    setEditingClass({
      id: cls.id,
      name: cls.name,
      gradeLevel: cls.grade_level,
      section: cls.section,
      capacity: cls.capacity,
      fee: classFee,
    });
    setShowEditModal(true);
  };

  const filteredClasses = classes.filter((cls) =>
    `${cls.name} ${cls.grade_level}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Classes</h1>
          <p className="text-secondary-text">Manage class divisions and assignments</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Class
        </button>
      </div>

      <div className="card">
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-text" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field pl-10"
            placeholder="Search classes..."
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClasses.map((cls, index) => (
            <motion.div
              key={cls.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="card-hover"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold">{cls.name}</h3>
                  <p className="text-sm text-secondary-text">{cls.grade_level} - Section {cls.section}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEditModal(cls)} className="p-2 rounded-lg hover:bg-secondary-bg dark:hover:bg-dark-card transition-colors">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDeleteClass(cls.id)} className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-secondary-text">Students</span>
                  <span className="font-medium">{cls.students}/{cls.capacity}</span>
                </div>
                <div className="h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-black dark:bg-white rounded-full"
                    style={{ width: `${cls.capacity > 0 ? (cls.students / cls.capacity) * 100 : 0}%` }}
                  />
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-border dark:border-gray-800">
                  <DollarSign className={`w-4 h-4 ${cls.fee > 0 ? 'text-green-600 dark:text-green-400' : 'text-secondary-text'}`} />
                  <span className="text-sm text-secondary-text">Fee:</span>
                  <span className={`font-medium ${cls.fee > 0 ? 'text-green-600 dark:text-green-400' : 'text-secondary-text'}`}>
                    {cls.fee > 0 ? `NGN ${cls.fee.toLocaleString()}` : 'Not set'}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {filteredClasses.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-secondary-text mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No classes found</h3>
            <p className="text-secondary-text">Create your first class to get started.</p>
          </div>
        )}
      </div>

      {/* Add Class Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-white dark:bg-dark-bg rounded-2xl shadow-xl overflow-hidden"
          >
            <div className="p-6 border-b border-border dark:border-gray-800">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Add New Class</h2>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-2 rounded-lg hover:bg-secondary-bg dark:hover:bg-dark-card"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <form onSubmit={handleAddClass} className="p-6 space-y-4">
              <div>
                <label className="label mb-1.5 block">Grade Level *</label>
                <select
                  required
                  value={formData.gradeLevel}
                  onChange={(e) => setFormData({ ...formData, gradeLevel: e.target.value })}
                  className="input-field"
                >
                  <option value="">Select grade level</option>
                  {gradeLevels.map((level) => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label mb-1.5 block">Section *</label>
                <select
                  required
                  value={formData.section}
                  onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                  className="input-field"
                >
                  <option value="">Select section</option>
                  {sections.map((section) => (
                    <option key={section} value={section}>{section}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label mb-1.5 block">Capacity (Students)</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                  className="input-field"
                  placeholder="40"
                />
              </div>

              <div>
                <label className="label mb-1.5 block">Class Fee (NGN)</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-text" />
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={formData.fee}
                    onChange={(e) => setFormData({ ...formData, fee: e.target.value })}
                    className="input-field pl-10"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="border-t border-border dark:border-gray-800 pt-6 flex items-center justify-end gap-3">
                <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="btn-primary">
                  {loading ? 'Creating...' : 'Create Class'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Edit Class Modal */}
      {showEditModal && editingClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-white dark:bg-dark-bg rounded-2xl shadow-xl overflow-hidden"
          >
            <div className="p-6 border-b border-border dark:border-gray-800">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Edit Class</h2>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="p-2 rounded-lg hover:bg-secondary-bg dark:hover:bg-dark-card"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <form onSubmit={handleEditClass} className="p-6 space-y-4">
              <div>
                <label className="label mb-1.5 block">Grade Level</label>
                <select
                  value={editingClass.gradeLevel}
                  onChange={(e) => setEditingClass({ ...editingClass, gradeLevel: e.target.value })}
                  className="input-field"
                >
                  {gradeLevels.map((level) => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label mb-1.5 block">Section</label>
                <select
                  value={editingClass.section}
                  onChange={(e) => setEditingClass({ ...editingClass, section: e.target.value })}
                  className="input-field"
                >
                  {sections.map((section) => (
                    <option key={section} value={section}>{section}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label mb-1.5 block">Capacity (Students)</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={editingClass.capacity}
                  onChange={(e) => setEditingClass({ ...editingClass, capacity: parseInt(e.target.value) })}
                  className="input-field"
                />
              </div>

              <div>
                <label className="label mb-1.5 block">Class Fee (NGN)</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-text" />
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={editingClass.fee}
                    onChange={(e) => setEditingClass({ ...editingClass, fee: parseFloat(e.target.value) })}
                    className="input-field pl-10"
                  />
                </div>
              </div>

              <div className="border-t border-border dark:border-gray-800 pt-6 flex items-center justify-end gap-3">
                <button type="button" onClick={() => setShowEditModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="btn-primary">
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-white dark:bg-dark-bg rounded-2xl shadow-xl overflow-hidden"
          >
            <div className="p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-bold mb-2">Success!</h2>
              <p className="text-secondary-text mb-6">{successMessage}</p>
              <button
                onClick={() => setShowSuccessModal(false)}
                className="w-full btn-primary"
              >
                Done
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
