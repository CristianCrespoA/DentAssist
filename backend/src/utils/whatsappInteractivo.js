'use strict';

const { esFechaValida } = require('./tiempo');

// Límites de la API de WhatsApp para mensajes interactivos.
const LIMITES = Object.freeze({
  TEXTO: 4096,
  CUERPO: 1024,
  TITULO_BOTON: 20,
  BOTONES: 3,
  TITULO_FILA: 24,
  DESCRIPCION_FILA: 72,
  FILAS: 10,
  ETIQUETA_LISTA: 20
});

const DIAS_SEMANA = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado'
];

const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre'
];

const MESES_CORTOS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic'
];

/** Recorta sin cortar palabras a la mitad y respeta el límite de la API. */
const recortar = (valor, max) => {
  if (valor === null || valor === undefined) return '';

  const limpio = String(valor).trim().replace(/\s+/g, ' ');

  if (limpio.length <= max) return limpio;

  const corte = limpio.slice(0, max - 1);
  const ultimoEspacio = corte.lastIndexOf(' ');
  const base = ultimoEspacio > max * 0.6 ? corte.slice(0, ultimoEspacio) : corte;

  return `${base.trimEnd()}…`;
};

/**
 * Recorta textos largos conservando los saltos de línea (cuerpos de mensajes).
 * Los títulos de botones y filas usan `recortar` porque deben ir en una línea.
 */
const limitar = (valor, max) => {
  if (valor === null || valor === undefined) return '';

  const limpio = String(valor)
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (limpio.length <= max) return limpio;

  const corte = limpio.slice(0, max - 1);
  const ultimoSalto = corte.lastIndexOf('\n');
  const base = ultimoSalto > max * 0.5 ? corte.slice(0, ultimoSalto) : corte;

  return `${base.trimEnd()}…`;
};

const partesFecha = (fecha) => {
  if (!esFechaValida(fecha)) return null;

  const [anio, mes, dia] = fecha.split('-').map(Number);
  const date = new Date(Date.UTC(anio, mes - 1, dia));

  return { anio, mes, dia, diaSemana: date.getUTCDay() };
};

/** "martes 28 de octubre de 2026" */
const formatearFecha = (fecha) => {
  const partes = partesFecha(fecha);

  if (!partes) return String(fecha ?? '');

  return `${DIAS_SEMANA[partes.diaSemana]} ${partes.dia} de ${MESES[partes.mes - 1]} de ${partes.anio}`;
};

/** "mar 28 oct", pensado para títulos de botón (máx. 20). */
const formatearFechaCorta = (fecha) => {
  const partes = partesFecha(fecha);

  if (!partes) return recortar(fecha, LIMITES.TITULO_BOTON);

  return `${DIAS_CORTOS[partes.diaSemana]} ${partes.dia} ${MESES_CORTOS[partes.mes - 1]}`;
};

const formatearPrecio = (valor) => {
  const numero = Number(valor);

  if (!Number.isFinite(numero)) return 'precio por confirmar';

  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
  }).format(numero);
};

/** "08:00:00" o "08:00" -> "08:00" */
const formatearHora = (hora) => {
  if (typeof hora !== 'string') return '';

  return hora.slice(0, 5);
};

/** Salida de texto plano. */
const texto = (contenido) => {
  const limitado = limitar(contenido, LIMITES.TEXTO);

  return {
    contenido: limitado,
    textoPlano: limitado
  };
};

/**
 * Salida con botones de respuesta rápida (máximo 3).
 * `opciones`: [{ id, titulo }]
 */
const botones = (cuerpo, opciones) => {
  const lista = (Array.isArray(opciones) ? opciones : [])
    .filter((opcion) => opcion && opcion.id && opcion.titulo)
    .slice(0, LIMITES.BOTONES)
    .map((opcion) => ({
      id: String(opcion.id),
      titulo: recortar(opcion.titulo, LIMITES.TITULO_BOTON)
    }));

  if (!lista.length) {
    throw new Error('Un mensaje con botones necesita al menos una opción');
  }

  return {
    contenido: {
      tipo: 'interactivo',
      interactivo: {
        type: 'button',
        body: { text: limitar(cuerpo, LIMITES.CUERPO) },
        action: {
          buttons: lista.map((opcion) => ({
            type: 'reply',
            reply: { id: opcion.id, title: opcion.titulo }
          }))
        }
      }
    },
    textoPlano: [
      limitar(cuerpo, LIMITES.CUERPO),
      ...lista.map((opcion, indice) => `${indice + 1}. ${opcion.titulo}`)
    ].join('\n')
  };
};

/**
 * Salida con lista desplegable (máximo 10 filas en total).
 * `filas`: [{ id, titulo, descripcion }]
 */
const lista = (cuerpo, filas, { etiqueta = 'Ver opciones', seccion = 'Opciones' } = {}) => {
  const rows = (Array.isArray(filas) ? filas : [])
    .filter((fila) => fila && fila.id && fila.titulo)
    .slice(0, LIMITES.FILAS)
    .map((fila) => {
      const row = {
        id: String(fila.id),
        title: recortar(fila.titulo, LIMITES.TITULO_FILA)
      };

      if (fila.descripcion) {
        row.description = recortar(fila.descripcion, LIMITES.DESCRIPCION_FILA);
      }

      return row;
    });

  if (!rows.length) {
    throw new Error('Un mensaje de lista necesita al menos una fila');
  }

  return {
    contenido: {
      tipo: 'interactivo',
      interactivo: {
        type: 'list',
        body: { text: limitar(cuerpo, LIMITES.CUERPO) },
        action: {
          button: recortar(etiqueta, LIMITES.ETIQUETA_LISTA),
          sections: [
            {
              title: recortar(seccion, LIMITES.TITULO_FILA),
              rows
            }
          ]
        }
      }
    },
    textoPlano: [
      limitar(cuerpo, LIMITES.CUERPO),
      ...rows.map((row, indice) => `${indice + 1}. ${row.title}${row.description ? ` — ${row.description}` : ''}`)
    ].join('\n')
  };
};

module.exports = {
  LIMITES,
  botones,
  formatearFecha,
  formatearFechaCorta,
  formatearHora,
  formatearPrecio,
  limitar,
  lista,
  recortar,
  texto
};
