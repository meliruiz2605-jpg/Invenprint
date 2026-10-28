import { useState, useEffect, type ReactNode } from "react";
import { getProfiles, updateProfile, deleteUserProfile, createUserWithFunction, changeUserPassword } from "@/lib/supabaseService";
import { toast } from "@/hooks/use-toast";
import { PERMISOS_DEFAULT, PERMISOS_LABELS, type Permisos } from "@/features/auth/types/permisos";

interface Profile {
  id: string;
  nombre: string;
  email: string;
  rol: "admin" | "operador";
  permisos?: Permisos;
  created_at: string;
}

interface UserManagementPageProps {
  currentUserId: string;
}

// Agrupa los permisos en secciones temáticas para el desplegable del modal.
const PERMISOS_GRUPOS: { title: string; icon: ReactNode; keys: (keyof Permisos)[] }[] = [
  {
    title: "Inventario",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.73z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    ),
    keys: ["agregarProducto", "editarProducto", "eliminarProducto", "registrarEntrada", "registrarSalida"],
  },
  {
    title: "Proveedores",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 18V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h1" />
        <path d="M14 9h4l4 4v4a1 1 0 0 1-1 1h-2" />
        <circle cx="7" cy="18" r="2" />
        <circle cx="17" cy="18" r="2" />
      </svg>
    ),
    keys: ["verProveedores", "editarProveedores", "eliminarProveedores"],
  },
  {
    title: "Reportes",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="20" x2="12" y2="10" />
        <line x1="18" y1="20" x2="18" y2="4" />
        <line x1="6" y1="20" x2="6" y2="16" />
      </svg>
    ),
    keys: ["editarEliminarReportes"],
  },
  {
    title: "CTP",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="9" y1="21" x2="9" y2="9" />
      </svg>
    ),
    keys: ["verCTP", "editarCTP", "eliminarCTP"],
  },
  {
    title: "Papel",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
    keys: ["verPapel"],
  },
  {
    title: "OFFSET",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 3" />
      </svg>
    ),
    keys: ["verOFFSET", "editarOFFSET", "eliminarOFFSET"],
  },
];

