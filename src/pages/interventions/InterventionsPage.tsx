import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Calendar, User, CheckCircle, Clock, AlertTriangle, MessageSquare, Loader } from 'lucide-react';
import { useAppStore } from '@/store';
import { interventionService } from '@/services/interventionService';
import { supabase } from '@/lib/supabase';
import { getInitialsFromName } from '@/utils/displayUtils';

interface InterventionData {
  id: string;
  student: string;
  class: string;
  type: string;
  status: string;
  priority: string;
  counselor: string;
  startDate: string;
  progress: number;
}

interface StudentOption {
  id: string;
  name: string;
  class: string;
}

const INTERVENTION_TYPES = [
  'Academic Support',
  'Attendance Monitoring',
  'Behaviour Support',
  'Counseling',
] as const;

export default function InterventionsPage() {
  const { user } = useAppStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showAddModal, setShowAddModal] = useState(false);
  const [interventionType, setInterventionType] = useState<string>(INTERVENTION_TYPES[0]);
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [description, setDescription] = useState('');
  const [notifyParent, setNotifyParent] = useState(true);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');
  const [interventions, setInterventions] = useState<InterventionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [allStudents, setAllStudents] = useState<StudentOption[]>([]);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<StudentOption | null>(null);
  const [filteredStudents, setFilteredStudents] = useState<StudentOption[]>([]);
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);
  const [stats, setStats] = useState({
    open: 0,
    inProgress: 0,
    completed: 0,
    escalated: 0,
  });

  useEffect(() => {
    if (user?.id && user?.schoolId) {
      fetchInterventionsData();
      loadAllStudents();
    }
  }, [user?.id, user?.schoolId]);

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setShowAddModal(true);
      const studentId = searchParams.get('studentId');
      if (studentId && allStudents.length > 0) {
        const match = allStudents.find((s) => s.id === studentId);
        if (match) {
          setSelectedStudent(match);
          setStudentSearchQuery(match.name);
        }
      }
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, allStudents, setSearchParams]);

  const loadAllStudents = async () => {
    try {
      console.log('[INTERVENTIONS] Loading all students for school:', user!.schoolId);

      // Get all students
      const { data: students } = await supabase
        .from('students')
        .select('id, first_name, last_name, class_id')
        .eq('school_id', user!.schoolId)
        .order('first_name');

      if (students && students.length > 0) {
        // Get all classes
        const { data: classes } = await supabase
          .from('classes')
          .select('id, name')
          .eq('school_id', user!.schoolId);

        const classMap = new Map(classes?.map((c) => [c.id, c.name]) || []);

        // Map students with class names
        const studentOptions: StudentOption[] = students.map(s => ({
          id: s.id,
          name: `${s.first_name} ${s.last_name}`,
          class: classMap.get(s.class_id) || 'N/A',
        }));

        setAllStudents(studentOptions);
        setFilteredStudents(studentOptions);
        console.log('[INTERVENTIONS] Students loaded:', studentOptions.length);
      }
    } catch (error) {
      console.error('[INTERVENTIONS] Error loading students:', error);
    }
  };

  const handleStudentSearch = (query: string) => {
    setStudentSearchQuery(query);
    if (query.trim() === '') {
      setFilteredStudents(allStudents);
    } else {
      const filtered = allStudents.filter(student =>
        student.name.toLowerCase().includes(query.toLowerCase()) ||
        student.class.toLowerCase().includes(query.toLowerCase())
      );
      setFilteredStudents(filtered);
    }
  };

  const handleSelectStudent = (student: StudentOption) => {
    setSelectedStudent(student);
    setStudentSearchQuery(student.name);
    setShowStudentDropdown(false);
  };

  const fetchInterventionsData = async () => {
    try {
      setIsLoading(true);

      // Get all students in the school (counselor has access to all)
      const { data: allCases } = await supabase
        .from('intervention_cases')
        .select('*')
        .eq('school_id', user!.schoolId)
        .order('created_at', { ascending: false });

      if (!allCases) {
        setInterventions([]);
        setStats({ open: 0, inProgress: 0, completed: 0, escalated: 0 });
        return;
      }

      // Fetch student and counselor details for each case
      const casesWithDetails = await Promise.all(
        allCases.map(async (caseItem) => {
          try {
            // Get student info
            const { data: student } = await supabase
              .from('students')
              .select('first_name, last_name, class_id')
              .eq('id', caseItem.student_id)
              .eq('school_id', user!.schoolId)
              .single();

            // Get class info
            let className = 'N/A';
            if (student?.class_id) {
              const { data: classData } = await supabase
                .from('classes')
                .select('name')
                .eq('id', student.class_id)
                .eq('school_id', user!.schoolId)
                .single();
              className = classData?.name || 'N/A';
            }

            // Get counselor info (assigned_to_id is auth.users id)
            const { data: counselor } = await supabase
              .from('staff')
              .select('full_name')
              .eq('school_id', user!.schoolId)
              .eq('user_id', caseItem.assigned_to_id)
              .maybeSingle();

            // Calculate progress (based on activities)
            const { data: activities } = await supabase
              .from('intervention_activities')
              .select('id')
              .eq('case_id', caseItem.id);

            const progress = activities?.length ? Math.min(((activities.length) / 5) * 100, 100) : 0;

            // Get start date
            const startDate = new Date(caseItem.created_at).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            });

            return {
              id: caseItem.id,
              student: student ? `${student.first_name} ${student.last_name}` : 'Unknown',
              class: className,
              type: caseItem.case_category.replace('_intervention', '').replace('_', ' ').toUpperCase(),
              status: caseItem.status,
              priority: caseItem.priority,
              counselor: counselor?.full_name ?? 'Unassigned',
              startDate,
              progress: Math.round(progress)
            };
          } catch (error) {
            console.error('Error fetching case details:', error);
            return null;
          }
        })
      );

      const validCases = casesWithDetails.filter((c): c is InterventionData => c !== null);
      setInterventions(validCases);

      // Calculate stats
      const openCount = validCases.filter(c => c.status === 'open').length;
      const inProgressCount = validCases.filter(c => c.status === 'in_progress').length;
      const completedCount = validCases.filter(c => c.status === 'completed').length;
      const escalatedCount = validCases.filter(c => c.status === 'escalated').length;

      setStats({
        open: openCount,
        inProgress: inProgressCount,
        completed: completedCount,
        escalated: escalatedCount,
      });
    } catch (error) {
      console.error('Error fetching interventions:', error);
      setInterventions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const resetModal = () => {
    setShowAddModal(false);
    setSelectedStudent(null);
    setStudentSearchQuery('');
    setShowStudentDropdown(false);
    setInterventionType(INTERVENTION_TYPES[0]);
    setPriority('medium');
    setDescription('');
    setNotifyParent(true);
    setFormError('');
  };

  const handleCreateIntervention = async () => {
    if (!selectedStudent || !user?.schoolId || !user?.id) return;

    setCreating(true);
    setFormError('');

    const mappedPriority =
      priority === 'critical' ? 'critical' : priority;

    const result = await interventionService.createManualIntervention(
      user.schoolId,
      selectedStudent.id,
      user.id,
      {
        category: interventionService.uiTypeToCategory(interventionType),
        priority: mappedPriority,
        description,
        notifyParent,
      }
    );

    setCreating(false);

    if (result.success) {
      resetModal();
      fetchInterventionsData();
    } else {
      setFormError(result.error || 'Failed to create intervention');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open': return 'badge-info';
      case 'in_progress': return 'badge-warning';
      case 'completed': return 'badge-success';
      default: return 'badge-info';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Interventions</h1>
          <p className="text-secondary-text">Manage student intervention plans</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New Intervention
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-900/30">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="stat-value text-xl">{stats.open}</p>
              <p className="text-xs text-secondary-text">Open</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-yellow-100 dark:bg-yellow-900/30">
              <User className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="stat-value text-xl">{stats.inProgress}</p>
              <p className="text-xs text-secondary-text">In Progress</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-green-100 dark:bg-green-900/30">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="stat-value text-xl">{stats.completed}</p>
              <p className="text-xs text-secondary-text">Completed</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-100 dark:bg-red-900/30">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="stat-value text-xl">{stats.escalated}</p>
              <p className="text-xs text-secondary-text">Escalated</p>
            </div>
          </div>
        </div>
      </div>

      {/* Interventions List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-current flex items-center gap-2">
              <Loader className="w-4 h-4" />
            </div>
          </div>
        ) : interventions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-secondary-text">No intervention cases found</p>
          </div>
        ) : (
          interventions.map((intervention, index) => (
            <motion.div
              key={intervention.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="card"
            >
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-secondary-bg dark:bg-dark-card flex items-center justify-center font-bold">
                    {getInitialsFromName(intervention.student)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{intervention.student}</h3>
                      <span className="text-xs text-secondary-text">{intervention.class}</span>
                    </div>
                    <p className="text-sm font-medium">{intervention.type}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-secondary-text">
                      <span>Counselor: {intervention.counselor}</span>
                      <span>Started: {intervention.startDate}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`badge ${intervention.priority === 'high' ? 'badge-danger' : intervention.priority === 'medium' ? 'badge-warning' : 'badge-info'}`}>
                    {intervention.priority}
                  </span>
                  <span className={`badge ${getStatusBadge(intervention.status)}`}>
                    {intervention.status.replace('_', ' ')}
                  </span>
                </div>
              </div>

              {/* Progress */}
              <div className="mt-4 pt-4 border-t border-border dark:border-gray-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-secondary-text">Progress</span>
                  <span className="text-sm font-medium">{intervention.progress}%</span>
                </div>
                <div className="h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${intervention.progress === 100 ? 'bg-green-500' : 'bg-black dark:bg-white'
                      }`}
                    style={{ width: `${intervention.progress}%` }}
                  />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button className="flex items-center gap-1 text-sm text-secondary-text hover:text-black dark:hover:text-white">
                    <MessageSquare className="w-4 h-4" />
                    Notes
                  </button>
                  <button className="flex items-center gap-1 text-sm text-secondary-text hover:text-black dark:hover:text-white">
                    <Calendar className="w-4 h-4" />
                    Schedule
                  </button>
                </div>
                <button className="btn-secondary text-sm py-1.5">View Details</button>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-xl bg-white dark:bg-dark-bg rounded-2xl shadow-xl"
          >
            <div className="p-6 border-b border-border dark:border-gray-800">
              <h2 className="text-xl font-bold">Create Intervention</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label mb-1.5 block">Student</label>
                <div className="relative">
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Search student by name or class..."
                    value={studentSearchQuery}
                    onChange={(e) => {
                      handleStudentSearch(e.target.value);
                      setShowStudentDropdown(true);
                    }}
                    onFocus={() => {
                      setShowStudentDropdown(true);
                      if (!studentSearchQuery && allStudents.length > 0) {
                        setFilteredStudents(allStudents);
                      }
                    }}
                  />
                  {showStudentDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-border dark:border-gray-700 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                      {filteredStudents.length === 0 ? (
                        <div className="p-3 text-sm text-secondary-text text-center">
                          No students found
                        </div>
                      ) : (
                        filteredStudents.map((student) => (
                          <button
                            key={student.id}
                            onClick={() => handleSelectStudent(student)}
                            className="w-full text-left px-4 py-3 hover:bg-secondary-bg dark:hover:bg-gray-700 border-b border-border dark:border-gray-700 last:border-b-0 transition-colors"
                          >
                            <div>
                              <p className="font-medium text-sm">{student.name}</p>
                              <p className="text-xs text-secondary-text">{student.class}</p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
                {selectedStudent && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">✓ {selectedStudent.name} selected</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label mb-1.5 block">Intervention Type</label>
                  <select
                    className="input-field"
                    value={interventionType}
                    onChange={(e) => setInterventionType(e.target.value)}
                  >
                    {INTERVENTION_TYPES.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label mb-1.5 block">Priority</label>
                  <select
                    className="input-field"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as typeof priority)}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Urgent</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label mb-1.5 block">Description</label>
                <textarea
                  className="input-field min-h-24"
                  placeholder="Intervention plan details..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div>
                <label className="label mb-1.5 block">Notify Parent</label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-border"
                    checked={notifyParent}
                    onChange={(e) => setNotifyParent(e.target.checked)}
                  />
                  <span className="text-sm">Send notification to parent</span>
                </label>
              </div>
              {formError && (
                <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>
              )}
            </div>
            <div className="p-6 border-t border-border dark:border-gray-800 flex justify-end gap-3">
              <button onClick={resetModal} className="btn-secondary">Cancel</button>
              <button
                onClick={handleCreateIntervention}
                className="btn-primary"
                disabled={!selectedStudent || creating}
              >
                {creating ? 'Creating...' : 'Create Intervention'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
