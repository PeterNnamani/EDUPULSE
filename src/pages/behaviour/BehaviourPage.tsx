import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Plus, TrendingUp, TrendingDown, AlertTriangle, Award, Search, Filter, Loader, X, ChevronDown, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store';
import { recordBehaviour } from '@/services/behaviourService';

interface BehaviourRecord {
  id: string;
  student_id: string;
  student_name: string;
  class_name: string;
  behaviour_type: 'merit' | 'demerit' | 'warning' | 'commendation' | 'suspension' | 'expulsion';
  category: string;
  description: string;
  points: number;
  date: string;
}

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  student_id: string;
  class_id: string;
  class_name?: string;
}

export default function BehaviourPage() {
  const { user } = useAppStore();
  const studentPickerRef = useRef<HTMLDivElement>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [records, setRecords] = useState<BehaviourRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<BehaviourRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');

  // Modal form states
  const [userClassId, setUserClassId] = useState<string>('');
  const [userClassName, setUserClassName] = useState<string>('');
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentSearchOpen, setStudentSearchOpen] = useState(false);
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [behaviorType, setBehaviorType] = useState('merit');
  const [category, setCategory] = useState('Class Participation');
  const [description, setDescription] = useState('');
  const [points, setPoints] = useState('');
  const [savingRecord, setSavingRecord] = useState(false);
  const [saveError, setSaveError] = useState<string>('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [stats, setStats] = useState({
    merits: 0,
    demerits: 0,
    commendations: 0,
    warnings: 0,
  });

  // Fetch behaviour records from database
  useEffect(() => {
    fetchBehaviourRecords();
  }, []);

  // Handle clicking outside student picker
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (studentPickerRef.current && !studentPickerRef.current.contains(event.target as Node)) {
        setStudentSearchOpen(false);
      }
    };

    if (studentSearchOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [studentSearchOpen]);

  const fetchUserClassAndStudents = async () => {
    try {
      if (!user?.schoolId || !user?.id) {
        console.error('Missing schoolId or userId');
        return;
      }

      // Fetch the class where this teacher is the class teacher
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select(`
          id,
          name
        `)
        .eq('school_id', user.schoolId)
        .eq('class_teacher_id', user.id)
        .maybeSingle();

      if (classError) {
        console.error('Error fetching class:', classError);
        throw classError;
      }

      if (!classData) {
        console.error('No class assigned to this teacher');
        setUserClassName('No class assigned');
        setStudents([]);
        return;
      }

      const classId = classData.id;
      const className = classData.name || 'Unknown';
      console.log(`✓ Class loaded: "${className}" (ID: ${classId})`);
      setUserClassId(classId);
      setUserClassName(className);

      // Now fetch students from that class
      setLoadingStudents(true);
      console.log(`📚 Fetching students for class "${classId}" in school "${user.schoolId}"`);

      // First, try to get ALL students in the school to verify data exists
      const { data: allStudents, error: allError } = await supabase
        .from('students')
        .select('id, first_name, student_id, class_id')
        .eq('school_id', user.schoolId)
        .limit(5);

      if (allError) {
        console.error('Error fetching all students:', allError);
      } else {
        console.log(`📊 Total students in school: ${allStudents?.length || 0}`, allStudents?.map(s => ({ name: s.first_name, studentId: s.student_id, classId: s.class_id })));
      }

      // Now fetch students for the specific class
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select(`
          id,
          first_name,
          last_name,
          student_id,
          class_id,
          classes(name)
        `)
        .eq('school_id', user.schoolId)
        .eq('class_id', classId)
        .order('first_name', { ascending: true });

      console.log(`📋 Students query result - Error: ${studentError ? 'YES' : 'NO'}, Count: ${studentData?.length || 0}`);

      if (studentError) {
        console.error('❌ Error fetching students:', studentError);
        throw studentError;
      }

      if (!studentData || studentData.length === 0) {
        console.warn(`⚠️  No students found for class ID "${classId}". Check if:
          1. Students exist in this class (class_id = "${classId}")
          2. class_id values in students table match exactly`);
      }

      const transformedStudents: Student[] = (studentData || []).map((student: any) => ({
        id: student.id,
        first_name: student.first_name,
        last_name: student.last_name,
        student_id: student.student_id,
        class_id: student.class_id,
        class_name: student.classes?.name || 'Unknown',
      }));

      console.log(`✅ Transformed ${transformedStudents.length} students for display`);
      setStudents(transformedStudents);
    } catch (err: any) {
      console.error('❌ Error fetching user class and students:', err);
      setStudents([]);
    } finally {
      setLoadingStudents(false);
    }
  };

  const openAddModal = () => {
    setShowAddModal(true);
    setSelectedStudent(null);
    setStudentSearchTerm('');
    setBehaviorType('merit');
    setCategory('Class Participation');
    setDescription('');
    setPoints('');
    setSaveError('');
    setSaveSuccess(false);
    // Fetch user's class and students
    fetchUserClassAndStudents();
  };

  const closeAddModal = () => {
    setShowAddModal(false);
    setStudentSearchOpen(false);
    setSelectedStudent(null);
    // Reset form
    setDescription('');
    setPoints('');
    setSaveError('');
    setSaveSuccess(false);
  };

  const handleSaveBehaviourRecord = async () => {
    if (!selectedStudent || !user?.schoolId || !user?.id) {
      setSaveError('Missing required information');
      return;
    }

    if (!description.trim()) {
      setSaveError('Description is required');
      return;
    }

    setSavingRecord(true);
    setSaveError('');

    try {
      const pointsValue = points ? parseInt(points) : undefined;

      const result = await recordBehaviour(
        user.schoolId,
        selectedStudent.id,
        selectedStudent.class_id,
        behaviorType as 'merit' | 'demerit' | 'warning' | 'commendation' | 'suspension' | 'expulsion',
        description,
        category,
        pointsValue,
        undefined,
        user.id
      );

      if (result.success) {
        setSaveSuccess(true);
        console.log('✅ Behaviour record saved successfully');

        // Refresh the behaviour records list
        await fetchBehaviourRecords();

        // Close modal after 1.5 seconds to show success message
        setTimeout(() => {
          closeAddModal();
        }, 1500);
      } else {
        setSaveError(result.error || 'Failed to save behaviour record');
      }
    } catch (err: any) {
      console.error('Error saving behaviour record:', err);
      setSaveError(err.message || 'Failed to save behaviour record');
    } finally {
      setSavingRecord(false);
    }
  };

  const filteredStudents = students.filter((student) =>
    `${student.first_name} ${student.last_name}`.toLowerCase().includes(studentSearchTerm.toLowerCase()) ||
    student.student_id.toLowerCase().includes(studentSearchTerm.toLowerCase())
  );

  const fetchBehaviourRecords = async () => {
    try {
      setLoading(true);
      setError('');

      if (!user?.schoolId) {
        setError('School ID not found');
        return;
      }

      // Fetch behaviour records with student and class info
      const { data, error: fetchError } = await supabase
        .from('behaviour_records')
        .select(`
          id,
          student_id,
          class_id,
          behaviour_type,
          category,
          description,
          points,
          date,
          students(first_name, last_name),
          classes(name)
        `)
        .eq('school_id', user.schoolId)
        .order('date', { ascending: false });

      if (fetchError) throw fetchError;

      // Transform data
      const transformedRecords: BehaviourRecord[] = (data || []).map((record: any) => ({
        id: record.id,
        student_id: record.student_id,
        student_name: `${record.students?.first_name || ''} ${record.students?.last_name || ''}`.trim() || 'Unknown',
        class_name: record.classes?.name || 'Unknown',
        behaviour_type: record.behaviour_type,
        category: record.category || 'General',
        description: record.description,
        points: record.points || 0,
        date: new Date(record.date).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
      }));

      setRecords(transformedRecords);
      applyFilters(transformedRecords, '', '');
      calculateStats(transformedRecords);
    } catch (err: any) {
      console.error('Error fetching behaviour records:', err);
      setError(err.message || 'Failed to load behaviour records');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (recordsToCalc: BehaviourRecord[]) => {
    const newStats = {
      merits: recordsToCalc.filter((r) => r.behaviour_type === 'merit').length,
      demerits: recordsToCalc.filter((r) => r.behaviour_type === 'demerit').length,
      commendations: recordsToCalc.filter((r) => r.behaviour_type === 'commendation').length,
      warnings: recordsToCalc.filter((r) => r.behaviour_type === 'warning').length,
    };
    setStats(newStats);
  };

  const applyFilters = (recordsToFilter: BehaviourRecord[], search: string, type: string) => {
    let filtered = recordsToFilter;

    if (search.trim()) {
      filtered = filtered.filter((r) =>
        r.student_name.toLowerCase().includes(search.toLowerCase()) ||
        r.class_name.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (type) {
      filtered = filtered.filter((r) => r.behaviour_type === type);
    }

    setFilteredRecords(filtered);
  };

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    applyFilters(records, value, filterType);
  };

  const handleFilterType = (value: string) => {
    setFilterType(value);
    applyFilters(records, searchTerm, value);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Behaviour Records</h1>
          <p className="text-secondary-text">Track merits, demerits, and behaviour incidents</p>
        </div>
        <button onClick={openAddModal} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Record
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-green-100 dark:bg-green-900/30">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="stat-value text-xl">{stats.merits}</p>
              <p className="text-xs text-secondary-text">Merits</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-100 dark:bg-red-900/30">
              <TrendingDown className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="stat-value text-xl">{stats.demerits}</p>
              <p className="text-xs text-secondary-text">Demerits</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-yellow-100 dark:bg-yellow-900/30">
              <Award className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="stat-value text-xl">{stats.commendations}</p>
              <p className="text-xs text-secondary-text">Commendations</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-orange-100 dark:bg-orange-900/30">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="stat-value text-xl">{stats.warnings}</p>
              <p className="text-xs text-secondary-text">Warnings</p>
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
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
          <select
            className="input-field w-full md:w-40"
            value={filterType}
            onChange={(e) => handleFilterType(e.target.value)}
          >
            <option value="">All Types</option>
            <option value="merit">Merits</option>
            <option value="demerit">Demerits</option>
            <option value="warning">Warnings</option>
            <option value="commendation">Commendations</option>
          </select>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="card flex items-center justify-center py-12">
          <div className="text-center">
            <Loader className="animate-spin mx-auto mb-3 w-8 h-8 text-blue-600" />
            <p className="text-secondary-text">Loading behaviour records...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="card bg-red-50 border-l-4 border-red-500 p-4">
          <p className="text-red-700 font-medium">Error: {error}</p>
        </div>
      )}

      {/* Records List */}
      {!loading && !error && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
        >
          {filteredRecords.length === 0 ? (
            <div className="py-12 text-center">
              <AlertTriangle className="mx-auto mb-3 w-8 h-8 text-gray-400" />
              <p className="text-secondary-text">
                {searchTerm || filterType ? 'No records match your filters' : 'No behaviour records found'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="table-header">
                    <th className="px-4 py-3 text-left rounded-l-lg">Date</th>
                    <th className="px-4 py-3 text-left">Student</th>
                    <th className="px-4 py-3 text-left">Type</th>
                    <th className="px-4 py-3 text-left">Category</th>
                    <th className="px-4 py-3 text-left">Description</th>
                    <th className="px-4 py-3 text-center">Points</th>
                    <th className="px-4 py-3 text-left rounded-r-lg">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((record) => (
                    <tr key={record.id} className="table-row">
                      <td className="px-4 py-3 text-sm">{record.date}</td>
                      <td className="px-4 py-3">
                        <span className="font-medium">{record.student_name}</span>
                        <span className="text-xs text-secondary-text ml-2">{record.class_name}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`badge ${record.behaviour_type === 'merit' ? 'badge-success' :
                          record.behaviour_type === 'commendation' ? 'bg-yellow-100 text-yellow-800' :
                            record.behaviour_type === 'warning' ? 'badge-warning' :
                              record.behaviour_type === 'demerit' ? 'badge-danger' :
                                'badge-secondary'
                          }`}>
                          {record.behaviour_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">{record.category}</td>
                      <td className="px-4 py-3 text-sm max-w-xs truncate">{record.description}</td>
                      <td className="px-4 py-3 text-center font-medium">
                        <span className={record.points > 0 ? 'text-green-600' : record.points < 0 ? 'text-red-600' : 'text-gray-600'}>
                          {record.points > 0 ? '+' : ''}{record.points}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button className="text-sm text-black dark:text-white hover:underline">View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-xl bg-white dark:bg-dark-bg rounded-2xl shadow-xl"
          >
            <div className="p-6 border-b border-border dark:border-gray-800">
              <h2 className="text-xl font-bold">Add Behaviour Record</h2>
            </div>

            {/* Error Message */}
            {saveError && (
              <div className="m-6 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-red-700 dark:text-red-200 text-sm">{saveError}</p>
              </div>
            )}

            {/* Success Message */}
            {saveSuccess && (
              <div className="m-6 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-green-700 dark:text-green-200 text-sm">✓ Behaviour record saved successfully!</p>
              </div>
            )}
            <div className="p-6 space-y-4">
              {/* Class Display */}
              <div>
                <label className="label mb-1.5 block">Class</label>
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="font-medium text-blue-900 dark:text-blue-200">{userClassName || 'Loading...'}</p>
                </div>
              </div>

              {/* Student Picker */}
              <div ref={studentPickerRef} className="relative">
                <label className="label mb-1.5 block">Student</label>
                <button
                  onClick={() => setStudentSearchOpen(!studentSearchOpen)}
                  className="w-full input-field flex items-center justify-between p-3"
                >
                  {selectedStudent ? (
                    <div className="flex items-center gap-3 flex-1 text-left">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <span className="text-xs font-bold text-blue-600">
                          {selectedStudent.first_name[0]}{selectedStudent.last_name[0]}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {selectedStudent.first_name} {selectedStudent.last_name}
                        </p>
                        <p className="text-xs text-secondary-text truncate">
                          {selectedStudent.class_name} • {selectedStudent.student_id}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <span className="text-secondary-text">Select a student...</span>
                  )}
                  <ChevronDown className={`w-4 h-4 text-secondary-text flex-shrink-0 transition-transform ${studentSearchOpen ? 'rotate-180' : ''
                    }`} />
                </button>

                {/* Dropdown List */}
                {studentSearchOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-dark-bg border border-border dark:border-gray-700 rounded-lg shadow-lg z-10"
                  >
                    {/* Search Input */}
                    <div className="p-2 border-b border-border dark:border-gray-700">
                      <input
                        type="text"
                        placeholder="Search by name or student ID..."
                        className="input-field text-sm"
                        value={studentSearchTerm}
                        onChange={(e) => setStudentSearchTerm(e.target.value)}
                        autoFocus
                      />
                    </div>

                    {/* Student List */}
                    <div className="max-h-60 overflow-y-auto">
                      {loadingStudents ? (
                        <div className="p-4 text-center">
                          <Loader className="animate-spin mx-auto w-5 h-5 text-blue-600" />
                          <p className="text-xs text-secondary-text mt-2">Loading students...</p>
                        </div>
                      ) : students.length === 0 ? (
                        <div className="p-4 text-center text-secondary-text text-sm">
                          No students found
                        </div>
                      ) : filteredStudents.length === 0 ? (
                        <div className="p-4 text-center text-secondary-text text-sm">
                          No students match your search
                        </div>
                      ) : (
                        filteredStudents.map((student) => (
                          <button
                            key={student.id}
                            onClick={() => {
                              setSelectedStudent(student);
                              setStudentSearchOpen(false);
                              setStudentSearchTerm('');
                            }}
                            className="w-full px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 flex items-center gap-3 text-left transition-colors border-b border-border dark:border-gray-700 last:border-0"
                          >
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                              <span className="text-xs font-bold text-blue-600">
                                {student.first_name[0]}{student.last_name[0]}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">
                                {student.first_name} {student.last_name}
                              </p>
                              <p className="text-xs text-secondary-text truncate">
                                {student.class_name} • {student.student_id}
                              </p>
                            </div>
                            {selectedStudent?.id === student.id && (
                              <div className="w-4 h-4 rounded-full bg-blue-600" />
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label mb-1.5 block">Type</label>
                  <select
                    className="input-field"
                    value={behaviorType}
                    onChange={(e) => setBehaviorType(e.target.value)}
                  >
                    <option value="merit">Merit</option>
                    <option value="demerit">Demerit</option>
                    <option value="warning">Warning</option>
                    <option value="commendation">Commendation</option>
                  </select>
                </div>
                <div>
                  <label className="label mb-1.5 block">Category</label>
                  <select
                    className="input-field"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option>Class Participation</option>
                    <option>Discipline</option>
                    <option>Academic Excellence</option>
                    <option>Attendance</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label mb-1.5 block">Description</label>
                <textarea
                  className="input-field min-h-24"
                  placeholder="Details of the incident..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div>
                <label className="label mb-1.5 block">Points</label>
                <input
                  type="number"
                  className="input-field"
                  placeholder="Positive or negative points"
                  value={points}
                  onChange={(e) => setPoints(e.target.value)}
                />
              </div>
            </div>
            <div className="p-6 border-t border-border dark:border-gray-800 flex justify-end gap-3">
              <button onClick={closeAddModal} className="btn-secondary" disabled={savingRecord}>Cancel</button>
              <button
                onClick={handleSaveBehaviourRecord}
                className={`btn-primary flex items-center gap-2 ${!selectedStudent || savingRecord ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={!selectedStudent || savingRecord}
              >
                {savingRecord ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : saveSuccess ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Saved!
                  </>
                ) : (
                  'Save Record'
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
