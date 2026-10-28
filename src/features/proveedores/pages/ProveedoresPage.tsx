import { useState } from "react";
import type { Proveedor } from "../types/proveedor";
import type { Paper } from "@/features/inventory/types/paper";
import { pluralizeUnit } from "@/lib/conversions";
import { CATEGORIAS } from "@/features/inventory/types/categorias";
import { createProveedor, updateProveedor, deleteProveedor } from "@/lib/supabaseService";
import { toast } from "@/hooks/use-toast";

interface ProveedoresPageProps {
  proveedores: Proveedor[];
  setProveedores: React.Dispatch<React.SetStateAction<Proveedor[]>>;
  canEditar: boolean;
  canEliminar: boolean;
  inventory: Paper[];
}

const inputClass = "w-full border border-gray-200 bg-white p-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00D4FF]/40 focus:border-[#00D4FF] transition-all duration-200";

function getInitials(nombre: string): string {
  const words = nombre.trim().split(/\s+/);
  const first = words[0]?.[0] ?? "";
  const second = words[1]?.[0] ?? "";
  return (first + second).toUpperCase();
}

function formatFecha(dateStr: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T/.test(dateStr)) return dateStr;
  const d = new Date(dateStr);
  const datePart = d
    .toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Bogota" })
    .replace(".", "");
  const timePart = d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Bogota" });
  return `${datePart} · ${timePart}`;
}

