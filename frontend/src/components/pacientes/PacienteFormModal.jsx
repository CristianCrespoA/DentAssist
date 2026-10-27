import { useRef, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import {
  aPayloadPaciente,
  hoyLocalISO,
  mapearErrorPaciente,
  nombreCompleto,
  validarPaciente,
  valoresInicialesPaciente,
} from '../../lib/pacientes';
import { actualizarPaciente, crearPaciente } from '../../services/pacientes';
import Button from '../ui/Button';
import Field from '../ui/Field';
import Input from '../ui/Input';
import Modal from '../ui/Modal';
import Textarea from '../ui/Textarea';

const ID_FORMULARIO = 'formulario-paciente';

const IDS_CAMPO = {
  nombre: 'paciente-nombre',
  apellido: 'paciente-apellido',
  telefono: 'paciente-telefono',
  correo: 'paciente-correo',
  fechaNacimiento: 'paciente-fecha-nacimiento',
  direccion: 'paciente-direccion',
};

const enfocarPrimerError = (errores) => {
  const campo = Object.keys(IDS_CAMPO).find((clave) => errores[clave]);

  if (campo) {
    document.getElementById(IDS_CAMPO[campo])?.focus();
  }
};

function PacienteFormModal({ paciente, onClose, onSaved }) {
  const esEdicion = Boolean(paciente);
  const [valores, setValores] = useState(() => valoresInicialesPaciente(paciente));
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState('');
  const [guardando, setGuardando] = useState(false);
  const nombreRef = useRef(null);
  const { error: toastError } = useToast();

  const cerrar = () => {
    if (!guardando) onClose();
  };

  const actualizarCampo = (campo) => (evento) => {
    const { value } = evento.target;

    setValores((actuales) => ({ ...actuales, [campo]: value }));

    if (errores[campo]) {
      setErrores((actuales) => {
        const siguientes = { ...actuales };
        delete siguientes[campo];
        return siguientes;
      });
    }

    if (errorGeneral) setErrorGeneral('');
  };

  const manejarEnvio = async (evento) => {
    evento.preventDefault();

    const erroresCliente = validarPaciente(valores);

    if (Object.keys(erroresCliente).length) {
      setErrores(erroresCliente);
      setErrorGeneral('');
      enfocarPrimerError(erroresCliente);
      return;
    }

    setGuardando(true);
    setErrores({});
    setErrorGeneral('');

    try {
      const datos = aPayloadPaciente(valores);
      const guardado = esEdicion
        ? await actualizarPaciente(paciente.id, datos)
        : await crearPaciente(datos);

      onSaved(guardado, esEdicion);
    } catch (error) {
      if (error?.name === 'AbortError') return;

      const mensaje =
        error?.mensaje || 'No se pudo guardar el paciente. Inténtalo de nuevo.';
      const { errores: erroresServidor, general } = mapearErrorPaciente(mensaje);

      setErrores(erroresServidor);
      setErrorGeneral(general);
      enfocarPrimerError(erroresServidor);

      toastError(mensaje, {
        titulo: esEdicion ? 'No se pudo actualizar' : 'No se pudo crear el paciente',
      });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      open
      onClose={cerrar}
      title={esEdicion ? 'Editar paciente' : 'Nuevo paciente'}
      description={
        esEdicion
          ? `Actualiza los datos de ${nombreCompleto(paciente)}.`
          : 'Registra los datos de contacto del paciente.'
      }
      size="lg"
      initialFocus={nombreRef}
      footer={
        <>
          <Button variant="secondary" onClick={cerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form={ID_FORMULARIO}
            isLoading={guardando}
            loadingLabel="Guardando…"
          >
            {esEdicion ? 'Guardar cambios' : 'Crear paciente'}
          </Button>
        </>
      }
    >
      <form
        id={ID_FORMULARIO}
        className="space-y-5"
        onSubmit={manejarEnvio}
        noValidate
      >
        {errorGeneral ? (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-field border border-danger-200 bg-danger-50 px-3 py-2.5 text-sm text-danger-800"
          >
            <AlertCircle
              className="mt-0.5 size-4 shrink-0 text-danger-600"
              aria-hidden="true"
            />
            <p>{errorGeneral}</p>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre" htmlFor={IDS_CAMPO.nombre} error={errores.nombre} required>
            <Input
              ref={nombreRef}
              id={IDS_CAMPO.nombre}
              name="nombre"
              value={valores.nombre}
              onChange={actualizarCampo('nombre')}
              autoComplete="given-name"
              maxLength={100}
              placeholder="Laura"
            />
          </Field>

          <Field
            label="Apellido"
            htmlFor={IDS_CAMPO.apellido}
            error={errores.apellido}
            required
          >
            <Input
              id={IDS_CAMPO.apellido}
              name="apellido"
              value={valores.apellido}
              onChange={actualizarCampo('apellido')}
              autoComplete="family-name"
              maxLength={100}
              placeholder="Gómez"
            />
          </Field>

          <Field
            label="Teléfono"
            htmlFor={IDS_CAMPO.telefono}
            error={errores.telefono}
            hint="Puedes escribirlo con o sin indicativo; se guarda normalizado."
            required
          >
            <Input
              id={IDS_CAMPO.telefono}
              name="telefono"
              type="tel"
              inputMode="tel"
              value={valores.telefono}
              onChange={actualizarCampo('telefono')}
              autoComplete="tel"
              maxLength={20}
              placeholder="300 123 4567"
            />
          </Field>

          <Field
            label="Correo electrónico"
            htmlFor={IDS_CAMPO.correo}
            error={errores.correo}
            hint="Opcional. Se usa para contactar al paciente."
          >
            <Input
              id={IDS_CAMPO.correo}
              name="correo"
              type="email"
              value={valores.correo}
              onChange={actualizarCampo('correo')}
              autoComplete="email"
              maxLength={255}
              placeholder="paciente@example.com"
            />
          </Field>

          <Field
            label="Fecha de nacimiento"
            htmlFor={IDS_CAMPO.fechaNacimiento}
            error={errores.fechaNacimiento}
            hint="Opcional."
            className="sm:col-span-2 sm:max-w-xs"
          >
            <Input
              id={IDS_CAMPO.fechaNacimiento}
              name="fechaNacimiento"
              type="date"
              value={valores.fechaNacimiento}
              onChange={actualizarCampo('fechaNacimiento')}
              max={hoyLocalISO()}
              autoComplete="bday"
            />
          </Field>

          <Field
            label="Dirección"
            htmlFor={IDS_CAMPO.direccion}
            error={errores.direccion}
            hint="Opcional."
            className="sm:col-span-2"
          >
            <Textarea
              id={IDS_CAMPO.direccion}
              name="direccion"
              rows={2}
              value={valores.direccion}
              onChange={actualizarCampo('direccion')}
              autoComplete="street-address"
              maxLength={255}
              placeholder="Calle 45 #12-30, Bogotá"
            />
          </Field>
        </div>
      </form>
    </Modal>
  );
}

export default PacienteFormModal;
