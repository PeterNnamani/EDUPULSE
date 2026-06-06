import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Cake, Loader } from 'lucide-react';
import { useAppStore } from '@/store';
import { birthdayService, BirthdayBuckets, BirthdayPerson } from '@/services/birthdayService';

const TYPE_BADGE: Record<string, string> = {
  student: 'Student',
  parent: 'Parent',
  teacher: 'Teacher',
  staff: 'Staff',
};

function PersonRow({ person, showWhen }: { person: BirthdayPerson; showWhen?: boolean }) {
  const when =
    person.daysUntil === 0
      ? 'Today'
      : person.daysUntil > 0
        ? `in ${person.daysUntil}d`
        : `${Math.abs(person.daysUntil)}d ago`;
  return (
    <li className="flex items-center justify-between gap-2 py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{person.name}</p>
        <p className="text-xs text-secondary-text">{TYPE_BADGE[person.personType]}</p>
      </div>
      {showWhen && <span className="text-xs text-secondary-text whitespace-nowrap">{when}</span>}
    </li>
  );
}

export default function BirthdayWidget() {
  const { user } = useAppStore();
  const schoolId = user?.schoolId;
  const [buckets, setBuckets] = useState<BirthdayBuckets | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!schoolId) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    birthdayService
      .getBirthdays(schoolId)
      .then((b) => {
        if (active) setBuckets(b);
      })
      .catch(() => {
        if (active) setBuckets(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [schoolId]);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card">
      <div className="flex items-center gap-2 mb-4">
        <Cake className="w-5 h-5 text-pink-500" />
        <h2 className="font-semibold">Birthdays</h2>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader className="w-6 h-6 animate-spin" />
        </div>
      ) : !buckets || (buckets.today.length === 0 && buckets.upcoming.length === 0) ? (
        <div className="text-center py-8">
          <Cake className="w-10 h-10 text-secondary-text mx-auto mb-2 opacity-40" />
          <p className="text-sm text-secondary-text">No birthdays in the next two weeks</p>
        </div>
      ) : (
        <div className="space-y-4">
          {buckets.today.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase text-pink-500 mb-1">Today 🎉</p>
              <ul className="divide-y divide-border dark:divide-gray-800">
                {buckets.today.map((p) => (
                  <PersonRow key={`${p.personType}-${p.personId}`} person={p} />
                ))}
              </ul>
            </div>
          )}
          {buckets.upcoming.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase text-secondary-text mb-1">Upcoming</p>
              <ul className="divide-y divide-border dark:divide-gray-800">
                {buckets.upcoming.slice(0, 6).map((p) => (
                  <PersonRow key={`${p.personType}-${p.personId}`} person={p} showWhen />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
