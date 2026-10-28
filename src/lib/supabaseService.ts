import { supabase } from "@/supabase";
import type { Paper, Movement } from "@/features/inventory/types/paper";
import type { Permisos } from "@/features/auth/types/permisos";
import type { Proveedor } from "@/features/proveedores/types/proveedor";
import type { HistorialMovimiento } from "@/features/historial/types/historial";

// ─── PAPERS ───────────────────────────────────────────────

export async function getPapers(): Promise<Paper[]> {
  const { data: papers, error } = await supabase
    .from("papers")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw error;

  const { data: movementsDesc, error: movError } = await supabase
    .from("movements")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10000);

  if (movError) throw movError;

  const movements = [...movementsDesc].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  return papers.map((p) => ({
    code: p.code,
    product: p.product,
    description: p.description ?? undefined,
    location: p.location ?? undefined,
    unit: p.unit,
    quantity: p.quantity,
    minStock: p.min_stock,
    convertedUnits: p.converted_units,
    categoria: p.categoria ?? "Papel",
    packageType: p.package_type ?? undefined,
    unitsPerPackage: p.units_per_package ?? undefined,
    movements: movements
      .filter((m) => m.paper_code === p.code)
      .map(mapMovement),
  }));
}

export async function createPaper(paper: Paper): Promise<void> {
  const { error } = await supabase.from("papers").insert({
    code: paper.code,
    product: paper.product,
    description: paper.description ?? null,
    location: paper.location ?? null,
    unit: paper.unit,
    quantity: paper.quantity,
    min_stock: paper.minStock,
    converted_units: paper.convertedUnits,
    categoria: paper.categoria ?? "Papel",
    package_type: paper.packageType ?? null,
    units_per_package: paper.unitsPerPackage ?? null,
  });
  if (error) throw error;

  if (paper.movements.length > 0) {
    await insertMovements(paper.code, paper.movements);
  }
}

export async function updatePaper(paper: Paper, oldCode?: string): Promise<void> {
  const { error } = await supabase
    .from("papers")
    .update({
      code: paper.code,
      product: paper.product,
      description: paper.description ?? null,
      location: paper.location ?? null,
      unit: paper.unit,
      min_stock: paper.minStock,
      categoria: paper.categoria ?? "Papel",
      package_type: paper.packageType ?? null,
      units_per_package: paper.unitsPerPackage ?? null,
    })
    .eq("code", oldCode ?? paper.code);
  if (error) throw error;
}

export async function deletePaper(code: string): Promise<void> {
  // Primero se borran todos los movimientos enlazados a este producto
  // (incluido el de "Saldo inicial" que se crea automáticamente al
  // agregar un material desde el formulario), para que la base de datos
  // no rechace el borrado del producto por la restricción de llave
  // foránea "movements_paper_code_fkey".
  const { error: movError } = await supabase
    .from("movements")
    .delete()
    .eq("paper_code", code);
  if (movError) throw movError;

  const { error } = await supabase
    .from("papers")
    .delete()
    .eq("code", code);
  if (error) throw error;
}

// ─── MOVEMENTS ────────────────────────────────────────────

export async function addMovement(paperCode: string, movement: Movement): Promise<void> {
  const { error } = await supabase.from("movements").insert({
    paper_code: paperCode,
    type: movement.type,
    subtype: movement.subtype ?? null,
    quantity: movement.quantity,
    original_quantity: movement.originalQuantity ?? null,
    original_unit: movement.originalUnit ?? null,
    responsible: movement.responsible,
    observations: movement.observations ?? null,
    invoice_number: movement.invoiceNumber ?? null,
    supplier: movement.supplier ?? null,
    order_number: movement.orderNumber ?? null,
    authorization_number: movement.authorizationNumber ?? null,
    motivo: movement.motivo ?? null,
    orden_danio: movement.ordenDanio ?? null,
    ctp_order_number: movement.ctpOrderNumber ?? null,
    is_initial: movement.isInitial ?? false,
    date: movement.date,
  });
  if (error) throw error;
}

