import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Paper } from "../types/paper";
import { CATEGORIAS } from "../types/categorias";
import { toast } from "@/hooks/use-toast";

interface CreatePaperDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (paper: Paper) => void;
  papers: Paper[];
}

const inputClass = "w-full border border-gray-200 bg-white p-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00D4FF]/40 focus:border-[#00D4FF] transition-all duration-200";
const labelClass = "block text-xs font-semibold text-gray-500 mb-1.5";

const UNIDADES_PAPEL = ["Resma", "Pliego", "Resmilla", "Caja de sobres", "Sobre", "Caja de resmillas"];
const UNIDADES_OFFSET = ["Unidad", "Litro", "Galón"];

export function CreatePaperDialog({
  open,
  onOpenChange,
  onCreate,
  papers,
}: CreatePaperDialogProps) {
  const [code, setCode] = useState("");
  const [product, setProduct] = useState("");
  const [description, setDescription] = useState("");
  const [categoria, setCategoria] = useState<string>(CATEGORIAS[0]);
  const [unit, setUnit] = useState(UNIDADES_PAPEL[0]);
  const [quantity, setQuantity] = useState<number | "">("");
  const [minStock, setMinStock] = useState<number | "">("");
  const [location, setLocation] = useState("");
  const [packageType, setPackageType] = useState<"Caja" | "Unidad">("Unidad");
  const [unitsPerPackage, setUnitsPerPackage] = useState<number | "">("");

  const isCTP = categoria === "CTP";
  const isOFFSET = categoria === "OFFSET";

  function handleCategoriaChange(nuevaCategoria: string) {
    setCategoria(nuevaCategoria);
    if (nuevaCategoria === "CTP") {
      setPackageType("Unidad");
      setUnit("Unidad");
      setUnitsPerPackage("");
    } else if (nuevaCategoria === "OFFSET") {
      setPackageType("Unidad");
      setUnit(UNIDADES_OFFSET[0]);
      setUnitsPerPackage("");
    } else {
      setUnit(UNIDADES_PAPEL[0]);
      setPackageType("Unidad");
      setUnitsPerPackage("");
    }
  }

  function handlePackageTypeChange(value: "Caja" | "Unidad") {
    setPackageType(value);
    // Para CTP, la unidad base se deduce del empaque: Caja = Plancha, Unidad = Unidad.
    setUnit(value === "Caja" ? "Plancha" : "Unidad");
    if (value === "Unidad") setUnitsPerPackage("");
  }

  function calculateConvertedUnits(quantity: number, unit: string): number {
    if (quantity <= 0) return 0;
    switch (unit) {
      case "Resma": return quantity * 500;
      case "Pliego": return quantity;
      case "Resmilla": return quantity * 500;
      case "Caja de sobres": return quantity * 500;
      case "Sobre": return quantity;
      case "Caja de resmillas": return quantity * 10 * 500;
      // CTP: Plancha y Unidad ya son unidades base — el stock se guarda
      // directo, sin factor de conversión. Igual para OFFSET (Unidad,
      // Litro, Galón): no manejan familia de conversión, se guardan tal cual.
      case "Plancha":
      case "Unidad":
      case "Litro":
      case "Galón":
        return quantity;
      default: return quantity;
    }
  }

  function handleSubmit() {
    if (!code.trim() || !product.trim()) return;
    if (quantity === "" || minStock === "") return;
    if (quantity < 0 || minStock < 0) return;
    if (isCTP && packageType === "Caja" && (unitsPerPackage === "" || unitsPerPackage <= 0)) {
      toast({ title: "Falta la cantidad por caja", description: "Escribe cuántas unidades trae cada caja.", variant: "destructive" });
      return;
    }

    const codeExists = papers.some(
      (paper) => paper.code.toLowerCase() === code.trim().toLowerCase()
    );
    if (codeExists) {
      toast({ title: "Código duplicado", description: "Ya existe un material con ese código.", variant: "destructive" });
      return;
    }

    const productExists = papers.some(
      (paper) => paper.product.toLowerCase() === product.trim().toLowerCase() && paper.unit === unit
    );
    if (productExists) {
      toast({ title: "Material duplicado", description: "Este material ya está registrado con la misma unidad.", variant: "destructive" });
      return;
    }

    const convertedUnits = calculateConvertedUnits(quantity, unit);
    const newPaper: Paper = {
      code: code.trim(),
      product: product.trim(),
      description: description.trim() || undefined,
      location: location.trim() || undefined,
      unit,
      quantity,
      minStock,
      convertedUnits,
      categoria,
      packageType: isCTP ? packageType : undefined,
      unitsPerPackage: isCTP && packageType === "Caja" && unitsPerPackage !== "" ? unitsPerPackage : undefined,
      movements: [],
    };

    onCreate(newPaper);
    onOpenChange(false);
    toast({ title: "✅ Material agregado", description: `${product.trim()} fue registrado correctamente.` });

    setCode(""); setProduct(""); setDescription("");
    setCategoria(CATEGORIAS[0]); setUnit(UNIDADES_PAPEL[0]);
    setQuantity(""); setMinStock(""); setLocation("");
    setPackageType("Unidad"); setUnitsPerPackage("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 bg-white">

        {/* Header */}
        <div className="px-6 py-5" style={{ backgroundColor: "#00D4FF" }}>
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white">
              Agregar Nuevo Material
            </DialogTitle>
          </DialogHeader>
          <p className="text-white/80 text-xs mt-1">Completa los campos para registrar un nuevo material en el inventario</p>
        </div>

        <div className="px-6 py-5 max-h-[75vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">

            <div>
              <label className={labelClass}>Código *</label>
              <input placeholder="Ej: PAP-004" className={inputClass} value={code} onChange={(e) => setCode(e.target.value)} />
            </div>

            <div>
              <label className={labelClass}>Categoría *</label>
              <select className={inputClass} value={categoria} onChange={(e) => handleCategoriaChange(e.target.value)}>
                {CATEGORIAS.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className={labelClass}>Nombre del material *</label>
              <input placeholder="Ej: Papel Couché 250gr" className={inputClass} value={product} onChange={(e) => setProduct(e.target.value)} />
            </div>

            <div className="col-span-2">
              <label className={labelClass}>Descripción</label>
              <textarea placeholder="Descripción detallada del material" className={inputClass} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

            {!isCTP && !isOFFSET && (
              <div>
                <label className={labelClass}>Unidad de medida</label>
                <select className={inputClass} value={unit} onChange={(e) => setUnit(e.target.value)}>
                  {UNIDADES_PAPEL.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
            )}

            {isCTP && (
              <div>
                <label className={labelClass}>Se empaca en</label>
                <select className={inputClass} value={packageType} onChange={(e) => handlePackageTypeChange(e.target.value as "Caja" | "Unidad")}>
                  <option value="Unidad">Unidad</option>
                  <option value="Caja">Caja</option>
                </select>
              </div>
            )}

            {isOFFSET && (
              <div>
                <label className={labelClass}>Unidad de medida</label>
                <select className={inputClass} value={unit} onChange={(e) => setUnit(e.target.value)}>
                  {UNIDADES_OFFSET.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className={labelClass}>Stock Actual</label>
              <input type="number" placeholder="Ej: 10" className={inputClass} value={quantity} min={0}
                onChange={(e) => setQuantity(e.target.value === "" ? "" : Number(e.target.value))} />
            </div>

            {isCTP && packageType === "Caja" && (
              <div>
                <label className={labelClass}>Cantidad por caja</label>
                <input type="number" placeholder="Ej: 100" className={inputClass} value={unitsPerPackage} min={1}
                  onChange={(e) => setUnitsPerPackage(e.target.value === "" ? "" : Number(e.target.value))} />
              </div>
            )}

            <div>
              <label className={labelClass}>Stock Mínimo</label>
              <input type="number" placeholder="Ej: 5" className={inputClass} value={minStock} min={0}
                onChange={(e) => setMinStock(e.target.value === "" ? "" : Number(e.target.value))} />
            </div>

            <div className="col-span-2">
              <label className={labelClass}>Ubicación en almacén</label>
              <input placeholder="Ej: Almacén A - Estante 2" className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>

            <div className="col-span-2 pt-2 flex gap-2">
              <button
                onClick={() => onOpenChange(false)}
                className="flex-1 py-3 rounded-full font-semibold text-gray-600 bg-white border border-gray-200 transition-all duration-200 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                className="flex-1 text-white py-3 rounded-full font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg shadow-sm"
                style={{ backgroundColor: "#00D4FF" }}
              >
                + Agregar Material
              </button>
            </div>

          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}