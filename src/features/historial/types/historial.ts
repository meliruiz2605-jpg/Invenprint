export interface HistorialMovimiento {
  id: string;
  movementId: string;
  paperCode?: string;
  productoNombre?: string;
  accion: "editar" | "eliminar";
  usuarioNombre: string;
  usuarioId?: string;
  fecha: string;
  snapshotAnterior?: any;
  snapshotNuevo?: any;
}