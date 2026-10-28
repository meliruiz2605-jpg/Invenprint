import { useState, useMemo } from "react";
import type { Paper, Movement } from "@/features/inventory/types/paper";
import { CATEGORIAS } from "@/features/inventory/types/categorias";
import { convertToBase, pluralizeUnit } from "@/lib/conversions";
import entradaIcon from "@/assets/entrada.png";
import salidaIcon from "@/assets/salida.png";
import appLogo from "@/assets/logo.png";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { toast } from "@/hooks/use-toast";

interface ReportRow {
  id: string;
  paperCode: string;
  date: string;
  productCode: string;
  productName: string;
  productUnit: string;
  productCategoria?: string;
  productPackageType?: "Caja" | "Unidad";
  productUnitsPerPackage?: number;
  type: "entrada" | "salida";
  subtype?: "orden_produccion" | "numero_autorizacion" | "orden_ctp"  | "ajuste_inventario";
  originalQuantity?: number;
  originalUnit?: string;
  quantity: number;
  unit: string;
  responsible: string;
  invoiceNumber?: string;
  supplier?: string;
  orderNumber?: string;
  authorizationNumber?: string;
  ctpOrderNumber?: string;
  motivo?: string;
  ordenDanio?: string;
  observations?: string;
  createdAt?: string;
  editedBy?: string;
  editedAt?: string;
}

interface ReportsPageProps {
  inventory: Paper[];
  isAdmin: boolean;
  canEditarEliminarReportes?: boolean;
  onUpdateMovement: (movementId: string, updatedMovement: Partial<Movement>) => Promise<void>;
  onDeleteMovement: (movementId: string) => Promise<void>;
  canVerCTP: boolean;
  canVerPapel: boolean;
  canVerOFFSET: boolean;
}

const PAPEL_MOTIVOS = [
  "Daño",
  "Devolución proveedor",
  "Salida interna",
  "Error de despacho",
  "Resmas incompletas",
  "Orden mal diligenciada",
  "Material defectuoso",
  "Muestra para cliente",
] as const;

const CTP_MOTIVOS = [
  "Daño",
  "Desgaste",
  "Error de filmado",
  "Cambio de máquina/montaje",
  "Pruebas y Mantenimiento",
  "Funcionamiento del Equipo"
] as const;

const CTP_MOTIVOS_CON_ORDEN = [
  "Daño",
  "Desgaste",
  "Error de filmado",
  "Cambio de máquina/montaje",
] as const;

const PAPEL_MOTIVOS_CON_ORDEN = [
  "Daño",
  "Error de despacho",
  "Resmas incompletas",
  "Orden mal diligenciada",
  "Material defectuoso",
  "Muestra para cliente",
] as const;

const OFFSET_MOTIVOS = [
  "Salida interna",
] as const;

const OFFSET_MOTIVOS_CON_ORDEN = [] as const;

type SubtypeValue = "orden_produccion" | "numero_autorizacion" | "orden_ctp" | "ajuste_inventario";
type SubtypeFilter = "todos" | SubtypeValue;
type EditSubtypeValue = SubtypeValue | "compra";

