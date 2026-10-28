import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Paper, Movement } from "../types/paper";
import { convertToBase, pluralizeUnit } from "@/lib/conversions";
import { toast } from "@/hooks/use-toast";

interface MultiSalidaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  papers: Paper[];
  onRegisterMovement: (paperCode: string, movement: Movement) => Promise<void>;
  nombreResponsable: string;
  canVerPapel: boolean;
  canVerCTP: boolean;
}

interface Linea {
  paperCode: string;
  product: string;
  paperUnit: string;
  categoria: string;
  packageType?: "Caja" | "Unidad";
  unitsPerPackage?: number;
  currentStock: number;
  quantity: number;
  selectedUnit: string;
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

const PAPEL_MOTIVOS_CON_ORDEN = [
  "Daño",
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
  "Funcionamiento del Equipo",
] as const;

const CTP_MOTIVOS_CON_ORDEN = [
  "Daño",
  "Desgaste",
  "Error de filmado",
  "Cambio de máquina/montaje",
] as const;

function getStockReal(paper: Paper): number {
  return paper.movements.reduce(
    (total, m) => (m.type === "entrada" ? total + m.quantity : total - m.quantity),
    0
  );
}

function getUnitOptionsPapel(paperUnit: string): string[] {
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

// Mismo criterio que en StockMovementDialog: para CTP, la única unidad es
// la unidad suelta del producto, salvo que tenga empaque tipo "Caja", en
// cuyo caso también se puede elegir la caja completa.
function getUnitOptions(paperUnit: string, isCTP: boolean, packageType?: "Caja" | "Unidad"): string[] {
  if (isCTP) {
    return packageType === "Caja" ? [paperUnit, "Caja"] : [paperUnit];
  }
  return getUnitOptionsPapel(paperUnit);
}

const inputClass = "w-full border border-gray-200 bg-white p-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00D4FF]/40 focus:border-[#00D4FF] transition-all duration-200";
const selectClass = "w-full border border-gray-200 bg-white p-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00D4FF]/40 focus:border-[#00D4FF] transition-all duration-200";
const labelClass = "block text-xs font-semibold text-gray-500 mb-1.5";

export function MultiSalidaDialog({
  open,
  onOpenChange,
  papers,
  onRegisterMovement,
  nombreResponsable,
  canVerPapel,
  canVerCTP,
}: MultiSalidaDialogProps) {
  // Solo se ofrecen las categorías que este usuario tiene permiso de ver
  // (mismo criterio que en Inventario, Alertas y Reportes). Si solo tiene
  // una, el selector ni siquiera se muestra.
  const categoriasPermitidas = (["Papel", "CTP"] as const).filter((c) =>
    c === "CTP" ? canVerCTP : canVerPapel
  );
  const categoriaPorDefecto = categoriasPermitidas[0] ?? "Papel";

  const [categoriaSalida, setCategoriaSalida] = useState<"Papel" | "CTP">(categoriaPorDefecto);
  const [subtype, setSubtype] = useState<"orden_produccion" | "numero_autorizacion" | "orden_ctp">("orden_produccion");
  const [orderNumber, setOrderNumber] = useState("");
  const [ctpOrderNumber, setCtpOrderNumber] = useState("");
  const [authorizationNumber, setAuthorizationNumber] = useState("");
  const [motivo, setMotivo] = useState<string>("");
  const [ordenDanio, setOrdenDanio] = useState("");
  const [responsible, setResponsible] = useState(nombreResponsable);
  const [observations, setObservations] = useState("");
  const [lineas, setLineas] = useState<Linea[]>([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);
  const [quantity, setQuantity] = useState(0);
  const [selectedUnit, setSelectedUnit] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Una salida múltiple es de una sola categoría a la vez (Papel o CTP),
  // elegida arriba con el selector de categoría, igual que en una salida
  // normal: según la categoría cambian tanto los tipos de orden disponibles
  // (Orden CTP solo existe para CTP) como los motivos de "Número de
  // autorización".
  const esCTP = categoriaSalida === "CTP";
  const motivosDisponibles = esCTP ? CTP_MOTIVOS : PAPEL_MOTIVOS;
  const motivosConOrden: readonly string[] = esCTP ? CTP_MOTIVOS_CON_ORDEN : PAPEL_MOTIVOS_CON_ORDEN;

  const productosDisponibles = papers.filter((p) => {
    if (lineas.some((l) => l.paperCode === p.code)) return false;
    if ((p.categoria ?? "Papel") !== categoriaSalida) return false;
    return true;
  });

  function handleCategoriaSalidaChange(nueva: "Papel" | "CTP") {
    if (nueva === categoriaSalida || lineas.length > 0) return;
    setCategoriaSalida(nueva);
    setSubtype("orden_produccion");
    setMotivo("");
    setOrdenDanio("");
    resetProductForm();
  }

  const searchResults = searchTerm.trim()
    ? productosDisponibles
        .filter(
          (p) =>
            p.product.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.code.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .slice(0, 6)
    : [];

  function handleSelectProduct(paper: Paper) {
    setSelectedPaper(paper);
    setSearchTerm(paper.product);
    setSelectedUnit(paper.unit);
    setQuantity(0);
  }

  function resetProductForm() {
    setSelectedPaper(null);
    setSearchTerm("");
    setQuantity(0);
    setSelectedUnit("");
  }

  function handleAddLinea() {
    if (!selectedPaper) {
      toast({ title: "Selecciona un producto primero", variant: "destructive" });
      return;
    }
    if (!quantity || quantity <= 0) {
      toast({ title: "Escribe una cantidad válida", variant: "destructive" });
      return;
    }
    const categoriaProducto = selectedPaper.categoria ?? "Papel";
    if (categoriaProducto !== categoriaSalida) {
      toast({
        title: "No se puede mezclar Papel y CTP",
        description: "Registra los productos de cada categoría en una salida múltiple aparte.",
        variant: "destructive",
      });
      return;
    }

    const currentStock = getStockReal(selectedPaper);
    const quantityInProductUnit =
      selectedUnit === selectedPaper.unit
        ? quantity
        : (() => {
            const basePerSelected = convertToBase(1, selectedUnit, selectedPaper.unitsPerPackage);
            const basePerProduct = convertToBase(1, selectedPaper.unit, selectedPaper.unitsPerPackage);
            return (quantity * basePerSelected) / basePerProduct;
          })();

    if (quantityInProductUnit > currentStock) {
      toast({
        title: "Stock insuficiente",
        description: `Solo hay ${currentStock} ${pluralizeUnit(currentStock, selectedPaper.unit)} de ${selectedPaper.product}.`,
        variant: "destructive",
      });
      return;
    }

    setLineas((prev) => [
      ...prev,
      {
        paperCode: selectedPaper.code,
        product: selectedPaper.product,
        paperUnit: selectedPaper.unit,
        categoria: categoriaProducto,
        packageType: selectedPaper.packageType,
        unitsPerPackage: selectedPaper.unitsPerPackage,
        currentStock,
        quantity,
        selectedUnit,
      },
    ]);
    resetProductForm();
  }

  function handleRemoveLinea(paperCode: string) {
    setLineas((prev) => prev.filter((l) => l.paperCode !== paperCode));
  }

  function resetAll() {
    setCategoriaSalida(categoriaPorDefecto);
    setSubtype("orden_produccion");
    setOrderNumber("");
    setCtpOrderNumber("");
    setAuthorizationNumber("");
    setMotivo("");
    setOrdenDanio("");
    setResponsible(nombreResponsable);
    setObservations("");
    setLineas([]);
    resetProductForm();
  }

  async function handleSubmit() {
    if (subtype === "orden_produccion" && !orderNumber.trim()) {
      toast({ title: "Escribe el número de orden", variant: "destructive" });
      return;
    }
    if (subtype === "orden_ctp" && !ctpOrderNumber.trim()) {
      toast({ title: "Escribe el número de orden de CTP", variant: "destructive" });
      return;
    }
    if (subtype === "numero_autorizacion" && !authorizationNumber.trim()) {
      toast({ title: "Escribe el número de autorización", variant: "destructive" });
      return;
    }
    if (lineas.length === 0) {
      toast({ title: "Agrega al menos un producto", variant: "destructive" });
      return;
    }
    if (!responsible) {
      toast({ title: "Escribe el responsable", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      for (const linea of lineas) {
        const quantityInProductUnit =
          linea.selectedUnit === linea.paperUnit
            ? linea.quantity
            : (() => {
                const basePerSelected = convertToBase(1, linea.selectedUnit, linea.unitsPerPackage);
                const basePerProduct = convertToBase(1, linea.paperUnit, linea.unitsPerPackage);
                return (linea.quantity * basePerSelected) / basePerProduct;
              })();

        const movement: Movement = {
          id: `${Date.now()}-${linea.paperCode}`,
          date: new Date().toISOString(),
          type: "salida",
          subtype,
          quantity: quantityInProductUnit,
          originalQuantity: linea.quantity,
          originalUnit: linea.selectedUnit,
          orderNumber: subtype === "orden_produccion" ? orderNumber.trim() : undefined,
          ctpOrderNumber: subtype === "orden_ctp" ? ctpOrderNumber.trim() : undefined,
          authorizationNumber: subtype === "numero_autorizacion" ? authorizationNumber.trim() : undefined,
          motivo: subtype === "numero_autorizacion" ? (motivo as Movement["motivo"]) || undefined : undefined,
          ordenDanio: subtype === "numero_autorizacion" && motivosConOrden.includes(motivo) ? ordenDanio || undefined : undefined,
          responsible,
          observations: observations || undefined,
        };

        await onRegisterMovement(linea.paperCode, movement);
      }

      toast({
        title: "✅ Salida múltiple registrada",
        description: `Se registraron ${lineas.length} productos correctamente.`,
      });
      resetAll();
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast({ title: "❌ Error", description: "No se pudo registrar la salida múltiple.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) resetAll(); onOpenChange(value); }}>
      <DialogContent className="max-w-lg p-0 bg-white">

        <div className="px-6 py-5" style={{ backgroundColor: "#D90000" }}>
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white">Salida Múltiple</DialogTitle>
          </DialogHeader>
          <p className="text-white/80 text-xs mt-1">Registra varios productos bajo la misma orden</p>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[75vh] overflow-y-auto">

          {/* Categoría de la salida — solo se muestra si el usuario tiene
              permiso de ver más de una categoría; si solo ve una, queda
              fija en esa sin necesidad de elegir. */}
          {categoriasPermitidas.length > 1 && (
            <div>
              <p className={labelClass}>Categoría</p>
              <div className="flex gap-1 bg-gray-100 p-1 rounded-full">
                {categoriasPermitidas.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    disabled={lineas.length > 0}
                    onClick={() => handleCategoriaSalidaChange(cat)}
                    className="flex-1 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none"
                    style={categoriaSalida === cat
                      ? { backgroundColor: "#D90000", color: "white" }
                      : { backgroundColor: "transparent", color: "#6b7280" }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              {lineas.length > 0 && (
                <p className="text-xs text-gray-400 mt-1.5">
                  Quita los productos agregados para cambiar de categoría.
                </p>
              )}
            </div>
          )}

          {/* Datos de la orden */}
          <div>
            <p className={labelClass}>Datos de la orden (aplican a todos los productos)</p>
            <select
              className={selectClass + " mb-2"}
              value={subtype}
              onChange={(e) => { setSubtype(e.target.value as any); setMotivo(""); setOrdenDanio(""); }}
            >
              <option value="orden_produccion">Orden de producción</option>
              {esCTP && <option value="orden_ctp">Orden de CTP</option>}
              <option value="numero_autorizacion">Número de autorización</option>
            </select>

            {subtype === "orden_produccion" && (
              <input
                placeholder="Número de orden de producción"
                className={inputClass}
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
              />
            )}

            {subtype === "orden_ctp" && (
              <input
                placeholder="Ej. 23648"
                className={inputClass}
                value={ctpOrderNumber}
                onChange={(e) => setCtpOrderNumber(e.target.value)}
              />
            )}

            {subtype === "numero_autorizacion" && (
              <div className="space-y-2">
                <input
                  placeholder="Número de autorización"
                  className={inputClass}
                  value={authorizationNumber}
                  onChange={(e) => setAuthorizationNumber(e.target.value)}
                />
                <select
                  className={selectClass}
                  value={motivo}
                  onChange={(e) => { setMotivo(e.target.value); setOrdenDanio(""); }}
                >
                  <option value="">Seleccionar motivo</option>
                  {motivosDisponibles.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                {motivosConOrden.includes(motivo) && (
                  <input
                    placeholder="Número de orden de producción"
                    className={inputClass}
                    value={ordenDanio}
                    onChange={(e) => setOrdenDanio(e.target.value)}
                  />
                )}
              </div>
            )}
          </div>

          {/* Buscar y agregar producto */}
          <div className="border-t border-gray-100 pt-4">
            <p className={labelClass}>Agregar producto</p>
            <p className="text-xs text-gray-400 -mt-1 mb-2">
              Solo se muestran productos de categoría {categoriaSalida}.
            </p>
            <div className="relative">
              <input
                placeholder="Buscar producto o código..."
                className={inputClass}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setSelectedPaper(null);
                }}
              />
              {searchTerm && !selectedPaper && searchResults.length > 0 && (
                <div className="absolute z-10 w-full bg-white border border-gray-100 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                  {searchResults.map((p) => (
                    <button
                      key={p.code}
                      type="button"
                      onClick={() => handleSelectProduct(p)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-[#FEF2F2] transition-colors duration-150 flex items-center justify-between"
                    >
                      <span className="text-gray-700">{p.product}</span>
                      <span className="text-gray-400 font-mono text-xs">{p.code}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedPaper && (
              <div className="flex gap-2 mt-2">
                <input
                  type="number"
                  placeholder="Cantidad"
                  className={inputClass + " flex-1"}
                  value={quantity || ""}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                />
                <select
                  className="border border-gray-200 bg-white p-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00D4FF]/40 focus:border-[#00D4FF] transition-all duration-200"
                  value={selectedUnit}
                  onChange={(e) => setSelectedUnit(e.target.value)}
                >
                  {getUnitOptions(selectedPaper.unit, (selectedPaper.categoria ?? "Papel") === "CTP", selectedPaper.packageType).map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddLinea}
                  className="px-4 rounded-lg text-sm font-semibold text-white transition-all duration-200 shrink-0 hover:-translate-y-0.5 hover:shadow-md"
                  style={{ backgroundColor: "#00D4FF" }}
                >
                  + Agregar
                </button>
              </div>
            )}
          </div>

          {/* Lista de productos agregados */}
          {lineas.length > 0 && (
            <div className="border-t border-gray-100 pt-4">
              <p className={labelClass}>Productos agregados ({lineas.length})</p>
              <div className="space-y-1.5">
                {lineas.map((l) => (
                  <div key={l.paperCode} className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-lg px-3 py-2.5">
                    <span className="text-sm text-gray-700">
                      {l.product} <span className="text-gray-400">· {l.quantity} {pluralizeUnit(l.quantity, l.selectedUnit)}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveLinea(l.paperCode)}
                      className="flex items-center justify-center w-6 h-6 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors duration-150 text-sm font-bold shrink-0"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-gray-100 pt-4">
            <label className={labelClass}>Observaciones (opcional)</label>
            <textarea
              placeholder="Aplica a todas las salidas de esta orden"
              className={inputClass}
              rows={2}
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
            />
          </div>

          {/* Botones */}
          <div className="flex gap-2">
            <button
              onClick={() => { resetAll(); onOpenChange(false); }}
              className="flex-1 py-3 rounded-full font-semibold text-gray-600 bg-white border border-gray-200 transition-all duration-200 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || lineas.length === 0}
              className="flex-1 text-white py-3 rounded-full font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg shadow-sm disabled:opacity-50 disabled:pointer-events-none disabled:hover:translate-y-0"
              style={{ backgroundColor: "#D90000" }}
            >
              {submitting
                ? "Registrando..."
                : `Registrar ${lineas.length > 0 ? lineas.length : ""} salida${lineas.length === 1 ? "" : "s"}`}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}