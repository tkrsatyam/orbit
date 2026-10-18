import { BrowserRouter, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/layout/ProtectedRoute'
import { AuthProvider } from './context/AuthContext'
import AuthPage from './pages/AuthPage'
import ConversationsPage from './pages/ConversationsPage'
import DiscoverPage from './pages/DiscoverPage'
import GroupPage from './pages/GroupPage'
import NotFoundPage from './pages/NotFoundPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<AuthPage key="login" initialMode="login" />} />
          <Route path="/register" element={<AuthPage key="register" initialMode="register" />} />
          <Route path="/discover" element={<DiscoverPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<ConversationsPage />} />
            <Route path="/groups/:id" element={<GroupPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}