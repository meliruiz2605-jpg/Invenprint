// Lista central de categorías. Si en el futuro agregas una nueva categoría de
// material (además de Papel y CTP), solo agrégala aquí y se reflejará
// automáticamente en el formulario de productos y en el de proveedores.
export const CATEGORIAS = ["Papel", "CTP", "OFFSET"] as const;
export type Categoria = (typeof CATEGORIAS)[number];