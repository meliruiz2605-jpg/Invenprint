export interface Permisos {
  agregarProducto: boolean;
  editarProducto: boolean;
  eliminarProducto: boolean;
  registrarEntrada: boolean;
  registrarSalida: boolean;
  verProveedores: boolean;
  editarProveedores: boolean;
  eliminarProveedores: boolean;
  editarEliminarReportes: boolean;
  verCTP: boolean;
  editarCTP: boolean;
  eliminarCTP: boolean;
  verPapel: boolean;
  verOFFSET: boolean;
  editarOFFSET: boolean;
  eliminarOFFSET: boolean;
}

export const PERMISOS_DEFAULT: Permisos = {
  agregarProducto: true,
  editarProducto: false,
  eliminarProducto: false,
  registrarEntrada: true,
  registrarSalida: true,
  verProveedores: false,
  editarProveedores: false,
  eliminarProveedores: false,
  editarEliminarReportes: false,
  verCTP: false,
  editarCTP: false,
  eliminarCTP: false,
  verPapel: true,
  verOFFSET: false,
  editarOFFSET: false,
  eliminarOFFSET: false,
};

export const PERMISOS_LABELS: { key: keyof Permisos; label: string }[] = [
  { key: "agregarProducto", label: "Agregar producto" },
  { key: "editarProducto", label: "Editar producto" },
  { key: "eliminarProducto", label: "Eliminar producto" },
  { key: "registrarEntrada", label: "Registrar entrada" },
  { key: "registrarSalida", label: "Registrar salida" },
  { key: "verProveedores", label: "Ver proveedores" },
  { key: "editarProveedores", label: "Editar proveedores" },
  { key: "eliminarProveedores", label: "Eliminar proveedores" },
  { key: "editarEliminarReportes", label: "Editar/eliminar movimientos en Reportes" },
  { key: "verCTP", label: "Ver CTP" },
  { key: "editarCTP", label: "Editar CTP" },
  { key: "eliminarCTP", label: "Eliminar CTP" },
  { key: "verPapel", label: "Ver Papel" },
  { key: "verOFFSET", label: "Ver OFFSET" },
  { key: "editarOFFSET", label: "Editar OFFSET" },
  { key: "eliminarOFFSET", label: "Eliminar OFFSET" },
];