import { createRoot } from 'react-dom/client';
import { ModelViewer } from './ModelViewer';
import './styles.css';
import './model.css';

createRoot(document.getElementById('root')!).render(<ModelViewer />);
