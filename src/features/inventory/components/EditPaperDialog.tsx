import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Paper } from "../types/paper";
import { CATEGORIAS } from "../types/categorias";
import { toast } from "@/hooks/use-toast";

interface EditPaperDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paper: Paper | null;
  papers: Paper[];
  onUpdate: (paper: Paper, oldCode: string) => void;
}

const inputClass = "w-full border border-gray-200 bg-white p-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00D4FF]/40 focus:border-[#00D4FF] transition-all duration-200";
const labelClass = "block text-xs font-semibold text-gray-500 mb-1.5";

const UNIDADES_PAPEL = ["Resma", "Pliego", "Resmilla", "Caja de sobres", "Sobre", "Caja de resmillas"];
const UNIDADES_OFFSET = ["Unidad", "Litro", "Galón"];

export function EditPaperDialog({
  open,
  onOpenChange,
  paper,
  papers,
  onUpdate,
}: EditPaperDialogProps) {
  const [code, setCode] = useState("");
  const [product, setProduct] = useState("");
  const [description, setDescription] = useState("");
  const [unit, setUnit] = useState("Resma");
  const [minStock, setMinStock] = useState(0);
  const [location, setLocation] = useState("");
  const [categoria, setCategoria] = useState<string>(CATEGORIAS[0]);
  const [packageType, setPackageType] = useState<"Caja" | "Unidad">("Unidad");
  const [unitsPerPackage, setUnitsPerPackage] = useState<number | "">("");

  useEffect(() => {
    if (paper) {
      setCode(paper.code);
      setProduct(paper.product);
      setDescription((paper as any).description || "");
      setUnit(paper.unit);
      setMinStock(paper.minStock);
      setLocation((paper as any).location || "");
      setCategoria(paper.categoria || CATEGORIAS[0]);
      setPackageType(paper.packageType ?? "Unidad");
      setUnitsPerPackage(paper.unitsPerPackage ?? "");
    }
  }, [paper]);

  if (!paper) return null;

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
    setUnit(value === "Caja" ? "Plancha" : "Unidad");
    if (value === "Unidad") setUnitsPerPackage("");
  }

  function handleSave() {
    if (!paper) return;

    const trimmedCode = code.trim();
    if (!trimmedCode) {
      toast({ title: "⚠️ El código no puede estar vacío", variant: "destructive" });
      return;
    }

    if (trimmedCode.toLowerCase() !== paper.code.toLowerCase()) {
      const codeExists = papers.some(
        (p) => p.code.toLowerCase() === trimmedCode.toLowerCase() && p.code !== paper.code
      );
      if (codeExists) {
        toast({ title: "⚠️ Código duplicado", description: "Ya existe otro material con ese código.", variant: "destructive" });
        return;
      }
    }

    if (isCTP && packageType === "Caja" && (unitsPerPackage === "" || unitsPerPackage <= 0)) {
      toast({ title: "Falta la cantidad por caja", description: "Escribe cuántas unidades trae cada caja.", variant: "destructive" });
      return;
    }

    const updatedPaper: Paper = {
      ...paper,
      code: trimmedCode,
      product: product.trim(),
      unit,
      minStock,
      categoria,
      packageType: isCTP ? packageType : undefined,
      unitsPerPackage: isCTP && packageType === "Caja" && unitsPerPackage !== "" ? unitsPerPackage : undefined,
      ...(description && { description } as any),
      ...(location && { location } as any),
    };

    onUpdate(updatedPaper, paper.code);
    onOpenChange(false);

    toast({
      title: "✅ Material actualizado",
      description: `${product.trim()} fue editado correctamente.`,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 bg-white">

        {/* Header */}
        <div className="px-6 py-5" style={{ backgroundColor: "#00D4FF" }}>
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white">
              Editar Material
            </DialogTitle>
          </DialogHeader>
          <p className="text-white/80 text-xs mt-1">
            Editando: <span className="font-semibold text-white">{paper.product}</span>
            <span className="ml-2 font-mono text-white/70">{paper.code}</span>
          </p>
        </div>

        <div className="px-6 py-5 max-h-[75vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">

            <div className="col-span-2">
              <label className={labelClass}>Nombre del material</label>
              <input className={inputClass} value={product} onChange={(e) => setProduct(e.target.value)} />
            </div>

            <div className="col-span-2">
              <label className={labelClass}>Descripción</label>
              <textarea className={inputClass} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

            <div>
              <label className={labelClass}>Código</label>
              <input className={inputClass} value={code} onChange={(e) => setCode(e.target.value)} />
              <p className="text-xs text-gray-400 mt-1">
                Cambiar el código actualiza también todo su historial de movimientos.
              </p>
            </div>

            <div>
              <label className={labelClass}>Categoría</label>
              <select className={inputClass} value={categoria} onChange={(e) => handleCategoriaChange(e.target.value)}>
                {CATEGORIAS.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
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

            {isCTP && (
              <div>
                <label className={labelClass}>Se empaca en</label>
                <select className={inputClass} value={packageType} onChange={(e) => handlePackageTypeChange(e.target.value as "Caja" | "Unidad")}>
                  <option value="Unidad">Unidad</option>
                  <option value="Caja">Caja</option>
                </select>
              </div>
            )}

            {isCTP && packageType === "Caja" && (
              <div>
                <label className={labelClass}>Cantidad por caja</label>
                <input type="number" className={inputClass} value={unitsPerPackage} min={1}
                  onChange={(e) => setUnitsPerPackage(e.target.value === "" ? "" : Number(e.target.value))} />
              </div>
            )}

            <div>
              <label className={labelClass}>Stock Mínimo</label>
              <input type="number" className={inputClass} value={minStock}
                onChange={(e) => setMinStock(Number(e.target.value))} />
            </div>

            <div className="col-span-2">
              <label className={labelClass}>Ubicación en almacén</label>
              <input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>

            <div className="col-span-2 pt-2 flex gap-2">
              <button
                onClick={() => onOpenChange(false)}
                className="flex-1 py-3 rounded-full font-semibold text-gray-600 bg-white border border-gray-200 transition-all duration-200 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                className="flex-1 text-white py-3 rounded-full font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg shadow-sm"
                style={{ backgroundColor: "#00D4FF" }}
              >
                Guardar Cambios
              </button>
            </div>

          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}