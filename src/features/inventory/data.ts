import type { Paper } from "./types/paper";

export const papers: Paper[] = [
  {
    code: "PAP-001",
    product: "Papel Bond 75gr",
    unit: "Resma",
    quantity: 2, // 5 entradas - 3 salidas = 2 Resmas
    convertedUnits: 1000, // 2 × 500 = 1000 pliegos
    minStock: 50,
    movements: [
      {
        id: "1",
        date: "2026-02-10 10:30",
        type: "entrada",
        quantity: 5, // 5 Resmas
        responsible: "Admin",
        invoiceNumber: "FAC-001",
        supplier: "Proveedor A",
        observations: "Compra proveedor",
      },
      {
        id: "2",
        date: "2026-02-11 14:20",
        type: "salida",
        quantity: 3, // 3 Resmas
        responsible: "Producción",
        orderNumber: "ORD-123",
        observations: "Pedido cliente",
      },
    ],
  },
  {
    code: "PAP-002",
    product: "Cartulina Blanca",
    unit: "Pliego",
    quantity: 10, // 10 Pliegos
    convertedUnits: 10, // Pliego = base, 1:1
    minStock: 5,
    movements: [
      {
        id: "3",
        date: "2026-02-09 09:00",
        type: "entrada",
        quantity: 10, // 10 Pliegos
        responsible: "Admin",
        invoiceNumber: "FAC-002",
        supplier: "Proveedor B",
        observations: "Ingreso inicial",
      },
    ],
  },
  {
    code: "PAP-003",
    product: "Papel Reciclado",
    unit: "Resma",
    quantity: 0,
    convertedUnits: 0,
    minStock: 200,
    movements: [],
  },
  {
    code: "PAP-004",
    product: "Papel",
    unit: "Resma",
    quantity: 10,
    convertedUnits: 5000,
    minStock: 5,
    movements: [
      {
        id: "4",
        date: "2026-02-10 08:00",
        type: "entrada",
        quantity: 10, // 10 Resmas
        responsible: "Sistema",
        observations: "Saldo inicial",
        isInitial: true,
      },
    ],
  },
  {
    code: "PAP-005",
    product: "Propalcote",
    unit: "Caja de resmillas",
    quantity: 5, // 5 Cajas de resmillas (NO 25000)
    convertedUnits: 25000, // 5 × 10 × 500 = 25000 hojas
    minStock: 2,
    movements: [
      {
        id: "5",
        date: new Date().toLocaleString(),
        type: "entrada",
        quantity: 5, // 5 Cajas de resmillas
        responsible: "Sistema",
        observations: "Saldo inicial",
        isInitial: true,
      },
    ],
  },
];
