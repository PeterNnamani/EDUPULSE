import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, AlertTriangle, Award, Search, Filter, Loader, ChevronDown } from 'lucide-react';
import { useAppStore } from '@/store';
import { supabase } from '@/lib/supabase';

interface BehaviourRecord {
    id: string;
    student_id: string;
    student_name: string;
    behaviour_type: 'merit' | 'demerit' | 'warning' | 'commendation' | 'suspension' | 'expulsion';
    category: string;
    description: string;
    points: number;
    date: string;
}

export default function ParentBehaviour() {
    const { user, selectedParentChildId, setSelectedParentChildId } = useAppStore();
    const [records, setRecords] = useState<BehaviourRecord[]>([]);
    const [filteredRecords, setFilteredRecords] = useState<BehaviourRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('');

    const selectedChildData = user?.children?.find((c: any) => c.id === selectedParentChildId);

    const [stats, setStats] = useState({
        merits: 0,
        demerits: 0,
        commendations: 0,
        warnings: 0,
        netPoints: 0,
    });

    // Set default child from store or initialize from first child
    useEffect(() => {
        if (user?.children && user.children.length > 0) {
            if (!selectedParentChildId) {
                setSelectedParentChildId(user.children[0].id);
            }
        }
    }, [user?.children, selectedParentChildId, setSelectedParentChildId]);

    // Fetch behaviour records for selected child
    useEffect(() => {
        if (!selectedParentChildId || !user?.schoolId) return;

        fetchBehaviourRecords();
    }, [selectedParentChildId, user?.schoolId]);

    const fetchBehaviourRecords = async () => {
        if (!selectedParentChildId || !user?.schoolId) return;

        try {
            setLoading(true);

            const { data, error } = await supabase
                .from('behaviour_records')
                .select(`
          id,
          student_id,
          behaviour_type,
          category,
          description,
          points,
          date,
          students(first_name, last_name)
        `)
                .eq('student_id', selectedParentChildId)
                .eq('school_id', user.schoolId)
                .order('date', { ascending: false });

            if (error) {
                console.error('[PARENT_BEHAVIOUR] Error fetching data:', error);
                return;
            }

            const transformedRecords: BehaviourRecord[] = (data || []).map((record: any) => ({
                id: record.id,
                student_id: record.student_id,
                student_name: `${record.students?.first_name || ''} ${record.students?.last_name || ''}`.trim() || 'Unknown',
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
        } catch (error) {
            console.error('[PARENT_BEHAVIOUR] Fetch error:', error);
        } finally {
            setLoading(false);
        }
    };

    const calculateStats = (recordsToCalc: BehaviourRecord[]) => {
        const merits = recordsToCalc.filter((r) => r.behaviour_type === 'merit').length;
        const demerits = recordsToCalc.filter((r) => r.behaviour_type === 'demerit').length;
        const commendations = recordsToCalc.filter((r) => r.behaviour_type === 'commendation').length;
        const warnings = recordsToCalc.filter((r) => r.behaviour_type === 'warning').length;
        const netPoints = recordsToCalc.reduce((sum, r) => sum + r.points, 0);

        setStats({ merits, demerits, commendations, warnings, netPoints });
    };

    const applyFilters = (recordsToFilter: BehaviourRecord[], search: string, type: string) => {
        let filtered = recordsToFilter;

        if (search.trim()) {
            filtered = filtered.filter((r) =>
                r.description.toLowerCase().includes(search.toLowerCase()) ||
                r.category.toLowerCase().includes(search.toLowerCase())
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
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <h1 className="text-3xl font-bold">Behaviour & Conduct</h1>
                <p className="text-secondary-text mt-1">View {selectedChildData?.firstName}'s behaviour records</p>
            </motion.div>

            {/* Child Selector */}
            {user?.children && user.children.length > 1 && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="card"
                >
                    <label className="label mb-2 block">Select Child</label>
                    <select
                        className="input-field"
                        value={selectedParentChildId || ''}
                        onChange={(e) => setSelectedParentChildId(e.target.value)}
                    >
                        {user.children.map((child: any) => (
                            <option key={child.id} value={child.id}>
                                {child.firstName} {child.lastName}
                            </option>
                        ))}
                    </select>
                </motion.div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
                <div className={`card ${stats.netPoints >= 0 ? 'border-l-4 border-green-500' : 'border-l-4 border-red-500'}`}>
                    <div>
                        <p className={`stat-value text-xl ${stats.netPoints >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {stats.netPoints > 0 ? '+' : ''}{stats.netPoints}
                        </p>
                        <p className="text-xs text-secondary-text">Net Points</p>
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
                            placeholder="Search records..."
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

            {/* Records List */}
            {!loading && (
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
                                        <th className="px-4 py-3 text-left">Type</th>
                                        <th className="px-4 py-3 text-left">Category</th>
                                        <th className="px-4 py-3 text-left">Description</th>
                                        <th className="px-4 py-3 text-center rounded-r-lg">Points</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRecords.map((record) => (
                                        <tr key={record.id} className="table-row">
                                            <td className="px-4 py-3 text-sm">{record.date}</td>
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
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </motion.div>
            )}
        </div>
    );
}
