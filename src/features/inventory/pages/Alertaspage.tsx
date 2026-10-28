import { useState } from "react";
import type { Paper } from "../types/paper";
import { CATEGORIAS } from "../types/categorias";
import { convertToBase, getBaseUnit, pluralizeUnit } from "@/lib/conversions";
import { PaperDetailDialog } from "@/components/PaperDetailDialog";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

interface AlertasPageProps {
  inventory: Paper[];
  onGoToInventario: () => void;
  canVerCTP: boolean;
  canVerPapel: boolean;
  canVerOFFSET: boolean;
}

function getStockReal(paper: Paper): number {
  return paper.movements.reduce((total, m) =>
    m.type === "entrada" ? total + m.quantity : total - m.quantity, 0
  );
}

export function AlertasPage({ inventory, canVerCTP, canVerPapel, canVerOFFSET }: AlertasPageProps) {
  const [categoriaFilter, setCategoriaFilter] = useState("");
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  function handleVerDetalles(paper: Paper) {
    setSelectedPaper(paper);
    setDetailOpen(true);
  }

  function categoriaVisible(categoria: string | undefined) {
    const cat = categoria ?? "Papel";
    if (cat === "CTP") return canVerCTP;
    if (cat === "Papel") return canVerPapel;
    if (cat === "OFFSET") return canVerOFFSET;
    return true;
  }

  const inventoryVisible = inventory.filter((p) => categoriaVisible(p.categoria));
  const categoriasVisibles = CATEGORIAS.filter((c) => categoriaVisible(c));

  const lowStockPapers = inventoryVisible.filter(
    (p) => getStockReal(p) <= p.minStock
  );

  const filteredPapers = categoriaFilter
    ? lowStockPapers.filter((p) => (p.categoria ?? "Papel") === categoriaFilter)
    : lowStockPapers;

  function exportToPDF() {
    const fecha = new Date().toLocaleDateString("es-CO", {
      year: "numeric", month: "long", day: "numeric",
    });

    const doc = new jsPDF();

    // Encabezado
    doc.setFontSize(18);
    doc.setTextColor(220, 20, 60);
    doc.text("Reporte de Alertas de Stock", 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    doc.text(`InvenPrint — Inventario Materia Prima`, 14, 28);
    doc.text(`Generado el ${fecha}`, 14, 34);
    doc.text(
      `${filteredPapers.length} producto${filteredPapers.length !== 1 ? "s" : ""} con stock bajo`,
      14, 40
    );

    // Tabla
    autoTable(doc, {
      startY: 48,
      head: [["Producto", "Código", "Stock Actual", "Stock Mínimo", "Estado", "Cantidad Solicitada"]],
      body: filteredPapers.map((paper) => {
        const stockReal = getStockReal(paper);
        const isCritical = stockReal === 0;
        const isBaseUnit = paper.unit === "Pliego" || paper.unit === "Hoja" || paper.unit === "Sobre" || paper.unit === "Unidad" || paper.unit === "Litro" || paper.unit === "Galón";
        const baseUnit = getBaseUnit(paper.unit);
        const displayStock = isBaseUnit ? stockReal : convertToBase(stockReal, paper.unit);
        const displayMinStock = isBaseUnit ? paper.minStock : convertToBase(paper.minStock, paper.unit);
        const displayUnit = isBaseUnit ? paper.unit : baseUnit;
return [
  paper.product,
  paper.code,
  paper.unit === "Pliego" || paper.unit === "Resma"
    ? `${displayStock.toLocaleString()} ${isBaseUnit ? pluralizeUnit(displayStock, displayUnit) : displayUnit}\n(${(displayStock / 500).toFixed(1)} Resma)`
    : `${displayStock.toLocaleString()} ${isBaseUnit ? pluralizeUnit(displayStock, displayUnit) : displayUnit}`,
  paper.unit === "Pliego" || paper.unit === "Resma"
    ? `${displayMinStock.toLocaleString()} ${isBaseUnit ? pluralizeUnit(displayMinStock, displayUnit) : displayUnit}\n(${(displayMinStock / 500).toFixed(1)} Resma)`
    : `${displayMinStock.toLocaleString()} ${isBaseUnit ? pluralizeUnit(displayMinStock, displayUnit) : displayUnit}`,
  isCritical ? "Critico" : "Stock bajo",
  "",
];
      }),
      headStyles: {
        fillColor: [220, 20, 60],
        textColor: 255,
        fontStyle: "bold",
        fontSize: 9,
      },
      bodyStyles: { fontSize: 9, textColor: [31, 41, 55] },
      alternateRowStyles: { fillColor: [255, 245, 245] },
      didParseCell: (data) => {
        if (data.section === "body" && (data.column.index === 2 || data.column.index === 3)) {
  const val = data.cell.raw as string;
  if (val.includes("\n")) {
    data.cell.styles.fontStyle = "italic";
  }
}
        if (data.section === "body" && data.column.index === 4) {
          const val = data.cell.raw as string;
          data.cell.styles.textColor = val === "Critico" ? [220, 20, 60] : [249, 115, 22];
          data.cell.styles.fontStyle = "bold";
        }
      },
    });

    // Footer en cada página
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(156, 163, 175);
      doc.text(
        `InvenPrint · Sistema de Inventario · Página ${i} de ${pageCount}`,
        14,
        doc.internal.pageSize.height - 10
      );
    }

    doc.save(`alertas_stock_${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  function exportToExcel() {
    const data = filteredPapers.map((paper) => {
      const stockReal = getStockReal(paper);
      const isCritical = stockReal === 0;
      const isBaseUnit = paper.unit === "Pliego" || paper.unit === "Hoja" || paper.unit === "Sobre" || paper.unit === "Unidad" || paper.unit === "Litro" || paper.unit === "Galón";
      const baseUnit = getBaseUnit(paper.unit);
      const displayStock = isBaseUnit ? stockReal : convertToBase(stockReal, paper.unit);
      const displayMinStock = isBaseUnit ? paper.minStock : convertToBase(paper.minStock, paper.unit);
      const displayUnit = isBaseUnit ? paper.unit : baseUnit;

      return {
        "Producto": paper.product,
        "Código": paper.code,
        "Categoría": paper.categoria ?? "Papel",
        "Stock Actual": displayStock,
        "Stock Mínimo": displayMinStock,
        "Unidad": displayUnit,
        "Estado": isCritical ? "Crítico" : "Stock bajo",
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    worksheet["!cols"] = [
      { wch: 30 }, { wch: 16 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 12 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Alertas");
    XLSX.writeFile(workbook, `alertas_stock_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <div className="w-full min-h-screen" style={{ backgroundColor: "#F7FBFC" }}>
      <div className="w-full px-4 md:px-12 py-6 md:py-10">

        {lowStockPapers.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Todo en orden</h2>
            <p className="text-gray-500">No hay productos con stock bajo en este momento.</p>
          </div>
        ) : (
          <>
            {/* Título + botones exportar */}
            <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
              <div>
                <p className="text-xs font-bold tracking-widest text-gray-300 mb-1">IMPRENTA GRÁFICA</p>
                <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900">Alertas de stock</h1>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={exportToPDF}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold text-gray-600 bg-white border border-gray-200 transition-all duration-200 hover:border-[#00D4FF] hover:text-[#00A8CC] hover:bg-[#F0FDFF]"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                  </svg>
                  Exportar PDF
                </button>
                <button
                  onClick={exportToExcel}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold text-gray-600 bg-white border border-gray-200 transition-all duration-200 hover:border-[#00D4FF] hover:text-[#00A8CC] hover:bg-[#F0FDFF]"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/>
                  </svg>
                  Exportar Excel
                </button>
              </div>
            </div>

            {/* CARD TABLA */}
            <div className="rounded-2xl shadow-sm border border-gray-100 overflow-hidden bg-white">

              {/* Encabezado */}
              <div className="px-4 md:px-8 pt-6 pb-4 flex items-center gap-3 flex-wrap">
                <h2 className="text-lg font-bold text-gray-900">Productos en stock bajo</h2>
                <span className="text-xs font-semibold px-3 py-1 rounded-full" style={{ color: "#D90000", backgroundColor: "#FFF0F0" }}>
                  {filteredPapers.length} {filteredPapers.length === 1 ? "producto" : "productos"}
                </span>
                <select
                  className="ml-auto border border-gray-200 bg-white px-4 py-2.5 rounded-full text-sm text-gray-500 focus:outline-none transition-all duration-200 w-48"
                  onFocus={(e) => e.target.style.boxShadow = `0 0 0 2px #00D4FF`}
                  onBlur={(e) => e.target.style.boxShadow = "none"}
                  value={categoriaFilter}
                  onChange={(e) => setCategoriaFilter(e.target.value)}
                >
                  <option value="">Todas las categorías</option>
                  {categoriasVisibles.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {filteredPapers.length === 0 ? (
                <div className="px-8 pb-10 text-center text-gray-400">
                  No hay productos con stock bajo en esta categoría.
                </div>
              ) : (
                <div className="px-4 md:px-8 pb-6 overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left text-[11px] font-bold tracking-widest text-gray-400 uppercase px-3 py-3">Producto</th>
                        <th className="text-right text-[11px] font-bold tracking-widest text-gray-400 uppercase px-3 py-3">Stock actual</th>
                        <th className="text-right text-[11px] font-bold tracking-widest text-gray-400 uppercase px-3 py-3">Stock mínimo</th>
                        <th className="text-left text-[11px] font-bold tracking-widest text-gray-400 uppercase px-3 py-3">Nivel de stock</th>
                        <th className="text-center text-[11px] font-bold tracking-widest text-gray-400 uppercase px-3 py-3">Estado</th>
                        <th className="text-center text-[11px] font-bold tracking-widest text-gray-400 uppercase px-3 py-3">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPapers.map((paper) => {
                        const stockReal = getStockReal(paper);
                        const isCritical = stockReal === 0;
                        const isBaseUnit = paper.unit === "Pliego" || paper.unit === "Hoja" || paper.unit === "Sobre" || paper.unit === "Unidad" || paper.unit === "Litro" || paper.unit === "Galón";
                        const baseUnit = getBaseUnit(paper.unit);
                        const displayStock = isBaseUnit ? stockReal : convertToBase(stockReal, paper.unit);
                        const displayMinStock = isBaseUnit ? paper.minStock : convertToBase(paper.minStock, paper.unit);
                        const displayUnit = isBaseUnit ? paper.unit : baseUnit;

                        const percentage = displayMinStock > 0
                          ? Math.round((displayStock / displayMinStock) * 100)
                          : 0;
                        const isOverstock = percentage > 100;
                        const barColor = isOverstock ? "#22c55e" : isCritical ? "#D90000" : "#f97316";
                        const badgeStyle = isOverstock
                          ? { backgroundColor: "#ECFDF5", color: "#059669" }
                          : isCritical
                          ? { backgroundColor: "#FEF2F2", color: "#D90000" }
                          : { backgroundColor: "#FFF7ED", color: "#EA580C" };

                        return (
                          <tr key={paper.code} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors duration-150">
                            <td className="px-3 py-4">
                              <p className="font-semibold text-gray-800">{paper.product}</p>
                              <p className="text-xs text-gray-400 font-mono mt-0.5">{paper.code}</p>
                            </td>
                            <td className="px-3 py-4 text-right">
                              <span className={`font-bold ${isOverstock ? "text-emerald-600" : isCritical ? "text-red-600" : "text-orange-500"}`}>
                                {displayStock.toLocaleString()}
                              </span>
                              <p className="text-xs text-gray-400">{isBaseUnit ? pluralizeUnit(displayStock, displayUnit) : displayUnit}</p>
                            </td>
                            <td className="px-3 py-4 text-right">
                              <span className="font-bold text-gray-900">{displayMinStock.toLocaleString()}</span>
                              <p className="text-xs text-gray-400">{isBaseUnit ? pluralizeUnit(displayMinStock, displayUnit) : displayUnit}</p>
                            </td>
                            <td className="px-3 py-4 min-w-[160px]">
                              <div className="flex items-center justify-between text-xs mb-1.5">
                                <span className="font-semibold text-gray-700">{percentage}%</span>
                                <span className="text-gray-400">del mínimo</span>
                              </div>
                              <div className="bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{ width: `${Math.min(percentage, 100)}%`, backgroundColor: barColor }}
                                />
                              </div>
                            </td>
                            <td className="px-3 py-4 text-center">
                              <span
                                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap"
                                style={badgeStyle}
                              >
                                {isOverstock ? "En riesgo" : isCritical ? "⛔ Crítico" : "⚠ Stock bajo"}
                              </span>
                            </td>
                            <td className="px-3 py-4 text-center">
                              <button
                                onClick={() => handleVerDetalles(paper)}
                                className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-full border border-gray-200 bg-white text-gray-600 transition-all duration-200 hover:border-[#00D4FF] hover:text-[#00A8CC] hover:bg-[#F0FDFF] whitespace-nowrap"
                              >
                                Ver detalles
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                                </svg>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <PaperDetailDialog
        paper={selectedPaper}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onOpenMovement={() => {}}
        canRegistrarEntrada={false}
        canRegistrarSalida={false}
      />
    </div>
  );
}