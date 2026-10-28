import { useState, useEffect, useMemo } from "react";
import { getHistorialMovimientos } from "@/lib/supabaseService";
import type { HistorialMovimiento } from "@/features/historial/types/historial";
import { pluralizeUnit } from "@/lib/conversions";

const ITEMS_PER_PAGE = 15;

// Etiquetas en español para los campos que puede tener un movimiento,
// usadas para mostrar de forma legible qué cambió entre el "antes" y el "después".
const CAMPO_LABELS: Record<string, string> = {
  type: "Tipo",
  motivo: "Motivo",
  order_number: "N° de orden de producción",
  authorization_number: "N° de autorización",
  ctp_order_number: "N° de orden CTP",
  orden_danio: "N° de orden (daño)",
  invoice_number: "N° de factura",
  supplier: "Proveedor",
  responsible: "Responsable",
  observations: "Observaciones",
  date: "Fecha del movimiento",
};

// Orden en el que se muestran los campos (los más relevantes primero).
const CAMPOS_ORDEN = [
  "type", "motivo", "order_number", "authorization_number", "ctp_order_number",
  "orden_danio", "invoice_number", "supplier", "responsible", "observations", "date",
];

// "quantity", "original_quantity" y "original_unit" no se muestran como
// campos separados (sería redundante): se combinan en una sola línea de
// "Cantidad" con formatCantidad(). "subtype" tampoco se muestra directo:
// es un dato interno para saber cuál de los números de orden aplica, y esa
// información ya queda clara mostrando ese número con su propia etiqueta.
const CAMPOS_OCULTOS = new Set(["id", "paper_code", "created_at", "edited_by", "edited_at", "is_initial", "subtype", "quantity", "original_quantity", "original_unit"]);

function formatDate(fecha: string): string {
  return new Date(fecha).toLocaleString("es-CO", { timeZone: "America/Bogota" });
}

// Misma lógica que en Reportes: convierte una fecha/hora a la "clave" del
// día en el que cae según la hora de Bogotá, para poder compararla contra
// los campos Desde/Hasta del filtro (que son fechas simples, sin hora).
function getBogotaDateKey(fecha: string): string {
  return new Date(fecha).toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
}

function formatFechaCorta(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

// Da formato legible a un valor, según de qué campo se trate.
function formatCampoValor(clave: string, valor: any): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  if (clave === "date") return formatDate(valor);
  if (clave === "type") return valor === "entrada" ? "Entrada" : valor === "salida" ? "Salida" : String(valor);
  return String(valor);
}

// Junta cantidad + unidad en un solo texto legible, priorizando lo que el
// usuario escribió originalmente (ej: "5 Litros") sobre el número ya
// convertido a la unidad base que se guarda internamente.
function formatCantidad(row: any): string {
  if (!row) return "—";
  if (row.original_quantity !== null && row.original_quantity !== undefined) {
    const unidad = row.original_unit ? ` ${pluralizeUnit(row.original_quantity, row.original_unit)}` : "";
    return `${row.original_quantity}${unidad}`;
  }
  return row.quantity !== null && row.quantity !== undefined ? String(row.quantity) : "—";
}

// Arma la lista ordenada de campos con datos (sin vacíos) de un movimiento,
// usada para mostrar el detalle de un movimiento eliminado.
function buildDetalle(row: any): { campo: string; valor: string }[] {
  if (!row) return [];
  const items: { campo: string; valor: string }[] = [];
  const cantidad = formatCantidad(row);
  if (cantidad !== "—") items.push({ campo: "Cantidad", valor: cantidad });
  CAMPOS_ORDEN.forEach((clave) => {
    if (!(clave in row)) return;
    const valor = formatCampoValor(clave, row[clave]);
    if (valor !== "—") items.push({ campo: CAMPO_LABELS[clave] ?? clave, valor });
  });
  return items;
}

