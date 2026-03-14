import React, { useEffect, useState } from 'react';
import { Settings, Users, Package, Building2, Plus, Save } from 'lucide-react';
import api from '../utils/api';

export default function AdminDashboard() {
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [branches, setBranches] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showNewUser, setShowNewUser] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', password: '', first_name: '', last_name: '', role_id: '', branch_id: '', phone: '' });
  const [showNewBranch, setShowNewBranch] = useState(false);
  const [newBranch, setNewBranch] = useState({ name: '', code: '', address: '', city: '', state: '', zip: '' });
  const [editProduct, setEditProduct] = useState(null);

  useEffect(() => {
    if (tab === 'users') loadUsers();
    else if (tab === 'products') loadProducts();
    else if (tab === 'branches') loadBranches();
  }, [tab]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const [usersRes, rolesRes, branchesRes] = await Promise.all([
        api.get('/admin/users', { params: { limit: 100 } }),
        api.get('/admin/roles'),
        api.get('/admin/branches'),
      ]);
      setUsers(usersRes.data.data || []);
      setRoles(rolesRes.data || []);
      setBranches(branchesRes.data || []);
    } catch (err) { setMessage(`Error: ${err.response?.data?.error || err.message}`); }
    finally { setLoading(false); }
  };

  const loadProducts = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/loan-products');
      setProducts(data || []);
    } catch (err) { setMessage(`Error: ${err.response?.data?.error || err.message}`); }
    finally { setLoading(false); }
  };

  const loadBranches = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/branches');
      setBranches(data || []);
    } catch (err) { setMessage(`Error: ${err.response?.data?.error || err.message}`); }
    finally { setLoading(false); }
  };

  const createUser = async () => {
    try {
      await api.post('/admin/users', {
        ...newUser,
        role_id: parseInt(newUser.role_id),
        branch_id: newUser.branch_id ? parseInt(newUser.branch_id) : null,
      });
      setMessage('User created successfully');
      setShowNewUser(false);
      setNewUser({ email: '', password: '', first_name: '', last_name: '', role_id: '', branch_id: '', phone: '' });
      loadUsers();
    } catch (err) { setMessage(`Error: ${err.response?.data?.error || err.message}`); }
  };

  const createBranch = async () => {
    try {
      await api.post('/admin/branches', newBranch);
      setMessage('Branch created successfully');
      setShowNewBranch(false);
      setNewBranch({ name: '', code: '', address: '', city: '', state: '', zip: '' });
      loadBranches();
    } catch (err) { setMessage(`Error: ${err.response?.data?.error || err.message}`); }
  };

  const updateProduct = async (product) => {
    try {
      await api.put(`/admin/loan-products/${product.id}`, {
        name: product.name,
        min_rate: parseFloat(product.min_rate),
        max_rate: parseFloat(product.max_rate),
        min_term: parseInt(product.min_term),
        max_term: parseInt(product.max_term),
        min_amount: parseFloat(product.min_amount),
        max_amount: parseFloat(product.max_amount),
        is_active: product.is_active,
      });
      setMessage('Product updated');
      setEditProduct(null);
      loadProducts();
    } catch (err) { setMessage(`Error: ${err.response?.data?.error || err.message}`); }
  };

  const toggleUserActive = async (user) => {
    try {
      await api.put(`/admin/users/${user.id}`, { is_active: !user.is_active });
      setMessage(`User ${user.is_active ? 'deactivated' : 'activated'}`);
      loadUsers();
    } catch (err) { setMessage(`Error: ${err.response?.data?.error || err.message}`); }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">System Administration</h1>

      {message && (
        <div className={`p-3 rounded-lg text-sm ${message.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {message}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {[
          { key: 'users', label: 'Users', icon: Users },
          { key: 'products', label: 'Loan Products', icon: Package },
          { key: 'branches', label: 'Branches', icon: Building2 },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center ${tab === t.key ? 'bg-white shadow text-primary-700' : 'text-gray-600 hover:text-gray-800'}`}>
            <t.icon className="w-4 h-4 mr-1.5" />{t.label}
          </button>
        ))}
      </div>

      {/* Users Tab */}
      {tab === 'users' && (
        <div className="space-y-4">
          <button onClick={() => setShowNewUser(true)} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 flex items-center">
            <Plus className="w-4 h-4 mr-1" /> Create User
          </button>

          {showNewUser && (
            <div className="bg-white rounded-xl shadow-sm border p-6 space-y-3">
              <h3 className="font-semibold">New User</h3>
              <div className="grid grid-cols-2 gap-3">
                <input type="text" placeholder="First Name" value={newUser.first_name} onChange={(e) => setNewUser({ ...newUser, first_name: e.target.value })}
                  className="px-3 py-2 border rounded-lg text-sm" />
                <input type="text" placeholder="Last Name" value={newUser.last_name} onChange={(e) => setNewUser({ ...newUser, last_name: e.target.value })}
                  className="px-3 py-2 border rounded-lg text-sm" />
                <input type="email" placeholder="Email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="px-3 py-2 border rounded-lg text-sm" />
                <input type="password" placeholder="Password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="px-3 py-2 border rounded-lg text-sm" />
                <input type="tel" placeholder="Phone" value={newUser.phone} onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                  className="px-3 py-2 border rounded-lg text-sm" />
                <select value={newUser.role_id} onChange={(e) => setNewUser({ ...newUser, role_id: e.target.value })}
                  className="px-3 py-2 border rounded-lg text-sm">
                  <option value="">Select Role</option>
                  {roles.map(r => <option key={r.id} value={r.id}>{r.display_name}</option>)}
                </select>
                <select value={newUser.branch_id} onChange={(e) => setNewUser({ ...newUser, branch_id: e.target.value })}
                  className="px-3 py-2 border rounded-lg text-sm">
                  <option value="">No Branch</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowNewUser(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
                <button onClick={createUser} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm">Create</button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Email</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Role</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Branch</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
                ) : users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">{u.first_name} {u.last_name}</td>
                    <td className="px-4 py-3 text-gray-500">{u.email}</td>
                    <td className="px-4 py-3 capitalize">{u.role_name?.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3">{u.branch_name || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => toggleUserActive(u)}
                        className="px-2 py-1 text-xs border rounded hover:bg-gray-50">
                        {u.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Products Tab */}
      {tab === 'products' && (
        <div className="space-y-4">
          {loading ? <div className="text-center py-8 text-gray-500">Loading...</div> : products.map(product => (
            <div key={product.id} className="bg-white rounded-xl shadow-sm border p-5">
              {editProduct === product.id ? (
                <div className="space-y-3">
                  <input type="text" value={product.name} onChange={(e) => setProducts(prev => prev.map(p => p.id === product.id ? { ...p, name: e.target.value } : p))}
                    className="w-full px-3 py-2 border rounded-lg text-sm font-semibold" />
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-gray-500">Min Rate %</label>
                      <input type="number" step="0.01" value={product.min_rate} onChange={(e) => setProducts(prev => prev.map(p => p.id === product.id ? { ...p, min_rate: e.target.value } : p))}
                        className="w-full px-3 py-2 border rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Max Rate %</label>
                      <input type="number" step="0.01" value={product.max_rate} onChange={(e) => setProducts(prev => prev.map(p => p.id === product.id ? { ...p, max_rate: e.target.value } : p))}
                        className="w-full px-3 py-2 border rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Active</label>
                      <select value={product.is_active?.toString()} onChange={(e) => setProducts(prev => prev.map(p => p.id === product.id ? { ...p, is_active: e.target.value === 'true' } : p))}
                        className="w-full px-3 py-2 border rounded-lg text-sm">
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Min Term (mo)</label>
                      <input type="number" value={product.min_term} onChange={(e) => setProducts(prev => prev.map(p => p.id === product.id ? { ...p, min_term: e.target.value } : p))}
                        className="w-full px-3 py-2 border rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Max Term (mo)</label>
                      <input type="number" value={product.max_term} onChange={(e) => setProducts(prev => prev.map(p => p.id === product.id ? { ...p, max_term: e.target.value } : p))}
                        className="w-full px-3 py-2 border rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Max Amount $</label>
                      <input type="number" value={product.max_amount} onChange={(e) => setProducts(prev => prev.map(p => p.id === product.id ? { ...p, max_amount: e.target.value } : p))}
                        className="w-full px-3 py-2 border rounded-lg text-sm" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setEditProduct(null)} className="px-3 py-1.5 border rounded text-sm">Cancel</button>
                    <button onClick={() => updateProduct(product)} className="px-3 py-1.5 bg-primary-600 text-white rounded text-sm flex items-center">
                      <Save className="w-3 h-3 mr-1" /> Save
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{product.name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${product.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {product.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      Rate: {product.min_rate}% - {product.max_rate}% &bull;
                      Term: {product.min_term} - {product.max_term} months &bull;
                      Amount: ${parseFloat(product.min_amount || 0).toLocaleString()} - ${parseFloat(product.max_amount || 0).toLocaleString()}
                    </p>
                    {product.description && <p className="text-sm text-gray-400 mt-1">{product.description}</p>}
                  </div>
                  <button onClick={() => setEditProduct(product.id)} className="px-3 py-1.5 border rounded text-sm hover:bg-gray-50">Edit</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Branches Tab */}
      {tab === 'branches' && (
        <div className="space-y-4">
          <button onClick={() => setShowNewBranch(true)} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 flex items-center">
            <Plus className="w-4 h-4 mr-1" /> Add Branch
          </button>

          {showNewBranch && (
            <div className="bg-white rounded-xl shadow-sm border p-6 space-y-3">
              <h3 className="font-semibold">New Branch</h3>
              <div className="grid grid-cols-2 gap-3">
                <input type="text" placeholder="Branch Name" value={newBranch.name} onChange={(e) => setNewBranch({ ...newBranch, name: e.target.value })}
                  className="px-3 py-2 border rounded-lg text-sm" />
                <input type="text" placeholder="Branch Code" value={newBranch.code} onChange={(e) => setNewBranch({ ...newBranch, code: e.target.value })}
                  className="px-3 py-2 border rounded-lg text-sm" />
                <input type="text" placeholder="Address" value={newBranch.address} onChange={(e) => setNewBranch({ ...newBranch, address: e.target.value })}
                  className="px-3 py-2 border rounded-lg text-sm col-span-2" />
                <input type="text" placeholder="City" value={newBranch.city} onChange={(e) => setNewBranch({ ...newBranch, city: e.target.value })}
                  className="px-3 py-2 border rounded-lg text-sm" />
                <input type="text" placeholder="State" value={newBranch.state} onChange={(e) => setNewBranch({ ...newBranch, state: e.target.value })}
                  className="px-3 py-2 border rounded-lg text-sm" />
                <input type="text" placeholder="ZIP" value={newBranch.zip} onChange={(e) => setNewBranch({ ...newBranch, zip: e.target.value })}
                  className="px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowNewBranch(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
                <button onClick={createBranch} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm">Create</button>
              </div>
            </div>
          )}

          <div className="grid gap-4">
            {loading ? <div className="text-center py-8 text-gray-500">Loading...</div> : branches.map(branch => (
              <div key={branch.id} className="bg-white rounded-xl shadow-sm border p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-primary-600" />
                      <h3 className="font-semibold">{branch.name}</h3>
                      <span className="text-xs text-gray-400">({branch.code})</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${branch.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {branch.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {[branch.address, branch.city, branch.state, branch.zip].filter(Boolean).join(', ')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
