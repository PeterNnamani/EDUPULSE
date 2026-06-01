import { motion } from 'framer-motion';
import { Activity } from 'lucide-react';

export default function SplashScreen() {

  return (
    <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center cursor-pointer">
      <div className="text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="flex flex-col items-center"
        >
          <motion.div
            className="mb-6"
            initial={{ rotate: -180 }}
            animate={{ rotate: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          >
            <Activity className="w-20 h-20 text-black dark:text-white" strokeWidth={1.5} />
          </motion.div>

          <motion.h1
            className="text-5xl font-bold tracking-tight text-black dark:text-white mb-3"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            EduPulse
          </motion.h1>

          <motion.p
            className="text-lg text-secondary-text dark:text-gray-400 mb-8"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
          >
            Academic Risk Monitoring Platform
          </motion.p>

          <motion.div
            className="space-y-2"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.5 }}
          >
            <p className="text-sm text-secondary-text dark:text-gray-500">
              Smarter Schools.
            </p>
            <p className="text-sm text-secondary-text dark:text-gray-500">
              Safer Students.
            </p>
            <p className="text-sm text-secondary-text dark:text-gray-500">
              Better Outcomes.
            </p>
          </motion.div>
        </motion.div>

        <motion.div
          className="mt-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.4 }}
        >
          <div className="flex items-center justify-center space-x-1">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 bg-black dark:bg-white rounded-full"
                animate={{ y: [0, -10, 0] }}
                transition={{
                  duration: 0.6,
                  repeat: Infinity,
                  delay: i * 0.1,
                }}
              />
            ))}
          </div>
        </motion.div>


      </div>
    </div>
  );
}
