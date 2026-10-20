import { useNavigate } from 'react-router-dom';
import Personalization from '@/components/Personalization';

export default function Appearance() {
  const navigate = useNavigate();
  return <Personalization fullPage onClose={() => navigate('/')} />;
}