async function insertMovements(paperCode: string, movements: Movement[]): Promise<void> {
  const rows = movements.map((m) => ({
    paper_code: paperCode,
    type: m.type,
    subtype: m.subtype ?? null,
    quantity: m.quantity,
    original_quantity: m.originalQuantity ?? null,
    original_unit: m.originalUnit ?? null,
    responsible: m.responsible,
    observations: m.observations ?? null,
    invoice_number: m.invoiceNumber ?? null,
    supplier: m.supplier ?? null,
    order_number: m.orderNumber ?? null,
    authorization_number: m.authorizationNumber ?? null,
    motivo: m.motivo ?? null,
    orden_danio: m.ordenDanio ?? null,
    ctp_order_number: m.ctpOrderNumber ?? null,
    is_initial: m.isInitial ?? false,
    date: m.date,
  }));

  const { error } = await supabase.from("movements").insert(rows);
  if (error) throw error;
}

// ─── PROVEEDORES ──────────────────────────────────────────

export async function getProveedores(): Promise<Proveedor[]> {
  const { data, error } = await supabase
    .from("proveedores")
    .select("*")
    .order("nombre", { ascending: true });
  if (error) throw error;
  return data.map((p: any) => ({
    id: p.id,
    nit: p.nit,
    nombre: p.nombre,
    categorias: p.categorias ?? [],
  }));
}

export async function createProveedor(proveedor: { nit: string; nombre: string; categorias: string[] }): Promise<Proveedor> {
  const { data, error } = await supabase
    .from("proveedores")
    .insert({ nit: proveedor.nit, nombre: proveedor.nombre, categorias: proveedor.categorias })
    .select()
    .single();
  if (error) throw error;
  return { id: data.id, nit: data.nit, nombre: data.nombre, categorias: data.categorias ?? [] };
}

export async function updateProveedor(id: string, proveedor: { nit: string; nombre: string; categorias: string[] }): Promise<void> {
  const { error } = await supabase
    .from("proveedores")
    .update({ nit: proveedor.nit, nombre: proveedor.nombre, categorias: proveedor.categorias })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteProveedor(id: string): Promise<void> {
  const { error } = await supabase
    .from("proveedores")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ─── HELPERS ──────────────────────────────────────────────

function mapMovement(m: any): Movement {
  return {
    id: m.id,
    type: m.type,
    subtype: m.subtype ?? undefined,
    quantity: m.quantity,
    originalQuantity: m.original_quantity ?? undefined,
    originalUnit: m.original_unit ?? undefined,
    responsible: m.responsible,
    observations: m.observations ?? undefined,
    invoiceNumber: m.invoice_number ?? undefined,
    supplier: m.supplier ?? undefined,
    orderNumber: m.order_number ?? undefined,
    authorizationNumber: m.authorization_number ?? undefined,
    motivo: m.motivo ?? undefined,
    ordenDanio: m.orden_danio ?? undefined,
    ctpOrderNumber: m.ctp_order_number ?? undefined,
    isInitial: m.is_initial ?? false,
    date: m.date,
    createdAt: m.created_at,
    editedBy: m.edited_by ?? undefined,
    editedAt: m.edited_at ?? undefined,
  };
}

// ─── USERS / PROFILES ─────────────────────────────────────

export async function getProfiles() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, nombre, email, rol, permisos, created_at")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function updateProfile(
  id: string,
  updates: { nombre?: string; rol?: "admin" | "operador"; permisos?: Permisos }
) {
  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteUserProfile(id: string) {
  const { error } = await supabase
    .from("profiles")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function createUserWithFunction(nombre: string, email: string, password: string, rol: "admin" | "operador") {
  const { data: { session } } = await supabase.auth.getSession();

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ nombre, email, password, rol }),
    }
  );

  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Error creando usuario");
  return result;
}

