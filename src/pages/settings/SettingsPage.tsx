import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Moon, Sun, Save, Loader2, Eye, Link as LinkIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppStore } from '@/store';
import { getRoleSettingsConfig } from '@/config/roleSettingsConfig';
import {
  fetchSchoolProfile,
  updateSchoolProfile,
  fetchStaffProfile,
  type SchoolProfile,
} from '@/services/schoolSettingsService';
import {
  loadUserPreferences,
  saveUserPreferences,
  getNotificationItemsForRole,
  type UserPreferences,
} from '@/services/userPreferencesService';

function ReadOnlyField({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <label className="label mb-1.5 block">{label}</label>
      <div className="input-field bg-secondary-bg/50 dark:bg-dark-card/50 text-secondary-text cursor-default">
        {value || '—'}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { darkMode, toggleDarkMode, user } = useAppStore();
  const role = user?.role ?? 'admin';
  const config = getRoleSettingsConfig(role);
  const [activeTab, setActiveTab] = useState(config.tabs[0]?.id ?? 'appearance');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [profile, setProfile] = useState<SchoolProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [staffProfile, setStaffProfile] = useState<{
    staffId: string;
    fullName: string;
    role: string;
    email: string | null;
    phone: string | null;
  } | null>(null);
  const [form, setForm] = useState<Partial<SchoolProfile>>({});
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);

  useEffect(() => {
    if (!user?.schoolId) {
      setProfileLoading(false);
      return;
    }

    const needsSchool = config.tabs.some((t) => t.id === 'school');
    if (needsSchool) {
      fetchSchoolProfile(user.schoolId).then((p) => {
        setProfile(p);
        if (p) setForm(p);
        setProfileLoading(false);
      });
    } else {
      setProfileLoading(false);
    }

    if (user.id && config.tabs.some((t) => t.id === 'profile')) {
      if (role === 'parent') {
        setStaffProfile({
          staffId: '—',
          fullName: user.fullName,
          role: 'parent',
          email: user.email ?? null,
          phone: user.phone ?? null,
        });
      } else if (user.staffId) {
        fetchStaffProfile(user.id, user.schoolId).then(setStaffProfile);
      }
    }

    setPrefs(loadUserPreferences(user.id, user.schoolId, role));
  }, [user?.schoolId, user?.id, role]);

  const handleSchoolSave = async () => {
    if (!user?.schoolId || !config.canEditSchool) return;
    setSaving(true);
    setSaveMessage(null);
    const result = await updateSchoolProfile(user.schoolId, {
      name: form.name,
      email: form.email,
      phone: form.phone,
      passMark: form.passMark,
      gradeA: form.gradeA,
      gradeB: form.gradeB,
      attendanceWarning: form.attendanceWarning,
      attendanceCritical: form.attendanceCritical,
      timezone: form.timezone,
      currency: form.currency,
    });
    setSaving(false);
    if (result.success) {
      setSaveMessage('School settings saved successfully.');
      const refreshed = await fetchSchoolProfile(user.schoolId);
      setProfile(refreshed);
    } else {
      setSaveMessage(result.error ?? 'Failed to save settings.');
    }
  };

  const handlePrefsSave = () => {
    if (!user?.schoolId || !prefs) return;
    saveUserPreferences(user.id, user.schoolId, role, prefs);
    setSaveMessage('Notification preferences saved.');
  };

  const notificationItems = getNotificationItemsForRole(role);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-secondary-text">{config.subtitle}</p>
      </div>

      {config.infoBanner && (
        <div className="card flex items-center gap-3 text-sm bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-900">
          <Eye className="w-5 h-5 text-blue-600 shrink-0" />
          <p className="text-blue-800 dark:text-blue-200">{config.infoBanner}</p>
        </div>
      )}

      {saveMessage && (
        <div className="card text-sm bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200">
          {saveMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <div className="card p-2">
            {config.tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                    activeTab === tab.id
                      ? 'bg-secondary-bg dark:bg-dark-card font-medium'
                      : 'text-secondary-text hover:bg-secondary-bg hover:text-black dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-3">
          {activeTab === 'profile' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card">
              <h2 className="font-semibold mb-6">
                {role === 'parent' ? 'My Account' : 'My Profile'}
              </h2>
              {staffProfile ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ReadOnlyField label="Full Name" value={staffProfile.fullName} />
                  <ReadOnlyField label="Role" value={staffProfile.role} />
                  {role !== 'parent' && (
                    <ReadOnlyField label="Staff ID" value={staffProfile.staffId} />
                  )}
                  <ReadOnlyField label="Phone" value={staffProfile.phone ?? '—'} />
                  <ReadOnlyField label="Email" value={staffProfile.email ?? '—'} />
                  <ReadOnlyField label="School ID" value={user?.schoolId ?? '—'} />
                </div>
              ) : (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
              )}
              {role === 'parent' && user?.children && user.children.length > 0 && (
                <div className="mt-6 pt-6 border-t border-border dark:border-gray-800">
                  <h3 className="font-medium mb-3">Linked children</h3>
                  <ul className="space-y-2">
                    {user.children.map((c) => (
                      <li
                        key={c.id}
                        className="p-3 rounded-lg bg-secondary-bg dark:bg-dark-card text-sm"
                      >
                        {c.firstName} {c.lastName} ({c.studentId})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-xs text-secondary-text mt-6">
                Profile details are managed by your school administrator.
              </p>
            </motion.div>
          )}

          {activeTab === 'school' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card">
              <h2 className="font-semibold mb-6">
                {role === 'finance' ? 'School & fee configuration' : 'School information'}
              </h2>
              {profileLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
              ) : !profile ? (
                <p className="text-secondary-text">School profile not found.</p>
              ) : config.canEditSchool ? (
                <SchoolEditForm form={form} setForm={setForm} showAcademic={config.showSchoolAcademic} />
              ) : (
                <SchoolReadOnlyView profile={profile} showAcademic={config.showSchoolAcademic} />
              )}

              {config.showBilling && profile && (
                <div className="mt-6 pt-6 border-t border-border dark:border-gray-800">
                  <p className="text-sm text-secondary-text mb-2">
                    Currency: <strong>{profile.currency}</strong> · Timezone:{' '}
                    <strong>{profile.timezone}</strong>
                  </p>
                  <p className="text-xs text-secondary-text">
                    Fee structures and payment rules are set by the administrator.
                  </p>
                </div>
              )}

              {config.canEditSchool && (
                <div className="mt-6 pt-6 border-t border-border dark:border-gray-800 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSchoolSave}
                    disabled={saving}
                    className="btn-primary flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? 'Saving…' : 'Save school settings'}
                  </button>
                </div>
              )}

              {role === 'admin' && (
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link
                    to="/admin/fee-settings"
                    className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:underline"
                  >
                    <LinkIcon className="w-4 h-4" /> Fee settings
                  </Link>
                  <Link
                    to="/admin/academic-calendar"
                    className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:underline"
                  >
                    <LinkIcon className="w-4 h-4" /> Academic calendar
                  </Link>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'notifications' && prefs && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card">
              <h2 className="font-semibold mb-2">Notification preferences</h2>
              <p className="text-sm text-secondary-text mb-6">
                Saved on this device for your {role} account at this school.
              </p>
              <div className="space-y-4">
                {notificationItems.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between p-4 rounded-xl bg-secondary-bg dark:bg-dark-card"
                  >
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <p className="text-sm text-secondary-text">{item.desc}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={prefs[item.key]}
                        onChange={(e) =>
                          setPrefs({ ...prefs, [item.key]: e.target.checked })
                        }
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-black" />
                    </label>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex justify-end">
                <button type="button" onClick={handlePrefsSave} className="btn-primary">
                  Save preferences
                </button>
              </div>
            </motion.div>
          )}

          {activeTab === 'security' && config.canEditSecurity && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card">
              <h2 className="font-semibold mb-6">Security</h2>
              <p className="text-sm text-secondary-text mb-4">
                Admin accounts use email and password via Supabase Auth.
              </p>
              <div className="space-y-4 max-w-md">
                <div>
                  <label className="label mb-1.5 block">Current password</label>
                  <input type="password" className="input-field" autoComplete="current-password" />
                </div>
                <div>
                  <label className="label mb-1.5 block">New password</label>
                  <input type="password" className="input-field" autoComplete="new-password" />
                </div>
                <button type="button" className="btn-primary">
                  Update password
                </button>
              </div>
            </motion.div>
          )}

          {activeTab === 'appearance' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card">
              <h2 className="font-semibold mb-6">Appearance</h2>
              <div className="flex items-center justify-between p-4 rounded-xl bg-secondary-bg dark:bg-dark-card">
                <div>
                  <p className="font-medium">Dark mode</p>
                  <p className="text-sm text-secondary-text">Switch between light and dark themes</p>
                </div>
                <button
                  type="button"
                  onClick={toggleDarkMode}
                  className={`relative w-14 h-8 rounded-full transition-colors ${
                    darkMode ? 'bg-black' : 'bg-gray-200'
                  }`}
                >
                  <div
                    className={`absolute top-1 w-6 h-6 bg-white rounded-full flex items-center justify-center transition-transform ${
                      darkMode ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  >
                    {darkMode ? (
                      <Moon className="w-3 h-3 text-black" />
                    ) : (
                      <Sun className="w-3 h-3 text-gray-600" />
                    )}
                  </div>
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

function SchoolReadOnlyView({
  profile,
  showAcademic,
}: {
  profile: SchoolProfile;
  showAcademic: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ReadOnlyField label="School name" value={profile.name} />
        <ReadOnlyField label="Email" value={profile.email} />
        <ReadOnlyField label="Phone" value={profile.phone} />
        <ReadOnlyField label="Location" value={`${profile.city}, ${profile.state}`} />
        <ReadOnlyField label="Currency" value={profile.currency} />
        <ReadOnlyField label="Timezone" value={profile.timezone} />
      </div>
      {showAcademic && (
        <div className="border-t border-border dark:border-gray-800 pt-6">
          <h3 className="font-medium mb-4">Academic thresholds</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ReadOnlyField label="Pass mark" value={profile.passMark} />
            <ReadOnlyField label="Grade A (%)" value={profile.gradeA} />
            <ReadOnlyField label="Grade B (%)" value={profile.gradeB} />
            <ReadOnlyField label="Attendance warning (%)" value={profile.attendanceWarning} />
            <ReadOnlyField label="Attendance critical (%)" value={profile.attendanceCritical} />
          </div>
        </div>
      )}
    </div>
  );
}

function SchoolEditForm({
  form,
  setForm,
  showAcademic,
}: {
  form: Partial<SchoolProfile>;
  setForm: (f: Partial<SchoolProfile>) => void;
  showAcademic: boolean;
}) {
  const update = (key: keyof SchoolProfile, value: string | number) =>
    setForm({ ...form, [key]: value });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="label mb-1.5 block">School name</label>
          <input
            className="input-field"
            value={form.name ?? ''}
            onChange={(e) => update('name', e.target.value)}
          />
        </div>
        <div>
          <label className="label mb-1.5 block">Email</label>
          <input
            className="input-field"
            value={form.email ?? ''}
            onChange={(e) => update('email', e.target.value)}
          />
        </div>
        <div>
          <label className="label mb-1.5 block">Phone</label>
          <input
            className="input-field"
            value={form.phone ?? ''}
            onChange={(e) => update('phone', e.target.value)}
          />
        </div>
        <div>
          <label className="label mb-1.5 block">Currency</label>
          <select
            className="input-field"
            value={form.currency ?? 'NGN'}
            onChange={(e) => update('currency', e.target.value)}
          >
            <option value="NGN">Nigerian Naira (NGN)</option>
            <option value="USD">US Dollar (USD)</option>
          </select>
        </div>
        <div>
          <label className="label mb-1.5 block">Timezone</label>
          <select
            className="input-field"
            value={form.timezone ?? 'Africa/Lagos'}
            onChange={(e) => update('timezone', e.target.value)}
          >
            <option value="Africa/Lagos">West Africa Time (WAT)</option>
          </select>
        </div>
      </div>
      {showAcademic && (
        <div className="border-t border-border dark:border-gray-800 pt-6">
          <h3 className="font-medium mb-4">Academic settings</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(
              [
                ['passMark', 'Pass mark'],
                ['gradeA', 'Grade A (%)'],
                ['gradeB', 'Grade B (%)'],
                ['attendanceWarning', 'Attendance warning (%)'],
                ['attendanceCritical', 'Attendance critical (%)'],
              ] as [keyof SchoolProfile, string][]
            ).map(([key, label]) => (
              <div key={key}>
                <label className="label mb-1.5 block">{label}</label>
                <input
                  type="number"
                  className="input-field"
                  value={form[key] as number ?? ''}
                  onChange={(e) => update(key, Number(e.target.value))}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
