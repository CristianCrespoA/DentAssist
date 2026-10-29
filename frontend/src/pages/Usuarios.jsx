import { useEffect, useState } from 'react';
import { UserPlus, Users as UsersIcon } from 'lucide-react';
import { api } from '../services/api';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Field from '../components/ui/Field';
import Card from '../components/ui/Card';
import Table from '../components/ui/Table';
import Badge from '../components/ui/Badge';

export default function Usuarios() {
  const [form, setForm] = useState({ nombre: '', apellido: '', correo: '', contrasena: '' });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [cargandoLista, setCargandoLista] = useState(false);

  const cargarUsuarios = async () => {
    setCargandoLista(true);
    try {
      const data = await api.get('/auth/usuarios');
      setUsuarios(Array.isArray(data) ? data : data?.usuarios || []);
    } catch {
      try {
        const data = await api.get('/usuarios');
        setUsuarios(Array.isArray(data) ? data : data?.usuarios || []);
      } catch {
        setUsuarios([]);
      }
    } finally {
      setCargandoLista(false);
    }
  };

  useEffect(() => {
    cargarUsuarios();
  }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      await api.post('/auth/register', { ...form, rol: 'recepcionista' });
      setMsg({ tipo: 'ok', texto: 'Recepcionista creado correctamente' });
      setForm({ nombre: '', apellido: '', correo: '', contrasena: '' });
      cargarUsuarios();
    } catch (err) {
      try {
        await api.post('/usuarios', { ...form, rol: 'recepcionista' });
        setMsg({ tipo: 'ok', texto: 'Recepcionista creado correctamente' });
        setForm({ nombre: '', apellido: '', correo: '', contrasena: '' });
        cargarUsuarios();
      } catch (err2) {
        setMsg({ tipo: 'error', texto: err2.response?.data?.mensaje || err.response?.data?.mensaje || 'Error al crear usuario' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-full bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-200">
          <UsersIcon className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Administración de usuarios</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Crear y visualizar usuarios del sistema</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="h-fit">
          <div className="border-b border-neutral-200 px-6 py-4 dark:border-neutral-800">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Crear recepcionista</h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Solo el administrador puede crear nuevos usuarios</p>
          </div>
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
            {msg && <p className={msg.tipo === 'ok' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>{msg.texto}</p>}
            <Button type="submit" disabled={loading} className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              {loading ? 'Creando...' : 'Crear recepcionista'}
            </Button>
          </form>
        </Card>

        <Card>
          <div className="border-b border-neutral-200 px-6 py-4 dark:border-neutral-800">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Lista de usuarios</h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Usuarios registrados en el sistema</p>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.Head>Nombre</Table.Head>
                  <Table.Head>Correo</Table.Head>
                  <Table.Head>Rol</Table.Head>
                  <Table.Head>Estado</Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {cargandoLista ? (
                  <Table.Row>
                    <Table.Cell colSpan={4} className="text-center text-neutral-500 dark:text-neutral-400">
                      Cargando...
                    </Table.Cell>
                  </Table.Row>
                ) : usuarios.length === 0 ? (
                  <Table.Row>
                    <Table.Cell colSpan={4} className="text-center text-neutral-500 dark:text-neutral-400">
                      No hay usuarios registrados
                    </Table.Cell>
                  </Table.Row>
                ) : (
                  usuarios.map((u) => (
                    <Table.Row key={u.id}>
                      <Table.Cell className="font-medium text-neutral-900 dark:text-neutral-100">
                        {u.nombre} {u.apellido}
                      </Table.Cell>
                      <Table.Cell className="text-neutral-600 dark:text-neutral-300">{u.correo || u.email}</Table.Cell>
                      <Table.Cell>
                        <Badge variant={u.rol === 'admin' ? 'primary' : 'neutral'} size="sm">
                          {u.rol === 'admin' ? 'Administrador' : u.rol === 'recepcionista' ? 'Recepcionista' : u.rol}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell>
                        <Badge variant={u.activo !== false ? 'success' : 'neutral'} size="sm">
                          {u.activo !== false ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </Table.Cell>
                    </Table.Row>
                  ))
                )}
              </Table.Body>
            </Table>
          </div>
        </Card>
      </div>
    </div>
  );
}
