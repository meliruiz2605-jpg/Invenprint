# InvenPrint

Sistema web de inventario de materia prima para imprentas. Permite controlar existencias de papel y planchas CTP, gestionar proveedores y generar reportes.

> Proyecto basado en un trabajo real para una empresa del sector editorial. La marca, los datos y las claves fueron reemplazados por ejemplos.

## Funcionalidades

- Inventario por categorías (Papel,CTP y OFFSET) con modelos de datos específicos
- Permisos por rol para administradores y operadores
- Módulo de proveedores
- Historial de movimientos de entradas y salidas
- Alertas de stock
- Exportes a PDF y Excel
- Paginación y navegación con barra lateral
- Reportes con filtros por tipo de movimiento, motivo y rango de fechas

## Tecnologías

- React 19, TypeScript y Vite
- Tailwind CSS y Radix UI
- Supabase (PostgreSQL y autenticación)
- jsPDF y jsPDF-AutoTable (reportes en PDF)
- SheetJS / xlsx (exportes a Excel)
- Lucide (íconos)

## Cómo ejecutarlo

1. Clona el repositorio
2. Instala las dependencias: `npm install`
3. Copia `.env.example` a `.env` y completa con los datos de tu proyecto de Supabase
4. Inicia el proyecto: `npm run dev`

## Mi aporte

Desarrollé el sistema completo: diseño de la base de datos, interfaz, permisos, reportes y despliegue.