function TypeBadge({ type }: { type: "entrada" | "salida" }) {
  const isEntrada = type === "entrada";
  return (
    <span
      className="px-3 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 border w-fit"
      style={isEntrada
        ? { backgroundColor: "#F0FDFF", color: "#00A8CC", borderColor: "#B3F0FF" }
        : { backgroundColor: "#FEF2F2", color: "#D90000", borderColor: "#FECACA" }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="19" x2="12" y2="5" />
        {isEntrada ? <polyline points="5 12 12 5 19 12" /> : <polyline points="5 12 12 19 19 12" />}
      </svg>
      {isEntrada ? "Entrada" : "Salida"}
    </span>
  );
}

function formatDate(date: string): string {
  return /^\d{4}-\d{2}-\d{2}T/.test(date)
    ? new Date(date).toLocaleString("es-CO", { timeZone: "America/Bogota" })
    : date;
}

// Devuelve "AAAA-MM-DD" según la hora de Bogotá, para poder comparar
// la fecha de un movimiento contra los campos "Desde"/"Hasta" (que también
// son "AAAA-MM-DD") sin líos de huso horario.
function getBogotaDateKey(date: string): string {
  const d = /^\d{4}-\d{2}-\d{2}T/.test(date) ? new Date(date) : new Date(`${date}T00:00:00`);
  return d.toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
}

// Mismo patrón que StockMovementDialog: qué unidades puede elegir el usuario
// al editar, según si el producto es Papel, CTP u OFFSET.
function getUnitOptions(paperUnit: string, categoria: string | undefined, packageType?: "Caja" | "Unidad"): string[] {
  if (categoria === "CTP" || categoria === "OFFSET") {
    // Con "Caja" se puede elegir entre la unidad suelta o la caja completa.
    // Con "Unidad" (o sin definir) solo existe la unidad suelta.
    return packageType === "Caja" ? [paperUnit, "Caja"] : [paperUnit];
  }
  switch (paperUnit) {
    case "Resma":
    case "Pliego":
      return ["Pliego", "Resma"];
    case "Resmilla":
    case "Caja de resmillas":
    case "Hoja":
      return ["Hoja", "Resmilla", "Caja de resmillas"];
    case "Sobre":
    case "Caja de sobres":
      return ["Sobre", "Caja de sobres"];
    default:
      return [paperUnit];
  }
}

// Mismos datos que getReferencia, pero separados en columnas independientes
// para el Excel: Tipo de referencia, Número, Motivo y Orden relacionada.
function getReferenciaPartes(r: ReportRow): { tipo: string; numero: string; motivo: string; ordenRelacionada: string } {
  if (r.invoiceNumber) return { tipo: "Factura", numero: r.invoiceNumber, motivo: "", ordenRelacionada: "" };
  if (r.orderNumber) return { tipo: "Orden de producción", numero: r.orderNumber, motivo: "", ordenRelacionada: "" };
  if (r.ctpOrderNumber) return { tipo: "Orden CTP", numero: r.ctpOrderNumber, motivo: "", ordenRelacionada: "" };
  if (r.authorizationNumber) return { tipo: "Número de autorización", numero: r.authorizationNumber, motivo: r.motivo ?? "", ordenRelacionada: r.ordenDanio ?? "" };
  if (r.motivo) return { tipo: "Número de autorización", numero: "", motivo: r.motivo, ordenRelacionada: r.ordenDanio ?? "" };
  if (r.subtype === "ajuste_inventario") return { tipo: "Ajuste de Inventario", numero: "", motivo: "", ordenRelacionada: "" };
  return { tipo: "—", numero: "", motivo: "", ordenRelacionada: "" };
}

function getReferencia(r: ReportRow): string {
  if (r.invoiceNumber) return `Factura: ${r.invoiceNumber}`;
  if (r.orderNumber) return `Orden: ${r.orderNumber}`;
  if (r.ctpOrderNumber) return `Orden CTP: ${r.ctpOrderNumber}`;
  if (r.authorizationNumber) return `Auth: ${r.authorizationNumber}${r.motivo ? ` · ${r.motivo}` : ""}${r.ordenDanio ? ` · Orden: ${r.ordenDanio}` : ""}`;
  if (r.motivo) return `${r.motivo}${r.ordenDanio ? ` · Orden: ${r.ordenDanio}` : ""}`;
  if (r.subtype === "ajuste_inventario") return "Ajuste de Inventario";
  return "—";
}

export function ReportsPage({ inventory, isAdmin, canEditarEliminarReportes, onUpdateMovement, onDeleteMovement, canVerCTP, canVerPapel, canVerOFFSET }: ReportsPageProps) {
  const puedeEditarEliminar = canEditarEliminarReportes ?? isAdmin;

  function categoriaVisible(categoria: string | undefined) {
    const cat = categoria ?? "Papel";
    if (cat === "CTP") return canVerCTP;
    if (cat === "Papel") return canVerPapel;
    if (cat === "OFFSET") return canVerOFFSET;
    return true;
  }

  const inventoryVisible = inventory.filter((p) => categoriaVisible(p.categoria));
  const categoriasVisibles = CATEGORIAS.filter((c) => categoriaVisible(c));
  const [filterType, setFilterType] = useState<"todos" | "entrada" | "salida">("todos");
  const [filterSubtype, setFilterSubtype] = useState<SubtypeFilter>("todos");
  const [categoriaFilter, setCategoriaFilter] = useState("");
  const [filterProduct, setFilterProduct] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [subtypeMenuOpen, setSubtypeMenuOpen] = useState(false);
  const [fechaMenuOpen, setFechaMenuOpen] = useState(false);
  const ITEMS_PER_PAGE = 20;
  const [selectedRow, setSelectedRow] = useState<ReportRow | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const [editSubtype, setEditSubtype] = useState<EditSubtypeValue>("orden_produccion");
  const [editQuantity, setEditQuantity] = useState(0);
  const [editUnit, setEditUnit] = useState("");
  const [editResponsible, setEditResponsible] = useState("");
  const [editObservations, setEditObservations] = useState("");
  const [editInvoiceNumber, setEditInvoiceNumber] = useState("");
  const [editSupplier, setEditSupplier] = useState("");
  const [editOrderNumber, setEditOrderNumber] = useState("");
  const [editCtpOrderNumber, setEditCtpOrderNumber] = useState("");
  const [editAuthorizationNumber, setEditAuthorizationNumber] = useState("");
  const [editMotivo, setEditMotivo] = useState<string>("");
  const [editOrdenDanio, setEditOrdenDanio] = useState("");

  const allRows: ReportRow[] = useMemo(() => {
    const rows: ReportRow[] = [];
    inventoryVisible.forEach((paper) => {
      paper.movements.forEach((m) => {
        if (m.isInitial) return;
        rows.push({
          id: m.id,
          paperCode: paper.code,
          date: m.date,
          productCode: paper.code,
          productName: paper.product,
          productUnit: paper.unit,
          productCategoria: paper.categoria ?? "Papel",
          productPackageType: paper.packageType,
          productUnitsPerPackage: paper.unitsPerPackage,
          type: m.type,
          subtype: m.subtype,
          originalQuantity: m.originalQuantity,
          originalUnit: m.originalUnit,
          quantity: m.quantity,
          unit: paper.unit,
          responsible: m.responsible ?? "-",
          invoiceNumber: m.invoiceNumber,
          supplier: m.supplier,
          orderNumber: m.orderNumber,
          authorizationNumber: m.authorizationNumber,
          ctpOrderNumber: m.ctpOrderNumber,
          motivo: m.motivo,
          ordenDanio: m.ordenDanio,
          observations: m.observations,
          createdAt: m.createdAt,
          editedBy: m.editedBy,
          editedAt: m.editedAt,
        });
      });
    });
    return rows.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
  }, [inventoryVisible]);

  // Filtrado base: Tipo, Categoría y buscador (sin el tipo de salida todavía).
  const rowsForCounts = useMemo(() => {
    const term = filterProduct.toLowerCase();
    return allRows.filter((row) => {
      if (filterType !== "todos" && row.type !== filterType) return false;
      if (categoriaFilter && row.productCategoria !== categoriaFilter) return false;
      if (fechaDesde || fechaHasta) {
        const rowKey = getBogotaDateKey(row.date);
        if (fechaDesde && rowKey < fechaDesde) return false;
        if (fechaHasta && rowKey > fechaHasta) return false;
      }
      if (term) {
        const matches =
          row.productName.toLowerCase().includes(term) ||
          row.productCode.toLowerCase().includes(term) ||
          (row.orderNumber?.toLowerCase().includes(term) ?? false) ||
          (row.ctpOrderNumber?.toLowerCase().includes(term) ?? false) ||
          (row.authorizationNumber?.toLowerCase().includes(term) ?? false);
        if (!matches) return false;
      }
      return true;
    });
  }, [allRows, filterType, categoriaFilter, filterProduct, fechaDesde, fechaHasta]);

  // Filtrado final: además aplica el tipo de salida elegido. Es lo que
  // alimenta la tabla, el PDF y el Excel.
  const filteredRows = useMemo(() => {
    return rowsForCounts.filter((row) => {
      if (filterSubtype !== "todos" && row.subtype !== filterSubtype) return false;
      return true;
    });
  }, [rowsForCounts, filterSubtype]);

  const totalPages = Math.ceil(filteredRows.length / ITEMS_PER_PAGE);
  const paginatedRows = useMemo(() => {
    return filteredRows.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  }, [filteredRows, currentPage]);

  function handleFilterTypeChange(t: "todos" | "entrada" | "salida") {
    setFilterType(t);
    setCurrentPage(1);
  }

  function handleFilterSubtypeChange(s: SubtypeFilter) {
    setFilterSubtype(s);
    setCurrentPage(1);
  }

  function handleCategoriaFilterChange(c: string) {
    setCategoriaFilter(c);
    setFilterSubtype("todos");
    setCurrentPage(1);
  }

  function handleFilterProductChange(value: string) {
    setFilterProduct(value);
    setCurrentPage(1);
  }

  function handleFechaDesdeChange(value: string) {
    setFechaDesde(value);
    setCurrentPage(1);
  }

  function handleFechaHastaChange(value: string) {
    setFechaHasta(value);
    setCurrentPage(1);
  }


  function handleClearFilters() {
    setFilterType("todos");
    setFilterSubtype("todos");
    setCategoriaFilter("");
    setFilterProduct("");
    setFechaDesde("");
    setFechaHasta("");
    setCurrentPage(1);
  }

  function exportToPDF() {
    const fecha = new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" });
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(18);
    doc.setTextColor(31, 41, 55);
    doc.text("Reporte de Movimientos", 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    doc.text(`InvenPrint — Generado el ${fecha}`, 14, 28);
    doc.text(`${filteredRows.length} registros`, 14, 34);
    autoTable(doc, {
      startY: 42,
      head: [["Fecha", "Código", "Producto", "Tipo", "Cantidad", "Unidad", "Responsable", "Referencia", "Observaciones"]],
      body: filteredRows.map((r) => [
        formatDate(r.date), r.productCode, r.productName,
        r.type === "entrada" ? "Entrada" : "Salida",
        String(r.originalQuantity ?? r.quantity),
        r.originalUnit ?? r.unit, r.responsible,
        getReferencia(r),
        r.observations ?? "—",
      ]),
      headStyles: { fillColor: [50, 193, 230], textColor: 255, fontStyle: "bold", fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: [31, 41, 55] },
      alternateRowStyles: { fillColor: [240, 249, 255] },
      columnStyles: { 2: { cellWidth: 35 }, 8: { cellWidth: 30 } },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 3) {
          const val = data.cell.raw as string;
          data.cell.styles.textColor = val === "Entrada" ? [22, 163, 74] : [220, 38, 38];
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
    doc.save(`movimientos_${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  function exportToExcel() {
    const data = filteredRows.map((r) => {
      const ref = getReferenciaPartes(r);
      return {
        "Fecha": formatDate(r.date),
        "Código": r.productCode,
        "Producto": r.productName,
        "Categoría": r.productCategoria ?? "Papel",
        "Tipo": r.type === "entrada" ? "Entrada" : "Salida",
        "Cantidad": r.originalQuantity ?? r.quantity,
        "Unidad": r.originalUnit ?? r.unit,
        "Responsable": r.responsible,
        "Tipo de referencia": ref.tipo,
        "Número": ref.numero || "—",
        "Motivo": ref.motivo || "—",
        "Orden relacionada": ref.ordenRelacionada || "—",
        "Observaciones": r.observations ?? "—",
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    worksheet["!cols"] = [
      { wch: 18 }, { wch: 16 }, { wch: 28 }, { wch: 10 }, { wch: 10 },
      { wch: 10 }, { wch: 10 }, { wch: 18 }, { wch: 20 }, { wch: 12 },
      { wch: 20 }, { wch: 16 }, { wch: 28 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Movimientos");
    XLSX.writeFile(workbook, `movimientos_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function loadImageAsDataUrl(src: string): Promise<string> {
    return fetch(src)
      .then((res) => res.blob())
      .then(
        (blob) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          })
      );
  }

  async function downloadComprobante(row: ReportRow) {
    const isEntrada = row.type === "entrada";
    const fecha = new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" });
    const doc = new jsPDF();
    const marginX = 14;
    const pageWidth = doc.internal.pageSize.width;
    const rightX = pageWidth - marginX;

    // --- Logo (con respaldo en texto si la imagen no carga) ---
    let logoDataUrl: string | null = null;
    try {
      logoDataUrl = await loadImageAsDataUrl(appLogo);
    } catch {
      logoDataUrl = null;
    }
    if (logoDataUrl) {
      const logoW = 40;
      const logoH = logoW * (1285 / 2814);
      doc.addImage(logoDataUrl, "PNG", marginX, 14, logoW, logoH);
    } else {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(31, 41, 55);
      doc.text("InvenPrint", marginX, 22);
      doc.setFont("helvetica", "normal");
    }

    // --- Insignia "Comprobante de Entrada/Salida" + número ---
    const badgeText = `COMPROBANTE DE ${isEntrada ? "ENTRADA" : "SALIDA"}`;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    const badgeTextW = doc.getTextWidth(badgeText);
    const arrowSize = 2.6;
    const arrowGap = 2.2;
    const badgePadX = 5;
    const badgeW = badgePadX * 2 + arrowSize + arrowGap + badgeTextW;
    const badgeH = 8;
    const badgeX = rightX - badgeW;
    const badgeY = 14;
    if (isEntrada) doc.setFillColor(240, 253, 255); else doc.setFillColor(254, 242, 242);
    doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 4, 4, "F");
    if (isEntrada) doc.setTextColor(0, 168, 204); else doc.setTextColor(220, 38, 38);
    if (isEntrada) doc.setFillColor(0, 168, 204); else doc.setFillColor(220, 38, 38);
    const arrowLeft = badgeX + badgePadX;
    const arrowMidY = badgeY + badgeH / 2;
    if (isEntrada) {
      doc.triangle(arrowLeft, arrowMidY + arrowSize / 2, arrowLeft + arrowSize, arrowMidY + arrowSize / 2, arrowLeft + arrowSize / 2, arrowMidY - arrowSize / 2, "F");
    } else {
      doc.triangle(arrowLeft, arrowMidY - arrowSize / 2, arrowLeft + arrowSize, arrowMidY - arrowSize / 2, arrowLeft + arrowSize / 2, arrowMidY + arrowSize / 2, "F");
    }
    doc.text(badgeText, arrowLeft + arrowSize + arrowGap, arrowMidY + 1.3);

    const numero = row.orderNumber || row.ctpOrderNumber || row.authorizationNumber || row.invoiceNumber || row.id.slice(-6).toUpperCase();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(31, 41, 55);
    doc.text(`N.º ${numero}`, rightX, badgeY + badgeH + 8, { align: "right" });
    doc.setFont("helvetica", "normal");

    // --- Línea divisoria ---
    const dividerY = 38;
    doc.setDrawColor(31, 41, 55);
    doc.setLineWidth(0.6);
    doc.line(marginX, dividerY, rightX, dividerY);

    // --- Fila de datos: Fecha / Categoría / Responsable ---
    const infoY = dividerY + 10;
    const infoCols: { label: string; value: string; x: number }[] = [
      { label: "FECHA Y HORA", value: formatDate(row.date), x: marginX },
      { label: "CATEGORÍA", value: row.productCategoria ?? "Papel", x: marginX + 62 },
      { label: "RESPONSABLE", value: row.responsible, x: marginX + 124 },
    ];
    infoCols.forEach((c) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(c.label, c.x, infoY);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(31, 41, 55);
      doc.text(c.value, c.x, infoY + 6);
    });

    // --- Tabla del material ---
    const qty = row.originalQuantity ?? row.quantity;
    const unit = pluralizeUnit(qty, row.originalUnit ?? row.unit);
    autoTable(doc, {
      startY: infoY + 16,
      margin: { left: marginX, right: marginX },
      head: [["CÓDIGO", "MATERIAL", "CANTIDAD", "UNIDAD"]],
      body: [
        [row.productCode, row.productName, `${isEntrada ? "+" : "-"}${qty}`, unit],
        [
          { content: `TOTAL ${isEntrada ? "INGRESADO" : "RETIRADO"}`, colSpan: 2, styles: { halign: "right", fontStyle: "bold", textColor: [31, 41, 55] } },
          { content: String(qty), styles: { fontStyle: "bold" } },
          unit,
        ],
      ],
      headStyles: { fillColor: [224, 242, 254], textColor: [71, 85, 105], fontStyle: "bold", fontSize: 8 },
      bodyStyles: { fontSize: 9, textColor: [31, 41, 55] },
      columnStyles: { 2: { halign: "right", fontStyle: "bold" } },
      didParseCell: (data) => {
        if (data.section === "body" && data.row.index === 0 && data.column.index === 2) {
          data.cell.styles.textColor = isEntrada ? [22, 163, 74] : [220, 38, 38];
        }
      },
    });

    // --- Caja de referencia / tipo / observaciones ---
    let y = (doc as any).lastAutoTable.finalY + 10;
    const referencia = getReferencia(row);
    const boxW = rightX - marginX;
    const hasObs = !!row.observations;
    const boxH = hasObs ? 34 : 20;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(marginX, y, boxW, boxH, 3, 3, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text("REFERENCIA", marginX + 6, y + 8);
    doc.text("TIPO DE MOVIMIENTO", marginX + boxW / 2, y + 8);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(31, 41, 55);
    doc.text(referencia, marginX + 6, y + 15);
    doc.text(isEntrada ? "Entrada" : "Salida", marginX + boxW / 2, y + 15);

    if (hasObs) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text("OBSERVACIONES", marginX + 6, y + 22);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(31, 41, 55);
      const obsLines = doc.splitTextToSize(row.observations!, boxW - 12);
      doc.text(obsLines, marginX + 6, y + 28);
    }

    // --- Pie de página ---
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text(`InvenPrint · Sistema de Inventario · Generado el ${fecha}`, marginX, doc.internal.pageSize.height - 10);

    doc.save(`comprobante_${row.type}_${row.productCode}_${new Date(row.date).toISOString().slice(0, 10)}.pdf`);
  }

  function openDetail(row: ReportRow) {
    setSelectedRow(row);
    setEditMode(false);
    setDeleteConfirm(false);
  }

  function closeModal() {
    setSelectedRow(null);
    setEditMode(false);
    setDeleteConfirm(false);
  }

  function startEdit() {
    if (!selectedRow) return;
    setEditSubtype(selectedRow.subtype ?? (selectedRow.type === "entrada" ? "compra" : "orden_produccion"));
    setEditQuantity(selectedRow.originalQuantity ?? selectedRow.quantity);
    setEditUnit(selectedRow.originalUnit ?? selectedRow.unit);
    setEditResponsible(selectedRow.responsible);
    setEditObservations(selectedRow.observations ?? "");
    setEditInvoiceNumber(selectedRow.invoiceNumber ?? "");
    setEditSupplier(selectedRow.supplier ?? "");
    setEditOrderNumber(selectedRow.orderNumber ?? "");
    setEditCtpOrderNumber(selectedRow.ctpOrderNumber ?? "");
    setEditAuthorizationNumber(selectedRow.authorizationNumber ?? "");
    setEditMotivo(selectedRow.motivo ?? "");
    setEditOrdenDanio(selectedRow.ordenDanio ?? "");
    setEditMode(true);
  }

  async function handleSaveEdit() {
    if (!selectedRow) return;
    if (!editQuantity || editQuantity <= 0) return;
    if (!editResponsible) return;

    const isCTP = selectedRow.productCategoria === "CTP";
    const isOFFSET = selectedRow.productCategoria === "OFFSET";
    const motivosConOrden: readonly string[] = isCTP ? CTP_MOTIVOS_CON_ORDEN : isOFFSET ? OFFSET_MOTIVOS_CON_ORDEN : PAPEL_MOTIVOS_CON_ORDEN;

    const quantityInProductUnit =
      editUnit === selectedRow.productUnit
        ? editQuantity
        : (() => {
            const basePerSelected = convertToBase(1, editUnit, selectedRow.productUnitsPerPackage);
            const basePerProduct = convertToBase(1, selectedRow.productUnit, selectedRow.productUnitsPerPackage);
            return (editQuantity * basePerSelected) / basePerProduct;
          })();

    // Igual que en el diálogo de registrar movimiento: para Salida el subtype
    // elegido se guarda tal cual; para Entrada solo se guarda cuando es
    // explícitamente "Ajuste de Inventario" (una entrada normal / "compra"
    // no lleva subtype, como siempre).
    const editEsAjusteEntrada = selectedRow.type === "entrada" && editSubtype === "ajuste_inventario";
    const updated: Partial<Movement> = {
      type: selectedRow.type,
      subtype: selectedRow.type === "salida" ? (editSubtype as Movement["subtype"]) : (editEsAjusteEntrada ? "ajuste_inventario" : undefined),
      quantity: quantityInProductUnit,
      originalQuantity: editQuantity,
      originalUnit: editUnit,
      responsible: editResponsible,
      observations: editObservations || undefined,
      invoiceNumber: selectedRow.type === "entrada" && !editEsAjusteEntrada ? editInvoiceNumber || undefined : undefined,
      supplier: selectedRow.type === "entrada" && !editEsAjusteEntrada ? editSupplier || undefined : undefined,
      orderNumber: selectedRow.type === "salida" && editSubtype === "orden_produccion" ? editOrderNumber || undefined : undefined,
      ctpOrderNumber: selectedRow.type === "salida" && editSubtype === "orden_ctp" ? editCtpOrderNumber || undefined : undefined,
      authorizationNumber: selectedRow.type === "salida" && editSubtype === "numero_autorizacion" ? editAuthorizationNumber || undefined : undefined,
      motivo: selectedRow.type === "salida" && editSubtype === "numero_autorizacion" ? (editMotivo as Movement["motivo"]) || undefined : undefined,
      ordenDanio: selectedRow.type === "salida" && editSubtype === "numero_autorizacion" && motivosConOrden.includes(editMotivo) ? editOrdenDanio || undefined : undefined,
    };

    try {
      await onUpdateMovement(selectedRow.id, updated);
      toast({ title: "✅ Movimiento actualizado", description: "Los cambios se guardaron correctamente." });
      closeModal();
    } catch (error) {
      console.error(error);
      toast({ title: "❌ Error", description: "No se pudo actualizar el movimiento.", variant: "destructive" });
    }
  }

  async function handleConfirmDelete() {
    if (!selectedRow) return;
    try {
      await onDeleteMovement(selectedRow.id);
      toast({ title: "✅ Movimiento eliminado", description: "El movimiento se eliminó correctamente." });
      closeModal();
    } catch (error) {
      console.error(error);
      toast({ title: "❌ Error", description: "No se pudo eliminar el movimiento.", variant: "destructive" });
    }
  }

  const inputClass = "w-full border border-gray-200 bg-white p-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00D4FF]/40 focus:border-[#00D4FF] transition-all duration-200";
  const selectClass = inputClass;
  const filterInputClass = "border border-gray-200 bg-white px-4 py-2.5 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-[#00D4FF]/40 focus:border-[#00D4FF] transition-all duration-200";

  const editIsCTP = selectedRow?.productCategoria === "CTP";
  const editIsOFFSET = selectedRow?.productCategoria === "OFFSET";
  const editMotivosDisponibles = editIsCTP ? CTP_MOTIVOS : editIsOFFSET ? OFFSET_MOTIVOS : PAPEL_MOTIVOS;
  const editMotivosConOrden: readonly string[] = editIsCTP ? CTP_MOTIVOS_CON_ORDEN : editIsOFFSET ? OFFSET_MOTIVOS_CON_ORDEN : PAPEL_MOTIVOS_CON_ORDEN;
  const editUnitOptions = selectedRow
    ? getUnitOptions(selectedRow.productUnit, selectedRow.productCategoria, selectedRow.productPackageType)
    : [];

  const extraFields: { label: string; value: string }[] = selectedRow
    ? [
        ...(selectedRow.invoiceNumber ? [{ label: "Factura", value: selectedRow.invoiceNumber }] : []),
        ...(selectedRow.supplier ? [{ label: "Proveedor", value: selectedRow.supplier }] : []),
        ...(selectedRow.orderNumber ? [{ label: "Orden de producción", value: selectedRow.orderNumber }] : []),
        ...(selectedRow.ctpOrderNumber ? [{ label: "Orden de CTP", value: selectedRow.ctpOrderNumber }] : []),
        ...(selectedRow.authorizationNumber ? [{ label: "N.° de autorización", value: selectedRow.authorizationNumber }] : []),
        ...(selectedRow.motivo ? [{ label: "Motivo", value: selectedRow.motivo }] : []),
        ...(selectedRow.ordenDanio ? [{ label: "Orden de producción", value: selectedRow.ordenDanio }] : []),
        ...(selectedRow.subtype === "ajuste_inventario" ? [{ label: selectedRow.type === "entrada" ? "Tipo de entrada" : "Tipo de salida", value: "Ajuste de Inventario" }] : []),
      ]
    : [];
  const extraFieldRows: { label: string; value: string }[][] = [];
  for (let i = 0; i < extraFields.length; i += 2) extraFieldRows.push(extraFields.slice(i, i + 2));

  const hasActiveFilters = filterType !== "todos" || filterSubtype !== "todos" || categoriaFilter !== "" || filterProduct !== "" || fechaDesde !== "" || fechaHasta !== "";

  // Etiqueta corta para el botón de fecha (ej: "01/08 - 19/08" o "Desde 01/08").
  function formatFechaCorta(iso: string): string {
    const [, m, d] = iso.split("-");
    return `${d}/${m}`;
  }
  const fechaFilterLabel = (() => {
    if (fechaDesde && fechaHasta) return `${formatFechaCorta(fechaDesde)} - ${formatFechaCorta(fechaHasta)}`;
    if (fechaDesde) return `Desde ${formatFechaCorta(fechaDesde)}`;
    if (fechaHasta) return `Hasta ${formatFechaCorta(fechaHasta)}`;
    return "Fecha";
  })();

  // Grupos de tipo de salida, cada uno atado a su categoría.
  const papelSubtypes: { value: SubtypeValue; label: string }[] = [
    { value: "orden_produccion", label: "Orden de producción" },
    { value: "numero_autorizacion", label: "N. Autorización" },
    ...(isAdmin ? [{ value: "ajuste_inventario" as SubtypeValue, label: "Ajuste de Inventario" }] : []),
  ];
const ctpSubtypes: { value: SubtypeValue; label: string }[] = [
  { value: "orden_produccion", label: "Orden de producción" },
  { value: "orden_ctp", label: "Orden de CTP" },
  { value: "numero_autorizacion", label: "Número de autorización" },
];
const offsetSubtypes: { value: SubtypeValue; label: string }[] = [
  { value: "numero_autorizacion", label: "Número de autorización" },
];

  const showPapelGroup = categoriaFilter === "Papel";
  const showCtpGroup = categoriaFilter === "CTP";
  const showOffsetGroup = categoriaFilter === "OFFSET";

  return (
    <div className="w-full min-h-screen" style={{ backgroundColor: "#F7FBFC" }}>
      <div className="w-full px-4 md:px-12 py-6 md:py-10">

        {/* HEADER */}
        <div className="flex items-start justify-between mb-6 md:mb-8 gap-3 flex-wrap">
          <div>
            <p className="text-xs font-bold tracking-widest text-gray-300 mb-1">IMPRENTA GRÁFICA</p>
            <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900">Reportes</h1>
            <p className="text-sm text-gray-400 mt-1">Historial completo de movimientos de inventario</p>
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
                <polyline points="10 9 9 9 8 9"/>
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

        {/* RESUMEN */}
        <div className="grid grid-cols-3 gap-3 md:gap-4 mb-4">
          {[
            { label: "Total movimientos", value: filteredRows.length, color: "#00A8CC", bg: "#E5FBFF" },
            { label: "Total entradas", value: filteredRows.filter(r => r.type === "entrada").length, color: "#16a34a", bg: "#dcfce7", icon: entradaIcon },
            { label: "Total salidas", value: filteredRows.filter(r => r.type === "salida").length, color: "#D90000", bg: "#fee2e2", icon: salidaIcon },
          ].map((item) => (
            <div key={item.label} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 md:p-5 flex flex-col md:flex-row items-center md:items-start gap-2 md:gap-4">
              <div className="w-9 h-9 md:w-11 md:h-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: item.bg }}>
                {item.icon
                  ? <img src={item.icon} alt="" className="w-5 h-5 object-contain" />
                  : <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke={item.color} strokeWidth="2.5"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                }
              </div>
              <div className="text-center md:text-left">
                <p className="text-xs text-gray-400 leading-tight">{item.label}</p>
                <p className="text-xl md:text-2xl font-bold" style={{ color: item.color }}>{item.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* FILTROS */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 md:px-6 py-4 mb-4 flex flex-col md:flex-row md:items-center gap-3 flex-wrap relative">
          <span className="text-sm text-gray-400 font-medium">Filtrar:</span>
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-full w-fit shrink-0">
            {(["todos", "entrada", "salida"] as const).map((t) => (
              <button
                key={t}
                onClick={() => handleFilterTypeChange(t)}
                className="px-4 py-1.5 rounded-full text-sm font-semibold transition-all duration-200 flex items-center gap-1.5"
                style={filterType === t
                  ? { backgroundColor: "white", color: t === "salida" ? "#D90000" : "#00A8CC", boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }
                  : { color: "#6b7280" }}
              >
                {t === "entrada" && <img src={entradaIcon} alt="" className="w-4 h-4 object-contain" />}
                {t === "salida" && <img src={salidaIcon} alt="" className="w-4 h-4 object-contain" />}
                {t === "todos" ? "Todos" : t === "entrada" ? "Entradas" : "Salidas"}
              </button>
            ))}
          </div>
          <div className="relative w-full md:flex-1 md:min-w-48">
            <span className="material-icons absolute left-4 top-2.5 text-gray-300 text-xl">search</span>
            <input
              type="text"
              placeholder="Buscar producto, código u orden..."
              className="w-full border border-gray-200 pl-11 pr-3 py-2.5 rounded-full text-sm focus:outline-none bg-white transition-all duration-200"
              value={filterProduct}
              onChange={(e) => handleFilterProductChange(e.target.value)}
            />
          </div>
          <select
            className="border border-gray-200 bg-white px-4 py-2.5 rounded-full text-sm text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#00D4FF]/40 focus:border-[#00D4FF] transition-all duration-200 w-full md:w-48"
            value={categoriaFilter}
            onChange={(e) => handleCategoriaFilterChange(e.target.value)}
          >
            <option value="">Todas las categorías</option>
            {categoriasVisibles.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          {/* Desplegable de Tipo de salida — solo aparece si hay una categoría específica elegida */}
          {(showPapelGroup || showCtpGroup || showOffsetGroup) && (
            <div className="relative">
              <button
                onClick={() => setSubtypeMenuOpen((v) => !v)}
                className="px-4 py-2.5 rounded-full text-sm font-medium border transition-all duration-200 flex items-center gap-1.5"
                style={filterSubtype !== "todos"
                  ? { backgroundColor: "#374151", color: "white", borderColor: "#374151" }
                  : { backgroundColor: "white", color: "#6b7280", borderColor: "#d1d5db" }}
              >
                {filterSubtype === "todos"
                  ? "Tipo de salida"
                  : [...papelSubtypes, ...ctpSubtypes, ...offsetSubtypes].find((s) => s.value === filterSubtype)?.label ?? "Tipo de salida"}
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>

              {subtypeMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setSubtypeMenuOpen(false)} />
                  <div className="absolute right-0 mt-1 w-52 bg-white border border-gray-200 rounded-lg shadow-lg z-20 overflow-hidden">
                    <button
                      onClick={() => { handleFilterSubtypeChange("todos"); setSubtypeMenuOpen(false); }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-all duration-200"
                      style={filterSubtype === "todos" ? { color: "#00D4FF", fontWeight: 600 } : { color: "#374151" }}
                    >
                      Todos los tipos
                    </button>
                    {(showPapelGroup ? papelSubtypes : showCtpGroup ? ctpSubtypes : offsetSubtypes).map((s) => (
                      <button
                        key={s.value}
                        onClick={() => { handleFilterSubtypeChange(s.value); setSubtypeMenuOpen(false); }}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition border-t border-gray-50"
                        style={filterSubtype === s.value ? { color: "#00D4FF", fontWeight: 600 } : { color: "#374151" }}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Desplegable de Fecha */}
          <div className="relative">
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
                        className={filterInputClass + " w-full"}
                        value={fechaDesde}
                        max={fechaHasta || undefined}
                        onChange={(e) => handleFechaDesdeChange(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Hasta</label>
                      <input
                        type="date"
                        className={filterInputClass + " w-full"}
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

          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="px-3 py-1.5 rounded-full text-sm text-gray-500 border border-gray-300 hover:bg-gray-100 transition-all duration-200"
            >
              ✕ Limpiar
            </button>
          )}
        </div>

        {/* TABLA */}
        <div className="rounded-2xl shadow-sm border border-gray-100 overflow-hidden bg-white">
          <div className="px-4 md:px-8 pt-6 pb-4 flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-900">Historial de movimientos</h2>
          </div>

          {filteredRows.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-3">📋</p>
              <p className="font-medium">No hay movimientos registrados</p>
              <p className="text-sm mt-1">Los movimientos aparecerán aquí una vez que registres entradas o salidas</p>
            </div>
          ) : (
            <>
              {/* Vista móvil */}
              <div className="block md:hidden divide-y divide-gray-50">
                {paginatedRows.map((row, i) => (
                  <div key={i} className="p-4 bg-white hover:bg-gray-50/60 transition-colors duration-150 cursor-pointer" onClick={() => openDetail(row)}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium text-gray-700 text-sm">{row.productName}</p>
                        <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded text-xs font-mono mt-0.5 inline-block">{row.productCode}</span>
                      </div>
                      <div className="shrink-0"><TypeBadge type={row.type} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-xs text-gray-500 mt-2">
                      <span><span className="text-gray-400">Fecha: </span>{formatDate(row.date)}</span>
                      <span><span className="text-gray-400">Cantidad: </span><span className="font-medium text-gray-700">{row.originalQuantity ?? row.quantity} {pluralizeUnit(row.originalQuantity ?? row.quantity, row.originalUnit ?? row.unit)}</span></span>
                      <span><span className="text-gray-400">Responsable: </span>{row.responsible}</span>
                    </div>
                    <p className="text-xs mt-2" style={{ color: "#00A8CC" }}>Ver detalle →</p>
                  </div>
                ))}
              </div>

              {/* Vista escritorio */}
              <div className="hidden md:block overflow-x-auto px-4 md:px-8 pb-2">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-[11px] font-bold tracking-widest text-gray-400 uppercase px-3 py-3">Fecha</th>
                      <th className="text-left text-[11px] font-bold tracking-widest text-gray-400 uppercase px-3 py-3">Código</th>
                      <th className="text-left text-[11px] font-bold tracking-widest text-gray-400 uppercase px-3 py-3">Producto</th>
                      <th className="text-left text-[11px] font-bold tracking-widest text-gray-400 uppercase px-3 py-3">Tipo</th>
                      <th className="text-left text-[11px] font-bold tracking-widest text-gray-400 uppercase px-3 py-3">Cantidad</th>
                      <th className="text-left text-[11px] font-bold tracking-widest text-gray-400 uppercase px-3 py-3">Responsable</th>
                      <th className="text-left text-[11px] font-bold tracking-widest text-gray-400 uppercase px-3 py-3">Referencia</th>
                      <th className="text-left text-[11px] font-bold tracking-widest text-gray-400 uppercase px-3 py-3">Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRows.map((row, i) => (
                      <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors duration-150 cursor-pointer" onClick={() => openDetail(row)}>
                        <td className="px-3 py-3 text-gray-500 text-xs whitespace-nowrap">{formatDate(row.date)}</td>
                        <td className="px-3 py-3"><span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs font-mono">{row.productCode}</span></td>
                        <td className="px-3 py-3 font-medium text-gray-700 max-w-[180px] truncate">{row.productName}</td>
                        <td className="px-3 py-3">
                          <TypeBadge type={row.type} />
                        </td>
                        <td className="px-3 py-3 font-medium text-gray-700">{row.originalQuantity ?? row.quantity} {pluralizeUnit(row.originalQuantity ?? row.quantity, row.originalUnit ?? row.unit)}</td>
                        <td className="px-3 py-3 text-gray-600">{row.responsible}</td>
                        <td className="px-3 py-3 text-gray-500 text-xs">{getReferencia(row)}</td>
                        <td className="px-3 py-3"><span className="text-xs font-medium" style={{ color: "#00A8CC" }}>Ver detalle →</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* PAGINACIÓN */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 md:px-8 py-4 border-t border-gray-100 flex-wrap gap-2">
                  <p className="text-xs text-gray-400">
                    Mostrando {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredRows.length)} de {filteredRows.length}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-200"
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
                            className="w-8 h-8 rounded-lg text-sm font-medium border transition-all duration-200"
                            style={currentPage === item
                              ? { backgroundColor: "#00D4FF", color: "white", borderColor: "#00D4FF" }
                              : { backgroundColor: "white", color: "#374151", borderColor: "#d1d5db" }}
                          >{item}</button>
                        )
                      )}

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

      {/* MODAL */}
      {selectedRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={closeModal}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 flex items-center justify-between sticky top-0 transition-colors duration-200" style={{ backgroundColor: selectedRow.type === "entrada" ? "#00D4FF" : "#D90000" }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="19" x2="12" y2="5" />
                    {selectedRow.type === "entrada" ? <polyline points="5 12 12 5 19 12" /> : <polyline points="5 12 12 19 19 12" />}
                  </svg>
                </div>
                <h3 className="text-white font-bold text-lg">{editMode ? "Editar movimiento" : selectedRow.type === "entrada" ? "Entrada" : "Salida"}</h3>
              </div>
              <button onClick={closeModal} className="w-8 h-8 rounded-full flex items-center justify-center bg-white/20 text-white hover:bg-white/30 transition-all duration-200">✕</button>
            </div>

            {deleteConfirm ? (
              <div className="px-6 py-6 space-y-4">
                <p className="text-sm text-gray-700">¿Seguro que quieres eliminar este movimiento de <strong>{selectedRow.productName}</strong>? Esta acción no se puede deshacer.</p>
                <div className="flex gap-2">
                  <button onClick={() => setDeleteConfirm(false)} className="flex-1 py-2.5 rounded-full text-sm font-semibold border border-gray-300 text-gray-600 hover:bg-gray-50 transition-all duration-200">Cancelar</button>
                  <button onClick={handleConfirmDelete} className="flex-1 py-2.5 rounded-full text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-all duration-200">Sí, eliminar</button>
                </div>
              </div>
            ) : editMode ? (
              <div className="px-6 py-5 space-y-4">
                {selectedRow.type === "entrada" && (
                  <>
                    {isAdmin && !editIsCTP && !editIsOFFSET && (
                      <select className={selectClass} value={editSubtype} onChange={(e) => setEditSubtype(e.target.value as EditSubtypeValue)}>
                        <option value="compra">Compra a proveedor</option>
                        <option value="ajuste_inventario">Ajuste de Inventario</option>
                      </select>
                    )}
                    {editSubtype === "ajuste_inventario" ? (
                      <p className="text-xs text-gray-400 -mt-1">
                        Ajuste de Inventario: no requiere proveedor ni factura, solo cantidad y observaciones.
                      </p>
                    ) : (
                      <>
                        <input placeholder="Número de factura" className={inputClass} value={editInvoiceNumber} onChange={(e) => setEditInvoiceNumber(e.target.value)} />
                        <input placeholder="Proveedor" className={inputClass} value={editSupplier} onChange={(e) => setEditSupplier(e.target.value)} />
                      </>
                    )}
                  </>
                )}
                {selectedRow.type === "salida" && (
                  <>
                   {!editIsOFFSET && (
                     <select className={selectClass} value={editSubtype} onChange={(e) => { setEditSubtype(e.target.value as any); setEditMotivo(""); setEditOrdenDanio(""); }}>
  <option value="orden_produccion">Orden de producción</option>
  {editIsCTP && <option value="orden_ctp">Orden de CTP</option>}
  <option value="numero_autorizacion">Número de autorización</option>
  {isAdmin && !editIsCTP && <option value="ajuste_inventario">Ajuste de Inventario</option>}
</select>
                   )}

                    {editSubtype === "orden_produccion" && (
                      <input placeholder="Número de orden" className={inputClass} value={editOrderNumber} onChange={(e) => setEditOrderNumber(e.target.value)} />
                    )}

                    {editSubtype === "orden_ctp" && (
                      <input placeholder="Orden de CTP" className={inputClass} value={editCtpOrderNumber} onChange={(e) => setEditCtpOrderNumber(e.target.value)} />
                    )}

                    {editSubtype === "numero_autorizacion" && (
                      <>
                        <input placeholder="Número de autorización" className={inputClass} value={editAuthorizationNumber} onChange={(e) => setEditAuthorizationNumber(e.target.value)} />
                        <select className={selectClass} value={editMotivo} onChange={(e) => { setEditMotivo(e.target.value); setEditOrdenDanio(""); }}>
                          <option value="">Seleccionar motivo</option>
                          {editMotivosDisponibles.map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                        {editMotivosConOrden.includes(editMotivo) && (
                          <input placeholder="Número de orden de producción" className={inputClass} value={editOrdenDanio} onChange={(e) => setEditOrdenDanio(e.target.value)} />
                        )}
                      </>
                    )}
                  </>
                )}
                <div className="flex gap-2">
                  <input type="number" placeholder="Cantidad" className="flex-1 border border-gray-200 bg-white p-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00D4FF]/40 focus:border-[#00D4FF] transition-all duration-200" value={editQuantity || ""} onChange={(e) => setEditQuantity(Number(e.target.value))} />
                  <select
                    className="border border-gray-200 bg-white p-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00D4FF]/40 focus:border-[#00D4FF] w-32"
                    value={editUnit}
                    onChange={(e) => setEditUnit(e.target.value)}
                  >
                    {editUnitOptions.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
                <input placeholder="Responsable *" className={inputClass} value={editResponsible} onChange={(e) => setEditResponsible(e.target.value)} />
                <textarea placeholder="Observaciones (opcional)" className={inputClass} rows={2} value={editObservations} onChange={(e) => setEditObservations(e.target.value)} />
                <div className="flex gap-2 pt-2">
                  <button onClick={() => setEditMode(false)} className="flex-1 py-2.5 rounded-full text-sm font-semibold border border-gray-300 text-gray-600 hover:bg-gray-50 transition-all duration-200">Cancelar</button>
                  <button onClick={handleSaveEdit} className="flex-1 py-2.5 rounded-full text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg shadow-sm" style={{ backgroundColor: "#00D4FF" }}>Guardar cambios</button>
                </div>
              </div>
            ) : (
              <div className="px-6 py-5 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide">Producto</p>
                    <p className="text-sm font-semibold text-gray-800">{selectedRow.productName}</p>
                    <p className="text-xs text-gray-400 font-mono">{selectedRow.productCode}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide">Fecha</p>
                    <p className="text-sm text-gray-700">{formatDate(selectedRow.date)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide">Cantidad</p>
                    <p className="text-sm font-semibold text-gray-800">{selectedRow.originalQuantity ?? selectedRow.quantity} {pluralizeUnit(selectedRow.originalQuantity ?? selectedRow.quantity, selectedRow.originalUnit ?? selectedRow.unit)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide">Responsable</p>
                    <p className="text-sm text-gray-700">{selectedRow.responsible}</p>
                  </div>
                </div>
                {(extraFieldRows.length > 0 || selectedRow.observations) && (
                  <div className="border-t border-gray-100 pt-3 space-y-3">
                    {extraFieldRows.map((row, i) => (
                      <div key={i} className="grid grid-cols-2 gap-3">
                        {row.map((f, j) => (
                          <div key={j}>
                            <p className="text-xs text-gray-400 uppercase tracking-wide">{f.label}</p>
                            <p className="text-sm font-semibold text-gray-800">{f.value}</p>
                          </div>
                        ))}
                      </div>
                    ))}
                    {selectedRow.observations && (
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide">Observaciones</p>
                        <p className="text-sm text-gray-400 italic">{selectedRow.observations}</p>
                      </div>
                    )}
                  </div>
                )}
                {selectedRow.editedBy && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 border-t border-gray-100 pt-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Editado por <span className="font-medium text-gray-500">{selectedRow.editedBy}</span>
                    {selectedRow.editedAt && <> · {formatDate(selectedRow.editedAt)}</>}
                  </div>
                )}
                <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                  <button onClick={() => downloadComprobante(selectedRow)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-full text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg shadow-sm" style={{ backgroundColor: "#00D4FF" }}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Descargar comprobante
                  </button>
                  {puedeEditarEliminar && (
                    <>
                      <button onClick={startEdit} title="Editar" className="w-11 h-11 shrink-0 rounded-full flex items-center justify-center bg-gray-50 transition-all duration-200 hover:scale-110 hover:bg-[#E5FBFF]" style={{ color: "#00A8CC" }}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button onClick={() => setDeleteConfirm(true)} title="Eliminar" className="w-11 h-11 shrink-0 rounded-full flex items-center justify-center bg-gray-50 text-red-400 transition-all duration-200 hover:scale-110 hover:bg-red-50 hover:text-red-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}