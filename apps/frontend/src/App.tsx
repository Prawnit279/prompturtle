import { BrowserRouter, Route, Routes } from 'react-router-dom';

function HomePage() {
  return (
    <main>
      <h1>Home</h1>
    </main>
  );
}

function DashboardPage() {
  return (
    <main>
      <h1>Dashboard</h1>
    </main>
  );
}

function LoginPage() {
  return (
    <main>
      <h1>Login</h1>
    </main>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/login" element={<LoginPage />} />
      </Routes>
    </BrowserRouter>
  );
}
