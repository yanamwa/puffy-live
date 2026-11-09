import { BrowserRouter, Link, useLocation } from "react-router-dom";
import "./App.css";
import { AuthProvider, useAuth } from "./context/AuthContext";
import {
  SystemStatusProvider,
  useSystemStatus,
} from "./context/SystemStatusContext.jsx";
import { getUserRole } from "./utils/roles.js";
import AppRoutes from "./routes/AppRoutes";

function SystemRoutes() {
  const { maintenanceMode } = useSystemStatus();
  const { user } = useAuth();
  const { pathname } = useLocation();

  if (
    maintenanceMode &&
    getUserRole(user) !== "super_admin" &&
    !/^\/login\/?$/i.test(pathname)
  ) {
    return (
      <main className="puffy-maintenance">
        <section>
          <h1>PuffyBrain is under maintenance</h1>
          <p>Please check back shortly.</p>
          <Link to="/login">Super Admin sign in</Link>
        </section>
      </main>
    );
  }

  return <AppRoutes />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <SystemStatusProvider>
          <SystemRoutes />
        </SystemStatusProvider>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
