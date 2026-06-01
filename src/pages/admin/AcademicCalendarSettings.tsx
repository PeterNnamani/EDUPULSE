import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Edit2, Trash2, Calendar, AlertCircle, Loader, Check, Zap } from 'lucide-react';
import { useAppStore } from '@/store';
import { supabase } from '@/lib/supabase';
import {
    getAllSessions,
    getTermsForSession,
    createSession,
    createTerm,
    setCurrentSession,
    setCurrentTerm,
} from '@/utils/calendarUtils';
import { setupStandardNigerianCalendar, getAcademicYear } from '@/utils/standardCalendarSetup';

interface AcademicSession {
    id: string;
    name: string;
    start_date: string;
    end_date: string;
    is_current: boolean;
}

interface AcademicTerm {
    id: string;
    session_id: string;
    name: string;
    term_number: number;
    start_date: string;
    end_date: string;
    is_current: boolean;
}

export default function AcademicCalendarSettings() {
    const { user } = useAppStore();
    const [sessions, setSessions] = useState<AcademicSession[]>([]);
    const [terms, setTerms] = useState<AcademicTerm[]>([]);
    const [selectedSession, setSelectedSession] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string>('');
    const [success, setSuccess] = useState<string>('');
    const [showSetupModal, setShowSetupModal] = useState(false);
    const [setupYear, setSetupYear] = useState<number>(getAcademicYear());

    // Session form
    const [showSessionModal, setShowSessionModal] = useState(false);
    const [sessionForm, setSessionForm] = useState({
        name: '',
        startDate: '',
        endDate: '',
    });

    // Term form
    const [showTermModal, setShowTermModal] = useState(false);
    const [termForm, setTermForm] = useState({
        name: '',
        termNumber: 1,
        startDate: '',
        endDate: '',
    });

    useEffect(() => {
        loadSessions();
    }, [user?.schoolId]);

    useEffect(() => {
        if (selectedSession) {
            loadTerms(selectedSession);
        }
    }, [selectedSession]);

    const loadSessions = async () => {
        if (!user?.schoolId) return;

        try {
            setLoading(true);
            const sessionsData = await getAllSessions(user.schoolId);
            setSessions(sessionsData);

            if (sessionsData.length > 0) {
                setSelectedSession(sessionsData[0].id);
            }
        } catch (err) {
            console.error('Error loading sessions:', err);
            setError('Failed to load academic sessions');
        } finally {
            setLoading(false);
        }
    };

    const loadTerms = async (sessionId: string) => {
        try {
            const termsData = await getTermsForSession(sessionId);
            setTerms(termsData);
        } catch (err) {
            console.error('Error loading terms:', err);
            setError('Failed to load academic terms');
        }
    };

    const handleCreateSession = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.schoolId) return;

        if (!sessionForm.name || !sessionForm.startDate || !sessionForm.endDate) {
            setError('Please fill in all required fields');
            return;
        }

        setSaving(true);
        try {
            const result = await createSession(
                user.schoolId,
                sessionForm.name,
                sessionForm.startDate,
                sessionForm.endDate,
                false
            );

            if (result.success) {
                setSuccess('Academic session created successfully');
                setShowSessionModal(false);
                setSessionForm({ name: '', startDate: '', endDate: '' });
                await loadSessions();
            } else {
                setError(result.error || 'Failed to create session');
            }
        } catch (err) {
            setError('Error creating session');
        } finally {
            setSaving(false);
        }
    };

    const handleCreateTerm = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.schoolId || !selectedSession) return;

        if (!termForm.name || !termForm.startDate || !termForm.endDate) {
            setError('Please fill in all required fields');
            return;
        }

        setSaving(true);
        try {
            const result = await createTerm(
                user.schoolId,
                selectedSession,
                termForm.name,
                termForm.termNumber,
                termForm.startDate,
                termForm.endDate,
                false
            );

            if (result.success) {
                setSuccess('Academic term created successfully');
                setShowTermModal(false);
                setTermForm({ name: '', termNumber: 1, startDate: '', endDate: '' });
                await loadTerms(selectedSession);
            } else {
                setError(result.error || 'Failed to create term');
            }
        } catch (err) {
            setError('Error creating term');
        } finally {
            setSaving(false);
        }
    };

    const handleSetCurrentSession = async (sessionId: string) => {
        if (!user?.schoolId) return;

        try {
            const success = await setCurrentSession(user.schoolId, sessionId);
            if (success) {
                setSuccess('Session set as current');
                await loadSessions();
            } else {
                setError('Failed to set current session');
            }
        } catch (err) {
            setError('Error setting current session');
        }
    };

    const handleSetCurrentTerm = async (termId: string) => {
        if (!user?.schoolId) return;

        try {
            const success = await setCurrentTerm(user.schoolId, termId);
            if (success) {
                setSuccess('Term set as current');
                await loadTerms(selectedSession);
            } else {
                setError('Failed to set current term');
            }
        } catch (err) {
            setError('Error setting current term');
        }
    };

    const handleDeleteSession = async (sessionId: string) => {
        if (!confirm('Are you sure? This will also delete all terms in this session.')) return;

        try {
            const { error } = await supabase
                .from('academic_sessions')
                .delete()
                .eq('id', sessionId);

            if (error) throw error;
            setSuccess('Session deleted');
            await loadSessions();
        } catch (err) {
            setError('Failed to delete session');
        }
    };

    const handleDeleteTerm = async (termId: string) => {
        if (!confirm('Are you sure you want to delete this term?')) return;

        try {
            const { error } = await supabase
                .from('academic_terms')
                .delete()
                .eq('id', termId);

            if (error) throw error;
            setSuccess('Term deleted');
            await loadTerms(selectedSession);
        } catch (err) {
            setError('Failed to delete term');
        }
    };

    const handleSetupStandardCalendar = async () => {
        if (!user?.schoolId) return;

        setSaving(true);
        setError('');
        try {
            const result = await setupStandardNigerianCalendar(
                user.schoolId,
                setupYear,
                true
            );

            if (result.success) {
                setSuccess(`✅ Standard Nigerian calendar setup for ${setupYear}/${setupYear + 1}!`);
                setShowSetupModal(false);
                await loadSessions();
            } else {
                setError(result.error || 'Failed to setup calendar');
            }
        } catch (err) {
            setError('Error setting up calendar');
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader className="w-8 h-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Academic Calendar</h1>
                    <p className="text-secondary-text">Manage academic sessions and terms</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setShowSetupModal(true)}
                        className="btn-secondary flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        <Zap className="w-4 h-4" />
                        Setup Standard Calendar
                    </button>
                    <button
                        onClick={() => setShowSessionModal(true)}
                        className="btn-primary flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        New Session
                    </button>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg flex gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="font-medium text-red-800 dark:text-red-200">{error}</p>
                    </div>
                </div>
            )}

            {success && (
                <div className="p-4 bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg flex gap-3">
                    <Check className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="font-medium text-green-800 dark:text-green-200">{success}</p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Sessions List */}
                <div className="lg:col-span-1">
                    <div className="card space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold">Academic Sessions</h2>
                            <Calendar className="w-5 h-5 text-secondary-text" />
                        </div>

                        <div className="space-y-2">
                            {sessions.map((session) => (
                                <motion.button
                                    key={session.id}
                                    onClick={() => setSelectedSession(session.id)}
                                    className={`w-full p-3 text-left rounded-lg transition-colors ${selectedSession === session.id
                                        ? 'bg-black dark:bg-white text-white dark:text-black'
                                        : 'hover:bg-secondary-bg dark:hover:bg-dark-card'
                                        }`}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="font-medium">{session.name}</p>
                                            <p className="text-xs text-secondary-text">
                                                {new Date(session.start_date).getFullYear()} -{' '}
                                                {new Date(session.end_date).getFullYear()}
                                            </p>
                                        </div>
                                        {session.is_current && (
                                            <Check className="w-4 h-4 text-green-600" />
                                        )}
                                    </div>
                                </motion.button>
                            ))}

                            {sessions.length === 0 && (
                                <p className="text-sm text-secondary-text text-center py-4">
                                    No sessions created yet
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Terms List */}
                <div className="lg:col-span-2">
                    <div className="card space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-semibold">
                                    Terms {selectedSession && `(${sessions.find(s => s.id === selectedSession)?.name})`}
                                </h2>
                                <p className="text-sm text-secondary-text">
                                    Click a term to set as current
                                </p>
                            </div>
                            <button
                                onClick={() => setShowTermModal(true)}
                                disabled={!selectedSession}
                                className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Plus className="w-4 h-4" />
                                New Term
                            </button>
                        </div>

                        <div className="space-y-3">
                            {terms.map((term) => (
                                <motion.div
                                    key={term.id}
                                    className={`p-4 rounded-lg border ${term.is_current
                                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                                        : 'border-border dark:border-gray-800'
                                        }`}
                                    whileHover={{ scale: 1.01 }}
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1">
                                            <p className="font-medium">{term.name}</p>
                                            <p className="text-sm text-secondary-text">
                                                {new Date(term.start_date).toLocaleDateString()} -{' '}
                                                {new Date(term.end_date).toLocaleDateString()}
                                            </p>
                                        </div>
                                        {term.is_current && (
                                            <span className="px-2 py-1 text-xs font-semibold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 rounded">
                                                Current
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex gap-2">
                                        {!term.is_current && (
                                            <button
                                                onClick={() => handleSetCurrentTerm(term.id)}
                                                className="flex-1 px-3 py-2 text-sm bg-black dark:bg-white text-white dark:text-black rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
                                            >
                                                Set as Current
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleDeleteTerm(term.id)}
                                            className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </motion.div>
                            ))}

                            {terms.length === 0 && (
                                <p className="text-sm text-secondary-text text-center py-6">
                                    {selectedSession ? 'No terms created for this session' : 'Select a session to view terms'}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Session Modal */}
            {showSessionModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full max-w-md bg-white dark:bg-dark-bg rounded-2xl shadow-xl"
                    >
                        <div className="p-6 border-b border-border dark:border-gray-800">
                            <h2 className="text-xl font-bold">Create Academic Session</h2>
                        </div>

                        <form onSubmit={handleCreateSession} className="p-6 space-y-4">
                            <div>
                                <label className="label mb-1.5 block">Session Name *</label>
                                <input
                                    type="text"
                                    placeholder="e.g., 2024/2025"
                                    value={sessionForm.name}
                                    onChange={(e) => setSessionForm({ ...sessionForm, name: e.target.value })}
                                    className="input-field"
                                    required
                                />
                            </div>

                            <div>
                                <label className="label mb-1.5 block">Start Date *</label>
                                <input
                                    type="date"
                                    value={sessionForm.startDate}
                                    onChange={(e) => setSessionForm({ ...sessionForm, startDate: e.target.value })}
                                    className="input-field"
                                    required
                                />
                            </div>

                            <div>
                                <label className="label mb-1.5 block">End Date *</label>
                                <input
                                    type="date"
                                    value={sessionForm.endDate}
                                    onChange={(e) => setSessionForm({ ...sessionForm, endDate: e.target.value })}
                                    className="input-field"
                                    required
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowSessionModal(false)}
                                    className="btn-secondary flex-1"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="btn-primary flex-1"
                                >
                                    {saving ? 'Creating...' : 'Create Session'}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}

            {/* Term Modal */}
            {showTermModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full max-w-md bg-white dark:bg-dark-bg rounded-2xl shadow-xl"
                    >
                        <div className="p-6 border-b border-border dark:border-gray-800">
                            <h2 className="text-xl font-bold">Create Academic Term</h2>
                        </div>

                        <form onSubmit={handleCreateTerm} className="p-6 space-y-4">
                            <div>
                                <label className="label mb-1.5 block">Term Name *</label>
                                <input
                                    type="text"
                                    placeholder="e.g., Term 1"
                                    value={termForm.name}
                                    onChange={(e) => setTermForm({ ...termForm, name: e.target.value })}
                                    className="input-field"
                                    required
                                />
                            </div>

                            <div>
                                <label className="label mb-1.5 block">Term Number *</label>
                                <select
                                    value={termForm.termNumber}
                                    onChange={(e) => setTermForm({ ...termForm, termNumber: parseInt(e.target.value) })}
                                    className="input-field"
                                    required
                                >
                                    <option value={1}>1</option>
                                    <option value={2}>2</option>
                                    <option value={3}>3</option>
                                </select>
                            </div>

                            <div>
                                <label className="label mb-1.5 block">Start Date *</label>
                                <input
                                    type="date"
                                    value={termForm.startDate}
                                    onChange={(e) => setTermForm({ ...termForm, startDate: e.target.value })}
                                    className="input-field"
                                    required
                                />
                            </div>

                            <div>
                                <label className="label mb-1.5 block">End Date *</label>
                                <input
                                    type="date"
                                    value={termForm.endDate}
                                    onChange={(e) => setTermForm({ ...termForm, endDate: e.target.value })}
                                    className="input-field"
                                    required
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowTermModal(false)}
                                    className="btn-secondary flex-1"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="btn-primary flex-1"
                                >
                                    {saving ? 'Creating...' : 'Create Term'}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}

            {/* Setup Standard Calendar Modal */}
            {showSetupModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full max-w-md bg-white dark:bg-dark-bg rounded-2xl shadow-xl"
                    >
                        <div className="p-6 border-b border-border dark:border-gray-800">
                            <h2 className="text-xl font-bold">Setup Standard Nigerian Calendar</h2>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <p className="text-sm text-secondary-text mb-3">
                                    This will automatically create the standard Nigerian academic calendar with:
                                </p>
                                <ul className="text-sm space-y-1 text-secondary-text">
                                    <li>✓ First Term: September - December</li>
                                    <li>✓ Second Term: January - March</li>
                                    <li>✓ Third Term: April - July</li>
                                </ul>
                            </div>

                            <div>
                                <label className="label mb-1.5 block">Academic Year Start *</label>
                                <select
                                    value={setupYear}
                                    onChange={(e) => setSetupYear(parseInt(e.target.value))}
                                    className="input-field"
                                >
                                    {Array.from({ length: 5 }, (_, i) => {
                                        const year = new Date().getFullYear() - 2 + i;
                                        return (
                                            <option key={year} value={year}>
                                                {year}/{year + 1}
                                            </option>
                                        );
                                    })}
                                </select>
                                <p className="text-xs text-secondary-text mt-1">
                                    Session will be: {setupYear}/{setupYear + 1}
                                </p>
                            </div>

                            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                                <p className="text-sm text-blue-800 dark:text-blue-300">
                                    ℹ️ Any existing sessions for this year will be reused. New terms will be created if they don't exist.
                                </p>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowSetupModal(false)}
                                    className="btn-secondary flex-1"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSetupStandardCalendar}
                                    disabled={saving}
                                    className="btn-primary flex-1 flex items-center justify-center gap-2"
                                >
                                    <Zap className="w-4 h-4" />
                                    {saving ? 'Setting up...' : 'Setup Now'}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
