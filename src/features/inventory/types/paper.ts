export interface Movement {
  id: string;
  date: string;

  type: "entrada" | "salida";

  // Para identificar si es saldo inicial
  isInitial?: boolean;

  // Para diferenciar tipo de salida
  subtype?: "orden_produccion" | "numero_autorizacion" | "orden_ctp" | "ajuste_inventario";

  quantity: number;

  // Unidad y cantidad original que ingresó el usuario (para mostrar en historial)
  originalQuantity?: number;
  originalUnit?: string;

  // Entrada
  invoiceNumber?: string;
  supplier?: string;

  // Salida orden producción
  orderNumber?: string;

  // Salida autorización
  authorizationNumber?: string;
  motivo?:
    | "Daño"
    | "Devolución proveedor"
    | "Salida interna"
    | "Error de despacho"
    | "Resmas incompletas"
    | "Orden mal diligenciada"
    | "Material defectuoso"
    // Motivos de Salida CTP (no se mezclan con los de Papel en la interfaz,
    // pero comparten la misma columna en la base de datos)
    | "Desgaste"
    | "Error de filmado"
    | "Cambio de máquina/montaje"
    | "Pruebas/Mantenimiento";

  ordenDanio?: string;

  // Salida CTP — "Orden de CTP", campo siempre visible junto a orderNumber
  ctpOrderNumber?: string;

  responsible?: string;
  observations?: string;
  description?: string;
  createdAt?: string;

  // Trazabilidad: quién editó por última vez este movimiento y cuándo
  editedBy?: string;
  editedAt?: string;
}

export interface Paper {
  code: string;
  product: string;
  description?: string;
  location?: string;
  unit: string;
  quantity: number;
  convertedUnits: number;
  minStock: number;
  categoria?: string;
  movements: Movement[];

  // Tipo de empaque y cuántas unidades trae (ej: "Caja" con 100 planchas,
  // "Envase" con 20 litros). Si el producto no maneja empaque (se cuenta
  // suelto, como Filtros), ambos quedan undefined.
  packageType?: "Caja" | "Unidad";
  unitsPerPackage?: number;
 }