import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";

import type { Paper } from "../types/paper";
import { convertToBase, getBaseUnit, pluralizeUnit } from "@/lib/conversions";

interface PaperTableProps {
  papers: Paper[];
  onSelectPaper: (paper: Paper) => void;
  onEdit?: (paper: Paper) => void;
  onDelete?: (paper: Paper) => void;
  canEditPaper?: (paper: Paper) => boolean;
  canDeletePaper?: (paper: Paper) => boolean;
}

function calculateStock(paper: Paper): number {
  return paper.movements.reduce((total, movement) => {
    return movement.type === "entrada"
      ? total + movement.quantity
      : total - movement.quantity;
  }, 0);
}

function isBaseUnit(unit: string): boolean {
  return unit === "Pliego" || unit === "Hoja" || unit === "Sobre" || unit === "Unidad" || unit === "Litro" || unit === "Galón";
}

export function PaperTable({ papers, onSelectPaper, onEdit, onDelete, canEditPaper, canDeletePaper }: PaperTableProps) {
  const showAcciones = onEdit || onDelete;

  return (
    <div className="rounded-xl overflow-hidden border border-gray-100">

      {/* ── VISTA MÓVIL: tarjetas ── */}
      <div className="block md:hidden">
        {papers.map((paper) => {
          const stockReal = calculateStock(paper);
          const isOut = stockReal <= 0;
          const isLowStock = !isOut && stockReal <= paper.minStock;
          const baseUnit = getBaseUnit(paper.unit);
          const convertedStock = convertToBase(stockReal, paper.unit);
          const alreadyBase = isBaseUnit(paper.unit);

          return (
            <div
              key={paper.code}
              onClick={() => onSelectPaper(paper)}
              className="border-b border-gray-100 p-4 bg-white hover:bg-[#F0FDFF] transition-colors duration-150 cursor-pointer"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-semibold text-gray-800 text-sm">{paper.product}</p>
                  <p className="font-mono text-xs text-gray-400 mt-0.5">{paper.code}</p>
                </div>
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                  isOut ? "bg-red-50 text-red-600" : isLowStock ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"
                }`}>
                  {isOut ? "⛔ Agotado" : isLowStock ? "⚠ Stock bajo" : "✓ En stock"}
                </span>
              </div>
              <div className="flex gap-4 text-xs text-gray-500 mt-2">
                <span>
                  <span className="text-gray-400">Stock: </span>
                  <span className="font-semibold text-gray-700">
                    {alreadyBase ? `${stockReal.toLocaleString()} ${pluralizeUnit(stockReal, paper.unit)}` : `${convertedStock.toLocaleString()} ${baseUnit}`}
                  </span>
                </span>
                <span>
                  <span className="text-gray-400">Mínimo: </span>
                  <span className="font-semibold text-gray-700">
                    {alreadyBase ? `${paper.minStock.toLocaleString()} ${pluralizeUnit(paper.minStock, paper.unit)}` : `${convertToBase(paper.minStock, paper.unit).toLocaleString()} ${baseUnit}`}
                  </span>
                </span>
              </div>
              {showAcciones && (onEdit && (!canEditPaper || canEditPaper(paper)) || onDelete && (!canDeletePaper || canDeletePaper(paper))) && (
                <div className="flex gap-3 mt-3" onClick={(e) => e.stopPropagation()}>
                  {onEdit && (!canEditPaper || canEditPaper(paper)) && (
                    <button
                      onClick={() => onEdit(paper)}
                      className="text-xs font-medium px-3 py-1.5 rounded-full border transition-all duration-200 hover:bg-[#E5FBFF]"
                      style={{ color: "#00A8CC", borderColor: "#00D4FF" }}
                    >
                      Editar
                    </button>
                  )}
                  {onDelete && (!canDeletePaper || canDeletePaper(paper)) && (
                    <button
                      onClick={() => onDelete(paper)}
                      className="text-xs font-medium px-3 py-1.5 rounded-full border border-red-300 text-red-500 transition-all duration-200 hover:bg-red-50"
                    >
                      Borrar
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── VISTA ESCRITORIO: tabla ── */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-gray-100 hover:bg-transparent">
              <TableHead className="text-gray-400 font-bold uppercase text-[11px] tracking-widest">Código</TableHead>
              <TableHead className="text-gray-400 font-bold uppercase text-[11px] tracking-widest">Producto</TableHead>
              <TableHead className="text-gray-400 font-bold uppercase text-[11px] tracking-widest text-center">Stock</TableHead>
              <TableHead className="text-gray-400 font-bold uppercase text-[11px] tracking-widest text-center">Stock Mínimo</TableHead>
              <TableHead className="text-gray-400 font-bold uppercase text-[11px] tracking-widest text-center">Estado</TableHead>
              {showAcciones && (
                <TableHead className="text-gray-400 font-bold uppercase text-[11px] tracking-widest text-center">Acciones</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {papers.map((paper) => {
              const stockReal = calculateStock(paper);
              const isOut = stockReal <= 0;
              const isLowStock = !isOut && stockReal <= paper.minStock;
              const baseUnit = getBaseUnit(paper.unit);
              const convertedStock = convertToBase(stockReal, paper.unit);
              const convertedMinStock = convertToBase(paper.minStock, paper.unit);
              const alreadyBase = isBaseUnit(paper.unit);

              return (
                <TableRow
                  key={paper.code}
                  className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors duration-150 cursor-pointer"
                  onClick={() => onSelectPaper(paper)}
                >
                  <TableCell className="font-mono text-sm text-gray-600">{paper.code}</TableCell>
                  <TableCell className="font-medium text-gray-800">{paper.product}</TableCell>
                  <TableCell className="text-center font-semibold text-gray-800">
                    {alreadyBase ? `${stockReal.toLocaleString()} ${pluralizeUnit(stockReal, paper.unit)}` : `${convertedStock.toLocaleString()} ${baseUnit}`}
                  </TableCell>
                  <TableCell className="text-center text-gray-600">
                    {alreadyBase ? `${paper.minStock.toLocaleString()} ${pluralizeUnit(paper.minStock, paper.unit)}` : `${convertedMinStock.toLocaleString()} ${baseUnit}`}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                      isOut ? "bg-red-50 text-red-600" : isLowStock ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"
                    }`}>
                      {isOut ? (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                          </svg>
                          Agotado
                        </>
                      ) : isLowStock ? (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                          </svg>
                          Stock bajo
                        </>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                          En stock
                        </>
                      )}
                    </span>
                  </TableCell>
                  {showAcciones && (
                    <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-2">
                        {onEdit && (!canEditPaper || canEditPaper(paper)) && (
                          <button
                            onClick={() => onEdit(paper)}
                            title="Editar"
                            className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-50 transition-all duration-200 hover:scale-110 hover:bg-[#E5FBFF]"
                            style={{ color: "#00A8CC" }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                          </button>
                        )}
                        {onDelete && (!canDeletePaper || canDeletePaper(paper)) && (
                          <button
                            onClick={() => onDelete(paper)}
                            title="Borrar"
                            className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-50 text-red-400 transition-all duration-200 hover:scale-110 hover:bg-red-50 hover:text-red-500"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"/>
                              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                              <path d="M10 11v6"/><path d="M14 11v6"/>
                              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                            </svg>
                          </button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}