import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { Paper } from "@/features/inventory/types/paper";
import { convertToBase, getBaseUnit, pluralizeUnit } from "@/lib/conversions";

interface PaperDetailDialogProps {
  paper: Paper | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenMovement: () => void;
  canRegistrarEntrada?: boolean;
  canRegistrarSalida?: boolean;
}

function calculateStock(paper: Paper): number {
  return paper.movements.reduce((total, movement) => {
    return movement.type === "entrada"
      ? total + movement.quantity
      : total - movement.quantity;
  }, 0);
}

function formatMovementDate(dateStr: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T/.test(dateStr)) return dateStr;
  const d = new Date(dateStr);
  const datePart = d
    .toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Bogota" })
    .replace(".", "");
  const timePart = d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Bogota" });
  return `${datePart} · ${timePart}`;
}

function buildMovementDetails(movement: import("@/features/inventory/types/paper").Movement): string {
  const parts: string[] = [];
  if (movement.responsible) parts.push(movement.responsible);
  if (movement.subtype === "ajuste_inventario") parts.push("Ajuste de Inventario");
  if (movement.orderNumber) parts.push(`Orden ${movement.orderNumber}`);
  if (movement.ctpOrderNumber) parts.push(`Orden CTP ${movement.ctpOrderNumber}`);
  if (movement.authorizationNumber) parts.push(`Aut. ${movement.authorizationNumber}`);
  if (movement.motivo) parts.push(movement.motivo);
  if (movement.ordenDanio) parts.push(`OP ${movement.ordenDanio}`);
  if (movement.invoiceNumber) parts.push(`Fact. ${movement.invoiceNumber}`);
  if (movement.supplier) parts.push(movement.supplier);
  return parts.join(" · ");
}

const MOVEMENTS_PER_PAGE = 5;