function diffCampos(anterior: any, nuevo: any): { campo: string; antes: string; despues: string }[] {
  if (!anterior || !nuevo) return [];
  const cambios: { campo: string; antes: string; despues: string }[] = [];

  const cantidadAntes = formatCantidad(anterior);
  const cantidadDespues = formatCantidad(nuevo);
  if (cantidadAntes !== cantidadDespues) {
    cambios.push({ campo: "Cantidad", antes: cantidadAntes, despues: cantidadDespues });
  }

  CAMPOS_ORDEN.forEach((clave) => {
    if (CAMPOS_OCULTOS.has(clave)) return;
    const antes = anterior[clave] ?? null;
    const despues = nuevo[clave] ?? null;
    if (antes !== despues) {
      cambios.push({
        campo: CAMPO_LABELS[clave] ?? clave,
        antes: formatCampoValor(clave, antes),
        despues: formatCampoValor(clave, despues),
      });
    }
  });
  return cambios;
}

function AccionBadge({ accion }: { accion: "editar" | "eliminar" }) {
  const esEliminar = accion === "eliminar";
  return (
    <span
      className="px-3 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 border w-fit"
      style={esEliminar
        ? { backgroundColor: "#FEF2F2", color: "#D90000", borderColor: "#FECACA" }
        : { backgroundColor: "#F0FDFF", color: "#00A8CC", borderColor: "#B3F0FF" }}
    >
      {esEliminar ? "Eliminado" : "Editado"}
    </span>
  );
}

