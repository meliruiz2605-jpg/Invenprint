import { useState, useEffect, useRef } from "react";
import { Toaster } from "@/components/ui/toaster";
import { PaperInventoryPage } from "@/features/inventory/pages/PaperInventoryPage";
import { AlertasPage } from "@/features/inventory/pages/Alertaspage";
import { ReportsPage } from "@/features/reports/pages/ReportsPage";
import { UserManagementPage } from "@/features/users/pages/UserManagementPage";
import { CreatePaperDialog } from "@/features/inventory/components/CreatePaperDialog";
import { LoginPage } from "@/features/auth/pages/LoginPage";
import { ProveedoresPage } from "@/features/proveedores/pages/ProveedoresPage";
import { HistorialPage } from "@/features/historial/pages/historialpage";
import { getPapers, createPaper, addMovement, updateMovement, deleteMovement, getProveedores } from "@/lib/supabaseService";
import type { Proveedor } from "@/features/proveedores/types/proveedor";
import { supabase } from "@/supabase";
import type { Paper, Movement } from "@/features/inventory/types/paper";
import { PERMISOS_DEFAULT, type Permisos } from "@/features/auth/types/permisos";
import logo from "@/assets/logo.png";
import iconoInventario from "@/assets/inventario-disponible.png";

type Tab = "inventario" | "alertas" | "reportes" | "proveedores" | "usuarios" | "historial";

interface UserProfile {
  nombre: string;
  email: string;
  rol: "admin" | "operador";
  permisos?: Permisos;
}

function getStockReal(paper: Paper): number {
  return paper.movements.reduce((total, m) =>
    m.type === "entrada" ? total + m.quantity : total - m.quantity, 0
  );
}

function App() {
  const [activeTab, setActiveTab] = useState<Tab>("inventario");
  const [inventory, setInventory] = useState<Paper[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userId, setUserId] = useState<string>("");
  const [menuOpen, setMenuOpen] = useState(false);
  const recargaTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUserId(session.user.id);
        await cargarPerfil(session.user.id);
        await cargarInventario();
        await cargarProveedores();
      }
      setLoading(false);
    }
    init();
  }, []);

  // Tiempo real: cuando cualquier usuario registra un movimiento o
  // agrega/edita un producto, Supabase avisa a todos los que tengan la
  // app abierta y el inventario se actualiza solo, sin necesidad de F5.
  // (Requiere que "papers" y "movements" tengan Realtime activado en
  // Supabase: Database → Replication → activar esas dos tablas.)
  useEffect(() => {
    if (!userId) return;

    function recargarConDebounce() {
      if (recargaTimeout.current) clearTimeout(recargaTimeout.current);
      recargaTimeout.current = setTimeout(() => {
        cargarInventario();
      }, 500);
    }

    const canal = supabase
      .channel("inventario-tiempo-real")
      .on("postgres_changes", { event: "*", schema: "public", table: "papers" }, recargarConDebounce)
      .on("postgres_changes", { event: "*", schema: "public", table: "movements" }, recargarConDebounce)
      .subscribe();

    return () => {
      if (recargaTimeout.current) clearTimeout(recargaTimeout.current);
      supabase.removeChannel(canal);
    };
  }, [userId]);

  async function cargarPerfil(userId: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select("nombre, email, rol, permisos")
      .eq("id", userId)
      .single();
    if (!error && data) {
      setProfile(data as UserProfile);
    }
  }

  async function cargarInventario() {
    try {
      const data = await getPapers();
      setInventory(data);
    } catch (error) {
      console.error("Error cargando inventario:", error);
    }
  }

  async function cargarProveedores() {
    try {
      const data = await getProveedores();
      setProveedores(data);
    } catch (error) {
      console.error("Error cargando proveedores:", error);
    }
  }

  async function handleLogin() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      setUserId(session.user.id);
      await cargarPerfil(session.user.id);
      await cargarInventario();
      await cargarProveedores();
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setProfile(null);
    setInventory([]);
    setUserId("");
  }

  async function handleCreateMaterial(newMaterial: Paper) {
    const saldoInicial: Movement = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      type: "entrada",
      isInitial: true,
      quantity: newMaterial.quantity,
      responsible: profile?.nombre ?? "Sistema",
      observations: "Saldo inicial",
    };
    const materialConMovimiento: Paper = {
      ...newMaterial,
      movements: [saldoInicial],
    };
    try {
      await createPaper(materialConMovimiento);
      await cargarInventario();
    } catch (error) {
      console.error("Error creando material:", error);
    }
  }

  async function handleAddMovement(paperCode: string, movement: Movement) {
    try {
      await addMovement(paperCode, movement);
      await cargarInventario();
    } catch (error) {
      console.error("Error registrando movimiento:", error);
    }
  }
  async function handleUpdateMovement(movementId: string, updatedMovement: Partial<Movement>) {
  try {
    await updateMovement(movementId, updatedMovement, profile?.nombre ?? "Sistema");
    await cargarInventario();
  } catch (error) {
    console.error("Error actualizando movimiento:", error);
  }
}