export function ProveedoresPage({ proveedores, setProveedores, canEditar, canEliminar, inventory }: ProveedoresPageProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoriaFilter, setCategoriaFilter] = useState<string>("Todas");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Proveedor | null>(null);
  const [saving, setSaving] = useState(false);

  const [nit, setNit] = useState("");
  const [nombre, setNombre] = useState("");
  const [categoriasSel, setCategoriasSel] = useState<string[]>([]);
  const [historialProveedor, setHistorialProveedor] = useState<Proveedor | null>(null);

  const compras = historialProveedor
    ? inventory
        .flatMap((paper) =>
          paper.movements
            .filter((m) => m.type === "entrada" && m.supplier === historialProveedor.nombre)
            .map((m) => ({
              id: m.id,
              date: m.date,
              product: paper.product,
              code: paper.code,
              cantidad: m.originalQuantity ?? m.quantity,
              unidad: m.originalUnit ?? paper.unit,
              invoiceNumber: m.invoiceNumber,
            }))
        )
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    : [];

  const filtered = proveedores.filter((p) => {
    const matchesSearch =
      p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.nit.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategoria = categoriaFilter === "Todas" || p.categorias.includes(categoriaFilter);
    return matchesSearch && matchesCategoria;
  });

  function openCreate() {
    setEditing(null);
    setNit("");
    setNombre("");
    setCategoriasSel([]);
    setFormOpen(true);
  }

  function openEdit(p: Proveedor) {
    setEditing(p);
    setNit(p.nit);
    setNombre(p.nombre);
    setCategoriasSel(p.categorias);
    setFormOpen(true);
  }

  function toggleCategoria(cat: string) {
    setCategoriasSel((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }

  async function handleSave() {
    if (!nit || !nombre || categoriasSel.length === 0) {
      toast({ title: "⚠️ Completa todos los campos", description: "Selecciona al menos una categoría.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateProveedor(editing.id, { nit, nombre, categorias: categoriasSel });
        setProveedores((prev) => prev.map((p) => (p.id === editing.id ? { ...p, nit, nombre, categorias: categoriasSel } : p)));
        toast({ title: "✅ Proveedor actualizado" });
      } else {
        const nuevo = await createProveedor({ nit, nombre, categorias: categoriasSel });
        setProveedores((prev) => [...prev, nuevo]);
        toast({ title: "✅ Proveedor creado" });
      }
      setFormOpen(false);
    } catch (error: any) {
      toast({ title: "❌ Error al guardar", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(p: Proveedor) {
    if (!window.confirm(`¿Eliminar al proveedor ${p.nombre}?`)) return;
    try {
      await deleteProveedor(p.id);
      setProveedores((prev) => prev.filter((x) => x.id !== p.id));
      toast({ title: "✅ Proveedor eliminado" });
    } catch (error: any) {
      toast({ title: "❌ Error al eliminar", description: error.message, variant: "destructive" });
    }
  }

  return (
    <div className="w-full min-h-screen" style={{ backgroundColor: "#F7FBFC" }}>
      <div className="w-full px-4 md:px-12 py-6 md:py-10">

        {/* HEADER */}
        <div className="flex items-start justify-between mb-6 md:mb-8 gap-3">
          <div>
            <p className="text-xs font-bold tracking-widest text-gray-300 mb-1">PROVEEDORES</p>
            <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900">Proveedores de materia prima</h1>
          </div>
          {canEditar && (
            <button
              onClick={openCreate}
              className="flex items-center gap-2 text-white text-sm font-semibold px-4 py-2.5 rounded-full transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg shadow-sm shrink-0"
              style={{ backgroundColor: "#00D4FF" }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
              </svg>
              Nuevo proveedor
            </button>
          )}
        </div>

        {/* MODAL CREAR/EDITAR */}
        {formOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
              <div className="px-6 py-5" style={{ backgroundColor: "#00D4FF" }}>
                <h2 className="text-xl font-bold text-white">{editing ? "Editar Proveedor" : "Nuevo Proveedor"}</h2>
              </div>
              <div className="px-6 py-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">NIT *</label>
                  <input className={inputClass} value={nit} onChange={(e) => setNit(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Razón Social *</label>
                  <input className={inputClass} value={nombre} onChange={(e) => setNombre(e.target.value)} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2">Categorías *</p>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIAS.map((cat) => {
                      const active = categoriasSel.includes(cat);
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => toggleCategoria(cat)}
                          className="px-3.5 py-2 rounded-full text-sm font-semibold border transition-all duration-200"
                          style={active
                            ? { backgroundColor: "#00D4FF", color: "white", borderColor: "#00D4FF" }
                            : { backgroundColor: "white", color: "#6b7280", borderColor: "#e5e7eb" }}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setFormOpen(false)} className="flex-1 py-2.5 rounded-full text-sm font-semibold border border-gray-300 text-gray-600 hover:bg-gray-50 transition-all duration-200">Cancelar</button>
                  <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-full text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg shadow-sm disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-sm" style={{ backgroundColor: "#00D4FF" }}>
                    {saving ? "Guardando..." : "Guardar"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TABLA */}
        <div className="rounded-2xl shadow-sm border border-gray-100 overflow-hidden bg-white">
          <div className="px-4 md:px-8 pt-5 pb-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex items-center gap-2 shrink-0">
              <h2 className="text-base font-bold text-gray-800">Proveedores registrados</h2>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ color: "#00A8CC", backgroundColor: "#E5FBFF" }}>
                {filtered.length} proveedores
              </span>
            </div>

            <div className="flex flex-col md:flex-row md:items-center gap-2 md:ml-auto w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <span className="material-icons absolute left-4 top-2.5 text-gray-300 text-xl">search</span>
                <input
                  type="text"
                  placeholder="Buscar por nombre o NIT..."
                  className="w-full border border-gray-200 pl-11 pr-3 py-2.5 rounded-full text-sm focus:outline-none bg-white transition-all duration-200"
                  onFocus={(e) => (e.target.style.boxShadow = "0 0 0 2px #00D4FF")}
                  onBlur={(e) => (e.target.style.boxShadow = "none")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-full w-fit shrink-0">
                {["Todas", ...CATEGORIAS].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setCategoriaFilter(tab)}
                    className="px-4 py-1.5 rounded-full text-sm font-semibold transition-all duration-200"
                    style={categoriaFilter === tab
                      ? { backgroundColor: "white", color: "#00A8CC", boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }
                      : { color: "#6b7280" }}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-3">🏭</p>
              <p className="font-medium">No hay proveedores registrados</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] font-bold tracking-widest text-gray-400 uppercase border-b border-gray-100">
                    <th className="px-6 py-3 text-left">Proveedor</th>
                    <th className="px-4 py-3 text-left">NIT</th>
                    <th className="px-4 py-3 text-left">Categorías</th>
                    {(canEditar || canEliminar) && <th className="px-4 py-3 text-left">Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => setHistorialProveedor(p)}
                      className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors duration-150 cursor-pointer"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ backgroundColor: "#E5FBFF", color: "#00A8CC" }}>
                            {getInitials(p.nombre)}
                          </div>
                          <span className="font-semibold text-gray-800">{p.nombre}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 font-mono text-gray-500">{p.nit}</td>
                      <td className="px-4 py-4">
                        <div className="flex gap-1.5 flex-wrap">
                          {p.categorias.map((cat) => (
                            <span key={cat} className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: "#E5FBFF", color: "#00A8CC" }}>
                              {cat}
                            </span>
                          ))}
                        </div>
                      </td>
                      {(canEditar || canEliminar) && (
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            {canEditar && (
                              <button onClick={(e) => { e.stopPropagation(); openEdit(p); }} title="Editar" className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-50 transition-all duration-200 hover:scale-110 hover:bg-[#E5FBFF]" style={{ color: "#00A8CC" }}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                </svg>
                              </button>
                            )}
                            {canEliminar && (
                              <button onClick={(e) => { e.stopPropagation(); handleDelete(p); }} title="Eliminar" className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-50 text-red-400 transition-all duration-200 hover:scale-110 hover:bg-red-50 hover:text-red-500">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6"/>
                                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                                  <path d="M10 11v6"/><path d="M14 11v6"/>
                                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                                </svg>
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* MODAL HISTORIAL DE COMPRAS */}
        {historialProveedor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
              <div className="px-6 py-5 shrink-0" style={{ backgroundColor: "#00D4FF" }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-xl font-bold text-white truncate">{historialProveedor.nombre}</h2>
                    <p className="text-white/80 text-xs mt-1">Historial de compras · {compras.length} {compras.length === 1 ? "registro" : "registros"}</p>
                  </div>
                  <button
                    onClick={() => setHistorialProveedor(null)}
                    className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/90 border border-white/50 shadow-sm transition-all duration-200 hover:bg-white hover:scale-105 shrink-0"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="px-6 py-5 overflow-y-auto">
                {compras.length === 0 ? (
                  <div className="text-center py-10 text-gray-400">
                    <p className="text-4xl mb-3">📦</p>
                    <p className="font-medium text-sm">Todavía no hay entradas registradas con este proveedor</p>
                    <p className="text-xs mt-1">Las compras aparecen aquí cuando registras una entrada de inventario y seleccionas este proveedor.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {compras.map((c) => (
                      <div key={c.id} className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                        <div className="flex justify-between items-start gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-800 text-sm truncate">{c.product}</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              <span className="font-mono">{c.code}</span>
                              <span className="mx-1">·</span>
                              {formatFecha(c.date)}
                              {c.invoiceNumber && (
                                <>
                                  <span className="mx-1">·</span>
                                  Fact. {c.invoiceNumber}
                                </>
                              )}
                            </p>
                          </div>
                          <div className="text-sm font-bold text-emerald-600 text-right shrink-0">
                            +{c.cantidad} {pluralizeUnit(c.cantidad, c.unidad)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}