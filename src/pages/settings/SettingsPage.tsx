import { useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, Bell, Moon, Sun, Shield, Globe, Save } from 'lucide-react';
import { useAppStore } from '@/store';

export default function SettingsPage() {
  const { darkMode, toggleDarkMode, user } = useAppStore();
  const [activeTab, setActiveTab] = useState('general');
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => setSaving(false), 1000);
  };

  const tabs = [
    { id: 'general', label: 'General', icon: Building2 },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'appearance', label: 'Appearance', icon: Moon },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-secondary-text">Manage your account and school preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Tabs */}
        <div className="lg:col-span-1">
          <div className="card p-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
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

        {/* Settings Content */}
        <div className="lg:col-span-3">
          {activeTab === 'general' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="card"
            >
              <h2 className="font-semibold mb-6">General Settings</h2>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label mb-1.5 block">School Name</label>
                    <input className="input-field" defaultValue="Wisdom International School" />
                  </div>
                  <div>
                    <label className="label mb-1.5 block">School Email</label>
                    <input className="input-field" defaultValue="admin@wisdomschool.edu" />
                  </div>
                  <div>
                    <label className="label mb-1.5 block">School Phone</label>
                    <input className="input-field" defaultValue="08012345678" />
                  </div>
                  <div>
                    <label className="label mb-1.5 block">Currency</label>
                    <select className="input-field">
                      <option value="NGN">Nigerian Naira (NGN)</option>
                      <option value="USD">US Dollar (USD)</option>
                    </select>
                  </div>
                  <div>
                    <label className="label mb-1.5 block">Timezone</label>
                    <select className="input-field">
                      <option value="Africa/Lagos">West Africa Time (WAT)</option>
                    </select>
                  </div>
                  <div>
                    <label className="label mb-1.5 block">Language</label>
                    <select className="input-field">
                      <option value="en">English</option>
                    </select>
                  </div>
                </div>

                <div className="border-t border-border dark:border-gray-800 pt-6">
                  <h3 className="font-medium mb-4">Academic Settings</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="label mb-1.5 block">Pass Mark</label>
                      <input type="number" className="input-field" defaultValue={40} />
                    </div>
                    <div>
                      <label className="label mb-1.5 block">Grade A (%)</label>
                      <input type="number" className="input-field" defaultValue={70} />
                    </div>
                    <div>
                      <label className="label mb-1.5 block">Grade B (%)</label>
                      <input type="number" className="input-field" defaultValue={60} />
                    </div>
                    <div>
                      <label className="label mb-1.5 block">Attendance Warning (%)</label>
                      <input type="number" className="input-field" defaultValue={80} />
                    </div>
                    <div>
                      <label className="label mb-1.5 block">Attendance Critical (%)</label>
                      <input type="number" className="input-field" defaultValue={60} />
                    </div>
                    <div>
                      <label className="label mb-1.5 block">Risk Threshold (%)</label>
                      <input type="number" className="input-field" defaultValue={50} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-6 pt-6 border-t border-border dark:border-gray-800 flex justify-end">
                <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </motion.div>
          )}

          {activeTab === 'notifications' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="card"
            >
              <h2 className="font-semibold mb-6">Notification Preferences</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-xl bg-secondary-bg dark:bg-dark-card">
                  <div>
                    <p className="font-medium">Email Notifications</p>
                    <p className="text-sm text-secondary-text">Receive updates via email</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-black"></div>
                  </label>
                </div>
                <div className="flex items-center justify-between p-4 rounded-xl bg-secondary-bg dark:bg-dark-card">
                  <div>
                    <p className="font-medium">SMS Notifications</p>
                    <p className="text-sm text-secondary-text">Receive updates via SMS</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-black"></div>
                  </label>
                </div>
                <div className="flex items-center justify-between p-4 rounded-xl bg-secondary-bg dark:bg-dark-card">
                  <div>
                    <p className="font-medium">Attendance Alerts</p>
                    <p className="text-sm text-secondary-text">Alert when students miss class</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-black"></div>
                  </label>
                </div>
                <div className="flex items-center justify-between p-4 rounded-xl bg-secondary-bg dark:bg-dark-card">
                  <div>
                    <p className="font-medium">Risk Alerts</p>
                    <p className="text-sm text-secondary-text">Notify about high-risk students</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-black"></div>
                  </label>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'security' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="card"
            >
              <h2 className="font-semibold mb-6">Security Settings</h2>
              <div className="space-y-6">
                <div>
                  <h3 className="font-medium mb-4">Change Password</h3>
                  <div className="space-y-4 max-w-md">
                    <div>
                      <label className="label mb-1.5 block">Current Password</label>
                      <input type="password" className="input-field" />
                    </div>
                    <div>
                      <label className="label mb-1.5 block">New Password</label>
                      <input type="password" className="input-field" />
                    </div>
                    <div>
                      <label className="label mb-1.5 block">Confirm New Password</label>
                      <input type="password" className="input-field" />
                    </div>
                    <button className="btn-primary">Update Password</button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'appearance' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="card"
            >
              <h2 className="font-semibold mb-6">Appearance Settings</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-xl bg-secondary-bg dark:bg-dark-card">
                  <div>
                    <p className="font-medium">Dark Mode</p>
                    <p className="text-sm text-secondary-text">Switch between light and dark themes</p>
                  </div>
                  <button
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
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