export function HistorialPage() {
  const [historial, setHistorial] = useState<HistorialMovimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAccion, setFilterAccion] = useState<"todos" | "editar" | "eliminar">("todos");
  const [search, setSearch] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [fechaMenuOpen, setFechaMenuOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    cargarHistorial();
  }, []);

  async function cargarHistorial() {
    setLoading(true);
    try {
      const data = await getHistorialMovimientos();
      setHistorial(data);
    } catch (error) {
      console.error("Error cargando historial:", error);
    } finally {
      setLoading(false);
    }
  }

  const filteredRows = useMemo(() => {
    const texto = search.trim().toLowerCase();
    return historial.filter((h) => {
      if (filterAccion !== "todos" && h.accion !== filterAccion) return false;
      if (fechaDesde || fechaHasta) {
        const rowKey = getBogotaDateKey(h.fecha);
        if (fechaDesde && rowKey < fechaDesde) return false;
        if (fechaHasta && rowKey > fechaHasta) return false;
      }
      if (!texto) return true;
      return (
        (h.productoNombre ?? "").toLowerCase().includes(texto) ||
        (h.paperCode ?? "").toLowerCase().includes(texto) ||
        h.usuarioNombre.toLowerCase().includes(texto)
      );
    });
  }, [historial, filterAccion, search, fechaDesde, fechaHasta]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / ITEMS_PER_PAGE));
  const pageRows = filteredRows.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  function handleFilterAccionChange(v: "todos" | "editar" | "eliminar") {
    setFilterAccion(v);
    setCurrentPage(1);
  }

  function handleSearchChange(v: string) {
    setSearch(v);
    setCurrentPage(1);
  }

  function handleFechaDesdeChange(v: string) {
    setFechaDesde(v);
    setCurrentPage(1);
  }

  function handleFechaHastaChange(v: string) {
    setFechaHasta(v);
    setCurrentPage(1);
  }

  const fechaFilterLabel = fechaDesde && fechaHasta
    ? `${formatFechaCorta(fechaDesde)} - ${formatFechaCorta(fechaHasta)}`
    : fechaDesde
    ? `Desde ${formatFechaCorta(fechaDesde)}`
    : fechaHasta
    ? `Hasta ${formatFechaCorta(fechaHasta)}`
    : "Fecha";

  const totalEdiciones = historial.filter((h) => h.accion === "editar").length;
  const totalEliminaciones = historial.filter((h) => h.accion === "eliminar").length;

  return (
    <div className="w-full min-h-screen" style={{ backgroundColor: "#F7FBFC" }}>
      <div className="w-full px-4 md:px-12 py-6 md:py-10">

        {/* HEADER */}
        <div className="flex items-start justify-between mb-6 md:mb-8 gap-3">
          <div>
            <p className="text-xs font-bold tracking-widest text-gray-300 mb-1">HISTORIAL</p>
            <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900">Historial de movimientos</h1>
            <p className="text-sm text-gray-400 mt-1">Trazabilidad de edición y eliminación</p>
          </div>
        </div>

        {/* RESUMEN */}
        <div className="grid grid-cols-3 gap-3 md:gap-4 mb-4">
          {[
            { label: "Total de cambios", value: historial.length, color: "#00A8CC", bg: "#E5FBFF" },
            { label: "Ediciones", value: totalEdiciones, color: "#00A8CC", bg: "#E5FBFF" },
            { label: "Eliminaciones", value: totalEliminaciones, color: "#D90000", bg: "#fee2e2" },
          ].map((item) => (
            <div key={item.label} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 md:p-5 flex flex-col md:flex-row items-center md:items-start gap-2 md:gap-4">
              <div className="text-center md:text-left w-full">
                <p className="text-xs text-gray-400 leading-tight">{item.label}</p>
                <p className="text-xl md:text-2xl font-bold" style={{ color: item.color }}>{item.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* LISTA */}
        <div className="rounded-2xl shadow-sm border border-gray-100 overflow-hidden bg-white">
          <div className="px-4 md:px-8 pt-5 pb-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex items-center gap-2 shrink-0">
              <h2 className="text-base font-bold text-gray-800">Historial de actividad</h2>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ color: "#00A8CC", backgroundColor: "#E5FBFF" }}>
                {filteredRows.length} cambios
              </span>
            </div>

            <div className="flex flex-col md:flex-row md:items-center gap-2 md:ml-auto w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <span className="material-icons absolute left-4 top-2.5 text-gray-300 text-xl">search</span>
                <input
                  type="text"
                  placeholder="Buscar producto, código o usuario..."
                  className="w-full border border-gray-200 pl-11 pr-3 py-2.5 rounded-full text-sm focus:outline-none bg-white transition-all duration-200"
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-full w-fit shrink-0">
                {(["todos", "editar", "eliminar"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => handleFilterAccionChange(v)}
                    className="px-4 py-1.5 rounded-full text-sm font-semibold transition-all duration-200"
                    style={filterAccion === v
                      ? { backgroundColor: "white", color: v === "eliminar" ? "#D90000" : "#00A8CC", boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }
                      : { color: "#6b7280" }}
                  >
                    {v === "todos" ? "Todos" : v === "editar" ? "Ediciones" : "Eliminaciones"}
                  </button>
                ))}
              </div>

              <div className="relative shrink-0">
                <button
                  onClick={() => setFechaMenuOpen((v) => !v)}
                  className="px-4 py-2.5 rounded-full text-sm font-medium border transition-all duration-200 flex items-center gap-1.5"
                  style={(fechaDesde || fechaHasta)
                    ? { backgroundColor: "#374151", color: "white", borderColor: "#374151" }
                    : { backgroundColor: "white", color: "#6b7280", borderColor: "#d1d5db" }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  {fechaFilterLabel}
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>

                {fechaMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setFechaMenuOpen(false)} />
                    <div className="absolute right-0 mt-1 w-72 max-w-[calc(100vw-2rem)] bg-white border border-gray-200 rounded-xl shadow-lg z-20 p-4">
                      <div className="space-y-2">
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 mb-1">Desde</label>
                          <input
                            type="date"
                            className="w-full border border-gray-200 bg-white p-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00D4FF]/40 focus:border-[#00D4FF] transition-all duration-200"
                            value={fechaDesde}
                            max={fechaHasta || undefined}
                            onChange={(e) => handleFechaDesdeChange(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 mb-1">Hasta</label>
                          <input
                            type="date"
                            className="w-full border border-gray-200 bg-white p-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00D4FF]/40 focus:border-[#00D4FF] transition-all duration-200"
                            value={fechaHasta}
                            min={fechaDesde || undefined}
                            onChange={(e) => handleFechaHastaChange(e.target.value)}
                          />
                        </div>
                      </div>
                      {(fechaDesde || fechaHasta) && (
                        <button
                          onClick={() => { setFechaDesde(""); setFechaHasta(""); setCurrentPage(1); }}
                          className="w-full mt-3 text-center text-xs text-gray-400 hover:text-gray-600 transition-all duration-200"
                        >
                          ✕ Quitar filtro de fecha
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-16 text-gray-400">
              <div className="w-8 h-8 rounded-full border-4 animate-spin mx-auto mb-3" style={{ borderColor: "#00D4FF", borderTopColor: "transparent" }} />
              <p className="text-sm">Cargando historial...</p>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-3">🗂️</p>
              <p className="font-medium">Aún no hay actividad para mostrar</p>
              <p className="text-sm mt-1">Aquí aparecerán las ediciones y eliminaciones de movimientos</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {pageRows.map((h) => {
                const isExpanded = expandedId === h.id;
                const cambios = h.accion === "editar" ? diffCampos(h.snapshotAnterior, h.snapshotNuevo) : [];
                return (
                  <div key={h.id} className="px-4 md:px-8 py-4">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : h.id)}
                      className="w-full flex items-start justify-between gap-3 text-left"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <AccionBadge accion={h.accion} />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">
                            {h.productoNombre ?? "Producto no disponible"}
                            {h.paperCode ? <span className="text-gray-400 font-normal"> · {h.paperCode}</span> : null}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            por <span className="font-medium text-gray-500">{h.usuarioNombre}</span> · {formatDate(h.fecha)}
                          </p>
                        </div>
                      </div>
                      <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 shrink-0 mt-1 text-gray-400 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>

                    {isExpanded && (
                      <div className="mt-3 ml-1 md:ml-8 bg-gray-50 rounded-xl p-4">
                        {h.accion === "eliminar" ? (
                          <>
                            <p className="text-xs font-semibold text-gray-500 mb-2">Datos del movimiento eliminado:</p>
                            <div className="space-y-1">
                              {buildDetalle(h.snapshotAnterior).map((item) => (
                                <p key={item.campo} className="text-sm text-gray-600">
                                  <span className="text-gray-400">{item.campo}:</span> {item.valor}
                                </p>
                              ))}
                            </div>
                          </>
                        ) : cambios.length === 0 ? (
                          <p className="text-sm text-gray-400">No se detectaron cambios en los datos del movimiento.</p>
                        ) : (
                          <>
                            <p className="text-xs font-semibold text-gray-500 mb-2">Qué cambió:</p>
                            <div className="space-y-1.5">
                              {cambios.map((c) => (
                                <p key={c.campo} className="text-sm text-gray-600">
                                  <span className="text-gray-400">{c.campo}:</span>{" "}
                                  <span className="line-through text-gray-400">{c.antes}</span>{" "}
                                  <span className="text-gray-400">→</span>{" "}
                                  <span className="font-medium text-gray-700">{c.despues}</span>
                                </p>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* PAGINACIÓN */}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-between px-4 md:px-8 py-4 border-t border-gray-100 flex-wrap gap-2">
              <p className="text-xs text-gray-400">
                Mostrando {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredRows.length)} de {filteredRows.length}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-200"
                  style={currentPage === 1
                    ? { color: "#d1d5db", borderColor: "#e5e7eb", cursor: "not-allowed", backgroundColor: "white" }
                    : { color: "#374151", borderColor: "#d1d5db", backgroundColor: "white" }}
                >← Anterior</button>
                <span className="text-xs text-gray-400">Página {currentPage} de {totalPages}</span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-200"
                  style={currentPage === totalPages
                    ? { color: "#d1d5db", borderColor: "#e5e7eb", cursor: "not-allowed", backgroundColor: "white" }
                    : { color: "#374151", borderColor: "#d1d5db", backgroundColor: "white" }}
                >Siguiente →</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}