export function PaperDetailDialog({
  paper,
  open,
  onOpenChange,
  onOpenMovement,
  canRegistrarEntrada = true,
  canRegistrarSalida = true,
}: PaperDetailDialogProps) {
  const [currentPage, setCurrentPage] = useState(1);

  if (!paper) return null;

  const stockReal = calculateStock(paper);
  const baseUnit = getBaseUnit(paper.unit);
  const isBaseUnit = paper.unit === "Pliego" || paper.unit === "Hoja" || paper.unit === "Sobre" || paper.unit === "Unidad" || paper.unit === "Litro" || paper.unit === "Galón";

  const displayStock = isBaseUnit ? stockReal : convertToBase(stockReal, paper.unit);
  const displayMinStock = isBaseUnit ? paper.minStock : convertToBase(paper.minStock, paper.unit);
  const displayUnit = isBaseUnit ? paper.unit : baseUnit;
  const isLowStock = stockReal <= paper.minStock;

  const movimientosOrdenados = paper.movements.slice().reverse();
  const totalPages = Math.ceil(movimientosOrdenados.length / MOVEMENTS_PER_PAGE);
  const movimientosPagina = movimientosOrdenados.slice(
    (currentPage - 1) * MOVEMENTS_PER_PAGE,
    currentPage * MOVEMENTS_PER_PAGE
  );

  function handleOpenChange(value: boolean) {
    if (!value) setCurrentPage(1);
    onOpenChange(value);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto overflow-x-hidden p-0 bg-white">

        {/* Header */}
        <div className="px-4 sm:px-6 pt-6 pb-5 border-b border-gray-100">
          <p className="text-xs text-gray-400 mb-1">
            <span className="font-mono">{paper.code}</span>
            {paper.categoria && <> <span className="mx-1">•</span> {paper.categoria}</>}
          </p>
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-2xl font-extrabold text-gray-900 break-words pr-6">{paper.product}</DialogTitle>
          </DialogHeader>
          {paper.description && (
            <p className="text-gray-500 text-sm mt-1 break-words">{paper.description}</p>
          )}
          <span
            className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full text-xs font-semibold"
            style={isLowStock ? { backgroundColor: "#FEF2F2", color: "#D90000" } : { backgroundColor: "#ECFDF5", color: "#059669" }}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${isLowStock ? "bg-red-500" : "bg-emerald-500"}`} />
            {isLowStock ? "Stock bajo" : "En stock"}
          </span>
        </div>

        <div className="px-4 sm:px-6 py-5 space-y-5">

          {/* Tarjetas de stock */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div className="bg-gray-50 rounded-xl p-2.5 sm:p-4 min-w-0">
              <p className="text-[10px] sm:text-[11px] text-gray-400 uppercase tracking-widest font-bold mb-1 truncate">Stock Actual</p>
              <p className="text-base sm:text-xl font-extrabold text-gray-900 break-words">{displayStock.toLocaleString()} {isBaseUnit ? pluralizeUnit(displayStock, displayUnit) : displayUnit}</p>
              {!isBaseUnit && <p className="text-xs text-gray-400 mt-1">({stockReal} {pluralizeUnit(stockReal, paper.unit)})</p>}
            </div>
            <div className="bg-gray-50 rounded-xl p-2.5 sm:p-4 min-w-0">
              <p className="text-[10px] sm:text-[11px] text-gray-400 uppercase tracking-widest font-bold mb-1 truncate">Stock Mínimo</p>
              <p className="text-base sm:text-xl font-extrabold text-gray-900 break-words">{displayMinStock.toLocaleString()} {isBaseUnit ? pluralizeUnit(displayMinStock, displayUnit) : displayUnit}</p>
              {!isBaseUnit && <p className="text-xs text-gray-400 mt-1">({paper.minStock} {pluralizeUnit(paper.minStock, paper.unit)})</p>}
            </div>
            <div className="bg-gray-50 rounded-xl p-2.5 sm:p-4 min-w-0">
              <p className="text-[10px] sm:text-[11px] text-gray-400 uppercase tracking-widest font-bold mb-1 truncate">Código</p>
              <p className="text-sm sm:text-base font-bold text-gray-800 font-mono break-words">{paper.code}</p>
            </div>
            {paper.location && (
              <div className="bg-gray-50 rounded-xl p-2.5 sm:p-4 min-w-0">
                <p className="text-[10px] sm:text-[11px] text-gray-400 uppercase tracking-widest font-bold mb-1 truncate">Ubicación</p>
                <p className="text-sm sm:text-base font-semibold text-gray-800 break-words">{paper.location}</p>
              </div>
            )}
          </div>

          {/* Botón movimiento */}
          {(canRegistrarEntrada || canRegistrarSalida) && (
            <div className="flex gap-2">
              <button
                onClick={onOpenMovement}
                className="flex-1 text-white py-3 rounded-xl font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg shadow-sm flex items-center justify-center gap-2"
                style={{ backgroundColor: "#00D4FF" }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <polyline points="19 12 12 19 5 12"/>
                </svg>
                Registrar movimiento
              </button>
            </div>
          )}

          {/* Historial */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-bold text-gray-900">Historial de movimientos</h3>
              {movimientosOrdenados.length > 0 && (
                <span className="ml-auto text-xs text-gray-400 bg-gray-50 px-2.5 py-1 rounded-full">
                  {movimientosOrdenados.length} {movimientosOrdenados.length === 1 ? "movimiento" : "movimientos"}
                </span>
              )}
            </div>

            {movimientosOrdenados.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No hay movimientos registrados.</p>
            ) : (
              <>
                <div className="space-y-3">
                  {movimientosPagina.map((movement) => {
                    const displayQty = movement.originalQuantity ?? movement.quantity;
                    const dUnit = movement.originalUnit ?? paper.unit;
                    const isEntrada = movement.type === "entrada";
                    const details = buildMovementDetails(movement);
                    return (
                      <div key={movement.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                        <div className="flex justify-between items-start gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <span
                              className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                              style={isEntrada ? { backgroundColor: "#ECFDF5" } : { backgroundColor: "#FEF2F2" }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke={isEntrada ? "#059669" : "#D90000"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="19" x2="12" y2="5"/>
                                {isEntrada ? <polyline points="5 12 12 5 19 12"/> : <polyline points="5 12 12 19 19 12"/>}
                              </svg>
                            </span>
                            <div className="min-w-0">
                              <p className="font-semibold text-gray-800 text-sm">
                                {isEntrada ? "Entrada" : "Salida"}
                                <span className="text-gray-400 font-normal"> · {formatMovementDate(movement.date)}</span>
                                {movement.isInitial && (
                                  <span className="ml-2 text-xs text-gray-400 font-normal">(Saldo inicial)</span>
                                )}
                              </p>
                              {details && <p className="text-xs text-gray-500 mt-0.5 truncate">{details}</p>}
                              {movement.observations && (
                                <p className="text-xs text-[#00A8CC] mt-2 px-2.5 py-1.5 rounded-lg inline-block" style={{ backgroundColor: "#F0FDFF" }}>
                                  <span className="font-bold mr-1">OBS</span>{movement.observations}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className={`text-sm sm:text-base font-bold text-right break-words shrink-0 max-w-[35%] sm:max-w-none ${isEntrada ? "text-emerald-600" : "text-red-500"}`}>
                            {isEntrada ? "+" : "-"}{displayQty} {pluralizeUnit(displayQty, dUnit)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* PAGINACIÓN */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100 flex-wrap gap-2">
                    <p className="text-xs text-gray-400">
                      Página {currentPage} de {totalPages}
                    </p>
                    <div className="flex items-center gap-1 flex-wrap justify-end">
                      <button
                        onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-200"
                        style={currentPage === 1
                          ? { color: "#d1d5db", borderColor: "#e5e7eb", cursor: "not-allowed", backgroundColor: "white" }
                          : { color: "#374151", borderColor: "#d1d5db", backgroundColor: "white" }}
                      >←</button>

                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className="w-8 h-8 rounded-lg text-sm font-medium border transition-all duration-200"
                          style={currentPage === page
                            ? { backgroundColor: "#00D4FF", color: "white", borderColor: "#00D4FF" }
                            : { backgroundColor: "white", color: "#374151", borderColor: "#d1d5db" }}
                        >{page}</button>
                      ))}

                      <button
                        onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-200"
                        style={currentPage === totalPages
                          ? { color: "#d1d5db", borderColor: "#e5e7eb", cursor: "not-allowed", backgroundColor: "white" }
                          : { color: "#374151", borderColor: "#d1d5db", backgroundColor: "white" }}
                      >→</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}