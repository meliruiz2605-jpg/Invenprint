// Plural de cada unidad de medida (solo se usa cuando la cantidad es
// distinta de 1, ej: "1 Pliego" pero "500 Pliegos").
const PLURALES_UNIDAD: Record<string, string> = {
  "Pliego": "Pliegos",
  "Resma": "Resmas",
  "Resmilla": "Resmillas",
  "Hoja": "Hojas",
  "Sobre": "Sobres",
  "Plancha": "Planchas",
  "Unidad": "Unidades",
  "Litro": "Litros",
  "Galón": "Galones",
  "Caja": "Cajas",
  "Caja de resmillas": "Cajas de resmillas",
  "Caja de sobres": "Cajas de sobres",
};

export function pluralizeUnit(quantity: number, unit: string): string {
  if (Math.abs(quantity) === 1) return unit;
  return PLURALES_UNIDAD[unit] ?? unit;
}

// Unidad base según familia
export function getBaseUnit(unit: string): string {
  switch (unit) {
    case "Resma":
    case "Pliego":
      return "pliegos";
    case "Resmilla":
    case "Caja de resmillas":
    case "Hoja":
      return "hojas";
    case "Caja de sobres":
    case "Sobre":
      return "sobres";
    default:
      return "unidades";
  }
}

// Conversión a unidad base
// unitsPerPackage: solo aplica para productos CTP con empaque dinámico
// (ej: 1 Caja = 100 Planchas, 1 Envase = 20 Litros). Para Papel se ignora.
export function convertToBase(
  quantity: number,
  unit: string,
  unitsPerPackage?: number
): number {
  switch (unit) {
    case "Resma":
      return quantity * 500;
    case "Pliego":
      return quantity;
    case "Hoja":
      return quantity;
    case "Resmilla":
      return quantity * 500;
    case "Caja de resmillas":
      return quantity * 10 * 500; // 10 resmillas × 500 hojas = 5000 hojas
    case "Caja de sobres":
      return quantity * 500;
    case "Sobre":
      return quantity;
    case "Caja":
      return quantity * (unitsPerPackage ?? 1);
    default:
      return quantity;
  }
}