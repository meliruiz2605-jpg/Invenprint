import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Movement } from "../types/paper";
import type { Proveedor } from "@/features/proveedores/types/proveedor";
import { convertToBase, pluralizeUnit } from "@/lib/conversions";
import { toast } from "@/hooks/use-toast";
import entradaIcon from "@/assets/entrada.png";
import salidaIcon from "@/assets/salida.png";

interface StockMovementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paperCode: string;
  paperUnit: string;
  currentStock: number;
  onRegisterMovement: (paperCode: string, movement: Movement) => void;
  canRegistrarEntrada?: boolean;
  canRegistrarSalida?: boolean;
  nombreResponsable: string;
  proveedores?: Proveedor[];
  categoriaProducto?: string;
  packageType?: "Caja" | "Unidad";
  unitsPerPackage?: number;
  isAdmin?: boolean;
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

function getUnitOptions(
  paperUnit: string,
  categoria: string | undefined,
  packageType?: "Caja" | "Unidad",
  type?: "entrada" | "salida"
): string[] {
  if (categoria === "CTP" || categoria === "OFFSET") {
    // Con "Caja" se puede elegir entre la unidad suelta o la caja completa.
    // Con "Unidad" (o sin definir) solo existe la unidad suelta.
    return packageType === "Caja" ? [paperUnit, "Caja"] : [paperUnit];
  }
  // Salida en Papel: el grupo Pliego/Resma queda fijo en Pliego, sin
  // opción de elegir Resma. Entrada sigue dejando elegir ambas.
  if (type === "salida" && (paperUnit === "Resma" || paperUnit === "Pliego")) {
    return ["Pliego"];
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

type SubtypeState = "orden_produccion" | "numero_autorizacion" | "orden_ctp" | "ajuste_inventario" | "compra";

const inputClass = "w-full border border-gray-200 bg-white p-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00D4FF]/40 focus:border-[#00D4FF] transition-all duration-200";
const selectClass = "w-full border border-gray-200 bg-white p-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00D4FF]/40 focus:border-[#00D4FF] transition-all duration-200";
const labelClass = "block text-xs font-semibold text-gray-500 mb-1.5";

export function StockMovementDialog({
  open,
  onOpenChange,
  paperCode,
  paperUnit,
  currentStock,
  onRegisterMovement,
  canRegistrarEntrada = true,
  canRegistrarSalida = true,
  nombreResponsable,
  proveedores = [],
  categoriaProducto,
  packageType,
  unitsPerPackage,
  isAdmin = false,
}: StockMovementDialogProps) {
  const isCTP = categoriaProducto === "CTP";
  const isOFFSET = categoriaProducto === "OFFSET";
  const motivosDisponibles = isCTP ? CTP_MOTIVOS : isOFFSET ? OFFSET_MOTIVOS : PAPEL_MOTIVOS;
  const motivosConOrden: readonly string[] = isCTP ? CTP_MOTIVOS_CON_ORDEN : isOFFSET ? OFFSET_MOTIVOS_CON_ORDEN : PAPEL_MOTIVOS_CON_ORDEN;
  // Ajuste de Inventario: solo Admin, y por ahora solo para Papel (no CTP ni OFFSET)
  const puedeAjustarInventario = isAdmin && !isCTP && !isOFFSET;

  // Para CTP, el flujo normal es registrar salidas mucho más seguido que
  // entradas, así que el modal abre en la pestaña "Salida" de una vez
  // (Papel y OFFSET siguen abriendo en "Entrada" como antes).
  const tipoInicial: "entrada" | "salida" = categoriaProducto === "CTP"
    ? (canRegistrarSalida ? "salida" : "entrada")
    : (canRegistrarEntrada ? "entrada" : "salida");
  const [type, setType] = useState<"entrada" | "salida">(tipoInicial);
  const [subtype, setSubtype] = useState<SubtypeState>(
    tipoInicial === "entrada" ? "compra" : (isOFFSET ? "numero_autorizacion" : "orden_produccion")
  );
  const [quantity, setQuantity] = useState(0);
  const [selectedUnit, setSelectedUnit] = useState(paperUnit);
  const [responsible, setResponsible] = useState(nombreResponsable);

  const proveedoresFiltrados = categoriaProducto
    ? proveedores.filter((p) => p.categorias.includes(categoriaProducto))
    : proveedores;
  const [observations, setObservations] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [supplier, setSupplier] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [ctpOrderNumber, setCtpOrderNumber] = useState("");
  const [authorizationNumber, setAuthorizationNumber] = useState("");
  const [motivo, setMotivo] = useState<string>("");
  const [ordenDanio, setOrdenDanio] = useState("");

  const unitOptions = getUnitOptions(paperUnit, categoriaProducto, packageType, type);

  // Si el usuario tenía "Resma" elegida en Entrada y cambia a Salida
  // (donde Resma ya no es una opción válida), se ajusta automáticamente
  // de vuelta a la unidad base.
  useEffect(() => {
    setSubtype(type === "entrada" ? "compra" : (isOFFSET ? "numero_autorizacion" : "orden_produccion"));
    if (!unitOptions.includes(selectedUnit)) {
      setSelectedUnit(unitOptions[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const quantityInProductUnit = selectedUnit === paperUnit
    ? quantity
    : (() => {
        const basePerSelected = convertToBase(1, selectedUnit, unitsPerPackage);
        const basePerProduct = convertToBase(1, paperUnit, unitsPerPackage);
        return (quantity * basePerSelected) / basePerProduct;
      })();

  const stockInsuficiente = type === "salida" && quantity > 0 && quantityInProductUnit > currentStock;

  function resetForm() {
    setQuantity(0);
    setSelectedUnit(paperUnit);
    setResponsible(nombreResponsable);
    setObservations("");
    setInvoiceNumber("");
    setSupplier("");
    setOrderNumber("");
    setCtpOrderNumber("");
    setAuthorizationNumber("");
    setMotivo("");
    setOrdenDanio("");
    setType(tipoInicial);
    setSubtype(tipoInicial === "entrada" ? "compra" : (isOFFSET ? "numero_autorizacion" : "orden_produccion"));
  }

  function handleSubmit() {
    if (!quantity || quantity <= 0) return;
    if (!responsible) return;
    if (stockInsuficiente) return;

    // Para Salida, el subtype elegido se guarda tal cual. Para Entrada, solo
    // nos interesa guardar "ajuste_inventario" cuando el usuario lo elige
    // explícitamente; una entrada normal ("compra") no guarda subtype,
    // igual que siempre.
    const finalSubtype: Movement["subtype"] =
      type === "salida"
        ? (subtype as Movement["subtype"])
        : subtype === "ajuste_inventario"
          ? "ajuste_inventario"
          : undefined;
    const esAjusteEntrada = type === "entrada" && subtype === "ajuste_inventario";

    const newMovement: Movement = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      type,
      subtype: finalSubtype,
      quantity: quantityInProductUnit,
      originalQuantity: quantity,
      originalUnit: selectedUnit,
      responsible,
      observations: observations || undefined,
      invoiceNumber: type === "entrada" && !esAjusteEntrada ? invoiceNumber : undefined,
      supplier: type === "entrada" && !esAjusteEntrada ? supplier : undefined,
      orderNumber: type === "salida" && subtype === "orden_produccion" ? orderNumber : undefined,
      ctpOrderNumber: type === "salida" && subtype === "orden_ctp" ? ctpOrderNumber : undefined,
      authorizationNumber: type === "salida" && subtype === "numero_autorizacion" ? authorizationNumber : undefined,
      motivo: type === "salida" && subtype === "numero_autorizacion" ? (motivo as Movement["motivo"]) || undefined : undefined,
      ordenDanio: type === "salida" && subtype === "numero_autorizacion" && motivosConOrden.includes(motivo) ? ordenDanio || undefined : undefined,
    };

    onRegisterMovement(paperCode, newMovement);
    resetForm();
    onOpenChange(false);

    toast({
      title: type === "entrada" ? "✅ Entrada registrada" : "✅ Salida registrada",
      description: `Se registró correctamente una ${type} de ${quantity} ${pluralizeUnit(quantity, selectedUnit)}.`,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) resetForm(); onOpenChange(value); }}>
      <DialogContent className="max-w-lg p-0 bg-white">

        {/* Header */}
        <div className="px-6 py-5 transition-colors duration-200" style={{ backgroundColor: type === "entrada" ? "#00D4FF" : "#D90000" }}>
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white">Movimiento de stock</DialogTitle>
          </DialogHeader>
          <p className="text-white/80 text-xs mt-1">
            {type === "entrada" ? "Ingreso de material al inventario" : "Descuento de material por consumo o merma"}
          </p>
        </div>

        <div className="px-6 py-5 space-y-4">

          {/* Tabs Entrada / Salida — solo se muestran las que el usuario tiene
              permitidas. Para CTP se muestran en el orden Salida → Entrada
              (mismo criterio que la pestaña inicial); para Papel y OFFSET
              queda Entrada → Salida como siempre. */}
          {(canRegistrarEntrada && canRegistrarSalida) && (
            <div className="flex gap-1 bg-gray-100 p-1 rounded-full">
              {(categoriaProducto === "CTP" ? (["salida", "entrada"] as const) : (["entrada", "salida"] as const)).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className="flex-1 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2"
                  style={type === t
                    ? { backgroundColor: t === "entrada" ? "#00D4FF" : "#D90000", color: "white" }
                    : { backgroundColor: "transparent", color: "#6b7280" }}
                >
                  <img src={t === "entrada" ? entradaIcon : salidaIcon} alt={t === "entrada" ? "Entrada" : "Salida"} className="w-5 h-5 object-contain" />
                  {t === "entrada" ? "Entrada" : "Salida"}
                </button>
              ))}
            </div>
          )}

          {/* Si solo tiene un permiso, se muestra como etiqueta fija (no elegible) */}
          {!(canRegistrarEntrada && canRegistrarSalida) && (
            <div className="flex items-center justify-center gap-2 py-2.5 rounded-full text-sm font-semibold" style={{ backgroundColor: type === "entrada" ? "#00D4FF" : "#D90000", color: "white" }}>
              <img src={type === "entrada" ? entradaIcon : salidaIcon} alt="" className="w-5 h-5 object-contain" />
              {type === "entrada" ? "Entrada" : "Salida"}
            </div>
          )}

          {/* Campos según tipo */}
          {type === "entrada" && (
            <>
              {puedeAjustarInventario && (
                <div>
                  <label className={labelClass}>Tipo de entrada</label>
                  <select className={selectClass} value={subtype} onChange={(e) => setSubtype(e.target.value as SubtypeState)}>
                    <option value="compra">Compra a proveedor</option>
                    <option value="ajuste_inventario">Ajuste de Inventario</option>
                  </select>
                </div>
              )}

              {subtype === "ajuste_inventario" ? (
                <p className="text-xs text-gray-400 -mt-1">
                  Ajuste de Inventario: úsalo cuando el conteo físico muestra más material del que aparece registrado en el sistema (por ejemplo, un error de conteo anterior). No requiere proveedor ni factura, solo cantidad y observaciones.
                </p>
              ) : (
                <>
                  <div>
                    <label className={labelClass}>Proveedor</label>
                    <select className={selectClass} value={supplier} onChange={(e) => setSupplier(e.target.value)}>
                      <option value="">Seleccionar proveedor</option>
                      {proveedoresFiltrados.map((p) => (
                        <option key={p.id} value={p.nombre}>{p.nombre}</option>
                      ))}
                    </select>
                    {proveedoresFiltrados.length === 0 && (
                      <p className="text-xs text-gray-400 mt-1">
                        No hay proveedores registrados para esta categoría. Agrégalos en la sección "Proveedores".
                      </p>
                    )}
                  </div>
                  <div>
                    <label className={labelClass}>Número de factura</label>
                    <input placeholder="Ej. F-004512" className={inputClass} value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
                  </div>
                </>
              )}
            </>
          )}

          {type === "salida" && (
            <>
              {!isOFFSET && (
                <div>
                  <label className={labelClass}>Tipo de salida</label>
                  <select className={selectClass} value={subtype} onChange={(e) => { setSubtype(e.target.value as any); setMotivo(""); setOrdenDanio(""); }}>
                    <option value="orden_produccion">Orden de producción</option>
                    {isCTP && <option value="orden_ctp">Orden de CTP</option>}
                    <option value="numero_autorizacion">Número de autorización</option>
                    {puedeAjustarInventario && <option value="ajuste_inventario">Ajuste de Inventario</option>}
                  </select>
                </div>
              )}

              {subtype === "orden_produccion" && (
                <div>
                  <label className={labelClass}>Orden de producción</label>
                  <input placeholder="Ej. 23648" className={inputClass} value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} />
                </div>
              )}

              {subtype === "orden_ctp" && (
                <div>
                  <label className={labelClass}>Orden de CTP</label>
                  <input placeholder="Ej. 23648" className={inputClass} value={ctpOrderNumber} onChange={(e) => setCtpOrderNumber(e.target.value)} />
                </div>
              )}

              {subtype === "numero_autorizacion" && (
                <>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className={labelClass}>Motivo</label>
                      <select className={selectClass} value={motivo} onChange={(e) => { setMotivo(e.target.value); setOrdenDanio(""); }}>
                        <option value="">Seleccionar motivo</option>
                        {motivosDisponibles.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className={labelClass}>Autorización</label>
                      <input placeholder="Ej. 42" className={inputClass} value={authorizationNumber} onChange={(e) => setAuthorizationNumber(e.target.value)} />
                    </div>
                  </div>
                  {motivosConOrden.includes(motivo) && (
                    <div>
                      <label className={labelClass}>Orden de producción</label>
                      <input
                        placeholder="Número de orden de producción"
                        className={inputClass}
                        value={ordenDanio}
                        onChange={(e) => setOrdenDanio(e.target.value)}
                      />
                    </div>
                  )}
                </>
              )}

              {subtype === "ajuste_inventario" && (
                <p className="text-xs text-gray-400 -mt-1">
                  Ajuste de Inventario: no requiere orden ni motivo, solo cantidad y observaciones.
                </p>
              )}
            </>
          )}

          {/* Cantidad + unidad */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className={labelClass}>Cantidad</label>
              <input
                type="number"
                placeholder="0"
                className={`w-full border p-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 transition-all duration-200 ${
                  stockInsuficiente
                    ? "border-red-400 bg-red-50 focus:ring-red-300"
                    : "border-gray-200 bg-white focus:ring-[#00D4FF]/40 focus:border-[#00D4FF]"
                }`}
                value={quantity || ""}
                onChange={(e) => setQuantity(Number(e.target.value))}
              />
            </div>
            <div>
              <label className={labelClass}>Unidad</label>
              <select
                className="border border-gray-200 bg-white p-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00D4FF]/40 focus:border-[#00D4FF] transition-all duration-200"
                value={selectedUnit}
                onChange={(e) => setSelectedUnit(e.target.value)}
                disabled={unitOptions.length === 1}
              >
                {unitOptions.map((unit) => (<option key={unit} value={unit}>{unit}</option>))}
              </select>
            </div>
          </div>

          {/* Advertencia stock insuficiente */}
          {stockInsuficiente && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium" style={{ backgroundColor: "#fff0f0", color: "#D90000", border: "1px solid #fecaca" }}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              Stock insuficiente — Solo hay <strong className="mx-1">{currentStock} {pluralizeUnit(currentStock, paperUnit)}</strong> disponibles
            </div>
          )}

          <div>
            <label className={labelClass}>Observaciones (opcional)</label>
            <textarea placeholder="Detalle del movimiento, pedido o responsable externo" className={inputClass} rows={2} value={observations} onChange={(e) => setObservations(e.target.value)} />
          </div>

          {/* Botones */}
          <div className="flex gap-2">
            <button
              onClick={() => { resetForm(); onOpenChange(false); }}
              className="flex-1 py-3 rounded-full font-semibold text-gray-600 bg-white border border-gray-200 transition-all duration-200 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={stockInsuficiente}
              className="flex-1 text-white py-3 rounded-full font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg shadow-sm disabled:opacity-50 disabled:pointer-events-none disabled:hover:translate-y-0"
              style={{ backgroundColor: type === "entrada" ? "#00D4FF" : "#D90000" }}
            >
              Registrar {type === "entrada" ? "Entrada" : "Salida"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}