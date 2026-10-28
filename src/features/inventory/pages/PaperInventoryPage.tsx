import { useState } from "react";
import { PaperTable } from "../components/PaperTable";
import { PaperDetailDialog } from "@/components/PaperDetailDialog";
import { StockMovementDialog } from "../components/StockMovementDialog";
import { EditPaperDialog } from "../components/EditPaperDialog";
import { MultiSalidaDialog } from "../components/MultiSalidaDialog";
import type { Paper, Movement } from "../types/paper";
import { CATEGORIAS } from "../types/categorias";
import { convertToBase } from "@/lib/conversions";
import { updatePaper, deletePaper } from "@/lib/supabaseService";
import { toast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

type SortField = "nombre" | "categoria" | "stock" | null;
type SortOrder = "asc" | "desc";

function getStockReal(paper: Paper): number {
  return paper.movements.reduce((total, m) =>
    m.type === "entrada" ? total + m.quantity : total - m.quantity, 0
  );
}

import type { Proveedor } from "@/features/proveedores/types/proveedor";

interface PaperInventoryPageProps {
  inventory: Paper[];
  setInventory: React.Dispatch<React.SetStateAction<Paper[]>>;
  onGoToAlertas: () => void;
  onAddMovement: (paperCode: string, movement: Movement) => Promise<void>;
  canEditarProducto: boolean;
  canEliminarProducto: boolean;
  canRegistrarEntrada: boolean;
  canRegistrarSalida: boolean;
  nombreResponsable: string;
  proveedores: Proveedor[];
  isAdmin: boolean;
  canVerCTP: boolean;
  canEditarCTP: boolean;
  canEliminarCTP: boolean;
  canVerPapel: boolean;
  canVerOFFSET: boolean;
  canEditarOFFSET: boolean;
  canEliminarOFFSET: boolean;
}

export function PaperInventoryPage({
  inventory,
  setInventory,
  onAddMovement,
  canEditarProducto,
  canEliminarProducto,
  canRegistrarEntrada,
  canRegistrarSalida,
  nombreResponsable,
  proveedores,
  isAdmin,
  canVerCTP,
  canEditarCTP,
  canEliminarCTP,
  canVerPapel,
  canVerOFFSET,
  canEditarOFFSET,
  canEliminarOFFSET,
}: PaperInventoryPageProps) {
  function categoriaVisible(categoria: string | undefined) {
    const cat = categoria ?? "Papel";
    if (cat === "CTP") return canVerCTP;
    if (cat === "Papel") return canVerPapel;
    if (cat === "OFFSET") return canVerOFFSET;
    return true;
  }

  const inventoryVisible = inventory.filter((p) => categoriaVisible(p.categoria));
  const categoriasVisibles = CATEGORIAS.filter((c) => categoriaVisible(c));

  function puedeEditar(paper: Paper) {
    const cat = paper.categoria ?? "Papel";
    if (cat === "CTP") return canEditarCTP;
    if (cat === "OFFSET") return canEditarOFFSET;
    return canEditarProducto;
  }

  function puedeEliminar(paper: Paper) {
    const cat = paper.categoria ?? "Papel";
    if (cat === "CTP") return canEliminarCTP;
    if (cat === "OFFSET") return canEliminarOFFSET;
    return canEliminarProducto;
  }
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);
  const [editPaper, setEditPaper] = useState<Paper | null>(null);
  const [open, setOpen] = useState(false);
  const [movementOpen, setMovementOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [multiSalidaOpen, setMultiSalidaOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoriaFilter, setCategoriaFilter] = useState("");
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  const hasActiveFilters = searchTerm !== "" || sortField !== null || categoriaFilter !== "";

  function handleSelectPaper(paper: Paper) {
    setSelectedPaper(paper);
    setOpen(true);
  }

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  }

  function handleClearFilters() {
    setSearchTerm("");
    setCategoriaFilter("");
    setSortField(null);
    setSortOrder("asc");
    setCurrentPage(1);
  }

  async function handleRegisterMovement(paperCode: string, movement: Movement) {
    await onAddMovement(paperCode, movement);
    setSelectedPaper((prev) => {
      if (!prev || prev.code !== paperCode) return prev;
      return { ...prev, movements: [...prev.movements, movement] };
    });
  }

  async function handleDelete(paper: Paper) {
    if (!window.confirm(`¿Eliminar ${paper.product}? Esto también borrará todo su historial de movimientos.`)) return;
    try {
      await deletePaper(paper.code);
      setInventory((prev) => prev.filter((p) => p.code !== paper.code));
      toast({ title: "✅ Producto eliminado", description: `${paper.product} fue eliminado correctamente.` });
    } catch (error: any) {
      console.error("Error eliminando producto:", error);
      toast({
        title: "❌ No se pudo eliminar",
        description: error?.message || "Ocurrió un error inesperado. Revisa la consola (F12) para más detalles.",
        variant: "destructive",
      });
    }
  }

  function handleEdit(paper: Paper) {
    setEditPaper(paper);
    setEditOpen(true);
  }

  async function handleUpdate(updatedPaper: Paper, oldCode: string) {
    try {
      await updatePaper(updatedPaper, oldCode);
      setInventory((prev) =>
        prev.map((p) => (p.code === oldCode ? updatedPaper : p))
      );
    } catch (error) {
      console.error("Error actualizando producto:", error);
      toast({
        title: "❌ No se pudo actualizar",
        description: "Ocurrió un error al guardar los cambios. Intenta de nuevo.",
        variant: "destructive",
      });
    }
  }

  function exportToPDF() {
    const fecha = new Date().toLocaleDateString("es-CO", {
      year: "numeric", month: "long", day: "numeric",
    });
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.setTextColor(31, 41, 55);
    doc.text("Inventario de Materia Prima", 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    doc.text(`InvenPrint — Generado el ${fecha}`, 14, 28);
    doc.text(`${processedInventory.length} productos registrados`, 14, 34);
    autoTable(doc, {
      startY: 42,
      head: [["Código", "Producto", "Unidad", "Stock Actual", "Stock Mínimo", "Ubicación", "Estado"]],
      body: processedInventory.map((paper) => {
        const stockReal = getStockReal(paper);
        const stockBajo = stockReal <= paper.minStock;
        return [
          paper.code, paper.product, paper.unit,
          stockReal.toLocaleString(), paper.minStock.toLocaleString(),
          (paper as any).location ?? "—",
          stockBajo ? "⚠ Stock bajo" : "✓ OK",
        ];
      }),
      headStyles: { fillColor: [50, 193, 230], textColor: 255, fontStyle: "bold", fontSize: 9 },
      bodyStyles: { fontSize: 9, textColor: [31, 41, 55] },
      alternateRowStyles: { fillColor: [240, 249, 255] },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 6) {
          const val = data.cell.raw as string;
          data.cell.styles.textColor = val.includes("⚠") ? [220, 20, 60] : [22, 163, 74];
          data.cell.styles.fontStyle = "bold";
        }
      },
    });
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(156, 163, 175);
      doc.text(`InvenPrint · Sistema de Inventario · Página ${i} de ${pageCount}`, 14, doc.internal.pageSize.height - 10);
    }
    doc.save(`inventario_${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  function exportToExcel() {
    const data = processedInventory.map((paper) => {
      const stockReal = getStockReal(paper);
      const stockBajo = stockReal <= paper.minStock;
      return {
        "Código": paper.code,
        "Producto": paper.product,
        "Categoría": paper.categoria ?? "Papel",
        "Unidad": paper.unit,
        "Stock Actual": stockReal,
        "Stock Mínimo": paper.minStock,
        "Ubicación": (paper as any).location ?? "—",
        "Estado": stockBajo ? "Stock bajo" : "OK",
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    worksheet["!cols"] = [
      { wch: 16 }, { wch: 30 }, { wch: 12 }, { wch: 10 },
      { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 12 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Inventario");
    XLSX.writeFile(workbook, `inventario_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  let processedInventory = inventoryVisible.filter(
    (paper) =>
      (paper.product.toLowerCase().includes(searchTerm.toLowerCase()) ||
        paper.code.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (categoriaFilter === "" || paper.categoria === categoriaFilter)
  );

  if (sortField === "nombre") {
    processedInventory = [...processedInventory].sort((a, b) =>
      sortOrder === "asc" ? a.product.localeCompare(b.product) : b.product.localeCompare(a.product)
    );
  } else if (sortField === "categoria") {
    processedInventory = [...processedInventory].sort((a, b) => {
      const catA = a.categoria ?? "";
      const catB = b.categoria ?? "";
      return sortOrder === "asc" ? catA.localeCompare(catB) : catB.localeCompare(catA);
    });
  } else if (sortField === "stock") {
    processedInventory = [...processedInventory].sort((a, b) => {
      const stockA = convertToBase(getStockReal(a), a.unit, a.unitsPerPackage);
      const stockB = convertToBase(getStockReal(b), b.unit, b.unitsPerPackage);
      return sortOrder === "asc" ? stockA - stockB : stockB - stockA;
    });
  } else {
    processedInventory = [...processedInventory].sort((a, b) => a.product.localeCompare(b.product));
}

  const totalPages = Math.ceil(processedInventory.length / ITEMS_PER_PAGE);
  const paginatedInventory = processedInventory.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  function SortButton({ field, label }: { field: SortField; label: string }) {
    const isActive = sortField === field;
    const arrow = isActive ? (sortOrder === "asc" ? " ↑" : " ↓") : "";
    return (
      <button
        onClick={() => handleSort(field)}
        className={`px-3 py-1.5 rounded-full text-xs md:text-sm font-medium border transition-all duration-200 ${isActive ? "" : "hover:bg-gray-100"}`}
        style={isActive
          ? { backgroundColor: "#00D4FF", color: "white", borderColor: "#00D4FF" }
          : { backgroundColor: "white", color: "#4b5563", borderColor: "#d1d5db" }}
      >
        {label}{arrow}
      </button>
    );
  }

  return (
    <div className="w-full min-h-screen" style={{ backgroundColor: "#F7FBFC" }}>
      <div className="w-full px-4 md:px-12 py-6 md:py-10">

        {/* TÍTULO DE PÁGINA */}
        <p className="text-xs font-bold tracking-widest text-gray-300 mb-1">IMPRENTA GRÁFICA</p>
        <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-6">Inventario de materiales</h1>

        {/* CARD TABLA */}
        <div className="rounded-2xl shadow-sm border border-gray-100 overflow-hidden bg-white">

          {/* Encabezado */}
          <div className="px-4 md:px-8 pt-6 pb-4 flex items-center gap-3 flex-wrap">
            <h2 className="text-lg font-bold text-gray-900">Lista de Materiales</h2>
           <span className="text-xs font-semibold px-3 py-1 rounded-full" style={{ color: "#00A8CC", backgroundColor: "#E5FBFF" }}>
              {processedInventory.length} productos
           </span>
            <div className="ml-auto flex gap-2">
              <button
                onClick={exportToPDF}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs md:text-sm font-semibold text-gray-600 bg-white border border-gray-200 transition-all duration-200 hover:border-[#00D4FF] hover:text-[#00A8CC] hover:bg-[#F0FDFF]"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10 9 9 9 8 9"/>
                </svg>
                <span className="hidden md:inline">Exportar </span>PDF
              </button>
              <button
                onClick={exportToExcel}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs md:text-sm font-semibold text-gray-600 bg-white border border-gray-200 transition-all duration-200 hover:border-[#00D4FF] hover:text-[#00A8CC] hover:bg-[#F0FDFF]"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/>
                </svg>
                <span className="hidden md:inline">Exportar </span>Excel
              </button>
              {canRegistrarSalida && (
                <button
                  onClick={() => setMultiSalidaOpen(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs md:text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg shadow-sm"
                  style={{ backgroundColor: "#00D4FF" }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14M5 12h14"/>
                  </svg>
                  <span className="hidden md:inline">Salida </span>Múltiple
                </button>
              )}
            </div>
          </div>

          {/* Filtros */}
          <div className="px-4 md:px-8 py-4">
            <div className="flex gap-2 mb-3">
              <div className="relative flex-1">
                <span className="material-icons absolute left-4 top-2.5 text-gray-300 text-xl">search</span>
                <input
                  type="text"
                  placeholder="Buscar producto o código..."
                  className="w-full border border-gray-200 pl-11 pr-3 py-2.5 rounded-full text-sm focus:outline-none bg-white transition-all duration-200"
                  onFocus={(e) => e.target.style.boxShadow = `0 0 0 2px #00D4FF`}
                  onBlur={(e) => e.target.style.boxShadow = "none"}
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                />
              </div>
              <select
                className="border border-gray-200 rounded-full px-4 py-2.5 text-sm text-gray-500 focus:outline-none bg-white w-36 md:w-56 transition-all duration-200"
                onFocus={(e) => e.target.style.boxShadow = `0 0 0 2px #00D4FF`}
                onBlur={(e) => e.target.style.boxShadow = "none"}
                value={categoriaFilter}
                onChange={(e) => { setCategoriaFilter(e.target.value); setCurrentPage(1); }}
              >
                <option value="">Todas las categorías</option>
                {categoriasVisibles.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 flex-wrap mb-4">
              <span className="text-xs md:text-sm text-gray-400">Ordenar por:</span>
              <SortButton field="nombre" label="Nombre" />
              <SortButton field="stock" label="Stock" />
              {hasActiveFilters && (
                <button
                  onClick={handleClearFilters}
                  className="px-3 py-1.5 rounded-full text-xs md:text-sm font-medium border border-gray-300 text-gray-500 hover:bg-gray-100 transition-all duration-200"
                >
                  ✕ Limpiar
                </button>
              )}
            </div>

            {processedInventory.length === 0 ? (
              <div className="text-center py-10 text-gray-400">No se encontraron resultados</div>
            ) : (
              <>
                <PaperTable
                  papers={paginatedInventory}
                  onSelectPaper={handleSelectPaper}
                  onEdit={canEditarProducto || canEditarCTP || canEditarOFFSET ? handleEdit : undefined}
                  onDelete={canEliminarProducto || canEliminarCTP || canEliminarOFFSET ? handleDelete : undefined}
                  canEditPaper={puedeEditar}
                  canDeletePaper={puedeEliminar}
                />

                {/* PAGINACIÓN */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6 pt-4 border-t border-cyan-100 flex-wrap gap-2">
                    <p className="text-xs text-gray-400">
                      Mostrando {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, processedInventory.length)} de {processedInventory.length}
                    </p>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1.5 rounded-lg text-sm font-medium border transition"
                        style={currentPage === 1
                          ? { color: "#d1d5db", borderColor: "#e5e7eb", cursor: "not-allowed", backgroundColor: "white" }
                          : { color: "#374151", borderColor: "#d1d5db", backgroundColor: "white" }}
                      >←</button>

                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter((page) => {
                          if (totalPages <= 7) return true;
                          if (page === 1 || page === totalPages) return true;
                          if (Math.abs(page - currentPage) <= 1) return true;
                          return false;
                        })
                        .reduce<(number | "...")[]>((acc, page, idx, arr) => {
                          if (idx > 0 && typeof arr[idx - 1] === "number" && (page as number) - (arr[idx - 1] as number) > 1) acc.push("...");
                          acc.push(page);
                          return acc;
                        }, [])
                        .map((item, idx) =>
                          item === "..." ? (
                            <span key={`ellipsis-${idx}`} className="px-2 text-gray-400 text-sm">...</span>
                          ) : (
                            <button
                              key={item}
                              onClick={() => setCurrentPage(item as number)}
                              className="w-8 h-8 rounded-lg text-sm font-medium border transition"
                              style={currentPage === item
                                ? { backgroundColor: "#00D4FF", color: "white", borderColor: "#00D4FF" }
                                : { backgroundColor: "white", color: "#374151", borderColor: "#d1d5db" }}
                            >{item}</button>
                          )
                        )}

                      <button
                        onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1.5 rounded-lg text-sm font-medium border transition"
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
      </div>

      {/* MODALES */}
      <PaperDetailDialog
        paper={selectedPaper}
        open={open}
        onOpenChange={setOpen}
        onOpenMovement={() => setMovementOpen(true)}
        canRegistrarEntrada={canRegistrarEntrada}
        canRegistrarSalida={canRegistrarSalida}
      />
      {selectedPaper && (canRegistrarEntrada || canRegistrarSalida) && (
        <StockMovementDialog
          open={movementOpen}
          onOpenChange={setMovementOpen}
          paperCode={selectedPaper.code}
          paperUnit={selectedPaper.unit}
          currentStock={getStockReal(selectedPaper)}
          onRegisterMovement={handleRegisterMovement}
          canRegistrarEntrada={canRegistrarEntrada}
          canRegistrarSalida={canRegistrarSalida}
          nombreResponsable={nombreResponsable}
          proveedores={proveedores}
          categoriaProducto={selectedPaper.categoria}
          packageType={selectedPaper.packageType}
          unitsPerPackage={selectedPaper.unitsPerPackage}
          isAdmin={isAdmin}
        />
      )}
      {(canEditarProducto || canEditarCTP || canEditarOFFSET) && (
        <EditPaperDialog open={editOpen} onOpenChange={setEditOpen} paper={editPaper} papers={inventory} onUpdate={handleUpdate} />
      )}
      <MultiSalidaDialog
        open={multiSalidaOpen}
        onOpenChange={setMultiSalidaOpen}
        papers={inventoryVisible}
        onRegisterMovement={onAddMovement}
        nombreResponsable={nombreResponsable}
        canVerPapel={canVerPapel}
        canVerCTP={canVerCTP}
      />
    </div>
  );
}