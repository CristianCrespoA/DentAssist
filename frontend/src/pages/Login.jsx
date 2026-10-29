import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Stethoscope,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';
import Button from '../components/ui/Button';
import Field from '../components/ui/Field';
import Input from '../components/ui/Input';
import ThemeToggle from '../components/ui/ThemeToggle';

const BENEFICIOS = [
  'Agenda de citas y disponibilidad en tiempo real.',
  'Datos de contacto de los pacientes siempre a mano.',
  'Solicitudes recibidas por WhatsApp en un solo lugar.',
];

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login, estaAutenticado } = useAuth();

  if (estaAutenticado()) {
    return <Navigate to="/agenda" replace />;
  }

  const handleSubmit = async (evento) => {
    evento.preventDefault();
    setError('');
    setLoading(true);

    try {
      const datos = await api.post('/auth/login', {
        email: email.trim(),
        password,
      });

      if (!datos?.token || !datos?.usuario) {
        throw new Error('La respuesta del servidor no es válida. Inténtalo de nuevo.');
      }

      login(datos.token, datos.usuario);
      navigate('/agenda', { replace: true });
    } catch (err) {
      setError(err?.message || 'No se pudo iniciar sesión. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-neutral-100 lg:grid lg:grid-cols-2 dark:bg-neutral-950">
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-primary-800 via-primary-900 to-neutral-950 p-12 text-white lg:flex lg:min-h-screen lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-primary-500/20 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-32 -left-20 size-96 rounded-full bg-primary-400/10 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-card bg-white/10 ring-1 ring-white/20">
            <Stethoscope className="size-6" aria-hidden="true" />
          </span>
          <div>
            <p className="text-lg font-bold tracking-tight">DentAssist</p>
            <p className="text-xs text-primary-100">Gestión de clínica dental</p>
          </div>
        </div>

        <div className="relative max-w-md space-y-6">
          <h2 className="text-3xl font-bold leading-tight tracking-tight text-white">
            Toda la operación de tu clínica, en un solo lugar.
          </h2>
          <p className="text-sm text-primary-100">
            Una base clara y consistente para que el equipo se concentre en la
            atención de los pacientes.
          </p>

          <ul className="space-y-3 text-sm text-primary-50">
            {BENEFICIOS.map((beneficio) => (
              <li key={beneficio} className="flex items-start gap-2.5">
                <CheckCircle2
                  className="mt-0.5 size-4 shrink-0 text-primary-300"
                  aria-hidden="true"
                />
                <span>{beneficio}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-primary-200">
          Los pacientes gestionan sus citas y solicitudes por WhatsApp.
        </p>
      </aside>

      <main className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6 lg:min-h-0 lg:px-12">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3 lg:hidden">
            <span className="flex size-11 items-center justify-center rounded-card bg-primary-700 text-white shadow-xs">
              <Stethoscope className="size-6" aria-hidden="true" />
            </span>
            <div>
              <p className="text-lg font-bold tracking-tight text-neutral-900">
                DentAssist
              </p>
              <p className="text-xs text-neutral-600">Gestión de clínica dental</p>
            </div>
          </div>

          <div className="mt-8 space-y-1.5 lg:mt-0">
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
              Acceso del personal
            </h1>
            <p className="text-sm text-neutral-600">
              Plataforma exclusiva para el personal de la clínica.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="mt-6 space-y-5 rounded-card border border-neutral-200 bg-white p-6 shadow-card sm:p-8"
          >
            {error ? (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-field border border-danger-200 bg-danger-50 px-3 py-2.5 text-sm text-danger-800"
              >
                <AlertCircle
                  className="mt-0.5 size-4 shrink-0 text-danger-600"
                  aria-hidden="true"
                />
                <p>{error}</p>
              </div>
            ) : null}

            <Field label="Correo electrónico" required>
              <Input
                type="email"
                name="email"
                value={email}
                onChange={(evento) => {
                  setEmail(evento.target.value);
                  if (error) setError('');
                }}
                autoComplete="email"
                placeholder="nombre@clinica.com"
                required
              />
            </Field>

            <Field label="Contraseña" required>
              <Input
                type={mostrarPassword ? 'text' : 'password'}
                name="password"
                value={password}
                onChange={(evento) => {
                  setPassword(evento.target.value);
                  if (error) setError('');
                }}
                autoComplete="current-password"
                placeholder="Tu contraseña"
                required
                endAdornment={
                  <button
                    type="button"
                    onClick={() => setMostrarPassword((visible) => !visible)}
                    aria-label={
                      mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
                    }
                    aria-pressed={mostrarPassword}
                    className="flex size-8 items-center justify-center rounded-field text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
                  >
                    {mostrarPassword ? (
                      <EyeOff className="size-4" aria-hidden="true" />
                    ) : (
                      <Eye className="size-4" aria-hidden="true" />
                    )}
                  </button>
                }
              />
            </Field>

            <Button
              type="submit"
              size="lg"
              fullWidth
              isLoading={loading}
              loadingLabel="Iniciando sesión…"
            >
              Iniciar sesión
            </Button>
          </form>

          <p className="mt-4 rounded-field bg-primary-50 px-4 py-3 text-center text-xs text-primary-800">
            Los pacientes gestionan sus citas y solicitudes por WhatsApp.
          </p>

          <p className="mt-6 text-center text-xs text-neutral-600">
            ¿Problemas para acceder? Contacta al administrador de la clínica.
          </p>
        </div>
      </main>
    </div>
  );
};

export default Login;
