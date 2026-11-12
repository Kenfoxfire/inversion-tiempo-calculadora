# Ritmo — Calculadora de inversión de tiempo

Organiza el horario semanal por categorías y visualiza cómo se distribuye el tiempo durante un día o una semana. Puedes activar trabajo y almuerzo, agregar actividades con nombre propio, asignar horas y minutos de lunes a domingo y cambiar el gráfico entre el periodo completo o solo el tiempo registrado.

## Desarrollo

```bash
npm install
npm start
```

Abre `http://localhost:4200/` en el navegador.

## Estimaciones y gráfico

- **Semana:** suma del tiempo programado en las categorías activas.
- **Mes promedio:** total semanal × 52 ÷ 12.
- **Año:** total semanal × 52.
- **Gráfico diario:** muestra la distribución para el día seleccionado sobre un total de 24 horas, o solo las horas registradas.
- **Gráfico semanal:** muestra la distribución semanal sobre un total de 168 horas, o solo las horas registradas.

El tiempo no asignado aparece como una categoría del gráfico cuando se elige el periodo completo. Si las actividades superan las horas disponibles, la calculadora avisa y muestra la proporción del tiempo registrado.

```bash
npm run build
npm test -- --watch=false
```