export function UserManagementPage({ currentUserId }: UserManagementPageProps) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [permisosOpen, setPermisosOpen] = useState(false);
  const [nombreOpen, setNombreOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [actionsMenuId, setActionsMenuId] = useState<string | null>(null);

  // Form crear usuario
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState<"admin" | "operador">("operador");
  const [creating, setCreating] = useState(false);

  // Form cambiar contraseña
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // Form editar nombre
  const [editNombre, setEditNombre] = useState("");
  const [savingNombre, setSavingNombre] = useState(false);

  // Form permisos
  const [editPermisos, setEditPermisos] = useState<Permisos>(PERMISOS_DEFAULT);
  const [savingPermisos, setSavingPermisos] = useState(false);

  useEffect(() => {
    cargarPerfiles();
  }, []);

  async function cargarPerfiles() {
    try {
      const data = await getProfiles();
      setProfiles(data as Profile[]);
    } catch (error) {
      console.error("Error cargando perfiles:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!nombre || !email || !password) {
      toast({ title: "⚠️ Completa todos los campos", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      await createUserWithFunction(nombre, email, password, rol);
      await cargarPerfiles();
      setCreateOpen(false);
      setNombre(""); setEmail(""); setPassword(""); setRol("operador");
      toast({ title: "✅ Usuario creado correctamente" });
    } catch (error: any) {
      toast({ title: "❌ Error al crear usuario", description: error.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleRol(profile: Profile) {
    const nuevoRol = profile.rol === "admin" ? "operador" : "admin";
    try {
      await updateProfile(profile.id, { rol: nuevoRol });
      setProfiles(prev => prev.map(p => p.id === profile.id ? { ...p, rol: nuevoRol } : p));
      toast({ title: `✅ Rol actualizado a ${nuevoRol}` });
    } catch {
      toast({ title: "❌ Error actualizando rol", variant: "destructive" });
    }
  }

  async function handleDelete(profile: Profile) {
    if (!window.confirm(`¿Eliminar al usuario ${profile.nombre}?`)) return;
    try {
      await deleteUserProfile(profile.id);
      setProfiles(prev => prev.filter(p => p.id !== profile.id));
      toast({ title: "✅ Usuario eliminado" });
    } catch {
      toast({ title: "❌ Error eliminando usuario", variant: "destructive" });
    }
  }

  function openChangePassword(profile: Profile) {
    setSelectedUser(profile);
    setNewPassword("");
    setConfirmPassword("");
    setPasswordOpen(true);
  }

  async function handleChangePassword() {
    if (!newPassword || !confirmPassword) {
      toast({ title: "⚠️ Completa todos los campos", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "⚠️ Las contraseñas no coinciden", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "⚠️ La contraseña debe tener al menos 6 caracteres", variant: "destructive" });
      return;
    }
    setChangingPassword(true);
    try {
      await changeUserPassword(selectedUser!.id, newPassword);
      setPasswordOpen(false);
      setSelectedUser(null);
      toast({ title: "✅ Contraseña actualizada correctamente" });
    } catch (error: any) {
      toast({ title: "❌ Error al cambiar contraseña", description: error.message, variant: "destructive" });
    } finally {
      setChangingPassword(false);
    }
  }

  function openEditNombre(profile: Profile) {
    setSelectedUser(profile);
    setEditNombre(profile.nombre);
    setNombreOpen(true);
  }

  async function handleSaveNombre() {
    if (!selectedUser) return;
    const trimmed = editNombre.trim();
    if (!trimmed) {
      toast({ title: "⚠️ El nombre no puede estar vacío", variant: "destructive" });
      return;
    }
    setSavingNombre(true);
    try {
      await updateProfile(selectedUser.id, { nombre: trimmed });
      setProfiles(prev => prev.map(p => p.id === selectedUser.id ? { ...p, nombre: trimmed } : p));
      toast({ title: "✅ Nombre actualizado correctamente" });
      setNombreOpen(false);
      setSelectedUser(null);
    } catch (error: any) {
      toast({ title: "❌ Error al actualizar nombre", description: error.message, variant: "destructive" });
    } finally {
      setSavingNombre(false);
    }
  }

  function openPermisos(profile: Profile) {
    setSelectedUser(profile);
    // Se combina con PERMISOS_DEFAULT para que los permisos agregados
    // después de que este usuario ya tenía permisos guardados (como
    // "Ver Papel") se muestren con su valor por defecto en vez de
    // aparecer destildados por no existir todavía en lo guardado.
    setEditPermisos({ ...PERMISOS_DEFAULT, ...(profile.permisos ?? {}) });
    setPermisosOpen(true);
  }

  function togglePermiso(key: keyof Permisos) {
    setEditPermisos(prev => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleSavePermisos() {
    if (!selectedUser) return;
    setSavingPermisos(true);
    try {
      await updateProfile(selectedUser.id, { permisos: editPermisos });
      setProfiles(prev => prev.map(p => p.id === selectedUser.id ? { ...p, permisos: editPermisos } : p));
      toast({ title: "✅ Permisos actualizados" });
      setPermisosOpen(false);
      setSelectedUser(null);
    } catch (error: any) {
      toast({ title: "❌ Error al guardar permisos", description: error.message, variant: "destructive" });
    } finally {
      setSavingPermisos(false);
    }
  }

  const inputClass = "w-full border border-gray-200 bg-white px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00D4FF]/40 focus:border-[#00D4FF] transition-all duration-200";
  const labelClass = "block text-xs font-semibold text-gray-500 mb-1.5";

  return (
    <div className="w-full min-h-screen" style={{ backgroundColor: "#F7FBFC" }}>
      <div className="w-full px-4 md:px-12 py-6 md:py-10">

        {/* HEADER */}
        <div className="flex items-start justify-between mb-6 md:mb-8 gap-3">
          <div>
            <p className="text-xs font-bold tracking-widest text-gray-300 mb-1">USUARIOS</p>
            <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900">Gestión de usuarios</h1>
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 text-white text-sm font-semibold px-4 py-2.5 rounded-full transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg shadow-sm shrink-0"
            style={{ backgroundColor: "#00D4FF" }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="16"/>
              <line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
            Nuevo usuario
          </button>
        </div>

        {/* MODAL CREAR USUARIO */}
        {createOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
              <div className="px-6 py-5" style={{ backgroundColor: "#00D4FF" }}>
                <h2 className="text-xl font-bold text-white">Nuevo Usuario</h2>
                <p className="text-white/80 text-xs mt-1">Completa los datos del nuevo usuario</p>
              </div>
              <div className="px-6 py-5 space-y-4">
                <div>
                  <label className={labelClass}>Nombre completo *</label>
                  <input className={inputClass} value={nombre} onChange={(e) => setNombre(e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Correo electrónico *</label>
                  <input type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Contraseña *</label>
                  <input type="password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Rol</label>
                  <select className={inputClass} value={rol} onChange={(e) => setRol(e.target.value as "admin" | "operador")}>
                    <option value="operador">Operador</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setCreateOpen(false)} className="flex-1 py-2.5 rounded-full text-sm font-semibold border border-gray-300 text-gray-600 hover:bg-gray-50 transition-all duration-200">Cancelar</button>
                  <button onClick={handleCreate} disabled={creating} className="flex-1 py-2.5 rounded-full text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg shadow-sm disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-sm" style={{ backgroundColor: "#00D4FF" }}>
                    {creating ? "Creando..." : "Crear usuario"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL EDITAR NOMBRE */}
        {nombreOpen && selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
              <div className="px-6 py-5" style={{ backgroundColor: "#00D4FF" }}>
                <h2 className="text-xl font-bold text-white">Editar Nombre</h2>
                <p className="text-white/80 text-xs mt-1">Usuario: {selectedUser.nombre}</p>
              </div>
              <div className="px-6 py-5 space-y-4">
                <div>
                  <label className={labelClass}>Nombre completo *</label>
                  <input
                    className={inputClass}
                    value={editNombre}
                    onChange={(e) => setEditNombre(e.target.value)}
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => { setNombreOpen(false); setSelectedUser(null); }} className="flex-1 py-2.5 rounded-full text-sm font-semibold border border-gray-300 text-gray-600 hover:bg-gray-50 transition-all duration-200">Cancelar</button>
                  <button onClick={handleSaveNombre} disabled={savingNombre} className="flex-1 py-2.5 rounded-full text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg shadow-sm disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-sm" style={{ backgroundColor: "#00D4FF" }}>
                    {savingNombre ? "Guardando..." : "Guardar nombre"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL CAMBIAR CONTRASEÑA */}
        {passwordOpen && selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
              <div className="px-6 py-5" style={{ backgroundColor: "#00D4FF" }}>
                <h2 className="text-xl font-bold text-white">Cambiar Contraseña</h2>
                <p className="text-white/80 text-xs mt-1">Usuario: {selectedUser.nombre}</p>
              </div>
              <div className="px-6 py-5 space-y-4">
                <div>
                  <label className={labelClass}>Nueva contraseña *</label>
                  <input
                    placeholder="Mínimo 6 caracteres"
                    type="password"
                    className={inputClass}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>Confirmar contraseña *</label>
                  <input
                    placeholder="Repite la contraseña"
                    type="password"
                    className={inputClass}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
                {newPassword && confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-xs text-red-500">⚠️ Las contraseñas no coinciden</p>
                )}
                <div className="flex gap-3 pt-2">
                  <button onClick={() => { setPasswordOpen(false); setSelectedUser(null); }} className="flex-1 py-2.5 rounded-full text-sm font-semibold border border-gray-300 text-gray-600 hover:bg-gray-50 transition-all duration-200">Cancelar</button>
                  <button onClick={handleChangePassword} disabled={changingPassword} className="flex-1 py-2.5 rounded-full text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg shadow-sm disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-sm" style={{ backgroundColor: "#00D4FF" }}>
                    {changingPassword ? "Guardando..." : "Guardar contraseña"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL PERMISOS */}
        {permisosOpen && selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden max-h-[85vh] flex flex-col">
              <div className="px-6 py-5 shrink-0" style={{ backgroundColor: "#00D4FF" }}>
                <h2 className="text-xl font-bold text-white">Permisos</h2>
                <p className="text-white/80 text-xs mt-1">Usuario: {selectedUser.nombre}</p>
              </div>
              <div className="px-6 py-5 space-y-3 overflow-y-auto">
                <p className="text-xs text-gray-400 mb-1">Marca las acciones que este operador puede realizar.</p>

                {PERMISOS_GRUPOS.map((grupo) => {
                  const activos = grupo.keys.filter((k) => editPermisos[k]).length;
                  const abierto = openGroups[grupo.title] ?? true;
                  return (
                    <div key={grupo.title} className="border border-gray-100 rounded-xl overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setOpenGroups((prev) => ({ ...prev, [grupo.title]: !abierto }))}
                        className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors duration-150"
                      >
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "#E5FBFF", color: "#00A8CC" }}>
                          {grupo.icon}
                        </div>
                        <span className="text-sm font-bold text-gray-800 flex-1 text-left">{grupo.title}</span>
                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={activos > 0 ? { backgroundColor: "#E5FBFF", color: "#00A8CC" } : { backgroundColor: "#F3F4F6", color: "#9CA3AF" }}
                        >
                          {activos}/{grupo.keys.length}
                        </span>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4 text-gray-400 transition-transform duration-200"
                          style={{ transform: abierto ? "rotate(180deg)" : "rotate(0deg)" }}
                          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>
                      {abierto && (
                        <div className="px-4 py-1 divide-y divide-gray-50">
                          {grupo.keys.map((key) => {
                            const label = PERMISOS_LABELS.find((p) => p.key === key)?.label ?? key;
                            return (
                              <label key={key} className="flex items-center gap-3 py-2.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={editPermisos[key]}
                                  onChange={() => togglePermiso(key)}
                                  className="w-4 h-4 rounded accent-[#00D4FF]"
                                />
                                <span className="text-sm text-gray-700">{label}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                <div className="flex gap-3 pt-3">
                  <button onClick={() => { setPermisosOpen(false); setSelectedUser(null); }} className="flex-1 py-2.5 rounded-full text-sm font-semibold border border-gray-300 text-gray-600 hover:bg-gray-50 transition-all duration-200">Cancelar</button>
                  <button onClick={handleSavePermisos} disabled={savingPermisos} className="flex-1 py-2.5 rounded-full text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg shadow-sm disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-sm" style={{ backgroundColor: "#00D4FF" }}>
                    {savingPermisos ? "Guardando..." : "Guardar permisos"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TABLA */}
        <div className="rounded-2xl shadow-sm border border-gray-100 overflow-hidden bg-white">
          <div className="px-4 md:px-8 pt-5 pb-4 border-b border-gray-100 flex items-center gap-2">
            <h2 className="text-base font-bold text-gray-800">Usuarios registrados</h2>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full ml-2" style={{ color: "#00A8CC", backgroundColor: "#E5FBFF" }}>
              {profiles.length} usuarios
            </span>
          </div>

          {loading ? (
            <div className="text-center py-16 text-gray-400">
              <div className="w-8 h-8 rounded-full border-4 animate-spin mx-auto mb-3" style={{ borderColor: "#00D4FF", borderTopColor: "transparent" }} />
              <p className="text-sm">Cargando usuarios...</p>
            </div>
          ) : (
            <div className="overflow-x-auto overflow-y-visible">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] font-bold tracking-widest text-gray-400 uppercase border-b border-gray-100">
                    <th className="px-6 py-3 text-left">Usuario</th>
                    <th className="px-4 py-3 text-left">Email</th>
                    <th className="px-4 py-3 text-left">Rol</th>
                    <th className="px-4 py-3 text-left">Fecha registro</th>
                    <th className="px-4 py-3 text-left">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((profile, profileIndex) => {
                    const openUpward = profileIndex >= profiles.length - 2;
                    return (
                    <tr key={profile.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors duration-150">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ backgroundColor: "#E5FBFF", color: "#00A8CC" }}>
                            {profile.nombre.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-semibold text-gray-800">{profile.nombre}</span>
                          {profile.id === currentUserId && (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#E5FBFF", color: "#00A8CC" }}>Tú</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-gray-500">{profile.email}</td>
                      <td className="px-4 py-4">
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold capitalize"
                          style={profile.rol === "admin"
                            ? { backgroundColor: "#EEF2FF", color: "#4F46E5" }
                            : { backgroundColor: "#ECFDF5", color: "#059669" }}
                        >
                          {profile.rol === "admin" ? "👑 Admin" : "👤 Operador"}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-gray-400 text-xs">
                        {new Date(profile.created_at).toLocaleDateString("es-CO")}
                      </td>
                      <td className="px-4 py-4 relative">
                        <button
                          onClick={() => setActionsMenuId((prev) => (prev === profile.id ? null : profile.id))}
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all duration-200"
                        >
                          Acciones
                          <svg
                            xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 transition-transform duration-200"
                            style={{ transform: actionsMenuId === profile.id ? "rotate(180deg)" : "rotate(0deg)" }}
                            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                          >
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </button>

                        {actionsMenuId === profile.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setActionsMenuId(null)} />
                            <div className={`absolute right-4 w-56 bg-white border border-gray-100 rounded-xl shadow-lg z-20 overflow-hidden py-1 ${openUpward ? "bottom-full mb-1" : "top-full mt-1"}`}>
                              {/* Editar nombre — disponible para todos */}
                              <button
                                onClick={() => { openEditNombre(profile); setActionsMenuId(null); }}
                                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#00A8CC" }}>
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                                Editar nombre
                              </button>

                              {/* Cambiar contraseña — disponible para todos */}
                              <button
                                onClick={() => { openChangePassword(profile); setActionsMenuId(null); }}
                                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#00A8CC" }}>
                                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                </svg>
                                Cambiar contraseña
                              </button>

                              {/* Permisos — solo para operadores (el admin siempre tiene todo) */}
                              {profile.rol === "operador" && (
                                <button
                                  onClick={() => { openPermisos(profile); setActionsMenuId(null); }}
                                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-purple-600 hover:bg-purple-50 transition-colors duration-150"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                    <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                                  </svg>
                                  Permisos
                                </button>
                              )}

                              {/* Cambiar rol y eliminar — solo para otros usuarios */}
                              {profile.id !== currentUserId && (
                                <>
                                  <div className="border-t border-gray-50 my-1" />
                                  <button
                                    onClick={() => { handleToggleRol(profile); setActionsMenuId(null); }}
                                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
                                      <polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
                                    </svg>
                                    Cambiar rol
                                  </button>
                                  <button
                                    onClick={() => { handleDelete(profile); setActionsMenuId(null); }}
                                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors duration-150"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="3 6 5 6 21 6" />
                                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                      <path d="M10 11v6" /><path d="M14 11v6" />
                                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                                    </svg>
                                    Eliminar usuario
                                  </button>
                                </>
                              )}
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}