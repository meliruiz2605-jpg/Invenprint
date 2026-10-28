import { useState } from "react";
import { supabase } from "@/supabase";
import logo from "@/assets/logo.png";

interface LoginPageProps {
  onLogin: () => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      setError("Por favor completa todos los campos.");
      return;
    }

    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError("Correo o contraseña incorrectos.");
      setLoading(false);
      return;
    }

    onLogin();
    setLoading(false);
  }

  return (
    <div className="w-full min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F0F8FF" }}>
      <div className="bg-white rounded-2xl shadow-md w-full max-w-sm overflow-hidden">

        {/* Header */}
        <div className="px-8 py-6 flex flex-col items-center" style={{ backgroundColor: "#B0E0E6" }}>
          <img src={logo} alt="Logo InvenPrint" style={{ height: "80px" }} className="object-contain mb-2" />
          <h1 className="text-lg font-bold text-gray-800" style={{ fontFamily: "Archivo Black, sans-serif" }}>
            Inventario Materia Prima
          </h1>
          <p className="text-xs text-gray-600 mt-1">Inicia sesión para continuar</p>
        </div>

        {/* Formulario */}
        <div className="px-8 py-6 space-y-4">

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Correo electrónico
            </label>
            <input
              type="email"
              placeholder="correo@ejemplo.com"
              className="w-full border border-gray-200 bg-gray-50 p-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300 transition"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Contraseña
            </label>
            <input
              type="password"
              placeholder="••••••••"
              className="w-full border border-gray-200 bg-gray-50 p-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300 transition"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
          </div>

          {error && (
            <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg border border-red-100">
              {error}
            </p>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full text-white py-3 rounded-xl font-semibold hover:opacity-90 transition shadow-sm mt-2"
            style={{ backgroundColor: "#32C1E6" }}
          >
            {loading ? "Iniciando sesión..." : "Iniciar sesión"}
          </button>

        </div>
      </div>
    </div>
  );
}
