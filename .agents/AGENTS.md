# Reglas del Proyecto (Master Prompts)

## 1. Filosofía Poka-Yoke (A prueba de errores)
**Contexto:** Aplicable a todos los módulos (especialmente Análisis de Procesos y Estudio de Tiempos).
**Regla:** Cuanto menos tenga que calcular o configurar manualmente el usuario, mejor. El objetivo principal es evitar el error humano, garantizando información 100% fiable para la toma de decisiones.

**Directrices Técnicas:**
- **Automatización Máxima:** El sistema debe encargarse de todas las conversiones matemáticas, formateo de unidades (ej. pasar de segundos a horas/minutos) y cruce de variables.
- **Cero Redundancia:** No pidas al usuario que seleccione opciones o ingrese datos que el sistema ya puede deducir o capturar por sí mismo (ej. si un cronómetro captura segundos, asume segundos como base nativa y haz la conversión solo para la vista).
- **Validaciones:** Diseña las interfaces con restricciones lógicas (poka-yokes) que hagan imposible o muy difícil cometer un error de ingreso.
- **Excepción:** Solo se habilitarán campos de cálculo o ingreso manual si las instrucciones indican explícitamente: "esa parte la va a llenar una persona". De lo contrario, asume automatización total.