export async function changeUserPassword(userId: string, newPassword: string) {
  const { data: { session } } = await supabase.auth.getSession();

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/change-password`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ userId, newPassword }),
    }
  );

  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Error cambiando contraseña");
  return result;
}

export async function updateMovement(
  movementId: string,
  movement: Partial<Movement>,
  actorNombre: string = "Sistema"
): Promise<void> {
  // 1. Traer el estado actual del movimiento, para comparar y para guardar el "antes" en el historial
  const { data: before, error: beforeError } = await supabase
    .from("movements")
    .select("*")
    .eq("id", movementId)
    .single();
  if (beforeError) throw beforeError;

  const nuevosValores = {
    type: movement.type,
    subtype: movement.subtype ?? null,
    quantity: movement.quantity,
    original_quantity: movement.originalQuantity ?? null,
    original_unit: movement.originalUnit ?? null,
    responsible: movement.responsible,
    observations: movement.observations ?? null,
    invoice_number: movement.invoiceNumber ?? null,
    supplier: movement.supplier ?? null,
    order_number: movement.orderNumber ?? null,
    authorization_number: movement.authorizationNumber ?? null,
    motivo: movement.motivo ?? null,
    orden_danio: movement.ordenDanio ?? null,
    ctp_order_number: movement.ctpOrderNumber ?? null,
  };

  // Si el usuario le da "Guardar" sin haber cambiado nada (ej: doble clic),
  // no se cuenta como una edición real ni se registra en el historial.
  const huboCambios = Object.entries(nuevosValores).some(
    ([campo, valor]) => (before?.[campo] ?? null) !== (valor ?? null)
  );
  if (!huboCambios) return;

  // 2. Traer el nombre del producto asociado, para mostrarlo en el historial
  let productoNombre: string | null = null;
  if (before?.paper_code) {
    const { data: paperData } = await supabase
      .from("papers")
      .select("product")
      .eq("code", before.paper_code)
      .maybeSingle();
    productoNombre = paperData?.product ?? null;
  }

  const now = new Date().toISOString();

  // 3. Actualizar el movimiento, dejando registrado quién y cuándo lo editó
  const { data: updated, error } = await supabase
    .from("movements")
    .update({
      ...nuevosValores,
      edited_by: actorNombre,
      edited_at: now,
    })
    .eq("id", movementId)
    .select("*")
    .single();
  if (error) throw error;

  // 4. Dejar el evento registrado en el historial
  const { error: histError } = await supabase.from("historial_movimientos").insert({
    movement_id: movementId,
    paper_code: before?.paper_code ?? null,
    producto_nombre: productoNombre,
    accion: "editar",
    usuario_nombre: actorNombre,
    snapshot_anterior: before,
    snapshot_nuevo: updated,
  });
  if (histError) throw histError;
}

export async function deleteMovement(
  movementId: string,
  actorNombre: string = "Sistema"
): Promise<void> {
  // 1. Traer el movimiento completo antes de borrarlo
  const { data: before, error: beforeError } = await supabase
    .from("movements")
    .select("*")
    .eq("id", movementId)
    .single();
  if (beforeError) throw beforeError;

  // 2. Traer el nombre del producto asociado, para mostrarlo en el historial
  let productoNombre: string | null = null;
  if (before?.paper_code) {
    const { data: paperData } = await supabase
      .from("papers")
      .select("product")
      .eq("code", before.paper_code)
      .maybeSingle();
    productoNombre = paperData?.product ?? null;
  }

  // 3. Dejar el evento registrado en el historial ANTES de borrar
  //    (una vez borrado el movimiento, ya no se podría "leer" para guardar su snapshot)
  const { error: histError } = await supabase.from("historial_movimientos").insert({
    movement_id: movementId,
    paper_code: before?.paper_code ?? null,
    producto_nombre: productoNombre,
    accion: "eliminar",
    usuario_nombre: actorNombre,
    snapshot_anterior: before,
    snapshot_nuevo: null,
  });
  if (histError) throw histError;

  // 4. Borrar el movimiento
  const { error } = await supabase
    .from("movements")
    .delete()
    .eq("id", movementId);
  if (error) throw error;
}

// ─── HISTORIAL ────────────────────────────────────────────

export async function getHistorialMovimientos(): Promise<HistorialMovimiento[]> {
  const { data, error } = await supabase
    .from("historial_movimientos")
    .select("*")
    .order("fecha", { ascending: false })
    .limit(2000);
  if (error) throw error;

  return (data ?? []).map((h: any) => ({
    id: h.id,
    movementId: h.movement_id,
    paperCode: h.paper_code ?? undefined,
    productoNombre: h.producto_nombre ?? undefined,
    accion: h.accion,
    usuarioNombre: h.usuario_nombre,
    usuarioId: h.usuario_id ?? undefined,
    fecha: h.fecha,
    snapshotAnterior: h.snapshot_anterior ?? undefined,
    snapshotNuevo: h.snapshot_nuevo ?? undefined,
  }));
}