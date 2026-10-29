import { useEffect, useState } from 'react';
import { UserPlus, Users as UsersIcon, Pencil, KeyRound, Trash2, X } from 'lucide-react';
import { api } from '../services/api';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Field from '../components/ui/Field';
import Card from '../components/ui/Card';
import Table from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';

export default function Usuarios() {
  const [form, setForm] = useState({ nombre: '', apellido: '', correo: '', contrasena: '' });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [cargandoLista, setCargandoLista] = useState(false);
  const [editarAbierto, setEditarAbierto] = useState(false);
  const [passwordAbierto, setPasswordAbierto] = useState(false);
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(null);
  const [formEditar, setFormEditar] = useState({ nombre: '', apellido: '', correo: '', rol: '' });
  const [formPass, setFormPass] = useState({ password: '' });
  const [guardando, setGuardando] = useState(false);

  const cargarUsuarios = async () => {
    setCargandoLista(true);
    setUsuarios([]);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`https://dentassist-backend-babh.onrender.com/api/auth/usuarios?_=${Date.now()}`, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Accept': 'application/json'
        },
        cache: 'no-store'
      });
      const data = await res.json();
      console.log('USUARIOS FETCH:', data);
      const lista = Array.isArray(data) ? data : [];
      setUsuarios(lista);
    } catch (e) {
      console.error('ERR FETCH', e);
      setUsuarios([]);
    } finally {
      setCargandoLista(false);
    }
  };

  const abrirEditar = (u) => {
    setUsuarioSeleccionado(u);
    setFormEditar({
      nombre: u.nombre || '',
      apellido: u.apellido || '',
      correo: u.correo || u.email || '',
      rol: u.rol || 'recepcionista'
    });
    setEditarAbierto(true);
    setMsg(null);
  };

  const abrirPassword = (u) => {
    setUsuarioSeleccionado(u);
    setFormPass({ password: '' });
    setPasswordAbierto(true);
    setMsg(null);
  };

  const guardarEditar = async (e) => {
    e.preventDefault();
    if (!usuarioSeleccionado) return;
    setGuardando(true);
    try {
      await api.put(`/auth/usuarios/${usuarioSeleccionado.id}`, formEditar);
      setMsg({ tipo: 'ok', texto: 'Usuario actualizado correctamente' });
      setEditarAbierto(false);
      cargarUsuarios();
    } catch (err) {
      setMsg({ tipo: 'error', texto: err.response?.data?.mensaje || 'Error al actualizar usuario' });
    } finally {
      setGuardando(false);
    }
  };

  const guardarPassword = async (e) => {
    e.preventDefault();
    if (!usuarioSeleccionado) return;
    setGuardando(true);
    try {
      await api.patch(`/auth/usuarios/${usuarioSeleccionado.id}/password`, formPass);
      setMsg({ tipo: 'ok', texto: 'Contraseña actualizada correctamente' });
      setPasswordAbierto(false);
    } catch (err) {
      setMsg({ tipo: 'error', texto: err.response?.data?.mensaje || 'Error al actualizar contraseña' });
    } finally {
      setGuardando(false);
    }
  };

  const eliminarUsuario = async (u) => {
    if (!window.confirm(`¿Eliminar a ${u.nombre} ${u.apellido || ''}?`)) return;
    try {
      await api.delete(`/auth/usuarios/${u.id}`);
      setMsg({ tipo: 'ok', texto: 'Usuario eliminado correctamente' });
      cargarUsuarios();
    } catch (err) {
      setMsg({ tipo: 'error', texto: err.response?.data?.mensaje || 'Error al eliminar usuario' });
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
      await api.post('/auth/register', { nombre: form.nombre + (form.apellido ? ' ' + form.apellido : ''), email: form.correo, password: form.contrasena, rol: 'recepcionista' });
      setMsg({ tipo: 'ok', texto: 'Recepcionista creado correctamente' });
      setForm({ nombre: '', apellido: '', correo: '', contrasena: '' });
      cargarUsuarios();
    } catch (err) {
      try {
        await api.post('/usuarios', { nombre: form.nombre + (form.apellido ? ' ' + form.apellido : ''), email: form.correo, password: form.contrasena, rol: 'recepcionista' });
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
                <Input name="apellido" value={form.apellido} onChange={handleChange} />
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
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Lista de usuarios ({usuarios.length})</h2>
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
                  <Table.Head className="text-right">Acciones</Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {cargandoLista ? (
                  <Table.Row>
                    <Table.Cell colSpan={5} className="text-center text-neutral-500 dark:text-neutral-400">
                      Cargando...
                    </Table.Cell>
                  </Table.Row>
                ) : usuarios.length === 0 ? (
                  <Table.Row>
                    <Table.Cell colSpan={5} className="text-center text-neutral-500 dark:text-neutral-400">
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
                      <Table.Cell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => abrirEditar(u)} title="Editar">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => abrirPassword(u)} title="Cambiar contraseña">
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          {u.rol !== 'admin' && (
                            <Button size="icon" variant="ghost" onClick={() => eliminarUsuario(u)} title="Eliminar">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  ))
                )}
              </Table.Body>
            </Table>
          </div>
        </Card>
      </div>

      <Modal open={editarAbierto} onClose={() => setEditarAbierto(false)} title="Editar usuario">
        <form onSubmit={guardarEditar} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Nombre">
              <Input value={formEditar.nombre} onChange={(e) => setFormEditar({ ...formEditar, nombre: e.target.value })} required />
            </Field>
            <Field label="Apellido">
              <Input value={formEditar.apellido} onChange={(e) => setFormEditar({ ...formEditar, apellido: e.target.value })} />
            </Field>
          </div>
          <Field label="Correo electrónico">
            <Input type="email" value={formEditar.correo} onChange={(e) => setFormEditar({ ...formEditar, correo: e.target.value })} required />
          </Field>
          <Field label="Rol">
            <select
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
              value={formEditar.rol}
              onChange={(e) => setFormEditar({ ...formEditar, rol: e.target.value })}
            >
              <option value="recepcionista">Recepcionista</option>
              <option value="admin">Administrador</option>
            </select>
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setEditarAbierto(false)}>
              <X className="mr-2 h-4 w-4" /> Cancelar
            </Button>
            <Button type="submit" disabled={guardando}>
              {guardando ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={passwordAbierto} onClose={() => setPasswordAbierto(false)} title="Cambiar contraseña">
        <form onSubmit={guardarPassword} className="space-y-4">
          <Field label="Nueva contraseña">
            <Input type="password" value={formPass.password} onChange={(e) => setFormPass({ password: e.target.value })} required />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setPasswordAbierto(false)}>
              <X className="mr-2 h-4 w-4" /> Cancelar
            </Button>
            <Button type="submit" disabled={guardando}>
              {guardando ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
