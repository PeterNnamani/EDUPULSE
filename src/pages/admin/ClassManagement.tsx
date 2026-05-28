import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Users, Edit2 } from 'lucide-react';

export default function ClassManagement() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  const mockClasses = [
    { id: '1', name: 'SS1A', grade_level: 'SS1', section: 'A', capacity: 40, students: 35, class_teacher: 'Dr. Adebayo Johnson' },
    { id: '2', name: 'SS1B', grade_level: 'SS1', section: 'B', capacity: 40, students: 32, class_teacher: 'Mrs. Grace Nwosu' },
    { id: '3', name: 'SS2A', grade_level: 'SS2', section: 'A', capacity: 40, students: 28, class_teacher: 'Mr. Yusuf Bello' },
    { id: '4', name: 'SS2B', grade_level: 'SS2', section: 'B', capacity: 40, students: 30, class_teacher: 'Mrs. Folake Adeyemi' },
    { id: '5', name: 'SS3A', grade_level: 'SS3', section: 'A', capacity: 40, students: 25, class_teacher: 'Prof. Chioma Okonkwo' },
    { id: '6', name: 'SS3B', grade_level: 'SS3', section: 'B', capacity: 40, students: 28, class_teacher: 'Mr. Emeka Obi' },
  ];

  const filteredClasses = mockClasses.filter((cls) =>
    `${cls.name} ${cls.class_teacher}`.toLowerCase().includes(searchQuery.toLowerCase())
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
                <button className="p-2 rounded-lg hover:bg-secondary-bg dark:hover:bg-dark-card">
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-secondary-text">Students</span>
                  <span className="font-medium">{cls.students}/{cls.capacity}</span>
                </div>
                <div className="h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-black dark:bg-white rounded-full"
                    style={{ width: `${(cls.students / cls.capacity) * 100}%` }}
                  />
                </div>
                <div className="pt-3 border-t border-border dark:border-gray-800">
                  <p className="text-xs text-secondary-text">Class Teacher</p>
                  <p className="text-sm font-medium">{cls.class_teacher}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
