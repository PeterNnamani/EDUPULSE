import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, ArrowUpRight, Loader } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppStore } from '@/store';
import { checkStudentLimit, type StudentLimitInfo } from '@/services/studentService';

export default function StudentUsageWidget() {
  const { user } = useAppStore();
  const [info, setInfo] = useState<StudentLimitInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.schoolId) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    checkStudentLimit(user.schoolId)
      .then((res) => {
        if (active) setInfo(res);
      })
      .catch(() => {
        if (active) setInfo(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user?.schoolId]);

  if (loading) {
    return (
      <div className="card flex items-center justify-center py-8">
        <Loader className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  if (!info) return null;

  const unlimited = !Number.isFinite(info.max);
  const pct = unlimited ? 0 : Math.min(100, Math.round((info.current / info.max) * 100));
  const nearLimit = !unlimited && pct >= 80;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-secondary-text" />
          <h3 className="font-semibold">Student Usage</h3>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-secondary-bg dark:bg-dark-card">{info.planName}</span>
      </div>

      <p className="text-2xl font-bold">
        {info.current.toLocaleString()}{' '}
        <span className="text-base font-normal text-secondary-text">
          / {unlimited ? 'Unlimited' : info.max.toLocaleString()}
        </span>
      </p>

      {!unlimited && (
        <>
          <div className="w-full bg-secondary-bg dark:bg-dark-card rounded-full h-2.5 mt-3">
            <div
              className={`h-2.5 rounded-full transition-all ${nearLimit ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-secondary-text mt-2">
            {info.remaining.toLocaleString()} student slot(s) remaining
          </p>
          {nearLimit && (
            <Link
              to="/admin/subscriptions"
              className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-1 mt-3 hover:underline"
            >
              Upgrade plan <ArrowUpRight className="w-4 h-4" />
            </Link>
          )}
        </>
      )}
    </motion.div>
  );
}
