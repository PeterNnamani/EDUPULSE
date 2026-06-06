import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarCheck, AlertTriangle, MessageSquare, TrendingUp, ChevronRight } from 'lucide-react';
import { useAppStore } from '@/store';

const slides = [
  {
    icon: CalendarCheck,
    title: 'Track Attendance Effortlessly',
    description: 'Mark attendance in seconds, track patterns over time, and get instant alerts when students miss class.',
    illustration: (
      <div className="w-64 h-48 bg-secondary-bg dark:bg-dark-card rounded-2xl p-4 flex items-center justify-center">
        <div className="space-y-2 w-full">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-black dark:bg-white" />
              <div className="flex-1 h-2 bg-gray-300 dark:bg-gray-700 rounded">
                <motion.div
                  className="h-full bg-black dark:bg-white rounded"
                  initial={{ width: 0 }}
                  animate={{ width: `${90 - i * 5}%` }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                />
              </div>
              <div className="w-6 h-6 rounded-full bg-green-500" />
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    icon: AlertTriangle,
    title: 'Detect Academic Risk Early',
    description: 'Our AI-powered system identifies at-risk students before they fall behind, enabling timely intervention.',
    illustration: (
      <div className="w-64 h-48 bg-secondary-bg dark:bg-dark-card rounded-2xl p-4 flex flex-col items-center justify-center gap-3">
        <div className="flex items-end gap-4 h-24">
          {[30, 50, 45, 70, 85].map((h, i) => (
            <motion.div
              key={i}
              initial={{ height: 0 }}
              animate={{ height: `${h}%` }}
              transition={{ delay: i * 0.1, duration: 0.4 }}
              className={`w-8 rounded-t ${
                h > 70 ? 'bg-red-500' : h > 50 ? 'bg-yellow-500' : 'bg-green-500'
              }`}
            />
          ))}
        </div>
        <div className="text-xs text-secondary-text">Risk Score Trend</div>
      </div>
    ),
  },
  {
    icon: MessageSquare,
    title: 'Keep Parents Informed',
    description: 'Automatic notifications keep parents in the loop about attendance, grades, behavior, and important updates.',
    illustration: (
      <div className="w-64 h-48 bg-secondary-bg dark:bg-dark-card rounded-2xl p-4 flex flex-col justify-center gap-3">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: i * 0.2, duration: 0.3 }}
            className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm"
          >
            <div className="w-3/4 h-2 bg-gray-200 dark:bg-gray-700 rounded mb-1" />
            <div className="w-1/2 h-2 bg-gray-200 dark:bg-gray-700 rounded" />
          </motion.div>
        ))}
      </div>
    ),
  },
  {
    icon: TrendingUp,
    title: 'Improve Student Outcomes',
    description: 'Data-driven insights and intervention tools help schools achieve better academic results for every student.',
    illustration: (
      <div className="w-64 h-48 bg-secondary-bg dark:bg-dark-card rounded-2xl p-4 flex items-center justify-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-center"
        >
          <div className="text-5xl font-bold text-black dark:text-white mb-2">87%</div>
          <div className="text-sm text-secondary-text">Pass Rate Increase</div>
        </motion.div>
      </div>
    ),
  },
];

export default function OnboardingFlow() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const setOnboardingComplete = useAppStore((s) => s.setOnboardingComplete);

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    }
  };

  const handleSkip = () => {
    setOnboardingComplete(true);
  };

  const handleGetStarted = () => {
    setOnboardingComplete(true);
  };

  const slide = slides[currentSlide];
  const Icon = slide.icon;

  return (
    <div className="min-h-screen bg-white dark:bg-dark-bg flex flex-col items-center justify-center p-8">
      <div className="max-w-md w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="text-center"
          >
            <motion.div
              className="w-16 h-16 mx-auto mb-6 rounded-full bg-secondary-bg dark:bg-dark-card flex items-center justify-center"
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, duration: 0.3 }}
            >
              <Icon className="w-8 h-8 text-black dark:text-white" strokeWidth={1.5} />
            </motion.div>

            <h2 className="text-2xl font-bold text-black dark:text-white mb-3">
              {slide.title}
            </h2>
            <p className="text-secondary-text dark:text-gray-400 mb-8">
              {slide.description}
            </p>

            <div className="flex justify-center mb-8">
              {slide.illustration}
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="flex justify-center gap-2 mb-8">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentSlide(i)}
              className={`w-2 h-2 rounded-full transition-all ${
                i === currentSlide
                  ? 'w-8 bg-black dark:bg-white'
                  : 'bg-gray-300 dark:bg-gray-700'
              }`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-4">
          <button
            onClick={handleSkip}
            className="px-6 py-3 text-secondary-text dark:text-gray-400 font-medium hover:text-black dark:hover:text-white transition-colors"
          >
            Skip
          </button>

          {currentSlide === slides.length - 1 ? (
            <button
              onClick={handleGetStarted}
              className="btn-primary flex items-center gap-2"
            >
              Get Started
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={handleNext} className="btn-primary flex items-center gap-2">
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
