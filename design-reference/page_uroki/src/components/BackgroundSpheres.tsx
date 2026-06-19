import { motion } from 'motion/react';

export function BackgroundSpheres() {
  return (
    <div className="fixed inset-0 overflow-hidden -z-10 pointer-events-none">
      <motion.div
        animate={{
          y: [0, -30, 0],
          scale: [1, 1.05, 1],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="absolute top-[-100px] left-[-100px] w-[400px] h-[400px] rounded-full bg-blue-300/30 blur-[100px]"
      />
      <motion.div
        animate={{
          y: [0, 40, 0],
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1,
        }}
        className="absolute bottom-[-50px] right-[50px] w-[350px] h-[350px] rounded-full bg-purple-200/40 blur-[100px]"
      />
    </div>
  );
}
