// AI 手牌堆（背面朝上的小堆牌）
import { motion } from 'framer-motion';
import PlayingCard from './PlayingCard';

interface AIHandStackProps {
  count: number;
  max?: number;
}

export default function AIHandStack({ count, max = 5 }: AIHandStackProps) {
  const display = Math.min(count, max);
  return (
    <div className="flex items-center" style={{ paddingLeft: '16px' }}>
      {Array.from({ length: display }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          style={{ marginLeft: i === 0 ? -16 : -22 }}
        >
          <PlayingCard card={{ id: `back-${i}`, suit: 'joker', rank: 3 }} size="sm" faceDown />
        </motion.div>
      ))}
    </div>
  );
}
