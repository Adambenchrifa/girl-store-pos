/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  UserPlus, 
  Shield, 
  UserCheck, 
  Flame, 
  Info, 
  CheckCircle2, 
  FileSliders, 
  Trash2, 
  Edit, 
  X, 
  Key, 
  ShieldAlert
} from 'lucide-react';
import { User } from '../types';

interface AdminUsersTabProps {
  currentUser: User;
  onResetDatabase?: () => void;
}

export default function AdminUsersTab({ currentUser, onResetDatabase }: AdminUsersTabProps) {
  const [users, setUsers] = useState<User[]>([]);
  
  // Registration States
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'Admin' | 'Staff'>('Staff');
  const [name, setName] = useState('');

  // Editing States
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRole, setEditRole] = useState<'Admin' | 'Staff'>('Staff');
  const [editName, setEditName] = useState('');

  // Deletion States
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  // Common Admin Password Confirm State
  const [adminPasswordConfirm, setAdminPasswordConfirm] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Database Reset States
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetAdminPassword, setResetAdminPassword] = useState('');
  const [isResettingDb, setIsResettingDb] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);

  const handleResetDatabaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetAdminPassword.trim()) {
      setResetError("Current Administrator Password is required.");
      return;
    }

    setIsResettingDb(true);
    setResetError(null);
    setResetSuccess(null);

    try {
      const response = await fetch('/api/admin/reset-database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminPassword: resetAdminPassword
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to format database.");
      }

      setResetSuccess(data.message || "Database formatted successfully!");
      setResetAdminPassword('');
      setShowResetConfirm(false);
      
      // Trigger parent synchronization
      if (onResetDatabase) {
        onResetDatabase();
      }
    } catch (err: any) {
      setResetError(err.message || "Failed to reset database.");
    } finally {
      setIsResettingDb(false);
    }
  };

  const isAdmin = currentUser.role === 'Admin';

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/auth/users');
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (e) {
      console.error("Failed to load active operators registry:", e);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setErrorMsg("A Staff cashier cannot add other operators. Administration permission required.");
      return;
    }
    if (!username.trim() || !password.trim() || !name.trim()) {
      setErrorMsg("Please fill in all requested fields.");
      return;
    }
    if (!adminPasswordConfirm.trim()) {
      setErrorMsg("Please enter your Current Admin Password as a secure confirmation.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const response = await fetch('/api/auth/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.toLowerCase().trim(),
          password,
          role,
          name: name.trim(),
          adminPassword: adminPasswordConfirm
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not register new operator account.");
      }

      setUsers([...users, data.user]);
      setUsername('');
      setPassword('');
      setName('');
      setAdminPasswordConfirm('');
      setSuccessMsg(`New operator '${data.user.name}' registered successfully under role ${data.user.role}!`);
      fetchUsers();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed registering user.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEdit = (user: User) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setEditingUser(user);
    setEditUsername(user.username);
    setEditName(user.name);
    setEditRole(user.role);
    setEditPassword('');
    setAdminPasswordConfirm('');
    setUserToDelete(null); // Close delete panel
  };

  const handleEditUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!editName.trim() || !editUsername.trim()) {
      setErrorMsg("Display Name and Username are mandatory.");
      return;
    }
    if (!adminPasswordConfirm.trim()) {
      setErrorMsg("Your Current Admin Password is required to write changes to files.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const response = await fetch(`/api/auth/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: editUsername.toLowerCase().trim(),
          password: editPassword.trim() || undefined,
          role: editRole,
          name: editName.trim(),
          adminPassword: adminPasswordConfirm
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not save operator updates.");
      }

      setSuccessMsg(`Operator credentials for '${data.user.name}' updated successfully!`);
      setEditingUser(null);
      setAdminPasswordConfirm('');
      fetchUsers();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed saving updates.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartDelete = (user: User) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setUserToDelete(user);
    setAdminPasswordConfirm('');
    setEditingUser(null); // Close edit panel
  };

  const handleDeleteUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToDelete) return;
    if (!adminPasswordConfirm.trim()) {
      setErrorMsg("Verification requires entering your Current Admin Password.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const response = await fetch(`/api/auth/users/${userToDelete.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminPassword: adminPasswordConfirm
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not remove employee records.");
      }

      setSuccessMsg(`Operator account '${userToDelete.name}' has been successfully deleted.`);
      setUserToDelete(null);
      setAdminPasswordConfirm('');
      fetchUsers();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to remove operator.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isAdmin) {
    return (
      <div id="unauthorized-users-view" className="bg-[#161616] border border-white/5 rounded-3xl p-12 text-center max-w-xl mx-auto my-12 shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-amber-500 border border-white/5 mx-auto mb-5">
          <Flame size={28} />
        </div>
        <h2 className="text-xl font-sans text-white font-medium mb-2">Security Access Restricted</h2>
        <p className="text-sm text-slate-500 leading-relaxed max-w-sm mx-auto mb-6">
          Role-Based Access Control dictates that only store **Administrators** can audit registered cash registers, add security personnel, or alter role assignments.
        </p>
        <div className="text-xs font-mono py-2 px-3 bg-[#0F0F0F] rounded-lg inline-block border border-white/5 text-slate-400">
          Current Level: <span className="text-amber-400 font-bold uppercase">{currentUser.role === 'Staff' ? 'Staff Cashier' : currentUser.role}</span>
        </div>
      </div>
    );
  }

  return (
    <div id="users-tab-content" className="space-y-6">
      
      {/* Branding Title Bar */}
      <div className="bg-[#161616] p-5 rounded-2xl border border-white/5 shadow-md">
        <span className="text-[10px] font-mono uppercase tracking-widest text-indigo-400 font-semibold text-xs">Administrative Panel</span>
        <h1 className="font-sans text-xl tracking-tight text-white font-light mt-1">Manage Operators & Sales Force</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start text-sm">
        
        {/* Left Column - CRUD Panels (Add, Edit, Delete Confirm) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Messages Banners */}
          {errorMsg && (
            <div className="bg-red-950/40 border border-red-900/65 p-4 rounded-2xl text-xs text-red-400">
              <span className="font-semibold block mb-1">Authorization Rejected</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-950/40 border border-[#059669]/35 p-4 rounded-2xl text-xs text-emerald-400 flex items-start gap-2.5">
              <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-400" />
              <div>
                <span className="font-semibold block mb-1">Transaction Successful</span>
                <span>{successMsg}</span>
              </div>
            </div>
          )}

          {/* PANEL A: EDIT OPERATOR MODE */}
          {editingUser ? (
            <div className="bg-[#161616] p-6 border border-indigo-500/20 rounded-2xl shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <h2 className="text-xs font-mono uppercase tracking-wider text-indigo-400 flex items-center gap-2 font-semibold">
                  <Edit size={16} /> Edit Operator Settings
                </h2>
                <button 
                  onClick={() => { setEditingUser(null); setErrorMsg(null); }}
                  className="p-1 hover:bg-white/5 rounded text-slate-500 hover:text-slate-200 transition-colors"
                  title="Cancel Edit"
                >
                  <X size={15} />
                </button>
              </div>

              <form onSubmit={handleEditUserSubmit} className="space-y-4" id="edit-operator-form">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                    Operator Display Name
                  </label>
                  <input
                    id="edit-user-name"
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-[#0F0F0F] border border-white/10 focus:border-indigo-500 rounded-xl py-2.5 px-4 text-xs text-slate-200 outline-none transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                    System LogID (Username)
                  </label>
                  <input
                    id="edit-user-username"
                    type="text"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    className="w-full bg-[#0F0F0F] border border-white/10 focus:border-indigo-500 rounded-xl py-2.5 px-4 text-xs text-slate-200 outline-none transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                    Alter Security Password
                  </label>
                  <input
                    id="edit-user-password"
                    type="password"
                    placeholder="Leave totally blank to preserve current"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    className="w-full bg-[#0F0F0F] border border-white/10 focus:border-indigo-500 rounded-xl py-2.5 px-4 text-xs text-slate-200 placeholder-slate-600 outline-none transition-all"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    *Changing this overrides the encrypted key structure on the server.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                    Security Authorization Level
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setEditRole('Staff')}
                      className={`py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all outline-none cursor-pointer ${
                        editRole === 'Staff'
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-[#0F0F0F] text-slate-400 border-white/5 hover:border-white/10'
                      }`}
                    >
                      <UserCheck size={13} /> Staff
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setEditRole('Admin')}
                      className={`py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all outline-none cursor-pointer ${
                        editRole === 'Admin'
                          ? 'bg-amber-600/20 text-amber-300 border-amber-600/30'
                          : 'bg-[#0F0F0F] text-slate-400 border-white/5 hover:border-white/10'
                      }`}
                    >
                      <Shield size={13} /> Shop Admin
                    </button>
                  </div>
                </div>

                {/* Secure Auth override confirmation block */}
                <div className="bg-amber-950/20 p-4 rounded-xl border border-amber-500/10 space-y-3">
                  <div className="flex gap-2 text-xs text-amber-300 items-start">
                    <Key size={14} className="shrink-0 mt-0.5" />
                    <span>Provide Supervisor Authorization Key:</span>
                  </div>
                  <input
                    id="edit-admin-password-key"
                    type="password"
                    placeholder="Enter Current Admin Password"
                    value={adminPasswordConfirm}
                    onChange={(e) => setAdminPasswordConfirm(e.target.value)}
                    className="w-full bg-[#0F0F0F] border border-amber-500/20 focus:border-amber-500 rounded-xl py-2 px-3 text-xs text-amber-100 placeholder-slate-705 outline-none transition-all text-center"
                    required
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => { setEditingUser(null); setErrorMsg(null); }}
                    className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 text-slate-350 text-xs font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    id="apply-edit-operator-btn"
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-505 text-white text-xs font-bold transition-colors shadow-lg shadow-indigo-600/15"
                  >
                    {isSubmitting ? "Syncing..." : "Apply Updates"}
                  </button>
                </div>
              </form>
            </div>
          ) : userToDelete ? (
            /* PANEL B: DELETE CONFIRMATION EXPLICIT PASSWORD PANEL */
            <div className="bg-[#161616] p-6 border border-red-500/25 rounded-2xl shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <h2 className="text-xs font-mono uppercase tracking-wider text-red-400 flex items-center gap-1.5 font-semibold">
                  <ShieldAlert size={16} /> Danger: Unregister Operator
                </h2>
                <button 
                  onClick={() => { setUserToDelete(null); setErrorMsg(null); }}
                  className="p-1 hover:bg-white/5 rounded text-slate-500 hover:text-slate-200 transition-colors"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="text-xs text-slate-300 leading-relaxed bg-[#0F0F0F] p-3 rounded-xl border border-white/5">
                Are you absolutely sure you want to completely erase the shop access records for <strong className="text-red-300 font-bold">{userToDelete.name}</strong> (Username ID: <code className="text-slate-400 bg-white/5 px-1 rounded">{userToDelete.username}</code>)? All operations journals are preserved but they will no longer be able to open cash registers.
              </div>

              <form onSubmit={handleDeleteUserSubmit} className="space-y-4" id="delete-operator-form">
                <div className="bg-red-950/20 p-4 rounded-xl border border-red-500/10 space-y-3">
                  <div className="flex gap-1.5 text-xs text-red-300 items-start">
                    <Key size={14} className="shrink-0 mt-0.5" />
                    <span>Authorize Deletion with Admin Password:</span>
                  </div>
                  <input
                    id="delete-admin-password-key"
                    type="password"
                    placeholder="Confirm Current Admin Password"
                    value={adminPasswordConfirm}
                    onChange={(e) => setAdminPasswordConfirm(e.target.value)}
                    className="w-full bg-[#0F0F0F] border border-red-500/20 focus:border-red-500 rounded-xl py-2 px-3 text-xs text-red-200 placeholder-slate-700 outline-none transition-all text-center"
                    required
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setUserToDelete(null); setErrorMsg(null); }}
                    className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 text-slate-350 text-xs font-semibold transition-colors"
                  >
                    Cancel Action
                  </button>
                  <button
                    id="confirm-delete-operator-btn"
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-505 text-white text-xs font-bold transition-colors shadow-lg shadow-red-600/15"
                  >
                    {isSubmitting ? "Unregistering..." : "Erase Operator"}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* PANEL C: REGISTER NEW OPERATOR DEFAULT */
            <div className="bg-[#161616] p-6 border border-white/5 rounded-2xl shadow-xl">
              <h2 className="text-xs font-mono uppercase tracking-wider text-indigo-400 border-b border-white/5 pb-3 mb-5 flex items-center gap-2 font-semibold">
                <UserPlus size={16} /> Register New Operator
              </h2>

              <form onSubmit={handleCreateUser} className="space-y-4" id="create-operator-form">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                    Staff Display Name
                  </label>
                  <input
                    id="user-name-input"
                    type="text"
                    placeholder="e.g. Maria Cashier"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-[#0F0F0F] border border-white/10 focus:border-indigo-500 rounded-xl py-2.5 px-4 text-xs text-slate-200 placeholder-slate-700 outline-none transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                    System LogID (Username)
                  </label>
                  <input
                    id="user-username-input"
                    type="text"
                    placeholder="e.g. maria"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-[#0F0F0F] border border-white/10 focus:border-indigo-500 rounded-xl py-2.5 px-4 text-xs text-slate-200 placeholder-slate-700 outline-none transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                    Operator Security Password
                  </label>
                  <input
                    id="user-password-input"
                    type="password"
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#0F0F0F] border border-white/10 focus:border-indigo-500 rounded-xl py-2.5 px-4 text-xs text-slate-200 placeholder-slate-700 outline-none transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                    RBAC Security Role
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      id="user-role-staff"
                      type="button"
                      onClick={() => setRole('Staff')}
                      className={`py-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all outline-none cursor-pointer ${
                        role === 'Staff'
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                          : 'bg-[#0F0F0F] text-slate-400 border-white/5 hover:border-white/10'
                      }`}
                    >
                      <UserCheck size={14} /> Staff Cashier
                    </button>
                    
                    <button
                      id="user-role-admin"
                      type="button"
                      onClick={() => setRole('Admin')}
                      className={`py-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all outline-none cursor-pointer ${
                        role === 'Admin'
                          ? 'bg-amber-600/20 text-amber-300 border-amber-600/30 shadow-md'
                          : 'bg-[#0F0F0F] text-slate-400 border-white/5 hover:border-white/10'
                      }`}
                    >
                      <Shield size={14} /> Shop Admin
                    </button>
                  </div>
                </div>

                {/* Required Current Admin Password */}
                <div className="bg-[#0F0F0F] p-4 border border-white/5 rounded-xl space-y-3">
                  <div className="flex gap-2 text-xs text-indigo-400 font-semibold uppercase font-mono tracking-wider items-center">
                    <Key size={13} />
                    <span>Confirm Admin Password</span>
                  </div>
                  <input
                    id="create-admin-password-key"
                    type="password"
                    placeholder="Your password to approve registration"
                    value={adminPasswordConfirm}
                    onChange={(e) => setAdminPasswordConfirm(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 focus:border-indigo-500 rounded-xl py-2.5 px-4 text-xs text-slate-250 outline-none transition-all placeholder-slate-700 text-center"
                    required
                  />
                </div>

                <button
                  id="user-submit-btn"
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-indigo-600 hover:bg-indigo-505 text-white font-bold h-12 rounded-xl text-xs transition-colors shadow-lg shadow-indigo-600/15 flex items-center justify-center gap-2 mt-4 hover:scale-[1.01]"
                >
                  {isSubmitting ? "Generating secure records..." : "Add Operator"}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Right Column - Registered Users Index list */}
        <div className="lg:col-span-7 bg-[#161616] p-6 border border-white/5 rounded-2xl shadow-xl space-y-4">
          <h2 className="text-xs font-mono uppercase tracking-wider text-indigo-400 border-b border-white/5 pb-3 flex items-center gap-2 font-semibold">
            <FileSliders size={16} /> Active Operators Directory
          </h2>

          <div className="space-y-3">
            {users.map((usr) => {
              const isSelf = usr.id === currentUser.id || usr.username.toLowerCase() === currentUser.username.toLowerCase();

              return (
                <div 
                  key={usr.id} 
                  className="flex items-center justify-between p-4 bg-white/[0.01] rounded-xl border border-white/5 hover:border-white/10 hover:bg-white/[0.02] transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center border font-sans font-semibold text-sm ${
                      usr.role === 'Admin' 
                        ? 'bg-amber-500/10 border-amber-500/10 text-amber-300 font-bold' 
                        : 'bg-indigo-500/10 border-indigo-500/10 text-indigo-300'
                    }`}>
                      {usr.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                        <span>{usr.name}</span>
                        {isSelf && (
                          <span className="text-[8px] uppercase tracking-wider bg-white/10 py-0.5 px-1.5 rounded-full text-slate-400 font-normal">
                            You
                          </span>
                        )}
                      </h3>
                      <p className="text-[10px] font-mono text-slate-500 mt-0.5">
                        Username ID: <span className="text-slate-400 font-semibold">{usr.username}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`text-[9.5px] uppercase font-mono tracking-widest px-2.5 py-1 rounded-full border ${
                      usr.role === 'Admin'
                        ? 'bg-amber-500/10 text-amber-300 border-amber-500/10 font-bold'
                        : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/10'
                    }`}>
                      {usr.role}
                    </span>

                    {/* Operational controls */}
                    <div className="flex items-center gap-1.5 ml-2 border-l border-white/10 pl-3">
                      <button
                        onClick={() => handleStartEdit(usr)}
                        className="p-1.5 text-slate-500 hover:text-indigo-400 hover:bg-white/5 rounded-lg transition-all"
                        title="Edit credentials"
                      >
                        <Edit size={13} />
                      </button>
                      
                      <button
                        onClick={() => handleStartDelete(usr)}
                        className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-white/5 rounded-lg transition-all"
                        title="Delete Operator"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-4 border-t border-white/5 flex gap-2 items-start text-[10px] text-slate-500 bg-[#0F0F0F] p-3 rounded-xl mt-4">
            <Info size={14} className="shrink-0 text-slate-400" />
            <p className="leading-normal">
              Operators credentials are saved in the Node web server configuration. Modifying, registering, or erasing any operator records requires validating your Current Administrator Password to guarantee maximum audit integrity.
            </p>
          </div>
        </div>

      </div>

      {/* --- DATABASE FORMAT / RESET PANEL (ADMIN ONLY) --- */}
      <div className="bg-[#161616] p-6 border border-red-900/10 rounded-2xl shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-3">
          <div className="space-y-1">
            <h2 className="text-xs font-mono uppercase tracking-wider text-red-400 flex items-center gap-2 font-semibold">
              <ShieldAlert size={16} /> Danger Zone: Formatage du Point de Vente (POS Reset)
            </h2>
            <p className="text-xs text-slate-500">
              Effacer tous les articles, l'historique des ventes et les dépenses pour recommencer à zéro.
            </p>
          </div>
          
          {!showResetConfirm ? (
            <button
              onClick={() => {
                setShowResetConfirm(true);
                setResetError(null);
                setResetSuccess(null);
              }}
              className="px-4 py-2.5 bg-red-600/10 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/25 hover:border-red-600 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer"
            >
              Formater le Système
            </button>
          ) : (
            <button
              onClick={() => setShowResetConfirm(false)}
              className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer"
            >
              Annuler
            </button>
          )}
        </div>

        {resetError && (
          <div className="p-3 bg-red-950/20 border border-red-900/30 rounded-xl text-xs text-red-400">
            {resetError}
          </div>
        )}

        {resetSuccess && (
          <div className="p-3 bg-emerald-950/20 border border-emerald-900/30 rounded-xl text-xs text-emerald-400">
            {resetSuccess}
          </div>
        )}

        {showResetConfirm && (
          <form onSubmit={handleResetDatabaseSubmit} className="bg-black/30 p-4 rounded-xl border border-red-950/25 space-y-4">
            <div className="flex gap-2.5 items-start text-xs text-red-400">
              <Info size={16} className="shrink-0 text-red-500 mt-0.5" />
              <p className="leading-relaxed text-slate-400">
                <strong>Attention:</strong> Cette action est irréversible. Le formatage supprimera définitivement tous les produits/articles de l'inventaire, toutes les factures de ventes et toutes les dépenses enregistrées. Les comptes d'utilisateurs et leurs mots de passe resteront intacts.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              <div className="md:col-span-8 space-y-1.5">
                <label className="text-[10px] font-mono uppercase text-slate-500">MOT DE PASSE DE L'ADMINISTRATEUR POUR CONFIRMER</label>
                <input
                  type="password"
                  placeholder="Saisissez votre mot de passe administrateur"
                  value={resetAdminPassword}
                  onChange={(e) => setResetAdminPassword(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 focus:border-red-500 rounded-xl py-2 px-4 text-xs text-slate-200 outline-none transition-all"
                  required
                />
              </div>

              <div className="md:col-span-4">
                <button
                  type="submit"
                  disabled={isResettingDb}
                  className="w-full h-10 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isResettingDb ? "Formatage..." : "CONFIRMER LE FORMATAGE"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

    </div>
  );
}
