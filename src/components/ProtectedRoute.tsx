import Login from '../pages/Login';

interface Props {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: Props) {
  const isAuthed = localStorage.getItem('motionDeckAuth') === 'true';

  if (!isAuthed) {
    return <Login />;
  }

  return <>{children}</>;
}
