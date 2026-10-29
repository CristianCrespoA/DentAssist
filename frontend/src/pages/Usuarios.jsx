import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { api } from '../services/api';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Field from '../components/ui/Field';
import Card from '../components/ui/Card';

export default function Usuarios() {
  const [form, setForm] = useState({ nombre: '', apellido: '', correo: '', contrasena: '' });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      await api.post('/auth/register', { ...form, rol: 'recepcionista' });
      setMsg({ tipo: 'ok', texto: 'Recepcionista creado correctamente' });
      setForm({ nombre: '', apellido: '', correo: '', contrasena: '' });
    } catch (err) {
      setMsg({ tipo: 'error', texto: err.response?.data?.mensaje || 'Error al crear usuario' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Usuarios</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Crear usuarios recepcionistas</p>
      </div>
      <Card className="max-w-xl">
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Nombre">
              <Input name="nombre" value={form.nombre} onChange={handleChange} required />
            </Field>
            <Field label="Apellido">
              <Input name="apellido" value={form.apellido} onChange={handleChange} required />
            </Field>
          </div>
          <Field label="Correo electrónico">
            <Input type="email" name="correo" value={form.correo} onChange={handleChange} required />
          </Field>
          <Field label="Contraseña">
            <Input type="password" name="contrasena" value={form.contrasena} onChange={handleChange} required />
          </Field>
          {msg && <p className={msg.tipo === 'ok' ? 'text-emerald-600' : 'text-red-600'}>{msg.texto}</p>}
          <Button type="submit" disabled={loading} className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            {loading ? 'Creando...' : 'Crear recepcionista'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