async function handleDeleteMovement(movementId: string) {
  try {
    await deleteMovement(movementId, profile?.nombre ?? "Sistema");
    await cargarInventario();
  } catch (error) {
    console.error("Error eliminando movimiento:", error);
  }
}

  if (loading) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F7FBFC" }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-4 animate-spin" style={{ borderColor: "#00D4FF", borderTopColor: "transparent" }} />
          <p className="text-gray-400 text-sm">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <>
        <LoginPage onLogin={handleLogin} />
        <Toaster />
      </>
    );
  }

  const isAdmin = profile.rol === "admin";
  // Se combina con PERMISOS_DEFAULT para que los permisos agregados después
  // de que un usuario ya tenía permisos guardados (como "Ver Papel") tomen
  // su valor por defecto en vez de quedar undefined/deshabilitados.
  const permisos: Permisos = { ...PERMISOS_DEFAULT, ...(profile.permisos ?? {}) };

  // El admin siempre tiene todo. El operador depende de sus permisos guardados.
  const canAgregarProducto = isAdmin || permisos.agregarProducto;
  const canEditarProducto = isAdmin || permisos.editarProducto;
  const canEliminarProducto = isAdmin || permisos.eliminarProducto;
  const canRegistrarEntrada = isAdmin || permisos.registrarEntrada;
  const canRegistrarSalida = isAdmin || permisos.registrarSalida;
  const canEditarEliminarReportes = isAdmin || permisos.editarEliminarReportes;
  const canVerProveedores = isAdmin || permisos.verProveedores;
  const canEditarProveedores = isAdmin || permisos.editarProveedores;
  const canEliminarProveedores = isAdmin || permisos.eliminarProveedores;
  const canVerCTP = isAdmin || permisos.verCTP;
  const canEditarCTP = isAdmin || permisos.editarCTP;
  const canEliminarCTP = isAdmin || permisos.eliminarCTP;
  const canVerPapel = isAdmin || permisos.verPapel;
  const canVerOFFSET = isAdmin || permisos.verOFFSET;
  const canEditarOFFSET = isAdmin || permisos.editarOFFSET;
  const canEliminarOFFSET = isAdmin || permisos.eliminarOFFSET;

  function categoriaVisible(categoria: string | undefined) {
    const cat = categoria ?? "Papel";
    if (cat === "CTP") return canVerCTP;
    if (cat === "Papel") return canVerPapel;
    if (cat === "OFFSET") return canVerOFFSET;
    return true;
  }

  const lowStockCount = inventory.filter(
    (p) => categoriaVisible(p.categoria) && getStockReal(p) <= p.minStock
  ).length;

  return (
    <div className="flex flex-col md:flex-row min-h-screen" style={{ backgroundColor: "#F7FBFC" }}>

      {/* SIDEBAR — escritorio */}
      <aside className="hidden md:flex md:flex-col md:justify-between md:w-64 bg-white border-r border-gray-100 h-screen sticky top-0 shrink-0">
        <div>
          <div className="flex items-center gap-2 px-6 py-6 cursor-pointer" onClick={() => setActiveTab("inventario")}>
            <img src={logo} alt="Logo InvenPrint" className="object-contain h-10" />
          </div>

          <p className="px-6 text-[11px] font-bold tracking-widest text-gray-300 mb-2">GESTIÓN</p>

          <nav className="flex flex-col gap-1 px-4">
            <button onClick={() => setActiveTab("inventario")} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${activeTab === "inventario" ? "text-[#00A8CC] bg-[#E5FBFF]" : "text-gray-500 hover:bg-gray-100"}`}>
              <img src={iconoInventario} alt="Inventario" className="h-5 w-5 object-contain" />
              Inventario
            </button>

            <button onClick={() => setActiveTab("alertas")} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${activeTab === "alertas" ? "text-red-500 bg-red-50" : "text-gray-500 hover:bg-gray-100"}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              Alertas
              {lowStockCount > 0 && <span className="ml-auto bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full leading-none">{lowStockCount}</span>}
            </button>

            <button onClick={() => setActiveTab("reportes")} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${activeTab === "reportes" ? "text-[#00A8CC] bg-[#E5FBFF]" : "text-gray-500 hover:bg-gray-100"}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              Reportes
            </button>

            {canVerProveedores && (
              <button onClick={() => setActiveTab("proveedores")} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${activeTab === "proveedores" ? "text-[#00A8CC] bg-[#E5FBFF]" : "text-gray-500 hover:bg-gray-100"}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/><path d="M9 9v.01M9 12v.01M9 15v.01M9 18v.01"/></svg>
                Proveedores
              </button>
            )}

            {isAdmin && (
              <button onClick={() => setActiveTab("usuarios")} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${activeTab === "usuarios" ? "text-[#00A8CC] bg-[#E5FBFF]" : "text-gray-500 hover:bg-gray-100"}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                Usuarios
              </button>
            )}

            {isAdmin && (
              <button onClick={() => setActiveTab("historial")} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${activeTab === "historial" ? "text-[#00A8CC] bg-[#E5FBFF]" : "text-gray-500 hover:bg-gray-100"}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M12 7v5l4 2"/></svg>
                Historial
              </button>
            )}

            <div className="h-px bg-gray-100 my-2" />

            {canAgregarProducto && (
              <button onClick={() => setCreateOpen(true)} className="flex items-center gap-2 text-white text-sm font-semibold px-3 py-2.5 rounded-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg shadow-sm" style={{ backgroundColor: "#00D4FF" }}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                Agregar producto
              </button>
            )}
          </nav>
        </div>

        <div className="px-4 pb-6">
          <div className="bg-gray-50 rounded-xl p-3 flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0" style={{ backgroundColor: "#E5FBFF", color: "#00A8CC" }}>
              {profile.nombre.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-700 truncate">{profile.nombre}</p>
              <p className="text-xs text-gray-400 capitalize">{profile.rol}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-gray-400 hover:text-red-500 transition px-3 py-2 rounded-lg hover:bg-red-50 w-full">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* TOPBAR — solo móvil */}
      <div className="md:hidden w-full bg-white sticky top-0 z-50 shadow-md">
        <div className="w-full px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab("inventario")}>
            <img src={logo} alt="Logo InvenPrint" className="object-contain h-12" />
          </div>
          <button className="flex flex-col gap-1.5 p-2" onClick={() => setMenuOpen(!menuOpen)}>
            <span className={`block w-6 h-0.5 bg-gray-600 transition-all duration-300 ${menuOpen ? "rotate-45 translate-y-2" : ""}`} />
            <span className={`block w-6 h-0.5 bg-gray-600 transition-all duration-300 ${menuOpen ? "opacity-0" : ""}`} />
            <span className={`block w-6 h-0.5 bg-gray-600 transition-all duration-300 ${menuOpen ? "-rotate-45 -translate-y-2" : ""}`} />
          </button>
        </div>

        {menuOpen && (
          <div className="bg-white border-t border-gray-100 px-4 py-3 flex flex-col gap-1 shadow-lg">
            <div className="flex items-center gap-3 px-3 py-2 mb-2 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm font-semibold text-gray-700">{profile.nombre}</p>
                <p className="text-xs text-gray-400 capitalize">{profile.rol}</p>
              </div>
            </div>

            {[
              { tab: "inventario" as Tab, label: "Inventario" },
              { tab: "alertas" as Tab, label: "Alertas" },
              { tab: "reportes" as Tab, label: "Reportes" },
              ...(canVerProveedores ? [{ tab: "proveedores" as Tab, label: "Proveedores" }] : []),
              ...(isAdmin ? [{ tab: "usuarios" as Tab, label: "Usuarios" }] : []),
              ...(isAdmin ? [{ tab: "historial" as Tab, label: "Historial" }] : []),
            ].map(({ tab, label }) => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setMenuOpen(false); }}
                className={`text-left px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  activeTab === tab ? "bg-[#00D4FF] text-white" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {label}
                {tab === "alertas" && lowStockCount > 0 && (
                  <span className="ml-2 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">{lowStockCount}</span>
                )}
              </button>
            ))}

            <div className="h-px bg-gray-100 my-1" />

            {canAgregarProducto && (
              <button
                onClick={() => { setCreateOpen(true); setMenuOpen(false); }}
                className="flex items-center gap-2 text-white text-sm font-semibold px-3 py-2.5 rounded-lg"
                style={{ backgroundColor: "#00D4FF" }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                Agregar producto
              </button>
            )}

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-sm text-red-500 px-3 py-2.5 rounded-lg hover:bg-red-50 transition"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              Cerrar sesión
            </button>
          </div>
        )}
      </div>

      {/* CONTENIDO */}
      <div className="flex-1 min-w-0">
        {activeTab === "inventario" && (
          <PaperInventoryPage
            inventory={inventory}
            setInventory={setInventory}
            onGoToAlertas={() => setActiveTab("alertas")}
            onAddMovement={handleAddMovement}
            canEditarProducto={canEditarProducto}
            canEliminarProducto={canEliminarProducto}
            canRegistrarEntrada={canRegistrarEntrada}
            canRegistrarSalida={canRegistrarSalida}
            nombreResponsable={profile.nombre}
            proveedores={proveedores}
            isAdmin={isAdmin}
            canVerCTP={canVerCTP}
            canEditarCTP={canEditarCTP}
            canEliminarCTP={canEliminarCTP}
            canVerPapel={canVerPapel}
            canVerOFFSET={canVerOFFSET}
            canEditarOFFSET={canEditarOFFSET}
            canEliminarOFFSET={canEliminarOFFSET}
          />
        )}
        {activeTab === "alertas" && (
          <AlertasPage inventory={inventory} onGoToInventario={() => setActiveTab("inventario")} canVerCTP={canVerCTP} canVerPapel={canVerPapel} canVerOFFSET={canVerOFFSET} />
        )}
        {activeTab === "reportes" && (
          <ReportsPage
            inventory={inventory}
            isAdmin={isAdmin}
            canEditarEliminarReportes={canEditarEliminarReportes}
            onUpdateMovement={handleUpdateMovement}
            onDeleteMovement={handleDeleteMovement}
            canVerCTP={canVerCTP}
            canVerPapel={canVerPapel}
            canVerOFFSET={canVerOFFSET}
          />
        )}
        {activeTab === "proveedores" && canVerProveedores && (
          <ProveedoresPage
            proveedores={proveedores}
            setProveedores={setProveedores}
            canEditar={canEditarProveedores}
            canEliminar={canEliminarProveedores}
            inventory={inventory}
          />
        )}
        {activeTab === "usuarios" && isAdmin && (
          <UserManagementPage currentUserId={userId} />
        )}
        {activeTab === "historial" && isAdmin && (
          <HistorialPage />
        )}
      </div>

      {canAgregarProducto && (
        <CreatePaperDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreate={handleCreateMaterial}
          papers={inventory}
        />
      )}

      <Toaster />
    </div>
  );
}

export default App;